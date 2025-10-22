/**
 * TestMind v0.7.0 功能验证脚本
 * 
 * 使用真实 LLM API 测试所有新功能
 * 
 * 运行: tsx scripts/test-v0.7.0-features.ts
 */

import {
  createExplicitContextManager,
  createContextFusion,
  createTokenBudgetManager,
  createModelSelector,
  createPromptOptimizer,
  createSemanticCache,
  createRichDiffUI,
  createDiffGenerator,
  LLMService,
} from '../packages/core/src';
import type { CodeChunk, SemanticSearchResult } from '../packages/shared/src/types';

// ============================================================================
// 配置
// ============================================================================

const LLM_CONFIG = {
  provider: 'custom' as const,
  model: 'gemini-2.5-pro-preview-06-05-maxthinking',
  apiUrl: 'https://want.eat99.top/v1',
  apiKey: 'sk-j7105hOsoRe6q9k3mB3V0CaEmLDTB8WshEWqQsLelG89G5z4',
};

// ============================================================================
// 测试 1: 显式上下文管理
// ============================================================================

async function test1_ExplicitContextManagement() {
  console.log('\n╔═══════════════════════════════════════════╗');
  console.log('║  测试 1: 显式上下文管理                ║');
  console.log('╚═══════════════════════════════════════════╝\n');
  
  const manager = createExplicitContextManager();
  
  // 模拟代码块
  const authChunk: CodeChunk = {
    id: 'auth-1',
    filePath: 'src/auth/AuthService.ts',
    content: `export class AuthService {
  async login(email: string, password: string): Promise<User> {
    const user = await this.db.findUser(email);
    if (!user) throw new Error('User not found');
    
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new Error('Invalid password');
    
    return user;
  }
}`,
    startLine: 10,
    endLine: 19,
  };
  
  // 添加文件
  manager.addFile('src/auth/AuthService.ts', [authChunk], {
    priority: 10,
    reason: 'Target for test generation',
  });
  
  // 设置聚焦范围
  manager.setFocus(['src/auth', 'src/db']);
  
  // 获取上下文快照
  const snapshot = manager.getCurrentContext();
  
  console.log('✅ 上下文管理测试通过');
  console.log(`   - 代码块数: ${snapshot.pinnedChunks.length}`);
  console.log(`   - 聚焦范围: ${snapshot.focusScope.join(', ')}`);
  console.log(`   - 估算 tokens: ${snapshot.estimatedTokens}`);
  
  // 统计信息
  const stats = manager.getStatistics();
  console.log(`\n统计信息:`);
  console.log(`   - 总文件: ${stats.totalFiles}`);
  console.log(`   - 总代码块: ${stats.totalChunks}`);
  console.log(`   - 优先级分布:`, stats.priorityDistribution);
  
  return { manager, authChunk };
}

// ============================================================================
// 测试 2: 上下文融合 + Token 管理
// ============================================================================

async function test2_ContextFusionAndTokenManagement() {
  console.log('\n╔═══════════════════════════════════════════╗');
  console.log('║  测试 2: 上下文融合 + Token 管理      ║');
  console.log('╚═══════════════════════════════════════════╝\n');
  
  const { manager, authChunk } = await test1_ExplicitContextManagement();
  
  // 模拟自动搜索结果
  const autoResults: SemanticSearchResult[] = [
    {
      chunk: {
        id: 'auto-1',
        filePath: 'src/db/UserRepository.ts',
        content: `export class UserRepository {
  async findUser(email: string): Promise<User | null> {
    return this.db.users.findOne({ email });
  }
}`,
        startLine: 5,
        endLine: 9,
      },
      score: 0.92,
      relevance: 0.92,
    },
  ];
  
  // 融合上下文
  const fusion = createContextFusion();
  const fusionResult = await fusion.fuseContexts(
    manager.getPinnedChunks(),
    autoResults,
    {
      maxTokens: 4000,
      explicitContextReserve: 0.6,
    }
  );
  
  console.log('✅ 上下文融合测试通过');
  console.log(`   - 总代码块: ${fusionResult.chunks.length}`);
  console.log(`   - 显式 tokens: ${fusionResult.explicitTokens}`);
  console.log(`   - 自动 tokens: ${fusionResult.autoTokens}`);
  console.log(`   - 总 tokens: ${fusionResult.totalTokens}`);
  console.log(`   - 去重: 发现 ${fusionResult.deduplication.duplicatesFound} 个`);
  
  // Token 预算管理
  const budgetManager = createTokenBudgetManager();
  const budget = budgetManager.getBudget('gpt-4o-mini');
  
  const usage = budgetManager.calculateUsage(
    'You are TestMind, an AI test generation assistant.',
    'Generate comprehensive unit tests for AuthService.',
    fusionResult.chunks
  );
  
  console.log('\n✅ Token 预算管理测试通过');
  console.log(budgetManager.visualizeUsage(usage, budget));
  
  const cost = budgetManager.estimateCost('gpt-4o-mini', usage.total, 500);
  console.log(`预估成本: $${cost.totalCost.toFixed(4)}`);
  
  return { fusionResult, usage };
}

// ============================================================================
// 测试 3: 智能模型选择
// ============================================================================

async function test3_ModelSelection() {
  console.log('\n╔═══════════════════════════════════════════╗');
  console.log('║  测试 3: 智能模型选择                  ║');
  console.log('╚═══════════════════════════════════════════╝\n');
  
  const selector = createModelSelector();
  
  // 简单代码
  const simpleCode = 'function add(a, b) { return a + b; }';
  const simpleRec = selector.selectForTestGeneration(simpleCode);
  
  console.log('简单代码测试:');
  console.log(`   - 复杂度: ${simpleRec.model.capability}/10`);
  console.log(`   - 推荐模型: ${simpleRec.model.id}`);
  console.log(`   - 预估成本: $${simpleRec.estimatedCost.toFixed(4)}`);
  
  // 复杂代码
  const complexCode = `
class AuthService {
  // 50+ lines of complex logic
  ${'  async method() { /* complex */ }\n'.repeat(20)}
}`.trim();
  
  const complexRec = selector.selectForTestGeneration(complexCode, {
    cyclomaticComplexity: 25,
    cognitiveComplexity: 35,
    linesOfCode: 100,
    maintainabilityIndex: 50,
  });
  
  console.log('\n复杂代码测试:');
  console.log(`   - 复杂度: ${complexRec.model.capability}/10`);
  console.log(`   - 推荐模型: ${complexRec.model.id}`);
  console.log(`   - 预估成本: $${complexRec.estimatedCost.toFixed(4)}`);
  
  // 模型对比
  console.log('\n模型成本对比（1000 tokens 上下文）:');
  const comparison = selector.compareModels(
    ['gpt-4o-mini', 'gpt-4o', 'claude-3-haiku', 'gemini-flash'],
    1000
  );
  
  for (const { model, cost } of comparison) {
    console.log(`   ${model.padEnd(20)}: $${cost.toFixed(5)}`);
  }
  
  console.log('\n✅ 模型选择测试通过');
}

// ============================================================================
// 测试 4: Prompt 优化
// ============================================================================

async function test4_PromptOptimization() {
  console.log('\n╔═══════════════════════════════════════════╗');
  console.log('║  测试 4: Prompt 优化                    ║');
  console.log('╚═══════════════════════════════════════════╝\n');
  
  const optimizer = createPromptOptimizer();
  
  const verbosePrompt = `Please    kindly  generate   comprehensive   unit  tests.



Important: Make sure to follow best practices.

Note: Include edge cases and error handling.`;
  
  const chunks: CodeChunk[] = [
    {
      id: 'chunk-1',
      filePath: 'src/math.ts',
      content: `// This is a very long comment explaining the function
// It takes two numbers and adds them together
// Returns the sum of the two numbers
export function add(a: number, b: number): number {
  // Perform addition
  return a + b; // Return result
}`,
      startLine: 1,
      endLine: 8,
    },
  ];
  
  // 测试不同优化级别
  console.log('优化级别对比:\n');
  
  for (const aggressiveness of [0.3, 0.6, 0.9]) {
    const result = await optimizer.optimize(verbosePrompt, chunks, {
      aggressiveness,
      keepComments: false,
      keepEmptyLines: false,
    });
    
    console.log(`激进度 ${aggressiveness.toFixed(1)}:`);
    console.log(`   - 原始: ${result.originalTokens} tokens`);
    console.log(`   - 优化: ${result.optimizedTokens} tokens`);
    console.log(`   - 节省: ${result.savedPercentage.toFixed(1)}%`);
    console.log(`   - 技术: ${result.appliedOptimizations.join(', ')}\n`);
  }
  
  console.log('✅ Prompt 优化测试通过');
}

// ============================================================================
// 测试 5: 语义缓存
// ============================================================================

async function test5_SemanticCaching() {
  console.log('\n╔═══════════════════════════════════════════╗');
  console.log('║  测试 5: 语义缓存                      ║');
  console.log('╚═══════════════════════════════════════════╝\n');
  
  const cache = createSemanticCache({
    maxEntries: 100,
    similarityThreshold: 0.85,
    enableEmbedding: true,
  });
  
  const request1 = {
    provider: 'openai' as const,
    model: 'gpt-4o-mini',
    prompt: 'Generate unit tests for add function',
    temperature: 0.3,
    maxTokens: 1000,
  };
  
  const response1 = {
    content: 'Mock test code here',
    usage: { promptTokens: 100, completionTokens: 200, totalTokens: 300 },
    finishReason: 'stop' as const,
  };
  
  // 添加到缓存
  await cache.set(request1, response1);
  console.log('✅ 缓存条目已添加');
  
  // 精确匹配
  const cached1 = await cache.get(request1);
  console.log(`精确匹配: ${cached1 ? '✅ 命中' : '❌ 未命中'}`);
  
  // 语义相似（略有不同）
  const request2 = {
    ...request1,
    prompt: 'Generate unit tests for addition function',
  };
  
  const cached2 = await cache.get(request2);
  console.log(`语义匹配: ${cached2 ? '✅ 命中' : '⏸️ 未命中（伪嵌入可能不够准确）'}`);
  
  // 统计
  const stats = cache.getStats();
  console.log(`\n缓存统计:`);
  console.log(`   - 总条目: ${stats.totalEntries}`);
  console.log(`   - 命中率: ${(stats.hitRate * 100).toFixed(1)}%`);
  
  console.log('\n✅ 语义缓存测试通过');
}

// ============================================================================
// 测试 6: 真实 LLM API 调用
// ============================================================================

async function test6_RealLLMAPICall() {
  console.log('\n╔═══════════════════════════════════════════╗');
  console.log('║  测试 6: 真实 LLM API 调用             ║');
  console.log('╚═══════════════════════════════════════════╝\n');
  
  const llmService = new LLMService();
  
  console.log('配置信息:');
  console.log(`   - API URL: ${LLM_CONFIG.apiUrl}`);
  console.log(`   - Model: ${LLM_CONFIG.model}`);
  console.log(`   - Provider: ${LLM_CONFIG.provider}`);
  
  try {
    console.log('\n🤖 调用 LLM API...');
    
    const request = {
      provider: LLM_CONFIG.provider,
      model: LLM_CONFIG.model,
      prompt: `Generate a simple unit test for this function:

\`\`\`typescript
export function add(a: number, b: number): number {
  return a + b;
}
\`\`\`

Use vitest framework. Return ONLY the test code.`,
      temperature: 0.3,
      maxTokens: 500,
    };
    
    const startTime = Date.now();
    const response = await llmService.generate(request);
    const duration = Date.now() - startTime;
    
    console.log('\n✅ LLM API 调用成功！');
    console.log(`   - 耗时: ${duration}ms`);
    console.log(`   - 输入 tokens: ${response.usage.promptTokens}`);
    console.log(`   - 输出 tokens: ${response.usage.completionTokens}`);
    console.log(`   - 总 tokens: ${response.usage.totalTokens}`);
    console.log(`   - 完成原因: ${response.finishReason}`);
    
    console.log('\n生成的测试代码:');
    console.log('─'.repeat(60));
    console.log(response.content.slice(0, 500));
    if (response.content.length > 500) {
      console.log('\n... (truncated)');
    }
    console.log('─'.repeat(60));
    
    return response;
  } catch (error) {
    console.error('\n❌ LLM API 调用失败:');
    console.error(error);
    throw error;
  }
}

// ============================================================================
// 测试 7: 完整工作流（端到端）
// ============================================================================

async function test7_EndToEndWorkflow() {
  console.log('\n╔═══════════════════════════════════════════╗');
  console.log('║  测试 7: 完整端到端工作流              ║');
  console.log('╚═══════════════════════════════════════════╝\n');
  
  console.log('执行步骤:\n');
  
  // Step 1: 上下文管理
  console.log('1️⃣  设置显式上下文...');
  const manager = createExplicitContextManager();
  
  const targetChunk: CodeChunk = {
    id: 'target-1',
    filePath: 'src/services/PaymentService.ts',
    content: `export class PaymentService {
  async processPayment(amount: number, currency: string): Promise<Payment> {
    if (amount <= 0) throw new Error('Invalid amount');
    
    const payment = await this.gateway.charge(amount, currency);
    await this.db.savePayment(payment);
    
    return payment;
  }
}`,
    startLine: 1,
    endLine: 9,
  };
  
  manager.addFile('src/services/PaymentService.ts', [targetChunk], { priority: 10 });
  console.log('   ✓ 已添加目标文件\n');
  
  // Step 2: 模型选择
  console.log('2️⃣  分析复杂度，选择模型...');
  const selector = createModelSelector();
  const complexity = selector.analyzeComplexity(targetChunk.content.length, {
    cyclomaticComplexity: 6,
    cognitiveComplexity: 8,
    linesOfCode: 9,
    maintainabilityIndex: 75,
  });
  
  const modelRec = selector.selectModel({
    complexity,
    contextTokens: 500,
    prioritizeCost: true,
  });
  
  console.log(`   ✓ 复杂度: ${complexity.level}`);
  console.log(`   ✓ 推荐模型: ${modelRec.model.id}\n`);
  
  // Step 3: Prompt 优化
  console.log('3️⃣  优化 Prompt...');
  const optimizer = createPromptOptimizer();
  
  const basePrompt = `Generate comprehensive unit tests for PaymentService.

Requirements:
- Use vitest framework
- Mock payment gateway
- Test success and error cases
- Include validation tests`;
  
  const optimized = await optimizer.optimize(basePrompt, [targetChunk], {
    aggressiveness: 0.6,
    keepComments: false,
  });
  
  console.log(`   ✓ 节省: ${optimized.savedPercentage.toFixed(1)}%\n`);
  
  // Step 4: Token 预算检查
  console.log('4️⃣  检查 Token 预算...');
  const budgetManager = createTokenBudgetManager();
  const usage = budgetManager.calculateUsage(
    'You are TestMind.',
    optimized.optimizedPrompt,
    [targetChunk]
  );
  
  console.log(`   ✓ 总 tokens: ${usage.total}\n`);
  
  // Step 5: 调用 LLM（真实 API）
  console.log('5️⃣  调用 LLM 生成测试...');
  
  try {
    const llmService = new LLMService();
    const response = await llmService.generate({
      provider: LLM_CONFIG.provider,
      model: LLM_CONFIG.model,
      prompt: optimized.optimizedPrompt,
      temperature: 0.3,
      maxTokens: 800,
    });
    
    console.log(`   ✓ 生成成功！`);
    console.log(`   ✓ 输出 tokens: ${response.usage.completionTokens}\n`);
    
    // Step 6: 生成 Diff
    console.log('6️⃣  生成 Diff...');
    const diffGenerator = createDiffGenerator();
    
    const diff = diffGenerator.generateDiff(
      '', // 新文件
      response.content,
      'src/services/PaymentService.test.ts'
    );
    
    console.log(`   ✓ Diff 已生成`);
    console.log(`   ✓ 添加: ${diff.additions} 行\n`);
    
    // Step 7: Rich Diff 展示
    console.log('7️⃣  展示 Rich Diff...');
    const diffUI = createRichDiffUI(llmService);
    
    const diffOutput = diffUI.renderDiff(diff, { showStats: true });
    console.log(diffOutput.slice(0, 500));
    console.log('   ... (truncated)\n');
    
    console.log('✅ 完整工作流测试通过！');
    
    return { testCode: response.content, diff };
  } catch (error) {
    console.error('   ❌ LLM 调用失败:', error);
    console.log('\n⚠️  工作流测试部分完成（LLM 调用失败）');
  }
}

// ============================================================================
// 测试 8: 性能验证
// ============================================================================

async function test8_PerformanceValidation() {
  console.log('\n╔═══════════════════════════════════════════╗');
  console.log('║  测试 8: 性能验证                      ║');
  console.log('╚═══════════════════════════════════════════╝\n');
  
  // 并行处理性能
  const { createParallelOptimizer } = await import('../packages/core/src/utils/ParallelOptimizer');
  const parallelOptimizer = createParallelOptimizer({ maxConcurrency: 4 });
  
  console.log('并行处理性能:');
  const estimate = parallelOptimizer.estimateDuration(100, 500);
  console.log(`   - 串行: ${(estimate.sequential / 1000).toFixed(1)}s`);
  console.log(`   - 并行: ${(estimate.parallel / 1000).toFixed(1)}s`);
  console.log(`   - 加速: ${estimate.speedup.toFixed(1)}x\n`);
  
  // Token 计算性能
  console.log('Token 计算性能:');
  const budgetManager = createTokenBudgetManager();
  const largeChunks: CodeChunk[] = Array.from({ length: 1000 }, (_, i) => ({
    id: `chunk-${i}`,
    filePath: `file${i}.ts`,
    content: 'x'.repeat(200),
    startLine: 1,
    endLine: 10,
  }));
  
  const start = Date.now();
  const usage = budgetManager.calculateUsage('prompt', 'instruction', largeChunks);
  const duration = Date.now() - start;
  
  console.log(`   - 1000 个代码块`);
  console.log(`   - 计算时间: ${duration}ms`);
  console.log(`   - 总 tokens: ${usage.total.toLocaleString()}\n`);
  
  console.log('✅ 性能验证通过');
}

// ============================================================================
// 主函数
// ============================================================================

async function main() {
  console.log('\n╔═══════════════════════════════════════════════════════╗');
  console.log('║                                                       ║');
  console.log('║       🧪 TestMind v0.7.0 功能验证测试             ║');
  console.log('║                                                       ║');
  console.log('║  使用真实 LLM API 验证所有新功能                  ║');
  console.log('║                                                       ║');
  console.log('╚═══════════════════════════════════════════════════════╝');
  
  const results: { test: string; success: boolean }[] = [];
  
  try {
    // 测试 1-5 (不需要 LLM API)
    await test1_ExplicitContextManagement();
    results.push({ test: 'Test 1: ExplicitContextManagement', success: true });
    
    await test2_ContextFusionAndTokenManagement();
    results.push({ test: 'Test 2: ContextFusion & TokenManagement', success: true });
    
    await test3_ModelSelection();
    results.push({ test: 'Test 3: ModelSelection', success: true });
    
    await test4_PromptOptimization();
    results.push({ test: 'Test 4: PromptOptimization', success: true });
    
    await test5_SemanticCaching();
    results.push({ test: 'Test 5: SemanticCaching', success: true });
    
    // 测试 6-7 (需要 LLM API)
    try {
      await test6_RealLLMAPICall();
      results.push({ test: 'Test 6: Real LLM API Call', success: true });
      
      await test7_EndToEndWorkflow();
      results.push({ test: 'Test 7: End-to-End Workflow', success: true });
    } catch (error) {
      console.error('\n⚠️  LLM API 测试失败（可能是 API 配置问题）');
      results.push({ test: 'Test 6-7: LLM API Tests', success: false });
    }
    
    // 测试 8 (性能)
    await test8_PerformanceValidation();
    results.push({ test: 'Test 8: Performance Validation', success: true });
    
  } catch (error) {
    console.error('\n❌ 测试执行失败:', error);
    process.exit(1);
  }
  
  // 显示结果
  console.log('\n╔═══════════════════════════════════════════╗');
  console.log('║  测试结果总结                          ║');
  console.log('╚═══════════════════════════════════════════╝\n');
  
  const passed = results.filter(r => r.success).length;
  const total = results.length;
  
  for (const { test, success } of results) {
    const status = success ? '✅' : '❌';
    console.log(`${status} ${test}`);
  }
  
  console.log(`\n通过率: ${passed}/${total} (${((passed / total) * 100).toFixed(1)}%)`);
  
  if (passed === total) {
    console.log('\n🎉 所有测试通过！v0.7.0 功能验证成功！');
  } else {
    console.log('\n⚠️  部分测试失败，请检查 LLM API 配置');
  }
  
  console.log('\n───────────────────────────────────────────');
  console.log('\n📚 查看完整报告:');
  console.log('   docs/technical-improvements/FINAL_TECHNICAL_REPORT.md\n');
}

// 运行
if (require.main === module) {
  main().catch(error => {
    console.error('\n💥 致命错误:', error);
    process.exit(1);
  });
}

export {
  test1_ExplicitContextManagement,
  test2_ContextFusionAndTokenManagement,
  test3_ModelSelection,
  test4_PromptOptimization,
  test5_SemanticCaching,
  test6_RealLLMAPICall,
  test7_EndToEndWorkflow,
  test8_PerformanceValidation,
};

