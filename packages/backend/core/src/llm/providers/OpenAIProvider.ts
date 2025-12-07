/**
 * OpenAIProvider: Integration with OpenAI API
 * Uses LangChain.js for robust API interaction
 * 
 * Design rationale:
 * - LangChain provides retry logic, error handling, and prompt management
 * - Abstracts away API versioning concerns
 * - Enables easy migration to other providers
 */

import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai';
import type { LLMRequest, LLMResponse } from '@testmind/shared';

import { createComponentLogger } from '../../utils/logger';
import type { LLMProvider } from '../LLMService';


const logger = createComponentLogger('OpenAIProvider');

export class OpenAIProvider implements LLMProvider {
  private readonly apiKey: string | undefined;
  private client: ChatOpenAI | null = null;
  private readonly defaultModel: string;
  private readonly defaultTemperature: number;
  private readonly defaultMaxTokens: number;

  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY;
    this.defaultModel = process.env.OPENAI_MODEL || 'gpt-4-turbo-preview';
    this.defaultTemperature = parseFloat(process.env.OPENAI_TEMPERATURE ?? '0.2');
    this.defaultMaxTokens = parseInt(process.env.OPENAI_MAX_TOKENS ?? '1000', 10);
    
    if (this.apiKey) {
      this.initializeClient();
    } else {
      logger.warn(
        '[OpenAIProvider] OPENAI_API_KEY not set. Falling back to stubbed responses.',
      );
    }
  }

  /**
   * Initialize OpenAI client
   * Lazy initialization pattern for better error handling
   * Supports custom endpoints for OpenAI-compatible APIs
   */
  private initializeClient(): void {
    if (!this.apiKey) {
      logger.warn('[OpenAIProvider] No API key available, skipping client initialization');
      this.client = null;
      return;
    }

    // Support custom API endpoint (for OpenAI-compatible APIs like Gemini, DeepSeek, etc.)
    const baseURL = process.env.OPENAI_API_BASE_URL
      || process.env.OPENAI_API_BASE
      || 'https://api.openai.com/v1';
    const modelName = this.defaultModel;
    
    logger.info(`[OpenAIProvider] Initializing with baseURL: ${baseURL}, model: ${modelName}`);

    // 支持自定义maxTokens，默认10000以支持复杂测试生成
    const maxTokens = this.defaultMaxTokens;
    
    this.client = new ChatOpenAI({
      openAIApiKey: this.apiKey,
      modelName,
      temperature: this.defaultTemperature,
      maxTokens,
      timeout: 120000, // 增加到120秒以支持大模型响应
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
    const modelName = request.model ?? this.defaultModel;
    const temperature = request.temperature ?? this.defaultTemperature;
    const maxTokens = request.maxTokens ?? this.defaultMaxTokens;

    if (!this.client) {
      this.initializeClient();
    }

    if (!this.client) {
      logger.warn('[OpenAIProvider] Client unavailable, returning stubbed response');
      return this.createStubResponse(modelName, request.prompt);
    }

    logger.info(`[OpenAIProvider] Calling OpenAI API (model: ${modelName})`);
    logger.info(`[OpenAIProvider] Temperature: ${temperature}, MaxTokens: ${maxTokens}`);

    try {
      // Override client settings with request parameters
      this.client.modelName = modelName;
      this.client.temperature = temperature;
      this.client.maxTokens = maxTokens;

      // Prepare messages
      const messages = [
        new SystemMessage(
          'You are an expert test engineer. Generate high-quality, comprehensive tests.',
        ),
        new HumanMessage(request.prompt),
      ];

      // Call OpenAI API
      const startTime = Date.now();
      const response = await this.client.invoke(messages);
      const duration = Date.now() - startTime;

      logger.info(`[OpenAIProvider] API call successful (${duration}ms)`);

      // Extract content
      const content = typeof response.content === 'string' 
        ? response.content 
        : '';

      // Extract token usage
      const usage = response.response_metadata.tokenUsage || {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      };

      // Calculate cost estimate (GPT-4 Turbo pricing)
      const inputCost = (usage.promptTokens / 1000) * 0.01; // $0.01/1K tokens
      const outputCost = (usage.completionTokens / 1000) * 0.03; // $0.03/1K tokens
      const totalCost = inputCost + outputCost;

      logger.info(`[OpenAIProvider] Token usage: ${usage.totalTokens} (cost: ~$${totalCost.toFixed(4)})`);

      return {
        content,
        usage: {
          promptTokens: usage.promptTokens || 0,
          completionTokens: usage.completionTokens || 0,
          totalTokens: usage.totalTokens || 0,
        },
        finishReason: response.response_metadata.finish_reason || 'stop',
        metadata: {
          model: modelName,
          duration,
          cost: totalCost,
        },
      };

    } catch (error: any) {
      logger.error('[OpenAIProvider] API call failed:', error);

      // Provide helpful error messages
      if (error.message?.includes('401')) {
        throw new Error(
          'OpenAI API authentication failed. Please check your OPENAI_API_KEY.\n' +
          'Get your key at: https://platform.openai.com/api-keys',
        );
      }

      if (error.message?.includes('429')) {
        throw new Error(
          'OpenAI API rate limit exceeded. Please try again later or upgrade your plan.\n' +
          'See: https://platform.openai.com/account/rate-limits',
        );
      }

      if (error.message?.includes('insufficient_quota')) {
        throw new Error(
          'OpenAI API quota exceeded. Please check your billing at:\n' +
          'https://platform.openai.com/account/billing',
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
    if (!text.trim()) {
      throw new Error('Embedding text must be non-empty');
    }

    if (!this.apiKey) {
      throw new Error('OPENAI_API_KEY is required for embedding generation');
    }

    const baseURL = process.env.OPENAI_API_BASE_URL
      || process.env.OPENAI_API_BASE
      || 'https://api.openai.com/v1';
    const modelName = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
    const startedAt = Date.now();

    try {
      const embeddingsClient = new OpenAIEmbeddings({
        modelName,
        openAIApiKey: this.apiKey,
        configuration: { baseURL },
      });

      const vector = await embeddingsClient.embedQuery(text);
      const duration = Date.now() - startedAt;

      logger.info('[OpenAIProvider] Embedding generated', {
        model: modelName,
        dimension: vector.length,
        duration,
      });
      return vector;
    } catch (error: any) {
      logger.error('[OpenAIProvider] Embedding generation failed', error);
      throw new Error(`OpenAI embedding failed: ${error?.message || error}`);
    }
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

  private createStubResponse(model: string, prompt: string): LLMResponse {
    return {
      content: `// OpenAIProvider stub response for model "${model}". Prompt length: ${prompt.length}`,
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      finishReason: 'stub',
      metadata: {
        model,
        stubbed: true,
      },
    };
  }
}
