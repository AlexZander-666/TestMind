/**
 * PromptBuilder 增强功能单元测试
 * 测试分层策略、框架最佳实践、错误学习
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PromptBuilder, type PromptContext } from '../PromptBuilder';
import type { FunctionContext } from '@testmind/shared';

describe('PromptBuilder - Enhanced Features', () => {
  let builder: PromptBuilder;

  beforeEach(() => {
    builder = new PromptBuilder();
  });

  describe('Tiered Prompt Strategy', () => {
    it('should generate minimal prompt for simple functions', () => {
      const simpleContext: PromptContext = {
        context: createMockContext({
          name: 'add',
          complexity: 2,
          sideEffects: [],
          dependencies: [],
        }),
        strategy: {
          type: 'AAA',
          mockStrategy: { dependencies: [] },
          boundaryConditions: [],
          edgeCases: [],
        },
        framework: 'vitest',
        examples: [],
      };

      const prompt = builder.buildUnitTestPrompt(simpleContext);

      // 简单函数应该包含简化指导
      expect(prompt).toContain('simple function');
      expect(prompt).toContain('keep tests straightforward');
      
      // 不应该包含复杂函数的指导
      expect(prompt).not.toContain('Chain-of-Thought');
    });

    it('should generate detailed prompt for complex functions', () => {
      const complexContext: PromptContext = {
        context: createMockContext({
          name: 'processUserData',
          complexity: 15,
          sideEffects: [
            { type: 'database_write', target: 'users table' },
            { type: 'api_call', target: 'external API' },
          ],
          dependencies: [
            { name: 'database', type: 'external' },
            { name: 'apiClient', type: 'external' },
            { name: 'logger', type: 'external' },
          ],
        }),
        strategy: {
          type: 'AAA',
          mockStrategy: { dependencies: ['database', 'apiClient'] },
          boundaryConditions: [
            { parameter: 'userData', reasoning: 'Can be null' },
          ],
          edgeCases: [
            { scenario: 'Empty data', expectedBehavior: 'Throw error' },
          ],
        },
        framework: 'vitest',
        examples: [],
      };

      const prompt = builder.buildUnitTestPrompt(complexContext);

      // 复杂函数应该包含详细指导
      expect(prompt).toContain('complex function');
      expect(prompt).toContain('Chain-of-Thought');
      expect(prompt).toContain('Mock external dependencies carefully');
    });

    it('should use standard prompt for moderate complexity', () => {
      const moderateContext: PromptContext = {
        context: createMockContext({
          name: 'validateEmail',
          complexity: 6,
          sideEffects: [],
          dependencies: [{ name: 'validator', type: 'internal' }],
        }),
        strategy: {
          type: 'AAA',
          mockStrategy: { dependencies: [] },
          boundaryConditions: [],
          edgeCases: [],
        },
        framework: 'vitest',
        examples: [],
      };

      const prompt = builder.buildUnitTestPrompt(moderateContext);

      // 中等复杂度不应该有特殊指导
      expect(prompt).not.toContain('simple function');
      expect(prompt).not.toContain('complex function');
    });
  });

  describe('Framework Best Practices', () => {
    it('should include Cypress best practices', () => {
      const context = createBasicPromptContext('cypress');
      const prompt = builder.buildUnitTestPrompt(context);

      expect(prompt).toContain('Cypress');
      expect(prompt).toContain('data-testid');
      expect(prompt).toContain('cy.intercept()');
      expect(prompt).toContain('class names');
    });

    it('should include Playwright best practices', () => {
      const context = createBasicPromptContext('playwright');
      const prompt = builder.buildUnitTestPrompt(context);

      expect(prompt).toContain('Playwright');
      expect(prompt).toContain('getByRole()');
      expect(prompt).toContain('auto-waiting');
      expect(prompt).toContain('XPath');
    });

    it('should include React Testing Library best practices', () => {
      const context = createBasicPromptContext('react-testing-library');
      const prompt = builder.buildUnitTestPrompt(context);

      expect(prompt).toContain('React Testing Library');
      expect(prompt).toContain('getByRole');
      expect(prompt).toContain('userEvent');
      expect(prompt).toContain('fireEvent');
    });

    it('should not include best practices for unknown frameworks', () => {
      const context = createBasicPromptContext('unknown-framework');
      const prompt = builder.buildUnitTestPrompt(context);

      expect(prompt).toContain('unknown-framework');
      expect(prompt).not.toContain('Best Practices');
    });
  });

  describe('Error Case Learning', () => {
    it('should include error avoidance section for complex functions', () => {
      const complexContext: PromptContext = {
        context: createMockContext({
          name: 'complex',
          complexity: 12,
          sideEffects: [],
          dependencies: [],
        }),
        strategy: {
          type: 'AAA',
          mockStrategy: { dependencies: [] },
          boundaryConditions: [],
          edgeCases: [],
        },
        framework: 'vitest',
        examples: [],
      };

      const prompt = builder.buildUnitTestPrompt(complexContext);

      expect(prompt).toContain('Common Mistakes to Avoid');
      expect(prompt).toContain('Inventing parameters');
      expect(prompt).toContain('wrong import paths');
    });

    it('should not include error section for simple functions', () => {
      const simpleContext: PromptContext = {
        context: createMockContext({
          name: 'simple',
          complexity: 2,
          sideEffects: [],
          dependencies: [],
        }),
        strategy: {
          type: 'AAA',
          mockStrategy: { dependencies: [] },
          boundaryConditions: [],
          edgeCases: [],
        },
        framework: 'vitest',
        examples: [],
      };

      const prompt = builder.buildUnitTestPrompt(simpleContext);

      expect(prompt).not.toContain('Common Mistakes to Avoid');
    });

    it('should allow learning from new errors', () => {
      builder.learnFromError('Using incorrect module imports');
      
      const complexContext: PromptContext = {
        context: createMockContext({
          name: 'complex',
          complexity: 12,
          sideEffects: [],
          dependencies: [],
        }),
        strategy: {
          type: 'AAA',
          mockStrategy: { dependencies: [] },
          boundaryConditions: [],
          edgeCases: [],
        },
        framework: 'vitest',
        examples: [],
      };

      const prompt = builder.buildUnitTestPrompt(complexContext);

      expect(prompt).toContain('Using incorrect module imports');
    });

    it('should limit error cases to 10', () => {
      // 添加超过 10 个错误
      for (let i = 0; i < 15; i++) {
        builder.learnFromError(`Error ${i}`);
      }

      const complexContext: PromptContext = {
        context: createMockContext({
          name: 'complex',
          complexity: 12,
          sideEffects: [],
          dependencies: [],
        }),
        strategy: {
          type: 'AAA',
          mockStrategy: { dependencies: [] },
          boundaryConditions: [],
          edgeCases: [],
        },
        framework: 'vitest',
        examples: [],
      };

      const prompt = builder.buildUnitTestPrompt(complexContext);

      // 应该只包含最近的 10 个
      expect(prompt).toContain('Error 14');
      expect(prompt).not.toContain('Error 0');
      expect(prompt).not.toContain('Error 1');
      expect(prompt).not.toContain('Error 2');
      expect(prompt).not.toContain('Error 3');
      expect(prompt).not.toContain('Error 4');
    });
  });

  describe('Integration', () => {
    it('should generate complete prompt with all enhancements', () => {
      const context: PromptContext = {
        context: createMockContext({
          name: 'authenticateUser',
          complexity: 8,
          sideEffects: [{ type: 'api_call', target: 'auth service' }],
          dependencies: [{ name: 'authService', type: 'external' }],
        }),
        strategy: {
          type: 'AAA',
          mockStrategy: { dependencies: ['authService'] },
          boundaryConditions: [
            { parameter: 'username', reasoning: 'Can be empty' },
          ],
          edgeCases: [
            { scenario: 'Invalid credentials', expectedBehavior: 'Throw error' },
          ],
        },
        framework: 'vitest',
        examples: [],
      };

      const prompt = builder.buildUnitTestPrompt(context);

      // 应该包含所有关键部分
      expect(prompt).toContain('authenticateUser');
      expect(prompt).toContain('Framework: Vitest');
      expect(prompt).toContain('Boundary Conditions');
      expect(prompt).toContain('Edge Cases');
      expect(prompt).toContain('authService');
      expect(prompt.length).toBeGreaterThan(500);
    });
  });
});

// 辅助函数
function createMockContext(options: {
  name: string;
  complexity: number;
  sideEffects: any[];
  dependencies: any[];
}): FunctionContext {
  return {
    signature: {
      name: options.name,
      filePath: `/test/src/${options.name}.ts`,
      parameters: [],
      returnType: 'void',
      isAsync: false,
    },
    dependencies: options.dependencies,
    callers: [],
    sideEffects: options.sideEffects,
    existingTests: [],
    coverage: {
      linesCovered: 0,
      linesTotal: 10,
      branchesCovered: 0,
      branchesTotal: 0,
      functionsCovered: 0,
      functionsTotal: 1,
      percentage: 0,
    },
    complexity: {
      cyclomaticComplexity: options.complexity,
      cognitiveComplexity: options.complexity,
      halsteadMetrics: {
        vocabulary: 10,
        length: 20,
        volume: 30,
        difficulty: 5,
        effort: 150,
      },
    },
    strategy: {
      type: 'AAA',
      mockStrategy: { dependencies: [] },
      boundaryConditions: [],
      edgeCases: [],
    },
  };
}

function createBasicPromptContext(framework: string): PromptContext {
  return {
    context: createMockContext({
      name: 'testFunction',
      complexity: 5,
      sideEffects: [],
      dependencies: [],
    }),
    strategy: {
      type: 'AAA',
      mockStrategy: { dependencies: [] },
      boundaryConditions: [],
      edgeCases: [],
    },
    framework,
    examples: [],
  };
}





















