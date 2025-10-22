/**
 * 完整工作流集成测试
 * 
 * 测试从上下文管理到测试生成的完整流程
 */

import { describe, it, expect } from 'vitest';
import {
  createExplicitContextManager,
  createContextFusion,
  createTokenBudgetManager,
  createModelSelector,
  createPromptOptimizer,
} from '../..';
import type { CodeChunk, SemanticSearchResult } from '@testmind/shared';

describe('Complete Workflow Integration', () => {
  it('should execute full context management workflow', async () => {
    // 1. 显式上下文管理
    const contextManager = createExplicitContextManager();
    
    const targetChunk: CodeChunk = {
      id: 'target-1',
      filePath: 'src/utils/math.ts',
      content: 'export function add(a: number, b: number) { return a + b; }',
      startLine: 1,
      endLine: 1,
    };
    
    contextManager.addFile('src/utils/math.ts', [targetChunk], { priority: 10 });
    
    const snapshot = contextManager.getCurrentContext();
    expect(snapshot.pinnedChunks).toHaveLength(1);
    expect(snapshot.estimatedTokens).toBeGreaterThan(0);
    
    // 2. 上下文融合
    const fusion = createContextFusion();
    
    const autoChunks: SemanticSearchResult[] = [
      {
        chunk: {
          id: 'auto-1',
          filePath: 'src/utils/string.ts',
          content: 'export function concat(a: string, b: string) { return a + b; }',
          startLine: 1,
          endLine: 1,
        },
        score: 0.9,
        relevance: 0.9,
      },
    ];
    
    const fusionResult = await fusion.fuseContexts(
      contextManager.getPinnedChunks(),
      autoChunks,
      { maxTokens: 5000 }
    );
    
    expect(fusionResult.chunks.length).toBeGreaterThanOrEqual(1);
    expect(fusionResult.explicitTokens).toBeGreaterThan(0);
    
    // 3. Token 预算管理
    const budgetManager = createTokenBudgetManager();
    const budget = budgetManager.getBudget('gpt-4o-mini');
    
    expect(budget.maxContextTokens).toBeGreaterThan(0);
    
    const usage = budgetManager.calculateUsage(
      'System prompt',
      'User instruction',
      fusionResult.chunks
    );
    
    expect(usage.total).toBeGreaterThan(0);
    expect(usage.total).toBe(
      usage.systemPrompt + usage.userInstruction + usage.codeContext + usage.metadata
    );
    
    // 4. 模型选择
    const modelSelector = createModelSelector();
    const complexity = modelSelector.analyzeComplexity(targetChunk.content.length);
    
    const modelRecommendation = modelSelector.selectModel({
      complexity,
      contextTokens: usage.total,
      prioritizeCost: true,
    });
    
    expect(modelRecommendation.model).toBeDefined();
    expect(modelRecommendation.confidence).toBeGreaterThan(0);
    expect(modelRecommendation.estimatedCost).toBeGreaterThanOrEqual(0);
    
    // 5. Prompt 优化
    const promptOptimizer = createPromptOptimizer();
    const optimizationResult = await promptOptimizer.optimize(
      'Generate unit tests.',
      fusionResult.chunks,
      { aggressiveness: 0.5 }
    );
    
    expect(optimizationResult.optimizedTokens).toBeLessThanOrEqual(optimizationResult.originalTokens);
    expect(optimizationResult.savedPercentage).toBeGreaterThanOrEqual(0);
  });
  
  it('should handle token budget overflow gracefully', async () => {
    const budgetManager = createTokenBudgetManager();
    
    // 创建大量代码块
    const largeChunks: CodeChunk[] = Array.from({ length: 100 }, (_, i) => ({
      id: `chunk-${i}`,
      filePath: `file${i}.ts`,
      content: 'x'.repeat(400), // ~100 tokens each
      startLine: 1,
      endLine: 10,
    }));
    
    // 尝试截断到小预算
    const truncated = budgetManager.truncateToFit(
      largeChunks,
      1000,
      'system prompt',
      'user instruction'
    );
    
    expect(truncated.wasTruncated).toBe(true);
    expect(truncated.chunks.length).toBeLessThan(largeChunks.length);
    expect(truncated.finalTokens).toBeLessThanOrEqual(1000);
  });
  
  it('should maintain data consistency through workflow', async () => {
    const contextManager = createExplicitContextManager();
    const fusion = createContextFusion();
    
    const chunk: CodeChunk = {
      id: 'test-chunk',
      filePath: 'test.ts',
      content: 'test content',
      startLine: 1,
      endLine: 1,
    };
    
    // 添加到显式上下文
    contextManager.addFile('test.ts', [chunk]);
    
    // 融合
    const result = await fusion.fuseContexts(
      contextManager.getPinnedChunks(),
      [],
      { maxTokens: 1000 }
    );
    
    // 验证数据完整性
    expect(result.chunks[0].id).toBe('test-chunk');
    expect(result.chunks[0].filePath).toBe('test.ts');
    expect(result.chunks[0].content).toBe('test content');
  });
});




