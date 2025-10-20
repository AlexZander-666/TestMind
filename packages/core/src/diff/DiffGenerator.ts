/**
 * DiffGenerator - 统一 Diff 格式生成器
 * 
 * 生成标准的 unified diff 格式
 * 支持：
 * - 文件级 diff
 * - 行级精确修改
 * - 多文件批量 diff
 */

export interface DiffLine {
  type: 'context' | 'addition' | 'deletion';
  lineNumber: number;
  content: string;
}

export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
}

export interface FileDiff {
  filePath: string;
  oldContent: string;
  newContent: string;
  hunks: DiffHunk[];
  operation: 'modify' | 'create' | 'delete';
}

export interface DiffOptions {
  /** 上下文行数（默认3行） */
  contextLines?: number;
  
  /** 是否显示行号 */
  showLineNumbers?: boolean;
  
  /** 是否压缩连续的上下文 */
  compressContext?: boolean;
}

/**
 * Diff 生成器
 */
export class DiffGenerator {
  private options: Required<DiffOptions>;

  constructor(options: DiffOptions = {}) {
    this.options = {
      contextLines: options.contextLines ?? 3,
      showLineNumbers: options.showLineNumbers ?? true,
      compressContext: options.compressContext ?? true
    };
  }

  /**
   * 生成文件 diff
   */
  generateFileDiff(
    filePath: string,
    oldContent: string,
    newContent: string
  ): FileDiff {
    // 确定操作类型
    const operation = this.determineOperation(oldContent, newContent);

    // 分割为行
    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');

    // 计算行级差异
    const diffLines = this.computeLineDiff(oldLines, newLines);

    // 分组为 hunks
    const hunks = this.groupIntoHunks(diffLines, oldLines, newLines);

    return {
      filePath,
      oldContent,
      newContent,
      hunks,
      operation
    };
  }

  /**
   * 生成多文件 diff
   */
  generateMultiFileDiff(
    files: Array<{ path: string; oldContent: string; newContent: string }>
  ): FileDiff[] {
    return files.map(file => 
      this.generateFileDiff(file.path, file.oldContent, file.newContent)
    );
  }

  /**
   * 格式化为 unified diff 字符串
   */
  formatUnifiedDiff(diff: FileDiff): string {
    const lines: string[] = [];

    // 文件头
    lines.push(`--- ${diff.filePath}`);
    lines.push(`+++ ${diff.filePath}`);
    lines.push('');

    // 每个 hunk
    for (const hunk of diff.hunks) {
      // Hunk 头
      lines.push(
        `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`
      );

      // Hunk 内容
      for (const line of hunk.lines) {
        const prefix = this.getLinePrefix(line.type);
        const lineNum = this.options.showLineNumbers ? 
          ` ${line.lineNumber.toString().padStart(4, ' ')}|` : '';
        
        lines.push(`${prefix}${lineNum}${line.content}`);
      }

      lines.push(''); // 空行分隔 hunks
    }

    return lines.join('\n');
  }

  /**
   * 格式化多个文件的 diff
   */
  formatMultiFileDiff(diffs: FileDiff[]): string {
    return diffs.map(diff => this.formatUnifiedDiff(diff)).join('\n\n');
  }

  /**
   * 生成简洁的摘要
   */
  generateSummary(diffs: FileDiff[]): string {
    const totalFiles = diffs.length;
    let totalAdditions = 0;
    let totalDeletions = 0;

    for (const diff of diffs) {
      for (const hunk of diff.hunks) {
        for (const line of hunk.lines) {
          if (line.type === 'addition') totalAdditions++;
          if (line.type === 'deletion') totalDeletions++;
        }
      }
    }

    return `${totalFiles} file(s) changed, ${totalAdditions} insertion(+), ${totalDeletions} deletion(-)`;
  }

  /**
   * 确定操作类型
   */
  private determineOperation(
    oldContent: string,
    newContent: string
  ): 'modify' | 'create' | 'delete' {
    if (!oldContent && newContent) return 'create';
    if (oldContent && !newContent) return 'delete';
    return 'modify';
  }

  /**
   * 计算行级差异（简化的Myers算法）
   */
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

