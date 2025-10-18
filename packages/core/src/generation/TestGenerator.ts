/**
 * TestGenerator: Orchestrate test code generation
 */

import type { FunctionContext, TestSuite, TestStrategy, TestType } from '@testmind/shared';
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
  async generateUnitTest(context: FunctionContext, projectId: string): Promise<TestSuite> {
    console.log(`[TestGenerator] Generating unit test for: ${context.signature.name}`);

    // Step 1: Plan test strategy
    const strategy = await this.planner.planUnitTest(context);

    // Step 2: Build prompt with context and strategy
    const prompt = this.promptBuilder.buildUnitTestPrompt({
      context,
      strategy,
      framework: 'jest', // TODO: Get from project config
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

    // Step 5: Create test suite object
    const testSuite: TestSuite = {
      id: generateUUID(),
      projectId,
      targetEntityId: generateUUID(), // TODO: Link to actual entity ID
      testType: 'unit',
      framework: 'jest',
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
  private generateTestFilePath(sourceFilePath: string): string {
    // Convert src/utils/foo.ts -> __tests__/utils/foo.test.ts
    const pathWithoutExt = sourceFilePath.replace(/\.(ts|js|py|java)$/, '');
    const testPath = pathWithoutExt.replace('/src/', '/__tests__/');
    return `${testPath}.test.ts`; // TODO: Use appropriate extension
  }

  /**
   * Extract mock dependencies from strategy
   */
  private extractMocksFromStrategy(strategy: TestStrategy): string[] {
    return strategy.mockStrategy.dependencies;
  }
}














