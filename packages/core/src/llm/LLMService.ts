/**
 * LLMService: Unified interface for LLM providers
 */

import type { LLMRequest, LLMResponse, LLMProvider as LLMProviderType } from '@testmind/shared';
import { OpenAIProvider } from './providers/OpenAIProvider';
import { AnthropicProvider } from './providers/AnthropicProvider';
import { OllamaProvider } from './providers/OllamaProvider';
import { createComponentLogger } from '../utils/logger';
import { metrics, MetricNames } from '../utils/metrics';

export interface LLMProvider {
  generate(request: Omit<LLMRequest, 'provider'>): Promise<LLMResponse>;
}

export class LLMService {
  private providers: Map<LLMProviderType, LLMProvider> = new Map();
  private logger = createComponentLogger('LLMService');

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
   * Generate completion from LLM
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

    const startTime = Date.now();
    
    this.logger.info('Generating completion', {
      provider: request.provider,
      model: request.model,
      promptLength: request.prompt.length,
      operation: 'generate'
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
        operation: 'generate'
      });

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



























