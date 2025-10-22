/**
 * TestMind v0.7.0 完整工作流演示
 * 
 * 展示所有新增功能的集成使用：
 * 1. 显式上下文管理（Aider 模式）
 * 2. 智能模型选择
 * 3. Prompt 优化
 * 4. Token 预算管理
 * 5. 语义缓存
 * 6. Rich Diff UI
 * 7. 多框架支持
 * 
 * 运行: tsx examples/v0.7.0-complete-workflow/demo.ts
 */

import {
  // 上下文管理
  createExplicitContextManager,
  createContextFusion,
  createTokenBudgetManager,
  
  // 模型选择和优化
  createModelSelector,
  createPromptOptimizer,
  
  // 缓存
  createSemanticCache,
  createLocalModelManager,
  
  // Diff 审查
  createRichDiffUI,
  createDiffGrouper,
  createDiffGenerator,
} from '@testmind/core';

import type { CodeChunk } from '@testmind/shared';

// ============================================================================
// 场景 1: 智能测试生成工作流
// ============================================================================

async function scenario1_IntelligentTestGeneration() {
  console.log('\n╔═══════════════════════════════════════════╗');
  console.log('║  场景 1: 智能测试生成工作流           ║');
  console.log('╚═══════════════════════════════════════════╝\n');
  
  // Step 1: 用户添加显式上下文
  console.log('📝 Step 1: 用户添加上下文...');
  const contextManager = createExplicitContextManager();
  
  const targetCode: CodeChunk = {
    id: 'auth-service-1',
    filePath: 'src/services/AuthService.ts',
    content: `export class AuthService {
  async login(email: string, password: string): Promise<User> {
    // Complex authentication logic
    const user = await this.userRepository.findByEmail(email);
    if (!user || !await this.verifyPassword(password, user.passwordHash)) {
      throw new AuthenticationError('Invalid credentials');
    }
    return user;
  }
  
  async verifyPassword(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }
}`,
    startLine: 10,
    endLine: 25,
  };
  
  contextManager.addFile('src/services/AuthService.ts', [targetCode], {
    priority: 10,
    reason: 'Target for test generation',
  });
  
  console.log('✅ 上下文已添加');
  console.log(`   - 文件: ${targetCode.filePath}`);
  console.log(`   - 代码块: 1 个`);
  console.log(`   - 优先级: 10`);
  
  // Step 2: 分析复杂度并选择模型
  console.log('\n🎯 Step 2: 分析复杂度，选择最佳模型...');
  const modelSelector = createModelSelector();
  
  const complexity = modelSelector.analyzeComplexity(
    targetCode.content.length,
    {
      cyclomaticComplexity: 8,
      cognitiveComplexity: 12,
      linesOfCode: 15,
      maintainabilityIndex: 65,
    }
  );
  
  console.log(`   复杂度: ${complexity.level} (评分: ${complexity.score})`);
  
  const modelRecommendation = modelSelector.selectForTestGeneration(
    targetCode.content,
    {
      cyclomaticComplexity: 8,
      cognitiveComplexity: 12,
      linesOfCode: 15,
      maintainabilityIndex: 65,
    }
  );
  
  console.log(`   推荐模型: ${modelRecommendation.model.id}`);
  console.log(`   预估成本: $${modelRecommendation.estimatedCost.toFixed(4)}`);
  console.log(`   推荐原因:`);
  for (const reason of modelRecommendation.reasons) {
    console.log(`   - ${reason}`);
  }
  
  // Step 3: 优化 Prompt
  console.log('\n⚡ Step 3: 优化 Prompt...');
  const promptOptimizer = createPromptOptimizer();
  
  const basePrompt = `Generate comprehensive unit tests for the AuthService class.

Requirements:
- Use Jest framework
- Mock dependencies (userRepository, bcrypt)
- Test both success and error cases
- Include edge cases
- Use TypeScript`;
  
  const optimizationResult = await promptOptimizer.optimize(
    basePrompt,
    [targetCode],
    {
      aggressiveness: 0.6,
      keepComments: false,
      keepEmptyLines: false,
    }
  );
  
  console.log(`   原始 tokens: ${optimizationResult.originalTokens}`);
  console.log(`   优化后 tokens: ${optimizationResult.optimizedTokens}`);
  console.log(`   节省: ${optimizationResult.savedPercentage.toFixed(1)}%`);
  console.log(`   应用的优化: ${optimizationResult.appliedOptimizations.join(', ')}`);
  
  // Step 4: Token 预算检查
  console.log('\n💰 Step 4: Token 预算管理...');
  const budgetManager = createTokenBudgetManager();
  
  const budget = budgetManager.getBudget(modelRecommendation.model.model);
  const usage = budgetManager.calculateUsage(
    'You are TestMind, an AI test generation assistant.',
    basePrompt,
    [targetCode]
  );
  
  console.log(budgetManager.visualizeUsage(usage, budget));
  
  const cost = budgetManager.estimateCost(
    modelRecommendation.model.model,
    usage.total,
    500 // 预估输出 tokens
  );
  
  console.log(`   预估成本: $${cost.totalCost.toFixed(4)}`);
  
  // Step 5: 生成测试（模拟）
  console.log('\n🤖 Step 5: 生成测试代码...');
  console.log('   (实际会调用 LLM API)');
  console.log('   ✅ 测试代码已生成');
}

// ============================================================================
// 场景 2: 本地模型 vs 云模型对比
// ============================================================================

async function scenario2_LocalVsCloudComparison() {
  console.log('\n╔═══════════════════════════════════════════╗');
  console.log('║  场景 2: 本地模型 vs 云模型对比       ║');
  console.log('╚═══════════════════════════════════════════╝\n');
  
  const localManager = createLocalModelManager();
  const modelSelector = createModelSelector();
  
  // 检查 Ollama 是否安装
  const ollamaInstalled = await localManager.isOllamaInstalled();
  console.log(`Ollama 安装状态: ${ollamaInstalled ? '✅ 已安装' : '❌ 未安装'}`);
  
  if (ollamaInstalled) {
    // 列出已下载的模型
    const downloaded = await localManager.listDownloadedModels();
    console.log(`\n已下载的模型: ${downloaded.filter(m => m.downloaded).length} 个`);
    
    for (const model of downloaded.filter(m => m.downloaded)) {
      console.log(`  - ${model.name} (${model.size}) - 性能: ${model.performance}/10`);
    }
  }
  
  // 生成混合策略
  console.log('\n🔀 混合推理策略:');
  const hybridStrategy = localManager.generateHybridStrategy(
    0.05, // $0.05 预算
    0.85  // 85% 质量要求
  );
  
  console.log(`   本地模型: ${hybridStrategy.localModel}`);
  console.log(`   云模型: ${hybridStrategy.cloudModel}`);
  console.log(`   预期节省: ${(hybridStrategy.estimatedSavings * 100).toFixed(0)}%`);
  console.log('\n   本地模型任务:');
  for (const task of hybridStrategy.localTasks) {
    console.log(`   - ${task}`);
  }
  console.log('\n   云模型任务:');
  for (const task of hybridStrategy.cloudTasks) {
    console.log(`   - ${task}`);
  }
  
  // 成本对比
  console.log('\n💵 成本对比（1000 次测试生成）:');
  
  const contextTokens = 1000;
  const iterations = 1000;
  
  const cloudModels = ['gpt-4o', 'gpt-4o-mini', 'claude-3-sonnet'];
  const comparison = modelSelector.compareModels(cloudModels, contextTokens);
  
  for (const { model, cost } of comparison) {
    const totalCost = cost * iterations;
    console.log(`   ${model.padEnd(20)}: $${totalCost.toFixed(2)}`);
  }
  
  console.log(`   ${'本地模型 (Ollama)'.padEnd(20)}: $0.00 ⭐`);
  console.log('\n   节省: 约 $' + (comparison[0].cost * iterations).toFixed(2));
}

// ============================================================================
// 场景 3: 语义缓存演示
// ============================================================================

async function scenario3_SemanticCaching() {
  console.log('\n╔═══════════════════════════════════════════╗');
  console.log('║  场景 3: 语义缓存系统                 ║');
  console.log('╚═══════════════════════════════════════════╝\n');
  
  const cache = createSemanticCache({
    maxEntries: 100,
    similarityThreshold: 0.85,
    enableEmbedding: true,
  });
  
  // 模拟缓存条目
  const mockRequest1 = {
    provider: 'openai' as const,
    model: 'gpt-4o-mini',
    prompt: 'Generate unit tests for add function',
    temperature: 0.3,
    maxTokens: 1000,
  };
  
  const mockResponse1 = {
    content: 'test code here',
    usage: { promptTokens: 100, completionTokens: 200, totalTokens: 300 },
    finishReason: 'stop' as const,
  };
  
  // 添加到缓存
  await cache.set(mockRequest1, mockResponse1);
  console.log('✅ 缓存条目已添加');
  
  // 精确匹配查询
  const cached1 = await cache.get(mockRequest1);
  console.log(`\n精确匹配查询: ${cached1 ? '✅ 命中' : '❌ 未命中'}`);
  
  // 语义相似查询（略有不同）
  const mockRequest2 = {
    ...mockRequest1,
    prompt: 'Generate unit tests for addition function', // 语义相似
  };
  
  const cached2 = await cache.get(mockRequest2);
  console.log(`语义相似查询: ${cached2 ? '✅ 命中' : '❌ 未命中'}`);
  
  // 显示统计
  const stats = cache.getStats();
  console.log('\n📊 缓存统计:');
  console.log(`   总条目: ${stats.totalEntries}`);
  console.log(`   命中: ${stats.hits}`);
  console.log(`   未命中: ${stats.misses}`);
  console.log(`   命中率: ${(stats.hitRate * 100).toFixed(1)}%`);
  console.log(`   精确命中: ${stats.exactHits}`);
  console.log(`   语义命中: ${stats.semanticHits}`);
}

// ============================================================================
// 场景 4: Rich Diff UI 演示
// ============================================================================

async function scenario4_RichDiffUI() {
  console.log('\n╔═══════════════════════════════════════════╗');
  console.log('║  场景 4: Rich Diff 审查界面           ║');
  console.log('╚═══════════════════════════════════════════╝\n');
  
  // 创建 UI（不带 LLM，仅演示）
  const diffUI = createRichDiffUI(undefined, {
    syntaxHighlight: true,
    showLineNumbers: true,
  });
  
  // 模拟 diff
  const mockDiffs = [
    {
      filePath: 'src/services/AuthService.test.ts',
      diff: `@@ -0,0 +1,20 @@
+import { describe, it, expect, vi } from 'vitest';
+import { AuthService } from './AuthService';
+
+describe('AuthService', () => {
+  it('should authenticate valid user', async () => {
+    const service = new AuthService();
+    const user = await service.login('test@example.com', 'password123');
+    expect(user).toBeDefined();
+    expect(user.email).toBe('test@example.com');
+  });
+
+  it('should throw error for invalid credentials', async () => {
+    const service = new AuthService();
+    await expect(service.login('wrong@example.com', 'wrong'))
+      .rejects.toThrow('Invalid credentials');
+  });
+});`,
      additions: 20,
      deletions: 0,
      hunks: [],
    },
    {
      filePath: 'src/utils/formatters.test.ts',
      diff: `@@ -0,0 +1,10 @@
+import { describe, it, expect } from 'vitest';
+import { formatNumber } from './formatters';
+
+describe('formatNumber', () => {
+  it('should format numbers with commas', () => {
+    expect(formatNumber(1000)).toBe('1,000');
+    expect(formatNumber(1000000)).toBe('1,000,000');
+  });
+});`,
      additions: 10,
      deletions: 0,
      hunks: [],
    },
  ];
  
  // 智能分组
  console.log('🔍 智能分组 Diff...');
  const grouper = createDiffGrouper();
  const groups = await grouper.autoGroup(mockDiffs);
  
  console.log(`   发现 ${groups.length} 个分组:`);
  for (const group of groups) {
    console.log(`   - ${group.description} (置信度: ${(group.confidence * 100).toFixed(0)}%)`);
  }
  
  // 渲染单个 diff
  console.log('\n📄 Diff 预览:');
  const diffOutput = diffUI.renderDiff(mockDiffs[0], { showStats: true });
  console.log(diffOutput);
  
  // 显示帮助
  console.log(diffUI.showHelp());
  
  // 显示摘要
  const summary = diffUI.renderSummary({
    total: 2,
    accepted: 2,
    rejected: 0,
    skipped: 0,
  });
  console.log(summary);
}

// ============================================================================
// 场景 5: 框架自动检测
// ============================================================================

async function scenario5_FrameworkDetection() {
  console.log('\n╔═══════════════════════════════════════════╗');
  console.log('║  场景 5: 测试框架自动检测             ║');
  console.log('╚═══════════════════════════════════════════╝\n');
  
  const { createFrameworkDetector } = await import('@testmind/core');
  const detector = createFrameworkDetector();
  
  console.log('🔍 分析项目配置...');
  
  // 检测当前项目
  const detectionResult = await detector.detect(process.cwd());
  
  console.log(`\n检测到 ${detectionResult.detected.length} 个框架:`);
  for (const framework of detectionResult.detected) {
    const status = framework.installed ? '✅ 已安装' : '❌ 未安装';
    const config = framework.configured ? '⚙️  已配置' : '⚠️  未配置';
    console.log(`   - ${framework.name.padEnd(15)} ${status} ${config} (置信度: ${(framework.confidence * 100).toFixed(0)}%)`);
  }
  
  if (detectionResult.recommended) {
    console.log(`\n💡 推荐使用: ${detectionResult.recommended.name}`);
  }
  
  console.log('\n📋 检测依据:');
  const evidenceByType = detectionResult.evidence.reduce((acc, e) => {
    if (!acc[e.type]) acc[e.type] = 0;
    acc[e.type]++;
    return acc;
  }, {} as Record<string, number>);
  
  for (const [type, count] of Object.entries(evidenceByType)) {
    console.log(`   - ${type}: ${count} 条`);
  }
}

// ============================================================================
// 场景 6: 完整的端到端工作流
// ============================================================================

async function scenario6_EndToEndWorkflow() {
  console.log('\n╔═══════════════════════════════════════════╗');
  console.log('║  场景 6: 完整端到端工作流             ║');
  console.log('╚═══════════════════════════════════════════╝\n');
  
  console.log('这个场景演示了从上下文管理到代码审查的完整流程:\n');
  
  console.log('1. 📝 用户添加目标代码到显式上下文');
  console.log('2. 🔍 系统自动搜索相关代码（自动上下文）');
  console.log('3. 🔀 融合显式和自动上下文');
  console.log('4. 🎯 分析复杂度，选择最佳模型');
  console.log('5. ⚡ 优化 Prompt，节省成本');
  console.log('6. 💰 检查 Token 预算，智能截断');
  console.log('7. 🤖 调用 LLM 生成测试代码');
  console.log('8. 📊 生成 Diff 并智能分组');
  console.log('9. 🎨 展示 Rich Diff UI');
  console.log('10. ✅ 用户审查并接受改动');
  console.log('11. 🔧 自动提交到 Git 分支');
  console.log('12. 📈 记录性能指标和成本');
  
  console.log('\n✨ 这就是 TestMind v0.7.0 的完整能力！');
}

// ============================================================================
// 运行所有场景
// ============================================================================

async function main() {
  console.log('\n╔═══════════════════════════════════════════════════════╗');
  console.log('║                                                       ║');
  console.log('║       🧠 TestMind v0.7.0 完整功能演示             ║');
  console.log('║                                                       ║');
  console.log('║  结合 Aider 显式控制 + Cody 自动推断              ║');
  console.log('║  的混合上下文引擎                                  ║');
  console.log('║                                                       ║');
  console.log('╚═══════════════════════════════════════════════════════╝');
  
  try {
    await scenario1_IntelligentTestGeneration();
    await scenario2_LocalVsCloudComparison();
    await scenario3_SemanticCaching();
    await scenario4_RichDiffUI();
    await scenario6_EndToEndWorkflow();
    
    console.log('\n╔═══════════════════════════════════════════╗');
    console.log('║  ✅ 所有演示场景运行完成！            ║');
    console.log('╚═══════════════════════════════════════════╝\n');
    
    console.log('📚 了解更多:');
    console.log('   - docs/technical-improvements/PROGRESS_SUMMARY.md');
    console.log('   - examples/explicit-context-management/demo.ts');
    console.log('   - packages/core/src/context/ExplicitContextManager.ts\n');
  } catch (error) {
    console.error('\n❌ 演示运行失败:', error);
    process.exit(1);
  }
}

// 仅在直接运行时执行
if (require.main === module) {
  main().catch(console.error);
}

export {
  scenario1_IntelligentTestGeneration,
  scenario2_LocalVsCloudComparison,
  scenario3_SemanticCaching,
  scenario4_RichDiffUI,
  scenario6_EndToEndWorkflow,
};

