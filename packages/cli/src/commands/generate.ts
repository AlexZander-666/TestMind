/**
 * Generate Command: Generate tests for code
 * This command orchestrates the full test generation workflow
 */

import chalk from 'chalk';
import ora from 'ora';
import { ContextEngine, TestGenerator, LLMService, TestReviewer, GitAutomation } from '@testmind/core';
import { loadConfig } from '../utils/config';
import path from 'path';
import { createComponentLogger } from '../../../core/src/utils/logger';

const logger = createComponentLogger('generate');

export interface GenerateOptions {
  type?: 'unit' | 'integration' | 'e2e';
  function?: string;
  framework?: string;
}

export const generateCommand = async (targetPath: string | undefined, options: GenerateOptions) => {
  logger.info(chalk.bold.cyan('\n🧠 TestMind - AI-Powered Test Generation\n'));

  // Check API key first
  if (!process.env.OPENAI_API_KEY) {
    logger.info(chalk.red('❌ OPENAI_API_KEY environment variable not set\n'));
    logger.info(chalk.gray('Please set your OpenAI API key:'));
    logger.info(chalk.cyan('  export OPENAI_API_KEY=sk-your-key-here\n'));
    logger.info(chalk.gray('Get your key at: https://platform.openai.com/api-keys\n'));
    process.exit(1);
  }

  const spinner = ora('Loading project configuration...').start();
  const config = await loadConfig();
  
  if (!config) {
    spinner.fail('Not initialized');
    logger.info(chalk.red('\n❌ TestMind is not initialized in this project.'));
    logger.info(chalk.gray('   Run: testmind init\n'));
    process.exit(1);
  }

  spinner.text = 'Initializing AI engines...';

  try {
    const contextEngine = new ContextEngine(config);
    const llmService = new LLMService();
    const testGenerator = new TestGenerator(llmService);

    spinner.succeed('Engines initialized');

    const target = targetPath || process.cwd();
    const absolutePath = path.resolve(process.cwd(), target);

    const relPath = path.relative(process.cwd(), absolutePath);
    logger.info(chalk.gray('\n📂 Target: ' + relPath));
    logger.info(chalk.gray('🎯 Type: ' + (options.type || 'unit')));
    logger.info(chalk.gray('🔧 Framework: ' + config.testFramework + '\n'));

    spinner.start('Indexing project...');
    const indexResult = await contextEngine.indexProject(config.repoPath);
    const indexMsg = 'Indexed ' + indexResult.filesIndexed + ' files, ' + indexResult.functionsExtracted + ' functions';
    spinner.succeed(indexMsg);

    if (options.type === 'unit' || !options.type) {
      await generateUnitTest(contextEngine, testGenerator, absolutePath, options, config);
    } else if (options.type === 'integration') {
      await generateIntegrationTest(contextEngine, testGenerator, absolutePath, config);
    } else if (options.type === 'e2e') {
      logger.info(chalk.yellow('\n⚠️  E2E test generation is coming in Month 3-4.\n'));
    }

    await contextEngine.dispose();

    logger.info(chalk.green('\n✨ Test generation complete!\n'));
    logger.info(chalk.gray('💡 Tip: Review the test and run it with:'));
    const testCmd = config.testFramework === 'jest' ? 'npm test' : 'pnpm test';
    logger.info(chalk.cyan('   ' + testCmd + '\n'));

  } catch (error) {
    spinner.fail('Generation failed');
    logger.error(chalk.red('\n❌ Error:'), error);
    
    const errorMsg = String(error);
    if (errorMsg.includes('OPENAI_API_KEY')) {
      logger.info(chalk.gray('\n💡 Make sure your API key is set correctly\n'));
    } else if (errorMsg.includes('not found')) {
      logger.info(chalk.gray('\n💡 Check that the file and function name are correct\n'));
    }
    
    process.exit(1);
  }
};

const generateUnitTest = async (
  contextEngine: ContextEngine,
  testGenerator: TestGenerator,
  filePath: string,
  options: GenerateOptions,
  config: any
) => {
  const spinner = ora('Analyzing function...').start();

  try {
    if (!options.function) {
      spinner.fail('Function name required');
      logger.info(chalk.red('\n❌ Please specify a function name with --function <name>\n'));
      logger.info(chalk.gray('Example:'));
      logger.info(chalk.cyan('  testmind generate src/utils/math.ts --function add\n'));
      return;
    }

    const funcName = options.function;
    spinner.text = 'Extracting context for ' + funcName + '()...';
    const functionContext = await contextEngine.getFunctionContext(filePath, funcName);

    spinner.succeed('Function analysis complete');
    
    logger.info(chalk.bold('\n📊 Function Analysis:\n'));
    logger.info('   Function: ' + chalk.cyan(functionContext.signature.name + '()'));
    logger.info('   Parameters: ' + functionContext.signature.parameters.length);
    logger.info('   Async: ' + (functionContext.signature.isAsync ? chalk.green('Yes') : chalk.gray('No')));
    logger.info('   Complexity: ' + chalk.yellow(String(functionContext.complexity.cyclomaticComplexity)));
    logger.info('   Dependencies: ' + functionContext.dependencies.length);
    const sideEffectsMsg = functionContext.sideEffects.length > 0 
      ? chalk.yellow(String(functionContext.sideEffects.length))
      : chalk.green('None');
    logger.info('   Side Effects: ' + sideEffectsMsg);

    logger.info(chalk.bold('\n🤖 Generating test with AI...\n'));
    spinner.start('Calling OpenAI API (this may take 10-30 seconds)...');
    
    const testSuite = await testGenerator.generateUnitTest(functionContext, config.id);

    spinner.succeed('AI test generation complete!');

    if (testSuite.metadata && 'cost' in testSuite.metadata) {
      const cost = (testSuite.metadata as any).cost;
      logger.info(chalk.gray('   💰 Estimated cost: ~$' + cost.toFixed(4)));
    }

    // ===== Diff-First Review Flow =====
    logger.info(chalk.green.bold('\n📋 Diff-First Review: Please review the proposed test\n'));

    const reviewer = new TestReviewer();
    const diffResult = await reviewer.generateDiff(testSuite);

    // Display diff
    logger.info(reviewer.formatForCLI(diffResult));
    logger.info('\n');

    // Interactive review
    const inquirer = (await import('inquirer')).default;
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: [
          { name: '✅ Apply - Save test and commit to new branch', value: 'apply' },
          { name: '💾 Apply without Git - Just save the file', value: 'apply-no-git' },
          { name: '❌ Reject - Discard this test', value: 'reject' },
          { name: '🔄 Regenerate - Try generating again', value: 'regenerate' },
        ],
        default: 'apply',
      },
    ]);

    if (action === 'reject') {
      logger.info(chalk.yellow('\n⚠️  Test rejected. No changes made.\n'));
      return;
    }

    if (action === 'regenerate') {
      logger.info(chalk.cyan('\n🔄 Regenerating test...\n'));
      // Recursively call generateUnitTest
      return await generateUnitTest(contextEngine, testGenerator, filePath, options, config);
    }

    // Apply the test
    const saveSpinner = ora('Applying test...').start();

    try {
      await reviewer.applyTest(testSuite);
      saveSpinner.succeed('Test saved to: ' + chalk.cyan(testSuite.filePath));

      // Git integration (optional)
      if (action === 'apply') {
        const gitSpinner = ora('Creating Git branch and commit...').start();
        
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

            gitSpinner.succeed(
              'Created branch: ' + chalk.cyan(gitResult.branchName)
            );

            logger.info(chalk.green('\n✅ Success! Test committed to new branch.\n'));
            logger.info(chalk.gray('📍 Branch: ' + chalk.cyan(gitResult.branchName)));
          } else {
            gitSpinner.info('Not a Git repository - skipping commit');
            logger.info(chalk.green('\n✅ Success! Test file created.\n'));
          }
        } catch (gitError) {
          gitSpinner.warn('Git commit failed - test still saved');
          logger.info(chalk.yellow('\n⚠️  Test saved but Git commit failed: ' + gitError));
        }
      } else {
        logger.info(chalk.green('\n✅ Success! Test file created.\n'));
      }

      logger.info(chalk.gray('Next steps:'));
      logger.info(chalk.gray('  1. Review the test: ' + testSuite.filePath));
      const runCmd = config.testFramework === 'jest' ? 'npm test' : 'pnpm test';
      logger.info(chalk.gray('  2. Run tests: ' + runCmd + '\n'));

    } catch (error) {
      saveSpinner.fail('Failed to apply test');
      logger.info(chalk.red('\n❌ Error: ' + error + '\n'));
    }

  } catch (error) {
    spinner.fail('Failed to analyze function');
    throw error;
  }
};

const generateIntegrationTest = async (
  contextEngine: ContextEngine,
  testGenerator: TestGenerator,
  modulePath: string,
  config: any
) => {
  const spinner = ora('Analyzing module...').start();

  logger.info(chalk.yellow('\n⚠️  Integration test generation is coming in Month 3-4.\n'));
  logger.info(chalk.gray('For now, please use unit test generation:\n'));
  logger.info(chalk.cyan('  testmind generate <file> --function <name>\n'));
  
  spinner.stop();
};
