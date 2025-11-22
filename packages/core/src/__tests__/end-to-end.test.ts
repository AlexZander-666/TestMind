/**
 * End-to-End Test: Full test generation workflow
 * This test validates the complete pipeline from code to generated test
 * 
 * Note: Requires OPENAI_API_KEY environment variable
 * Run with: OPENAI_API_KEY=xxx pnpm test end-to-end
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { ContextEngine } from '../context/ContextEngine';
import { TestGenerator } from '../generation/TestGenerator';
import { LLMService } from '../llm/LLMService';
import type { ProjectConfig } from '@testmind/shared';
import { DEFAULT_CONFIG } from '@testmind/shared';
import path from 'path';

// Skip if no API key (CI environment)
const skipIfNoApiKey = !process.env.OPENAI_API_KEY;

describe.skipIf(skipIfNoApiKey)('End-to-End Test Generation', () => {
  let contextEngine: ContextEngine;
  let testGenerator: TestGenerator;
  let config: ProjectConfig;

  beforeAll(() => {
    config = {
      id: 'e2e-test-project',
      name: 'E2E Test',
      repoPath: path.join(__dirname, '../context/__tests__/fixtures'),
      language: 'typescript',
      testFramework: 'jest',
      config: DEFAULT_CONFIG,
    };

    const llmService = new LLMService();
    contextEngine = new ContextEngine(config);
    testGenerator = new TestGenerator(llmService);
  });

  it('should generate unit test for simple function', async () => {
    // Setup
    const sampleFile = path.join(config.repoPath, 'sample.ts');
    
    // Index project
    await contextEngine.indexProject(config.repoPath);

    // Get function context
    const functionContext = await contextEngine.getFunctionContext(sampleFile, 'add');

    expect(functionContext).toBeDefined();
    expect(functionContext.signature.name).toBe('add');

    // Generate test
    const testSuite = await testGenerator.generateUnitTest(functionContext, config.id);

    // Verify generated test
    expect(testSuite).toBeDefined();
    expect(testSuite.code).toBeDefined();
    expect(testSuite.code.length).toBeGreaterThan(0);
    expect(testSuite.testType).toBe('unit');
    expect(testSuite.framework).toBe('jest');
    expect(testSuite.metadata.targetFunction).toBe('add');

    // Verify test contains key elements
    expect(testSuite.code).toContain('describe');
    expect(testSuite.code).toContain('it');
    expect(testSuite.code).toContain('expect');

    console.log('\n✅ Generated Test:\n');
    console.log('─'.repeat(80));
    console.log(testSuite.code);
    console.log('─'.repeat(80));

    // Cleanup
    await contextEngine.dispose();
  }, 60000); // 60 second timeout for API call

  it('should generate test for async function', async () => {
    const sampleFile = path.join(config.repoPath, 'sample.ts');
    
    await contextEngine.indexProject(config.repoPath);
    const functionContext = await contextEngine.getFunctionContext(sampleFile, 'fetchUserData');

    expect(functionContext.signature.isAsync).toBe(true);

    const testSuite = await testGenerator.generateUnitTest(functionContext, config.id);

    expect(testSuite.code).toContain('async');
    expect(testSuite.code).toContain('await');
    
    await contextEngine.dispose();
  }, 60000);

  it('should generate test for complex function with branches', async () => {
    const sampleFile = path.join(config.repoPath, 'sample.ts');
    
    await contextEngine.indexProject(config.repoPath);
    const functionContext = await contextEngine.getFunctionContext(sampleFile, 'calculateDiscount');

    expect(functionContext.complexity.cyclomaticComplexity).toBeGreaterThan(1);

    const testSuite = await testGenerator.generateUnitTest(functionContext, config.id);

    // Complex functions should have multiple test cases
    expect(testSuite.code).toContain('describe');
    expect(testSuite.code.split('it(').length).toBeGreaterThan(2); // At least 2 test cases
    
    await contextEngine.dispose();
  }, 60000);
});



























