import chalk from 'chalk';
import Table from 'cli-table3';
import type { Command } from 'commander';
import { listSkillConfigs } from '@testmind/core';

export interface SkillCommandOptions {
  status?: string;
  owner?: string;
}

export function registerSkillsCommand(program: Command): void {
  program
    .command('skills')
    .description('List planned skills and their delivery plan (placeholder).')
    .option('--status <status>', 'Filter by status (beta|preview|planned)')
    .option('--owner <owner>', 'Filter by owner (Self-Healing Guild, Platform Guild, etc.)')
    .action((options: SkillCommandOptions) => {
      const entries = listSkillConfigs({
        status: options.status as any,
        owner: options.owner,
      });

      if (entries.length === 0) {
        console.log(chalk.yellow('No skill entries match the provided filters.'));
        console.log('Follow plan.md §2.4.2 for the full placeholder list.');
        return;
      }

      const table = new Table({
        head: ['Skill', 'Status', 'ETA', 'Owner', 'Frameworks'],
        style: { head: ['cyan'] },
      });

      entries.forEach(entry => {
        table.push([
          entry.name,
          colorizeStatus(entry.status),
          entry.eta,
          entry.owner,
          entry.frameworks.join(', '),
        ]);
      });

      console.log(table.toString());
      console.log(
        chalk.dim(
          'ℹ︎ This command uses placeholder data from packages/backend/core/src/config/SkillConfig.ts.',
        ),
      );
    });
}

function colorizeStatus(status: string): string {
  switch (status) {
    case 'beta':
      return chalk.green(status);
    case 'preview':
      return chalk.blue(status);
    default:
      return chalk.yellow(status);
  }
}
