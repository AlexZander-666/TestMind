/**
 * 测试生成功能演示
 * 
 * 为TestMind自己的代码生成测试，验证核心功能
 */

import { LLMService } from '../packages/core/src/llm/LLMService';
import { TestGenerator } from '../packages/core/src/generation/TestGenerator';
import { ContextEngine } from '../packages/core/src/context/ContextEngine';
import { DiffGenerator } from '../packages/core/src/diff/DiffGenerator';
import * as fs from 'fs/promises';
import * as path from 'path';

async function demoTestGeneration() {
  console.log('\n🎯 TestMind 测试生成功能演示\n');
  console.log('═'.repeat(80));

  // 初始化组件
  console.log('\n📦 初始化组件...\n');
  
  const projectPath = path.join(__dirname, '..');
  const llmService = new LLMService();
  const contextEngine = new ContextEngine({
    id: 'testmind-demo',
    name: 'TestMind',
    repoPath: projectPath,
    language: 'typescript',
    testFramework: 'vitest',
    config: {
      includePatterns: ['**/*.ts'],
      excludePatterns: ['**/node_modules/**', '**/dist/**', '**/__tests__/**', '**/*.test.ts', '**/*.spec.ts'],
      testDirectory: '__tests__',
      coverageThreshold: 80,
      maxFileSize: 1000000
    }
  });
  
  console.log('  ✓ LLM服务初始化');
  console.log('  ✓ 上下文引擎初始化');
  
  const testGenerator = new TestGenerator(llmService, contextEngine);
  const diffGenerator = new DiffGenerator();
  
  console.log('  ✓ 测试生成器初始化');
  console.log('  ✓ Diff生成器初始化');

  // 索引项目
  console.log('\n📊 索引TestMind项目...\n');
  const indexResult = await contextEngine.indexProject(projectPath);
  
  console.log(`  ✓ 文件: ${indexResult.filesIndexed}个`);
  console.log(`  ✓ 函数: ${indexResult.functionsExtracted}个`);
  console.log(`  ✓ 嵌入: ${indexResult.embeddingsCreated}个`);
  console.log(`  ✓ 耗时: ${indexResult.duration}ms`);

  // 选择一个简单的文件生成测试
  const targetFile = path.join(projectPath, 'packages/core/src/diff/DiffGenerator.ts');
  
  console.log('\n\n✨ 生成测试\n');
  console.log('─'.repeat(80));
  console.log(`📝 目标文件: ${path.relative(projectPath, targetFile)}`);
  
  try {
    console.log('\n  步骤1: 分析文件获取函数上下文...');
    
    // 获取文件的函数上下文
    const fileContent = await fs.readFile(targetFile, 'utf-8');
    const functionContexts = await contextEngine.extractFunctionsFromFile(targetFile);
    
    if (!functionContexts || functionContexts.length === 0) {
      console.log('\n  ⚠️  未找到可测试的函数');
      return;
    }
    
    console.log(`  ✓ 找到 ${functionContexts.length} 个函数`);
    const targetFunction = functionContexts[0]; // 选择第一个函数
    console.log(`  ✓ 选择函数: ${targetFunction.signature.name}`);
    
    console.log('\n  步骤2: 生成测试代码...');
    const startTime = Date.now();
    
    const testSuite = await testGenerator.generateUnitTest(
      targetFunction,
      'testmind-demo',
      'vitest'
    );
    
    const testCode = testSuite.testCode;
    const duration = Date.now() - startTime;
    
    if (testCode && testCode.length > 100) {
      console.log(`\n  ✅ 测试生成成功！`);
      console.log(`    耗时: ${(duration / 1000).toFixed(1)}秒`);
      console.log(`    代码长度: ${testCode.length}字符`);
      console.log(`    行数: ${testCode.split('\n').length}行`);
      
      // 统计测试用例数
      const testCases = (testCode.match(/it\(/g) || []).length + (testCode.match(/test\(/g) || []).length;
      console.log(`    测试用例: ${testCases}个`);
      
      // 统计断言数
      const assertions = (testCode.match(/expect\(/g) || []).length;
      console.log(`    断言: ${assertions}个`);
      
      // 显示代码预览
      console.log(`\n  📄 生成的测试代码预览:\n`);
      console.log('  ' + '─'.repeat(76));
      const lines = testCode.split('\n');
      lines.slice(0, 30).forEach((line, i) => {
        console.log(`  ${String(i + 1).padStart(3)} | ${line}`);
      });
      if (lines.length > 30) {
        console.log(`  ... (还有 ${lines.length - 30} 行)`);
      }
      console.log('  ' + '─'.repeat(76));
      
      // 保存测试文件
      const testFilePath = targetFile.replace(/\.ts$/, '.test.ts');
      await fs.writeFile(testFilePath, testCode, 'utf-8');
      
      console.log(`\n  💾 测试已保存: ${path.relative(projectPath, testFilePath)}`);
      
      // 生成 diff
      console.log(`\n\n📝 生成 Diff\n`);
      console.log('─'.repeat(80));
      
      const diff = diffGenerator.generateFileDiff(
        path.relative(projectPath, testFilePath),
        '',  // 新文件，oldContent为空
        testCode
      );
      
      const formattedDiff = diffGenerator.formatColoredDiff(diff);
      console.log('\n' + formattedDiff);
      
      // 摘要
      console.log('\n' + '═'.repeat(80));
      console.log('🎉 测试生成演示完成！');
      console.log('═'.repeat(80));
      console.log('\n📊 统计:');
      console.log(`  - 生成时间: ${(duration / 1000).toFixed(1)}秒`);
      console.log(`  - 测试用例: ${testCases}个`);
      console.log(`  - 断言数: ${assertions}个`);
      console.log(`  - 代码质量: ${assertions >= testCases ? '✅ 优秀' : '⚠️ 需改进'}`);
      console.log(`\n💡 下一步:`);
      console.log(`  - 运行测试: pnpm test ${path.basename(testFilePath)}`);
      console.log(`  - 查看完整代码: code ${testFilePath}`);
      console.log(`  - 修改后提交: git add ${path.relative(projectPath, testFilePath)}\n`);
      
    } else {
      console.log('\n  ❌ 测试生成失败: 代码太短或为空');
    }
    
  } catch (error) {
    console.log(`\n  ❌ 生成失败:`, error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      console.error('\n  调试信息:');
      console.error(error.stack);
    }
  }
}

// 运行演示
demoTestGeneration().catch(console.error);

