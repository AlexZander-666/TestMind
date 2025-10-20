/**
 * LLMService: Unified interface for LLM providers
 */

import type { LLMRequest, LLMResponse, LLMProvider as LLMProviderType } from '@testmind/shared';
import { OpenAIProvider } from './providers/OpenAIProvider';
import { AnthropicProvider } from './providers/AnthropicProvider';
import { OllamaProvider } from './providers/OllamaProvider';
import { createComponentLogger } from '../utils/logger';
import { metrics, MetricNames } from '../utils/metrics';
import { llmCache } from './LLMCache';

export interface LLMProvider {
  generate(request: Omit<LLMRequest, 'provider'>): Promise<LLMResponse>;
}

export class LLMService {
  private providers: Map<LLMProviderType, LLMProvider> = new Map();
  private logger = createComponentLogger('LLMService');
  private cacheEnabled: boolean = true; // 默认启用缓存

  constructor() {
    // Initialize providers
    this.providers.set('openai', new OpenAIProvider());
    this.providers.set('anthropic', new AnthropicProvider());
    this.providers.set('ollama', new OllamaProvider());
    
    this.logger.debug('LLMService initialized', {
      providers: Array.from(this.providers.keys())
    });
  }

  /**
   * Generate completion from LLM (with caching)
   */
  async generate(request: LLMRequest): Promise<LLMResponse> {
    const provider = this.providers.get(request.provider);
    
    if (!provider) {
      const error = new Error(`Unsupported LLM provider: ${request.provider}`);
      this.logger.error('Unsupported provider', { 
        provider: request.provider,
        availableProviders: Array.from(this.providers.keys())
      });
      throw error;
    }

    // 1. 检查缓存
    if (this.cacheEnabled) {
      const cachedResponse = llmCache.get(request.prompt, request.provider, request.model);
      
      if (cachedResponse) {
        this.logger.info('Cache hit', {
          provider: request.provider,
          model: request.model,
          promptLength: request.prompt.length
        });

        return {
          content: cachedResponse,
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          finishReason: 'cached'
        } as LLMResponse;
      }
    }

    const startTime = Date.now();
    
    this.logger.info('Generating completion', {
      provider: request.provider,
      model: request.model,
      promptLength: request.prompt.length,
      operation: 'generate',
      cached: false
    });

    try {
      const response = await provider.generate(request);
      const duration = Date.now() - startTime;
      
      // Record metrics
      metrics.incrementCounter(MetricNames.LLM_CALL_COUNT, 1, {
        provider: request.provider,
        model: request.model
      });
      metrics.recordHistogram(MetricNames.LLM_DURATION, duration, {
        provider: request.provider,
        model: request.model
      });
      metrics.recordHistogram(MetricNames.LLM_TOKEN_USAGE, response.usage.totalTokens, {
        provider: request.provider,
        model: request.model
      });
      
      this.logger.info('Generation complete', {
        provider: request.provider,
        model: request.model,
        duration,
        tokens: response.usage.totalTokens,
        finishReason: response.finishReason,
        operation: 'generate',
        cached: false
      });

      // 2. 存入缓存
      if (this.cacheEnabled && response.content) {
        llmCache.set(
          request.prompt,
          response.content,
          request.provider,
          request.model,
          response.usage
        );
      }

      return response;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      
      this.logger.error('Generation failed', {
        provider: request.provider,
        model: request.model,
        duration,
        error: error.message,
        operation: 'generate'
      });
      
      throw error;
    }
  }

  /**
   * Generate embeddings for semantic search
   */
  async generateEmbedding(text: string, provider: LLMProviderType = 'openai'): Promise<number[]> {
    console.log(`[LLMService] Generating embedding with ${provider}`);

    const llmProvider = this.providers.get(provider);
    if (!llmProvider) {
      throw new Error(`Unsupported provider: ${provider}`);
    }

    // TODO: Implement embedding generation
    // For now, return empty array
    return [];
  }

  /**
   * Stream generation (for interactive use)
   */
  async *generateStream(request: LLMRequest): AsyncGenerator<string> {
    // TODO: Implement streaming
    const response = await this.generate(request);
    yield response.content;
  }
}





























  /** 启用/禁用缓存 */
  setCacheEnabled(enabled: boolean): void {
    this.cacheEnabled = enabled;
    this.logger.debug('Cache toggled', { enabled });
  }

  /** 获取缓存统计 */
  getCacheStats() {
    return llmCache.getStats();
  }

  /** 清除缓存 */
  clearCache(): void {
    llmCache.clear();
    this.logger.info('Cache cleared');
  }


  /** 启用/禁用缓存 */
  setCacheEnabled(enabled: boolean): void {
    this.cacheEnabled = enabled;
    this.logger.debug('Cache toggled', { enabled });
  }

  /** 获取缓存统计 */
  getCacheStats() {
    return llmCache.getStats();
  }

  /** 清除缓存 */
  clearCache(): void {
    llmCache.clear();
    this.logger.info('Cache cleared');
  }
}