/**
 * RefactorSkill - Code refactoring skill
 * Implements refactoring capabilities from 1.md framework
 * 
 * Features (MVP):
 * - Extract method
 * - Extract constant
 * - Simplify conditional
 * - Identify code smells
 */

import { BaseSkill, SkillContext, SkillResult, CodeChange } from './Skill';
import { StaticAnalyzer } from '../context/StaticAnalyzer';
import { LLMService } from '../llm/LLMService';
import type { ProjectConfig } from '@testmind/shared';
import * as fs from 'fs-extra';
import * as path from 'path';

export interface RefactorOptions {
  type?: 'extract-method' | 'extract-constant' | 'simplify' | 'auto';
  target?: string; // Line range or function name
  preserveBehavior?: boolean;
}

export class RefactorSkill extends BaseSkill {
  readonly name = 'refactor';
  readonly description = 'Refactor code to improve maintainability and readability';
  readonly category = 'refactoring' as const;
  readonly version = '1.0.0';
  readonly author = 'TestMind Core Team';

  private staticAnalyzer?: StaticAnalyzer;
  private llmService?: LLMService;

  configuration = {
    preserveBehavior: true,
    generateTests: true,
    maxComplexity: 10,
  };

  /**
   * Check if this skill can handle the request
   */
  canHandle(context: SkillContext): boolean {
    const prompt = context.userPrompt.toLowerCase();
    
    const refactorKeywords = [
      'refactor',
      'clean',
      'improve',
      'simplify',
      'extract',
      '重构',
      '优化',
    ];

    return refactorKeywords.some(keyword => prompt.includes(keyword)) &&
           context.targetFiles.length > 0;
  }

  /**
   * Validate context
   */
  async validate(context: SkillContext): Promise<string | null> {
    if (context.targetFiles.length === 0) {
      return 'No target files specified for refactoring';
    }

    return null;
  }

  /**
   * Generate preview
   */
  async preview(context: SkillContext): Promise<string> {
    let preview = '🔧 Refactor Preview:\n\n';
    
    preview += `Will analyze and refactor:\n`;
    context.targetFiles.forEach(file => {
      preview += `  - ${file}\n`;
    });

    preview += `\nRefactoring approach:\n`;
    preview += `  - Identify code smells\n`;
    preview += `  - Suggest improvements\n`;
    preview += `  - Preserve behavior: ${this.configuration.preserveBehavior ? 'Yes' : 'No'}\n`;
    preview += `  - Generate tests: ${this.configuration.generateTests ? 'Yes' : 'No'}\n`;

    return preview;
  }

  /**
   * Execute refactoring
   */
  async execute(context: SkillContext): Promise<SkillResult> {
    const startTime = Date.now();

    try {
      // Initialize
      await this.initialize(context);

      const changes: CodeChange[] = [];
      const analysis: any = {
        filesAnalyzed: 0,
        issuesFound: 0,
        refactoringsApplied: 0,
      };

      // Analyze each file
      for (const targetFile of context.targetFiles) {
        this.log(`Analyzing ${targetFile}...`);

        const fileAnalysis = await this.analyzeFile(context, targetFile);
        analysis.filesAnalyzed++;
        analysis.issuesFound += fileAnalysis.issues.length;

        // Generate refactoring suggestions
        if (fileAnalysis.issues.length > 0) {
          const refactorChanges = await this.generateRefactorings(
            context,
            targetFile,
            fileAnalysis
          );

          changes.push(...refactorChanges);
          analysis.refactoringsApplied += refactorChanges.length;
        }
      }

      const duration = Date.now() - startTime;

      if (changes.length === 0) {
        return this.success(
          'No refactoring opportunities found. Code looks good!',
          [],
          analysis
        );
      }

      return this.success(
        `Found ${analysis.issuesFound} issue(s), proposed ${analysis.refactoringsApplied} refactoring(s)`,
        changes,
        { ...analysis, duration }
      );

    } catch (error: any) {
      return this.failure(`Refactoring failed: ${error.message}`, {
        error: error.message,
      });
    }
  }

  /**
   * Initialize analyzer
   */
  private async initialize(context: SkillContext): Promise<void> {
    const projectConfig: any = {
      id: 'temp-project',
      name: 'temp',
      repoPath: context.projectPath,
      language: 'typescript',
      testFramework: 'vitest',
      config: {
        includePatterns: ['**/*.ts', '**/*.js'],
        excludePatterns: ['**/node_modules/**'],
        testDirectory: '__tests__',
        coverageThreshold: 80,
        maxFileSize: 1000000,
        llmProvider: 'openai',
        llmModel: 'gpt-4',
        testFilePattern: '{filename}.test.ts',
      },
    };

    this.staticAnalyzer = new StaticAnalyzer(projectConfig, new (require('../utils/FileCache').FileCache)());
    this.llmService = new LLMService();
  }

  /**
   * Analyze file for refactoring opportunities
   */
  private async analyzeFile(
    context: SkillContext,
    filePath: string
  ): Promise<any> {
    const fullPath = path.join(context.projectPath, filePath);
    const content = await fs.readFile(fullPath, 'utf-8');

    // Analyze with static analyzer
    const fileData = await this.staticAnalyzer!.analyzeFile(fullPath);

    // Identify issues
    const issues: Array<{
      type: string;
      severity: 'high' | 'medium' | 'low';
      line: number;
      message: string;
      suggestion?: string;
    }> = [];

    // Check function complexity
    for (const func of fileData.astData.functions) {
      const complexity = await this.staticAnalyzer!.calculateComplexity(fullPath, func.name);
      
      if (complexity.cyclomaticComplexity > this.configuration.maxComplexity) {
        issues.push({
          type: 'high-complexity',
          severity: 'high',
          line: func.startLine,
          message: `Function ${func.name} has high complexity (${complexity.cyclomaticComplexity})`,
          suggestion: 'Consider extracting methods to reduce complexity',
        });
      }
    }

    // Check long functions
    for (const func of fileData.astData.functions) {
      const lineCount = func.endLine - func.startLine;
      if (lineCount > 50) {
        issues.push({
          type: 'long-function',
          severity: 'medium',
          line: func.startLine,
          message: `Function ${func.name} is too long (${lineCount} lines)`,
          suggestion: 'Consider breaking into smaller functions',
        });
      }
    }

    // Check magic numbers
    // TODO: Implement magic number detection

    return {
      filePath,
      content,
      fileData,
      issues,
    };
  }

  /**
   * Generate refactoring changes using LLM
   */
  private async generateRefactorings(
    context: SkillContext,
    filePath: string,
    analysis: any
  ): Promise<CodeChange[]> {
    const changes: CodeChange[] = [];

    // For MVP, we'll create a single refactoring proposal per file
    // In the future, this would be more sophisticated

    const prompt = this.buildRefactorPrompt(filePath, analysis);

    try {
      const response = await this.llmService!.generate({
        provider: 'openai',
        model: 'gpt-4',
        prompt: `You are a code refactoring expert. Suggest improvements while preserving behavior.\n\n${prompt}`,
        temperature: 0.7,
        maxTokens: 1500,
      });

      // Parse LLM response and create change
      // For now, create a description-only change
      changes.push({
        type: 'modify',
        path: filePath,
        description: `Refactoring suggestions:\n${response.content}`,
        // TODO: Generate actual diff
      });

    } catch (error) {
      this.log(`Failed to generate refactoring for ${filePath}: ${error}`);
    }

    return changes;
  }

  /**
   * Build refactoring prompt
   */
  private buildRefactorPrompt(filePath: string, analysis: any): string {
    let prompt = `File: ${filePath}\n\n`;
    prompt += `Issues found:\n`;
    
    analysis.issues.forEach((issue: any, index: number) => {
      prompt += `${index + 1}. [${issue.severity}] Line ${issue.line}: ${issue.message}\n`;
      if (issue.suggestion) {
        prompt += `   Suggestion: ${issue.suggestion}\n`;
      }
    });

    prompt += `\nCurrent code:\n\`\`\`\n${analysis.content}\n\`\`\`\n\n`;
    prompt += `Please suggest specific refactorings to address these issues.`;

    return prompt;
  }

  /**
   * Cleanup
   */
  async dispose(): Promise<void> {
    // Cleanup if needed
  }
}



