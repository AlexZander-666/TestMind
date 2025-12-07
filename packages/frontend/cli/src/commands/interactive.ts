/**
 * Interactive command - Start REPL session
 * Implements the interactive CLI from 1.md framework
 */

import { Command } from 'commander';
import { startInteractiveSession } from '../repl';

export function createInteractiveCommand(): Command {
  const cmd = new Command('interactive');

  cmd
    .alias('i')
    .description('Start an interactive TestMind session')
    .action(async () => {
      await startInteractiveSession();
    });

  return cmd;
}



