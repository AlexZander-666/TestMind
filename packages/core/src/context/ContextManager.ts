/**
 * ContextManager: Manages hybrid context (automatic + explicit)
 * This implements the "hybrid context engine" from the 1.md strategic framework
 * 
 * Design:
 * - Automatic context: Provided by ContextEngine (RAG, code graph)
 * - Explicit context: User-defined "working memory" via /add, /focus commands
 * - Hybrid: Combines both for optimal context delivery to LLM
 */

import type { FunctionContext, ProjectConfig } from '@testmind/shared';
import { ContextEngine } from './ContextEngine';
import * as fs from 'fs-extra';
import * as path from 'path';
import { createComponentLogger } from '../utils/logger';

export interface ContextFile {
  filePath: string;
  content: string;
  addedAt: Date;
  isFocused: boolean;
}

export interface FocusPoint {
  filePath: string;
  functionName: string;
  context?: FunctionContext;
  addedAt: Date;
}

export interface ContextSnapshot {
  explicitFiles: ContextFile[];
  focusPoints: FocusPoint[];
  totalTokens: number;
  message: string;
}

export interface HybridContext {
  // Explicit context (user-defined)
  explicitFiles: ContextFile[];
  focusPoints: FocusPoint[];
  
  // Automatic context (from ContextEngine)
  relevantChunks: any[];
  dependencies: any[];
  
  // Metadata
  totalTokens: number;
  contextSize: string;
}

export class ContextManager {
  private explicitFiles: Map<string, ContextFile> = new Map();
  private focusPoints: Map<string, FocusPoint> = new Map();
  private contextEngine: ContextEngine;
  private projectPath: string;
  private logger = createComponentLogger('ContextManager');

  constructor(config: ProjectConfig, projectPath: string) {
    this.contextEngine = new ContextEngine(config);
    this.projectPath = projectPath;
    this.logger.debug('ContextManager initialized', { projectPath });
  }

  /**
   * Add a file to explicit context (working memory)
   * Command: testmind add <file>
   */
  async addToContext(filePath: string): Promise<void> {
    const absolutePath = path.isAbsolute(filePath) 
      ? filePath 
      : path.join(this.projectPath, filePath);

    // Validate file exists
    if (!await fs.pathExists(absolutePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    // Check if already in context
    if (this.explicitFiles.has(absolutePath)) {
      this.logger.debug('File already in context', { filePath });
      return;
    }

    // Read file content
    const content = await fs.readFile(absolutePath, 'utf-8');

    // Add to explicit context
    const contextFile: ContextFile = {
      filePath: absolutePath,
      content,
      addedAt: new Date(),
      isFocused: false,
    };

    this.explicitFiles.set(absolutePath, contextFile);
    this.logger.info('Added to context', { filePath, contentLength: content.length });
  }

  /**
   * Focus on a specific function in a file
   * Command: testmind focus <file>::<function>
   */
  async focusOn(filePath: string, functionName: string): Promise<void> {
    const absolutePath = path.isAbsolute(filePath) 
      ? filePath 
      : path.join(this.projectPath, filePath);

    // Ensure file is in context first
    if (!this.explicitFiles.has(absolutePath)) {
      await this.addToContext(filePath);
    }

    // Get function context from ContextEngine
    let functionContext: FunctionContext | undefined;
    try {
      functionContext = await this.contextEngine.getFunctionContext(absolutePath, functionName);
    } catch (error) {
      this.logger.warn('Could not get function context', { filePath, functionName, error });
    }

    // Create focus point
    const key = `${absolutePath}::${functionName}`;
    const focusPoint: FocusPoint = {
      filePath: absolutePath,
      functionName,
      context: functionContext,
      addedAt: new Date(),
    };

    this.focusPoints.set(key, focusPoint);
    
    // Mark file as focused
    const file = this.explicitFiles.get(absolutePath);
    if (file) {
      file.isFocused = true;
    }

    this.logger.info('Focused on function', { filePath, functionName });
  }

  /**
   * Get current context snapshot
   * Command: testmind context
   */
  getCurrentContext(): ContextSnapshot {
    const explicitFiles = Array.from(this.explicitFiles.values());
    const focusPoints = Array.from(this.focusPoints.values());

    // Calculate total tokens (rough estimate: ~4 chars per token)
    let totalChars = 0;
    explicitFiles.forEach(f => totalChars += f.content.length);
    focusPoints.forEach(f => {
      if (f.context) {
        // Estimate context size
        totalChars += JSON.stringify(f.context).length;
      }
    });
    const totalTokens = Math.ceil(totalChars / 4);

    // Build message
    let message = '📋 Current Context:\n\n';
    
    if (explicitFiles.length === 0 && focusPoints.length === 0) {
      message += '  (empty - no files or functions added)\n';
      message += '\n  Use:\n';
      message += '    testmind add <file>          - Add file to context\n';
      message += '    testmind focus <file>::<fn>  - Focus on function\n';
    } else {
      message += `  Files: ${explicitFiles.length}\n`;
      explicitFiles.forEach(f => {
        const relPath = path.relative(this.projectPath, f.filePath);
        const focused = f.isFocused ? ' [FOCUSED]' : '';
        message += `    - ${relPath}${focused}\n`;
      });

      if (focusPoints.length > 0) {
        message += `\n  Focus Points: ${focusPoints.length}\n`;
        focusPoints.forEach(fp => {
          const relPath = path.relative(this.projectPath, fp.filePath);
          message += `    - ${relPath}::${fp.functionName}\n`;
        });
      }

      message += `\n  Estimated tokens: ${totalTokens.toLocaleString()}\n`;
    }

    return {
      explicitFiles,
      focusPoints,
      totalTokens,
      message,
    };
  }

  /**
   * Remove a file from context
   * Command: testmind context remove <file>
   */
  async removeFromContext(filePath: string): Promise<void> {
    const absolutePath = path.isAbsolute(filePath) 
      ? filePath 
      : path.join(this.projectPath, filePath);

    if (!this.explicitFiles.has(absolutePath)) {
      this.logger.debug('File not in context', { filePath });
      return;
    }

    // Remove file
    this.explicitFiles.delete(absolutePath);

    // Remove related focus points
    const toRemove: string[] = [];
    this.focusPoints.forEach((fp, key) => {
      if (fp.filePath === absolutePath) {
        toRemove.push(key);
      }
    });
    toRemove.forEach(key => this.focusPoints.delete(key));

    this.logger.info('Removed from context', { filePath, focusPointsRemoved: toRemove.length });
  }

  /**
   * Clear all explicit context
   * Command: testmind context clear
   */
  clearContext(): void {
    const fileCount = this.explicitFiles.size;
    const focusCount = this.focusPoints.size;

    this.explicitFiles.clear();
    this.focusPoints.clear();

    this.logger.info('Context cleared', { fileCount, focusCount });
  }

  /**
   * Build hybrid context for LLM
   * Combines explicit context (user-added) + automatic context (RAG)
   */
  async buildHybridContext(userPrompt: string): Promise<HybridContext> {
    // 1. Get explicit context (already loaded)
    const explicitFiles = Array.from(this.explicitFiles.values());
    const focusPoints = Array.from(this.focusPoints.values());

    // 2. Get automatic context from semantic search
    const relevantChunks = await this.contextEngine.semanticSearch(userPrompt, 5);

    // 3. Get dependencies for focused functions
    const dependencies: any[] = [];
    for (const fp of focusPoints) {
      if (fp.context) {
        dependencies.push(...fp.context.dependencies);
      }
    }

    // 4. Calculate total tokens
    let totalChars = 0;
    explicitFiles.forEach(f => totalChars += f.content.length);
    relevantChunks.forEach(c => totalChars += JSON.stringify(c).length);
    dependencies.forEach(d => totalChars += JSON.stringify(d).length);
    const totalTokens = Math.ceil(totalChars / 4);

    return {
      explicitFiles,
      focusPoints,
      relevantChunks,
      dependencies,
      totalTokens,
      contextSize: `${(totalTokens / 1000).toFixed(1)}K tokens`,
    };
  }

  /**
   * Initialize ContextEngine for automatic context
   */
  async initializeAutomaticContext(): Promise<void> {
    this.logger.info('Initializing automatic context (indexing project)');
    await this.contextEngine.indexProject(this.projectPath);
    this.logger.info('Automatic context ready');
  }

  /**
   * Get the underlying ContextEngine for advanced operations
   */
  getContextEngine(): ContextEngine {
    return this.contextEngine;
  }

  /**
   * Clean up resources
   */
  async dispose(): Promise<void> {
    await this.contextEngine.dispose();
  }
}



