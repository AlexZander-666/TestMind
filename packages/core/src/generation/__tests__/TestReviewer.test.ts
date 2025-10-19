/**
 * TestReviewer unit tests
 * Testing Diff-First review functionality
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestReviewer } from '../TestReviewer';
import type { TestSuite } from '@testmind/shared';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

describe('TestReviewer', () => {
  let reviewer: TestReviewer;
  let tempDir: string;

  beforeEach(async () => {
    reviewer = new TestReviewer();
    // Create temporary directory for test files
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'testmind-test-'));
  });

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('generateDiff', () => {
    it('should generate diff for new file', async () => {
      const testSuite: TestSuite = {
        id: 'test-1',
        projectId: 'project-1',
        targetEntityId: 'entity-1',
        testType: 'unit',
        framework: 'jest',
        code: 'import { add } from "./math";\n\ndescribe("add", () => {\n  it("should add two numbers", () => {\n    expect(add(1, 2)).toBe(3);\n  });\n});',
        filePath: path.join(tempDir, 'math.test.ts'),
        generatedAt: new Date(),
        generatedBy: 'ai',
        metadata: {
          targetFunction: 'add',
          dependencies: [],
          mocks: [],
          fixtures: [],
          estimatedRunTime: 100,
        },
      };

      const diffResult = await reviewer.generateDiff(testSuite);

      expect(diffResult.exists).toBe(false);
      expect(diffResult.filePath).toBe(testSuite.filePath);
      expect(diffResult.newContent).toBe(testSuite.code);
      expect(diffResult.originalContent).toBeUndefined();
      expect(diffResult.diff).toContain('📝 New file:');
      expect(diffResult.diff).toContain('import { add }');
    });

    it('should generate diff for existing file', async () => {
      const filePath = path.join(tempDir, 'existing.test.ts');
      const originalContent = 'import { old } from "./old";\n\ndescribe("old", () => {});';
      
      // Create existing file
      await fs.writeFile(filePath, originalContent, 'utf-8');

      const testSuite: TestSuite = {
        id: 'test-2',
        projectId: 'project-1',
        targetEntityId: 'entity-1',
        testType: 'unit',
        framework: 'jest',
        code: 'import { new } from "./new";\n\ndescribe("new", () => {});',
        filePath,
        generatedAt: new Date(),
        generatedBy: 'ai',
        metadata: {
          targetFunction: 'new',
          dependencies: [],
          mocks: [],
          fixtures: [],
          estimatedRunTime: 100,
        },
      };

      const diffResult = await reviewer.generateDiff(testSuite);

      expect(diffResult.exists).toBe(true);
      expect(diffResult.originalContent).toBe(originalContent);
      expect(diffResult.diff).toContain('📝 Modified file:');
      expect(diffResult.diff).toContain('-');
      expect(diffResult.diff).toContain('+');
    });
  });

  describe('applyTest', () => {
    it('should create new test file', async () => {
      const filePath = path.join(tempDir, 'subdir', 'new.test.ts');
      const testCode = 'describe("test", () => { it("works", () => {}); });';

      const testSuite: TestSuite = {
        id: 'test-3',
        projectId: 'project-1',
        targetEntityId: 'entity-1',
        testType: 'unit',
        framework: 'jest',
        code: testCode,
        filePath,
        generatedAt: new Date(),
        generatedBy: 'ai',
        metadata: {
          targetFunction: 'test',
          dependencies: [],
          mocks: [],
          fixtures: [],
          estimatedRunTime: 100,
        },
      };

      await reviewer.applyTest(testSuite);

      // Verify file was created
      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).toBe(testCode);
    });

    it('should overwrite existing test file', async () => {
      const filePath = path.join(tempDir, 'overwrite.test.ts');
      const oldContent = 'old content';
      const newContent = 'new content';

      // Create existing file
      await fs.writeFile(filePath, oldContent, 'utf-8');

      const testSuite: TestSuite = {
        id: 'test-4',
        projectId: 'project-1',
        targetEntityId: 'entity-1',
        testType: 'unit',
        framework: 'jest',
        code: newContent,
        filePath,
        generatedAt: new Date(),
        generatedBy: 'ai',
        metadata: {
          targetFunction: 'test',
          dependencies: [],
          mocks: [],
          fixtures: [],
          estimatedRunTime: 100,
        },
      };

      await reviewer.applyTest(testSuite);

      // Verify file was overwritten
      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).toBe(newContent);
    });
  });

  describe('formatForCLI', () => {
    it('should format diff with ANSI colors', async () => {
      const testSuite: TestSuite = {
        id: 'test-5',
        projectId: 'project-1',
        targetEntityId: 'entity-1',
        testType: 'unit',
        framework: 'jest',
        code: 'test code',
        filePath: path.join(tempDir, 'format.test.ts'),
        generatedAt: new Date(),
        generatedBy: 'ai',
        metadata: {
          targetFunction: 'test',
          dependencies: [],
          mocks: [],
          fixtures: [],
          estimatedRunTime: 100,
        },
      };

      const diffResult = await reviewer.generateDiff(testSuite);
      const formatted = reviewer.formatForCLI(diffResult);

      // Check for ANSI color codes
      expect(formatted).toContain('\x1b['); // ANSI escape codes
      expect(formatted).toContain('32m'); // Green for additions
      expect(formatted).toContain('36m'); // Cyan for header
    });
  });

  describe('edge cases', () => {
    it('should handle empty test code', async () => {
      const testSuite: TestSuite = {
        id: 'test-6',
        projectId: 'project-1',
        targetEntityId: 'entity-1',
        testType: 'unit',
        framework: 'jest',
        code: '',
        filePath: path.join(tempDir, 'empty.test.ts'),
        generatedAt: new Date(),
        generatedBy: 'ai',
        metadata: {
          targetFunction: 'test',
          dependencies: [],
          mocks: [],
          fixtures: [],
          estimatedRunTime: 100,
        },
      };

      const diffResult = await reviewer.generateDiff(testSuite);
      expect(diffResult.newContent).toBe('');
    });

    it('should handle multiline test code', async () => {
      const multilineCode = `import { func } from './module';

describe('func', () => {
  it('should work', () => {
    expect(func()).toBe(true);
  });

  it('should handle error', () => {
    expect(() => func()).toThrow();
  });
});`;

      const testSuite: TestSuite = {
        id: 'test-7',
        projectId: 'project-1',
        targetEntityId: 'entity-1',
        testType: 'unit',
        framework: 'jest',
        code: multilineCode,
        filePath: path.join(tempDir, 'multiline.test.ts'),
        generatedAt: new Date(),
        generatedBy: 'ai',
        metadata: {
          targetFunction: 'func',
          dependencies: [],
          mocks: [],
          fixtures: [],
          estimatedRunTime: 100,
        },
      };

      const diffResult = await reviewer.generateDiff(testSuite);
      expect(diffResult.diff).toContain('import { func }');
      expect(diffResult.diff).toContain('describe');
      expect(diffResult.diff).toContain('it');
    });
  });
});














