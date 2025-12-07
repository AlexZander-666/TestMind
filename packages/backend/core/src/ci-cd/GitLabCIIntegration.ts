/**
 * GitLabCIIntegration - GitLab CI/CD 集成
 * 
 * 功能：
 * - 生成 .gitlab-ci.yml
 * - 自动测试生成 pipeline
 * - 自愈测试 pipeline
 * - Merge Request 评论
 * - Coverage 报告
 */

import * as fs from 'fs/promises';
import * as path from 'path';

export interface GitLabCIConfig {
  /** CI 配置文件路径 */
  configPath?: string;
  
  /** 是否启用自动测试生成 */
  enableAutoGenerate?: boolean;
  
  /** 是否启用自愈 */
  enableAutoHealing?: boolean;
  
  /** Docker 镜像 */
  dockerImage?: string;
  
  /** 分支规则 */
  only?: string[];
  
  /** Node.js 版本 */
  nodeVersion?: string;
}

/**
 * GitLab CI/CD 集成器
 */
export class GitLabCIIntegration {
  private readonly config: Required<Omit<GitLabCIConfig, 'only'>>;
  private readonly only?: string[];
  private readonly repoPath: string;

  constructor(repoPath: string, config: GitLabCIConfig = {}) {
    this.repoPath = repoPath;
    this.config = {
      configPath: config.configPath ?? '.gitlab-ci.yml',
      enableAutoGenerate: config.enableAutoGenerate ?? false,
      enableAutoHealing: config.enableAutoHealing ?? false,
      dockerImage: config.dockerImage ?? `node:${config.nodeVersion || '20'}`,
      nodeVersion: config.nodeVersion ?? '20',
    };
    this.only = config.only;
  }

  /**
   * 生成 GitLab CI 配置
   */
  async generateConfig(): Promise<{ success: boolean; configPath?: string; error?: string }> {
    try {
      const configContent = this.buildConfigYAML();
      const configFullPath = path.join(this.repoPath, this.config.configPath);

      await fs.writeFile(configFullPath, configContent, 'utf-8');

      return {
        success: true,
        configPath: this.config.configPath,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 构建配置 YAML
   */
  private buildConfigYAML(): string {
    const yaml: string[] = [];

    // 镜像配置
    yaml.push(`image: ${this.config.dockerImage}`);
    yaml.push('');

    // 阶段定义
    yaml.push('stages:');
    yaml.push('  - prepare');
    if (this.config.enableAutoGenerate) {
      yaml.push('  - generate');
    }
    yaml.push('  - test');
    if (this.config.enableAutoHealing) {
      yaml.push('  - heal');
    }
    yaml.push('  - report');
    yaml.push('');

    // 缓存配置
    yaml.push('cache:');
    yaml.push('  paths:');
    yaml.push('    - node_modules/');
    yaml.push('    - .npm/');
    yaml.push('');

    // 准备阶段
    yaml.push('prepare:');
    yaml.push('  stage: prepare');
    yaml.push('  script:');
    yaml.push('    - npm ci --cache .npm --prefer-offline');
    yaml.push('    - npm install -g @testmind/cli');
    yaml.push('  artifacts:');
    yaml.push('    paths:');
    yaml.push('      - node_modules/');
    yaml.push('    expire_in: 1 hour');
    if (this.only && this.only.length > 0) {
      yaml.push('  only:');
      this.only.forEach(branch => yaml.push(`    - ${branch}`));
    }
    yaml.push('');

    // 测试生成阶段
    if (this.config.enableAutoGenerate) {
      yaml.push('generate:');
      yaml.push('  stage: generate');
      yaml.push('  script:');
      yaml.push('    - |');
      yaml.push('      if [ -z "${TESTMIND_GENERATE_COMMAND:-}" ]; then');
      yaml.push('        echo "Skipping TestMind generate. Set TESTMIND_GENERATE_COMMAND to run your automation."');
      yaml.push('      else');
      yaml.push('        eval "$TESTMIND_GENERATE_COMMAND" | tee generate-results.json');
      yaml.push('      fi');
      yaml.push('  artifacts:');
      yaml.push('    reports:');
      yaml.push('      dotenv: generate-results.json');
      yaml.push('    paths:');
      yaml.push('      - generate-results.json');
      yaml.push('      - tests/**/*.spec.ts # 生成的测试文件');
      yaml.push('  allow_failure: true');
      if (this.only && this.only.length > 0) {
        yaml.push('  only:');
        this.only.forEach(branch => yaml.push(`    - ${branch}`));
      }
      yaml.push('');
    }

    // 测试阶段
    yaml.push('test:');
    yaml.push('  stage: test');
    yaml.push('  script:');
    yaml.push('    - npm test');
    yaml.push('  coverage: \'/All files[^|]*\\|[^|]*\\s+([\\d\\.]+)/\'');
    yaml.push('  artifacts:');
    yaml.push('    reports:');
    yaml.push('      junit: coverage/junit.xml');
    yaml.push('      coverage_report:');
    yaml.push('        coverage_format: cobertura');
    yaml.push('        path: coverage/cobertura-coverage.xml');
    yaml.push('    paths:');
    yaml.push('      - coverage/');
    yaml.push('  allow_failure: true');
    if (this.only && this.only.length > 0) {
      yaml.push('  only:');
      this.only.forEach(branch => yaml.push(`    - ${branch}`));
    }
    yaml.push('');

    // 自愈阶段
    if (this.config.enableAutoHealing) {
      yaml.push('heal:');
      yaml.push('  stage: heal');
      yaml.push('  script:');
      yaml.push('    - |');
      yaml.push('      if [ -z "${TESTMIND_HEAL_COMMAND:-}" ]; then');
      yaml.push('        echo "Skipping TestMind heal. Set TESTMIND_HEAL_COMMAND to run your automation."');
      yaml.push('      else');
      yaml.push('        eval "$TESTMIND_HEAL_COMMAND" | tee heal-results.json');
      yaml.push('      fi');
      yaml.push('    - npm test # 重新运行测试');
      yaml.push('  artifacts:');
      yaml.push('    paths:');
      yaml.push('      - heal-results.json');
      yaml.push('      - tests/**/*.spec.ts # 修复后的测试');
      yaml.push('  when: on_failure');
      yaml.push('  dependencies:');
      yaml.push('    - test');
      if (this.only && this.only.length > 0) {
        yaml.push('  only:');
        this.only.forEach(branch => yaml.push(`    - ${branch}`));
      }
      yaml.push('');
    }

    // 报告阶段
    yaml.push('report:');
    yaml.push('  stage: report');
    yaml.push('  image: alpine:latest');
    yaml.push('  script:');
    yaml.push('    - echo "📊 Generating TestMind report..."');
    yaml.push('    - |');
    yaml.push('      cat > testmind-report.md << \'EOF\'');
    yaml.push('      ## 🤖 TestMind CI Report');
    yaml.push('      ');
    if (this.config.enableAutoGenerate) {
      yaml.push('      ### ✨ Test Generation');
      yaml.push('      - See generate-results.json for details');
      yaml.push('      ');
    }
    yaml.push('      ### 🧪 Test Results');
    yaml.push('      - See coverage report');
    yaml.push('      ');
    if (this.config.enableAutoHealing) {
      yaml.push('      ### 🔧 Self-Healing');
      yaml.push('      - See heal-results.json for details');
      yaml.push('      EOF');
    }
    yaml.push('    - cat testmind-report.md');
    yaml.push('  artifacts:');
    yaml.push('    paths:');
    yaml.push('      - testmind-report.md');
    yaml.push('  when: always');
    if (this.only && this.only.length > 0) {
      yaml.push('  only:');
      this.only.forEach(branch => yaml.push(`    - ${branch}`));
    }

    return yaml.join('\n');
  }

  /**
   * 生成本地模拟脚本
   */
  async generateLocalScript(): Promise<string> {
    const script: string[] = [];

    script.push('#!/bin/bash');
    script.push('# TestMind GitLab CI - Local Simulation');
    script.push('set -e');
    script.push('');

    script.push('echo "🚀 TestMind GitLab CI (Local)"');
    script.push('');

    script.push('# Stage: prepare');
    script.push('echo "📦 Installing dependencies..."');
    script.push('npm ci');
    script.push('npm install -g @testmind/cli');
    script.push('');

    if (this.config.enableAutoGenerate) {
      script.push('# Stage: generate');
      script.push('echo "✨ Generating tests..."');
      script.push('if [ -z "${TESTMIND_GENERATE_COMMAND:-}" ]; then');
      script.push('  echo "Skipping generation (set TESTMIND_GENERATE_COMMAND to enable)"');
      script.push('else');
      script.push('  eval "$TESTMIND_GENERATE_COMMAND"');
      script.push('fi');
      script.push('');
    }

    script.push('# Stage: test');
    script.push('echo "🧪 Running tests..."');
    script.push('npm test || TEST_FAILED=true');
    script.push('');

    if (this.config.enableAutoHealing) {
      script.push('# Stage: heal');
      script.push('if [ "$TEST_FAILED" = true ]; then');
      script.push('  echo "🔧 Healing tests..."');
      script.push('  if [ -z "${TESTMIND_HEAL_COMMAND:-}" ]; then');
      script.push('    echo "Skipping healing (set TESTMIND_HEAL_COMMAND to enable)"');
      script.push('  else');
      script.push('    eval "$TESTMIND_HEAL_COMMAND"');
      script.push('  fi');
      script.push('  npm test');
      script.push('fi');
      script.push('');
    }

    script.push('# Stage: report');
    script.push('echo "📊 Generating report..."');
    script.push('echo "✅ Pipeline completed!"');

    const scriptPath = path.join(this.repoPath, 'scripts', 'gitlab-ci-local.sh');
    await fs.mkdir(path.dirname(scriptPath), { recursive: true });
    await fs.writeFile(scriptPath, script.join('\n'), { mode: 0o755 });

    return scriptPath;
  }
}

/**
 * 便捷工厂函数
 */
export function createGitLabCIIntegration(
  repoPath: string,
  config?: GitLabCIConfig,
): GitLabCIIntegration {
  return new GitLabCIIntegration(repoPath, config);
}
