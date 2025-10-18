/**
 * FileCache: Centralized file reading and caching utility
 * 
 * Eliminates DRY violations across the codebase where file reading
 * is duplicated in StaticAnalyzer, ContextEngine, and other components.
 * 
 * Benefits (4.md Economic Analysis):
 * - Single source of truth for file operations
 * - Consistent error handling
 * - Performance optimization through caching
 * - Reduced maintenance cost (1 place to update vs 3+)
 * 
 * ROI Analysis:
 * - Current cost: 3 places × 10min/change × 5 changes/year = 2.5 hours/year
 * - Refactored cost: 1 place × 10min/change × 5 changes/year = 50 min/year
 * - Annual savings: 1.5 hours
 * - Implementation time: 2 hours (pays for itself in first year)
 */

import { promises as fs } from 'fs';
import { hashString } from '@testmind/shared';

export interface CacheEntry {
  content: string;
  hash: string;
  timestamp: number;
  size: number;
}

export interface FileCacheOptions {
  /** Enable caching (default: true) */
  enableCache?: boolean;
  
  /** Maximum cache size in number of files (default: 100) */
  maxCacheSize?: number;
  
  /** Cache TTL in milliseconds (default: 5 minutes) */
  cacheTTL?: number;
}

export class FileCache {
  private cache: Map<string, CacheEntry> = new Map();
  private options: Required<FileCacheOptions>;

  constructor(options: FileCacheOptions = {}) {
    this.options = {
      enableCache: options.enableCache ?? true,
      maxCacheSize: options.maxCacheSize ?? 100,
      cacheTTL: options.cacheTTL ?? 5 * 60 * 1000, // 5 minutes
    };
  }

  /**
   * Read file content with caching support
   */
  async readFile(filePath: string): Promise<string> {
    // Check cache first
    if (this.options.enableCache) {
      const cached = this.cache.get(filePath);
      if (cached && !this.isExpired(cached)) {
        return cached.content;
      }
    }

    // Read file from disk
    const content = await fs.readFile(filePath, 'utf-8');
    
    // Update cache
    if (this.options.enableCache) {
      this.set(filePath, content);
    }

    return content;
  }

  /**
   * Read file and return both content and hash
   */
  async readFileWithHash(filePath: string): Promise<{ content: string; hash: string }> {
    const content = await this.readFile(filePath);
    const hash = hashString(content);
    return { content, hash };
  }

  /**
   * Check if file exists
   */
  async exists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get file stats
   */
  async stat(filePath: string) {
    return fs.stat(filePath);
  }

  /**
   * Invalidate cache entry for a specific file
   */
  invalidate(filePath: string): void {
    this.cache.delete(filePath);
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const now = Date.now();
    const entries = Array.from(this.cache.entries());
    const expired = entries.filter(([_, entry]) => this.isExpired(entry)).length;
    const totalSize = entries.reduce((sum, [_, entry]) => sum + entry.size, 0);

    return {
      totalEntries: this.cache.size,
      expiredEntries: expired,
      totalSizeBytes: totalSize,
      cacheEnabled: this.options.enableCache,
      maxCacheSize: this.options.maxCacheSize,
      cacheTTL: this.options.cacheTTL,
    };
  }

  /**
   * Set cache entry (internal)
   */
  private set(filePath: string, content: string): void {
    // Evict oldest entries if cache is full
    if (this.cache.size >= this.options.maxCacheSize) {
      this.evictOldest();
    }

    const entry: CacheEntry = {
      content,
      hash: hashString(content),
      timestamp: Date.now(),
      size: Buffer.byteLength(content, 'utf-8'),
    };

    this.cache.set(filePath, entry);
  }

  /**
   * Check if cache entry is expired
   */
  private isExpired(entry: CacheEntry): boolean {
    const now = Date.now();
    return now - entry.timestamp > this.options.cacheTTL;
  }

  /**
   * Evict oldest cache entry (LRU)
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }
}

/**
 * Singleton instance for global file cache
 */
let globalFileCache: FileCache | null = null;

export function getGlobalFileCache(options?: FileCacheOptions): FileCache {
  if (!globalFileCache) {
    globalFileCache = new FileCache(options);
  }
  return globalFileCache;
}

export function resetGlobalFileCache(): void {
  globalFileCache = null;
}





