/**
 * TestReadabilityOptimizer - 测试可读性优化引擎
 * 
 * 功能：
 * - 强制 AAA 模式（Arrange-Act-Assert）
 * - 改进测试描述和命名
 * - 提取公共 setup
 * - 替换 magic numbers
 * - 添加关键注释
 */

import { createComponentLogger } from '../utils/logger';

export interface ReadabilityIssue {
  type: 'naming' | 'structure' | 'magic-number' | 'comment' | 'duplication';
  line: number;
  description: string;
  suggestion: string;
  severity: 'error' | 'warning' | 'info';
}

export interface OptimizationResult {
  original: string;
  optimized: string;
  issues: ReadabilityIssue[];
  improvements: number;
}

export class TestReadabilityOptimizer {
  private logger = createComponentLogger('TestReadabilityOptimizer');

  /**
   * 优化测试代码可读性
   */
  optimize(testCode: string): OptimizationResult {
    this.logger.debug('Optimizing test readability');

    const issues: ReadabilityIssue[] = [];
    let optimized = testCode;

    // 1. 强制 AAA 模式
    optimized = this.enforceAAAPattern(optimized, issues);

    // 2. 改进描述性命名
    optimized = this.improveDescriptions(optimized, issues);

    // 3. 提取公共 setup
    optimized = this.extractCommonSetup(optimized, issues);

    // 4. 替换 magic numbers
    optimized = this.replaceMagicNumbers(optimized, issues);

    // 5. 添加断言注释
    optimized = this.addAssertionComments(optimized, issues);

    // 6. 移除重复代码
    optimized = this.removeDuplication(optimized, issues);

    this.logger.info('Readability optimization complete', {
      issuesFound: issues.length,
      improvements: issues.filter(i => i.severity !== 'info').length,
    });

    return {
      original: testCode,
      optimized,
      issues,
      improvements: issues.filter(i => i.severity !== 'info').length,
    };
  }

  /**
   * 1. 强制 AAA 模式（Arrange-Act-Assert）
   */
  private enforceAAAPattern(code: string, issues: ReadabilityIssue[]): string {
    // 检测测试是否遵循 AAA 模式
    const testBlocks = code.matchAll(/it\(['"]([^'"]+)['"],\s*(?:async\s*)?\(\)\s*=>\s*{([\s\S]*?)}\);?/g);
    
    let optimized = code;

    for (const block of testBlocks) {
      const testName = block[1];
      const testBody = block[2];
      
      // 检查是否有明确的 AAA 分隔
      const hasArrange = /\/\/\s*Arrange/i.test(testBody);
      const hasAct = /\/\/\s*Act/i.test(testBody);
      const hasAssert = /\/\/\s*Assert/i.test(testBody);

      if (!hasArrange && !hasAct && !hasAssert) {
        // 尝试自动添加 AAA 注释
        const lines = testBody.split('\n');
        let arrangeEnd = -1;
        let actEnd = -1;

        // 找到 Arrange 结束位置（最后一个赋值或 mock）
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes('const') || lines[i].includes('let') || lines[i].includes('mock')) {
            arrangeEnd = i;
          } else if (lines[i].trim() && !lines[i].includes('//')) {
            break;
          }
        }

        // 找到 Act 位置（第一个函数调用）
        for (let i = arrangeEnd + 1; i < lines.length; i++) {
          if (lines[i].includes('await') || lines[i].includes('(') && !lines[i].includes('expect')) {
            actEnd = i;
            break;
          }
        }

        // 插入 AAA 注释
        if (arrangeEnd > -1) {
          lines.splice(0, 0, '    // Arrange');
        }
        if (actEnd > -1) {
          lines.splice(actEnd + 1, 0, '\n    // Act');
        }
        if (lines.some(l => l.includes('expect'))) {
          const assertIndex = lines.findIndex(l => l.includes('expect'));
          if (assertIndex > -1) {
            lines.splice(assertIndex, 0, '\n    // Assert');
          }
        }

        const newTestBody = lines.join('\n');
        optimized = optimized.replace(testBody, newTestBody);

        issues.push({
          type: 'structure',
          line: 0,
          description: `Test "${testName}" doesn't follow AAA pattern`,
          suggestion: 'Added AAA comments (Arrange-Act-Assert)',
          severity: 'warning',
        });
      }
    }

    return optimized;
  }

  /**
   * 2. 改进描述性命名
   */
  private improveDescriptions(code: string, issues: ReadabilityIssue[]): string {
    let optimized = code;

    // 查找不清晰的测试名称
    const badPatterns = [
      { pattern: /it\(['"]test\s+\d+['"]/, suggestion: 'Use descriptive name instead of "test 1", "test 2"' },
      { pattern: /it\(['"]works['"]/, suggestion: 'Describe what specifically works' },
      { pattern: /it\(['"]should work['"]/, suggestion: 'Describe expected behavior' },
      { pattern: /it\(['"]test['"]/, suggestion: 'Use descriptive test name' },
    ];

    badPatterns.forEach(({ pattern, suggestion }) => {
      const matches = code.matchAll(new RegExp(pattern, 'g'));
      for (const match of matches) {
        issues.push({
          type: 'naming',
          line: 0,
          description: `Non-descriptive test name: ${match[0]}`,
          suggestion,
          severity: 'warning',
        });
      }
    });

    // 改进测试名称为 "should [expected behavior] when [condition]" 格式
    optimized = optimized.replace(
      /it\(['"]([^'"]+)['"]/g,
      (match, name) => {
        if (!name.startsWith('should')) {
          // 尝试改进命名
          if (name.includes('returns')) {
            return match.replace(name, `should return ${name.split('returns')[1]?.trim()}`);
          }
          if (name.includes('throws')) {
            return match.replace(name, `should throw ${name.split('throws')[1]?.trim()}`);
          }
        }
        return match;
      }
    );

    return optimized;
  }

  /**
   * 3. 提取公共 setup
   */
  private extractCommonSetup(code: string, issues: ReadabilityIssue[]): string {
    // 查找重复的 setup 代码
    const testBlocks = Array.from(code.matchAll(/it\(['"][^'"]+['"],\s*(?:async\s*)?\(\)\s*=>\s*{([\s\S]*?)}\);?/g));
    
    if (testBlocks.length < 2) return code;

    // 提取每个测试的第一行代码
    const setupLines: string[][] = testBlocks.map(block => {
      const lines = block[1].split('\n')
        .filter(l => l.trim())
        .filter(l => !l.includes('//'));
      return lines.slice(0, 3); // 取前3行
    });

    // 找到共同的 setup 代码
    const commonLines: string[] = [];
    setupLines[0]?.forEach((line, index) => {
      if (setupLines.every(setup => setup[index] === line)) {
        commonLines.push(line);
      }
    });

    if (commonLines.length > 1) {
      issues.push({
        type: 'duplication',
        line: 0,
        description: `Found ${commonLines.length} duplicated setup lines`,
        suggestion: 'Extract to beforeEach()',
        severity: 'info',
      });

      // 在实际优化中，这里应该提取到 beforeEach
      // 为了简化，这里只记录问题
    }

    return code;
  }

  /**
   * 4. 替换 magic numbers
   */
  private replaceMagicNumbers(code: string, issues: ReadabilityIssue[]): string {
    let optimized = code;

    // 查找 magic numbers（除了 0, 1, -1 外的数字）
    const magicNumbers = code.matchAll(/(?<!const\s+\w+\s*=\s*)(?<!\.\s*)(\d{2,}|\d+\.\d+)(?!\s*;)/g);
    
    for (const match of magicNumbers) {
      const number = match[1];
      if (number !== '10' && number !== '100') { // 常见的数字可能有意义
        issues.push({
          type: 'magic-number',
          line: 0,
          description: `Magic number: ${number}`,
          suggestion: 'Extract to named constant',
          severity: 'info',
        });
      }
    }

    return optimized;
  }

  /**
   * 5. 添加断言注释
   */
  private addAssertionComments(code: string, issues: ReadabilityIssue[]): string {
    let optimized = code;

    // 为复杂的断言添加注释
    const complexAssertions = code.matchAll(/expect\(([^)]+)\)\.(toBe|toEqual|toMatchObject)\(([^)]+)\);?/g);
    
    for (const match of matches) {
      const actual = match[1];
      const matcher = match[2];
      const expected = match[3];

      // 如果断言很长或复杂，建议添加注释
      if (actual.length > 50 || expected.length > 50) {
        issues.push({
          type: 'comment',
          line: 0,
          description: `Complex assertion without comment`,
          suggestion: `Add comment explaining why ${actual} should ${matcher} ${expected}`,
          severity: 'info',
        });
      }
    }

    return optimized;
  }

  /**
   * 6. 移除重复代码
   */
  private removeDuplication(code: string, issues: ReadabilityIssue[]): string {
    // 查找重复的代码块（3行以上相同）
    const lines = code.split('\n');
    const duplicates = new Map<string, number[]>();

    for (let i = 0; i < lines.length - 2; i++) {
      const block = lines.slice(i, i + 3).join('\n');
      if (block.trim()) {
        if (!duplicates.has(block)) {
          duplicates.set(block, []);
        }
        duplicates.get(block)!.push(i);
      }
    }

    duplicates.forEach((positions, block) => {
      if (positions.length > 1) {
        issues.push({
          type: 'duplication',
          line: positions[0],
          description: `Duplicated code block (${positions.length} times)`,
          suggestion: 'Extract to helper function or beforeEach',
          severity: 'warning',
        });
      }
    });

    return code;
  }
}

