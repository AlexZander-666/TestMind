/**
 * DiffGenerator - 统一 Diff 格式生成器
 * 
 * 生成标准的 Unified Diff 格式，兼容 git diff
 */

import { createComponentLogger } from '../utils/logger';

const logger = createComponentLogger('DiffGenerator');

export interface DiffOptions {
  context?: number; // 上下文行数，默认 3
  includeTimestamp?: boolean;
  color?: boolean;
}

export interface GeneratedDiff {
  filePath: string;
  diff: string;
  additions: number;
  deletions: number;
  hunks: DiffHunk[];
}

export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
}

export interface DiffLine {
  type: 'context' | 'addition' | 'deletion';
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

/**
 * Diff 生成器
 */
export class DiffGenerator {
  /**
   * 生成 Unified Diff
   */
  generateDiff(
    originalCode: string,
    modifiedCode: string,
    filePath: string,
    options: DiffOptions = {}
  ): GeneratedDiff {
    logger.debug('Generating diff', { filePath });

    const contextLines = options.context ?? 3;

    // 1. 分割为行
    const originalLines = originalCode.split('\n');
    const modifiedLines = modifiedCode.split('\n');

    // 2. 计算差异
    const changes = this.computeDiff(originalLines, modifiedLines);

    // 3. 生成 hunks
    const hunks = this.generateHunks(changes, originalLines, modifiedLines, contextLines);

    // 4. 生成 diff 字符串
    const diff = this.formatUnifiedDiff(filePath, hunks, options);

    // 5. 统计添加和删除
    const { additions, deletions } = this.countChanges(hunks);

    logger.debug('Diff generated', {
      filePath,
      additions,
      deletions,
      hunks: hunks.length,
    });

    return {
      filePath,
      diff,
      additions,
      deletions,
      hunks,
    };
  }

  /**
   * 计算两个文本的差异（Myers diff 算法简化版）
   */
  private computeDiff(
    oldLines: string[],
    newLines: string[]
  ): Array<{ type: 'add' | 'delete' | 'equal'; oldIndex: number; newIndex: number }> {
    const changes: Array<{ type: 'add' | 'delete' | 'equal'; oldIndex: number; newIndex: number }> = [];

    // 简化的 diff 算法（实际应使用 Myers diff）
    let i = 0;
    let j = 0;

    while (i < oldLines.length || j < newLines.length) {
      if (i < oldLines.length && j < newLines.length && oldLines[i] === newLines[j]) {
        changes.push({ type: 'equal', oldIndex: i, newIndex: j });
        i++;
        j++;
      } else if (j < newLines.length && (i >= oldLines.length || oldLines[i] !== newLines[j])) {
        changes.push({ type: 'add', oldIndex: -1, newIndex: j });
        j++;
      } else if (i < oldLines.length) {
        changes.push({ type: 'delete', oldIndex: i, newIndex: -1 });
        i++;
      }
    }

    return changes;
  }

  /**
   * 生成 diff hunks
   */
  private generateHunks(
    changes: Array<{ type: string; oldIndex: number; newIndex: number }>,
    oldLines: string[],
    newLines: string[],
    contextLines: number
  ): DiffHunk[] {
    const hunks: DiffHunk[] = [];
    let currentHunk: DiffLine[] = [];
    let hunkOldStart = -1;
    let hunkNewStart = -1;
    let oldLineNum = 0;
    let newLineNum = 0;

    const flushHunk = () => {
      if (currentHunk.length > 0 && hunkOldStart >= 0 && hunkNewStart >= 0) {
        const oldLinesCount = currentHunk.filter(
          l => l.type === 'context' || l.type === 'deletion'
        ).length;
        const newLinesCount = currentHunk.filter(
          l => l.type === 'context' || l.type === 'addition'
        ).length;

        hunks.push({
          oldStart: hunkOldStart + 1, // 1-based
          oldLines: oldLinesCount,
          newStart: hunkNewStart + 1, // 1-based
          newLines: newLinesCount,
          lines: currentHunk,
        });

        currentHunk = [];
        hunkOldStart = -1;
        hunkNewStart = -1;
      }
    };

    for (let i = 0; i < changes.length; i++) {
      const change = changes[i];

      if (change.type === 'equal') {
        // 检查是否需要开始新的 hunk
        if (hunkOldStart === -1) {
          hunkOldStart = change.oldIndex;
          hunkNewStart = change.newIndex;
        }

        currentHunk.push({
          type: 'context',
          content: oldLines[change.oldIndex],
          oldLineNumber: oldLineNum++,
          newLineNumber: newLineNum++,
        });
      } else if (change.type === 'delete') {
        if (hunkOldStart === -1) {
          hunkOldStart = change.oldIndex;
          hunkNewStart = newLineNum;
        }

        currentHunk.push({
          type: 'deletion',
          content: oldLines[change.oldIndex],
          oldLineNumber: oldLineNum++,
        });
      } else if (change.type === 'add') {
        if (hunkNewStart === -1) {
          hunkOldStart = oldLineNum;
          hunkNewStart = change.newIndex;
        }

        currentHunk.push({
          type: 'addition',
          content: newLines[change.newIndex],
          newLineNumber: newLineNum++,
        });
      }
    }

    flushHunk();

    return hunks;
  }

  /**
   * 格式化为 Unified Diff 格式
   */
  private formatUnifiedDiff(
    filePath: string,
    hunks: DiffHunk[],
    options: DiffOptions
  ): string {
    const lines: string[] = [];

    // 文件头
    lines.push(`--- a/${filePath}`);
    lines.push(`+++ b/${filePath}`);

    // 每个 hunk
    for (const hunk of hunks) {
      // Hunk 头: @@ -oldStart,oldLines +newStart,newLines @@
      lines.push(
        `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`
      );

      // Hunk 内容
      for (const line of hunk.lines) {
        const prefix = this.getLinePrefix(line.type);
        lines.push(`${prefix}${line.content}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * 获取行前缀
   */
  private getLinePrefix(type: string): string {
    switch (type) {
      case 'addition':
        return '+';
      case 'deletion':
        return '-';
      case 'context':
        return ' ';
      default:
        return ' ';
    }
  }

  /**
   * 统计变更
   */
  private countChanges(hunks: DiffHunk[]): {
    additions: number;
    deletions: number;
  } {
    let additions = 0;
    let deletions = 0;

    for (const hunk of hunks) {
        for (const line of hunk.lines) {
        if (line.type === 'addition') additions++;
        if (line.type === 'deletion') deletions++;
      }
    }

    return { additions, deletions };
  }

  /**
   * 生成简洁的变更摘要
   */
  generateSummary(diff: GeneratedDiff): string {
    const { additions, deletions } = diff;
    const total = additions + deletions;

    if (total === 0) {
      return 'No changes';
    }

    const parts: string[] = [];
    if (additions > 0) parts.push(`+${additions}`);
    if (deletions > 0) parts.push(`-${deletions}`);

    return parts.join(' ');
  }

  /**
   * 批量生成 diff（多文件）
   */
  generateMultiFileDiff(
    files: Array<{
      filePath: string;
      originalCode: string;
      modifiedCode: string;
    }>,
    options: DiffOptions = {}
  ): GeneratedDiff[] {
    return files.map(file =>
      this.generateDiff(
        file.originalCode,
        file.modifiedCode,
        file.filePath,
        options
      )
    );
  }
}

  private computeLineDiff(
    oldLines: string[],
    newLines: string[]
  ): DiffLine[] {
    const result: DiffLine[] = [];
    
    // 使用简化的双指针算法
    let oldIndex = 0;
    let newIndex = 0;

    while (oldIndex < oldLines.length || newIndex < newLines.length) {
      const oldLine = oldLines[oldIndex];
      const newLine = newLines[newIndex];

      if (oldLine === newLine) {
        // 相同行 - 上下文
        result.push({
          type: 'context',
          lineNumber: oldIndex + 1,
          content: oldLine
        });
        oldIndex++;
        newIndex++;
      } else {
        // 查找下一个匹配点
        const matchPoint = this.findNextMatch(
          oldLines,
          newLines,
          oldIndex,
          newIndex
        );

        if (matchPoint) {
          // 删除旧行
          while (oldIndex < matchPoint.oldIndex) {
            result.push({
              type: 'deletion',
              lineNumber: oldIndex + 1,
              content: oldLines[oldIndex]
            });
            oldIndex++;
          }

          // 添加新行
          while (newIndex < matchPoint.newIndex) {
            result.push({
              type: 'addition',
              lineNumber: newIndex + 1,
              content: newLines[newIndex]
            });
            newIndex++;
          }
        } else {
          // 没有更多匹配，处理剩余
          if (oldIndex < oldLines.length) {
            result.push({
              type: 'deletion',
              lineNumber: oldIndex + 1,
              content: oldLines[oldIndex]
            });
            oldIndex++;
          }
          if (newIndex < newLines.length) {
            result.push({
              type: 'addition',
              lineNumber: newIndex + 1,
              content: newLines[newIndex]
            });
            newIndex++;
          }
        }
      }
    }

    return result;
  }

  /**
   * 查找下一个匹配点
   */
  private findNextMatch(
    oldLines: string[],
    newLines: string[],
    oldStart: number,
    newStart: number
  ): { oldIndex: number; newIndex: number } | null {
    const searchWindow = 10; // 向前搜索的窗口大小

    for (let offset = 1; offset < searchWindow; offset++) {
      const oldIdx = oldStart + offset;
      const newIdx = newStart + offset;

      if (oldIdx < oldLines.length && newIdx < newLines.length) {
        if (oldLines[oldIdx] === newLines[newIdx]) {
          return { oldIndex: oldIdx, newIndex: newIdx };
        }
      }
    }

    return null;
  }

  /**
   * 将 diff 行分组为 hunks
   */
  private groupIntoHunks(
    diffLines: DiffLine[],
    oldLines: string[],
    newLines: string[]
  ): DiffHunk[] {
    const hunks: DiffHunk[] = [];
    const contextLines = this.options.contextLines;

    let currentHunk: DiffHunk | null = null;
    let contextBuffer: DiffLine[] = [];

    for (let i = 0; i < diffLines.length; i++) {
      const line = diffLines[i];

      if (line.type === 'context') {
        if (!currentHunk) {
          // 暂存上下文
          contextBuffer.push(line);
          if (contextBuffer.length > contextLines) {
            contextBuffer.shift();
          }
        } else {
          // 在 hunk 中的上下文
          contextBuffer.push(line);
          
          // 检查是否应该关闭当前 hunk
          if (contextBuffer.length > contextLines * 2) {
            // 添加上下文并关闭 hunk
            currentHunk.lines.push(...contextBuffer.slice(0, contextLines));
            this.finalizeHunk(currentHunk);
            hunks.push(currentHunk);
            
            // 重置
            currentHunk = null;
            contextBuffer = contextBuffer.slice(-contextLines);
          }
        }
      } else {
        // 添加或删除行
        if (!currentHunk) {
          // 创建新 hunk
          currentHunk = {
            oldStart: Math.max(1, line.lineNumber - contextBuffer.length),
            oldLines: 0,
            newStart: Math.max(1, line.lineNumber - contextBuffer.length),
            newLines: 0,
            lines: [...contextBuffer]
          };
          contextBuffer = [];
        }

        currentHunk.lines.push(line);
      }
    }

    // 完成最后一个 hunk
    if (currentHunk) {
      currentHunk.lines.push(...contextBuffer.slice(0, contextLines));
      this.finalizeHunk(currentHunk);
      hunks.push(currentHunk);
    }

    return hunks;
  }

  /**
   * 完成 hunk 的行数统计
   */
  private finalizeHunk(hunk: DiffHunk): void {
    let oldLines = 0;
    let newLines = 0;

    for (const line of hunk.lines) {
      if (line.type === 'deletion' || line.type === 'context') {
        oldLines++;
      }
      if (line.type === 'addition' || line.type === 'context') {
        newLines++;
      }
    }

    hunk.oldLines = oldLines;
    hunk.newLines = newLines;
  }

  /**
   * 获取行前缀符号
   */
  private getLinePrefix(type: DiffLine['type']): string {
    switch (type) {
      case 'addition':
        return '+';
      case 'deletion':
        return '-';
      case 'context':
        return ' ';
    }
  }

  /**
   * 生成彩色终端输出
   */
  formatColoredDiff(diff: FileDiff): string {
    const lines: string[] = [];

    // 文件头（cyan）
    lines.push(`\x1b[36m--- ${diff.filePath}\x1b[0m`);
    lines.push(`\x1b[36m+++ ${diff.filePath}\x1b[0m`);
    lines.push('');

    for (const hunk of diff.hunks) {
      // Hunk 头（magenta）
      lines.push(
        `\x1b[35m@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@\x1b[0m`
      );

      for (const line of hunk.lines) {
        let colored: string;
        const content = line.content || '';

        switch (line.type) {
          case 'addition':
            colored = `\x1b[32m+${content}\x1b[0m`; // green
            break;
          case 'deletion':
            colored = `\x1b[31m-${content}\x1b[0m`; // red
            break;
          case 'context':
            colored = ` ${content}`;
            break;
        }

        lines.push(colored);
      }

      lines.push('');
    }

    return lines.join('\n');
  }
}

/**
 * 便捷工厂函数
 */
export function createDiffGenerator(options?: DiffOptions): DiffGenerator {
  return new DiffGenerator(options);
}


  private computeLineDiff(
    oldLines: string[],
    newLines: string[]
  ): DiffLine[] {
    const result: DiffLine[] = [];
    
    // 使用简化的双指针算法
    let oldIndex = 0;
    let newIndex = 0;

    while (oldIndex < oldLines.length || newIndex < newLines.length) {
      const oldLine = oldLines[oldIndex];
      const newLine = newLines[newIndex];

      if (oldLine === newLine) {
        // 相同行 - 上下文
        result.push({
          type: 'context',
          lineNumber: oldIndex + 1,
          content: oldLine
        });
        oldIndex++;
        newIndex++;
      } else {
        // 查找下一个匹配点
        const matchPoint = this.findNextMatch(
          oldLines,
          newLines,
          oldIndex,
          newIndex
        );

        if (matchPoint) {
          // 删除旧行
          while (oldIndex < matchPoint.oldIndex) {
            result.push({
              type: 'deletion',
              lineNumber: oldIndex + 1,
              content: oldLines[oldIndex]
            });
            oldIndex++;
          }

          // 添加新行
          while (newIndex < matchPoint.newIndex) {
            result.push({
              type: 'addition',
              lineNumber: newIndex + 1,
              content: newLines[newIndex]
            });
            newIndex++;
          }
        } else {
          // 没有更多匹配，处理剩余
          if (oldIndex < oldLines.length) {
            result.push({
              type: 'deletion',
              lineNumber: oldIndex + 1,
              content: oldLines[oldIndex]
            });
            oldIndex++;
          }
          if (newIndex < newLines.length) {
            result.push({
              type: 'addition',
              lineNumber: newIndex + 1,
              content: newLines[newIndex]
            });
            newIndex++;
          }
        }
      }
    }

    return result;
  }

  /**
   * 查找下一个匹配点
   */
  private findNextMatch(
    oldLines: string[],
    newLines: string[],
    oldStart: number,
    newStart: number
  ): { oldIndex: number; newIndex: number } | null {
    const searchWindow = 10; // 向前搜索的窗口大小

    for (let offset = 1; offset < searchWindow; offset++) {
      const oldIdx = oldStart + offset;
      const newIdx = newStart + offset;

      if (oldIdx < oldLines.length && newIdx < newLines.length) {
        if (oldLines[oldIdx] === newLines[newIdx]) {
          return { oldIndex: oldIdx, newIndex: newIdx };
        }
      }
    }

    return null;
  }

  /**
   * 将 diff 行分组为 hunks
   */
  private groupIntoHunks(
    diffLines: DiffLine[],
    oldLines: string[],
    newLines: string[]
  ): DiffHunk[] {
    const hunks: DiffHunk[] = [];
    const contextLines = this.options.contextLines;

    let currentHunk: DiffHunk | null = null;
    let contextBuffer: DiffLine[] = [];

    for (let i = 0; i < diffLines.length; i++) {
      const line = diffLines[i];

      if (line.type === 'context') {
        if (!currentHunk) {
          // 暂存上下文
          contextBuffer.push(line);
          if (contextBuffer.length > contextLines) {
            contextBuffer.shift();
          }
        } else {
          // 在 hunk 中的上下文
          contextBuffer.push(line);
          
          // 检查是否应该关闭当前 hunk
          if (contextBuffer.length > contextLines * 2) {
            // 添加上下文并关闭 hunk
            currentHunk.lines.push(...contextBuffer.slice(0, contextLines));
            this.finalizeHunk(currentHunk);
            hunks.push(currentHunk);
            
            // 重置
            currentHunk = null;
            contextBuffer = contextBuffer.slice(-contextLines);
          }
        }
      } else {
        // 添加或删除行
        if (!currentHunk) {
          // 创建新 hunk
          currentHunk = {
            oldStart: Math.max(1, line.lineNumber - contextBuffer.length),
            oldLines: 0,
            newStart: Math.max(1, line.lineNumber - contextBuffer.length),
            newLines: 0,
            lines: [...contextBuffer]
          };
          contextBuffer = [];
        }

        currentHunk.lines.push(line);
      }
    }

    // 完成最后一个 hunk
    if (currentHunk) {
      currentHunk.lines.push(...contextBuffer.slice(0, contextLines));
      this.finalizeHunk(currentHunk);
      hunks.push(currentHunk);
    }

    return hunks;
  }

  /**
   * 完成 hunk 的行数统计
   */
  private finalizeHunk(hunk: DiffHunk): void {
    let oldLines = 0;
    let newLines = 0;

    for (const line of hunk.lines) {
      if (line.type === 'deletion' || line.type === 'context') {
        oldLines++;
      }
      if (line.type === 'addition' || line.type === 'context') {
        newLines++;
      }
    }

    hunk.oldLines = oldLines;
    hunk.newLines = newLines;
  }

  /**
   * 获取行前缀符号
   */
  private getLinePrefix(type: DiffLine['type']): string {
    switch (type) {
      case 'addition':
        return '+';
      case 'deletion':
        return '-';
      case 'context':
        return ' ';
    }
  }

  /**
   * 生成彩色终端输出
   */
  formatColoredDiff(diff: FileDiff): string {
    const lines: string[] = [];

    // 文件头（cyan）
    lines.push(`\x1b[36m--- ${diff.filePath}\x1b[0m`);
    lines.push(`\x1b[36m+++ ${diff.filePath}\x1b[0m`);
    lines.push('');

    for (const hunk of diff.hunks) {
      // Hunk 头（magenta）
      lines.push(
        `\x1b[35m@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@\x1b[0m`
      );

      for (const line of hunk.lines) {
        let colored: string;
        const content = line.content || '';

        switch (line.type) {
          case 'addition':
            colored = `\x1b[32m+${content}\x1b[0m`; // green
            break;
          case 'deletion':
            colored = `\x1b[31m-${content}\x1b[0m`; // red
            break;
          case 'context':
            colored = ` ${content}`;
            break;
        }

        lines.push(colored);
      }

      lines.push('');
    }

    return lines.join('\n');
  }
}

/**
 * 便捷工厂函数
 */
export function createDiffGenerator(options?: DiffOptions): DiffGenerator {
  return new DiffGenerator(options);
}

