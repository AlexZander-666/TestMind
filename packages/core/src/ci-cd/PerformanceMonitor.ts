/**
 * PerformanceMonitor - 测试性能回归检测器
 * 
 * 功能：
 * 1. 比较当前测试运行与基线
 * 2. 检测性能退化
 * 3. 生成性能报告
 * 4. CI 集成支持
 */

import * as fs from 'fs/promises';

/**
 * 测试运行数据
 */
export interface TestRun {
  /** 运行时间戳 */
  timestamp: string;
  
  /** 总时长（毫秒） */
  totalDuration: number;
  
  /** 测试列表 */
  tests: TestPerformance[];
  
  /** 环境信息 */
  environment?: {
    node: string;
    os: string;
    cpu: string;
  };
}

/**
 * 单个测试性能数据
 */
export interface TestPerformance {
  /** 测试名称 */
  name: string;
  
  /** 测试文件 */
  file: string;
  
  /** 执行时长（毫秒） */
  duration: number;
  
  /** 是否通过 */
  passed: boolean;
  
  /** 内存使用（字节） */
  memoryUsed?: number;
}

/**
 * 性能回归
 */
export interface PerformanceRegression {
  /** 测试名称 */
  test: string;
  
  /** 基线时长 */
  baselineDuration: number;
  
  /** 当前时长 */
  currentDuration: number;
  
  /** 变慢倍数 */
  slowdownRatio: number;
  
  /** 变慢百分比 */
  slowdownPercentage: string;
  
  /** 严重程度 */
  severity: 'critical' | 'warning' | 'minor';
  
  /** 绝对差异（毫秒） */
  absoluteDiff: number;
}

/**
 * 性能改进
 */
export interface PerformanceImprovement {
  /** 测试名称 */
  test: string;
  
  /** 基线时长 */
  baselineDuration: number;
  
  /** 当前时长 */
  currentDuration: number;
  
  /** 加快倍数 */
  speedupRatio: number;
  
  /** 加快百分比 */
  speedupPercentage: string;
}

/**
 * 性能对比结果
 */
export interface PerformanceComparisonResult {
  /** 总体性能变化 */
  overall: {
    baselineTotalDuration: number;
    currentTotalDuration: number;
    changePercentage: number;
    improved: boolean;
  };
  
  /** 回归列表 */
  regressions: PerformanceRegression[];
  
  /** 改进列表 */
  improvements: PerformanceImprovement[];
  
  /** 统计 */
  stats: {
    totalTests: number;
    regressedTests: number;
    improvedTests: number;
    unchangedTests: number;
    criticalRegressions: number;
  };
}

/**
 * 配置选项
 */
export interface PerformanceMonitorConfig {
  /** 回归阈值（倍数） */
  regressionThreshold?: number;
  
  /** 改进阈值（倍数） */
  improvementThreshold?: number;
  
  /** 严重回归阈值（倍数） */
  criticalThreshold?: number;
  
  /** 最小测试时长（毫秒，过短的测试忽略） */
  minTestDuration?: number;
}

/**
 * 性能监控器
 */
export class PerformanceMonitor {
  private config: Required<PerformanceMonitorConfig>;

  constructor(config: PerformanceMonitorConfig = {}) {
    this.config = {
      regressionThreshold: config.regressionThreshold ?? 1.2, // 20% 变慢
      improvementThreshold: config.improvementThreshold ?? 1.2, // 20% 变快
      criticalThreshold: config.criticalThreshold ?? 2.0, // 100% 变慢
      minTestDuration: config.minTestDuration ?? 10, // 10ms
    };
  }

  /**
   * 检测性能回归
   */
  async detectRegression(
    currentRunPath: string,
    baselinePath: string
  ): Promise<PerformanceComparisonResult> {
    console.log('[PerformanceMonitor] Detecting performance regression...');

    // 1. 加载运行数据
    const currentRun = await this.loadTestRun(currentRunPath);
    const baseline = await this.loadTestRun(baselinePath);

    // 2. 比较测试性能
    const regressions: PerformanceRegression[] = [];
    const improvements: PerformanceImprovement[] = [];
    let unchangedTests = 0;

    for (const currentTest of currentRun.tests) {
      const baselineTest = baseline.tests.find(t => t.name === currentTest.name);
      
      if (!baselineTest) {
        continue; // 新测试，跳过
      }

      // 跳过过短的测试
      if (baselineTest.duration < this.config.minTestDuration) {
        continue;
      }

      const ratio = currentTest.duration / baselineTest.duration;

      // 检测回归
      if (ratio >= this.config.regressionThreshold) {
        const absoluteDiff = currentTest.duration - baselineTest.duration;
        const severity = this.calculateSeverity(ratio);

        regressions.push({
          test: currentTest.name,
          baselineDuration: baselineTest.duration,
          currentDuration: currentTest.duration,
          slowdownRatio: ratio,
          slowdownPercentage: `${((ratio - 1) * 100).toFixed(0)}%`,
          severity,
          absoluteDiff,
        });
      }
      // 检测改进
      else if (ratio <= (1 / this.config.improvementThreshold)) {
        improvements.push({
          test: currentTest.name,
          baselineDuration: baselineTest.duration,
          currentDuration: currentTest.duration,
          speedupRatio: 1 / ratio,
          speedupPercentage: `${((1 / ratio - 1) * 100).toFixed(0)}%`,
        });
      }
      // 无显著变化
      else {
        unchangedTests++;
      }
    }

    // 3. 计算总体性能
    const baselineTotalDuration = baseline.totalDuration;
    const currentTotalDuration = currentRun.totalDuration;
    const changePercentage = ((currentTotalDuration - baselineTotalDuration) / baselineTotalDuration) * 100;

    const criticalRegressions = regressions.filter(r => r.severity === 'critical').length;

    console.log('[PerformanceMonitor] Detection complete:');
    console.log(`  - Regressions: ${regressions.length} (${criticalRegressions} critical)`);
    console.log(`  - Improvements: ${improvements.length}`);
    console.log(`  - Overall change: ${changePercentage > 0 ? '+' : ''}${changePercentage.toFixed(1)}%`);

    return {
      overall: {
        baselineTotalDuration,
        currentTotalDuration,
        changePercentage: parseFloat(changePercentage.toFixed(2)),
        improved: changePercentage < 0,
      },
      regressions,
      improvements,
      stats: {
        totalTests: currentRun.tests.length,
        regressedTests: regressions.length,
        improvedTests: improvements.length,
        unchangedTests,
        criticalRegressions,
      },
    };
  }

  /**
   * 保存为基线
   */
  async saveBaseline(runPath: string, baselinePath: string): Promise<void> {
    const run = await this.loadTestRun(runPath);
    await fs.writeFile(baselinePath, JSON.stringify(run, null, 2));
    console.log(`[PerformanceMonitor] Baseline saved to: ${baselinePath}`);
  }

  /**
   * 生成 Markdown 报告
   */
  generateMarkdownReport(result: PerformanceComparisonResult): string {
    let report = `# ⚡ Performance Regression Report\n\n`;
    
    // 总体性能
    report += `## Overall Performance\n\n`;
    report += `**Baseline Total**: ${result.overall.baselineTotalDuration}ms\n`;
    report += `**Current Total**: ${result.overall.currentTotalDuration}ms\n`;
    report += `**Change**: ${result.overall.changePercentage > 0 ? '+' : ''}${result.overall.changePercentage}%`;
    report += result.overall.improved ? ' ✅\n\n' : ' ⚠️\n\n';

    // 关键回归
    if (result.stats.criticalRegressions > 0) {
      report += `## 🔴 Critical Regressions (${result.stats.criticalRegressions})\n\n`;
      
      const critical = result.regressions.filter(r => r.severity === 'critical');
      for (const reg of critical) {
        report += `### ${reg.test}\n`;
        report += `- **Baseline**: ${reg.baselineDuration}ms\n`;
        report += `- **Current**: ${reg.currentDuration}ms\n`;
        report += `- **Slowdown**: ${reg.slowdownPercentage} (${reg.slowdownRatio.toFixed(2)}x)\n`;
        report += `- **Diff**: +${reg.absoluteDiff}ms\n\n`;
      }
    }

    // 警告级回归
    const warnings = result.regressions.filter(r => r.severity === 'warning');
    if (warnings.length > 0) {
      report += `## ⚠️  Warning Regressions (${warnings.length})\n\n`;
      
      for (const reg of warnings.slice(0, 10)) {
        report += `- **${reg.test}**: ${reg.baselineDuration}ms → ${reg.currentDuration}ms (${reg.slowdownPercentage})\n`;
      }
      
      if (warnings.length > 10) {
        report += `\n... and ${warnings.length - 10} more\n`;
      }
      
      report += `\n`;
    }

    // 性能改进
    if (result.improvements.length > 0) {
      report += `## ✅ Performance Improvements (${result.improvements.length})\n\n`;
      
      for (const imp of result.improvements.slice(0, 5)) {
        report += `- **${imp.test}**: ${imp.baselineDuration}ms → ${imp.currentDuration}ms (${imp.speedupPercentage} faster)\n`;
      }
      
      report += `\n`;
    }

    // 统计
    report += `## 📊 Statistics\n\n`;
    report += `- **Total Tests**: ${result.stats.totalTests}\n`;
    report += `- **Regressed**: ${result.stats.regressedTests}\n`;
    report += `- **Improved**: ${result.stats.improvedTests}\n`;
    report += `- **Unchanged**: ${result.stats.unchangedTests}\n`;

    return report;
  }

  /**
   * 加载测试运行数据
   */
  private async loadTestRun(filePath: string): Promise<TestRun> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);

      // Jest/Vitest 格式转换
      if (data.testResults) {
        return this.convertJestFormat(data);
      }

      // 直接格式
      return data as TestRun;
    } catch (error) {
      throw new Error(`Failed to load test run: ${error}`);
    }
  }

  /**
   * 转换 Jest 格式
   */
  private convertJestFormat(jestReport: any): TestRun {
    const tests: TestPerformance[] = [];
    let totalDuration = 0;

    for (const testResult of jestReport.testResults || []) {
      for (const assertion of testResult.assertionResults || []) {
        const duration = assertion.duration || 0;
        totalDuration += duration;

        tests.push({
          name: assertion.fullName || assertion.title,
          file: testResult.name,
          duration,
          passed: assertion.status === 'passed',
        });
      }
    }

    return {
      timestamp: new Date().toISOString(),
      totalDuration,
      tests,
    };
  }

  /**
   * 计算严重程度
   */
  private calculateSeverity(ratio: number): 'critical' | 'warning' | 'minor' {
    if (ratio >= this.config.criticalThreshold) {
      return 'critical';
    } else if (ratio >= this.config.regressionThreshold * 1.5) {
      return 'warning';
    } else {
      return 'minor';
    }
  }

  /**
   * 生成可视化图表数据（用于前端展示）
   */
  generateChartData(result: PerformanceComparisonResult): {
    labels: string[];
    baseline: number[];
    current: number[];
  } {
    // 取前 20 个最慢的测试
    const slowestTests = result.regressions
      .sort((a, b) => b.currentDuration - a.currentDuration)
      .slice(0, 20);

    return {
      labels: slowestTests.map(r => r.test),
      baseline: slowestTests.map(r => r.baselineDuration),
      current: slowestTests.map(r => r.currentDuration),
    };
  }
}

/**
 * 便捷工厂函数
 */
export function createPerformanceMonitor(config?: PerformanceMonitorConfig): PerformanceMonitor {
  return new PerformanceMonitor(config);
}


