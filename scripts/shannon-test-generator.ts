/**
 * Shannon测试生成脚本
 * 使用TestMind为Shannon生成测试，并记录所有问题
 */

import { ContextEngine, TestGenerator, LLMService, TestReviewer } from '../packages/core/dist/index.mjs';
import type { ProjectConfig } from '../packages/shared/dist/index.mjs';
import { promises as fs } from 'fs';
import path from 'path';
import chalk from 'chalk';

interface TestGenerationResult {
  file: string;
  function: string;
  success: boolean;
  testCode?: string;
  testFilePath?: string;
  errors: string[];
  warnings: string[];
  duration: number;
  quality?: {
    linesOfCode: number;
    testCount: number;
    hasAssertions: boolean;
    hasMocks: boolean;
  };
}

class ShannonTestGenerator {
  private shannonPath = 'D:\\AllAboutCursor\\Shannon\\Shannon-main';
  private outputDir = 'shannon-validation-output';
  private results: TestGenerationResult[] = [];
  private testMindIssues: any[] = [];
  private shannonIssues: any[] = [];

  /**
   * 目标文件列表
   */
  private targets = [
    {
      file: 'observability/dashboard/lib/format.ts',
      functions: ['formatTokensAbbrev'], // 从代码中看到的导出函数
      priority: 'high',
    },
    {
      file: 'observability/dashboard/lib/debug.ts',
      functions: ['debugLog'],
      priority: 'high',
    },
    {
      file: 'observability/dashboard/lib/simClient.ts',
      functions: ['isConnected', 'ensureConnected', 'postIntent', 'destroyConnection'],
      priority: 'high',
    },
  ];

  async run() {
    console.log(chalk.bold.cyan('\n🧪 Shannon测试生成开始\n'));
    console.log(chalk.gray('模式：探索式验证 + 问题记录\n'));

    // 创建输出目录
    await this.setupOutputDirectory();

    // 检查OpenAI API Key
    if (!process.env.OPENAI_API_KEY) {
      console.log(chalk.red('❌ 错误：OPENAI_API_KEY 未设置'));
      console.log(chalk.gray('\n请设置环境变量后重试：'));
      console.log(chalk.cyan('  export OPENAI_API_KEY=sk-your-key-here\n'));
      console.log(chalk.yellow('⚠️  跳过实际LLM调用，仅测试解析和上下文提取\n'));
    }

    // 初始化TestMind配置
    const config = await this.createShannonConfig();

    console.log(chalk.green('✓ 配置创建成功\n'));
    console.log(chalk.bold('📋 测试目标：\n'));

    this.targets.forEach((target, idx) => {
      console.log(`${idx + 1}. ${chalk.cyan(target.file)}`);
      console.log(`   函数: ${target.functions.join(', ')}`);
      console.log(`   优先级: ${target.priority}\n`);
    });

    console.log(chalk.gray('='.repeat(80)));

    // 逐个生成测试
    for (const target of this.targets) {
      for (const funcName of target.functions) {
        await this.generateTestForFunction(config, target.file, funcName);
      }
    }

    // 生成最终报告
    await this.generateFinalReport();
  }

  private async setupOutputDirectory() {
    const dirs = [
      this.outputDir,
      path.join(this.outputDir, 'generated-tests'),
      path.join(this.outputDir, 'suggested-fixes'),
      path.join(this.outputDir, 'contribution-guides'),
    ];

    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
    }

    console.log(chalk.green(`✓ 输出目录创建: ${this.outputDir}\n`));
  }

  private async createShannonConfig(): Promise<ProjectConfig> {
    // 创建临时配置
    return {
      id: 'shannon-validation',
      name: 'Shannon',
      repoPath: this.shannonPath,
      language: 'typescript',
      testFramework: 'vitest',
      config: {
        includePatterns: ['observability/dashboard/**/*.ts'],
        excludePatterns: ['**/*.test.ts', '**/node_modules/**', '**/.next/**'],
        testDirectory: '__tests__',
        coverageThreshold: 80,
        maxFileSize: 1000000,
        llmProvider: 'openai',
        llmModel: 'gpt-4-turbo-preview',
      },
    };
  }

  private async generateTestForFunction(config: ProjectConfig, filePath: string, functionName: string) {
    console.log(chalk.bold(`\n\n📄 ${filePath} :: ${functionName}()\n`));

    const startTime = Date.now();
    const result: TestGenerationResult = {
      file: filePath,
      function: functionName,
      success: false,
      errors: [],
      warnings: [],
      duration: 0,
    };

    try {
      // Step 1: 初始化Context Engine
      console.log(chalk.gray('1. 初始化上下文引擎...'));
      const contextEngine = new ContextEngine(config);

      // Step 2: 索引项目（仅索引dashboard目录）
      console.log(chalk.gray('2. 索引项目...'));
      try {
        const indexResult = await contextEngine.indexProject(this.shannonPath);
        console.log(chalk.green(`   ✓ 索引完成: ${indexResult.filesIndexed}个文件, ${indexResult.functionsExtracted}个函数`));
      } catch (indexError) {
        const error = String(indexError);
        console.log(chalk.yellow(`   ⚠️ 索引警告: ${error}`));
        result.warnings.push(`索引警告: ${error}`);
        // 继续执行
      }

      // Step 3: 获取函数上下文
      console.log(chalk.gray(`3. 分析函数: ${functionName}()...`));
      const fullPath = path.join(this.shannonPath, filePath);
      
      let functionContext;
      try {
        functionContext = await contextEngine.getFunctionContext(fullPath, functionName);
        console.log(chalk.green(`   ✓ 函数上下文提取成功`));
        console.log(chalk.cyan(`     参数数量: ${functionContext.signature.parameters.length}`));
        console.log(chalk.cyan(`     是否异步: ${functionContext.signature.isAsync}`));
        console.log(chalk.cyan(`     依赖数量: ${functionContext.dependencies.length}`));
        console.log(chalk.cyan(`     副作用: ${functionContext.sideEffects.length}`));
        console.log(chalk.cyan(`     圈复杂度: ${functionContext.complexity.cyclomaticComplexity}`));
      } catch (contextError) {
        const error = String(contextError);
        console.log(chalk.red(`   ✗ 上下文提取失败: ${error}`));
        result.errors.push(`上下文提取失败: ${error}`);
        
        // 记录TestMind问题
        this.testMindIssues.push({
          severity: 'critical',
          category: 'testmind-bug',
          description: `无法提取函数上下文: ${functionName}`,
          error,
          file: filePath,
          function: functionName,
        });
        
        result.duration = Date.now() - startTime;
        this.results.push(result);
        return;
      }

      // Step 4: 生成测试（如果有API key）
      if (process.env.OPENAI_API_KEY) {
        console.log(chalk.gray('4. 调用LLM生成测试...'));
        
        try {
          const llmService = new LLMService();
          const testGenerator = new TestGenerator(llmService);
          
          const testSuite = await testGenerator.generateUnitTest(
            functionContext, 
            config.id, 
            config.testFramework || 'jest'
          );
          
          console.log(chalk.green(`   ✓ 测试生成成功`));
          
          // 分析测试质量
          result.testCode = testSuite.code;
          result.testFilePath = testSuite.filePath;
          result.quality = this.analyzeTestQuality(testSuite.code);
          
          console.log(chalk.cyan(`     生成代码行数: ${result.quality.linesOfCode}`));
          console.log(chalk.cyan(`     测试用例数: ${result.quality.testCount}`));
          console.log(chalk.cyan(`     包含断言: ${result.quality.hasAssertions ? '是' : '否'}`));
          console.log(chalk.cyan(`     包含Mock: ${result.quality.hasMocks ? '是' : '否'}`));
          
          // 保存测试到输出目录
          const outputPath = path.join(
            this.outputDir,
            'generated-tests',
            path.basename(filePath, '.ts') + '-' + functionName + '.test.ts'
          );
          await fs.writeFile(outputPath, testSuite.code, 'utf-8');
          console.log(chalk.green(`   ✓ 测试已保存: ${outputPath}`));
          
          result.success = true;
          
        } catch (llmError) {
          const error = String(llmError);
          console.log(chalk.red(`   ✗ LLM生成失败: ${error}`));
          result.errors.push(`LLM生成失败: ${error}`);
          
          // 记录TestMind问题
          this.testMindIssues.push({
            severity: 'major',
            category: 'testmind-bug',
            description: `LLM生成测试失败: ${functionName}`,
            error,
            file: filePath,
            function: functionName,
          });
        }
      } else {
        console.log(chalk.yellow('   ⚠️ 跳过LLM调用（无API key）'));
        result.warnings.push('跳过LLM调用（无API key）');
        result.success = true; // 上下文提取成功就算部分成功
      }

      await contextEngine.dispose();

    } catch (error) {
      const errorStr = String(error);
      console.log(chalk.red(`\n❌ 测试生成失败: ${errorStr}`));
      result.errors.push(errorStr);
      
      // 记录TestMind Critical问题
      this.testMindIssues.push({
        severity: 'critical',
        category: 'testmind-bug',
        description: `完全失败: ${filePath}::${functionName}`,
        error: errorStr,
        file: filePath,
        function: functionName,
      });
    }

    result.duration = Date.now() - startTime;
    this.results.push(result);

    console.log(chalk.gray(`\n⏱️  耗时: ${result.duration}ms`));
    console.log(chalk.gray('─'.repeat(80)));
  }

  private analyzeTestQuality(testCode: string) {
    const lines = testCode.split('\n');
    
    // 统计测试用例
    const describeCount = (testCode.match(/describe\(/g) || []).length;
    const itCount = (testCode.match(/\bit\(/g) || []).length;
    const testCount = (testCode.match(/\btest\(/g) || []).length;
    
    // 检查断言
    const hasExpect = testCode.includes('expect(');
    const hasAssert = testCode.includes('assert');
    
    // 检查Mock
    const hasMock = testCode.includes('mock') || testCode.includes('Mock') || testCode.includes('vi.');
    
    return {
      linesOfCode: lines.length,
      testCount: Math.max(itCount, testCount, describeCount),
      hasAssertions: hasExpect || hasAssert,
      hasMocks: hasMock,
    };
  }

  private async generateFinalReport() {
    console.log(chalk.bold.cyan('\n\n📊 验证结果总结\n'));
    console.log(chalk.gray('='.repeat(80)));

    const totalTests = this.results.length;
    const successTests = this.results.filter(r => r.success).length;
    const failedTests = totalTests - successTests;

    console.log(chalk.bold('\n测试生成统计：'));
    console.log(`  总尝试数: ${totalTests}`);
    console.log(`  成功: ${chalk.green(successTests)}`);
    console.log(`  失败: ${chalk.red(failedTests)}`);
    console.log(`  成功率: ${((successTests / totalTests) * 100).toFixed(0)}%`);

    console.log(chalk.bold('\n问题统计：'));
    console.log(`  TestMind问题: ${chalk.red(this.testMindIssues.length)}`);
    
    const criticalTM = this.testMindIssues.filter(i => i.severity === 'critical').length;
    const majorTM = this.testMindIssues.filter(i => i.severity === 'major').length;
    const minorTM = this.testMindIssues.filter(i => i.severity === 'minor').length;
    
    console.log(`    🔴 Critical: ${criticalTM}`);
    console.log(`    🟡 Major: ${majorTM}`);
    console.log(`    🟢 Minor: ${minorTM}`);

    // 生成详细测试报告
    await this.saveDetailedResults();

    // 更新问题日志
    await this.updateIssueLogs();

    console.log(chalk.green('\n✅ 验证完成！'));
    console.log(chalk.cyan('\n📝 查看结果：'));
    console.log(`  - ${this.outputDir}/GENERATION_REPORT.md`);
    console.log(`  - TESTMIND_ISSUES_LOG.md`);
    console.log(`  - SHANNON_ISSUES_DISCOVERED.md\n`);
  }

  private async saveDetailedResults() {
    const report: string[] = [];
    
    report.push('# Shannon测试生成详细报告\n');
    report.push(`**生成时间：** ${new Date().toISOString()}\n`);
    report.push(`**总测试数：** ${this.results.length}\n`);
    report.push(`**成功数：** ${this.results.filter(r => r.success).length}\n`);
    report.push('---\n\n');

    // 成功的测试
    report.push('## ✅ 成功生成的测试\n\n');
    const successful = this.results.filter(r => r.success);
    
    if (successful.length > 0) {
      successful.forEach((result, idx) => {
        report.push(`### ${idx + 1}. ${result.file}::${result.function}()\n\n`);
        
        if (result.quality) {
          report.push(`**质量指标：**\n`);
          report.push(`- 代码行数: ${result.quality.linesOfCode}\n`);
          report.push(`- 测试用例数: ${result.quality.testCount}\n`);
          report.push(`- 包含断言: ${result.quality.hasAssertions ? '✅' : '❌'}\n`);
          report.push(`- 包含Mock: ${result.quality.hasMocks ? '✅' : '❌'}\n`);
        }
        
        if (result.testFilePath) {
          report.push(`\n**生成文件：** \`${path.basename(result.testFilePath)}\`\n`);
        }
        
        report.push(`**耗时：** ${result.duration}ms\n\n`);
        
        if (result.warnings.length > 0) {
          report.push(`**警告：**\n`);
          result.warnings.forEach(w => report.push(`- ⚠️ ${w}\n`));
          report.push('\n');
        }
        
        report.push('---\n\n');
      });
    } else {
      report.push('*无成功生成的测试*\n\n');
    }

    // 失败的测试
    report.push('## ❌ 失败的测试\n\n');
    const failed = this.results.filter(r => !r.success);
    
    if (failed.length > 0) {
      failed.forEach((result, idx) => {
        report.push(`### ${idx + 1}. ${result.file}::${result.function}()\n\n`);
        report.push(`**错误：**\n`);
        result.errors.forEach(e => report.push(`- ❌ ${e}\n`));
        report.push(`\n**耗时：** ${result.duration}ms\n\n`);
        report.push('---\n\n');
      });
    } else {
      report.push('*无失败的测试*\n\n');
    }

    const reportPath = path.join(this.outputDir, 'GENERATION_REPORT.md');
    await fs.writeFile(reportPath, report.join(''), 'utf-8');
  }

  private async updateIssueLogs() {
    // 更新TestMind问题日志
    if (this.testMindIssues.length > 0) {
      let log = await fs.readFile('TESTMIND_ISSUES_LOG.md', 'utf-8');
      
      // 添加新发现的问题
      const criticalSection = log.indexOf('## 🔴 Critical Issues');
      const majorSection = log.indexOf('## 🟡 Major Issues');
      
      this.testMindIssues.forEach((issue, idx) => {
        const issueText = this.formatIssue(issue, idx + 1);
        
        if (issue.severity === 'critical') {
          log = this.insertIssueInSection(log, issueText, criticalSection, majorSection);
        } else if (issue.severity === 'major') {
          const minorSection = log.indexOf('## 🟢 Minor Issues');
          log = this.insertIssueInSection(log, issueText, majorSection, minorSection);
        }
      });
      
      // 更新统计
      const criticalCount = this.testMindIssues.filter(i => i.severity === 'critical').length;
      const majorCount = this.testMindIssues.filter(i => i.severity === 'major').length;
      const minorCount = this.testMindIssues.filter(i => i.severity === 'minor').length;
      
      log = log.replace(/\| 🔴 Critical \| \d+ \|/, `| 🔴 Critical | ${criticalCount} |`);
      log = log.replace(/\| 🟡 Major \| \d+ \|/, `| 🟡 Major | ${majorCount} |`);
      log = log.replace(/\| 🟢 Minor \| \d+ \|/, `| 🟢 Minor | ${minorCount} |`);
      log = log.replace(/\| \*\*总计\*\* \| \*\*\d+\*\* \|/, `| **总计** | **${criticalCount + majorCount + minorCount}** |`);
      
      await fs.writeFile('TESTMIND_ISSUES_LOG.md', log);
    }
  }

  private formatIssue(issue: any, number: number): string {
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    
    return `
### Issue #${number}: ${issue.description}

**发现时间：** ${now}  
**严重程度：** ${issue.severity === 'critical' ? '🔴' : issue.severity === 'major' ? '🟡' : '🟢'} ${issue.severity}  
**触发文件：** Shannon/${issue.file}  
**触发函数：** ${issue.function || 'N/A'}  

**错误信息：**
\`\`\`
${issue.error || 'N/A'}
\`\`\`

**修复状态：** ⏳ Pending

---
`;
  }

  private insertIssueInSection(log: string, issueText: string, sectionStart: number, nextSection: number): string {
    const before = log.slice(0, nextSection);
    const after = log.slice(nextSection);
    return before + '\n' + issueText + after;
  }
}

// 运行
const generator = new ShannonTestGenerator();
generator.run().catch(error => {
  console.error(chalk.red('\n❌ 验证失败:'), error);
  process.exit(1);
});







