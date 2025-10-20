/**
 * Context management commands
 * Implements explicit context control as per 1.md framework
 */

import { Command } from 'commander';
import { ContextManager } from '@testmind/core';
import { loadConfig } from '../utils/config';
import * as path from 'path';
import chalk from 'chalk';

export function createContextCommand(): Command {
  const cmd = new Command('context');

  cmd
    .description('View and manage the current context')
    .action(async () => {
      await viewContext();
    });

  cmd
    .command('add <file>')
    .description('Add a file to the explicit context')
    .action(async (file: string) => {
      await addToContext(file);
    });

  cmd
    .command('focus <target>')
    .description('Focus on a specific function (format: <file>::<function>)')
    .action(async (target: string) => {
      await focusOn(target);
    });

  cmd
    .command('remove <file>')
    .description('Remove a file from context')
    .action(async (file: string) => {
      await removeFromContext(file);
    });

  cmd
    .command('clear')
    .description('Clear all explicit context')
    .action(async () => {
      await clearContext();
    });

  return cmd;
}

async function viewContext() {
  try {
    const config = await loadConfig();
    const projectPath = process.cwd();
    const contextManager = new ContextManager(config, projectPath);

    const snapshot = contextManager.getCurrentContext();
    console.log(snapshot.message);

    await contextManager.dispose();
  } catch (error) {
    console.error(chalk.red('Error viewing context:'), error);
    process.exit(1);
  }
}

async function addToContext(file: string) {
  try {
    const config = await loadConfig();
    const projectPath = process.cwd();
    const contextManager = new ContextManager(config, projectPath);

    await contextManager.addToContext(file);

    console.log(chalk.green(`✓ Added to context: ${file}`));

    // Show updated context
    const snapshot = contextManager.getCurrentContext();
    console.log(`\nCurrent context: ${snapshot.explicitFiles.length} files, ${snapshot.totalTokens.toLocaleString()} tokens`);

    await contextManager.dispose();
  } catch (error: any) {
    console.error(chalk.red('Error adding to context:'), error.message);
    process.exit(1);
  }
}

async function focusOn(target: string) {
  try {
    const parts = target.split('::');
    if (parts.length !== 2) {
      console.error(chalk.red('Error: Invalid format. Use: <file>::<function>'));
      console.error(chalk.gray('Example: testmind context focus src/utils.ts::formatString'));
      process.exit(1);
    }

    const [file, functionName] = parts;

    const config = await loadConfig();
    const projectPath = process.cwd();
    const contextManager = new ContextManager(config, projectPath);

    await contextManager.focusOn(file, functionName);

    console.log(chalk.green(`✓ Focused on: ${file}::${functionName}`));

    // Show updated context
    const snapshot = contextManager.getCurrentContext();
    console.log(`\nFocus points: ${snapshot.focusPoints.length}`);

    await contextManager.dispose();
  } catch (error: any) {
    console.error(chalk.red('Error focusing:'), error.message);
    process.exit(1);
  }
}

async function removeFromContext(file: string) {
  try {
    const config = await loadConfig();
    const projectPath = process.cwd();
    const contextManager = new ContextManager(config, projectPath);

    await contextManager.removeFromContext(file);

    console.log(chalk.green(`✓ Removed from context: ${file}`));

    await contextManager.dispose();
  } catch (error: any) {
    console.error(chalk.red('Error removing from context:'), error.message);
    process.exit(1);
  }
}

async function clearContext() {
  try {
    const config = await loadConfig();
    const projectPath = process.cwd();
    const contextManager = new ContextManager(config, projectPath);

    contextManager.clearContext();

    console.log(chalk.green('✓ Context cleared'));

    await contextManager.dispose();
  } catch (error: any) {
    console.error(chalk.red('Error clearing context:'), error.message);
    process.exit(1);
  }
}



