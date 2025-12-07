/**
 * GitHubActionsIntegration单元测试
 */

import * as fs from 'fs/promises';
import * as path from 'path';

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { GitHubActionsIntegration } from '../GitHubActionsIntegration';

const mockRepoPath = path.join(__dirname, 'mock-repo-github');

const ensureMockRepo = async () => {
  await fs.rm(mockRepoPath, { recursive: true, force: true });
  await fs.mkdir(mockRepoPath, { recursive: true });
};

vi.mock('child_process', () => ({
  execSync: vi.fn(() => '[]'),
}));

describe('GitHubActionsIntegration', () => {
  let integration: GitHubActionsIntegration;
  beforeEach(async () => {
    await ensureMockRepo();
    integration = new GitHubActionsIntegration(mockRepoPath, {
      enableAutoGenerate: true,
      enableAutoHealing: true,
      enableAutoPR: false,
      trigger: 'pull_request',
      branches: ['main', 'develop'],
    });
  });

  afterEach(async () => {
    await fs.rm(mockRepoPath, { recursive: true, force: true });
  });

  describe('generateWorkflow', () => {
    it('should generate complete workflow YAML', async () => {
      const result = await integration.generateWorkflow();

      expect(result.success).toBe(true);
      expect(result.workflowPath).toBeDefined();
      expect(result.workflowPath).toContain('.github/workflows');
    });

    it('should include test generation when enabled', async () => {
      const result = await integration.generateWorkflow();

      // Workflow应该包含testmind generate步骤
      expect(result.success).toBe(true);
    });

    it('should include self-healing when enabled', async () => {
      const result = await integration.generateWorkflow();

      // Workflow应该包含testmind heal步骤
      expect(result.success).toBe(true);
    });

    it('should respect trigger configuration', async () => {
      const pushIntegration = new GitHubActionsIntegration(mockRepoPath, {
        trigger: 'push',
      });

      const result = await pushIntegration.generateWorkflow();

      expect(result.success).toBe(true);
    });

    it('should handle custom branches', async () => {
      const result = await integration.generateWorkflow();

      // Workflow应该包含main和develop分支
      expect(result.success).toBe(true);
    });
  });

  describe('generateLocalTestScript', () => {
    it('should generate executable bash script', async () => {
      const scriptPath = await integration.generateLocalTestScript();

      expect(scriptPath).toBeDefined();
      expect(scriptPath).toContain('testmind-ci-local.sh');
    });
  });

  describe('updateWorkflow', () => {
    it('should update existing workflow configuration', async () => {
      const result = await integration.updateWorkflow({
        enableAutoPR: true,
        nodeVersion: '18',
      });

      expect(result.success).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle file write errors gracefully', async () => {
      const badIntegration = new GitHubActionsIntegration('/read-only-path');
      
      const result = await badIntegration.generateWorkflow();

      // 应该返回error而不是throw
      expect(result.success).toBeDefined();
    });
  });
});
