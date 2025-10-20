/**
 * TestGenerationSkill - First official skill
 * Wraps existing TestGenerator functionality into the skill framework
 * 
 * This demonstrates how to convert existing functionality into a skill
 */

import { BaseSkill, SkillContext, SkillResult, CodeChange } from './Skill';
import { TestGenerator } from '../generation/TestGenerator';
import { ContextEngine } from '../context/ContextEngine';
import { LLMService } from '../llm/LLMService';
import type { ProjectConfig } from '@testmind/shared';
import * as path from 'path';

export class TestGenerationSkill extends BaseSkill {
  readonly name = 'test-generation';
  readonly description = 'Generate unit tests for functions and modules';
  readonly category = 'testing' as const;
  readonly version = '1.0.0';
  readonly author = 'TestMind Core Team';

  private testGenerator?: TestGenerator;
  private contextEngine?: ContextEngine;

  configuration = {
    testFramework: 'vitest',
    coverage: true,
    includeEdgeCases: true,
  };

  /**
   * Check if this skill can handle the request
   */
  canHandle(context: SkillContext): boolean {
    // Handle if:
    // 1. User prompt mentions "test" or "testing"
    // 2. Target files are specified
    // 3. Context explicitly requests test generation

    const prompt = context.userPrompt.toLowerCase();
    const mentionsTest = prompt.includes('test') || 
                         prompt.includes('测试') ||
                         prompt.includes('generate test') ||
                         prompt.includes('unit test');

    const hasTargets = context.targetFiles.length > 0 || 
                      Boolean(context.targetFunctions && context.targetFunctions.length > 0);

    return mentionsTest && hasTargets;
  }

  /**
   * Validate context before execution
   */
  async validate(context: SkillContext): Promise<string | null> {
    if (context.targetFiles.length === 0) {
      return 'No target files specified. Use /add <file> or provide file path.';
    }

    // Check if files exist
    const fs = require('fs-extra');
    for (const file of context.targetFiles) {
      const fullPath = path.join(context.projectPath, file);
      if (!await fs.pathExists(fullPath)) {
        return `File not found: ${file}`;
      }
    }

    return null;
  }

  /**
   * Generate preview
   */
  async preview(context: SkillContext): Promise<string> {
    let preview = '🧪 Test Generation Preview:\n\n';
    
    preview += `Will generate tests for:\n`;
    context.targetFiles.forEach(file => {
      preview += `  - ${file}\n`;
    });

    if (context.targetFunctions && context.targetFunctions.length > 0) {
      preview += `\nFocusing on functions:\n`;
      context.targetFunctions.forEach(fn => {
        preview += `  - ${fn.name} in ${fn.file}\n`;
      });
    }

    preview += `\nTest framework: ${this.configuration.testFramework}\n`;
    preview += `Coverage analysis: ${this.configuration.coverage ? 'Yes' : 'No'}\n`;

    return preview;
  }

  /**
   * Execute test generation
   */
  async execute(context: SkillContext): Promise<SkillResult> {
    const startTime = Date.now();

    try {
      // Initialize if needed
      if (!this.testGenerator || !this.contextEngine) {
        await this.initialize(context);
      }

      const changes: CodeChange[] = [];
      const metadata: any = {
        testsGenerated: 0,
        filesProcessed: 0,
      };

      // Process each target file
      for (const targetFile of context.targetFiles) {
        this.log(`Processing ${targetFile}...`);

        // If specific functions are targeted, generate tests for those
        if (context.targetFunctions && context.targetFunctions.length > 0) {
          const fileFunctions = context.targetFunctions.filter(fn => fn.file === targetFile);
          
          for (const fn of fileFunctions) {
            const result = await this.generateTestForFunction(
              context,
              targetFile,
              fn.name
            );
            
            if (result) {
              changes.push(result);
              metadata.testsGenerated++;
            }
          }
        } else {
          // Generate tests for all functions in file
          const result = await this.generateTestForFile(context, targetFile);
          
          if (result) {
            changes.push(result);
            metadata.testsGenerated++;
          }
        }

        metadata.filesProcessed++;
      }

      const duration = Date.now() - startTime;

      return this.success(
        `Generated tests for ${metadata.filesProcessed} file(s), ${metadata.testsGenerated} test suite(s)`,
        changes,
        { ...metadata, duration }
      );

    } catch (error: any) {
      return this.failure(`Test generation failed: ${error.message}`, {
        error: error.message,
        stack: error.stack,
      });
    }
  }

  /**
   * Initialize test generator
   */
  private async initialize(context: SkillContext): Promise<void> {
    // Create minimal ProjectConfig for engines
    const projectConfig: any = {
      id: 'temp-project',
      name: 'temp',
      repoPath: context.projectPath,
      language: 'typescript',
      testFramework: this.configuration.testFramework,
      config: {
        includePatterns: ['**/*.ts', '**/*.js'],
        excludePatterns: ['**/node_modules/**', '**/*.test.ts'],
        testDirectory: '__tests__',
        coverageThreshold: 80,
        maxFileSize: 1000000,
        llmProvider: 'openai',
        llmModel: 'gpt-4',
      },
    };
    
    this.contextEngine = new ContextEngine(projectConfig);
    
    // Index project if not already done
    if (context.hybridContext) {
      // Use existing indexed context
      this.log('Using existing project index');
    } else {
      // Index project
      this.log('Indexing project...');
      await this.contextEngine.indexProject(context.projectPath);
    }

    const llmService = new LLMService();
    this.testGenerator = new TestGenerator(llmService);
  }

  /**
   * Generate test for a specific function
   */
  private async generateTestForFunction(
    context: SkillContext,
    filePath: string,
    functionName: string
  ): Promise<CodeChange | null> {
    try {
      // Get function context
      const functionContext = await this.contextEngine!.getFunctionContext(
        path.join(context.projectPath, filePath),
        functionName
      );

      // Generate test
      const testSuite = await this.testGenerator!.generateUnitTest(
        functionContext,
        'temp-project-id', // TODO: Use actual project ID
        this.configuration.testFramework as any
      );

      return {
        type: 'create',
        path: testSuite.filePath,
        content: testSuite.code,
        description: `Generated test suite for ${functionName}()`,
      };

    } catch (error: any) {
      this.log(`Failed to generate test for ${functionName}: ${error.message}`);
      return null;
    }
  }

  /**
   * Generate test for entire file
   */
  private async generateTestForFile(
    context: SkillContext,
    filePath: string
  ): Promise<CodeChange | null> {
    try {
      // TODO: Implement module-level test generation
      // For now, just generate for first exported function
      
      this.log(`Module-level test generation not yet implemented for ${filePath}`);
      return null;

    } catch (error: any) {
      this.log(`Failed to generate test for ${filePath}: ${error.message}`);
      return null;
    }
  }

  /**
   * Cleanup
   */
  async dispose(): Promise<void> {
    if (this.contextEngine) {
      await this.contextEngine.dispose();
    }
  }
}



