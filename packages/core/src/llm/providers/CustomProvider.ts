/**
 * CustomProvider - 自定义 LLM 提供商
 * 
 * 支持兼容 OpenAI API 的自定义端点
 * 
 * 用途：
 * - 代理 API（如 OneAPI, FastGPT）
 * - 私有部署的 LLM
 * - 自定义模型服务
 */

import type { LLMRequest, LLMResponse } from '@testmind/shared';
import { createComponentLogger } from '../../utils/logger';

export interface CustomProviderConfig {
  /** API 基础 URL */
  baseURL: string;
  
  /** API 密钥 */
  apiKey: string;
  
  /** 默认模型 */
  defaultModel?: string;
  
  /** 超时时间（毫秒） */
  timeout?: number;
}

/**
 * 自定义提供商
 */
export class CustomProvider {
  private logger = createComponentLogger('CustomProvider');
  private config: Required<CustomProviderConfig>;
  
  constructor(config?: Partial<CustomProviderConfig>) {
    this.config = {
      baseURL: config?.baseURL || process.env.OPENAI_API_BASE || 'https://api.openai.com/v1',
      apiKey: config?.apiKey || process.env.OPENAI_API_KEY || '',
      defaultModel: config?.defaultModel || 'gpt-4o-mini',
      timeout: config?.timeout || 60000,
    };
    
    this.logger.info('CustomProvider initialized', {
      baseURL: this.config.baseURL,
      defaultModel: this.config.defaultModel,
    });
  }
  
  /**
   * 生成补全
   */
  async generate(request: Omit<LLMRequest, 'provider'>): Promise<LLMResponse> {
    const model = request.model || this.config.defaultModel;
    
    this.logger.info('Generating completion', {
      model,
      promptLength: request.prompt.length,
    });
    
    try {
      const response = await fetch(`${this.config.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'user',
              content: request.prompt,
            },
          ],
          temperature: request.temperature,
          max_tokens: request.maxTokens,
        }),
        signal: AbortSignal.timeout(this.config.timeout),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API request failed: ${response.status} ${errorText}`);
      }
      
      const data = await response.json();
      
      const llmResponse: LLMResponse = {
        content: data.choices[0].message.content,
        usage: {
          promptTokens: data.usage?.prompt_tokens || 0,
          completionTokens: data.usage?.completion_tokens || 0,
          totalTokens: data.usage?.total_tokens || 0,
        },
        finishReason: data.choices[0].finish_reason || 'stop',
      };
      
      this.logger.info('Generation completed', {
        model,
        tokens: llmResponse.usage.totalTokens,
      });
      
      return llmResponse;
    } catch (error) {
      this.logger.error('Generation failed', {
        model,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
  
  /**
   * 更新配置
   */
  updateConfig(config: Partial<CustomProviderConfig>): void {
    Object.assign(this.config, config);
    
    this.logger.info('Configuration updated', {
      baseURL: this.config.baseURL,
    });
  }
}




