import { colors, symbols } from './theme';

export interface PrinterLogger {
  info(message: string): void;
  warn?(message: string): void;
  error?(message: string): void;
}

export interface NextStep {
  label: string;
  command?: string;
}

const hasContent = (value?: string): value is string => typeof value === 'string' && value.length > 0;

export function createPrinter(logger: PrinterLogger) {
  const write = (message: string) => logger.info(message);

  const divider = (width = 40) => colors.muted('─'.repeat(width));

  const header = (title: string, subtitle?: string) => {
    write('');
    const base = colors.primary(`[${title}]`);
    if (hasContent(subtitle)) {
      write(`${base} ${colors.muted(subtitle)}`);
    } else {
      write(base);
    }
    write(divider());
  };

  const blank = () => write('');

  const info = (message: string) => write(message);

  const success = (message: string) => write(`${colors.success(symbols.success)} ${message}`);

  const warn = (message: string) => write(`${colors.warning(symbols.warning)} ${message}`);

  const error = (message: string, hint?: string) => {
    write(`${colors.danger(symbols.danger)} ${message}`);
    if (hasContent(hint)) {
      write(`${colors.muted('Hint:')} ${hint}`);
    }
  };

  const list = (items: string[]) => {
    items.forEach((item) => write(`${colors.muted('-')} ${item}`));
  };

  const keyValue = (label: string, value: string) => {
    const padded = label.padEnd(12);
    write(`${colors.muted(padded)} ${value}`);
  };

  const section = (title: string, lines: string[]) => {
    write('');
    write(colors.accent(title));
    lines.forEach((line) => write(line));
  };

  const status = (title: string, message?: string) => {
    write('');
    const base = colors.accent(`[${title}]`);
    if (hasContent(message)) {
      write(`${base} ${colors.muted(message)}`);
      return;
    }
    write(base);
  };

  const nextSteps = (steps: NextStep[]) => {
    if (steps.length === 0) {
      return;
    }
    write('');
    write(colors.muted('Next steps:'));
    steps.forEach((step, index) => {
      const prefix = `${index + 1}. ${step.label}`;
      if (hasContent(step.command)) {
        write(`${prefix} — ${colors.primary(step.command)}`);
        return;
      }
      write(prefix);
    });
  };

  return {
    header,
    info,
    success,
    warn,
    error,
    list,
    keyValue,
    section,
    status,
    nextSteps,
    blank,
  };
}

export type Printer = ReturnType<typeof createPrinter>;
