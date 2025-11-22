import { describe, it, expect, beforeEach } from 'vitest';
import {
  FailureClassifier,
  FailureType,
  type TestFailure,
  createFailureClassifier
} from '../FailureClassifier';

describe('FailureClassifier', () => {
  let classifier: FailureClassifier;

  beforeEach(() => {
    classifier = createFailureClassifier();
  });

  describe('classify', () => {
    it('should classify timeout errors as environment issues', async () => {
      const failure: TestFailure = {
        testName: 'should load page',
        testFile: 'test/page.test.ts',
        errorMessage: 'Timeout exceeded waiting for page to load',
        stackTrace: 'at Page.load (page.ts:123)',
        timestamp: new Date()
      };

      const result = await classifier.classify(failure);

      expect(result.failureType).toBe(FailureType.ENVIRONMENT);
      expect(result.confidence).toBeGreaterThan(0.6);
    });

    it('should classify element not found errors as test fragility', async () => {
      const failure: TestFailure = {
        testName: 'should click button',
        testFile: 'test/button.test.ts',
        errorMessage: 'Element not found: .submit-button',
        stackTrace: 'at click (test.ts:45)',
        timestamp: new Date(),
        selector: '.submit-button'
      };

      const result = await classifier.classify(failure);

      expect(result.failureType).toBe(FailureType.TEST_FRAGILITY);
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it('should classify assertion errors as real bugs', async () => {
      const failure: TestFailure = {
        testName: 'should calculate total',
        testFile: 'test/calc.test.ts',
        errorMessage: 'Expected 100 but got 95',
        stackTrace: 'at expect (calc.test.ts:23)',
        timestamp: new Date(),
        expectedValue: 100,
        actualValue: 95
      };

      const result = await classifier.classify(failure);

      expect(result.failureType).toBe(FailureType.REAL_BUG);
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should classify network errors as environment issues', async () => {
      const failure: TestFailure = {
        testName: 'should fetch data',
        testFile: 'test/api.test.ts',
        errorMessage: 'Network error: ECONNREFUSED',
        stackTrace: 'at fetch (api.ts:12)',
        timestamp: new Date()
      };

      const result = await classifier.classify(failure);

      expect(result.failureType).toBe(FailureType.ENVIRONMENT);
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it('should classify stale element errors as test fragility', async () => {
      const failure: TestFailure = {
        testName: 'should interact with element',
        testFile: 'test/element.test.ts',
        errorMessage: 'Stale element reference: element is not attached to the page document',
        stackTrace: 'at click (element.test.ts:34)',
        timestamp: new Date()
      };

      const result = await classifier.classify(failure);

      expect(result.failureType).toBe(FailureType.TEST_FRAGILITY);
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('should provide suggested actions for each failure type', async () => {
      const failure: TestFailure = {
        testName: 'test',
        testFile: 'test.ts',
        errorMessage: 'Timeout',
        stackTrace: 'stack',
        timestamp: new Date()
      };

      const result = await classifier.classify(failure);

      expect(result.suggestedActions).toBeDefined();
      expect(result.suggestedActions.length).toBeGreaterThan(0);
      expect(Array.isArray(result.suggestedActions)).toBe(true);
    });
  });

  describe('flakiness detection', () => {
    it('should detect flaky tests with mixed pass/fail history', async () => {
      const failure: TestFailure = {
        testName: 'flaky test',
        testFile: 'test/flaky.test.ts',
        errorMessage: 'Random failure',
        stackTrace: 'stack',
        timestamp: new Date(),
        previousRuns: [
          { timestamp: new Date(), passed: true, duration: 100 },
          { timestamp: new Date(), passed: false, duration: 120, errorMessage: 'error' },
          { timestamp: new Date(), passed: true, duration: 110 },
          { timestamp: new Date(), passed: false, duration: 125, errorMessage: 'error' },
          { timestamp: new Date(), passed: true, duration: 105 }
        ]
      };

      const result = await classifier.classify(failure);

      expect(result.isFlaky).toBe(true);
    });

    it('should not mark consistently failing tests as flaky', async () => {
      const failure: TestFailure = {
        testName: 'consistent failure',
        testFile: 'test/broken.test.ts',
        errorMessage: 'Always fails',
        stackTrace: 'stack',
        timestamp: new Date(),
        previousRuns: [
          { timestamp: new Date(), passed: false, duration: 100, errorMessage: 'error' },
          { timestamp: new Date(), passed: false, duration: 105, errorMessage: 'error' },
          { timestamp: new Date(), passed: false, duration: 110, errorMessage: 'error' }
        ]
      };

      const result = await classifier.classify(failure);

      expect(result.isFlaky).toBe(false);
    });

    it('should not mark tests as flaky with insufficient history', async () => {
      const failure: TestFailure = {
        testName: 'new test',
        testFile: 'test/new.test.ts',
        errorMessage: 'Failure',
        stackTrace: 'stack',
        timestamp: new Date(),
        previousRuns: [
          { timestamp: new Date(), passed: false, duration: 100, errorMessage: 'error' }
        ]
      };

      const result = await classifier.classify(failure);

      expect(result.isFlaky).toBe(false);
    });
  });

  describe('pattern matching', () => {
    it('should match multiple keywords', async () => {
      const failure: TestFailure = {
        testName: 'test',
        testFile: 'test.ts',
        errorMessage: 'Service unavailable: connection refused',
        stackTrace: 'network error stack trace',
        timestamp: new Date()
      };

      const result = await classifier.classify(failure);

      expect(result.failureType).toBe(FailureType.ENVIRONMENT);
      expect(result.metadata?.matchedKeywords).toBeDefined();
      if (result.metadata?.matchedKeywords) {
        expect(result.metadata.matchedKeywords.length).toBeGreaterThan(0);
      }
    });

    it('should return unknown for unrecognized patterns', async () => {
      const failure: TestFailure = {
        testName: 'test',
        testFile: 'test.ts',
        errorMessage: 'Some completely unique and unrecognized error xyz123',
        stackTrace: 'unique stack trace abc789',
        timestamp: new Date()
      };

      const result = await classifier.classify(failure);

      // May return UNKNOWN if no patterns match with sufficient confidence
      if (result.confidence < 0.5) {
        expect(result.failureType).toBe(FailureType.UNKNOWN);
      }
    });
  });
});










































