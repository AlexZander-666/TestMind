/**
 * TestGenerator: Orchestrate test code generation
 */

import type { FunctionContext, TestSuite, TestStrategy, TestType, TestFramework } from '@testmind/shared';
import { generateUUID } from '@testmind/shared';
import { TestStrategyPlanner } from './TestStrategyPlanner';
import { PromptBuilder } from './PromptBuilder';
import { LLMService } from '../llm/LLMService';
import { createComponentLogger } from '../utils/logger';
import { metrics, MetricNames } from '../utils/metrics';

export class TestGenerator {
  private planner: TestStrategyPlanner;
  private promptBuilder: PromptBuilder;
  private llm: LLMService;
  private logger = createComponentLogger('TestGenerator');

  constructor(llmService: LLMService) {
    this.llm = llmService;
    this.planner = new TestStrategyPlanner();
    this.promptBuilder = new PromptBuilder();
    this.logger.debug('TestGenerator initialized');
  }

  /**
   * Generate unit test for a function
   */
  async generateUnitTest(
    context: FunctionContext, 
    projectId: string,
    framework: TestFramework = 'jest'
  ): Promise<TestSuite> {
    const startTime = Date.now();
    
    this.logger.info('Generating unit test', {
      functionName: context.signature.name,
      framework,
      operation: 'generateUnitTest'
    });

    try {
      // Step 1: Plan test strategy
      const strategy = await this.planner.planUnitTest(context);

      // Step 2: Build prompt with context and strategy
      const prompt = this.promptBuilder.buildUnitTestPrompt({
        context,
        strategy,
        framework: framework, // Use framework from parameter
        examples: [], // TODO: Get from semantic search
      });

      // Step 3: Generate test code using LLM
      const model = process.env.OPENAI_MODEL || 'gpt-4-turbo-preview';
      
      this.logger.debug('Calling LLM for test generation', { model, framework });
      
      const response = await this.llm.generate({
        provider: 'openai',
        model,
        prompt,
        temperature: 0.2, // Lower temperature for more consistent code
        maxTokens: 4000, // Increased from 2000 to avoid truncation
      });
      
      // Record LLM metrics
      metrics.incrementCounter(MetricNames.LLM_CALL_COUNT, 1, { 
        operation: 'test-generation',
        model 
      });
      metrics.recordHistogram(MetricNames.LLM_TOKEN_USAGE, response.usage.totalTokens, { 
        model 
      });

    // Step 4: Extract and validate generated code
    const testCode = this.extractCodeFromResponse(response.content);

    // Step 4.5: Validate test quality
    const isValid = this.validateGeneratedTest(testCode, context.signature.name);
    if (!isValid) {
      throw new Error(
        `Generated test for ${context.signature.name} failed quality check. ` +
        `Please regenerate or check the function complexity.`
      );
    }

      // Step 5: Create test suite object
      const testSuite: TestSuite = {
        id: generateUUID(),
        projectId,
        targetEntityId: generateUUID(), // TODO: Link to actual entity ID
        testType: 'unit',
        framework: framework, // Use framework from parameter
        code: testCode,
        filePath: this.generateTestFilePath(context.signature.filePath),
        generatedAt: new Date(),
        generatedBy: 'ai',
        metadata: {
          targetFunction: context.signature.name,
          dependencies: context.dependencies.map((d) => d.name),
          mocks: this.extractMocksFromStrategy(strategy),
          fixtures: [],
          estimatedRunTime: 100, // ms
        },
      };

      const duration = Date.now() - startTime;
      
      // Record metrics
      metrics.incrementCounter(MetricNames.TEST_GENERATION_COUNT, 1, { framework });
      metrics.recordHistogram(MetricNames.TEST_GENERATION_DURATION, duration, { framework });
      
      this.logger.info('Test suite generated successfully', {
        functionName: context.signature.name,
        framework,
        duration,
        testFilePath: testSuite.filePath,
        operation: 'generateUnitTest'
      });

      return testSuite;
      
    } catch (error: any) {
      const duration = Date.now() - startTime;
      
      this.logger.error('Test generation failed', {
        functionName: context.signature.name,
        framework,
        duration,
        error: error.message,
        operation: 'generateUnitTest'
      });
      
      throw error;
    }
  }

  /**
   * Generate tests for multiple functions in batch (parallel processing)
   * @param contexts Array of function contexts to generate tests for
   * @param projectId Project identifier
   * @param framework Test framework to use
   * @param maxParallel Maximum number of parallel generations (default: 3)
   * @returns Array of test suites and generation results
   */
  async generateBatch(
    contexts: FunctionContext[],
    projectId: string,
    framework: TestFramework = 'jest',
    maxParallel: number = 3
  ): Promise<Array<{ context: FunctionContext; suite?: TestSuite; error?: Error }>> {
    const startTime = Date.now();
    
    this.logger.info('Starting batch test generation', {
      count: contexts.length,
      framework,
      maxParallel,
      operation: 'generateBatch'
    });

    const results: Array<{ context: FunctionContext; suite?: TestSuite; error?: Error }> = [];
    const queue = [...contexts];
    const inProgress = new Set<Promise<void>>();

    // Process contexts in parallel with concurrency limit
    while (queue.length > 0 || inProgress.size > 0) {
      // Fill up to maxParallel concurrent requests
      while (inProgress.size < maxParallel && queue.length > 0) {
        const context = queue.shift()!;
        
        const task = this.generateUnitTest(context, projectId, framework)
          .then(suite => {
            results.push({ context, suite });
            this.logger.debug('Batch item completed', {
              functionName: context.signature.name,
              progress: `${results.length}/${contexts.length}`
            });
          })
          .catch(error => {
            results.push({ context, error: error as Error });
            this.logger.warn('Batch item failed', {
              functionName: context.signature.name,
              error: (error as Error).message
            });
          })
          .finally(() => {
            inProgress.delete(task);
          });
        
        inProgress.add(task);
      }

      // Wait for at least one to complete
      if (inProgress.size > 0) {
        await Promise.race(inProgress);
      }
    }

    const duration = Date.now() - startTime;
    const successful = results.filter(r => r.suite).length;
    const failed = results.filter(r => r.error).length;

    this.logger.info('Batch generation completed', {
      total: contexts.length,
      successful,
      failed,
      successRate: `${((successful / contexts.length) * 100).toFixed(1)}%`,
      duration,
      avgPerTest: Math.round(duration / contexts.length),
      operation: 'generateBatch'
    });

    metrics.incrementCounter(MetricNames.TEST_GENERATION_COUNT, successful, { 
      framework,
      batch: true 
    });
    metrics.recordHistogram(MetricNames.TEST_GENERATION_DURATION, duration, { 
      framework,
      batch: true,
      count: contexts.length
    });

    return results;
  }

  /**
   * Generate tests for an entire file (all functions in the file)
   * @param filePath Path to the source file
   * @param contexts All function contexts from the file
   * @param projectId Project identifier  
   * @param framework Test framework to use
   * @returns Batch generation results
   */
  async generateFileTests(
    filePath: string,
    contexts: FunctionContext[],
    projectId: string,
    framework: TestFramework = 'jest'
  ): Promise<{
    filePath: string;
    testFilePath: string;
    results: Array<{ context: FunctionContext; suite?: TestSuite; error?: Error }>;
    successRate: number;
  }> {
    this.logger.info('Generating tests for entire file', {
      filePath,
      functionCount: contexts.length,
      framework,
      operation: 'generateFileTests'
    });

    const results = await this.generateBatch(contexts, projectId, framework);
    
    const testFilePath = this.generateTestFilePath(filePath);
    const successful = results.filter(r => r.suite).length;
    const successRate = (successful / contexts.length) * 100;

    return {
      filePath,
      testFilePath,
      results,
      successRate
    };
  }

  /**
   * Generate integration test for a module
   */
  async generateIntegrationTest(
    modulePath: string,
    projectId: string
  ): Promise<TestSuite> {
    console.log(`[TestGenerator] Generating integration test for: ${modulePath}`);

    // TODO: Implement integration test generation
    // 1. Analyze module boundaries
    // 2. Identify integration points (APIs, databases, etc.)
    // 3. Generate test scenarios
    // 4. Create appropriate mocks/stubs
    
    throw new Error('Integration test generation not yet implemented');
  }

  /**
   * Generate E2E test
   */
  async generateE2ETest(
    userStory: string,
    projectId: string
  ): Promise<TestSuite> {
    console.log(`[TestGenerator] Generating E2E test for: ${userStory}`);

    // TODO: Implement E2E test generation
    throw new Error('E2E test generation not yet implemented');
  }

  /**
   * Extract code block from LLM response
   * Enhanced: Support multiple markdown formats
   * Fixed: Dogfooding discovered this was too fragile
   */
  private extractCodeFromResponse(response: string): string {
    // Try multiple code block patterns
    const patterns = [
      /```(?:typescript|ts)\s*\n([\s\S]*?)```/,
      /```javascript\s*\n([\s\S]*?)```/,
      /```\s*\n([\s\S]*?)```/,
      /```([\s\S]*?)```/,
    ];
    
    for (const pattern of patterns) {
      const match = response.match(pattern);
      if (match && match[1]) {
        const code = match[1].trim();
        // Verify it's not empty or just comments
        if (code.length > 10 && !code.startsWith('//')) {
          return code;
        }
      }
    }
    
    // If no code block markers, check if it's already pure code
    if (!response.includes('```')) {
      const trimmed = response.trim();
      // Basic validation: should look like TypeScript code
      if (trimmed.includes('describe') || trimmed.includes('it(') || trimmed.includes('test(')) {
        return trimmed;
      }
    }
    
    // Fallback: remove all ``` markers and return
    const cleaned = response.replace(/```[\w]*\s*\n?/g, '').trim();
    return cleaned;
  }

  /**
   * Generate test file path from source file path
   */
  private generateTestFilePath(
    sourceFilePath: string,
    strategy: { type: 'colocated' | 'separate' | 'nested' } = { type: 'colocated' }
  ): string {
    const path = require('path');
    const parsed = path.parse(sourceFilePath);
    const baseName = parsed.name;
    const dirName = parsed.dir;
    const ext = parsed.ext;
    
    switch (strategy.type) {
      case 'colocated':
        // lib/format.ts → lib/format.test.ts
        return path.join(dirName, `${baseName}.test${ext}`);
        
      case 'separate':
        // lib/format.ts → __tests__/lib/format.test.ts
        const relativePath = dirName.replace(/^src\/?/, '');
        return path.join('__tests__', relativePath, `${baseName}.test${ext}`);
        
      case 'nested':
        // lib/format.ts → lib/__tests__/format.test.ts
        return path.join(dirName, '__tests__', `${baseName}.test${ext}`);
        
      default:
        // Fallback to colocated
        return path.join(dirName, `${baseName}.test${ext}`);
    }
  }

  /**
   * Generate import path from test file to source file
   */
  private generateImportPath(testFilePath: string, sourceFilePath: string): string {
    const path = require('path');
    const testDir = path.dirname(testFilePath);
    const sourceDir = path.dirname(sourceFilePath);
    const sourceName = path.parse(sourceFilePath).name;
    
    // Calculate relative path
    const relativePath = path.relative(testDir, sourceDir);
    
    if (relativePath === '' || relativePath === '.') {
      // Same directory: ./format
      return `./${sourceName}`;
    } else {
      // Different directory: ../lib/format
      const importPath = path.join(relativePath, sourceName);
      // Normalize to forward slashes for imports
      return importPath.replace(/\\/g, '/');
    }
  }

  /**
   * Extract mock dependencies from strategy
   */
  private extractMocksFromStrategy(strategy: TestStrategy): string[] {
    return strategy.mockStrategy.dependencies;
  }

  /**
   * Validate generated test quality
   * Returns false if test is empty or invalid
   */
  private validateGeneratedTest(code: string, functionName: string): boolean {
    // Check 1: Must contain at least one test case
    const hasTestCase = code.includes('it(') || code.includes('test(');
    if (!hasTestCase) {
      console.warn(`[TestGenerator] No test cases found for ${functionName}`);
      return false;
    }

    // Check 2: Must contain assertions
    const hasAssertions = code.includes('expect(');
    if (!hasAssertions) {
      console.warn(`[TestGenerator] No assertions found for ${functionName}`);
      return false;
    }

    // Check 3: Must have reasonable length (>20 lines for actual test)
    const lines = code.split('\n').filter(line => line.trim().length > 0);
    if (lines.length < 10) {
      console.warn(`[TestGenerator] Test too short for ${functionName}: ${lines.length} lines`);
      return false;
    }

    console.log(`[TestGenerator] Test quality validation passed for ${functionName}`);
    return true;
  }
}














