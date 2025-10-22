/**
 * ContextFusion 单元测试
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ContextFusion } from '../ContextFusion';
import type { CodeChunk, SemanticSearchResult } from '@testmind/shared';
import type { PinnedChunk } from '../ExplicitContextManager';

describe('ContextFusion', () => {
  let fusion: ContextFusion;
  
  beforeEach(() => {
    fusion = new ContextFusion();
  });
  
  describe('fuseContexts', () => {
    it('should include all explicit contexts', async () => {
      const explicitChunks: PinnedChunk[] = [
        {
          chunk: {
            id: 'explicit-1',
            filePath: 'src/core.ts',
            content: 'code'.repeat(100),
            startLine: 1,
            endLine: 10,
          },
          addedAt: new Date(),
          priority: 10,
        },
      ];
      
      const autoChunks: SemanticSearchResult[] = [];
      
      const result = await fusion.fuseContexts(explicitChunks, autoChunks, {
        maxTokens: 1000,
      });
      
      expect(result.chunks).toHaveLength(1);
      expect(result.chunks[0].id).toBe('explicit-1');
    });
    
    it('should add auto context within budget', async () => {
      const explicitChunks: PinnedChunk[] = [
        {
          chunk: {
            id: 'explicit-1',
            filePath: 'src/core.ts',
            content: 'code'.repeat(50), // ~200 chars ≈ 50 tokens
            startLine: 1,
            endLine: 5,
          },
          addedAt: new Date(),
          priority: 10,
        },
      ];
      
      const autoChunks: SemanticSearchResult[] = [
        {
          chunk: {
            id: 'auto-1',
            filePath: 'src/utils.ts',
            content: 'code'.repeat(50), // ~200 chars ≈ 50 tokens
            startLine: 1,
            endLine: 5,
          },
          score: 0.95,
          relevance: 0.95,
        },
      ];
      
      const result = await fusion.fuseContexts(explicitChunks, autoChunks, {
        maxTokens: 1000,
      });
      
      // 应该包含显式和自动两个块
      expect(result.chunks.length).toBeGreaterThanOrEqual(1);
      expect(result.explicitTokens).toBeGreaterThan(0);
    });
    
    it('should deduplicate chunks', async () => {
      const duplicateChunk: CodeChunk = {
        id: 'dup-1',
        filePath: 'src/core.ts',
        content: 'duplicate content',
        startLine: 1,
        endLine: 1,
      };
      
      const explicitChunks: PinnedChunk[] = [
        {
          chunk: duplicateChunk,
          addedAt: new Date(),
          priority: 10,
        },
      ];
      
      const autoChunks: SemanticSearchResult[] = [
        {
          chunk: duplicateChunk, // 相同的块
          score: 0.9,
          relevance: 0.9,
        },
      ];
      
      const result = await fusion.fuseContexts(explicitChunks, autoChunks, {
        maxTokens: 1000,
        deduplicationStrategy: 'strict',
      });
      
      // 应该只包含一个块（显式优先）
      expect(result.chunks).toHaveLength(1);
      expect(result.deduplication.duplicatesFound).toBe(1);
      expect(result.deduplication.duplicatesRemoved).toBe(1);
    });
    
    it('should truncate auto context when exceeding budget', async () => {
      const explicitChunks: PinnedChunk[] = [
        {
          chunk: {
            id: 'explicit-1',
            filePath: 'src/core.ts',
            content: 'x'.repeat(800), // ~200 tokens
            startLine: 1,
            endLine: 10,
          },
          addedAt: new Date(),
          priority: 10,
        },
      ];
      
      // 很多自动块
      const autoChunks: SemanticSearchResult[] = Array.from({ length: 10 }, (_, i) => ({
        chunk: {
          id: `auto-${i}`,
          filePath: `src/file${i}.ts`,
          content: 'x'.repeat(400), // ~100 tokens each
          startLine: 1,
          endLine: 5,
        },
        score: 0.9 - i * 0.05,
        relevance: 0.9 - i * 0.05,
      }));
      
      const result = await fusion.fuseContexts(explicitChunks, autoChunks, {
        maxTokens: 500, // 小预算
        explicitContextReserve: 0.6,
      });
      
      // 显式上下文应该包含
      expect(result.chunks.find(c => c.id === 'explicit-1')).toBeDefined();
      
      // 应该发生截断
      expect(result.truncated).toBe(true);
      expect(result.chunks.length).toBeLessThan(11); // 不是所有块都被包含
    });
    
    it('should prioritize explicit context', async () => {
      const explicitChunks: PinnedChunk[] = [
        {
          chunk: {
            id: 'explicit-high',
            filePath: 'src/important.ts',
            content: 'important code',
            startLine: 1,
            endLine: 1,
          },
          addedAt: new Date(),
          priority: 10,
        },
      ];
      
      const autoChunks: SemanticSearchResult[] = [
        {
          chunk: {
            id: 'auto-low',
            filePath: 'src/other.ts',
            content: 'other code',
            startLine: 1,
            endLine: 1,
          },
          score: 0.99, // 即使得分很高
          relevance: 0.99,
        },
      ];
      
      const result = await fusion.fuseContexts(explicitChunks, autoChunks, {
        maxTokens: 1000,
      });
      
      // 显式上下文应该排在前面
      expect(result.chunks[0].id).toBe('explicit-high');
    });
  });
  
  describe('respects explicitContextReserve', () => {
    it('should reserve tokens for explicit context', async () => {
      const largeExplicitChunk: PinnedChunk = {
        chunk: {
          id: 'large-explicit',
          filePath: 'src/large.ts',
          content: 'x'.repeat(2000), // ~500 tokens
          startLine: 1,
          endLine: 50,
        },
        addedAt: new Date(),
        priority: 10,
      };
      
      const autoChunks: SemanticSearchResult[] = Array.from({ length: 5 }, (_, i) => ({
        chunk: {
          id: `auto-${i}`,
          filePath: `src/auto${i}.ts`,
          content: 'x'.repeat(400), // ~100 tokens each
          startLine: 1,
          endLine: 10,
        },
        score: 0.9,
        relevance: 0.9,
      }));
      
      const result = await fusion.fuseContexts([largeExplicitChunk], autoChunks, {
        maxTokens: 1000,
        explicitContextReserve: 0.6, // 60% 预留给显式
      });
      
      // 显式块应该包含，即使很大
      expect(result.chunks.find(c => c.id === 'large-explicit')).toBeDefined();
      
      // 应该有一些自动块，但受预算限制
      const autoCount = result.chunks.filter(c => c.id.startsWith('auto')).length;
      expect(autoCount).toBeLessThan(5); // 不是所有自动块都被包含
    });
  });
  
  describe('getStatistics', () => {
    it('should calculate fusion statistics', async () => {
      const explicitChunks: PinnedChunk[] = [
        {
          chunk: {
            id: 'explicit-1',
            filePath: 'src/core.ts',
            content: 'code',
            startLine: 1,
            endLine: 1,
          },
          addedAt: new Date(),
          priority: 10,
        },
      ];
      
      const autoChunks: SemanticSearchResult[] = [
        {
          chunk: {
            id: 'auto-1',
            filePath: 'src/utils.ts',
            content: 'code',
            startLine: 1,
            endLine: 1,
          },
          score: 0.9,
          relevance: 0.9,
        },
      ];
      
      const result = await fusion.fuseContexts(explicitChunks, autoChunks, {
        maxTokens: 1000,
      });
      
      expect(result.totalTokens).toBe(result.explicitTokens + result.autoTokens);
      expect(result.exceedsBudget).toBe(false);
    });
  });
});


