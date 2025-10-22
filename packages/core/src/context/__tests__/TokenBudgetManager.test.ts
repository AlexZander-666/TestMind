/**
 * TokenBudgetManager 单元测试
 */

import { describe, it, expect } from 'vitest';
import { TokenBudgetManager } from '../TokenBudgetManager';
import type { CodeChunk } from '@testmind/shared';

describe('TokenBudgetManager', () => {
  let manager: TokenBudgetManager;
  
  beforeEach(() => {
    manager = new TokenBudgetManager();
  });
  
  describe('getBudget', () => {
    it('should return correct budget for gpt-4', () => {
      const budget = manager.getBudget('gpt-4');
      
      expect(budget.model).toBe('gpt-4');
      expect(budget.maxContextTokens).toBe(8192);
      expect(budget.maxCompletionTokens).toBe(4096);
      expect(budget.availableInputTokens).toBe(4096);
    });
    
    it('should return correct budget for gpt-4o', () => {
      const budget = manager.getBudget('gpt-4o');
      
      expect(budget.model).toBe('gpt-4o');
      expect(budget.maxContextTokens).toBe(128000);
    });
    
    it('should return correct budget for gemini-1.5-pro', () => {
      const budget = manager.getBudget('gemini-1.5-pro');
      
      expect(budget.model).toBe('gemini-1.5-pro');
      expect(budget.maxContextTokens).toBe(1000000);
    });
    
    it('should use default for unknown model', () => {
      const budget = manager.getBudget('unknown-model');
      
      // 应该返回 gpt-4o-mini 的配置
      expect(budget.model).toBe('gpt-4o-mini');
    });
  });
  
  describe('calculateUsage', () => {
    it('should calculate token usage correctly', () => {
      const systemPrompt = 'You are a helpful assistant.'; // ~30 chars ≈ 8 tokens
      const userInstruction = 'Generate tests.'; // ~15 chars ≈ 4 tokens
      const codeChunks: CodeChunk[] = [
        {
          id: 'chunk-1',
          filePath: 'src/math.ts',
          content: 'function add() { return 1 + 2; }', // ~32 chars ≈ 8 tokens
          startLine: 1,
          endLine: 1,
        },
      ];
      
      const usage = manager.calculateUsage(systemPrompt, userInstruction, codeChunks);
      
      expect(usage.systemPrompt).toBeGreaterThan(0);
      expect(usage.userInstruction).toBeGreaterThan(0);
      expect(usage.codeContext).toBeGreaterThan(0);
      expect(usage.metadata).toBeGreaterThan(0);
      expect(usage.total).toBe(
        usage.systemPrompt + usage.userInstruction + usage.codeContext + usage.metadata
      );
    });
    
    it('should handle multiple code chunks', () => {
      const chunks: CodeChunk[] = [
        {
          id: 'chunk-1',
          filePath: 'file1.ts',
          content: 'a'.repeat(400),
          startLine: 1,
          endLine: 1,
        },
        {
          id: 'chunk-2',
          filePath: 'file2.ts',
          content: 'b'.repeat(400),
          startLine: 1,
          endLine: 1,
        },
      ];
      
      const usage = manager.calculateUsage('prompt', 'instruction', chunks);
      
      expect(usage.codeContext).toBeGreaterThan(0);
      expect(usage.total).toBeGreaterThan(usage.codeContext);
    });
  });
  
  describe('truncateToFit', () => {
    it('should not truncate when within budget', () => {
      const chunks: CodeChunk[] = [
        {
          id: 'chunk-1',
          filePath: 'file.ts',
          content: 'small code',
          startLine: 1,
          endLine: 1,
        },
      ];
      
      const result = manager.truncateToFit(chunks, 10000, '', '');
      
      expect(result.wasTruncated).toBe(false);
      expect(result.chunks).toHaveLength(1);
      expect(result.removedCount).toBe(0);
    });
    
    it('should truncate when exceeding budget', () => {
      const chunks: CodeChunk[] = Array.from({ length: 100 }, (_, i) => ({
        id: `chunk-${i}`,
        filePath: `file${i}.ts`,
        content: 'x'.repeat(400), // ~100 tokens each
        startLine: 1,
        endLine: 10,
      }));
      
      // 预算只有 500 tokens，但有 100 个块 x 100 tokens = 10000 tokens
      const result = manager.truncateToFit(chunks, 500, '', '');
      
      expect(result.wasTruncated).toBe(true);
      expect(result.chunks.length).toBeLessThan(100);
      expect(result.removedCount).toBeGreaterThan(0);
      expect(result.finalTokens).toBeLessThanOrEqual(500);
    });
    
    it('should return empty when no budget for code', () => {
      const chunks: CodeChunk[] = [
        {
          id: 'chunk-1',
          filePath: 'file.ts',
          content: 'code',
          startLine: 1,
          endLine: 1,
        },
      ];
      
      const hugePrompt = 'x'.repeat(40000); // ~10000 tokens
      const result = manager.truncateToFit(chunks, 1000, hugePrompt, '');
      
      // 固定部分已经超出预算，无空间给代码
      expect(result.chunks).toHaveLength(0);
      expect(result.wasTruncated).toBe(true);
    });
    
    it('should preserve chunk order when truncating', () => {
      const chunks: CodeChunk[] = [
        {
          id: 'chunk-1',
          filePath: 'file1.ts',
          content: 'x'.repeat(400),
          startLine: 1,
          endLine: 1,
        },
        {
          id: 'chunk-2',
          filePath: 'file2.ts',
          content: 'x'.repeat(400),
          startLine: 1,
          endLine: 1,
        },
        {
          id: 'chunk-3',
          filePath: 'file3.ts',
          content: 'x'.repeat(400),
          startLine: 1,
          endLine: 1,
        },
      ];
      
      const result = manager.truncateToFit(chunks, 250, '', ''); // 只能容纳 2 个块
      
      // 应该按顺序保留前面的块
      expect(result.chunks[0].id).toBe('chunk-1');
      expect(result.chunks[1].id).toBe('chunk-2');
    });
  });
  
  describe('estimateCost', () => {
    it('should calculate cost for gpt-4', () => {
      const cost = manager.estimateCost('gpt-4', 1000, 500);
      
      // gpt-4: $30/M input, $60/M output
      expect(cost.inputCost).toBeCloseTo(0.03, 4); // 1000 * 30 / 1M
      expect(cost.outputCost).toBeCloseTo(0.03, 4); // 500 * 60 / 1M
      expect(cost.totalCost).toBeCloseTo(0.06, 4);
      expect(cost.currency).toBe('USD');
    });
    
    it('should calculate cost for gpt-4o-mini', () => {
      const cost = manager.estimateCost('gpt-4o-mini', 10000, 5000);
      
      // gpt-4o-mini: $0.15/M input, $0.6/M output
      expect(cost.inputCost).toBeCloseTo(0.0015, 4);
      expect(cost.outputCost).toBeCloseTo(0.003, 4);
      expect(cost.totalCost).toBeCloseTo(0.0045, 4);
    });
    
    it('should use fallback pricing for unknown model', () => {
      const cost = manager.estimateCost('unknown-model', 1000, 500);
      
      // 应该使用 gpt-4o-mini 的定价
      expect(cost).toBeDefined();
      expect(cost.currency).toBe('USD');
    });
  });
  
  describe('visualizeUsage', () => {
    it('should generate visualization string', () => {
      const usage = {
        systemPrompt: 100,
        userInstruction: 50,
        codeContext: 800,
        metadata: 50,
        total: 1000,
      };
      
      const budget = manager.getBudget('gpt-4o-mini');
      const visualization = manager.visualizeUsage(usage, budget);
      
      expect(visualization).toContain('Token Usage');
      expect(visualization).toContain('1,000');
      expect(visualization).toContain('System Prompt');
      expect(visualization).toContain('Code Context');
      expect(visualization).toContain('[');
      expect(visualization).toContain('█'); // 进度条
    });
    
    it('should show percentage correctly', () => {
      const usage = {
        systemPrompt: 0,
        userInstruction: 0,
        codeContext: 50000,
        metadata: 0,
        total: 50000,
      };
      
      const budget = manager.getBudget('gpt-4o'); // 123904 available
      const visualization = manager.visualizeUsage(usage, budget);
      
      // ~40% 使用率
      expect(visualization).toContain('40.'); // 大约 40%
    });
  });
});





