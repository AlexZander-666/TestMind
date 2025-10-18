/**
 * LLMService: Unified interface for LLM providers
 */

import type { LLMRequest, LLMResponse, LLMProvider as LLMProviderType } from '@testmind/shared';
import { OpenAIProvider } from './providers/OpenAIProvider';
import { AnthropicProvider } from './providers/AnthropicProvider';
import { OllamaProvider } from './providers/OllamaProvider';

export interface LLMProvider {
  generate(request: Omit<LLMRequest, 'provider'>): Promise<LLMResponse>;
}

export class LLMService {
  private providers: Map<LLMProviderType, LLMProvider> = new Map();

  constructor() {
    // Initialize providers
    this.providers.set('openai', new OpenAIProvider());
    this.providers.set('anthropic', new AnthropicProvider());
    this.providers.set('ollama', new OllamaProvider());
  }

  /**
   * Generate completion from LLM
   */
  async generate(request: LLMRequest): Promise<LLMResponse> {
    const provider = this.providers.get(request.provider);
    
    if (!provider) {
      throw new Error(`Unsupported LLM provider: ${request.provider}`);
    }

    console.log(`[LLMService] Generating with ${request.provider}/${request.model}`);

    try {
      const response = await provider.generate(request);
      
      console.log('[LLMService] Generation complete:', {
        tokens: response.usage.totalTokens,
        finishReason: response.finishReason,
      });

      return response;
    } catch (error) {
      console.error('[LLMService] Generation failed:', error);
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



























