/**
 * ExplicitContextManager 单元测试
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ExplicitContextManager } from '../ExplicitContextManager';
import type { CodeChunk } from '@testmind/shared';

describe('ExplicitContextManager', () => {
  let manager: ExplicitContextManager;
  let sampleChunks: CodeChunk[];
  
  beforeEach(() => {
    manager = new ExplicitContextManager();
    
    // 准备测试数据
    sampleChunks = [
      {
        id: 'chunk-1',
        filePath: 'src/utils/math.ts',
        content: 'export function add(a: number, b: number) { return a + b; }',
        startLine: 1,
        endLine: 1,
      },
      {
        id: 'chunk-2',
        filePath: 'src/utils/math.ts',
        content: 'export function subtract(a: number, b: number) { return a - b; }',
        startLine: 3,
        endLine: 3,
      },
      {
        id: 'chunk-3',
        filePath: 'src/core/engine.ts',
        content: 'export class Engine { /* ... */ }',
        startLine: 1,
        endLine: 10,
      },
    ];
  });
  
  describe('addFile', () => {
    it('should add file chunks to context', () => {
      manager.addFile('src/utils/math.ts', [sampleChunks[0], sampleChunks[1]]);
      
      const pinnedChunks = manager.getPinnedChunks();
      expect(pinnedChunks).toHaveLength(2);
      expect(pinnedChunks[0].chunk.filePath).toBe('src/utils/math.ts');
    });
    
    it('should use default priority of 5', () => {
      manager.addFile('src/utils/math.ts', [sampleChunks[0]]);
      
      const pinnedChunks = manager.getPinnedChunks();
      expect(pinnedChunks[0].priority).toBe(5);
    });
    
    it('should use custom priority when provided', () => {
      manager.addFile('src/utils/math.ts', [sampleChunks[0]], { priority: 9 });
      
      const pinnedChunks = manager.getPinnedChunks();
      expect(pinnedChunks[0].priority).toBe(9);
    });
    
    it('should include reason in pinned chunk', () => {
      const customReason = 'User explicitly added';
      manager.addFile('src/utils/math.ts', [sampleChunks[0]], { reason: customReason });
      
      const pinnedChunks = manager.getPinnedChunks();
      expect(pinnedChunks[0].reason).toBe(customReason);
    });
  });
  
  describe('addFunction', () => {
    it('should add specific function to context', () => {
      manager.addFunction('src/utils/math.ts', 'add', sampleChunks[0]);
      
      const pinnedChunks = manager.getPinnedChunks();
      expect(pinnedChunks).toHaveLength(1);
      expect(pinnedChunks[0].chunk.id).toBe('chunk-1');
    });
    
    it('should use higher default priority (7) for functions', () => {
      manager.addFunction('src/utils/math.ts', 'add', sampleChunks[0]);
      
      const pinnedChunks = manager.getPinnedChunks();
      expect(pinnedChunks[0].priority).toBe(7);
    });
  });
  
  describe('removeFile', () => {
    it('should remove all chunks from a file', () => {
      manager.addFile('src/utils/math.ts', [sampleChunks[0], sampleChunks[1]]);
      manager.addFile('src/core/engine.ts', [sampleChunks[2]]);
      
      expect(manager.getPinnedChunks()).toHaveLength(3);
      
      manager.removeFile('src/utils/math.ts');
      
      const remaining = manager.getPinnedChunks();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].chunk.filePath).toBe('src/core/engine.ts');
    });
  });
  
  describe('setFocus / getFocusScope', () => {
    it('should set focus scope', () => {
      manager.setFocus(['src/core', 'src/utils']);
      
      const scope = manager.getFocusScope();
      expect(scope).toHaveLength(2);
      expect(scope).toContain('src/core');
      expect(scope).toContain('src/utils');
    });
    
    it('should replace existing focus scope', () => {
      manager.setFocus(['src/old']);
      manager.setFocus(['src/new']);
      
      const scope = manager.getFocusScope();
      expect(scope).toHaveLength(1);
      expect(scope).toContain('src/new');
    });
  });
  
  describe('addToFocus / removeFromFocus', () => {
    it('should add to focus scope', () => {
      manager.setFocus(['src/core']);
      manager.addToFocus('src/utils');
      
      const scope = manager.getFocusScope();
      expect(scope).toHaveLength(2);
    });
    
    it('should remove from focus scope', () => {
      manager.setFocus(['src/core', 'src/utils']);
      manager.removeFromFocus('src/utils');
      
      const scope = manager.getFocusScope();
      expect(scope).toHaveLength(1);
      expect(scope).toContain('src/core');
    });
  });
  
  describe('getPinnedChunks', () => {
    it('should return chunks sorted by priority (default)', () => {
      manager.addFile('file1.ts', [sampleChunks[0]], { priority: 3 });
      manager.addFile('file2.ts', [sampleChunks[1]], { priority: 8 });
      manager.addFile('file3.ts', [sampleChunks[2]], { priority: 5 });
      
      const chunks = manager.getPinnedChunks();
      
      expect(chunks[0].priority).toBe(8);
      expect(chunks[1].priority).toBe(5);
      expect(chunks[2].priority).toBe(3);
    });
    
    it('should support unsorted retrieval', () => {
      manager.addFile('file1.ts', [sampleChunks[0]], { priority: 3 });
      manager.addFile('file2.ts', [sampleChunks[1]], { priority: 8 });
      
      const chunks = manager.getPinnedChunks(false);
      
      // 顺序可能不同（因为使用 Map）
      expect(chunks).toHaveLength(2);
    });
  });
  
  describe('getCurrentContext', () => {
    it('should return context snapshot', () => {
      manager.addFile('src/utils/math.ts', [sampleChunks[0], sampleChunks[1]]);
      manager.setFocus(['src/utils']);
      
      const snapshot = manager.getCurrentContext();
      
      expect(snapshot.pinnedChunks).toHaveLength(2);
      expect(snapshot.focusScope).toEqual(['src/utils']);
      expect(snapshot.estimatedTokens).toBeGreaterThan(0);
      expect(snapshot.timestamp).toBeInstanceOf(Date);
    });
    
    it('should estimate tokens correctly', () => {
      // 假设 1 token ≈ 4 字符
      const chunk: CodeChunk = {
        id: 'test',
        filePath: 'test.ts',
        content: 'a'.repeat(400), // 400 字符 ≈ 100 tokens
        startLine: 1,
        endLine: 1,
      };
      
      manager.addFile('test.ts', [chunk]);
      
      const snapshot = manager.getCurrentContext();
      expect(snapshot.estimatedTokens).toBe(100);
    });
  });
  
  describe('clear', () => {
    it('should clear all pinned chunks', () => {
      manager.addFile('src/utils/math.ts', sampleChunks);
      expect(manager.getPinnedChunks()).toHaveLength(3);
      
      manager.clear();
      
      expect(manager.getPinnedChunks()).toHaveLength(0);
    });
  });
  
  describe('clearFocus', () => {
    it('should clear focus scope', () => {
      manager.setFocus(['src/core', 'src/utils']);
      expect(manager.getFocusScope()).toHaveLength(2);
      
      manager.clearFocus();
      
      expect(manager.getFocusScope()).toHaveLength(0);
    });
  });
  
  describe('isInFocus', () => {
    it('should return true when no focus scope is set', () => {
      expect(manager.isInFocus('any/file.ts')).toBe(true);
    });
    
    it('should return true for exact match', () => {
      manager.setFocus(['src/core/engine.ts']);
      expect(manager.isInFocus('src/core/engine.ts')).toBe(true);
    });
    
    it('should return true for file in focused directory', () => {
      manager.setFocus(['src/core']);
      expect(manager.isInFocus('src/core/engine.ts')).toBe(true);
      expect(manager.isInFocus('src/core/subdir/file.ts')).toBe(true);
    });
    
    it('should return false for file outside focus scope', () => {
      manager.setFocus(['src/core']);
      expect(manager.isInFocus('src/utils/math.ts')).toBe(false);
    });
  });
  
  describe('getStatistics', () => {
    it('should return correct statistics', () => {
      manager.addFile('src/utils/math.ts', [sampleChunks[0], sampleChunks[1]], { priority: 5 });
      manager.addFile('src/core/engine.ts', [sampleChunks[2]], { priority: 8 });
      manager.setFocus(['src/core', 'src/utils']);
      
      const stats = manager.getStatistics();
      
      expect(stats.totalChunks).toBe(3);
      expect(stats.totalFiles).toBe(2);
      expect(stats.focusScopeCount).toBe(2);
      expect(stats.estimatedTokens).toBeGreaterThan(0);
      expect(stats.priorityDistribution[5]).toBe(2);
      expect(stats.priorityDistribution[8]).toBe(1);
    });
    
    it('should calculate unique files correctly', () => {
      manager.addFile('src/utils/math.ts', [sampleChunks[0], sampleChunks[1]]);
      
      const stats = manager.getStatistics();
      
      // 两个 chunks 但只有一个文件
      expect(stats.totalChunks).toBe(2);
      expect(stats.totalFiles).toBe(1);
    });
  });
});





