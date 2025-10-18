/**
 * OpenAIProvider: Integration with OpenAI API
 * Uses LangChain.js for robust API interaction
 * 
 * Design rationale:
 * - LangChain provides retry logic, error handling, and prompt management
 * - Abstracts away API versioning concerns
 * - Enables easy migration to other providers
 */

import type { LLMRequest, LLMResponse } from '@testmind/shared';
import type { LLMProvider } from '../LLMService';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

export class OpenAIProvider implements LLMProvider {
  private apiKey: string | undefined;
  private client: ChatOpenAI | null = null;

  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY;
    
    if (this.apiKey) {
      this.initializeClient();
    }
  }

  /**
   * Initialize OpenAI client
   * Lazy initialization pattern for better error handling
   * Supports custom endpoints for OpenAI-compatible APIs
   */
  private initializeClient(): void {
    if (!this.apiKey) {
      throw new Error(
        'OPENAI_API_KEY environment variable is not set.\n' +
        'Please set it with: export OPENAI_API_KEY=your-api-key'
      );
    }

    // Support custom API endpoint (for OpenAI-compatible APIs like DeepSeek)
    const baseURL = process.env.OPENAI_API_BASE || 'https://api.openai.com/v1';
    const modelName = process.env.OPENAI_MODEL || 'gpt-4-turbo-preview';

    this.client = new ChatOpenAI({
      openAIApiKey: this.apiKey,
      modelName,
      temperature: 0.2,
      maxTokens: 2000,
      timeout: 60000,
      configuration: {
        baseURL,
      },
    });
  }

  /**
   * Generate completion from OpenAI
   * 
   * Error handling strategy:
   * 1. Validate API key exists
   * 2. Retry on transient failures (429, 503)
   * 3. Clear error messages for user issues (401, 404)
   * 4. Track token usage for cost monitoring
   */
  async generate(request: Omit<LLMRequest, 'provider'>): Promise<LLMResponse> {
    if (!this.client) {
      this.initializeClient();
    }

    if (!this.client) {
      throw new Error('Failed to initialize OpenAI client');
    }

    console.log(`[OpenAIProvider] Calling OpenAI API (model: ${request.model})`);
    console.log(`[OpenAIProvider] Temperature: ${request.temperature}, MaxTokens: ${request.maxTokens}`);

    try {
      // Override client settings with request parameters
      this.client.modelName = request.model;
      this.client.temperature = request.temperature;
      this.client.maxTokens = request.maxTokens;

      // Prepare messages
      const messages = [
        new SystemMessage(
          'You are an expert test engineer. Generate high-quality, comprehensive tests.'
        ),
        new HumanMessage(request.prompt),
      ];

      // Call OpenAI API
      const startTime = Date.now();
      const response = await this.client.invoke(messages);
      const duration = Date.now() - startTime;

      console.log(`[OpenAIProvider] API call successful (${duration}ms)`);

      // Extract content
      const content = typeof response.content === 'string' 
        ? response.content 
        : '';

      // Extract token usage
      const usage = response.response_metadata?.tokenUsage || {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      };

      // Calculate cost estimate (GPT-4 Turbo pricing)
      const inputCost = (usage.promptTokens / 1000) * 0.01; // $0.01/1K tokens
      const outputCost = (usage.completionTokens / 1000) * 0.03; // $0.03/1K tokens
      const totalCost = inputCost + outputCost;

      console.log(`[OpenAIProvider] Token usage: ${usage.totalTokens} (cost: ~$${totalCost.toFixed(4)})`);

      return {
        content,
        usage: {
          promptTokens: usage.promptTokens || 0,
          completionTokens: usage.completionTokens || 0,
          totalTokens: usage.totalTokens || 0,
        },
        finishReason: response.response_metadata?.finish_reason || 'stop',
        metadata: {
          model: request.model,
          duration,
          cost: totalCost,
        },
      };

    } catch (error: any) {
      console.error('[OpenAIProvider] API call failed:', error);

      // Provide helpful error messages
      if (error.message?.includes('401')) {
        throw new Error(
          'OpenAI API authentication failed. Please check your OPENAI_API_KEY.\n' +
          'Get your key at: https://platform.openai.com/api-keys'
        );
      }

      if (error.message?.includes('429')) {
        throw new Error(
          'OpenAI API rate limit exceeded. Please try again later or upgrade your plan.\n' +
          'See: https://platform.openai.com/account/rate-limits'
        );
      }

      if (error.message?.includes('insufficient_quota')) {
        throw new Error(
          'OpenAI API quota exceeded. Please check your billing at:\n' +
          'https://platform.openai.com/account/billing'
        );
      }

      // Re-throw with context
      throw new Error(`OpenAI API error: ${error.message || error}`);
    }
  }

  /**
   * Generate embeddings for semantic search
   * Uses text-embedding-3-small for cost efficiency
   */
  async generateEmbedding(text: string): Promise<number[]> {
    // TODO: Implement using @langchain/openai embeddings
    // Will be done in SemanticIndexer implementation
    throw new Error('Embedding generation not yet implemented');
  }

  /**
   * Test API connection
   * Useful for debugging and setup validation
   */
  async testConnection(): Promise<boolean> {
    try {
      const testResponse = await this.generate({
        model: 'gpt-3.5-turbo', // Use cheaper model for test
        prompt: 'Reply with "OK" if you can read this.',
        temperature: 0,
        maxTokens: 10,
      });

      return testResponse.content.trim().toUpperCase().includes('OK');
    } catch {
      return false;
    }
  }
}


