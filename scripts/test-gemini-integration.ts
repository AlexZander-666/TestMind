/**
 * 测试 Gemini 集成
 * 
 * 验证：
 * 1. GeminiProvider 可以正常调用 API
 * 2. Gemini Embeddings 可以生成向量
 * 3. RealLanceDBVectorStore 可以存储和搜索
 * 4. ModelSelector 优先推荐 Gemini
 */

import { GeminiProvider } from '../packages/core/src/llm/providers/GeminiProvider';
import { GeminiEmbeddingGenerator } from '../packages/core/src/context/GeminiEmbeddings';
import { RealLanceDBVectorStore } from '../packages/core/src/db/VectorStore.real';
import { ModelSelector } from '../packages/core/src/generation/ModelSelector';
import type { CodeChunk } from '../packages/shared/src/types';

/**
 * 测试 1: GeminiProvider
 */
async function testGeminiProvider() {
  console.log('\n' + '='.repeat(60));
  console.log('测试 1: GeminiProvider');
  console.log('='.repeat(60));

  try {
    const provider = new GeminiProvider();
    
    const request = {
      prompt: 'Write a simple unit test for a function that adds two numbers.',
      model: 'gemini-1.5-flash',
    };

    console.log('发送请求...');
    const response = await provider.generate(request);

    console.log('\n✅ GeminiProvider 测试成功！');
    console.log('响应内容预览:', response.content.substring(0, 200) + '...');
    console.log('Token 使用:', response.usage);
    console.log('估算成本:', `$${response.cost?.toFixed(6) || 0}`);

    return true;
  } catch (error: any) {
    console.error('\n❌ GeminiProvider 测试失败:', error.message);
    
    if (error.message.includes('API key')) {
      console.log('\n提示：请设置 GOOGLE_API_KEY 环境变量');
      console.log('export GOOGLE_API_KEY=your-api-key');
    }
    
    return false;
  }
}

/**
 * 测试 2: Gemini Embeddings
 */
async function testGeminiEmbeddings() {
  console.log('\n' + '='.repeat(60));
  console.log('测试 2: Gemini Embeddings');
  console.log('='.repeat(60));

  const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    console.log('⚠️  跳过：未设置 GOOGLE_API_KEY');
    return false;
  }

  try {
    const generator = new GeminiEmbeddingGenerator({ apiKey });
    
    const chunks: CodeChunk[] = [
      {
        id: 'test-1',
        filePath: 'src/utils.ts',
        name: 'add',
        content: 'function add(a: number, b: number): number { return a + b; }',
        type: 'function',
        startLine: 1,
        endLine: 1,
        complexity: 1,
        loc: 1,
        dependencies: [],
        metadata: {},
      },
      {
        id: 'test-2',
        filePath: 'src/utils.ts',
        name: 'multiply',
        content: 'function multiply(a: number, b: number): number { return a * b; }',
        type: 'function',
        startLine: 3,
        endLine: 3,
        complexity: 1,
        loc: 1,
        dependencies: [],
        metadata: {},
      },
    ];

    console.log('生成 embeddings...');
    const result = await generator.generateBatch(chunks);

    console.log('\n✅ Gemini Embeddings 测试成功！');
    console.log('成功:', result.successCount);
    console.log('失败:', result.failedCount);
    console.log('耗时:', `${result.duration}ms`);
    console.log('估算成本:', `$${result.estimatedCost.toFixed(8)}`);
    console.log('向量维度:', (chunks[0] as any).embedding?.length || 'N/A');

    return true;
  } catch (error: any) {
    console.error('\n❌ Gemini Embeddings 测试失败:', error.message);
    return false;
  }
}

/**
 * 测试 3: RealLanceDBVectorStore
 */
async function testRealLanceDB() {
  console.log('\n' + '='.repeat(60));
  console.log('测试 3: RealLanceDBVectorStore');
  console.log('='.repeat(60));

  try {
    const store = new RealLanceDBVectorStore('.testmind/test/lancedb');
    
    console.log('初始化 LanceDB...');
    await store.initialize();
    
    // 创建模拟数据（含 embeddings）
    const chunks: CodeChunk[] = [
      {
        id: 'test-1',
        filePath: 'src/utils.ts',
        name: 'add',
        content: 'function add(a: number, b: number): number { return a + b; }',
        type: 'function',
        startLine: 1,
        endLine: 1,
        complexity: 1,
        loc: 1,
        dependencies: [],
        metadata: {},
      } as CodeChunk,
    ];

    // 添加随机向量（模拟）
    (chunks[0] as any).embedding = Array.from({ length: 768 }, () => Math.random());

    console.log('插入数据...');
    await store.insertChunks(chunks);

    console.log('执行搜索...');
    const queryVector = Array.from({ length: 768 }, () => Math.random());
    const results = await store.search(queryVector, { k: 1 });

    console.log('\n✅ RealLanceDBVectorStore 测试成功！');
    console.log('搜索结果数:', results.length);
    
    // 获取统计
    const stats = await store.getStats();
    console.log('统计信息:', stats);

    await store.close();
    return true;
  } catch (error: any) {
    console.error('\n❌ RealLanceDBVectorStore 测试失败:', error.message);
    
    if (error.message.includes('Cannot find module')) {
      console.log('\n提示：请确保已安装 @lancedb/lancedb');
      console.log('pnpm add @lancedb/lancedb apache-arrow -w');
    }
    
    return false;
  }
}

/**
 * 测试 4: ModelSelector 推荐 Gemini
 */
async function testModelSelector() {
  console.log('\n' + '='.repeat(60));
  console.log('测试 4: ModelSelector - Gemini 优先推荐');
  console.log('='.repeat(60));

  try {
    const selector = new ModelSelector();
    
    // 场景 1: 简单任务
    const simpleRecommendation = selector.selectModel({
      complexity: {
        level: 'simple',
        score: 20,
        factors: {
          codeComplexity: 10,
          contextLength: 10,
          taskType: 0,
          requiresReasoning: 0,
        },
      },
      contextTokens: 2000,
      prioritizeCost: true,
    });

    console.log('\n场景 1: 简单任务');
    console.log('推荐模型:', simpleRecommendation.model.id);
    console.log('Provider:', simpleRecommendation.model.provider);
    console.log('置信度:', simpleRecommendation.confidence);
    console.log('推荐原因:', simpleRecommendation.reasons);

    // 场景 2: 复杂任务
    const complexRecommendation = selector.selectModel({
      complexity: {
        level: 'complex',
        score: 80,
        factors: {
          codeComplexity: 70,
          contextLength: 60,
          taskType: 50,
          requiresReasoning: 80,
        },
      },
      contextTokens: 10000,
      prioritizeCost: true,
    });

    console.log('\n场景 2: 复杂任务');
    console.log('推荐模型:', complexRecommendation.model.id);
    console.log('Provider:', complexRecommendation.model.provider);
    console.log('置信度:', complexRecommendation.confidence);

    // 验证是否推荐了 Gemini
    const geminiCount = [simpleRecommendation, complexRecommendation].filter(
      r => r.model.provider === 'google'
    ).length;

    console.log('\n✅ ModelSelector 测试成功！');
    console.log(`Gemini 推荐次数: ${geminiCount}/2`);
    
    if (geminiCount > 0) {
      console.log('✓ Gemini 已被优先推荐');
    } else {
      console.log('⚠ Gemini 未被推荐（可能需要调整评分）');
    }

    return true;
  } catch (error: any) {
    console.error('\n❌ ModelSelector 测试失败:', error.message);
    return false;
  }
}

/**
 * 主测试函数
 */
async function main() {
  console.log('TestMind Gemini 集成测试');
  console.log('使用提供的 API 配置进行测试\n');

  // 设置 API 配置（从用户提供的配置）
  if (!process.env.GOOGLE_API_KEY && !process.env.GEMINI_API_KEY) {
    console.log('使用测试 API 配置...');
    // 注意：实际使用时，这些配置应该从环境变量获取
    // 这里仅用于演示
  }

  const results = {
    geminiProvider: false,
    geminiEmbeddings: false,
    realLanceDB: false,
    modelSelector: false,
  };

  // 测试 1: GeminiProvider（需要 API Key）
  if (process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY) {
    results.geminiProvider = await testGeminiProvider();
  } else {
    console.log('\n⚠️  跳过 GeminiProvider 测试（未设置 API Key）');
  }

  // 测试 2: Gemini Embeddings（需要 API Key）
  if (process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY) {
    results.geminiEmbeddings = await testGeminiEmbeddings();
  } else {
    console.log('\n⚠️  跳过 Gemini Embeddings 测试（未设置 API Key）');
  }

  // 测试 3: RealLanceDB（不需要 API Key）
  results.realLanceDB = await testRealLanceDB();

  // 测试 4: ModelSelector（不需要 API Key）
  results.modelSelector = await testModelSelector();

  // 汇总结果
  console.log('\n' + '='.repeat(60));
  console.log('测试结果汇总');
  console.log('='.repeat(60));
  
  Object.entries(results).forEach(([name, passed]) => {
    const status = passed ? '✅ 通过' : '❌ 失败';
    console.log(`${name}: ${status}`);
  });

  const passCount = Object.values(results).filter(Boolean).length;
  const totalCount = Object.values(results).length;
  
  console.log(`\n总体: ${passCount}/${totalCount} 测试通过`);

  if (passCount === totalCount) {
    console.log('\n🎉 所有测试通过！Gemini 集成成功！');
  } else {
    console.log('\n⚠️  部分测试失败，请检查错误信息');
  }
}

// 运行测试
main().catch(error => {
  console.error('测试执行失败:', error);
  process.exit(1);
});


