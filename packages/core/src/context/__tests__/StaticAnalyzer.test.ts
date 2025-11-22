/**
 * Tests for StaticAnalyzer
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { StaticAnalyzer } from '../StaticAnalyzer';
import type { ProjectConfig } from '@testmind/shared';
import { DEFAULT_CONFIG } from '@testmind/shared';
import path from 'path';

describe('StaticAnalyzer', () => {
  let analyzer: StaticAnalyzer;
  let config: ProjectConfig;

  beforeEach(() => {
    config = {
      id: 'test-project-id',
      name: 'TestProject',
      repoPath: __dirname,
      language: 'typescript',
      testFramework: 'vitest',
      config: DEFAULT_CONFIG,
    };
    analyzer = new StaticAnalyzer(config);
  });

  describe('analyzeFile', () => {
    it('should parse TypeScript file and extract functions', async () => {
      const filePath = path.join(__dirname, 'fixtures/sample.ts');
      const result = await analyzer.analyzeFile(filePath);

      expect(result).toBeDefined();
      expect(result.language).toBe('typescript');
      expect(result.astData).toBeDefined();
      expect(result.astData.functions.length).toBeGreaterThan(0);
    });

    it('should extract function with correct signature', async () => {
      const filePath = path.join(__dirname, 'fixtures/sample.ts');
      const result = await analyzer.analyzeFile(filePath);

      const addFunction = result.astData.functions.find((f) => f.name === 'add');
      expect(addFunction).toBeDefined();
      expect(addFunction?.parameters).toHaveLength(2);
      expect(addFunction?.parameters[0]?.name).toBe('a');
      expect(addFunction?.parameters[0]?.type).toContain('number');
      expect(addFunction?.isExported).toBe(true);
    });

    it('should detect async functions', async () => {
      const filePath = path.join(__dirname, 'fixtures/sample.ts');
      const result = await analyzer.analyzeFile(filePath);

      const asyncFunction = result.astData.functions.find((f) => f.name === 'fetchUserData');
      expect(asyncFunction).toBeDefined();
      expect(asyncFunction?.isAsync).toBe(true);
    });

    it('should extract optional and default parameters', async () => {
      const filePath = path.join(__dirname, 'fixtures/sample.ts');
      const result = await analyzer.analyzeFile(filePath);

      const greetFunction = result.astData.functions.find((f) => f.name === 'greet');
      expect(greetFunction).toBeDefined();
      expect(greetFunction?.parameters).toHaveLength(3);
      
      // Check default parameter
      const greetingParam = greetFunction?.parameters.find((p) => p.name === 'greeting');
      expect(greetingParam?.defaultValue).toBeDefined();
      
      // Check optional parameter
      const excitedParam = greetFunction?.parameters.find((p) => p.name === 'excited');
      expect(excitedParam?.optional).toBe(true);
    });

    it('should extract classes with methods', async () => {
      const filePath = path.join(__dirname, 'fixtures/sample.ts');
      const result = await analyzer.analyzeFile(filePath);

      const userServiceClass = result.astData.classes.find((c) => c.name === 'UserService');
      expect(userServiceClass).toBeDefined();
      expect(userServiceClass?.methods.length).toBeGreaterThan(0);
      
      const getUserMethod = userServiceClass?.methods.find((m) => m.name === 'getUser');
      expect(getUserMethod).toBeDefined();
      expect(getUserMethod?.isAsync).toBe(true);
    });

    it('should extract class properties', async () => {
      const filePath = path.join(__dirname, 'fixtures/sample.ts');
      const result = await analyzer.analyzeFile(filePath);

      const userServiceClass = result.astData.classes.find((c) => c.name === 'UserService');
      expect(userServiceClass?.properties.length).toBeGreaterThan(0);
      
      const baseUrlProp = userServiceClass?.properties.find((p) => p.name === 'baseUrl');
      expect(baseUrlProp).toBeDefined();
      expect(baseUrlProp?.visibility).toBe('private');
    });

    it('should extract imports', async () => {
      const filePath = path.join(__dirname, 'fixtures/sample.ts');
      const result = await analyzer.analyzeFile(filePath);

      expect(result.astData.imports.length).toBeGreaterThan(0);
      
      const fsImport = result.astData.imports.find((i) => i.source.includes('fs'));
      expect(fsImport).toBeDefined();
      expect(fsImport?.specifiers).toContain('readFile');
    });

    it('should extract exports', async () => {
      const filePath = path.join(__dirname, 'fixtures/sample.ts');
      const result = await analyzer.analyzeFile(filePath);

      expect(result.astData.exports.length).toBeGreaterThan(0);
      
      const addExport = result.astData.exports.find((e) => e.name === 'add');
      expect(addExport).toBeDefined();
      expect(addExport?.isDefault).toBe(false);
    });
  });

  describe('getFunction', () => {
    it('should retrieve specific function by name', async () => {
      const filePath = path.join(__dirname, 'fixtures/sample.ts');
      const func = await analyzer.getFunction(filePath, 'add');

      expect(func).toBeDefined();
      expect(func?.name).toBe('add');
      expect(func?.parameters).toHaveLength(2);
    });

    it('should return null for non-existent function', async () => {
      const filePath = path.join(__dirname, 'fixtures/sample.ts');
      const func = await analyzer.getFunction(filePath, 'nonExistent');

      expect(func).toBeNull();
    });
  });

  describe('analyzeSideEffects', () => {
    it('should detect network side effects', async () => {
      const filePath = path.join(__dirname, 'fixtures/sample.ts');
      const sideEffects = await analyzer.analyzeSideEffects(filePath, 'fetchUserData');

      expect(sideEffects.length).toBeGreaterThan(0);
      const networkEffect = sideEffects.find((se) => se.type === 'network');
      expect(networkEffect).toBeDefined();
    });

    it('should detect file system side effects', async () => {
      const filePath = path.join(__dirname, 'fixtures/sample.ts');
      const sideEffects = await analyzer.analyzeSideEffects(filePath, 'loadConfig');

      const fsEffect = sideEffects.find((se) => se.type === 'filesystem');
      expect(fsEffect).toBeDefined();
    });
  });

  describe('calculateComplexity', () => {
    it('should calculate complexity for simple function', async () => {
      const filePath = path.join(__dirname, 'fixtures/sample.ts');
      const complexity = await analyzer.calculateComplexity(filePath, 'add');

      expect(complexity.cyclomaticComplexity).toBe(1); // No branches
      expect(complexity.linesOfCode).toBeGreaterThan(0);
      expect(complexity.maintainabilityIndex).toBeGreaterThan(80);
    });

    it('should calculate higher complexity for branching function', async () => {
      const filePath = path.join(__dirname, 'fixtures/sample.ts');
      const complexity = await analyzer.calculateComplexity(filePath, 'calculateDiscount');

      expect(complexity.cyclomaticComplexity).toBeGreaterThan(1);
      expect(complexity.cognitiveComplexity).toBeGreaterThan(0);
    });
  });

  describe('getModuleExports', () => {
    it('should retrieve all module exports', async () => {
      const filePath = path.join(__dirname, 'fixtures/sample.ts');
      const exports = await analyzer.getModuleExports(filePath);

      expect(exports.length).toBeGreaterThan(0);
      expect(exports).toContain('add');
      expect(exports).toContain('UserService');
    });
  });
});



























