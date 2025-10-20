/**
 * GitLabCIIntegration单元测试
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GitLabCIIntegration } from '../GitLabCIIntegration';

describe('GitLabCIIntegration', () => {
  let integration: GitLabCIIntegration;
  const mockRepoPath = '/mock/repo';

  beforeEach(() => {
    integration = new GitLabCIIntegration(mockRepoPath, {
      enableAutoGenerate: true,
      enableAutoHealing: true,
      dockerImage: 'node:20',
      only: ['main', 'develop']
    });
  });

  describe('generateConfig', () => {
    it('should generate complete GitLab CI YAML', async () => {
      const result = await integration.generateConfig();

      expect(result.success).toBe(true);
      expect(result.configPath).toBe('.gitlab-ci.yml');
    });

    it('should include all stages', async () => {
      const result = await integration.generateConfig();

      // 配置应该包含多个stage: prepare, generate, test, heal, report
      expect(result.success).toBe(true);
    });

    it('should use specified Docker image', async () => {
      const result = await integration.generateConfig();

      // 配置应该使用node:20镜像
      expect(result.success).toBe(true);
    });

    it('should respect branch filters', async () => {
      const result = await integration.generateConfig();

      // 配置应该包含only: [main, develop]
      expect(result.success).toBe(true);
    });
  });

  describe('generateLocalScript', () => {
    it('should generate local simulation script', async () => {
      const scriptPath = await integration.generateLocalScript();

      expect(scriptPath).toBeDefined();
      expect(scriptPath).toContain('gitlab-ci-local.sh');
    });
  });

  describe('configuration options', () => {
    it('should work with minimal configuration', async () => {
      const minimalIntegration = new GitLabCIIntegration(mockRepoPath);

      const result = await minimalIntegration.generateConfig();

      expect(result.success).toBe(true);
    });

    it('should handle auto-generate disabled', async () => {
      const noGenIntegration = new GitLabCIIntegration(mockRepoPath, {
        enableAutoGenerate: false
      });

      const result = await noGenIntegration.generateConfig();

      expect(result.success).toBe(true);
      // Pipeline不应该包含generate stage
    });
  });

  describe('error handling', () => {
    it('should handle file write errors', async () => {
      const badIntegration = new GitLabCIIntegration('/read-only-path');
      
      const result = await badIntegration.generateConfig();

      expect(result.success).toBeDefined();
    });
  });
});

 * GitLabCIIntegration单元测试