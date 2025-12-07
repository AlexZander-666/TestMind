import chalk from 'chalk';

// Centralized color palette for the minimal CLI look
export const colors = {
  primary: chalk.cyan,
  accent: chalk.blue,
  success: chalk.green,
  warning: chalk.yellow,
  danger: chalk.red,
  muted: chalk.gray,
  text: (value: string) => value,
};

export const symbols = {
  success: '✓',
  warning: '!',
  danger: 'x',
};

export type PrinterColor = keyof typeof colors;
