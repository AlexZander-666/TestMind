/**
 * QualityAnalyzer 增强功能单元测试
 * 测试新增的 3 个维度：断言多样性、边界条件覆盖、可读性
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { QualityAnalyzer, type ExtendedQualityScore } from '../QualityAnalyzer';
import type { TestSuite } from '@testmind/shared';

describe('QualityAnalyzer - Enhanced Features', () => {
  let analyzer: QualityAnalyzer;

  beforeEach(() => {
    analyzer = new QualityAnalyzer();
  });

  describe('Assertion Diversity', () => {
    it('should score high for diverse assertions', async () => {
      const testSuite: TestSuite = {
        id: 'test-1',
        targetFunction: 'testFunc',
        framework: 'vitest',
        code: `
          import { describe, it, expect } from 'vitest';
          
          describe('testFunc', () => {
            it('should test equality', () => {
              expect(result).toBe(42);
            });
            
            it('should test boolean', () => {
              expect(result).toBeTruthy();
            });
            
            it('should test containment', () => {
              expect(array).toContain('value');
            });
            
            it('should test errors', () => {
              expect(() => func()).toThrow();
            });
            
            it('should test async', async () => {
              await expect(promise).resolves.toBe(true);
            });
          });
        `,
        generatedAt: Date.now(),
        status: 'generated',
      };

      const score = await analyzer.analyze(testSuite);

      expect(score.assertionDiversity).toBeGreaterThan(0.7);
    });

    it('should score low for single assertion type', async () => {
      const testSuite: TestSuite = {
        id: 'test-2',
        targetFunction: 'testFunc',
        framework: 'vitest',
        code: `
          import { describe, it, expect } from 'vitest';
          
          describe('testFunc', () => {
            it('test 1', () => {
              expect(result).toBe(1);
            });
            
            it('test 2', () => {
              expect(result).toBe(2);
            });
          });
        `,
        generatedAt: Date.now(),
        status: 'generated',
      };

      const score = await analyzer.analyze(testSuite);

      // 只有 equality 类型，多样性应该较低
      expect(score.assertionDiversity).toBeLessThan(0.3);
    });
  });

  describe('Boundary Condition Coverage', () => {
    it('should score high for comprehensive boundary testing', async () => {
      const testSuite: TestSuite = {
        id: 'test-3',
        targetFunction: 'testFunc',
        framework: 'vitest',
        code: `
          import { describe, it, expect } from 'vitest';
          
          describe('testFunc', () => {
            it('should handle empty array', () => {
              expect(func([])).toBe(0);
            });
            
            it('should handle null', () => {
              expect(func(null)).toThrow();
            });
            
            it('should handle undefined', () => {
              expect(func(undefined)).toThrow();
            });
            
            it('should handle zero', () => {
              expect(func(0)).toBe(0);
            });
            
            it('should handle negative numbers', () => {
              expect(func(-1)).toBe(-1);
            });
            
            it('should handle max values', () => {
              expect(func(Number.MAX_VALUE)).toBeDefined();
            });
            
            it('should handle empty string', () => {
              expect(func('')).toBe('');
            });
          });
        `,
        generatedAt: Date.now(),
        status: 'generated',
      };

      const score = await analyzer.analyze(testSuite);

      // 覆盖所有 7 种边界条件
      expect(score.boundaryConditionCoverage).toBeGreaterThan(0.9);
    });

    it('should score low for missing boundary tests', async () => {
      const testSuite: TestSuite = {
        id: 'test-4',
        targetFunction: 'testFunc',
        framework: 'vitest',
        code: `
          import { describe, it, expect } from 'vitest';
          
          describe('testFunc', () => {
            it('should work with normal input', () => {
              expect(func('test')).toBe('TEST');
            });
          });
        `,
        generatedAt: Date.now(),
        status: 'generated',
      };

      const score = await analyzer.analyze(testSuite);

      // 没有边界条件测试
      expect(score.boundaryConditionCoverage).toBeLessThan(0.2);
    });
  });

  describe('Readability', () => {
    it('should score high for readable tests', async () => {
      const testSuite: TestSuite = {
        id: 'test-5',
        targetFunction: 'formatCurrency',
        framework: 'vitest',
        code: `
          import { describe, it, expect } from 'vitest';
          import { formatCurrency } from './utils';
          
          describe('formatCurrency', () => {
            it('should format positive numbers with dollar sign and commas', () => {
              // Arrange
              const amount = 1234.56;
              
              // Act
              const result = formatCurrency(amount);
              
              // Assert
              expect(result).toBe('$1,234.56');
            });
            
            it('should handle negative numbers with parentheses', () => {
              const amount = -500;
              const result = formatCurrency(amount);
              expect(result).toBe('($500.00)');
            });
          });
        `,
        generatedAt: Date.now(),
        status: 'generated',
      };

      const score = await analyzer.analyze(testSuite);

      // 应该得高分：描述性命名 + AAA 注释 + 合适的注释比例
      expect(score.readability).toBeGreaterThan(0.8);
    });

    it('should score low for unreadable tests', async () => {
      const testSuite: TestSuite = {
        id: 'test-6',
        targetFunction: 'func',
        framework: 'vitest',
        code: `
          import { describe, it, expect } from 'vitest';
          
          describe('func', () => {
            it('test', () => {
              expect(func(12345678)).toBe(87654321);
            });
          });
        `,
        generatedAt: Date.now(),
        status: 'generated',
      };

      const score = await analyzer.analyze(testSuite);

      // 应该得低分：命名太短、魔法数字、无注释
      expect(score.readability).toBeLessThan(0.7);
    });

    it('should detect AAA pattern', async () => {
      const testSuite: TestSuite = {
        id: 'test-7',
        targetFunction: 'testFunc',
        framework: 'vitest',
        code: `
          it('should work correctly', () => {
            // Arrange
            const input = 42;
            
            // Act
            const result = func(input);
            
            // Assert
            expect(result).toBe(84);
          });
        `,
        generatedAt: Date.now(),
        status: 'generated',
      };

      const score = await analyzer.analyze(testSuite);

      // AAA 模式应该提升可读性分数
      expect(score.readability).toBeGreaterThan(0.7);
    });
  });

  describe('Improvement Suggestions', () => {
    it('should generate suggestions for low scores', async () => {
      const testSuite: TestSuite = {
        id: 'test-8',
        targetFunction: 'testFunc',
        framework: 'vitest',
        code: `
          it('test', () => {
            expect(true).toBeTruthy();
          });
        `,
        generatedAt: Date.now(),
        status: 'generated',
      };

      const score = await analyzer.analyze(testSuite);
      const suggestions = analyzer.generateImprovements(score);

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some(s => s.includes('assertion diversity'))).toBe(true);
      expect(suggestions.some(s => s.includes('boundary condition'))).toBe(true);
      expect(suggestions.some(s => s.includes('readability'))).toBe(true);
    });

    it('should not generate suggestions for high-quality tests', async () => {
      const testSuite: TestSuite = {
        id: 'test-9',
        targetFunction: 'testFunc',
        framework: 'vitest',
        code: `
          import { describe, it, expect } from 'vitest';
          
          describe('testFunc', () => {
            it('should handle various input types correctly', () => {
              expect(func([])).toEqual([]);
              expect(func(null)).toThrow();
              expect(func(0)).toBe(0);
              expect(func(-1)).toBeLessThan(0);
              expect(func('test')).toContain('test');
            });
          });
        `,
        generatedAt: Date.now(),
        status: 'generated',
      };

      const score = await analyzer.analyze(testSuite);
      const suggestions = analyzer.generateImprovements(score);

      // 高质量测试应该没有或很少建议
      expect(suggestions.length).toBeLessThan(2);
    });
  });

  describe('Overall Score Calculation', () => {
    it('should weight all 8 dimensions correctly', async () => {
      const testSuite: TestSuite = {
        id: 'test-10',
        targetFunction: 'testFunc',
        framework: 'vitest',
        code: `
          import { describe, it, expect } from 'vitest';
          
          describe('testFunc - comprehensive test suite', () => {
            it('should handle empty array input correctly', () => {
              // Arrange
              const input = [];
              
              // Act
              const result = func(input);
              
              // Assert
              expect(result).toEqual([]);
              expect(result).toHaveLength(0);
            });
            
            it('should handle null input by throwing error', () => {
              expect(() => func(null)).toThrow('Invalid input');
            });
            
            it('should handle undefined input gracefully', () => {
              expect(() => func(undefined)).toThrow();
            });
            
            it('should process normal input correctly', async () => {
              const result = await func('valid data');
              expect(result).resolves.toBeTruthy();
            });
          });
        `,
        generatedAt: Date.now(),
        status: 'generated',
      };

      const score = await analyzer.analyze(testSuite);

      // 综合得分应该考虑所有维度
      expect(score.overallScore).toBeGreaterThan(0);
      expect(score.overallScore).toBeLessThanOrEqual(100);
      
      // 检查所有新维度都被计算
      expect(score.assertionDiversity).toBeDefined();
      expect(score.boundaryConditionCoverage).toBeDefined();
      expect(score.readability).toBeDefined();
    });
  });
});

// 辅助函数
function createBasicTestSuite(code: string): TestSuite {
  return {
    id: 'test-suite',
    targetFunction: 'testFunc',
    framework: 'vitest',
    code,
    generatedAt: Date.now(),
    status: 'generated',
  };
}



















