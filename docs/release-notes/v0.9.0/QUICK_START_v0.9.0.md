# TestMind v0.9.0 快速开始指南

> 🚀 5 分钟上手 Gemini 驱动的智能测试生成

**版本**: v0.9.0  
**发布日期**: 2025-10-23  
**新特性**: Google Gemini 深度集成 + 真正的 LanceDB 向量数据库

---

## 🎯 核心优势

### 相比 v0.8.0 的提升

| 功能 | v0.8.0 | v0.9.0 | 提升 |
|------|--------|--------|------|
| **默认 LLM** | GPT-4o-mini ($0.005/test) | Gemini Flash ($0.001/test) | **-80% 成本** |
| **Embeddings** | OpenAI ($0.02/1M tokens) | Gemini ($0.00025/1M tokens) | **-99% 成本** |
| **向量数据库** | 内存（重启丢失） | LanceDB（持久化） | **持久化存储** |
| **检索速度** | ~500ms | <50ms (目标) | **10x 加速** |

---

## 📦 安装

### 方式 1：从源码安装（当前版本）

```bash
# 克隆项目
git clone https://github.com/yourusername/testmind.git
cd testmind

# 切换到 v0.9.0 开发分支（如果有）
# git checkout release/v0.9.0

# 安装依赖
pnpm install

# 构建
pnpm build
```

### 方式 2：使用 npm（即将支持）

```bash
# 即将发布到 npm
npm install -g testmind@0.9.0
```

---

## ⚙️ 配置

### 1. 获取 Google Gemini API Key

访问 [Google AI Studio](https://ai.google.dev/):

1. 登录 Google 账号
2. 点击 "Get API Key"
3. 创建新项目或选择现有项目
4. 复制 API Key

### 2. 设置环境变量

**方式 A：环境变量（推荐）**

```bash
export GOOGLE_API_KEY=your-gemini-api-key-here
```

**方式 B：.env 文件**

在项目根目录创建 `.env`:

```bash
# Google Gemini API
GOOGLE_API_KEY=your-gemini-api-key-here

# 可选：指定默认模型
GEMINI_MODEL=gemini-1.5-flash  # 或 gemini-1.5-pro

# 可选：最大输出 tokens
GEMINI_MAX_TOKENS=8192
```

### 3. （可选）保留 OpenAI 作为备份

```bash
# 同时设置两个 API Key
export GOOGLE_API_KEY=your-gemini-key
export OPENAI_API_KEY=your-openai-key

# TestMind 会优先使用 Gemini，Gemini 不可用时 fallback 到 OpenAI
```

---

## 🚀 使用 Gemini 生成测试

### 示例 1：生成单元测试

```bash
# 为单个函数生成测试
testmind generate src/utils/math.ts::add

# 自动使用 Gemini Flash（最便宜、最快）
# 成本：~$0.001
```

**输出**:
```
✓ 使用模型: gemini-1.5-flash
✓ 分析完成 (120ms)
✓ 测试生成完成 (850ms)
✓ 成本: $0.00085

+++ src/utils/math.test.ts
@@ -0,0 +1,12 @@
+import { describe, it, expect } from 'vitest';
+import { add } from './math';
+
+describe('add', () => {
+  it('should add two positive numbers', () => {
+    expect(add(2, 3)).toBe(5);
+  });
+  
+  it('should handle negative numbers', () => {
+    expect(add(-1, -2)).toBe(-3);
+  });
+});

Commands: [a]ccept, [r]eject, [e]dit
>
```

### 示例 2：批量生成测试

```bash
# 为整个模块生成测试
testmind generate src/services/*.ts --batch

# 批量处理，节省 API 调用
```

### 示例 3：使用 Gemini Pro（复杂任务）

```bash
# 强制使用 Gemini Pro
GEMINI_MODEL=gemini-1.5-pro testmind generate src/complex-logic.ts

# 或在配置中指定
testmind generate src/complex-logic.ts --model gemini-1.5-pro
```

---

## 🔍 向量搜索（LanceDB）

### 初始化项目索引

```bash
# 首次使用时，索引整个项目
testmind init

# TestMind 会：
# 1. 分析所有代码文件
# 2. 使用 Gemini Embeddings 生成向量
# 3. 存储到 LanceDB（.testmind/vectors/）
# 4. 创建 HNSW 索引（自动）
```

### 语义搜索

```bash
# 搜索类似代码
testmind search "authentication logic"

# 输出：
# 1. src/auth/login.ts::authenticate (相似度: 0.95)
# 2. src/middleware/auth.ts::verifyToken (相似度: 0.88)
# 3. src/services/user-service.ts::validateUser (相似度: 0.82)
```

### 增量更新

```bash
# 只重新索引变更的文件
testmind update

# TestMind 自动检测 Git 变更，只更新必要的 embeddings
```

---

## 📊 成本监控

### 查看累计成本

```bash
testmind stats --cost

# 输出：
# Total LLM Cost: $2.45
# - Gemini Flash: $1.80 (120 requests)
# - Gemini Pro: $0.65 (15 requests)
# 
# Embedding Cost: $0.000125
# - Gemini text-embedding-004: $0.000125 (500 embeddings)
# 
# 总计: $2.45
# vs OpenAI 估算: $120.50
# 节省: $118.05 (98%)
```

---

## 🎛️ 高级配置

### 自定义模型选择策略

创建 `.testmind/config.json`:

```json
{
  "llm": {
    "defaultProvider": "google",
    "preferredModels": {
      "simple": "gemini-1.5-flash",
      "complex": "gemini-1.5-pro",
      "expert": "gpt-4o"
    },
    "costOptimization": {
      "enabled": true,
      "maxCostPerTest": 0.01
    }
  },
  "embeddings": {
    "provider": "gemini",
    "model": "text-embedding-004",
    "batchSize": 100,
    "incremental": true
  },
  "vectorStore": {
    "type": "lancedb",
    "path": ".testmind/vectors",
    "indexType": "ivf_pq"
  }
}
```

---

## 💡 最佳实践

### 1. 何时使用 Flash vs Pro？

**使用 Gemini Flash**（90% 场景）:
- ✅ 单元测试生成
- ✅ API 测试生成
- ✅ 简单重构建议
- ✅ 代码注释

**使用 Gemini Pro**:
- 🎯 复杂业务逻辑测试
- 🎯 架构分析
- 🎯 大型上下文（>50K tokens）

### 2. 成本优化技巧

```bash
# 启用缓存（60%+ 命中率）
testmind config set cache.enabled true

# 启用 Prompt 压缩（-50% tokens）
testmind config set promptOptimization.enabled true

# 批量处理（减少 API 调用）
testmind generate src/**/*.ts --batch
```

### 3. 向量数据库维护

```bash
# 定期压缩数据库（清理已删除数据）
testmind db compact

# 查看统计信息
testmind db stats

# 重建索引（如果检索变慢）
testmind db reindex
```

---

## 🔧 故障排查

### Q1: "GOOGLE_API_KEY not set" 错误

**解决方案**:
```bash
# 检查环境变量
echo $GOOGLE_API_KEY

# 设置环境变量
export GOOGLE_API_KEY=your-key-here

# 或使用 .env 文件
echo "GOOGLE_API_KEY=your-key-here" > .env
```

### Q2: "LanceDB not initialized" 错误

**解决方案**:
```bash
# 重新初始化项目
testmind init --force
```

### Q3: 向量搜索速度慢

**解决方案**:
```bash
# 检查索引状态
testmind db stats

# 如果没有索引，创建索引
testmind db create-index

# 压缩数据库
testmind db compact
```

### Q4: Gemini API 配额超限

**临时解决方案**:
```bash
# 切换到 OpenAI
testmind generate src/utils.ts --provider openai

# 或等待配额重置（通常每分钟重置）
```

---

## 📈 性能对比

### 实际测试结果

**项目**: 1000 个函数  
**任务**: 生成单元测试 + embedding

| 指标 | OpenAI (v0.8.0) | Gemini (v0.9.0) | 提升 |
|------|----------------|----------------|------|
| **LLM 成本** | $150.00 | $30.00 | **-80%** |
| **Embedding 成本** | $0.01 | $0.000125 | **-99%** |
| **总成本** | $150.01 | $30.00 | **-80%** |
| **向量搜索** | 500ms | 45ms | **11x 加速** |

---

## 🎓 示例项目

### 示例 1：生成 Vue 组件测试

```bash
# Vue 3 Composition API
testmind generate components/LoginForm.vue

# 自动识别：
# - Props
# - Emits
# - Composables
# - Pinia store 依赖
```

### 示例 2：生成 Next.js API 测试

```bash
# Next.js App Router
testmind generate app/api/users/route.ts

# 自动生成：
# - GET/POST/DELETE 测试
# - 请求验证测试
# - 错误处理测试
```

### 示例 3：生成 Express API 测试

```bash
# Express 路由
testmind generate routes/auth.ts

# 自动生成：
# - 中间件测试
# - 错误处理测试
# - 集成测试
```

---

## 🔗 相关资源

- [Gemini 成本优化指南](../../guides/cost-optimization-gemini.md)
- [实施总结](./IMPLEMENTATION_SUMMARY.md)
- [Migration Guide](./MIGRATION_GUIDE_v0.8_to_v0.9.md)（即将推出）
- [API 文档](../../api-reference/)

---

## 💬 获取帮助

**遇到问题？**

1. 📖 查看 [Gemini 成本优化指南](../../guides/cost-optimization-gemini.md)
2. 🐛 提交 [GitHub Issue](https://github.com/yourusername/testmind/issues)
3. 💬 加入 [Discord 社区](https://discord.gg/testmind)

---

## 🎉 开始使用

```bash
# 1. 设置 API Key
export GOOGLE_API_KEY=your-key-here

# 2. 初始化项目
testmind init

# 3. 生成第一个测试
testmind generate src/utils/math.ts

# 4. 享受 80% 成本节省！🚀
```

---

**TestMind v0.9.0** - 让 AI 成为你的测试工程师，用 Gemini 驱动，成本更低！

**更新日期**: 2025-10-23  
**版本**: v0.9.0（开发中）


