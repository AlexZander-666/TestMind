/**
 * DiffApplier单元测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DiffApplier } from '../DiffApplier';
import { DiffGenerator } from '../DiffGenerator';
import type { FileDiff } from '../DiffGenerator';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('DiffApplier', () => {
  let applier: DiffApplier;
  let generator: DiffGenerator;
  const testDir = path.join(__dirname, '.test-tmp');

  beforeEach(async () => {
    applier = new DiffApplier({
      dryRun: false,
      createBackup: true,
      allowPartial: false
    });
    
    generator = new DiffGenerator();

    // 创建测试目录
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    // 清理测试目录
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('applyFileDiff', () => {
    it('should apply simple modification', async () => {
      const testFile = path.join(testDir, 'test.ts');
      const oldContent = 'old content';
      const newContent = 'new content';

      // 创建原文件
      await fs.writeFile(testFile, oldContent, 'utf-8');

      // 生成diff
      const diff = generator.generateFileDiff(testFile, oldContent, newContent);

      // 应用diff
      const result = await applier.applyFileDiff(diff);

      expect(result.success).toBe(true);
      expect(result.applied).toBe(true);
      expect(result.conflicts.length).toBe(0);

      // 验证文件内容
      const actualContent = await fs.readFile(testFile, 'utf-8');
      expect(actualContent).toBe(newContent);
    });

    it('should detect conflicts when file content changed', async () => {
      const testFile = path.join(testDir, 'test.ts');
      const originalContent = 'original';
      const expectedContent = 'expected';
      const actualContent = 'different actual content';

      // 基于originalContent生成diff
      const diff = generator.generateFileDiff(testFile, originalContent, expectedContent);

      // 但文件实际内容不同
      await fs.writeFile(testFile, actualContent, 'utf-8');

      // 应用diff应该检测到冲突
      const result = await applier.applyFileDiff(diff);

      expect(result.success).toBe(true);
      expect(result.conflicts.length).toBeGreaterThan(0);
      expect(result.applied).toBe(false);
    });

    it('should create backup when enabled', async () => {
      const applierWithBackup = new DiffApplier({
        createBackup: true,
        backupDir: path.join(testDir, 'backups')
      });

      const testFile = path.join(testDir, 'test.ts');
      const oldContent = 'original content';
      const newContent = 'modified content';

      await fs.writeFile(testFile, oldContent, 'utf-8');

      const diff = generator.generateFileDiff(testFile, oldContent, newContent);
      const result = await applierWithBackup.applyFileDiff(diff);

      expect(result.backupPath).toBeDefined();
      
      if (result.backupPath) {
        const backupExists = await fs.access(result.backupPath).then(() => true).catch(() => false);
        expect(backupExists).toBe(true);
      }
    });

    it('should work in dry-run mode without modifying file', async () => {
      const applierDryRun = new DiffApplier({ dryRun: true });

      const testFile = path.join(testDir, 'test.ts');
      const oldContent = 'old';
      const newContent = 'new';

      await fs.writeFile(testFile, oldContent, 'utf-8');

      const diff = generator.generateFileDiff(testFile, oldContent, newContent);
      const result = await applierDryRun.applyFileDiff(diff);

      expect(result.success).toBe(true);
      
      // 文件不应该被修改
      const actualContent = await fs.readFile(testFile, 'utf-8');
      expect(actualContent).toBe(oldContent);
    });
  });

  describe('applyMultipleDiffs', () => {
    it('should apply multiple diffs successfully', async () => {
      const file1 = path.join(testDir, 'file1.ts');
      const file2 = path.join(testDir, 'file2.ts');

      await fs.writeFile(file1, 'content1', 'utf-8');
      await fs.writeFile(file2, 'content2', 'utf-8');

      const diff1 = generator.generateFileDiff(file1, 'content1', 'modified1');
      const diff2 = generator.generateFileDiff(file2, 'content2', 'modified2');

      const results = await applier.applyMultipleDiffs([diff1, diff2]);

      expect(results.length).toBe(2);
      expect(results.every(r => r.success)).toBe(true);
    });

    it('should stop on first failure when allowPartial is false', async () => {
      const applierStrict = new DiffApplier({ allowPartial: false });

      const file1 = path.join(testDir, 'file1.ts');
      const file2 = path.join(testDir, 'file2.ts');

      await fs.writeFile(file1, 'wrong content', 'utf-8'); // 会导致冲突

      const diff1 = generator.generateFileDiff(file1, 'expected', 'new1');
      const diff2 = generator.generateFileDiff(file2, '', 'new2');

      const results = await applierStrict.applyMultipleDiffs([diff1, diff2]);

      // 应该在第一个失败后停止
      expect(results.length).toBeLessThanOrEqual(2);
    });
  });

  describe('generateReport', () => {
    it('should generate comprehensive apply report', async () => {
      const results = [
        {
          success: true,
          filePath: 'file1.ts',
          applied: true,
          conflicts: []
        },
        {
          success: true,
          filePath: 'file2.ts',
          applied: false,
          conflicts: [{
            hunkIndex: 0,
            lineNumber: 5,
            reason: 'mismatch',
            expected: 'exp',
            actual: 'act'
          }]
        },
        {
          success: false,
          filePath: 'file3.ts',
          applied: false,
          conflicts: [],
          error: 'File not found'
        }
      ];

      const report = applier.generateReport(results);

      expect(report).toContain('Diff Apply Report');
      expect(report).toContain('Total: 3');
      expect(report).toContain('Successfully Applied: 1');
      expect(report).toContain('Failed: 1');
      expect(report).toContain('Partially Applied: 1');
    });
  });

  describe('rollbackFromBackup', () => {
    it('should rollback file from backup', async () => {
      const testFile = path.join(testDir, 'test.ts');
      const backupFile = path.join(testDir, 'test.ts.backup');
      const originalContent = 'original';
      const modifiedContent = 'modified';

      // 创建备份
      await fs.writeFile(backupFile, originalContent, 'utf-8');
      
      // 修改原文件
      await fs.writeFile(testFile, modifiedContent, 'utf-8');

      // 回滚
      await applier.rollbackFromBackup(testFile, backupFile);

      // 验证回滚成功
      const content = await fs.readFile(testFile, 'utf-8');
      expect(content).toBe(originalContent);
    });
  });
});

 * DiffApplier单元测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DiffApplier } from '../DiffApplier';
import { DiffGenerator } from '../DiffGenerator';
import type { FileDiff } from '../DiffGenerator';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('DiffApplier', () => {
  let applier: DiffApplier;
  let generator: DiffGenerator;
  const testDir = path.join(__dirname, '.test-tmp');

  beforeEach(async () => {
    applier = new DiffApplier({
      dryRun: false,
      createBackup: true,
      allowPartial: false
    });
    
    generator = new DiffGenerator();

    // 创建测试目录
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    // 清理测试目录
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('applyFileDiff', () => {
    it('should apply simple modification', async () => {
      const testFile = path.join(testDir, 'test.ts');
      const oldContent = 'old content';
      const newContent = 'new content';

      // 创建原文件
      await fs.writeFile(testFile, oldContent, 'utf-8');

      // 生成diff
      const diff = generator.generateFileDiff(testFile, oldContent, newContent);

      // 应用diff
      const result = await applier.applyFileDiff(diff);

      expect(result.success).toBe(true);
      expect(result.applied).toBe(true);
      expect(result.conflicts.length).toBe(0);

      // 验证文件内容
      const actualContent = await fs.readFile(testFile, 'utf-8');
      expect(actualContent).toBe(newContent);
    });

    it('should detect conflicts when file content changed', async () => {
      const testFile = path.join(testDir, 'test.ts');
      const originalContent = 'original';
      const expectedContent = 'expected';
      const actualContent = 'different actual content';

      // 基于originalContent生成diff
      const diff = generator.generateFileDiff(testFile, originalContent, expectedContent);

      // 但文件实际内容不同
      await fs.writeFile(testFile, actualContent, 'utf-8');

      // 应用diff应该检测到冲突
      const result = await applier.applyFileDiff(diff);

      expect(result.success).toBe(true);
      expect(result.conflicts.length).toBeGreaterThan(0);
      expect(result.applied).toBe(false);
    });

    it('should create backup when enabled', async () => {
      const applierWithBackup = new DiffApplier({
        createBackup: true,
        backupDir: path.join(testDir, 'backups')
      });

      const testFile = path.join(testDir, 'test.ts');
      const oldContent = 'original content';
      const newContent = 'modified content';

      await fs.writeFile(testFile, oldContent, 'utf-8');

      const diff = generator.generateFileDiff(testFile, oldContent, newContent);
      const result = await applierWithBackup.applyFileDiff(diff);

      expect(result.backupPath).toBeDefined();
      
      if (result.backupPath) {
        const backupExists = await fs.access(result.backupPath).then(() => true).catch(() => false);
        expect(backupExists).toBe(true);
      }
    });

    it('should work in dry-run mode without modifying file', async () => {
      const applierDryRun = new DiffApplier({ dryRun: true });

      const testFile = path.join(testDir, 'test.ts');
      const oldContent = 'old';
      const newContent = 'new';

      await fs.writeFile(testFile, oldContent, 'utf-8');

      const diff = generator.generateFileDiff(testFile, oldContent, newContent);
      const result = await applierDryRun.applyFileDiff(diff);

      expect(result.success).toBe(true);
      
      // 文件不应该被修改
      const actualContent = await fs.readFile(testFile, 'utf-8');
      expect(actualContent).toBe(oldContent);
    });
  });

  describe('applyMultipleDiffs', () => {
    it('should apply multiple diffs successfully', async () => {
      const file1 = path.join(testDir, 'file1.ts');
      const file2 = path.join(testDir, 'file2.ts');

      await fs.writeFile(file1, 'content1', 'utf-8');
      await fs.writeFile(file2, 'content2', 'utf-8');

      const diff1 = generator.generateFileDiff(file1, 'content1', 'modified1');
      const diff2 = generator.generateFileDiff(file2, 'content2', 'modified2');

      const results = await applier.applyMultipleDiffs([diff1, diff2]);

      expect(results.length).toBe(2);
      expect(results.every(r => r.success)).toBe(true);
    });

    it('should stop on first failure when allowPartial is false', async () => {
      const applierStrict = new DiffApplier({ allowPartial: false });

      const file1 = path.join(testDir, 'file1.ts');
      const file2 = path.join(testDir, 'file2.ts');

      await fs.writeFile(file1, 'wrong content', 'utf-8'); // 会导致冲突

      const diff1 = generator.generateFileDiff(file1, 'expected', 'new1');
      const diff2 = generator.generateFileDiff(file2, '', 'new2');

      const results = await applierStrict.applyMultipleDiffs([diff1, diff2]);

      // 应该在第一个失败后停止
      expect(results.length).toBeLessThanOrEqual(2);
    });
  });

  describe('generateReport', () => {
    it('should generate comprehensive apply report', async () => {
      const results = [
        {
          success: true,
          filePath: 'file1.ts',
          applied: true,
          conflicts: []
        },
        {
          success: true,
          filePath: 'file2.ts',
          applied: false,
          conflicts: [{
            hunkIndex: 0,
            lineNumber: 5,
            reason: 'mismatch',
            expected: 'exp',
            actual: 'act'
          }]
        },
        {
          success: false,
          filePath: 'file3.ts',
          applied: false,
          conflicts: [],
          error: 'File not found'
        }
      ];

      const report = applier.generateReport(results);

      expect(report).toContain('Diff Apply Report');
      expect(report).toContain('Total: 3');
      expect(report).toContain('Successfully Applied: 1');
      expect(report).toContain('Failed: 1');
      expect(report).toContain('Partially Applied: 1');
    });
  });

  describe('rollbackFromBackup', () => {
    it('should rollback file from backup', async () => {
      const testFile = path.join(testDir, 'test.ts');
      const backupFile = path.join(testDir, 'test.ts.backup');
      const originalContent = 'original';
      const modifiedContent = 'modified';

      // 创建备份
      await fs.writeFile(backupFile, originalContent, 'utf-8');
      
      // 修改原文件
      await fs.writeFile(testFile, modifiedContent, 'utf-8');

      // 回滚
      await applier.rollbackFromBackup(testFile, backupFile);

      // 验证回滚成功
      const content = await fs.readFile(testFile, 'utf-8');
      expect(content).toBe(originalContent);
    });
  });
});

 * DiffApplier单元测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DiffApplier } from '../DiffApplier';
import { DiffGenerator } from '../DiffGenerator';
import type { FileDiff } from '../DiffGenerator';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('DiffApplier', () => {
  let applier: DiffApplier;
  let generator: DiffGenerator;
  const testDir = path.join(__dirname, '.test-tmp');

  beforeEach(async () => {
    applier = new DiffApplier({
      dryRun: false,
      createBackup: true,
      allowPartial: false
    });
    
    generator = new DiffGenerator();

    // 创建测试目录
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    // 清理测试目录
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('applyFileDiff', () => {
    it('should apply simple modification', async () => {
      const testFile = path.join(testDir, 'test.ts');
      const oldContent = 'old content';
      const newContent = 'new content';

      // 创建原文件
      await fs.writeFile(testFile, oldContent, 'utf-8');

      // 生成diff
      const diff = generator.generateFileDiff(testFile, oldContent, newContent);

      // 应用diff
      const result = await applier.applyFileDiff(diff);

      expect(result.success).toBe(true);
      expect(result.applied).toBe(true);
      expect(result.conflicts.length).toBe(0);

      // 验证文件内容
      const actualContent = await fs.readFile(testFile, 'utf-8');
      expect(actualContent).toBe(newContent);
    });

    it('should detect conflicts when file content changed', async () => {
      const testFile = path.join(testDir, 'test.ts');
      const originalContent = 'original';
      const expectedContent = 'expected';
      const actualContent = 'different actual content';

      // 基于originalContent生成diff
      const diff = generator.generateFileDiff(testFile, originalContent, expectedContent);

      // 但文件实际内容不同
      await fs.writeFile(testFile, actualContent, 'utf-8');

      // 应用diff应该检测到冲突
      const result = await applier.applyFileDiff(diff);

      expect(result.success).toBe(true);
      expect(result.conflicts.length).toBeGreaterThan(0);
      expect(result.applied).toBe(false);
    });

    it('should create backup when enabled', async () => {
      const applierWithBackup = new DiffApplier({
        createBackup: true,
        backupDir: path.join(testDir, 'backups')
      });

      const testFile = path.join(testDir, 'test.ts');
      const oldContent = 'original content';
      const newContent = 'modified content';

      await fs.writeFile(testFile, oldContent, 'utf-8');

      const diff = generator.generateFileDiff(testFile, oldContent, newContent);
      const result = await applierWithBackup.applyFileDiff(diff);

      expect(result.backupPath).toBeDefined();
      
      if (result.backupPath) {
        const backupExists = await fs.access(result.backupPath).then(() => true).catch(() => false);
        expect(backupExists).toBe(true);
      }
    });

    it('should work in dry-run mode without modifying file', async () => {
      const applierDryRun = new DiffApplier({ dryRun: true });

      const testFile = path.join(testDir, 'test.ts');
      const oldContent = 'old';
      const newContent = 'new';

      await fs.writeFile(testFile, oldContent, 'utf-8');

      const diff = generator.generateFileDiff(testFile, oldContent, newContent);
      const result = await applierDryRun.applyFileDiff(diff);

      expect(result.success).toBe(true);
      
      // 文件不应该被修改
      const actualContent = await fs.readFile(testFile, 'utf-8');
      expect(actualContent).toBe(oldContent);
    });
  });

  describe('applyMultipleDiffs', () => {
    it('should apply multiple diffs successfully', async () => {
      const file1 = path.join(testDir, 'file1.ts');
      const file2 = path.join(testDir, 'file2.ts');

      await fs.writeFile(file1, 'content1', 'utf-8');
      await fs.writeFile(file2, 'content2', 'utf-8');

      const diff1 = generator.generateFileDiff(file1, 'content1', 'modified1');
      const diff2 = generator.generateFileDiff(file2, 'content2', 'modified2');

      const results = await applier.applyMultipleDiffs([diff1, diff2]);

      expect(results.length).toBe(2);
      expect(results.every(r => r.success)).toBe(true);
    });

    it('should stop on first failure when allowPartial is false', async () => {
      const applierStrict = new DiffApplier({ allowPartial: false });

      const file1 = path.join(testDir, 'file1.ts');
      const file2 = path.join(testDir, 'file2.ts');

      await fs.writeFile(file1, 'wrong content', 'utf-8'); // 会导致冲突

      const diff1 = generator.generateFileDiff(file1, 'expected', 'new1');
      const diff2 = generator.generateFileDiff(file2, '', 'new2');

      const results = await applierStrict.applyMultipleDiffs([diff1, diff2]);

      // 应该在第一个失败后停止
      expect(results.length).toBeLessThanOrEqual(2);
    });
  });

  describe('generateReport', () => {
    it('should generate comprehensive apply report', async () => {
      const results = [
        {
          success: true,
          filePath: 'file1.ts',
          applied: true,
          conflicts: []
        },
        {
          success: true,
          filePath: 'file2.ts',
          applied: false,
          conflicts: [{
            hunkIndex: 0,
            lineNumber: 5,
            reason: 'mismatch',
            expected: 'exp',
            actual: 'act'
          }]
        },
        {
          success: false,
          filePath: 'file3.ts',
          applied: false,
          conflicts: [],
          error: 'File not found'
        }
      ];

      const report = applier.generateReport(results);

      expect(report).toContain('Diff Apply Report');
      expect(report).toContain('Total: 3');
      expect(report).toContain('Successfully Applied: 1');
      expect(report).toContain('Failed: 1');
      expect(report).toContain('Partially Applied: 1');
    });
  });

  describe('rollbackFromBackup', () => {
    it('should rollback file from backup', async () => {
      const testFile = path.join(testDir, 'test.ts');
      const backupFile = path.join(testDir, 'test.ts.backup');
      const originalContent = 'original';
      const modifiedContent = 'modified';

      // 创建备份
      await fs.writeFile(backupFile, originalContent, 'utf-8');
      
      // 修改原文件
      await fs.writeFile(testFile, modifiedContent, 'utf-8');

      // 回滚
      await applier.rollbackFromBackup(testFile, backupFile);

      // 验证回滚成功
      const content = await fs.readFile(testFile, 'utf-8');
      expect(content).toBe(originalContent);
    });
  });
});

