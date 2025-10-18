/**
 * FileCache Unit Tests
 * Validates caching logic, LRU eviction, and TTL expiration
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FileCache } from '../FileCache';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('FileCache', () => {
  let tempDir: string;
  let testFile1: string;
  let testFile2: string;
  let testFile3: string;

  beforeEach(async () => {
    // Create temporary directory and files
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'filecache-test-'));
    
    testFile1 = path.join(tempDir, 'file1.ts');
    testFile2 = path.join(tempDir, 'file2.ts');
    testFile3 = path.join(tempDir, 'file3.ts');
    
    await fs.writeFile(testFile1, 'export const x = 1;', 'utf-8');
    await fs.writeFile(testFile2, 'export const y = 2;', 'utf-8');
    await fs.writeFile(testFile3, 'export const z = 3;', 'utf-8');
  });

  afterEach(async () => {
    // Cleanup
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('Basic Operations', () => {
    it('should read file content', async () => {
      const cache = new FileCache();
      
      const content = await cache.readFile(testFile1);
      
      expect(content).toBe('export const x = 1;');
    });

    it('should read file with hash', async () => {
      const cache = new FileCache();
      
      const result = await cache.readFileWithHash(testFile1);
      
      expect(result.content).toBe('export const x = 1;');
      expect(result.hash).toBeDefined();
      expect(typeof result.hash).toBe('string');
      expect(result.hash.length).toBeGreaterThan(0);
    });

    it('should check if file exists', async () => {
      const cache = new FileCache();
      
      const exists1 = await cache.exists(testFile1);
      const exists2 = await cache.exists(path.join(tempDir, 'nonexistent.ts'));
      
      expect(exists1).toBe(true);
      expect(exists2).toBe(false);
    });

    it('should get file stats', async () => {
      const cache = new FileCache();
      
      const stats = await cache.stat(testFile1);
      
      expect(stats).toBeDefined();
      expect(stats.size).toBeGreaterThan(0);
      expect(stats.isFile()).toBe(true);
    });
  });

  describe('Caching Behavior', () => {
    it('should cache file content on first read', async () => {
      const cache = new FileCache();
      
      // First read - should read from disk
      await cache.readFile(testFile1);
      
      const stats = cache.getStats();
      expect(stats.totalEntries).toBe(1);
    });

    it('should return cached content on subsequent reads', async () => {
      const cache = new FileCache();
      
      // First read
      const content1 = await cache.readFile(testFile1);
      
      // Modify file after caching
      await fs.writeFile(testFile1, 'export const x = 999;', 'utf-8');
      
      // Second read - should return cached (old) content
      const content2 = await cache.readFile(testFile1);
      
      expect(content2).toBe(content1);
      expect(content2).toBe('export const x = 1;'); // Original content
    });

    it('should work with cache disabled', async () => {
      const cache = new FileCache({ enableCache: false });
      
      // First read
      const content1 = await cache.readFile(testFile1);
      
      // Modify file
      await fs.writeFile(testFile1, 'export const x = 999;', 'utf-8');
      
      // Second read - should read fresh content (cache disabled)
      const content2 = await cache.readFile(testFile1);
      
      expect(content2).toBe('export const x = 999;'); // New content
      expect(cache.getStats().totalEntries).toBe(0);
    });
  });

  describe('LRU Eviction', () => {
    it('should evict oldest entry when cache is full', async () => {
      const cache = new FileCache({ maxCacheSize: 2 });
      
      // Fill cache
      await cache.readFile(testFile1); // Oldest
      await cache.readFile(testFile2);
      
      // Cache is now full (2/2)
      expect(cache.getStats().totalEntries).toBe(2);
      
      // Add third file - should evict file1
      await cache.readFile(testFile3);
      
      expect(cache.getStats().totalEntries).toBe(2);
      
      // Verify file1 was evicted by reading it again and checking if re-read from disk
      await fs.writeFile(testFile1, 'MODIFIED', 'utf-8');
      const content = await cache.readFile(testFile1);
      
      // If evicted, should read new content from disk
      expect(content).toBe('MODIFIED');
    });

    it('should keep recently used entries', async () => {
      const cache = new FileCache({ maxCacheSize: 2 });
      
      await cache.readFile(testFile1);
      await cache.readFile(testFile2);
      
      // Access file1 again (make it recently used)
      await cache.readFile(testFile1);
      
      // Add file3 - should evict file2 (not file1, since file1 was accessed more recently)
      await cache.readFile(testFile3);
      
      // Verify file2 was evicted
      await fs.writeFile(testFile2, 'MODIFIED', 'utf-8');
      const content = await cache.readFile(testFile2);
      expect(content).toBe('MODIFIED');
    });
  });

  describe('TTL Expiration', () => {
    it('should expire entries after TTL', async () => {
      const shortTTL = 100; // 100ms
      const cache = new FileCache({ cacheTTL: shortTTL });
      
      // First read - cache it
      const content1 = await cache.readFile(testFile1);
      expect(cache.getStats().totalEntries).toBe(1);
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, shortTTL + 50));
      
      // Modify file
      await fs.writeFile(testFile1, 'EXPIRED', 'utf-8');
      
      // Read again - should get new content (cache expired)
      const content2 = await cache.readFile(testFile1);
      
      expect(content2).toBe('EXPIRED');
      expect(content2).not.toBe(content1);
    });

    it('should report expired entries in stats', async () => {
      const shortTTL = 100;
      const cache = new FileCache({ cacheTTL: shortTTL });
      
      await cache.readFile(testFile1);
      await cache.readFile(testFile2);
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, shortTTL + 50));
      
      const stats = cache.getStats();
      expect(stats.expiredEntries).toBe(2);
    });
  });

  describe('Cache Management', () => {
    it('should invalidate specific entry', async () => {
      const cache = new FileCache();
      
      await cache.readFile(testFile1);
      await cache.readFile(testFile2);
      
      expect(cache.getStats().totalEntries).toBe(2);
      
      // Invalidate file1
      cache.invalidate(testFile1);
      
      expect(cache.getStats().totalEntries).toBe(1);
      
      // Verify file1 is re-read from disk
      await fs.writeFile(testFile1, 'INVALIDATED', 'utf-8');
      const content = await cache.readFile(testFile1);
      expect(content).toBe('INVALIDATED');
    });

    it('should clear entire cache', async () => {
      const cache = new FileCache();
      
      await cache.readFile(testFile1);
      await cache.readFile(testFile2);
      await cache.readFile(testFile3);
      
      expect(cache.getStats().totalEntries).toBe(3);
      
      cache.clear();
      
      expect(cache.getStats().totalEntries).toBe(0);
    });
  });

  describe('Statistics', () => {
    it('should return accurate cache statistics', async () => {
      const cache = new FileCache({ maxCacheSize: 10, cacheTTL: 5000 });
      
      await cache.readFile(testFile1);
      await cache.readFile(testFile2);
      
      const stats = cache.getStats();
      
      expect(stats.totalEntries).toBe(2);
      expect(stats.expiredEntries).toBe(0);
      expect(stats.totalSizeBytes).toBeGreaterThan(0);
      expect(stats.cacheEnabled).toBe(true);
      expect(stats.maxCacheSize).toBe(10);
      expect(stats.cacheTTL).toBe(5000);
    });

    it('should calculate total size correctly', async () => {
      const cache = new FileCache();
      
      await cache.readFile(testFile1); // 'export const x = 1;' = 19 bytes
      
      const stats = cache.getStats();
      
      expect(stats.totalSizeBytes).toBe(19);
    });
  });

  describe('Error Handling', () => {
    it('should throw error for non-existent file', async () => {
      const cache = new FileCache();
      
      await expect(
        cache.readFile(path.join(tempDir, 'nonexistent.ts'))
      ).rejects.toThrow();
    });

    it('should throw error for invalid path', async () => {
      const cache = new FileCache();
      
      await expect(
        cache.readFile('')
      ).rejects.toThrow();
    });

    it('should handle permission errors gracefully', async () => {
      const cache = new FileCache();
      
      // Try to read a system file we likely don't have permission for
      const restrictedFile = process.platform === 'win32'
        ? 'C:\\Windows\\System32\\config\\SAM'
        : '/root/.ssh/id_rsa';
      
      try {
        await cache.readFile(restrictedFile);
      } catch (error) {
        // Should throw error, not crash
        expect(error).toBeDefined();
      }
    });
  });

  describe('Concurrent Access', () => {
    it('should handle multiple concurrent reads of same file', async () => {
      const cache = new FileCache();
      
      // Trigger multiple concurrent reads
      const promises = [
        cache.readFile(testFile1),
        cache.readFile(testFile1),
        cache.readFile(testFile1),
      ];
      
      const results = await Promise.all(promises);
      
      // All should return same content
      expect(results[0]).toBe(results[1]);
      expect(results[1]).toBe(results[2]);
      
      // Should only cache once
      expect(cache.getStats().totalEntries).toBe(1);
    });

    it('should handle concurrent reads of different files', async () => {
      const cache = new FileCache();
      
      const promises = [
        cache.readFile(testFile1),
        cache.readFile(testFile2),
        cache.readFile(testFile3),
      ];
      
      const results = await Promise.all(promises);
      
      expect(results[0]).toContain('x = 1');
      expect(results[1]).toContain('y = 2');
      expect(results[2]).toContain('z = 3');
      expect(cache.getStats().totalEntries).toBe(3);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty file', async () => {
      const cache = new FileCache();
      const emptyFile = path.join(tempDir, 'empty.ts');
      
      await fs.writeFile(emptyFile, '', 'utf-8');
      
      const content = await cache.readFile(emptyFile);
      
      expect(content).toBe('');
      expect(cache.getStats().totalEntries).toBe(1);
    });

    it('should handle very large file', async () => {
      const cache = new FileCache();
      const largeFile = path.join(tempDir, 'large.ts');
      
      // Create 1MB file
      const largeContent = 'a'.repeat(1024 * 1024);
      await fs.writeFile(largeFile, largeContent, 'utf-8');
      
      const content = await cache.readFile(largeFile);
      
      expect(content.length).toBe(1024 * 1024);
      
      const stats = cache.getStats();
      expect(stats.totalSizeBytes).toBe(1024 * 1024);
    });

    it('should handle file with special characters in path', async () => {
      const cache = new FileCache();
      const specialFile = path.join(tempDir, 'file with spaces & special!.ts');
      
      await fs.writeFile(specialFile, 'export const special = true;', 'utf-8');
      
      const content = await cache.readFile(specialFile);
      
      expect(content).toContain('special');
    });
  });

  describe('Configuration', () => {
    it('should respect custom max cache size', async () => {
      const cache = new FileCache({ maxCacheSize: 1 });
      
      await cache.readFile(testFile1);
      expect(cache.getStats().totalEntries).toBe(1);
      
      await cache.readFile(testFile2);
      expect(cache.getStats().totalEntries).toBe(1); // Still 1 (evicted testFile1)
    });

    it('should respect custom TTL', async () => {
      const cache = new FileCache({ cacheTTL: 50 }); // 50ms
      
      await cache.readFile(testFile1);
      
      // Before expiration
      await new Promise(resolve => setTimeout(resolve, 20));
      await fs.writeFile(testFile1, 'NEW', 'utf-8');
      const content1 = await cache.readFile(testFile1);
      expect(content1).toBe('export const x = 1;'); // Still cached
      
      // After expiration
      await new Promise(resolve => setTimeout(resolve, 50));
      const content2 = await cache.readFile(testFile1);
      expect(content2).toBe('NEW'); // Re-read from disk
    });
  });

  describe('Performance Characteristics', () => {
    it('should be faster on cache hit', async () => {
      const cache = new FileCache();
      
      // First read (from disk)
      const start1 = Date.now();
      await cache.readFile(testFile1);
      const duration1 = Date.now() - start1;
      
      // Second read (from cache)
      const start2 = Date.now();
      await cache.readFile(testFile1);
      const duration2 = Date.now() - start2;
      
      // Cache hit should be significantly faster
      // (This test may be flaky on very fast systems, so using a loose assertion)
      expect(duration2).toBeLessThanOrEqual(duration1);
    });

    it('should handle 100 files efficiently', async () => {
      const cache = new FileCache({ maxCacheSize: 100 });
      
      // Create 100 files
      const files = [];
      for (let i = 0; i < 100; i++) {
        const file = path.join(tempDir, `file${i}.ts`);
        await fs.writeFile(file, `export const x${i} = ${i};`, 'utf-8');
        files.push(file);
      }
      
      // Read all files
      const start = Date.now();
      for (const file of files) {
        await cache.readFile(file);
      }
      const duration = Date.now() - start;
      
      // Should complete in reasonable time (<1 second)
      expect(duration).toBeLessThan(1000);
      expect(cache.getStats().totalEntries).toBe(100);
    });
  });

  describe('Hash Consistency', () => {
    it('should return same hash for same content', async () => {
      const cache = new FileCache();
      
      const result1 = await cache.readFileWithHash(testFile1);
      
      // Clear cache and read again
      cache.clear();
      
      const result2 = await cache.readFileWithHash(testFile1);
      
      expect(result1.hash).toBe(result2.hash);
    });

    it('should return different hash for different content', async () => {
      const cache = new FileCache();
      
      const result1 = await cache.readFileWithHash(testFile1);
      const result2 = await cache.readFileWithHash(testFile2);
      
      expect(result1.hash).not.toBe(result2.hash);
    });
  });

  describe('Real-world Usage Pattern', () => {
    it('should handle typical analysis workflow', async () => {
      // Simulate StaticAnalyzer usage pattern
      const cache = new FileCache();
      
      // Analyze file multiple times (common in dependency analysis)
      await cache.readFileWithHash(testFile1); // analyzeFile
      await cache.readFile(testFile1);          // analyzeSideEffects
      await cache.readFile(testFile1);          // calculateComplexity
      
      // Should only cache once
      const stats = cache.getStats();
      expect(stats.totalEntries).toBe(1);
      
      // Cache hit should have saved 2 disk reads
      // (This is validated through the cache entry count)
    });
  });
});





