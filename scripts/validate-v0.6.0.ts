/**
 * TestMind v0.6.0 功能验证脚本
 * 
 * 验证所有新功能是否正常工作
 */

import { EnhancedVectorStore } from '../packages/core/src/db/VectorStore.enhanced';
import { EmbeddingGenerator } from '../packages/core/src/context/EmbeddingGenerator';
import { HybridSearchEngine } from '../packages/core/src/context/HybridSearchEngine';
import { EnhancedFailureClassifier } from '../packages/core/src/self-healing/FailureClassifier.enhanced';
import { CostOptimizer, CostTracker } from '../packages/core/src/generation/CostOptimizer';
import { CoverageAnalyzer } from '../packages/core/src/ci-cd/CoverageAnalyzer';
import { PerformanceMonitor } from '../packages/core/src/ci-cd/PerformanceMonitor';
import { BrowserAdapterRegistry, createBrowserAdapter } from '../packages/core/src/self-healing/adapters';

async function main() {
  console.log('🧪 TestMind v0.6.0 功能验证\n');
  
  const results = {
    passed: 0,
    failed: 0,
    skipped: 0,
  };

  // ==================== 测试 1: 浏览器适配器 ====================
  console.log('1️⃣  测试浏览器适配器注册...');
  try {
    const adapters = BrowserAdapterRegistry.list();
    console.log(`   ✅ 已注册 ${adapters.length} 个适配器: ${adapters.join(', ')}`);
    
    if (adapters.includes('playwright') && adapters.includes('cypress')) {
      results.passed++;
    } else {
      throw new Error('Missing expected adapters');
    }
  } catch (error) {
    console.error(`   ❌ 失败: ${error}`);
    results.failed++;
  }

  // ==================== 测试 2: 向量存储 ====================
  console.log('\n2️⃣  测试向量存储初始化...');
  try {
    const vectorStore = new EnhancedVectorStore('.testmind/test-vectors');
    await vectorStore.initialize();
    
    const stats = await vectorStore.getStats();
    console.log(`   ✅ 向量存储已初始化`);
    console.log(`      - Total Chunks: ${stats.totalChunks}`);
    console.log(`      - DB Size: ${stats.dbSizeMB} MB`);
    
    await vectorStore.close();
    results.passed++;
  } catch (error) {
    console.error(`   ❌ 失败: ${error}`);
    results.failed++;
  }

  // ==================== 测试 3: Embedding 生成器 ====================
  console.log('\n3️⃣  测试 Embedding 生成器...');
  
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    console.log('   ⏭️  跳过: 未配置 OPENAI_API_KEY');
    results.skipped++;
  } else {
    try {
      const generator = new EmbeddingGenerator({
        apiKey,
        model: 'text-embedding-3-small',
        batchSize: 10,
      });

      // 估算成本
      const mockChunks = [
        {
          id: 'test-1',
          filePath: 'test.ts',
          name: 'testFunction',
          content: 'function testFunction() { return 42; }',
          type: 'function' as any,
        },
      ];

      const estimate = generator.estimateCost(mockChunks);
      console.log(`   ✅ 成本估算完成`);
      console.log(`      - Estimated Tokens: ${estimate.estimatedTokens}`);
      console.log(`      - Estimated Cost: $${estimate.estimatedCost.toFixed(6)}`);
      console.log(`      - Estimated Duration: ${estimate.estimatedDuration}s`);
      
      results.passed++;
    } catch (error) {
      console.error(`   ❌ 失败: ${error}`);
      results.failed++;
    }
  }

  // ==================== 测试 4: 失败分类器 ====================
  console.log('\n4️⃣  测试失败分类器...');
  try {
    const classifier = new EnhancedFailureClassifier();

    // 测试环境问题分类
    const envFailure = {
      testName: 'test 1',
      testFile: 'test.ts',
      error: 'Error: ECONNREFUSED connect ECONNREFUSED 127.0.0.1:3000',
      timestamp: new Date(),
    };

    const envResult = await classifier.classify(envFailure);
    console.log(`   ✅ 环境问题分类: ${envResult.failureType} (置信度: ${(envResult.confidence * 100).toFixed(0)}%)`);

    // 测试脆弱性分类
    const fragilityFailure = {
      testName: 'test 2',
      testFile: 'test.ts',
      error: 'Element not found: .some-class',
      selector: '.some-class',
      timestamp: new Date(),
    };

    const fragilityResult = await classifier.classify(fragilityFailure);
    console.log(`   ✅ 测试脆弱性分类: ${fragilityResult.failureType} (置信度: ${(fragilityResult.confidence * 100).toFixed(0)}%)`);

    // 测试真实 Bug 分类
    const bugFailure = {
      testName: 'test 3',
      testFile: 'test.ts',
      error: 'AssertionError: expected 10 to equal 9',
      expectedValue: 10,
      actualValue: 9,
      timestamp: new Date(),
    };

    const bugResult = await classifier.classify(bugFailure);
    console.log(`   ✅ 真实 Bug 分类: ${bugResult.failureType} (置信度: ${(bugResult.confidence * 100).toFixed(0)}%)`);

    results.passed++;
  } catch (error) {
    console.error(`   ❌ 失败: ${error}`);
    results.failed++;
  }

  // ==================== 测试 5: 成本优化器 ====================
  console.log('\n5️⃣  测试成本优化器...');
  try {
    const optimizer = new CostOptimizer();

    // 简单函数
    const simpleContext = {
      functionCode: 'function add(a, b) { return a + b; }',
      functionName: 'add',
      complexity: 1,
      filePath: 'utils.ts',
    };
    const simpleModel = optimizer.selectModel(simpleContext);
    console.log(`   ✅ 简单函数 → ${simpleModel.model} (成本: $${simpleModel.estimatedCost.toFixed(6)})`);

    // 复杂函数
    const complexContext = {
      functionCode: 'function complex() { /* ... */ }',
      functionName: 'complex',
      complexity: 15,
      filePath: 'logic.ts',
      dependencies: ['dep1', 'dep2', 'dep3', 'dep4', 'dep5', 'dep6'],
    };
    const complexModel = optimizer.selectModel(complexContext);
    console.log(`   ✅ 复杂函数 → ${complexModel.model} (成本: $${complexModel.estimatedCost.toFixed(6)})`);

    // 成本追踪
    const tracker = new CostTracker();
    tracker.track({
      model: 'gpt-4o-mini',
      inputTokens: 1000,
      outputTokens: 500,
      operation: 'test_generation',
    });

    const trackerStats = tracker.getStats();
    console.log(`   ✅ 成本追踪: 总成本 $${trackerStats.totalCost.toFixed(6)}`);

    results.passed++;
  } catch (error) {
    console.error(`   ❌ 失败: ${error}`);
    results.failed++;
  }

  // ==================== 测试 6: 性能监控器 ====================
  console.log('\n6️⃣  测试性能监控器...');
  try {
    const monitor = new PerformanceMonitor({
      regressionThreshold: 1.2,
      criticalThreshold: 2.0,
    });

    // 模拟测试数据
    const mockBaseline = {
      timestamp: new Date().toISOString(),
      totalDuration: 5000,
      tests: [
        { name: 'test1', file: 'test1.ts', duration: 100, passed: true },
        { name: 'test2', file: 'test2.ts', duration: 200, passed: true },
      ],
    };

    const mockCurrent = {
      timestamp: new Date().toISOString(),
      totalDuration: 6500,
      tests: [
        { name: 'test1', file: 'test1.ts', duration: 250, passed: true }, // 2.5x slower
        { name: 'test2', file: 'test2.ts', duration: 190, passed: true }, // slight improvement
      ],
    };

    // 写入临时文件
    await import('fs/promises').then(fs => Promise.all([
      fs.writeFile('.testmind/temp-baseline.json', JSON.stringify(mockBaseline)),
      fs.writeFile('.testmind/temp-current.json', JSON.stringify(mockCurrent)),
    ]));

    const perfResult = await monitor.detectRegression(
      '.testmind/temp-current.json',
      '.testmind/temp-baseline.json'
    );

    console.log(`   ✅ 性能监控完成`);
    console.log(`      - Regressions: ${perfResult.stats.regressedTests}`);
    console.log(`      - Improvements: ${perfResult.stats.improvedTests}`);
    console.log(`      - Critical: ${perfResult.stats.criticalRegressions}`);

    results.passed++;
  } catch (error) {
    console.error(`   ❌ 失败: ${error}`);
    results.failed++;
  }

  // ==================== 测试 7: 覆盖率分析器 ====================
  console.log('\n7️⃣  测试覆盖率分析器...');
  try {
    const analyzer = new CoverageAnalyzer();

    // 模拟覆盖率数据
    const mockCoverage = {
      total: {
        lines: { pct: 85.5 },
        statements: { pct: 84.2 },
        functions: { pct: 78.3 },
        branches: { pct: 70.1 },
      },
      files: {
        'src/utils.ts': {
          path: 'src/utils.ts',
          lines: { pct: 60, covered: 30, total: 50 },
          functions: { pct: 50, covered: 5, total: 10 },
          statements: { pct: 58, covered: 29, total: 50 },
          branches: { pct: 40, covered: 4, total: 10 },
          uncoveredFunctions: [
            {
              name: 'uncoveredFunc',
              filePath: 'src/utils.ts',
              line: 42,
              complexity: 8,
              isPublic: true,
            },
          ],
        },
      },
    };

    await import('fs/promises').then(fs =>
      fs.writeFile('.testmind/temp-coverage.json', JSON.stringify(mockCoverage))
    );

    const coverageResult = await analyzer.analyzeCoverageGaps('.testmind/temp-coverage.json');

    console.log(`   ✅ 覆盖率分析完成`);
    console.log(`      - Overall Coverage: ${coverageResult.overallCoverage.toFixed(1)}%`);
    console.log(`      - Uncovered Functions: ${coverageResult.totalUncovered}`);
    console.log(`      - High Priority: ${coverageResult.highPriority.length}`);

    results.passed++;
  } catch (error) {
    console.error(`   ❌ 失败: ${error}`);
    results.failed++;
  }

  // ==================== 汇总结果 ====================
  console.log('\n' + '='.repeat(50));
  console.log('📊 验证结果汇总\n');
  console.log(`✅ 通过: ${results.passed}`);
  console.log(`❌ 失败: ${results.failed}`);
  console.log(`⏭️  跳过: ${results.skipped}`);
  console.log(`总计: ${results.passed + results.failed + results.skipped}`);
  
  const successRate = (results.passed / (results.passed + results.failed) * 100).toFixed(1);
  console.log(`\n成功率: ${successRate}%`);

  if (results.failed === 0) {
    console.log('\n🎉 所有功能验证通过！v0.6.0 已就绪。\n');
    process.exit(0);
  } else {
    console.log('\n⚠️  部分功能验证失败，请检查错误日志。\n');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('\n💥 验证脚本执行失败:', error);
  process.exit(1);
});














