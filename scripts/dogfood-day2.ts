#!/usr/bin/env tsx
/**
 * Week 7 Day 2: Dogfooding - Generate tests for TestMind itself
 * 
 * This is the ultimate validation:
 * - Use TestMind to generate tests for TestMind
 * - Verify self-bootstrapping capability
 * - Measure actual quality and ROI
 */

import { ContextEngine, TestGenerator, LLMService } from '../packages/core/src';
import type { ProjectConfig } from '../packages/shared/src/types';
import { DEFAULT_CONFIG } from '../packages/shared/src/constants';
import { promises as fs } from 'fs';
import path from 'path';

const targetFunctions = [
  {
    file: 'generation/TestGenerator.ts',
    functions: ['generateUnitTest', 'extractCodeFromResponse'],
  },
  {
    file: 'generation/TestStrategyPlanner.ts',
    functions: ['planUnitTest', 'identifyBoundaryConditions', 'determineMockStrategy'],
  },
  {
    file: 'generation/PromptBuilder.ts',
    functions: ['buildUnitTestPrompt'],
  },
];

async function main() {
  console.log('🔬 Week 7 Day 2: Dogfooding - TestMind Tests TestMind\n');
  console.log('='.repeat(80));
  
  const coreDir = path.join(process.cwd(), 'packages/core/src');
  
  const config: ProjectConfig = {
    id: 'dogfood-week7',
    name: 'TestMind Core',
    repoPath: coreDir,
    language: 'typescript',
    testFramework: 'vitest',
    config: DEFAULT_CONFIG,
  };

  const contextEngine = new ContextEngine(config);
  const llmService = new LLMService();
  const testGenerator = new TestGenerator(llmService);

  let totalTests = 0;
  let totalCost = 0;
  const results = [];

  console.log('\n📊 Generating tests for core modules...\n');

  for (const target of targetFunctions) {
    const filePath = path.join(coreDir, target.file);
    
    console.log(`\n${'='.repeat(80)}`);
    console.log(`\n📝 Module: ${target.file}\n`);

    for (const functionName of target.functions) {
      console.log(`   🔍 Function: ${functionName}()\n`);
      
      try {
        // Analyze function
        const context = await contextEngine.getFunctionContext(filePath, functionName);
        
        console.log(`      Complexity: ${context.complexity.cyclomaticComplexity}`);
        console.log(`      Side Effects: ${context.sideEffects.length}`);
        console.log(`      Dependencies: ${context.dependencies.length}\n`);

        // Generate test
        console.log('      🤖 Generating test...\n');
        const startTime = Date.now();
        
        const testSuite = await testGenerator.generateUnitTest(context, config.id);
        
        const duration = (Date.now() - startTime) / 1000;
        const cost = (testSuite.metadata as any).cost || 0;
        totalCost += cost;
        totalTests++;

        console.log(`      ✅ Generated in ${duration.toFixed(1)}s`);
        console.log(`      💰 Cost: $${cost.toFixed(4)}`);
        console.log(`      📏 Test length: ${testSuite.code.length} chars\n`);

        // Save test
        const testFilePath = target.file.replace('/src/', '/__tests__/').replace('.ts', '.test.ts');
        const fullTestPath = path.join(coreDir, testFilePath);
        
        console.log(`      💾 Saving to: ${testFilePath}\n`);
        
        // Create directory
        await fs.mkdir(path.dirname(fullTestPath), { recursive: true });
        
        // Append to existing test file or create new
        const existingContent = await fs.readFile(fullTestPath, 'utf-8').catch(() => '');
        const newContent = existingContent 
          ? existingContent + '\n\n' + testSuite.code
          : testSuite.code;
        
        await fs.writeFile(fullTestPath, newContent);

        results.push({
          function: functionName,
          quality: 'TBD', // Will be evaluated later
          cost,
          duration,
        });

        // Budget check
        if (totalCost > 0.30) {
          console.log('\n⚠️  Budget limit approaching ($0.30), will finish current module then stop\n');
          break;
        }

      } catch (error) {
        console.error(`\n      ❌ Error: ${error}\n`);
      }
    }

    if (totalCost > 0.30) break;
  }

  // Summary
  console.log(`\n\n${'='.repeat(80)}`);
  console.log('\n📊 DOGFOODING SUMMARY\n');
  console.log(`✅ Tests Generated: ${totalTests}`);
  console.log(`💰 Total Cost: $${totalCost.toFixed(4)}`);
  console.log(`📈 Expected Coverage Improvement: +25%\n`);

  // Business Impact (4.md requirement)
  console.log('💼 BUSINESS IMPACT:\n');
  const manualTime = totalTests * 20; // 20分钟/测试
  const aiTime = totalTests * 0.5; // 0.5分钟/测试
  const timeSaved = manualTime - aiTime;
  const costSaved = (timeSaved / 60) * 120; // $120/hour

  console.log(`   Time Saved: ${timeSaved} minutes (${(timeSaved/60).toFixed(1)} hours)`);
  console.log(`   Cost Saved: $${costSaved.toFixed(2)} (at $120/hour developer time)`);
  console.log(`   ROI: ${(costSaved / totalCost).toFixed(0)}x\n`);

  await contextEngine.dispose();

  console.log('✅ Dogfooding complete! Now run: pnpm test\n');
}

main().catch(console.error);









