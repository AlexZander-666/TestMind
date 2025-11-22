/**
 * Vector Search & Hybrid Search 使用示例
 * 
 * 演示如何使用向量数据库和混合搜索
 */

import { EnhancedVectorStore } from '@testmind/core';
import { EmbeddingGenerator } from '@testmind/core';
import { HybridSearchEngine } from '@testmind/core';
import { DependencyGraphBuilder } from '@testmind/core';
import type { CodeChunk } from '@testmind/shared';

/**
 * 示例 1: 向量存储基础使用
 */
async function example1_vectorStore() {
  console.log('=== 示例 1: 向量存储 ===\n');

  // 1. 初始化向量存储
  const vectorStore = new EnhancedVectorStore('.testmind/examples/vectors');
  await vectorStore.initialize();

  // 2. 准备代码块
  const chunks: CodeChunk[] = [
    {
      id: 'chunk-1',
      filePath: 'src/utils/math.ts',
      name: 'add',
      content: 'function add(a: number, b: number): number { return a + b; }',
      type: 'function',
      complexity: 1,
      loc: 1,
      embedding: new Array(1536).fill(0.1), // 模拟向量
    },
    {
      id: 'chunk-2',
      filePath: 'src/utils/string.ts',
      name: 'capitalize',
      content: 'function capitalize(str: string): string { return str.charAt(0).toUpperCase() + str.slice(1); }',
      type: 'function',
      complexity: 2,
      loc: 1,
      embedding: new Array(1536).fill(0.2),
    },
  ];

  // 3. 插入代码块
  await vectorStore.insertChunks(chunks);

  // 4. 搜索相似代码
  const queryEmbedding = new Array(1536).fill(0.15); // 模拟查询向量
  
  const results = await vectorStore.search(queryEmbedding, {
    k: 5,
    filter: {
      chunkType: 'function',
      minComplexity: 1,
    },
  });

  console.log(`找到 ${results.length} 个相似代码:`);
  results.forEach((result, i) => {
    console.log(`  ${i + 1}. ${result.chunk.name} (${result.chunk.filePath})`);
    console.log(`     相似度: ${result.score.toFixed(3)}`);
  });

  // 5. 获取统计
  const stats = await vectorStore.getStats();
  console.log('\n数据库统计:');
  console.log(`  - Total Chunks: ${stats.totalChunks}`);
  console.log(`  - Total Files: ${stats.totalFiles}`);
  console.log(`  - DB Size: ${stats.dbSizeMB} MB`);

  // 清理
  await vectorStore.close();
}

/**
 * 示例 2: Embedding 生成
 */
async function example2_embeddingGeneration() {
  console.log('\n=== 示例 2: Embedding 生成 ===\n');

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.log('⏭️  跳过: 未配置 OPENAI_API_KEY');
    return;
  }

  // 1. 创建生成器
  const generator = new EmbeddingGenerator({
    apiKey,
    model: 'text-embedding-3-small',
    batchSize: 10,
    maxRetries: 3,
  });

  // 2. 准备代码块
  const chunks: CodeChunk[] = [
    {
      id: 'chunk-1',
      filePath: 'src/auth/login.ts',
      name: 'authenticateUser',
      content: 'async function authenticateUser(username: string, password: string) { /* ... */ }',
      type: 'function',
      parameters: ['username: string', 'password: string'],
    },
  ];

  // 3. 估算成本
  const estimate = generator.estimateCost(chunks);
  console.log('成本估算:');
  console.log(`  - Estimated Tokens: ${estimate.estimatedTokens.toLocaleString()}`);
  console.log(`  - Estimated Cost: $${estimate.estimatedCost.toFixed(6)}`);
  console.log(`  - Estimated Duration: ${estimate.estimatedDuration}s`);

  // 4. 生成 Embeddings（带进度回调）
  console.log('\n开始生成...');
  
  const result = await generator.generateEmbeddings(chunks, (progress) => {
    console.log(`  进度: ${progress.percentage.toFixed(1)}% (${progress.current}/${progress.total})`);
  });

  console.log('\n生成完成:');
  console.log(`  - Success: ${result.successCount}/${chunks.length}`);
  console.log(`  - Failed: ${result.failedCount}`);
  console.log(`  - Tokens Used: ${result.totalTokens.toLocaleString()}`);
  console.log(`  - Actual Cost: $${result.estimatedCost.toFixed(6)}`);
  console.log(`  - Duration: ${(result.duration / 1000).toFixed(2)}s`);

  // 5. 查看总统计
  const totalStats = generator.getTotalStats();
  console.log('\n总使用统计:');
  console.log(`  - Total Tokens: ${totalStats.totalTokensUsed.toLocaleString()}`);
  console.log(`  - Total Cost: $${totalStats.totalCost.toFixed(6)}`);
}

/**
 * 示例 3: 混合搜索
 */
async function example3_hybridSearch() {
  console.log('\n=== 示例 3: 混合搜索 ===\n');

  // 1. 创建依赖（模拟）
  const vectorStore = new EnhancedVectorStore('.testmind/examples/vectors');
  await vectorStore.initialize();

  const dependencyGraph = new DependencyGraphBuilder({
    rootDir: process.cwd(),
    exclude: ['node_modules', 'dist'],
  });

  // 2. 创建混合搜索引擎
  const hybridSearch = new HybridSearchEngine(vectorStore, dependencyGraph);

  // 3. 构建关键词索引
  const mockChunks: CodeChunk[] = [
    {
      id: 'chunk-1',
      filePath: 'src/auth/login.ts',
      name: 'authenticateUser',
      content: 'async function authenticateUser(username, password) { /* validate credentials */ }',
      type: 'function',
    },
    {
      id: 'chunk-2',
      filePath: 'src/auth/validate.ts',
      name: 'validatePassword',
      content: 'function validatePassword(password) { /* check password strength */ }',
      type: 'function',
    },
  ];

  await hybridSearch.buildKeywordIndex(mockChunks);

  // 4. 执行混合搜索
  const query = {
    text: 'authentication login user',
    embedding: new Array(1536).fill(0.1), // 模拟向量
    filePath: 'src/auth/login.ts',
    topK: 5,
    weights: {
      vector: 0.5,
      keyword: 0.3,
      dependency: 0.2,
    },
  };

  const results = await hybridSearch.search(query);

  console.log(`找到 ${results.length} 个相关代码:`);
  results.forEach((result, i) => {
    console.log(`  ${i + 1}. ${result.chunk.name} (${result.chunk.filePath})`);
    console.log(`     总分: ${result.score.toFixed(4)}`);
    console.log(`     匹配策略: ${result.matchedBy.join(', ')}`);
    
    if (result.scores.vector) {
      console.log(`     向量分数: ${result.scores.vector.toFixed(4)}`);
    }
    if (result.scores.keyword) {
      console.log(`     关键词分数: ${result.scores.keyword.toFixed(4)}`);
    }
  });

  // 5. 查看搜索统计
  const stats = hybridSearch.getStats();
  console.log('\n搜索统计:');
  console.log(`  - Total Searches: ${stats.totalSearches}`);
  console.log(`  - Avg Response Time: ${stats.avgResponseTime.toFixed(0)}ms`);
  console.log(`  - Vector Hits: ${stats.strategyHits.vector}`);
  console.log(`  - Keyword Hits: ${stats.strategyHits.keyword}`);
  console.log(`  - Dependency Hits: ${stats.strategyHits.dependency}`);

  // 6. 生成搜索解释
  const explanation = hybridSearch.explainSearch(results);
  console.log('\n搜索解释:');
  console.log(explanation.split('\n').slice(0, 15).join('\n'));
  console.log('  ...');

  // 清理
  await vectorStore.close();
}

/**
 * 主函数
 */
async function main() {
  console.log('🔍 Vector Search & Hybrid Search 示例\n');
  console.log('='.repeat(50) + '\n');

  try {
    await example1_vectorStore();
    await example2_embeddingGeneration();
    await example3_hybridSearch();

    console.log('\n' + '='.repeat(50));
    console.log('✅ 所有示例执行完成！\n');
  } catch (error) {
    console.error('\n❌ 示例执行失败:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export {
  example1_vectorStore,
  example2_embeddingGeneration,
  example3_hybridSearch,
};














