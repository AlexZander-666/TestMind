/**
 * Shannon测试验证脚本
 * 在Shannon项目中实际运行TestMind生成的测试
 */

import { promises as fs } from 'fs';
import { spawn } from 'child_process';
import path from 'path';
import chalk from 'chalk';

interface TestResult {
  file: string;
  success: boolean;
  output: string;
  errors: string[];
  duration: number;
}

class ShannonTestVerifier {
  private shannonPath = 'D:\\AllAboutCursor\\Shannon\\Shannon-main\\observability\\dashboard';
  private testMindPath = 'D:\\AllAboutCursor\\TestMind';
  private results: TestResult[] = [];

  async run() {
    console.log(chalk.bold.cyan('\n🧪 Shannon测试验证\n'));
    console.log(chalk.gray('模式：在Shannon环境运行TestMind生成的测试\n'));

    // 要验证的测试文件
    const tests = [
      { 
        source: 'shannon-validation-output/verified-tests/format.test.ts',
        target: 'lib/format.test.ts',
        description: 'formatTokensAbbrev tests'
      },
      { 
        source: 'shannon-validation-output/verified-tests/debug.test.ts',
        target: 'lib/debug.test.ts',
        description: 'debugLog tests'
      },
      { 
        source: 'shannon-validation-output/verified-tests/simClient.test.ts',
        target: 'lib/simClient.test.ts',
        description: 'simClient tests (isConnected, ensureConnected, postIntent, destroyConnection)'
      },
    ];

    for (const test of tests) {
      await this.verifyTest(test);
    }

    // 生成报告
    await this.generateReport();
  }

  private async verifyTest(test: { source: string; target: string; description: string }) {
    const result: TestResult = {
      file: test.description,
      success: false,
      output: '',
      errors: [],
      duration: 0,
    };

    const startTime = Date.now();

    try {
      console.log(chalk.bold(`\n📄 ${test.description}\n`));
      console.log(chalk.gray(`   Source: ${test.source}`));
      console.log(chalk.gray(`   Target: ${test.target}\n`));

      // Step 1: 复制测试文件到Shannon
      console.log(chalk.gray('1. 复制测试文件到Shannon...'));
      const sourcePath = path.join(this.testMindPath, test.source);
      const targetPath = path.join(this.shannonPath, test.target);

      const testContent = await fs.readFile(sourcePath, 'utf-8');
      await fs.writeFile(targetPath, testContent, 'utf-8');
      console.log(chalk.green('   ✓ 文件复制成功'));

      // Step 2: 在Shannon中运行测试
      console.log(chalk.gray('2. 运行测试...'));
      const testOutput = await this.runTestInShannon(test.target);

      result.output = testOutput;

      // Step 3: 解析结果
      if (testOutput.includes('✓') || testOutput.includes('passed')) {
        console.log(chalk.green('   ✓ 测试通过！'));
        result.success = true;
      } else if (testOutput.includes('✗') || testOutput.includes('failed') || testOutput.includes('error')) {
        console.log(chalk.red('   ✗ 测试失败'));
        result.success = false;
        
        // 提取错误信息
        const errorLines = testOutput.split('\n').filter(line => 
          line.includes('Error') || 
          line.includes('Expected') || 
          line.includes('Received') ||
          line.includes('✗')
        );
        result.errors = errorLines;
      } else {
        console.log(chalk.yellow('   ⚠️  无法确定测试结果'));
      }

      // 清理：删除测试文件
      await fs.unlink(targetPath);
      console.log(chalk.gray('   ✓ 清理完成'));

    } catch (error) {
      console.log(chalk.red(`   ✗ 验证失败: ${error}`));
      result.errors.push(String(error));
    }

    result.duration = Date.now() - startTime;
    this.results.push(result);

    console.log(chalk.gray(`\n⏱️  耗时: ${result.duration}ms`));
    console.log(chalk.gray('─'.repeat(80)));
  }

  private async runTestInShannon(testFile: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(
        'pnpm',
        ['test', testFile, '--run'],  // --run for non-watch mode
        {
          cwd: this.shannonPath,
          shell: true,
        }
      );

      let output = '';
      let errorOutput = '';

      child.stdout?.on('data', (data) => {
        output += data.toString();
      });

      child.stderr?.on('data', (data) => {
        errorOutput += data.toString();
      });

      child.on('close', (code) => {
        resolve(output + '\n' + errorOutput);
      });

      child.on('error', (error) => {
        reject(error);
      });
    });
  }

  private async generateReport() {
    console.log(chalk.bold.cyan('\n\n📊 验证结果总结\n'));
    console.log(chalk.gray('='.repeat(80)));

    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.success).length;
    const failedTests = totalTests - passedTests;

    console.log(chalk.bold('\n测试验证统计：'));
    console.log(`  总测试文件: ${totalTests}`);
    console.log(`  通过: ${chalk.green(passedTests)}`);
    console.log(`  失败: ${chalk.red(failedTests)}`);
    console.log(`  通过率: ${((passedTests / totalTests) * 100).toFixed(0)}%`);

    // 保存详细报告
    await this.saveDetailedReport();

    console.log(chalk.green('\n✅ 验证完成！'));
    console.log(chalk.cyan('\n📝 查看详细报告：'));
    console.log(`  - shannon-validation-output/TEST_EXECUTION_REPORT.md\n`);
  }

  private async saveDetailedReport() {
    const report: string[] = [];

    report.push('# Shannon测试执行报告\n\n');
    report.push(`**执行时间：** ${new Date().toISOString()}\n`);
    report.push(`**执行环境：** Shannon项目实际环境\n`);
    report.push(`**TestMind版本：** v0.2.0\n\n`);
    report.push('---\n\n');

    report.push('## 执行摘要\n\n');
    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.success).length;
    const failedTests = totalTests - passedTests;

    report.push(`| 指标 | 值 |\n`);
    report.push(`|------|----|\n`);
    report.push(`| 总测试文件 | ${totalTests} |\n`);
    report.push(`| 通过 | ${passedTests} ✅ |\n`);
    report.push(`| 失败 | ${failedTests} ❌ |\n`);
    report.push(`| 通过率 | ${((passedTests / totalTests) * 100).toFixed(0)}% |\n\n`);

    report.push('---\n\n');

    // 详细结果
    report.push('## 详细结果\n\n');

    this.results.forEach((result, idx) => {
      report.push(`### ${idx + 1}. ${result.file}\n\n`);
      
      if (result.success) {
        report.push(`**状态：** ✅ 通过\n\n`);
      } else {
        report.push(`**状态：** ❌ 失败\n\n`);
        
        if (result.errors.length > 0) {
          report.push(`**错误：**\n\n`);
          report.push('```\n');
          result.errors.forEach(e => report.push(`${e}\n`));
          report.push('```\n\n');
        }
      }

      report.push(`**耗时：** ${result.duration}ms\n\n`);

      if (result.output) {
        report.push(`<details>\n<summary>完整输出</summary>\n\n`);
        report.push('```\n');
        report.push(result.output);
        report.push('\n```\n\n');
        report.push('</details>\n\n');
      }

      report.push('---\n\n');
    });

    // 保存报告
    const reportPath = path.join(
      this.testMindPath,
      'shannon-validation-output',
      'TEST_EXECUTION_REPORT.md'
    );
    await fs.writeFile(reportPath, report.join(''), 'utf-8');
  }
}

// 运行验证
new ShannonTestVerifier().run()
  .then(() => {
    console.log(chalk.green.bold('\n✅ Shannon测试验证完成！\n'));
  })
  .catch((error) => {
    console.error(chalk.red('\n❌ 验证失败:'), error);
    process.exit(1);
  });






