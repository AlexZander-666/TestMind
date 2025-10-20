/**
 * CICDManager - CI/CD 统一管理器
 * 
 * 功能：
 * - 自动检测 CI/CD 平台
 * - 统一的配置接口
 * - 批量生成配置
 * - 验证和测试
 */

import { GitHubActionsIntegration, type GitHubActionsConfig } from './GitHubActionsIntegration';
import { GitLabCIIntegration, type GitLabCIConfig } from './GitLabCIIntegration';
import * as fs from 'fs/promises';
import * as path from 'path';

export type CIPlatform = 'github' | 'gitlab' | 'jenkins' | 'circleci' | 'unknown';

export interface CICDManagerConfig {
  /** 仓库路径 */
  repoPath: string;
  
  /** 要生成的平台（留空则自动检测） */
  platforms?: CIPlatform[];
  
  /** GitHub Actions 配置 */
  githubActions?: GitHubActionsConfig;
  
  /** GitLab CI 配置 */
  gitlabCI?: GitLabCIConfig;
}

export interface SetupResult {
  platform: CIPlatform;
  success: boolean;
  configPath?: string;
  error?: string;
}

/**
 * CI/CD 管理器
 */
export class CICDManager {
  private repoPath: string;
  private githubActions?: GitHubActionsIntegration;
  private gitlabCI?: GitLabCIIntegration;

  constructor(config: CICDManagerConfig) {
    this.repoPath = config.repoPath;

    // 初始化集成
    if (config.githubActions || (config.platforms?.includes('github'))) {
      this.githubActions = new GitHubActionsIntegration(
        config.repoPath,
        config.githubActions
      );
    }

    if (config.gitlabCI || (config.platforms?.includes('gitlab'))) {
      this.gitlabCI = new GitLabCIIntegration(
        config.repoPath,
        config.gitlabCI
      );
    }
  }

  /**
   * 自动检测当前仓库使用的 CI/CD 平台
   */
  async detectPlatform(): Promise<CIPlatform[]> {
    const platforms: CIPlatform[] = [];

    try {
      // 检测 GitHub Actions
      const githubPath = path.join(this.repoPath, '.github', 'workflows');
      try {
        await fs.access(githubPath);
        platforms.push('github');
      } catch {
        // Not GitHub
      }

      // 检测 GitLab CI
      const gitlabPath = path.join(this.repoPath, '.gitlab-ci.yml');
      try {
        await fs.access(gitlabPath);
        platforms.push('gitlab');
      } catch {
        // Not GitLab
      }

      // 检测 Jenkins
      const jenkinsPath = path.join(this.repoPath, 'Jenkinsfile');
      try {
        await fs.access(jenkinsPath);
        platforms.push('jenkins');
      } catch {
        // Not Jenkins
      }

      // 检测 CircleCI
      const circlePath = path.join(this.repoPath, '.circleci', 'config.yml');
      try {
        await fs.access(circlePath);
        platforms.push('circleci');
      } catch {
        // Not CircleCI
      }

      return platforms.length > 0 ? platforms : ['unknown'];
    } catch (error) {
      return ['unknown'];
    }
  }

  /**
   * 设置 CI/CD（自动或手动）
   */
  async setup(platforms?: CIPlatform[]): Promise<SetupResult[]> {
    const results: SetupResult[] = [];

    // 如果未指定平台，自动检测
    const targetPlatforms = platforms || await this.detectPlatform();

    for (const platform of targetPlatforms) {
      let result: SetupResult;

      switch (platform) {
        case 'github':
          result = await this.setupGitHub();
          break;

        case 'gitlab':
          result = await this.setupGitLab();
          break;

        case 'jenkins':
          result = {
            platform: 'jenkins',
            success: false,
            error: 'Jenkins integration not yet implemented'
          };
          break;

        case 'circleci':
          result = {
            platform: 'circleci',
            success: false,
            error: 'CircleCI integration not yet implemented'
          };
          break;

        default:
          result = {
            platform: 'unknown',
            success: false,
            error: 'Unknown CI/CD platform'
          };
      }

      results.push(result);
    }

    return results;
  }

  /**
   * 设置 GitHub Actions
   */
  private async setupGitHub(): Promise<SetupResult> {
    if (!this.githubActions) {
      this.githubActions = new GitHubActionsIntegration(this.repoPath);
    }

    const result = await this.githubActions.generateWorkflow();

    return {
      platform: 'github',
      success: result.success,
      configPath: result.workflowPath,
      error: result.error
    };
  }

  /**
   * 设置 GitLab CI
   */
  private async setupGitLab(): Promise<SetupResult> {
    if (!this.gitlabCI) {
      this.gitlabCI = new GitLabCIIntegration(this.repoPath);
    }

    const result = await this.gitlabCI.generateConfig();

    return {
      platform: 'gitlab',
      success: result.success,
      configPath: result.configPath,
      error: result.error
    };
  }

  /**
   * 生成所有平台的配置
   */
  async setupAll(): Promise<SetupResult[]> {
    const platforms: CIPlatform[] = ['github', 'gitlab'];
    return this.setup(platforms);
  }

  /**
   * 生成设置报告
   */
  generateSetupReport(results: SetupResult[]): string {
    let report = `# CI/CD Setup Report\n\n`;
    report += `**Repository**: ${this.repoPath}\n\n`;

    report += `**Results:**\n`;
    for (const result of results) {
      const status = result.success ? '✅' : '❌';
      report += `- ${status} **${result.platform}**`;
      
      if (result.configPath) {
        report += ` → \`${result.configPath}\``;
      }
      
      if (result.error) {
        report += `\n  - Error: ${result.error}`;
      }
      
      report += '\n';
    }

    return report;
  }

  /**
   * 验证配置
   */
  async validateConfigs(): Promise<{
    platform: CIPlatform;
    valid: boolean;
    errors?: string[];
  }[]> {
    const results: {
      platform: CIPlatform;
      valid: boolean;
      errors?: string[];
    }[] = [];

    // 验证 GitHub Actions
    if (this.githubActions) {
      const validation = await this.githubActions.validateWorkflow();
      results.push({
        platform: 'github',
        valid: validation.valid,
        errors: validation.errors
      });
    }

    // GitLab CI 暂无验证（需要 gitlab-ci-lint）

    return results;
  }

  /**
   * 获取使用指南
   */
  getUsageGuide(platform: CIPlatform): string {
    switch (platform) {
      case 'github':
        return `
# GitHub Actions 使用指南

## 1. 配置已生成
- Workflow 文件: \`.github/workflows/testmind-ci.yml\`

## 2. 触发方式
- 自动：每次 Pull Request 时自动运行
- 手动：在 GitHub Actions 页面点击 "Run workflow"

## 3. 查看结果
- PR 评论中会显示测试结果
- 详细日志在 Actions 标签页查看

## 4. 本地测试
运行本地模拟脚本：
\`\`\`bash
./scripts/testmind-ci-local.sh
\`\`\`

## 5. 自定义配置
修改 \`.github/workflows/testmind-ci.yml\` 文件
`;

      case 'gitlab':
        return `
# GitLab CI 使用指南

## 1. 配置已生成
- Pipeline 文件: \`.gitlab-ci.yml\`

## 2. 触发方式
- 自动：每次 push 或 Merge Request
- 手动：在 GitLab CI/CD 页面点击 "Run Pipeline"

## 3. 查看结果
- Pipeline 视图显示各阶段状态
- 点击 job 查看详细日志

## 4. 本地测试
运行本地模拟脚本：
\`\`\`bash
./scripts/gitlab-ci-local.sh
\`\`\`

## 5. 自定义配置
修改 \`.gitlab-ci.yml\` 文件
`;

      default:
        return `Platform ${platform} guide not available`;
    }
  }
}

/**
 * 便捷工厂函数
 */
export function createCICDManager(config: CICDManagerConfig): CICDManager {
  return new CICDManager(config);
}

