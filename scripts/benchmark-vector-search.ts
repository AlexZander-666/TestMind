/**
 * 向量搜索性能基准测试
 * 
 * 测试场景：
 * 1. 小型项目（100 chunks）
 * 2. 中型项目（1,000 chunks）
 * 3. 大型项目（10,000 chunks）
 * 
 * 测试指标：
 * - 索引构建时间
 * - 搜索延迟（p50, p95, p99）
 * - 内存占用
 * - 磁盘占用
 * 
 * 对比：
 * - 内存版本（EnhancedVectorStore）
 * - 真实版本（RealLanceDBVectorStore）
 */

import { RealLanceDBVectorStore } from '../packages/core/src/db/VectorStore.real';
import { EnhancedVectorStore } from '../packages/core/src/db/VectorStore.enhanced';
import type { CodeChunk } from '../packages/shared/src/types';
import * as fs from 'fs/promises';

/**
 * 生成模拟的代码块
 */
function generateMockChunks(count: number): CodeChunk[] {
  const chunks: CodeChunk[] = [];
  
  for (let i = 0; i < count; i++) {
    const fileIndex = Math.floor(i / 10); // 每个文件 10 个函数
    
    chunks.push({
      id: `chunk-${i}`,
      filePath: `src/file-${fileIndex}.ts`,
      name: `function${i}`,
      content: `function function${i}(param: string): void {\n  // Function ${i} implementation\n  console.log('Hello from function ${i}');\n  return param.toUpperCase();\n}`,
      type: 'function',
      startLine: i * 5,
      endLine: i * 5 + 4,
      complexity: Math.floor(Math.random() * 10) + 1,
      loc: 4,
      dependencies: [],
      metadata: {
        async: false,
        exported: true,
      },
    } as CodeChunk);
  }
  
  return chunks;
}

/**
 * 生成随机向量（768 维，用于 Gemini embeddings）
 */
function generateRandomVector(dim = 768): number[] {
  const vector: number[] = [];
  for (let i = 0; i < dim; i++) {
    vector.push(Math.random() * 2 - 1); // [-1, 1]
  }
  
  // 归一化
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  return vector.map(v => v / norm);
}

/**
 * 为代码块添加模拟 embeddings
 */
function addMockEmbeddings(chunks: CodeChunk[]): void {
  chunks.forEach(chunk => {
    (chunk as any).embedding = generateRandomVector(768);
  });
}

/**
 * 测试索引构建时间
 */
async function benchmarkIndexing(
  storeName: string,
  store: RealLanceDBVectorStore | EnhancedVectorStore,
  chunks: CodeChunk[]
): Promise<number> {
  console.log(`\n[${storeName}] 测试索引构建...`);
  console.log(`  Chunks: ${chunks.length}`);
  
  const startTime = Date.now();
  
  await store.initialize();
  await store.insertChunks(chunks);
  
  const duration = Date.now() - startTime;
  console.log(`  ✓ 索引构建完成: ${duration}ms`);
  
  return duration;
}

/**
 * 测试搜索性能
 */
async function benchmarkSearch(
  storeName: string,
  store: RealLanceDBVectorStore | EnhancedVectorStore,
  iterations = 100
): Promise<{ p50: number; p95: number; p99: number; avg: number }> {
  console.log(`\n[${storeName}] 测试搜索性能...`);
  console.log(`  Iterations: ${iterations}`);
  
  const latencies: number[] = [];
  
  for (let i = 0; i < iterations; i++) {
    const queryVector = generateRandomVector(768);
    
    const startTime = Date.now();
    await store.search(queryVector, { k: 5 });
    const duration = Date.now() - startTime;
    
    latencies.push(duration);
  }
  
  // 排序计算百分位数
  latencies.sort((a, b) => a - b);
  
  const p50 = latencies[Math.floor(latencies.length * 0.5)];
  const p95 = latencies[Math.floor(latencies.length * 0.95)];
  const p99 = latencies[Math.floor(latencies.length * 0.99)];
  const avg = latencies.reduce((sum, v) => sum + v, 0) / latencies.length;
  
  console.log(`  ✓ 搜索性能:`);
  console.log(`    P50: ${p50}ms`);
  console.log(`    P95: ${p95}ms`);
  console.log(`    P99: ${p99}ms`);
  console.log(`    Avg: ${avg.toFixed(2)}ms`);
  
  return { p50, p95, p99, avg };
}

/**
 * 测试存储占用
 */
async function benchmarkStorage(
  storeName: string,
  dbPath: string
): Promise<number> {
  console.log(`\n[${storeName}] 测试存储占用...`);
  
  try {
    const stats = await fs.stat(dbPath);
    const sizeKB = stats.size / 1024;
    const sizeMB = sizeKB / 1024;
    
    console.log(`  ✓ 磁盘占用: ${sizeMB.toFixed(2)} MB`);
    
    return stats.size;
  } catch (error) {
    console.log(`  ⚠ 无法获取存储大小`);
    return 0;
  }
}

/**
 * 运行完整基准测试
 */
async function runBenchmark(
  scenario: { name: string; chunkCount: number; searchIterations: number }
): Promise<void> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`测试场景: ${scenario.name} (${scenario.chunkCount} chunks)`);
  console.log(`${'='.repeat(60)}`);
  
  // 生成模拟数据
  console.log('\n准备测试数据...');
  const chunks = generateMockChunks(scenario.chunkCount);
  addMockEmbeddings(chunks);
  console.log(`✓ 生成了 ${chunks.length} 个代码块（含 embeddings）`);
  
  // 测试 1: 内存版本（EnhancedVectorStore）
  const memoryStore = new EnhancedVectorStore('.testmind/benchmark/memory');
  const memoryIndexTime = await benchmarkIndexing('EnhancedVectorStore', memoryStore, chunks);
  const memorySearchPerf = await benchmarkSearch('EnhancedVectorStore', memoryStore, scenario.searchIterations);
  
  // 测试 2: 真实版本（RealLanceDBVectorStore）
  const realStore = new RealLanceDBVectorStore('.testmind/benchmark/lancedb');
  const realIndexTime = await benchmarkIndexing('RealLanceDBVectorStore', realStore, chunks);
  const realSearchPerf = await benchmarkSearch('RealLanceDBVectorStore', realStore, scenario.searchIterations);
  const realStorage = await benchmarkStorage('RealLanceDBVectorStore', '.testmind/benchmark/lancedb');
  
  // 汇总对比
  console.log(`\n${'='.repeat(60)}`);
  console.log('性能对比汇总');
  console.log(`${'='.repeat(60)}`);
  
  console.log('\n索引构建时间:');
  console.log(`  EnhancedVectorStore: ${memoryIndexTime}ms`);
  console.log(`  RealLanceDBVectorStore: ${realIndexTime}ms`);
  console.log(`  提升: ${((memoryIndexTime / realIndexTime) * 100 - 100).toFixed(1)}%`);
  
  console.log('\n搜索延迟（P50）:');
  console.log(`  EnhancedVectorStore: ${memorySearchPerf.p50}ms`);
  console.log(`  RealLanceDBVectorStore: ${realSearchPerf.p50}ms`);
  console.log(`  提升: ${((memorySearchPerf.p50 / realSearchPerf.p50) * 100 - 100).toFixed(1)}%`);
  
  console.log('\n搜索延迟（P95）:');
  console.log(`  EnhancedVectorStore: ${memorySearchPerf.p95}ms`);
  console.log(`  RealLanceDBVectorStore: ${realSearchPerf.p95}ms`);
  console.log(`  提升: ${((memorySearchPerf.p95 / realSearchPerf.p95) * 100 - 100).toFixed(1)}%`);
  
  // 清理
  await memoryStore.close();
  await realStore.close();
}

/**
 * 主函数
 */
async function main() {
  console.log('TestMind 向量搜索性能基准测试');
  console.log('对比 EnhancedVectorStore (内存) vs RealLanceDBVectorStore (LanceDB)');
  
  try {
    // 场景 1: 小型项目
    await runBenchmark({
      name: '小型项目',
      chunkCount: 100,
      searchIterations: 50,
    });
    
    // 场景 2: 中型项目
    await runBenchmark({
      name: '中型项目',
      chunkCount: 1000,
      searchIterations: 100,
    });
    
    // 场景 3: 大型项目（可选，耗时较长）
    if (process.env.FULL_BENCHMARK === 'true') {
      await runBenchmark({
        name: '大型项目',
        chunkCount: 10000,
        searchIterations: 100,
      });
    }
    
    console.log(`\n${'='.repeat(60)}`);
    console.log('✅ 基准测试完成！');
    console.log(`${'='.repeat(60)}`);
    
    console.log('\n提示：');
    console.log('- 运行完整基准测试（包含 10K chunks）：FULL_BENCHMARK=true tsx scripts/benchmark-vector-search.ts');
    console.log('- 清理测试数据：rm -rf .testmind/benchmark');
    
  } catch (error: any) {
    console.error('\n❌ 基准测试失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// 运行
main();


