/**
 * ParallelOptimizer - 并行处理优化器
 * 
 * 优化多文件分析和处理的并行性能
 * 
 * 策略：
 * 1. 自适应并发控制（根据 CPU 核心数）
 * 2. 任务批处理
 * 3. Worker 线程池（重型任务）
 * 4. 智能任务调度
 * 
 * 性能目标：
 * - 100 文件分析 < 5s
 * - CPU 利用率 > 80%
 * - 内存使用 < 2GB
 */

import * as os from 'os';
import { createComponentLogger } from './logger';

export interface ParallelOptions {
  /** 最大并发数（默认为 CPU 核心数） */
  maxConcurrency?: number;
  
  /** 批次大小 */
  batchSize?: number;
  
  /** 是否使用 Worker 线程 */
  useWorkers?: boolean;
  
  /** 超时时间（毫秒） */
  timeout?: number;
  
  /** 重试次数 */
  retries?: number;
}

export interface Task<T, R> {
  /** 任务 ID */
  id: string;
  
  /** 任务输入 */
  input: T;
  
  /** 任务函数 */
  fn: (input: T) => Promise<R>;
  
  /** 任务优先级 */
  priority?: number;
}

export interface TaskResult<R> {
  /** 任务 ID */
  id: string;
  
  /** 是否成功 */
  success: boolean;
  
  /** 结果（成功时） */
  result?: R;
  
  /** 错误（失败时） */
  error?: Error;
  
  /** 执行时间（毫秒） */
  duration: number;
}

export interface BatchResult<R> {
  /** 所有结果 */
  results: TaskResult<R>[];
  
  /** 成功数 */
  successCount: number;
  
  /** 失败数 */
  failureCount: number;
  
  /** 总耗时（毫秒） */
  totalDuration: number;
  
  /** 平均耗时（毫秒） */
  avgDuration: number;
}

/**
 * 并行处理优化器
 */
export class ParallelOptimizer {
  private logger = createComponentLogger('ParallelOptimizer');
  private options: Required<ParallelOptions>;
  
  constructor(options: ParallelOptions = {}) {
    const cpuCount = os.cpus().length;
    
    this.options = {
      maxConcurrency: options.maxConcurrency ?? Math.max(cpuCount - 1, 1),
      batchSize: options.batchSize ?? 10,
      useWorkers: options.useWorkers ?? false,
      timeout: options.timeout ?? 30000,
      retries: options.retries ?? 2,
    };
    
    this.logger.info('ParallelOptimizer initialized', {
      cpuCount,
      maxConcurrency: this.options.maxConcurrency,
    });
  }
  
  /**
   * 并行执行任务
   */
  async executeBatch<T, R>(tasks: Task<T, R>[]): Promise<BatchResult<R>> {
    const startTime = Date.now();
    const results: TaskResult<R>[] = [];
    
    // 按优先级排序
    const sortedTasks = [...tasks].sort((a, b) => 
      (b.priority || 0) - (a.priority || 0)
    );
    
    // 分批处理
    const batches = this.chunkArray(sortedTasks, this.options.maxConcurrency);
    
    this.logger.info('Executing batch', {
      totalTasks: tasks.length,
      batches: batches.length,
      concurrency: this.options.maxConcurrency,
    });
    
    for (const batch of batches) {
      // 并行执行当前批次
      const batchResults = await Promise.all(
        batch.map(task => this.executeTask(task))
      );
      
      results.push(...batchResults);
    }
    
    const totalDuration = Date.now() - startTime;
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;
    const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
    
    this.logger.info('Batch execution completed', {
      total: tasks.length,
      success: successCount,
      failure: failureCount,
      duration: totalDuration,
      avgDuration,
    });
    
    return {
      results,
      successCount,
      failureCount,
      totalDuration,
      avgDuration,
    };
  }
  
  /**
   * 执行单个任务（带重试）
   */
  private async executeTask<T, R>(task: Task<T, R>): Promise<TaskResult<R>> {
    const startTime = Date.now();
    let lastError: Error | undefined;
    
    for (let attempt = 0; attempt <= this.options.retries; attempt++) {
      try {
        const result = await this.executeWithTimeout(
          () => task.fn(task.input),
          this.options.timeout
        );
        
        const duration = Date.now() - startTime;
        
        return {
          id: task.id,
          success: true,
          result,
          duration,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt < this.options.retries) {
          this.logger.warn('Task failed, retrying', {
            id: task.id,
            attempt: attempt + 1,
            error: lastError.message,
          });
        }
      }
    }
    
    const duration = Date.now() - startTime;
    
    return {
      id: task.id,
      success: false,
      error: lastError,
      duration,
    };
  }
  
  /**
   * 带超时的执行
   */
  private async executeWithTimeout<R>(
    fn: () => Promise<R>,
    timeout: number
  ): Promise<R> {
    return Promise.race([
      fn(),
      new Promise<R>((_, reject) =>
        setTimeout(() => reject(new Error('Task timeout')), timeout)
      ),
    ]);
  }
  
  /**
   * 数组分块
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    
    return chunks;
  }
  
  /**
   * 自适应并发控制
   * 
   * 根据系统负载动态调整并发数
   */
  getOptimalConcurrency(): number {
    const cpuCount = os.cpus().length;
    const freeMemory = os.freemem();
    const totalMemory = os.totalmem();
    const memoryUsage = 1 - (freeMemory / totalMemory);
    
    let concurrency = cpuCount - 1;
    
    // 内存压力大时，减少并发
    if (memoryUsage > 0.8) {
      concurrency = Math.max(Math.floor(concurrency * 0.5), 1);
      this.logger.warn('High memory usage, reducing concurrency', {
        memoryUsage: (memoryUsage * 100).toFixed(1) + '%',
        concurrency,
      });
    }
    
    return concurrency;
  }
  
  /**
   * 估算批处理时间
   */
  estimateDuration(
    taskCount: number,
    avgTaskDuration: number
  ): {
    sequential: number;
    parallel: number;
    speedup: number;
  } {
    const sequential = taskCount * avgTaskDuration;
    const batches = Math.ceil(taskCount / this.options.maxConcurrency);
    const parallel = batches * avgTaskDuration;
    const speedup = sequential / parallel;
    
    return {
      sequential,
      parallel,
      speedup,
    };
  }
}

/**
 * 工厂函数
 */
export function createParallelOptimizer(options?: ParallelOptions): ParallelOptimizer {
  return new ParallelOptimizer(options);
}

