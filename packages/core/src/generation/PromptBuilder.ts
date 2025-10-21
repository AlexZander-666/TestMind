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
    
    // Generate mock guidance based on whether function is pure (optimized)
    const mockGuidance = strategy.mockStrategy.dependencies.length === 0
      ? `
## Mocks

Pure function - NO mocks needed. Test with real inputs/outputs.
`
      : `
## Mocks

Side effects: ${context.sideEffects.map((se) => se.type).join(', ')}
Mock: ${strategy.mockStrategy.dependencies.join(', ')} using ${mockSyntax.mock}
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

## Import

\`\`\`typescript
import { ${context.signature.name} } from '${importPath}';
\`\`\`

⚠️ Use this exact path: \`'${importPath}'\` (not @/ alias or wrong depth)

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

1. Use ${framework} framework (syntax above)
2. Follow ${strategy.type} pattern  
3. Descriptive test names
4. Test happy & error paths
5. Specific assertions (toBe not toBeDefined)
6. Mock only real dependencies
7. No invented imports/functions
8. At least ONE test case

## Output

Return ONLY test code in TypeScript code block.
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
   * Get framework-specific syntax guide (optimized version)
   */
  private getFrameworkGuide(framework: string): string {
    if (framework === 'vitest') {
      return `
## Framework: Vitest

Import: \`import { describe, it, expect, vi } from 'vitest';\`
Mock: \`vi.mock()\` | Spy: \`vi.spyOn()\` | Fn: \`vi.fn()\`
❌ Do NOT use jest.* syntax
`;
    } else if (framework === 'jest') {
      return `
## Framework: Jest

Import: \`import { describe, it, expect, jest } from '@jest/globals';\`
Mock: \`jest.mock()\` | Spy: \`jest.spyOn()\` | Fn: \`jest.fn()\`
`;
    } else {
      return `## Framework: ${framework}\n`;
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
   * Build strict function signature constraints (optimized version)
   */
  private buildSignatureConstraints(context: FunctionContext): string {
    const { signature } = context;
    const params = signature.parameters;
    
    if (params.length === 0) {
      return `
## Signature: \`${signature.name}()\`

⚠️ ZERO parameters - call as \`${signature.name}()\` with NO arguments
❌ Do NOT invent parameters or pass mock objects
`;
    }
    
    const paramList = params.map(p => 
      `${p.name}: ${p.type || 'any'}${p.optional ? '?' : ''}${p.defaultValue ? ` = ${p.defaultValue}` : ''}`
    ).join(', ');
    
    return `
## Signature: \`${signature.name}(${paramList})\`

Use exactly these ${params.length} parameter(s). Do NOT add/change parameters.
`;
  }
}















