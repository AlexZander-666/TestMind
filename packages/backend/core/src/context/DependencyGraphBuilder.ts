/**
 * DependencyGraphBuilder: Analyze and track code dependencies
 * 
 * Purpose: Build and maintain a directed graph of code dependencies
 * - Module-level: File A imports File B
 * - Function-level: Function A calls Function B
 * - Reverse lookup: Who uses this module/function?
 * 
 * Design: In-memory graph using Map for O(1) lookup performance
 * Future: Can be extended with SQLite persistence if needed
 */

import path from 'path';

import type { ProjectConfig, CodeFile, Dependency } from '@testmind/shared';
import { normalizePath } from '@testmind/shared';

import { createComponentLogger } from '../utils/logger';

import type { DependencyNeighbor } from './types';

const logger = createComponentLogger('DependencyGraphBuilder');

interface FileMetadata {
  hash?: string;
  indexedAt?: number;
  lastUpdated?: number;
}

export class DependencyGraphBuilder {
  // Module-level dependency graph
  // Key: file path, Value: set of files it imports
  private readonly dependencyGraph: Map<string, Set<string>> = new Map();
  
  // Reverse graph for "who uses this" queries
  // Key: file path, Value: set of files that import it
  private readonly reverseGraph: Map<string, Set<string>> = new Map();
  
  // Function-level call graph
  // Key: "filePath::functionName", Value: set of called functions
  private readonly callGraph: Map<string, Set<string>> = new Map();
  
  // Reverse call graph
  private readonly reverseCallGraph: Map<string, Set<string>> = new Map();
  
  // Cache for resolved import paths
  private readonly importPathCache: Map<string, string> = new Map();
  private readonly fileMetadata: Map<string, FileMetadata> = new Map();
  private fileIndex: Map<string, CodeFile> = new Map();

  constructor(_config: ProjectConfig) {}

  /**
   * Build dependency graph from analyzed files
   * Economic rationale: Upfront investment in graph building saves
   * repeated cost of runtime dependency resolution
   */
  async buildGraph(files: CodeFile[]): Promise<void> {
    logger.info(`[DependencyGraphBuilder] Building graph for ${files.length} files`);
    
    const startTime = Date.now();
    
    // Clear existing graphs
    this.dependencyGraph.clear();
    this.reverseGraph.clear();
    this.callGraph.clear();
    this.reverseCallGraph.clear();
    this.importPathCache.clear();

    // Step 1: Build file index for quick lookup
    const fileIndex = this.buildFileIndex(files);
    this.fileIndex = fileIndex;
    files.forEach(file => this.updateFileMetadata(file));

    // Step 2: Process each file to extract dependencies
    for (const file of files) {
      await this.processFile(file, fileIndex);
    }

    const duration = Date.now() - startTime;
    logger.info(`[DependencyGraphBuilder] Graph built in ${duration}ms`);
    logger.info(`[DependencyGraphBuilder] Nodes: ${this.dependencyGraph.size}, Edges: ${this.countEdges()}`);
  }

  /**
   * Build index of all files for efficient lookup
   * Performance optimization: O(1) file resolution
   */
  private buildFileIndex(files: CodeFile[]): Map<string, CodeFile> {
    const index = new Map<string, CodeFile>();
    
    for (const file of files) {
      const normalized = normalizePath(file.filePath);
      index.set(normalized, file);
      
      // Also index by filename for easier matching
      const filename = path.basename(file.filePath);
      if (!index.has(filename)) {
        index.set(filename, file);
      }
    }
    
    return index;
  }

  private updateFileMetadata(file: CodeFile): void {
    const normalized = normalizePath(file.filePath);
    this.fileMetadata.set(normalized, {
      hash: file.hash,
      indexedAt: file.indexedAt instanceof Date ? file.indexedAt.getTime() : undefined,
      lastUpdated: Date.now(),
    });
  }

  /**
   * Process a single file to extract its dependencies
   */
  private async processFile(file: CodeFile, fileIndex: Map<string, CodeFile>): Promise<void> {
    const filePath = normalizePath(file.filePath);
    
    // Initialize graph nodes
    if (!this.dependencyGraph.has(filePath)) {
      this.dependencyGraph.set(filePath, new Set());
    }
    if (!this.reverseGraph.has(filePath)) {
      this.reverseGraph.set(filePath, new Set());
    }

    // Process each import
    for (const importNode of file.astData.imports) {
      const resolvedPath = this.resolveImportPath(importNode.source, filePath, fileIndex);
      
      if (resolvedPath) {
        // Add to forward graph: file -> dependency
        this.dependencyGraph.get(filePath)?.add(resolvedPath);
        
        // Add to reverse graph: dependency -> file that imports it
        if (!this.reverseGraph.has(resolvedPath)) {
          this.reverseGraph.set(resolvedPath, new Set());
        }
        this.reverseGraph.get(resolvedPath)?.add(filePath);
      }
    }

    // TODO: Process function-level calls (requires deeper AST analysis)
    // This will be implemented when we need integration test generation
  }

  /**
   * Resolve import path to actual file path
   * Handles: relative imports, absolute imports, node_modules
   * 
   * Economic rationale: Caching saves repeated path resolution cost
   */
  private resolveImportPath(
    importSource: string,
    fromFile: string,
    fileIndex: Map<string, CodeFile>,
  ): string | null {
    // Check cache first
    const cacheKey = `${fromFile}::${importSource}`;
    if (this.importPathCache.has(cacheKey)) {
      return this.importPathCache.get(cacheKey)!;
    }

    let resolved: string | null = null;

    // Case 1: Relative import (./foo, ../bar)
    if (importSource.startsWith('.')) {
      const fromDir = path.dirname(fromFile);
      const absolutePath = path.resolve(fromDir, importSource);
      
      // Try with common extensions
      const extensions = ['.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.js'];
      for (const ext of extensions) {
        const candidate = normalizePath(absolutePath + ext);
        if (fileIndex.has(candidate)) {
          resolved = candidate;
          break;
        }
      }
    }
    
    // Case 2: Absolute import or node_modules
    // For MVP, we skip node_modules (external dependencies)
    // Focus on internal project dependencies
    else if (!importSource.startsWith('@') && !importSource.includes('node_modules')) {
      // Try to match by filename
      const filename = importSource.split('/').pop();
      if (filename) {
        for (const [filePath, file] of fileIndex) {
          if (filePath.includes(filename)) {
            resolved = normalizePath(file.filePath);
            break;
          }
        }
      }
    }

    // Cache the result (even if null)
    if (resolved) {
      this.importPathCache.set(cacheKey, resolved);
    }
    return resolved;
  }

  /**
   * Get dependencies for a specific function
   * Returns both internal and external dependencies
   */
  async getFunctionDependencies(filePath: string, functionName: string): Promise<Dependency[]> {
    logger.info(`[DependencyGraphBuilder] Getting dependencies: ${functionName}`);
    
    const normalized = normalizePath(filePath);
    const dependencies: Dependency[] = [];

    // Get module-level dependencies
    const moduleDeps = this.dependencyGraph.get(normalized);
    if (moduleDeps) {
      for (const dep of moduleDeps) {
        dependencies.push({
          type: 'internal',
          name: dep,
          usedIn: [filePath],
        });
      }
    }

    // TODO: Add function-level dependencies
    // This requires analyzing function body for:
    // - Function calls
    // - Variable references
    // - Class instantiations
    
    return dependencies;
  }

  /**
   * Get functions that call the target function
   * Critical for understanding impact of changes
   */
  async getFunctionCallers(filePath: string, functionName: string): Promise<string[]> {
    logger.info(`[DependencyGraphBuilder] Getting callers: ${functionName}`);
    
    const normalized = normalizePath(filePath);
    const callers: string[] = [];

    // Get all files that depend on this file
    const dependentFiles = this.reverseGraph.get(normalized);
    if (dependentFiles) {
      callers.push(...Array.from(dependentFiles));
    }

    // TODO: Implement function-level reverse lookup
    // Track which specific functions call this function
    
    return callers;
  }

  /**
   * Get module-level dependencies
   */
  async getModuleDependencies(modulePath: string): Promise<string[]> {
    const normalized = normalizePath(modulePath);
    const deps = this.dependencyGraph.get(normalized);
    return deps ? Array.from(deps) : [];
  }

  /**
   * Update graph for a single file (incremental update)
   * Performance optimization: Only rebuild affected subgraph
   */
  async updateFile(filePath: string, file?: CodeFile): Promise<void> {
    logger.info(`[DependencyGraphBuilder] Updating graph: ${filePath}`);
    
    const normalized = normalizePath(filePath);
    const targetFile = file ?? this.fileIndex.get(normalized);

    // Remove old edges from this file
    this.dependencyGraph.delete(normalized);
    this.reverseGraph.delete(normalized);

    // Remove this file from reverse graph entries and dependency sets
    for (const deps of this.dependencyGraph.values()) {
      deps.delete(normalized);
    }
    for (const files of this.reverseGraph.values()) {
      files.delete(normalized);
    }

    // Clear cache entries for this file
    for (const key of this.importPathCache.keys()) {
      if (key.startsWith(normalized)) {
        this.importPathCache.delete(key);
      }
    }

    if (!targetFile) {
      logger.warn('[DependencyGraphBuilder] No file metadata available for incremental update', {
        filePath,
      });
      this.fileMetadata.delete(normalized);
      return;
    }

    this.fileIndex.set(normalized, targetFile);
    await this.processFile(targetFile, this.fileIndex);
    this.updateFileMetadata(targetFile);
  }

  async getRelatedFiles(
    filePath: string,
    opts?: {
      includeReverse?: boolean;
      maxDepth?: number;
      limit?: number;
    },
  ): Promise<DependencyNeighbor[]> {
    const normalized = normalizePath(filePath);
    const includeReverse = opts?.includeReverse ?? false;
    const maxDepth = opts?.maxDepth ?? 1;
    const limit = opts?.limit ?? 25;

    const neighborMap = new Map<string, DependencyNeighbor>();
    const queue: Array<{ node: string; depth: number }> = [{ node: normalized, depth: 0 }];
    const visited = new Set<string>([normalized]);

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current.depth >= maxDepth) continue;
      const deps = this.dependencyGraph.get(current.node);
      if (!deps) continue;

      for (const dep of deps) {
        if (visited.has(`${dep}:${current.depth + 1}:${'imports'}`)) continue;
        const relation: DependencyNeighbor['relation'] =
          current.depth === 0 ? 'imports' : 'transitive';
        this.upsertNeighbor(neighborMap, dep, relation, current.depth + 1);
        queue.push({ node: dep, depth: current.depth + 1 });
        visited.add(`${dep}:${current.depth + 1}:${relation}`);
      }
    }

    if (includeReverse) {
      const reverseQueue: Array<{ node: string; depth: number }> = [{ node: normalized, depth: 0 }];
      const reverseVisited = new Set<string>([normalized]);

      while (reverseQueue.length > 0) {
        const current = reverseQueue.shift()!;
        if (current.depth >= maxDepth) continue;
        const dependents = this.reverseGraph.get(current.node);
        if (!dependents) continue;

        for (const dependent of dependents) {
          if (reverseVisited.has(`${dependent}:${current.depth + 1}`)) continue;
          this.upsertNeighbor(neighborMap, dependent, 'importedBy', current.depth + 1);
          reverseQueue.push({ node: dependent, depth: current.depth + 1 });
          reverseVisited.add(`${dependent}:${current.depth + 1}`);
        }
      }
    }

    const neighbors = Array.from(neighborMap.values()).filter(
      neighbor => normalizePath(neighbor.path) !== normalized,
    );

    neighbors.sort((a, b) => b.weight - a.weight);
    return neighbors.slice(0, limit);
  }

  markFileUpdated(filePath: string, hash: string): void {
    const normalized = normalizePath(filePath);
    const existing = this.fileMetadata.get(normalized) || {};
    this.fileMetadata.set(normalized, {
      ...existing,
      hash,
      lastUpdated: Date.now(),
    });
  }

  pruneMissing(filesOnDisk: Set<string>): void {
    const normalized = new Set(Array.from(filesOnDisk).map(file => normalizePath(file)));

    for (const key of Array.from(this.dependencyGraph.keys())) {
      if (!normalized.has(key)) {
        this.dependencyGraph.delete(key);
      }
    }

    for (const key of Array.from(this.reverseGraph.keys())) {
      if (!normalized.has(key)) {
        this.reverseGraph.delete(key);
      }
    }

    for (const key of Array.from(this.fileMetadata.keys())) {
      if (!normalized.has(key)) {
        this.fileMetadata.delete(key);
      }
    }

    for (const key of Array.from(this.importPathCache.keys())) {
      if (!normalized.has(key.split('::')[0] || '')) {
        this.importPathCache.delete(key);
      }
    }
  }

  private upsertNeighbor(
    map: Map<string, DependencyNeighbor>,
    targetPath: string,
    relation: DependencyNeighbor['relation'],
    depth: number,
  ): void {
    const normalized = normalizePath(targetPath);
    const weight = this.calculateNeighborWeight(depth, relation);
    const existing = map.get(normalized);

    if (!existing || weight > existing.weight) {
      map.set(normalized, {
        path: normalized,
        relation,
        weight,
        lastModified: this.fileMetadata.get(normalized)?.lastUpdated,
      });
    }
  }

  private calculateNeighborWeight(
    depth: number,
    relation: DependencyNeighbor['relation'],
  ): number {
    const base = Math.max(0.1, 1 / depth);
    if (relation === 'imports') return base;
    if (relation === 'importedBy') return base * 0.9;
    return base * 0.7;
  }

  /**
   * Detect circular dependencies
   * System thinking: Circular deps increase coupling and complexity
   */
  detectCircularDependencies(filePath: string): string[][] {
    const normalized = normalizePath(filePath);
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const dfs = (node: string, path: string[]) => {
      visited.add(node);
      recursionStack.add(node);
      path.push(node);

      const deps = this.dependencyGraph.get(node);
      if (deps) {
        for (const dep of deps) {
          if (!visited.has(dep)) {
            dfs(dep, [...path]);
          } else if (recursionStack.has(dep)) {
            // Found a cycle
            const cycleStart = path.indexOf(dep);
            cycles.push([...path.slice(cycleStart), dep]);
          }
        }
      }

      recursionStack.delete(node);
    };

    dfs(normalized, []);
    return cycles;
  }

  /**
   * Get all transitive dependencies (dependencies of dependencies)
   * Used for comprehensive integration test planning
   */
  getTransitiveDependencies(filePath: string, maxDepth = 3): Set<string> {
    const normalized = normalizePath(filePath);
    const allDeps = new Set<string>();
    const visited = new Set<string>();

    const traverse = (node: string, depth: number) => {
      if (depth > maxDepth || visited.has(node)) return;
      
      visited.add(node);
      const deps = this.dependencyGraph.get(node);
      
      if (deps) {
        for (const dep of deps) {
          allDeps.add(dep);
          traverse(dep, depth + 1);
        }
      }
    };

    traverse(normalized, 0);
    return allDeps;
  }

  /**
   * Get graph statistics
   * Useful for monitoring and debugging
   */
  getStats(): {
    totalNodes: number;
    totalEdges: number;
    avgDependencies: number;
    maxDependencies: number;
    } {
    const totalNodes = this.dependencyGraph.size;
    const totalEdges = this.countEdges();
    
    let maxDeps = 0;
    for (const deps of this.dependencyGraph.values()) {
      maxDeps = Math.max(maxDeps, deps.size);
    }

    return {
      totalNodes,
      totalEdges,
      avgDependencies: totalNodes > 0 ? totalEdges / totalNodes : 0,
      maxDependencies: maxDeps,
    };
  }

  /**
   * Count total edges in graph
   */
  private countEdges(): number {
    let count = 0;
    for (const deps of this.dependencyGraph.values()) {
      count += deps.size;
    }
    return count;
  }

  /**
   * Export graph for visualization (e.g., GraphViz)
   * Useful for debugging and documentation
   */
  exportToDOT(): string {
    let dot = 'digraph Dependencies {\n';
    dot += '  rankdir=LR;\n';
    dot += '  node [shape=box];\n\n';

    for (const [from, toSet] of this.dependencyGraph.entries()) {
      const fromLabel = path.basename(from);
      for (const to of toSet) {
        const toLabel = path.basename(to);
        dot += `  "${fromLabel}" -> "${toLabel}";\n`;
      }
    }

    dot += '}\n';
    return dot;
  }
}
