import { describe, it, expect, beforeEach } from 'vitest';
import { TestValidator } from '../TestValidator';

describe('TestValidator', () => {
  let validator: TestValidator;

  beforeEach(() => {
    validator = new TestValidator('/mock/project/path');
  });

  describe('extractExpectations', () => {
    it('should extract simple expect().toBe() statements', () => {
      const testCode = `
        expect(formatNumber(123)).toBe('123');
        expect(formatNumber(1000)).toBe('1.0k');
      `;

      const result = validator.extractExpectations(testCode, 'formatNumber');

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        functionName: 'formatNumber',
        input: '123',
        expectedValue: "'123'",
      });
      expect(result[1]).toMatchObject({
        functionName: 'formatNumber',
        input: '1000',
        expectedValue: "'1.0k'",
      });
    });

    it('should handle multiple parameters', () => {
      const testCode = `
        expect(formatNumber(123, { mode: true })).toBe('123.0');
      `;

      const result = validator.extractExpectations(testCode, 'formatNumber');

      expect(result).toHaveLength(1);
      expect(result[0].input).toBe("123, { mode: true }");
    });

    it('should return empty array if no expectations found', () => {
      const testCode = `
        const result = formatNumber(123);
        // No expect statements
      `;

      const result = validator.extractExpectations(testCode, 'formatNumber');

      expect(result).toHaveLength(0);
    });

    it('should capture line numbers correctly', () => {
      const testCode = `
Line 1
expect(formatNumber(1)).toBe('1');
Line 3
expect(formatNumber(2)).toBe('2');
      `.trim();

      const result = validator.extractExpectations(testCode, 'formatNumber');

      expect(result[0].lineNumber).toBe(2);
      expect(result[1].lineNumber).toBe(4);
    });
  });

  describe('generateVerificationScript', () => {
    it('should generate valid JavaScript script', async () => {
      const expectations = [
        {
          functionName: 'formatNumber',
          testCase: 'expect(formatNumber(123)).toBe("123")',
          input: '123',
          expectedValue: '"123"',
          lineNumber: 10,
        },
        {
          functionName: 'formatNumber',
          testCase: 'expect(formatNumber(1000)).toBe("1.0k")',
          input: '1000',
          expectedValue: '"1.0k"',
          lineNumber: 15,
        },
      ];

      const script = await validator.generateVerificationScript(
        'formatNumber',
        './lib/format',
        expectations
      );

      // 验证脚本包含必要元素
      expect(script).toContain('import { formatNumber }');
      expect(script).toContain('from \'./lib/format'); // 不检查.ts扩展名
      expect(script).toContain('testCases');
      expect(script).toContain('{ input: 123');
      expect(script).toContain('{ input: 1000');
      expect(script).toContain('console.log');
    });

    it('should include all test cases in script', async () => {
      const expectations = [
        {
          functionName: 'add',
          testCase: 'test',
          input: '1, 2',
          expectedValue: '3',
          lineNumber: 5,
        },
      ];

      const script = await validator.generateVerificationScript(
        'add',
        './utils/math',
        expectations
      );

      expect(script).toContain('input: 1, 2');
      expect(script).toContain('expected: 3');
      expect(script).toContain('line: 5');
    });
  });

  describe('autoCorrectExpectations', () => {
    it('should replace incorrect expected values', () => {
      const testCode = `
expect(formatNumber(123)).toBe('123');
expect(formatNumber(1000)).toBe('1.0K');  // Wrong: should be lowercase
expect(formatNumber(2000)).toBe('2.0k');
      `.trim();

      const mismatches = [
        {
          testCase: 'Line 2',
          input: '1000',
          expected: "'1.0K'",
          actual: "'1.0k'",
          lineNumber: 2,
        },
      ];

      const corrected = validator.autoCorrectExpectations(testCode, mismatches);

      expect(corrected).toContain(".toBe('1.0k')");
      expect(corrected).not.toContain(".toBe('1.0K')");
      // 其他行保持不变
      expect(corrected).toContain(".toBe('123')");
      expect(corrected).toContain(".toBe('2.0k')");
    });

    it('should handle multiple corrections', () => {
      const testCode = `
expect(fn(1)).toBe('A');
expect(fn(2)).toBe('B');
expect(fn(3)).toBe('C');
      `.trim();

      const mismatches = [
        {
          testCase: 'test',
          input: '1',
          expected: "'A'",
          actual: "'X'",
          lineNumber: 1,
        },
        {
          testCase: 'test',
          input: '3',
          expected: "'C'",
          actual: "'Z'",
          lineNumber: 3,
        },
      ];

      const corrected = validator.autoCorrectExpectations(testCode, mismatches);

      expect(corrected).toContain(".toBe('X')");
      expect(corrected).toContain(".toBe('B')");
      expect(corrected).toContain(".toBe('Z')");
      expect(corrected).not.toContain(".toBe('A')");
      expect(corrected).not.toContain(".toBe('C')");
    });

    it('should handle when line number is out of range', () => {
      const testCode = `expect(fn(1)).toBe('A');`;

      const mismatches = [
        {
          testCase: 'test',
          input: '999',
          expected: "'wrong'",
          actual: "'right'",
          lineNumber: 999, // Out of range
        },
      ];

      const corrected = validator.autoCorrectExpectations(testCode, mismatches);

      // 应该保持不变（无法修正不存在的行）
      expect(corrected).toBe(testCode);
    });
  });
});


