/**
 * LLMCache单元测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LLMCache } from '../LLMCache';
import * as fs from 'fs/promises';

describe('LLMCache', () => {
  let cache: LLMCache;

  beforeEach(() => {
    cache = new LLMCache({ maxSize: 10, maxAge: 1000 });
  });

  afterEach(() => {
    cache.clear();
  });

  describe('get and set', () => {
    it('should cache and retrieve responses', () => {
      const prompt = 'test prompt';
      const response = 'test response';
      const provider = 'openai';
      const model = 'gpt-4';

      cache.set(prompt, response, provider, model);
      const retrieved = cache.get(prompt, provider, model);

      expect(retrieved).toBe(response);
    });

    it('should return null for cache miss', () => {
      const result = cache.get('non-existent', 'openai', 'gpt-4');
      expect(result).toBeNull();
    });

    it('should generate same key for same inputs', () => {
      cache.set('prompt', 'response1', 'openai', 'gpt-4');
      cache.set('prompt', 'response2', 'openai', 'gpt-4');

      const result = cache.get('prompt', 'openai', 'gpt-4');
      
      // 应该返回最新的
      expect(result).toBe('response2');
    });

    it('should differentiate by provider', () => {
      cache.set('prompt', 'openai response', 'openai', 'gpt-4');
      cache.set('prompt', 'anthropic response', 'anthropic', 'claude');

      expect(cache.get('prompt', 'openai', 'gpt-4')).toBe('openai response');
      expect(cache.get('prompt', 'anthropic', 'claude')).toBe('anthropic response');
    });

    it('should differentiate by model', () => {
      cache.set('prompt', 'gpt-4 response', 'openai', 'gpt-4');
      cache.set('prompt', 'gpt-3.5 response', 'openai', 'gpt-3.5-turbo');

      expect(cache.get('prompt', 'openai', 'gpt-4')).toBe('gpt-4 response');
      expect(cache.get('prompt', 'openai', 'gpt-3.5-turbo')).toBe('gpt-3.5 response');
    });
  });

  describe('expiration', () => {
    it('should expire old entries', async () => {
      const shortLivedCache = new LLMCache({ maxAge: 100 }); // 100ms TTL

      shortLivedCache.set('prompt', 'response', 'openai', 'gpt-4');
      
      // 立即读取应该成功
      expect(shortLivedCache.get('prompt', 'openai', 'gpt-4')).toBe('response');

      // 等待过期
      await new Promise(resolve => setTimeout(resolve, 150));

      // 过期后应该返回null
      expect(shortLivedCache.get('prompt', 'openai', 'gpt-4')).toBeNull();
    });

    it('should clear expired entries', async () => {
      const shortLivedCache = new LLMCache({ maxAge: 100 });

      shortLivedCache.set('prompt1', 'response1', 'openai', 'gpt-4');
      shortLivedCache.set('prompt2', 'response2', 'openai', 'gpt-4');

      await new Promise(resolve => setTimeout(resolve, 150));

      const cleared = shortLivedCache.clearExpired();
      
      expect(cleared).toBe(2);
      expect(shortLivedCache.getStats().size).toBe(0);
    });
  });

  describe('LRU eviction', () => {
    it('should evict least recently used entry when full', () => {
      const smallCache = new LLMCache({ maxSize: 3 });

      // 填满缓存
      smallCache.set('prompt1', 'response1', 'openai', 'gpt-4');
      smallCache.set('prompt2', 'response2', 'openai', 'gpt-4');
      smallCache.set('prompt3', 'response3', 'openai', 'gpt-4');

      expect(smallCache.getStats().size).toBe(3);

      // 添加第4个应该淘汰prompt1
      smallCache.set('prompt4', 'response4', 'openai', 'gpt-4');

      expect(smallCache.getStats().size).toBe(3);
      expect(smallCache.get('prompt1', 'openai', 'gpt-4')).toBeNull();
      expect(smallCache.get('prompt4', 'openai', 'gpt-4')).toBe('response4');
    });

    it('should update LRU order on access', () => {
      const smallCache = new LLMCache({ maxSize: 3 });

      smallCache.set('prompt1', 'response1', 'openai', 'gpt-4');
      smallCache.set('prompt2', 'response2', 'openai', 'gpt-4');
      smallCache.set('prompt3', 'response3', 'openai', 'gpt-4');

      // 访问prompt1，使其成为最近使用
      smallCache.get('prompt1', 'openai', 'gpt-4');

      // 添加新条目应该淘汰prompt2（现在是LRU）
      smallCache.set('prompt4', 'response4', 'openai', 'gpt-4');

      expect(smallCache.get('prompt1', 'openai', 'gpt-4')).toBe('response1');
      expect(smallCache.get('prompt2', 'openai', 'gpt-4')).toBeNull();
    });
  });

  describe('statistics', () => {
    it('should track cache hits and misses', () => {
      cache.set('prompt', 'response', 'openai', 'gpt-4');

      cache.get('prompt', 'openai', 'gpt-4'); // hit
      cache.get('other', 'openai', 'gpt-4'); // miss

      const stats = cache.getStats();

      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe(0.5);
    });

    it('should calculate hit rate correctly', () => {
      cache.set('p1', 'r1', 'openai', 'gpt-4');
      cache.set('p2', 'r2', 'openai', 'gpt-4');

      cache.get('p1', 'openai', 'gpt-4'); // hit
      cache.get('p1', 'openai', 'gpt-4'); // hit
      cache.get('p2', 'openai', 'gpt-4'); // hit
      cache.get('p3', 'openai', 'gpt-4'); // miss

      const stats = cache.getStats();

      expect(stats.hitRate).toBe(0.75); // 3 hits / 4 total
    });

    it('should reset statistics', () => {
      cache.set('prompt', 'response', 'openai', 'gpt-4');
      cache.get('prompt', 'openai', 'gpt-4');

      cache.resetStats();

      const stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });
  });

  describe('clear', () => {
    it('should clear all entries', () => {
      cache.set('p1', 'r1', 'openai', 'gpt-4');
      cache.set('p2', 'r2', 'openai', 'gpt-4');

      cache.clear();

      expect(cache.getStats().size).toBe(0);
      expect(cache.get('p1', 'openai', 'gpt-4')).toBeNull();
    });
  });

  describe('export and import', () => {
    it('should export cache data', () => {
      cache.set('prompt', 'response', 'openai', 'gpt-4');

      const exported = cache.export();

      expect(exported).toBeDefined();
      const parsed = JSON.parse(exported);
      expect(parsed.entries).toBeDefined();
      expect(parsed.stats).toBeDefined();
    });

    it('should import cache data', () => {
      const data = JSON.stringify({
        entries: [
          ['key1', {
            prompt: 'p1',
            response: 'r1',
            timestamp: Date.now(),
            provider: 'openai',
            model: 'gpt-4'
          }]
        ],
        accessOrder: ['key1']
      });

      const imported = cache.import(data);

      expect(imported).toBe(1);
      expect(cache.getStats().size).toBe(1);
    });
  });
});

