/**
 * 显式上下文管理 Demo
 * 
 * 演示如何使用 Aider 风格的显式上下文控制
 * 
 * 运行: tsx examples/explicit-context-management/demo.ts
 */

import {
  createExplicitContextManager,
  createContextFusion,
  createTokenBudgetManager,
} from '@testmind/core';
import type { CodeChunk, SemanticSearchResult } from '@testmind/shared';

// ============================================================================
// Demo 1: 基础显式上下文管理
// ============================================================================

async function demo1_BasicExplicitContext() {
  console.log('\n=== Demo 1: 基础显式上下文管理 ===\n');
  
  const manager = createExplicitContextManager();
  
  // 模拟代码块
  const chunks: CodeChunk[] = [
    {
      id: 'chunk-1',
      filePath: 'src/utils/math.ts',
      content: 'export function add(a: number, b: number) { return a + b; }',
      startLine: 1,
      endLine: 1,
    },
    {
      id: 'chunk-2',
      filePath: 'src/utils/math.ts',
      content: 'export function subtract(a: number, b: number) { return a - b; }',
      startLine: 3,
      endLine: 3,
    },
  ];
  
  // 1. 添加文件到上下文
  manager.addFile('src/utils/math.ts', chunks, { priority: 8 });
  
  // 2. 设置聚焦范围
  manager.setFocus(['src/utils']);
  
  // 3. 查看当前上下文
  const snapshot = manager.getCurrentContext();
  console.log('当前上下文:');
  console.log(`- 代码块数量: ${snapshot.pinnedChunks.length}`);
  console.log(`- 聚焦范围: ${snapshot.focusScope.join(', ')}`);
  console.log(`- 估算 tokens: ${snapshot.estimatedTokens}`);
  
  // 4. 获取统计信息
  const stats = manager.getStatistics();
  console.log('\n统计信息:');
  console.log(`- 总代码块: ${stats.totalChunks}`);
  console.log(`- 总文件: ${stats.totalFiles}`);
  console.log(`- 优先级分布:`, stats.priorityDistribution);
}

// ============================================================================
// Demo 2: 上下文融合
// ============================================================================

async function demo2_ContextFusion() {
  console.log('\n=== Demo 2: 上下文融合 ===\n');
  
  const explicitManager = createExplicitContextManager();
  const fusion = createContextFusion();
  
  // 显式上下文
  const explicitChunks: CodeChunk[] = [
    {
      id: 'explicit-1',
      filePath: 'src/core/engine.ts',
      content: '// Core engine code (500 chars)'.padEnd(500),
      startLine: 1,
      endLine: 20,
    },
  ];
  
  explicitManager.addFile('src/core/engine.ts', explicitChunks, { priority: 10 });
  const pinnedChunks = explicitManager.getPinnedChunks();
  
  // 自动上下文（模拟语义搜索结果）
  const autoChunks: SemanticSearchResult[] = [
    {
      chunk: {
        id: 'auto-1',
        filePath: 'src/utils/helper.ts',
        content: '// Helper code (400 chars)'.padEnd(400),
        startLine: 1,
        endLine: 15,
      },
      score: 0.95,
      relevance: 0.95,
    },
    {
      chunk: {
        id: 'auto-2',
        filePath: 'src/config/settings.ts',
        content: '// Config code (300 chars)'.padEnd(300),
        startLine: 1,
        endLine: 10,
      },
      score: 0.85,
      relevance: 0.85,
    },
  ];
  
  // 融合上下文
  const result = await fusion.fuseContexts(pinnedChunks, autoChunks, {
    maxTokens: 1000,
    explicitContextReserve: 0.6,
    allowPartialAuto: true,
  });
  
  console.log('融合结果:');
  console.log(`- 总代码块: ${result.chunks.length}`);
  console.log(`- 显式 tokens: ${result.explicitTokens}`);
  console.log(`- 自动 tokens: ${result.autoTokens}`);
  console.log(`- 总 tokens: ${result.totalTokens}`);
  console.log(`- 是否截断: ${result.truncated}`);
  console.log(`- 去重: 发现 ${result.deduplication.duplicatesFound} 个，移除 ${result.deduplication.duplicatesRemoved} 个`);
}

// ============================================================================
// Demo 3: Token 预算管理
// ============================================================================

async function demo3_TokenBudget() {
  console.log('\n=== Demo 3: Token 预算管理 ===\n');
  
  const budgetManager = createTokenBudgetManager();
  
  // 1. 获取模型预算
  const budget = budgetManager.getBudget('gpt-4o');
  console.log('GPT-4o 预算:');
  console.log(`- 最大上下文: ${budget.maxContextTokens.toLocaleString()} tokens`);
  console.log(`- 可用输入: ${budget.availableInputTokens.toLocaleString()} tokens`);
  
  // 2. 计算使用情况
  const systemPrompt = 'You are a helpful coding assistant.';
  const userInstruction = 'Generate unit tests for the add function.';
  const codeChunks: CodeChunk[] = [
    {
      id: 'chunk-1',
      filePath: 'src/math.ts',
      content: `export function add(a: number, b: number): number {
  return a + b;
}

export function multiply(a: number, b: number): number {
  return a * b;
}`,
      startLine: 1,
      endLine: 7,
    },
  ];
  
  const usage = budgetManager.calculateUsage(systemPrompt, userInstruction, codeChunks);
  console.log('\nToken 使用:');
  console.log(`- 系统提示: ${usage.systemPrompt} tokens`);
  console.log(`- 用户指令: ${usage.userInstruction} tokens`);
  console.log(`- 代码上下文: ${usage.codeContext} tokens`);
  console.log(`- 元数据: ${usage.metadata} tokens`);
  console.log(`- 总计: ${usage.total} tokens`);
  
  // 3. 可视化
  console.log(budgetManager.visualizeUsage(usage, budget));
  
  // 4. 成本估算
  const cost = budgetManager.estimateCost('gpt-4o', usage.total, 500);
  console.log('成本估算:');
  console.log(`- 输入成本: $${cost.inputCost.toFixed(4)}`);
  console.log(`- 输出成本: $${cost.outputCost.toFixed(4)}`);
  console.log(`- 总成本: $${cost.totalCost.toFixed(4)}`);
}

// ============================================================================
// Demo 4: 完整工作流
// ============================================================================

async function demo4_CompleteWorkflow() {
  console.log('\n=== Demo 4: 完整工作流 ===\n');
  
  // 1. 用户添加显式上下文
  const explicitManager = createExplicitContextManager();
  explicitManager.addFile('src/core/engine.ts', [
    {
      id: 'core-1',
      filePath: 'src/core/engine.ts',
      content: '// Core implementation'.padEnd(1000),
      startLine: 1,
      endLine: 40,
    },
  ], { priority: 10, reason: 'User explicitly added for review' });
  
  explicitManager.setFocus(['src/core', 'src/utils']);
  
  // 2. 系统自动搜索相关上下文
  const autoResults: SemanticSearchResult[] = [
    {
      chunk: {
        id: 'auto-1',
        filePath: 'src/utils/helper.ts',
        content: '// Helper functions'.padEnd(800),
        startLine: 1,
        endLine: 30,
      },
      score: 0.92,
      relevance: 0.92,
    },
    {
      chunk: {
        id: 'auto-2',
        filePath: 'tests/engine.test.ts',
        content: '// Existing tests'.padEnd(600),
        startLine: 1,
        endLine: 25,
      },
      score: 0.88,
      relevance: 0.88,
    },
  ];
  
  // 3. 融合上下文
  const fusion = createContextFusion();
  const fusionResult = await fusion.fuseContexts(
    explicitManager.getPinnedChunks(),
    autoResults,
    { maxTokens: 8000, explicitContextReserve: 0.6 }
  );
  
  // 4. Token 预算检查
  const budgetManager = createTokenBudgetManager();
  const budget = budgetManager.getBudget('gpt-4o');
  const systemPrompt = 'You are TestMind, an AI test generation assistant.';
  const userInstruction = 'Generate comprehensive unit tests.';
  
  const usage = budgetManager.calculateUsage(
    systemPrompt,
    userInstruction,
    fusionResult.chunks
  );
  
  // 5. 如果超出预算，截断
  const truncated = budgetManager.truncateToFit(
    fusionResult.chunks,
    budget.availableInputTokens,
    systemPrompt,
    userInstruction
  );
  
  console.log('完整工作流结果:');
  console.log(`- 显式上下文: ${explicitManager.getStatistics().totalChunks} 块`);
  console.log(`- 自动上下文: ${autoResults.length} 块`);
  console.log(`- 融合后: ${fusionResult.chunks.length} 块`);
  console.log(`- 截断后: ${truncated.chunks.length} 块`);
  console.log(`- 最终 tokens: ${truncated.finalTokens}`);
  console.log(`- 是否截断: ${truncated.wasTruncated}`);
  console.log(`- 预算使用率: ${((truncated.finalTokens / budget.availableInputTokens) * 100).toFixed(1)}%`);
}

// ============================================================================
// 运行所有 Demo
// ============================================================================

async function main() {
  console.log('\n🎯 TestMind 显式上下文管理 Demo\n');
  console.log('演示 Aider 风格的显式上下文控制功能\n');
  console.log('═'.repeat(60));
  
  await demo1_BasicExplicitContext();
  await demo2_ContextFusion();
  await demo3_TokenBudget();
  await demo4_CompleteWorkflow();
  
  console.log('\n═'.repeat(60));
  console.log('\n✅ 所有 Demo 运行完成！\n');
}

// 仅在直接运行时执行
if (require.main === module) {
  main().catch(console.error);
}

export { demo1_BasicExplicitContext, demo2_ContextFusion, demo3_TokenBudget, demo4_CompleteWorkflow };





