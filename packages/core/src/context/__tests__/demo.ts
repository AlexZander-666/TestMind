/**
 * Demo script to showcase StaticAnalyzer capabilities
 * Run with: ts-node packages/core/src/context/__tests__/demo.ts
 */

import { StaticAnalyzer } from '../StaticAnalyzer';
import type { ProjectConfig } from '@testmind/shared';
import { DEFAULT_CONFIG } from '@testmind/shared';
import path from 'path';

async function main() {
  console.log('🧠 TestMind - StaticAnalyzer Demo\n');
  console.log('=' .repeat(60));

  // Create analyzer instance
  const config: ProjectConfig = {
    id: 'demo-project',
    name: 'Demo Project',
    repoPath: __dirname,
    language: 'typescript',
    testFramework: 'vitest',
    config: DEFAULT_CONFIG,
  };

  const analyzer = new StaticAnalyzer(config);

  // Analyze sample file
  const sampleFile = path.join(__dirname, 'fixtures/sample.ts');
  console.log(`\n📄 Analyzing file: ${path.basename(sampleFile)}\n`);

  try {
    const result = await analyzer.analyzeFile(sampleFile);

    // Display functions
    console.log(`\n📦 Found ${result.astData.functions.length} functions:`);
    console.log('-'.repeat(60));
    for (const func of result.astData.functions.slice(0, 5)) {
      const params = func.parameters.map((p) => {
        const type = p.type ? `: ${p.type}` : '';
        const optional = p.optional ? '?' : '';
        const defaultVal = p.defaultValue ? ` = ${p.defaultValue}` : '';
        return `${p.name}${optional}${type}${defaultVal}`;
      }).join(', ');

      console.log(`\n  ✓ ${func.name}(${params})`);
      console.log(`    Lines: ${func.startLine}-${func.endLine}`);
      console.log(`    Async: ${func.isAsync ? 'Yes' : 'No'}`);
      console.log(`    Exported: ${func.isExported ? 'Yes' : 'No'}`);
      if (func.returnType) {
        console.log(`    Returns: ${func.returnType}`);
      }
    }

    // Display classes
    if (result.astData.classes.length > 0) {
      console.log(`\n\n🏛️  Found ${result.astData.classes.length} classes:`);
      console.log('-'.repeat(60));
      for (const cls of result.astData.classes) {
        console.log(`\n  ✓ ${cls.name}`);
        console.log(`    Lines: ${cls.startLine}-${cls.endLine}`);
        console.log(`    Methods: ${cls.methods.length}`);
        console.log(`    Properties: ${cls.properties.length}`);
        
        if (cls.methods.length > 0) {
          console.log(`    \n    Methods:`);
          for (const method of cls.methods.slice(0, 3)) {
            console.log(`      - ${method.name}() ${method.isAsync ? '[async]' : ''}`);
          }
        }
      }
    }

    // Display imports
    console.log(`\n\n📥 Found ${result.astData.imports.length} imports:`);
    console.log('-'.repeat(60));
    for (const imp of result.astData.imports) {
      console.log(`  ✓ ${imp.source}`);
      console.log(`    Imports: ${imp.specifiers.join(', ')}`);
    }

    // Display exports
    console.log(`\n\n📤 Found ${result.astData.exports.length} exports:`);
    console.log('-'.repeat(60));
    for (const exp of result.astData.exports.slice(0, 5)) {
      console.log(`  ✓ ${exp.name} ${exp.isDefault ? '[default]' : ''}`);
    }

    // Analyze specific function complexity
    console.log(`\n\n📊 Complexity Analysis:`);
    console.log('-'.repeat(60));
    
    const testFunctions = ['add', 'calculateDiscount', 'fetchUserData'];
    for (const funcName of testFunctions) {
      const func = await analyzer.getFunction(sampleFile, funcName);
      if (func) {
        const complexity = await analyzer.calculateComplexity(sampleFile, funcName);
        console.log(`\n  ${funcName}():`);
        console.log(`    Cyclomatic Complexity: ${complexity.cyclomaticComplexity}`);
        console.log(`    Cognitive Complexity: ${complexity.cognitiveComplexity}`);
        console.log(`    Lines of Code: ${complexity.linesOfCode}`);
        console.log(`    Maintainability Index: ${complexity.maintainabilityIndex.toFixed(1)}`);
      }
    }

    // Analyze side effects
    console.log(`\n\n⚠️  Side Effects Analysis:`);
    console.log('-'.repeat(60));
    
    const sideEffectFuncs = ['fetchUserData', 'getUser'];
    for (const funcName of sideEffectFuncs) {
      const sideEffects = await analyzer.analyzeSideEffects(sampleFile, funcName);
      if (sideEffects.length > 0) {
        console.log(`\n  ${funcName}():`);
        for (const effect of sideEffects) {
          console.log(`    ${effect.type}: ${effect.description}`);
        }
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Analysis complete!\n');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main().catch(console.error);



























