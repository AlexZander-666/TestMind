import path from 'path';
import { safeReadFile } from './file';
import type { TestFailure } from '@testmind/core';

const DEFAULT_SNIPPET_CONTEXT_LINES = 3;

/**
 * Resolve the absolute test file path by preferring an explicit override, falling back to the
 * failure metadata, and finally the CLI working directory if necessary.
 */
export const resolveReportedTestFilePath = (
  reportPath: string | undefined,
  failureTestFile?: string,
  overrideTestFile?: string
): string | null => {
  if (overrideTestFile) {
    return path.isAbsolute(overrideTestFile)
      ? overrideTestFile
      : path.resolve(process.cwd(), overrideTestFile);
  }

  if (!failureTestFile) {
    return null;
  }

  if (path.isAbsolute(failureTestFile)) {
    return failureTestFile;
  }

  if (reportPath) {
    return path.resolve(path.dirname(path.resolve(reportPath)), failureTestFile);
  }

  return path.resolve(process.cwd(), failureTestFile);
};

/**
 * Load the contents of the test file, if available.
 */
export const loadTestFileContent = async (filePath?: string | null): Promise<string | null> => {
  if (!filePath) {
    return null;
  }

  return await safeReadFile(filePath);
};

/**
 * Extract a focused snippet around the failing test for logging or diagnosis.
 */
export const extractTestSnippet = (
  testCode: string,
  failure: TestFailure,
  contextLines = DEFAULT_SNIPPET_CONTEXT_LINES
): string => {
  if (!testCode) {
    return '';
  }

  const lines = testCode.split(/\r?\n/);
  const searchTerms = [
    failure.testName,
    failure.selector,
    'it(',
    'test(',
    'describe('
  ].filter(Boolean);

  let matchIndex = -1;
  for (const term of searchTerms) {
    if (!term) {
      continue;
    }

    const candidate = lines.findIndex(line => line.includes(term));
    if (candidate >= 0) {
      matchIndex = candidate;
      break;
    }
  }

  if (matchIndex === -1) {
    matchIndex = 0;
  }

  const start = Math.max(0, matchIndex - contextLines);
  const end = Math.min(lines.length, matchIndex + contextLines + 1);

  return lines.slice(start, end).join('\n').trim();
};

/**
 * Parse the first line number from a stack trace to help highlight where the failure happened.
 */
export const extractFailedLineNumber = (stackTrace?: string): number | undefined => {
  if (!stackTrace) {
    return undefined;
  }

  const match = stackTrace.match(/:(\d+):\d+/);
  if (!match) {
    return undefined;
  }

  return Number(match[1]);
};
