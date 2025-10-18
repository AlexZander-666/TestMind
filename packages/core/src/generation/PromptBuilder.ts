/**
 * PromptBuilder: Construct optimized prompts for LLM
 */

import type { FunctionContext, TestStrategy, TestType } from '@testmind/shared';

export interface PromptContext {
  context: FunctionContext;
  strategy: TestStrategy;
  framework: string;
  examples: unknown[];
}

export class PromptBuilder {
  /**
   * Build prompt for unit test generation
   */
  buildUnitTestPrompt(promptContext: PromptContext): string {
    const { context, strategy, framework } = promptContext;

    // Generate mock guidance based on whether function is pure
    const mockGuidance = strategy.mockStrategy.dependencies.length === 0
      ? `
## Mock Strategy for This Function

✓ This is a **PURE FUNCTION** with no side effects.
✓ **DO NOT add any mocks or jest.mock() calls.**
✓ Test the function directly with real inputs and outputs.
✓ Keep the test simple and focused on the function logic.
`
      : `
## Mock Strategy for This Function

⚠️ This function has side effects: ${context.sideEffects.map((se) => se.type).join(', ')}
⚠️ Mock these dependencies: ${strategy.mockStrategy.dependencies.join(', ')}

Use appropriate mocking for side effects:
- Network calls (fetch/axios): Use jest.mock() or nock
- File system (fs): Mock fs module
- Database: Mock database client
- State mutations: Mock state management
`;

    return `You are an expert test engineer. Generate comprehensive unit tests for the following function.

## Function to Test

\`\`\`typescript
${this.formatFunctionSignature(context)}
\`\`\`

## Function Details

- **Name**: ${context.signature.name}
- **File**: ${context.signature.filePath}
- **Async**: ${context.signature.isAsync ? 'Yes' : 'No'}
- **Complexity**: Cyclomatic ${context.complexity.cyclomaticComplexity}, Cognitive ${context.complexity.cognitiveComplexity}
- **Dependencies**: ${context.dependencies.map((d) => d.name).join(', ') || 'None'}
- **Side Effects**: ${context.sideEffects.length > 0 ? context.sideEffects.map((se) => se.type).join(', ') : 'None (Pure function)'}

${mockGuidance}

## Test Strategy

- **Pattern**: ${strategy.type}

## Boundary Conditions to Test

${strategy.boundaryConditions.map((bc) => `- **${bc.parameter}**: ${bc.reasoning}`).join('\n') || '- None identified'}

## Edge Cases to Cover

${strategy.edgeCases.map((ec) => `- **${ec.scenario}**: ${ec.expectedBehavior}`).join('\n') || '- None identified'}

## Requirements

1. Use ${framework} testing framework
2. Follow ${strategy.type} pattern (Arrange-Act-Assert)
3. Include descriptive test names that explain what is being tested
4. Test both happy paths and error cases
5. **Use specific assertions**: expect(result).toBe(5) NOT expect(result).toBeDefined()
6. **Avoid unnecessary mocks**: Only mock external dependencies with side effects
7. Ensure tests are independent and can run in any order
8. Add comments explaining non-obvious logic
9. Keep tests simple and maintainable

## Output Format

Generate ONLY the test code, wrapped in a TypeScript code block. Do not include explanations outside the code block.

\`\`\`typescript
// Your generated test code here
\`\`\`
`;
  }

  /**
   * Build prompt for integration test generation
   */
  buildIntegrationTestPrompt(modulePath: string, integrationPoints: string[]): string {
    return `Generate integration tests for module: ${modulePath}
Integration points: ${integrationPoints.join(', ')}
// TODO: Implement full prompt`;
  }

  /**
   * Format function signature for display
   */
  private formatFunctionSignature(context: FunctionContext): string {
    const { signature } = context;
    const params = signature.parameters
      .map((p) => {
        const optional = p.optional ? '?' : '';
        const type = p.type ? `: ${p.type}` : '';
        const defaultVal = p.defaultValue ? ` = ${p.defaultValue}` : '';
        return `${p.name}${optional}${type}${defaultVal}`;
      })
      .join(', ');

    const asyncKeyword = signature.isAsync ? 'async ' : '';
    const returnType = signature.returnType ? `: ${signature.returnType}` : '';

    return `${asyncKeyword}function ${signature.name}(${params})${returnType}`;
  }
}















