/**
 * ContextManager - 混合上下文管理器（已升级）
 * 
 * v0.6.0+: 集成显式上下文管理（参考 1.md Aider 模式）
 * 
 * 实现"Aider 模式"的显式上下文控制 + 自动化 RAG
 * 核心功能：
 * 1. 显式上下文添加（用户控制）
 * 2. 自动上下文检索（RAG）
 * 3. 混合上下文合并
 * 4. 上下文窗口管理
 */

import type { FunctionContext, CodeChunk } from '@testmind/shared';
import { SemanticIndexer } from './SemanticIndexer';
import { DependencyGraphBuilder } from './DependencyGraphBuilder';
import { ContextRanker } from './ContextRanker';
import { createComponentLogger } from '../utils/logger';

const logger = createComponentLogger('ContextManager');

export interface ExplicitContextEntry {
  id: string;
  type: 'file' | 'function' | 'directory';
  path: string;
  content?: string;
  chunk?: CodeChunk;
  addedAt: Date;
  priority: number; // 1-10, 10 最高
}

export interface HybridContext {
  explicit: ExplicitContextEntry[];
  automatic: CodeChunk[];
  ranked: CodeChunk[];
  totalTokens: number;
  truncated: boolean;
}

export interface ContextOptions {
  maxTokens?: number;
  includeExplicit?: boolean;
  includeAutomatic?: boolean;
  focusScope?: string; // 聚焦的目录或文件
  prioritizeRecent?: boolean;
}

/**
 * 混合上下文管理器
 */
export class ContextManager {
  private explicitContext: Map<string, ExplicitContextEntry> = new Map();
  private focusScope?: string;
  private maxTokensDefault = 8000; // 默认上下文窗口大小（为 LLM 留空间）

  constructor(
    private semanticIndexer: SemanticIndexer,
    private dependencyBuilder: DependencyGraphBuilder,
    private ranker: ContextRanker
  ) {
    logger.debug('ContextManager initialized');
  }

  /**
   * 显式添加文件到上下文
   */
  async addFile(filePath: string, priority: number = 5): Promise<void> {
    logger.debug('Adding file to context', { filePath, priority });

    const id = `file:${filePath}`;
    
    if (this.explicitContext.has(id)) {
      logger.debug('File already in context, updating priority', { filePath });
      const entry = this.explicitContext.get(id)!;
      entry.priority = priority;
      entry.addedAt = new Date();
      return;
    }

    // 读取文件内容（在真实实现中从文件系统读取）
    const content = await this.readFile(filePath);

    this.explicitContext.set(id, {
      id,
      type: 'file',
      path: filePath,
      content,
      addedAt: new Date(),
      priority,
    });

    logger.info('File added to explicit context', { filePath, priority });
  }

  /**
   * 显式添加函数到上下文
   */
  async addFunction(filePath: string, functionName: string, priority: number = 7): Promise<void> {
    logger.debug('Adding function to context', { filePath, functionName, priority });

    const id = `function:${filePath}::${functionName}`;

    if (this.explicitContext.has(id)) {
      const entry = this.explicitContext.get(id)!;
      entry.priority = priority;
      entry.addedAt = new Date();
      return;
    }

    // 从 SemanticIndexer 检索函数信息
    const chunk = await this.semanticIndexer.getFunction(filePath, functionName);

    if (!chunk) {
      logger.warn('Function not found in index', { filePath, functionName });
      return;
    }

    this.explicitContext.set(id, {
      id,
      type: 'function',
      path: `${filePath}::${functionName}`,
      chunk,
      addedAt: new Date(),
      priority,
    });

    logger.info('Function added to explicit context', { filePath, functionName, priority });
  }

  /**
   * 显式添加目录到上下文
   */
  async addDirectory(directoryPath: string, priority: number = 4): Promise<void> {
    logger.debug('Adding directory to context', { directoryPath, priority });

    const id = `dir:${directoryPath}`;

    if (this.explicitContext.has(id)) {
      const entry = this.explicitContext.get(id)!;
      entry.priority = priority;
      entry.addedAt = new Date();
      return;
    }

    this.explicitContext.set(id, {
      id,
      type: 'directory',
      path: directoryPath,
      addedAt: new Date(),
      priority,
    });

    logger.info('Directory added to explicit context', { directoryPath, priority });
  }

  /**
   * 移除显式上下文
   */
  remove(id: string): boolean {
    const existed = this.explicitContext.has(id);
    this.explicitContext.delete(id);
    
    if (existed) {
      logger.info('Removed from explicit context', { id });
    }
    
    return existed;
  }

  /**
   * 清空所有显式上下文
   */
  clearExplicit(): void {
    const count = this.explicitContext.size;
    this.explicitContext.clear();
    this.focusScope = undefined;
    logger.info('Cleared explicit context', { removedCount: count });
  }

  /**
   * 设置聚焦范围
   */
  focusOn(scope: string): void {
    this.focusScope = scope;
    logger.info('Focus scope set', { scope });
  }

  /**
   * 清除聚焦范围
   */
  clearFocus(): void {
    this.focusScope = undefined;
    logger.info('Focus scope cleared');
  }

  /**
   * 获取混合上下文（核心方法）
   */
  async getHybridContext(
    query: string,
    options: ContextOptions = {}
  ): Promise<HybridContext> {
    const startTime = Date.now();

    const opts = {
      maxTokens: options.maxTokens || this.maxTokensDefault,
      includeExplicit: options.includeExplicit ?? true,
      includeAutomatic: options.includeAutomatic ?? true,
      focusScope: options.focusScope || this.focusScope,
      prioritizeRecent: options.prioritizeRecent ?? false,
    };

    logger.debug('Building hybrid context', {
      query: query.substring(0, 50),
      options: opts,
    });

    // 步骤 1: 收集显式上下文
    const explicitEntries: ExplicitContextEntry[] = [];
    let explicitChunks: CodeChunk[] = [];

    if (opts.includeExplicit) {
      explicitEntries.push(...Array.from(this.explicitContext.values()));

      // 转换显式上下文为 CodeChunk
      explicitChunks = await this.convertToChunks(explicitEntries);
    }

    // 步骤 2: 获取自动上下文（RAG）
    let automaticChunks: CodeChunk[] = [];

    if (opts.includeAutomatic) {
      automaticChunks = await this.getAutomaticContext(query, opts.focusScope);
    }

    // 步骤 3: 合并并排序
    const allChunks = [...explicitChunks, ...automaticChunks];

    const rankedResults = this.ranker.rankChunks(allChunks);
    const rankedChunks = rankedResults.map(r => r.context as CodeChunk);

    // 步骤 4: 限制在 token 窗口内
    const { chunks: truncatedChunks, truncated, totalTokens } = this.truncateToTokenLimit(
      rankedChunks,
      opts.maxTokens
    );

    const duration = Date.now() - startTime;

    logger.info('Hybrid context built', {
      explicitCount: explicitChunks.length,
      automaticCount: automaticChunks.length,
      rankedCount: truncatedChunks.length,
      totalTokens,
      truncated,
      duration,
    });

    return {
      explicit: explicitEntries,
      automatic: automaticChunks,
      ranked: truncatedChunks,
      totalTokens,
      truncated,
    };
  }

  /**
   * 获取自动上下文（从语义索引）
   */
  private async getAutomaticContext(
    query: string,
    focusScope?: string
  ): Promise<CodeChunk[]> {
    try {
      // 从 SemanticIndexer 进行语义搜索
      const results = await this.semanticIndexer.search(query, {
        topK: 10,
        minScore: 0.7,
      });

      // 如果有聚焦范围，过滤结果
      let chunks = results.map((r) => r.chunk);

      if (focusScope) {
        chunks = chunks.filter((chunk) => chunk.filePath.startsWith(focusScope));
        logger.debug('Filtered by focus scope', {
          originalCount: results.length,
          filteredCount: chunks.length,
          focusScope,
        });
      }

      return chunks;
    } catch (error) {
      logger.error('Failed to get automatic context', { error });
      return [];
    }
  }

  /**
   * 将显式上下文条目转换为 CodeChunk
   */
  private async convertToChunks(entries: ExplicitContextEntry[]): Promise<CodeChunk[]> {
    const chunks: CodeChunk[] = [];

    for (const entry of entries) {
      if (entry.chunk) {
        // 已经是 chunk
        chunks.push(entry.chunk);
      } else if (entry.content) {
        // 文件内容，需要分块
        const fileChunks = await this.chunkFileContent(entry.path, entry.content);
        chunks.push(...fileChunks);
      } else if (entry.type === 'directory') {
        // 目录，获取目录下的所有文件
        const dirChunks = await this.getDirectoryChunks(entry.path);
        chunks.push(...dirChunks);
      }
    }

    return chunks;
  }

  /**
   * 将文件内容分块
   */
  private async chunkFileContent(filePath: string, content: string): Promise<CodeChunk[]> {
    // 简单实现：按函数分块
    // 真实实现会使用更智能的分块策略
    const chunk: CodeChunk = {
      id: `chunk:${filePath}`,
      content,
      filePath,
      startLine: 1,
      endLine: content.split('\n').length,
      embedding: [],
      imports: [],
      exports: [],
      dependencies: [],
    };

    return [chunk];
  }

  /**
   * 获取目录下的所有代码块
   */
  private async getDirectoryChunks(directoryPath: string): Promise<CodeChunk[]> {
    // 从 SemanticIndexer 获取目录下的所有代码块
    try {
      const results = await this.semanticIndexer.search('*', {
        topK: 100,
        minScore: 0,
      });

      return results
        .filter((r) => r.chunk.filePath?.startsWith(directoryPath))
        .map((r) => r.chunk);
    } catch (error) {
      logger.error('Failed to get directory chunks', { error, directoryPath });
      return [];
    }
  }

  /**
   * 限制上下文在 token 窗口内
   */
  private truncateToTokenLimit(
    chunks: CodeChunk[],
    maxTokens: number
  ): { chunks: CodeChunk[]; truncated: boolean; totalTokens: number } {
    const result: CodeChunk[] = [];
    let totalTokens = 0;
    let truncated = false;

    for (const chunk of chunks) {
      const chunkTokens = this.estimateTokens(chunk.content);

      if (totalTokens + chunkTokens > maxTokens) {
        truncated = true;
        logger.debug('Context truncated at token limit', {
          limit: maxTokens,
          actual: totalTokens,
          skipped: chunks.length - result.length,
        });
        break;
      }

      result.push(chunk);
      totalTokens += chunkTokens;
    }

    return { chunks: result, truncated, totalTokens };
  }

  /**
   * 估算文本的 token 数量
   * 简化版：1 token ≈ 4 字符
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * 读取文件内容（模拟）
   */
  private async readFile(filePath: string): Promise<string> {
    // 在真实实现中，从文件系统读取
    // 现在返回空字符串
    return '';
  }

  /**
   * 获取当前显式上下文列表
   */
  listExplicitContext(): ExplicitContextEntry[] {
    return Array.from(this.explicitContext.values()).sort(
      (a, b) => b.priority - a.priority
    );
  }

  /**
   * 获取上下文统计信息
   */
  getStatistics(): {
    explicitCount: number;
    explicitByType: Record<string, number>;
    focusScope?: string;
  } {
    const byType: Record<string, number> = {
      file: 0,
      function: 0,
      directory: 0,
    };

    for (const entry of this.explicitContext.values()) {
      byType[entry.type]++;
    }

    return {
      explicitCount: this.explicitContext.size,
      explicitByType: byType,
      focusScope: this.focusScope,
    };
  }
}
