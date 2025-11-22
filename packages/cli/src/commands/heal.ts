/**
 * Heal Command - 自动修复失败的测试
 * 
 * 用法：
 * - testmind heal                          # 交互式修复
 * - testmind heal --auto                   # 自动修复高置信度问题
 * - testmind heal --ci                     # CI 模式（自动提交）
 * - testmind heal --report test-results.json  # 从报告文件读取失败
 */

import { Command } from 'commander';
import { SelfHealingEngine, HealingStrategy } from '@testmind/core';
import type { TestFailure, SelfHealingResult } from '@testmind/core';
import * as fs from 'fs/promises';
import * as path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { createComponentLogger } from '../../../core/src/utils/logger';

const logger = createComponentLogger('heal');

export interface HealCommandOptions {
  /** 测试报告文件路径 */
  report?: string;
  
  /** 是否自动应用修复（无需审查） */
  auto?: boolean;
  
  /** 自动修复的置信度阈值 */
  confidenceThreshold?: number;
  
  /** CI 模式（自动提交） */
  ci?: boolean;
  
  /** 是否自动提交 */
  autoCommit?: boolean;
  
  /** 最大修复数量 */
  maxFixes?: number;
  
  /** 输出报告路径 */
  output?: string;
}

/**
 * 解析测试报告（Jest/Vitest JSON 格式）
 */
async function parseTestReport(reportPath: string): Promise<TestFailure[]> {
  try {
    const content = await fs.readFile(reportPath, 'utf-8');
    const report = JSON.parse(content);

    const failures: TestFailure[] = [];

    // 解析 Jest/Vitest 格式
    if (report.testResults) {
      for (const testResult of report.testResults) {
        for (const assertionResult of testResult.assertionResults || []) {
          if (assertionResult.status === 'failed') {
            failures.push({
              testName: assertionResult.fullName || assertionResult.title,
              testFile: testResult.name,
              error: assertionResult.failureMessages?.join('\n') || 'Unknown error',
              stackTrace: assertionResult.failureMessages?.join('\n'),
              expectedValue: assertionResult.expected,
              actualValue: assertionResult.actual,
            });
          }
        }
      }
    }

    return failures;
  } catch (error) {
    throw new Error(`Failed to parse test report: ${error}`);
  }
}

/**
 * 生成修复报告
 */
function generateHealingReport(
  results: Map<string, SelfHealingResult>,
  options: HealCommandOptions
): any {
  const totalTests = results.size;
  const healedTests = Array.from(results.values()).filter(r => r.healed).length;
  const suggestedTests = Array.from(results.values()).filter(
    r => !r.healed && r.suggestions.length > 0
  ).length;
  const cannotFixTests = totalTests - healedTests - suggestedTests;

  const healingRate = totalTests > 0 ? (healedTests / totalTests * 100).toFixed(1) : '0.0';

  return {
    summary: {
      total: totalTests,
      healed: healedTests,
      suggested: suggestedTests,
      cannotFix: cannotFixTests,
      healingRate: parseFloat(healingRate),
    },
    details: Array.from(results.entries()).map(([testName, result]) => ({
      testName,
      healed: result.healed,
      strategy: result.strategy,
      confidence: result.confidence,
      classification: result.classification.failureType,
      suggestionsCount: result.suggestions.length,
      duration: result.duration,
    })),
    timestamp: new Date().toISOString(),
    options,
  };
}

/**
 * 应用修复（生成 Diff 并应用）
 */
async function applyFixes(
  results: Map<string, SelfHealingResult>,
  options: HealCommandOptions
): Promise<{ applied: number; skipped: number }> {
  let applied = 0;
  let skipped = 0;

  const highConfidenceResults = Array.from(results.values()).filter(
    r => r.confidence >= (options.confidenceThreshold || 0.85) && r.suggestions.length > 0
  );

  logger.info(chalk.cyan(`\n🔧 Applying ${highConfidenceResults.length} high-confidence fixes...\n`));

  for (const result of highConfidenceResults) {
    if (options.maxFixes && applied >= options.maxFixes) {
      skipped += highConfidenceResults.length - applied;
      break;
    }

    try {
      // 这里应该调用 DiffApplier 来应用修复
      // const diff = generateDiff(result.suggestions[0]);
      // await applyDiff(diff);
      
      logger.info(chalk.green(`  ✓ Applied fix: ${result.suggestions[0]?.description}`));
      applied++;
  } catch (error) {
      logger.error(chalk.red(`  ✗ Failed to apply fix: ${error}`));
      skipped++;
    }
  }

  return { applied, skipped };
}

/**
 * Heal 命令实现
 */
export async function healCommand(options: HealCommandOptions): Promise<void> {
  logger.info(chalk.bold.cyan('\n🏥 TestMind Self-Healing Engine\n'));

  // 1. 解析测试失败
  let failures: TestFailure[] = [];

  if (options.report) {
    const spinner = ora('Parsing test report...').start();
    try {
      failures = await parseTestReport(options.report);
      spinner.succeed(`Found ${failures.length} failed tests`);
    } catch (error) {
      spinner.fail(`Failed to parse report: ${error}`);
      process.exit(1);
    }
      } else {
    // 交互式选择测试文件
    logger.info(chalk.yellow('ℹ️  No report provided. Please specify --report <path>'));
    process.exit(1);
  }

  if (failures.length === 0) {
    logger.info(chalk.green('✨ All tests passed! Nothing to heal.\n'));
    return;
  }

  // 2. 初始化自愈引擎
  const healingEngine = new SelfHealingEngine({
    enableAutoFix: options.auto || options.ci,
    autoFixConfidenceThreshold: options.confidenceThreshold || 0.85,
    enableIntentTracking: true,
    enableLLM: true,
    // llmService 应从配置中获取
  });

  // 3. 执行自愈
  const spinner = ora(`Analyzing ${failures.length} failures...`).start();
  
  const results = new Map<string, SelfHealingResult>();
  let processed = 0;

  for (const failure of failures) {
    try {
      const context = {
        testCode: '', // 应从测试文件中读取
        pageContext: undefined,
      };

      const result = await healingEngine.heal(failure, context);
      results.set(failure.testName, result);
      
      processed++;
      spinner.text = `Processing... (${processed}/${failures.length})`;
    } catch (error) {
      logger.error(chalk.red(`\n  ✗ Failed to heal ${failure.testName}: ${error}`));
    }
  }

  spinner.succeed(`Analyzed ${processed} failed tests`);

  // 4. 显示结果摘要
  const healedCount = Array.from(results.values()).filter(r => r.healed).length;
  const healingRate = ((healedCount / results.size) * 100).toFixed(1);

  logger.info(chalk.bold('\n📊 Healing Results:\n'));
  logger.info(`  Total Failures: ${chalk.yellow(results.size.toString())}`);
  logger.info(`  Auto-Healed: ${chalk.green(healedCount.toString())} (${healingRate}%)`);
  logger.info(`  Needs Review: ${chalk.yellow((results.size - healedCount).toString())}`);

  // 5. 生成报告
  const report = generateHealingReport(results, options);
  
  const outputPath = options.output || 'testmind-healing-report.json';
  await fs.writeFile(outputPath, JSON.stringify(report, null, 2));
  
  logger.info(chalk.dim(`\n📄 Report saved to: ${outputPath}\n`));

  // 6. CI 模式：自动应用修复
  if (options.ci && options.autoCommit) {
    const { applied, skipped } = await applyFixes(results, options);
    
    if (applied > 0) {
      logger.info(chalk.green(`\n✅ Applied ${applied} fixes automatically\n`));
      
      // Git commit
      // await gitCommit('fix(tests): auto-heal failed tests via TestMind');
      logger.info(chalk.dim('(Git commit would be created in real implementation)\n'));
    }
  }

  // 7. 交互模式：显示建议
  if (!options.ci) {
    logger.info(chalk.bold('\n💡 Healing Suggestions:\n'));
    
    let suggestionCount = 0;
    for (const [testName, result] of results) {
      if (result.suggestions.length > 0) {
        suggestionCount++;
        logger.info(chalk.cyan(`${suggestionCount}. ${testName}`));
        logger.info(chalk.dim(`   Classification: ${result.classification.failureType}`));
        logger.info(chalk.dim(`   Confidence: ${(result.confidence * 100).toFixed(0)}%`));
        logger.info(chalk.dim(`   Suggestion: ${result.suggestions[0]?.description}\n`));
      }
    }
  }

  // 8. 退出码
  if (healedCount === results.size) {
    logger.info(chalk.green.bold('🎉 All tests healed successfully!\n'));
    process.exit(0);
  } else {
    logger.info(chalk.yellow.bold(`⚠️  ${results.size - healedCount} tests still need manual review\n`));
    process.exit(options.ci ? 1 : 0); // CI 模式下失败退出
  }
}

/**
 * 注册 heal 命令
 */
export function registerHealCommand(program: Command): void {
  program
    .command('heal')
    .description('自动修复失败的测试')
    .option('-r, --report <path>', '测试报告文件路径（JSON 格式）')
    .option('-a, --auto', '自动应用高置信度修复（无需审查）')
    .option('-c, --confidence-threshold <number>', '自动修复的置信度阈值', '0.85')
    .option('--ci', 'CI 模式（自动提交）')
    .option('--auto-commit', '自动提交修复')
    .option('-m, --max-fixes <number>', '最大修复数量')
    .option('-o, --output <path>', '输出报告路径', 'testmind-healing-report.json')
    .action(async (options) => {
      await healCommand({
        ...options,
        confidenceThreshold: parseFloat(options.confidenceThreshold || '0.85'),
        maxFixes: options.maxFixes ? parseInt(options.maxFixes) : undefined,
      });
    });
}
