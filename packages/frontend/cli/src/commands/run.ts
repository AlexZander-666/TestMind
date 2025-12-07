/**
 * Run Command: Execute tests
 */

import { createComponentLogger } from '@testmind/core';
import { createSpinner } from '../ui/spinner';
import { createStdoutPrinter } from '../ui/stdoutPrinter';
import { loadConfig } from '../utils/config';
import { printContextDiagnostics } from '../utils/contextDebug';
import { getCliLogLevel } from '../utils/logLevel';
import { recordCliEvent } from '../utils/telemetry';
import { resolveSuite, isPreviewSuite } from '../utils/suite';
import { TestRunner, type ExecutionResult } from '@testmind/core';
import type { CoverageInfo } from '@testmind/shared';

export interface RunOptions {
  stabilityCheck?: boolean;
  debugContext?: boolean;
  json?: boolean;
}

const hasSuiteId = (value?: string): value is string => typeof value === 'string' && value.trim().length > 0;
const isEnabled = (value?: boolean): value is true => value === true;
type StabilityReport = Awaited<ReturnType<TestRunner['runWithStabilityCheck']>>;

type RunJsonPayload = {
  command: 'run';
  suiteId: string | null;
  status: 'executed' | 'missing_suite_id';
  success: boolean;
  stabilityCheck: boolean;
  debugContext: boolean;
  suite?: {
    id: string;
    framework: string;
    filePath: string;
  };
  execution?: {
    status: 'passed' | 'failed';
    duration: number;
    coverage?: CoverageInfo;
    errors: number;
  };
  stability?: {
    stable: boolean;
    iterations: number;
    results: Array<{
      iteration: number;
      success: boolean;
      coverage?: CoverageInfo;
    }>;
  };
  nextSteps: string[];
  timestamp: string;
};

export const runCommand = async (suiteId: string | undefined, options: RunOptions) => {
  const logLevel = getCliLogLevel();
  const logger = createComponentLogger('run');
  const printer = createStdoutPrinter({ logger, logLevel });
  const jsonMode = options.json === true;

  logger.info('Run command invoked', {
    suiteId: suiteId ?? null,
    stabilityCheck: options.stabilityCheck ?? false,
    jsonMode,
  });

  if (!jsonMode) {
    printer.header('run', 'Execute a test suite (preview)');
  }

  const spinner = jsonMode
    ? null
    : createSpinner('Loading configuration...', { logger, logLevel });
  spinner?.start();

  const config = await loadConfig();

  if (!config) {
    const message = 'TestMind is not initialized in this project.';
    if (jsonMode) {
      process.stdout.write(
        `${JSON.stringify(
          {
            command: 'run',
            success: false,
            error: message,
            hint: 'Run "testmind init" first.',
          },
          null,
          2,
        )}\n`,
      );
    } else {
      spinner?.fail('Configuration missing');
      printer.error(message, 'Run "testmind init" first.');
    }
    process.exit(1);
  }

  spinner?.succeed('Configuration ready');
  logger.info('Configuration ready', { suiteId, jsonMode });
  recordCliEvent('config.loaded', {
    command: 'run',
    suiteId: hasSuiteId(suiteId) ? suiteId : 'unspecified',
    json: jsonMode ? 'true' : 'false',
  });
  let jsonPayload: RunJsonPayload | null = null;

  const runner = new TestRunner();
  let runSpinner: ReturnType<typeof createSpinner> | undefined;
  let stabilitySpinner: ReturnType<typeof createSpinner> | undefined;

  try {
    if (hasSuiteId(suiteId)) {
      const suite = await resolveSuite(config, suiteId);

      if (!jsonMode) {
        printer.status(
          'Preview',
          isPreviewSuite(suite)
            ? 'TestRunner currently emits placeholder metrics until the executor is wired up.'
            : 'Suite metadata loaded from storage.',
        );
      }

      if (!jsonMode) {
        runSpinner = createSpinner(`Running suite ${suite.id}...`, { logger, logLevel });
        runSpinner.start();
      }

      let execution: ExecutionResult | null = null;
      let stabilityReport: StabilityReport | null = null;

      if (isEnabled(options.stabilityCheck)) {
        if (!jsonMode) {
          stabilitySpinner = createSpinner('Performing stability check...', { logger, logLevel });
          stabilitySpinner.start();
        }
        stabilityReport = await runner.runWithStabilityCheck(suite);
        if (!jsonMode) {
          stabilitySpinner?.succeed('Stability check complete');
          runSpinner?.succeed('Stability run complete');
        }
        execution = stabilityReport.results[stabilityReport.results.length - 1] ?? null;
      } else {
        execution = await runner.run(suite);
        if (!jsonMode) {
          runSpinner?.succeed('Run complete');
        }
      }

      if (!jsonMode) {
        if (execution) {
          printer.success('Test suite executed through TestRunner.');
          printer.section('Suite', [
            `id: ${suite.id}`,
            `framework: ${suite.framework}`,
            `file path: ${suite.filePath}`,
            `placeholder data: ${isPreviewSuite(suite) ? 'yes' : 'no'}`,
          ]);
          printer.section('Execution', [
            `status: ${execution.success ? 'passed' : 'failed'}`,
            `duration: ${execution.duration}ms`,
            `coverage: ${formatCoverage(execution.coverage)}`,
            `errors: ${execution.errors.length}`,
          ]);
        } else {
          printer.warn('No execution result returned from TestRunner.');
        }

        if (stabilityReport) {
          printer.section('Stability', formatStabilityReport(stabilityReport));
        }
      }

      const nextSteps = [
        { label: 'Inspect quality metrics', command: `testmind analyze ${suite.id}` },
        { label: 'Review context', command: 'testmind context' },
      ];

      if (!isEnabled(options.stabilityCheck)) {
        nextSteps.push({ label: 'Run stability check', command: `testmind run ${suite.id} --stability-check` });
      }

      if (!jsonMode) {
        printer.nextSteps(nextSteps);
      }

      const jsonNextSteps = nextSteps.map((step) => step.command ?? step.label);

      jsonPayload = {
        command: 'run',
        suiteId: suite.id,
        status: 'executed',
        success: Boolean(execution?.success),
        stabilityCheck: isEnabled(options.stabilityCheck),
        debugContext: isEnabled(options.debugContext),
        suite: {
          id: suite.id,
          framework: suite.framework,
          filePath: suite.filePath,
        },
        execution: execution
          ? {
              status: execution.success ? 'passed' : 'failed',
              duration: execution.duration,
              coverage: execution.coverage,
              errors: execution.errors.length,
            }
          : undefined,
        stability: stabilityReport
          ? {
              stable: stabilityReport.isStable,
              iterations: stabilityReport.results.length,
              results: stabilityReport.results.map((result, index) => ({
                iteration: index + 1,
                success: result.success,
                coverage: result.coverage,
              })),
            }
          : undefined,
        nextSteps: jsonNextSteps,
        timestamp: new Date().toISOString(),
      };
    } else {
      if (!jsonMode) {
        spinner?.warn('No suite ID provided');
        printer.warn('Specify a suite ID to run.', 'Usage: testmind run <suite-id>');
      }

      jsonPayload = {
        command: 'run',
        suiteId: null,
        status: 'missing_suite_id',
        success: false,
        stabilityCheck: isEnabled(options.stabilityCheck),
        debugContext: isEnabled(options.debugContext),
        nextSteps: ['testmind run <suite-id>'],
        timestamp: new Date().toISOString(),
      };
    }

    if (jsonPayload) {
      recordCliEvent('run.completed', {
        command: 'run',
        suiteId: jsonPayload.suiteId ?? 'missing',
        success: jsonPayload.success ? 'true' : 'false',
        stabilityCheck: jsonPayload.stabilityCheck ? 'true' : 'false',
        debugContext: jsonPayload.debugContext ? 'true' : 'false',
        jsonMode: jsonMode ? 'true' : 'false',
      });
    }

    if (!jsonMode && isEnabled(options.debugContext)) {
      const contextKey = hasSuiteId(suiteId) ? `run:${suiteId}` : 'run';
      recordCliEvent('context.diagnostics', {
        command: 'run',
        context: contextKey,
      });
      await printContextDiagnostics(config, {
        query: contextKey,
        projectPath: process.cwd(),
      });
    }

    if (jsonMode && jsonPayload) {
      process.stdout.write(`${JSON.stringify(jsonPayload, null, 2)}\n`);
      return;
    }
  } catch (error) {
    runSpinner?.fail('Test execution failed');
    stabilitySpinner?.fail('Stability check failed');
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Run command failed', { suiteId, error: message });
    recordCliEvent('run.completed', {
      command: 'run',
      suiteId: suiteId ?? 'missing',
      success: 'false',
      error: message,
      jsonMode: jsonMode ? 'true' : 'false',
    });
    if (jsonMode) {
      process.stdout.write(
        `${JSON.stringify(
          {
            command: 'run',
            success: false,
            error: message,
          },
          null,
          2,
        )}\n`,
      );
    } else {
      printer.error('Test execution failed.', message);
    }
    process.exit(1);
  }
};

const formatCoverage = (coverage: CoverageInfo | undefined): string => {
  if (!coverage) {
    return 'n/a';
  }

  const linesCovered = coverage.linesCovered ?? 0;
  const linesTotal = coverage.linesTotal ?? 0;
  const rawPercent = Number.isFinite(coverage.percentage) ? coverage.percentage : linesTotal > 0 ? (linesCovered / linesTotal) * 100 : 0;
  const percentage = Number.isFinite(rawPercent) ? rawPercent : 0;

  return `${percentage.toFixed(1)}% (${linesCovered}/${linesTotal} lines)`;
};

const formatStabilityReport = (report: StabilityReport): string[] => {
  const lines = [
    `stable: ${report.isStable ? 'yes' : 'no'}`,
    `iterations: ${report.results.length}`,
  ];

  if (report.results.length === 0) {
    lines.push('No stability runs recorded.');
    return lines;
  }

  report.results.forEach((result, index) => {
    lines.push(`run ${index + 1}: ${result.success ? 'pass' : 'fail'} (${formatCoverage(result.coverage)})`);
  });

  if (!report.isStable) {
    lines.push('Outcomes varied across runs; inspect logs for flakiness.');
  }

  return lines;
};
