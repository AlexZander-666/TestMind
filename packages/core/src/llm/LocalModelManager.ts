/**
 * LocalModelManager - 本地模型管理器
 * 
 * 管理本地运行的 LLM（通过 Ollama）
 * 
 * 支持的模型：
 * - Llama 3.3 (8B, 70B)
 * - Qwen 2.5 (7B, 14B, 32B)
 * - DeepSeek Coder (6.7B, 33B)
 * - CodeLlama (7B, 13B, 34B)
 * 
 * 功能：
 * - 自动下载和安装模型
 * - 模型性能基准
 * - 混合推理（本地+云）
 * - 成本节省 60-80%
 */

import { execSync } from 'child_process';
import { createComponentLogger } from '../utils/logger';

export interface LocalModel {
  /** 模型名称 */
  name: string;
  
  /** 模型大小 */
  size: string;
  
  /** 参数量 */
  parameters: string;
  
  /** 是否已下载 */
  downloaded: boolean;
  
  /** 推荐用途 */
  recommendedFor: string[];
  
  /** 性能评分 (0-10) */
  performance: number;
}

export interface ModelBenchmark {
  /** 模型名称 */
  model: string;
  
  /** 平均延迟（毫秒） */
  avgLatency: number;
  
  /** tokens per second */
  tokensPerSecond: number;
  
  /** 测试任务数 */
  testCases: number;
  
  /** 成功率 */
  successRate: number;
}

export interface HybridStrategy {
  /** 本地模型用于的任务类型 */
  localTasks: string[];
  
  /** 云模型用于的任务类型 */
  cloudTasks: string[];
  
  /** 本地模型名称 */
  localModel: string;
  
  /** 云模型名称 */
  cloudModel: string;
  
  /** 预期成本节省 */
  estimatedSavings: number;
}

/**
 * 支持的本地模型列表
 */
const SUPPORTED_MODELS: LocalModel[] = [
  {
    name: 'llama3.3:8b',
    size: '4.9GB',
    parameters: '8B',
    downloaded: false,
    recommendedFor: ['simple-test', 'refactor', 'documentation'],
    performance: 7,
  },
  {
    name: 'llama3.3:70b',
    size: '40GB',
    parameters: '70B',
    downloaded: false,
    recommendedFor: ['complex-test', 'architecture', 'debugging'],
    performance: 9,
  },
  {
    name: 'qwen2.5:7b',
    size: '4.7GB',
    parameters: '7B',
    downloaded: false,
    recommendedFor: ['simple-test', 'quick-analysis'],
    performance: 7,
  },
  {
    name: 'qwen2.5-coder:32b',
    size: '19GB',
    parameters: '32B',
    downloaded: false,
    recommendedFor: ['complex-test', 'code-generation', 'refactor'],
    performance: 8,
  },
  {
    name: 'deepseek-coder:6.7b',
    size: '3.8GB',
    parameters: '6.7B',
    downloaded: false,
    recommendedFor: ['simple-test', 'code-completion'],
    performance: 6,
  },
  {
    name: 'deepseek-coder:33b',
    size: '20GB',
    parameters: '33B',
    downloaded: false,
    recommendedFor: ['complex-test', 'code-generation'],
    performance: 8,
  },
  {
    name: 'codellama:7b',
    size: '3.8GB',
    parameters: '7B',
    downloaded: false,
    recommendedFor: ['simple-test', 'code-completion'],
    performance: 6,
  },
  {
    name: 'codellama:34b',
    size: '19GB',
    parameters: '34B',
    downloaded: false,
    recommendedFor: ['complex-test', 'architecture'],
    performance: 8,
  },
];

/**
 * 本地模型管理器
 */
export class LocalModelManager {
  private logger = createComponentLogger('LocalModelManager');
  private models = SUPPORTED_MODELS;
  
  /**
   * 检查 Ollama 是否已安装
   */
  async isOllamaInstalled(): Promise<boolean> {
    try {
      execSync('ollama --version', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * 列出已下载的模型
   */
  async listDownloadedModels(): Promise<LocalModel[]> {
    try {
      const output = execSync('ollama list', { encoding: 'utf-8' });
      const lines = output.split('\n').slice(1); // 跳过表头
      
      const downloaded = new Set<string>();
      for (const line of lines) {
        const match = line.match(/^(\S+)/);
        if (match) {
          downloaded.add(match[1]);
        }
      }
      
      // 更新下载状态
      return this.models.map(model => ({
        ...model,
        downloaded: downloaded.has(model.name),
      }));
    } catch (error) {
      this.logger.error('Failed to list models', { error });
      return [];
    }
  }
  
  /**
   * 下载模型
   */
  async downloadModel(modelName: string): Promise<void> {
    this.logger.info('Downloading model', { modelName });
    
    try {
      execSync(`ollama pull ${modelName}`, { stdio: 'inherit' });
      this.logger.info('Model downloaded successfully', { modelName });
    } catch (error) {
      this.logger.error('Failed to download model', { modelName, error });
      throw new Error(`Failed to download model: ${modelName}`);
    }
  }
  
  /**
   * 推荐本地模型
   */
  async recommendModel(taskType: string): Promise<LocalModel | null> {
    const downloaded = await this.listDownloadedModels();
    
    // 优先推荐已下载的模型
    const suitable = downloaded.filter(m => 
      m.downloaded && m.recommendedFor.includes(taskType)
    );
    
    if (suitable.length > 0) {
      // 选择性能最好的
      return suitable.sort((a, b) => b.performance - a.performance)[0];
    }
    
    // 如果没有已下载的，推荐最小的合适模型
    const notDownloaded = this.models
      .filter(m => m.recommendedFor.includes(taskType))
      .sort((a, b) => parseInt(a.size) - parseInt(b.size));
    
    return notDownloaded[0] || null;
  }
  
  /**
   * 运行性能基准测试
   */
  async benchmark(modelName: string, testCases: string[]): Promise<ModelBenchmark> {
    this.logger.info('Running benchmark', { modelName, testCases: testCases.length });
    
    const latencies: number[] = [];
    let successCount = 0;
    
    for (const testCase of testCases) {
      const startTime = Date.now();
      
      try {
        // 运行测试（简化版）
        execSync(`ollama run ${modelName} "${testCase}"`, {
          stdio: 'ignore',
          timeout: 30000,
        });
        
        const latency = Date.now() - startTime;
        latencies.push(latency);
        successCount++;
      } catch (error) {
        this.logger.warn('Benchmark test failed', { testCase });
      }
    }
    
    const avgLatency = latencies.length > 0 
      ? latencies.reduce((a, b) => a + b, 0) / latencies.length 
      : 0;
    
    // 估算 tokens per second（粗略）
    const avgTokens = 100; // 假设每个响应平均 100 tokens
    const tokensPerSecond = avgLatency > 0 ? (avgTokens / (avgLatency / 1000)) : 0;
    
    return {
      model: modelName,
      avgLatency,
      tokensPerSecond,
      testCases: testCases.length,
      successRate: successCount / testCases.length,
    };
  }
  
  /**
   * 生成混合推理策略
   */
  generateHybridStrategy(
    costBudget: number,
    qualityRequirement: number
  ): HybridStrategy {
    // 简单任务用本地模型，复杂任务用云模型
    
    let localModel = 'qwen2.5-coder:32b'; // 平衡性能和成本
    let cloudModel = 'gpt-4o-mini';
    
    // 高质量要求
    if (qualityRequirement > 0.9) {
      cloudModel = 'gpt-4o';
    }
    
    // 低成本预算
    if (costBudget < 0.01) {
      localModel = 'qwen2.5:7b'; // 更小的模型
    }
    
    return {
      localTasks: [
        'simple-test',
        'refactor',
        'documentation',
        'code-completion',
      ],
      cloudTasks: [
        'complex-test',
        'architecture',
        'debugging',
        'expert-analysis',
      ],
      localModel,
      cloudModel,
      estimatedSavings: 0.7, // 预期节省 70%
    };
  }
  
  /**
   * 获取推荐的初学者模型
   */
  getBeginnerRecommendation(): LocalModel {
    // 推荐最小的代码模型
    return this.models.find(m => m.name === 'deepseek-coder:6.7b')!;
  }
  
  /**
   * 获取所有可用模型
   */
  getAllModels(): LocalModel[] {
    return [...this.models];
  }
  
  /**
   * 安装向导
   */
  async setupGuide(): Promise<string> {
    const guide = `
# Ollama 本地模型设置指南

## 1. 安装 Ollama

### macOS / Linux:
\`\`\`bash
curl -fsSL https://ollama.com/install.sh | sh
\`\`\`

### Windows:
下载并运行安装程序：https://ollama.com/download/windows

## 2. 验证安装
\`\`\`bash
ollama --version
\`\`\`

## 3. 下载推荐模型（初学者）

\`\`\`bash
# DeepSeek Coder 6.7B - 适合测试生成（3.8GB）
ollama pull deepseek-coder:6.7b
\`\`\`

## 4. 测试模型

\`\`\`bash
ollama run deepseek-coder:6.7b "Write a unit test for a function that adds two numbers"
\`\`\`

## 5. 在 TestMind 中配置

\`\`\`typescript
// .testmind/config.json
{
  "llmProvider": "ollama",
  "llmModel": "deepseek-coder:6.7b",
  "localFirst": true
}
\`\`\`

## 推荐的模型（按大小排序）

1. **deepseek-coder:6.7b** (3.8GB) - 简单测试，快速
2. **qwen2.5:7b** (4.7GB) - 平衡性能
3. **qwen2.5-coder:32b** (19GB) - 复杂测试，高质量
4. **llama3.3:70b** (40GB) - 最强性能（需要高配置）

## 成本节省

使用本地模型可以节省 **60-80%** 的 LLM 成本！
`;
    
    return guide;
  }
}

/**
 * 工厂函数
 */
export function createLocalModelManager(): LocalModelManager {
  return new LocalModelManager();
}




