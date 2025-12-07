/**
 * GitHubActionsIntegration - GitHub Actions 深度集成
 * 
 * 功能：
 * - 自动生成缺失测试的 workflow
 * - 自愈测试的 workflow
 * - 自动创建 PR
 * - Coverage 报告集成
 * - 评论测试结果到 PR
 */

import { execSync } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface GitHubActionsConfig {
  /** Workflow 文件路径 */
  workflowPath?: string;
  
  /** 是否启用自动测试生成 */
  enableAutoGenerate?: boolean;
  
  /** 是否启用自愈 */
  enableAutoHealing?: boolean;
  
  /** 是否自动创建 PR */
  enableAutoPR?: boolean;
  
  /** 触发条件 */
  trigger?: 'push' | 'pull_request' | 'schedule';
  
  /** 分支过滤 */
  branches?: string[];
  
  /** Node.js 版本 */
  nodeVersion?: string;
}

export interface WorkflowResult {
  success: boolean;
  workflowPath?: string;
  error?: string;
  message?: string;
}

/**
 * GitHub Actions 集成器
 */
export class GitHubActionsIntegration {
  private readonly config: Required<Omit<GitHubActionsConfig, 'branches'>>;
  private branches?: string[];
  private readonly repoPath: string;

  constructor(repoPath: string, config: GitHubActionsConfig = {}) {
    this.repoPath = repoPath;
    this.config = {
      workflowPath: config.workflowPath ?? '.github/workflows/testmind-ci.yml',
      enableAutoGenerate: config.enableAutoGenerate ?? false,
      enableAutoHealing: config.enableAutoHealing ?? false,
      enableAutoPR: config.enableAutoPR ?? false,
      trigger: config.trigger ?? 'pull_request',
      nodeVersion: config.nodeVersion ?? '20',
    };
    this.branches = config.branches;
  }

  /**
   * 生成完整的 GitHub Actions workflow
   */
  async generateWorkflow(): Promise<WorkflowResult> {
    try {
      const workflowContent = this.buildWorkflowYAML();
      const workflowFullPath = path.join(this.repoPath, this.config.workflowPath);

      // 确保目录存在
      await fs.mkdir(path.dirname(workflowFullPath), { recursive: true });

      // 写入 workflow 文件
      await fs.writeFile(workflowFullPath, workflowContent, 'utf-8');

      return {
        success: true,
        workflowPath: this.config.workflowPath,
        message: `Generated GitHub Actions workflow at ${this.config.workflowPath}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 构建 Workflow YAML 内容
   */
  private buildWorkflowYAML(): string {
    const yaml: string[] = [];

    // Workflow 名称和触发条件
    yaml.push('name: TestMind CI');
    yaml.push('');
    yaml.push('on:');
    
    if (this.config.trigger === 'pull_request') {
      yaml.push('  pull_request:');
      if (this.branches && this.branches.length > 0) {
        yaml.push('    branches:');
        this.branches.forEach(branch => yaml.push(`      - ${branch}`));
      }
    } else if (this.config.trigger === 'push') {
      yaml.push('  push:');
      if (this.branches && this.branches.length > 0) {
        yaml.push('    branches:');
        this.branches.forEach(branch => yaml.push(`      - ${branch}`));
      }
    } else if (this.config.trigger === 'schedule') {
      yaml.push('  schedule:');
      yaml.push('    - cron: \'0 0 * * *\' # 每天运行');
    }

    yaml.push('');
    yaml.push('jobs:');
    yaml.push('  testmind:');
    yaml.push('    runs-on: ubuntu-latest');
    yaml.push('');
    yaml.push('    steps:');

    // 1. Checkout 代码
    yaml.push('      - name: Checkout code');
    yaml.push('        uses: actions/checkout@v4');
    yaml.push('');

    // 2. 设置 Node.js
    yaml.push('      - name: Setup Node.js');
    yaml.push('        uses: actions/setup-node@v4');
    yaml.push('        with:');
    yaml.push(`          node-version: '${this.config.nodeVersion}'`);
    yaml.push('          cache: \'npm\'');
    yaml.push('');

    // 3. 安装依赖
    yaml.push('      - name: Install dependencies');
    yaml.push('        run: npm ci');
    yaml.push('');

    // 4. 安装 TestMind
    yaml.push('      - name: Install TestMind');
    yaml.push('        run: npm install -g @testmind/cli');
    yaml.push('');

    // 5. 自动生成缺失测试（如果启用）
    if (this.config.enableAutoGenerate) {
      yaml.push('      - name: Generate missing tests (preview)');
      yaml.push('        id: generate');
      yaml.push('        env:');
      yaml.push('          TESTMIND_GENERATE_COMMAND: ${{ env.TESTMIND_GENERATE_COMMAND }}');
      yaml.push('        run: |');
      yaml.push('          if [ -z "${TESTMIND_GENERATE_COMMAND:-}" ]; then');
      yaml.push('            echo "::notice::Skipping TestMind generate. Set TESTMIND_GENERATE_COMMAND to run your own automation."');
      yaml.push('            exit 0');
      yaml.push('          fi');
      yaml.push('          eval "$TESTMIND_GENERATE_COMMAND"');
      yaml.push('        continue-on-error: true');
      yaml.push('');
    }

    // 6. 运行测试
    yaml.push('      - name: Run tests');
    yaml.push('        id: test');
    yaml.push('        run: npm test');
    yaml.push('        continue-on-error: true');
    yaml.push('');

    // 7. 自愈失败的测试（如果启用）
    if (this.config.enableAutoHealing) {
      yaml.push('      - name: Self-heal failed tests (preview)');
      yaml.push('        id: heal');
      yaml.push('        if: steps.test.outcome == \'failure\'');
      yaml.push('        env:');
      yaml.push('          TESTMIND_HEAL_COMMAND: ${{ env.TESTMIND_HEAL_COMMAND }}');
      yaml.push('        run: |');
      yaml.push('          if [ -z "${TESTMIND_HEAL_COMMAND:-}" ]; then');
      yaml.push('            echo "::notice::Skipping TestMind heal. Set TESTMIND_HEAL_COMMAND to invoke your preferred workflow."');
      yaml.push('            exit 0');
      yaml.push('          fi');
      yaml.push('          eval "$TESTMIND_HEAL_COMMAND"');
      yaml.push('        continue-on-error: true');
      yaml.push('');

      // 8. 重新运行测试（自愈后）
      yaml.push('      - name: Re-run tests after healing');
      yaml.push('        if: steps.heal.outputs.healed == \'true\'');
      yaml.push('        run: npm test');
      yaml.push('');
    }

    // 9. 生成 Coverage 报告
    yaml.push('      - name: Generate coverage report');
    yaml.push('        run: npm run test:coverage');
    yaml.push('        continue-on-error: true');
    yaml.push('');

    // 10. 上传 Coverage 到 Codecov
    yaml.push('      - name: Upload coverage to Codecov');
    yaml.push('        uses: codecov/codecov-action@v4');
    yaml.push('        with:');
    yaml.push('          file: ./coverage/coverage-final.json');
    yaml.push('          flags: unittests');
    yaml.push('          name: codecov-umbrella');
    yaml.push('        continue-on-error: true');
    yaml.push('');

    // 11. 评论测试结果到 PR
    yaml.push('      - name: Comment PR with results');
    yaml.push('        if: github.event_name == \'pull_request\'');
    yaml.push('        uses: actions/github-script@v7');
    yaml.push('        with:');
    yaml.push('          script: |');
    yaml.push('            const fs = require(\'fs\');');
    yaml.push('            let comment = \'## 🤖 TestMind CI Results\\n\\n\';');
    yaml.push('');

    if (this.config.enableAutoGenerate) {
      yaml.push('            // 测试生成结果');
      yaml.push('            if (fs.existsSync(\'generate-results.json\')) {');
      yaml.push('              const genResults = JSON.parse(fs.readFileSync(\'generate-results.json\', \'utf-8\'));');
      yaml.push('              comment += `### ✨ Test Generation\\n`;');
      yaml.push('              comment += `- Generated: ${genResults.generated} tests\\n`;');
      yaml.push('              comment += `- Coverage gap closed: ${genResults.coverageIncrease}%\\n\\n`;');
      yaml.push('            }');
      yaml.push('');
    }

    if (this.config.enableAutoHealing) {
      yaml.push('            // 自愈结果');
      yaml.push('            if (fs.existsSync(\'heal-results.json\')) {');
      yaml.push('              const healResults = JSON.parse(fs.readFileSync(\'heal-results.json\', \'utf-8\'));');
      yaml.push('              comment += `### 🔧 Self-Healing\\n`;');
      yaml.push('              comment += `- Healed: ${healResults.healed} tests\\n`;');
      yaml.push('              comment += `- Success rate: ${healResults.successRate}%\\n\\n`;');
      yaml.push('            }');
      yaml.push('');
    }

    yaml.push('            // 发布评论');
    yaml.push('            github.rest.issues.createComment({');
    yaml.push('              issue_number: context.issue.number,');
    yaml.push('              owner: context.repo.owner,');
    yaml.push('              repo: context.repo.repo,');
    yaml.push('              body: comment');
    yaml.push('            });');
    yaml.push('');

    // 12. 自动创建 PR（如果有修复）
    if (this.config.enableAutoPR) {
      yaml.push('      - name: Create PR for fixes');
      yaml.push('        if: steps.heal.outputs.fixes > 0');
      yaml.push('        env:');
      yaml.push('          GH_TOKEN: ${{ github.token }}');
      yaml.push('        run: |');
      yaml.push('          git config user.name "TestMind Bot"');
      yaml.push('          git config user.email "bot@testmind.dev"');
      yaml.push('          git checkout -b testmind/auto-heal-${{ github.run_number }}');
      yaml.push('          git add .');
      yaml.push('          git commit -m "🤖 Auto-heal: Fix ${{ steps.heal.outputs.fixes }} flaky tests"');
      yaml.push('          git push origin testmind/auto-heal-${{ github.run_number }}');
      yaml.push('          gh pr create --title "🤖 Auto-heal: Fix flaky tests" --body "Automatically healed ${{ steps.heal.outputs.fixes }} tests"');
      yaml.push('');
    }

    return yaml.join('\n');
  }

  /**
   * 更新现有 workflow
   */
  async updateWorkflow(updates: Partial<GitHubActionsConfig>): Promise<WorkflowResult> {
    // 更新配置
    Object.assign(this.config, updates);
    if (updates.branches) {
      this.branches = updates.branches;
    }

    // 重新生成
    return this.generateWorkflow();
  }

  /**
   * 验证 workflow 语法
   */
  async validateWorkflow(): Promise<{ valid: boolean; errors?: string[] }> {
    try {
      // 使用 actionlint 验证（如果安装了）
      execSync('actionlint --version', { cwd: this.repoPath });
      
      execSync(`actionlint ${this.config.workflowPath}`, {
        cwd: this.repoPath,
        encoding: 'utf-8',
      });

      return {
        valid: true,
      };
    } catch (error) {
      // actionlint 未安装或验证失败
      return {
        valid: false,
        errors: [error instanceof Error ? error.message : String(error)],
      };
    }
  }

  /**
   * 生成本地测试脚本（模拟 GitHub Actions）
   */
  async generateLocalTestScript(): Promise<string> {
    const script: string[] = [];

    script.push('#!/bin/bash');
    script.push('# TestMind CI - Local Simulation');
    script.push('set -e');
    script.push('');

    script.push('echo "🚀 Starting TestMind CI..."');
    script.push('');

    if (this.config.enableAutoGenerate) {
      script.push('echo "📝 Generating missing tests..."');
      script.push('if [ -z "${TESTMIND_GENERATE_COMMAND:-}" ]; then');
      script.push('  echo "Skipping generation (set TESTMIND_GENERATE_COMMAND to enable)";');
      script.push('else');
      script.push('  eval "$TESTMIND_GENERATE_COMMAND"');
      script.push('fi');
      script.push('');
    }

    script.push('echo "🧪 Running tests..."');
    script.push('npm test || TEST_FAILED=true');
    script.push('');

    if (this.config.enableAutoHealing) {
      script.push('if [ "$TEST_FAILED" = true ]; then');
      script.push('  echo "🔧 Healing failed tests..."');
      script.push('  if [ -z "${TESTMIND_HEAL_COMMAND:-}" ]; then');
      script.push('    echo "Skipping healing (set TESTMIND_HEAL_COMMAND to enable)";');
      script.push('  else');
      script.push('    eval "$TESTMIND_HEAL_COMMAND"');
      script.push('  fi');
      script.push('  echo "🔄 Re-running tests..."');
      script.push('  npm test');
      script.push('fi');
      script.push('');
    }

    script.push('echo "📊 Generating coverage..."');
    script.push('npm run test:coverage');
    script.push('');

    script.push('echo "✅ TestMind CI completed!"');

    const scriptPath = path.join(this.repoPath, 'scripts', 'testmind-ci-local.sh');
    await fs.mkdir(path.dirname(scriptPath), { recursive: true });
    await fs.writeFile(scriptPath, script.join('\n'), { mode: 0o755 });

    return scriptPath;
  }

  /**
   * 获取 workflow 状态（需要 GitHub CLI）
   */
  async getWorkflowStatus(): Promise<{
    status: 'success' | 'failure' | 'pending' | 'unknown';
    runs: number;
    lastRun?: Date;
  }> {
    try {
      const output = execSync('gh run list --workflow testmind-ci.yml --json status,createdAt --limit 1', {
        cwd: this.repoPath,
        encoding: 'utf-8',
      });

      const runs = JSON.parse(output);
      
      if (runs.length === 0) {
        return { status: 'unknown', runs: 0 };
      }

      const lastRun = runs[0];
      
      return {
        status: lastRun.status === 'completed' ? 'success' : 'pending',
        runs: runs.length,
        lastRun: new Date(lastRun.createdAt),
      };
    } catch (error) {
      return { status: 'unknown', runs: 0 };
    }
  }
}

/**
 * 便捷工厂函数
 */
export function createGitHubActionsIntegration(
  repoPath: string,
  config?: GitHubActionsConfig,
): GitHubActionsIntegration {
  return new GitHubActionsIntegration(repoPath, config);
}
