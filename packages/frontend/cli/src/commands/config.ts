/**
 * Config Command: Manage configuration
 */

import type { ProjectConfig } from '@testmind/shared';

import type { Printer } from '../ui/printer';
import { createStdoutPrinter } from '../ui/stdoutPrinter';
import { loadConfig } from '../utils/config';

const hasValue = (input?: string): input is string => typeof input === 'string' && input.trim().length > 0;

export const configCommand = async (
  action: string = 'show',
  key?: string,
  value?: string,
) => {
  const printer = createStdoutPrinter();

  printer.header('config', 'Project settings');

  const config = await loadConfig();

  if (!config) {
    printer.error('TestMind is not initialized in this project.', 'Run "testmind init" first.');
    process.exit(1);
  }

  switch (action) {
    case 'show':
      displayConfig(config, printer);
      break;

    case 'set':
      if (!hasValue(key) || !hasValue(value)) {
        printer.error('Key and value are required for config set.', 'Usage: testmind config set <key> <value>');
        process.exit(1);
      }
      printer.warn('Config updates are not implemented yet.');
      break;

    case 'reset':
      printer.warn('Config reset is not implemented yet.');
      break;

    default:
      printer.error(`Unknown action: ${action}`, 'Actions: show | set | reset');
      process.exit(1);
  }
};

const displayConfig = (config: ProjectConfig, printer: Printer) => {
  printer.section('Project', [
    `id: ${config.id}`,
    `name: ${config.name}`,
    `language: ${config.language}`,
    `test framework: ${config.testFramework}`,
  ]);

  printer.section('Paths', [
    `tests: ${config.config.testDirectory}`,
    `repo: ${config.repoPath}`,
  ]);

  printer.section('Quality', [
    `coverage threshold: ${config.config.coverageThreshold}%`,
  ]);

  printer.section('LLM', [
    `provider: ${config.config.llmProvider}`,
    `model: ${config.config.llmModel}`,
  ]);

  printer.nextSteps([{ label: 'Edit config file directly', command: '.testmind/config.json' }]);
};


















