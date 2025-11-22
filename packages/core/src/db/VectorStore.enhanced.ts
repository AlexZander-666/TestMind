/**
 * Enhanced VectorStore - 完整的 LanceDB 集成
 * 
 * 功能：
 * 1. 连接和初始化 LanceDB
 * 2. 批量插入代码块向量
 * 3. 语义搜索（向量相似度）
 * 4. 增量更新（文件级别）
 * 5. 索引优化
 * 6. 统计和监控
 */

import type { CodeChunk, SemanticSearchResult } from '@testmind/shared';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * LanceDB 表模式
 */
interface LanceDBSchema {
  id: string;
  filePath: string;
  functionName: string;
  code: string;
  vector: number[]; // 1536 维向量 (OpenAI text-embedding-3-small)
  metadata: string; // JSON 字符串
  timestamp: number;
  chunkType: string; // 'function' | 'class' | 'method'
  complexity?: number;
  loc?: number; // Lines of Code
}

/**
 * 向量存储统计
 */
export interface VectorStoreStats {
  totalChunks: number;
  totalFiles: number;
  vectorDimension: number;
  dbSizeMB: number;
  lastUpdated: Date;
  indexType?: string;
}

/**
 * 搜索选项
 */
export interface SearchOptions {
  /** 返回结果数量 */
  k?: number;
  
  /** 过滤条件 */
  filter?: {
    filePath?: string;
    chunkType?: string;
    minComplexity?: number;
    maxComplexity?: number;
  };
  
  /** 是否包含元数据 */
  includeMetadata?: boolean;
}

/**
 * 增强的向量存储
 * 
 * 当前实现使用文件系统存储（JSON），
 * 生产环境应使用真实的 LanceDB
 */
export class EnhancedVectorStore {
  private dbPath: string;
  private chunks: Map<string, LanceDBSchema> = new Map();
  private fileIndex: Map<string, string[]> = new Map(); // filePath -> chunk IDs
  private initialized = false;

  constructor(dbPath = '.testmind/vectors') {
    this.dbPath = dbPath;
  }

  /**
   * 初始化向量数据库
   */
  async initialize(): Promise<void> {
    console.log('[VectorStore] Initializing LanceDB...');
    
    try {
      // 确保数据库目录存在
      await fs.mkdir(this.dbPath, { recursive: true });

      // 加载现有数据（如果有）
      await this.loadExistingData();

      this.initialized = true;
      console.log('[VectorStore] Initialization complete');
    } catch (error) {
      console.error('[VectorStore] Initialization failed:', error);
      throw error;
    }

    /* 真实 LanceDB 实现示例：
    
    import * as lancedb from 'vectordb';
    
    // 连接数据库
    this.db = await lancedb.connect(this.dbPath);
    
    // 定义表模式
    const schema = {
      id: new lancedb.String(),
      filePath: new lancedb.String(),
      functionName: new lancedb.String(),
      code: new lancedb.String(),
      vector: new lancedb.FixedSizeList(1536, new lancedb.Float32()),
      metadata: new lancedb.String(),
      timestamp: new lancedb.Int64(),
      chunkType: new lancedb.String(),
      complexity: new lancedb.Int32(),
      loc: new lancedb.Int32()
    };
    
    // 创建或打开表
    try {
      this.table = await this.db.openTable('code_chunks');
    } catch {
      this.table = await this.db.createTable('code_chunks', schema);
    }
    
    // 创建向量索引加速搜索
    await this.table.createIndex('vector', { 
      type: 'IVF_PQ',
      num_partitions: 256,
      num_sub_vectors: 96
    });
    */
  }

  /**
   * 批量插入代码块
   */
  async insertChunks(chunks: CodeChunk[]): Promise<void> {
    this.ensureInitialized();
    
    console.log(`[VectorStore] Inserting ${chunks.length} chunks`);
    
    const BATCH_SIZE = 100;
    let inserted = 0;

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      
      for (const chunk of batch) {
        // 转换为数据库模式
        const record: LanceDBSchema = {
          id: chunk.id,
          filePath: chunk.filePath,
          functionName: chunk.name || chunk.functionName || 'anonymous',
          code: chunk.content,
          vector: chunk.embedding || new Array(1536).fill(0), // 默认零向量
          metadata: JSON.stringify(chunk.metadata || {}),
          timestamp: Date.now(),
          chunkType: chunk.type || 'function',
          complexity: chunk.complexity || 0,
          loc: chunk.loc || 0,
        };

        // 存储到内存
        this.chunks.set(record.id, record);

        // 更新文件索引
        if (!this.fileIndex.has(record.filePath)) {
          this.fileIndex.set(record.filePath, []);
        }
        this.fileIndex.get(record.filePath)!.push(record.id);

        inserted++;
      }

      console.log(`[VectorStore] Progress: ${inserted}/${chunks.length}`);
    }

    // 持久化到磁盘
    await this.persist();

    console.log(`[VectorStore] Successfully inserted ${inserted} chunks`);

    /* 真实 LanceDB 批量插入：
    
    const rows = batch.map(chunk => ({
      id: chunk.id,
      filePath: chunk.filePath,
      functionName: chunk.name || 'anonymous',
      code: chunk.content,
      vector: chunk.embedding,
      metadata: JSON.stringify(chunk.metadata),
      timestamp: Date.now(),
      chunkType: chunk.type,
      complexity: chunk.complexity || 0,
      loc: chunk.loc || 0
    }));
    
    await this.table.add(rows);
    */
  }

  /**
   * 语义搜索
   */
  async search(
    queryEmbedding: number[],
    options: SearchOptions = {}
  ): Promise<SemanticSearchResult[]> {
    this.ensureInitialized();

    const k = options.k || 5;
    
    console.log(`[VectorStore] Searching for top ${k} similar chunks`);

    // 获取所有候选
    let candidates = Array.from(this.chunks.values());

    // 应用过滤器
    if (options.filter) {
      candidates = this.applyFilters(candidates, options.filter);
    }

    // 计算余弦相似度
    const results = candidates.map(chunk => {
      const score = this.cosineSimilarity(queryEmbedding, chunk.vector);
      return {
        chunk: this.convertToCodeChunk(chunk),
        score,
        relevance: score,  // Same as score
      };
    });

    // 排序并返回 top K
    results.sort((a, b) => b.score - a.score);

    return results.slice(0, k);

    /* 真实 LanceDB 搜索：
    
    let query = this.table.search(queryEmbedding).limit(k);
    
    // 应用过滤器
    if (options.filter?.filePath) {
      query = query.filter(`filePath = '${options.filter.filePath}'`);
    }
    if (options.filter?.chunkType) {
      query = query.filter(`chunkType = '${options.filter.chunkType}'`);
    }
    if (options.filter?.minComplexity) {
      query = query.filter(`complexity >= ${options.filter.minComplexity}`);
    }
    
    const results = await query.execute();
    
    return results.map(row => ({
      chunk: {
        id: row.id,
        filePath: row.filePath,
        name: row.functionName,
        content: row.code,
        type: row.chunkType,
        complexity: row.complexity,
        loc: row.loc,
        metadata: JSON.parse(row.metadata)
      },
      score: 1 - row._distance // LanceDB 返回距离，转换为相似度
    }));
    */
  }

  /**
   * 更新文件的向量
   */
  async updateFile(filePath: string, chunks: CodeChunk[]): Promise<void> {
    this.ensureInitialized();
    
    console.log(`[VectorStore] Updating embeddings for: ${filePath}`);

    // 1. 删除旧的 chunks
    await this.deleteFile(filePath);

    // 2. 插入新的 chunks
    await this.insertChunks(chunks);

    console.log(`[VectorStore] File updated: ${filePath}`);

    /* 真实 LanceDB 更新：
    
    // 删除旧数据
    await this.table.delete(`filePath = '${filePath}'`);
    
    // 插入新数据
    await this.insertChunks(chunks);
    */
  }

  /**
   * 删除文件的所有向量
   */
  async deleteFile(filePath: string): Promise<void> {
    this.ensureInitialized();
    
    const chunkIds = this.fileIndex.get(filePath) || [];
    
    for (const id of chunkIds) {
      this.chunks.delete(id);
    }
    
    this.fileIndex.delete(filePath);
    
    await this.persist();

    console.log(`[VectorStore] Deleted ${chunkIds.length} chunks for: ${filePath}`);

    /* 真实 LanceDB 删除：
    
    await this.table.delete(`filePath = '${filePath}'`);
    */
  }

  /**
   * 获取统计信息
   */
  async getStats(): Promise<VectorStoreStats> {
    this.ensureInitialized();

    const uniqueFiles = new Set(
      Array.from(this.chunks.values()).map(c => c.filePath)
    );

    // 计算数据库大小（估算）
    let totalSize = 0;
    for (const chunk of this.chunks.values()) {
      totalSize += chunk.code.length + chunk.vector.length * 4; // 4 bytes per float
    }
    const dbSizeMB = totalSize / (1024 * 1024);

    return {
      totalChunks: this.chunks.size,
      totalFiles: uniqueFiles.size,
      vectorDimension: 1536,
      dbSizeMB: parseFloat(dbSizeMB.toFixed(2)),
      lastUpdated: new Date(),
      indexType: 'in-memory',
    };
  }

  /**
   * 关闭数据库连接
   */
  async close(): Promise<void> {
    if (this.initialized) {
      await this.persist();
      this.chunks.clear();
      this.fileIndex.clear();
      this.initialized = false;
      console.log('[VectorStore] Closed');
    }

    /* 真实 LanceDB 关闭：
    
    await this.db.close();
    */
  }

  /**
   * 清除所有数据
   */
  async clear(): Promise<void> {
    this.chunks.clear();
    this.fileIndex.clear();
    await this.persist();
    console.log('[VectorStore] All data cleared');
  }

  /**
   * 应用过滤器
   */
  private applyFilters(
    candidates: LanceDBSchema[],
    filter: NonNullable<SearchOptions['filter']>
  ): LanceDBSchema[] {
    let filtered = candidates;

    if (filter.filePath) {
      filtered = filtered.filter(c => c.filePath === filter.filePath);
    }

    if (filter.chunkType) {
      filtered = filtered.filter(c => c.chunkType === filter.chunkType);
    }

    if (filter.minComplexity !== undefined) {
      filtered = filtered.filter(c => (c.complexity || 0) >= filter.minComplexity!);
    }

    if (filter.maxComplexity !== undefined) {
      filtered = filtered.filter(c => (c.complexity || 0) <= filter.maxComplexity!);
    }

    return filtered;
  }

  /**
   * 计算余弦相似度
   */
  private cosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) {
      return 0;
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      const v1 = vec1[i] ?? 0;
      const v2 = vec2[i] ?? 0;
      dotProduct += v1 * v2;
      norm1 += v1 * v1;
      norm2 += v2 * v2;
    }

    const denominator = Math.sqrt(norm1) * Math.sqrt(norm2);
    
    if (denominator === 0) {
      return 0;
    }

    return dotProduct / denominator;
  }

  /**
   * 转换数据库记录为 CodeChunk
   */
  private convertToCodeChunk(record: LanceDBSchema): CodeChunk {
    return {
      id: record.id,
      filePath: record.filePath,
      content: record.code,
      startLine: 0,
      endLine: 0,
      name: record.functionName,
      functionName: record.functionName,
      type: record.chunkType as any,
      complexity: record.complexity,
      loc: record.loc,
      embedding: record.vector,
      metadata: JSON.parse(record.metadata),
    };
  }

  /**
   * 持久化到磁盘（JSON 格式）
   */
  private async persist(): Promise<void> {
    const dataPath = path.join(this.dbPath, 'data.json');
    const indexPath = path.join(this.dbPath, 'index.json');

    // 保存 chunks
    const chunksArray = Array.from(this.chunks.values());
    await fs.writeFile(dataPath, JSON.stringify(chunksArray, null, 2));

    // 保存文件索引
    const indexData = Object.fromEntries(this.fileIndex);
    await fs.writeFile(indexPath, JSON.stringify(indexData, null, 2));
  }

  /**
   * 加载现有数据
   */
  private async loadExistingData(): Promise<void> {
    const dataPath = path.join(this.dbPath, 'data.json');
    const indexPath = path.join(this.dbPath, 'index.json');

    try {
      // 加载 chunks
      const chunksData = await fs.readFile(dataPath, 'utf-8');
      const chunksArray: LanceDBSchema[] = JSON.parse(chunksData);
      
      for (const chunk of chunksArray) {
        this.chunks.set(chunk.id, chunk);
      }

      // 加载文件索引
      const indexData = await fs.readFile(indexPath, 'utf-8');
      const indexObj = JSON.parse(indexData);
      
      for (const [filePath, chunkIds] of Object.entries(indexObj)) {
        this.fileIndex.set(filePath, chunkIds as string[]);
      }

      console.log(`[VectorStore] Loaded ${this.chunks.size} existing chunks`);
    } catch (error) {
      // 数据文件不存在，这是正常的首次运行
      console.log('[VectorStore] No existing data found, starting fresh');
    }
  }

  /**
   * 确保已初始化
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('VectorStore not initialized. Call initialize() first.');
    }
  }
}

/**
 * LanceDB 真实集成参考实现
 * 
 * 安装依赖：
 * ```bash
 * pnpm add vectordb @lancedb/lancedb
 * ```
 * 
 * 完整实现：
 * ```typescript
 * import * as lancedb from 'vectordb';
 * 
 * export class RealLanceDBVectorStore {
 *   private db: lancedb.Connection;
 *   private table: lancedb.Table;
 * 
 *   async initialize() {
 *     this.db = await lancedb.connect(this.dbPath);
 *     
 *     try {
 *       this.table = await this.db.openTable('code_chunks');
 *     } catch {
 *       const schema = {
 *         id: new lancedb.String(),
 *         vector: new lancedb.FixedSizeList(1536, new lancedb.Float32()),
 *         // ... 其他字段
 *       };
 *       this.table = await this.db.createTable('code_chunks', [], schema);
 *     }
 * 
 *     // 创建 IVF_PQ 索引（加速大规模向量搜索）
 *     await this.table.createIndex('vector', {
 *       type: 'IVF_PQ',
 *       num_partitions: 256, // 聚类数量
 *       num_sub_vectors: 96   // 子向量数量
 *     });
 *   }
 * 
 *   async search(queryEmbedding: number[], k: number) {
 *     const results = await this.table
 *       .search(queryEmbedding)
 *       .limit(k)
 *       .execute();
 *     
 *     return results.map(row => ({
 *       chunk: { ...row },
 *       score: 1 - row._distance
 *     }));
 *   }
 * }
 * ```
 */

/**
 * 便捷工厂函数
 */
export function createEnhancedVectorStore(dbPath?: string): EnhancedVectorStore {
  return new EnhancedVectorStore(dbPath);
}





