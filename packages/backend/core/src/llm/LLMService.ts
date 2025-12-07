/**
 * LLMService: Unified interface for LLM providers
 */

import type { LLMRequest, LLMResponse, LLMProvider as LLMProviderType } from '@testmind/shared';

import { LLMError } from '../errors';
import { createComponentLogger } from '../utils/logger';
import { metrics, MetricNames } from '../utils/metrics';
import { ExponentialBackoff, type RetryConfig } from '../utils/retry';

import { llmCache } from './LLMCache';
import { AnthropicProvider } from './providers/AnthropicProvider';
import { OllamaProvider } from './providers/OllamaProvider';
import { OpenAIProvider } from './providers/OpenAIProvider';
const DEFAULT_PROVIDER: LLMProviderType = 'openai';
const DEFAULT_MODELS: Record<LLMProviderType, string> = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-sonnet',
  ollama: 'llama3',
  custom: 'default',
};

export interface LLMProvider {
  generate(request: Omit<LLMRequest, 'provider'>): Promise<LLMResponse>;
  generateEmbedding?(text: string): Promise<number[]>;
  generateStream?(request: Omit<LLMRequest, 'provider'>): AsyncGenerator<string>;
}

export class LLMService {
  private readonly providers: Map<LLMProviderType, LLMProvider> = new Map();
  private readonly logger = createComponentLogger('LLMService');
  private cacheEnabled: boolean = true; // 默认启用缓存
  private readonly retryConfig: RetryConfig = {
    maxRetries: 3,
    baseDelayMs: 1000,
    maxDelayMs: 10000,
  };
  private readonly backoff = new ExponentialBackoff(this.retryConfig);

  constructor() {
    // Initialize providers
    this.providers.set('openai', new OpenAIProvider());
    this.providers.set('anthropic', new AnthropicProvider());
    this.providers.set('ollama', new OllamaProvider());
    
    this.logger.debug('LLMService initialized', {
      providers: Array.from(this.providers.keys()),
    });
  }

  /**
   * Generate completion from LLM (with caching)
   */
  async generate(request: LLMRequest): Promise<LLMResponse> {
    const providerName = request.provider ?? DEFAULT_PROVIDER;
    const modelName = request.model ?? DEFAULT_MODELS[providerName] ?? 'default';
    const normalizedRequest: LLMRequest = {
      ...request,
      provider: providerName,
      model: modelName,
      temperature: request.temperature ?? 0.2,
      maxTokens: request.maxTokens ?? 800,
    };

    const provider = this.providers.get(providerName);
    
    if (!provider) {
      this.logger.error('Unsupported provider', { 
        provider: providerName,
        availableProviders: Array.from(this.providers.keys()),
      });
      throw new LLMError(providerName, `Unsupported LLM provider: ${providerName}`);
    }

    // 1. 检查缓存
    if (this.cacheEnabled) {
      const cachedResponse = llmCache.get(
        normalizedRequest.prompt,
        providerName,
        modelName,
      );
      
      if (cachedResponse) {
        this.logger.info('Cache hit', {
          provider: providerName,
          model: modelName,
          promptLength: normalizedRequest.prompt.length,
        });

        return {
          content: cachedResponse,
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          finishReason: 'cached',
        } as LLMResponse;
      }
    }

    this.logger.info('Generating completion', {
      provider: providerName,
      model: modelName,
      promptLength: normalizedRequest.prompt.length,
      operation: 'generate',
      cached: false,
    });

    try {
      const response = await this.backoff.execute(
        async () => {
          const startTime = Date.now();
          const result = await provider.generate(normalizedRequest);
          const duration = Date.now() - startTime;

          metrics.incrementCounter(MetricNames.LLM_CALL_COUNT, 1, {
            provider: providerName,
            model: modelName,
          });
          metrics.recordHistogram(MetricNames.LLM_DURATION, duration, {
            provider: providerName,
            model: modelName,
          });
          metrics.recordHistogram(MetricNames.LLM_TOKEN_USAGE, result.usage.totalTokens, {
            provider: providerName,
            model: modelName,
          });

          this.logger.info('Generation complete', {
            provider: providerName,
            model: modelName,
            duration,
            tokens: result.usage.totalTokens,
            finishReason: result.finishReason,
            operation: 'generate',
            cached: false,
          });

          return result;
        },
        {
          shouldRetry: error => this.isRetryableError(error),
          onRetry: (attempt, error, delay) => {
            this.logger.warn('LLM call failed, retrying', {
              attempt,
              delay,
              provider: providerName,
              model: modelName,
              error: (error as Error).message,
            });
          },
        },
      );

      // 2. 存入缓存
      if (this.cacheEnabled && response.content) {
        llmCache.set(normalizedRequest.prompt, response.content, providerName, modelName, response.usage);
      }

      return response;
    } catch (error: any) {
      this.logger.error('Generation failed', {
        provider: providerName,
        model: modelName,
        error: error.message,
        operation: 'generate',
      });
      
      throw new LLMError(providerName, error.message, error);
    }
  }

  /**
   * Generate embeddings for semantic search
   */
  async generateEmbedding(text: string, provider: LLMProviderType = DEFAULT_PROVIDER): Promise<number[]> {
    if (!text.trim()) {
      throw new Error('Embedding text must be non-empty');
    }

    const llmProvider = this.providers.get(provider);
    if (!llmProvider) {
      this.logger.error('Embedding requested for unsupported provider', { provider });
      throw new Error(`Unsupported provider: ${provider}`);
    }

    if (typeof llmProvider.generateEmbedding !== 'function') {
      this.logger.error('Embedding not implemented for provider', { provider });
      throw new Error(`Embedding not implemented for provider: ${provider}`);
    }

    const startedAt = Date.now();
    this.logger.info('Generating embedding', { provider, length: text.length });

    try {
      const embedding = await llmProvider.generateEmbedding(text);
      if (!Array.isArray(embedding) || embedding.length === 0) {
        throw new Error('Provider returned empty embedding vector');
      }

      const duration = Date.now() - startedAt;
      this.logger.info('Embedding generated', {
        provider,
        dimension: embedding.length,
        duration,
      });
      return embedding;
    } catch (error) {
      this.logger.error('Embedding generation failed', { provider, error });
      throw error;
    }
  }

  /**
   * Stream generation (for interactive use)
   */
  async *generateStream(request: LLMRequest): AsyncGenerator<string> {
    const providerName = request.provider ?? DEFAULT_PROVIDER;
    const modelName = request.model ?? DEFAULT_MODELS[providerName] ?? 'default';
    const normalizedRequest: LLMRequest = {
      ...request,
      provider: providerName,
      model: modelName,
      temperature: request.temperature ?? 0.2,
      maxTokens: request.maxTokens ?? 800,
    };

    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new LLMError(providerName, `Unsupported LLM provider: ${providerName}`);
    }

    if (provider?.generateStream) {
      const { provider: _omit, ...streamRequest } = normalizedRequest;
      yield* provider.generateStream(streamRequest);
      return;
    }

    // Fallback to non-streaming
    const response = await this.generate(normalizedRequest);
    yield response.content;
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

  private isRetryableError(error: Error): boolean {
    const retryableCodes = ['429', '503', '504', 'ECONNRESET', 'ETIMEDOUT', 'timeout'];
    return retryableCodes.some(code => error.message?.toLowerCase().includes(code.toLowerCase()));
  }
}
