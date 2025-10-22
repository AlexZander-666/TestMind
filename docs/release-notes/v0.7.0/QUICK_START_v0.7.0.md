# 🚀 TestMind v0.7.0 快速开始指南

**5 分钟上手 TestMind v0.7.0 的核心新功能**

---

## 📋 前置要求

- Node.js 20+
- pnpm 8+
- OpenAI API Key（用于 LLM 功能）
- Git（用于版本控制）

---

## ⚡ 1 分钟：显式上下文管理

### 概念

告别黑盒！精确控制 AI 看到的代码上下文。

### 快速使用

```typescript
import { createExplicitContextManager } from '@testmind/core';

// 创建管理器
const manager = createExplicitContextManager();

// 添加目标文件（显式控制）
manager.addFile('src/auth/AuthService.ts', chunks, {
  priority: 10,
  reason: 'Target for test generation'
});

// 设置聚焦范围
manager.setFocus(['src/auth', 'src/db']);

// 获取上下文快照
const snapshot = manager.getCurrentContext();
console.log(`上下文包含 ${snapshot.pinnedChunks.length} 个代码块`);
console.log(`估算 tokens: ${snapshot.estimatedTokens}`);
```

### 命令式交互（计划中）

```bash
# 添加文件到上下文
/add src/auth/AuthService.ts

# 聚焦特定目录
/focus src/auth

# 查看当前上下文
/context

# 清除上下文
/clear
```

---

## ⚡ 2 分钟：智能成本优化

### 场景：选择最佳模型

```typescript
import { createModelSelector } from '@testmind/core';

const selector = createModelSelector();

// 分析代码复杂度
const code = `/* 你的代码 */`;
const recommendation = selector.selectForTestGeneration(code);

console.log('推荐模型:', recommendation.model.model);
console.log('预估成本:', `$${recommendation.estimatedCost}`);
console.log('预期质量:', `${recommendation.expectedQuality}%`);
console.log('推荐理由:', recommendation.reasoning);
```

### 输出示例

```
推荐模型: gpt-4o-mini
预估成本: $0.0002
预期质量: 85%
推荐理由: 简单函数，使用 mini 模型即可获得良好效果
```

### 场景：Prompt 优化

```typescript
import { createPromptOptimizer } from '@testmind/core';

const optimizer = createPromptOptimizer({
  enableAbbreviation: true,
  enableStructureOptimization: true,
  enableDuplicateRemoval: true,
  aggressivenessLevel: 'balanced' // 'conservative' | 'balanced' | 'aggressive'
});

const result = await optimizer.optimize(prompt, contextChunks);

console.log('原始 tokens:', result.original.tokens);
console.log('优化后 tokens:', result.optimized.tokens);
console.log('节省比例:', `${result.savings.percentage}%`);
console.log('节省成本:', `$${result.savings.costSaved}`);
```

### 实测数据

```
原始 tokens: 3000
优化后 tokens: 1000
节省比例: 66.7%
节省成本: $0.006
```

---

## ⚡ 3 分钟：语义缓存

### 启用缓存

```typescript
import { createSemanticCache } from '@testmind/core';

// 创建缓存
const cache = createSemanticCache({
  maxSize: 1000,
  ttl: 3600000, // 1小时
  similarityThreshold: 0.85
});

// 使用缓存
const cacheKey = 'test_generation_auth_service';
const cached = await cache.get(cacheKey);

if (cached) {
  console.log('缓存命中！');
  return cached.value;
}

// 生成新结果
const result = await generateTest(code);

// 存入缓存
await cache.set(cacheKey, result);
```

### 缓存统计

```typescript
const stats = cache.getStats();
console.log(`命中率: ${stats.hitRate.toFixed(2)}%`);
console.log(`节省成本: $${stats.costSaved.toFixed(4)}`);
console.log(`节省时间: ${stats.timeSaved}ms`);
```

---

## ⚡ 4 分钟：上下文融合

### 混合显式和自动上下文

```typescript
import { 
  createExplicitContextManager,
  createContextFusion 
} from '@testmind/core';

// 1. 显式上下文（用户控制）
const explicitManager = createExplicitContextManager();
explicitManager.addFile('src/target.ts', chunks, { priority: 10 });

// 2. 自动上下文（语义搜索）
const autoResults = await hybridSearch.search({
  text: 'authentication logic',
  topK: 5
});

// 3. 智能融合
const fusion = createContextFusion();
const result = await fusion.fuseContexts(
  explicitManager.getCurrentContext().pinnedChunks,
  autoResults.map(r => r.chunk),
  {
    maxTokens: 8000,
    model: 'gpt-4o'
  }
);

console.log(`融合结果: ${result.selected.length} 个代码块`);
console.log(`显式: ${result.statistics.explicitCount}`);
console.log(`自动: ${result.statistics.autoCount}`);
console.log(`去重: ${result.statistics.duplicatesRemoved}`);
```

---

## ⚡ 5 分钟：Rich Diff 审查

### 启用 AI 辅助审查

```typescript
import { 
  createRichDiffUI,
  createDiffGenerator,
  LLMService 
} from '@testmind/core';

// 1. 生成 Diff
const diffGenerator = createDiffGenerator();
const diffs = await diffGenerator.generate(oldCode, newCode);

// 2. 创建 Rich UI
const llmService = new LLMService();
const diffUI = createRichDiffUI(llmService);

// 3. 显示审查界面
const decision = await diffUI.showReviewUI(diffs, {
  enableAIExplanation: true,
  enableRiskAssessment: true,
  enableIssueDetection: true,
  enableGrouping: true
});

if (decision.accepted) {
  console.log('用户接受了改动');
  // 应用改动
} else {
  console.log('用户拒绝了改动');
}
```

### 输出示例

```
╔════════════════════════════════════════╗
║  Diff 审查：src/auth/AuthService.ts  ║
╚════════════════════════════════════════╝

📝 AI 解释:
添加了密码验证的安全增强，使用 bcrypt 进行哈希比对

⚠️ 风险评估: 低风险
- 不影响现有功能
- 增强安全性
- 性能影响可忽略

🔍 潜在问题: 无

命令: [a]ccept, [r]eject, [s]kip, [q]uit
>
```

---

## 📚 完整工作流示例

### 端到端测试生成

```typescript
import {
  createExplicitContextManager,
  createModelSelector,
  createPromptOptimizer,
  createSemanticCache,
  createRichDiffUI,
  LLMService,
  TestGenerator
} from '@testmind/core';

async function generateTestWithFullOptimization(filePath: string) {
  // Step 1: 添加目标文件到上下文
  const contextManager = createExplicitContextManager();
  contextManager.addFile(filePath, chunks, { priority: 10 });
  
  // Step 2: 选择最佳模型
  const modelSelector = createModelSelector();
  const model = modelSelector.selectForTestGeneration(code);
  
  // Step 3: 优化 Prompt
  const optimizer = createPromptOptimizer();
  const optimizedPrompt = await optimizer.optimize(
    basePrompt,
    contextManager.getCurrentContext().pinnedChunks
  );
  
  // Step 4: 检查缓存
  const cache = createSemanticCache();
  const cacheKey = `test_${filePath}`;
  const cached = await cache.get(cacheKey);
  if (cached) return cached.value;
  
  // Step 5: 调用 LLM 生成
  const llm = new LLMService();
  const response = await llm.generate({
    provider: model.model.provider,
    model: model.model.model,
    prompt: optimizedPrompt.optimizedPrompt,
    temperature: 0.3,
    maxTokens: 1000
  });
  
  // Step 6: Rich Diff 审查
  const diffUI = createRichDiffUI(llm);
  const decision = await diffUI.showReviewUI([{
    filePath: `${filePath}.test.ts`,
    oldContent: '',
    newContent: response,
    type: 'create'
  }]);
  
  if (decision.accepted) {
    // 应用并缓存
    await cache.set(cacheKey, response);
    return response;
  }
  
  return null;
}
```

---

## 🔧 配置优化

### 环境变量

```bash
# LLM 配置
export OPENAI_API_KEY=sk-your-key-here
export OPENAI_API_BASE=https://api.openai.com/v1  # 可选

# 成本优化
export TESTMIND_ENABLE_PROMPT_OPTIMIZATION=true
export TESTMIND_ENABLE_SEMANTIC_CACHE=true
export TESTMIND_ENABLE_LOCAL_MODELS=false  # Ollama支持

# 上下文管理
export TESTMIND_MAX_CONTEXT_TOKENS=8000
export TESTMIND_CONTEXT_SIMILARITY_THRESHOLD=0.85
```

### 配置文件 `.testmindrc.json`

```json
{
  "llm": {
    "provider": "openai",
    "model": "gpt-4o",
    "maxTokens": 10000
  },
  "context": {
    "explicitControlEnabled": true,
    "autoSearchEnabled": true,
    "maxTokens": 8000
  },
  "optimization": {
    "enableModelSelection": true,
    "enablePromptOptimization": true,
    "enableSemanticCache": true,
    "aggressivenessLevel": "balanced"
  },
  "ui": {
    "enableRichDiff": true,
    "enableAIExplanation": true,
    "enableRiskAssessment": true
  }
}
```

---

## 📊 性能监控

### 获取成本统计

```typescript
import { createCostTracker } from '@testmind/core';

const tracker = createCostTracker();

// 追踪每次调用
tracker.track({
  model: 'gpt-4o-mini',
  inputTokens: 1000,
  outputTokens: 500,
  operation: 'test_generation'
});

// 获取统计
const stats = tracker.getStatistics();
console.log(`总成本: $${stats.totalCost}`);
console.log(`总调用: ${stats.totalCalls}`);
console.log(`平均成本: $${stats.averageCost}`);

// 按操作分组
const byOp = tracker.getStatisticsByOperation();
console.log('按操作统计:', byOp);
```

---

## 🐛 故障排查

### 常见问题

**Q: 无法导入新模块**

A: 确保已重新构建：
```bash
pnpm build
```

**Q: 上下文管理器返回空结果**

A: 检查文件路径和代码块是否正确添加：
```typescript
const snapshot = manager.getCurrentContext();
console.log('代码块数:', snapshot.pinnedChunks.length);
```

**Q: 成本优化器没有生效**

A: 确认配置已启用：
```typescript
const optimizer = createPromptOptimizer({
  enableAbbreviation: true,
  enableStructureOptimization: true
});
```

**Q: Diff UI 显示异常**

A: 检查 LLM 服务配置：
```typescript
const llm = new LLMService();
// 确保 API Key 已设置
```

---

## 💡 最佳实践

### DO ✅

- ✅ 使用显式上下文控制关键代码
- ✅ 启用 Prompt 优化降低成本
- ✅ 配置语义缓存避免重复调用
- ✅ 使用 Rich Diff UI 审查所有改动
- ✅ 监控成本统计优化配置

### DON'T ❌

- ❌ 不要禁用所有优化（除非调试）
- ❌ 不要跳过 Diff 审查
- ❌ 不要忽略成本统计
- ❌ 不要添加过多低优先级上下文
- ❌ 不要使用过小的缓存大小

---

## 📞 获取帮助

- 📖 [完整发布说明](./RELEASE_NOTES_v0.7.0.md)
- 📖 [详细变更日志](./CHANGELOG_v0.7.0.md)
- 📖 [升级指南](./MIGRATION_GUIDE_v0.6_to_v0.7.md)
- 💬 [GitHub Discussions](https://github.com/yourusername/testmind/discussions)
- 🐛 [报告 Bug](https://github.com/yourusername/testmind/issues)

---

## 🎯 下一步

1. 浏览[完整示例代码](../../../examples/v0.7.0-complete-workflow/)
2. 运行[功能验证脚本](../../../scripts/test-v0.7.0-features.ts)
3. 阅读[技术报告](../../../docs/technical-improvements/FINAL_TECHNICAL_REPORT.md)了解深层原理

---

**开始探索 TestMind v0.7.0！** 🎉

**TestMind Team**  
2025年10月22日

