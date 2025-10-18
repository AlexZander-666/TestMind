/**
 * Init Command: Initialize TestMind in project
 */

import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { DEFAULT_CONFIG, type ProjectSettings } from '@testmind/shared';
import { ensureDir, safeWriteFile } from '../utils/file';
import path from 'path';

export const initCommand = async (options: { force?: boolean }) => {
  console.log(chalk.bold.cyan('\n🧠 TestMind Initialization\n'));

  // Check if already initialized
  const configPath = path.join(process.cwd(), '.testmind', 'config.json');
  const configExists = await checkFileExists(configPath);

  if (configExists && !options.force) {
    console.log(chalk.yellow('⚠️  TestMind is already initialized in this project.'));
    console.log(chalk.gray('   Use --force to reinitialize.\n'));
    return;
  }

  // Gather configuration through interactive prompts
  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'language',
      message: 'Primary programming language:',
      choices: ['typescript', 'javascript', 'python', 'java'],
      default: 'typescript',
    },
    {
      type: 'list',
      name: 'testFramework',
      message: 'Test framework:',
      choices: (answers: { language: string }) => {
        if (answers.language === 'python') return ['pytest'];
        if (answers.language === 'java') return ['junit'];
        return ['jest', 'vitest', 'mocha'];
      },
    },
    {
      type: 'input',
      name: 'testDirectory',
      message: 'Test directory:',
      default: '__tests__',
    },
    {
      type: 'number',
      name: 'coverageThreshold',
      message: 'Coverage threshold (%):',
      default: 80,
      validate: (value: number) =>
        value >= 0 && value <= 100 ? true : 'Must be between 0 and 100',
    },
    {
      type: 'list',
      name: 'llmProvider',
      message: 'LLM provider:',
      choices: ['openai', 'anthropic', 'ollama'],
      default: 'openai',
    },
    {
      type: 'input',
      name: 'llmModel',
      message: 'LLM model:',
      default: (answers: { llmProvider: string }) => {
        if (answers.llmProvider === 'anthropic') return 'claude-3-sonnet-20240229';
        if (answers.llmProvider === 'ollama') return 'codellama';
        return 'gpt-4-turbo-preview';
      },
    },
  ]);

  // Create configuration
  const config: ProjectSettings = {
    ...DEFAULT_CONFIG,
    ...answers,
  };

  const projectConfig = {
    id: generateUUID(),
    name: path.basename(process.cwd()),
    repoPath: process.cwd(),
    language: answers.language as any,
    testFramework: answers.testFramework as any,
    config,
  };

  // Save configuration
  const spinner = ora('Creating configuration...').start();

  try {
    // Create .testmind directory
    await ensureDir(path.join(process.cwd(), '.testmind'));

    // Save config
    await safeWriteFile(configPath, JSON.stringify(projectConfig, null, 2));

    // Create .gitignore entry
    await appendToGitignore();

    spinner.succeed('Configuration created successfully!');

    console.log(chalk.green('\n✅ TestMind initialized successfully!\n'));
    console.log(chalk.gray('Next steps:'));
    console.log(chalk.gray('  1. Set your API key: export OPENAI_API_KEY=your-key'));
    console.log(chalk.gray('  2. Generate tests: testmind generate <path>'));
    console.log(chalk.gray('  3. Run tests: testmind run\n'));
  } catch (error) {
    spinner.fail('Failed to initialize');
    console.error(chalk.red('\n❌ Error:'), error);
    process.exit(1);
  }
};

const checkFileExists = async (filePath: string): Promise<boolean> => {
  try {
    const fs = await import('fs/promises');
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
};

const appendToGitignore = async (): Promise<void> => {
  const gitignorePath = path.join(process.cwd(), '.gitignore');
  const entry = '\n# TestMind\n.testmind/\n*.testmind.db*\n';

  try {
    const fs = await import('fs/promises');
    const exists = await checkFileExists(gitignorePath);

    if (exists) {
      const content = await fs.readFile(gitignorePath, 'utf-8');
      if (!content.includes('.testmind/')) {
        await fs.appendFile(gitignorePath, entry);
      }
    } else {
      await fs.writeFile(gitignorePath, entry);
    }
  } catch (error) {
    console.warn(chalk.yellow('Warning: Could not update .gitignore'));
  }
};

const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};





