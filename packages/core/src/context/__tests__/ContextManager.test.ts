/**
 * Tests for ContextManager
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ContextManager } from '../ContextManager';
import type { ProjectConfig } from '@testmind/shared';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';

describe('ContextManager', () => {
  let contextManager: ContextManager;
  let testDir: string;
  let testFile1: string;
  let testFile2: string;

  const mockConfig: ProjectConfig = {
    projectPath: '',
    language: 'typescript',
    testFramework: 'vitest',
    testDirectory: '__tests__',
    testFilePattern: '{filename}.test.ts',
  };

  beforeEach(async () => {
    // Create temporary test directory
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'contextmanager-test-'));
    mockConfig.projectPath = testDir;

    // Create test files
    testFile1 = path.join(testDir, 'utils.ts');
    testFile2 = path.join(testDir, 'math.ts');

    await fs.writeFile(testFile1, `
export function formatString(str: string): string {
  return str.trim().toLowerCase();
}

export function parseJson(json: string): any {
  return JSON.parse(json);
}
    `);

    await fs.writeFile(testFile2, `
export function add(a: number, b: number): number {
  return a + b;
}

export function multiply(a: number, b: number): number {
  return a * b;
}
    `);

    contextManager = new ContextManager(mockConfig, testDir);
  });

  afterEach(async () => {
    await contextManager.dispose();
    await fs.remove(testDir);
  });

  describe('addToContext', () => {
    it('should add a file to explicit context', async () => {
      await contextManager.addToContext('utils.ts');

      const snapshot = contextManager.getCurrentContext();
      expect(snapshot.explicitFiles).toHaveLength(1);
      expect(snapshot.explicitFiles[0].filePath).toBe(testFile1);
    });

    it('should handle absolute paths', async () => {
      await contextManager.addToContext(testFile1);

      const snapshot = contextManager.getCurrentContext();
      expect(snapshot.explicitFiles).toHaveLength(1);
      expect(snapshot.explicitFiles[0].filePath).toBe(testFile1);
    });

    it('should throw error for non-existent file', async () => {
      await expect(contextManager.addToContext('nonexistent.ts'))
        .rejects.toThrow('File not found');
    });

    it('should not add duplicate files', async () => {
      await contextManager.addToContext('utils.ts');
      await contextManager.addToContext('utils.ts');

      const snapshot = contextManager.getCurrentContext();
      expect(snapshot.explicitFiles).toHaveLength(1);
    });

    it('should add multiple files', async () => {
      await contextManager.addToContext('utils.ts');
      await contextManager.addToContext('math.ts');

      const snapshot = contextManager.getCurrentContext();
      expect(snapshot.explicitFiles).toHaveLength(2);
    });
  });

  describe('getCurrentContext', () => {
    it('should return empty context initially', () => {
      const snapshot = contextManager.getCurrentContext();

      expect(snapshot.explicitFiles).toHaveLength(0);
      expect(snapshot.focusPoints).toHaveLength(0);
      expect(snapshot.totalTokens).toBe(0);
      expect(snapshot.message).toContain('empty');
    });

    it('should show context summary with files', async () => {
      await contextManager.addToContext('utils.ts');
      await contextManager.addToContext('math.ts');

      const snapshot = contextManager.getCurrentContext();

      expect(snapshot.message).toContain('Files: 2');
      expect(snapshot.message).toContain('utils.ts');
      expect(snapshot.message).toContain('math.ts');
    });

    it('should estimate token count', async () => {
      await contextManager.addToContext('utils.ts');

      const snapshot = contextManager.getCurrentContext();

      expect(snapshot.totalTokens).toBeGreaterThan(0);
      expect(snapshot.message).toMatch(/tokens: \d/);
    });
  });

  describe('removeFromContext', () => {
    it('should remove a file from context', async () => {
      await contextManager.addToContext('utils.ts');
      await contextManager.addToContext('math.ts');

      await contextManager.removeFromContext('utils.ts');

      const snapshot = contextManager.getCurrentContext();
      expect(snapshot.explicitFiles).toHaveLength(1);
      expect(snapshot.explicitFiles[0].filePath).toBe(testFile2);
    });

    it('should handle removing non-existent file', async () => {
      await expect(contextManager.removeFromContext('nonexistent.ts'))
        .resolves.not.toThrow();
    });
  });

  describe('clearContext', () => {
    it('should clear all context', async () => {
      await contextManager.addToContext('utils.ts');
      await contextManager.addToContext('math.ts');

      contextManager.clearContext();

      const snapshot = contextManager.getCurrentContext();
      expect(snapshot.explicitFiles).toHaveLength(0);
      expect(snapshot.focusPoints).toHaveLength(0);
    });
  });

  describe('focusOn', () => {
    it('should focus on a function', async () => {
      // Note: This test might fail without proper indexing
      // For now, we just verify the structure is correct
      await contextManager.addToContext('utils.ts');

      // This will log a warning if function context cannot be retrieved
      await contextManager.focusOn('utils.ts', 'formatString');

      const snapshot = contextManager.getCurrentContext();
      expect(snapshot.focusPoints).toHaveLength(1);
      expect(snapshot.focusPoints[0].functionName).toBe('formatString');
    });

    it('should automatically add file if not in context', async () => {
      await contextManager.focusOn('utils.ts', 'formatString');

      const snapshot = contextManager.getCurrentContext();
      expect(snapshot.explicitFiles).toHaveLength(1);
      expect(snapshot.focusPoints).toHaveLength(1);
    });

    it('should mark file as focused', async () => {
      await contextManager.focusOn('utils.ts', 'formatString');

      const snapshot = contextManager.getCurrentContext();
      expect(snapshot.explicitFiles[0].isFocused).toBe(true);
      expect(snapshot.message).toContain('FOCUSED');
    });
  });

  describe('buildHybridContext', () => {
    it('should build hybrid context with explicit files', async () => {
      await contextManager.addToContext('utils.ts');

      const hybrid = await contextManager.buildHybridContext('test prompt');

      expect(hybrid.explicitFiles).toHaveLength(1);
      expect(hybrid.totalTokens).toBeGreaterThan(0);
      expect(hybrid.contextSize).toMatch(/K tokens$/);
    });

    it('should include semantic search results', async () => {
      // Note: This requires initialization which might be expensive
      // For now, we just verify the structure
      await contextManager.addToContext('utils.ts');

      const hybrid = await contextManager.buildHybridContext('parse json');

      expect(hybrid).toHaveProperty('relevantChunks');
      expect(hybrid).toHaveProperty('dependencies');
    });
  });

  describe('integration', () => {
    it('should support full workflow: add -> focus -> context -> clear', async () => {
      // Add files
      await contextManager.addToContext('utils.ts');
      await contextManager.addToContext('math.ts');

      let snapshot = contextManager.getCurrentContext();
      expect(snapshot.explicitFiles).toHaveLength(2);

      // Focus on function
      await contextManager.focusOn('utils.ts', 'formatString');

      snapshot = contextManager.getCurrentContext();
      expect(snapshot.focusPoints).toHaveLength(1);

      // Build hybrid context
      const hybrid = await contextManager.buildHybridContext('format string');
      expect(hybrid.explicitFiles).toHaveLength(2);
      expect(hybrid.focusPoints).toHaveLength(1);

      // Clear
      contextManager.clearContext();

      snapshot = contextManager.getCurrentContext();
      expect(snapshot.explicitFiles).toHaveLength(0);
      expect(snapshot.focusPoints).toHaveLength(0);
    });
  });
});



