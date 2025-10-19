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

    // Get framework-specific mock syntax
    const mockSyntax = this.getFrameworkMockSyntax(framework);
    
    // Generate mock guidance based on whether function is pure
    const mockGuidance = strategy.mockStrategy.dependencies.length === 0
      ? `
## Mock Strategy for This Function

✓ This is a **PURE FUNCTION** with no side effects.
✓ **DO NOT add any mocks or ${mockSyntax.mock} calls.**
✓ Test the function directly with real inputs and outputs.
✓ Keep the test simple and focused on the function logic.
`
      : `
## Mock Strategy for This Function

⚠️ This function has side effects: ${context.sideEffects.map((se) => se.type).join(', ')}
⚠️ Mock these dependencies: ${strategy.mockStrategy.dependencies.join(', ')}

Use appropriate mocking for side effects:
- Network calls (fetch/axios): Use ${mockSyntax.mock}
- File system (fs): Mock fs module with ${mockSyntax.spy}
- Database: Mock database client
- State mutations: Mock state management
`;

    // Get framework-specific syntax guide
    const frameworkGuide = this.getFrameworkGuide(framework);
    
    // Get strict function signature constraints
    const signatureConstraints = this.buildSignatureConstraints(context);
    
    // Calculate correct import path
    const testFilePath = context.signature.filePath.replace(/\.(ts|js)$/, '.test.$1');
    const importPath = this.calculateImportPath(testFilePath, context.signature.filePath);
    
    return `You are an expert test engineer. Generate comprehensive unit tests for the following function.

## Function to Test

**Source file:** ${context.signature.filePath}
**Test file location:** ${testFilePath} (same directory as source)

\`\`\`typescript
${this.formatFunctionSignature(context)}
\`\`\`

## Import Statement (CRITICAL - Use Exactly As Shown)

**REQUIRED import statement:**
\`\`\`typescript
import { ${context.signature.name} } from '${importPath}';
\`\`\`

**DO NOT use:**
- ❌ \`from '../lib/${context.signature.name}'\` (wrong relative path)
- ❌ \`from '../../lib/${context.signature.name}'\` (wrong depth)
- ❌ \`from '@/lib/${context.signature.name}'\` (aliased paths for source, not tests)

**MUST use:** \`from '${importPath}'\` exactly as shown above.

${signatureConstraints}

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

${frameworkGuide}

## Requirements

1. **CRITICAL**: Use ${framework} testing framework (see syntax above)
2. Follow ${strategy.type} pattern (Arrange-Act-Assert)
3. Include descriptive test names that explain what is being tested
4. Test both happy paths and error cases
5. **Use specific assertions**: expect(result).toBe(5) NOT expect(result).toBeDefined()
6. **Avoid unnecessary mocks**: Only mock external dependencies with side effects
7. **ONLY use imports that actually exist in the source file** - DO NOT invent helper functions
8. Ensure tests are independent and can run in any order
9. Add comments explaining non-obvious logic
10. **Generate at least ONE test case** - even simple functions need tests

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
   * Get framework-specific mock syntax
   */
  private getFrameworkMockSyntax(framework: string): { mock: string; spy: string; fn: string } {
    const defaultSyntax = {
      mock: 'jest.mock()',
      spy: 'jest.spyOn()',
      fn: 'jest.fn()',
    };
    
    const syntaxMap: Record<string, { mock: string; spy: string; fn: string }> = {
      vitest: {
        mock: 'vi.mock()',
        spy: 'vi.spyOn()',
        fn: 'vi.fn()',
      },
      jest: defaultSyntax,
      mocha: {
        mock: 'sinon.stub()',
        spy: 'sinon.spy()',
        fn: 'sinon.fake()',
      },
    };

    return syntaxMap[framework] ?? defaultSyntax;
  }

  /**
   * Get framework-specific syntax guide
   */
  private getFrameworkGuide(framework: string): string {
    if (framework === 'vitest') {
      return `
## Testing Framework: Vitest

**CRITICAL**: This project uses **VITEST**, NOT Jest.

**Required Imports:**
\`\`\`typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
\`\`\`

**Correct Syntax:**
- Mock modules: \`vi.mock('./module')\`
- Spy on functions: \`vi.spyOn(obj, 'method')\`
- Create mock functions: \`vi.fn()\`
- Restore mocks: \`vi.restoreAllMocks()\`

**WRONG (Do NOT use):**
- ❌ jest.mock
- ❌ jest.spyOn
- ❌ jest.fn

**Example:**
\`\`\`typescript
import { describe, it, expect, vi } from 'vitest';

describe('myFunction', () => {
  it('should work', () => {
    const spy = vi.spyOn(console, 'log');
    // ... test code
    expect(spy).toHaveBeenCalled();
  });
});
\`\`\`
`;
    } else if (framework === 'jest') {
      return `
## Testing Framework: Jest

**Required Imports:**
\`\`\`typescript
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
\`\`\`

**Syntax:**
- Mock modules: \`jest.mock('./module')\`
- Spy on functions: \`jest.spyOn(obj, 'method')\`
- Create mock functions: \`jest.fn()\`
`;
    } else {
      return `
## Testing Framework: ${framework}

Use ${framework} testing conventions.
`;
    }
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

  /**
   * Calculate import path from test file to source file
   */
  private calculateImportPath(testFilePath: string, sourceFilePath: string): string {
    const path = require('path');
    const testDir = path.dirname(testFilePath);
    const sourceDir = path.dirname(sourceFilePath);
    const sourceName = path.parse(sourceFilePath).name;
    
    // Calculate relative path
    const relativePath = path.relative(testDir, sourceDir);
    
    if (relativePath === '' || relativePath === '.') {
      // Same directory: ./format
      return `./${sourceName}`;
    } else {
      // Different directory: ../lib/format
      const importPath = path.join(relativePath, sourceName);
      // Normalize to forward slashes for imports
      return importPath.replace(/\\/g, '/');
    }
  }

  /**
   * Build strict function signature constraints
   * Prevents LLM from assuming function signatures
   */
  private buildSignatureConstraints(context: FunctionContext): string {
    const { signature } = context;
    const params = signature.parameters;
    
    // Generate readable signature
    let signatureDisplay: string;
    if (params.length === 0) {
      signatureDisplay = `${signature.name}()  // ← ZERO parameters, NO arguments`;
    } else {
      const paramList = params.map(p => 
        `${p.name}: ${p.type || 'any'}${p.optional ? '?' : ''}`
      ).join(', ');
      signatureDisplay = `${signature.name}(${paramList})`;
    }
    
    let constraints = `
## Function Signature (CRITICAL - Use Exactly As Shown)

\`\`\`typescript
function ${signatureDisplay}
\`\`\`

**STRICT REQUIREMENTS:**
`;

    if (params.length === 0) {
      constraints += `
1. ❌ **DO NOT add any parameters** - this function has ZERO parameters
2. ❌ **DO NOT create mock state/config objects** as parameters
3. ✅ **MUST call as**: \`${signature.name}()\` with NO arguments
4. ✅ Test the function's actual behavior (global state, return value, side effects)

**WRONG examples (DO NOT DO THIS):**
\`\`\`typescript
${signature.name}(mockState);          // ❌ WRONG - no parameters exist
${signature.name}({ config: true });   // ❌ WRONG - inventing parameters
${signature.name}(arg1, arg2);         // ❌ WRONG - function takes 0 args
\`\`\`

**CORRECT example:**
\`\`\`typescript
const result = ${signature.name}();    // ✅ CORRECT - no arguments
expect(result).toBe(...);              // Test the return value
\`\`\`
`;
    } else {
      constraints += `
1. ✅ **MUST use exactly these ${params.length} parameter(s)**
2. ❌ **DO NOT add extra parameters** beyond these ${params.length}
3. ❌ **DO NOT change parameter types**
4. ✅ **Call as**: \`${signature.name}(${params.map(p => p.name).join(', ')})\`

**Parameter details:**
${params.map((p, i) => `
${i + 1}. \`${p.name}\`: ${p.type || 'any'}${p.optional ? ' (optional)' : ''}${p.defaultValue ? ` = ${p.defaultValue}` : ''}
`).join('')}
`;
    }
    
    return constraints;
  }
}















