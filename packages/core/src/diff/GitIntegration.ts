/**
 * GitIntegration - Git 集成模块
 * 
 * Enhanced with:
 * - Smart branch naming (module + timestamp)
 * - AI-generated commit messages
 * - Descriptive commit body generation
 * - Rollback mechanism with history
 * - Safe operation checks
 * 
 * 功能：
 * - 智能创建 feature 分支
 * - AI 生成 commit 消息
 * - 自动提交已接受的 diff
 * - 创建 PR（可选）
 * - 回滚支持
 */

import { execSync } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { LLMService } from '../llm/LLMService';
import type { FileDiff } from './DiffGenerator';
import { createComponentLogger } from '../utils/logger';

export interface GitOperationResult {
  success: boolean;
  branchName?: string;
  commitHash?: string;
  error?: string;
  message?: string;
}

export interface CommitOptions {
  /** 自动生成 commit 消息 */
  autoGenerateMessage?: boolean;
  
  /** 自定义 commit 消息 */
  customMessage?: string;
  
  /** commit 消息前缀 */
  messagePrefix?: string;
  
  /** 是否包含详细描述 */
  includeDescription?: boolean;
}

export interface BranchOptions {
  /** 分支名称前缀 */
  branchPrefix?: string;
  
  /** 基于的分支 */
  baseBranch?: string;
  
  /** 是否自动切换 */
  autoCheckout?: boolean;
}

/**
 * Git 集成器 (Enhanced)
 */
export class GitIntegration {
  private repoPath: string;
  private llmService?: LLMService;
  private logger = createComponentLogger('GitIntegration');
  private operationHistory: Array<{operation: string; details: any; timestamp: number}> = [];

  constructor(repoPath: string, llmService?: LLMService) {
    this.repoPath = repoPath;
    this.llmService = llmService;
  }
  
  /**
   * Generate smart branch name based on changes
   */
  private generateSmartBranchName(diffs: FileDiff[], featureName?: string): string {
    if (featureName) {
      return this.sanitizeBranchName(featureName);
    }
    
    // Analyze diffs to generate intelligent name
    const affectedModules = new Set<string>();
    const fileTypes = new Set<string>();
    
    for (const diff of diffs) {
      // Extract module from path: src/components/Button.tsx -> components
      const parts = diff.filePath.split('/');
      if (parts.length > 2) {
        affectedModules.add(parts[parts.length - 2]);
      }
      
      // Track file type
      if (diff.filePath.endsWith('.test.ts') || diff.filePath.endsWith('.test.tsx')) {
        fileTypes.add('tests');
      } else if (diff.filePath.includes('component')) {
        fileTypes.add('components');
      } else if (diff.filePath.includes('util')) {
        fileTypes.add('utils');
      }
    }
    
    const modules = Array.from(affectedModules).slice(0, 2).join('-');
    const types = Array.from(fileTypes).slice(0, 1).join('-');
    
    const name = modules || types || 'update';
    return this.sanitizeBranchName(`add-${name}`);
  }
  
  /**
   * Sanitize branch name (remove special chars)
   */
  private sanitizeBranchName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * 创建 feature 分支 (Enhanced with smart naming)
   */
  async createFeatureBranch(
    featureName: string,
    options: BranchOptions = {}
  ): Promise<GitOperationResult> {
    const {
      branchPrefix = 'testmind',
      baseBranch = 'main',
      autoCheckout = true
    } = options;

    try {
      this.logger.info('Creating feature branch', { featureName, baseBranch });
      
      // Check for uncommitted changes
      const status = this.exec('git status --porcelain');
      if (status.trim() && !this.exec('git diff --cached').trim()) {
        this.logger.warn('Uncommitted changes detected');
        // Note: In production, might want to stash or require clean state
      }
      
      // 生成分支名（智能命名）
      const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '');
      const sanitizedName = this.sanitizeBranchName(featureName);
      const branchName = `${branchPrefix}/${sanitizedName}-${timestamp}`;

      // 确保在正确的基础分支上
      try {
        this.exec(`git checkout ${baseBranch}`);
      } catch {
        // If base branch doesn't exist or can't checkout, continue anyway
        this.logger.warn(`Could not checkout ${baseBranch}, continuing anyway`);
      }

      // 创建新分支
      this.exec(`git checkout -b ${branchName}`);
      
      // Record operation
      this.recordOperation('create_branch', { branchName, baseBranch });

      this.logger.info('Branch created successfully', { branchName });

      return {
        success: true,
        branchName,
        message: `✓ Created and checked out branch: ${branchName}`
      };
    } catch (error) {
      this.logger.error('Failed to create branch', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  /**
   * Generate AI-powered commit message based on diffs
   */
  async generateCommitMessage(diffs: FileDiff[]): Promise<string> {
    if (!this.llmService) {
      return this.generateFallbackCommitMessage(diffs);
    }
    
    try {
      this.logger.info('Generating AI commit message', { diffCount: diffs.length });
      
      // Build context for LLM
      const diffSummary = diffs.map(d => ({
        file: d.filePath,
        additions: d.additions,
        deletions: d.deletions,
      }));
      
      const prompt = `Generate a concise git commit message for the following changes:

Files changed (${diffs.length}):
${diffSummary.map(d => `- ${d.file} (+${d.additions}, -${d.deletions})`).join('\n')}

Requirements:
1. Start with conventional commit type: feat/fix/test/refactor/docs/chore
2. Keep subject line under 72 characters
3. Be specific about what changed
4. Use imperative mood (e.g., "add" not "added")

Return ONLY the commit message, no explanation.`;

      const response = await this.llmService.generate({
        provider: 'openai',
        model: 'gpt-4o-mini',
        prompt,
        temperature: 0.3, // Low temperature for consistent formatting
        maxTokens: 100,
      });
      
      const message = response.content.trim();
      this.logger.info('AI commit message generated', { message });
      
      return message;
    } catch (error) {
      this.logger.warn('AI generation failed, using fallback', { error });
      return this.generateFallbackCommitMessage(diffs);
    }
  }
  
  /**
   * Generate fallback commit message without AI
   */
  private generateFallbackCommitMessage(diffs: FileDiff[]): string {
    const testFiles = diffs.filter(d => d.filePath.includes('.test.'));
    const sourceFiles = diffs.filter(d => !d.filePath.includes('.test.'));
    
    if (testFiles.length > 0 && sourceFiles.length === 0) {
      return `test: add tests for ${testFiles.length} file(s)`;
    }
    
    if (testFiles.length > 0) {
      return `feat: add implementation and tests for ${sourceFiles.length} file(s)`;
    }
    
    const totalAdditions = diffs.reduce((sum, d) => sum + (d.additions || 0), 0);
    const totalDeletions = diffs.reduce((sum, d) => sum + (d.deletions || 0), 0);
    
    if (totalAdditions > totalDeletions * 2) {
      return `feat: add new functionality (+${totalAdditions} lines)`;
    } else if (totalDeletions > totalAdditions * 2) {
      return `refactor: clean up code (-${totalDeletions} lines)`;
    } else {
      return `chore: update ${diffs.length} file(s)`;
    }
  }
  
  /**
   * Record operation for rollback
   */
  private recordOperation(operation: string, details: any): void {
    this.operationHistory.push({
      operation,
      details,
      timestamp: Date.now(),
    });
    
    // Keep last 10 operations
    if (this.operationHistory.length > 10) {
      this.operationHistory.shift();
    }
  }

  /**
   * 提交已接受的 diff (Enhanced with AI message and history)
   */
  async commitDiffs(
    diffs: FileDiff[],
    options: CommitOptions = {}
  ): Promise<GitOperationResult> {
    const {
      autoGenerateMessage = true,
      customMessage,
      messagePrefix = '🤖',
      includeDescription = true
    } = options;

    try {
      this.logger.info('Committing diffs', { count: diffs.length });
      
      // 1. Stage 所有修改的文件
      for (const diff of diffs) {
        this.exec(`git add "${diff.filePath}"`);
      }

      // 2. 生成或使用 commit 消息
      let commitMessage: string;
      
      if (customMessage) {
        commitMessage = customMessage;
      } else if (autoGenerateMessage) {
        commitMessage = await this.generateCommitMessage(diffs);
      } else {
        commitMessage = this.generateFallbackCommitMessage(diffs);
      }

      // 添加前缀
      if (messagePrefix) {
        commitMessage = `${messagePrefix} ${commitMessage}`;
      }

      // 3. 执行 commit
      const escapedMessage = commitMessage.replace(/"/g, '\\"');
      this.exec(`git commit -m "${escapedMessage}"`);

      // 4. 获取 commit hash
      const commitHash = this.exec('git rev-parse HEAD').trim();
      
      // Record operation for rollback
      this.recordOperation('commit', {
        commitHash,
        message: commitMessage,
        files: diffs.map(d => d.filePath),
      });

      this.logger.info('Commit successful', { commitHash, message: commitMessage });

      return {
        success: true,
        commitHash,
        message: `✓ Committed: ${commitMessage}`
      };
    } catch (error) {
      this.logger.error('Commit failed', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * 使用 LLM 生成 commit 消息 (with options)
   */
  private async generateCommitMessageWithOptions(
    diffs: FileDiff[],
    includeDescription: boolean
  ): Promise<string> {
    if (!this.llmService) {
      return this.generateBasicCommitMessage(diffs);
    }

    // 准备 diff 摘要
    const diffSummary = diffs.map(diff => {
      const stats = this.calculateDiffStats(diff);
      return `- ${diff.filePath} (${stats.additions}+, ${stats.deletions}-)`;
    }).join('\n');

    const prompt = `
Generate a concise git commit message for the following changes:

Files changed:
${diffSummary}

Requirements:
1. Start with a conventional commit type (feat, fix, refactor, test, docs, etc.)
2. Keep the subject line under 72 characters
3. Be specific about what changed
${includeDescription ? '4. Include a brief description (2-3 lines max)' : ''}

Format:
<type>: <subject>
${includeDescription ? '\n<description>' : ''}

Output only the commit message, nothing else.
`;

    try {
      const response = await this.llmService.generate({
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        prompt,
        temperature: 0.3,
        maxTokens: 150
      });

      return response.content.trim();
    } catch (error) {
      console.error('Failed to generate commit message:', error);
      return this.generateBasicCommitMessage(diffs);
    }
  }

  /**
   * 生成基础 commit 消息
   */
  private generateBasicCommitMessage(diffs: FileDiff[]): string {
    const fileCount = diffs.length;
    const firstFile = path.basename(diffs[0].filePath);

    if (fileCount === 1) {
      return `Update ${firstFile}`;
    } else {
      return `Update ${fileCount} files`;
    }
  }

  /**
   * 计算 diff 统计信息
   */
  private calculateDiffStats(diff: FileDiff): { additions: number; deletions: number } {
    let additions = 0;
    let deletions = 0;

    for (const hunk of diff.hunks) {
      for (const line of hunk.lines) {
        if (line.type === 'addition') additions++;
        if (line.type === 'deletion') deletions++;
      }
    }

    return { additions, deletions };
  }

  /**
   * 创建 Pull Request（需要 GitHub CLI）
   */
  async createPullRequest(
    title: string,
    body?: string,
    options: {
      baseBranch?: string;
      draft?: boolean;
    } = {}
  ): Promise<GitOperationResult> {
    const {
      baseBranch = 'main',
      draft = false
    } = options;

    try {
      // 检查 gh CLI 是否可用
      this.exec('gh --version');

      // 创建 PR
      const command = [
        'gh pr create',
        `--title "${title}"`,
        body ? `--body "${body}"` : '',
        `--base ${baseBranch}`,
        draft ? '--draft' : ''
      ].filter(Boolean).join(' ');

      const output = this.exec(command);

      return {
        success: true,
        message: output
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * 推送到远程
   */
  async push(remote: string = 'origin', setUpstream: boolean = true): Promise<GitOperationResult> {
    try {
      const currentBranch = this.getCurrentBranch();
      
      const command = setUpstream
        ? `git push -u ${remote} ${currentBranch}`
        : `git push ${remote} ${currentBranch}`;

      this.exec(command);

      return {
        success: true,
        message: `Pushed to ${remote}/${currentBranch}`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * 回滚最后一次 commit (Enhanced with safety checks)
   */
  async undoLastCommit(soft: boolean = true): Promise<GitOperationResult> {
    try {
      this.logger.info('Undoing last commit', { soft });
      
      // Safety check: Get last commit info
      const lastCommitHash = this.exec('git rev-parse HEAD').trim();
      const lastCommitMessage = this.exec('git log -1 --pretty=%B').trim();
      
      // Check if it's a TestMind commit (has 🤖 prefix)
      if (!lastCommitMessage.includes('🤖')) {
        this.logger.warn('Last commit is not a TestMind commit');
        return {
          success: false,
          error: 'Safety check failed: Last commit is not a TestMind commit. Use git reset manually if you\'re sure.',
          message: `Last commit: ${lastCommitMessage}`,
        };
      }
      
      // Perform reset
      const command = soft ? 'git reset --soft HEAD~1' : 'git reset --hard HEAD~1';
      this.exec(command);
      
      // Record rollback operation
      this.recordOperation('rollback', {
        undoneCommit: lastCommitHash,
        undoneMessage: lastCommitMessage,
        soft,
      });
      
      this.logger.info('Rollback successful', { 
        undoneCommit: lastCommitHash,
        soft 
      });

      return {
        success: true,
        message: soft 
          ? `✓ Undone last commit (changes kept in working directory)\n  Previous commit: ${lastCommitMessage}`
          : `✓ Undone last commit (changes discarded)\n  Previous commit: ${lastCommitMessage}`
      };
    } catch (error) {
      this.logger.error('Rollback failed', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  /**
   * Save operation history to disk
   */
  async saveHistory(): Promise<void> {
    try {
      const historyDir = path.join(this.repoPath, '.testmind', 'history');
      await fs.mkdir(historyDir, { recursive: true });
      
      const historyFile = path.join(historyDir, 'git-operations.json');
      await fs.writeFile(
        historyFile,
        JSON.stringify(this.operationHistory, null, 2),
        'utf-8'
      );
      
      this.logger.debug('Operation history saved', { 
        operations: this.operationHistory.length 
      });
    } catch (error) {
      this.logger.warn('Failed to save history', { error });
    }
  }
  
  /**
   * Load operation history from disk
   */
  async loadHistory(): Promise<void> {
    try {
      const historyFile = path.join(this.repoPath, '.testmind', 'history', 'git-operations.json');
      const content = await fs.readFile(historyFile, 'utf-8');
      this.operationHistory = JSON.parse(content);
      
      this.logger.debug('Operation history loaded', { 
        operations: this.operationHistory.length 
      });
    } catch (error) {
      // No history file yet, start fresh
      this.operationHistory = [];
    }
  }
  
  /**
   * Get operation history
   */
  getHistory(): typeof this.operationHistory {
    return [...this.operationHistory];
  }

  /**
   * 检查是否有未提交的更改
   */
  hasUncommittedChanges(): boolean {
    try {
      const status = this.exec('git status --porcelain');
      return status.trim().length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * 获取当前分支名
   */
  getCurrentBranch(): string {
    return this.exec('git branch --show-current').trim();
  }

  /**
   * 获取 git 状态
   */
  getStatus(): string {
    return this.exec('git status');
  }

  /**
   * 切换分支
   */
  async checkoutBranch(branchName: string): Promise<GitOperationResult> {
    try {
      this.exec(`git checkout ${branchName}`);
      
      return {
        success: true,
        branchName,
        message: `Switched to branch: ${branchName}`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * 删除分支
   */
  async deleteBranch(
    branchName: string,
    force: boolean = false
  ): Promise<GitOperationResult> {
    try {
      const flag = force ? '-D' : '-d';
      this.exec(`git branch ${flag} ${branchName}`);
      
      return {
        success: true,
        message: `Deleted branch: ${branchName}`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * 完整的 diff-first 工作流
   */
  async performDiffFirstWorkflow(
    diffs: FileDiff[],
    featureName: string,
    options: {
      commitMessage?: string;
      createPR?: boolean;
      prTitle?: string;
      prBody?: string;
    } = {}
  ): Promise<GitOperationResult[]> {
    const results: GitOperationResult[] = [];

    try {
      // 1. 创建 feature 分支
      const branchResult = await this.createFeatureBranch(featureName);
      results.push(branchResult);
      if (!branchResult.success) {
        return results;
      }

      // 2. 提交 diffs
      const commitResult = await this.commitDiffs(diffs, {
        customMessage: options.commitMessage
      });
      results.push(commitResult);
      if (!commitResult.success) {
        return results;
      }

      // 3. 推送（可选）
      if (options.createPR) {
        const pushResult = await this.push();
        results.push(pushResult);
        if (!pushResult.success) {
          return results;
        }

        // 4. 创建 PR（可选）
        const prResult = await this.createPullRequest(
          options.prTitle || `[TestMind] ${featureName}`,
          options.prBody
        );
        results.push(prResult);
      }

    } catch (error) {
      results.push({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    return results;
  }

  /**
   * 执行 git 命令
   */
  private exec(command: string): string {
    return execSync(command, {
      cwd: this.repoPath,
      encoding: 'utf-8'
    });
  }

  /**
   * 生成工作流报告
   */
  generateWorkflowReport(results: GitOperationResult[]): string {
    let report = `# Git Workflow Report\n\n`;
    
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    report += `**Summary:**\n`;
    report += `- Total Operations: ${results.length}\n`;
    report += `- Successful: ${successful}\n`;
    report += `- Failed: ${failed}\n\n`;

    report += `**Operations:**\n`;
    
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const status = result.success ? '✅' : '❌';
      
      report += `${i + 1}. ${status} ${result.message || result.error || 'Unknown'}\n`;
      
      if (result.branchName) {
        report += `   Branch: ${result.branchName}\n`;
      }
      if (result.commitHash) {
        report += `   Commit: ${result.commitHash}\n`;
      }
    }

    return report;
  }
}

/**
 * 便捷工厂函数
 */
export function createGitIntegration(
  repoPath: string,
  llmService?: LLMService
): GitIntegration {
  return new GitIntegration(repoPath, llmService);
}

