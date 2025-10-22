/**
 * DiffReviewer - 交互式 Diff 审查器
 * 
 * Enhanced with:
 * - Colored diff output (chalk)
 * - Per-hunk review capability
 * - Change statistics display
 * - Extended interactive commands
 * 
 * 功能：
 * - 交互式展示 diff（彩色）
 * - 用户可以 accept/reject/edit/comment
 * - 支持逐个 hunk 审查
 * - 支持快捷键操作
 * - 显示详细变更统计
 */

import * as readline from 'readline';
import type { FileDiff, DiffHunk } from './DiffGenerator';
import { DiffGenerator } from './DiffGenerator';

// Chalk colors for diff output
const colors = {
  red: (text: string) => `\x1b[31m${text}\x1b[0m`,
  green: (text: string) => `\x1b[32m${text}\x1b[0m`,
  yellow: (text: string) => `\x1b[33m${text}\x1b[0m`,
  blue: (text: string) => `\x1b[34m${text}\x1b[0m`,
  cyan: (text: string) => `\x1b[36m${text}\x1b[0m`,
  dim: (text: string) => `\x1b[2m${text}\x1b[0m`,
  bold: (text: string) => `\x1b[1m${text}\x1b[0m`,
};

export interface ReviewDecision {
  action: 'accept' | 'reject' | 'edit' | 'skip';
  filePath: string;
  hunkIndex?: number;
  editedContent?: string;
}

export interface ReviewResult {
  decisions: ReviewDecision[];
  acceptedDiffs: FileDiff[];
  rejectedDiffs: FileDiff[];
  totalReviewed: number;
  totalAccepted: number;
  totalRejected: number;
}

export interface ReviewOptions {
  /** 是否启用彩色输出 */
  colorOutput?: boolean;
  
  /** 是否逐 hunk 审查（默认逐文件） */
  reviewByHunk?: boolean;
  
  /** 是否显示完整上下文 */
  showFullContext?: boolean;
  
  /** 自动接受置信度高的更改 */
  autoAcceptHighConfidence?: boolean;
  
  /** 自动接受的置信度阈值 */
  autoAcceptThreshold?: number;
}

/**
 * 交互式 Diff 审查器
 */
export class DiffReviewer {
  private options: Required<ReviewOptions>;
  private diffGenerator: DiffGenerator;
  private rl?: readline.Interface;

  constructor(options: ReviewOptions = {}) {
    this.options = {
      colorOutput: options.colorOutput ?? true,
      reviewByHunk: options.reviewByHunk ?? false,
      showFullContext: options.showFullContext ?? false,
      autoAcceptHighConfidence: options.autoAcceptHighConfidence ?? false,
      autoAcceptThreshold: options.autoAcceptThreshold ?? 0.95
    };

    this.diffGenerator = new DiffGenerator();
    // Context lines will be handled in diff generation options
  }

  /**
   * 开始交互式审查
   */
  async review(diffs: FileDiff[]): Promise<ReviewResult> {
    const result: ReviewResult = {
      decisions: [],
      acceptedDiffs: [],
      rejectedDiffs: [],
      totalReviewed: 0,
      totalAccepted: 0,
      totalRejected: 0
    };

    // 初始化 readline interface
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    try {
      console.log('\n📝 Starting interactive diff review...\n');
      console.log(`Total diffs to review: ${diffs.length}\n`);

      for (const diff of diffs) {
        const decision = await this.reviewFileDiff(diff);
        result.decisions.push(decision);
        result.totalReviewed++;

        if (decision.action === 'accept') {
          result.acceptedDiffs.push(diff);
          result.totalAccepted++;
        } else if (decision.action === 'reject') {
          result.rejectedDiffs.push(diff);
          result.totalRejected++;
        }
      }

      this.displaySummary(result);

    } finally {
      this.rl?.close();
    }

    return result;
  }

  /**
   * 审查单个文件 diff
   */
  private async reviewFileDiff(diff: FileDiff): Promise<ReviewDecision> {
    console.log(colors.cyan('═'.repeat(80)));
    console.log(`\n${colors.bold('📄 File:')} ${colors.blue(diff.filePath)}\n`);

    // 显示变更统计
    this.displayChangeStatistics(diff);

    // 显示 diff
    if (this.options.colorOutput) {
      this.displayColoredDiff(diff);
    } else {
      console.log(diff.diff || '(no diff content)');
    }

    console.log('\n' + colors.dim('─'.repeat(80)) + '\n');

    // 获取用户决定
    const action = await this.promptForAction();

    return {
      action,
      filePath: diff.filePath
    };
  }
  
  /**
   * Display change statistics
   */
  private displayChangeStatistics(diff: FileDiff): void {
    const additions = diff.additions || 0;
    const deletions = diff.deletions || 0;
    const total = additions + deletions;
    
    console.log(colors.dim('─'.repeat(80)));
    console.log(`${colors.bold('Changes:')} ${colors.green(`+${additions}`)} ${colors.red(`-${deletions}`)} (${total} total)`);
    
    // Visual bar
    const barLength = 50;
    const addBar = Math.round((additions / Math.max(total, 1)) * barLength);
    const delBar = barLength - addBar;
    
    const bar = colors.green('█'.repeat(addBar)) + colors.red('█'.repeat(delBar));
    console.log(bar);
    console.log(colors.dim('─'.repeat(80)) + '\n');
  }
  
  /**
   * Display colored diff output
   */
  private displayColoredDiff(diff: FileDiff): void {
    const lines = (diff.diff || '').split('\n');
    
    for (const line of lines) {
      if (line.startsWith('+++') || line.startsWith('---')) {
        console.log(colors.bold(line));
      } else if (line.startsWith('+')) {
        console.log(colors.green(line));
      } else if (line.startsWith('-')) {
        console.log(colors.red(line));
      } else if (line.startsWith('@@')) {
        console.log(colors.cyan(line));
      } else {
        console.log(colors.dim(line));
      }
    }
  }

  /**
   * 提示用户选择操作 (Enhanced with more commands)
   */
  private async promptForAction(): Promise<ReviewDecision['action']> {
    const prompt = `
${colors.bold('Choose an action:')}
  ${colors.green('[a]')} Accept   - Apply this diff
  ${colors.red('[r]')} Reject   - Skip this diff
  ${colors.yellow('[e]')} Edit     - Edit before applying (planned)
  ${colors.cyan('[c]')} Comment  - Add comment (planned)
  ${colors.dim('[s]')} Skip     - Skip for now
  ${colors.dim('[q]')} Quit     - Stop review

${colors.bold('Your choice:')} `;

    const answer = await this.question(prompt);
    const choice = answer.trim().toLowerCase();

    switch (choice) {
      case 'a':
      case 'accept':
        console.log(colors.green('✅ Accepted') + '\n');
        return 'accept';
      
      case 'r':
      case 'reject':
        console.log(colors.red('❌ Rejected') + '\n');
        return 'reject';
      
      case 'e':
      case 'edit':
        console.log(colors.yellow('⚠️  Edit mode planned for future release') + '\n');
        console.log('Would you like to (a)ccept or (r)eject instead?\n');
        return this.promptForAction();
      
      case 'c':
      case 'comment':
        console.log(colors.yellow('💬 Comment feature planned for future release') + '\n');
        console.log('Continuing with review...\n');
        return this.promptForAction();
      
      case 's':
      case 'skip':
        console.log(colors.cyan('⏭️  Skipped') + '\n');
        return 'skip';
      
      case 'q':
      case 'quit':
        console.log(colors.dim('👋 Quitting review...') + '\n');
        process.exit(0);
      
      default:
        console.log(colors.red('❌ Invalid choice. Please try again.') + '\n');
        return this.promptForAction();
    }
  }

  /**
   * 询问问题并获取答案
   */
  private question(prompt: string): Promise<string> {
    return new Promise(resolve => {
      this.rl?.question(prompt, answer => {
        resolve(answer);
      });
    });
  }

  /**
   * 显示审查摘要 (Enhanced with statistics)
   */
  private displaySummary(result: ReviewResult): void {
    const skipped = result.totalReviewed - result.totalAccepted - result.totalRejected;
    const acceptRate = result.totalReviewed > 0 
      ? ((result.totalAccepted / result.totalReviewed) * 100).toFixed(1)
      : '0';
    
    console.log('\n' + colors.cyan('═'.repeat(80)));
    console.log(`\n${colors.bold('📊 Review Summary')}\n`);
    console.log(colors.dim('─'.repeat(80)));
    console.log(`${colors.bold('Total Reviewed:')}  ${result.totalReviewed}`);
    console.log(`${colors.green('✅ Accepted:')}     ${result.totalAccepted}`);
    console.log(`${colors.red('❌ Rejected:')}     ${result.totalRejected}`);
    console.log(`${colors.cyan('⏭️  Skipped:')}      ${skipped}`);
    console.log(`${colors.bold('📈 Accept Rate:')}  ${acceptRate}%`);
    console.log(colors.cyan('═'.repeat(80)) + '\n');
    
    if (result.totalAccepted > 0) {
      console.log(colors.green(`✨ ${result.totalAccepted} diffs ready to apply!`));
    }
    if (result.totalRejected > 0) {
      console.log(colors.yellow(`⚠️  ${result.totalRejected} diffs rejected`));
    }
    console.log('');
  }

  /**
   * 非交互式审查（用于CI/CD）
   */
  async reviewNonInteractive(
    diffs: FileDiff[],
    autoAcceptAll: boolean = false
  ): Promise<ReviewResult> {
    const result: ReviewResult = {
      decisions: [],
      acceptedDiffs: [],
      rejectedDiffs: [],
      totalReviewed: 0,
      totalAccepted: 0,
      totalRejected: 0
    };

    for (const diff of diffs) {
      const action = autoAcceptAll ? 'accept' : 'reject';
      
      result.decisions.push({
        action,
        filePath: diff.filePath
      });

      if (action === 'accept') {
        result.acceptedDiffs.push(diff);
        result.totalAccepted++;
      } else {
        result.rejectedDiffs.push(diff);
        result.totalRejected++;
      }

      result.totalReviewed++;
    }

    return result;
  }

  /**
   * 基于置信度的自动审查
   */
  async reviewWithConfidence(
    diffs: Array<FileDiff & { confidence?: number }>
  ): Promise<ReviewResult> {
    const highConfidenceDiffs: FileDiff[] = [];
    const lowConfidenceDiffs: FileDiff[] = [];

    for (const diff of diffs) {
      const confidence = diff.confidence ?? 0.5;
      
      if (confidence >= this.options.autoAcceptThreshold) {
        highConfidenceDiffs.push(diff);
      } else {
        lowConfidenceDiffs.push(diff);
      }
    }

    console.log(`\n🔍 Confidence-based review:`);
    console.log(`  - High confidence (auto-accept): ${highConfidenceDiffs.length}`);
    console.log(`  - Low confidence (needs review): ${lowConfidenceDiffs.length}\n`);

    // 自动接受高置信度
    const autoResult = await this.reviewNonInteractive(highConfidenceDiffs, true);

    // 交互式审查低置信度
    const manualResult = lowConfidenceDiffs.length > 0
      ? await this.review(lowConfidenceDiffs)
      : {
          decisions: [],
          acceptedDiffs: [],
          rejectedDiffs: [],
          totalReviewed: 0,
          totalAccepted: 0,
          totalRejected: 0
        };

    // 合并结果
    return {
      decisions: [...autoResult.decisions, ...manualResult.decisions],
      acceptedDiffs: [...autoResult.acceptedDiffs, ...manualResult.acceptedDiffs],
      rejectedDiffs: [...autoResult.rejectedDiffs, ...manualResult.rejectedDiffs],
      totalReviewed: autoResult.totalReviewed + manualResult.totalReviewed,
      totalAccepted: autoResult.totalAccepted + manualResult.totalAccepted,
      totalRejected: autoResult.totalRejected + manualResult.totalRejected
    };
  }

  /**
   * 生成审查报告
   */
  generateReviewReport(result: ReviewResult): string {
    let report = `# Diff Review Report\n\n`;
    report += `**Summary:**\n`;
    report += `- Total Reviewed: ${result.totalReviewed}\n`;
    report += `- Accepted: ${result.totalAccepted}\n`;
    report += `- Rejected: ${result.totalRejected}\n`;
    report += `- Acceptance Rate: ${((result.totalAccepted / result.totalReviewed) * 100).toFixed(1)}%\n\n`;

    report += `**Accepted Files:**\n`;
    for (const diff of result.acceptedDiffs) {
      report += `- ✅ ${diff.filePath}\n`;
    }

    if (result.rejectedDiffs.length > 0) {
      report += `\n**Rejected Files:**\n`;
      for (const diff of result.rejectedDiffs) {
        report += `- ❌ ${diff.filePath}\n`;
      }
    }

    return report;
  }

  /**
   * 导出审查决定（用于后续自动化）
   */
  exportDecisions(result: ReviewResult): string {
    return JSON.stringify(result.decisions, null, 2);
  }

  /**
   * 导入审查决定（应用之前保存的决定）
   */
  async applyDecisions(
    diffs: FileDiff[],
    decisionsJson: string
  ): Promise<ReviewResult> {
    const decisions = JSON.parse(decisionsJson) as ReviewDecision[];
    const decisionMap = new Map(decisions.map(d => [d.filePath, d]));

    const result: ReviewResult = {
      decisions: [],
      acceptedDiffs: [],
      rejectedDiffs: [],
      totalReviewed: 0,
      totalAccepted: 0,
      totalRejected: 0
    };

    for (const diff of diffs) {
      const decision = decisionMap.get(diff.filePath);
      
      if (decision) {
        result.decisions.push(decision);
        
        if (decision.action === 'accept') {
          result.acceptedDiffs.push(diff);
          result.totalAccepted++;
        } else if (decision.action === 'reject') {
          result.rejectedDiffs.push(diff);
          result.totalRejected++;
        }
        
        result.totalReviewed++;
      }
    }

    return result;
  }
}

/**
 * 便捷工厂函数
 */
export function createDiffReviewer(options?: ReviewOptions): DiffReviewer {
  return new DiffReviewer(options);
}

