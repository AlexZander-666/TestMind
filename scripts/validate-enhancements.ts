/**
 * 验证技术提升效果脚本
 * 
 * 测试内容：
 * 1. 增量索引性能
 * 2. 缓存效率
 * 3. 并行处理性能
 * 4. 上下文相关性
 * 5. Prompt 质量
 * 6. 质量评分准确性
 */

import { ContextEngine } from '../packages/core/src/context/ContextEngine';
import { ParallelProcessor } from '../packages/core/src/utils/ParallelProcessor';
import { LLMCache } from '../packages/core/src/llm/LLMCache';
import { SemanticIndexer } from '../packages/core/src/context/SemanticIndexer';
import { QualityAnalyzer } from '../packages/core/src/evaluation/QualityAnalyzer';
import { PromptBuilder } from '../packages/core/src/generation/PromptBuilder';
import type { ProjectConfig } from '../packages/core/src';

console.log('🧪 TestMind 技术提升验证\n');
console.log('=' .repeat(80));

async function main() {
  // 1. 测试增量索引
  await testIncrementalIndexing();
  
  // 2. 测试缓存效率
  await testCacheEfficiency();
  
  // 3. 测试并行处理
  await testParallelProcessing();
  
  // 4. 测试语义搜索
  await testSemanticSearch();
  
  // 5. 测试 Prompt 工程
  await testPromptEngineering();
  
  // 6. 测试质量评分
  await testQualityScoring();
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ 所有验证测试完成！');
}

/**
 * 测试 1：增量索引性能
 */
async function testIncrementalIndexing() {
  console.log('\n📊 测试 1：增量索引性能\n');
  console.log('-'.repeat(80));
  
  const config: ProjectConfig = {
    id: 'test',
    name: 'Test',
    rootPath: process.cwd(),
    config: {
      includePatterns: ['packages/**/*.ts'],
      excludePatterns: ['**/node_modules/**', '**/dist/**', '**/*.test.ts'],
      testFramework: 'vitest',
    },
  };
  
  const engine = new ContextEngine(config);
  
  // 全量索引
  console.log('🔄 执行全量索引...');
  const start1 = Date.now();
  const fullResult = await engine.indexProject(process.cwd(), { force: true });
  const fullDuration = Date.now() - start1;
  
  console.log(`✅ 全量索引完成`);
  console.log(`   - 文件数: ${fullResult.filesIndexed}`);
  console.log(`   - 函数数: ${fullResult.functionsExtracted}`);
  console.log(`   - 耗时: ${fullDuration}ms`);
  
  // 增量索引（无变更）
  console.log('\n🔄 执行增量索引（无变更）...');
  const start2 = Date.now();
  const incrementalResult = await engine.indexProject(process.cwd(), { incremental: true });
  const incrementalDuration = Date.now() - start2;
  
  console.log(`✅ 增量索引完成`);
  console.log(`   - 文件数: ${incrementalResult.filesIndexed}`);
  console.log(`   - 耗时: ${incrementalDuration}ms`);
  
  const speedup = (fullDuration / Math.max(incrementalDuration, 1)).toFixed(2);
  console.log(`\n🚀 性能提升: ${speedup}x`);
  
  if (parseFloat(speedup) >= 2) {
    console.log('✅ 通过：增量索引性能提升 >= 2x');
  } else {
    console.log('⚠️  警告：增量索引性能提升 < 2x');
  }
}

/**
 * 测试 2：缓存效率
 */
async function testCacheEfficiency() {
  console.log('\n📊 测试 2：缓存效率\n');
  console.log('-'.repeat(80));
  
  const cache = new LLMCache({
    maxSize: 100,
    enableSimilarityMatch: true,
    similarityThreshold: 0.85,
    enableAdaptiveTTL: true,
  });
  
  // 模拟一系列请求
  const prompts = [
    'Generate test for getUserName function',
    'Generate test for getUserData function',  // 相似
    'Generate test for getUserProfile function', // 相似
    'Generate test for login function',
    'Generate test for logout function',        // 相似
    'Generate test for signin function',        // 相似（与 login）
  ];
  
  // 第一轮：填充缓存
  console.log('🔄 第一轮请求（填充缓存）...');
  prompts.forEach((prompt, i) => {
    cache.set(prompt, `response-${i}`, 'openai', 'gpt-4');
  });
  
  // 第二轮：测试命中率
  console.log('🔄 第二轮请求（测试缓存）...');
  cache.resetStats();
  
  const testPrompts = [
    'Generate test for getUserName function',     // 精确匹配
    'Generate test for getUserEmail function',    // 相似度匹配
    'Generate test for authenticateUser function', // 相似度匹配（login 同义词）
    'Write documentation for API',                 // 不匹配
  ];
  
  testPrompts.forEach(prompt => {
    cache.get(prompt, 'openai', 'gpt-4');
  });
  
  const stats = cache.getStats();
  
  console.log(`\n📊 缓存统计:`);
  console.log(`   - 总请求: ${stats.hits + stats.misses}`);
  console.log(`   - 命中: ${stats.hits}`);
  console.log(`   - 未命中: ${stats.misses}`);
  console.log(`   - 精确匹配: ${stats.exactHits}`);
  console.log(`   - 相似度匹配: ${stats.similarityHits}`);
  console.log(`   - 命中率: ${(stats.hitRate * 100).toFixed(1)}%`);
  
  if (stats.hitRate >= 0.5) {
    console.log('✅ 通过：缓存命中率 >= 50%');
  } else {
    console.log('⚠️  警告：缓存命中率 < 50%');
  }
}

/**
 * 测试 3：并行处理性能
 */
async function testParallelProcessing() {
  console.log('\n📊 测试 3：并行处理性能\n');
  console.log('-'.repeat(80));
  
  const processor = new ParallelProcessor();
  
  // 模拟文件分析任务
  const tasks = Array.from({ length: 50 }, (_, i) => ({
    id: `file-${i}`,
    input: i,
  }));
  
  // 串行处理
  console.log('🔄 串行处理 50 个任务...');
  const start1 = Date.now();
  for (const task of tasks) {
    await simulateFileAnalysis(task.input);
  }
  const serialDuration = Date.now() - start1;
  console.log(`   耗时: ${serialDuration}ms`);
  
  // 并行处理
  console.log('🔄 并行处理 50 个任务...');
  const start2 = Date.now();
  await processor.process(tasks, async (input) => {
    return await simulateFileAnalysis(input);
  });
  const parallelDuration = Date.now() - start2;
  console.log(`   耗时: ${parallelDuration}ms`);
  
  const speedup = (serialDuration / Math.max(parallelDuration, 1)).toFixed(2);
  console.log(`\n🚀 性能提升: ${speedup}x`);
  
  if (parseFloat(speedup) >= 2) {
    console.log('✅ 通过：并行处理性能提升 >= 2x');
  } else {
    console.log('⚠️  提示：并行处理性能提升 < 2x（可能由于任务太简单）');
  }
}

/**
 * 测试 4：语义搜索质量
 */
async function testSemanticSearch() {
  console.log('\n📊 测试 4：语义搜索质量\n');
  console.log('-'.repeat(80));
  
  const config: ProjectConfig = {
    id: 'test',
    name: 'Test',
    rootPath: '/test',
    config: {
      includePatterns: ['**/*.ts'],
      excludePatterns: [],
      testFramework: 'vitest',
    },
  };
  
  const indexer = new SemanticIndexer(config);
  
  // 索引模拟数据
  await indexer.indexCodebase([
    {
      filePath: '/test/auth/getUserName.ts',
      astData: {
        imports: [],
        exports: [],
        functions: [{
          name: 'getUserName',
          parameters: [],
          returnType: 'string',
          isAsync: false,
          isExported: true,
          startLine: 1,
          endLine: 5,
        }],
        classes: [],
      },
      metadata: { language: 'typescript' },
    },
    {
      filePath: '/test/auth/loginUser.ts',
      astData: {
        imports: [],
        exports: [],
        functions: [{
          name: 'loginUser',
          parameters: [],
          returnType: 'Promise<User>',
          isAsync: true,
          isExported: true,
          startLine: 1,
          endLine: 10,
        }],
        classes: [],
      },
      metadata: { language: 'typescript' },
    },
  ]);
  
  // 测试各种搜索场景
  console.log('🔍 测试模糊匹配: "getUserNam" (有拼写错误)');
  const fuzzyResults = await indexer.search('getUserNam', { topK: 3 });
  console.log(`   - 找到 ${fuzzyResults.length} 个结果`);
  if (fuzzyResults.length > 0) {
    console.log(`   - 最佳匹配: ${fuzzyResults[0].chunk.metadata.name} (相关性: ${fuzzyResults[0].relevance.toFixed(2)})`);
  }
  
  console.log('\n🔍 测试同义词扩展: "authentication"');
  const synonymResults = await indexer.search('authentication', { topK: 3 });
  console.log(`   - 找到 ${synonymResults.length} 个结果`);
  if (synonymResults.length > 0) {
    console.log(`   - 最佳匹配: ${synonymResults[0].chunk.metadata.name}`);
  }
  
  console.log('\n🔍 测试 Token 分词: "user name"');
  const tokenResults = await indexer.search('user name', { topK: 3 });
  console.log(`   - 找到 ${tokenResults.length} 个结果`);
  if (tokenResults.length > 0) {
    console.log(`   - 最佳匹配: ${tokenResults[0].chunk.metadata.name}`);
  }
  
  // 验证相关性
  const avgRelevance = fuzzyResults.length > 0
    ? fuzzyResults.reduce((sum, r) => sum + r.relevance, 0) / fuzzyResults.length
    : 0;
  
  console.log(`\n📈 平均相关性: ${avgRelevance.toFixed(3)}`);
  
  if (avgRelevance >= 0.8) {
    console.log('✅ 通过：平均相关性 >= 0.8');
  } else {
    console.log('⚠️  警告：平均相关性 < 0.8');
  }
}

/**
 * 测试 5：Prompt 工程质量
 */
async function testPromptEngineering() {
  console.log('\n📊 测试 5：Prompt 工程质量\n');
  console.log('-'.repeat(80));
  
  const builder = new PromptBuilder();
  
  // 测试简单函数 prompt
  console.log('🔍 测试简单函数 Prompt 生成...');
  const simplePrompt = builder.buildUnitTestPrompt({
    context: createMockContext('add', 2, [], []),
    strategy: {
      type: 'AAA',
      mockStrategy: { dependencies: [] },
      boundaryConditions: [],
      edgeCases: [],
    },
    framework: 'vitest',
    examples: [],
  });
  
  const hasSimpleGuidance = simplePrompt.includes('simple function');
  console.log(`   - 包含简单函数指导: ${hasSimpleGuidance ? '✅' : '❌'}`);
  console.log(`   - Prompt 长度: ${simplePrompt.length} 字符`);
  
  // 测试复杂函数 prompt
  console.log('\n🔍 测试复杂函数 Prompt 生成...');
  const complexPrompt = builder.buildUnitTestPrompt({
    context: createMockContext(
      'processPayment',
      15,
      [{ type: 'database_write', target: 'payments' }],
      [
        { name: 'database', type: 'external' },
        { name: 'apiClient', type: 'external' },
      ]
    ),
    strategy: {
      type: 'AAA',
      mockStrategy: { dependencies: ['database', 'apiClient'] },
      boundaryConditions: [{ parameter: 'amount', reasoning: 'Can be negative' }],
      edgeCases: [{ scenario: 'Network failure', expectedBehavior: 'Retry 3 times' }],
    },
    framework: 'vitest',
    examples: [],
  });
  
  const hasComplexGuidance = complexPrompt.includes('complex function');
  const hasCoT = complexPrompt.includes('Chain-of-Thought');
  console.log(`   - 包含复杂函数指导: ${hasComplexGuidance ? '✅' : '❌'}`);
  console.log(`   - 包含 Chain-of-Thought: ${hasCoT ? '✅' : '❌'}`);
  console.log(`   - Prompt 长度: ${complexPrompt.length} 字符`);
  
  // 测试框架最佳实践
  console.log('\n🔍 测试框架最佳实践...');
  const frameworks = ['cypress', 'playwright', 'react-testing-library'];
  
  for (const framework of frameworks) {
    const prompt = builder.buildUnitTestPrompt({
      context: createMockContext('testFunc', 5, [], []),
      strategy: {
        type: 'AAA',
        mockStrategy: { dependencies: [] },
        boundaryConditions: [],
        edgeCases: [],
      },
      framework,
      examples: [],
    });
    
    const hasBestPractices = prompt.includes('Best Practices');
    console.log(`   - ${framework}: ${hasBestPractices ? '✅' : '❌'}`);
  }
  
  console.log('\n✅ Prompt 工程验证完成');
}

/**
 * 测试 6：质量评分准确性
 */
async function testQualityScoring() {
  console.log('\n📊 测试 6：质量评分准确性\n');
  console.log('-'.repeat(80));
  
  const analyzer = new QualityAnalyzer();
  
  // 测试高质量代码
  console.log('🔍 分析高质量测试...');
  const highQualityTest = {
    id: 'test-1',
    targetFunction: 'formatCurrency',
    framework: 'vitest' as const,
    code: `
import { describe, it, expect } from 'vitest';
import { formatCurrency } from './utils';

describe('formatCurrency', () => {
  it('should format positive numbers with dollar sign and commas correctly', () => {
    // Arrange
    const amount = 1234.56;
    
    // Act
    const result = formatCurrency(amount);
    
    // Assert
    expect(result).toBe('$1,234.56');
    expect(result).toContain('$');
    expect(result).toMatch(/\\d,\\d/);
  });
  
  it('should handle null input by throwing error', () => {
    expect(() => formatCurrency(null)).toThrow('Invalid amount');
  });
  
  it('should handle zero value correctly', () => {
    expect(formatCurrency(0)).toBe('$0.00');
  });
  
  it('should handle negative numbers with parentheses', async () => {
    const result = formatCurrency(-100);
    await expect(result).resolves.toBe('($100.00)');
  });
});
    `,
    generatedAt: Date.now(),
    status: 'generated' as const,
  };
  
  const highScore = await analyzer.analyze(highQualityTest);
  
  console.log(`   - 整体得分: ${highScore.overallScore.toFixed(1)}/100`);
  console.log(`   - 断言质量: ${(highScore.assertionQuality * 100).toFixed(1)}/100`);
  console.log(`   - 断言多样性: ${((highScore.assertionDiversity || 0) * 100).toFixed(1)}/100`);
  console.log(`   - 边界条件: ${((highScore.boundaryConditionCoverage || 0) * 100).toFixed(1)}/100`);
  console.log(`   - 可读性: ${((highScore.readability || 0) * 100).toFixed(1)}/100`);
  
  // 测试低质量代码
  console.log('\n🔍 分析低质量测试...');
  const lowQualityTest = {
    id: 'test-2',
    targetFunction: 'func',
    framework: 'vitest' as const,
    code: `
it('test', () => {
  expect(true).toBeTruthy();
});
    `,
    generatedAt: Date.now(),
    status: 'generated' as const,
  };
  
  const lowScore = await analyzer.analyze(lowQualityTest);
  
  console.log(`   - 整体得分: ${lowScore.overallScore.toFixed(1)}/100`);
  console.log(`   - 断言质量: ${(lowScore.assertionQuality * 100).toFixed(1)}/100`);
  console.log(`   - 断言多样性: ${((lowScore.assertionDiversity || 0) * 100).toFixed(1)}/100`);
  console.log(`   - 边界条件: ${((lowScore.boundaryConditionCoverage || 0) * 100).toFixed(1)}/100`);
  console.log(`   - 可读性: ${((lowScore.readability || 0) * 100).toFixed(1)}/100`);
  
  // 生成改进建议
  const suggestions = analyzer.generateImprovements(lowScore);
  console.log(`\n💡 改进建议（${suggestions.length} 条）:`);
  suggestions.slice(0, 3).forEach(s => {
    console.log(`   - ${s}`);
  });
  
  // 验证评分差异
  const scoreDiff = highScore.overallScore - lowScore.overallScore;
  console.log(`\n📈 质量差异: ${scoreDiff.toFixed(1)} 分`);
  
  if (scoreDiff >= 30) {
    console.log('✅ 通过：质量评分能有效区分高低质量代码');
  } else {
    console.log('⚠️  警告：质量评分差异不够显著');
  }
}

// 辅助函数
function createMockContext(
  name: string,
  complexity: number,
  sideEffects: any[],
  dependencies: any[]
): any {
  return {
    signature: {
      name,
      filePath: `/test/src/${name}.ts`,
      parameters: [],
      returnType: 'void',
      isAsync: false,
    },
    dependencies,
    callers: [],
    sideEffects,
    existingTests: [],
    coverage: {
      linesCovered: 0,
      linesTotal: 10,
      branchesCovered: 0,
      branchesTotal: 0,
      functionsCovered: 0,
      functionsTotal: 1,
      percentage: 0,
    },
    complexity: {
      cyclomaticComplexity: complexity,
      cognitiveComplexity: complexity,
      halsteadMetrics: {
        vocabulary: 10,
        length: 20,
        volume: 30,
        difficulty: 5,
        effort: 150,
      },
    },
    strategy: {
      type: 'AAA',
      mockStrategy: { dependencies: [] },
      boundaryConditions: [],
      edgeCases: [],
    },
  };
}

async function simulateFileAnalysis(fileId: number): Promise<number> {
  // 模拟文件分析耗时
  await new Promise(resolve => setTimeout(resolve, 10));
  return fileId * 2;
}

// 执行
main().catch(error => {
  console.error('❌ 验证失败:', error);
  process.exit(1);
});



















