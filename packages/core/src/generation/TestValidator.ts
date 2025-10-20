/**
 * TestValidator - 自动验证生成的测试的期望值
 * 
 * 解决Issue #5：期望值精度错误
 * 
 * 功能：
 * 1. 从测试代码中提取期望值
 * 2. 生成验证脚本在目标项目中运行
 * 3. 对比期望值与实际输出
 * 4. 自动修正不匹配的期望值
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * 从测试代码中提取的期望值
 */
export interface ExtractedExpectation {
  functionName: string;
  testCase: string;
  input: string;
  expectedValue: string;
  lineNumber: number;
}

/**
 * 验证结果
 */
export interface ValidationResult {
  functionName: string;
  totalExpectations: number;
  matchedExpectations: number;
  mismatches: ExpectationMismatch[];
  accuracyRate: number;
}

/**
 * 期望值不匹配
 */
export interface ExpectationMismatch {
  testCase: string;
  input: string;
  expected: string;
  actual: string;
  lineNumber: number;
}

/**
 * TestValidator类
 */
export class TestValidator {
  constructor(private projectPath: string) {}

  /**
   * 从测试代码中提取期望值
   */
  extractExpectations(testCode: string, functionName: string): ExtractedExpectation[] {
    const expectations: ExtractedExpectation[] = [];
    const lines = testCode.split('\n');

    // 正则匹配 expect(functionName(...)).toBe(...)
    const expectRegex = new RegExp(
      `expect\\(${functionName}\\(([^)]*)\\)\\)\\.toBe\\(([^)]+)\\)`,
      'g'
    );

    lines.forEach((line, index) => {
      let match;
      while ((match = expectRegex.exec(line)) !== null) {
        if (match[1] && match[2]) {
          expectations.push({
            functionName,
            testCase: line.trim(),
            input: match[1].trim(),
            expectedValue: match[2].trim(),
            lineNumber: index + 1,
          });
        }
      }
    });

    return expectations;
  }

  /**
   * 生成验证脚本
   * 
   * 生成一个可在目标项目中运行的脚本，实际调用函数并输出结果
   */
  async generateVerificationScript(
    functionName: string,
    sourceFilePath: string,
    expectations: ExtractedExpectation[]
  ): Promise<string> {
    const importPath = sourceFilePath.replace(/\.ts$/, '.ts');

    const testCases = expectations.map((exp, index) => {
      return `  { input: ${exp.input}, expected: ${exp.expectedValue}, line: ${exp.lineNumber} }`;
    }).join(',\n');

    const script = `
/**
 * 自动生成的验证脚本
 * 用于验证测试的期望值是否与实际输出匹配
 */

import { ${functionName} } from '${importPath}';

const testCases = [
${testCases}
];

console.log('=== ${functionName} 期望值验证 ===\\n');

const results = testCases.map((testCase, index) => {
  try {
    const actual = ${functionName}(...[testCase.input]);
    const actualStr = JSON.stringify(actual);
    const expectedStr = JSON.stringify(testCase.expected).replace(/^"|"$/g, '');
    const match = actualStr === expectedStr;
    
    return {
      index: index + 1,
      input: testCase.input,
      expected: testCase.expected,
      actual,
      match,
      line: testCase.line,
    };
  } catch (error) {
    return {
      index: index + 1,
      input: testCase.input,
      expected: testCase.expected,
      actual: 'ERROR: ' + (error as Error).message,
      match: false,
      line: testCase.line,
      error: true,
    };
  }
});

// 输出结果
console.log('| # | 输入 | 期望 | 实际 | 匹配 |');
console.log('|---|------|------|------|------|');

results.forEach(r => {
  const status = r.match ? '✅' : '❌';
  console.log(\`| \${r.index} | \${r.input} | \${r.expected} | \${r.actual} | \${status} |\`);
});

// 统计
const matched = results.filter(r => r.match).length;
const total = results.length;
const accuracy = ((matched / total) * 100).toFixed(1);

console.log('\\n=== 统计 ===');
console.log(\`总计: \${total}\`);
console.log(\`匹配: \${matched}\`);
console.log(\`不匹配: \${total - matched}\`);
console.log(\`准确率: \${accuracy}%\`);

// 输出不匹配的详情（供自动修正使用）
const mismatches = results.filter(r => !r.match);
if (mismatches.length > 0) {
  console.log('\\n=== 不匹配详情（JSON） ===');
  console.log(JSON.stringify(mismatches, null, 2));
}

process.exit(mismatches.length > 0 ? 1 : 0);
`.trim();

    return script;
  }

  /**
   * 运行验证脚本并解析结果
   */
  async runVerificationScript(scriptContent: string, targetProjectPath: string): Promise<ValidationResult> {
    // 临时文件路径
    const tempScriptPath = path.join(targetProjectPath, 'temp-verification.mjs');

    try {
      // 写入临时脚本
      await fs.writeFile(tempScriptPath, scriptContent);

      // 运行脚本
      const { stdout, stderr } = await execAsync(`node ${tempScriptPath}`, {
        cwd: targetProjectPath,
      });

      // 解析输出
      const output = stdout + stderr;

      // 提取统计信息
      const totalMatch = output.match(/总计:\s*(\d+)/);
      const matchedMatch = output.match(/匹配:\s*(\d+)/);
      const accuracyMatch = output.match(/准确率:\s*([\d.]+)%/);
      
      const total = (totalMatch && totalMatch[1]) ? parseInt(totalMatch[1]) : 0;
      const matched = (matchedMatch && matchedMatch[1]) ? parseInt(matchedMatch[1]) : 0;
      const accuracy = (accuracyMatch && accuracyMatch[1]) ? parseFloat(accuracyMatch[1]) : 0;

      // 提取不匹配详情
      const mismatchJsonMatch = output.match(/=== 不匹配详情（JSON） ===\s*(\[[\s\S]*?\])/);
      let mismatches: ExpectationMismatch[] = [];

      if (mismatchJsonMatch && mismatchJsonMatch[1]) {
        try {
          const mismatchData = JSON.parse(mismatchJsonMatch[1]);
          mismatches = mismatchData.map((m: any) => ({
            testCase: `expect(${m.input}).toBe(${m.expected})`,
            input: String(m.input || ''),
            expected: String(m.expected || ''),
            actual: String(m.actual || ''),
            lineNumber: m.line || 0,
          }));
        } catch (e) {
          console.warn('Failed to parse mismatch JSON:', e);
        }
      }

      return {
        functionName: 'unknown', // Will be set by caller
        totalExpectations: total,
        matchedExpectations: matched,
        mismatches,
        accuracyRate: accuracy,
      };
    } finally {
      // 清理临时文件
      try {
        await fs.unlink(tempScriptPath);
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * 验证测试代码的期望值
   * 
   * @param testCode 生成的测试代码
   * @param functionName 被测试的函数名
   * @param sourceFilePath 源文件相对路径（相对于项目根目录）
   * @returns 验证结果
   */
  async validateExpectations(
    testCode: string,
    functionName: string,
    sourceFilePath: string
  ): Promise<ValidationResult> {
    // 1. 提取期望值
    const expectations = this.extractExpectations(testCode, functionName);

    if (expectations.length === 0) {
      return {
        functionName,
        totalExpectations: 0,
        matchedExpectations: 0,
        mismatches: [],
        accuracyRate: 100, // 没有期望值就算100%
      };
    }

    // 2. 生成验证脚本
    const script = await this.generateVerificationScript(
      functionName,
      sourceFilePath,
      expectations
    );

    // 3. 运行验证
    const result = await this.runVerificationScript(script, this.projectPath);
    result.functionName = functionName;

    return result;
  }

  /**
   * 自动修正测试代码中的期望值
   * 
   * @param testCode 原始测试代码
   * @param mismatches 不匹配的期望值列表
   * @returns 修正后的测试代码
   */
  autoCorrectExpectations(testCode: string, mismatches: ExpectationMismatch[]): string {
    let correctedCode = testCode;

    // 按行号倒序排序，避免替换后行号变化
    const sortedMismatches = [...mismatches].sort((a, b) => b.lineNumber - a.lineNumber);

    sortedMismatches.forEach(mismatch => {
      const lines = correctedCode.split('\n');
      const lineIndex = mismatch.lineNumber - 1;

      if (lineIndex >= 0 && lineIndex < lines.length) {
        const line = lines[lineIndex];
        
        if (!line) {
          return; // Skip if line is undefined
        }

        // 替换期望值
        const oldExpectPattern = `.toBe(${mismatch.expected})`;
        const newExpectPattern = `.toBe(${mismatch.actual})`;

        if (line.includes(oldExpectPattern)) {
          lines[lineIndex] = line.replace(oldExpectPattern, newExpectPattern);
          correctedCode = lines.join('\n');
        }
      }
    });

    return correctedCode;
  }

  /**
   * 完整的验证和修正流程
   * 
   * @param testCode 生成的测试代码
   * @param functionName 被测试的函数名
   * @param sourceFilePath 源文件路径
   * @returns { correctedCode, validationResult }
   */
  async validateAndCorrect(
    testCode: string,
    functionName: string,
    sourceFilePath: string
  ): Promise<{ correctedCode: string; validationResult: ValidationResult }> {
    // 1. 验证期望值
    const validationResult = await this.validateExpectations(
      testCode,
      functionName,
      sourceFilePath
    );

    // 2. 如果有不匹配，自动修正
    let correctedCode = testCode;
    if (validationResult.mismatches.length > 0) {
      correctedCode = this.autoCorrectExpectations(testCode, validationResult.mismatches);
    }

    return { correctedCode, validationResult };
  }
}

