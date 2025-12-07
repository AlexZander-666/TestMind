#!/usr/bin/env node
/**
 * TestMind CLI Entry Point
 */

import { Command } from 'commander';
import { APP_NAME, APP_VERSION } from '@testmind/shared';
import { LogLevel } from '@testmind/core';
import { initCommand } from './commands/init';
import { generateCommand } from './commands/generate';
import { runCommand } from './commands/run';
import { analyzeCommand } from './commands/analyze';
import { configCommand } from './commands/config';
import { createContextCommand } from './commands/context';
import { createUndoCommand } from './commands/undo';
import { createInteractiveCommand } from './commands/interactive';
import { registerHealCommand } from './commands/heal';
import { registerSkillsCommand } from './commands/skills';
import { normalizeLogLevel, setCliLogLevel } from './utils/logLevel';
import { ciCommand } from './commands/ci';

const program = new Command();

setCliLogLevel(LogLevel.INFO);

program
  .name('testmind')
  .description('AI-powered test automation for modern development teams')
  .version(APP_VERSION);

program.option(
  '--log-level <level>',
  'Set CLI log level (debug|info|warn|error)',
  normalizeLogLevel,
  LogLevel.INFO,
);

// ============================================================================
// Commands
// ============================================================================

// Initialize project
program
  .command('init')
  .description('Initialize TestMind in your project')
  .option('-f, --force', 'Overwrite existing configuration')
  .action(initCommand);

// Interactive session
program.addCommand(createInteractiveCommand());

// Generate tests
program
  .command('generate')
  .description('Generate tests for your code')
  .argument('[path]', 'File or directory path')
  .option('-t, --type <type>', 'Test type (unit only; integration/e2e paused)', 'unit')
  .option('-f, --function <name>', 'Specific function to test')
  .option('--framework <framework>', 'Test framework to use')
  .action(generateCommand);

// Run tests
program
  .command('run')
  .description('Run tests and collect coverage')
  .argument('[suite-id]', 'Specific test suite ID')
  .option('--stability-check', 'Run multiple times to check for flakiness')
  .option('--debug-context', 'Print top-ranked context diagnostics')
  .option('--json', 'Emit structured JSON results for CI/automation')
  .action(runCommand);

// Analyze test quality
program
  .command('analyze')
  .description('Analyze test quality and provide suggestions (preview)')
  .argument('[suite-id]', 'Specific test suite ID')
  .option('--all', 'Analyze all test suites')
  .option('--debug-context', 'Print top-ranked context diagnostics')
  .action(analyzeCommand);

// Configuration management
program
  .command('config')
  .description('Manage TestMind configuration')
  .argument('[action]', 'Action: show|set|reset')
  .argument('[key]', 'Configuration key')
  .argument('[value]', 'Configuration value')
  .action(configCommand);

// Context management
program.addCommand(createContextCommand());

// Undo management
program.addCommand(createUndoCommand());

// Self-healing
registerHealCommand(program);

// Skills roadmap (placeholder)
registerSkillsCommand(program);

// CI/CD automation
program
  .command('ci')
  .description('Generate or verify CI/CD workflows for this repository')
  .option('--platform <platforms>', 'Comma-separated platforms: github,gitlab,jenkins,circleci')
  .option('--json', 'Emit structured results suitable for automation')
  .action(ciCommand);

// Parse arguments
program.hook('preAction', (command) => {
  const opts = command.optsWithGlobals();
  setCliLogLevel(opts.logLevel);
});

program.parse(process.argv);















