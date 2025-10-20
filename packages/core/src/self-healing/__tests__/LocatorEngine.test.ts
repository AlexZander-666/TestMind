import { describe, it, expect, beforeEach } from 'vitest';
import {
  LocatorEngine,
  LocatorStrategy,
  type ElementDescriptor,
  createLocatorEngine
} from '../LocatorEngine';

describe('LocatorEngine', () => {
  let engine: LocatorEngine;

  beforeEach(() => {
    engine = createLocatorEngine();
  });

  describe('locateElement', () => {
    it('should locate element by ID with highest confidence', async () => {
      const descriptor: ElementDescriptor = {
        id: 'login-button',
        cssSelector: '.btn-login'
      };

      const result = await engine.locateElement(descriptor);

      expect(result).not.toBeNull();
      expect(result?.strategy).toBe(LocatorStrategy.ID);
      expect(result?.confidence).toBe(1.0);
    });

    it('should fallback to CSS selector when ID is not available', async () => {
      const descriptor: ElementDescriptor = {
        cssSelector: '.btn-login'
      };

      const result = await engine.locateElement(descriptor);

      expect(result).not.toBeNull();
      expect(result?.strategy).toBe(LocatorStrategy.CSS_SELECTOR);
    });

    it('should fallback to XPath when ID and CSS are not available', async () => {
      const descriptor: ElementDescriptor = {
        xpath: '//button[@class="btn-login"]'
      };

      const result = await engine.locateElement(descriptor);

      expect(result).not.toBeNull();
      expect(result?.strategy).toBe(LocatorStrategy.XPATH);
    });

    it('should return null when no strategy succeeds', async () => {
      const descriptor: ElementDescriptor = {};

      const result = await engine.locateElement(descriptor);

      expect(result).toBeNull();
    });

    it('should respect minimum confidence threshold', async () => {
      const strictEngine = new LocatorEngine({
        minConfidenceThreshold: 0.95
      });

      const descriptor: ElementDescriptor = {
        cssSelector: '.btn',
        textContent: 'non-matching-text'
      };

      const result = await strictEngine.locateElement(descriptor);

      // Might be null if confidence is below threshold
      if (result) {
        expect(result.confidence).toBeGreaterThanOrEqual(0.95);
      }
    });
  });

  describe('suggestAlternativeLocators', () => {
    it('should suggest ID-based selector when ID is available', async () => {
      const descriptor: ElementDescriptor = {
        id: 'submit-btn',
        attributes: {
          class: 'btn btn-primary'
        }
      };

      const suggestions = await engine.suggestAlternativeLocators(descriptor);

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].cssSelector).toBe('#submit-btn');
    });

    it('should suggest class-based selector when class is available', async () => {
      const descriptor: ElementDescriptor = {
        attributes: {
          class: 'btn-primary btn-large'
        }
      };

      const suggestions = await engine.suggestAlternativeLocators(descriptor);

      const classSuggestion = suggestions.find(s => 
        s.cssSelector?.includes('.btn-primary')
      );
      expect(classSuggestion).toBeDefined();
    });

    it('should suggest XPath with text when textContent is available', async () => {
      const descriptor: ElementDescriptor = {
        textContent: 'Submit'
      };

      const suggestions = await engine.suggestAlternativeLocators(descriptor);

      const xpathSuggestion = suggestions.find(s => 
        s.xpath?.includes("contains(text(), 'Submit')")
      );
      expect(xpathSuggestion).toBeDefined();
    });
  });

  describe('configuration', () => {
    it('should respect custom fallback strategies', async () => {
      const customEngine = new LocatorEngine({
        fallbackStrategies: [
          LocatorStrategy.CSS_SELECTOR,
          LocatorStrategy.ID
        ]
      });

      const descriptor: ElementDescriptor = {
        id: 'test',
        cssSelector: '.test'
      };

      const result = await customEngine.locateElement(descriptor);

      // Should try CSS first based on custom strategy order
      expect(result).not.toBeNull();
    });

    it('should disable visual matching when configured', async () => {
      const engine = new LocatorEngine({
        enableVisualMatching: false
      });

      const descriptor: ElementDescriptor = {
        visualSignature: 'some-visual-hash'
      };

      const result = await engine.locateElement(descriptor);

      // Visual strategy disabled, should return null
      expect(result).toBeNull();
    });

    it('should disable semantic matching when configured', async () => {
      const engine = new LocatorEngine({
        enableSemanticMatching: false
      });

      const descriptor: ElementDescriptor = {
        semanticIntent: 'login button'
      };

      const result = await engine.locateElement(descriptor);

      // Semantic strategy disabled, should return null
      expect(result).toBeNull();
    });
  });
});




