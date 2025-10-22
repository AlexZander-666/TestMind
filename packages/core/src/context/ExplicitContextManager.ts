/**
 * ExplicitContextManager - 显式上下文管理器
 * 
 * 参考 1.md 中的 Aider 模式，让用户精确控制 LLM 的上下文范围
 * 
 * 核心功能：
 * - /add <file> - 将文件添加到会话上下文
 * - /add <file>:<function> - 添加特定函数
 * - /focus <directory> - 聚焦到特定目录
 * - /context - 查看当前上下文
 * - /clear - 清空显式上下文
 * 
 * 设计理念：
 * - 用户明确控制 > 自动推断
 * - 显式上下文优先级最高
 * - 支持细粒度选择（文件/函数/目录）
 */

import type { CodeChunk } from '@testmind/shared';
import { createComponentLogger } from '../utils/logger';

export interface PinnedChunk {
  /** 代码块 */
  chunk: CodeChunk;
  
  /** 添加时间 */
  addedAt: Date;
  
  /** 添加原因 */
  reason?: string;
  
  /** 优先级（1-10，10最高） */
  priority: number;
}

export interface ContextSnapshot {
  /** 已钉住的代码块 */
  pinnedChunks: PinnedChunk[];
  
  /** 聚焦范围（文件路径或目录） */
  focusScope: string[];
  
  /** 总 token 估计 */
  estimatedTokens: number;
  
  /** 快照时间 */
  timestamp: Date;
}

export interface AddFileOptions {
  /** 优先级 */
  priority?: number;
  
  /** 添加原因 */
  reason?: string;
  
  /** 是否递归添加目录 */
  recursive?: boolean;
}

/**
 * 显式上下文管理器
 */
export class ExplicitContextManager {
  private pinnedChunks: Map<string, PinnedChunk> = new Map(); // key: chunk.id
  private focusScope: Set<string> = new Set(); // 文件路径或目录
  private logger = createComponentLogger('ExplicitContextManager');
  
  /**
   * 添加文件到上下文
   * 
   * @param filePath - 文件路径
   * @param chunks - 该文件的所有代码块
   * @param options - 添加选项
   */
  addFile(filePath: string, chunks: CodeChunk[], options: AddFileOptions = {}): void {
    const priority = options.priority ?? 5;
    const reason = options.reason ?? `User added: ${filePath}`;
    
    for (const chunk of chunks) {
      this.pinnedChunks.set(chunk.id, {
        chunk,
        addedAt: new Date(),
        reason,
        priority,
      });
    }
    
    this.logger.info('File added to context', {
      filePath,
      chunksCount: chunks.length,
      priority,
    });
  }
  
  /**
   * 添加特定函数到上下文
   * 
   * @param filePath - 文件路径
   * @param functionName - 函数名
   * @param chunk - 函数对应的代码块
   * @param options - 添加选项
   */
  addFunction(
    filePath: string,
    functionName: string,
    chunk: CodeChunk,
    options: AddFileOptions = {}
  ): void {
    const priority = options.priority ?? 7; // 函数级别的优先级更高
    const reason = options.reason ?? `User added function: ${filePath}:${functionName}`;
    
    this.pinnedChunks.set(chunk.id, {
      chunk,
      addedAt: new Date(),
      reason,
      priority,
    });
    
    this.logger.info('Function added to context', {
      filePath,
      functionName,
      priority,
    });
  }
  
  /**
   * 移除文件从上下文
   * 
   * @param filePath - 文件路径
   */
  removeFile(filePath: string): void {
    let removed = 0;
    
    for (const [id, pinned] of this.pinnedChunks) {
      if (pinned.chunk.filePath === filePath) {
        this.pinnedChunks.delete(id);
        removed++;
      }
    }
    
    this.logger.info('File removed from context', { filePath, removed });
  }
  
  /**
   * 设置聚焦范围
   * 
   * 当设置聚焦范围后，自动上下文搜索将限制在这些范围内
   * 
   * @param scope - 文件路径或目录列表
   */
  setFocus(scope: string[]): void {
    this.focusScope.clear();
    scope.forEach(s => this.focusScope.add(s));
    
    this.logger.info('Focus scope set', { scope });
  }
  
  /**
   * 添加到聚焦范围
   */
  addToFocus(path: string): void {
    this.focusScope.add(path);
    this.logger.info('Added to focus scope', { path });
  }
  
  /**
   * 从聚焦范围移除
   */
  removeFromFocus(path: string): void {
    this.focusScope.delete(path);
    this.logger.info('Removed from focus scope', { path });
  }
  
  /**
   * 获取聚焦范围
   */
  getFocusScope(): string[] {
    return Array.from(this.focusScope);
  }
  
  /**
   * 获取所有已钉住的代码块
   * 
   * @param sortByPriority - 是否按优先级排序
   */
  getPinnedChunks(sortByPriority = true): PinnedChunk[] {
    let chunks = Array.from(this.pinnedChunks.values());
    
    if (sortByPriority) {
      chunks = chunks.sort((a, b) => {
        // 优先级高的在前
        if (a.priority !== b.priority) {
          return b.priority - a.priority;
        }
        // 优先级相同时，早添加的在前
        return a.addedAt.getTime() - b.addedAt.getTime();
      });
    }
    
    return chunks;
  }
  
  /**
   * 获取当前上下文快照
   */
  getCurrentContext(): ContextSnapshot {
    const pinnedChunks = this.getPinnedChunks();
    
    // 估算 token 数量（粗略估算：1 token ≈ 4 字符）
    const estimatedTokens = pinnedChunks.reduce((sum, pinned) => {
      return sum + Math.ceil(pinned.chunk.content.length / 4);
    }, 0);
    
    return {
      pinnedChunks,
      focusScope: this.getFocusScope(),
      estimatedTokens,
      timestamp: new Date(),
    };
  }
  
  /**
   * 清空所有显式上下文
   */
  clear(): void {
    const before = this.pinnedChunks.size;
    this.pinnedChunks.clear();
    
    this.logger.info('Explicit context cleared', { removed: before });
  }
  
  /**
   * 清空聚焦范围
   */
  clearFocus(): void {
    const before = this.focusScope.size;
    this.focusScope.clear();
    
    this.logger.info('Focus scope cleared', { removed: before });
  }
  
  /**
   * 检查文件是否在聚焦范围内
   * 
   * @param filePath - 文件路径
   */
  isInFocus(filePath: string): boolean {
    if (this.focusScope.size === 0) {
      // 没有设置聚焦范围时，所有文件都在范围内
      return true;
    }
    
    for (const scope of this.focusScope) {
      if (filePath === scope || filePath.startsWith(scope + '/')) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * 获取统计信息
   */
  getStatistics(): {
    totalChunks: number;
    totalFiles: number;
    focusScopeCount: number;
    estimatedTokens: number;
    priorityDistribution: Record<number, number>;
  } {
    const chunks = this.getPinnedChunks(false);
    const files = new Set(chunks.map(p => p.chunk.filePath));
    
    const priorityDistribution: Record<number, number> = {};
    for (const pinned of chunks) {
      priorityDistribution[pinned.priority] = (priorityDistribution[pinned.priority] || 0) + 1;
    }
    
    const estimatedTokens = chunks.reduce((sum, pinned) => {
      return sum + Math.ceil(pinned.chunk.content.length / 4);
    }, 0);
    
    return {
      totalChunks: chunks.length,
      totalFiles: files.size,
      focusScopeCount: this.focusScope.size,
      estimatedTokens,
      priorityDistribution,
    };
  }
}

/**
 * 工厂函数
 */
export function createExplicitContextManager(): ExplicitContextManager {
  return new ExplicitContextManager();
}


