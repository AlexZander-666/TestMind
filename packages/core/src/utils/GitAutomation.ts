/**
 * GitAutomation: Automatic Git branch management for test commits
 * Part of the Diff-First trust model
 */

import simpleGit, { SimpleGit } from 'simple-git';
import path from 'path';

export interface GitCommitOptions {
  message: string;
  files: string[];
  branchPrefix?: string;
}

export interface GitBranchInfo {
  branchName: string;
  created: boolean;
  committed: boolean;
}

export class GitAutomation {
  private git: SimpleGit;
  private repoPath: string;

  constructor(repoPath: string) {
    this.repoPath = repoPath;
    this.git = simpleGit(repoPath);
  }

  /**
   * Check if the directory is a Git repository
   */
  async isGitRepo(): Promise<boolean> {
    try {
      await this.git.revparse(['--is-inside-work-tree']);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Create a new feature branch for test changes
   */
  async createTestBranch(testName: string, prefix = 'testmind/test'): Promise<string> {
    // Sanitize test name for branch name
    const sanitized = testName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    const branchName = `${prefix}-${sanitized}`;

    // Check if branch already exists
    const branches = await this.git.branchLocal();
    if (branches.all.includes(branchName)) {
      // Branch exists, use a timestamp suffix
      const timestamp = Date.now();
      return `${branchName}-${timestamp}`;
    }

    return branchName;
  }

  /**
   * Commit test changes to a new branch
   */
  async commitTestChanges(options: GitCommitOptions): Promise<GitBranchInfo> {
    const { message, files, branchPrefix = 'testmind/test' } = options;

    // Validate files array
    if (!files || files.length === 0) {
      throw new Error('No files to commit');
    }

    // Get current branch
    const currentBranch = await this.git.revparse(['--abbrev-ref', 'HEAD']);

    // Extract test name from first file (simple heuristic)
    const firstFile = files[0]!; // Already validated files.length > 0
    const testName = path.basename(firstFile, path.extname(firstFile));
    const branchName = await this.createTestBranch(testName, branchPrefix);

    try {
      // Create and checkout new branch
      await this.git.checkoutLocalBranch(branchName);

      // Add files
      await this.git.add(files);

      // Commit with message
      await this.git.commit(message);

      return {
        branchName,
        created: true,
        committed: true,
      };
    } catch (error) {
      // If something goes wrong, try to go back to original branch
      try {
        await this.git.checkout(currentBranch);
      } catch {
        // Ignore checkout error
      }
      throw error;
    }
  }

  /**
   * Get current branch name
   */
  async getCurrentBranch(): Promise<string> {
    return await this.git.revparse(['--abbrev-ref', 'HEAD']);
  }

  /**
   * Check if there are uncommitted changes
   */
  async hasUncommittedChanges(): Promise<boolean> {
    const status = await this.git.status();
    return !status.isClean();
  }

  /**
   * Undo the last commit, keeping changes in working directory
   * Command: testmind undo
   * 
   * This implements the "undo" feature from 1.md framework
   * Allows developers to reverse an applied change without losing work
   */
  async undoLastCommit(): Promise<{ success: boolean; message: string }> {
    try {
      // Check if there's anything to undo
      const log = await this.git.log({ maxCount: 1 });
      if (!log.latest) {
        return {
          success: false,
          message: 'No commits to undo',
        };
      }

      const lastCommit = log.latest;
      
      // Reset to previous commit, keeping changes staged
      await this.git.reset(['--soft', 'HEAD~1']);

      return {
        success: true,
        message: `Undone commit: ${lastCommit.message.split('\n')[0]}`,
      };
    } catch (error) {
      throw new Error(`Failed to undo last commit: ${error}`);
    }
  }

  /**
   * Undo the last commit and discard all changes
   * Command: testmind undo --hard
   * 
   * WARNING: This is destructive and cannot be reversed
   */
  async undoAndDiscard(): Promise<{ success: boolean; message: string }> {
    try {
      // Check if there's anything to undo
      const log = await this.git.log({ maxCount: 1 });
      if (!log.latest) {
        return {
          success: false,
          message: 'No commits to undo',
        };
      }

      const lastCommit = log.latest;
      
      // Reset to previous commit, discarding all changes
      await this.git.reset(['--hard', 'HEAD~1']);

      return {
        success: true,
        message: `Undone and discarded commit: ${lastCommit.message.split('\n')[0]}`,
      };
    } catch (error) {
      throw new Error(`Failed to undo and discard: ${error}`);
    }
  }

  /**
   * Get commit history for a branch
   * Used to show what can be undone
   */
  async getRecentCommits(count: number = 5): Promise<Array<{
    hash: string;
    message: string;
    date: string;
    author: string;
  }>> {
    try {
      const log = await this.git.log({ maxCount: count });
      
      return log.all.map(commit => ({
        hash: commit.hash.substring(0, 7),
        message: commit.message.split('\n')[0] || '',
        date: commit.date,
        author: commit.author_name,
      }));
    } catch (error) {
      throw new Error(`Failed to get commit history: ${error}`);
    }
  }

  /**
   * Check if the last commit was made by TestMind
   * This helps users avoid accidentally undoing manual commits
   */
  async isLastCommitFromTestMind(): Promise<boolean> {
    try {
      const log = await this.git.log({ maxCount: 1 });
      if (!log.latest) {
        return false;
      }

      return log.latest.message.includes('Generated by TestMind');
    } catch {
      return false;
    }
  }

  /**
   * Generate commit message for test
   */
  static generateCommitMessage(testInfo: {
    functionName: string;
    filePath: string;
    testCount?: number;
  }): string {
    const { functionName, filePath, testCount } = testInfo;
    const fileName = path.basename(filePath);
    
    let message = `test: add tests for ${functionName}`;
    
    if (testCount) {
      message += `\n\nGenerated ${testCount} test case${testCount > 1 ? 's' : ''} for ${functionName}() in ${fileName}`;
    } else {
      message += `\n\nGenerated tests for ${functionName}() in ${fileName}`;
    }
    
    message += '\n\n🤖 Generated by TestMind - AI-powered test automation';
    
    return message;
  }
}

