/**
 * ModelSelector 单元测试
 */

import { describe, it, expect } from 'vitest';
import { ModelSelector } from '../ModelSelector';

describe('ModelSelector', () => {
  let selector: ModelSelector;
  
  beforeEach(() => {
    selector = new ModelSelector();
  });
  
  describe('analyzeComplexity', () => {
    it('should classify simple code correctly', () => {
      const complexity = selector.analyzeComplexity(100);
      
      expect(complexity.level).toBe('simple');
      expect(complexity.score).toBeLessThan(40);
    });
    
    it('should classify moderate code correctly', () => {
      const complexity = selector.analyzeComplexity(500, {
        cyclomaticComplexity: 8,
        cognitiveComplexity: 12,
        linesOfCode: 100,
        maintainabilityIndex: 70,
      });
      
      expect(complexity.level).toBe('moderate');
      expect(complexity.score).toBeGreaterThanOrEqual(40);
      expect(complexity.score).toBeLessThan(60);
    });
    
    it('should classify complex code correctly', () => {
      const complexity = selector.analyzeComplexity(1500, {
        cyclomaticComplexity: 25,
        cognitiveComplexity: 35,
        linesOfCode: 300,
        maintainabilityIndex: 45,
      });
      
      expect(complexity.level).toBe('complex');
      expect(complexity.score).toBeGreaterThanOrEqual(60);
    });
    
    it('should classify expert-level code correctly', () => {
      const complexity = selector.analyzeComplexity(3000, {
        cyclomaticComplexity: 40,
        cognitiveComplexity: 50,
        linesOfCode: 500,
        maintainabilityIndex: 30,
      });
      
      expect(complexity.level).toBe('expert');
      expect(complexity.score).toBeGreaterThanOrEqual(80);
    });
  });
  
  describe('selectModel', () => {
    it('should select mini model for simple tasks', () => {
      const complexity = selector.analyzeComplexity(100);
      
      const recommendation = selector.selectModel({
        complexity,
        contextTokens: 500,
        prioritizeCost: true,
      });
      
      // 应该选择低成本模型
      expect(recommendation.model.costPerMillion).toBeLessThan(1.0);
      expect(recommendation.confidence).toBeGreaterThan(0.5);
      expect(recommendation.reasons.length).toBeGreaterThan(0);
    });
    
    it('should select powerful model for complex tasks', () => {
      const complexity: any = {
        level: 'expert',
        score: 90,
        factors: { codeComplexity: 40, contextLength: 5000, taskType: 100, requiresReasoning: 1 },
      };
      
      const recommendation = selector.selectModel({
        complexity,
        contextTokens: 5000,
        qualityRequirement: 0.95,
      });
      
      // 应该选择高能力模型
      expect(recommendation.model.capability).toBeGreaterThan(8);
    });
    
    it('should respect budget constraint', () => {
      const complexity = selector.analyzeComplexity(500);
      
      const recommendation = selector.selectModel({
        complexity,
        contextTokens: 1000,
        budget: 0.001, // 很小的预算
        prioritizeCost: true,
      });
      
      // 应该选择最便宜的模型
      expect(recommendation.estimatedCost).toBeLessThanOrEqual(0.001);
    });
    
    it('should filter models by context window', () => {
      const complexity = selector.analyzeComplexity(100);
      
      const recommendation = selector.selectModel({
        complexity,
        contextTokens: 150000, // 超过某些模型的上下文窗口
      });
      
      // 应该选择支持大上下文的模型
      expect(recommendation.model.contextWindow).toBeGreaterThanOrEqual(150000);
    });
  });
  
  describe('selectForTestGeneration', () => {
    it('should select appropriate model for test generation', () => {
      const code = 'function add(a, b) { return a + b; }';
      
      const recommendation = selector.selectForTestGeneration(code);
      
      expect(recommendation.model).toBeDefined();
      expect(recommendation.confidence).toBeGreaterThan(0.5);
      expect(recommendation.estimatedCost).toBeGreaterThan(0);
    });
  });
  
  describe('selectForRefactoring', () => {
    it('should select higher quality model for refactoring', () => {
      const code = 'complex code here'.repeat(100);
      
      const recommendation = selector.selectForRefactoring(code);
      
      // 重构需要更高质量的模型
      expect(recommendation.model.capability).toBeGreaterThanOrEqual(7);
    });
  });
  
  describe('selectForArchitectureAnalysis', () => {
    it('should select expert model for architecture', () => {
      const recommendation = selector.selectForArchitectureAnalysis(10000);
      
      // 架构分析需要最强模型
      expect(recommendation.model.capability).toBeGreaterThanOrEqual(8);
    });
  });
  
  describe('getAllModels', () => {
    it('should return all available models', () => {
      const models = selector.getAllModels();
      
      expect(models.length).toBeGreaterThan(0);
      expect(models[0]).toHaveProperty('id');
      expect(models[0]).toHaveProperty('provider');
      expect(models[0]).toHaveProperty('capability');
    });
  });
  
  describe('getModelsByProvider', () => {
    it('should filter models by provider', () => {
      const openaiModels = selector.getModelsByProvider('openai');
      
      expect(openaiModels.length).toBeGreaterThan(0);
      expect(openaiModels.every(m => m.provider === 'openai')).toBe(true);
    });
  });
  
  describe('compareModels', () => {
    it('should compare costs of different models', () => {
      const comparison = selector.compareModels(
        ['gpt-4o-mini', 'gpt-4o', 'claude-3-haiku'],
        1000
      );
      
      expect(comparison.length).toBe(3);
      
      // 应该按成本从低到高排序
      for (let i = 1; i < comparison.length; i++) {
        expect(comparison[i].cost).toBeGreaterThanOrEqual(comparison[i - 1].cost);
      }
    });
  });
});




