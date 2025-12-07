/**
 * Analyze Command: Summarize test quality signals.
 */

import type { Printer } from '../ui/printer';
import { createSpinner } from '../ui/spinner';
import { createStdoutPrinter } from '../ui/stdoutPrinter';
import { loadConfig } from '../utils/config';
import { printContextDiagnostics } from '../utils/contextDebug';
import { createComponentLogger } from '@testmind/core';
import { getCliLogLevel } from '../utils/logLevel';
import { recordCliEvent } from '../utils/telemetry';
import { resolveSuite, resolveSuites, isPreviewSuite } from '../utils/suite';
import { TestEvaluator } from '@testmind/core';
import type { Improvement, QualityScore, TestSuite } from '@testmind/shared';

export interface AnalyzeOptions {
  all?: boolean;
  debugContext?: boolean;
}

const hasSuiteId = (value?: string): value is string => typeof value === 'string' && value.trim().length > 0;
const isTrue = (value?: boolean): boolean => value === true;
const MAX_ANALYSIS_TARGETS = 5;

export const analyzeCommand = async (suiteId: string | undefined, options: AnalyzeOptions) => {
  const logLevel = getCliLogLevel();
  const logger = createComponentLogger('analyze');
  const printer = createStdoutPrinter({ logger, logLevel });
  printer.header('analyze', 'Test quality review (preview)');

  logger.info('Analyze command invoked', {
    suiteId: suiteId ?? null,
    all: options.all ?? false,
  });

  const configSpinner = createSpinner('Loading configuration...', { logger, logLevel });
  configSpinner.start();
  const config = await loadConfig();

  if (!config) {
    configSpinner.fail('Configuration missing');
    printer.error('TestMind is not initialized in this project.', 'Run "testmind init" first.');
    process.exit(1);
  }
  configSpinner.succeed('Configuration ready');
  logger.info('Analysis config ready', { suiteId, all: options.all === true });
  recordCliEvent('config.loaded', {
    command: 'analyze',
    scope: isTrue(options.all)
      ? 'all'
      : hasSuiteId(suiteId)
        ? suiteId
        : 'default',
  });

  const evaluator = new TestEvaluator();
  try {
    if (isTrue(options.all)) {
      const suites = await resolveSuites({ config, limit: MAX_ANALYSIS_TARGETS });
      if (suites.length === 0) {
        printer.warn('No suites found for analysis.');
        return;
      }
      printer.status('Info', `Analyzing ${suites.length} suites (limit ${MAX_ANALYSIS_TARGETS}).`);
      for (const suite of suites) {
        await analyzeSuite(printer, suite, evaluator);
      }
    } else if (hasSuiteId(suiteId)) {
      const suite = await resolveSuite(config, suiteId);
      await analyzeSuite(printer, suite, evaluator);
    } else {
      printer.warn('Provide a suite ID or use --all.');
    }

    if (isTrue(options.debugContext)) {
      const contextKey = hasSuiteId(suiteId)
        ? `analyze:${suiteId}`
        : isTrue(options.all)
          ? 'analyze:all'
          : 'analyze';
      recordCliEvent('context.diagnostics', {
        command: 'analyze',
        context: contextKey,
      });
      await printContextDiagnostics(config, {
        query: contextKey,
        projectPath: process.cwd(),
      });
    }
  } catch (error) {
    configSpinner.fail('Analysis failed');
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Analysis failed', { error: message });
    recordCliEvent('analysis.completed', {
      command: 'analyze',
      scope: hasSuiteId(suiteId)
        ? suiteId
        : isTrue(options.all)
          ? 'all'
          : 'default',
      success: 'false',
      error: message,
    });
    printer.error('Analysis failed.', message);
    process.exit(1);
  }
};

const analyzeSuite = async (printer: Printer, suite: TestSuite, evaluator: TestEvaluator) => {
  printer.status(
    'Quality',
    isPreviewSuite(suite)
      ? 'Metrics sourced from preview suites until the collector is fully wired up.'
      : 'Metrics derived from stored suite metadata.',
  );

  const quality = await evaluator.evaluateQuality(suite);
  const improvements = await evaluator.suggestImprovements(quality, suite.id);

  printer.section('Scope', [
    `suite: ${suite.id}`,
    `framework: ${suite.framework}`,
    `path: ${suite.filePath}`,
  ]);

  printer.section('Quality metrics', formatQualityMetrics(quality));
  printer.section('Overall', [
    `score: ${formatOverallScore(quality.overallScore)}`,
    `anti-patterns: ${quality.antiPatterns.length}`,
  ]);

  if (improvements.length > 0) {
    printer.section(
      'Recommendations',
      improvements.slice(0, 5).map((improvement: Improvement) => {
        return `${improvement.priority} priority — ${improvement.description}`;
      }),
    );
  } else {
    printer.info('No improvement suggestions generated at this time.');
  }

  printer.nextSteps([
    { label: 'Run this suite', command: `testmind run ${suite.id}` },
    { label: 'Request healing suggestions', command: `testmind heal ${suite.id}` },
  ]);
  recordCliEvent('analysis.completed', {
    command: 'analyze',
    suiteId: suite.id,
    success: 'true',
    preview: isPreviewSuite(suite) ? 'preview' : 'stable',
  });
};

const formatQualityMetrics = (quality: QualityScore): string[] => [
  `coverage: ${formatPercentage(quality.coverage)}`,
  `assertion quality: ${formatScore(quality.assertionQuality)}`,
  `independence: ${formatScore(quality.independence)}`,
  `stability: ${formatScore(quality.stability)}`,
  `maintainability: ${formatScore(quality.maintainability)}`,
];

const formatPercentage = (value: number): string => {
  if (!Number.isFinite(value)) {
    return 'n/a';
  }
  const numeric = value > 1 ? value : value * 100;
  return `${numeric.toFixed(1)}%`;
};

const formatScore = (value: number): string => {
  if (!Number.isFinite(value)) {
    return 'n/a';
  }
  return `${(value * 100).toFixed(1)}%`;
};

const formatOverallScore = (value: number): string => {
  if (!Number.isFinite(value)) {
    return 'n/a';
  }
  return `${value.toFixed(1)}/100`;
};
