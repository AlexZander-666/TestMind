/**
 * DiffApplier - 安全 Diff 应用器
 * 
 * 功能：
 * - 验证 diff 可应用性
 * - 安全应用 diff 到文件
 * - 检测和处理冲突
 * - 支持干运行（dry-run）模式
 * - 自动备份原文件
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { FileDiff, DiffHunk } from './DiffGenerator';

export interface ApplyResult {
  success: boolean;
  filePath: string;
  applied: boolean;
  conflicts: Conflict[];
  backupPath?: string;
  error?: string;
}

export interface Conflict {
  hunkIndex: number;
  lineNumber: number;
  reason: string;
  expected: string;
  actual: string;
}

export interface ApplyOptions {
  /** 干运行模式（不实际修改文件） */
  dryRun?: boolean;
  
  /** 是否创建备份 */
  createBackup?: boolean;
  
  /** 备份目录 */
  backupDir?: string;
  
  /** 是否允许部分应用（跳过冲突的hunks） */
  allowPartial?: boolean;
  
  /** 验证模式（strict: 严格匹配，fuzzy: 模糊匹配） */
  validationMode?: 'strict' | 'fuzzy';
}

/**
 * Diff 应用器
 */
export class DiffApplier {
  private options: Required<Omit<ApplyOptions, 'backupDir'>>;
  private backupDir?: string;

  constructor(options: ApplyOptions = {}) {
    this.options = {
      dryRun: options.dryRun ?? false,
      createBackup: options.createBackup ?? true,
      allowPartial: options.allowPartial ?? false,
      validationMode: options.validationMode ?? 'strict'
    };
    this.backupDir = options.backupDir;
  }

  /**
   * 应用单个文件 diff
   */
  async applyFileDiff(diff: FileDiff): Promise<ApplyResult> {
    const result: ApplyResult = {
      success: false,
      filePath: diff.filePath,
      applied: false,
      conflicts: []
    };

    try {
      // 1. 读取当前文件内容
      let currentContent: string;
      try {
        currentContent = await fs.readFile(diff.filePath, 'utf-8');
      } catch (error) {
        if (diff.operation === 'create') {
          currentContent = '';
        } else {
          result.error = `File not found: ${diff.filePath}`;
          return result;
        }
      }

      // 2. 验证 diff 可应用性
      const conflicts = this.validateDiff(diff, currentContent);
      result.conflicts = conflicts;

      if (conflicts.length > 0 && !this.options.allowPartial) {
        result.error = `Found ${conflicts.length} conflict(s)`;
        return result;
      }

      // 3. 创建备份（如果需要）
      if (this.options.createBackup && !this.options.dryRun && currentContent) {
        result.backupPath = await this.createBackup(diff.filePath, currentContent);
      }

      // 4. 应用 diff
      const newContent = this.applyDiffToContent(diff, currentContent, conflicts);

      // 5. 写入文件（除非是干运行）
      if (!this.options.dryRun) {
        // 确保目录存在
        await fs.mkdir(path.dirname(diff.filePath), { recursive: true });
        await fs.writeFile(diff.filePath, newContent, 'utf-8');
      }

      result.success = true;
      result.applied = conflicts.length === 0 || this.options.allowPartial;

    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
    }

    return result;
  }

  /**
   * 批量应用多个 diff
   */
  async applyMultipleDiffs(diffs: FileDiff[]): Promise<ApplyResult[]> {
    const results: ApplyResult[] = [];

    for (const diff of diffs) {
      const result = await this.applyFileDiff(diff);
      results.push(result);

      // 如果有失败且不允许部分应用，停止
      if (!result.success && !this.options.allowPartial) {
        break;
      }
    }

    return results;
  }

  /**
   * 验证 diff 可应用性
   */
  private validateDiff(diff: FileDiff, currentContent: string): Conflict[] {
    const conflicts: Conflict[] = [];
    const lines = currentContent.split('\n');

    for (let hunkIndex = 0; hunkIndex < diff.hunks.length; hunkIndex++) {
      const hunk = diff.hunks[hunkIndex];
      
      // 验证 hunk 起始位置
      const startLine = hunk.oldStart - 1; // 转换为0索引
      
      if (startLine < 0 || startLine >= lines.length) {
        conflicts.push({
          hunkIndex,
          lineNumber: hunk.oldStart,
          reason: 'Hunk start line out of range',
          expected: `Line ${hunk.oldStart}`,
          actual: `File has ${lines.length} lines`
        });
        continue;
      }

      // 验证 hunk 内容
      const hunkConflicts = this.validateHunk(hunk, lines, hunkIndex);
      conflicts.push(...hunkConflicts);
    }

    return conflicts;
  }

  /**
   * 验证单个 hunk
   */
  private validateHunk(
    hunk: DiffHunk,
    fileLines: string[],
    hunkIndex: number
  ): Conflict[] {
    const conflicts: Conflict[] = [];
    let fileLine = hunk.oldStart - 1; // 0-indexed

    for (const diffLine of hunk.lines) {
      if (diffLine.type === 'context' || diffLine.type === 'deletion') {
        // 检查上下文或删除的行是否匹配
        if (fileLine >= fileLines.length) {
          conflicts.push({
            hunkIndex,
            lineNumber: fileLine + 1,
            reason: 'Line number exceeds file length',
            expected: diffLine.content,
            actual: '<end of file>'
          });
          break;
        }

        const actualLine = fileLines[fileLine];
        const matches = this.options.validationMode === 'strict'
          ? actualLine === diffLine.content
          : this.fuzzyMatch(actualLine, diffLine.content);

        if (!matches) {
          conflicts.push({
            hunkIndex,
            lineNumber: fileLine + 1,
            reason: 'Line content mismatch',
            expected: diffLine.content,
            actual: actualLine
          });
        }

        fileLine++;
      }
      // 添加行不需要验证
    }

    return conflicts;
  }

  /**
   * 模糊匹配（忽略空白差异）
   */
  private fuzzyMatch(line1: string, line2: string): boolean {
    const normalize = (s: string) => s.trim().replace(/\s+/g, ' ');
    return normalize(line1) === normalize(line2);
  }

  /**
   * 应用 diff 到内容
   */
  private applyDiffToContent(
    diff: FileDiff,
    currentContent: string,
    conflicts: Conflict[]
  ): string {
    const lines = currentContent.split('\n');
    const conflictedHunks = new Set(conflicts.map(c => c.hunkIndex));

    // 从后向前应用 hunks，避免行号偏移问题
    const sortedHunks = [...diff.hunks]
      .sort((a, b) => b.oldStart - a.oldStart);

    for (let i = 0; i < sortedHunks.length; i++) {
      const hunk = sortedHunks[i];
      const hunkIndex = diff.hunks.indexOf(hunk);

      // 跳过有冲突的 hunk（如果允许部分应用）
      if (conflictedHunks.has(hunkIndex) && this.options.allowPartial) {
        continue;
      }

      this.applyHunk(hunk, lines);
    }

    return lines.join('\n');
  }

  /**
   * 应用单个 hunk
   */
  private applyHunk(hunk: DiffHunk, lines: string[]): void {
    const startLine = hunk.oldStart - 1; // 0-indexed
    const newLines: string[] = [];

    // 构建新行
    for (const diffLine of hunk.lines) {
      if (diffLine.type === 'addition') {
        newLines.push(diffLine.content);
      } else if (diffLine.type === 'context') {
        newLines.push(diffLine.content);
      }
      // deletion 的行跳过
    }

    // 计算要删除的行数
    const deleteCount = hunk.lines.filter(
      l => l.type === 'deletion' || l.type === 'context'
    ).length;

    // 替换行
    lines.splice(startLine, deleteCount, ...newLines);
  }

  /**
   * 创建备份文件
   */
  private async createBackup(filePath: string, content: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `${path.basename(filePath)}.backup.${timestamp}`;
    
    const backupPath = this.backupDir
      ? path.join(this.backupDir, backupFileName)
      : path.join(path.dirname(filePath), '.testmind-backups', backupFileName);

    // 确保备份目录存在
    await fs.mkdir(path.dirname(backupPath), { recursive: true });

    // 写入备份
    await fs.writeFile(backupPath, content, 'utf-8');

    return backupPath;
  }

  /**
   * 回滚到备份
   */
  async rollbackFromBackup(originalPath: string, backupPath: string): Promise<void> {
    const backupContent = await fs.readFile(backupPath, 'utf-8');
    await fs.writeFile(originalPath, backupContent, 'utf-8');
  }

  /**
   * 清理备份文件
   */
  async cleanupBackup(backupPath: string): Promise<void> {
    try {
      await fs.unlink(backupPath);
    } catch (error) {
      // 忽略删除失败
    }
  }

  /**
   * 生成应用报告
   */
  generateReport(results: ApplyResult[]): string {
    const successful = results.filter(r => r.success && r.applied).length;
    const failed = results.filter(r => !r.success).length;
    const partial = results.filter(r => r.success && !r.applied).length;

    let report = `# Diff Apply Report\n\n`;
    report += `**Summary:**\n`;
    report += `- Total: ${results.length}\n`;
    report += `- Successfully Applied: ${successful}\n`;
    report += `- Failed: ${failed}\n`;
    report += `- Partially Applied: ${partial}\n\n`;

    if (this.options.dryRun) {
      report += `_Note: This was a dry run. No files were modified._\n\n`;
    }

    report += `**Details:**\n\n`;

    for (const result of results) {
      const status = result.success
        ? (result.applied ? '✅' : '⚠️')
        : '❌';

      report += `${status} **${result.filePath}**\n`;

      if (result.conflicts.length > 0) {
        report += `  - Conflicts: ${result.conflicts.length}\n`;
        for (const conflict of result.conflicts) {
          report += `    - Line ${conflict.lineNumber}: ${conflict.reason}\n`;
        }
      }

      if (result.backupPath) {
        report += `  - Backup: ${result.backupPath}\n`;
      }

      if (result.error) {
        report += `  - Error: ${result.error}\n`;
      }

      report += '\n';
    }

    return report;
  }
}

/**
 * 便捷工厂函数
 */
export function createDiffApplier(options?: ApplyOptions): DiffApplier {
  return new DiffApplier(options);
}

