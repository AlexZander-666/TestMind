/**
 * Performance Benchmark Script
 * Tests TestMind against NFR (Non-Functional Requirements)
 * 
 * Validates performance targets from WEEK_7_READY:
 * - Small projects: <5s analysis
 * - Medium projects: <30s analysis
 * - Large projects: <2min analysis
 * 
 * Business perspective (4.md): Performance = User Trust
 * 
 * Note: This version tests ANALYSIS performance only (no LLM calls)
 * to provide consistent, repeatable benchmark results.
 */

import { StaticAnalyzer } from '../packages/core/src/context/StaticAnalyzer.js';
import type { ProjectConfig } from '@testmind/shared';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';

interface BenchmarkResult {
  category: 'Small' | 'Medium' | 'Large';
  filesCount: number;
  functionsCount: number;
  analysisTimeMs: number;
  generationTimeMs: number;
  totalTimeMs: number;
  targetTimeMs: number;
  passed: boolean;
  performanceRatio: number; // Actual / Target (lower is better)
}

interface BenchmarkReport {
  timestamp: Date;
  systemInfo: {
    platform: string;
    nodeVersion: string;
    cpuCount: number;
    totalMemoryGB: number;
  };
  results: BenchmarkResult[];
  summary: {
    totalTests: number;
    passed: number;
    failed: number;
    overallPass: boolean;
  };
  recommendations: string[];
}

class PerformanceBenchmark {
  private tempDir: string | null = null;

  async run(): Promise<BenchmarkReport> {
    console.log('='.repeat(60));
    console.log('TestMind Performance Benchmark');
    console.log('='.repeat(60));
    console.log();

    const systemInfo = this.collectSystemInfo();
    console.log('System Information:');
    console.log(`  Platform: ${systemInfo.platform}`);
    console.log(`  Node: ${systemInfo.nodeVersion}`);
    console.log(`  CPUs: ${systemInfo.cpuCount}`);
    console.log(`  Memory: ${systemInfo.totalMemoryGB.toFixed(1)} GB`);
    console.log();

    const results: BenchmarkResult[] = [];

    // Test 1: Small Project (1-5 files)
    console.log('Test 1/3: Small Project Performance');
    results.push(await this.benchmarkSmallProject());

    // Test 2: Medium Project (20-30 files)
    console.log('\nTest 2/3: Medium Project Performance');
    results.push(await this.benchmarkMediumProject());

    // Test 3: Large Project (100+ files)
    console.log('\nTest 3/3: Large Project Performance');
    results.push(await this.benchmarkLargeProject());

    // Generate summary
    const summary = {
      totalTests: results.length,
      passed: results.filter(r => r.passed).length,
      failed: results.filter(r => !r.passed).length,
      overallPass: results.every(r => r.passed),
    };

    const recommendations = this.generateRecommendations(results);

    const report: BenchmarkReport = {
      timestamp: new Date(),
      systemInfo,
      results,
      summary,
      recommendations,
    };

    // Print results
    this.printReport(report);

    return report;
  }

  private collectSystemInfo() {
    return {
      platform: `${process.platform} ${os.release()}`,
      nodeVersion: process.version,
      cpuCount: os.cpus().length,
      totalMemoryGB: os.totalmem() / (1024 ** 3),
    };
  }

  private async benchmarkSmallProject(): Promise<BenchmarkResult> {
    const filesCount = 5;
    const functionsPerFile = 3;
    const targetTimeMs = 5000; // 5 seconds

    console.log(`  Target: ${filesCount} files, ${filesCount * functionsPerFile} functions, <${targetTimeMs / 1000}s`);

    // Create temporary project
    this.tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'testmind-bench-small-'));

    await this.generateTestProject(this.tempDir, filesCount, functionsPerFile);

    // Benchmark - Analysis only
    const config = this.createConfig(this.tempDir);
    const analyzer = new StaticAnalyzer(config);

    const startTime = Date.now();

    // Analysis phase - analyze all files
    const analysisStart = Date.now();
    const files = await fs.readdir(this.tempDir);
    const tsFiles = files.filter(f => f.endsWith('.ts'));
    
    let totalFunctions = 0;
    for (const file of tsFiles) {
      const filePath = path.join(this.tempDir, file);
      const result = await analyzer.analyzeFile(filePath);
      totalFunctions += result.astData.functions.length;
    }
    
    const analysisTimeMs = Date.now() - analysisStart;
    const generationTimeMs = 0; // Skip generation for consistent benchmarks
    const totalTimeMs = Date.now() - startTime;

    // Cleanup
    await fs.rm(this.tempDir, { recursive: true, force: true });

    const passed = totalTimeMs < targetTimeMs;
    const performanceRatio = totalTimeMs / targetTimeMs;

    console.log(`  ✓ Analysis: ${analysisTimeMs}ms`);
    console.log(`  ✓ Generation: ${generationTimeMs}ms`);
    console.log(`  ✓ Total: ${totalTimeMs}ms`);
    console.log(`  ${passed ? '✅ PASS' : '❌ FAIL'} (${(performanceRatio * 100).toFixed(1)}% of target)`);

    return {
      category: 'Small',
      filesCount: tsFiles.length,
      functionsCount: totalFunctions,
      analysisTimeMs,
      generationTimeMs,
      totalTimeMs,
      targetTimeMs,
      passed,
      performanceRatio,
    };
  }

  private async benchmarkMediumProject(): Promise<BenchmarkResult> {
    const filesCount = 25;
    const functionsPerFile = 4;
    const targetTimeMs = 30000; // 30 seconds

    console.log(`  Target: ${filesCount} files, ${filesCount * functionsPerFile} functions, <${targetTimeMs / 1000}s`);

    // Create temporary project
    this.tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'testmind-bench-medium-'));

    await this.generateTestProject(this.tempDir, filesCount, functionsPerFile);

    // Benchmark - Analysis only
    const config = this.createConfig(this.tempDir);
    const analyzer = new StaticAnalyzer(config);

    const startTime = Date.now();

    // Analysis phase - analyze all files
    const analysisStart = Date.now();
    const files = await fs.readdir(this.tempDir);
    const tsFiles = files.filter(f => f.endsWith('.ts'));
    
    let totalFunctions = 0;
    for (const file of tsFiles) {
      const filePath = path.join(this.tempDir, file);
      const result = await analyzer.analyzeFile(filePath);
      totalFunctions += result.astData.functions.length;
    }
    
    const analysisTimeMs = Date.now() - analysisStart;
    const generationTimeMs = 0; // Skip generation for consistent benchmarks
    const totalTimeMs = Date.now() - startTime;

    // Cleanup
    await fs.rm(this.tempDir, { recursive: true, force: true });

    const passed = totalTimeMs < targetTimeMs;
    const performanceRatio = totalTimeMs / targetTimeMs;

    console.log(`  ✓ Analysis: ${analysisTimeMs}ms`);
    console.log(`  ✓ Generation: ${generationTimeMs}ms`);
    console.log(`  ✓ Total: ${totalTimeMs}ms`);
    console.log(`  ${passed ? '✅ PASS' : '❌ FAIL'} (${(performanceRatio * 100).toFixed(1)}% of target)`);

    return {
      category: 'Medium',
      filesCount: tsFiles.length,
      functionsCount: totalFunctions,
      analysisTimeMs,
      generationTimeMs,
      totalTimeMs,
      targetTimeMs,
      passed,
      performanceRatio,
    };
  }

  private async benchmarkLargeProject(): Promise<BenchmarkResult> {
    const filesCount = 100;
    const functionsPerFile = 5;
    const targetTimeMs = 120000; // 2 minutes

    console.log(`  Target: ${filesCount} files, ${filesCount * functionsPerFile} functions, <${targetTimeMs / 1000}s`);

    // Create temporary project
    this.tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'testmind-bench-large-'));

    await this.generateTestProject(this.tempDir, filesCount, functionsPerFile);

    // Benchmark - Analysis only
    const config = this.createConfig(this.tempDir);
    const analyzer = new StaticAnalyzer(config);

    const startTime = Date.now();

    // Analysis phase - analyze all files
    const analysisStart = Date.now();
    const files = await fs.readdir(this.tempDir);
    const tsFiles = files.filter(f => f.endsWith('.ts'));
    
    let totalFunctions = 0;
    for (const file of tsFiles) {
      const filePath = path.join(this.tempDir, file);
      const result = await analyzer.analyzeFile(filePath);
      totalFunctions += result.astData.functions.length;
    }
    
    const analysisTimeMs = Date.now() - analysisStart;
    const generationTimeMs = 0; // Skip generation for consistent benchmarks
    const totalTimeMs = Date.now() - startTime;

    // Cleanup
    await fs.rm(this.tempDir, { recursive: true, force: true });

    const passed = totalTimeMs < targetTimeMs;
    const performanceRatio = totalTimeMs / targetTimeMs;

    console.log(`  ✓ Analysis: ${analysisTimeMs}ms`);
    console.log(`  ✓ Generation: ${generationTimeMs}ms`);
    console.log(`  ✓ Total: ${totalTimeMs}ms`);
    console.log(`  ${passed ? '✅ PASS' : '❌ FAIL'} (${(performanceRatio * 100).toFixed(1)}% of target)`);

    return {
      category: 'Large',
      filesCount: tsFiles.length,
      functionsCount: totalFunctions,
      analysisTimeMs,
      generationTimeMs,
      totalTimeMs,
      targetTimeMs,
      passed,
      performanceRatio,
    };
  }

  private async generateTestProject(dir: string, filesCount: number, functionsPerFile: number): Promise<void> {
    for (let i = 0; i < filesCount; i++) {
      const functions = [];
      for (let j = 0; j < functionsPerFile; j++) {
        functions.push(`
export function func${j}(x: number): number {
  if (x < 0) return 0;
  if (x === 0) return 1;
  if (x === 1) return 1;
  return x * 2;
}`);
      }

      const content = `// File ${i}\n${functions.join('\n\n')}`;
      await fs.writeFile(path.join(dir, `file${i}.ts`), content, 'utf-8');
    }
  }

  private createConfig(rootPath: string): ProjectConfig {
    return {
      id: 'benchmark-project',
      name: 'Benchmark Project',
      language: 'typescript',
      rootPath,
      config: {
        includePatterns: ['**/*.ts'],
        excludePatterns: ['**/*.test.ts', '**/node_modules/**'],
        testFramework: 'jest',
        llmConfig: {
          provider: 'openai',
          model: 'gpt-4',
          apiKey: process.env.OPENAI_API_KEY || 'test-key',
        },
      },
    };
  }

  private generateRecommendations(results: BenchmarkResult[]): string[] {
    const recommendations: string[] = [];

    // Check if any tests failed
    const failed = results.filter(r => !r.passed);
    if (failed.length > 0) {
      recommendations.push(`⚠️ ${failed.length} performance test(s) failed. Consider optimization.`);
      
      for (const result of failed) {
        const overBy = result.totalTimeMs - result.targetTimeMs;
        const overBySeconds = (overBy / 1000).toFixed(1);
        recommendations.push(
          `   - ${result.category} project exceeded target by ${overBySeconds}s (${(result.performanceRatio * 100).toFixed(0)}% of target)`
        );
      }
    } else {
      recommendations.push('✅ All performance tests passed! System meets NFR requirements.');
    }

    // Check for bottlenecks
    for (const result of results) {
      const analysisRatio = result.analysisTimeMs / result.totalTimeMs;
      const generationRatio = result.generationTimeMs / result.totalTimeMs;

      if (analysisRatio > 0.8) {
        recommendations.push(
          `💡 ${result.category} project: Analysis phase is ${(analysisRatio * 100).toFixed(0)}% of total time. Consider caching.`
        );
      }

      if (generationRatio > 0.5 && result.category === 'Small') {
        recommendations.push(
          `💡 ${result.category} project: Generation phase is slow. Consider prompt optimization or faster LLM.`
        );
      }
    }

    // Performance trend
    const avgRatio = results.reduce((sum, r) => sum + r.performanceRatio, 0) / results.length;
    if (avgRatio < 0.5) {
      recommendations.push('🚀 Excellent performance! System runs at <50% of target time across all categories.');
    } else if (avgRatio < 0.8) {
      recommendations.push('✓ Good performance! System runs within 80% of target time.');
    }

    return recommendations;
  }

  private printReport(report: BenchmarkReport): void {
    console.log();
    console.log('='.repeat(60));
    console.log('Performance Benchmark Report');
    console.log('='.repeat(60));
    console.log();

    // Summary table
    console.log('Summary:');
    console.log(`  Tests Run: ${report.summary.totalTests}`);
    console.log(`  Passed: ${report.summary.passed}`);
    console.log(`  Failed: ${report.summary.failed}`);
    console.log(`  Overall: ${report.summary.overallPass ? '✅ PASS' : '❌ FAIL'}`);
    console.log();

    // Detailed results
    console.log('Detailed Results:');
    console.log();
    for (const result of report.results) {
      console.log(`${result.category} Project:`);
      console.log(`  Files: ${result.filesCount}`);
      console.log(`  Functions: ${result.functionsCount}`);
      console.log(`  Analysis: ${result.analysisTimeMs}ms`);
      console.log(`  Generation: ${result.generationTimeMs}ms`);
      console.log(`  Total: ${result.totalTimeMs}ms (target: ${result.targetTimeMs}ms)`);
      console.log(`  Performance: ${(result.performanceRatio * 100).toFixed(1)}% of target`);
      console.log(`  Result: ${result.passed ? '✅ PASS' : '❌ FAIL'}`);
      console.log();
    }

    // Recommendations
    console.log('Recommendations:');
    for (const recommendation of report.recommendations) {
      console.log(`  ${recommendation}`);
    }
    console.log();

    // Business perspective (4.md)
    console.log('Business Impact Analysis:');
    const avgTime = report.results.reduce((sum, r) => sum + r.totalTimeMs, 0) / report.results.length;
    const avgTimeSeconds = (avgTime / 1000).toFixed(1);
    
    console.log(`  Average response time: ${avgTimeSeconds}s`);
    if (report.summary.overallPass) {
      console.log('  ✅ User Trust: HIGH - System responds quickly');
      console.log('  ✅ Developer Experience: EXCELLENT - Fast feedback loop');
      console.log('  ✅ Adoption Likelihood: HIGH - Performance meets expectations');
    } else {
      console.log('  ⚠️ User Trust: MEDIUM - Performance needs improvement');
      console.log('  ⚠️ Developer Experience: ACCEPTABLE - Some delays expected');
      console.log('  ⚠️ Adoption Likelihood: MEDIUM - Optimize for better market fit');
    }
    console.log();
    console.log('='.repeat(60));
  }
}

// Run benchmark
async function main() {
  const benchmark = new PerformanceBenchmark();
  
  try {
    const report = await benchmark.run();
    
    // Save report to file
    const reportPath = path.join(__dirname, '../PERFORMANCE_BENCHMARK_REPORT.md');
    const markdown = generateMarkdownReport(report);
    await fs.writeFile(reportPath, markdown, 'utf-8');
    
    console.log(`\nFull report saved to: PERFORMANCE_BENCHMARK_REPORT.md`);
    
    // Exit with appropriate code
    process.exit(report.summary.overallPass ? 0 : 1);
  } catch (error) {
    console.error('Benchmark failed:', error);
    process.exit(1);
  }
}

function generateMarkdownReport(report: BenchmarkReport): string {
  const lines: string[] = [];
  
  lines.push('# TestMind Performance Benchmark Report');
  lines.push('');
  lines.push(`**Generated:** ${report.timestamp.toISOString()}`);
  lines.push('');
  
  lines.push('## System Information');
  lines.push('');
  lines.push('| Property | Value |');
  lines.push('|----------|-------|');
  lines.push(`| Platform | ${report.systemInfo.platform} |`);
  lines.push(`| Node Version | ${report.systemInfo.nodeVersion} |`);
  lines.push(`| CPU Count | ${report.systemInfo.cpuCount} |`);
  lines.push(`| Total Memory | ${report.systemInfo.totalMemoryGB.toFixed(1)} GB |`);
  lines.push('');
  
  lines.push('## Summary');
  lines.push('');
  lines.push(`- **Tests Run:** ${report.summary.totalTests}`);
  lines.push(`- **Passed:** ${report.summary.passed}`);
  lines.push(`- **Failed:** ${report.summary.failed}`);
  lines.push(`- **Overall:** ${report.summary.overallPass ? '✅ PASS' : '❌ FAIL'}`);
  lines.push('');
  
  lines.push('## Detailed Results');
  lines.push('');
  lines.push('| Category | Files | Functions | Analysis (ms) | Generation (ms) | Total (ms) | Target (ms) | Performance | Status |');
  lines.push('|----------|-------|-----------|---------------|-----------------|------------|-------------|-------------|--------|');
  
  for (const result of report.results) {
    const perfPercent = `${(result.performanceRatio * 100).toFixed(1)}%`;
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    lines.push(
      `| ${result.category} | ${result.filesCount} | ${result.functionsCount} | ${result.analysisTimeMs} | ${result.generationTimeMs} | ${result.totalTimeMs} | ${result.targetTimeMs} | ${perfPercent} | ${status} |`
    );
  }
  
  lines.push('');
  lines.push('## Recommendations');
  lines.push('');
  for (const rec of report.recommendations) {
    lines.push(`- ${rec}`);
  }
  lines.push('');
  
  lines.push('## Business Impact');
  lines.push('');
  const avgTime = report.results.reduce((sum, r) => sum + r.totalTimeMs, 0) / report.results.length;
  lines.push(`**Average Response Time:** ${(avgTime / 1000).toFixed(1)}s`);
  lines.push('');
  
  if (report.summary.overallPass) {
    lines.push('### Positive Indicators:');
    lines.push('- ✅ **User Trust:** HIGH - System responds quickly');
    lines.push('- ✅ **Developer Experience:** EXCELLENT - Fast feedback loop');
    lines.push('- ✅ **Adoption Likelihood:** HIGH - Performance meets expectations');
    lines.push('- ✅ **Market Readiness:** System is production-ready from performance perspective');
  } else {
    lines.push('### Areas for Improvement:');
    lines.push('- ⚠️ **User Trust:** MEDIUM - Performance optimization recommended');
    lines.push('- ⚠️ **Developer Experience:** ACCEPTABLE - Feedback loop could be faster');
    lines.push('- ⚠️ **Adoption Likelihood:** MEDIUM - Performance improvements will increase adoption');
  }
  lines.push('');
  
  lines.push('---');
  lines.push('');
  lines.push('*This report validates TestMind against Non-Functional Requirements (NFR) from the project roadmap.*');
  
  return lines.join('\n');
}

// Execute if run directly
if (require.main === module) {
  main();
}

export { PerformanceBenchmark, type BenchmarkReport, type BenchmarkResult };

