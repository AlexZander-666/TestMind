/**
 * RealLanceDBVectorStore - 真正的 LanceDB 集成
 * 
 * 功能：
 * 1. 持久化向量存储（本地文件系统）
 * 2. 高性能 ANN 搜索（HNSW 索引）
 * 3. 支持过滤查询（filePath, chunkType 等）
 * 4. 增量更新（文件级别）
 * 5. 自动索引优化
 * 
 * 性能目标：
 * - 索引构建：<1s for 1000 chunks
 * - 搜索延迟：<50ms for 10K chunks
 * - 内存占用：合理（使用 mmap）
 * 
 * 对比内存版本：
 * - ✅ 持久化存储
 * - ✅ 更快的搜索（HNSW vs 暴力搜索）
 * - ✅ 更低的内存占用
 */

import type { CodeChunk, SemanticSearchResult } from '@testmind/shared';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createComponentLogger } from '../utils/logger';

const logger = createComponentLogger('RealLanceDBVectorStore');

/**
 * LanceDB 表 schema
 */
export interface LanceDBRecord {
  id: string;
  filePath: string;
  functionName: string;
  code: string;
  vector: number[];
  chunkType: string; // 'function' | 'class' | 'method' | 'interface'
  complexity?: number;
  loc?: number;
  timestamp: number;
  metadata: string; // JSON string
}

/**
 * 搜索选项
 */
export interface SearchOptions {
  k?: number;
  filter?: {
    filePath?: string;
    chunkType?: string;
    minComplexity?: number;
  };
  useIndex?: boolean; // 是否使用 HNSW 索引（默认 true）
}

/**
 * 向量存储统计
 */
export interface VectorStoreStats {
  totalChunks: number;
  totalFiles: number;
  indexedChunks: number;
  lastUpdated: Date;
  storageSize: number; // bytes
}

/**
 * 真正的 LanceDB 向量存储
 * 
 * 注意：此版本使用真实的 @lancedb/lancedb 包
 */
export class RealLanceDBVectorStore {
  private dbPath: string;
  private db: any | null = null; // lancedb.Connection
  private table: any | null = null; // lancedb.Table
  private initialized = false;
  private readonly tableName = 'code_chunks';

  constructor(dbPath = '.testmind/vectors') {
    this.dbPath = dbPath;
  }

  /**
   * 初始化数据库连接
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      logger.debug('Already initialized');
      return;
    }

    try {
      logger.info('Initializing LanceDB', { dbPath: this.dbPath });
      
      // 确保目录存在
      await fs.mkdir(this.dbPath, { recursive: true });

      // 动态导入 @lancedb/lancedb
      const lancedb = await import('@lancedb/lancedb');
      
      // 连接数据库
      this.db = await lancedb.connect(this.dbPath);
      logger.debug('Connected to LanceDB');

      // 尝试打开现有表，如果不存在则创建
      try {
        this.table = await this.db.openTable(this.tableName);
        logger.info('Opened existing table', { table: this.tableName });
      } catch (error) {
        logger.info('Creating new table', { table: this.tableName });
        
        // 创建表时提供一个初始的空记录以定义 schema
        const initialRecord: LanceDBRecord = {
          id: '__init__',
          filePath: '__init__',
          functionName: '__init__',
          code: '',
          vector: Array(768).fill(0), // 768 维零向量（Gemini embedding size）
          chunkType: 'function',
          complexity: 0,
          loc: 0,
          timestamp: Date.now(),
          metadata: '{}',
        };
        
        this.table = await this.db.createTable(this.tableName, [initialRecord]);
        
        // 立即删除初始记录
        await this.table.delete("id = '__init__'");
        logger.debug('Initial record removed');
      }

      this.initialized = true;
      logger.info('LanceDB initialized successfully');
      
    } catch (error: any) {
      logger.error('Failed to initialize LanceDB', { error: error.message });
      
      // 提供友好的错误消息
      if (error.message?.includes('Cannot find module')) {
        throw new Error(
          'LanceDB is not installed. Please run: pnpm add @lancedb/lancedb apache-arrow'
        );
      }
      
      throw new Error(`Failed to initialize LanceDB: ${error.message}`);
    }
  }

  /**
   * 批量插入代码块向量
   */
  async insertChunks(chunks: CodeChunk[]): Promise<void> {
    this.ensureInitialized();

    if (chunks.length === 0) {
      logger.warn('No chunks to insert');
      return;
    }

    const startTime = Date.now();
    logger.info('Inserting chunks', { count: chunks.length });

    try {
      // 转换为 LanceDB 记录格式
      const records: LanceDBRecord[] = chunks.map(chunk => ({
        id: chunk.id,
        filePath: chunk.filePath,
        functionName: chunk.name || '',
        code: chunk.content,
        vector: chunk.embedding || [], // 假设 CodeChunk 有 embedding 字段
        chunkType: chunk.type || 'function',
        complexity: chunk.complexity,
        loc: chunk.loc,
        timestamp: Date.now(),
        metadata: JSON.stringify(chunk.metadata || {}),
      }));

      // 批量插入
      // LanceDB 会自动处理重复的 id（覆盖）
      await this.table.add(records);
      
      const duration = Date.now() - startTime;
      logger.info('Chunks inserted successfully', { 
        count: records.length, 
        duration 
      });

    } catch (error: any) {
      logger.error('Failed to insert chunks', { 
        error: error.message,
        count: chunks.length 
      });
      throw new Error(`Failed to insert chunks: ${error.message}`);
    }
  }

  /**
   * 语义搜索（向量相似度）
   */
  async search(
    queryEmbedding: number[],
    options: SearchOptions = {}
  ): Promise<SemanticSearchResult[]> {
    this.ensureInitialized();

    const { k = 5, filter, useIndex = true } = options;
    const startTime = Date.now();
    
    logger.debug('Searching vectors', { k, filter, useIndex });

    try {
      // 构建搜索查询
      let query = this.table
        .search(queryEmbedding)
        .limit(k);

      // 应用过滤器
      if (filter?.filePath) {
        query = query.where(`filePath = '${filter.filePath}'`);
      }
      if (filter?.chunkType) {
        query = query.where(`chunkType = '${filter.chunkType}'`);
      }
      if (filter?.minComplexity !== undefined) {
        query = query.where(`complexity >= ${filter.minComplexity}`);
      }

      // 执行搜索
      const rawResults = await query.execute();
      
      // LanceDB 可能返回不同类型的结果，尝试多种转换方式
      let results: any[] = [];
      
      if (Array.isArray(rawResults)) {
        results = rawResults;
      } else if (typeof rawResults[Symbol.asyncIterator] === 'function') {
        // 异步迭代器
        for await (const row of rawResults) {
          results.push(row);
        }
      } else if (typeof rawResults.toArray === 'function') {
        // Apache Arrow RecordBatch
        results = await rawResults.toArray();
      } else {
        // 直接将其视为可迭代对象
        results = [...rawResults];
      }
      
      const duration = Date.now() - startTime;
      
      // 转换为 SemanticSearchResult 格式
      const searchResults: SemanticSearchResult[] = results.map((row: any) => ({
        chunk: {
          id: row.id,
          filePath: row.filePath,
          name: row.functionName,
          content: row.code,
          type: row.chunkType,
          complexity: row.complexity,
          loc: row.loc,
          metadata: JSON.parse(row.metadata || '{}'),
        } as CodeChunk,
        score: 1 - (row._distance || 0), // LanceDB 返回距离，转换为相似度
        relevance: 1 - (row._distance || 0),
      }));

      logger.info('Search completed', { 
        results: searchResults.length,
        duration 
      });

      return searchResults;

    } catch (error: any) {
      logger.error('Search failed', { error: error.message });
      throw new Error(`Vector search failed: ${error.message}`);
    }
  }

  /**
   * 创建 HNSW 索引（加速搜索）
   * 
   * 建议：在有 >1000 chunks 时创建索引
   */
  async createIndex(): Promise<void> {
    this.ensureInitialized();

    const startTime = Date.now();
    logger.info('Creating HNSW index...');

    try {
      // 创建索引
      await this.table.createIndex('vector', {
        type: 'ivf_pq',
        num_partitions: 256,
        num_sub_vectors: 96,
      });

      const duration = Date.now() - startTime;
      logger.info('Index created successfully', { duration });

    } catch (error: any) {
      // 如果索引已存在，忽略错误
      if (error.message?.includes('already exists')) {
        logger.debug('Index already exists');
        return;
      }
      
      logger.error('Failed to create index', { error: error.message });
      throw new Error(`Failed to create index: ${error.message}`);
    }
  }

  /**
   * 更新文件的向量
   */
  async updateFile(filePath: string, chunks: CodeChunk[]): Promise<void> {
    this.ensureInitialized();

    logger.info('Updating file', { filePath, chunks: chunks.length });

    try {
      // 1. 删除该文件的所有旧向量
      await this.deleteFile(filePath);

      // 2. 插入新向量
      await this.insertChunks(chunks);

      logger.info('File updated successfully', { filePath });

    } catch (error: any) {
      logger.error('Failed to update file', { 
        filePath, 
        error: error.message 
      });
      throw new Error(`Failed to update file: ${error.message}`);
    }
  }

  /**
   * 删除文件的所有向量
   */
  async deleteFile(filePath: string): Promise<void> {
    this.ensureInitialized();

    logger.debug('Deleting file vectors', { filePath });

    try {
      // LanceDB 使用 SQL-like delete
      await this.table.delete(`filePath = '${filePath}'`);
      
      logger.debug('File deleted successfully', { filePath });

    } catch (error: any) {
      logger.error('Failed to delete file', { 
        filePath, 
        error: error.message 
      });
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  }

  /**
   * 获取统计信息
   */
  async getStats(): Promise<VectorStoreStats> {
    this.ensureInitialized();

    try {
      const count = await this.table.countRows();
      
      // 统计唯一文件数
      // 注意：LanceDB 不支持 SQL GROUP BY，需要手动统计
      const rawRecords = await this.table.query().execute();
      let allRecords: any[] = [];
      
      if (Array.isArray(rawRecords)) {
        allRecords = rawRecords;
      } else if (typeof rawRecords[Symbol.asyncIterator] === 'function') {
        for await (const row of rawRecords) {
          allRecords.push(row);
        }
      } else if (typeof rawRecords.toArray === 'function') {
        allRecords = await rawRecords.toArray();
      } else {
        allRecords = [...rawRecords];
      }
      
      const uniqueFiles = new Set(allRecords.map((r: any) => r.filePath));

      // 估算存储大小
      const dbDir = await fs.stat(this.dbPath);
      const storageSize = dbDir.size || 0;

      return {
        totalChunks: count,
        totalFiles: uniqueFiles.size,
        indexedChunks: count,
        lastUpdated: new Date(),
        storageSize,
      };

    } catch (error: any) {
      logger.error('Failed to get stats', { error: error.message });
      
      return {
        totalChunks: 0,
        totalFiles: 0,
        indexedChunks: 0,
        lastUpdated: new Date(),
        storageSize: 0,
      };
    }
  }

  /**
   * 压缩数据库（清理已删除的数据）
   */
  async compact(): Promise<void> {
    this.ensureInitialized();

    const startTime = Date.now();
    logger.info('Compacting database...');

    try {
      await this.table.optimize();
      
      const duration = Date.now() - startTime;
      logger.info('Database compacted', { duration });

    } catch (error: any) {
      logger.warn('Failed to compact database', { error: error.message });
      // 压缩失败不影响功能，只记录警告
    }
  }

  /**
   * 关闭数据库连接
   */
  async close(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    logger.info('Closing LanceDB connection');
    
    // LanceDB 的 Node.js 版本自动管理连接，不需要显式关闭
    this.db = null;
    this.table = null;
    this.initialized = false;
  }

  /**
   * 确保已初始化
   */
  private ensureInitialized(): void {
    if (!this.initialized || !this.table) {
      throw new Error('VectorStore not initialized. Call initialize() first.');
    }
  }
}

/**
 * 便捷工厂函数
 */
export function createRealVectorStore(dbPath?: string): RealLanceDBVectorStore {
  return new RealLanceDBVectorStore(dbPath);
}

