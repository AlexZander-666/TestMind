#!/usr/bin/env tsx
/**
 * 分析Shannon项目测试覆盖缺口
 * 找出未被测试的函数和类
 */

import * as fs from 'fs';
import * as path from 'path';

interface FunctionInfo {
  name: string;
  type: 'function' | 'method' | 'class';
  line?: number;
  exported: boolean;
}

interface CoverageGap {
  file: string;
  sourceFile: string;
  testFile: string;
  allFunctions: FunctionInfo[];
  testedFunctions: string[];
  untestedFunctions: FunctionInfo[];
  coveragePercentage: number;
}

/**
 * 从源文件中提取函数和类名
 */
function extractFunctionsFromSource(content: string, filePath: string): FunctionInfo[] {
  const functions: FunctionInfo[] = [];
  
  // 匹配导出的函数: export function name
  const exportedFunctionRegex = /export\s+(?:async\s+)?function\s+(\w+)/g;
  let match;
  while ((match = exportedFunctionRegex.exec(content)) !== null) {
    functions.push({
      name: match[1],
      type: 'function',
      exported: true
    });
  }
  
  // 匹配导出的类: export class name
  const exportedClassRegex = /export\s+class\s+(\w+)/g;
  while ((match = exportedClassRegex.exec(content)) !== null) {
    functions.push({
      name: match[1],
      type: 'class',
      exported: true
    });
  }
  
  // 匹配导出的const函数: export const name = 
  const exportedConstRegex = /export\s+const\s+(\w+)\s*=\s*(?:async\s*)?\(/g;
  while ((match = exportedConstRegex.exec(content)) !== null) {
    functions.push({
      name: match[1],
      type: 'function',
      exported: true
    });
  }
  
  // 匹配类方法 (在类内部)
  const classMethodRegex = /(?:public|private|protected)?\s*(?:async\s+)?(\w+)\s*\([^)]*\)\s*(?::\s*[^{]+)?\s*\{/g;
  while ((match = classMethodRegex.exec(content)) !== null) {
    const methodName = match[1];
    // 过滤掉一些常见的非方法关键字
    if (!['if', 'while', 'for', 'function', 'class', 'const', 'let', 'var'].includes(methodName)) {
      functions.push({
        name: methodName,
        type: 'method',
        exported: false
      });
    }
  }
  
  return functions;
}

/**
 * 从测试文件中提取被测试的函数名
 */
function extractTestedFunctions(content: string): string[] {
  const testedFunctions = new Set<string>();
  
  // 匹配 describe('functionName' 或 describe("functionName"
  const describeRegex = /describe\s*\(\s*['"]([^'"]+)['"]/g;
  let match;
  while ((match = describeRegex.exec(content)) !== null) {
    testedFunctions.add(match[1]);
  }
  
  // 匹配 import { function1, function2 } from './source'
  const importRegex = /import\s*\{([^}]+)\}\s*from/g;
  while ((match = importRegex.exec(content)) !== null) {
    const imports = match[1].split(',').map(i => i.trim());
    imports.forEach(imp => testedFunctions.add(imp));
  }
  
  // 匹配测试中直接调用的函数 functionName(
  const callRegex = /(\w+)\s*\(/g;
  while ((match = callRegex.exec(content)) !== null) {
    const funcName = match[1];
    // 过滤掉测试框架关键字
    if (!['describe', 'it', 'test', 'expect', 'beforeEach', 'afterEach', 'vi', 'console'].includes(funcName)) {
      testedFunctions.add(funcName);
    }
  }
  
  return Array.from(testedFunctions);
}

/**
 * 分析单个文件的覆盖缺口
 */
async function analyzeFile(sourceFile: string, testFile: string): Promise<CoverageGap | null> {
  // 读取源文件
  if (!fs.existsSync(sourceFile)) {
    console.error(`Source file not found: ${sourceFile}`);
    return null;
  }
  
  const sourceContent = fs.readFileSync(sourceFile, 'utf-8');
  const allFunctions = extractFunctionsFromSource(sourceContent, sourceFile);
  
  // 读取测试文件
  let testedFunctions: string[] = [];
  if (fs.existsSync(testFile)) {
    const testContent = fs.readFileSync(testFile, 'utf-8');
    testedFunctions = extractTestedFunctions(testContent);
  } else {
    console.warn(`Test file not found: ${testFile} (will show all functions as untested)`);
  }
  
  // 找出未测试的函数
  const untestedFunctions = allFunctions.filter(func => 
    !testedFunctions.some(tested => 
      tested === func.name || tested.includes(func.name)
    )
  );
  
  // 计算覆盖率（只计算导出的函数）
  const exportedFunctions = allFunctions.filter(f => f.exported);
  const testedExportedCount = exportedFunctions.length - untestedFunctions.filter(f => f.exported).length;
  const coveragePercentage = exportedFunctions.length > 0 
    ? Math.round((testedExportedCount / exportedFunctions.length) * 100)
    : 0;
  
  return {
    file: path.basename(sourceFile, '.ts'),
    sourceFile,
    testFile,
    allFunctions: exportedFunctions, // 只报告导出的
    testedFunctions,
    untestedFunctions: untestedFunctions.filter(f => f.exported),
    coveragePercentage
  };
}

/**
 * 主函数
 */
async function main() {
  const shannonLibPath = 'D:\\AllAboutCursor\\Shannon\\Shannon-main\\observability\\dashboard\\lib';
  
  console.log('=== Shannon测试覆盖缺口分析 ===\n');
  console.log(`分析路径: ${shannonLibPath}\n`);
  
  // 要分析的文件列表
  const filesToAnalyze = [
    { source: 'store.ts', priority: '⭐⭐⭐⭐⭐' },
    { source: 'engine.ts', priority: '⭐⭐⭐⭐⭐' },
    { source: 'simBridge.ts', priority: '⭐⭐⭐⭐' },
    { source: 'bridgeToStore.ts', priority: '⭐⭐⭐⭐' },
    { source: 'constants.ts', priority: '⭐⭐⭐' },
    { source: 'rng.ts', priority: '⭐⭐⭐' },
    { source: 'config.ts', priority: '⭐⭐' },
  ];
  
  const gaps: CoverageGap[] = [];
  
  for (const file of filesToAnalyze) {
    const sourceFile = path.join(shannonLibPath, file.source);
    const testFile = path.join(shannonLibPath, file.source.replace('.ts', '.test.ts'));
    
    const gap = await analyzeFile(sourceFile, testFile);
    if (gap) {
      gaps.push(gap);
      
      console.log(`## ${file.source} (${file.priority})`);
      console.log(`覆盖率: ${gap.coveragePercentage}%`);
      console.log(`总导出函数: ${gap.allFunctions.length}`);
      console.log(`未测试函数: ${gap.untestedFunctions.length}`);
      
      if (gap.untestedFunctions.length > 0) {
        console.log('\n未测试的函数:');
        gap.untestedFunctions.forEach(func => {
          console.log(`  - ${func.name} (${func.type})`);
        });
      }
      console.log('');
    }
  }
  
  // 生成总结报告
  console.log('=== 总结 ===\n');
  
  const totalFiles = gaps.length;
  const avgCoverage = Math.round(
    gaps.reduce((sum, gap) => sum + gap.coveragePercentage, 0) / totalFiles
  );
  const totalUntested = gaps.reduce((sum, gap) => sum + gap.untestedFunctions.length, 0);
  
  console.log(`分析文件数: ${totalFiles}`);
  console.log(`平均覆盖率: ${avgCoverage}%`);
  console.log(`总未测试函数: ${totalUntested}\n`);
  
  // 按未测试函数数量排序
  const gapsByPriority = [...gaps]
    .filter(g => g.untestedFunctions.length > 0)
    .sort((a, b) => b.untestedFunctions.length - a.untestedFunctions.length);
  
  if (gapsByPriority.length > 0) {
    console.log('=== 建议优先测试 ===\n');
    gapsByPriority.slice(0, 3).forEach((gap, index) => {
      console.log(`${index + 1}. ${gap.file} - ${gap.untestedFunctions.length}个未测试函数 (${gap.coveragePercentage}%覆盖率)`);
      console.log(`   未测试: ${gap.untestedFunctions.map(f => f.name).join(', ')}\n`);
    });
  } else {
    console.log('✅ 所有分析的文件都有良好的测试覆盖！');
  }
  
  // 保存详细报告
  const reportPath = 'archive/shannon-validation/coverage-gap-report.json';
  fs.writeFileSync(reportPath, JSON.stringify(gaps, null, 2));
  console.log(`\n详细报告已保存: ${reportPath}`);
}

main().catch(console.error);




