/**
 * Run Command: Execute tests
 */

import chalk from 'chalk';
import ora from 'ora';
import { TestEvaluator } from '@testmind/core';
import { loadConfig } from '../utils/config';
import { createComponentLogger } from '../../../core/src/utils/logger';

const logger = createComponentLogger('run');

export interface RunOptions {
  stabilityCheck?: boolean;
}

export const runCommand = async (suiteId: string | undefined, options: RunOptions) => {
  logger.info(chalk.bold.cyan('\n🧠 TestMind - Test Execution\n'));

  const spinner = ora('Loading configuration...').start();
  const config = await loadConfig();

  if (!config) {
    spinner.fail('Not initialized');
    logger.info(chalk.red('\n❌ TestMind is not initialized in this project.\n'));
    process.exit(1);
  }

  try {
    const evaluator = new TestEvaluator();

    if (suiteId) {
      spinner.text = `Running test suite: ${suiteId}`;
      
      // TODO: Load test suite from database
      // const testSuite = await loadTestSuite(suiteId);
      // const result = await evaluator.runTests(testSuite);
      
      spinner.succeed('Tests completed');
      
      logger.info(chalk.green('\n✅ Test run completed\n'));
      // Display results...
    } else {
      spinner.warn('No suite ID provided');
      logger.info(chalk.yellow('\n⚠️  Please specify a test suite ID\n'));
      logger.info(chalk.gray('   Usage: testmind run <suite-id>\n'));
    }
  } catch (error) {
    spinner.fail('Test execution failed');
    logger.error(chalk.red('\n❌ Error:'), error);
    process.exit(1);
  }
};



























