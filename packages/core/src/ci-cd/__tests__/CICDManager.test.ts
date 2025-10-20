/**
 * CICDManager单元测试
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CICDManager } from '../CICDManager';
import * as path from 'path';

describe('CICDManager', () => {
  let manager: CICDManager;
  const mockRepoPath = path.join(__dirname, 'mock-repo');

  beforeEach(() => {
    manager = new CICDManager({
      repoPath: mockRepoPath,
      platforms: ['github', 'gitlab']
    });
  });

  describe('detectPlatform', () => {
    it('should detect CI/CD platforms', async () => {
      const platforms = await manager.detectPlatform();

      expect(platforms).toBeDefined();
      expect(Array.isArray(platforms)).toBe(true);
    });

    it('should return unknown when no CI config found', async () => {
      const emptyManager = new CICDManager({
        repoPath: '/non-existent-path'
      });

      const platforms = await emptyManager.detectPlatform();

      expect(platforms).toContain('unknown');
    });
  });

  describe('setup', () => {
    it('should setup multiple platforms', async () => {
      const results = await manager.setup(['github', 'gitlab']);

      expect(results).toBeDefined();
      expect(results.length).toBe(2);
      
      results.forEach(result => {
        expect(result.platform).toBeDefined();
        expect(result.success).toBeDefined();
      });
    });

    it('should handle unsupported platforms gracefully', async () => {
      const results = await manager.setup(['jenkins' as any]);

      expect(results[0].success).toBe(false);
      expect(results[0].error).toContain('not yet implemented');
    });
  });

  describe('setupAll', () => {
    it('should setup all supported platforms', async () => {
      const results = await manager.setupAll();

      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.platform === 'github')).toBe(true);
      expect(results.some(r => r.platform === 'gitlab')).toBe(true);
    });
  });

  describe('generateSetupReport', () => {
    it('should generate comprehensive setup report', async () => {
      const mockResults = [
        {
          platform: 'github' as const,
          success: true,
          configPath: '.github/workflows/testmind.yml'
        },
        {
          platform: 'gitlab' as const,
          success: false,
          error: 'Config generation failed'
        }
      ];

      const report = manager.generateSetupReport(mockResults);

      expect(report).toContain('CI/CD Setup Report');
      expect(report).toContain('github');
      expect(report).toContain('gitlab');
      expect(report).toContain('.github/workflows/testmind.yml');
      expect(report).toContain('Config generation failed');
    });
  });

  describe('getUsageGuide', () => {
    it('should provide GitHub Actions usage guide', () => {
      const guide = manager.getUsageGuide('github');

      expect(guide).toContain('GitHub Actions');
      expect(guide).toContain('.github/workflows/testmind-ci.yml');
      expect(guide).toContain('Pull Request');
    });

    it('should provide GitLab CI usage guide', () => {
      const guide = manager.getUsageGuide('gitlab');

      expect(guide).toContain('GitLab CI');
      expect(guide).toContain('.gitlab-ci.yml');
      expect(guide).toContain('Pipeline');
    });

    it('should handle unknown platforms', () => {
      const guide = manager.getUsageGuide('unknown');

      expect(guide).toContain('not available');
    });
  });
});

 * CICDManager单元测试