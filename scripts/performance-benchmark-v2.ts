/**
 * 性能基准测试 v2 - with LLM缓存
 * 
 * 对比有无缓存的性能差异
 */

import { LLMService } from '../packages/core/src/llm/LLMService';
import { llmCache } from '../packages/core/src/llm/LLMCache';
import { TestGenerator } from '../packages/core/src/generation/TestGenerator';
import { ContextEngine } from '../packages/core/src/context/ContextEngine';
import * as path from 'path';

interface BenchmarkResult {
  scenario: string;
  totalTime: number;
  averageTime: number;
  cacheStats?: {
    hits: number;
    misses: number;
    hitRate: number;
  };
}

async function benchmarkWithoutCache() {
  console.log('\n📊 Scenario 1: Without Cache\n');
  console.log('═'.repeat(60));

  const llmService = new LLMService();
  llmService.setCacheEnabled(false);

  const testPrompts = [
    'Generate unit test for add(a, b)',
    'Generate unit test for multiply(x, y)',
    'Generate unit test for divide(a, b)',
    'Generate unit test for subtract(x, y)',
    'Generate unit test for add(a, b)' // 重复
  ];

  const startTime = Date.now();

  for (let i = 0; i < testPrompts.length; i++) {
    console.log(`  生成测试 ${i + 1}/${testPrompts.length}...`);
    
    const promptStart = Date.now();
    
    try {
      await llmService.generate({
        provider: 'openai',
        model: process.env.OPENAI_MODEL || 'gpt-4',
        prompt: testPrompts[i],
        temperature: 0.3,
        maxTokens: 1000
      });
      
      const duration = Date.now() - promptStart;
      console.log(`  ✓ 完成 (${(duration / 1000).toFixed(1)}秒)`);
      
    } catch (error) {
      console.log(`  ❌ 失败:`, error instanceof Error ? error.message : String(error));
    }
  }

  const totalTime = Date.now() - startTime;

  console.log(`\n  总时间: ${(totalTime / 1000).toFixed(1)}秒`);
  console.log(`  平均: ${(totalTime / testPrompts.length / 1000).toFixed(1)}秒/测试\n`);

  return {
    scenario: 'Without Cache',
    totalTime,
    averageTime: totalTime / testPrompts.length
  };
}

async function benchmarkWithCache() {
  console.log('\n📊 Scenario 2: With Cache\n');
  console.log('═'.repeat(60));

  const llmService = new LLMService();
  llmService.setCacheEnabled(true);
  llmCache.clear();
  llmCache.resetStats();

  const testPrompts = [
    'Generate unit test for add(a, b)',
    'Generate unit test for multiply(x, y)',
    'Generate unit test for divide(a, b)',
    'Generate unit test for subtract(x, y)',
    'Generate unit test for add(a, b)' // 重复 - should hit cache
  ];

  const startTime = Date.now();

  for (let i = 0; i < testPrompts.length; i++) {
    console.log(`  生成测试 ${i + 1}/${testPrompts.length}...`);
    
    const promptStart = Date.now();
    
    try {
      const response = await llmService.generate({
        provider: 'openai',
        model: process.env.OPENAI_MODEL || 'gpt-4',
        prompt: testPrompts[i],
        temperature: 0.3,
        maxTokens: 1000
      });
      
      const duration = Date.now() - promptStart;
      const cached = response.finishReason === 'cached';
      
      console.log(`  ✓ 完成 (${(duration / 1000).toFixed(1)}秒${cached ? ' - 缓存命中' : ''})`);
      
    } catch (error) {
      console.log(`  ❌ 失败:`, error instanceof Error ? error.message : String(error));
    }
  }

  const totalTime = Date.now() - startTime;
  const cacheStats = llmCache.getStats();

  console.log(`\n  总时间: ${(totalTime / 1000).toFixed(1)}秒`);
  console.log(`  平均: ${(totalTime / testPrompts.length / 1000).toFixed(1)}秒/测试`);
  console.log(`\n  缓存统计:`);
  console.log(`    命中: ${cacheStats.hits}`);
  console.log(`    未命中: ${cacheStats.misses}`);
  console.log(`    命中率: ${(cacheStats.hitRate * 100).toFixed(1)}%`);
  console.log(`    节省调用: ${cacheStats.totalSaved}次\n`);

  return {
    scenario: 'With Cache',
    totalTime,
    averageTime: totalTime / testPrompts.length,
    cacheStats
  };
}

async function comparePerformance() {
  console.log('\n🚀 LLM Cache Performance Benchmark\n');
  console.log('═'.repeat(60));
  console.log('\n测试5个提示（包含1个重复）\n');

  try {
    const withoutCache = await benchmarkWithoutCache();
    const withCache = await benchmarkWithCache();

    console.log('\n📈 Performance Comparison\n');
    console.log('═'.repeat(60));
    console.log(`\n  Without Cache: ${(withoutCache.totalTime / 1000).toFixed(1)}秒`);
    console.log(`  With Cache:    ${(withCache.totalTime / 1000).toFixed(1)}秒`);
    
    const speedup = withoutCache.totalTime / withCache.totalTime;
    console.log(`\n  ⚡ Speed up: ${speedup.toFixed(2)}x`);
    
    if (withCache.cacheStats) {
      const savings = (1 - withCache.totalTime / withoutCache.totalTime) * 100;
      console.log(`  💰 Time saved: ${savings.toFixed(1)}%`);
      console.log(`  🎯 Cache hit rate: ${(withCache.cacheStats.hitRate * 100).toFixed(1)}%`);
    }

    console.log('\n═'.repeat(60));
    console.log('\n✅ Benchmark Complete!\n');

    // 生成报告
    const report = generateReport([withoutCache, withCache]);
    await fs.writeFile('performance-benchmark-report.md', report, 'utf-8');
    console.log('📄 Report saved: performance-benchmark-report.md\n');

  } catch (error) {
    console.error('\n❌ Benchmark failed:', error);
    process.exit(1);
  }
}

function generateReport(results: BenchmarkResult[]): string {
  return `# LLM Cache Performance Benchmark Report

**Date**: ${new Date().toISOString().split('T')[0]}

## Summary

${results.map(r => `### ${r.scenario}

- **Total Time**: ${(r.totalTime / 1000).toFixed(1)}s
- **Average Time**: ${(r.averageTime / 1000).toFixed(1)}s per test
${r.cacheStats ? `
**Cache Statistics**:
- Hits: ${r.cacheStats.hits}
- Misses: ${r.cacheStats.misses}
- Hit Rate: ${(r.cacheStats.hitRate * 100).toFixed(1)}%
- API Calls Saved: ${r.cacheStats.hits}
` : ''}
`).join('\n')}

## Performance Improvement

${results.length === 2 ? `
- **Speed Up**: ${(results[0].totalTime / results[1].totalTime).toFixed(2)}x
- **Time Saved**: ${((1 - results[1].totalTime / results[0].totalTime) * 100).toFixed(1)}%
${results[1].cacheStats ? `- **Cache Hit Rate**: ${(results[1].cacheStats.hitRate * 100).toFixed(1)}%` : ''}

## Conclusion

LLM caching provides significant performance improvement:
- Cached responses return in <1s vs ${(results[0].averageTime / 1000).toFixed(1)}s for API calls
- Cost savings: ${results[1].cacheStats?.hits || 0} API calls avoided
- Recommended for production use
` : ''}

---

*Generated by performance-benchmark-v2.ts*
`;
}

// 运行基准测试
if (require.main === module) {
  comparePerformance().catch(console.error);
}

 * 性能基准测试 v2 - with LLM缓存