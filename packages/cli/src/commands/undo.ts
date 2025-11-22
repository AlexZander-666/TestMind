/**
 * Undo command - Reverse the last TestMind commit
 * Implements the "undo" feature from 1.md framework
 */

import { Command } from 'commander';
import { GitAutomation } from '@testmind/core';
import chalk from 'chalk';
import { createComponentLogger } from '../../../core/src/utils/logger';

const logger = createComponentLogger('undo');

export function createUndoCommand(): Command {
  const cmd = new Command('undo');

  cmd
    .description('Undo the last TestMind commit')
    .option('--hard', 'Discard changes completely (WARNING: destructive)')
    .option('--show-history', 'Show recent commits before undoing')
    .action(async (options) => {
      await undoCommand(options);
    });

  return cmd;
}

interface UndoOptions {
  hard?: boolean;
  showHistory?: boolean;
}

async function undoCommand(options: UndoOptions) {
  try {
    const projectPath = process.cwd();
    const git = new GitAutomation(projectPath);

    // Check if it's a Git repository
    const isGit = await git.isGitRepo();
    if (!isGit) {
      logger.error(chalk.red('Error: Not a Git repository'));
      logger.info(chalk.gray('Initialize Git with: git init'));
      process.exit(1);
    }

    // Show history if requested
    if (options.showHistory) {
      logger.info(chalk.blue('📜 Recent commits:\n'));
      const commits = await git.getRecentCommits(5);
      commits.forEach((commit, index) => {
        const marker = index === 0 ? chalk.yellow('→') : ' ';
        logger.info(`${marker} ${chalk.gray(commit.hash)} ${commit.message}`);
        logger.info(`  ${chalk.gray(commit.date)} by ${commit.author}`);
      });
      logger.info();
    }

    // Check if last commit is from TestMind
    const isTestMindCommit = await git.isLastCommitFromTestMind();
    if (!isTestMindCommit) {
      logger.info(chalk.yellow('⚠️  Warning: The last commit was not made by TestMind'));
      logger.info(chalk.gray('You are about to undo a manual commit.'));
      
      // In a real implementation, we'd prompt for confirmation here
      // For now, we'll proceed but warn the user
      logger.info(chalk.gray('Proceeding anyway...\n'));
    }

    // Perform undo
    if (options.hard) {
      // Show strong warning for destructive operation
      logger.info(chalk.red.bold('⚠️  WARNING: This will permanently discard all changes!'));
      logger.info(chalk.gray('This operation cannot be reversed.\n'));
      
      // In production, we should prompt for confirmation
      // For now, we'll proceed with the operation
      
      const result = await git.undoAndDiscard();
      
      if (result.success) {
        logger.info(chalk.green('✓ Commit undone and changes discarded'));
        logger.info(chalk.gray(`  ${result.message}`));
      } else {
        logger.info(chalk.yellow(result.message));
      }
    } else {
      // Soft undo - keep changes
      const result = await git.undoLastCommit();
      
      if (result.success) {
        logger.info(chalk.green('✓ Commit undone (changes preserved in working directory)'));
        logger.info(chalk.gray(`  ${result.message}`));
        logger.info();
        logger.info(chalk.blue('Next steps:'));
        logger.info(chalk.gray('  - Review changes: git status'));
        logger.info(chalk.gray('  - Make modifications and commit again'));
        logger.info(chalk.gray('  - Or discard changes: git reset --hard'));
      } else {
        logger.info(chalk.yellow(result.message));
      }
    }

  } catch (error: any) {
    logger.error(chalk.red('Error undoing commit:'), error.message);
    process.exit(1);
  }
}

export async function undoLastCommit(options: UndoOptions = {}) {
  return undoCommand(options);
}



