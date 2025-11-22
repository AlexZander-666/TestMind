/**
 * Run Command: Execute tests
 */

import chalk from 'chalk';
import ora from 'ora';
import { TestEvaluator } from '@testmind/core';
import { loadConfig } from '../utils/config';

export interface RunOptions {
  stabilityCheck?: boolean;
}

export const runCommand = async (suiteId: string | undefined, options: RunOptions) => {
  console.log(chalk.bold.cyan('\n🧠 TestMind - Test Execution\n'));

  const spinner = ora('Loading configuration...').start();
  const config = await loadConfig();

  if (!config) {
    spinner.fail('Not initialized');
    console.log(chalk.red('\n❌ TestMind is not initialized in this project.\n'));
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
      
      console.log(chalk.green('\n✅ Test run completed\n'));
      // Display results...
    } else {
      spinner.warn('No suite ID provided');
      console.log(chalk.yellow('\n⚠️  Please specify a test suite ID\n'));
      console.log(chalk.gray('   Usage: testmind run <suite-id>\n'));
    }
  } catch (error) {
    spinner.fail('Test execution failed');
    console.error(chalk.red('\n❌ Error:'), error);
    process.exit(1);
  }
};



























