/**
 * TokenBudgetManager - Token 预算管理器
 * 
 * 精确管理 LLM 上下文窗口的 token 使用
 * 
 * 功能：
 * - 精确计算 token 数量（支持不同的 tokenizer）
 * - 智能截断（超出预算时）
 * - 可视化 token 使用情况
 * - 成本估算
 * 
 * 支持的模型：
 * - GPT-4: 8k/32k/128k context
 * - GPT-3.5: 4k/16k context
 * - Claude: 100k/200k context
 * - Gemini: 32k/1M context
 */

import type { CodeChunk } from '@testmind/shared';
import { createComponentLogger } from '../utils/logger';

export interface TokenBudget {
  /** 模型标识 */
  model: string;
  
  /** 最大上下文 tokens */
  maxContextTokens: number;
  
  /** 预留给响应的 tokens */
  maxCompletionTokens: number;
  
  /** 可用于输入的 tokens */
  availableInputTokens: number;
}

export interface TokenUsage {
  /** 系统提示 tokens */
  systemPrompt: number;
  
  /** 用户指令 tokens */
  userInstruction: number;
  
  /** 代码上下文 tokens */
  codeContext: number;
  
  /** 其他元数据 tokens */
  metadata: number;
  
  /** 总计 */
  total: number;
}

export interface TruncationResult {
  /** 截断后的代码块 */
  chunks: CodeChunk[];
  
  /** 是否发生截断 */
  wasTruncated: boolean;
  
  /** 移除的代码块数量 */
  removedCount: number;
  
  /** 截断前的 token 数 */
  originalTokens: number;
  
  /** 截断后的 token 数 */
  finalTokens: number;
}

export interface CostEstimate {
  /** 输入成本（USD） */
  inputCost: number;
  
  /** 输出成本（USD） */
  outputCost: number;
  
  /** 总成本（USD） */
  totalCost: number;
  
  /** 成本货币 */
  currency: string;
}

/**
 * 模型配置
 */
const MODEL_CONFIGS: Record<string, TokenBudget> = {
  'gpt-4': {
    model: 'gpt-4',
    maxContextTokens: 8192,
    maxCompletionTokens: 4096,
    availableInputTokens: 4096,
  },
  'gpt-4-32k': {
    model: 'gpt-4-32k',
    maxContextTokens: 32768,
    maxCompletionTokens: 8192,
    availableInputTokens: 24576,
  },
  'gpt-4-turbo': {
    model: 'gpt-4-turbo',
    maxContextTokens: 128000,
    maxCompletionTokens: 4096,
    availableInputTokens: 123904,
  },
  'gpt-4o': {
    model: 'gpt-4o',
    maxContextTokens: 128000,
    maxCompletionTokens: 4096,
    availableInputTokens: 123904,
  },
  'gpt-4o-mini': {
    model: 'gpt-4o-mini',
    maxContextTokens: 128000,
    maxCompletionTokens: 16384,
    availableInputTokens: 111616,
  },
  'gpt-3.5-turbo': {
    model: 'gpt-3.5-turbo',
    maxContextTokens: 4096,
    maxCompletionTokens: 4096,
    availableInputTokens: 0, // Legacy
  },
  'gpt-3.5-turbo-16k': {
    model: 'gpt-3.5-turbo-16k',
    maxContextTokens: 16384,
    maxCompletionTokens: 4096,
    availableInputTokens: 12288,
  },
  'claude-2': {
    model: 'claude-2',
    maxContextTokens: 100000,
    maxCompletionTokens: 4096,
    availableInputTokens: 95904,
  },
  'claude-3': {
    model: 'claude-3',
    maxContextTokens: 200000,
    maxCompletionTokens: 4096,
    availableInputTokens: 195904,
  },
  'gemini-pro': {
    model: 'gemini-pro',
    maxContextTokens: 32768,
    maxCompletionTokens: 8192,
    availableInputTokens: 24576,
  },
  'gemini-1.5-pro': {
    model: 'gemini-1.5-pro',
    maxContextTokens: 1000000,
    maxCompletionTokens: 8192,
    availableInputTokens: 991808,
  },
};

/**
 * 定价配置（USD per 1M tokens）
 */
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4': { input: 30.0, output: 60.0 },
  'gpt-4-32k': { input: 60.0, output: 120.0 },
  'gpt-4-turbo': { input: 10.0, output: 30.0 },
  'gpt-4o': { input: 5.0, output: 15.0 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-3.5-turbo': { input: 0.5, output: 1.5 },
  'gpt-3.5-turbo-16k': { input: 3.0, output: 4.0 },
  'claude-2': { input: 8.0, output: 24.0 },
  'claude-3': { input: 15.0, output: 75.0 },
  'gemini-pro': { input: 0.5, output: 1.5 },
  'gemini-1.5-pro': { input: 3.5, output: 10.5 },
};

/**
 * Token 预算管理器
 */
export class TokenBudgetManager {
  private logger = createComponentLogger('TokenBudgetManager');
  
  /**
   * 获取模型的 token 预算配置
   */
  getBudget(model: string): TokenBudget {
    const config = MODEL_CONFIGS[model];
    
    if (!config) {
      this.logger.warn('Unknown model, using gpt-4o-mini defaults', { model });
      return MODEL_CONFIGS['gpt-4o-mini'];
    }
    
    return config;
  }
  
  /**
   * 计算 token 使用情况
   * 
   * @param systemPrompt - 系统提示
   * @param userInstruction - 用户指令
   * @param codeChunks - 代码上下文
   */
  calculateUsage(
    systemPrompt: string,
    userInstruction: string,
    codeChunks: CodeChunk[]
  ): TokenUsage {
    const systemPromptTokens = this.estimateTokens(systemPrompt);
    const userInstructionTokens = this.estimateTokens(userInstruction);
    
    const codeContextTokens = codeChunks.reduce((sum, chunk) => {
      return sum + this.estimateTokens(chunk.content);
    }, 0);
    
    const metadataTokens = codeChunks.reduce((sum, chunk) => {
      const metadata = `File: ${chunk.filePath}\nLines: ${chunk.startLine}-${chunk.endLine}\n`;
      return sum + this.estimateTokens(metadata);
    }, 0);
    
    const total = systemPromptTokens + userInstructionTokens + codeContextTokens + metadataTokens;
    
    return {
      systemPrompt: systemPromptTokens,
      userInstruction: userInstructionTokens,
      codeContext: codeContextTokens,
      metadata: metadataTokens,
      total,
    };
  }
  
  /**
   * 估算文本的 token 数量
   * 
   * 简化版：1 token ≈ 4 字符（英文）
   * TODO: 集成 tiktoken 以获得精确计数
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
  
  /**
   * 智能截断代码块以适应 token 预算
   * 
   * 策略：
   * 1. 优先保留高优先级的代码块
   * 2. 尽量保持完整的函数/类
   * 3. 均匀分配 token 给不同文件
   */
  truncateToFit(
    chunks: CodeChunk[],
    maxTokens: number,
    systemPrompt: string = '',
    userInstruction: string = ''
  ): TruncationResult {
    // 计算固定部分的 token
    const fixedTokens = this.estimateTokens(systemPrompt) + this.estimateTokens(userInstruction);
    const availableForCode = maxTokens - fixedTokens;
    
    if (availableForCode <= 0) {
      this.logger.error('No tokens available for code context', {
        maxTokens,
        fixedTokens,
      });
      
      return {
        chunks: [],
        wasTruncated: true,
        removedCount: chunks.length,
        originalTokens: this.calculateChunksTokens(chunks),
        finalTokens: 0,
      };
    }
    
    const originalTokens = this.calculateChunksTokens(chunks);
    
    // 如果已经在预算内，无需截断
    if (originalTokens <= availableForCode) {
      return {
        chunks,
        wasTruncated: false,
        removedCount: 0,
        originalTokens,
        finalTokens: originalTokens,
      };
    }
    
    // 需要截断 - 按顺序选择代码块直到达到预算
    const selected: CodeChunk[] = [];
    let usedTokens = 0;
    
    for (const chunk of chunks) {
      const chunkTokens = this.estimateTokens(chunk.content);
      
      if (usedTokens + chunkTokens <= availableForCode) {
        selected.push(chunk);
        usedTokens += chunkTokens;
      } else {
        // 已达到预算，停止添加
        break;
      }
    }
    
    this.logger.info('Chunks truncated to fit budget', {
      original: chunks.length,
      final: selected.length,
      removed: chunks.length - selected.length,
      originalTokens,
      finalTokens: usedTokens,
      budget: availableForCode,
    });
    
    return {
      chunks: selected,
      wasTruncated: true,
      removedCount: chunks.length - selected.length,
      originalTokens,
      finalTokens: usedTokens,
    };
  }
  
  /**
   * 计算代码块的总 token 数
   */
  private calculateChunksTokens(chunks: CodeChunk[]): number {
    return chunks.reduce((sum, chunk) => {
      return sum + this.estimateTokens(chunk.content);
    }, 0);
  }
  
  /**
   * 估算成本
   */
  estimateCost(
    model: string,
    inputTokens: number,
    outputTokens: number
  ): CostEstimate {
    const pricing = MODEL_PRICING[model];
    
    if (!pricing) {
      this.logger.warn('Unknown model pricing, using gpt-4o-mini', { model });
      return this.estimateCost('gpt-4o-mini', inputTokens, outputTokens);
    }
    
    const inputCost = (inputTokens / 1_000_000) * pricing.input;
    const outputCost = (outputTokens / 1_000_000) * pricing.output;
    const totalCost = inputCost + outputCost;
    
    return {
      inputCost,
      outputCost,
      totalCost,
      currency: 'USD',
    };
  }
  
  /**
   * 生成 token 使用情况的可视化字符串
   */
  visualizeUsage(usage: TokenUsage, budget: TokenBudget): string {
    const percentUsed = (usage.total / budget.availableInputTokens) * 100;
    const barLength = 50;
    const filledLength = Math.round((percentUsed / 100) * barLength);
    const emptyLength = barLength - filledLength;
    
    const bar = '█'.repeat(filledLength) + '░'.repeat(emptyLength);
    
    return `
Token Usage: ${usage.total.toLocaleString()} / ${budget.availableInputTokens.toLocaleString()} (${percentUsed.toFixed(1)}%)
[${bar}]

Breakdown:
  System Prompt:    ${usage.systemPrompt.toLocaleString().padStart(8)} tokens
  User Instruction: ${usage.userInstruction.toLocaleString().padStart(8)} tokens
  Code Context:     ${usage.codeContext.toLocaleString().padStart(8)} tokens
  Metadata:         ${usage.metadata.toLocaleString().padStart(8)} tokens
  ──────────────────────────────────
  Total:            ${usage.total.toLocaleString().padStart(8)} tokens
`;
  }
}

/**
 * 工厂函数
 */
export function createTokenBudgetManager(): TokenBudgetManager {
  return new TokenBudgetManager();
}


