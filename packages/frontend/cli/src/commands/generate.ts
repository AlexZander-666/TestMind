/**
 * Generate Command: Generate tests for code
 * This command orchestrates the full test generation workflow
 */

import path from 'path';
import {
  ContextEngine,
  TestGenerator,
  LLMService,
  TestReviewer,
  GitAutomation,
  createComponentLogger,
  Database as TestMindDatabase,
} from '@testmind/core';
import { loadConfig } from '../utils/config';
import { type Printer } from '../ui/printer';
import { createSpinner } from '../ui/spinner';
import { createStdoutPrinter } from '../ui/stdoutPrinter';
import { getCliLogLevel } from '../utils/logLevel';
import { recordCliEvent } from '../utils/telemetry';
import type { ProjectConfig, TestSuite } from '@testmind/shared';

const logger = createComponentLogger('generate');

export interface GenerateOptions {
  type?: 'unit' | 'integration' | 'e2e';
  function?: string;
  framework?: string;
}

export const generateCommand = async (targetPath: string | undefined, options: GenerateOptions) => {
  const logLevel = getCliLogLevel();
  const printer = createStdoutPrinter({ logger, logLevel });

  printer.header('generate', 'AI test generation');

  if (!process.env.OPENAI_API_KEY) {
    printer.error('OPENAI_API_KEY is not set.', 'Add the environment variable and rerun.');
    process.exit(1);
  }

  const configSpinner = createSpinner('Loading project configuration...', { logger, logLevel });
  configSpinner.start();
  const config = await loadConfig();

  if (!config) {
    configSpinner.fail('Configuration missing');
    printer.error('TestMind is not initialized in this project.', 'Run "testmind init" first.');
    process.exit(1);
  }
  configSpinner.succeed('Configuration ready');
  recordCliEvent('config.loaded', { command: 'generate', framework: config.testFramework });

  const requestedType = options.type ?? 'unit';
  if (requestedType !== 'unit') {
    printer.error(
      'Integration and E2E generation are paused.',
      'Re-run without --type or set --type unit.'
    );
    return;
  }

  const enginesSpinner = createSpinner('Initializing AI engines...', { logger, logLevel });
  enginesSpinner.start();

  let contextEngine: ContextEngine | null = null;

  try {
    contextEngine = new ContextEngine(config);
    const llmService = new LLMService();
    const testGenerator = new TestGenerator(llmService);
    enginesSpinner.succeed('Engines ready');

    const target = targetPath || process.cwd();
    const absolutePath = path.resolve(process.cwd(), target);
    const relPath = path.relative(process.cwd(), absolutePath) || '.';

    printer.section('Scope', [
      `target: ${relPath}`,
      `type: ${requestedType}`,
      `framework: ${config.testFramework}`,
    ]);

    const indexSpinner = createSpinner('Indexing project...', { logger, logLevel });
    indexSpinner.start();
    const indexResult = await contextEngine.indexProject(config.repoPath);
    const indexSummary = `Indexed ${indexResult.filesIndexed} files / ${indexResult.functionsExtracted} functions`;
    indexSpinner.succeed(indexSummary);

    await generateUnitTest(contextEngine, testGenerator, absolutePath, options, config, printer);

    printer.blank();
    printer.success('Test generation complete.');
    printer.nextSteps([
      { label: 'Review generated files', command: 'git status' },
      {
        label: 'Run your tests',
        command: config.testFramework === 'jest' ? 'npm test' : 'pnpm test',
      },
    ]);
    recordCliEvent('generate.completed', { command: 'generate', status: 'success' });
  } catch (error: any) {
    enginesSpinner.fail('Generation failed');
    printer.error('Test generation failed.', 'Run with --verbose for more logs.');
    logger.error('Generation failed', { error: error?.message || error });
    recordCliEvent('generate.completed', { command: 'generate', status: 'failure' });
    process.exit(1);
  } finally {
    if (contextEngine) {
      try {
        await contextEngine.dispose();
      } catch (disposeError) {
        logger.warn('Failed to dispose context engine', { error: disposeError });
      }
    }
  }
};

const generateUnitTest = async (
  contextEngine: ContextEngine,
  testGenerator: TestGenerator,
  filePath: string,
  options: GenerateOptions,
  config: any,
  printer: Printer
) => {
  const spinnerLevel = getCliLogLevel();
  const analysisSpinner = createSpinner('Analyzing function...', {
    logger,
    logLevel: spinnerLevel,
  });
  analysisSpinner.start();

  if (!options.function) {
    analysisSpinner.fail('Function not provided');
    printer.error('Provide a function name with --function.', 'Example: --function add');
    return;
  }

  try {
    const funcName = options.function;
    const functionContext = await contextEngine.getFunctionContext(filePath, funcName);
    analysisSpinner.succeed('Function analysis ready');

    printer.section('Function', [
      `name: ${functionContext.signature.name}()`,
      `parameters: ${functionContext.signature.parameters.length}`,
      `async: ${functionContext.signature.isAsync ? 'yes' : 'no'}`,
      `complexity: ${functionContext.complexity.cyclomaticComplexity}`,
      `dependencies: ${functionContext.dependencies.length}`,
      `side effects: ${functionContext.sideEffects.length || 'none'}`,
    ]);

    const generationSpinner = createSpinner('Generating test case...', {
      logger,
      logLevel: spinnerLevel,
    });
    generationSpinner.start();
    const testSuite = await testGenerator.generateUnitTest(functionContext, config.id);
    generationSpinner.succeed('Test ready');

    if (testSuite.metadata && 'cost' in testSuite.metadata) {
      const cost = (testSuite.metadata as any).cost;
      printer.info(`estimated cost: ~$${Number(cost).toFixed(4)}`);
    }

    printer.section('Review', ['Inspect the proposed diff below.']);
    const reviewer = new TestReviewer();
    const diffResult = await reviewer.generateDiff(testSuite);
    recordCliEvent('diff.generated', {
      command: 'generate',
      file: path.relative(process.cwd(), testSuite.filePath),
    });
    logger.info(reviewer.formatForCLI(diffResult));

    const inquirer = (await import('inquirer')).default;
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'Select next step',
        choices: [
          { name: 'Apply and commit', value: 'apply' },
          { name: 'Apply without Git', value: 'apply-no-git' },
          { name: 'Reject', value: 'reject' },
          { name: 'Regenerate', value: 'regenerate' },
        ],
        default: 'apply',
      },
    ]);

    if (action === 'reject') {
      printer.warn('Test rejected. No files were created.');
      return;
    }

    if (action === 'regenerate') {
      printer.info('Regenerating test...');
      return await generateUnitTest(contextEngine, testGenerator, filePath, options, config, printer);
    }

    const saveSpinner = createSpinner('Saving test...', {
      logger,
      logLevel: spinnerLevel,
    });
    saveSpinner.start();

    try {
      await reviewer.applyTest(testSuite);
      await persistSuiteToDatabase(config, testSuite);
      saveSpinner.succeed(`Saved to ${testSuite.filePath}`);

      if (action === 'apply') {
        const gitSpinner = createSpinner('Creating Git branch...', {
          logger,
          logLevel: spinnerLevel,
        });
        gitSpinner.start();

        try {
          const gitAutomation = new GitAutomation(config.repoPath);
          const isGitRepo = await gitAutomation.isGitRepo();

          if (isGitRepo) {
            const commitMessage = GitAutomation.generateCommitMessage({
              functionName: funcName,
              filePath,
            });

            const gitResult = await gitAutomation.commitTestChanges({
              message: commitMessage,
              files: [testSuite.filePath],
            });

            gitSpinner.succeed(`Branch ${gitResult.branchName}`);
            printer.success('Test committed to a new branch.');
            printer.keyValue('branch', gitResult.branchName);
          } else {
            gitSpinner.info('Not a Git repository');
            printer.success('Test file created (Git skip).');
          }
        } catch (gitError: any) {
          gitSpinner.warn('Git commit failed');
          printer.warn(`Test saved but Git commit failed: ${gitError?.message || gitError}`);
        }
      } else {
        printer.success('Test file created.');
      }

      printer.nextSteps([
        { label: 'Review the test', command: testSuite.filePath },
        {
          label: 'Run your suite',
          command: config.testFramework === 'jest' ? 'npm test' : 'pnpm test',
        },
      ]);
    } catch (error: any) {
      saveSpinner.fail('Failed to save test');
      printer.error('Failed to apply the generated test.', error?.message);
    }
  } catch (error) {
    analysisSpinner.fail('Failed to analyze function');
    throw error;
  }
};

const generateIntegrationTest = async (
  _contextEngine: ContextEngine,
  _testGenerator: TestGenerator,
  _modulePath: string,
  _config: any,
  printer: Printer
) => {
  const spinner = createSpinner('Analyzing module...', { logLevel: getCliLogLevel() });
  spinner.start();
  spinner.stop();
  printer.warn('Integration test generation is not available yet. Use unit generation for now.');
};

const persistSuiteToDatabase = async (config: ProjectConfig, suite: TestSuite): Promise<void> => {
  const repoPath = config.repoPath || process.cwd();
  const dbPath = path.join(repoPath, '.testmind', 'testmind.db');
  const database = new TestMindDatabase(dbPath);

  try {
    await database.initialize();
    await database.saveTestSuite(suite);
    logger.info('Persisted suite to database', { suiteId: suite.id, dbPath });
  } catch (error) {
    logger.warn('Failed to persist suite to database', {
      suiteId: suite.id,
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    await database.close();
  }
};
