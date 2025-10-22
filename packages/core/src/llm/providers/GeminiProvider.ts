/**
 * GeminiProvider: Integration with Google Gemini API
 * 
 * 优势对比：
 * - 成本：比 OpenAI 便宜 80-90%
 * - 上下文：支持 1M tokens 超大上下文窗口
 * - 性能：Flash 模型速度极快
 * 
 * 支持模型：
 * - gemini-1.5-flash: 最快最便宜，适合简单任务
 * - gemini-1.5-pro: 平衡性能和成本
 * - gemini-2.0-flash-exp: 最新实验版
 * 
 * 定价（输入/输出）：
 * - Flash: $0.075/$0.30 per 1M tokens
 * - Pro: $3.50/$10.50 per 1M tokens
 * vs OpenAI GPT-4o: $5.00/$15.00 per 1M tokens
 */

import type { LLMRequest, LLMResponse } from '@testmind/shared';
import type { LLMProvider } from '../LLMService';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { createComponentLogger } from '../../utils/logger';

const logger = createComponentLogger('GeminiProvider');

export class GeminiProvider implements LLMProvider {
  private apiKey: string | undefined;
  private client: ChatGoogleGenerativeAI | null = null;

  constructor() {
    this.apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    
    if (this.apiKey) {
      this.initializeClient();
    }
  }

  /**
   * 初始化 Gemini 客户端
   */
  private initializeClient(): void {
    if (!this.apiKey) {
      throw new Error(
        'GOOGLE_API_KEY or GEMINI_API_KEY environment variable is not set.\n' +
        'Get your key at: https://ai.google.dev/\n' +
        'Then set: export GOOGLE_API_KEY=your-api-key'
      );
    }

    const modelName = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
    const maxOutputTokens = parseInt(process.env.GEMINI_MAX_TOKENS || '8192', 10);
    
    logger.info('Initializing Gemini', { model: modelName, maxOutputTokens });

    this.client = new ChatGoogleGenerativeAI({
      apiKey: this.apiKey,
      modelName,
      temperature: 0.2,
      maxOutputTokens,
      topP: 0.95,
      topK: 40,
    });
  }

  /**
   * 生成 LLM 响应
   */
  async generate(request: Omit<LLMRequest, 'provider'>): Promise<LLMResponse> {
    if (!this.client) {
      this.initializeClient();
    }

    if (!this.client) {
      throw new Error('Failed to initialize Gemini client');
    }

    const startTime = Date.now();
    logger.debug('Calling Gemini API', { 
      model: request.model || 'default',
      promptLength: request.prompt.length 
    });

    try {
      // 构建消息
      const messages = [];
      
      if (request.systemPrompt) {
        messages.push(new SystemMessage(request.systemPrompt));
      }
      
      messages.push(new HumanMessage(request.prompt));

      // 调用 Gemini
      const response = await this.client.invoke(messages);
      
      const duration = Date.now() - startTime;
      const content = response.content.toString();

      // Gemini 的 usage 信息结构
      const usage = (response as any).usage_metadata || {};
      const inputTokens = usage.prompt_token_count || 0;
      const outputTokens = usage.candidates_token_count || 0;
      
      logger.info('Gemini API success', {
        duration,
        inputTokens,
        outputTokens,
        model: request.model
      });

      // 成本计算（基于模型定价）
      const cost = this.calculateCost(request.model || 'gemini-1.5-flash', inputTokens, outputTokens);

      return {
        content,
        usage: {
          promptTokens: inputTokens,
          completionTokens: outputTokens,
          totalTokens: inputTokens + outputTokens,
        },
        model: request.model || 'gemini-1.5-flash',
        finishReason: 'stop',
        cached: false,
        cost,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      
      logger.error('Gemini API error', {
        error: error.message,
        duration,
        model: request.model,
      });

      // 友好的错误消息
      if (error.message?.includes('API key')) {
        throw new Error(
          'Invalid Google API key. Please check your GOOGLE_API_KEY environment variable.\n' +
          'Get a key at: https://ai.google.dev/'
        );
      }

      if (error.message?.includes('quota')) {
        throw new Error(
          'Google API quota exceeded. Please check your quota at: https://console.cloud.google.com/apis/dashboard'
        );
      }

      if (error.message?.includes('SAFETY')) {
        throw new Error(
          'Content blocked by Gemini safety filters. Try rephrasing your prompt or adjusting safety settings.'
        );
      }

      throw new Error(`Gemini API error: ${error.message}`);
    }
  }

  /**
   * 计算成本（美元）
   */
  private calculateCost(model: string, inputTokens: number, outputTokens: number): number {
    const pricing: Record<string, { input: number; output: number }> = {
      'gemini-1.5-flash': { input: 0.075, output: 0.30 },
      'gemini-1.5-pro': { input: 3.50, output: 10.50 },
      'gemini-2.0-flash-exp': { input: 0, output: 0 }, // 实验版免费
    };

    const prices = pricing[model] || pricing['gemini-1.5-flash'];
    const inputCost = (inputTokens / 1_000_000) * prices.input;
    const outputCost = (outputTokens / 1_000_000) * prices.output;
    
    return inputCost + outputCost;
  }
}


