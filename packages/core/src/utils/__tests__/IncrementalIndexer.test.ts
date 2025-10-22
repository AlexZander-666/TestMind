/**
 * IncrementalIndexer 单元测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IncrementalIndexer } from '../IncrementalIndexer';
import * as fs from 'fs-extra';
import * as path from 'path';

describe('IncrementalIndexer', () => {
  const testProjectPath = path.join(__dirname, 'test-project');
  let indexer: IncrementalIndexer;

  beforeEach(async () => {
    // 创建测试项目目录
    await fs.ensureDir(testProjectPath);
    indexer = new IncrementalIndexer(testProjectPath);
  });

  afterEach(async () => {
    // 清理测试目录
    await fs.remove(testProjectPath);
  });

  describe('detectChanges', () => {
    it('should return full strategy when no metadata exists', async () => {
      const result = await indexer.detectChanges();

      expect(result.strategy).toBe('full');
      expect(result.totalFilesToReindex).toBe(-1);
    });

    it('should detect new files', async () => {
      // 第一次索引
      const file1 = path.join(testProjectPath, 'file1.ts');
      await fs.writeFile(file1, 'export function test() {}', 'utf-8');
      
      await indexer.saveMetadata([{
        filePath: file1,
        astData: { imports: [], exports: [], functions: [], classes: [] },
        metadata: { language: 'typescript' },
      }]);

      // 添加新文件
      const file2 = path.join(testProjectPath, 'file2.ts');
      await fs.writeFile(file2, 'export function test2() {}', 'utf-8');

      const result = await indexer.detectChanges();

      expect(result.strategy).toBe('incremental');
      expect(result.changedFiles.length).toBeGreaterThan(0);
      expect(result.changedFiles.some(f => f.includes('file2.ts'))).toBe(true);
    });

    it('should detect modified files using hash', async () => {
      const file1 = path.join(testProjectPath, 'file1.ts');
      await fs.writeFile(file1, 'export function test() {}', 'utf-8');
      
      await indexer.saveMetadata([{
        filePath: file1,
        astData: { imports: [], exports: [], functions: [], classes: [] },
        metadata: { language: 'typescript' },
      }]);

      // 修改文件
      await fs.writeFile(file1, 'export function test() { return 42; }', 'utf-8');

      const result = await indexer.detectChanges();

      expect(result.strategy).toBe('incremental');
      expect(result.changedFiles.length).toBeGreaterThan(0);
      expect(result.changedFiles.some(f => f.includes('file1.ts'))).toBe(true);
    });

    it('should detect deleted files', async () => {
      const file1 = path.join(testProjectPath, 'file1.ts');
      const file2 = path.join(testProjectPath, 'file2.ts');
      
      await fs.writeFile(file1, 'export function test1() {}', 'utf-8');
      await fs.writeFile(file2, 'export function test2() {}', 'utf-8');
      
      await indexer.saveMetadata([
        {
          filePath: file1,
          astData: { imports: [], exports: [], functions: [], classes: [] },
          metadata: { language: 'typescript' },
        },
        {
          filePath: file2,
          astData: { imports: [], exports: [], functions: [], classes: [] },
          metadata: { language: 'typescript' },
        },
      ]);

      // 删除文件
      await fs.remove(file2);

      const result = await indexer.detectChanges();

      expect(result.strategy).toBe('incremental');
      const deletedFile = result.changedFiles.find(f => f.includes('file2.ts'));
      expect(deletedFile).toBeDefined();
    });
  });

  describe('calculateAffectedFiles', () => {
    it('should calculate affected files using dependency graph', async () => {
      const dependencyGraph = new Map<string, Set<string>>();
      
      // A imports B, C imports A
      const fileA = '/project/src/A.ts';
      const fileB = '/project/src/B.ts';
      const fileC = '/project/src/C.ts';
      
      dependencyGraph.set(fileA, new Set([fileB]));
      dependencyGraph.set(fileC, new Set([fileA]));

      const changedFiles = [fileB]; // B 变更
      const affected = await indexer.calculateAffectedFiles(changedFiles, dependencyGraph);

      // A 依赖 B，所以 A 受影响；C 依赖 A，所以 C 也受影响
      expect(affected).toContain(fileA);
      expect(affected).toContain(fileC);
    });

    it('should handle circular dependencies', async () => {
      const dependencyGraph = new Map<string, Set<string>>();
      
      // Circular: A → B → C → A
      const fileA = '/project/src/A.ts';
      const fileB = '/project/src/B.ts';
      const fileC = '/project/src/C.ts';
      
      dependencyGraph.set(fileA, new Set([fileB]));
      dependencyGraph.set(fileB, new Set([fileC]));
      dependencyGraph.set(fileC, new Set([fileA]));

      const changedFiles = [fileA];
      const affected = await indexer.calculateAffectedFiles(changedFiles, dependencyGraph);

      // 应该检测到循环并优雅处理
      expect(affected).toBeDefined();
      expect(affected.length).toBeGreaterThan(0);
    });

    it('should return empty array when no dependencies', async () => {
      const dependencyGraph = new Map<string, Set<string>>();
      const changedFiles = ['/project/src/isolated.ts'];
      
      const affected = await indexer.calculateAffectedFiles(changedFiles, dependencyGraph);

      expect(affected).toEqual([]);
    });
  });

  describe('saveMetadata', () => {
    it('should save metadata to disk', async () => {
      const files = [
        {
          filePath: path.join(testProjectPath, 'test.ts'),
          astData: { imports: [], exports: [], functions: [], classes: [] },
          metadata: { language: 'typescript' },
        },
      ];

      await fs.writeFile(files[0].filePath, 'export function test() {}', 'utf-8');
      await indexer.saveMetadata(files);

      const metadataPath = path.join(testProjectPath, '.testmind', 'index-metadata.json');
      const exists = await fs.pathExists(metadataPath);
      
      expect(exists).toBe(true);

      const metadata = await fs.readJSON(metadataPath);
      expect(metadata.version).toBe('1.0.0');
      expect(metadata.fileHashes).toBeDefined();
      expect(metadata.fileHashes.length).toBe(1);
    });

    it('should calculate file hashes correctly', async () => {
      const file = path.join(testProjectPath, 'test.ts');
      const content1 = 'export function test() {}';
      const content2 = 'export function test() { return 42; }';

      await fs.writeFile(file, content1, 'utf-8');
      
      await indexer.saveMetadata([{
        filePath: file,
        astData: { imports: [], exports: [], functions: [], classes: [] },
        metadata: { language: 'typescript' },
      }]);

      const metadataPath = path.join(testProjectPath, '.testmind', 'index-metadata.json');
      const metadata1 = await fs.readJSON(metadataPath);
      const hash1 = metadata1.fileHashes[0][1];

      // 修改文件
      await fs.writeFile(file, content2, 'utf-8');
      
      await indexer.saveMetadata([{
        filePath: file,
        astData: { imports: [], exports: [], functions: [], classes: [] },
        metadata: { language: 'typescript' },
      }]);

      const metadata2 = await fs.readJSON(metadataPath);
      const hash2 = metadata2.fileHashes[0][1];

      // 内容不同，哈希应该不同
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('clearMetadata', () => {
    it('should clear metadata file', async () => {
      // 先创建元数据
      await indexer.saveMetadata([{
        filePath: path.join(testProjectPath, 'test.ts'),
        astData: { imports: [], exports: [], functions: [], classes: [] },
        metadata: { language: 'typescript' },
      }]);

      const metadataPath = path.join(testProjectPath, '.testmind', 'index-metadata.json');
      expect(await fs.pathExists(metadataPath)).toBe(true);

      // 清除
      await indexer.clearMetadata();

      expect(await fs.pathExists(metadataPath)).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty project', async () => {
      const result = await indexer.detectChanges();
      
      expect(result.strategy).toBe('full');
      expect(result.changedFiles).toEqual([]);
    });

    it('should handle file read errors gracefully', async () => {
      const nonExistentFile = path.join(testProjectPath, 'nonexistent.ts');
      
      await indexer.saveMetadata([{
        filePath: nonExistentFile,
        astData: { imports: [], exports: [], functions: [], classes: [] },
        metadata: { language: 'typescript' },
      }]);

      // 应该优雅处理不存在的文件
      const result = await indexer.detectChanges();
      expect(result).toBeDefined();
    });
  });
});



















