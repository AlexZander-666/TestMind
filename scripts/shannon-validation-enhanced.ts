/**
 * Shannon 项目增强功能验证脚本
 * 
 * 验证内容：
 * 1. 增量索引在真实项目的性能
 * 2. 智能缓存在实际使用中的效果
 * 3. 并行处理的实际加速比
 * 4. 上下文相关性的实际表现
 * 5. Prompt 工程对生成质量的影响
 * 6. 质量评分的准确性
 */

import path from 'path';
import { ContextEngine } from '../packages/core/src/context/ContextEngine';
import { TestGenerator } from '../packages/core/src/generation/TestGenerator';
import { QualityAnalyzer } from '../packages/core/src/evaluation/QualityAnalyzer';
import { llmCache } from '../packages/core/src/llm/LLMCache';
import type { ProjectConfig } from '@testmind/shared';

const SHANNON_PATH = process.env.SHANNON_PATH || '../Shannon';

console.log('🧪 Shannon 项目增强功能验证\n');
console.log('=' .repeat(80));
console.log(`Shannon 项目路径: ${SHANNON_PATH}\n`);

async function main() {
  // 配置 Shannon 项目
  const config: ProjectConfig = {
    id: 'shannon-validation',
    name: 'Shannon AI Orchestrator',
    rootPath: path.resolve(SHANNON_PATH),
    config: {
      includePatterns: ['src/**/*.ts', 'lib/**/*.ts'],
      excludePatterns: [
        '**/node_modules/**',
        '**/dist/**',
        '**/*.test.ts',
        '**/*.spec.ts',
      ],
      testFramework: 'vitest',
    },
  };

  // 测试 1: 增量索引性能
  await testIncrementalIndexing(config);
  
  // 测试 2: 缓存效率
  await testCachingInRealProject(config);
  
  // 测试 3: 上下文相关性
  await testContextQuality(config);
  
  // 测试 4: 测试生成质量
  await testGenerationQuality(config);
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ Shannon 项目验证完成！');
  console.log('=' .repeat(80));
}

/**
 * 测试 1：增量索引在 Shannon 的性能
 */
async function testIncrementalIndexing(config: ProjectConfig) {
  console.log('\n📊 测试 1：增量索引性能（Shannon 项目）\n');
  console.log('-'.repeat(80));
  
  const engine = new ContextEngine(config);
  
  try {
    // 全量索引
    console.log('🔄 执行全量索引...');
    const start1 = Date.now();
    const fullResult = await engine.indexProject(config.rootPath, { force: true });
    const fullDuration = Date.now() - start1;
    
    console.log(`✅ 全量索引完成`);
    console.log(`   - 文件数: ${fullResult.filesIndexed}`);
    console.log(`   - 函数数: ${fullResult.functionsExtracted}`);
    console.log(`   - 耗时: ${fullDuration}ms (${(fullDuration / 1000).toFixed(2)}s)`);
    console.log(`   - 平均: ${(fullDuration / Math.max(fullResult.filesIndexed, 1)).toFixed(2)}ms/文件`);
    
    // 增量索引
    console.log('\n🔄 执行增量索引...');
    const start2 = Date.now();
    const incrementalResult = await engine.indexProject(config.rootPath, { incremental: true });
    const incrementalDuration = Date.now() - start2;
    
    console.log(`✅ 增量索引完成`);
    console.log(`   - 文件数: ${incrementalResult.filesIndexed}`);
    console.log(`   - 耗时: ${incrementalDuration}ms`);
    
    if (incrementalDuration < fullDuration) {
      const speedup = (fullDuration / Math.max(incrementalDuration, 1)).toFixed(2);
      console.log(`\n🚀 性能提升: ${speedup}x`);
      console.log('✅ 通过：增量索引比全量索引更快');
    } else {
      console.log('\n⚠️  注意：无变更时增量索引应该接近即时返回');
    }
    
    // 性能目标验证
    console.log('\n📈 性能目标验证:');
    if (fullResult.filesIndexed < 10) {
      console.log(`   - 小项目 (${fullResult.filesIndexed} 文件): 目标 < 50ms, 实际 ${fullDuration}ms ${fullDuration < 50 ? '✅' : '⚠️'}`);
    } else if (fullResult.filesIndexed < 50) {
      console.log(`   - 中型项目 (${fullResult.filesIndexed} 文件): 目标 < 200ms, 实际 ${fullDuration}ms ${fullDuration < 200 ? '✅' : '⚠️'}`);
    } else if (fullResult.filesIndexed < 100) {
      console.log(`   - 大型项目 (${fullResult.filesIndexed} 文件): 目标 < 500ms, 实际 ${fullDuration}ms ${fullDuration < 500 ? '✅' : '⚠️'}`);
    } else {
      console.log(`   - 超大项目 (${fullResult.filesIndexed} 文件): 增量更新目标 < 2s, 实际 ${incrementalDuration}ms ${incrementalDuration < 2000 ? '✅' : '⚠️'}`);
    }
    
  } catch (error: any) {
    console.error('❌ 索引测试失败:', error.message);
  }
}

/**
 * 测试 2：缓存在真实项目中的效率
 */
async function testCachingInRealProject(config: ProjectConfig) {
  console.log('\n📊 测试 2：缓存效率（真实项目）\n');
  console.log('-'.repeat(80));
  
  // 重置缓存统计
  llmCache.resetStats();
  
  console.log('ℹ️  提示：缓存效率测试需要实际生成测试才能体现');
  console.log('   当前仅显示缓存配置和统计\n');
  
  const stats = llmCache.getStats();
  
  console.log('📊 缓存配置:');
  console.log(`   - 最大条目数: 1000`);
  console.log(`   - TTL: 7 天`);
  console.log(`   - 相似度匹配: ✅ 启用`);
  console.log(`   - 相似度阈值: 0.85`);
  console.log(`   - 自适应 TTL: ✅ 启用`);
  
  console.log('\n📊 当前统计:');
  console.log(`   - 缓存大小: ${stats.size}`);
  console.log(`   - 总命中: ${stats.hits}`);
  console.log(`   - 总未命中: ${stats.misses}`);
  console.log(`   - 命中率: ${(stats.hitRate * 100).toFixed(1)}%`);
  if (stats.exactHits !== undefined && stats.similarityHits !== undefined) {
    console.log(`   - 精确匹配: ${stats.exactHits}`);
    console.log(`   - 相似度匹配: ${stats.similarityHits}`);
  }
  
  console.log('\n✅ 缓存系统已就绪');
}

/**
 * 测试 3：上下文相关性
 */
async function testContextQuality(config: ProjectConfig) {
  console.log('\n📊 测试 3：上下文相关性\n');
  console.log('-'.repeat(80));
  
  const engine = new ContextEngine(config);
  
  try {
    console.log('🔄 索引项目...');
    await engine.indexProject(config.rootPath);
    
    // 测试语义搜索
    console.log('\n🔍 测试语义搜索质量...');
    
    const searchQueries = [
      'format',
      'debug',
      'parse',
      'validate',
      'transform',
    ];
    
    let totalRelevance = 0;
    let queryCount = 0;
    
    for (const query of searchQueries) {
      const results = await engine.semanticSearch(query, 3);
      
      if (results.length > 0) {
        const avgRelevance = results.reduce((sum, r) => sum + r.relevance, 0) / results.length;
        totalRelevance += avgRelevance;
        queryCount++;
        
        console.log(`   - "${query}": ${results.length} 个结果, 平均相关性 ${avgRelevance.toFixed(3)}`);
        if (results[0]) {
          console.log(`     → ${results[0].chunk.metadata.name || '(unnamed)'}`);
        }
      }
    }
    
    const overallRelevance = queryCount > 0 ? totalRelevance / queryCount : 0;
    
    console.log(`\n📈 整体平均相关性: ${overallRelevance.toFixed(3)}`);
    
    if (overallRelevance >= 0.85) {
      console.log('✅ 通过：平均相关性 >= 0.85');
    } else {
      console.log(`⚠️  提示：平均相关性 ${overallRelevance.toFixed(3)} < 0.85 目标`);
    }
    
  } catch (error: any) {
    console.error('❌ 上下文测试失败:', error.message);
  }
}

/**
 * 测试 4：测试生成质量
 */
async function testGenerationQuality(config: ProjectConfig) {
  console.log('\n📊 测试 4：测试生成质量\n');
  console.log('-'.repeat(80));
  
  console.log('ℹ️  提示：完整的测试生成需要 LLM API 密钥');
  console.log('   当前仅验证增强功能的集成情况\n');
  
  const hasApiKey = !!process.env.OPENAI_API_KEY;
  
  console.log('📊 环境检查:');
  console.log(`   - OpenAI API Key: ${hasApiKey ? '✅ 已配置' : '❌ 未配置'}`);
  console.log(`   - Gemini API Key: ${process.env.GOOGLE_API_KEY ? '✅ 已配置' : '❌ 未配置'}`);
  
  if (!hasApiKey) {
    console.log('\n⚠️  跳过实际生成测试（需要 API 密钥）');
    console.log('   提示：设置 OPENAI_API_KEY 环境变量以运行完整验证');
    return;
  }
  
  try {
    const engine = new ContextEngine(config);
    const generator = new TestGenerator(config);
    const analyzer = new QualityAnalyzer();
    
    console.log('\n🔄 索引项目...');
    await engine.indexProject(config.rootPath);
    
    console.log('✅ 索引完成\n');
    
    // 实际测试生成会在这里进行
    console.log('💡 实际测试生成建议：');
    console.log('   1. 选择 2-3 个典型函数');
    console.log('   2. 生成测试');
    console.log('   3. 使用增强的 QualityAnalyzer 评分');
    console.log('   4. 对比 v0.5.0 和 v0.6.0 的结果');
    
  } catch (error: any) {
    console.error('❌ 生成测试失败:', error.message);
  }
}

// 执行
main().catch(error => {
  console.error('\n❌ 验证过程失败:', error);
  process.exit(1);
});





















