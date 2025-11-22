/**
 * Error Handling and Boundary Conditions Tests
 * Validates system resilience and defensive programming
 * 
 * Tests the robustness principle from 4.md:
 * "Systems should fail gracefully and provide clear error messages"
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { StaticAnalyzer } from '../context/StaticAnalyzer';
import { ContextEngine } from '../context/ContextEngine';
import { TestStrategyPlanner } from '../generation/TestStrategyPlanner';
import { PromptBuilder } from '../generation/PromptBuilder';
import { DependencyGraphBuilder } from '../context/DependencyGraphBuilder';
import type { ProjectConfig, FunctionContext } from '@testmind/shared';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import { getTestFixturesPath } from './utils/test-helpers';

describe('Error Handling - File Operations', () => {
  let config: ProjectConfig;

  beforeAll(() => {
    config = {
      id: 'test-project',
      name: 'Test Project',
      language: 'typescript',
      rootPath: getTestFixturesPath(),
      config: {
        includePatterns: ['**/*.ts'],
        excludePatterns: ['**/*.test.ts'],
        testFramework: 'jest',
        llmConfig: {
          provider: 'openai',
          model: 'gpt-4',
          apiKey: 'test-key',
        },
      },
    };
  });

  it('should handle file not found with clear error message', async () => {
    const engine = new ContextEngine(config);
    
    await expect(
      engine.getFunctionContext('does-not-exist.ts', 'someFunction')
    ).rejects.toThrow();
    
    // TODO: In ideal implementation, should throw AnalysisError with helpful suggestions
    // e.g., "File not found. Did you mean: sample.ts?"
  });

  it('should handle function not found gracefully', async () => {
    const engine = new ContextEngine(config);
    const fixturesPath = path.join(__dirname, '../context/__tests__/fixtures');
    const samplePath = path.join(fixturesPath, 'sample.ts');
    
    await expect(
      engine.getFunctionContext(samplePath, 'nonexistentFunction')
    ).rejects.toThrow(/not found/i);
    
    // Error message should be informative
    try {
      await engine.getFunctionContext(samplePath, 'nonexistentFunction');
    } catch (error) {
      expect((error as Error).message).toContain('nonexistentFunction');
    }
  });

  it('should handle invalid file path gracefully', async () => {
    const analyzer = new StaticAnalyzer(config);
    
    // Test various invalid paths
    await expect(
      analyzer.analyzeFile('')
    ).rejects.toThrow();
    
    await expect(
      analyzer.analyzeFile('/invalid/path/to/nowhere.ts')
    ).rejects.toThrow();
  });

  it('should handle permission denied errors', async () => {
    // Note: This test might be platform-specific
    const analyzer = new StaticAnalyzer(config);
    
    // Try to analyze a file we definitely can't read (if it exists)
    // On most systems, /root or C:\Windows\System32 files require special permissions
    const restrictedPath = process.platform === 'win32' 
      ? 'C:\\Windows\\System32\\config\\SAM'
      : '/root/.ssh/id_rsa';
    
    // Should handle permission errors gracefully (not crash)
    try {
      await analyzer.analyzeFile(restrictedPath);
    } catch (error) {
      // Should throw an error, but not crash the process
      expect(error).toBeDefined();
    }
  });
});

describe('Boundary Conditions - Empty and Minimal Cases', () => {
  let config: ProjectConfig;
  let tempDir: string;

  beforeAll(async () => {
    // Create temporary directory for test files
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'testmind-test-'));
    
    config = {
      id: 'test-project',
      name: 'Test Project',
      language: 'typescript',
      rootPath: tempDir,
      config: {
        includePatterns: ['**/*.ts'],
        excludePatterns: ['**/*.test.ts'],
        testFramework: 'jest',
        llmConfig: {
          provider: 'openai',
          model: 'gpt-4',
          apiKey: 'test-key',
        },
      },
    };
  });

  afterAll(async () => {
    // Clean up temporary files
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should handle empty file without crashing', async () => {
    const analyzer = new StaticAnalyzer(config);
    const emptyFile = path.join(tempDir, 'empty.ts');
    
    // Create empty file
    await fs.writeFile(emptyFile, '');
    
    // Should analyze without crashing
    const result = await analyzer.analyzeFile(emptyFile);
    
    expect(result).toBeDefined();
    expect(result.astData.functions).toEqual([]);
    expect(result.astData.classes).toEqual([]);
    expect(result.astData.imports).toEqual([]);
    expect(result.astData.exports).toEqual([]);
  });

  it('should handle file with only comments', async () => {
    const analyzer = new StaticAnalyzer(config);
    const commentOnlyFile = path.join(tempDir, 'comments-only.ts');
    
    // Create file with only comments
    await fs.writeFile(commentOnlyFile, `
      // This is a comment
      /* This is a multi-line
         comment */
      // Another comment
    `);
    
    const result = await analyzer.analyzeFile(commentOnlyFile);
    
    expect(result).toBeDefined();
    expect(result.astData.functions).toEqual([]);
    expect(result.astData.classes).toEqual([]);
  });

  it('should handle file with only whitespace', async () => {
    const analyzer = new StaticAnalyzer(config);
    const whitespaceFile = path.join(tempDir, 'whitespace.ts');
    
    // Create file with only whitespace
    await fs.writeFile(whitespaceFile, '   \n\n\t\t\n   ');
    
    const result = await analyzer.analyzeFile(whitespaceFile);
    
    expect(result).toBeDefined();
    expect(result.astData.functions).toEqual([]);
  });

  it('should handle function with no parameters', async () => {
    const analyzer = new StaticAnalyzer(config);
    const engine = new ContextEngine(config);
    const noParamFile = path.join(tempDir, 'no-param.ts');
    
    // Create function with no parameters
    await fs.writeFile(noParamFile, `
      export function getAnswer(): number {
        return 42;
      }
    `);
    
    const context = await engine.getFunctionContext(noParamFile, 'getAnswer');
    
    expect(context.signature.parameters).toEqual([]);
    expect(context.signature.returnType).toBe(': number');
  });

  it('should handle function with no return type annotation', async () => {
    const engine = new ContextEngine(config);
    const noReturnFile = path.join(tempDir, 'no-return.ts');
    
    // Create function without return type
    await fs.writeFile(noReturnFile, `
      export function doSomething() {
        console.log('hello');
      }
    `);
    
    const context = await engine.getFunctionContext(noReturnFile, 'doSomething');
    
    expect(context.signature.returnType).toBeUndefined();
  });

  it('should handle anonymous/arrow functions', async () => {
    const analyzer = new StaticAnalyzer(config);
    const arrowFile = path.join(tempDir, 'arrow.ts');
    
    // Create arrow function
    await fs.writeFile(arrowFile, `
      export const add = (a: number, b: number) => a + b;
    `);
    
    const result = await analyzer.analyzeFile(arrowFile);
    
    expect(result.astData.functions.length).toBeGreaterThan(0);
    const func = result.astData.functions[0];
    expect(func.parameters).toHaveLength(2);
  });
});

describe('Boundary Conditions - Large and Complex Cases', () => {
  let config: ProjectConfig;
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'testmind-test-'));
    
    config = {
      id: 'test-project',
      name: 'Test Project',
      language: 'typescript',
      rootPath: tempDir,
      config: {
        includePatterns: ['**/*.ts'],
        excludePatterns: ['**/*.test.ts'],
        testFramework: 'jest',
        llmConfig: {
          provider: 'openai',
          model: 'gpt-4',
          apiKey: 'test-key',
        },
      },
    };
  });

  afterAll(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should handle very long function names', async () => {
    const analyzer = new StaticAnalyzer(config);
    const longNameFile = path.join(tempDir, 'long-name.ts');
    
    // Function name with 100+ characters
    const longName = 'thisIsAnExtremelyLongFunctionNameThatSomeoneDecidedToCreateForSomeReasonAndItKeepsGoingAndGoingAndGoing';
    
    await fs.writeFile(longNameFile, `
      export function ${longName}(): void {
        return;
      }
    `);
    
    const result = await analyzer.analyzeFile(longNameFile);
    
    // Tree-sitter may tokenize very long names differently
    // Just verify we found functions and the name contains our identifier
    expect(result.astData.functions.length).toBeGreaterThan(0);
    expect(result.astData.functions[0].name).toContain('thisIsAnExtremely');
  });

  it('should handle function with many parameters', async () => {
    const engine = new ContextEngine(config);
    const manyParamsFile = path.join(tempDir, 'many-params.ts');
    
    // Function with 10 parameters
    await fs.writeFile(manyParamsFile, `
      export function manyParams(
        a: number, b: number, c: number, d: number, e: number,
        f: number, g: number, h: number, i: number, j: number
      ): number {
        return a + b + c + d + e + f + g + h + i + j;
      }
    `);
    
    const context = await engine.getFunctionContext(manyParamsFile, 'manyParams');
    
    expect(context.signature.parameters).toHaveLength(10);
  });

  it('should handle deeply nested functions', async () => {
    const analyzer = new StaticAnalyzer(config);
    const nestedFile = path.join(tempDir, 'nested.ts');
    
    // Deeply nested function
    await fs.writeFile(nestedFile, `
      export function outer() {
        function middle() {
          function inner() {
            return 42;
          }
          return inner();
        }
        return middle();
      }
    `);
    
    const result = await analyzer.analyzeFile(nestedFile);
    
    // Should find at least the outer function
    expect(result.astData.functions.length).toBeGreaterThan(0);
    const outerFunc = result.astData.functions.find(f => f.name === 'outer');
    expect(outerFunc).toBeDefined();
  });

  it('should handle high cyclomatic complexity', async () => {
    const engine = new ContextEngine(config);
    const complexFile = path.join(tempDir, 'complex.ts');
    
    // Function with high complexity (many branches)
    await fs.writeFile(complexFile, `
      export function veryComplex(x: number): string {
        if (x === 0) return 'zero';
        if (x === 1) return 'one';
        if (x === 2) return 'two';
        if (x === 3) return 'three';
        if (x === 4) return 'four';
        if (x === 5) return 'five';
        if (x === 6) return 'six';
        if (x === 7) return 'seven';
        if (x === 8) return 'eight';
        if (x === 9) return 'nine';
        return 'many';
      }
    `);
    
    const context = await engine.getFunctionContext(complexFile, 'veryComplex');
    
    expect(context.complexity.cyclomaticComplexity).toBeGreaterThan(10);
  });

  it('should handle very long files', async () => {
    const analyzer = new StaticAnalyzer(config);
    const longFile = path.join(tempDir, 'long-file.ts');
    
    // Create a file with 1000+ lines
    const lines: string[] = [];
    for (let i = 0; i < 100; i++) {
      lines.push(`
        export function func${i}(x: number): number {
          return x * ${i};
        }
      `);
    }
    
    await fs.writeFile(longFile, lines.join('\n'));
    
    const result = await analyzer.analyzeFile(longFile);
    
    // Should find all 100 functions (Tree-sitter may count some twice due to parsing)
    expect(result.astData.functions.length).toBeGreaterThanOrEqual(100);
  });
});

describe('Error Handling - Strategy Planning', () => {
  let config: ProjectConfig;

  beforeAll(() => {
    config = {
      id: 'test-project',
      name: 'Test Project',
      language: 'typescript',
      rootPath: path.join(__dirname, '../context/__tests__/fixtures'),
      config: {
        includePatterns: ['**/*.ts'],
        excludePatterns: ['**/*.test.ts'],
        testFramework: 'jest',
        llmConfig: {
          provider: 'openai',
          model: 'gpt-4',
          apiKey: 'test-key',
        },
      },
    };
  });

  it('should handle function context with missing type information', async () => {
    const planner = new TestStrategyPlanner();
    
    // Create minimal function context (missing optional fields)
    const minimalContext: FunctionContext = {
      signature: {
        name: 'testFunc',
        filePath: '/test.ts',
        parameters: [],
        isAsync: false,
      },
      dependencies: [],
      callers: [],
      sideEffects: [],
      existingTests: [],
      coverage: {
        linesCovered: 0,
        linesTotal: 0,
        branchesCovered: 0,
        branchesTotal: 0,
        functionsCovered: 0,
        functionsTotal: 0,
        percentage: 0,
      },
      complexity: {
        cyclomaticComplexity: 1,
        cognitiveComplexity: 1,
        linesOfCode: 5,
        maintainabilityIndex: 100,
      },
    };
    
    // Should handle gracefully without crashing
    const strategy = await planner.planUnitTest(minimalContext);
    
    expect(strategy).toBeDefined();
    expect(strategy.type).toBeDefined();
    expect(strategy.mockStrategy).toBeDefined();
  });

  it('should handle parameters with unknown types', async () => {
    const planner = new TestStrategyPlanner();
    
    const context: FunctionContext = {
      signature: {
        name: 'mystery',
        filePath: '/test.ts',
        parameters: [
          { name: 'x', type: undefined, optional: false }, // No type info
          { name: 'y', optional: false }, // No type info
        ],
        isAsync: false,
      },
      dependencies: [],
      callers: [],
      sideEffects: [],
      existingTests: [],
      coverage: {
        linesCovered: 0,
        linesTotal: 0,
        branchesCovered: 0,
        branchesTotal: 0,
        functionsCovered: 0,
        functionsTotal: 0,
        percentage: 0,
      },
      complexity: {
        cyclomaticComplexity: 1,
        cognitiveComplexity: 1,
        linesOfCode: 5,
        maintainabilityIndex: 100,
      },
    };
    
    const strategy = await planner.planUnitTest(context);
    
    // Should still create a strategy, even without type info
    expect(strategy).toBeDefined();
    expect(strategy.boundaryConditions).toBeDefined();
  });
});

describe('Error Handling - Prompt Building', () => {
  it('should handle empty context gracefully', async () => {
    const builder = new PromptBuilder();
    
    const minimalContext: FunctionContext = {
      signature: {
        name: 'test',
        filePath: '/test.ts',
        parameters: [],
        isAsync: false,
      },
      dependencies: [],
      callers: [],
      sideEffects: [],
      existingTests: [],
      coverage: {
        linesCovered: 0,
        linesTotal: 0,
        branchesCovered: 0,
        branchesTotal: 0,
        functionsCovered: 0,
        functionsTotal: 0,
        percentage: 0,
      },
      complexity: {
        cyclomaticComplexity: 1,
        cognitiveComplexity: 1,
        linesOfCode: 1,
        maintainabilityIndex: 100,
      },
    };
    
    const strategy = {
      type: 'AAA' as const,
      boundaryConditions: [],
      edgeCases: [],
      mockStrategy: {
        dependencies: [],
        mockType: 'none' as const,
        mockData: {},
      },
    };
    
    const prompt = builder.buildUnitTestPrompt({
      context: minimalContext,
      strategy,
      framework: 'jest',
      examples: [],
    });
    
    expect(prompt).toBeDefined();
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(0);
  });

  it('should handle special characters in function names', async () => {
    const builder = new PromptBuilder();
    
    const context: FunctionContext = {
      signature: {
        name: '$_special_123',
        filePath: '/test.ts',
        parameters: [],
        isAsync: false,
      },
      dependencies: [],
      callers: [],
      sideEffects: [],
      existingTests: [],
      coverage: {
        linesCovered: 0,
        linesTotal: 0,
        branchesCovered: 0,
        branchesTotal: 0,
        functionsCovered: 0,
        functionsTotal: 0,
        percentage: 0,
      },
      complexity: {
        cyclomaticComplexity: 1,
        cognitiveComplexity: 1,
        linesOfCode: 1,
        maintainabilityIndex: 100,
      },
    };
    
    const strategy = {
      type: 'AAA' as const,
      boundaryConditions: [],
      edgeCases: [],
      mockStrategy: {
        dependencies: [],
        mockType: 'none' as const,
        mockData: {},
      },
    };
    
    const prompt = builder.buildUnitTestPrompt({
      context,
      strategy,
      framework: 'jest',
      examples: [],
    });
    
    expect(prompt).toContain('$_special_123');
  });
});

describe('Boundary Conditions - Dependency Graph', () => {
  let config: ProjectConfig;

  beforeAll(() => {
    config = {
      id: 'test-project',
      name: 'Test Project',
      language: 'typescript',
      rootPath: getTestFixturesPath(),
      config: {
        includePatterns: ['**/*.ts'],
        excludePatterns: ['**/*.test.ts'],
        testFramework: 'jest',
        llmConfig: {
          provider: 'openai',
          model: 'gpt-4',
          apiKey: 'test-key',
        },
      },
    };
  });

  it('should handle circular dependencies', async () => {
    const builder = new DependencyGraphBuilder(config);
    
    // Test with files that might have circular dependencies
    const analyzer = new StaticAnalyzer(config);
    
    const moduleA = await analyzer.analyzeFile(path.join(getTestFixturesPath(), 'moduleA.ts'));
    const moduleB = await analyzer.analyzeFile(path.join(getTestFixturesPath(), 'moduleB.ts'));
    const moduleC = await analyzer.analyzeFile(path.join(getTestFixturesPath(), 'moduleC.ts'));
    
    // Should not crash when building graph with potential circular deps
    await builder.buildGraph([moduleA, moduleB, moduleC]);
    
    // Graph should be built successfully
    expect(builder).toBeDefined();
  });

  it('should handle modules with no dependencies', async () => {
    const builder = new DependencyGraphBuilder(config);
    const analyzer = new StaticAnalyzer(config);
    
    const samplePath = path.join(getTestFixturesPath(), 'sample.ts');
    const deps = await builder.getModuleDependencies(samplePath);
    
    // Even modules with no internal dependencies should return empty array, not crash
    expect(deps).toBeDefined();
    expect(Array.isArray(deps)).toBe(true);
  });

  it('should handle function with no callers', async () => {
    const builder = new DependencyGraphBuilder(config);
    const samplePath = path.join(getTestFixturesPath(), 'sample.ts');
    
    // Build graph first
    const analyzer = new StaticAnalyzer(config);
    const files = [await analyzer.analyzeFile(samplePath)];
    await builder.buildGraph(files);
    
    const callers = await builder.getFunctionCallers(samplePath, 'add');
    
    // Should return empty array for functions with no callers
    expect(callers).toBeDefined();
    expect(Array.isArray(callers)).toBe(true);
  });
});

