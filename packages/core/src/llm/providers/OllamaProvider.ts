/**
 * OllamaProvider: Integration with local Ollama models
 */

import type { LLMRequest, LLMResponse } from '@testmind/shared';
import type { LLMProvider } from '../LLMService';

export class OllamaProvider implements LLMProvider {
  private baseURL: string;

  constructor(baseURL = 'http://localhost:11434') {
    this.baseURL = baseURL;
  }

  async generate(request: Omit<LLMRequest, 'provider'>): Promise<LLMResponse> {
    console.log('[OllamaProvider] Calling local Ollama...');

    // TODO: Implement actual API call to Ollama
    
    return {
      content: '// Generated test code placeholder',
      usage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      },
      finishReason: 'stop',
      metadata: {},
    };
  }
}



























