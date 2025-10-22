/**
 * ContextFusion - 上下文融合器
 * 
 * 融合显式上下文和自动化上下文的核心逻辑
 * 
 * 设计原则（参考 1.md）:
 * 1. 显式上下文始终包含（用户明确指定）
 * 2. 自动上下文填充剩余 token 预算
 * 3. 智能去重（避免重复包含相同代码块）
 * 4. 优先级排序（显式 > 自动）
 * 5. Token 预算管理（不超过 LLM 上下文窗口）
 */

import type { CodeChunk, SemanticSearchResult } from '@testmind/shared';
import type { PinnedChunk } from './ExplicitContextManager';
import { createComponentLogger } from '../utils/logger';

export interface FusionOptions {
  /** 最大 token 数量 */
  maxTokens: number;
  
  /** 显式上下文的 token 保留比例（0-1） */
  explicitContextReserve?: number;
  
  /** 是否允许部分自动上下文 */
  allowPartialAuto?: boolean;
  
  /** 去重策略 */
  deduplicationStrategy?: 'strict' | 'fuzzy';
}

export interface FusionResult {
  /** 最终的代码块列表 */
  chunks: CodeChunk[];
  
  /** 实际使用的 token 数量 */
  totalTokens: number;
  
  /** 显式上下文的 token 数量 */
  explicitTokens: number;
  
  /** 自动上下文的 token 数量 */
  autoTokens: number;
  
  /** 是否超出预算 */
  exceedsBudget: boolean;
  
  /** 是否发生截断 */
  truncated: boolean;
  
  /** 去重统计 */
  deduplication: {
    duplicatesFound: number;
    duplicatesRemoved: number;
  };
}

/**
 * 上下文融合器
 */
export class ContextFusion {
  private logger = createComponentLogger('ContextFusion');
  
  /**
   * 融合显式上下文和自动上下文
   * 
   * @param explicitChunks - 用户显式指定的代码块
   * @param autoChunks - 自动搜索得到的代码块
   * @param options - 融合选项
   */
  async fuseContexts(
    explicitChunks: PinnedChunk[],
    autoChunks: SemanticSearchResult[],
    options: FusionOptions
  ): Promise<FusionResult> {
    const {
      maxTokens,
      explicitContextReserve = 0.6, // 显式上下文保留 60% 预算
      allowPartialAuto = true,
      deduplicationStrategy = 'strict',
    } = options;
    
    // Step 1: 提取显式上下文的代码块
    const explicitCodeChunks = explicitChunks
      .sort((a, b) => b.priority - a.priority) // 按优先级排序
      .map(p => p.chunk);
    
    // Step 2: 计算显式上下文的 token 数量
    const explicitTokens = this.estimateTokens(explicitCodeChunks);
    
    // Step 3: 计算可用于自动上下文的 token 预算
    const reservedForExplicit = maxTokens * explicitContextReserve;
    const availableForAuto = maxTokens - Math.min(explicitTokens, reservedForExplicit);
    
    // Step 4: 去重（移除与显式上下文重复的自动上下文）
    const deduplicationResult = this.deduplicateChunks(
      explicitCodeChunks,
      autoChunks.map(r => r.chunk),
      deduplicationStrategy
    );
    
    const uniqueAutoChunks = deduplicationResult.uniqueChunks;
    
    // Step 5: 选择自动上下文（在预算内）
    const selectedAutoChunks = this.selectChunksWithinBudget(
      uniqueAutoChunks,
      availableForAuto,
      allowPartialAuto
    );
    
    // Step 6: 合并和最终排序
    const finalChunks = this.mergeAndSort(
      explicitCodeChunks,
      selectedAutoChunks
    );
    
    // Step 7: 计算最终统计信息
    const autoTokens = this.estimateTokens(selectedAutoChunks);
    const totalTokens = explicitTokens + autoTokens;
    const exceedsBudget = totalTokens > maxTokens;
    const truncated = uniqueAutoChunks.length > selectedAutoChunks.length;
    
    this.logger.info('Context fusion completed', {
      explicit: explicitCodeChunks.length,
      auto: selectedAutoChunks.length,
      total: finalChunks.length,
      tokens: { explicit: explicitTokens, auto: autoTokens, total: totalTokens },
      budget: maxTokens,
      exceedsBudget,
      truncated,
    });
    
    return {
      chunks: finalChunks,
      totalTokens,
      explicitTokens,
      autoTokens,
      exceedsBudget,
      truncated,
      deduplication: {
        duplicatesFound: deduplicationResult.duplicatesFound,
        duplicatesRemoved: deduplicationResult.duplicatesRemoved,
      },
    };
  }
  
  /**
   * 估算代码块的 token 数量
   * 
   * 粗略估算：1 token ≈ 4 字符（英文）
   * 更精确的估算需要使用 tiktoken 库
   */
  private estimateTokens(chunks: CodeChunk[]): number {
    return chunks.reduce((sum, chunk) => {
      // 代码内容
      const contentTokens = Math.ceil(chunk.content.length / 4);
      
      // 元数据（文件路径、函数名等）
      const metadataTokens = Math.ceil(
        (chunk.filePath.length + (chunk.name || '').length) / 4
      );
      
      return sum + contentTokens + metadataTokens;
    }, 0);
  }
  
  /**
   * 去重：移除与显式上下文重复的代码块
   */
  private deduplicateChunks(
    explicitChunks: CodeChunk[],
    autoChunks: CodeChunk[],
    strategy: 'strict' | 'fuzzy'
  ): {
    uniqueChunks: CodeChunk[];
    duplicatesFound: number;
    duplicatesRemoved: number;
  } {
    const explicitIds = new Set(explicitChunks.map(c => c.id));
    const uniqueChunks: CodeChunk[] = [];
    let duplicatesFound = 0;
    let duplicatesRemoved = 0;
    
    for (const chunk of autoChunks) {
      // Strict: 基于 ID 去重
      if (strategy === 'strict') {
        if (explicitIds.has(chunk.id)) {
          duplicatesFound++;
          duplicatesRemoved++;
          continue;
        }
        uniqueChunks.push(chunk);
      }
      // Fuzzy: 基于内容相似度去重
      else if (strategy === 'fuzzy') {
        const isDuplicate = this.isFuzzyDuplicate(chunk, explicitChunks);
        if (isDuplicate) {
          duplicatesFound++;
          duplicatesRemoved++;
          continue;
        }
        uniqueChunks.push(chunk);
      }
    }
    
    return { uniqueChunks, duplicatesFound, duplicatesRemoved };
  }
  
  /**
   * 模糊去重：检查内容相似度
   */
  private isFuzzyDuplicate(chunk: CodeChunk, existingChunks: CodeChunk[]): boolean {
    const threshold = 0.9; // 90% 相似度视为重复
    
    for (const existing of existingChunks) {
      const similarity = this.calculateSimilarity(chunk.content, existing.content);
      if (similarity >= threshold) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * 计算两个字符串的相似度（简化版 Jaccard 相似度）
   */
  private calculateSimilarity(str1: string, str2: string): number {
    // 简化：基于字符串长度和公共子串
    if (str1 === str2) return 1.0;
    
    const len1 = str1.length;
    const len2 = str2.length;
    const maxLen = Math.max(len1, len2);
    const minLen = Math.min(len1, len2);
    
    // 非常粗略的估算
    return minLen / maxLen;
  }
  
  /**
   * 在 token 预算内选择代码块
   */
  private selectChunksWithinBudget(
    chunks: CodeChunk[],
    budgetTokens: number,
    allowPartial: boolean
  ): CodeChunk[] {
    const selected: CodeChunk[] = [];
    let usedTokens = 0;
    
    for (const chunk of chunks) {
      const chunkTokens = this.estimateTokens([chunk]);
      
      // 检查是否超出预算
      if (usedTokens + chunkTokens > budgetTokens) {
        if (!allowPartial) {
          // 不允许部分包含，停止添加
          break;
        }
        // 允许部分包含，但这个块太大，跳过
        continue;
      }
      
      selected.push(chunk);
      usedTokens += chunkTokens;
    }
    
    return selected;
  }
  
  /**
   * 合并并排序最终的代码块列表
   * 
   * 排序规则：
   * 1. 显式上下文在前
   * 2. 按文件路径分组（便于阅读）
   * 3. 按代码位置排序（同一文件内）
   */
  private mergeAndSort(
    explicitChunks: CodeChunk[],
    autoChunks: CodeChunk[]
  ): CodeChunk[] {
    // 标记显式上下文（用于排序）
    const markedExplicit = explicitChunks.map(c => ({ chunk: c, isExplicit: true }));
    const markedAuto = autoChunks.map(c => ({ chunk: c, isExplicit: false }));
    
    const all = [...markedExplicit, ...markedAuto];
    
    // 排序
    all.sort((a, b) => {
      // 1. 显式上下文优先
      if (a.isExplicit !== b.isExplicit) {
        return a.isExplicit ? -1 : 1;
      }
      
      // 2. 按文件路径分组
      if (a.chunk.filePath !== b.chunk.filePath) {
        return a.chunk.filePath.localeCompare(b.chunk.filePath);
      }
      
      // 3. 按代码位置排序（同一文件内）
      return a.chunk.startLine - b.chunk.startLine;
    });
    
    return all.map(item => item.chunk);
  }
}

/**
 * 工厂函数
 */
export function createContextFusion(): ContextFusion {
  return new ContextFusion();
}


