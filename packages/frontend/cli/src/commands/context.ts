/**
 * Context management commands
 * Implements explicit context control as per 1.md framework
 */

import { ContextManager } from '@testmind/core';
import { Command } from 'commander';

import type { Printer } from '../ui/printer';
import { createStdoutPrinter } from '../ui/stdoutPrinter';
import { loadConfig } from '../utils/config';

type ContextSnapshot = {
  explicitFiles?: Array<{
    displayPath: string;
    isFocused?: boolean;
  }>;
  focusPoints?: Array<unknown>;
  totalTokens?: number;
};

type ContextManagerInstance = {
  getCurrentContext(): ContextSnapshot;
  addToContext(file: string): Promise<void>;
  focusOn(file: string, functionName: string): Promise<void>;
  removeFromContext(file: string): Promise<void>;
  clearContext(): void;
  dispose(): Promise<void>;
};

type ContextManagerConstructor = new (
  config: unknown,
  projectRoot: string,
) => ContextManagerInstance;

const ContextManagerImpl = ContextManager as unknown as ContextManagerConstructor;

const hasValue = (value?: string): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const formatNumber = (value?: number): string =>
  typeof value === 'number' ? value.toLocaleString() : '0';

const formatError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

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

const ensureConfig = async (printer: Printer) => {
  const config = await loadConfig();
  if (!config) {
    printer.error('TestMind is not initialized in this project.', 'Run "testmind init" first.');
    process.exit(1);
  }
  return config;
};

const withContextManager = async <T>(
  printer: Printer,
  fn: (manager: ContextManagerInstance) => Promise<T> | T,
): Promise<T> => {
  const config = await ensureConfig(printer);
  const manager = new ContextManagerImpl(config, process.cwd());

  try {
    return await Promise.resolve(fn(manager));
  } finally {
    await manager.dispose();
  }
};

const renderSnapshot = (printer: Printer, snapshot: ContextSnapshot) => {
  const explicitCount = snapshot.explicitFiles?.length ?? 0;
  const focusCount = snapshot.focusPoints?.length ?? 0;
  const tokens = formatNumber(snapshot.totalTokens ?? 0);

  printer.section('Summary', [
    `files: ${explicitCount}`,
    `focus points: ${focusCount}`,
    `tokens: ${tokens}`,
  ]);

  if (explicitCount > 0 && Array.isArray(snapshot.explicitFiles)) {
    const entries = snapshot.explicitFiles.slice(0, 5).map((file) => {
      const flag = file.isFocused === true ? ' (focused)' : '';
      return `${file.displayPath}${flag}`;
    });
    printer.section('Top files', entries);
  }
};

async function viewContext() {
  const printer = createStdoutPrinter();
  printer.header('context', 'Current selection');

  try {
    await withContextManager(printer, (contextManager) => {
      const snapshot = contextManager.getCurrentContext();
      renderSnapshot(printer, snapshot);
    });
  } catch (error) {
    printer.error('Unable to view context.', formatError(error));
    process.exit(1);
  }
}

async function addToContext(file: string) {
  const printer = createStdoutPrinter();
  printer.header('context add', 'Add file to context');

  try {
    await withContextManager(printer, async (contextManager) => {
      await contextManager.addToContext(file);
      printer.success(`Added to context: ${file}`);
      renderSnapshot(printer, contextManager.getCurrentContext());
    });
  } catch (error) {
    printer.error('Unable to add file to context.', formatError(error));
    process.exit(1);
  }
}

async function focusOn(target: string) {
  const printer = createStdoutPrinter();
  printer.header('context focus', 'Focus on function');

  const [file, functionName] = target.split('::');
  if (!hasValue(file) || !hasValue(functionName)) {
    printer.error('Invalid target format.', 'Use <file>::<function>.');
    process.exit(1);
  }

  try {
    await withContextManager(printer, async (contextManager) => {
      await contextManager.focusOn(file, functionName);
      printer.success(`Focused on ${file}::${functionName}`);
      renderSnapshot(printer, contextManager.getCurrentContext());
    });
  } catch (error) {
    printer.error('Unable to focus on target.', formatError(error));
    process.exit(1);
  }
}

async function removeFromContext(file: string) {
  const printer = createStdoutPrinter();
  printer.header('context remove', 'Remove file');

  try {
    await withContextManager(printer, async (contextManager) => {
      await contextManager.removeFromContext(file);
      printer.success(`Removed from context: ${file}`);
      renderSnapshot(printer, contextManager.getCurrentContext());
    });
  } catch (error) {
    printer.error('Unable to remove file from context.', formatError(error));
    process.exit(1);
  }
}

async function clearContext() {
  const printer = createStdoutPrinter();
  printer.header('context clear', 'Reset explicit context');

  try {
    await withContextManager(printer, (contextManager) => {
      contextManager.clearContext();
      printer.success('Context cleared.');
    });
  } catch (error) {
    printer.error('Unable to clear context.', formatError(error));
    process.exit(1);
  }
}
