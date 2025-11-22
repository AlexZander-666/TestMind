# Vector Store API 参考

## 概述

TestMind v0.6.0 集成了向量数据库（LanceDB），实现智能的语义搜索和上下文检索。

## 核心组件

### EnhancedVectorStore

增强的向量存储，支持语义搜索、混合搜索和增量更新。

#### 基础用法

```typescript
import { createEnhancedVectorStore } from '@testmind/core';

// 创建向量存储
const store = await createEnhancedVectorStore({
  dbPath: '.testmind/vectors',
  embeddingModel: 'text-embedding-3-small'
});

// 添加代码块
await store.addChunks(codeChunks);

// 语义搜索
const results = await store.search('authentication logic', {
  topK: 5,
  minScore: 0.7
});
```

#### API 方法

##### addChunks(chunks: CodeChunk[]): Promise<void>

批量添加代码块到向量存储。

**参数:**
```typescript
interface CodeChunk {
  id: string;
  content: string;
  filePath: string;
  startLine: number;
  endLine: number;
  name?: string; // 函数/类名
  type?: 'function' | 'class' | 'module';
  complexity?: number;
  metadata?: ChunkMetadata;
}
```

**示例:**
```typescript
const chunks = [
  {
    id: 'auth-login-1',
    content: 'function login(username, password) { ... }',
    filePath: 'src/auth/login.ts',
    startLine: 10,
    endLine: 25,
    name: 'login',
    type: 'function'
  }
];

await store.addChunks(chunks);
```

##### search(query: string, options?: SearchOptions): Promise<SearchResult[]>

语义搜索代码块。

**参数:**
```typescript
interface SearchOptions {
  topK?: number; // 返回结果数，默认: 5
  minScore?: number; // 最小相似度，默认: 0.5
  filters?: {
    filePath?: string;
    type?: 'function' | 'class' | 'module';
    minComplexity?: number;
    maxComplexity?: number;
  };
}
```

**返回:**
```typescript
interface SearchResult {
  chunk: CodeChunk;
  score: number; // 相似度 0-1
  relevance: number;
}
```

**示例:**
```typescript
const results = await store.search('user authentication', {
  topK: 3,
  minScore: 0.8,
  filters: {
    type: 'function',
    maxComplexity: 10
  }
});

for (const result of results) {
  console.log(`${result.chunk.name} (相似度: ${result.score.toFixed(2)})`);
}
```

---

### HybridSearchEngine

混合搜索引擎，结合向量搜索、关键词搜索和依赖关系。

#### 搜索策略

1. **向量搜索** - 语义相似性（权重: 0.5）
2. **关键词搜索** - BM25算法（权重: 0.3）
3. **依赖搜索** - 代码依赖关系（权重: 0.2）

#### 基础用法

```typescript
import { createHybridSearchEngine } from '@testmind/core';

const engine = await createHybridSearchEngine({
  vectorStore: store,
  bm25Index: keywordIndex,
  dependencyGraph: depGraph
});

// 混合搜索
const results = await engine.hybridSearch({
  query: 'error handling',
  context: {
    currentFile: 'src/api/users.ts',
    recentlyViewed: ['src/auth/', 'src/middleware/']
  }
}, {
  topK: 10,
  minScore: 0.6
});
```

#### API 方法

##### hybridSearch(query: SearchQuery, options?: SearchOptions): Promise<HybridSearchResult[]>

执行混合搜索。

**参数:**
```typescript
interface SearchQuery {
  query: string; // 搜索查询
  context?: {
    currentFile?: string; // 当前文件
    targetFunction?: string; // 目标函数
    recentlyViewed?: string[]; // 最近查看的文件
    dependencies?: string[]; // 依赖项
  };
}
```

**返回:**
```typescript
interface HybridSearchResult {
  chunk: CodeChunk;
  totalScore: number; // 综合得分
  scores: {
    vector: number; // 向量搜索得分
    keyword: number; // 关键词得分
    dependency: number; // 依赖得分
  };
  matchedBy: Array<'vector' | 'keyword' | 'dependency'>;
}
```

---

### EmbeddingGenerator

Embedding 批量生成器，支持成本追踪和增量更新。

#### 基础用法

```typescript
import { createEmbeddingGenerator } from '@testmind/core';

const generator = createEmbeddingGenerator({
  apiKey: process.env.OPENAI_API_KEY,
  model: 'text-embedding-3-small',
  batchSize: 100
});

// 生成embeddings
const result = await generator.generateEmbeddings(chunks, (progress) => {
  console.log(`进度: ${progress.percentage}%`);
});

console.log(`成功: ${result.successCount}, 成本: $${result.estimatedCost.toFixed(4)}`);
```

#### API 方法

##### generateEmbeddings(chunks: CodeChunk[], onProgress?: ProgressCallback): Promise<EmbeddingGenerationResult>

批量生成embeddings。

**参数:**
```typescript
type ProgressCallback = (progress: {
  current: number;
  total: number;
  percentage: number;
  estimatedTimeRemaining?: number; // 秒
}) => void;
```

**返回:**
```typescript
interface EmbeddingGenerationResult {
  successCount: number;
  failedCount: number;
  duration: number; // 毫秒
  totalTokens: number;
  estimatedCost: number; // 美元
  failures: Array<{
    chunkId: string;
    error: string;
  }>;
}
```

##### generateIncremental(allChunks: CodeChunk[], existingChunks: Map<string, CodeChunk>): Promise<EmbeddingGenerationResult>

增量生成，只为新增或修改的代码生成embeddings。

**示例:**
```typescript
// 第一次：全量生成
const result1 = await generator.generateEmbeddings(allChunks);

// 后续：增量生成（节省成本）
const existingMap = new Map(allChunks.map(c => [c.id, c]));
const result2 = await generator.generateIncremental(updatedChunks, existingMap);

console.log(`增量生成: ${result2.successCount} chunks, 成本: $${result2.estimatedCost.toFixed(4)}`);
```

---

## 完整示例

### 智能代码检索

```typescript
import {
  createEnhancedVectorStore,
  createHybridSearchEngine,
  createEmbeddingGenerator
} from '@testmind/core';

// 1. 初始化组件
const generator = createEmbeddingGenerator({
  apiKey: process.env.OPENAI_API_KEY,
  model: 'text-embedding-3-small'
});

const store = await createEnhancedVectorStore({
  dbPath: '.testmind/vectors'
});

// 2. 索引代码库
const codeChunks = await parseCodebase('src/');

// 生成embeddings
const genResult = await generator.generateEmbeddings(codeChunks, (p) => {
  console.log(`索引进度: ${p.percentage}%`);
});

// 存储到向量数据库
await store.addChunks(codeChunks);

// 3. 创建混合搜索引擎
const engine = await createHybridSearchEngine({
  vectorStore: store,
  // ...其他配置
});

// 4. 智能搜索
const results = await engine.hybridSearch({
  query: 'database connection pooling',
  context: {
    currentFile: 'src/db/connection.ts',
    recentlyViewed: ['src/config/', 'src/db/']
  }
}, {
  topK: 5,
  minScore: 0.7
});

// 5. 使用结果
for (const result of results) {
  console.log(`\n${result.chunk.name} (${result.chunk.filePath})`);
  console.log(`总分: ${result.totalScore.toFixed(2)}`);
  console.log(`向量: ${result.scores.vector.toFixed(2)}, 关键词: ${result.scores.keyword.toFixed(2)}`);
  console.log(`匹配: ${result.matchedBy.join(', ')}`);
}
```

---

## 配置选项

### VectorStore 配置

```typescript
interface VectorStoreConfig {
  // 数据库路径
  dbPath: string; // 默认: '.testmind/vectors'
  
  // Embedding 模型
  embeddingModel?: 'text-embedding-3-small' | 'text-embedding-3-large';
  
  // Embedding 维度
  embeddingDimension?: number; // 默认: 1536
  
  // 批量大小
  batchSize?: number; // 默认: 1000
}
```

### HybridSearch 配置

```typescript
interface HybridSearchConfig {
  // 搜索策略权重
  weights?: {
    vector?: number; // 默认: 0.5
    keyword?: number; // 默认: 0.3
    dependency?: number; // 默认: 0.2
  };
  
  // RRF 参数（Reciprocal Rank Fusion）
  rrf?: {
    k?: number; // 默认: 60
  };
  
  // 上下文增强
  contextBoost?: {
    sameFile?: number; // 默认: 1.2
    sameModule?: number; // 默认: 1.1
    recentlyViewed?: number; // 默认: 1.15
  };
}
```

---

## 成本优化

### 最佳实践

1. **使用增量更新**
```typescript
// ✅ 好：只为变更的文件生成embeddings
await generator.generateIncremental(newChunks, existingMap);

// ❌ 差：每次都全量生成
await generator.generateEmbeddings(allChunks);
```

2. **选择合适的模型**
```typescript
// 小项目：text-embedding-3-small ($0.02/1M tokens)
// 大项目：text-embedding-3-large ($0.13/1M tokens, 更高质量)
```

3. **估算成本**
```typescript
const estimate = generator.estimateCost(chunks);
console.log(`预计成本: $${estimate.estimatedCost.toFixed(4)}`);
console.log(`预计时间: ${estimate.estimatedDuration}秒`);
```

### 成本示例

- **小项目**（100个函数）：~20K tokens = **$0.0004**
- **中项目**（1000个函数）：~200K tokens = **$0.004**
- **大项目**（10000个函数）：~2M tokens = **$0.04**

---

## 性能指标

- **搜索延迟**: < 100ms
- **索引速度**: ~10 chunks/秒
- **相关性**: 0.92+ (混合搜索)
- **内存占用**: ~500MB (10K chunks)

---

## 相关文档

- [向量数据库设置指南](../guides/vector-database-setup.md)
- [混合上下文引擎](../architecture/hybrid-context-engine.md)

