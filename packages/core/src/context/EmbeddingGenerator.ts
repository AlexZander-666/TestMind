/**
 * EmbeddingGenerator - 批量 Embedding 生成器
 * 
 * 优化策略：
 * 1. 批量调用 API（减少网络往返）
 * 2. 成本追踪和估算
 * 3. 错误重试机制
 * 4. 进度回调支持
 * 5. 增量生成（只为新增/修改的代码生成）
 */

import { OpenAIEmbeddings } from '@langchain/openai';
import type { CodeChunk } from '@testmind/shared';

/**
 * Embedding 配置
 */
export interface EmbeddingConfig {
  /** OpenAI API Key */
  apiKey: string;
  
  /** Embedding 模型 */
  model?: 'text-embedding-3-small' | 'text-embedding-3-large' | 'text-embedding-ada-002';
  
  /** 批量大小 */
  batchSize?: number;
  
  /** 最大重试次数 */
  maxRetries?: number;
  
  /** 重试延迟（毫秒） */
  retryDelay?: number;
  
  /** 最大 Token 限制（每个文本） */
  maxTokensPerText?: number;
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
 * Embedding 生成器
 */
export class EmbeddingGenerator {
  private config: Required<Omit<EmbeddingConfig, 'apiKey'>> & { apiKey: string };
  private embeddings: OpenAIEmbeddings;
  private totalTokensUsed = 0;
  
  // 模型定价（$/1M tokens）
  private static readonly MODEL_PRICING = {
    'text-embedding-3-small': 0.02,
    'text-embedding-3-large': 0.13,
    'text-embedding-ada-002': 0.10,
  };

  constructor(config: EmbeddingConfig) {
    this.config = {
      apiKey: config.apiKey,
      model: config.model || 'text-embedding-3-small',
      batchSize: config.batchSize || 100,
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 1000,
      maxTokensPerText: config.maxTokensPerText || 8000,
    };

    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: this.config.apiKey,
      modelName: this.config.model,
    });
  }

  /**
   * 批量生成 Embeddings
   */
  async generateEmbeddings(
    chunks: CodeChunk[],
    onProgress?: ProgressCallback
  ): Promise<EmbeddingGenerationResult> {
    console.log(`[EmbeddingGenerator] Starting batch generation for ${chunks.length} chunks`);
    
    const startTime = Date.now();
    const failures: Array<{ chunkId: string; error: string }> = [];
    let successCount = 0;
    let totalTokens = 0;

    const batches = this.createBatches(chunks);
    
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      if (!batch) continue; // Skip if batch is undefined
      
      const batchStartTime = Date.now();

      try {
        // 准备文本
        const texts = batch.map(chunk => this.prepareTextForEmbedding(chunk));
        
        // 估算 tokens
        const estimatedTokens = texts.reduce((sum, text) => sum + this.estimateTokens(text), 0);
        totalTokens += estimatedTokens;

        // 批量调用 API（带重试）
        const embeddings = await this.generateWithRetry(texts);

        // 将向量附加到 chunks
        batch.forEach((chunk, idx) => {
          const embedding = embeddings[idx];
          if (embedding) {
            chunk.embedding = embedding;
            successCount++;
          }
        });

        // 进度回调
        if (onProgress) {
          const current = (batchIndex + 1) * this.config.batchSize;
          const percentage = Math.min(100, (current / chunks.length) * 100);
          
          // 估算剩余时间
          const elapsed = Date.now() - startTime;
          const avgTimePerBatch = elapsed / (batchIndex + 1);
          const remainingBatches = batches.length - batchIndex - 1;
          const estimatedTimeRemaining = avgTimePerBatch * remainingBatches;

          onProgress({
            current: Math.min(current, chunks.length),
            total: chunks.length,
            percentage: parseFloat(percentage.toFixed(1)),
            currentFile: batch?.[0]?.filePath,
            estimatedTimeRemaining: Math.round(estimatedTimeRemaining / 1000), // 转为秒
          });
        }

        console.log(
          `[EmbeddingGenerator] Batch ${batchIndex + 1}/${batches.length} completed ` +
          `(${batch.length} chunks, ${estimatedTokens} tokens, ${Date.now() - batchStartTime}ms)`
        );

      } catch (error) {
        // 批量失败，记录失败项
        console.error(`[EmbeddingGenerator] Batch ${batchIndex + 1} failed:`, error);
        
        for (const chunk of batch) {
          failures.push({
            chunkId: chunk.id,
            error: String(error),
          });
        }
      }
    }

    const duration = Date.now() - startTime;
    const estimatedCost = this.calculateCost(totalTokens);

    this.totalTokensUsed += totalTokens;

    const result: EmbeddingGenerationResult = {
      successCount,
      failedCount: failures.length,
      duration,
      totalTokens,
      estimatedCost,
      failures,
    };

    console.log('[EmbeddingGenerator] Generation complete:');
    console.log(`  - Success: ${successCount}/${chunks.length}`);
    console.log(`  - Tokens: ${totalTokens.toLocaleString()}`);
    console.log(`  - Cost: $${estimatedCost.toFixed(4)}`);
    console.log(`  - Duration: ${(duration / 1000).toFixed(2)}s`);

    return result;
  }

  /**
   * 准备文本用于 Embedding
   * 
   * 优化：移除不必要的信息，减少 token 使用
   */
  private prepareTextForEmbedding(chunk: CodeChunk): string {
    // 构建结构化文本
    const parts = [
      `File: ${chunk.filePath}`,
    ];

    // 添加函数名（如果有）
    if (chunk.name || chunk.functionName) {
      parts.push(`Function: ${chunk.name || chunk.functionName}`);
    }

    // 添加类型（如果有）
    if (chunk.type) {
      parts.push(`Type: ${chunk.type}`);
    }

    // 添加参数（如果有）
    if (chunk.parameters && chunk.parameters.length > 0) {
      parts.push(`Parameters: ${chunk.parameters.join(', ')}`);
    }

    // 添加返回类型（如果有）
    if (chunk.returnType) {
      parts.push(`Returns: ${chunk.returnType}`);
    }

    // 添加代码（限制长度）
    const codeSnippet = chunk.content.slice(0, this.config.maxTokensPerText * 4); // 粗略估算：1 token ≈ 4 chars
    parts.push(`Code:\n${codeSnippet}`);

    return parts.join('\n');
  }

  /**
   * 估算文本的 Token 数量
   * 
   * 简化估算：1 token ≈ 4 characters (英文)
   * 真实场景应使用 tiktoken 库
   */
  private estimateTokens(text: string): number {
    // 简化估算
    return Math.ceil(text.length / 4);
  }

  /**
   * 计算成本
   */
  private calculateCost(tokens: number): number {
    const pricePerMillion = EmbeddingGenerator.MODEL_PRICING[this.config.model];
    return (tokens / 1_000_000) * pricePerMillion;
  }

  /**
   * 创建批次
   */
  private createBatches(chunks: CodeChunk[]): CodeChunk[][] {
    const batches: CodeChunk[][] = [];
    
    for (let i = 0; i < chunks.length; i += this.config.batchSize) {
      batches.push(chunks.slice(i, i + this.config.batchSize));
    }
    
    return batches;
  }

  /**
   * 带重试的 API 调用
   */
  private async generateWithRetry(texts: string[]): Promise<number[][]> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        // 调用 OpenAI Embeddings API
        const embeddings = await this.embeddings.embedDocuments(texts);
        return embeddings;
      } catch (error) {
        lastError = error as Error;
        console.warn(
          `[EmbeddingGenerator] Attempt ${attempt + 1}/${this.config.maxRetries} failed:`,
          error
        );

        // 等待后重试
        if (attempt < this.config.maxRetries - 1) {
          const delay = this.config.retryDelay * Math.pow(2, attempt); // 指数退避
          console.log(`[EmbeddingGenerator] Retrying in ${delay}ms...`);
          await this.sleep(delay);
        }
      }
    }

    throw lastError || new Error('Failed to generate embeddings after retries');
  }

  /**
   * 增量生成：只为新增或修改的 chunks 生成 embeddings
   */
  async generateIncremental(
    allChunks: CodeChunk[],
    existingChunks: Map<string, CodeChunk>,
    onProgress?: ProgressCallback
  ): Promise<EmbeddingGenerationResult> {
    // 过滤出需要生成 embedding 的 chunks
    const chunksToGenerate = allChunks.filter(chunk => {
      const existing = existingChunks.get(chunk.id);
      
      // 如果不存在或内容已变化，需要重新生成
      if (!existing || !existing.embedding) {
        return true;
      }
      
      // 比较内容哈希（简化：比较长度和前100字符）
      const contentChanged = 
        existing.content.length !== chunk.content.length ||
        existing.content.slice(0, 100) !== chunk.content.slice(0, 100);
      
      return contentChanged;
    });

    console.log(
      `[EmbeddingGenerator] Incremental generation: ${chunksToGenerate.length}/${allChunks.length} chunks need updating`
    );

    // 复用已有的 embeddings
    for (const chunk of allChunks) {
      if (!chunksToGenerate.includes(chunk)) {
        const existing = existingChunks.get(chunk.id);
        if (existing?.embedding) {
          chunk.embedding = existing.embedding;
        }
      }
    }

    // 只为需要的 chunks 生成新 embeddings
    if (chunksToGenerate.length === 0) {
      return {
        successCount: 0,
        failedCount: 0,
        duration: 0,
        totalTokens: 0,
        estimatedCost: 0,
        failures: [],
      };
    }

    return await this.generateEmbeddings(chunksToGenerate, onProgress);
  }

  /**
   * 获取总使用统计
   */
  getTotalStats(): {
    totalTokensUsed: number;
    totalCost: number;
  } {
    return {
      totalTokensUsed: this.totalTokensUsed,
      totalCost: this.calculateCost(this.totalTokensUsed),
    };
  }

  /**
   * 估算生成成本（在实际调用前）
   */
  estimateCost(chunks: CodeChunk[]): {
    estimatedTokens: number;
    estimatedCost: number;
    estimatedDuration: number; // 秒
  } {
    let totalTokens = 0;

    for (const chunk of chunks) {
      const text = this.prepareTextForEmbedding(chunk);
      totalTokens += this.estimateTokens(text);
    }

    const estimatedCost = this.calculateCost(totalTokens);
    
    // 估算时间：约 10 chunks/second
    const estimatedDuration = Math.ceil(chunks.length / 10);

    return {
      estimatedTokens: totalTokens,
      estimatedCost,
      estimatedDuration,
    };
  }

  /**
   * 睡眠辅助函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * 便捷工厂函数
 */
export function createEmbeddingGenerator(config: EmbeddingConfig): EmbeddingGenerator {
  return new EmbeddingGenerator(config);
}

/**
 * 成本优化最佳实践
 * 
 * 1. 选择合适的模型：
 *    - text-embedding-3-small: $0.02/1M tokens (推荐，性价比最高)
 *    - text-embedding-3-large: $0.13/1M tokens (更高质量)
 *    - ada-002: $0.10/1M tokens (旧模型)
 * 
 * 2. 优化输入文本：
 *    - 移除注释和空白行
 *    - 限制代码长度（8000 tokens max）
 *    - 只包含关键上下文
 * 
 * 3. 增量更新：
 *    - 只为变更的文件重新生成
 *    - 使用文件哈希检测变化
 * 
 * 4. 批量处理：
 *    - 每批 100 个文本（OpenAI 建议）
 *    - 减少网络往返
 * 
 * 成本示例：
 * - 小项目（100 函数）：~20K tokens = $0.0004
 * - 中项目（1000 函数）：~200K tokens = $0.004
 * - 大项目（10000 函数）：~2M tokens = $0.04
 */








