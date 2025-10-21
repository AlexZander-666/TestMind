/**
 * StreamingLLMService - 流式 LLM 服务
 * 
 * 支持流式响应，提升用户体验
 */

import type { LLMProvider, LLMResponse } from '@testmind/shared';
import { createComponentLogger } from '../utils/logger';

const logger = createComponentLogger('StreamingLLMService');

export interface StreamChunk {
  content: string;
  isComplete: boolean;
  totalTokens?: number;
}

export type StreamCallback = (chunk: StreamChunk) => void;

export interface StreamingOptions {
  provider: LLMProvider;
  model: string;
  prompt: string;
  temperature?: number;
  maxTokens?: number;
  onChunk: StreamCallback;
}

/**
 * 流式 LLM 服务
 */
export class StreamingLLMService {
  /**
   * 流式生成（支持实时输出）
   */
  async generateStream(options: StreamingOptions): Promise<LLMResponse> {
    logger.info('Starting streaming generation', {
      provider: options.provider,
      model: options.model,
    });

    const startTime = Date.now();
    let fullContent = '';
    let totalTokens = 0;

    try {
      // 在真实实现中，这里会：
      // 1. 调用 OpenAI/Anthropic 的流式 API
      // 2. 逐块接收响应
      // 3. 调用回调函数传递每个块
      // 4. 累积完整内容

      // 模拟流式响应
      const chunks = this.simulateStreaming(options.prompt);

      for (const chunk of chunks) {
        fullContent += chunk;
        totalTokens += Math.ceil(chunk.length / 4);

        // 调用回调
        options.onChunk({
          content: chunk,
          isComplete: false,
        });

        // 模拟延迟
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // 发送完成信号
      options.onChunk({
        content: '',
        isComplete: true,
        totalTokens,
      });

      const duration = Date.now() - startTime;

      logger.info('Streaming generation complete', {
        totalTokens,
        duration,
      });

      return {
        content: fullContent,
        usage: {
          promptTokens: Math.ceil(options.prompt.length / 4),
          completionTokens: totalTokens,
          totalTokens: totalTokens + Math.ceil(options.prompt.length / 4),
        },
        finishReason: 'stop',
      };
    } catch (error) {
      logger.error('Streaming generation failed', { error });
      throw error;
    }
  }

  /**
   * 模拟流式响应（用于测试）
   */
  private simulateStreaming(prompt: string): string[] {
    const response = 'Generated test code example...';
    const chunks: string[] = [];
    const chunkSize = 10;

    for (let i = 0; i < response.length; i += chunkSize) {
      chunks.push(response.substring(i, i + chunkSize));
    }

    return chunks;
  }

  /**
   * 带进度显示的生成
   */
  async generateWithProgress(
    options: Omit<StreamingOptions, 'onChunk'>,
    onProgress: (progress: { current: number; total: number; content: string }) => void
  ): Promise<LLMResponse> {
    let current = 0;
    const estimated = options.maxTokens || 1000;

    return this.generateStream({
      ...options,
      onChunk: (chunk) => {
        if (!chunk.isComplete) {
          current += chunk.content.length;
          onProgress({
            current,
            total: estimated,
            content: chunk.content,
          });
        }
      },
    });
  }
}



