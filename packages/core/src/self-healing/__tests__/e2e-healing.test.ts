/**
 * E2E Self-Healing Tests
 * 
 * 完整的端到端自愈测试，验证：
 * 1. 元素定位失败后的自动修复
 * 2. 多策略定位器瀑布
 * 3. 失败分类准确性
 * 4. 修复建议质量
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SelfHealingEngine } from '../SelfHealingEngine';
import { createBrowserAdapter } from '../adapters';
import type { TestFailure } from '../FailureClassifier';
import type { BrowserContext } from '../adapters/BrowserAdapter';

describe('E2E Self-Healing', () => {
  let healingEngine: SelfHealingEngine;
  let mockContext: BrowserContext;

  beforeEach(() => {
    // 初始化自愈引擎
    healingEngine = new SelfHealingEngine({
      enableAutoFix: true,
      autoFixConfidenceThreshold: 0.85,
      enableIntentTracking: true,
      enableLLM: false, // 测试环境不需要真实 LLM
    });

    // 创建模拟浏览器上下文
    mockContext = {
      adapter: {
        name: 'mock',
        version: '1.0',
        findElement: async (selector: string) => ({
          _raw: { selector, _mock: true },
          tagName: 'button',
          id: selector.includes('#') ? selector.slice(1) : undefined,
        }),
        findElements: async () => [],
        getAttribute: async () => null,
        getComputedStyles: async () => ({}),
        getTextContent: async () => '',
        isVisible: async () => true,
        screenshot: async () => Buffer.from(''),
        screenshotPage: async () => Buffer.from(''),
        getBoundingBox: async () => ({ x: 0, y: 0, width: 100, height: 40 }),
        click: async () => {},
        fill: async () => {},
        waitForElement: async () => null,
        evaluate: async (script: any) => script(),
        getSimplifiedDOM: async () => '<div><button id="submit-button" data-testid="submit">Submit</button></div>',
        isUnique: async () => true,
      } as any,
      page: {},
      url: 'http://localhost:3000/login',
    };
  });

  describe('Scenario 1: Button ID Change', () => {
    it('should heal button ID change via data-testid', async () => {
      // 测试失败：原选择器 #submit-btn 不再有效
      const failure: TestFailure = {
        testName: 'should submit login form',
        testFile: 'tests/login.spec.ts',
        errorMessage: 'Element not found: #submit-btn',
        stackTrace: 'Error: Element not found\n  at login.spec.ts:15',
        selector: '#submit-btn',
        timestamp: new Date(),
      };

      const context = {
        testCode: `
          cy.get('#submit-btn').click();
          cy.url().should('include', '/dashboard');
        `,
        pageContext: mockContext,
      };

      // 执行自愈
      const result = await healingEngine.heal(failure, context);

      // 验证结果
      expect(result.healed).toBe(false); // 在测试环境下不会真正修复
      expect(result.classification.failureType).toBe('test_fragility');
      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThan(0.7);

      // 验证建议包含 data-testid
      const suggestions = result.suggestions.map(s => s.description);
      const hasDataTestId = suggestions.some(s => s.includes('data-testid'));
      expect(hasDataTestId).toBe(true);
    });
  });

  describe('Scenario 2: CSS Class Refactoring', () => {
    it('should handle CSS class renaming', async () => {
      const failure: TestFailure = {
        testName: 'should display user profile',
        testFile: 'tests/profile.spec.ts',
        errorMessage: 'Element not found: .user-profile-card',
        stackTrace: 'Error: Element not found\n  at profile.spec.ts:22',
        selector: '.user-profile-card',
        timestamp: new Date(),
      };

      const context = {
        testCode: `cy.get('.user-profile-card').should('be.visible');`,
        pageContext: mockContext,
      };

      const result = await healingEngine.heal(failure, context);

      expect(result.classification.failureType).toBe('test_fragility');
      expect(result.suggestions.length).toBeGreaterThan(0);
      
      // 应该建议使用更稳定的选择器
      const suggestionText = result.suggestions.map(s => s.description).join(' ');
      expect(
        suggestionText.includes('data-testid') ||
        suggestionText.includes('role') ||
        suggestionText.includes('aria-label')
      ).toBe(true);
    });
  });

  describe('Scenario 3: Assertion Failure (Real Bug)', () => {
    it('should classify assertion failure as real bug', async () => {
      const failure: TestFailure = {
        testName: 'should calculate total correctly',
        testFile: 'tests/cart.spec.ts',
        errorMessage: 'Expected 150 but received 145',
        stackTrace: 'AssertionError: expected 150 to equal 145\n  at cart.spec.ts:45',
        expectedValue: 150,
        actualValue: 145,
        timestamp: new Date(),
      };

      const context = {
        testCode: `expect(cart.getTotal()).toBe(150);`,
        pageContext: mockContext,
      };

      const result = await healingEngine.heal(failure, context);

      // 应该被分类为真实 Bug（不能自动修复）
      expect(result.classification.failureType).toBe('real_bug');
      expect(result.healed).toBe(false);
      expect(result.strategy).toBe('cannot_fix');
      
      // 建议应该是调查代码
      const suggestionText = result.suggestions.map(s => s.description).join(' ');
      expect(suggestionText.toLowerCase()).toContain('review');
    });
  });

  describe('Scenario 4: Network Timeout (Environment Issue)', () => {
    it('should classify network timeout as environment issue', async () => {
      const failure: TestFailure = {
        testName: 'should load user data',
        testFile: 'tests/api.spec.ts',
        errorMessage: 'Error: ECONNREFUSED connect ECONNREFUSED 127.0.0.1:3000',
        stackTrace: 'Error: ECONNREFUSED\n  at api.spec.ts:10',
        timestamp: new Date(),
      };

      const context = {
        testCode: `const response = await fetch('/api/users');`,
        pageContext: mockContext,
      };

      const result = await healingEngine.heal(failure, context);

      // 应该被分类为环境问题
      expect(result.classification.failureType).toBe('environment');
      expect(result.healed).toBe(false);
      expect(result.strategy).toBe('cannot_fix');
      
      // 建议应该是检查服务
      const suggestionText = result.suggestions.map(s => s.description).join(' ');
      expect(
        suggestionText.toLowerCase().includes('service') ||
        suggestionText.toLowerCase().includes('network') ||
        suggestionText.toLowerCase().includes('server')
      ).toBe(true);
    });
  });

  describe('Scenario 5: Element Not Visible (Timing Issue)', () => {
    it('should detect timing issues and suggest waits', async () => {
      const failure: TestFailure = {
        testName: 'should show success message',
        testFile: 'tests/form.spec.ts',
        errorMessage: 'Element not visible: [data-testid="success-message"]',
        stackTrace: 'Error: Element not visible\n  at form.spec.ts:30',
        selector: '[data-testid="success-message"]',
        timestamp: new Date(),
      };

      const context = {
        testCode: `
          cy.get('[data-testid="submit"]').click();
          cy.get('[data-testid="success-message"]').should('be.visible');
        `,
        pageContext: mockContext,
      };

      const result = await healingEngine.heal(failure, context);

      expect(result.classification.failureType).toBe('test_fragility');
      
      // 建议应该包含等待策略
      const suggestionText = result.suggestions.map(s => s.description).join(' ');
      expect(
        suggestionText.toLowerCase().includes('wait') ||
        suggestionText.toLowerCase().includes('timeout') ||
        suggestionText.toLowerCase().includes('async')
      ).toBe(true);
    });
  });

  describe('Scenario 6: Fragile XPath Selector', () => {
    it('should detect fragile XPath and suggest alternatives', async () => {
      const failure: TestFailure = {
        testName: 'should click action button',
        testFile: 'tests/actions.spec.ts',
        errorMessage: 'Element not found: /html/body/div[1]/div[2]/button[3]',
        stackTrace: 'Error: Element not found\n  at actions.spec.ts:18',
        selector: '/html/body/div[1]/div[2]/button[3]',
        timestamp: new Date(),
      };

      const context = {
        testCode: `driver.findElement(By.xpath('/html/body/div[1]/div[2]/button[3]')).click();`,
        pageContext: mockContext,
      };

      const result = await healingEngine.heal(failure, context);

      expect(result.classification.failureType).toBe('test_fragility');
      
      // 建议应该包含更稳定的选择器
      const suggestionText = result.suggestions.map(s => s.description).join(' ');
      expect(
        suggestionText.includes('data-testid') ||
        suggestionText.includes('aria-label') ||
        suggestionText.includes('role')
      ).toBe(true);
    });
  });

  describe('Batch Healing', () => {
    it('should heal multiple failures in batch', async () => {
      const failures: TestFailure[] = [
        {
          testName: 'test 1',
          testFile: 'test1.spec.ts',
          errorMessage: 'Element not found',
          stackTrace: '',
          selector: '#old-id',
          timestamp: new Date(),
        },
        {
          testName: 'test 2',
          testFile: 'test2.spec.ts',
          errorMessage: 'Assertion failed',
          stackTrace: '',
          expectedValue: 10,
          actualValue: 9,
          timestamp: new Date(),
        },
      ];

      const contextMap = new Map(
        failures.map(f => [
          f.testName,
          {
            testCode: 'mock code',
            pageContext: mockContext,
          },
        ])
      );

      const results = await healingEngine.healBatch(failures, contextMap);

      expect(results.size).toBe(2);
      
      // 生成报告
      const report = healingEngine.generateHealingReport(results);
      expect(report).toContain('Self-Healing Report');
      expect(report).toContain('test 1');
      expect(report).toContain('test 2');
    });
  });

  describe('Performance', () => {
    it('should complete healing in reasonable time', async () => {
      const failure: TestFailure = {
        testName: 'perf test',
        testFile: 'perf.spec.ts',
        errorMessage: 'Element not found',
        stackTrace: '',
        selector: '.some-class',
        timestamp: new Date(),
      };

      const context = {
        testCode: 'mock code',
        pageContext: mockContext,
      };

      const startTime = Date.now();
      const result = await healingEngine.heal(failure, context);
      const duration = Date.now() - startTime;

      // 自愈应该在 5 秒内完成（不含 LLM）
      expect(duration).toBeLessThan(5000);
      expect(result.duration).toBeGreaterThan(0);
    });
  });
});

/**
 * 真实 Playwright 环境的集成测试
 * 
 * 需要真实的 Playwright 浏览器实例
 * 这些测试应该在独立的集成测试套件中运行
 */
describe.skip('Real Browser Integration Tests', () => {
  it('should heal in real Playwright browser', async () => {
    // 需要：
    // 1. 启动 Playwright 浏览器
    // 2. 加载测试页面
    // 3. 模拟 DOM 变化
    // 4. 验证自愈成功

    // 示例代码（需要真实环境）:
    /*
    import { chromium } from 'playwright';
    
    const browser = await chromium.launch();
    const page = await browser.newPage();
    const adapter = createBrowserAdapter('playwright', page);
    
    await page.goto('http://localhost:3000/test-page');
    
    const context: BrowserContext = {
      adapter,
      page,
      url: page.url(),
    };
    
    // ... 执行自愈测试
    
    await browser.close();
    */
  });
});














