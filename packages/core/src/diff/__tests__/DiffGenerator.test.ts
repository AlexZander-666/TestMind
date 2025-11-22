/**
 * DiffGenerator单元测试
 */

import { describe, it, expect } from 'vitest';
import { DiffGenerator } from '../DiffGenerator';

describe('DiffGenerator', () => {
  let generator: DiffGenerator;

  beforeEach(() => {
    generator = new DiffGenerator();
  });

  describe('generateFileDiff', () => {
    it('should generate diff for modified file', () => {
      const oldContent = 'function add(a, b) {\n  return a + b;\n}';
      const newContent = 'function add(a: number, b: number): number {\n  return a + b;\n}';

      const diff = generator.generateFileDiff('math.ts', oldContent, newContent);

      expect(diff).toBeDefined();
      expect(diff.filePath).toBe('math.ts');
      expect(diff.operation).toBe('modify');
      expect(diff.hunks.length).toBeGreaterThan(0);
    });

    it('should generate diff for new file', () => {
      const newContent = 'export const VERSION = "1.0.0";';

      const diff = generator.generateFileDiff('version.ts', '', newContent);

      expect(diff.operation).toBe('create');
      expect(diff.oldContent).toBe('');
      expect(diff.newContent).toBe(newContent);
    });

    it('should generate diff for deleted file', () => {
      const oldContent = 'const deprecated = true;';

      const diff = generator.generateFileDiff('old.ts', oldContent, '');

      expect(diff.operation).toBe('delete');
      expect(diff.oldContent).toBe(oldContent);
      expect(diff.newContent).toBe('');
    });

    it('should handle multi-line changes', () => {
      const oldContent = `line1\nline2\nline3\nline4\nline5`;
      const newContent = `line1\nmodified line2\nline3\nmodified line4\nline5`;

      const diff = generator.generateFileDiff('file.ts', oldContent, newContent);

      expect(diff.hunks.length).toBeGreaterThan(0);
      
      // 应该检测到2处修改
      const totalChanges = diff.hunks.reduce((sum, hunk) => {
        return sum + hunk.lines.filter(l => l.type === 'addition' || l.type === 'deletion').length;
      }, 0);
      
      expect(totalChanges).toBeGreaterThan(0);
    });
  });

  describe('formatUnifiedDiff', () => {
    it('should format diff in unified format', () => {
      const oldContent = 'old line';
      const newContent = 'new line';

      const diff = generator.generateFileDiff('test.ts', oldContent, newContent);
      const formatted = generator.formatUnifiedDiff(diff);

      expect(formatted).toContain('--- test.ts');
      expect(formatted).toContain('+++ test.ts');
      expect(formatted).toContain('@@');
      expect(formatted).toContain('-');
      expect(formatted).toContain('+');
    });

    it('should include line numbers when enabled', () => {
      const generatorWithNumbers = new DiffGenerator({ showLineNumbers: true });
      
      const diff = generatorWithNumbers.generateFileDiff(
        'test.ts',
        'line1\nline2',
        'line1\nmodified'
      );
      
      const formatted = generatorWithNumbers.formatUnifiedDiff(diff);
      
      expect(formatted).toMatch(/\|\s*\d/); // 包含行号格式
    });
  });

  describe('generateSummary', () => {
    it('should generate summary for single file', () => {
      const diff = generator.generateFileDiff(
        'test.ts',
        'old\nold2',
        'new\nnew2'
      );

      const summary = generator.generateSummary([diff]);

      expect(summary).toContain('1 file');
      expect(summary).toMatch(/\d+ insertion/);
      expect(summary).toMatch(/\d+ deletion/);
    });

    it('should generate summary for multiple files', () => {
      const diff1 = generator.generateFileDiff('file1.ts', 'old', 'new');
      const diff2 = generator.generateFileDiff('file2.ts', 'old', 'new');

      const summary = generator.generateSummary([diff1, diff2]);

      expect(summary).toContain('2 file');
    });
  });

  describe('formatColoredDiff', () => {
    it('should generate colored output for terminal', () => {
      const diff = generator.generateFileDiff(
        'test.ts',
        'old line',
        'new line'
      );

      const colored = generator.formatColoredDiff(diff);

      // 应该包含ANSI颜色代码
      expect(colored).toMatch(/\x1b\[\d+m/);
      expect(colored).toContain('test.ts');
    });

    it('should use different colors for additions and deletions', () => {
      const diff = generator.generateFileDiff(
        'test.ts',
        'removed',
        'added'
      );

      const colored = generator.formatColoredDiff(diff);

      // 绿色（添加）和红色（删除）
      expect(colored).toContain('\x1b[32m'); // green
      expect(colored).toContain('\x1b[31m'); // red
    });
  });

  describe('edge cases', () => {
    it('should handle empty files', () => {
      const diff = generator.generateFileDiff('empty.ts', '', '');

      expect(diff.operation).toBe('modify');
      expect(diff.hunks.length).toBe(0);
    });

    it('should handle very long files', () => {
      const longContent = 'line\n'.repeat(1000);
      const modifiedContent = 'line\n'.repeat(500) + 'modified\n' + 'line\n'.repeat(500);

      const diff = generator.generateFileDiff('long.ts', longContent, modifiedContent);

      expect(diff).toBeDefined();
      expect(diff.hunks.length).toBeGreaterThan(0);
    });

    it('should handle files with no changes', () => {
      const content = 'unchanged content';

      const diff = generator.generateFileDiff('same.ts', content, content);

      expect(diff.operation).toBe('modify');
      expect(diff.hunks.length).toBe(0);
    });
  });
});

 * DiffGenerator单元测试
 */

import { describe, it, expect } from 'vitest';
import { DiffGenerator } from '../DiffGenerator';

describe('DiffGenerator', () => {
  let generator: DiffGenerator;

  beforeEach(() => {
    generator = new DiffGenerator();
  });

  describe('generateFileDiff', () => {
    it('should generate diff for modified file', () => {
      const oldContent = 'function add(a, b) {\n  return a + b;\n}';
      const newContent = 'function add(a: number, b: number): number {\n  return a + b;\n}';

      const diff = generator.generateFileDiff('math.ts', oldContent, newContent);

      expect(diff).toBeDefined();
      expect(diff.filePath).toBe('math.ts');
      expect(diff.operation).toBe('modify');
      expect(diff.hunks.length).toBeGreaterThan(0);
    });

    it('should generate diff for new file', () => {
      const newContent = 'export const VERSION = "1.0.0";';

      const diff = generator.generateFileDiff('version.ts', '', newContent);

      expect(diff.operation).toBe('create');
      expect(diff.oldContent).toBe('');
      expect(diff.newContent).toBe(newContent);
    });

    it('should generate diff for deleted file', () => {
      const oldContent = 'const deprecated = true;';

      const diff = generator.generateFileDiff('old.ts', oldContent, '');

      expect(diff.operation).toBe('delete');
      expect(diff.oldContent).toBe(oldContent);
      expect(diff.newContent).toBe('');
    });

    it('should handle multi-line changes', () => {
      const oldContent = `line1\nline2\nline3\nline4\nline5`;
      const newContent = `line1\nmodified line2\nline3\nmodified line4\nline5`;

      const diff = generator.generateFileDiff('file.ts', oldContent, newContent);

      expect(diff.hunks.length).toBeGreaterThan(0);
      
      // 应该检测到2处修改
      const totalChanges = diff.hunks.reduce((sum, hunk) => {
        return sum + hunk.lines.filter(l => l.type === 'addition' || l.type === 'deletion').length;
      }, 0);
      
      expect(totalChanges).toBeGreaterThan(0);
    });
  });

  describe('formatUnifiedDiff', () => {
    it('should format diff in unified format', () => {
      const oldContent = 'old line';
      const newContent = 'new line';

      const diff = generator.generateFileDiff('test.ts', oldContent, newContent);
      const formatted = generator.formatUnifiedDiff(diff);

      expect(formatted).toContain('--- test.ts');
      expect(formatted).toContain('+++ test.ts');
      expect(formatted).toContain('@@');
      expect(formatted).toContain('-');
      expect(formatted).toContain('+');
    });

    it('should include line numbers when enabled', () => {
      const generatorWithNumbers = new DiffGenerator({ showLineNumbers: true });
      
      const diff = generatorWithNumbers.generateFileDiff(
        'test.ts',
        'line1\nline2',
        'line1\nmodified'
      );
      
      const formatted = generatorWithNumbers.formatUnifiedDiff(diff);
      
      expect(formatted).toMatch(/\|\s*\d/); // 包含行号格式
    });
  });

  describe('generateSummary', () => {
    it('should generate summary for single file', () => {
      const diff = generator.generateFileDiff(
        'test.ts',
        'old\nold2',
        'new\nnew2'
      );

      const summary = generator.generateSummary([diff]);

      expect(summary).toContain('1 file');
      expect(summary).toMatch(/\d+ insertion/);
      expect(summary).toMatch(/\d+ deletion/);
    });

    it('should generate summary for multiple files', () => {
      const diff1 = generator.generateFileDiff('file1.ts', 'old', 'new');
      const diff2 = generator.generateFileDiff('file2.ts', 'old', 'new');

      const summary = generator.generateSummary([diff1, diff2]);

      expect(summary).toContain('2 file');
    });
  });

  describe('formatColoredDiff', () => {
    it('should generate colored output for terminal', () => {
      const diff = generator.generateFileDiff(
        'test.ts',
        'old line',
        'new line'
      );

      const colored = generator.formatColoredDiff(diff);

      // 应该包含ANSI颜色代码
      expect(colored).toMatch(/\x1b\[\d+m/);
      expect(colored).toContain('test.ts');
    });

    it('should use different colors for additions and deletions', () => {
      const diff = generator.generateFileDiff(
        'test.ts',
        'removed',
        'added'
      );

      const colored = generator.formatColoredDiff(diff);

      // 绿色（添加）和红色（删除）
      expect(colored).toContain('\x1b[32m'); // green
      expect(colored).toContain('\x1b[31m'); // red
    });
  });

  describe('edge cases', () => {
    it('should handle empty files', () => {
      const diff = generator.generateFileDiff('empty.ts', '', '');

      expect(diff.operation).toBe('modify');
      expect(diff.hunks.length).toBe(0);
    });

    it('should handle very long files', () => {
      const longContent = 'line\n'.repeat(1000);
      const modifiedContent = 'line\n'.repeat(500) + 'modified\n' + 'line\n'.repeat(500);

      const diff = generator.generateFileDiff('long.ts', longContent, modifiedContent);

      expect(diff).toBeDefined();
      expect(diff.hunks.length).toBeGreaterThan(0);
    });

    it('should handle files with no changes', () => {
      const content = 'unchanged content';

      const diff = generator.generateFileDiff('same.ts', content, content);

      expect(diff.operation).toBe('modify');
      expect(diff.hunks.length).toBe(0);
    });
  });
});

 * DiffGenerator单元测试
 */

import { describe, it, expect } from 'vitest';
import { DiffGenerator } from '../DiffGenerator';

describe('DiffGenerator', () => {
  let generator: DiffGenerator;

  beforeEach(() => {
    generator = new DiffGenerator();
  });

  describe('generateFileDiff', () => {
    it('should generate diff for modified file', () => {
      const oldContent = 'function add(a, b) {\n  return a + b;\n}';
      const newContent = 'function add(a: number, b: number): number {\n  return a + b;\n}';

      const diff = generator.generateFileDiff('math.ts', oldContent, newContent);

      expect(diff).toBeDefined();
      expect(diff.filePath).toBe('math.ts');
      expect(diff.operation).toBe('modify');
      expect(diff.hunks.length).toBeGreaterThan(0);
    });

    it('should generate diff for new file', () => {
      const newContent = 'export const VERSION = "1.0.0";';

      const diff = generator.generateFileDiff('version.ts', '', newContent);

      expect(diff.operation).toBe('create');
      expect(diff.oldContent).toBe('');
      expect(diff.newContent).toBe(newContent);
    });

    it('should generate diff for deleted file', () => {
      const oldContent = 'const deprecated = true;';

      const diff = generator.generateFileDiff('old.ts', oldContent, '');

      expect(diff.operation).toBe('delete');
      expect(diff.oldContent).toBe(oldContent);
      expect(diff.newContent).toBe('');
    });

    it('should handle multi-line changes', () => {
      const oldContent = `line1\nline2\nline3\nline4\nline5`;
      const newContent = `line1\nmodified line2\nline3\nmodified line4\nline5`;

      const diff = generator.generateFileDiff('file.ts', oldContent, newContent);

      expect(diff.hunks.length).toBeGreaterThan(0);
      
      // 应该检测到2处修改
      const totalChanges = diff.hunks.reduce((sum, hunk) => {
        return sum + hunk.lines.filter(l => l.type === 'addition' || l.type === 'deletion').length;
      }, 0);
      
      expect(totalChanges).toBeGreaterThan(0);
    });
  });

  describe('formatUnifiedDiff', () => {
    it('should format diff in unified format', () => {
      const oldContent = 'old line';
      const newContent = 'new line';

      const diff = generator.generateFileDiff('test.ts', oldContent, newContent);
      const formatted = generator.formatUnifiedDiff(diff);

      expect(formatted).toContain('--- test.ts');
      expect(formatted).toContain('+++ test.ts');
      expect(formatted).toContain('@@');
      expect(formatted).toContain('-');
      expect(formatted).toContain('+');
    });

    it('should include line numbers when enabled', () => {
      const generatorWithNumbers = new DiffGenerator({ showLineNumbers: true });
      
      const diff = generatorWithNumbers.generateFileDiff(
        'test.ts',
        'line1\nline2',
        'line1\nmodified'
      );
      
      const formatted = generatorWithNumbers.formatUnifiedDiff(diff);
      
      expect(formatted).toMatch(/\|\s*\d/); // 包含行号格式
    });
  });

  describe('generateSummary', () => {
    it('should generate summary for single file', () => {
      const diff = generator.generateFileDiff(
        'test.ts',
        'old\nold2',
        'new\nnew2'
      );

      const summary = generator.generateSummary([diff]);

      expect(summary).toContain('1 file');
      expect(summary).toMatch(/\d+ insertion/);
      expect(summary).toMatch(/\d+ deletion/);
    });

    it('should generate summary for multiple files', () => {
      const diff1 = generator.generateFileDiff('file1.ts', 'old', 'new');
      const diff2 = generator.generateFileDiff('file2.ts', 'old', 'new');

      const summary = generator.generateSummary([diff1, diff2]);

      expect(summary).toContain('2 file');
    });
  });

  describe('formatColoredDiff', () => {
    it('should generate colored output for terminal', () => {
      const diff = generator.generateFileDiff(
        'test.ts',
        'old line',
        'new line'
      );

      const colored = generator.formatColoredDiff(diff);

      // 应该包含ANSI颜色代码
      expect(colored).toMatch(/\x1b\[\d+m/);
      expect(colored).toContain('test.ts');
    });

    it('should use different colors for additions and deletions', () => {
      const diff = generator.generateFileDiff(
        'test.ts',
        'removed',
        'added'
      );

      const colored = generator.formatColoredDiff(diff);

      // 绿色（添加）和红色（删除）
      expect(colored).toContain('\x1b[32m'); // green
      expect(colored).toContain('\x1b[31m'); // red
    });
  });

  describe('edge cases', () => {
    it('should handle empty files', () => {
      const diff = generator.generateFileDiff('empty.ts', '', '');

      expect(diff.operation).toBe('modify');
      expect(diff.hunks.length).toBe(0);
    });

    it('should handle very long files', () => {
      const longContent = 'line\n'.repeat(1000);
      const modifiedContent = 'line\n'.repeat(500) + 'modified\n' + 'line\n'.repeat(500);

      const diff = generator.generateFileDiff('long.ts', longContent, modifiedContent);

      expect(diff).toBeDefined();
      expect(diff.hunks.length).toBeGreaterThan(0);
    });

    it('should handle files with no changes', () => {
      const content = 'unchanged content';

      const diff = generator.generateFileDiff('same.ts', content, content);

      expect(diff.operation).toBe('modify');
      expect(diff.hunks.length).toBe(0);
    });
  });
});

