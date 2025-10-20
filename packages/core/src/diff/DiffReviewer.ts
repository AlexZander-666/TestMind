/**
 * DiffReviewer - 交互式 Diff 审查器
 * 
 * 功能：
 * - 交互式展示 diff
 * - 用户可以 accept/reject/edit
 * - 支持逐个 hunk 审查
 * - 支持快捷键操作
 */

import * as readline from 'readline';
import type { FileDiff, DiffHunk } from './DiffGenerator';
import { DiffGenerator } from './DiffGenerator';

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

    this.diffGenerator = new DiffGenerator({
      contextLines: this.options.showFullContext ? 10 : 3
    });
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
    console.log('═'.repeat(80));
    console.log(`\n📄 File: ${diff.filePath}\n`);

    // 显示 diff
    if (this.options.colorOutput) {
      console.log(this.diffGenerator.formatColoredDiff(diff));
    } else {
      console.log(this.diffGenerator.formatUnifiedDiff(diff));
    }

    console.log('\n' + '─'.repeat(80) + '\n');

    // 获取用户决定
    const action = await this.promptForAction();

    return {
      action,
      filePath: diff.filePath
    };
  }

  /**
   * 提示用户选择操作
   */
  private async promptForAction(): Promise<ReviewDecision['action']> {
    const prompt = `
Choose an action:
  [a] Accept   - Apply this diff
  [r] Reject   - Skip this diff
  [e] Edit     - Edit before applying (not implemented yet)
  [s] Skip     - Skip for now
  [q] Quit     - Stop review

Your choice: `;

    const answer = await this.question(prompt);
    const choice = answer.trim().toLowerCase();

    switch (choice) {
      case 'a':
      case 'accept':
        console.log('✅ Accepted\n');
        return 'accept';
      
      case 'r':
      case 'reject':
        console.log('❌ Rejected\n');
        return 'reject';
      
      case 'e':
      case 'edit':
        console.log('⚠️  Edit mode not yet implemented. Skipping...\n');
        return 'skip';
      
      case 's':
      case 'skip':
        console.log('⏭️  Skipped\n');
        return 'skip';
      
      case 'q':
      case 'quit':
        console.log('👋 Quitting review...\n');
        process.exit(0);
      
      default:
        console.log('Invalid choice. Please try again.\n');
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
   * 显示审查摘要
   */
  private displaySummary(result: ReviewResult): void {
    console.log('\n' + '═'.repeat(80));
    console.log('\n📊 Review Summary\n');
    console.log('─'.repeat(80));
    console.log(`Total Reviewed:  ${result.totalReviewed}`);
    console.log(`✅ Accepted:     ${result.totalAccepted}`);
    console.log(`❌ Rejected:     ${result.totalRejected}`);
    console.log(`⏭️  Skipped:      ${result.totalReviewed - result.totalAccepted - result.totalRejected}`);
    console.log('═'.repeat(80) + '\n');
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

