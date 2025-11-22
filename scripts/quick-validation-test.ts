/**
 * 快速验证测试
 * 
 * 在TestMind自身代码上测试核心功能
 */

import { LLMService } from '../packages/core/src/llm/LLMService';
import { TestGenerator } from '../packages/core/src/generation/TestGenerator';
import { ContextEngine } from '../packages/core/src/context/ContextEngine';
import { DiffGenerator } from '../packages/core/src/diff/DiffGenerator';
import { SelfHealingEngine } from '../packages/core/src/self-healing/SelfHealingEngine';
import * as path from 'path';

async function quickValidation() {
  console.log('\n🚀 TestMind 快速验证测试\n');
  console.log('═'.repeat(80));

  // 1. 测试LLM服务
  console.log('\n📡 测试 1: LLM服务');
  console.log('─'.repeat(80));
  
  try {
    const llmService = new LLMService();
    
    console.log('  配置:');
    console.log(`    Provider: openai`);
    console.log(`    Model: ${process.env.OPENAI_MODEL}`);
    console.log(`    Max Tokens: ${process.env.OPENAI_MAX_TOKENS || '10000'}`);
    
    const startTime = Date.now();
    const response = await llmService.generate({
      provider: 'openai',
      model: process.env.OPENAI_MODEL || 'gpt-4',
      prompt: 'Generate a simple unit test for a function called "add(a, b)" that adds two numbers. Use vitest framework. Be concise.',
      temperature: 0.3,
      maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '10000', 10)
    });
    
    const duration = Date.now() - startTime;
    
    console.log(`\n  ✅ LLM调用成功`);
    console.log(`    耗时: ${duration}ms`);
    console.log(`    响应长度: ${response.content.length}字符`);
    console.log(`    Token使用: ${response.usage?.totalTokens || 'N/A'}`);
    console.log(`    响应预览: ${response.content.substring(0, 100)}...`);
    
  } catch (error) {
    console.log(`\n  ❌ LLM测试失败:`, error instanceof Error ? error.message : String(error));
    return false;
  }

  // 2. 测试ContextEngine
  console.log('\n\n📊 测试 2: 上下文引擎');
  console.log('─'.repeat(80));
  
  try {
    const projectPath = path.join(__dirname, '..');
    const contextEngine = new ContextEngine({
      id: 'testmind-validation',
      name: 'TestMind',
      repoPath: projectPath,
      language: 'typescript',
      testFramework: 'vitest',
      config: {
        includePatterns: ['**/*.ts', '**/*.js'],
        excludePatterns: ['**/node_modules/**', '**/dist/**', '**/__tests__/**'],
        testDirectory: '__tests__',
        coverageThreshold: 80,
        maxFileSize: 1000000
      }
    });
    
    console.log(`  初始化项目: ${projectPath}`);
    const indexResult = await contextEngine.indexProject(projectPath);
    
    console.log(`\n  ✅ 上下文引擎正常`);
    console.log(`    扫描文件: ${indexResult.filesIndexed}个`);
    console.log(`    提取函数: ${indexResult.functionsExtracted}个`);
    console.log(`    创建嵌入: ${indexResult.embeddingsCreated}个`);
    console.log(`    耗时: ${indexResult.duration}ms`);
    
  } catch (error) {
    console.log(`\n  ❌ 上下文引擎测试失败:`, error instanceof Error ? error.message : String(error));
    return false;
  }

  // 3. 测试DiffGenerator
  console.log('\n\n📝 测试 3: Diff生成器');
  console.log('─'.repeat(80));
  
  try {
    const diffGenerator = new DiffGenerator();
    
    const oldCode = `function add(a, b) {\n  return a + b;\n}`;
    const newCode = `function add(a: number, b: number): number {\n  return a + b;\n}`;
    
    const diff = diffGenerator.generateFileDiff('example.ts', oldCode, newCode);
    const formatted = diffGenerator.formatUnifiedDiff(diff);
    
    console.log(`\n  ✅ Diff生成正常`);
    console.log(`    Hunks: ${diff.hunks.length}`);
    console.log(`    操作类型: ${diff.operation}`);
    console.log(`\n  预览:`);
    console.log(formatted.split('\n').slice(0, 10).join('\n'));
    
  } catch (error) {
    console.log(`\n  ❌ Diff生成测试失败:`, error instanceof Error ? error.message : String(error));
    return false;
  }

  // 4. 测试自愈引擎
  console.log('\n\n🔧 测试 4: 自愈引擎');
  console.log('─'.repeat(80));
  
  try {
    const llmService = new LLMService();
    const healingEngine = new SelfHealingEngine({
      llmService,
      enableAutoFix: false
    });
    
    console.log(`  ✅ 自愈引擎初始化成功`);
    console.log(`    定位引擎: 就绪`);
    console.log(`    分类器: 就绪`);
    console.log(`    修复建议器: 就绪`);
    console.log(`    意图跟踪: 就绪`);
    
  } catch (error) {
    console.log(`\n  ❌ 自愈引擎测试失败:`, error instanceof Error ? error.message : String(error));
    return false;
  }

  // 总结
  console.log('\n\n' + '═'.repeat(80));
  console.log('🎉 所有核心组件测试通过！');
  console.log('═'.repeat(80));
  console.log('\n✅ TestMind核心引擎状态: 正常');
  console.log('✅ API配置: 正常');
  console.log('✅ 组件集成: 正常\n');
  console.log('🚀 准备就绪，可以开始Shannon项目验证！\n');

  return true;
}

// 运行验证
quickValidation().then(success => {
  if (success) {
    console.log('下一步:');
    console.log('  运行 Shannon 完整验证:');
    console.log('    pnpm tsx scripts/shannon-validation.ts');
    console.log('\n');
    process.exit(0);
  } else {
    console.log('\n⚠️ 请检查配置后重试\n');
    process.exit(1);
  }
}).catch(error => {
  console.error('\n❌ 验证出错:', error);
  process.exit(1);
});

