/**
 * Undo command - Reverse the last TestMind commit
 * Implements the "undo" feature from 1.md framework
 */

import { GitAutomation as CoreGitAutomation, createComponentLogger } from '@testmind/core';
import { Command } from 'commander';

import type { Printer } from '../ui/printer';
import { createStdoutPrinter } from '../ui/stdoutPrinter';
import { getCliLogLevel } from '../utils/logLevel';
import { recordCliEvent } from '../utils/telemetry';

type UndoResult = { success: boolean; message: string };
type CommitSummary = { hash: string; message: string; date: string; author: string };

type GitAutomationInstance = {
  isGitRepo(): Promise<boolean>;
  getRecentCommits(count?: number): Promise<CommitSummary[]>;
  isLastCommitFromTestMind(): Promise<boolean>;
  undoAndDiscard(): Promise<UndoResult>;
  undoLastCommit(): Promise<UndoResult>;
};

type GitAutomationConstructor = new (repoPath: string) => GitAutomationInstance;

const GitAutomation = CoreGitAutomation as unknown as GitAutomationConstructor;

export function createUndoCommand(): Command {
  const cmd = new Command('undo');

  cmd
    .description('Undo the last TestMind commit (preview)')
    .option('--hard', 'Discard changes completely (WARNING: destructive)')
    .option('--show-history', 'Show recent commits before undoing')
    .option('--experimental', 'Enable the experimental undo workflow')
    .option('--confirm', 'Apply the undo after previewing the plan')
    .action(async (cmdOptions: UndoOptions) => {
      await undoCommand({
        hard: cmdOptions.hard === true,
        showHistory: cmdOptions.showHistory === true,
        experimental: cmdOptions.experimental === true,
        confirm: cmdOptions.confirm === true,
      });
    });

  return cmd;
}

interface UndoOptions {
  hard?: boolean;
  showHistory?: boolean;
  experimental?: boolean;
  confirm?: boolean;
  skipExit?: boolean;
}

async function undoCommand(options: UndoOptions = {}) {
  const logLevel = getCliLogLevel();
  const logger = createComponentLogger('undo');
  const printer = createStdoutPrinter({ logger, logLevel });
  printer.header('undo', 'Revert the last commit (preview)');
  logger.info('Undo command invoked', { hard: options.hard === true });

  const exitWithCode = (code: number) => {
    if (options.skipExit) {
      process.exitCode = code;
      return;
    }
    process.exit(code);
  };

  try {
    const git = new GitAutomation(process.cwd());

    if (!(await git.isGitRepo())) {
      printer.error('Not a Git repository.', 'Run git init before using undo.');
      exitWithCode(1);
      return;
    }

    if (options.showHistory === true) {
      await showRecentCommits(printer, git);
    }

    if (options.experimental !== true) {
      printer.warn('Undo is experimental and gated.');
      printer.info('Re-run with --experimental --confirm after reviewing the planned revert.');
      exitWithCode(1);
      return;
    }

    const [lastCommit] = await git.getRecentCommits(1);
    printer.section('Undo plan', buildPlanLines(lastCommit, options));

    if (options.confirm !== true) {
      printer.status('Preview', 'Add --confirm to execute the revert described above.');
      exitWithCode(0);
      return;
    }

    const isTestMindCommit = await git.isLastCommitFromTestMind();
    if (!isTestMindCommit) {
      printer.warn('Last commit was not created by TestMind. Proceeding anyway.');
    }

    if (options.hard === true) {
      await discardCommit(printer, git);
      recordCliEvent('undo.completed', {
        command: 'undo',
        mode: 'hard',
        success: true,
        experimental: options.experimental ? 'true' : 'false',
      });
    } else {
      await undoSoft(printer, git);
      recordCliEvent('undo.completed', {
        command: 'undo',
        mode: 'soft',
        success: true,
        experimental: options.experimental ? 'true' : 'false',
      });
    }

    exitWithCode(0);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Undo command failed', { error: message });
    recordCliEvent('undo.completed', {
      command: 'undo',
      mode: options.hard ? 'hard' : 'soft',
      success: false,
      error: message,
    });
    printer.error('Failed to undo commit.', message);
    exitWithCode(1);
  }
}

const showRecentCommits = async (printer: Printer, git: GitAutomationInstance) => {
  const commits = await git.getRecentCommits(5);
  if (commits.length === 0) {
    printer.warn('No commit history available.');
    return;
  }

  printer.section(
    'Recent commits',
    commits.map((commit, index) => {
      const pointer = index === 0 ? '>' : ' ';
      return `${pointer} ${commit.hash} ${commit.message} (${commit.date} by ${commit.author})`;
    }),
  );
  return commits;
};

const discardCommit = async (printer: Printer, git: GitAutomationInstance) => {
  printer.warn('Hard undo will discard local changes permanently.');
  const result = await git.undoAndDiscard();

  if (result.success) {
    printer.success('Commit undone and changes discarded.');
    printer.info(result.message);
  } else {
    printer.warn(result.message);
  }
};

const undoSoft = async (printer: Printer, git: GitAutomationInstance) => {
  const result = await git.undoLastCommit();

  if (result.success) {
    printer.success('Commit undone. Changes remain in your working tree.');
    printer.info(result.message);
    printer.nextSteps([
      { label: 'Review changes', command: 'git status' },
      { label: 'Commit again', command: 'git commit -am "<message>"' },
      { label: 'Discard work', command: 'git reset --hard' },
    ]);
  } else {
    printer.warn(result.message);
  }
};

export async function undoLastCommit(options: UndoOptions = {}) {
  return undoCommand(options);
}

const buildPlanLines = (commit: CommitSummary | undefined, options: UndoOptions): string[] => {
  const lines: string[] = [];
  if (commit) {
    lines.push(`target commit: ${commit.hash} — ${commit.message}`);
    lines.push(`author: ${commit.author} (${commit.date})`);
  } else {
    lines.push('target commit: unknown');
  }
  lines.push(`mode: ${options.hard ? 'hard' : 'soft'} undo`);
  lines.push(
    options.confirm ? 'confirmation: executing the revert' : 'confirmation: preview only (add --confirm)',
  );
  return lines;
};
