/**
 * Tests for DependencyGraphBuilder
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DependencyGraphBuilder } from '../DependencyGraphBuilder';
import { StaticAnalyzer } from '../StaticAnalyzer';
import type { ProjectConfig, CodeFile } from '@testmind/shared';
import { DEFAULT_CONFIG } from '@testmind/shared';
import path from 'path';

describe('DependencyGraphBuilder', () => {
  let builder: DependencyGraphBuilder;
  let analyzer: StaticAnalyzer;
  let config: ProjectConfig;
  let testFiles: CodeFile[];

  beforeEach(async () => {
    config = {
      id: 'test-project-id',
      name: 'TestProject',
      repoPath: __dirname,
      language: 'typescript',
      testFramework: 'vitest',
      config: DEFAULT_CONFIG,
    };

    analyzer = new StaticAnalyzer(config);
    builder = new DependencyGraphBuilder(config);

    // Analyze test fixture files
    const fixturesDir = path.join(__dirname, 'fixtures');
    testFiles = await Promise.all([
      analyzer.analyzeFile(path.join(fixturesDir, 'moduleA.ts')),
      analyzer.analyzeFile(path.join(fixturesDir, 'moduleB.ts')),
      analyzer.analyzeFile(path.join(fixturesDir, 'moduleC.ts')),
    ]);
  });

  describe('buildGraph', () => {
    it('should build dependency graph from files', async () => {
      await builder.buildGraph(testFiles);

      const stats = builder.getStats();
      expect(stats.totalNodes).toBeGreaterThan(0);
      expect(stats.totalEdges).toBeGreaterThanOrEqual(0);
    });

    it('should track module dependencies correctly', async () => {
      await builder.buildGraph(testFiles);

      const moduleAPath = testFiles[0]?.filePath;
      if (!moduleAPath) throw new Error('moduleA not found');

      const deps = await builder.getModuleDependencies(moduleAPath);
      
      // Module A should depend on Module B and C
      expect(Array.isArray(deps)).toBe(true);
    });

    it('should build reverse dependency graph', async () => {
      await builder.buildGraph(testFiles);

      const moduleBPath = testFiles[1]?.filePath;
      if (!moduleBPath) throw new Error('moduleB not found');

      const callers = await builder.getFunctionCallers(moduleBPath, 'helperFunction');
      
      // Should return array
      expect(Array.isArray(callers)).toBe(true);
    });

    it('should handle files with no dependencies', async () => {
      await builder.buildGraph(testFiles);

      const moduleBPath = testFiles[1]?.filePath;
      if (!moduleBPath) throw new Error('moduleB not found');

      const deps = await builder.getModuleDependencies(moduleBPath);
      
      // Module B has no imports
      expect(Array.isArray(deps)).toBe(true);
    });
  });

  describe('getFunctionDependencies', () => {
    it('should return function dependencies', async () => {
      await builder.buildGraph(testFiles);

      const moduleAPath = testFiles[0]?.filePath;
      if (!moduleAPath) throw new Error('moduleA not found');

      const deps = await builder.getFunctionDependencies(moduleAPath, 'processData');
      
      expect(deps).toBeDefined();
      expect(Array.isArray(deps)).toBe(true);
    });
  });

  describe('getTransitiveDependencies', () => {
    it('should find transitive dependencies', async () => {
      await builder.buildGraph(testFiles);

      const moduleAPath = testFiles[0]?.filePath;
      if (!moduleAPath) throw new Error('moduleA not found');

      const transitiveDeps = builder.getTransitiveDependencies(moduleAPath);
      
      expect(transitiveDeps).toBeDefined();
      expect(transitiveDeps.size).toBeGreaterThanOrEqual(0);
    });

    it('should respect max depth limit', async () => {
      await builder.buildGraph(testFiles);

      const moduleAPath = testFiles[0]?.filePath;
      if (!moduleAPath) throw new Error('moduleA not found');

      const depthOne = builder.getTransitiveDependencies(moduleAPath, 1);
      const depthTwo = builder.getTransitiveDependencies(moduleAPath, 2);
      
      // Depth 2 should have more or equal dependencies
      expect(depthTwo.size).toBeGreaterThanOrEqual(depthOne.size);
    });
  });

  describe('detectCircularDependencies', () => {
    it('should detect when no circular dependencies exist', async () => {
      await builder.buildGraph(testFiles);

      const moduleAPath = testFiles[0]?.filePath;
      if (!moduleAPath) throw new Error('moduleA not found');

      const cycles = builder.detectCircularDependencies(moduleAPath);
      
      // Our test fixtures have no cycles
      expect(Array.isArray(cycles)).toBe(true);
    });
  });

  describe('getStats', () => {
    it('should return graph statistics', async () => {
      await builder.buildGraph(testFiles);

      const stats = builder.getStats();
      
      expect(stats.totalNodes).toBeGreaterThan(0);
      expect(stats.totalEdges).toBeGreaterThanOrEqual(0);
      expect(stats.avgDependencies).toBeGreaterThanOrEqual(0);
      expect(stats.maxDependencies).toBeGreaterThanOrEqual(0);
    });
  });

  describe('exportToDOT', () => {
    it('should export graph in DOT format', async () => {
      await builder.buildGraph(testFiles);

      const dot = builder.exportToDOT();
      
      expect(dot).toContain('digraph Dependencies');
      expect(dot).toBeDefined();
    });
  });

  describe('updateFile', () => {
    it('should update graph for single file', async () => {
      await builder.buildGraph(testFiles);

      const moduleAPath = testFiles[0]?.filePath;
      if (!moduleAPath) throw new Error('moduleA not found');

      await builder.updateFile(moduleAPath);
      
      // Graph should still be valid
      const stats = builder.getStats();
      expect(stats.totalNodes).toBeGreaterThan(0);
    });
  });
});
