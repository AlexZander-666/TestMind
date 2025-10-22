# 🚀 TestMind v0.6.0 快速开始指南

**5 分钟上手 TestMind v0.6.0 的核心新功能**

---

## 📋 前置要求

- Node.js 20+
- pnpm 8+
- OpenAI API Key（用于 LLM 功能）
- Playwright 或 Cypress（用于自愈功能）

---

## ⚡ 1 分钟：自愈引擎

### 安装

```bash
cd testmind
pnpm install
pnpm build
```

### 运行自愈

```bash
# 运行测试（生成报告）
pnpm test --reporter=json --outputFile=test-results.json

# 自动修复失败的测试
testmind heal --report test-results.json
```

### 输出示例

```
🏥 TestMind Self-Healing Engine

✓ Found 5 failed tests

Analyzing failures...
  ✓ test1: Classified as test_fragility (confidence: 88%)
  ✓ test2: Classified as environment_issue (confidence: 95%)
  ✓ test3: Classified as real_bug (confidence: 90%)

📊 Healing Results:
  Total Failures: 5
  Auto-Healed: 2 (40%)
  Needs Review: 2
  Cannot Fix: 1 (real bug)

💡 Healing Suggestions:
1. should click submit button
   Classification: test_fragility
   Confidence: 88%
   Suggestion: Replace #submit-btn with [data-testid="submit"]
```

---

## ⚡ 2 分钟：向量搜索

### 初始化索引

```bash
# 设置 API Key
export OPENAI_API_KEY=sk-your-key-here

# 初始化项目（生成向量索引）
testmind init

# 输出:
# Analyzing 100 files...
# Creating 850 code chunks...
# Generating embeddings...
# Progress: 100% (850/850)
# 
# Cost: $0.0034
# Duration: 85s
# Index created: .testmind/vectors/
```

### 使用搜索

```typescript
import { createEnhancedVectorStore, createHybridSearchEngine } from '@testmind/core';

// 1. 加载向量存储
const vectorStore = createEnhancedVectorStore();
await vectorStore.initialize();

// 2. 创建混合搜索
const hybridSearch = createHybridSearchEngine(vectorStore, dependencyGraph);

// 3. 搜索相关代码
const results = await hybridSearch.search({
  text: 'user authentication logic',
  topK: 5,
});

// 4. 查看结果
results.forEach(r => {
  console.log(`${r.chunk.name}: ${r.score.toFixed(3)}`);
});
```

---

## ⚡ 3 分钟：CI/CD 自动化

### GitHub Actions 集成

**步骤 1**: 复制工作流

```bash
cp .github/workflows/testmind-auto-heal.yml your-project/.github/workflows/
```

**步骤 2**: 添加 Secret

1. 进入 GitHub 仓库 `Settings` → `Secrets`
2. 添加 `OPENAI_API_KEY`

**步骤 3**: 推送代码

```bash
git add .github/workflows/testmind-auto-heal.yml
git commit -m "feat: add TestMind auto-heal workflow"
git push
```

**步骤 4**: 查看结果

- PR 中会自动显示自愈结果
- Actions 标签页查看详细日志
- Artifacts 下载完整报告

---

## ⚡ 4 分钟：覆盖率分析

### 分析未覆盖代码

```bash
# 1. 生成覆盖率报告
pnpm test --coverage --coverageReporters=json

# 2. 分析缺口
testmind coverage analyze \
  --report coverage/coverage-final.json \
  --output coverage-gaps.md

# 3. 查看报告
cat coverage-gaps.md
```

### 输出示例

```markdown
# 📊 Coverage Analysis Report

**Overall Coverage**: 85.5%
**Uncovered Functions**: 42

## 🎯 High Priority (8)

### authenticateUser
**Priority**: 95/100
**Estimated Effort**: 25 minutes

**Test Cases**:
- Test successful authentication
- Test invalid credentials
- Test token generation

**Mock Requirements**:
- Database connection
- Session store

**Edge Cases**:
- Empty credentials
- SQL injection attempt
```

---

## ⚡ 5 分钟：成本优化

### 使用成本优化器

```typescript
import { createCostOptimizer, createCostTracker } from '@testmind/core';

// 1. 创建优化器
const optimizer = createCostOptimizer(hybridSearch);

// 2. 选择最优模型
const selection = optimizer.selectModel({
  functionName: 'processData',
  complexity: 12,
  functionCode: '...',
  filePath: 'src/data.ts',
});

console.log(`Model: ${selection.model}`);
console.log(`Cost: $${selection.estimatedCost}`);
console.log(`Quality: ${selection.expectedQuality}%`);

// 3. 追踪成本
const tracker = createCostTracker();

tracker.track({
  model: 'gpt-4o-mini',
  inputTokens: 1000,
  outputTokens: 500,
  operation: 'test_generation',
});

console.log(`Total: $${tracker.getTotalCost()}`);
```

---

## 📚 下一步

### 深入学习

1. **自愈引擎**:
   - [Self-Healing Advanced Guide](docs/guides/self-healing-advanced.md)
   - [Browser Adapters](packages/core/src/self-healing/adapters/)
   - [Locator Strategies](packages/core/src/self-healing/strategies/)

2. **向量搜索**:
   - [Vector Database Setup](docs/guides/vector-database-setup.md)
   - [Hybrid Search](packages/core/src/context/HybridSearchEngine.ts)
   - [RRF Algorithm](docs/guides/vector-database-setup.md#rrf-算法详解)

3. **CI/CD**:
   - [GitHub Actions Example](.github/workflows/testmind-auto-heal.yml)
   - [GitLab CI Example](.gitlab-ci.testmind.yml)
   - [Integration Guide](examples/v0.6.0-features/ci-cd-integration-example.md)

### 运行示例

```bash
# 自愈示例
tsx examples/v0.6.0-features/self-healing-example.ts

# 向量搜索示例
tsx examples/v0.6.0-features/vector-search-example.ts

# 验证所有功能
tsx scripts/validate-v0.6.0.ts
```

---

## 🐛 故障排查

### 常见问题

**Q: 导入错误 "Cannot find module '@testmind/core'"**

A: 确保已构建项目：
```bash
pnpm build
```

**Q: "OPENAI_API_KEY is not defined"**

A: 设置环境变量：
```bash
export OPENAI_API_KEY=sk-your-key-here
```

**Q: Playwright 相关错误**

A: 安装 Playwright：
```bash
pnpm add playwright
npx playwright install chromium
```

**Q: "VectorStore initialization failed"**

A: 创建目录：
```bash
mkdir -p .testmind/vectors
```

---

## 💡 最佳实践

### DO ✅

- 在 CI 中启用自愈（`--ci --auto-commit`）
- 使用向量搜索提升上下文相关性
- 定期分析覆盖率缺口
- 监控性能回归
- 使用成本优化器降低 LLM 成本

### DON'T ❌

- 不要跳过失败分类（很重要！）
- 不要盲目接受所有自动修复
- 不要忽略真实 Bug
- 不要在本地运行大规模 Embedding 生成（成本）
- 不要禁用规则引擎（免费且准确）

---

## 📞 获取帮助

- 📖 [完整文档](docs/)
- 💬 [GitHub Discussions](https://github.com/yourusername/testmind/discussions)
- 🐛 [报告 Bug](https://github.com/yourusername/testmind/issues)
- 📧 Email: support@testmind.dev

---

**开始探索 TestMind v0.6.0！** 🎉














