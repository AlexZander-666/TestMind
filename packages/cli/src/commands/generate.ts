/**
 * Generate Command: Generate tests for code
 * This command orchestrates the full test generation workflow
 */

import chalk from 'chalk';
import ora from 'ora';
import { ContextEngine, TestGenerator, LLMService, TestReviewer, GitAutomation } from '@testmind/core';
import { loadConfig } from '../utils/config';
import path from 'path';

export interface GenerateOptions {
  type?: 'unit' | 'integration' | 'e2e';
  function?: string;
  framework?: string;
}

export const generateCommand = async (targetPath: string | undefined, options: GenerateOptions) => {
  console.log(chalk.bold.cyan('\n🧠 TestMind - AI-Powered Test Generation\n'));

  // Check API key first
  if (!process.env.OPENAI_API_KEY) {
    console.log(chalk.red('❌ OPENAI_API_KEY environment variable not set\n'));
    console.log(chalk.gray('Please set your OpenAI API key:'));
    console.log(chalk.cyan('  export OPENAI_API_KEY=sk-your-key-here\n'));
    console.log(chalk.gray('Get your key at: https://platform.openai.com/api-keys\n'));
    process.exit(1);
  }

  const spinner = ora('Loading project configuration...').start();
  const config = await loadConfig();
  
  if (!config) {
    spinner.fail('Not initialized');
    console.log(chalk.red('\n❌ TestMind is not initialized in this project.'));
    console.log(chalk.gray('   Run: testmind init\n'));
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
    console.log(chalk.gray('\n📂 Target: ' + relPath));
    console.log(chalk.gray('🎯 Type: ' + (options.type || 'unit')));
    console.log(chalk.gray('🔧 Framework: ' + config.testFramework + '\n'));

    spinner.start('Indexing project...');
    const indexResult = await contextEngine.indexProject(config.repoPath);
    const indexMsg = 'Indexed ' + indexResult.filesIndexed + ' files, ' + indexResult.functionsExtracted + ' functions';
    spinner.succeed(indexMsg);

    if (options.type === 'unit' || !options.type) {
      await generateUnitTest(contextEngine, testGenerator, absolutePath, options, config);
    } else if (options.type === 'integration') {
      await generateIntegrationTest(contextEngine, testGenerator, absolutePath, config);
    } else if (options.type === 'e2e') {
      console.log(chalk.yellow('\n⚠️  E2E test generation is coming in Month 3-4.\n'));
    }

    await contextEngine.dispose();

    console.log(chalk.green('\n✨ Test generation complete!\n'));
    console.log(chalk.gray('💡 Tip: Review the test and run it with:'));
    const testCmd = config.testFramework === 'jest' ? 'npm test' : 'pnpm test';
    console.log(chalk.cyan('   ' + testCmd + '\n'));

  } catch (error) {
    spinner.fail('Generation failed');
    console.error(chalk.red('\n❌ Error:'), error);
    
    const errorMsg = String(error);
    if (errorMsg.includes('OPENAI_API_KEY')) {
      console.log(chalk.gray('\n💡 Make sure your API key is set correctly\n'));
    } else if (errorMsg.includes('not found')) {
      console.log(chalk.gray('\n💡 Check that the file and function name are correct\n'));
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
      console.log(chalk.red('\n❌ Please specify a function name with --function <name>\n'));
      console.log(chalk.gray('Example:'));
      console.log(chalk.cyan('  testmind generate src/utils/math.ts --function add\n'));
      return;
    }

    const funcName = options.function;
    spinner.text = 'Extracting context for ' + funcName + '()...';
    const functionContext = await contextEngine.getFunctionContext(filePath, funcName);

    spinner.succeed('Function analysis complete');
    
    console.log(chalk.bold('\n📊 Function Analysis:\n'));
    console.log('   Function: ' + chalk.cyan(functionContext.signature.name + '()'));
    console.log('   Parameters: ' + functionContext.signature.parameters.length);
    console.log('   Async: ' + (functionContext.signature.isAsync ? chalk.green('Yes') : chalk.gray('No')));
    console.log('   Complexity: ' + chalk.yellow(String(functionContext.complexity.cyclomaticComplexity)));
    console.log('   Dependencies: ' + functionContext.dependencies.length);
    const sideEffectsMsg = functionContext.sideEffects.length > 0 
      ? chalk.yellow(String(functionContext.sideEffects.length))
      : chalk.green('None');
    console.log('   Side Effects: ' + sideEffectsMsg);

    console.log(chalk.bold('\n🤖 Generating test with AI...\n'));
    spinner.start('Calling OpenAI API (this may take 10-30 seconds)...');
    
    const testSuite = await testGenerator.generateUnitTest(functionContext, config.id);

    spinner.succeed('AI test generation complete!');

    if (testSuite.metadata && 'cost' in testSuite.metadata) {
      const cost = (testSuite.metadata as any).cost;
      console.log(chalk.gray('   💰 Estimated cost: ~$' + cost.toFixed(4)));
    }

    // ===== Diff-First Review Flow =====
    console.log(chalk.green.bold('\n📋 Diff-First Review: Please review the proposed test\n'));

    const reviewer = new TestReviewer();
    const diffResult = await reviewer.generateDiff(testSuite);

    // Display diff
    console.log(reviewer.formatForCLI(diffResult));
    console.log('\n');

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
      console.log(chalk.yellow('\n⚠️  Test rejected. No changes made.\n'));
      return;
    }

    if (action === 'regenerate') {
      console.log(chalk.cyan('\n🔄 Regenerating test...\n'));
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

            console.log(chalk.green('\n✅ Success! Test committed to new branch.\n'));
            console.log(chalk.gray('📍 Branch: ' + chalk.cyan(gitResult.branchName)));
          } else {
            gitSpinner.info('Not a Git repository - skipping commit');
            console.log(chalk.green('\n✅ Success! Test file created.\n'));
          }
        } catch (gitError) {
          gitSpinner.warn('Git commit failed - test still saved');
          console.log(chalk.yellow('\n⚠️  Test saved but Git commit failed: ' + gitError));
        }
      } else {
        console.log(chalk.green('\n✅ Success! Test file created.\n'));
      }

      console.log(chalk.gray('Next steps:'));
      console.log(chalk.gray('  1. Review the test: ' + testSuite.filePath));
      const runCmd = config.testFramework === 'jest' ? 'npm test' : 'pnpm test';
      console.log(chalk.gray('  2. Run tests: ' + runCmd + '\n'));

    } catch (error) {
      saveSpinner.fail('Failed to apply test');
      console.log(chalk.red('\n❌ Error: ' + error + '\n'));
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

  console.log(chalk.yellow('\n⚠️  Integration test generation is coming in Month 3-4.\n'));
  console.log(chalk.gray('For now, please use unit test generation:\n'));
  console.log(chalk.cyan('  testmind generate <file> --function <name>\n'));
  
  spinner.stop();
};
