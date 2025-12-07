/**
 * TestRunner: Execute tests and collect results
 */

import { spawn } from 'child_process';
import * as path from 'path';

import fs from 'fs-extra';
import type { TestSuite, CoverageInfo, TestError, TestFramework } from '@testmind/shared';

import { createComponentLogger } from '../utils/logger';

const logger = createComponentLogger('TestRunner');
const REPORTS_DIR = path.join('.testmind', 'reports');
const TEMP_SUITE_DIR = path.join('.testmind', 'suites');

type SupportedFramework = 'vitest' | 'jest';

export interface ExecutionResult {
  success: boolean;
  coverage: CoverageInfo;
  duration: number;
  errors: TestError[];
}

type JsonTestResult = {
  name?: string;
  status?: string;
  message?: string;
  assertionResults?: Array<{
    title?: string;
    status?: string;
    failureMessages?: string[];
    location?: { line?: number; column?: number };
  }>;
};

type JsonReport = {
  success?: boolean;
  numFailedTests?: number;
  numTotalTests?: number;
  testResults?: JsonTestResult[];
};

type CommandResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

export class TestRunner {
  /**
   * Run test suite in isolated environment
   */
  async run(testSuite: TestSuite): Promise<ExecutionResult> {
    logger.info(`[TestRunner] Executing tests: ${testSuite.filePath}`);

    if (this.isPreviewSuite(testSuite)) {
      logger.warn('Suite is marked as preview; returning placeholder execution result.');
      return this.buildPlaceholderResult();
    }

    const repoPath = this.resolveRepoPath(testSuite);
    const preparedSuite = await this.prepareTestFile(testSuite, repoPath);
    const reportPath = await this.prepareReportPath(repoPath, testSuite.id);
    const framework = this.normalizeFramework(testSuite.framework);
    const command = this.buildCommand(framework, preparedSuite.testFilePath, reportPath, repoPath);

    const startTime = Date.now();
    let report: JsonReport | null = null;
    let commandResult: CommandResult | null = null;

    try {
      commandResult = await this.executeCommand(command.executable, command.args, repoPath);
      report = await this.tryReadReport(reportPath);
    } finally {
      await preparedSuite.cleanup?.();
      await this.safeRemove(reportPath);
    }

    if (!report && (commandResult?.exitCode ?? 0) !== 0) {
      const errorMessage = `Test command failed (${commandResult?.exitCode ?? 'unknown'}). See logs for details.`;
      logger.error(errorMessage, {
        stdout: commandResult?.stdout,
        stderr: commandResult?.stderr,
      });
      throw new Error(errorMessage);
    }

    const duration = Date.now() - startTime;
    const coverage = (await this.readCoverageSummary(repoPath)) ?? this.emptyCoverage();
    const errors = this.extractErrors(report);
    const success = this.isReportSuccessful(report, commandResult?.exitCode ?? 0);

    logger.info('Test execution finished', {
      success,
      duration,
      exitCode: commandResult?.exitCode ?? 0,
      errors: errors.length,
    });

    return {
      success,
      coverage,
      duration,
      errors,
    };
  }

  /**
   * Run tests multiple times to detect flakiness
   */
  async runWithStabilityCheck(testSuite: TestSuite, iterations = 3): Promise<{
    results: ExecutionResult[];
    isStable: boolean;
  }> {
    logger.info(`[TestRunner] Running stability check (${iterations} iterations)`);

    const results: ExecutionResult[] = [];
    for (let i = 0; i < iterations; i++) {
      results.push(await this.run(testSuite));
    }

    const allPassed = results.every((r) => r.success);
    const allFailed = results.every((r) => !r.success);
    const isStable = allPassed || allFailed;

    return { results, isStable };
  }

  private isPreviewSuite(testSuite: TestSuite): boolean {
    return Boolean(testSuite.metadata && (testSuite.metadata as Record<string, unknown>).preview === true);
  }

  private buildPlaceholderResult(): ExecutionResult {
    return {
      success: false,
      coverage: this.emptyCoverage(),
      duration: 0,
      errors: [
        {
          message: 'Preview suites do not have executable artifacts yet.',
        },
      ],
    };
  }

  private resolveRepoPath(testSuite: TestSuite): string {
    const metadata = (testSuite.metadata ?? {}) as Record<string, unknown>;
    if (typeof metadata.repoPath === 'string' && metadata.repoPath.length > 0) {
      return metadata.repoPath;
    }
    return process.cwd();
  }

  private async prepareTestFile(
    testSuite: TestSuite,
    repoPath: string,
  ): Promise<{ testFilePath: string; cleanup?: () => Promise<void> }> {
    const targetPath = this.resolveSuiteFilePath(testSuite.filePath, repoPath);
    if (await fs.pathExists(targetPath)) {
      return { testFilePath: targetPath };
    }

    const tempDir = path.join(repoPath, TEMP_SUITE_DIR);
    await fs.ensureDir(tempDir);
    const extension = path.extname(targetPath) || '.test.ts';
    const tempFilePath = path.join(tempDir, `${testSuite.id}${extension}`);
    await fs.writeFile(tempFilePath, testSuite.code, 'utf8');

    logger.info('Temporary test file created', { tempFilePath });

    return {
      testFilePath: tempFilePath,
      cleanup: async () => {
        await fs.remove(tempFilePath);
      },
    };
  }

  private resolveSuiteFilePath(filePath: string, repoPath: string): string {
    if (path.isAbsolute(filePath)) {
      return filePath;
    }
    return path.join(repoPath, filePath);
  }

  private async prepareReportPath(repoPath: string, suiteId: string): Promise<string> {
    const reportsDir = path.join(repoPath, REPORTS_DIR);
    await fs.ensureDir(reportsDir);
    return path.join(reportsDir, `${suiteId}-${Date.now()}.json`);
  }

  private normalizeFramework(framework: TestFramework): SupportedFramework {
    if (framework === 'vitest' || framework === 'jest') {
      return framework;
    }
    throw new Error(
      `Unsupported test framework "${framework}". TestMind currently supports running Vitest or Jest suites.`,
    );
  }

  private buildCommand(
    framework: SupportedFramework,
    testFilePath: string,
    reportPath: string,
    repoPath: string,
  ): { executable: string; args: string[] } {
    const executable = this.resolveExecutable(framework, repoPath);

    if (framework === 'vitest') {
      return {
        executable,
        args: [
          'run',
          testFilePath,
          '--reporter=json',
          '--outputFile',
          reportPath,
          '--coverage',
          '--passWithNoTests',
        ],
      };
    }

    return {
      executable,
      args: [
        testFilePath,
        '--runInBand',
        '--json',
        `--outputFile=${reportPath}`,
        '--coverage',
        '--testLocationInResults',
      ],
    };
  }

  private resolveExecutable(framework: SupportedFramework, repoPath: string): string {
    const binName = framework;
    const binDir = path.join(repoPath, 'node_modules', '.bin');
    const withExtension = process.platform === 'win32' ? `${binName}.cmd` : binName;
    const localPath = path.join(binDir, withExtension);

    if (fs.existsSync(localPath)) {
      return localPath;
    }

    return binName;
  }

  private executeCommand(command: string, args: string[], cwd: string): Promise<CommandResult> {
    return new Promise((resolve, reject) => {
      logger.debug('Executing test command', { command, args, cwd });
      const child = spawn(command, args, {
        cwd,
        env: {
          ...process.env,
          FORCE_COLOR: '0',
          NODE_ENV: process.env.NODE_ENV ?? 'test',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: false,
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('error', (error) => {
        reject(error);
      });

      child.on('close', (code) => {
        logger.debug('Test command completed', { code, stdoutLength: stdout.length, stderrLength: stderr.length });
        resolve({
          exitCode: code ?? 0,
          stdout,
          stderr,
        });
      });
    });
  }

  private async tryReadReport(reportPath: string): Promise<JsonReport | null> {
    try {
      if (!(await fs.pathExists(reportPath))) {
        return null;
      }
      const content = await fs.readFile(reportPath, 'utf8');
      return JSON.parse(content) as JsonReport;
    } catch (error) {
      logger.warn('Failed to parse test report', {
        reportPath,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  private async safeRemove(filePath: string): Promise<void> {
    try {
      await fs.remove(filePath);
    } catch (error) {
      logger.warn('Failed to clean up file', {
        filePath,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async readCoverageSummary(repoPath: string): Promise<CoverageInfo | null> {
    const summaryPath = path.join(repoPath, 'coverage', 'coverage-summary.json');
    if (!(await fs.pathExists(summaryPath))) {
      return null;
    }

    try {
      const summary = await fs.readJSON(summaryPath);
      const total = summary?.total;
      if (!total) {
        return null;
      }

      const linesTotal = total.lines?.total ?? 0;
      const linesCovered = total.lines?.covered ?? 0;
      const branchesTotal = total.branches?.total ?? 0;
      const branchesCovered = total.branches?.covered ?? 0;
      const functionsTotal = total.functions?.total ?? 0;
      const functionsCovered = total.functions?.covered ?? 0;

      return {
        linesCovered,
        linesTotal,
        branchesCovered,
        branchesTotal,
        functionsCovered,
        functionsTotal,
        percentage: linesTotal > 0 ? (linesCovered / linesTotal) * 100 : 0,
      };
    } catch (error) {
      logger.warn('Failed to parse coverage summary', {
        summaryPath,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  private emptyCoverage(): CoverageInfo {
    return {
      linesCovered: 0,
      linesTotal: 0,
      branchesCovered: 0,
      branchesTotal: 0,
      functionsCovered: 0,
      functionsTotal: 0,
      percentage: 0,
    };
  }

  private extractErrors(report: JsonReport | null): TestError[] {
    if (!report?.testResults || report.testResults.length === 0) {
      return [];
    }

    const errors: TestError[] = [];
    for (const result of report.testResults) {
      if (result.status === 'failed' && result.message) {
        errors.push({
          message: result.message,
          location: result.name
            ? {
                filePath: result.name,
                line: 0,
                column: 0,
              }
            : undefined,
        });
      }

      if (!result.assertionResults) {
        continue;
      }

      for (const assertion of result.assertionResults) {
        if (assertion.status !== 'failed') {
          continue;
        }

        errors.push({
          message: assertion.failureMessages?.[0] ?? assertion.title ?? 'Test failed',
          location:
            assertion.location && result.name
              ? {
                  filePath: result.name,
                  line: assertion.location.line ?? 0,
                  column: assertion.location.column ?? 0,
                }
              : undefined,
        });
      }
    }

    return errors;
  }

  private isReportSuccessful(report: JsonReport | null, exitCode: number): boolean {
    if (typeof report?.success === 'boolean') {
      return report.success;
    }

    if (typeof report?.numFailedTests === 'number') {
      return report.numFailedTests === 0;
    }

    return exitCode === 0;
  }
}

























