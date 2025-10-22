/**
 * RichDiffUI - 增强的 Diff 审查界面
 * 
 * 参考 1.md 的 Diff-First 理念，提供富文本终端 UI
 * 
 * 功能：
 * - 语法高亮的 Diff 展示
 * - 键盘快捷键支持（j/k 导航，a 接受，r 拒绝）
 * - 智能分组相关 Diff
 * - AI 辅助解释改动
 * - 风险评估
 * 
 * 技术栈：
 * - chalk: 终端颜色
 * - cli-highlight: 代码语法高亮
 * - inquirer: 交互式提示
 */

import type { FileDiff, DiffHunk } from './DiffGenerator';
import type { LLMService } from '../llm/LLMService';
import { createComponentLogger } from '../utils/logger';

// 颜色配置
const colors = {
  // Diff 颜色
  addition: (text: string) => `\x1b[32m${text}\x1b[0m`,      // 绿色
  deletion: (text: string) => `\x1b[31m${text}\x1b[0m`,      // 红色
  context: (text: string) => `\x1b[90m${text}\x1b[0m`,       // 灰色
  lineNumber: (text: string) => `\x1b[36m${text}\x1b[0m`,    // 青色
  
  // UI 元素
  header: (text: string) => `\x1b[1m\x1b[34m${text}\x1b[0m`, // 粗体蓝色
  success: (text: string) => `\x1b[32m${text}\x1b[0m`,       // 绿色
  error: (text: string) => `\x1b[31m${text}\x1b[0m`,         // 红色
  warning: (text: string) => `\x1b[33m${text}\x1b[0m`,       // 黄色
  info: (text: string) => `\x1b[36m${text}\x1b[0m`,          // 青色
  dim: (text: string) => `\x1b[2m${text}\x1b[0m`,            // 暗淡
  bold: (text: string) => `\x1b[1m${text}\x1b[0m`,           // 粗体
};

export interface DiffGroup {
  /** 分组类型 */
  type: 'test-generation' | 'refactor' | 'bug-fix' | 'feature' | 'other';
  
  /** 包含的文件 */
  files: FileDiff[];
  
  /** 分组描述 */
  description: string;
  
  /** 置信度 (0-1) */
  confidence: number;
  
  /** AI 生成的解释 */
  explanation?: string;
  
  /** 风险评估 */
  risk?: 'low' | 'medium' | 'high';
}

export interface RichDiffOptions {
  /** 是否启用语法高亮 */
  syntaxHighlight?: boolean;
  
  /** 是否显示行号 */
  showLineNumbers?: boolean;
  
  /** 是否显示 AI 解释 */
  showAIExplanation?: boolean;
  
  /** 是否显示风险评估 */
  showRiskAssessment?: boolean;
  
  /** 是否启用键盘快捷键 */
  enableHotkeys?: boolean;
  
  /** 上下文行数 */
  contextLines?: number;
}

export interface ReviewAction {
  action: 'accept' | 'reject' | 'edit' | 'explain' | 'skip' | 'quit';
  targetFile?: string;
  targetHunk?: number;
}

/**
 * Rich Diff UI
 */
export class RichDiffUI {
  private logger = createComponentLogger('RichDiffUI');
  private options: Required<RichDiffOptions>;
  
  constructor(
    private llmService?: LLMService,
    options: RichDiffOptions = {}
  ) {
    this.options = {
      syntaxHighlight: options.syntaxHighlight ?? true,
      showLineNumbers: options.showLineNumbers ?? true,
      showAIExplanation: options.showAIExplanation ?? !!llmService,
      showRiskAssessment: options.showRiskAssessment ?? !!llmService,
      enableHotkeys: options.enableHotkeys ?? true,
      contextLines: options.contextLines ?? 3,
    };
  }
  
  /**
   * 智能分组 Diff
   * 
   * 将相关的 diff 分组，便于审查
   */
  async groupDiffs(diffs: FileDiff[]): Promise<DiffGroup[]> {
    const groups: DiffGroup[] = [];
    
    // 简单分组策略：按文件路径模式
    const testFiles = diffs.filter(d => d.filePath.includes('.test.') || d.filePath.includes('__tests__'));
    const srcFiles = diffs.filter(d => !d.filePath.includes('.test.') && !d.filePath.includes('__tests__'));
    
    if (testFiles.length > 0) {
      groups.push({
        type: 'test-generation',
        files: testFiles,
        description: `生成 ${testFiles.length} 个测试文件`,
        confidence: 0.95,
      });
    }
    
    if (srcFiles.length > 0) {
      // 进一步分析源文件类型
      const hasRefactor = srcFiles.some(d => 
        d.diff.includes('extract') || d.diff.includes('rename') || d.diff.includes('move')
      );
      
      groups.push({
        type: hasRefactor ? 'refactor' : 'feature',
        files: srcFiles,
        description: hasRefactor ? '重构代码' : '功能开发',
        confidence: 0.8,
      });
    }
    
    // 如果启用了 AI 解释，为每组生成解释
    if (this.options.showAIExplanation && this.llmService) {
      for (const group of groups) {
        try {
          group.explanation = await this.generateGroupExplanation(group);
        } catch (error) {
          this.logger.warn('Failed to generate AI explanation', { error });
        }
      }
    }
    
    return groups;
  }
  
  /**
   * AI 生成分组解释
   */
  private async generateGroupExplanation(group: DiffGroup): Promise<string> {
    if (!this.llmService) {
      return '';
    }
    
    const filesInfo = group.files.map(f => `${f.filePath} (+${f.additions}/-${f.deletions})`).join('\n');
    
    const prompt = `Analyze these code changes and provide a concise explanation (max 2 sentences):

Files:
${filesInfo}

Type: ${group.type}

Explain what these changes do and why they might be made.`;
    
    const response = await this.llmService.generate({
      provider: 'openai',
      model: 'gpt-4o-mini',
      prompt,
      temperature: 0.3,
      maxTokens: 150,
    });
    
    return response.content.trim();
  }
  
  /**
   * 评估改动风险
   */
  async assessRisk(diff: FileDiff): Promise<'low' | 'medium' | 'high'> {
    // 简单的启发式规则
    let riskScore = 0;
    
    // 1. 改动规模
    const changeSize = diff.additions + diff.deletions;
    if (changeSize > 500) riskScore += 3;
    else if (changeSize > 200) riskScore += 2;
    else if (changeSize > 50) riskScore += 1;
    
    // 2. 删除比例
    const deletionRatio = diff.deletions / (diff.additions + diff.deletions);
    if (deletionRatio > 0.5) riskScore += 2; // 删除多可能风险高
    
    // 3. 文件类型
    if (diff.filePath.includes('core') || diff.filePath.includes('engine')) {
      riskScore += 2; // 核心文件风险高
    }
    
    if (diff.filePath.includes('.test.') || diff.filePath.includes('__tests__')) {
      riskScore -= 1; // 测试文件风险低
    }
    
    // 4. 如果有 LLM，询问 AI 的意见
    if (this.llmService && riskScore >= 3) {
      try {
        const aiRisk = await this.getAIRiskAssessment(diff);
        if (aiRisk === 'high') riskScore += 1;
      } catch (error) {
        this.logger.debug('AI risk assessment failed', { error });
      }
    }
    
    // 转换为风险等级
    if (riskScore >= 6) return 'high';
    if (riskScore >= 3) return 'medium';
    return 'low';
  }
  
  /**
   * AI 风险评估
   */
  private async getAIRiskAssessment(diff: FileDiff): Promise<'low' | 'medium' | 'high'> {
    if (!this.llmService) {
      return 'low';
    }
    
    const prompt = `Assess the risk level of this code change:

File: ${diff.filePath}
Changes: +${diff.additions} -${diff.deletions}

Diff preview:
${diff.diff.slice(0, 500)}

Rate the risk as: low, medium, or high
Consider: breaking changes, API compatibility, data loss potential

Risk level (one word only):`;
    
    const response = await this.llmService.generate({
      provider: 'openai',
      model: 'gpt-4o-mini',
      prompt,
      temperature: 0.1,
      maxTokens: 10,
    });
    
    const risk = response.content.toLowerCase().trim();
    if (risk.includes('high')) return 'high';
    if (risk.includes('medium')) return 'medium';
    return 'low';
  }
  
  /**
   * 渲染单个 Diff
   */
  renderDiff(diff: FileDiff, options: { showStats?: boolean } = {}): string {
    const lines: string[] = [];
    
    // 文件头
    lines.push(colors.header(`\n╔═══ ${diff.filePath} ═══╗`));
    
    // 统计信息
    if (options.showStats) {
      const stats = colors.success(`+${diff.additions}`) + ' ' + colors.deletion(`-${diff.deletions}`);
      lines.push(colors.dim(`│ Changes: ${stats}`));
    }
    
    lines.push(colors.header('╚' + '═'.repeat(diff.filePath.length + 8) + '╝\n'));
    
    // Diff 内容
    const diffLines = diff.diff.split('\n');
    for (const line of diffLines) {
      if (line.startsWith('+')) {
        lines.push(colors.addition(line));
      } else if (line.startsWith('-')) {
        lines.push(colors.deletion(line));
      } else if (line.startsWith('@@')) {
        lines.push(colors.info(line));
      } else {
        lines.push(colors.context(line));
      }
    }
    
    return lines.join('\n');
  }
  
  /**
   * 渲染 Diff 分组
   */
  async renderDiffGroup(group: DiffGroup): Promise<string> {
    const lines: string[] = [];
    
    // 分组头
    const icon = this.getGroupIcon(group.type);
    lines.push(colors.header(`\n${icon} ${group.description}`));
    
    // AI 解释
    if (group.explanation && this.options.showAIExplanation) {
      lines.push(colors.dim(`   ${group.explanation}`));
    }
    
    // 风险指示
    if (group.risk && this.options.showRiskAssessment) {
      const riskText = this.getRiskText(group.risk);
      lines.push(riskText);
    }
    
    lines.push(''); // 空行
    
    // 文件列表
    for (const file of group.files) {
      lines.push(this.renderDiff(file, { showStats: true }));
    }
    
    return lines.join('\n');
  }
  
  /**
   * 获取分组图标
   */
  private getGroupIcon(type: DiffGroup['type']): string {
    const icons = {
      'test-generation': '🧪',
      'refactor': '♻️',
      'bug-fix': '🐛',
      'feature': '✨',
      'other': '📝',
    };
    return icons[type];
  }
  
  /**
   * 获取风险文本
   */
  private getRiskText(risk: 'low' | 'medium' | 'high'): string {
    const icons = {
      low: '✅',
      medium: '⚠️',
      high: '🚨',
    };
    
    const texts = {
      low: colors.success('Risk: Low - Safe to apply'),
      medium: colors.warning('Risk: Medium - Review carefully'),
      high: colors.error('Risk: High - Exercise caution'),
    };
    
    return `   ${icons[risk]} ${texts[risk]}`;
  }
  
  /**
   * 显示快捷键帮助
   */
  showHelp(): string {
    return `
${colors.header('━━━ 快捷键帮助 ━━━')}

${colors.success('a')} - Accept this change
${colors.error('r')} - Reject this change
${colors.info('e')} - Edit before applying
${colors.warning('s')} - Skip (review later)
${colors.dim('x')} - Explain (AI analysis)
${colors.dim('j/k')} - Navigate (next/previous)
${colors.dim('q')} - Quit review

${colors.header('━━━━━━━━━━━━━━━━━━')}
`;
  }
  
  /**
   * 显示审查摘要
   */
  renderSummary(stats: {
    total: number;
    accepted: number;
    rejected: number;
    skipped: number;
  }): string {
    const lines = [
      '',
      colors.header('═══ 审查摘要 ═══'),
      '',
      `总计: ${stats.total} 个改动`,
      colors.success(`✓ 接受: ${stats.accepted}`),
      colors.error(`✗ 拒绝: ${stats.rejected}`),
      colors.warning(`⊙ 跳过: ${stats.skipped}`),
      '',
    ];
    
    if (stats.accepted > 0) {
      const acceptRate = ((stats.accepted / stats.total) * 100).toFixed(1);
      lines.push(colors.info(`接受率: ${acceptRate}%`));
    }
    
    lines.push(colors.header('═══════════════'));
    
    return lines.join('\n');
  }
  
  /**
   * 显示进度条
   */
  renderProgress(current: number, total: number): string {
    const percent = (current / total) * 100;
    const barLength = 40;
    const filled = Math.round((percent / 100) * barLength);
    const empty = barLength - filled;
    
    const bar = colors.success('█'.repeat(filled)) + colors.dim('░'.repeat(empty));
    
    return `[${bar}] ${current}/${total} (${percent.toFixed(1)}%)`;
  }
  
  /**
   * 生成改动解释（AI 辅助）
   */
  async explainChange(diff: FileDiff): Promise<string> {
    if (!this.llmService) {
      return '(AI 解释不可用 - 未配置 LLM)';
    }
    
    const prompt = `Explain this code change in simple terms (max 3 sentences):

File: ${diff.filePath}
Changes: +${diff.additions} -${diff.deletions}

Diff:
${diff.diff.slice(0, 1000)}

Explanation:`;
    
    try {
      const response = await this.llmService.generate({
        provider: 'openai',
        model: 'gpt-4o-mini',
        prompt,
        temperature: 0.3,
        maxTokens: 200,
      });
      
      return response.content.trim();
    } catch (error) {
      this.logger.error('Failed to generate explanation', { error });
      return '(生成解释失败)';
    }
  }
  
  /**
   * 检测潜在问题（AI 辅助）
   */
  async detectIssues(diff: FileDiff): Promise<string[]> {
    if (!this.llmService) {
      return [];
    }
    
    const prompt = `Review this code change and identify potential issues:

File: ${diff.filePath}
Diff:
${diff.diff.slice(0, 1500)}

List any potential issues (one per line):
- Breaking changes
- Performance concerns
- Security risks
- Test coverage gaps
- Type safety issues

Issues (or "None" if looks good):`;
    
    try {
      const response = await this.llmService.generate({
        provider: 'openai',
        model: 'gpt-4o-mini',
        prompt,
        temperature: 0.2,
        maxTokens: 300,
      });
      
      const content = response.content.trim();
      if (content.toLowerCase().includes('none') || !content.includes('-')) {
        return [];
      }
      
      // 解析列表
      return content
        .split('\n')
        .filter(line => line.trim().startsWith('-'))
        .map(line => line.replace(/^-\s*/, '').trim());
    } catch (error) {
      this.logger.error('Failed to detect issues', { error });
      return [];
    }
  }
  
  /**
   * 渲染带问题标注的 Diff
   */
  async renderDiffWithIssues(diff: FileDiff): Promise<string> {
    const diffOutput = this.renderDiff(diff);
    
    if (this.options.showAIExplanation || this.options.showRiskAssessment) {
      const lines = [diffOutput];
      
      // AI 解释
      if (this.options.showAIExplanation) {
        const explanation = await this.explainChange(diff);
        lines.push('');
        lines.push(colors.info('💡 AI 解释:'));
        lines.push(colors.dim(`   ${explanation}`));
      }
      
      // 风险评估
      if (this.options.showRiskAssessment) {
        const risk = await this.assessRisk(diff);
        lines.push('');
        lines.push(this.getRiskText(risk));
      }
      
      // 潜在问题
      const issues = await this.detectIssues(diff);
      if (issues.length > 0) {
        lines.push('');
        lines.push(colors.warning('⚠️  潜在问题:'));
        for (const issue of issues) {
          lines.push(colors.dim(`   - ${issue}`));
        }
      }
      
      return lines.join('\n');
    }
    
    return diffOutput;
  }
  
  /**
   * 显示完整的审查界面
   */
  async showReviewUI(diffs: FileDiff[]): Promise<void> {
    console.clear();
    
    // 显示欢迎信息
    console.log(colors.header('\n╔═══════════════════════════════════════════╗'));
    console.log(colors.header('║   TestMind Diff Review - 代码审查助手   ║'));
    console.log(colors.header('╚═══════════════════════════════════════════╝\n'));
    
    // 显示帮助
    if (this.options.enableHotkeys) {
      console.log(this.showHelp());
    }
    
    // 分组并显示
    const groups = await this.groupDiffs(diffs);
    
    for (let i = 0; i < groups.length; i++) {
      console.log(colors.dim(`\n───── 分组 ${i + 1}/${groups.length} ─────`));
      const groupOutput = await this.renderDiffGroup(groups[i]);
      console.log(groupOutput);
    }
    
    // 显示总览
    console.log('\n');
    console.log(colors.header('═══ 审查总览 ═══'));
    console.log(`总文件数: ${diffs.length}`);
    console.log(`总改动: ${colors.success(`+${diffs.reduce((s, d) => s + d.additions, 0)}`)} ${colors.deletion(`-${diffs.reduce((s, d) => s + d.deletions, 0)}`)}`);
    console.log(colors.header('═══════════════\n'));
  }
}

/**
 * 工厂函数
 */
export function createRichDiffUI(
  llmService?: LLMService,
  options?: RichDiffOptions
): RichDiffUI {
  return new RichDiffUI(llmService, options);
}

