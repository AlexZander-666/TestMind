#!/usr/bin/env node
/**
 * TestMind CLI Entry Point
 */

import { Command } from 'commander';
import { APP_NAME, APP_VERSION } from '@testmind/shared';
import { initCommand } from './commands/init';
import { generateCommand } from './commands/generate';
import { runCommand } from './commands/run';
import { analyzeCommand } from './commands/analyze';
import { configCommand } from './commands/config';

const program = new Command();

program
  .name('testmind')
  .description('AI-powered test automation for modern development teams')
  .version(APP_VERSION);

// ============================================================================
// Commands
// ============================================================================

// Initialize project
program
  .command('init')
  .description('Initialize TestMind in your project')
  .option('-f, --force', 'Overwrite existing configuration')
  .action(initCommand);

// Generate tests
program
  .command('generate')
  .description('Generate tests for your code')
  .argument('[path]', 'File or directory path')
  .option('-t, --type <type>', 'Test type (unit|integration|e2e)', 'unit')
  .option('-f, --function <name>', 'Specific function to test')
  .option('--framework <framework>', 'Test framework to use')
  .action(generateCommand);

// Run tests
program
  .command('run')
  .description('Run tests and collect coverage')
  .argument('[suite-id]', 'Specific test suite ID')
  .option('--stability-check', 'Run multiple times to check for flakiness')
  .action(runCommand);

// Analyze test quality
program
  .command('analyze')
  .description('Analyze test quality and provide suggestions')
  .argument('[suite-id]', 'Specific test suite ID')
  .option('--all', 'Analyze all test suites')
  .action(analyzeCommand);

// Configuration management
program
  .command('config')
  .description('Manage TestMind configuration')
  .argument('[action]', 'Action: show|set|reset')
  .argument('[key]', 'Configuration key')
  .argument('[value]', 'Configuration value')
  .action(configCommand);

// Parse arguments
program.parse(process.argv);



























