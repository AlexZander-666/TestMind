/**
 * Integration tests: StaticAnalyzer + DependencyGraphBuilder
 * Verify the full context engine workflow
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ContextEngine } from '../ContextEngine';
import type { ProjectConfig } from '@testmind/shared';
import { DEFAULT_CONFIG } from '@testmind/shared';
import path from 'path';

describe('ContextEngine Integration', () => {
  let contextEngine: ContextEngine;
  let config: ProjectConfig;

  beforeEach(() => {
    config = {
      id: 'integration-test-project',
      name: 'Integration Test',
      repoPath: path.join(__dirname, 'fixtures'),
      language: 'typescript',
      testFramework: 'vitest',
      config: {
        ...DEFAULT_CONFIG,
        includePatterns: ['**/*.ts'],
        excludePatterns: ['**/*.test.ts', '**/*.spec.ts'],
      },
    };

    contextEngine = new ContextEngine(config);
  });

  describe('Full workflow', () => {
    it('should index project and build dependency graph', async () => {
      const fixturesDir = path.join(__dirname, 'fixtures');
      
      // This tests the complete workflow:
      // 1. StaticAnalyzer parses files
      // 2. DependencyGraphBuilder builds graph
      // 3. SemanticIndexer creates embeddings (placeholder for now)
      const result = await contextEngine.indexProject(fixturesDir);

      expect(result.filesIndexed).toBeGreaterThan(0);
      expect(result.functionsExtracted).toBeGreaterThan(0);
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should get function context with dependencies', async () => {
      const fixturesDir = path.join(__dirname, 'fixtures');
      await contextEngine.indexProject(fixturesDir);

      const sampleFile = path.join(fixturesDir, 'sample.ts');
      const context = await contextEngine.getFunctionContext(sampleFile, 'fetchUserData');

      expect(context).toBeDefined();
      expect(context.signature.name).toBe('fetchUserData');
      expect(context.dependencies).toBeDefined();
      expect(Array.isArray(context.dependencies)).toBe(true);
    });

    it('should get module context with full dependency tree', async () => {
      const fixturesDir = path.join(__dirname, 'fixtures');
      await contextEngine.indexProject(fixturesDir);

      const moduleAPath = path.join(fixturesDir, 'moduleA.ts');
      const moduleContext = await contextEngine.getModuleContext(moduleAPath);

      expect(moduleContext).toBeDefined();
      expect(moduleContext.modulePath).toBe(moduleAPath);
      expect(moduleContext.dependencies).toBeDefined();
      expect(Array.isArray(moduleContext.dependencies)).toBe(true);
    });
  });

  describe('Performance benchmarks', () => {
    it('should index project in reasonable time', async () => {
      const fixturesDir = path.join(__dirname, 'fixtures');
      const startTime = Date.now();
      
      await contextEngine.indexProject(fixturesDir);
      
      const duration = Date.now() - startTime;
      
      // Should complete in less than 5 seconds for small project
      expect(duration).toBeLessThan(5000);
      console.log(`  ⏱️  Indexing duration: ${duration}ms`);
    });
  });
});



























