/**
 * 分析Prompt Token消耗
 * 
 * 统计各类测试生成的平均token使用，识别优化空间
 */

import { PromptBuilder } from '../packages/core/src/generation/PromptBuilder';
import type { FunctionContext, TestStrategy } from '@testmind/shared';

// 简单的token估算（1 token ≈ 4 characters for English, ≈ 2 for Chinese）
function estimateTokens(text: string): number {
  // 粗略估算：混合中英文，平均3个字符=1 token
  return Math.ceil(text.length / 3);
}

// 模拟不同类型的函数上下文
function createMockContexts(): Array<{ name: string; context: FunctionContext; strategy: TestStrategy }> {
  return [
    {
      name: '简单纯函数（add）',
      context: {
        signature: {
          name: 'add',
          parameters: [
            { name: 'a', type: 'number', optional: false },
            { name: 'b', type: 'number', optional: false }
          ],
          returnType: 'number',
          isAsync: false,
          filePath: 'src/utils/math.ts'
        },
        dependencies: [],
        sideEffects: [],
        complexity: {
          cyclomaticComplexity: 1,
          cognitiveComplexity: 0
        }
      } as FunctionContext,
      strategy: {
        type: 'AAA',
        mockStrategy: { dependencies: [] },
        boundaryConditions: [
          { parameter: 'a', reasoning: 'Test with 0, negative, and positive numbers' },
          { parameter: 'b', reasoning: 'Test with 0, negative, and positive numbers' }
        ],
        edgeCases: [
          { scenario: 'Large numbers', expectedBehavior: 'Should handle large numbers correctly' }
        ]
      } as TestStrategy
    },
    {
      name: '复杂异步函数（fetchUserData）',
      context: {
        signature: {
          name: 'fetchUserData',
          parameters: [
            { name: 'userId', type: 'string', optional: false },
            { name: 'options', type: 'FetchOptions', optional: true, defaultValue: '{}' }
          ],
          returnType: 'Promise<User>',
          isAsync: true,
          filePath: 'src/api/users.ts'
        },
        dependencies: [
          { name: 'fetch', type: 'global' },
          { name: 'logger', type: 'local' }
        ],
        sideEffects: [
          { type: 'network', description: 'Fetches data from API' },
          { type: 'logging', description: 'Logs errors' }
        ],
        complexity: {
          cyclomaticComplexity: 5,
          cognitiveComplexity: 3
        }
      } as FunctionContext,
      strategy: {
        type: 'AAA',
        mockStrategy: { 
          dependencies: ['fetch', 'logger']
        },
        boundaryConditions: [
          { parameter: 'userId', reasoning: 'Test with empty string, invalid format, valid ID' },
          { parameter: 'options', reasoning: 'Test with undefined, empty object, full config' }
        ],
        edgeCases: [
          { scenario: 'Network failure', expectedBehavior: 'Should throw appropriate error' },
          { scenario: '404 response', expectedBehavior: 'Should handle not found' },
          { scenario: 'Timeout', expectedBehavior: 'Should timeout gracefully' }
        ]
      } as TestStrategy
    },
    {
      name: '无参数函数（getCurrentTimestamp）',
      context: {
        signature: {
          name: 'getCurrentTimestamp',
          parameters: [],
          returnType: 'number',
          isAsync: false,
          filePath: 'src/utils/time.ts'
        },
        dependencies: [],
        sideEffects: [],
        complexity: {
          cyclomaticComplexity: 1,
          cognitiveComplexity: 0
        }
      } as FunctionContext,
      strategy: {
        type: 'AAA',
        mockStrategy: { dependencies: [] },
        boundaryConditions: [],
        edgeCases: []
      } as TestStrategy
    }
  ];
}

async function analyzePromptTokens() {
  console.log('\n📊 Prompt Token消耗分析\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const promptBuilder = new PromptBuilder();
  const mockContexts = createMockContexts();
  
  let totalTokens = 0;
  let maxTokens = 0;
  let minTokens = Infinity;
  
  const results: Array<{ name: string; tokens: number; sections: any }> = [];
  
  for (const { name, context, strategy } of mockContexts) {
    const prompt = promptBuilder.buildUnitTestPrompt({
      context,
      strategy,
      framework: 'vitest',
      examples: []
    });
    
    const tokens = estimateTokens(prompt);
    totalTokens += tokens;
    maxTokens = Math.max(maxTokens, tokens);
    minTokens = Math.min(minTokens, tokens);
    
    // 分析各个部分的token消耗
    const sections = analyzeSections(prompt);
    
    results.push({ name, tokens, sections });
    
    console.log(`📝 ${name}`);
    console.log(`   总Token: ${tokens.toLocaleString()}`);
    console.log(`   字符数: ${prompt.length.toLocaleString()}\n`);
    
    // 显示各部分占比
    console.log('   部分明细:');
    for (const [section, count] of Object.entries(sections)) {
      const percentage = ((count as number) / tokens * 100).toFixed(1);
      console.log(`     - ${section}: ${count} tokens (${percentage}%)`);
    }
    console.log('');
  }
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const avgTokens = Math.round(totalTokens / mockContexts.length);
  
  console.log('📈 统计摘要\n');
  console.log(`   平均Token: ${avgTokens.toLocaleString()}`);
  console.log(`   最大Token: ${maxTokens.toLocaleString()}`);
  console.log(`   最小Token: ${minTokens.toLocaleString()}`);
  console.log(`   Token范围: ${minTokens.toLocaleString()} - ${maxTokens.toLocaleString()}\n`);
  
  // 优化建议
  console.log('💡 优化建议\n');
  console.log('   基于分析结果，主要优化空间：\n');
  
  // 计算各部分的平均占比
  const avgSections: Record<string, number> = {};
  for (const result of results) {
    for (const [section, count] of Object.entries(result.sections)) {
      avgSections[section] = (avgSections[section] || 0) + (count as number);
    }
  }
  
  const sectionAnalysis = Object.entries(avgSections)
    .map(([section, total]) => ({
      section,
      avgTokens: Math.round(total / results.length),
      percentage: (total / totalTokens * 100)
    }))
    .sort((a, b) => b.avgTokens - a.avgTokens);
  
  for (const { section, avgTokens, percentage } of sectionAnalysis) {
    if (percentage > 15) {
      console.log(`   ⚠️  ${section}: 平均${avgTokens}tokens (${percentage.toFixed(1)}%) - 优先优化目标`);
    } else if (percentage > 5) {
      console.log(`   →  ${section}: 平均${avgTokens}tokens (${percentage.toFixed(1)}%)`);
    }
  }
  
  console.log('\n   建议优化策略：');
  console.log('   1. 简化Framework Guide（移除示例代码）');
  console.log('   2. 压缩Signature Constraints（合并重复警告）');
  console.log('   3. 简化Mock Guidance（使用更简洁的格式）');
  console.log('   4. 移除重复的"DO NOT"警告');
  console.log('   5. 使用function calling替代自由文本输出');
  
  console.log('\n   预期优化效果：');
  console.log(`   当前平均: ${avgTokens} tokens`);
  console.log(`   优化目标: ${Math.round(avgTokens * 0.6)} tokens (减少40%)`);
  console.log(`   预计每次生成节省: ${Math.round(avgTokens * 0.4)} tokens\n`);
  
  // 成本分析
  const costPerToken = 0.0085 / 3781; // 基于测试结果
  const currentCost = avgTokens * costPerToken;
  const optimizedCost = avgTokens * 0.6 * costPerToken;
  const savings = currentCost - optimizedCost;
  
  console.log('💰 成本影响\n');
  console.log(`   当前每次生成成本: $${currentCost.toFixed(6)}`);
  console.log(`   优化后成本: $${optimizedCost.toFixed(6)}`);
  console.log(`   每次节省: $${savings.toFixed(6)} (40%)`);
  console.log(`   1000次生成节省: $${(savings * 1000).toFixed(2)}\n`);
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

function analyzeSections(prompt: string): Record<string, number> {
  const sections: Record<string, number> = {};
  
  // 使用标记来分割各个部分
  const markers = [
    { name: 'Header', pattern: /^You are an expert.*?(?=##)/s },
    { name: 'Function to Test', pattern: /## Function to Test.*?(?=##)/s },
    { name: 'Import Statement', pattern: /## Import Statement.*?(?=##)/s },
    { name: 'Signature Constraints', pattern: /## Function Signature.*?(?=##)/s },
    { name: 'Function Details', pattern: /## Function Details.*?(?=##)/s },
    { name: 'Mock Strategy', pattern: /## Mock Strategy.*?(?=##)/s },
    { name: 'Test Strategy', pattern: /## Test Strategy.*?(?=##)/s },
    { name: 'Boundary Conditions', pattern: /## Boundary Conditions.*?(?=##)/s },
    { name: 'Edge Cases', pattern: /## Edge Cases.*?(?=##)/s },
    { name: 'Framework Guide', pattern: /## Testing Framework.*?(?=##)/s },
    { name: 'Requirements', pattern: /## Requirements.*?(?=##)/s },
    { name: 'Output Format', pattern: /## Output Format.*$/s }
  ];
  
  for (const { name, pattern } of markers) {
    const match = prompt.match(pattern);
    if (match) {
      sections[name] = estimateTokens(match[0]);
    }
  }
  
  return sections;
}

// 执行分析
analyzePromptTokens().catch(console.error);



























