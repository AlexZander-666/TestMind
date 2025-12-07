import { Logger, LogLevel } from '@testmind/core';
import { createPrinter, type Printer } from './printer';
import { getCliLogLevel, isSeverityAllowed } from '../utils/logLevel';

export interface StdoutPrinterOptions {
  logger?: Logger;
  logLevel?: LogLevel;
}

const writeOut = (message: string, isError = false) => {
  const stream = isError ? process.stderr : process.stdout;
  stream.write(`${message}\n`);
};

export const createStdoutPrinter = ({
  logger,
  logLevel,
}: StdoutPrinterOptions = {}): Printer => {
  const effectiveLevel = logLevel ?? getCliLogLevel();

  const logToComponent = (level: LogLevel, message: string) => {
    if (!logger) return;
    if (!isSeverityAllowed(level, effectiveLevel)) return;
    logger[level](message);
  };

  const stdoutLogger = {
    info: (message: string) => {
      writeOut(message);
      logToComponent(LogLevel.INFO, message);
    },
    warn: (message: string) => {
      writeOut(message);
      logToComponent(LogLevel.WARN, message);
    },
    error: (message: string) => {
      writeOut(message, true);
      logToComponent(LogLevel.ERROR, message);
    },
  };

  return createPrinter(stdoutLogger);
};
