import { logger as coreLogger, LogLevel } from '@testmind/core';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  [LogLevel.DEBUG]: 0,
  [LogLevel.INFO]: 1,
  [LogLevel.WARN]: 2,
  [LogLevel.ERROR]: 3,
};

let currentLogLevel: LogLevel = LogLevel.INFO;

const isValidLogLevel = (value: string): value is LogLevel => {
  return Object.values(LogLevel).includes(value as LogLevel);
};

export const normalizeLogLevel = (value?: string | LogLevel): LogLevel => {
  if (!value) {
    return LogLevel.INFO;
  }

  const normalized = typeof value === 'string' ? value.toLowerCase() : value;
  if (isValidLogLevel(normalized)) {
    return normalized;
  }

  return LogLevel.INFO;
};

export const setCliLogLevel = (value?: string | LogLevel): LogLevel => {
  const nextLevel = normalizeLogLevel(value);
  currentLogLevel = nextLevel;
  coreLogger.level = nextLevel;
  process.env.LOG_LEVEL = nextLevel;
  return nextLevel;
};

export const getCliLogLevel = (): LogLevel => currentLogLevel;

export const isSeverityAllowed = (severity: LogLevel, threshold?: LogLevel): boolean => {
  const targetLevel = threshold ?? currentLogLevel;
  return LEVEL_PRIORITY[severity] >= LEVEL_PRIORITY[targetLevel];
};
