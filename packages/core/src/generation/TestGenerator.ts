/**
 * TestGenerator: Orchestrate test code generation
 */

import type { FunctionContext, TestSuite, TestStrategy, TestType, TestFramework } from '@testmind/shared';
import { generateUUID } from '@testmind/shared';
import { TestStrategyPlanner } from './TestStrategyPlanner';
import { PromptBuilder } from './PromptBuilder';
import { LLMService } from '../llm/LLMService';

export class TestGenerator {
  private planner: TestStrategyPlanner;
  private promptBuilder: PromptBuilder;
  private llm: LLMService;

  constructor(llmService: LLMService) {
    this.llm = llmService;
    this.planner = new TestStrategyPlanner();
    this.promptBuilder = new PromptBuilder();
  }

  /**
   * Generate unit test for a function
   */
  async generateUnitTest(
    context: FunctionContext, 
    projectId: string,
    framework: TestFramework = 'jest'
  ): Promise<TestSuite> {
    console.log(`[TestGenerator] Generating unit test for: ${context.signature.name}`);

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
    const response = await this.llm.generate({
      provider: 'openai',
      model,
      prompt,
      temperature: 0.2, // Lower temperature for more consistent code
      maxTokens: 4000, // Increased from 2000 to avoid truncation
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

    console.log('[TestGenerator] Test suite generated successfully');
    return testSuite;
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














