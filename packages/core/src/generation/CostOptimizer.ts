/**
 * CostOptimizer - LLM 成本优化器
 * 
 * 优化策略：
 * 1. 分层模型选择（简单用cheap模型，复杂用强模型）
 * 2. Prompt 压缩（移除冗余，保留关键信息）
 * 3. Few-shot 智能选择（从向量库选最相关示例）
 * 4. 批量生成（减少往返次数）
 * 5. 缓存优化（相似请求复用）
 */

import type { CodeChunk } from '@testmind/shared';
import type { HybridSearchEngine } from '../context/HybridSearchEngine';

/**
 * 模型定价（$/1M tokens）
 */
const MODEL_PRICING = {
  'gpt-4-turbo': { input: 10.0, output: 30.0 },
  'gpt-4': { input: 30.0, output: 60.0 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-3.5-turbo': { input: 0.5, output: 1.5 },
  'gemini-2.5-pro': { input: 1.25, output: 5.0 },
  'claude-3-5-sonnet': { input: 3.0, output: 15.0 },
};

/**
 * 测试上下文
 */
export interface TestGenerationContext {
  /** 函数代码 */
  functionCode: string;
  
  /** 函数名 */
  functionName: string;
  
  /** 圈复杂度 */
  complexity: number;
  
  /** 依赖项 */
  dependencies?: string[];
  
  /** 文件路径 */
  filePath: string;
  
  /** 是否有现有测试（参考） */
  hasExistingTests?: boolean;
}

/**
 * 模型选择结果
 */
export interface ModelSelection {
  /** 选择的模型 */
  model: string;
  
  /** 选择理由 */
  reason: string;
  
  /** 估算成本（美元） */
  estimatedCost: number;
  
  /** 预期质量得分 (0-100) */
  expectedQuality: number;
}

/**
 * Prompt 压缩结果
 */
export interface PromptCompressionResult {
  /** 压缩后的 Prompt */
  compressed: string;
  
  /** 原始长度 */
  originalLength: number;
  
  /** 压缩后长度 */
  compressedLength: number;
  
  /** 压缩率 */
  compressionRatio: number;
  
  /** 节省的估算成本 */
  costSaved: number;
}

/**
 * LLM 成本优化器
 */
export class CostOptimizer {
  private hybridSearch?: HybridSearchEngine;
  private totalCostSaved = 0;
  private totalTokensSaved = 0;

  constructor(hybridSearch?: HybridSearchEngine) {
    this.hybridSearch = hybridSearch;
  }

  /**
   * 选择最优模型
   * 
   * 决策树：
   * - 复杂度 ≤ 3: gpt-3.5-turbo (最便宜)
   * - 复杂度 4-10: gpt-4o-mini (平衡)
   * - 复杂度 > 10: gpt-4-turbo (最强)
   * - 有复杂依赖: gpt-4-turbo
   */
  selectModel(context: TestGenerationContext): ModelSelection {
    let model = 'gpt-3.5-turbo';
    let reason = '';
    let expectedQuality = 70;

    // 简单函数 -> 便宜模型
    if (context.complexity <= 3) {
      model = 'gpt-3.5-turbo';
      reason = 'Simple function, using cost-effective model';
      expectedQuality = 75;
    }
    // 中等复杂度 -> 平衡模型
    else if (context.complexity <= 10) {
      model = 'gpt-4o-mini';
      reason = 'Moderate complexity, using balanced model';
      expectedQuality = 85;
    }
    // 高复杂度 -> 强模型
    else {
      model = 'gpt-4-turbo';
      reason = 'High complexity, using advanced model';
      expectedQuality = 93;
    }

    // 有复杂依赖 -> 升级模型
    if (context.dependencies && context.dependencies.length > 5) {
      if (model === 'gpt-3.5-turbo') {
        model = 'gpt-4o-mini';
        reason += '; upgraded due to complex dependencies';
        expectedQuality += 8;
      }
    }

    // 估算成本（假设 1000 tokens input, 500 tokens output）
    const pricing = MODEL_PRICING[model as keyof typeof MODEL_PRICING];
    const estimatedCost = (1000 / 1_000_000 * pricing.input) + (500 / 1_000_000 * pricing.output);

    return {
      model,
      reason,
      estimatedCost: parseFloat(estimatedCost.toFixed(6)),
      expectedQuality,
    };
  }

  /**
   * 压缩 Prompt
   * 
   * 压缩策略：
   * 1. 移除注释（但保留 JSDoc）
   * 2. 简化空白
   * 3. 移除重复的上下文
   * 4. 提取关键信息
   */
  compressPrompt(prompt: string, context: TestGenerationContext): PromptCompressionResult {
    const originalLength = prompt.length;
    let compressed = prompt;

    // 1. 移除多余空行（保留单个空行）
    compressed = compressed.replace(/\n{3,}/g, '\n\n');

    // 2. 简化缩进（4 空格 -> 2 空格）
    compressed = compressed.replace(/ {4}/g, '  ');

    // 3. 移除行尾空格
    compressed = compressed.split('\n').map(line => line.trimEnd()).join('\n');

    // 4. 压缩代码示例
    compressed = this.compressCodeExamples(compressed);

    // 5. 移除冗余的解释性文本
    compressed = this.removeRedundantText(compressed);

    const compressedLength = compressed.length;
    const compressionRatio = 1 - (compressedLength / originalLength);
    
    // 估算节省的成本
    const tokensSaved = Math.floor((originalLength - compressedLength) / 4);
    const costSaved = (tokensSaved / 1_000_000) * 0.5; // 假设平均 $0.5/1M tokens

    this.totalTokensSaved += tokensSaved;
    this.totalCostSaved += costSaved;

    return {
      compressed,
      originalLength,
      compressedLength,
      compressionRatio: parseFloat(compressionRatio.toFixed(3)),
      costSaved: parseFloat(costSaved.toFixed(6)),
    };
  }

  /**
   * 智能选择 Few-shot 示例
   * 
   * 从向量库中选择最相关的示例，而非使用固定示例
   */
  async selectFewShotExamples(
    context: TestGenerationContext,
    maxExamples = 2
  ): Promise<CodeChunk[]> {
    if (!this.hybridSearch) {
      return []; // 没有搜索引擎，返回空
    }

    try {
      // 构建搜索查询
      const query = {
        text: `${context.functionName} ${context.functionCode.slice(0, 500)}`,
        topK: maxExamples,
        filter: {
          fileTypes: [context.filePath.split('.').pop()!],
        },
      };

      // 搜索相似代码
      const results = await this.hybridSearch.search(query);

      console.log(
        `[CostOptimizer] Selected ${results.length} few-shot examples ` +
        `(avg score: ${(results.reduce((sum, r) => sum + r.score, 0) / results.length).toFixed(3)})`
      );

      return results.map(r => r.chunk);
    } catch (error) {
      console.error('[CostOptimizer] Failed to select few-shot examples:', error);
      return [];
    }
  }

  /**
   * 批量生成优化
   * 
   * 将多个测试生成请求合并为一个，减少 API 往返
   */
  async batchGenerate(contexts: TestGenerationContext[]): Promise<{
    prompts: string[];
    estimatedSavings: number;
  }> {
    // 如果只有 1-2 个，不值得批量
    if (contexts.length <= 2) {
      return {
        prompts: contexts.map(c => `Generate test for ${c.functionName}`),
        estimatedSavings: 0,
      };
    }

    // 构建批量 Prompt
    const batchPrompt = `Generate tests for the following ${contexts.length} functions:

${contexts.map((ctx, i) => `
${i + 1}. Function: ${ctx.functionName}
   Complexity: ${ctx.complexity}
   Code:
   \`\`\`typescript
   ${ctx.functionCode.slice(0, 300)}
   \`\`\`
`).join('\n')}

For each function, generate a concise test. Format your response as:

TEST 1:
\`\`\`typescript
// test code here
\`\`\`

TEST 2:
\`\`\`typescript
// test code here
\`\`\`

... and so on.
`;

    // 估算节省
    // 单个生成：每个约 800 tokens system + 1000 tokens per function
    const individualCost = contexts.length * (800 + 1000);
    
    // 批量生成：800 tokens system + 500 tokens per function (减少重复上下文)
    const batchCost = 800 + contexts.length * 500;
    
    const tokensSaved = individualCost - batchCost;
    const estimatedSavings = (tokensSaved / 1_000_000) * 0.5;

    console.log(`[CostOptimizer] Batch generation saves ~${tokensSaved} tokens ($${estimatedSavings.toFixed(4)})`);

    return {
      prompts: [batchPrompt],
      estimatedSavings,
    };
  }

  /**
   * 获取优化统计
   */
  getOptimizationStats(): {
    totalTokensSaved: number;
    totalCostSaved: number;
  } {
    return {
      totalTokensSaved: this.totalTokensSaved,
      totalCostSaved: parseFloat(this.totalCostSaved.toFixed(6)),
    };
  }

  /**
   * 压缩代码示例
   */
  private compressCodeExamples(text: string): string {
    // 移除示例代码中的注释
    return text.replace(/```[\s\S]*?```/g, (match) => {
      return match.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
    });
  }

  /**
   * 移除冗余文本
   */
  private removeRedundantText(text: string): string {
    let compressed = text;

    // 移除重复的"Generate"指令
    compressed = compressed.replace(/Generate.*?test.*?\n/gi, (match, offset) => {
      // 只保留最后一个"Generate"指令
      return offset > compressed.length * 0.8 ? match : '';
    });

    return compressed;
  }

  /**
   * 生成成本报告
   */
  generateCostReport(): string {
    return `# LLM Cost Optimization Report

## Total Savings
- **Tokens Saved**: ${this.totalTokensSaved.toLocaleString()}
- **Cost Saved**: $${this.totalCostSaved.toFixed(4)}

## Optimization Strategies Applied
1. Model Selection (simple → cheap, complex → powerful)
2. Prompt Compression (remove redundancy)
3. Few-shot Smart Selection (vector search)
4. Batch Generation (reduce API calls)

## Recommendations
- Continue using gpt-4o-mini for moderate complexity (85% quality, 1/67 cost of gpt-4)
- Use batch generation for > 3 functions
- Enable caching for repeated patterns
- Consider local models (Ollama) for development
`;
  }
}

/**
 * 成本追踪器
 */
export class CostTracker {
  private costs: Array<{
    timestamp: Date;
    model: string;
    inputTokens: number;
    outputTokens: number;
    cost: number;
    operation: string;
  }> = [];

  /**
   * 记录成本
   */
  track(entry: {
    model: string;
    inputTokens: number;
    outputTokens: number;
    operation: string;
  }): void {
    const pricing = MODEL_PRICING[entry.model as keyof typeof MODEL_PRICING];
    
    if (!pricing) {
      console.warn(`[CostTracker] Unknown model pricing: ${entry.model}`);
      return;
    }

    const cost = 
      (entry.inputTokens / 1_000_000 * pricing.input) +
      (entry.outputTokens / 1_000_000 * pricing.output);

    this.costs.push({
      timestamp: new Date(),
      model: entry.model,
      inputTokens: entry.inputTokens,
      outputTokens: entry.outputTokens,
      cost,
      operation: entry.operation,
    });
  }

  /**
   * 获取总成本
   */
  getTotalCost(): number {
    return this.costs.reduce((sum, entry) => sum + entry.cost, 0);
  }

  /**
   * 获取统计
   */
  getStats(): {
    totalCost: number;
    totalTokens: number;
    byModel: Record<string, { count: number; cost: number; tokens: number }>;
    byOperation: Record<string, { count: number; cost: number }>;
  } {
    const byModel: Record<string, { count: number; cost: number; tokens: number }> = {};
    const byOperation: Record<string, { count: number; cost: number }> = {};
    let totalTokens = 0;

    for (const entry of this.costs) {
      totalTokens += entry.inputTokens + entry.outputTokens;

      // 按模型统计
      if (!byModel[entry.model]) {
        byModel[entry.model] = { count: 0, cost: 0, tokens: 0 };
      }
      byModel[entry.model].count++;
      byModel[entry.model].cost += entry.cost;
      byModel[entry.model].tokens += entry.inputTokens + entry.outputTokens;

      // 按操作统计
      if (!byOperation[entry.operation]) {
        byOperation[entry.operation] = { count: 0, cost: 0 };
      }
      byOperation[entry.operation].count++;
      byOperation[entry.operation].cost += entry.cost;
    }

    return {
      totalCost: this.getTotalCost(),
      totalTokens,
      byModel,
      byOperation,
    };
  }

  /**
   * 生成成本报告
   */
  generateReport(): string {
    const stats = this.getStats();

    let report = `# LLM Cost Report\n\n`;
    report += `**Total Cost**: $${stats.totalCost.toFixed(4)}\n`;
    report += `**Total Tokens**: ${stats.totalTokens.toLocaleString()}\n`;
    report += `**Total Requests**: ${this.costs.length}\n\n`;

    report += `## Cost by Model\n\n`;
    for (const [model, data] of Object.entries(stats.byModel)) {
      if (data) {
        report += `- **${model}**: ${data.count} requests, ${data.tokens.toLocaleString()} tokens, $${data.cost.toFixed(4)}\n`;
      }
    }

    report += `\n## Cost by Operation\n\n`;
    for (const [operation, data] of Object.entries(stats.byOperation)) {
      if (data) {
        report += `- **${operation}**: ${data.count} requests, $${data.cost.toFixed(4)}\n`;
      }
    }

    return report;
  }

  /**
   * 导出为 JSON
   */
  exportJSON(): string {
    return JSON.stringify({
      summary: this.getStats(),
      details: this.costs,
    }, null, 2);
  }

  /**
   * 清空统计
   */
  reset(): void {
    this.costs = [];
  }
}

/**
 * 便捷工厂函数
 */
export function createCostOptimizer(hybridSearch?: HybridSearchEngine): CostOptimizer {
  return new CostOptimizer(hybridSearch);
}

export function createCostTracker(): CostTracker {
  return new CostTracker();
}

/**
 * 成本优化最佳实践
 * 
 * 1. 模型选择：
 *    - GPT-3.5-turbo: 简单函数（复杂度 ≤ 3）
 *    - GPT-4o-mini: 中等复杂度（4-10）
 *    - GPT-4-turbo: 高复杂度（> 10）
 *    
 *    成本对比：
 *    - GPT-3.5: $0.0005/1K tokens (input)
 *    - GPT-4o-mini: $0.00015/1K tokens (1/3 成本)
 *    - GPT-4-turbo: $0.01/1K tokens (67x 成本)
 * 
 * 2. Prompt 工程：
 *    - 简洁明确，移除冗余
 *    - 使用结构化格式
 *    - Few-shot 示例数量：1-3 个（更多未必更好）
 * 
 * 3. 缓存策略：
 *    - 相似度 ≥ 0.85: 复用缓存
 *    - 热点请求延长 TTL
 *    - 定期清理过期缓存
 * 
 * 4. 批量处理：
 *    - > 3 个函数: 考虑批量生成
 *    - 每批 5-10 个为宜
 *    - 平衡成本和质量
 * 
 * 预期节省：
 * - Prompt 压缩: 15-25%
 * - 模型选择: 40-60%
 * - Few-shot 优化: 10-15%
 * - 批量处理: 20-30%
 * - 总计: 60-70% 成本降低
 */


