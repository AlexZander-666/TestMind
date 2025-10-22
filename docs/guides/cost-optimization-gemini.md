# Gemini 成本优化指南

> 🎯 使用 Google Gemini 实现 70-80% 成本节省

## 📊 成本对比

### LLM 成本（每 1M tokens）

| 模型 | 输入价格 | 输出价格 | 总成本（估算）| 相对 GPT-4o |
|------|---------|---------|-------------|-------------|
| **Gemini 1.5 Flash** | $0.075 | $0.30 | $0.19 | **-96%** |
| **Gemini 1.5 Pro** | $3.50 | $10.50 | $7.00 | **-65%** |
| GPT-4o-mini | $0.15 | $0.60 | $0.38 | -92% |
| GPT-4o | $5.00 | $15.00 | $10.00 | 基准 |
| Claude 3.5 Sonnet | $3.00 | $15.00 | $9.00 | -10% |

### Embedding 成本（每 1M tokens）

| 模型 | 价格 | 相对 OpenAI |
|------|------|------------|
| **Gemini text-embedding-004** | $0.00025 | **-99%** |
| OpenAI text-embedding-3-small | $0.02 | 基准 |
| OpenAI text-embedding-3-large | $0.13 | +550% |

### 实际场景成本对比

#### 场景 1：生成 100 个单元测试

假设：
- 每个测试上下文：2K tokens
- 每个测试输出：1K tokens
- 总输入：200K tokens
- 总输出：100K tokens

| 模型 | 成本 | 节省 |
|------|------|------|
| Gemini 1.5 Flash | **$0.045** | **基准** |
| GPT-4o-mini | $0.090 | +100% |
| GPT-4o | $1.50 | +3233% |

#### 场景 2：为 1000 个函数生成 embeddings

假设：每个函数平均 500 tokens

| 模型 | 成本 | 节省 |
|------|------|------|
| **Gemini text-embedding-004** | **$0.000125** | **基准** |
| OpenAI text-embedding-3-small | $0.01 | +7900% |

---

## 🚀 快速开始

### 1. 获取 Gemini API Key

访问 [Google AI Studio](https://ai.google.dev/)：

1. 登录 Google 账号
2. 点击 "Get API Key"
3. 创建新项目或选择现有项目
4. 复制 API Key

### 2. 配置 TestMind

**方式 1：环境变量（推荐）**

```bash
export GOOGLE_API_KEY=your-api-key-here
```

**方式 2：.env 文件**

```bash
# .env
GOOGLE_API_KEY=your-api-key-here
GEMINI_MODEL=gemini-1.5-flash  # 默认模型
```

### 3. 使用 Gemini

TestMind 会自动选择最合适的模型。如需强制使用 Gemini：

```bash
# 使用 Gemini Flash（最便宜，推荐）
GEMINI_MODEL=gemini-1.5-flash testmind generate src/utils.ts

# 使用 Gemini Pro（复杂任务）
GEMINI_MODEL=gemini-1.5-pro testmind generate src/complex-logic.ts
```

---

## 💡 最佳实践

### 何时使用 Flash vs Pro？

#### ✅ Gemini 1.5 Flash（推荐大部分场景）

适用于：
- ✅ 单元测试生成（简单 → 中等复杂度）
- ✅ 代码重构建议
- ✅ API 测试生成
- ✅ 文档生成
- ✅ 代码注释

优势：
- 💰 成本极低（$0.075/1M tokens）
- ⚡ 速度快
- 🎯 质量足够好（能力评分：7.5/10）

**成本效益**：对于 90% 的测试生成任务，Flash 已足够

#### 🔥 Gemini 1.5 Pro

适用于：
- 🎯 复杂业务逻辑测试
- 🏗️ 架构分析
- 🐛 复杂 bug 调试
- 📊 大型上下文（>50K tokens）
- 🧩 需要深度推理的任务

优势：
- 🧠 更强的推理能力（能力评分：9/10）
- 📖 超大上下文窗口（1M tokens）
- 🎯 复杂任务质量更高

**成本效益**：仅在 Flash 无法胜任时使用

---

## 🔧 高级配置

### 自定义模型选择策略

修改 `.testmind/config.json`：

```json
{
  "llm": {
    "defaultProvider": "google",
    "preferredModels": {
      "simple": "gemini-1.5-flash",
      "complex": "gemini-1.5-pro"
    },
    "costOptimization": {
      "enabled": true,
      "maxCostPerTest": 0.01  // $0.01 per test
    }
  }
}
```

### 成本监控

TestMind 自动追踪 LLM 成本：

```bash
# 查看累计成本
testmind stats --cost

# 输出示例：
# Total LLM Cost: $2.45
# - Gemini Flash: $1.80 (120 requests)
# - Gemini Pro: $0.65 (15 requests)
# 
# Embedding Cost: $0.000125
# - Gemini text-embedding-004: $0.000125 (500 embeddings)
```

---

## 📈 成本优化技巧

### 1. 使用语义缓存

TestMind 内置三层缓存，可避免重复调用 LLM：

```json
{
  "cache": {
    "enabled": true,
    "ttl": 86400,  // 24 hours
    "semanticSimilarityThreshold": 0.9
  }
}
```

**成本节省**：60%+ 缓存命中率 → 减少 60% API 调用

### 2. Prompt 压缩

启用 AST 级别 Prompt 压缩：

```json
{
  "promptOptimization": {
    "enabled": true,
    "compression": "ast",  // AST-based compression
    "targetReduction": 0.5  // 目标：减少 50% tokens
  }
}
```

**成本节省**：40-60% token 减少

### 3. 批量处理

使用批量生成模式：

```bash
# 批量生成测试（一次 LLM 调用）
testmind generate src/**/*.ts --batch

# vs 单个生成（多次调用）
testmind generate src/a.ts src/b.ts src/c.ts
```

**成本节省**：减少 API 往返，提高吞吐量

### 4. 智能 Embedding

仅为变更的代码重新生成 embedding：

```json
{
  "embeddings": {
    "provider": "gemini",
    "incremental": true,  // 只重新索引变更文件
    "batchSize": 100
  }
}
```

**成本节省**：避免重复 embedding 生成

---

## 🎯 综合成本优化方案

结合所有优化技巧，可实现 **80-90% 综合成本节省**：

| 优化措施 | 节省幅度 |
|---------|---------|
| 使用 Gemini Flash 替代 GPT-4o | -96% |
| 使用 Gemini Embeddings | -99% |
| 语义缓存 | -60% |
| Prompt 压缩 | -50% |
| 批量处理 | -30% |

**实际案例**：

```
项目：1000 个函数
任务：生成单元测试 + embedding

原方案（GPT-4o + OpenAI Embeddings）：
- LLM: $150.00
- Embeddings: $0.01
- 总计: $150.01

优化方案（Gemini + 缓存 + 压缩）：
- LLM: $4.50 (Flash + 缓存 60% + 压缩 50%)
- Embeddings: $0.000125
- 总计: $4.50

节省: $145.51 (97%)
```

---

## 🚧 常见问题

### Q1: Gemini 质量比 GPT-4o 差吗？

**A**: 对于测试生成任务，Gemini Flash 质量已足够好：
- 简单测试：Flash ≈ GPT-4o-mini
- 复杂测试：Pro ≈ GPT-4o
- 成本效益：Gemini 远优于 OpenAI

### Q2: 如何在 Gemini 和 OpenAI 之间切换？

**A**: 两种方式：

1. 环境变量：
   ```bash
   # 使用 Gemini
   export GOOGLE_API_KEY=xxx
   
   # 使用 OpenAI
   export OPENAI_API_KEY=xxx
   ```

2. 配置文件：
   ```json
   {
     "llm": {
       "defaultProvider": "google"  // 或 "openai"
     }
   }
   ```

### Q3: Gemini API 有速率限制吗？

**A**: 是的，但很宽松：
- Free tier: 15 RPM (requests per minute)
- Paid tier: 360 RPM

TestMind 自动处理速率限制（重试 + 指数退避）

### Q4: 可以混合使用不同模型吗？

**A**: 可以！TestMind 支持智能模型路由：

```json
{
  "llm": {
    "routing": {
      "simple-test": "gemini-1.5-flash",
      "complex-test": "gemini-1.5-pro",
      "architecture": "gpt-4o"  // 极复杂任务仍用 GPT-4o
    }
  }
}
```

---

## 📚 相关文档

- [Gemini API 文档](https://ai.google.dev/docs)
- [TestMind LLM 配置指南](./llm-configuration.md)
- [成本监控与分析](../api-reference/cost-tracking.md)

---

## 💬 反馈与支持

遇到问题或有建议？

- 📧 Email: support@testmind.dev
- 💬 Discord: [TestMind Community](https://discord.gg/testmind)
- 🐛 Issues: [GitHub Issues](https://github.com/yourusername/testmind/issues)

---

**更新日期**: 2025-10-23  
**适用版本**: TestMind v0.9.0+


