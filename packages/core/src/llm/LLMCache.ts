/**
 * LLMCache - LLM响应缓存
 * 
 * 通过缓存常见请求减少API调用和提高性能
 * 
 * Features:
 * - SHA256-based cache keys
 * - 7-day TTL (configurable)
 * - Max 1000 entries (LRU eviction)
 * - Hit rate monitoring
 * - Optional disk persistence
 */

import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import { metrics, MetricNames } from '../utils/metrics';

export interface CacheEntry {
  prompt: string;
  response: string;
  timestamp: number;
  provider: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  accessCount?: number; // Track frequency for adaptive TTL
  lastAccessTime?: number;
}

export interface CacheStats {
  size: number;
  hits: number;
  misses: number;
  hitRate: number;
  totalSaved: number; // 节省的API调用次数
}

export interface LLMCacheConfig {
  /** 最大缓存条目数 */
  maxSize?: number;
  
  /** 缓存过期时间（毫秒） */
  maxAge?: number;
  
  /** 是否启用磁盘持久化 */
  enablePersistence?: boolean;
  
  /** 持久化文件路径 */
  persistencePath?: string;
  
  /** 是否启用相似度匹配 */
  enableSimilarityMatch?: boolean;
  
  /** 相似度阈值 (0-1) */
  similarityThreshold?: number;
  
  /** 是否启用自适应TTL */
  enableAdaptiveTTL?: boolean;
}

/**
 * LLM响应缓存
 */
export class LLMCache {
  private cache: Map<string, CacheEntry> = new Map();
  private accessOrder: string[] = []; // LRU tracking
  private hits: number = 0;
  private misses: number = 0;
  private similarityHits: number = 0; // Hits from similarity matching
  
  private config: Required<Omit<LLMCacheConfig, 'persistencePath'>>;
  private persistencePath?: string;

  constructor(config: LLMCacheConfig = {}) {
    this.config = {
      maxSize: config.maxSize ?? 1000,
      maxAge: config.maxAge ?? 7 * 24 * 60 * 60 * 1000, // 7天
      enablePersistence: config.enablePersistence ?? false,
      enableSimilarityMatch: config.enableSimilarityMatch ?? true,
      similarityThreshold: config.similarityThreshold ?? 0.85,
      enableAdaptiveTTL: config.enableAdaptiveTTL ?? true,
    };
    
    this.persistencePath = config.persistencePath;

    // 如果启用持久化，尝试加载
    if (this.config.enablePersistence) {
      this.loadFromDisk().catch(err => {
        console.warn('Failed to load cache from disk:', err);
      });
    }
  }

  /**
   * 生成缓存键（SHA256哈希）
   */
  private generateKey(prompt: string, provider: string, model: string): string {
    const hash = crypto
      .createHash('sha256')
      .update(`${provider}:${model}:${prompt}`)
      .digest('hex');
    return hash.substring(0, 32); // 使用前32个字符
  }

  /**
   * 获取缓存
   */
  get(prompt: string, provider: string, model: string): string | null {
    const key = this.generateKey(prompt, provider, model);
    let entry = this.cache.get(key);

    // Exact match found
    if (entry) {
      // 检查是否过期（使用自适应TTL）
      const maxAge = this.calculateAdaptiveTTL(entry);
      const age = Date.now() - entry.timestamp;
      
      if (age > maxAge) {
        this.cache.delete(key);
        this.removeFromAccessOrder(key);
        this.misses++;
        metrics.incrementCounter(MetricNames.LLM_CALL_COUNT, 1, { 
          cached: false,
          expired: true,
          provider,
          model 
        });
        return null;
      }

      // Update access tracking
      entry.accessCount = (entry.accessCount || 0) + 1;
      entry.lastAccessTime = Date.now();
      this.updateAccessOrder(key);

      this.hits++;
      metrics.incrementCounter(MetricNames.LLM_CALL_COUNT, 1, { 
        cached: true,
        exactMatch: true,
        provider,
        model
      });

      return entry.response;
    }

    // Try similarity matching if enabled
    if (this.config.enableSimilarityMatch) {
      const similarEntry = this.findSimilarEntry(prompt, provider, model);
      
      if (similarEntry) {
        // Update access tracking
        similarEntry.entry.accessCount = (similarEntry.entry.accessCount || 0) + 1;
        similarEntry.entry.lastAccessTime = Date.now();
        this.updateAccessOrder(similarEntry.key);

        this.similarityHits++;
        this.hits++;
        metrics.incrementCounter(MetricNames.LLM_CALL_COUNT, 1, { 
          cached: true,
          similarityMatch: true,
          similarity: similarEntry.similarity,
          provider,
          model
        });

        return similarEntry.entry.response;
      }
    }

    this.misses++;
    metrics.incrementCounter(MetricNames.LLM_CALL_COUNT, 1, { 
      cached: false,
      provider,
      model
    });
    return null;
  }

  /**
   * 设置缓存
   */
  set(
    prompt: string,
    response: string,
    provider: string,
    model: string,
    usage?: CacheEntry['usage']
  ): void {
    const key = this.generateKey(prompt, provider, model);

    // 如果缓存已满，删除最少使用的条目（LRU）
    if (this.cache.size >= this.config.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    const entry: CacheEntry = {
      prompt,
      response,
      timestamp: Date.now(),
      provider,
      model,
      usage,
      accessCount: 1,
      lastAccessTime: Date.now(),
    };

    this.cache.set(key, entry);
    this.updateAccessOrder(key);

    // 异步持久化（不阻塞）
    if (this.config.enablePersistence) {
      this.saveToDisk().catch(err => {
        console.warn('Failed to persist cache:', err);
      });
    }
  }

  /**
   * LRU淘汰
   */
  private evictLRU(): void {
    if (this.accessOrder.length === 0) return;

    const lruKey = this.accessOrder[0];
    this.cache.delete(lruKey);
    this.accessOrder.shift();
  }

  /**
   * 更新访问顺序
   */
  private updateAccessOrder(key: string): void {
    // 移除旧位置
    this.removeFromAccessOrder(key);
    
    // 添加到末尾（最近使用）
    this.accessOrder.push(key);
  }

  /**
   * 从访问顺序中移除
   */
  private removeFromAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index !== -1) {
      this.accessOrder.splice(index, 1);
    }
  }

  /**
   * Find similar cached entry using string similarity
   * Uses Jaccard similarity for token-based matching
   */
  private findSimilarEntry(
    prompt: string,
    provider: string,
    model: string
  ): { key: string; entry: CacheEntry; similarity: number } | null {
    let bestMatch: { key: string; entry: CacheEntry; similarity: number } | null = null;
    let highestSimilarity = 0;

    for (const [key, entry] of this.cache.entries()) {
      // Only compare prompts from same provider and model
      if (entry.provider !== provider || entry.model !== model) {
        continue;
      }

      const similarity = this.calculatePromptSimilarity(prompt, entry.prompt);
      
      if (similarity >= this.config.similarityThreshold && similarity > highestSimilarity) {
        highestSimilarity = similarity;
        bestMatch = { key, entry, similarity };
      }
    }

    return bestMatch;
  }

  /**
   * Calculate similarity between two prompts using Jaccard similarity
   * Returns value between 0 (no similarity) and 1 (identical)
   */
  private calculatePromptSimilarity(prompt1: string, prompt2: string): number {
    // Tokenize prompts (split by whitespace and punctuation)
    const tokenize = (text: string): Set<string> => {
      const tokens = text
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(t => t.length > 2); // Ignore very short tokens
      return new Set(tokens);
    };

    const tokens1 = tokenize(prompt1);
    const tokens2 = tokenize(prompt2);

    // Calculate Jaccard similarity: |intersection| / |union|
    const intersection = new Set([...tokens1].filter(t => tokens2.has(t)));
    const union = new Set([...tokens1, ...tokens2]);

    if (union.size === 0) return 0;
    
    return intersection.size / union.size;
  }

  /**
   * Calculate adaptive TTL based on access frequency
   * High-frequency items get longer TTL, low-frequency get shorter TTL
   */
  private calculateAdaptiveTTL(entry: CacheEntry): number {
    if (!this.config.enableAdaptiveTTL) {
      return this.config.maxAge;
    }

    const accessCount = entry.accessCount || 1;
    const baseAge = this.config.maxAge;

    // Frequency tiers
    if (accessCount >= 10) {
      // High frequency: 2x TTL
      return baseAge * 2;
    } else if (accessCount >= 5) {
      // Medium frequency: 1.5x TTL
      return baseAge * 1.5;
    } else if (accessCount >= 2) {
      // Low frequency: 1x TTL
      return baseAge;
    } else {
      // Very low frequency: 0.5x TTL
      return baseAge * 0.5;
    }
  }

  /**
   * 清除缓存
   */
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    this.accessOrder = [];
    
    console.log(`[LLMCache] Cleared ${size} entries`);
  }

  /**
   * 清除过期条目
   */
  clearExpired(): number {
    const now = Date.now();
    let cleared = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.config.maxAge) {
        this.cache.delete(key);
        this.removeFromAccessOrder(key);
        cleared++;
      }
    }

    if (cleared > 0) {
      console.log(`[LLMCache] Cleared ${cleared} expired entries`);
    }

    return cleared;
  }

  /**
   * 获取缓存统计
   */
  getStats(): CacheStats & { similarityHits?: number; exactHits?: number } {
    const total = this.hits + this.misses;
    const hitRate = total > 0 ? this.hits / total : 0;
    const exactHits = this.hits - this.similarityHits;

    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate,
      totalSaved: this.hits,
      similarityHits: this.similarityHits,
      exactHits,
    };
  }

  /**
   * 重置统计
   */
  resetStats(): void {
    this.hits = 0;
    this.misses = 0;
    this.similarityHits = 0;
  }

  /**
   * 保存到磁盘
   */
  private async saveToDisk(): Promise<void> {
    if (!this.persistencePath) {
      this.persistencePath = path.join(process.cwd(), '.testmind-cache', 'llm-cache.json');
    }

    try {
      await fs.mkdir(path.dirname(this.persistencePath), { recursive: true });
      
      const data = {
        entries: Array.from(this.cache.entries()),
        accessOrder: this.accessOrder,
        stats: {
          hits: this.hits,
          misses: this.misses
        }
      };

      await fs.writeFile(
        this.persistencePath,
        JSON.stringify(data, null, 2),
        'utf-8'
      );
    } catch (error) {
      console.error('[LLMCache] Failed to save to disk:', error);
    }
  }

  /**
   * 从磁盘加载
   */
  private async loadFromDisk(): Promise<void> {
    if (!this.persistencePath) {
      this.persistencePath = path.join(process.cwd(), '.testmind-cache', 'llm-cache.json');
    }

    try {
      const content = await fs.readFile(this.persistencePath, 'utf-8');
      const data = JSON.parse(content);

      this.cache = new Map(data.entries);
      this.accessOrder = data.accessOrder || [];
      this.hits = data.stats?.hits || 0;
      this.misses = data.stats?.misses || 0;

      console.log(`[LLMCache] Loaded ${this.cache.size} entries from disk`);
    } catch (error) {
      // 文件不存在或解析失败，使用空缓存
      console.log('[LLMCache] Starting with empty cache');
    }
  }

  /**
   * 导出缓存数据
   */
  export(): string {
    const data = {
      entries: Array.from(this.cache.entries()),
      accessOrder: this.accessOrder,
      stats: this.getStats()
    };
    return JSON.stringify(data, null, 2);
  }

  /**
   * 导入缓存数据
   */
  import(jsonData: string): number {
    try {
      const data = JSON.parse(jsonData);
      this.cache = new Map(data.entries);
      this.accessOrder = data.accessOrder || [];
      
      return this.cache.size;
    } catch (error) {
      console.error('[LLMCache] Failed to import data:', error);
      return 0;
    }
  }
}

/**
 * 全局LLM缓存实例
 * Enhanced with similarity matching and adaptive TTL
 */
export const llmCache = new LLMCache({
  maxSize: 1000,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7天
  enablePersistence: true,
  enableSimilarityMatch: true, // Enable fuzzy cache matching
  similarityThreshold: 0.85, // 85% similarity required
  enableAdaptiveTTL: true, // High-frequency items get longer TTL
});

