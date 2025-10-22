/**
 * ModelSelector - 智能模型选择器
 * 
 * 根据任务复杂度自动选择最合适的 LLM 模型
 * 
 * 策略：
 * - 简单任务 -> 小模型 (gpt-4o-mini, gemini-flash)
 * - 复杂任务 -> 大模型 (gpt-4o, claude-3, gemini-pro)
 * - 架构分析 -> 最强模型 (gpt-4o, claude-3-opus)
 * 
 * 考虑因素：
 * - 代码复杂度
 * - 上下文长度
 * - 任务类型
 * - 成本预算
 */

import type { ComplexityMetrics } from '@testmind/shared';
import { createComponentLogger } from '../utils/logger';

export interface ModelConfig {
  /** 模型 ID */
  id: string;
  
  /** 提供商 */
  provider: 'openai' | 'anthropic' | 'google' | 'ollama';
  
  /** 模型名称 */
  model: string;
  
  /** 上下文窗口大小 */
  contextWindow: number;
  
  /** 成本（USD per 1M tokens input） */
  costPerMillion: number;
  
  /** 能力评分 (0-10) */
  capability: number;
  
  /** 推荐用途 */
  recommendedFor: string[];
}

export interface TaskComplexity {
  /** 复杂度等级 */
  level: 'simple' | 'moderate' | 'complex' | 'expert';
  
  /** 复杂度评分 (0-100) */
  score: number;
  
  /** 评估依据 */
  factors: {
    codeComplexity: number;
    contextLength: number;
    taskType: number;
    requiresReasoning: number;
  };
}

export interface SelectionCriteria {
  /** 任务复杂度 */
  complexity: TaskComplexity;
  
  /** 上下文 token 数 */
  contextTokens: number;
  
  /** 成本预算（USD） */
  budget?: number;
  
  /** 质量要求 (0-1) */
  qualityRequirement?: number;
  
  /** 优先考虑速度 */
  prioritizeSpeed?: boolean;
  
  /** 优先考虑成本 */
  prioritizeCost?: boolean;
}

export interface ModelRecommendation {
  /** 推荐的模型 */
  model: ModelConfig;
  
  /** 推荐置信度 (0-1) */
  confidence: number;
  
  /** 推荐原因 */
  reasons: string[];
  
  /** 预估成本 */
  estimatedCost: number;
  
  /** 备选模型 */
  alternatives?: ModelConfig[];
}

/**
 * 预定义的模型配置
 */
const MODEL_CATALOG: ModelConfig[] = [
  // OpenAI 系列
  {
    id: 'gpt-4o-mini',
    provider: 'openai',
    model: 'gpt-4o-mini',
    contextWindow: 128000,
    costPerMillion: 0.15,
    capability: 7,
    recommendedFor: ['simple-test', 'refactor', 'documentation'],
  },
  {
    id: 'gpt-4o',
    provider: 'openai',
    model: 'gpt-4o',
    contextWindow: 128000,
    costPerMillion: 5.0,
    capability: 9,
    recommendedFor: ['complex-test', 'architecture', 'debugging'],
  },
  {
    id: 'gpt-4-turbo',
    provider: 'openai',
    model: 'gpt-4-turbo',
    contextWindow: 128000,
    costPerMillion: 10.0,
    capability: 9,
    recommendedFor: ['architecture', 'complex-refactor'],
  },
  
  // Anthropic 系列
  {
    id: 'claude-3-haiku',
    provider: 'anthropic',
    model: 'claude-3-haiku',
    contextWindow: 200000,
    costPerMillion: 0.25,
    capability: 7,
    recommendedFor: ['simple-test', 'documentation'],
  },
  {
    id: 'claude-3-sonnet',
    provider: 'anthropic',
    model: 'claude-3-sonnet',
    contextWindow: 200000,
    costPerMillion: 3.0,
    capability: 8,
    recommendedFor: ['complex-test', 'refactor'],
  },
  {
    id: 'claude-3-opus',
    provider: 'anthropic',
    model: 'claude-3-opus',
    contextWindow: 200000,
    costPerMillion: 15.0,
    capability: 10,
    recommendedFor: ['architecture', 'expert-analysis'],
  },
  
  // Google 系列
  {
    id: 'gemini-flash',
    provider: 'google',
    model: 'gemini-1.5-flash',
    contextWindow: 1000000,
    costPerMillion: 0.075,
    capability: 6,
    recommendedFor: ['simple-test', 'quick-analysis'],
  },
  {
    id: 'gemini-pro',
    provider: 'google',
    model: 'gemini-1.5-pro',
    contextWindow: 1000000,
    costPerMillion: 3.5,
    capability: 8,
    recommendedFor: ['complex-test', 'large-context'],
  },
];

/**
 * 模型选择器
 */
export class ModelSelector {
  private logger = createComponentLogger('ModelSelector');
  private catalog = MODEL_CATALOG;
  
  /**
   * 选择最合适的模型
   */
  selectModel(criteria: SelectionCriteria): ModelRecommendation {
    const { complexity, contextTokens, budget, qualityRequirement = 0.8, prioritizeCost = false } = criteria;
    
    // 1. 根据复杂度筛选候选模型
    let candidates = this.filterByComplexity(complexity);
    
    // 2. 根据上下文窗口筛选
    candidates = candidates.filter(m => m.contextWindow >= contextTokens);
    
    // 3. 根据预算筛选（如果指定）
    if (budget) {
      candidates = this.filterByBudget(candidates, contextTokens, budget);
    }
    
    // 4. 评分和排序
    const scored = this.scoreModels(candidates, criteria);
    
    if (scored.length === 0) {
      this.logger.warn('No suitable model found, using fallback');
      return this.getFallbackRecommendation();
    }
    
    // 5. 选择最佳模型
    const best = scored[0];
    const alternatives = scored.slice(1, 3);
    
    // 6. 计算预估成本
    const estimatedCost = this.estimateCost(best, contextTokens);
    
    // 7. 生成推荐原因
    const reasons = this.generateReasons(best, criteria);
    
    this.logger.info('Model selected', {
      model: best.id,
      complexity: complexity.level,
      estimatedCost,
    });
    
    return {
      model: best,
      confidence: this.calculateConfidence(best, criteria),
      reasons,
      estimatedCost,
      alternatives,
    };
  }
  
  /**
   * 根据复杂度筛选模型
   */
  private filterByComplexity(complexity: TaskComplexity): ModelConfig[] {
    const minCapability = {
      'simple': 6,
      'moderate': 7,
      'complex': 8,
      'expert': 9,
    }[complexity.level];
    
    return this.catalog.filter(m => m.capability >= minCapability);
  }
  
  /**
   * 根据预算筛选模型
   */
  private filterByBudget(
    models: ModelConfig[],
    contextTokens: number,
    budget: number
  ): ModelConfig[] {
    return models.filter(m => {
      const estimatedCost = this.estimateCost(m, contextTokens);
      return estimatedCost <= budget;
    });
  }
  
  /**
   * 评分模型
   */
  private scoreModels(
    models: ModelConfig[],
    criteria: SelectionCriteria
  ): ModelConfig[] {
    const scored = models.map(model => {
      let score = 0;
      
      // 能力评分（权重：40%）
      score += (model.capability / 10) * 0.4;
      
      // 成本评分（权重：30%）
      if (criteria.prioritizeCost) {
        const costScore = 1 - (model.costPerMillion / 20); // 归一化
        score += costScore * 0.3;
      }
      
      // 上下文窗口评分（权重：20%）
      const contextScore = Math.min(model.contextWindow / criteria.contextTokens, 1);
      score += contextScore * 0.2;
      
      // 任务匹配度（权重：10%）
      const taskType = this.getTaskType(criteria.complexity);
      const matchScore = model.recommendedFor.includes(taskType) ? 1 : 0.5;
      score += matchScore * 0.1;
      
      return { model, score };
    });
    
    // 按评分排序
    scored.sort((a, b) => b.score - a.score);
    
    return scored.map(s => s.model);
  }
  
  /**
   * 估算成本
   */
  private estimateCost(model: ModelConfig, contextTokens: number): number {
    // 假设输出是输入的 20%
    const outputTokens = contextTokens * 0.2;
    const totalTokens = contextTokens + outputTokens;
    
    return (totalTokens / 1_000_000) * model.costPerMillion;
  }
  
  /**
   * 计算推荐置信度
   */
  private calculateConfidence(model: ModelConfig, criteria: SelectionCriteria): number {
    let confidence = 0.8; // 基础置信度
    
    // 如果任务类型匹配，提高置信度
    const taskType = this.getTaskType(criteria.complexity);
    if (model.recommendedFor.includes(taskType)) {
      confidence += 0.1;
    }
    
    // 如果上下文窗口足够大，提高置信度
    if (model.contextWindow >= criteria.contextTokens * 2) {
      confidence += 0.05;
    }
    
    return Math.min(confidence, 1.0);
  }
  
  /**
   * 生成推荐原因
   */
  private generateReasons(model: ModelConfig, criteria: SelectionCriteria): string[] {
    const reasons: string[] = [];
    
    // 能力匹配
    if (model.capability >= 8) {
      reasons.push(`高能力模型（${model.capability}/10），适合复杂任务`);
    } else {
      reasons.push(`平衡性能和成本的优秀选择`);
    }
    
    // 成本优势
    if (model.costPerMillion < 1.0) {
      reasons.push(`成本低（$${model.costPerMillion}/M tokens）`);
    }
    
    // 上下文窗口
    if (model.contextWindow >= 100000) {
      reasons.push(`超大上下文窗口（${(model.contextWindow / 1000).toFixed(0)}K tokens）`);
    }
    
    // 任务匹配
    const taskType = this.getTaskType(criteria.complexity);
    if (model.recommendedFor.includes(taskType)) {
      reasons.push(`专为 ${taskType} 优化`);
    }
    
    return reasons;
  }
  
  /**
   * 获取任务类型
   */
  private getTaskType(complexity: TaskComplexity): string {
    const mapping = {
      'simple': 'simple-test',
      'moderate': 'refactor',
      'complex': 'complex-test',
      'expert': 'architecture',
    };
    
    return mapping[complexity.level];
  }
  
  /**
   * 获取备选推荐
   */
  private getFallbackRecommendation(): ModelRecommendation {
    const fallback = this.catalog.find(m => m.id === 'gpt-4o-mini')!;
    
    return {
      model: fallback,
      confidence: 0.6,
      reasons: ['Fallback to default model'],
      estimatedCost: 0,
    };
  }
  
  /**
   * 分析代码复杂度
   */
  analyzeComplexity(
    codeLength: number,
    metrics?: ComplexityMetrics
  ): TaskComplexity {
    let score = 0;
    
    // 1. 代码长度
    if (codeLength > 1000) score += 40;
    else if (codeLength > 500) score += 30;
    else if (codeLength > 200) score += 20;
    else score += 10;
    
    // 2. 圈复杂度
    if (metrics) {
      if (metrics.cyclomaticComplexity > 20) score += 30;
      else if (metrics.cyclomaticComplexity > 10) score += 20;
      else score += 10;
      
      // 3. 认知复杂度
      if (metrics.cognitiveComplexity > 30) score += 20;
      else if (metrics.cognitiveComplexity > 15) score += 10;
      else score += 5;
      
      // 4. 可维护性指数
      if (metrics.maintainabilityIndex < 50) score += 10;
    }
    
    // 转换为等级
    let level: TaskComplexity['level'];
    if (score >= 80) level = 'expert';
    else if (score >= 60) level = 'complex';
    else if (score >= 40) level = 'moderate';
    else level = 'simple';
    
    return {
      level,
      score,
      factors: {
        codeComplexity: metrics?.cyclomaticComplexity || 0,
        contextLength: codeLength,
        taskType: 0,
        requiresReasoning: metrics ? (metrics.cognitiveComplexity / 50) : 0,
      },
    };
  }
  
  /**
   * 为测试生成选择模型
   */
  selectForTestGeneration(
    targetCode: string,
    metrics?: ComplexityMetrics
  ): ModelRecommendation {
    const complexity = this.analyzeComplexity(targetCode.length, metrics);
    const contextTokens = Math.ceil(targetCode.length / 4);
    
    return this.selectModel({
      complexity,
      contextTokens,
      qualityRequirement: 0.85,
      prioritizeCost: true,
    });
  }
  
  /**
   * 为代码重构选择模型
   */
  selectForRefactoring(
    targetCode: string,
    metrics?: ComplexityMetrics
  ): ModelRecommendation {
    const complexity = this.analyzeComplexity(targetCode.length, metrics);
    const contextTokens = Math.ceil(targetCode.length / 4);
    
    return this.selectModel({
      complexity,
      contextTokens,
      qualityRequirement: 0.9, // 重构需要更高质量
      prioritizeCost: false,
    });
  }
  
  /**
   * 为架构分析选择模型
   */
  selectForArchitectureAnalysis(
    codebaseSize: number
  ): ModelRecommendation {
    const complexity: TaskComplexity = {
      level: 'expert',
      score: 90,
      factors: {
        codeComplexity: 50,
        contextLength: codebaseSize,
        taskType: 100,
        requiresReasoning: 1,
      },
    };
    
    return this.selectModel({
      complexity,
      contextTokens: Math.ceil(codebaseSize / 4),
      qualityRequirement: 0.95,
      prioritizeCost: false,
    });
  }
  
  /**
   * 获取所有可用模型
   */
  getAllModels(): ModelConfig[] {
    return [...this.catalog];
  }
  
  /**
   * 获取特定提供商的模型
   */
  getModelsByProvider(provider: 'openai' | 'anthropic' | 'google'): ModelConfig[] {
    return this.catalog.filter(m => m.provider === provider);
  }
  
  /**
   * 比较模型成本
   */
  compareModels(models: string[], contextTokens: number): {
    model: string;
    cost: number;
  }[] {
    return models.map(modelId => {
      const model = this.catalog.find(m => m.id === modelId);
      if (!model) {
        return { model: modelId, cost: 0 };
      }
      
      return {
        model: modelId,
        cost: this.estimateCost(model, contextTokens),
      };
    }).sort((a, b) => a.cost - b.cost);
  }
}

/**
 * 工厂函数
 */
export function createModelSelector(): ModelSelector {
  return new ModelSelector();
}

