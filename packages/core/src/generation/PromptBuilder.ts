/**
 * PromptBuilder: Construct optimized prompts for LLM
 * 
 * Enhanced with:
 * - Tiered prompt strategy (simple vs complex functions)
 * - Framework-specific best practices
 * - Error case learning from failed generations
 */

import type { FunctionContext, TestStrategy, TestType } from '@testmind/shared';

export interface PromptContext {
  context: FunctionContext;
  strategy: TestStrategy;
  framework: string;
  examples: unknown[];
}

export interface PromptTier {
  complexity: 'simple' | 'moderate' | 'complex';
  verbosity: 'minimal' | 'standard' | 'detailed';
  includeExamples: boolean;
  includeErrorCases: boolean;
}

export interface FrameworkBestPractice {
  name: string;
  practices: string[];
  antiPatterns: string[];
  examples?: string[];
}

export class PromptBuilder {
  private commonErrorCases: string[] = [];
  
  constructor() {
    // Initialize with common error patterns to avoid
    this.commonErrorCases = [
      'Inventing parameters that don\'t exist in the function signature',
      'Using wrong import paths (too many ../ or wrong file names)',
      'Mixing test frameworks (using jest.* in vitest)',
      'Creating empty test cases without assertions',
      'Testing implementation details instead of behavior',
      'Overcomplicating mocks for pure functions',
    ];
  }
  
  /**
   * Determine prompt tier based on function complexity
   */
  private determinePromptTier(context: FunctionContext): PromptTier {
    const cyclomaticComplexity = context.complexity.cyclomaticComplexity;
    const hasSideEffects = context.sideEffects.length > 0;
    const hasMultipleDeps = context.dependencies.length > 2;
    
    // Simple: low complexity, pure function
    if (cyclomaticComplexity <= 3 && !hasSideEffects && !hasMultipleDeps) {
      return {
        complexity: 'simple',
        verbosity: 'minimal',
        includeExamples: false,
        includeErrorCases: false,
      };
    }
    
    // Complex: high complexity, side effects, or many dependencies
    if (cyclomaticComplexity > 10 || (hasSideEffects && hasMultipleDeps)) {
      return {
        complexity: 'complex',
        verbosity: 'detailed',
        includeExamples: true,
        includeErrorCases: true,
      };
    }
    
    // Moderate: everything else
    return {
      complexity: 'moderate',
      verbosity: 'standard',
      includeExamples: false,
      includeErrorCases: true,
    };
  }
  
  /**
   * Build prompt for unit test generation with tiered strategy
   */
  buildUnitTestPrompt(promptContext: PromptContext): string {
    const { context, strategy, framework } = promptContext;
    const tier = this.determinePromptTier(context);

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

    // Get framework-specific syntax guide with best practices
    const frameworkGuide = this.getFrameworkGuideWithBestPractices(framework);
    
    // Get strict function signature constraints
    const signatureConstraints = this.buildSignatureConstraints(context);
    
    // Build error avoidance section if needed
    const errorAvoidance = tier.includeErrorCases ? this.buildErrorAvoidanceSection() : '';
    
    // Build complexity-specific guidance
    const complexityGuidance = this.buildComplexityGuidance(tier, context);
    
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

${complexityGuidance}

${errorAvoidance}
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
   * Get framework-specific syntax guide with best practices
   */
  private getFrameworkGuideWithBestPractices(framework: string): string {
    const bestPractices = this.getFrameworkBestPractices(framework);
    const syntaxGuide = this.getFrameworkGuide(framework);
    
    if (!bestPractices) {
      return syntaxGuide;
    }
    
    const practicesSection = `
### Best Practices for ${bestPractices.name}

✅ DO:
${bestPractices.practices.map(p => `- ${p}`).join('\n')}

❌ DON'T:
${bestPractices.antiPatterns.map(ap => `- ${ap}`).join('\n')}
`;
    
    return syntaxGuide + practicesSection;
  }
  
  /**
   * Get framework-specific syntax guide
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
   * Get framework-specific best practices
   */
  private getFrameworkBestPractices(framework: string): FrameworkBestPractice | null {
    const practices: Record<string, FrameworkBestPractice> = {
      cypress: {
        name: 'Cypress',
        practices: [
          'Use data-testid for stable selectors: cy.get(\'[data-testid="submit-btn"]\')',
          'Use cy.intercept() for API mocking',
          'Avoid cy.wait() with hardcoded times, use aliases instead',
          'Chain commands properly: cy.get().should().click()',
          'Use custom commands for repeated actions',
        ],
        antiPatterns: [
          'Using class names for selectors (brittle, changes often)',
          'Selecting by text content without data-testid',
          'Testing implementation details',
          'Overusing cy.wait()',
          'Not cleaning up state between tests',
        ],
      },
      playwright: {
        name: 'Playwright',
        practices: [
          'Use getByRole() for accessible selectors: page.getByRole(\'button\', { name: \'Submit\' })',
          'Leverage auto-waiting: Playwright waits automatically',
          'Use page object model for complex flows',
          'Test across multiple browsers (chromium, firefox, webkit)',
          'Use .locator() for flexible element selection',
        ],
        antiPatterns: [
          'Using XPath when getByRole/getByTestId would work',
          'Manual waits (waitForTimeout) instead of auto-waiting',
          'Not using test fixtures for setup/teardown',
          'Ignoring accessibility in selectors',
          'Hardcoding delays',
        ],
      },
      'react-testing-library': {
        name: 'React Testing Library',
        practices: [
          'Query by role/label/text: getByRole(\'button\', { name: /submit/i })',
          'Use userEvent over fireEvent for realistic interactions',
          'Test user behavior, not implementation details',
          'Use waitFor() for async updates',
          'Avoid querying by className or id',
        ],
        antiPatterns: [
          'Testing component internal state',
          'Using container.querySelector()',
          'fireEvent instead of userEvent',
          'Not using *ByRole queries',
          'Testing props directly instead of rendered output',
        ],
      },
    };
    
    return practices[framework] || null;
  }
  
  /**
   * Build complexity-specific guidance
   */
  private buildComplexityGuidance(tier: PromptTier, context: FunctionContext): string {
    if (tier.complexity === 'simple') {
      return `
## 💡 Guidance (Simple Function)

This is a simple function - keep tests straightforward:
- Focus on core functionality
- Use minimal mocks (if any)
- Keep it concise but thorough
`;
    }
    
    if (tier.complexity === 'complex') {
      return `
## 💡 Guidance (Complex Function)

This is a complex function - use structured approach:
- Break down into scenarios
- Consider Chain-of-Thought: describe logic first, then test
- Mock external dependencies carefully
- Test error paths thoroughly
- Consider edge cases thoroughly
`;
    }
    
    return ''; // Standard complexity needs no extra guidance
  }
  
  /**
   * Build error avoidance section from learned cases
   */
  private buildErrorAvoidanceSection(): string {
    if (this.commonErrorCases.length === 0) {
      return '';
    }
    
    return `
## ⚠️ Common Mistakes to Avoid

Learn from past errors - DO NOT:
${this.commonErrorCases.map(error => `- ${error}`).join('\n')}
`;
  }
  
  /**
   * Add a new error case to learn from
   */
  public learnFromError(errorDescription: string): void {
    if (!this.commonErrorCases.includes(errorDescription)) {
      this.commonErrorCases.push(errorDescription);
      
      // Keep only last 10 errors to avoid prompt bloat
      if (this.commonErrorCases.length > 10) {
        this.commonErrorCases.shift();
      }
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















