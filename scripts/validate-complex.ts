#!/usr/bin/env tsx
/**
 * Validate TestMind on complex functions
 * Tests 3 different complexity scenarios
 */

import { ContextEngine, TestGenerator, LLMService } from '../packages/core/src';
import type { ProjectConfig } from '../packages/shared/src/types';
import { DEFAULT_CONFIG } from '../packages/shared/src/constants';
import path from 'path';
import { promises as fs } from 'fs';

interface TestScenario {
  functionName: string;
  expectedComplexity: number;
  expectedSideEffects: number;
  expectedMocks: string[];
  type: string;
}

const scenarios: TestScenario[] = [
  {
    functionName: 'fetchUserData',
    expectedComplexity: 1,
    expectedSideEffects: 1, // axios
    expectedMocks: ['axios'],
    type: 'async-network',
  },
  {
    functionName: 'calculateDiscount',
    expectedComplexity: 5, // 多个if
    expectedSideEffects: 0,
    expectedMocks: [],
    type: 'multi-branch-pure',
  },
];

interface TestResult {
  function: string;
  type: string;
  analysis: {
    complexity: number;
    sideEffects: number;
    sideEffectsAccurate: boolean;
  };
  quality: {
    correctness: number;
    completeness: number;
    readability: number;
    maintainability: number;
    mockStrategy: number;
    assertions: number;
    bestPractices: number;
    total: number;
  };
  cost: number;
  duration: number;
  testCode: string;
}

async function main() {
  console.log('🧪 TestMind Complex Function Validation\n');
  console.log('='.repeat(80));
  
  const fixturesDir = path.join(process.cwd(), 'packages/core/src/context/__tests__/fixtures');
  const sampleFile = path.join(fixturesDir, 'sample.ts');

  const config: ProjectConfig = {
    id: 'validation-project',
    name: 'Validation',
    repoPath: fixturesDir,
    language: 'typescript',
    testFramework: 'jest',
    config: DEFAULT_CONFIG,
  };

  const contextEngine = new ContextEngine(config);
  const llmService = new LLMService();
  const testGenerator = new TestGenerator(llmService);

  let totalCost = 0;
  const results: TestResult[] = [];

  for (const scenario of scenarios) {
    console.log(`\n\n${'='.repeat(80)}`);
    console.log(`\n📝 Test Case ${results.length + 1}: ${scenario.functionName}`);
    console.log(`   Type: ${scenario.type}`);
    console.log(`   Expected Complexity: ${scenario.expectedComplexity}`);
    console.log(`   Expected Side Effects: ${scenario.expectedSideEffects}\n`);

    try {
      // Step 1: Analyze function
      console.log('🔍 Analyzing function...\n');
      const functionContext = await contextEngine.getFunctionContext(sampleFile, scenario.functionName);

      // Validate analysis
      console.log('   Analysis Results:');
      console.log(`   ✓ Complexity: ${functionContext.complexity.cyclomaticComplexity}`);
      console.log(`   ✓ Side Effects: ${functionContext.sideEffects.length}`);
      console.log(`   ✓ Dependencies: ${functionContext.dependencies.length}`);

      // Check accuracy
      const sideEffectsAccurate = functionContext.sideEffects.length === scenario.expectedSideEffects;
      console.log(`   ${sideEffectsAccurate ? '✅' : '❌'} Side effect detection: ${sideEffectsAccurate ? 'ACCURATE' : 'INACCURATE'}\n`);

      // Step 2: Generate test
      console.log('🤖 Generating test with AI...\n');
      const startTime = Date.now();
      
      const testSuite = await testGenerator.generateUnitTest(functionContext, config.id);
      
      const duration = (Date.now() - startTime) / 1000;
      const cost = (testSuite.metadata as any).cost || 0;
      totalCost += cost;

      console.log(`   ✓ Generated in ${duration.toFixed(1)}s`);
      console.log(`   ✓ Cost: $${cost.toFixed(4)}`);
      console.log(`   ✓ Total cost so far: $${totalCost.toFixed(4)}\n`);

      // Step 3: Analyze quality
      const quality = analyzeTestQuality(testSuite.code, scenario);

      const percentage = (quality.total / 0.7).toFixed(0);
      console.log(`   📊 Quality Score: ${quality.total}/70 (${percentage}%)`);
      console.log(`      Correctness: ${quality.correctness}/10`);
      console.log(`      Completeness: ${quality.completeness}/10`);
      console.log(`      Readability: ${quality.readability}/10`);
      console.log(`      Maintainability: ${quality.maintainability}/10`);
      console.log(`      Mock Strategy: ${quality.mockStrategy}/10`);
      console.log(`      Assertions: ${quality.assertions}/10`);
      console.log(`      Best Practices: ${quality.bestPractices}/10\n`);

      // Display generated test preview
      console.log('   📝 Generated Test (preview):');
      console.log('   ' + '─'.repeat(76));
      const preview = testSuite.code.substring(0, 800);
      console.log(preview.split('\n').map(l => '   ' + l).join('\n'));
      if (testSuite.code.length > 800) {
        console.log('   ... (truncated for display)');
      }
      console.log('   ' + '─'.repeat(76) + '\n');

      results.push({
        function: scenario.functionName,
        type: scenario.type,
        analysis: {
          complexity: functionContext.complexity.cyclomaticComplexity,
          sideEffects: functionContext.sideEffects.length,
          sideEffectsAccurate,
        },
        quality,
        cost,
        duration,
        testCode: testSuite.code,
      });

      // Budget check
      if (totalCost > 0.15) {
        console.log('⚠️  Budget limit reached ($0.15), stopping validation');
        break;
      }

    } catch (error) {
      console.error(`\n❌ Error testing ${scenario.functionName}:`, error);
    }
  }

  // Final summary
  console.log(`\n\n${'='.repeat(80)}`);
  console.log('\n📊 VALIDATION SUMMARY\n');
  console.log(`✅ Functions Tested: ${results.length}/2`);
  console.log(`💰 Total Cost: $${totalCost.toFixed(4)}`);
  
  if (results.length > 0) {
    const avgQuality = results.reduce((sum, r) => sum + r.quality.total, 0) / results.length / 0.7;
    console.log(`📈 Average Quality: ${avgQuality.toFixed(0)}%`);
    
    const allAccurate = results.every(r => r.analysis.sideEffectsAccurate);
    console.log(`🎯 Side Effect Detection: ${allAccurate ? '✅ 100% Accurate' : '⚠️ Needs improvement'}\n`);
  }

  // Save results to JSON
  await fs.writeFile(
    'validation-results.json',
    JSON.stringify({ results, totalCost, timestamp: new Date().toISOString() }, null, 2)
  );

  console.log('💾 Results saved to: validation-results.json\n');
  
  await contextEngine.dispose();
  
  console.log('✅ Validation complete!\n');
}

function analyzeTestQuality(code: string, scenario: TestScenario) {
  const scores = {
    correctness: analyzeCorrectness(code),
    completeness: analyzeCompleteness(code, scenario),
    readability: analyzeReadability(code),
    maintainability: analyzeMaintainability(code),
    mockStrategy: analyzeMockStrategy(code, scenario),
    assertions: analyzeAssertions(code),
    bestPractices: analyzeBestPractices(code),
  };

  const total = Object.values(scores).reduce((sum, score) => sum + score, 0);
  return { ...scores, total };
}

function analyzeCorrectness(code: string): number {
  if (!code.includes('describe') || !code.includes('it')) return 3;
  if (code.includes('syntax error') || code.includes('undefined')) return 5;
  return 9;
}

function analyzeCompleteness(code: string, scenario: TestScenario): number {
  const testCount = (code.match(/it\(/g) || []).length;
  const hasErrorTests = code.includes('toThrow') || code.includes('rejects');
  
  if (scenario.type === 'multi-branch-pure') {
    if (testCount >= 5 && hasErrorTests) return 9;
    if (testCount >= 3) return 7;
    return 5;
  }
  
  if (scenario.type === 'async-network') {
    if (testCount >= 3 && hasErrorTests) return 9;
    if (testCount >= 2) return 7;
    return 5;
  }
  
  return testCount >= 3 ? 8 : testCount >= 2 ? 6 : 4;
}

function analyzeReadability(code: string): number {
  const hasDescriptiveNames = code.match(/it\(['"]should /g);
  const hasComments = code.includes('// Arrange') || code.includes('// Act');
  const linesCount = code.split('\n').length;
  
  let score = 5;
  if (hasDescriptiveNames) score += 2;
  if (hasComments) score += 2;
  if (linesCount < 100) score += 1;
  
  return Math.min(10, score);
}

function analyzeMaintainability(code: string): number {
  const linesCount = code.split('\n').length;
  if (linesCount < 50) return 9;
  if (linesCount < 80) return 8;
  if (linesCount < 120) return 7;
  return 6;
}

function analyzeMockStrategy(code: string, scenario: TestScenario): number {
  const hasMocks = code.includes('jest.mock') || code.includes('mockResolvedValue') || code.includes('mockReturnValue');
  
  if (scenario.expectedMocks.length === 0) {
    return hasMocks ? 4 : 10;
  } else {
    if (!hasMocks) return 4;
    const hasClearMocks = code.includes('jest.clearAllMocks') || code.includes('beforeEach');
    return hasClearMocks ? 9 : 7;
  }
}

function analyzeAssertions(code: string): number {
  const specificAssertions = (code.match(/\.toBe\(|\.toEqual\(|\.toHaveBeenCalledWith\(/g) || []).length;
  const genericAssertions = (code.match(/\.toBeDefined\(|\.toBeTruthy\(/g) || []).length;
  
  if (specificAssertions === 0) return 3;
  
  const ratio = specificAssertions / (specificAssertions + genericAssertions);
  if (ratio > 0.8) return 9;
  if (ratio > 0.6) return 7;
  return 5;
}

function analyzeBestPractices(code: string): number {
  const hasAAA = code.includes('// Arrange') && code.includes('// Act') && code.includes('// Assert');
  const hasSetup = code.includes('beforeEach') || code.includes('beforeAll');
  const usesDescribe = code.includes('describe(');
  
  let score = 5;
  if (hasAAA) score += 2;
  if (hasSetup && code.includes('clearAllMocks')) score += 2;
  if (usesDescribe) score += 1;
  
  return Math.min(10, score);
}

main().catch(console.error);












