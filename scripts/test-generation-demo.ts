#!/usr/bin/env tsx
/**
 * End-to-End Demo: Complete test generation workflow
 * 
 * This demonstrates the full capability of TestMind:
 * 1. Analyze code structure
 * 2. Build context (dependencies, complexity, side effects)
 * 3. Plan test strategy
 * 4. Generate test using LLM
 * 5. Display generated test
 * 
 * Usage: OPENAI_API_KEY=xxx tsx scripts/test-generation-demo.ts
 */

import { ContextEngine } from '../packages/core/src/context/ContextEngine';
import { TestGenerator } from '../packages/core/src/generation/TestGenerator';
import { LLMService } from '../packages/core/src/llm/LLMService';
import type { ProjectConfig } from '../packages/shared/src/types';
import { DEFAULT_CONFIG } from '../packages/shared/src/constants';
import path from 'path';

async function main() {
  console.log('🧠 TestMind - End-to-End Test Generation Demo\n');
  console.log('='.repeat(80));

  // Check API key
  if (!process.env.OPENAI_API_KEY) {
    console.log('\n❌ Error: OPENAI_API_KEY environment variable not set\n');
    console.log('Please set your OpenAI API key:');
    console.log('  export OPENAI_API_KEY=your-api-key-here\n');
    console.log('Get your key at: https://platform.openai.com/api-keys\n');
    process.exit(1);
  }

  const fixturesDir = path.join(process.cwd(), 'packages/core/src/context/__tests__/fixtures');

  const config: ProjectConfig = {
    id: 'demo-project',
    name: 'Demo Project',
    repoPath: fixturesDir,
    language: 'typescript',
    testFramework: 'jest',
    config: DEFAULT_CONFIG,
  };

  try {
    // Initialize engines
    console.log('\n🔧 Initializing TestMind engines...\n');
    const contextEngine = new ContextEngine(config);
    const llmService = new LLMService();
    const testGenerator = new TestGenerator(llmService);

    // Step 1: Index project
    console.log('📊 Step 1: Analyzing codebase...\n');
    const indexResult = await contextEngine.indexProject(fixturesDir);
    
    console.log(`   ✓ Files indexed: ${indexResult.filesIndexed}`);
    console.log(`   ✓ Functions found: ${indexResult.functionsExtracted}`);
    console.log(`   ✓ Duration: ${(indexResult.duration / 1000).toFixed(2)}s`);

    // Step 2: Get function context
    console.log('\n🔍 Step 2: Extracting function context...\n');
    const targetFile = path.join(fixturesDir, 'sample.ts');
    const targetFunction = 'add'; // Simple function for demo

    const functionContext = await contextEngine.getFunctionContext(targetFile, targetFunction);
    
    console.log(`   ✓ Function: ${functionContext.signature.name}`);
    console.log(`   ✓ Parameters: ${functionContext.signature.parameters.length}`);
    console.log(`   ✓ Complexity: ${functionContext.complexity.cyclomaticComplexity}`);
    console.log(`   ✓ Dependencies: ${functionContext.dependencies.length}`);
    console.log(`   ✓ Side effects: ${functionContext.sideEffects.length}`);

    // Step 3: Generate test
    console.log('\n🤖 Step 3: Generating test with AI...\n');
    console.log('   (Calling OpenAI API, please wait...)\n');

    const testSuite = await testGenerator.generateUnitTest(functionContext, config.id);

    console.log(`   ✓ Test generated successfully!`);
    console.log(`   ✓ Framework: ${testSuite.framework}`);
    console.log(`   ✓ Type: ${testSuite.testType}`);
    console.log(`   ✓ File: ${testSuite.filePath}`);

    // Step 4: Display generated test
    console.log('\n📝 Step 4: Generated Test Code:\n');
    console.log('─'.repeat(80));
    console.log(testSuite.code);
    console.log('─'.repeat(80));

    // Summary
    console.log('\n\n✅ Demo Complete!\n');
    console.log('📊 Summary:');
    console.log(`   • Analyzed: ${indexResult.filesIndexed} files`);
    console.log(`   • Generated: 1 test suite`);
    console.log(`   • Framework: ${testSuite.framework}`);
    console.log(`   • Target: ${testSuite.metadata.targetFunction}()`);
    console.log(`   • Quality: AI-generated with context awareness`);

    // Cleanup
    await contextEngine.dispose();

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

main().catch(console.error);



























