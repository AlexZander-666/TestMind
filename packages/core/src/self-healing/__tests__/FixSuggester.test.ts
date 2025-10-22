import { describe, it, expect, beforeEach } from 'vitest';
import {
  FixSuggester,
  FixType,
  type TestFailure,
  type FixContext,
  createFixSuggester
} from '../FixSuggester';
import type { ClassificationResult } from '../FailureClassifier';
import { FailureType } from '../FailureClassifier';
import type { ElementDescriptor } from '../LocatorEngine';

describe('FixSuggester', () => {
  let suggester: FixSuggester;

  beforeEach(() => {
    suggester = createFixSuggester();
  });

  describe('suggestFixes', () => {
    it('should suggest selector updates for element not found errors', async () => {
      const failure: TestFailure = {
        testName: 'should click button',
        testFile: 'test/button.test.ts',
        errorMessage: 'Element not found: .old-selector',
        stackTrace: 'stack trace',
        timestamp: new Date(),
        selector: '.old-selector'
      };

      const context: FixContext = {
        testCode: `
          await page.click('.old-selector');
          expect(page.url()).toBe('/dashboard');
        `,
        currentSelector: '.old-selector',
        alternativeSelectors: [
          { id: 'submit-btn' },
          { cssSelector: '.new-selector' }
        ],
        failureClassification: {
          failureType: FailureType.TEST_FRAGILITY,
          confidence: 0.9,
          reasoning: 'Element selector is outdated',
          suggestedActions: [],
          isFlaky: false
        }
      };

      const suggestions = await suggester.suggestFixes(failure, context);

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].type).toBe(FixType.UPDATE_SELECTOR);
      expect(suggestions[0].diff).toContain('.old-selector');
    });

    it('should suggest wait increase for timeout errors', async () => {
      const failure: TestFailure = {
        testName: 'should load data',
        testFile: 'test/data.test.ts',
        errorMessage: 'Timeout waiting for element',
        stackTrace: 'stack trace',
        timestamp: new Date(),
        timeout: 5000
      };

      const context: FixContext = {
        testCode: `
          await page.waitForSelector('.data-table', { timeout: 5000 });
        `,
        failureClassification: {
          failureType: FailureType.TEST_FRAGILITY,
          confidence: 0.8,
          reasoning: 'Element takes longer to appear',
          suggestedActions: [],
          isFlaky: false
        }
      };

      const suggestions = await suggester.suggestFixes(failure, context);

      const waitSuggestion = suggestions.find(s => s.type === FixType.ADD_WAIT);
      expect(waitSuggestion).toBeDefined();
      expect(waitSuggestion?.description).toContain('10000');
    });

    it('should suggest retry logic for environment issues', async () => {
      const failure: TestFailure = {
        testName: 'should fetch API',
        testFile: 'test/api.test.ts',
        errorMessage: 'Network error: ECONNREFUSED',
        stackTrace: 'stack trace',
        timestamp: new Date()
      };

      const context: FixContext = {
        testCode: `
          const response = await fetch('/api/data');
          expect(response.ok).toBe(true);
        `,
        failedLine: 2,
        failureClassification: {
          failureType: FailureType.ENVIRONMENT,
          confidence: 0.9,
          reasoning: 'Network connection failed',
          suggestedActions: [],
          isFlaky: false
        }
      };

      const suggestions = await suggester.suggestFixes(failure, context);

      const retrySuggestion = suggestions.find(s => s.type === FixType.ADD_RETRY);
      expect(retrySuggestion).toBeDefined();
      expect(retrySuggestion?.diff).toContain('withRetry');
    });

    it('should suggest assertion fix for real bugs (with caution)', async () => {
      const failure: TestFailure = {
        testName: 'should calculate sum',
        testFile: 'test/calc.test.ts',
        errorMessage: 'Expected 100 but got 95',
        stackTrace: 'stack trace',
        timestamp: new Date(),
        expectedValue: 100,
        actualValue: 95
      };

      const context: FixContext = {
        testCode: `
          const sum = calculate(50, 45);
          expect(sum).toBe(100);
        `,
        failureClassification: {
          failureType: FailureType.REAL_BUG,
          confidence: 0.6,
          reasoning: 'Assertion mismatch',
          suggestedActions: [],
          isFlaky: false
        }
      };

      const suggestions = await suggester.suggestFixes(failure, context);

      const assertionFix = suggestions.find(s => s.type === FixType.FIX_ASSERTION);
      expect(assertionFix).toBeDefined();
      expect(assertionFix?.confidence).toBeLessThan(0.7); // Lower confidence for real bugs
      expect(assertionFix?.reasoning).toContain('bug');
    });

    it('should sort suggestions by confidence', async () => {
      const failure: TestFailure = {
        testName: 'test',
        testFile: 'test.ts',
        errorMessage: 'Element not found',
        stackTrace: 'stack',
        timestamp: new Date(),
        selector: '.old'
      };

      const context: FixContext = {
        testCode: 'await page.click(\'.old\');',
        currentSelector: '.old',
        alternativeSelectors: [
          { id: 'btn' }, // High confidence
          { xpath: '//button' }, // Lower confidence
          { cssSelector: '.new-selector' } // Medium confidence
        ],
        failureClassification: {
          failureType: FailureType.TEST_FRAGILITY,
          confidence: 0.9,
          reasoning: 'reason',
          suggestedActions: [],
          isFlaky: false
        }
      };

      const suggestions = await suggester.suggestFixes(failure, context);

      // Should be sorted by confidence (descending)
      for (let i = 1; i < suggestions.length; i++) {
        expect(suggestions[i - 1].confidence).toBeGreaterThanOrEqual(
          suggestions[i].confidence
        );
      }
    });
  });

  describe('generateHumanReadableGuide', () => {
    it('should generate comprehensive fix guide', () => {
      const suggestion = {
        type: FixType.UPDATE_SELECTOR,
        description: 'Update selector to use ID',
        diff: '- await page.click(\'.btn\');\n+ await page.click(\'#submit-btn\');',
        confidence: 0.95,
        estimatedEffort: 'low' as const,
        reasoning: 'ID selectors are more stable',
        alternativeApproaches: [
          'Use data-testid attribute',
          'Use text content for selection'
        ]
      };

      const guide = suggester.generateHumanReadableGuide(suggestion);

      expect(guide).toContain('## Fix Suggestion');
      expect(guide).toContain('Update selector to use ID');
      expect(guide).toContain('95%'); // Confidence
      expect(guide).toContain('low'); // Effort
      expect(guide).toContain('ID selectors are more stable'); // Reasoning
      expect(guide).toContain('```diff'); // Code diff
      expect(guide).toContain('Alternative Approaches');
      expect(guide).toContain('Use data-testid attribute');
    });

    it('should handle suggestion without alternatives', () => {
      const suggestion = {
        type: FixType.ADD_WAIT,
        description: 'Increase timeout',
        diff: '- { timeout: 5000 }\n+ { timeout: 10000 }',
        confidence: 0.7,
        estimatedEffort: 'low' as const,
        reasoning: 'Element needs more time'
      };

      const guide = suggester.generateHumanReadableGuide(suggestion);

      expect(guide).toContain('## Fix Suggestion');
      expect(guide).not.toContain('Alternative Approaches');
    });
  });

  describe('diff generation', () => {
    it('should generate valid diff for selector updates', async () => {
      const failure: TestFailure = {
        testName: 'test',
        testFile: 'test.ts',
        errorMessage: 'Element not found',
        stackTrace: 'stack',
        timestamp: new Date(),
        selector: '.old-btn'
      };

      const context: FixContext = {
        testCode: 'await page.click(\'.old-btn\');',
        currentSelector: '.old-btn',
        alternativeSelectors: [{ id: 'new-btn' }],
        failureClassification: {
          failureType: FailureType.TEST_FRAGILITY,
          confidence: 0.9,
          reasoning: 'reason',
          suggestedActions: [],
          isFlaky: false
        }
      };

      const suggestions = await suggester.suggestFixes(failure, context);
      const selectorFix = suggestions.find(s => s.type === FixType.UPDATE_SELECTOR);

      expect(selectorFix?.diff).toBeDefined();
      expect(selectorFix?.diff).toContain('.old-btn');
      expect(selectorFix?.diff).toContain('#new-btn');
      expect(selectorFix?.diff).toMatch(/^[\-\+]/m); // Contains diff markers
    });
  });

  describe('selector confidence calculation', () => {
    it('should assign highest confidence to ID selectors', async () => {
      const context: FixContext = {
        testCode: 'test code',
        currentSelector: '.old',
        alternativeSelectors: [
          { id: 'btn' },
          { cssSelector: '.new' }
        ],
        failureClassification: {
          failureType: FailureType.TEST_FRAGILITY,
          confidence: 0.9,
          reasoning: 'reason',
          suggestedActions: [],
          isFlaky: false
        }
      };

      const failure: TestFailure = {
        testName: 'test',
        testFile: 'test.ts',
        errorMessage: 'error',
        stackTrace: 'stack',
        timestamp: new Date(),
        selector: '.old'
      };

      const suggestions = await suggester.suggestFixes(failure, context);
      
      const idSuggestion = suggestions.find(s => 
        s.description.includes('ID')
      );
      const cssSuggestion = suggestions.find(s => 
        s.description.includes('CSS') && !s.description.includes('ID')
      );

      if (idSuggestion && cssSuggestion) {
        expect(idSuggestion.confidence).toBeGreaterThan(cssSuggestion.confidence);
      }
    });
  });
});















































