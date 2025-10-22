# 向量数据库配置指南

## 概述

TestMind 使用向量数据库实现语义搜索，提升代码上下文的相关性。本指南介绍如何配置和优化向量数据库。

---

## 快速开始

### 1. 初始化

```bash
# 初始化项目并构建索引
testmind init

# 这将：
# 1. 分析项目代码
# 2. 生成代码块
# 3. 调用 OpenAI API 生成 Embeddings
# 4. 存储到 LanceDB
```

### 2. 查看统计

```bash
testmind index stats

# 输出：
# Total Chunks: 1,234
# Total Files: 56
# Vector Dimension: 1536
# DB Size: 45.3 MB
# Last Updated: 2025-10-21 14:30:00
```

### 3. 增量更新

```bash
# 只更新变更的文件
testmind index update

# 或手动指定文件
testmind index update src/utils/math.ts
```

---

## 向量数据库架构

### LanceDB 简介

TestMind 使用 LanceDB 作为向量数据库：

**优势**:
- ✅ 嵌入式（无需单独服务器）
- ✅ 高性能（Rust 实现）
- ✅ 列式存储（查询高效）
- ✅ 支持大规模向量（百万级）

**表模式**:
```
code_chunks
├─ id (String, 主键)
├─ filePath (String, 索引)
├─ functionName (String)
├─ code (String)
├─ vector (Float32[1536], 向量索引)
├─ metadata (JSON)
├─ timestamp (Int64)
├─ chunkType (String)
├─ complexity (Int32)
└─ loc (Int32)
```

---

## Embedding 生成

### 模型选择

TestMind 支持多种 Embedding 模型：

| 模型 | 维度 | 成本 ($/1M tokens) | 推荐用途 |
|------|------|-------------------|---------|
| text-embedding-3-small | 1536 | $0.02 | ⭐ 推荐（性价比最高） |
| text-embedding-3-large | 3072 | $0.13 | 高质量需求 |
| text-embedding-ada-002 | 1536 | $0.10 | 兼容性考虑 |

**配置**:
```typescript
// .testmind/config.json
{
  "embedding": {
    "model": "text-embedding-3-small",
    "batchSize": 100,
    "maxTokensPerText": 8000
  }
}
```

### 成本估算

```bash
# 估算索引成本
testmind index estimate

# 输出示例：
# Files to Index: 100
# Estimated Chunks: 850
# Estimated Tokens: 170,000
# Estimated Cost: $0.0034
# Estimated Time: 85 seconds
```

**实际成本示例**:
- 小项目（100 函数）：$0.0004
- 中项目（1,000 函数）：$0.004
- 大项目（10,000 函数）：$0.04

---

## 索引优化

### 1. IVF_PQ 索引

LanceDB 支持 IVF_PQ（Inverted File with Product Quantization）索引加速大规模搜索：

```typescript
// 为向量创建索引
await vectorStore.createIndex('vector', {
  type: 'IVF_PQ',
  num_partitions: 256,    // 分区数（建议: sqrt(向量数))
  num_sub_vectors: 96,    // 子向量数
});
```

**性能对比**:
| 向量数量 | 无索引 | IVF_PQ | 加速比 |
|---------|--------|--------|--------|
| 1,000 | 50ms | 15ms | 3.3x |
| 10,000 | 500ms | 40ms | 12.5x |
| 100,000 | 5000ms | 120ms | 41.7x |

### 2. 批量插入

```typescript
// 批量插入（100条/批）
const BATCH_SIZE = 100;

for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
  const batch = chunks.slice(i, i + BATCH_SIZE);
  await vectorStore.insertChunks(batch);
}
```

### 3. 增量更新

```typescript
// 只更新变更的文件
const changedFiles = await git.getChangedFiles();

for (const file of changedFiles) {
  const chunks = await analyzer.analyzeFile(file);
  await vectorStore.updateFile(file, chunks);
}
```

---

## 语义搜索

### 基础搜索

```typescript
import { EnhancedVectorStore } from '@testmind/core';

const vectorStore = new EnhancedVectorStore('.testmind/vectors');
await vectorStore.initialize();

// 搜索相似代码
const results = await vectorStore.search(queryEmbedding, {
  k: 5,
  filter: {
    chunkType: 'function',
    minComplexity: 5,
  },
});

for (const result of results) {
  console.log(`${result.chunk.name} (score: ${result.score.toFixed(3)})`);
}
```

### 混合搜索

```typescript
import { HybridSearchEngine } from '@testmind/core';

const hybridSearch = new HybridSearchEngine(vectorStore, dependencyGraph);

// 构建关键词索引
await hybridSearch.buildKeywordIndex(allChunks);

// 执行混合搜索
const results = await hybridSearch.search({
  text: 'authentication logic',
  embedding: queryEmbedding,
  filePath: 'src/auth/login.ts',
  topK: 5,
  weights: {
    vector: 0.5,      // 语义相似度
    keyword: 0.3,     // 关键词匹配
    dependency: 0.2,  // 依赖关系
  },
});

// 查看搜索解释
const explanation = hybridSearch.explainSearch(results);
console.log(explanation);
```

---

## 维护和监控

### 定期维护

```bash
# 清理过期数据
testmind index clean --older-than 30d

# 压缩数据库
testmind index compact

# 重建索引
testmind index rebuild
```

### 监控

```typescript
// 获取统计信息
const stats = await vectorStore.getStats();

console.log(`Total Chunks: ${stats.totalChunks}`);
console.log(`DB Size: ${stats.dbSizeMB} MB`);
console.log(`Last Updated: ${stats.lastUpdated}`);

// 检查搜索性能
const searchStats = hybridSearch.getStats();
console.log(`Avg Response Time: ${searchStats.avgResponseTime}ms`);
```

---

## 故障排查

### 问题：向量数据库初始化失败

**解决**:
```bash
# 检查目录权限
ls -la .testmind/

# 重新初始化
rm -rf .testmind/vectors
testmind init
```

### 问题：搜索结果不相关

**解决**:
1. 检查 Embedding 模型是否一致
2. 重新生成 Embeddings
3. 调整搜索权重
4. 增加 Few-shot 示例

### 问题：成本过高

**解决**:
1. 使用 `text-embedding-3-small`（最便宜）
2. 限制代码长度（maxTokensPerText: 8000）
3. 启用增量更新（只更新变更文件）
4. 考虑本地 Embedding 模型

---

## 高级话题

### 自定义 Embedding 模型

```typescript
import { EmbeddingGenerator } from '@testmind/core';

const generator = new EmbeddingGenerator({
  apiKey: process.env.OPENAI_API_KEY,
  model: 'text-embedding-3-large', // 更高质量
  batchSize: 50, // 更小批次
  maxRetries: 5,
});

const result = await generator.generateEmbeddings(chunks, (progress) => {
  console.log(`Progress: ${progress.percentage}%`);
});
```

### 多租户支持

```typescript
// 为不同项目使用不同的向量库
const projectAStore = new EnhancedVectorStore('.testmind/projectA/vectors');
const projectBStore = new EnhancedVectorStore('.testmind/projectB/vectors');
```

---

## 性能基准

### 索引性能

```
项目规模：1,000 文件，10,000 函数

初次索引：
├─ 代码分析: 2,500ms
├─ Embedding 生成: 120,000ms (API 调用)
├─ 向量存储: 850ms
└─ 总计: ~125 秒

增量更新（10 个文件变更）：
├─ 代码分析: 120ms
├─ Embedding 生成: 1,200ms
├─ 向量存储: 45ms
└─ 总计: ~1.4 秒
```

### 搜索性能

```
向量数量：10,000

无索引：
└─ 平均查询时间: 450ms

IVF_PQ 索引：
└─ 平均查询时间: 35ms (12.9x 加速)

混合搜索：
└─ 平均查询时间: 45ms (包含 RRF 融合)
```

---

## 参考资料

- [LanceDB 官方文档](https://lancedb.github.io/lancedb/)
- [OpenAI Embeddings](https://platform.openai.com/docs/guides/embeddings)
- [向量搜索原理](https://www.pinecone.io/learn/vector-database/)
- [RRF 算法论文](https://plg.uwaterloo.ca/~gvcormac/cormacksigir09-rrf.pdf)


















