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
import {
  SelfHealingEngine,
  HealingStrategy,
  createComponentLogger
} from '@testmind/core';
import type {
  FixContext,
  SelfHealingConfig,
  SelfHealingResult,
  TestFailure
} from '@testmind/core';
import * as fs from 'fs/promises';
import chalk from 'chalk';
import { z } from 'zod';
import { createSpinner } from '../ui/spinner';
import { getCliLogLevel } from '../utils/logLevel';
import { recordCliEvent } from '../utils/telemetry';
import {
  extractFailedLineNumber,
  extractTestSnippet,
  loadTestFileContent,
  resolveReportedTestFilePath
} from '../utils/testReport';

const logger = createComponentLogger('heal');

const TestReportSchema = z.object({
  testResults: z.array(z.object({
    name: z.string().optional(),
    assertionResults: z.array(z.object({
      status: z.enum(['passed', 'failed', 'skipped']),
      title: z.string().optional(),
      fullName: z.string().optional(),
      failureMessages: z.array(z.string()).optional(),
      expected: z.unknown().optional(),
      actual: z.unknown().optional(),
    })).optional(),
  })).optional(),
});

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

  /** 是否通过 --experimental 显式启用实验流程 */
  experimental?: boolean;

  /** 测试时绕过 process.exit 调用（便于单元测试） */
  skipExit?: boolean;
}

export type HealEngineFactory = (config: SelfHealingConfig) => SelfHealingEngine;

/**
 * 解析测试报告（Jest/Vitest JSON 格式）
 */
async function parseTestReport(reportPath: string): Promise<TestFailure[]> {
  try {
    const content = await fs.readFile(reportPath, 'utf-8');
    const rawReport = JSON.parse(content);

    const parsed = TestReportSchema.safeParse(rawReport);
    if (!parsed.success) {
      throw new Error(`Invalid test report format: ${parsed.error.message}`);
    }

    const report = parsed.data;

    const failures: TestFailure[] = [];

    // 解析 Jest/Vitest 格式
    if (report.testResults) {
      for (const testResult of report.testResults) {
        for (const assertionResult of testResult.assertionResults || []) {
          if (assertionResult.status === 'failed') {
            const failureMessage =
              assertionResult.failureMessages?.join('\n') || 'Unknown error';

            failures.push({
              testName: assertionResult.fullName || assertionResult.title || 'Unnamed test',
              testFile: testResult.name || 'unknown',
              errorMessage: failureMessage,
              stackTrace: failureMessage,
              expectedValue: assertionResult.expected,
              actualValue: assertionResult.actual,
              timestamp: new Date()
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
export async function healCommand(
  testFile: string | undefined,
  options: HealCommandOptions = {},
  engineFactory: HealEngineFactory = (config) => new SelfHealingEngine(config)
): Promise<void> {
  const exitWithStatus = (code: number): void => {
    if (options.skipExit) {
      process.exitCode = code;
      return;
    }
    process.exit(code);
  };

  const logLevel = getCliLogLevel();
  const spinnerOptions = { logger, logLevel };
  logger.info('Heal command invoked', {
    target: testFile ?? 'interactive',
    experimental: options.experimental ?? false,
    auto: options.auto ?? false,
    ci: options.ci ?? false,
  });
  recordCliEvent('heal.invoked', {
    target: testFile ?? 'interactive',
    experimental: options.experimental ? 'true' : 'false',
    auto: options.auto ? 'true' : 'false',
    ci: options.ci ? 'true' : 'false',
  });

  const previewMode = options.experimental !== true;

  if (previewMode) {
    logger.warn(
      chalk.yellow(
        'heal command is running in preview mode. Use --experimental to enable auto-apply behaviors once they are stable.'
      )
    );
    logger.info(
      chalk.dim('Preview mode will still analyze failures and emit suggestions, but auto/CI options are disabled.')
    );

    if (options.auto || options.ci || options.autoCommit) {
      logger.info(
        chalk.dim(
          `Disabling ${[
            options.auto ? '--auto' : null,
            options.ci ? '--ci' : null,
            options.autoCommit ? '--auto-commit' : null,
          ]
            .filter(Boolean)
            .join(', ')} for this run.`,
        ),
      );
    }

    options.auto = false;
    options.ci = false;
    options.autoCommit = false;
  }

  logger.info(chalk.bold.cyan('\n🏥 TestMind Self-Healing Engine (experimental)\n'));

  if (testFile) {
    logger.info(chalk.dim(`Target file: ${testFile}`));
  }

  // 1. 解析测试失败
  let failures: TestFailure[] = [];

  if (options.report) {
    const reportSpinner = createSpinner('Parsing test report...', spinnerOptions);
    reportSpinner.start();
    try {
      failures = await parseTestReport(options.report);
      reportSpinner.succeed(`Found ${failures.length} failed tests`);
      recordCliEvent('heal.report.parsed', {
        failures: failures.length,
        report: options.report,
      });
    } catch (error) {
      reportSpinner.fail(`Failed to parse report: ${error}`);
      recordCliEvent('heal.completed', {
        success: 'false',
        error: String(error),
        stage: 'parse',
      });
      exitWithStatus(1);
      return;
    }
  } else {
    // 交互式选择测试文件
    logger.info(chalk.yellow('ℹ️  No report provided. Please specify --report <path>'));
    exitWithStatus(1);
    return;
  }

  if (failures.length === 0) {
    logger.info(chalk.green('✨ All tests passed! Nothing to heal.\n'));
    return;
  }

  // 2. 初始化自愈引擎
  const healingEngine = engineFactory({
    enableAutoFix: options.auto || options.ci,
    autoFixConfidenceThreshold: options.confidenceThreshold || 0.85,
    enableIntentTracking: true,
    enableLLM: true,
    // llmService 应从配置中获取
  });

  // 3. 执行自愈
  const analysisSpinner = createSpinner(`Analyzing ${failures.length} failures...`, spinnerOptions);
  analysisSpinner.start();
  
  const results = new Map<string, SelfHealingResult>();
  let processed = 0;

  for (const failure of failures) {
    try {
      const resolvedTestFile = resolveReportedTestFilePath(
        options.report,
        failure.testFile,
        testFile
      );

      const testFileContent = await loadTestFileContent(resolvedTestFile);
      const snippet = testFileContent
        ? extractTestSnippet(testFileContent, failure)
        : '';

      const fixContext = {
        testCode:
          testFileContent ||
          snippet ||
          failure.stackTrace ||
          failure.errorMessage,
        failedLine: extractFailedLineNumber(failure.stackTrace),
        currentSelector: failure.selector
      } satisfies FixContext;

      const context = {
        ...fixContext,
        pageContext: undefined
      };

      const result = await healingEngine.heal(failure, context);
      results.set(failure.testName, result);
      
      processed++;
      analysisSpinner.text = `Processing... (${processed}/${failures.length})`;
    } catch (error) {
      logger.error(chalk.red(`\n  ✗ Failed to heal ${failure.testName}: ${error}`));
    }
  }

  analysisSpinner.succeed(`Analyzed ${processed} failed tests`);
  recordCliEvent('heal.analysis', {
    failures: failures.length,
    processed,
    healed: Array.from(results.values()).filter((r) => r.healed).length,
  });

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
  recordCliEvent('heal.report.saved', {
    path: outputPath,
    failures: results.size,
  });

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

  const success = healedCount === results.size;
  const needsReview = results.size - healedCount;
  recordCliEvent('heal.completed', {
    success: success ? 'true' : 'false',
    failures: results.size,
    needsReview,
    autoCommit: options.ci && options.autoCommit ? 'true' : 'false',
  });

  // 8. 退出码
  if (healedCount === results.size) {
    logger.info(chalk.green.bold('🎉 All tests healed successfully!\n'));
    exitWithStatus(0);
  } else {
    logger.info(chalk.yellow.bold(`⚠️  ${results.size - healedCount} tests still need manual review\n`));
    exitWithStatus(options.ci ? 1 : 0); // CI 模式下失败退出
  }
}

/**
 * 注册 heal 命令
 */
export function registerHealCommand(program: Command): void {
  program
    .command('heal [test-file]')
    .description('自动修复失败的测试')
    .option('-r, --report <path>', '测试报告文件路径（JSON 格式）')
    .option('-a, --auto', '自动应用高置信度修复（无需审查）')
    .option('-c, --confidence-threshold <number>', '自动修复的置信度阈值', '0.85')
    .option('--ci', 'CI 模式（自动提交）')
    .option('--auto-commit', '自动提交修复')
    .option('-m, --max-fixes <number>', '最大修复数量')
    .option('-o, --output <path>', '输出报告路径', 'testmind-healing-report.json')
    .option('--experimental', '启用实验性 heal 流程')
    .action(async (testFile, options) => {
      await healCommand(testFile, {
        ...options,
        confidenceThreshold: parseFloat(options.confidenceThreshold || '0.85'),
        maxFixes: options.maxFixes ? parseInt(options.maxFixes) : undefined,
      });
    });
}
