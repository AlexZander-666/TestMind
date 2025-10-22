/**
 * PromptOptimizer - Prompt 优化器
 * 
 * 智能优化 LLM Prompt 以降低成本和提升质量
 * 
 * 优化策略：
 * 1. 移除冗余上下文
 * 2. 压缩代码注释
 * 3. 使用更精简的描述
 * 4. 动态调整详细程度
 * 5. 缓存常用 Prompt 模板
 * 
 * 目标：最高 70% Token 节省
 */

import type { CodeChunk } from '@testmind/shared';
import { createComponentLogger } from '../utils/logger';

export interface OptimizationOptions {
  /** 优化激进度 (0-1，1最激进) */
  aggressiveness?: number;
  
  /** 是否保留注释 */
  keepComments?: boolean;
  
  /** 是否保留空行 */
  keepEmptyLines?: boolean;
  
  /** 最大 token 目标 */
  maxTokens?: number;
  
  /** 最小质量阈值（避免过度压缩） */
  minQualityThreshold?: number;
}

export interface OptimizationResult {
  /** 优化后的 Prompt */
  optimizedPrompt: string;
  
  /** 原始 token 数 */
  originalTokens: number;
  
  /** 优化后 token 数 */
  optimizedTokens: number;
  
  /** 节省的 token 数 */
  savedTokens: number;
  
  /** 节省比例 */
  savedPercentage: number;
  
  /** 应用的优化技术 */
  appliedOptimizations: string[];
}

/**
 * Prompt 优化器
 */
export class PromptOptimizer {
  private logger = createComponentLogger('PromptOptimizer');
  
  /**
   * 优化 Prompt
   */
  async optimize(
    prompt: string,
    codeChunks: CodeChunk[],
    options: OptimizationOptions = {}
  ): Promise<OptimizationResult> {
    const {
      aggressiveness = 0.5,
      keepComments = false,
      keepEmptyLines = false,
      maxTokens,
    } = options;
    
    const appliedOptimizations: string[] = [];
    let optimizedPrompt = prompt;
    let optimizedChunks = [...codeChunks];
    
    // 1. 移除冗余空行
    if (!keepEmptyLines) {
      optimizedPrompt = this.removeExcessiveEmptyLines(optimizedPrompt);
      appliedOptimizations.push('remove-empty-lines');
    }
    
    // 2. 压缩代码注释
    if (!keepComments) {
      optimizedChunks = this.removeComments(optimizedChunks);
      appliedOptimizations.push('remove-comments');
    }
    
    // 3. 移除重复的导入语句
    optimizedChunks = this.deduplicateImports(optimizedChunks);
    appliedOptimizations.push('deduplicate-imports');
    
    // 4. 压缩长变量名（激进模式）
    if (aggressiveness > 0.7) {
      optimizedChunks = this.compressVariableNames(optimizedChunks);
      appliedOptimizations.push('compress-variables');
    }
    
    // 5. 提取代码摘要（激进模式）
    if (aggressiveness > 0.8 && maxTokens) {
      optimizedChunks = this.extractCodeSummary(optimizedChunks, maxTokens);
      appliedOptimizations.push('extract-summary');
    }
    
    // 6. 组合优化后的内容
    const finalPrompt = this.combineOptimizedContent(optimizedPrompt, optimizedChunks);
    
    // 7. 计算节省
    const originalTokens = this.estimateTokens(prompt) + 
      codeChunks.reduce((s, c) => s + this.estimateTokens(c.content), 0);
    const optimizedTokens = this.estimateTokens(finalPrompt);
    const savedTokens = originalTokens - optimizedTokens;
    const savedPercentage = (savedTokens / originalTokens) * 100;
    
    this.logger.info('Prompt optimized', {
      originalTokens,
      optimizedTokens,
      savedTokens,
      savedPercentage: savedPercentage.toFixed(1) + '%',
      optimizations: appliedOptimizations,
    });
    
    return {
      optimizedPrompt: finalPrompt,
      originalTokens,
      optimizedTokens,
      savedTokens,
      savedPercentage,
      appliedOptimizations,
    };
  }
  
  /**
   * 移除过多的空行
   */
  private removeExcessiveEmptyLines(text: string): string {
    // 将连续的空行替换为单个空行
    return text.replace(/\n{3,}/g, '\n\n');
  }
  
  /**
   * 移除代码注释
   */
  private removeComments(chunks: CodeChunk[]): CodeChunk[] {
    return chunks.map(chunk => ({
      ...chunk,
      content: this.stripComments(chunk.content),
    }));
  }
  
  /**
   * 移除代码中的注释
   */
  private stripComments(code: string): string {
    // 移除单行注释
    code = code.replace(/\/\/.*$/gm, '');
    
    // 移除多行注释（保留 JSDoc 给类型提示）
    code = code.replace(/\/\*(?!\*)[\s\S]*?\*\//g, '');
    
    // 移除空行
    code = code.replace(/^\s*\n/gm, '');
    
    return code;
  }
  
  /**
   * 去重导入语句
   */
  private deduplicateImports(chunks: CodeChunk[]): CodeChunk[] {
    const seenImports = new Set<string>();
    
    return chunks.map(chunk => {
      const lines = chunk.content.split('\n');
      const filteredLines: string[] = [];
      
      for (const line of lines) {
        const trimmed = line.trim();
        
        // 检查是否为 import 语句
        if (trimmed.startsWith('import ')) {
          if (!seenImports.has(trimmed)) {
            seenImports.add(trimmed);
            filteredLines.push(line);
          }
        } else {
          filteredLines.push(line);
        }
      }
      
      return {
        ...chunk,
        content: filteredLines.join('\n'),
      };
    });
  }
  
  /**
   * 压缩变量名（激进）
   */
  private compressVariableNames(chunks: CodeChunk[]): CodeChunk[] {
    // 这是一个简化版本，实际应该使用 AST 变换
    // 这里只是示意性的实现
    
    this.logger.warn('Variable name compression is experimental');
    
    return chunks.map(chunk => {
      let code = chunk.content;
      
      // 压缩常见的长变量名
      const replacements = {
        'userRepository': 'userRepo',
        'configuration': 'config',
        'initialization': 'init',
        'authentication': 'auth',
        'authorization': 'authz',
      };
      
      for (const [long, short] of Object.entries(replacements)) {
        const regex = new RegExp(`\\b${long}\\b`, 'g');
        code = code.replace(regex, short);
      }
      
      return {
        ...chunk,
        content: code,
      };
    });
  }
  
  /**
   * 提取代码摘要（激进）
   */
  private extractCodeSummary(chunks: CodeChunk[], maxTokens: number): CodeChunk[] {
    // 当代码太长时，只保留函数签名和类型定义
    
    const estimatedTokens = chunks.reduce((s, c) => 
      s + this.estimateTokens(c.content), 0
    );
    
    if (estimatedTokens <= maxTokens) {
      return chunks;
    }
    
    this.logger.info('Extracting code summary due to token limit', {
      estimatedTokens,
      maxTokens,
    });
    
    return chunks.map(chunk => ({
      ...chunk,
      content: this.extractFunctionSignatures(chunk.content),
    }));
  }
  
  /**
   * 提取函数签名
   */
  private extractFunctionSignatures(code: string): string {
    const lines = code.split('\n');
    const signatures: string[] = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // 保留函数声明
      if (
        trimmed.startsWith('export function') ||
        trimmed.startsWith('export const') ||
        trimmed.startsWith('function') ||
        trimmed.startsWith('class') ||
        trimmed.startsWith('interface') ||
        trimmed.startsWith('type ')
      ) {
        signatures.push(line);
      }
    }
    
    return signatures.join('\n');
  }
  
  /**
   * 组合优化后的内容
   */
  private combineOptimizedContent(prompt: string, chunks: CodeChunk[]): string {
    const codeContext = chunks.map(chunk => {
      const header = `// File: ${chunk.filePath} (lines ${chunk.startLine}-${chunk.endLine})`;
      return `${header}\n${chunk.content}`;
    }).join('\n\n');
    
    return `${prompt}\n\nCode Context:\n${codeContext}`;
  }
  
  /**
   * 估算 token 数量
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
  
  /**
   * 压缩 Prompt 模板
   * 
   * 移除不必要的说明文字，保留核心指令
   */
  compressPromptTemplate(template: string): string {
    let compressed = template;
    
    // 移除多余的礼貌用语
    compressed = compressed.replace(/please\s+/gi, '');
    compressed = compressed.replace(/kindly\s+/gi, '');
    
    // 移除重复的强调
    compressed = compressed.replace(/\s*important:\s*/gi, ' ');
    compressed = compressed.replace(/\s*note:\s*/gi, ' ');
    
    // 压缩空白
    compressed = compressed.replace(/\s{2,}/g, ' ');
    compressed = compressed.replace(/\n{3,}/g, '\n\n');
    
    return compressed.trim();
  }
}

/**
 * 工厂函数
 */
export function createPromptOptimizer(): PromptOptimizer {
  return new PromptOptimizer();
}




