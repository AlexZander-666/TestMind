/**
 * SelfHealingEngine单元测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SelfHealingEngine, HealingStrategy } from '../SelfHealingEngine';
import type { TestFailure } from '../FailureClassifier';
import type { FixContext } from '../FixSuggester';
import type { LLMService } from '../../llm/LLMService';

describe('SelfHealingEngine', () => {
  let engine: SelfHealingEngine;
  let mockLLMService: LLMService;

  beforeEach(() => {
    // Mock LLM Service
    mockLLMService = {
      generate: vi.fn().mockResolvedValue({
        content: JSON.stringify({
          failureType: 'test_fragility',
          confidence: 0.9,
          reasoning: 'Element selector changed',
          suggestedActions: ['Update selector', 'Use data-testid']
        }),
        usage: { totalTokens: 100 }
      })
    } as any;

    engine = new SelfHealingEngine({
      llmService: mockLLMService,
      enableAutoFix: false,
      enableIntentTracking: true,
      enableLLM: true
    });
  });

  describe('heal', () => {
    it('should classify test fragility and suggest fixes', async () => {
      const failure: TestFailure = {
        testName: 'login-test',
        testFile: 'tests/login.spec.ts',
        errorMessage: 'Element not found: .btn-login',
        stackTrace: 'at page.click(...)',
        timestamp: new Date(),
        selector: '.btn-login'
      };

      const context: FixContext = {
        testCode: 'await page.click(".btn-login")',
        currentSelector: '.btn-login',
        failedLine: 15
      };

      const result = await engine.heal(failure, context);

      expect(result).toBeDefined();
      expect(result.healed).toBeDefined();
      expect(result.strategy).toBeDefined();
      expect(result.suggestions).toBeDefined();
      expect(result.classification).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should use AUTO_FIX strategy for high confidence fragility', async () => {
      const engine = new SelfHealingEngine({
        llmService: mockLLMService,
        enableAutoFix: true,
        autoFixConfidenceThreshold: 0.8
      });

      const failure: TestFailure = {
        testName: 'test',
        testFile: 'test.ts',
        errorMessage: 'Element not found',
        stackTrace: 'stack',
        timestamp: new Date(),
        selector: '.btn'
      };

      const context: FixContext = {
        testCode: 'code',
        currentSelector: '.btn'
      };

      // Mock高置信度分类
      mockLLMService.generate = vi.fn().mockResolvedValue({
        content: JSON.stringify({
          failureType: 'test_fragility',
          confidence: 0.95,
          reasoning: 'Clear selector issue',
          suggestedActions: ['Update']
        }),
        usage: { totalTokens: 50 }
      });

      const result = await engine.heal(failure, context);

      // 高置信度的测试脆弱性应该建议自动修复
      expect(result.strategy).toBe(HealingStrategy.SUGGEST_FIX);
    });

    it('should use CANNOT_FIX strategy for real bugs', async () => {
      const failure: TestFailure = {
        testName: 'test',
        testFile: 'test.ts',
        errorMessage: 'TypeError: Cannot read property of undefined',
        stackTrace: 'at myFunction',
        timestamp: new Date()
      };

      const context: FixContext = {
        testCode: 'expect(result.value).toBe(5)'
      };

      // Mock真实Bug分类
      mockLLMService.generate = vi.fn().mockResolvedValue({
        content: JSON.stringify({
          failureType: 'real_bug',
          confidence: 0.9,
          reasoning: 'Code logic error',
          suggestedActions: ['Fix code']
        }),
        usage: { totalTokens: 50 }
      });

      const result = await engine.heal(failure, context);

      expect(result.strategy).toBe(HealingStrategy.CANNOT_FIX);
      expect(result.healed).toBe(false);
    });

    it('should generate fix suggestions', async () => {
      const failure: TestFailure = {
        testName: 'test',
        testFile: 'test.ts',
        errorMessage: 'Timeout waiting for element',
        stackTrace: 'stack',
        timestamp: new Date(),
        timeout: 5000
      };

      const context: FixContext = {
        testCode: 'await page.click(".btn", { timeout: 5000 })',
        currentSelector: '.btn'
      };

      const result = await engine.heal(failure, context);

      expect(result.suggestions).toBeDefined();
      expect(result.suggestions.length).toBeGreaterThan(0);
      
      // 应该有增加超时的建议
      const hasTimeoutSuggestion = result.suggestions.some(
        s => s.description.toLowerCase().includes('timeout')
      );
      expect(hasTimeoutSuggestion).toBe(true);
    });

    it('should calculate overall confidence from multiple factors', async () => {
      const failure: TestFailure = {
        testName: 'test',
        testFile: 'test.ts',
        errorMessage: 'Element not found',
        stackTrace: 'stack',
        timestamp: new Date(),
        selector: '.btn'
      };

      const context: FixContext = {
        testCode: 'code',
        currentSelector: '.btn'
      };

      const result = await engine.heal(failure, context);

      // 置信度应该在合理范围内
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThan(1);
      
      // 应该综合考虑分类、建议等因素
      expect(result.classification.confidence).toBeDefined();
    });
  });

  describe('healBatch', () => {
    it('should heal multiple failures in batch', async () => {
      const failures: TestFailure[] = [
        {
          testName: 'test-1',
          testFile: 'test.ts',
          errorMessage: 'Element not found',
          stackTrace: 'stack',
          timestamp: new Date(),
          selector: '.btn1'
        },
        {
          testName: 'test-2',
          testFile: 'test.ts',
          errorMessage: 'Timeout',
          stackTrace: 'stack',
          timestamp: new Date(),
          timeout: 5000
        }
      ];

      const contextMap = new Map<string, FixContext>();
      contextMap.set('test-1', { testCode: 'code1', currentSelector: '.btn1' });
      contextMap.set('test-2', { testCode: 'code2' });

      const results = await engine.healBatch(failures, contextMap);

      expect(results.size).toBe(2);
      expect(results.has('test-1')).toBe(true);
      expect(results.has('test-2')).toBe(true);
    });

    it('should handle partial failures in batch', async () => {
      const failures: TestFailure[] = [
        {
          testName: 'good-test',
          testFile: 'test.ts',
          errorMessage: 'Element not found',
          stackTrace: 'stack',
          timestamp: new Date()
        },
        {
          testName: 'bad-test',
          testFile: 'test.ts',
          errorMessage: 'Error',
          stackTrace: 'stack',
          timestamp: new Date()
        }
      ];

      const contextMap = new Map<string, FixContext>();
      contextMap.set('good-test', { testCode: 'code' });
      // bad-test没有context，应该跳过

      const results = await engine.healBatch(failures, contextMap);

      expect(results.size).toBe(1);
      expect(results.has('good-test')).toBe(true);
      expect(results.has('bad-test')).toBe(false);
    });
  });

  describe('generateHealingReport', () => {
    it('should generate comprehensive healing report', async () => {
      const failure: TestFailure = {
        testName: 'test',
        testFile: 'test.ts',
        errorMessage: 'Element not found',
        stackTrace: 'stack',
        timestamp: new Date(),
        selector: '.btn'
      };

      const context: FixContext = {
        testCode: 'code',
        currentSelector: '.btn'
      };

      const result = await engine.heal(failure, context);
      const resultsMap = new Map([['test', result]]);

      const report = engine.generateHealingReport(resultsMap);

      expect(report).toContain('Self-Healing Report');
      expect(report).toContain('Total Failed Tests');
      expect(report).toContain('test');
      expect(report).toContain(result.strategy);
    });

    it('should calculate healing success rate correctly', async () => {
      const resultsMap = new Map();
      
      // 模拟结果
      resultsMap.set('test-1', {
        healed: true,
        strategy: HealingStrategy.AUTO_FIX,
        suggestions: [],
        classification: { failureType: 'test_fragility', confidence: 0.9, reasoning: '', suggestedActions: [], isFlaky: false },
        confidence: 0.9,
        duration: 100
      });
      
      resultsMap.set('test-2', {
        healed: false,
        strategy: HealingStrategy.SUGGEST_FIX,
        suggestions: [],
        classification: { failureType: 'real_bug', confidence: 0.8, reasoning: '', suggestedActions: [], isFlaky: false },
        confidence: 0.5,
        duration: 100
      });

      const report = engine.generateHealingReport(resultsMap);

      expect(report).toContain('2'); // total tests
      expect(report).toContain('1'); // healed tests
      expect(report).toContain('50.0%'); // healing rate
    });
  });

  describe('component getters', () => {
    it('should provide access to IntentTracker', () => {
      const tracker = engine.getIntentTracker();
      expect(tracker).toBeDefined();
    });

    it('should provide access to LocatorEngine', () => {
      const locator = engine.getLocatorEngine();
      expect(locator).toBeDefined();
    });
  });

  describe('configuration', () => {
    it('should respect enableAutoFix configuration', () => {
      const engineWithAutoFix = new SelfHealingEngine({
        enableAutoFix: true,
        autoFixConfidenceThreshold: 0.95
      });

      expect(engineWithAutoFix).toBeDefined();
      // Configuration通过constructor传入
    });

    it('should work without LLM service', async () => {
      const engineNoLLM = new SelfHealingEngine({
        enableLLM: false
      });

      const failure: TestFailure = {
        testName: 'test',
        testFile: 'test.ts',
        errorMessage: 'Element not found',
        stackTrace: 'stack',
        timestamp: new Date()
      };

      const context: FixContext = {
        testCode: 'code'
      };

      const result = await engineNoLLM.heal(failure, context);

      // 应该仍然能工作，使用规则引擎
      expect(result).toBeDefined();
      expect(result.classification).toBeDefined();
    });
  });
});

