import { describe, it, expect, vi } from 'vitest';

import { LLMService, type LLMProvider } from '../LLMService';

const baseResponse = {
  usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
  finishReason: 'stop',
  metadata: {},
};

describe('LLMService retry', () => {
  it('retries on retryable errors and eventually succeeds', async () => {
    const service = new LLMService();
    const provider: LLMProvider = {
      generate: vi
        .fn()
        .mockRejectedValueOnce(new Error('429 rate limit'))
        .mockResolvedValue({
          ...baseResponse,
          content: 'ok',
        }),
    };

    // Inject stub provider and disable backoff sleep for fast tests
    (service as any).providers.set('openai', provider);
    (service as any).backoff.sleep = () => Promise.resolve();

    const result = await service.generate({
      provider: 'openai',
      model: 'test-model',
      prompt: 'hello',
      temperature: 0.1,
      maxTokens: 10,
    });

    expect(result.content).toBe('ok');
    expect((provider.generate as any).mock.calls.length).toBe(2);
  });
});
