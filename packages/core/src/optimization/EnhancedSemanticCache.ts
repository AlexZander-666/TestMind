/**
 * EnhancedSemanticCache - 三层缓存策略
 * 
 * 功能：
 * - L1: 内存缓存（LRU，最热数据，<1ms）
 * - L2: 磁盘缓存（SQLite，持久化，<50ms）
 * - L3: 团队共享缓存（可选，<200ms）
 * - 缓存命中率目标：60%+
 */

import { createComponentLogger } from '../utils/logger';
import { LRUCache } from 'lru-cache';
import * as fs from 'fs-extra';
import * as path from 'path';

export interface CacheEntry {
  key: string;
  value: string;
  embedding?: number[];
  timestamp: number;
  hits: number;
  ttl?: number;
}

export interface CacheStats {
  l1Hits: number;
  l2Hits: number;
  l3Hits: number;
  misses: number;
  hitRate: number;
  avgResponseTime: number;
}

export class EnhancedSemanticCache {
  private l1Cache: LRUCache<string, CacheEntry>;
  private l2CachePath: string;
  private l3Enabled: boolean;
  private logger = createComponentLogger('EnhancedSemanticCache');
  
  private stats: CacheStats = {
    l1Hits: 0,
    l2Hits: 0,
    l3Hits: 0,
    misses: 0,
    hitRate: 0,
    avgResponseTime: 0,
  };

  constructor(options: {
    l1MaxSize?: number;
    l2CachePath?: string;
    l3Enabled?: boolean;
  } = {}) {
    const {
      l1MaxSize = 100,
      l2CachePath = path.join(process.cwd(), '.testmind', 'cache'),
      l3Enabled = false,
    } = options;

    // L1: 内存缓存
    this.l1Cache = new LRUCache({
      max: l1MaxSize,
      ttl: 1000 * 60 * 60, // 1小时
    });

    // L2: 磁盘缓存
    this.l2CachePath = l2CachePath;
    fs.ensureDirSync(this.l2CachePath);

    // L3: 团队共享缓存
    this.l3Enabled = l3Enabled;

    this.logger.debug('EnhancedSemanticCache initialized', {
      l1MaxSize,
      l2CachePath,
      l3Enabled,
    });
  }

  /**
   * 获取缓存（三层查找）
   */
  async get(prompt: string, similarityThreshold = 0.85): Promise<string | null> {
    const startTime = Date.now();
    const key = this.generateKey(prompt);

    // L1: 内存查询（<1ms）
    const l1Result = this.l1Cache.get(key);
    if (l1Result) {
      this.stats.l1Hits++;
      this.updateStats(Date.now() - startTime);
      this.logger.debug('L1 cache hit', { key: key.substring(0, 20) });
      return l1Result.value;
    }

    // L2: 语义相似度查询（<50ms）
    const l2Result = await this.searchL2Similar(prompt, similarityThreshold);
    if (l2Result) {
      this.stats.l2Hits++;
      // 回填 L1
      this.l1Cache.set(key, l2Result);
      this.updateStats(Date.now() - startTime);
      this.logger.debug('L2 cache hit', { key: key.substring(0, 20) });
      return l2Result.value;
    }

    // L3: 团队共享查询（可选，<200ms）
    if (this.l3Enabled) {
      const l3Result = await this.searchL3(prompt);
      if (l3Result) {
        this.stats.l3Hits++;
        // 回填 L1 和 L2
        this.l1Cache.set(key, l3Result);
        await this.setL2(key, l3Result);
        this.updateStats(Date.now() - startTime);
        this.logger.debug('L3 cache hit', { key: key.substring(0, 20) });
        return l3Result.value;
      }
    }

    this.stats.misses++;
    this.updateStats(Date.now() - startTime);
    this.logger.debug('Cache miss', { key: key.substring(0, 20) });
    return null;
  }

  /**
   * 设置缓存（三层写入）
   */
  async set(prompt: string, value: string, ttl?: number): Promise<void> {
    const key = this.generateKey(prompt);
    const entry: CacheEntry = {
      key,
      value,
      timestamp: Date.now(),
      hits: 0,
      ttl,
    };

    // 写入 L1
    this.l1Cache.set(key, entry);

    // 写入 L2
    await this.setL2(key, entry);

    // 写入 L3（如果启用）
    if (this.l3Enabled) {
      await this.setL3(key, entry);
    }

    this.logger.debug('Cache set', { key: key.substring(0, 20) });
  }

  /**
   * L2: 搜索相似缓存
   */
  private async searchL2Similar(prompt: string, threshold: number): Promise<CacheEntry | null> {
    // 简化实现：读取所有 L2 缓存文件并比较
    const cacheFiles = await fs.readdir(this.l2CachePath);
    
    for (const file of cacheFiles) {
      if (!file.endsWith('.json')) continue;

      const filePath = path.join(this.l2CachePath, file);
      const entry: CacheEntry = await fs.readJSON(filePath);

      // 计算相似度（简化：使用 Jaccard 相似度）
      const similarity = this.calculateSimilarity(prompt, entry.key);
      
      if (similarity >= threshold) {
        // 检查 TTL
        if (entry.ttl && Date.now() - entry.timestamp > entry.ttl) {
          await fs.remove(filePath);
          continue;
        }

        entry.hits++;
        await fs.writeJSON(filePath, entry);
        return entry;
      }
    }

    return null;
  }

  /**
   * L2: 写入磁盘缓存
   */
  private async setL2(key: string, entry: CacheEntry): Promise<void> {
    const filePath = path.join(this.l2CachePath, `${key}.json`);
    await fs.writeJSON(filePath, entry);
  }

  /**
   * L3: 搜索团队共享缓存（模拟）
   */
  private async searchL3(prompt: string): Promise<CacheEntry | null> {
    // 实际实现应该连接到共享服务器或数据库
    // 这里只是占位符
    return null;
  }

  /**
   * L3: 写入团队共享缓存（模拟）
   */
  private async setL3(key: string, entry: CacheEntry): Promise<void> {
    // 实际实现应该连接到共享服务器或数据库
    // 这里只是占位符
  }

  /**
   * 生成缓存键
   */
  private generateKey(prompt: string): string {
    // 简化的哈希函数
    let hash = 0;
    for (let i = 0; i < prompt.length; i++) {
      const char = prompt.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * 计算相似度（Jaccard 相似度）
   */
  private calculateSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));

    const intersection = new Set([...words1].filter(w => words2.has(w)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }

  /**
   * 更新统计信息
   */
  private updateStats(responseTime: number): void {
    const totalRequests = this.stats.l1Hits + this.stats.l2Hits + this.stats.l3Hits + this.stats.misses;
    const hits = this.stats.l1Hits + this.stats.l2Hits + this.stats.l3Hits;
    
    this.stats.hitRate = totalRequests > 0 ? hits / totalRequests : 0;
    this.stats.avgResponseTime = (this.stats.avgResponseTime * (totalRequests - 1) + responseTime) / totalRequests;
  }

  /**
   * 获取统计信息
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * 清空缓存
   */
  async clear(): Promise<void> {
    this.l1Cache.clear();
    await fs.emptyDir(this.l2CachePath);
    this.stats = {
      l1Hits: 0,
      l2Hits: 0,
      l3Hits: 0,
      misses: 0,
      hitRate: 0,
      avgResponseTime: 0,
    };
    this.logger.info('Cache cleared');
  }
}

