import ora, { Ora } from 'ora';
import { Logger, LogLevel } from '@testmind/core';
import { getCliLogLevel, isSeverityAllowed } from '../utils/logLevel';

export interface SpinnerOptions {
  logger?: Logger;
  logLevel?: LogLevel;
}

const logMessage = (
  logger: Logger | undefined,
  effectiveLevel: LogLevel,
  severity: LogLevel,
  message: string
) => {
  if (!logger) return;
  if (!isSeverityAllowed(severity, effectiveLevel)) return;
  logger[severity](message);
};

export const createSpinner = (text: string, options: SpinnerOptions = {}): Ora => {
  const spinner = ora({
    text,
    spinner: 'dots',
    color: 'cyan',
  });

  const effectiveLevel = options.logLevel ?? getCliLogLevel();

  const wrap = (method: 'start' | 'succeed' | 'fail' | 'warn', severity: LogLevel) => {
    const original = spinner[method].bind(spinner);
    spinner[method] = ((message?: string) => {
      const payload = message ?? spinner.text;
      logMessage(options.logger, effectiveLevel, severity, payload);
      return original(message);
    }) as Ora[typeof method];
  };

  wrap('start', LogLevel.DEBUG);
  wrap('succeed', LogLevel.INFO);
  wrap('fail', LogLevel.ERROR);
  wrap('warn', LogLevel.WARN);

  return spinner;
};
