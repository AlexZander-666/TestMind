/**
 * ContextManager - 混合上下文管理器
 * 
 * 实现"Aider 模式"的显式上下文控制 + 自动化 RAG
 * 核心功能：
 * 1. 显式上下文添加（用户控制）
 * 2. 自动上下文检索（RAG）
 * 3. 混合上下文合并
 * 4. 上下文窗口管理
 */

import { promises as fs } from 'fs';
import path from 'path';

import type { CodeChunk, ProjectConfig } from '@testmind/shared';

import { createComponentLogger } from '../utils/logger';

import { ContextOptimizationService } from './ContextOptimizationService';
import { ContextRanker } from './ContextRanker';
import { DependencyGraphBuilder } from './DependencyGraphBuilder';
import { SemanticIndexer } from './SemanticIndexer';
import type { ExplicitContextEntry, RankedChunk } from './types';


const logger = createComponentLogger('ContextManager');

export interface FocusPoint {
  filePath: string;
  functionName: string;
  addedAt: Date;
}

export interface ContextSnapshot {
  explicitFiles: Array<{
    id: string;
    filePath: string;
    displayPath: string;
    tokens: number;
    priority: number;
    addedAt: Date;
    isFocused?: boolean;
  }>;
  focusPoints: FocusPoint[];
  totalTokens: number;
  message: string;
}

export interface HybridContext {
  explicit: ExplicitContextEntry[];
  explicitFiles: ExplicitContextEntry[];
  automatic: CodeChunk[];
  relevantChunks?: CodeChunk[];
  ranked: RankedChunk[];
  focusPoints: FocusPoint[];
  totalTokens: number;
  truncated: boolean;
  contextSize: string;
  dependencies?: {
    edgesTraversed: number;
    reverseHits: number;
    cyclesDetected: number;
  };
  diagnostics?: {
    topFiles: string[];
  };
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
  private readonly explicitContext: Map<string, ExplicitContextEntry> = new Map();
  private focusPoints: FocusPoint[] = [];
  private readonly focusedFiles: Set<string> = new Set();
  private focusScope?: string;
  private readonly maxTokensDefault = 8000; // 默认上下文窗口大小（为 LLM 留空间）
  private readonly optimizationService: ContextOptimizationService;
  private readonly semanticIndexer: SemanticIndexer;
  private readonly dependencyBuilder: DependencyGraphBuilder;
  private readonly ranker: ContextRanker;
  private readonly projectRoot?: string;
  private readonly projectConfig?: ProjectConfig;
  private ownsDependencies = false;

  constructor(
    configOrIndexer: ProjectConfig | SemanticIndexer,
    projectRootOrDependency?: string | DependencyGraphBuilder,
    ranker?: ContextRanker,
  ) {
    if (configOrIndexer instanceof SemanticIndexer && projectRootOrDependency instanceof DependencyGraphBuilder) {
      this.semanticIndexer = configOrIndexer;
      this.dependencyBuilder = projectRootOrDependency;
      this.ranker = ranker ?? new ContextRanker();
    } else if (ContextManager.isProjectConfig(configOrIndexer) && typeof projectRootOrDependency === 'string') {
      this.projectConfig = configOrIndexer;
      this.projectRoot = projectRootOrDependency;
      this.semanticIndexer = new SemanticIndexer(configOrIndexer);
      this.dependencyBuilder = new DependencyGraphBuilder(configOrIndexer);
      this.ranker = new ContextRanker();
      this.ownsDependencies = true;
    } else {
      throw new Error(
        'ContextManager requires either (SemanticIndexer, DependencyGraphBuilder) or (ProjectConfig, projectPath)',
      );
    }

    logger.debug('ContextManager initialized', {
      projectRoot: this.projectRoot,
      projectLanguage: this.projectConfig?.language,
    });

    this.optimizationService = new ContextOptimizationService(
      this.semanticIndexer,
      this.dependencyBuilder,
      this.ranker,
    );
  }

  private static isProjectConfig(value: unknown): value is ProjectConfig {
    if (!value || typeof value !== 'object') {
      return false;
    }
    return 'language' in value && 'testFramework' in value;
  }

  /**
   * 显式添加文件到上下文
   */
  async addFile(filePath: string, priority: number = 5): Promise<void> {
    logger.debug('Adding file to context', { filePath, priority });

    const absolutePath = this.resolveAbsolutePath(filePath);
    const id = this.createEntryId('file', absolutePath);
    
    if (this.explicitContext.has(id)) {
      logger.debug('File already in context, updating priority', { filePath });
      const entry = this.explicitContext.get(id)!;
      entry.priority = priority;
      entry.addedAt = new Date();
      return;
    }

    // 读取文件内容（在真实实现中从文件系统读取）
    const content = await this.readFile(absolutePath);

    this.explicitContext.set(id, {
      id,
      type: 'file',
      path: absolutePath,
      content,
      addedAt: new Date(),
      priority,
      matchedStrategies: ['explicit'],
    });

    logger.info('File added to explicit context', { filePath: absolutePath, priority });
  }

  /**
   * Backwards compatible alias used by CLI + REPL
   */
  async addToContext(filePath: string, priority?: number): Promise<void> {
    await this.addFile(filePath, priority ?? 5);
  }

  /**
   * 显式添加函数到上下文
   */
  async addFunction(filePath: string, functionName: string, priority: number = 7): Promise<void> {
    logger.debug('Adding function to context', { filePath, functionName, priority });

    const absolutePath = this.resolveAbsolutePath(filePath);
    const id = this.createEntryId('function', `${absolutePath}::${functionName}`);

    if (this.explicitContext.has(id)) {
      const entry = this.explicitContext.get(id)!;
      entry.priority = priority;
      entry.addedAt = new Date();
      return;
    }

    // 从 SemanticIndexer 检索函数信息
    const chunk = await this.semanticIndexer.getFunction(absolutePath, functionName);

    if (!chunk) {
      logger.warn('Function not found in index', { filePath, functionName });
      return;
    }

    this.explicitContext.set(id, {
      id,
      type: 'function',
      path: `${absolutePath}::${functionName}`,
      chunk,
      addedAt: new Date(),
      priority,
    });

    logger.info('Function added to explicit context', {
      filePath: absolutePath,
      functionName,
      priority,
    });
  }

  /**
   * 显式添加目录到上下文
   */
  async addDirectory(directoryPath: string, priority: number = 4): Promise<void> {
    logger.debug('Adding directory to context', { directoryPath, priority });

    const absolutePath = this.resolveAbsolutePath(directoryPath);
    const id = this.createEntryId('directory', absolutePath);

    if (this.explicitContext.has(id)) {
      const entry = this.explicitContext.get(id)!;
      entry.priority = priority;
      entry.addedAt = new Date();
      return;
    }

    this.explicitContext.set(id, {
      id,
      type: 'directory',
      path: absolutePath,
      addedAt: new Date(),
      priority,
    });

    logger.info('Directory added to explicit context', { directoryPath: absolutePath, priority });
  }

  /**
   * 移除显式上下文
   */
  remove(id: string): boolean {
    const entry = this.explicitContext.get(id);
    const existed = this.explicitContext.delete(id);
    
    if (existed) {
      if (entry?.type === 'file' && entry.path) {
        this.focusedFiles.delete(entry.path);
        this.focusPoints = this.focusPoints.filter(point => point.filePath !== entry.path);
      }
      logger.info('Removed from explicit context', { id, path: entry?.path });
    }
    
    return existed;
  }

  async removeFromContext(filePath: string): Promise<void> {
    const absolutePath = this.resolveAbsolutePath(filePath);
    const id = this.createEntryId('file', absolutePath);
    this.remove(id);
  }

  /**
   * 清空所有显式上下文
   */
  clearExplicit(): void {
    const count = this.explicitContext.size;
    this.explicitContext.clear();
    this.focusScope = undefined;
    this.focusPoints = [];
    this.focusedFiles.clear();
    logger.info('Cleared explicit context', { removedCount: count });
  }

  clearContext(): void {
    this.clearExplicit();
  }

  /**
   * 设置聚焦范围或聚焦函数
   */
  async focusOn(target: string, functionName?: string): Promise<void> {
    if (!functionName) {
      this.focusScope = target;
      logger.info('Focus scope set', { scope: target });
      return;
    }

    const absolutePath = this.resolveAbsolutePath(target);
    const entryId = this.createEntryId('file', absolutePath);
    if (!this.explicitContext.has(entryId)) {
      await this.addToContext(absolutePath);
    }

    this.focusPoints = this.focusPoints.filter(
      point => !(point.filePath === absolutePath && point.functionName === functionName),
    );
    this.focusPoints.push({
      filePath: absolutePath,
      functionName,
      addedAt: new Date(),
    });
    this.focusedFiles.add(absolutePath);

    logger.info('Function focused', { filePath: absolutePath, functionName });
  }

  /**
   * 清除聚焦范围
   */
  clearFocus(): void {
    this.focusScope = undefined;
    this.focusPoints = [];
    this.focusedFiles.clear();
    logger.info('Focus scope cleared');
  }

  /**
   * 获取混合上下文（核心方法）
   */
  async getHybridContext(
    query: string,
    options: ContextOptions = {},
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

    const explicitEntries: ExplicitContextEntry[] = opts.includeExplicit
      ? this.listExplicitContext()
      : [];

    const response = await this.optimizationService.buildContext({
      projectId: 'default',
      query,
      focusScope: opts.focusScope,
      explicitEntries,
      maxTokens: opts.maxTokens,
      includeAutomatic: opts.includeAutomatic,
    });

    const automaticChunks: CodeChunk[] = opts.includeAutomatic
      ? response.ranked
        .filter(chunk => chunk.source !== 'explicit')
        .map(chunk => chunk.chunk)
      : [];

    const duration = Date.now() - startTime;

    logger.info('Hybrid context built', {
      explicitCount: explicitEntries.length,
      automaticCount: automaticChunks.length,
      rankedCount: response.ranked.length,
      totalTokens: response.tokenUsage.total,
      truncated: response.truncated,
      duration,
    });

    return {
      explicit: explicitEntries,
      explicitFiles: explicitEntries,
      automatic: automaticChunks,
      relevantChunks: automaticChunks,
      ranked: response.ranked,
      focusPoints: [...this.focusPoints],
      totalTokens: response.tokenUsage.total,
      truncated: response.truncated,
      contextSize: this.formatContextSize(response.tokenUsage.total),
      dependencies: response.diagnostics.dependencyStats,
      diagnostics: response.diagnostics,
    };
  }

  /**
   * Backwards compatible alias primarily used by CLI + REPL
   */
  async buildHybridContext(
    query: string,
    options: ContextOptions = {},
  ): Promise<HybridContext> {
    return this.getHybridContext(query, options);
  }

  /**
   * 读取文件内容（模拟）
   */
  private async readFile(filePath: string): Promise<string> {
    try {
      return await fs.readFile(filePath, 'utf8');
    } catch (error) {
      logger.warn('Failed to read file for context', { filePath, error });
      throw new Error(`File not found: ${filePath}`);
    }
  }

  private resolveAbsolutePath(filePath: string): string {
    if (path.isAbsolute(filePath)) {
      return path.normalize(filePath);
    }
    const base = this.projectRoot ?? process.cwd();
    return path.normalize(path.join(base, filePath));
  }

  private formatDisplayPath(filePath: string): string {
    if (!this.projectRoot) {
      return filePath;
    }
    const relativePath = path.relative(this.projectRoot, filePath);
    if (!relativePath || relativePath.startsWith('..')) {
      return filePath;
    }
    return relativePath;
  }

  private createEntryId(type: 'file' | 'function' | 'directory', target: string): string {
    return `${type}:${path.normalize(target)}`;
  }

  /**
   * 获取当前显式上下文列表
   */
  listExplicitContext(): ExplicitContextEntry[] {
    return Array.from(this.explicitContext.values()).sort(
      (a, b) => b.priority - a.priority,
    );
  }

  getCurrentContext(): ContextSnapshot {
    const explicitEntries = this.listExplicitContext();
    const focusPoints = [...this.focusPoints];
    const totalTokens = explicitEntries.reduce(
      (sum, entry) => sum + this.estimateTokens(entry.content ?? entry.chunk?.content ?? ''),
      0,
    );

    let message: string;
    if (explicitEntries.length === 0) {
      message = 'Context is empty. Use /add <file> to include code.';
    } else {
      const header = `Files: ${explicitEntries.length} | tokens: ${totalTokens.toLocaleString()}`;
      const fileLines = explicitEntries.slice(0, 5).map(entry => {
        const display = this.formatDisplayPath(entry.path);
        const focused = this.focusedFiles.has(entry.path) ? ' [FOCUSED]' : '';
        return ` - ${display}${focused}`;
      });
      message = ['Context Snapshot', header, ...fileLines].join('\n');
    }

    return {
      explicitFiles: explicitEntries.map(entry => ({
        id: entry.id,
        filePath: entry.path,
        displayPath: this.formatDisplayPath(entry.path),
        tokens: this.estimateTokens(entry.content ?? entry.chunk?.content ?? ''),
        priority: entry.priority,
        addedAt: entry.addedAt,
        isFocused: this.focusedFiles.has(entry.path),
      })),
      focusPoints,
      totalTokens,
      message,
    };
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
      const type = entry.type || 'file';
      if (byType[type] !== undefined) {
        byType[type]++;
      } else if (byType.file !== undefined) {
        byType.file++; // Default to file if type not recognized
      }
    }

    return {
      explicitCount: this.explicitContext.size,
      explicitByType: byType,
      focusScope: this.focusScope,
    };
  }

  private formatContextSize(tokens: number): string {
    if (!tokens) {
      return '0K tokens';
    }
    return `${Math.max(1, Math.ceil(tokens / 1000))}K tokens`;
  }

  private estimateTokens(content: string): number {
    if (!content) {
      return 0;
    }
    return Math.ceil(content.length / 4);
  }

  async dispose(): Promise<void> {
    if (this.ownsDependencies) {
      await this.semanticIndexer.dispose();
    }
    this.explicitContext.clear();
    this.focusPoints = [];
    this.focusedFiles.clear();
  }
}
