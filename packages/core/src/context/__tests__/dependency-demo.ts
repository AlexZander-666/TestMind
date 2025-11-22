/**
 * Demo script for DependencyGraphBuilder
 * Run with: ts-node packages/core/src/context/__tests__/dependency-demo.ts
 */

import { DependencyGraphBuilder } from '../DependencyGraphBuilder';
import { StaticAnalyzer } from '../StaticAnalyzer';
import type { ProjectConfig } from '@testmind/shared';
import { DEFAULT_CONFIG } from '@testmind/shared';
import path from 'path';

async function main() {
  console.log('🧠 TestMind - DependencyGraphBuilder Demo\n');
  console.log('='.repeat(60));

  // Create config
  const config: ProjectConfig = {
    id: 'demo-project',
    name: 'Demo Project',
    repoPath: __dirname,
    language: 'typescript',
    testFramework: 'vitest',
    config: DEFAULT_CONFIG,
  };

  // Initialize analyzer and builder
  const analyzer = new StaticAnalyzer(config);
  const builder = new DependencyGraphBuilder(config);

  // Analyze test fixtures
  const fixturesDir = path.join(__dirname, 'fixtures');
  console.log(`\n📁 Analyzing fixtures directory: ${path.basename(fixturesDir)}\n`);

  const files = await Promise.all([
    analyzer.analyzeFile(path.join(fixturesDir, 'moduleA.ts')),
    analyzer.analyzeFile(path.join(fixturesDir, 'moduleB.ts')),
    analyzer.analyzeFile(path.join(fixturesDir, 'moduleC.ts')),
  ]);

  console.log(`✓ Analyzed ${files.length} modules`);

  // Build dependency graph
  console.log('\n🔨 Building dependency graph...\n');
  await builder.buildGraph(files);

  // Display graph statistics
  const stats = builder.getStats();
  console.log('📊 Graph Statistics:');
  console.log('-'.repeat(60));
  console.log(`  Total Nodes: ${stats.totalNodes}`);
  console.log(`  Total Edges: ${stats.totalEdges}`);
  console.log(`  Avg Dependencies per Module: ${stats.avgDependencies.toFixed(2)}`);
  console.log(`  Max Dependencies: ${stats.maxDependencies}`);

  // Show dependencies for each module
  console.log('\n\n🔗 Module Dependencies:\n');
  console.log('-'.repeat(60));

  for (const file of files) {
    const moduleName = path.basename(file.filePath);
    const deps = await builder.getModuleDependencies(file.filePath);
    
    console.log(`\n  📦 ${moduleName}`);
    if (deps.length > 0) {
      console.log(`    Imports:`);
      for (const dep of deps) {
        console.log(`      → ${path.basename(dep)}`);
      }
    } else {
      console.log(`    No dependencies (leaf module)`);
    }

    // Show transitive dependencies
    const transitive = builder.getTransitiveDependencies(file.filePath);
    if (transitive.size > 0) {
      console.log(`    Transitive (depth 3):`);
      for (const dep of transitive) {
        console.log(`      ⇒ ${path.basename(dep)}`);
      }
    }
  }

  // Show reverse dependencies (who uses this module)
  console.log('\n\n🔙 Reverse Dependencies (Who Uses This):\n');
  console.log('-'.repeat(60));

  for (const file of files) {
    const moduleName = path.basename(file.filePath);
    const callers = await builder.getFunctionCallers(file.filePath, '');
    
    console.log(`\n  📦 ${moduleName}`);
    if (callers.length > 0) {
      console.log(`    Used by:`);
      for (const caller of callers) {
        console.log(`      ← ${path.basename(caller)}`);
      }
    } else {
      console.log(`    Not imported by any module`);
    }
  }

  // Detect circular dependencies
  console.log('\n\n🔄 Circular Dependency Check:\n');
  console.log('-'.repeat(60));

  for (const file of files) {
    const moduleName = path.basename(file.filePath);
    const cycles = builder.detectCircularDependencies(file.filePath);
    
    if (cycles.length > 0) {
      console.log(`\n  ⚠️  ${moduleName} has circular dependencies:`);
      for (const cycle of cycles) {
        const cycleNames = cycle.map((f) => path.basename(f)).join(' → ');
        console.log(`    ${cycleNames}`);
      }
    }
  }
  
  if (files.every(f => builder.detectCircularDependencies(f.filePath).length === 0)) {
    console.log('\n  ✅ No circular dependencies detected');
  }

  // Export DOT format
  console.log('\n\n📊 Graph Visualization (DOT format):\n');
  console.log('-'.repeat(60));
  const dot = builder.exportToDOT();
  console.log(dot);

  console.log('\n' + '='.repeat(60));
  console.log('✅ Dependency analysis complete!\n');
  console.log('💡 Tip: Copy the DOT format to https://dreampuf.github.io/GraphvizOnline/');
  console.log('   to visualize the dependency graph\n');
}

main().catch(console.error);



























