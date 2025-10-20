/**
 * Undo command - Reverse the last TestMind commit
 * Implements the "undo" feature from 1.md framework
 */

import { Command } from 'commander';
import { GitAutomation } from '@testmind/core';
import chalk from 'chalk';

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
      console.error(chalk.red('Error: Not a Git repository'));
      console.log(chalk.gray('Initialize Git with: git init'));
      process.exit(1);
    }

    // Show history if requested
    if (options.showHistory) {
      console.log(chalk.blue('📜 Recent commits:\n'));
      const commits = await git.getRecentCommits(5);
      commits.forEach((commit, index) => {
        const marker = index === 0 ? chalk.yellow('→') : ' ';
        console.log(`${marker} ${chalk.gray(commit.hash)} ${commit.message}`);
        console.log(`  ${chalk.gray(commit.date)} by ${commit.author}`);
      });
      console.log();
    }

    // Check if last commit is from TestMind
    const isTestMindCommit = await git.isLastCommitFromTestMind();
    if (!isTestMindCommit) {
      console.log(chalk.yellow('⚠️  Warning: The last commit was not made by TestMind'));
      console.log(chalk.gray('You are about to undo a manual commit.'));
      
      // In a real implementation, we'd prompt for confirmation here
      // For now, we'll proceed but warn the user
      console.log(chalk.gray('Proceeding anyway...\n'));
    }

    // Perform undo
    if (options.hard) {
      // Show strong warning for destructive operation
      console.log(chalk.red.bold('⚠️  WARNING: This will permanently discard all changes!'));
      console.log(chalk.gray('This operation cannot be reversed.\n'));
      
      // In production, we should prompt for confirmation
      // For now, we'll proceed with the operation
      
      const result = await git.undoAndDiscard();
      
      if (result.success) {
        console.log(chalk.green('✓ Commit undone and changes discarded'));
        console.log(chalk.gray(`  ${result.message}`));
      } else {
        console.log(chalk.yellow(result.message));
      }
    } else {
      // Soft undo - keep changes
      const result = await git.undoLastCommit();
      
      if (result.success) {
        console.log(chalk.green('✓ Commit undone (changes preserved in working directory)'));
        console.log(chalk.gray(`  ${result.message}`));
        console.log();
        console.log(chalk.blue('Next steps:'));
        console.log(chalk.gray('  - Review changes: git status'));
        console.log(chalk.gray('  - Make modifications and commit again'));
        console.log(chalk.gray('  - Or discard changes: git reset --hard'));
      } else {
        console.log(chalk.yellow(result.message));
      }
    }

  } catch (error: any) {
    console.error(chalk.red('Error undoing commit:'), error.message);
    process.exit(1);
  }
}

export async function undoLastCommit(options: UndoOptions = {}) {
  return undoCommand(options);
}



