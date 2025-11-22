/**
 * Shannon探索式验证脚本
 * 测试TestMind在Shannon项目上的表现，记录所有问题
 */

import { promises as fs } from 'fs';
import path from 'path';
import chalk from 'chalk';

interface ValidationResult {
  file: string;
  function?: string;
  success: boolean;
  testGenerated: boolean;
  testCompiles?: boolean;
  testRuns?: boolean;
  issues: Issue[];
  duration: number;
}

interface Issue {
  severity: 'critical' | 'major' | 'minor';
  category: 'testmind-bug' | 'shannon-missing-test' | 'shannon-code-quality';
  description: string;
  error?: string;
  file: string;
  function?: string;
}

class ShannonValidator {
  private results: ValidationResult[] = [];
  private testMindIssues: Issue[] = [];
  private shannonIssues: Issue[] = [];

  /**
   * 测试文件列表（探索式验证）
   */
  private testFiles = [
    {
      file: 'observability/dashboard/lib/format.ts',
      reason: '纯函数，没有测试文件',
      priority: 'high',
    },
    {
      file: 'observability/dashboard/lib/simClient.ts',
      reason: '有外部依赖，没有测试文件',
      priority: 'high',
    },
    {
      file: 'observability/dashboard/lib/debug.ts',
      reason: '工具函数，没有测试文件',
      priority: 'medium',
    },
    {
      file: 'observability/dashboard/lib/types.ts',
      reason: '类型定义文件',
      priority: 'low',
    },
    {
      file: 'observability/dashboard/lib/audio/tracks.ts',
      reason: '音频相关逻辑',
      priority: 'medium',
    },
  ];

  async runValidation() {
    console.log(chalk.bold.cyan('\n🔍 Shannon探索式验证开始\n'));
    console.log(chalk.gray('目标：发现TestMind在真实项目中的问题\n'));

    const shannonPath = 'D:\\AllAboutCursor\\Shannon\\Shannon-main';

    // 验证Shannon路径
    try {
      await fs.access(shannonPath);
    } catch {
      console.log(chalk.red('❌ Shannon项目不存在：' + shannonPath));
      return;
    }

    console.log(chalk.green('✓ Shannon项目已找到\n'));
    console.log(chalk.bold('📋 探索式验证文件清单：\n'));

    this.testFiles.forEach((item, idx) => {
      const priority = item.priority === 'high' ? chalk.red('高')
        : item.priority === 'medium' ? chalk.yellow('中')
        : chalk.gray('低');
      console.log(`${idx + 1}. ${chalk.cyan(item.file)}`);
      console.log(`   原因: ${item.reason}`);
      console.log(`   优先级: ${priority}\n`);
    });

    console.log(chalk.yellow('⚠️  注意：这是探索式验证，会记录所有遇到的问题\n'));
    console.log(chalk.gray('=' .repeat(80)));

    // 逐个测试文件
    for (const testFile of this.testFiles) {
      await this.testFile(shannonPath, testFile);
    }

    // 生成报告
    await this.generateReport();
  }

  private async testFile(
    shannonPath: string,
    testFile: { file: string; reason: string; priority: string }
  ) {
    console.log(chalk.bold(`\n\n📄 测试文件: ${testFile.file}\n`));

    const fullPath = path.join(shannonPath, testFile.file);
    const startTime = Date.now();

    const result: ValidationResult = {
      file: testFile.file,
      success: false,
      testGenerated: false,
      issues: [],
      duration: 0,
    };

    try {
      // 1. 检查文件是否存在
      await fs.access(fullPath);
      console.log(chalk.green('✓ 文件存在'));

      // 2. 读取文件内容
      const content = await fs.readFile(fullPath, 'utf-8');
      console.log(chalk.green(`✓ 文件读取成功 (${content.length} 字节)`));

      // 3. 简单分析文件
      const analysis = this.analyzeFile(content);
      console.log(chalk.cyan(`\n文件分析：`));
      console.log(`  - 函数数量: ${analysis.functionCount}`);
      console.log(`  - 类数量: ${analysis.classCount}`);
      console.log(`  - 导入数量: ${analysis.importCount}`);
      console.log(`  - 行数: ${analysis.lineCount}`);

      // 4. 检查是否有测试文件
      const testFilePath = fullPath.replace(/\.ts$/, '.test.ts');
      let hasTest = false;
      try {
        await fs.access(testFilePath);
        hasTest = true;
        console.log(chalk.yellow(`\n⚠️  已存在测试文件: ${path.basename(testFilePath)}`));
      } catch {
        console.log(chalk.gray(`\nℹ️  无测试文件（新建机会）`));
        
        // 记录Shannon问题：缺少测试
        this.shannonIssues.push({
          severity: 'major',
          category: 'shannon-missing-test',
          description: `文件缺少单元测试`,
          file: testFile.file,
        });
      }

      // 5. 分析代码质量
      const qualityIssues = this.analyzeCodeQuality(content);
      if (qualityIssues.length > 0) {
        console.log(chalk.cyan(`\n发现代码质量问题: ${qualityIssues.length}个`));
        qualityIssues.forEach(issue => {
          console.log(`  - ${issue.description}`);
          this.shannonIssues.push({
            ...issue,
            file: testFile.file,
          });
        });
      }

      result.success = true;
      console.log(chalk.green(`\n✅ 文件分析完成`));

    } catch (error) {
      console.log(chalk.red(`\n❌ 测试失败: ${error}`));

      // 记录TestMind问题
      this.testMindIssues.push({
        severity: 'critical',
        category: 'testmind-bug',
        description: `无法分析文件 ${testFile.file}`,
        error: String(error),
        file: testFile.file,
      });

      result.issues.push({
        severity: 'critical',
        category: 'testmind-bug',
        description: String(error),
        file: testFile.file,
      });
    }

    result.duration = Date.now() - startTime;
    this.results.push(result);

    console.log(chalk.gray(`\n⏱️  耗时: ${result.duration}ms`));
    console.log(chalk.gray('─'.repeat(80)));
  }

  private analyzeFile(content: string) {
    const lines = content.split('\n');
    
    // 简单的正则匹配
    const functionMatches = content.match(/function\s+\w+|const\s+\w+\s*=\s*\([^)]*\)\s*=>/g) || [];
    const classMatches = content.match(/class\s+\w+/g) || [];
    const importMatches = content.match(/import\s+/g) || [];

    return {
      lineCount: lines.length,
      functionCount: functionMatches.length,
      classCount: classMatches.length,
      importCount: importMatches.length,
    };
  }

  private analyzeCodeQuality(content: string): Issue[] {
    const issues: Issue[] = [];

    // 检查1: 是否有TODO注释
    if (content.includes('TODO') || content.includes('FIXME')) {
      issues.push({
        severity: 'minor',
        category: 'shannon-code-quality',
        description: '代码包含TODO/FIXME注释',
        file: '',
      });
    }

    // 检查2: 是否有console.log（可能是调试代码）
    const consoleLogCount = (content.match(/console\.log/g) || []).length;
    if (consoleLogCount > 3) {
      issues.push({
        severity: 'minor',
        category: 'shannon-code-quality',
        description: `包含${consoleLogCount}个console.log（可能需要清理）`,
        file: '',
      });
    }

    // 检查3: 是否有any类型
    const anyTypeCount = (content.match(/:\s*any\b/g) || []).length;
    if (anyTypeCount > 2) {
      issues.push({
        severity: 'minor',
        category: 'shannon-code-quality',
        description: `使用${anyTypeCount}次any类型（类型安全问题）`,
        file: '',
      });
    }

    return issues;
  }

  private async generateReport() {
    console.log(chalk.bold.cyan('\n\n📊 验证结果汇总\n'));
    console.log(chalk.gray('='.repeat(80)));

    // 统计
    const totalFiles = this.results.length;
    const successFiles = this.results.filter(r => r.success).length;
    const failedFiles = totalFiles - successFiles;

    console.log(chalk.bold('\n测试统计：'));
    console.log(`  总文件数: ${totalFiles}`);
    console.log(`  成功: ${chalk.green(successFiles)}`);
    console.log(`  失败: ${chalk.red(failedFiles)}`);

    console.log(chalk.bold('\n问题统计：'));
    console.log(`  TestMind问题: ${chalk.red(this.testMindIssues.length)}`);
    console.log(`  Shannon问题: ${chalk.yellow(this.shannonIssues.length)}`);

    // TestMind问题分类
    const critical = this.testMindIssues.filter(i => i.severity === 'critical').length;
    const major = this.testMindIssues.filter(i => i.severity === 'major').length;
    const minor = this.testMindIssues.filter(i => i.severity === 'minor').length;

    console.log(chalk.bold('\nTestMind问题分类：'));
    console.log(`  🔴 Critical: ${critical}`);
    console.log(`  🟡 Major: ${major}`);
    console.log(`  🟢 Minor: ${minor}`);

    // 更新日志文件
    await this.updateLogs();

    console.log(chalk.green('\n✅ 验证报告已生成'));
    console.log(chalk.cyan('\n📝 查看详细日志：'));
    console.log(`  - TESTMIND_ISSUES_LOG.md`);
    console.log(`  - SHANNON_ISSUES_DISCOVERED.md`);
    console.log();
  }

  private async updateLogs() {
    // 更新TestMind问题日志
    if (this.testMindIssues.length > 0) {
      let log = await fs.readFile('TESTMIND_ISSUES_LOG.md', 'utf-8');
      
      // 更新统计
      const criticalCount = this.testMindIssues.filter(i => i.severity === 'critical').length;
      const majorCount = this.testMindIssues.filter(i => i.severity === 'major').length;
      const minorCount = this.testMindIssues.filter(i => i.severity === 'minor').length;

      log = log.replace(
        /\| 🔴 Critical \| \d+ \|/,
        `| 🔴 Critical | ${criticalCount} |`
      );
      log = log.replace(
        /\| 🟡 Major \| \d+ \|/,
        `| 🟡 Major | ${majorCount} |`
      );
      log = log.replace(
        /\| 🟢 Minor \| \d+ \|/,
        `| 🟢 Minor | ${minorCount} |`
      );

      await fs.writeFile('TESTMIND_ISSUES_LOG.md', log);
    }

    // 更新Shannon问题日志
    if (this.shannonIssues.length > 0) {
      let log = await fs.readFile('SHANNON_ISSUES_DISCOVERED.md', 'utf-8');
      
      // 计算统计
      const missingTest = this.shannonIssues.filter(i => i.category === 'shannon-missing-test').length;
      const codeQuality = this.shannonIssues.filter(i => i.category === 'shannon-code-quality').length;

      log = log.replace(
        /\| 缺少测试 \| \d+ \|/,
        `| 缺少测试 | ${missingTest} |`
      );
      log = log.replace(
        /\| 其他 \| \d+ \|/,
        `| 其他 | ${codeQuality} |`
      );

      await fs.writeFile('SHANNON_ISSUES_DISCOVERED.md', log);
    }
  }
}

// 运行验证
const validator = new ShannonValidator();
validator.runValidation().catch(error => {
  console.error(chalk.red('\n❌ 验证失败:'), error);
  process.exit(1);
});

