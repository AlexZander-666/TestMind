/**
 * ParallelProcessor 单元测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ParallelProcessor } from '../ParallelProcessor';

describe('ParallelProcessor', () => {
  let processor: ParallelProcessor;

  beforeEach(() => {
    processor = new ParallelProcessor(4); // 固定并发数用于测试
  });

  describe('map', () => {
    it('should process all items in parallel', async () => {
      const items = [1, 2, 3, 4, 5];
      const results = await processor.map(items, async (item) => item * 2);

      expect(results).toEqual([2, 4, 6, 8, 10]);
    });

    it('should maintain original order', async () => {
      const items = [1, 2, 3, 4, 5];
      const results = await processor.map(items, async (item) => {
        // 模拟不同处理时间
        await sleep(Math.random() * 10);
        return item * 2;
      });

      expect(results).toEqual([2, 4, 6, 8, 10]);
    });

    it('should handle async operations', async () => {
      const items = ['a', 'b', 'c'];
      const results = await processor.map(items, async (item) => {
        await sleep(5);
        return item.toUpperCase();
      });

      expect(results).toEqual(['A', 'B', 'C']);
    });

    it('should call progress callback', async () => {
      const items = [1, 2, 3, 4, 5];
      const progressUpdates: number[] = [];

      await processor.map(
        items,
        async (item) => item * 2,
        {
          onProgress: (completed, total) => {
            progressUpdates.push(completed);
          },
        }
      );

      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates[progressUpdates.length - 1]).toBe(5);
    });
  });

  describe('process', () => {
    it('should process tasks with custom processor', async () => {
      const tasks = [
        { id: 'task-1', input: 10 },
        { id: 'task-2', input: 20 },
        { id: 'task-3', input: 30 },
      ];

      const results = await processor.process(
        tasks,
        async (input) => input * 2
      );

      expect(results).toHaveLength(3);
      expect(results[0].result).toBe(20);
      expect(results[1].result).toBe(40);
      expect(results[2].result).toBe(60);
    });

    it('should handle errors with retry', async () => {
      let attemptCount = 0;
      
      const tasks = [
        { id: 'task-1', input: 'success' },
        { id: 'task-2', input: 'fail-once' },
      ];

      const results = await processor.process(
        tasks,
        async (input) => {
          if (input === 'fail-once' && attemptCount === 0) {
            attemptCount++;
            throw new Error('First attempt failed');
          }
          return input.toUpperCase();
        },
        {
          retryOnError: true,
          maxRetries: 2,
        }
      );

      expect(results).toHaveLength(2);
      expect(results[0].result).toBe('SUCCESS');
      expect(results[1].result).toBe('FAIL-ONCE'); // 应该重试成功
    });

    it('should return error after max retries', async () => {
      const tasks = [
        { id: 'task-1', input: 'always-fail' },
      ];

      const results = await processor.process(
        tasks,
        async (input) => {
          throw new Error('Always fails');
        },
        {
          retryOnError: true,
          maxRetries: 2,
        }
      );

      expect(results).toHaveLength(1);
      expect(results[0].error).toBeDefined();
      expect(results[0].error?.message).toBe('Always fails');
    });

    it('should respect max concurrency', async () => {
      let currentlyRunning = 0;
      let maxConcurrent = 0;

      const tasks = Array.from({ length: 10 }, (_, i) => ({
        id: `task-${i}`,
        input: i,
      }));

      await processor.process(
        tasks,
        async (input) => {
          currentlyRunning++;
          maxConcurrent = Math.max(maxConcurrent, currentlyRunning);
          await sleep(10);
          currentlyRunning--;
          return input * 2;
        }
      );

      // 最大并发应该不超过设定值（4）
      expect(maxConcurrent).toBeLessThanOrEqual(4);
      expect(maxConcurrent).toBeGreaterThan(0);
    });
  });

  describe('processBatches', () => {
    it('should process large task list in batches', async () => {
      const tasks = Array.from({ length: 250 }, (_, i) => ({
        id: `task-${i}`,
        input: i,
      }));

      const results = await processor.processBatches(
        tasks,
        async (input) => input * 2,
        100 // 批大小
      );

      expect(results).toHaveLength(250);
      expect(results[0].result).toBe(0);
      expect(results[249].result).toBe(498);
    });
  });

  describe('getOptimalBatchSize', () => {
    it('should return appropriate batch size for different task counts', () => {
      const smallBatch = processor.getOptimalBatchSize(5);
      const mediumBatch = processor.getOptimalBatchSize(50);
      const largeBatch = processor.getOptimalBatchSize(500);

      expect(smallBatch).toBeLessThanOrEqual(10);
      expect(mediumBatch).toBeGreaterThan(smallBatch);
      expect(largeBatch).toBeGreaterThan(mediumBatch);
    });
  });

  describe('getRecommendedConcurrency', () => {
    it('should return different values for different task types', () => {
      const cpuBound = ParallelProcessor.getRecommendedConcurrency('cpu-bound');
      const ioBound = ParallelProcessor.getRecommendedConcurrency('io-bound');
      const mixed = ParallelProcessor.getRecommendedConcurrency('mixed');

      // IO-bound 应该允许更高并发
      expect(ioBound).toBeGreaterThan(cpuBound);
      expect(mixed).toBeGreaterThan(cpuBound);
      expect(mixed).toBeLessThan(ioBound);
    });
  });
});

// 辅助函数
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
























