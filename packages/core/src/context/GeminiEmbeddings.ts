/**
 * GeminiEmbeddings - Google Gemini Embedding 生成器
 * 
 * 优势：
 * - 成本极低：$0.00025/1M tokens（比 OpenAI 便宜 80x）
 * - 向量维度：768（vs OpenAI 1536，节省 50% 存储）
 * - 性能优秀：批量处理速度快
 * 
 * 成本对比（生成 1000 个 embeddings，每个 500 tokens）：
 * - OpenAI text-embedding-3-small: $0.01 (500K tokens * $0.02/1M)
 * - Gemini text-embedding-004: $0.000125 (500K tokens * $0.00025/1M)
 * - **节省 98.75%**
 * 
 * 模型：text-embedding-004
 * - 维度：768
 * - 最大输入：2048 tokens
 * - 支持批量处理
 */

import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import type { CodeChunk } from '@testmind/shared';
import { createComponentLogger } from '../utils/logger';

const logger = createComponentLogger('GeminiEmbeddings');

/**
 * Embedding 配置
 */
export interface GeminiEmbeddingConfig {
  /** Google API Key */
  apiKey: string;
  
  /** 批量大小 */
  batchSize?: number;
  
  /** 最大重试次数 */
  maxRetries?: number;
  
  /** 重试延迟（毫秒） */
  retryDelay?: number;
  
  /** 任务类型 */
  taskType?: 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY' | 'SEMANTIC_SIMILARITY' | 'CLASSIFICATION';
}

/**
 * 生成结果
 */
export interface EmbeddingGenerationResult {
  /** 成功生成的数量 */
  successCount: number;
  
  /** 失败的数量 */
  failedCount: number;
  
  /** 总耗时（毫秒） */
  duration: number;
  
  /** 总 Token 数 */
  totalTokens: number;
  
  /** 估算成本（美元） */
  estimatedCost: number;
  
  /** 失败的项 */
  failures: Array<{
    chunkId: string;
    error: string;
  }>;
}

/**
 * 进度回调
 */
export type ProgressCallback = (progress: {
  current: number;
  total: number;
  percentage: number;
  currentFile?: string;
  estimatedTimeRemaining?: number;
}) => void;

/**
 * Gemini Embedding 生成器
 */
export class GeminiEmbeddingGenerator {
  private config: Required<Omit<GeminiEmbeddingConfig, 'apiKey'>> & { apiKey: string };
  private embeddings: GoogleGenerativeAIEmbeddings;
  private totalTokensUsed = 0;
  
  // 模型定价（$/1M tokens）
  private static readonly MODEL_PRICING = 0.00025; // $0.00025 per 1M tokens

  constructor(config: GeminiEmbeddingConfig) {
    this.config = {
      apiKey: config.apiKey,
      batchSize: config.batchSize || 100,
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 1000,
      taskType: config.taskType || 'RETRIEVAL_DOCUMENT',
    };

    this.embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: this.config.apiKey,
      modelName: 'text-embedding-004',
      taskType: this.config.taskType,
    });

    logger.info('GeminiEmbeddingGenerator initialized', {
      batchSize: this.config.batchSize,
      taskType: this.config.taskType,
    });
  }

  /**
   * 批量生成 embeddings
   */
  async generateBatch(
    chunks: CodeChunk[],
    onProgress?: ProgressCallback
  ): Promise<EmbeddingGenerationResult> {
    const startTime = Date.now();
    const failures: Array<{ chunkId: string; error: string }> = [];
    let successCount = 0;
    let totalTokens = 0;

    logger.info('Starting batch embedding generation', { 
      totalChunks: chunks.length,
      batchSize: this.config.batchSize 
    });

    // 分批处理
    for (let i = 0; i < chunks.length; i += this.config.batchSize) {
      const batch = chunks.slice(i, Math.min(i + this.config.batchSize, chunks.length));
      const batchTexts = batch.map(chunk => this.prepareText(chunk));

      try {
        // 调用 Gemini Embeddings API
        const vectors = await this.embedWithRetry(batchTexts);
        
        // 更新 chunks 的 embedding
        batch.forEach((chunk, idx) => {
          if (vectors[idx]) {
            (chunk as any).embedding = vectors[idx];
            successCount++;
          }
        });

        // 估算 tokens（Gemini 没有直接返回 token count）
        const batchTokens = batchTexts.reduce((sum, text) => sum + this.estimateTokens(text), 0);
        totalTokens += batchTokens;

        logger.debug('Batch processed', {
          batchIndex: Math.floor(i / this.config.batchSize) + 1,
          processed: Math.min(i + this.config.batchSize, chunks.length),
          total: chunks.length,
        });

        // 进度回调
        if (onProgress) {
          const current = Math.min(i + this.config.batchSize, chunks.length);
          const percentage = Math.floor((current / chunks.length) * 100);
          const elapsed = Date.now() - startTime;
          const estimatedTotal = (elapsed / current) * chunks.length;
          const estimatedTimeRemaining = estimatedTotal - elapsed;

          onProgress({
            current,
            total: chunks.length,
            percentage,
            estimatedTimeRemaining,
          });
        }

      } catch (error: any) {
        logger.warn('Batch processing failed', {
          batchIndex: Math.floor(i / this.config.batchSize) + 1,
          error: error.message,
        });

        // 记录失败的 chunks
        batch.forEach(chunk => {
          failures.push({
            chunkId: chunk.id,
            error: error.message,
          });
        });
      }

      // 避免速率限制
      if (i + this.config.batchSize < chunks.length) {
        await this.sleep(100); // 100ms 延迟
      }
    }

    const duration = Date.now() - startTime;
    this.totalTokensUsed += totalTokens;

    // 估算成本
    const estimatedCost = (totalTokens / 1_000_000) * GeminiEmbeddingGenerator.MODEL_PRICING;

    const result: EmbeddingGenerationResult = {
      successCount,
      failedCount: failures.length,
      duration,
      totalTokens,
      estimatedCost,
      failures,
    };

    logger.info('Batch embedding generation completed', {
      ...result,
      successRate: `${((successCount / chunks.length) * 100).toFixed(2)}%`,
    });

    return result;
  }

  /**
   * 生成单个文本的 embedding
   */
  async generateSingle(text: string): Promise<number[]> {
    logger.debug('Generating single embedding', { 
      textLength: text.length 
    });

    try {
      const vector = await this.embeddings.embedQuery(text);
      
      const tokens = this.estimateTokens(text);
      this.totalTokensUsed += tokens;
      
      return vector;

    } catch (error: any) {
      logger.error('Failed to generate embedding', { error: error.message });
      throw new Error(`Failed to generate embedding: ${error.message}`);
    }
  }

  /**
   * 带重试的 embedding 生成
   */
  private async embedWithRetry(texts: string[]): Promise<number[][]> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        return await this.embeddings.embedDocuments(texts);
      } catch (error: any) {
        lastError = error;
        
        logger.warn('Embedding attempt failed', {
          attempt,
          maxRetries: this.config.maxRetries,
          error: error.message,
        });

        if (attempt < this.config.maxRetries) {
          await this.sleep(this.config.retryDelay * attempt);
        }
      }
    }

    throw lastError || new Error('Failed to generate embeddings after retries');
  }

  /**
   * 准备文本（从 CodeChunk 提取）
   */
  private prepareText(chunk: CodeChunk): string {
    // 组合文件路径、函数名和代码内容
    const parts: string[] = [];
    
    if (chunk.filePath) {
      parts.push(`File: ${chunk.filePath}`);
    }
    
    if (chunk.name) {
      parts.push(`Function: ${chunk.name}`);
    }
    
    parts.push(chunk.content);
    
    const text = parts.join('\n\n');
    
    // Gemini text-embedding-004 最大输入 2048 tokens
    // 约 8000 字符（粗略估算：1 token ≈ 4 chars）
    const maxChars = 8000;
    if (text.length > maxChars) {
      return text.substring(0, maxChars);
    }
    
    return text;
  }

  /**
   * 估算 tokens 数量
   * 
   * 粗略规则：
   * - 英文：1 token ≈ 4 chars
   * - 中文：1 token ≈ 1.5 chars
   * - 代码：1 token ≈ 3-4 chars
   */
  private estimateTokens(text: string): number {
    // 简化：按 1 token = 4 chars 估算
    return Math.ceil(text.length / 4);
  }

  /**
   * 睡眠（用于延迟）
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 获取累计使用的 tokens
   */
  getTotalTokensUsed(): number {
    return this.totalTokensUsed;
  }

  /**
   * 获取累计成本
   */
  getTotalCost(): number {
    return (this.totalTokensUsed / 1_000_000) * GeminiEmbeddingGenerator.MODEL_PRICING;
  }
}

/**
 * 便捷工厂函数
 */
export function createGeminiEmbeddings(config: GeminiEmbeddingConfig): GeminiEmbeddingGenerator {
  return new GeminiEmbeddingGenerator(config);
}


