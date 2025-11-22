/**
 * LLMCache 增强功能单元测试
 * 测试相似度匹配和自适应 TTL
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { LLMCache } from '../LLMCache';

describe('LLMCache - Enhanced Features', () => {
  let cache: LLMCache;

  beforeEach(() => {
    cache = new LLMCache({
      maxSize: 100,
      maxAge: 1000, // 1 秒用于测试
      enablePersistence: false,
      enableSimilarityMatch: true,
      similarityThreshold: 0.85,
      enableAdaptiveTTL: true,
    });
  });

  describe('Similarity Matching', () => {
    it('should match similar prompts', () => {
      // 设置缓存
      cache.set(
        'Generate test for getUserName function',
        'test code here',
        'openai',
        'gpt-4'
      );

      // 查询相似 prompt
      const result = cache.get(
        'Generate test for getUserData function', // 相似但不完全相同
        'openai',
        'gpt-4'
      );

      // 应该通过相似度匹配命中
      expect(result).toBe('test code here');
    });

    it('should not match dissimilar prompts', () => {
      cache.set(
        'Generate test for getUserName function',
        'test code here',
        'openai',
        'gpt-4'
      );

      // 完全不同的 prompt
      const result = cache.get(
        'Write documentation for API endpoint',
        'openai',
        'gpt-4'
      );

      expect(result).toBeNull();
    });

    it('should match prompts with same tokens in different order', () => {
      cache.set(
        'test function user get name',
        'test code',
        'openai',
        'gpt-4'
      );

      const result = cache.get(
        'get user name test function',
        'openai',
        'gpt-4'
      );

      // Token 重叠度高，应该匹配
      expect(result).toBe('test code');
    });

    it('should respect similarity threshold', () => {
      const strictCache = new LLMCache({
        enableSimilarityMatch: true,
        similarityThreshold: 0.95, // 非常严格
      });

      strictCache.set(
        'Generate test for getUserName',
        'test code',
        'openai',
        'gpt-4'
      );

      const result = strictCache.get(
        'Generate test for getUserData', // 相似度约 0.87
        'openai',
        'gpt-4'
      );

      // 不满足 0.95 阈值
      expect(result).toBeNull();
    });
  });

  describe('Adaptive TTL', () => {
    it('should extend TTL for frequently accessed items', async () => {
      cache.set('prompt1', 'response1', 'openai', 'gpt-4');

      // 模拟多次访问
      for (let i = 0; i < 12; i++) {
        cache.get('prompt1', 'openai', 'gpt-4');
      }

      // 等待超过基础 TTL 但少于 2x TTL
      await sleep(1200); // 1.2 秒

      const result = cache.get('prompt1', 'openai', 'gpt-4');

      // 由于高频访问（12 次 >= 10），TTL 延长为 2x (2 秒)
      // 所以 1.2 秒后仍然有效
      expect(result).toBe('response1');
    });

    it('should expire low-frequency items faster', async () => {
      cache.set('prompt1', 'response1', 'openai', 'gpt-4');

      // 只访问 1 次（设置时）
      // 等待超过 0.5x TTL
      await sleep(600); // 0.6 秒

      const result = cache.get('prompt1', 'openai', 'gpt-4');

      // 由于低频访问（1 次），TTL 缩短为 0.5x (0.5 秒)
      // 所以 0.6 秒后应该过期
      expect(result).toBeNull();
    });

    it('should track access count correctly', () => {
      cache.set('prompt1', 'response1', 'openai', 'gpt-4');

      // 访问多次
      cache.get('prompt1', 'openai', 'gpt-4');
      cache.get('prompt1', 'openai', 'gpt-4');
      cache.get('prompt1', 'openai', 'gpt-4');

      const stats = cache.getStats();
      
      // 1 次 set + 3 次 get = 4 次访问
      expect(stats.hits).toBe(3);
    });
  });

  describe('Statistics', () => {
    it('should separate exact and similarity hits', () => {
      cache.set('prompt exact', 'response', 'openai', 'gpt-4');

      // 精确匹配
      cache.get('prompt exact', 'openai', 'gpt-4');
      
      // 相似度匹配
      cache.get('prompt similar exact', 'openai', 'gpt-4');

      const stats = cache.getStats();

      expect(stats.exactHits).toBe(1);
      expect(stats.similarityHits).toBe(1);
      expect(stats.hits).toBe(2);
    });

    it('should calculate hit rate correctly', () => {
      cache.set('prompt1', 'response1', 'openai', 'gpt-4');

      // 3 次命中
      cache.get('prompt1', 'openai', 'gpt-4');
      cache.get('prompt1', 'openai', 'gpt-4');
      cache.get('prompt1', 'openai', 'gpt-4');

      // 2 次未命中
      cache.get('prompt2', 'openai', 'gpt-4');
      cache.get('prompt3', 'openai', 'gpt-4');

      const stats = cache.getStats();

      expect(stats.hits).toBe(3);
      expect(stats.misses).toBe(2);
      expect(stats.hitRate).toBeCloseTo(0.6, 1); // 3/5 = 60%
    });
  });

  describe('LRU Eviction', () => {
    it('should evict least recently used items when full', () => {
      const smallCache = new LLMCache({ maxSize: 3 });

      smallCache.set('prompt1', 'response1', 'openai', 'gpt-4');
      smallCache.set('prompt2', 'response2', 'openai', 'gpt-4');
      smallCache.set('prompt3', 'response3', 'openai', 'gpt-4');

      // 访问 prompt1（变为最近使用）
      smallCache.get('prompt1', 'openai', 'gpt-4');

      // 添加新条目，应该淘汰 prompt2（最少使用）
      smallCache.set('prompt4', 'response4', 'openai', 'gpt-4');

      expect(smallCache.get('prompt1', 'openai', 'gpt-4')).toBe('response1');
      expect(smallCache.get('prompt2', 'openai', 'gpt-4')).toBeNull(); // 已淘汰
      expect(smallCache.get('prompt3', 'openai', 'gpt-4')).toBe('response3');
      expect(smallCache.get('prompt4', 'openai', 'gpt-4')).toBe('response4');
    });
  });

  describe('Integration', () => {
    it('should work with both exact and similarity matching', () => {
      cache.set('generate test for login function', 'test1', 'openai', 'gpt-4');
      cache.set('generate test for logout function', 'test2', 'openai', 'gpt-4');

      // 精确匹配
      const exact = cache.get('generate test for login function', 'openai', 'gpt-4');
      expect(exact).toBe('test1');

      // 相似度匹配
      const similar = cache.get('generate test for signin function', 'openai', 'gpt-4');
      expect(similar).toBeTruthy(); // 应该匹配到相似的

      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.exactHits).toBe(1);
      expect(stats.similarityHits).toBe(1);
    });
  });
});

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}



















