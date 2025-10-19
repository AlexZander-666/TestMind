/**
 * ContextEngine: Central hub for code understanding
 * Coordinates static analysis, semantic indexing, and dependency tracking
 */

import type {
  FunctionContext,
  CodeChunk,
  SemanticSearchResult,
  ProjectConfig,
} from '@testmind/shared';
import { StaticAnalyzer } from './StaticAnalyzer';
import { SemanticIndexer } from './SemanticIndexer';
import { DependencyGraphBuilder } from './DependencyGraphBuilder';
import { FileCache } from '../utils/FileCache';

export interface IndexResult {
  filesIndexed: number;
  functionsExtracted: number;
  embeddingsCreated: number;
  duration: number;
}

export interface ModuleContext {
  modulePath: string;
  exports: string[];
  dependencies: string[];
  functions: FunctionContext[];
  complexity: number;
}

export class ContextEngine {
  private staticAnalyzer: StaticAnalyzer;
  private semanticIndexer: SemanticIndexer;
  private dependencyBuilder: DependencyGraphBuilder;
  private fileCache: FileCache;

  constructor(private config: ProjectConfig) {
    // Create shared FileCache instance for all components
    this.fileCache = new FileCache();
    
    this.staticAnalyzer = new StaticAnalyzer(config, this.fileCache);
    this.semanticIndexer = new SemanticIndexer(config);
    this.dependencyBuilder = new DependencyGraphBuilder(config);
  }

  /**
   * Initialize project-wide indexing
   * This is the entry point for understanding a codebase
   */
  async indexProject(projectPath: string): Promise<IndexResult> {
    const startTime = Date.now();
    
    console.log(`[ContextEngine] Starting project indexing: ${projectPath}`);

    // Step 1: Static analysis - extract AST and code structure
    console.log('[ContextEngine] Step 1/3: Static analysis...');
    const analysisResult = await this.staticAnalyzer.analyzeProject(projectPath);
    
    // Step 2: Build dependency graph
    console.log('[ContextEngine] Step 2/3: Building dependency graph...');
    await this.dependencyBuilder.buildGraph(analysisResult.files);
    
    // Step 3: Create semantic embeddings
    console.log('[ContextEngine] Step 3/3: Creating embeddings...');
    const embeddingResult = await this.semanticIndexer.indexCodebase(analysisResult.files);

    const duration = Date.now() - startTime;
    
    const result: IndexResult = {
      filesIndexed: analysisResult.files.length,
      functionsExtracted: analysisResult.totalFunctions,
      embeddingsCreated: embeddingResult.embeddingsCount,
      duration,
    };

    console.log('[ContextEngine] Indexing complete:', result);
    
    // Log FileCache statistics for performance monitoring
    const cacheStats = this.fileCache.getStats();
    console.log('[ContextEngine] FileCache stats:', {
      entries: cacheStats.totalEntries,
      sizeKB: (cacheStats.totalSizeBytes / 1024).toFixed(1),
      enabled: cacheStats.cacheEnabled,
    });
    
    return result;
  }

  /**
   * Get comprehensive context for a specific function
   * This is used for unit test generation
   */
  async getFunctionContext(filePath: string, functionName: string): Promise<FunctionContext> {
    console.log(`[ContextEngine] Getting context for: ${filePath}::${functionName}`);

    // Extract function details from static analysis
    const functionNode = await this.staticAnalyzer.getFunction(filePath, functionName);
    
    if (!functionNode) {
      throw new Error(`Function ${functionName} not found in ${filePath}`);
    }

    // Get dependencies
    const dependencies = await this.dependencyBuilder.getFunctionDependencies(
      filePath,
      functionName
    );

    // Get callers (reverse dependencies)
    const callers = await this.dependencyBuilder.getFunctionCallers(filePath, functionName);

    // Analyze side effects
    const sideEffects = await this.staticAnalyzer.analyzeSideEffects(filePath, functionName);

    // Find existing tests
    const existingTests = await this.staticAnalyzer.findExistingTests(filePath, functionName);

    // Get coverage information (placeholder - will integrate with coverage tools)
    const coverage = {
      linesCovered: 0,
      linesTotal: functionNode.endLine - functionNode.startLine,
      branchesCovered: 0,
      branchesTotal: 0,
      functionsCovered: 0,
      functionsTotal: 1,
      percentage: 0,
    };

    // Calculate complexity
    const complexity = await this.staticAnalyzer.calculateComplexity(filePath, functionName);

    return {
      signature: {
        name: functionNode.name,
        filePath,
        parameters: functionNode.parameters,
        returnType: functionNode.returnType,
        isAsync: functionNode.isAsync,
        documentation: undefined, // TODO: Extract from JSDoc/docstrings
      },
      dependencies,
      callers,
      sideEffects,
      existingTests,
      coverage,
      complexity,
    };
  }

  /**
   * Get context for an entire module
   * This is used for integration test generation
   */
  async getModuleContext(modulePath: string): Promise<ModuleContext> {
    console.log(`[ContextEngine] Getting module context: ${modulePath}`);

    const moduleData = await this.staticAnalyzer.analyzeFile(modulePath);
    const dependencies = await this.dependencyBuilder.getModuleDependencies(modulePath);
    const exports = await this.staticAnalyzer.getModuleExports(modulePath);

    // Get context for all exported functions
    const functionContexts: FunctionContext[] = [];
    for (const func of moduleData.astData.functions.filter((f) => f.isExported)) {
      try {
        const ctx = await this.getFunctionContext(modulePath, func.name);
        functionContexts.push(ctx);
      } catch (error) {
        console.warn(`Failed to get context for ${func.name}:`, error);
      }
    }

    return {
      modulePath,
      exports,
      dependencies,
      functions: functionContexts,
      complexity: functionContexts.reduce((sum, f) => sum + f.complexity.cyclomaticComplexity, 0),
    };
  }

  /**
   * Semantic search across the codebase
   * Find similar code patterns, especially those with good test coverage
   */
  async semanticSearch(query: string, k = 5): Promise<SemanticSearchResult[]> {
    console.log(`[ContextEngine] Semantic search: "${query}" (k=${k})`);
    return this.semanticIndexer.search(query, k);
  }

  /**
   * Incremental update - only reindex changed files
   */
  async updateFile(filePath: string): Promise<void> {
    console.log(`[ContextEngine] Updating file: ${filePath}`);
    
    await this.staticAnalyzer.analyzeFile(filePath);
    await this.dependencyBuilder.updateFile(filePath);
    await this.semanticIndexer.updateFile(filePath);
  }

  /**
   * Clean up resources
   */
  async dispose(): Promise<void> {
    await this.semanticIndexer.dispose();
  }

  /**
   * Detect test location strategy from existing tests
   * Returns the most common pattern used in the project
   */
  async detectTestStrategy(projectPath: string): Promise<{ type: 'colocated' | 'separate' | 'nested' }> {
    const fastGlob = require('fast-glob');
    const path = require('path');
    
    try {
      // 1. Find existing test files
      const existingTests = await fastGlob(['**/*.test.ts', '**/*.test.js', '**/*.spec.ts', '**/*.spec.js'], {
        cwd: projectPath,
        ignore: ['**/node_modules/**', '**/dist/**', '**/.next/**'],
      });

      if (existingTests.length === 0) {
        // No existing tests, default to colocated
        console.log('[ContextEngine] No existing tests found, defaulting to colocated strategy');
        return { type: 'colocated' };
      }

      // 2. Analyze patterns
      const patterns = existingTests.map((testPath: string) => {
        // Remove .test or .spec suffix
        const sourcePath = testPath.replace(/\.(test|spec)\.(ts|js)$/, '.$2');
        return {
          testPath,
          testDir: path.dirname(testPath),
          sourceDir: path.dirname(sourcePath),
          hasTestsDir: testPath.includes('__tests__') || testPath.includes('test/'),
        };
      });

      // 3. Determine most common pattern
      const colocated = patterns.filter((p: any) => p.testDir === p.sourceDir && !p.hasTestsDir);
      const separate = patterns.filter((p: any) => p.hasTestsDir && !p.testPath.match(/\/src\/__tests__\//));
      const nested = patterns.filter((p: any) => p.testPath.match(/\/__tests__\//) && p.testDir.includes(p.sourceDir));

      const totalTests = existingTests.length;
      const colocatedPct = (colocated.length / totalTests) * 100;
      const separatePct = (separate.length / totalTests) * 100;
      const nestedPct = (nested.length / totalTests) * 100;

      console.log(`[ContextEngine] Test strategy detection: colocated=${colocatedPct.toFixed(0)}%, separate=${separatePct.toFixed(0)}%, nested=${nestedPct.toFixed(0)}%`);

      // 4. Return dominant pattern
      if (colocatedPct > 50) {
        return { type: 'colocated' };
      } else if (separatePct > 50) {
        return { type: 'separate' };
      } else if (nestedPct > 50) {
        return { type: 'nested' };
      } else {
        // Mixed or unclear, default to colocated
        return { type: 'colocated' };
      }
    } catch (error) {
      console.warn('[ContextEngine] Error detecting test strategy:', error);
      return { type: 'colocated' };
    }
  }
}























