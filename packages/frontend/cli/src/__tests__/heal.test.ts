import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import path from 'path';
import type { SelfHealingResult, TestFailure } from '@testmind/core';
import {
  extractFailedLineNumber,
  extractTestSnippet,
  resolveReportedTestFilePath
} from '../utils/testReport';
import { healCommand } from '../commands/heal';

const fixturesDir = path.resolve(__dirname, 'fixtures');
const reportPath = path.join(fixturesDir, 'failed-report.json');

const mockResult: SelfHealingResult = {
  healed: true,
  strategy: 'suggest_fix',
  suggestions: [],
  classification: {
    failureType: 'test_fragility',
    confidence: 0.9,
    reasoning: 'mocked reasoning',
    suggestedActions: [],
    isFlaky: false
  },
  confidence: 0.9,
  duration: 1
};

describe('testReport utilities', () => {
  it('resolves override test file paths relative to cwd', () => {
    const override = 'tests/override/sample.ts';
    const resolved = resolveReportedTestFilePath(undefined, undefined, override);
    expect(resolved).toBe(path.resolve(process.cwd(), override));
  });

  it('resolves failure paths relative to the report', () => {
    const resolved = resolveReportedTestFilePath(reportPath, 'sample.fixture.ts');
    expect(resolved).toBe(path.join(fixturesDir, 'sample.fixture.ts'));
  });

  it('extracts a snippet around the failing test', () => {
    const failure: TestFailure = {
      testName: 'should fail to click submit',
      testFile: 'sample.fixture.ts',
      errorMessage: 'boom',
      stackTrace: '',
      timestamp: new Date(),
      selector: '[data-testid="submit-button"]'
    };

    const code = `describe('Sample form', () => {
  it('should fail to click submit', () => {
    cy.get('[data-testid="submit-button"]').click();
  });
});`;

    const snippet = extractTestSnippet(code, failure);
    expect(snippet).toContain('cy.get(\'[data-testid="submit-button"]\')');
  });

  it('extracts the failing line number from a stack trace', () => {
    const lineNumber = extractFailedLineNumber('Error: boom\\n  at sample.fixture.ts:12:4');
    expect(lineNumber).toBe(12);
  });
});

describe('healCommand', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.exitCode = undefined;
  });

  afterEach(() => {
    process.exitCode = undefined;
  });

  it('loads test file contents and passes them to the healing engine', async () => {
    const mockHeal = vi.fn().mockResolvedValue(mockResult);
    const factory = () => ({ heal: mockHeal } as any);

    await healCommand(undefined, {
      experimental: true,
      report: reportPath,
      skipExit: true
    }, factory as any);

    expect(mockHeal).toHaveBeenCalledOnce();
    const [, context] = mockHeal.mock.calls[0];
    expect(context.testCode).toContain('[data-testid="submit-button"]');
    expect(context.failedLine).toBe(8);
    expect(process.exitCode).toBe(0);
  });
});
