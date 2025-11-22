#!/usr/bin/env ts-node
/**
 * Test TestMind on real open-source projects
 * 
 * Purpose: Validate accuracy, performance, and stability
 * Run with: pnpm tsx scripts/test-real-projects.ts
 */

import { ContextEngine } from '../packages/core/src/context/ContextEngine';
import { StaticAnalyzer } from '../packages/core/src/context/StaticAnalyzer';
import { DependencyGraphBuilder } from '../packages/core/src/context/DependencyGraphBuilder';
import type { ProjectConfig } from '../packages/shared/src/types';
import { DEFAULT_CONFIG } from '../packages/shared/src/constants';
import { promises as fs } from 'fs';
import path from 'path';
import { execSync } from 'child_process';

interface TestProject {
  name: string;
  repo: string;
  branch: string;
  description: string;
  expectedFiles: number;
  expectedFunctions: number;
}

// Test projects selection
const TEST_PROJECTS: TestProject[] = [
  {
    name: 'tiny-project',
    repo: 'local', // Use our own packages as tiny project
    branch: 'main',
    description: 'Small TypeScript project (~50 files)',
    expectedFiles: 50,
    expectedFunctions: 100,
  },
  // Add more projects as needed
  // {
  //   name: 'vitest',
  //   repo: 'https://github.com/vitest-dev/vitest.git',
  //   branch: 'main',
  //   description: 'Testing framework (~500 files)',
  //   expectedFiles: 500,
  //   expectedFunctions: 2000,
  // },
];

interface TestResult {
  project: string;
  success: boolean;
  filesAnalyzed: number;
  functionsExtracted: number;
  classesExtracted: number;
  dependencyEdges: number;
  duration: number;
  performance: {
    avgTimePerFile: number;
    filesPerSecond: number;
  };
  errors: string[];
  warnings: string[];
}

async function main() {
  console.log('🧪 TestMind - Real Project Testing\n');
  console.log('='.repeat(80));
  console.log('\nObjective: Validate accuracy, performance, and stability');
  console.log(`Testing ${TEST_PROJECTS.length} projects\n`);

  const results: TestResult[] = [];
  const tempDir = path.join(process.cwd(), '.testmind-test-temp');

  try {
    // Ensure temp directory exists
    await fs.mkdir(tempDir, { recursive: true });

    for (const project of TEST_PROJECTS) {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`\n📦 Testing Project: ${project.name}`);
      console.log(`   Description: ${project.description}`);
      console.log(`   Expected: ${project.expectedFiles} files, ${project.expectedFunctions} functions\n`);

      const result = await testProject(project, tempDir);
      results.push(result);

      displayResult(result);
    }

    // Generate summary report
    console.log(`\n\n${'='.repeat(80)}`);
    console.log('\n📊 SUMMARY REPORT\n');
    displaySummary(results);

    // Save detailed report
    await saveReport(results);

    console.log('\n✅ Testing complete! Report saved to: .testmind-test-report.json\n');

  } catch (error) {
    console.error('\n❌ Testing failed:', error);
    process.exit(1);
  } finally {
    // Cleanup temp directory (optional, keep for debugging)
    // await fs.rm(tempDir, { recursive: true, force: true });
  }
}

async function testProject(project: TestProject, tempDir: string): Promise<TestResult> {
  const result: TestResult = {
    project: project.name,
    success: false,
    filesAnalyzed: 0,
    functionsExtracted: 0,
    classesExtracted: 0,
    dependencyEdges: 0,
    duration: 0,
    performance: { avgTimePerFile: 0, filesPerSecond: 0 },
    errors: [],
    warnings: [],
  };

  try {
    // Setup project path
    let projectPath: string;
    
    if (project.repo === 'local') {
      // Use our own packages as test project
      projectPath = path.join(process.cwd(), 'packages');
    } else {
      // Clone the project
      projectPath = path.join(tempDir, project.name);
      console.log(`   Cloning repository...`);
      
      if (!(await directoryExists(projectPath))) {
        execSync(`git clone --depth 1 -b ${project.branch} ${project.repo} ${projectPath}`, {
          stdio: 'ignore',
        });
      }
      console.log(`   ✓ Repository ready`);
    }

    // Create analyzer config
    const config: ProjectConfig = {
      id: `test-${project.name}`,
      name: project.name,
      repoPath: projectPath,
      language: 'typescript',
      testFramework: 'vitest',
      config: DEFAULT_CONFIG,
    };

    console.log(`   Analyzing code...`);
    const startTime = Date.now();

    // Create engines
    const analyzer = new StaticAnalyzer(config);
    const dependencyBuilder = new DependencyGraphBuilder(config);
    const contextEngine = new ContextEngine(config);

    // Index project
    const indexResult = await contextEngine.indexProject(projectPath);

    // Get dependency stats
    const depStats = dependencyBuilder.getStats();

    const duration = Date.now() - startTime;

    // Populate result
    result.success = true;
    result.filesAnalyzed = indexResult.filesIndexed;
    result.functionsExtracted = indexResult.functionsExtracted;
    result.classesExtracted = 0; // TODO: Add to indexResult
    result.dependencyEdges = depStats.totalEdges;
    result.duration = duration;
    result.performance.avgTimePerFile =
      result.filesAnalyzed > 0 ? duration / result.filesAnalyzed : 0;
    result.performance.filesPerSecond =
      duration > 0 ? (result.filesAnalyzed / duration) * 1000 : 0;

    // Validate results
    if (result.filesAnalyzed === 0) {
      result.warnings.push('No files analyzed - check include patterns');
    }
    if (result.functionsExtracted === 0) {
      result.warnings.push('No functions extracted - possible parsing issue');
    }

    // Cleanup
    await contextEngine.dispose();

  } catch (error) {
    result.success = false;
    result.errors.push(String(error));
  }

  return result;
}

function displayResult(result: TestResult) {
  console.log(`\n   Results:`);
  console.log(`   ${result.success ? '✅' : '❌'} Status: ${result.success ? 'SUCCESS' : 'FAILED'}`);
  console.log(`   📁 Files: ${result.filesAnalyzed}`);
  console.log(`   ⚡ Functions: ${result.functionsExtracted}`);
  console.log(`   🔗 Dependencies: ${result.dependencyEdges} edges`);
  console.log(`   ⏱️  Duration: ${(result.duration / 1000).toFixed(2)}s`);
  console.log(`   📈 Performance: ${result.performance.filesPerSecond.toFixed(1)} files/sec`);
  console.log(`   💾 Avg/file: ${result.performance.avgTimePerFile.toFixed(1)}ms`);

  if (result.errors.length > 0) {
    console.log(`\n   ❌ Errors:`);
    result.errors.forEach((err) => console.log(`      - ${err}`));
  }

  if (result.warnings.length > 0) {
    console.log(`\n   ⚠️  Warnings:`);
    result.warnings.forEach((warn) => console.log(`      - ${warn}`));
  }
}

function displaySummary(results: TestResult[]) {
  const successful = results.filter((r) => r.success).length;
  const totalFiles = results.reduce((sum, r) => sum + r.filesAnalyzed, 0);
  const totalFunctions = results.reduce((sum, r) => sum + r.functionsExtracted, 0);
  const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
  const avgPerformance =
    results.reduce((sum, r) => sum + r.performance.filesPerSecond, 0) / results.length;

  console.log(`✅ Success Rate: ${successful}/${results.length} (${((successful / results.length) * 100).toFixed(1)}%)`);
  console.log(`📁 Total Files Analyzed: ${totalFiles}`);
  console.log(`⚡ Total Functions Extracted: ${totalFunctions}`);
  console.log(`⏱️  Average Duration: ${(avgDuration / 1000).toFixed(2)}s`);
  console.log(`📈 Average Performance: ${avgPerformance.toFixed(1)} files/sec`);

  // Performance verdict
  console.log('\n🎯 Performance Verdict:');
  if (avgPerformance > 3) {
    console.log(`   ✅ EXCELLENT (${avgPerformance.toFixed(1)} files/sec > 3 files/sec target)`);
  } else if (avgPerformance > 1) {
    console.log(`   ✅ GOOD (${avgPerformance.toFixed(1)} files/sec > 1 file/sec target)`);
  } else {
    console.log(`   ⚠️  NEEDS OPTIMIZATION (${avgPerformance.toFixed(1)} files/sec)`);
  }
}

async function saveReport(results: TestResult[]) {
  const report = {
    timestamp: new Date().toISOString(),
    testmindVersion: '0.1.0',
    results,
    summary: {
      totalProjects: results.length,
      successfulProjects: results.filter((r) => r.success).length,
      totalFiles: results.reduce((sum, r) => sum + r.filesAnalyzed, 0),
      totalFunctions: results.reduce((sum, r) => sum + r.functionsExtracted, 0),
      avgPerformance:
        results.reduce((sum, r) => sum + r.performance.filesPerSecond, 0) / results.length,
    },
  };

  await fs.writeFile('.testmind-test-report.json', JSON.stringify(report, null, 2));
}

async function directoryExists(dirPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dirPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

main().catch(console.error);



























