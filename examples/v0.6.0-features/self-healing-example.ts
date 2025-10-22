/**
 * Self-Healing Engine 使用示例
 * 
 * 演示如何使用 v0.6.0 的自愈功能
 */

import { SelfHealingEngine, LocatorEngine, createBrowserAdapter } from '@testmind/core';
import type { TestFailure, BrowserContext } from '@testmind/core';

/**
 * 示例 1: 基础自愈流程
 */
async function example1_basic() {
  console.log('=== 示例 1: 基础自愈流程 ===\n');

  // 1. 创建自愈引擎
  const engine = new SelfHealingEngine({
    enableAutoFix: true,
    autoFixConfidenceThreshold: 0.85,
    enableLLM: false, // 此示例不使用 LLM
  });

  // 2. 模拟测试失败
  const failure: TestFailure = {
    testName: 'should click submit button',
    testFile: 'tests/login.spec.ts',
    errorMessage: 'Element not found: #submit-btn',
    stackTrace: 'Error: Element not found\n  at login.spec.ts:15',
    selector: '#submit-btn',
    timestamp: new Date(),
  };

  // 3. 创建上下文（测试环境模拟）
  const context = {
    testCode: `cy.get('#submit-btn').click();`,
    pageContext: undefined, // 测试环境不需要真实浏览器
  };

  // 4. 执行自愈
  const result = await engine.heal(failure, context);

  // 5. 检查结果
  console.log('自愈结果:');
  console.log(`  - Healed: ${result.healed}`);
  console.log(`  - Strategy: ${result.strategy}`);
  console.log(`  - Confidence: ${(result.confidence * 100).toFixed(0)}%`);
  console.log(`  - Classification: ${result.classification.failureType}`);
  console.log(`  - Suggestions: ${result.suggestions.length}`);
  console.log(`  - Duration: ${result.duration}ms`);

  if (result.suggestions.length > 0) {
    console.log('\n修复建议:');
    result.suggestions.forEach((suggestion, i) => {
      console.log(`  ${i + 1}. ${suggestion.description} (置信度: ${(suggestion.confidence * 100).toFixed(0)}%)`);
    });
  }
}

/**
 * 示例 2: 使用 Playwright 适配器（需要 Playwright 安装）
 */
async function example2_playwright() {
  console.log('\n=== 示例 2: Playwright 适配器 ===\n');

  try {
    // 检查 Playwright 是否可用
    const playwright = await import('playwright');
    
    // 1. 启动浏览器
    const browser = await playwright.chromium.launch({ headless: true });
    const page = await browser.newPage();

    // 2. 创建适配器
    const adapter = createBrowserAdapter('playwright', page);

    // 3. 导航到页面
    await page.goto('data:text/html,<html><body><button id="test-btn" data-testid="submit">Click Me</button></body></html>');

    // 4. 创建浏览器上下文
    const context: BrowserContext = {
      adapter,
      page,
      url: page.url(),
    };

    // 5. 使用定位引擎
    const locator = new LocatorEngine();

    const result = await locator.locateElement(
      {
        id: 'test-btn',
        cssSelector: '#test-btn',
        semanticIntent: 'submit button',
      },
      context
    );

    console.log('定位结果:');
    console.log(`  - Found: ${result !== null}`);
    if (result) {
      console.log(`  - Strategy: ${result.strategy}`);
      console.log(`  - Confidence: ${(result.confidence * 100).toFixed(0)}%`);
    }

    // 清理
    await browser.close();
  } catch (error: any) {
    if (error.code === 'MODULE_NOT_FOUND') {
      console.log('  ⏭️  跳过: Playwright 未安装');
      console.log('      安装方式: pnpm add playwright');
    } else {
      throw error;
    }
  }
}

/**
 * 示例 3: 批量自愈
 */
async function example3_batch_healing() {
  console.log('\n=== 示例 3: 批量自愈 ===\n');

  const engine = new SelfHealingEngine();

  // 多个失败
  const failures: TestFailure[] = [
    {
      testName: 'test 1',
      testFile: 'test1.ts',
      errorMessage: 'Element not found: #old-id',
      stackTrace: '',
      selector: '#old-id',
      timestamp: new Date(),
    },
    {
      testName: 'test 2',
      testFile: 'test2.ts',
      errorMessage: 'Assertion failed',
      stackTrace: '',
      expectedValue: 10,
      actualValue: 9,
      timestamp: new Date(),
    },
    {
      testName: 'test 3',
      testFile: 'test3.ts',
      errorMessage: 'ECONNREFUSED',
      stackTrace: '',
      timestamp: new Date(),
    },
  ];

  const contextMap = new Map(
    failures.map(f => [
      f.testName,
      {
        testCode: 'mock code',
        pageContext: undefined,
      },
    ])
  );

  // 批量自愈
  const results = await engine.healBatch(failures, contextMap);

  console.log(`批量自愈完成: ${results.size} 个测试`);

  // 统计
  let healed = 0;
  let suggested = 0;
  let cannotFix = 0;

  for (const result of results.values()) {
    if (result.healed) healed++;
    else if (result.suggestions.length > 0) suggested++;
    else cannotFix++;
  }

  console.log(`  - Auto-healed: ${healed}`);
  console.log(`  - Need Review: ${suggested}`);
  console.log(`  - Cannot Fix: ${cannotFix}`);

  // 生成报告
  const report = engine.generateHealingReport(results);
  console.log('\n报告预览:');
  console.log(report.split('\n').slice(0, 10).join('\n'));
  console.log('  ...');
}

/**
 * 示例 4: 成本优化
 */
async function example4_cost_optimization() {
  console.log('\n=== 示例 4: 成本优化 ===\n');

  const optimizer = new CostOptimizer();

  // 不同复杂度的函数
  const contexts = [
    { complexity: 2, name: 'simple' },
    { complexity: 7, name: 'moderate' },
    { complexity: 15, name: 'complex' },
  ];

  console.log('模型选择策略:');
  for (const ctx of contexts) {
    const selection = optimizer.selectModel({
      functionCode: 'mock',
      functionName: ctx.name,
      complexity: ctx.complexity,
      filePath: 'test.ts',
    });

    console.log(`  - 复杂度 ${ctx.complexity} → ${selection.model}`);
    console.log(`    成本: $${selection.estimatedCost.toFixed(6)}, 预期质量: ${selection.expectedQuality}%`);
  }

  // Prompt 压缩示例
  const longPrompt = `
    Generate a test for this function:
    
    function example() {
      return 42;
    }
    
    
    Make sure to:
    - Use best practices
    - Add assertions
    - Handle edge cases
    
    
    Example test:
    // ...
  `;

  const compressionResult = optimizer.compressPrompt(longPrompt, {
    functionCode: 'mock',
    functionName: 'example',
    complexity: 5,
    filePath: 'test.ts',
  });

  console.log('\nPrompt 压缩:');
  console.log(`  - 原始长度: ${compressionResult.originalLength}`);
  console.log(`  - 压缩后: ${compressionResult.compressedLength}`);
  console.log(`  - 压缩率: ${(compressionResult.compressionRatio * 100).toFixed(1)}%`);
  console.log(`  - 节省成本: $${compressionResult.costSaved.toFixed(6)}`);
}

// 执行所有示例
async function runAllExamples() {
  console.log('🚀 TestMind v0.6.0 功能演示\n');
  console.log('='.repeat(50) + '\n');

  try {
    await example1_basic();
    await example2_playwright();
    await example3_batch_healing();
    await example4_cost_optimization();

    console.log('\n' + '='.repeat(50));
    console.log('✅ 所有示例执行完成！\n');
  } catch (error) {
    console.error('\n❌ 示例执行失败:', error);
    process.exit(1);
  }
}

// 如果直接运行此文件
if (require.main === module) {
  runAllExamples();
}

export {
  example1_basic,
  example2_playwright,
  example3_batch_healing,
  example4_cost_optimization,
};


















