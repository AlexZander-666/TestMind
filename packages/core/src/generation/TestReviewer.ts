/**
 * TestReviewer: Implements Diff-First review model
 * Builds trust by showing changes before applying them
 */

import type { TestSuite } from '@testmind/shared';
import { promises as fs } from 'fs';
import path from 'path';

export interface DiffResult {
  filePath: string;
  exists: boolean;
  diff: string;
  originalContent?: string;
  newContent: string;
}

export interface ReviewDecision {
  action: 'apply' | 'reject' | 'edit' | 'regenerate';
  editedContent?: string;
}

export class TestReviewer {
  /**
   * Generate a human-readable diff for the test
   */
  async generateDiff(testSuite: TestSuite): Promise<DiffResult> {
    const { filePath, code } = testSuite;
    
    let exists = false;
    let originalContent: string | undefined;

    try {
      originalContent = await fs.readFile(filePath, 'utf-8');
      exists = true;
    } catch (error) {
      // File doesn't exist yet - this is a new test
      exists = false;
    }

    // Generate diff format
    const diff = this.formatDiff(filePath, originalContent, code, exists);

    return {
      filePath,
      exists,
      diff,
      originalContent,
      newContent: code,
    };
  }

  /**
   * Format content as a git-style diff
   */
  private formatDiff(
    filePath: string,
    oldContent: string | undefined,
    newContent: string,
    exists: boolean
  ): string {
    if (!exists) {
      // New file - show as additions
      const lines = newContent.split('\n');
      const additions = lines.map((line, idx) => {
        const lineNum = (idx + 1).toString().padStart(4, ' ');
        return `+${lineNum} | ${line}`;
      }).join('\n');

      return `📝 New file: ${filePath}\n\n${additions}`;
    }

    // Existing file - show actual diff
    const oldLines = oldContent!.split('\n');
    const newLines = newContent.split('\n');

    // Simple line-by-line diff
    const diffLines: string[] = [];
    let lineNum = 1;

    for (let i = 0; i < Math.max(oldLines.length, newLines.length); i++) {
      const oldLine = oldLines[i];
      const newLine = newLines[i];

      if (oldLine === undefined) {
        // Added line
        diffLines.push(`+${lineNum.toString().padStart(4, ' ')} | ${newLine}`);
        lineNum++;
      } else if (newLine === undefined) {
        // Removed line
        diffLines.push(`-${lineNum.toString().padStart(4, ' ')} | ${oldLine}`);
      } else if (oldLine !== newLine) {
        // Changed line
        diffLines.push(`-${lineNum.toString().padStart(4, ' ')} | ${oldLine}`);
        diffLines.push(`+${lineNum.toString().padStart(4, ' ')} | ${newLine}`);
        lineNum++;
      } else {
        // Unchanged line (show context)
        if (i < 3 || i > Math.max(oldLines.length, newLines.length) - 3) {
          diffLines.push(` ${lineNum.toString().padStart(4, ' ')} | ${oldLine}`);
        } else if (diffLines[diffLines.length - 1] !== '...') {
          diffLines.push('...');
        }
        lineNum++;
      }
    }

    return `📝 Modified file: ${filePath}\n\n${diffLines.join('\n')}`;
  }

  /**
   * Apply the test to filesystem
   */
  async applyTest(testSuite: TestSuite): Promise<void> {
    const { filePath, code } = testSuite;
    
    // Ensure directory exists
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });

    // Write test file
    await fs.writeFile(filePath, code, 'utf-8');
  }

  /**
   * Format diff for CLI display with colors
   */
  formatForCLI(diffResult: DiffResult): string {
    const lines = diffResult.diff.split('\n');
    
    return lines.map(line => {
      if (line.startsWith('+')) {
        return `\x1b[32m${line}\x1b[0m`; // Green for additions
      } else if (line.startsWith('-')) {
        return `\x1b[31m${line}\x1b[0m`; // Red for deletions
      } else if (line.startsWith('📝')) {
        return `\x1b[1m\x1b[36m${line}\x1b[0m`; // Bold cyan for file header
      } else {
        return `\x1b[90m${line}\x1b[0m`; // Gray for context
      }
    }).join('\n');
  }
}














