/**
 * Dogfooding Data Analysis Tool
 * 
 * Purpose: Automatically analyze WEEK_8_DOGFOODING_REPORT.md and make Go/No-Go decision
 * Framework: 4.md Data-Driven Decision Making
 * 
 * Usage:
 *   1. Fill WEEK_8_DOGFOODING_REPORT.md with Dogfooding data
 *   2. Run: pnpm tsx scripts/analyze-dogfooding-data.ts
 *   3. Get: Alpha Go/No-Go recommendation based on data
 */

import fs from 'fs/promises';
import path from 'path';

interface ProjectData {
  name: string;
  size: 'Small' | 'Medium' | 'Large';
  timeToValue: number; // minutes
  satisfaction: number; // 1-5
  installEase: number; // 1-5
  configEase: number; // 1-5
  generationSpeed: number; // 1-5
  generationQuality: number; // 1-5
  wouldRecommend: boolean;
  issues: {
    severity: 'Critical' | 'High' | 'Medium' | 'Low';
    description: string;
    frequency: number; // how many projects encountered this
  }[];
}

interface DogfoodingAnalysis {
  summary: {
    projectsCompleted: number;
    avgTimeToValue: number;
    avgSatisfaction: number;
    recommendationRate: number;
  };
  issues: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    topIssues: { description: string; frequency: number; severity: string }[];
  };
  decision: {
    result: 'GO' | 'GO_WITH_FIXES' | 'NO_GO';
    reasoning: string[];
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
    nextActions: string[];
  };
  metrics: {
    timeToValuePass: boolean;
    satisfactionPass: boolean;
    recommendationPass: boolean;
    noCriticalIssues: boolean;
    overallPass: boolean;
  };
}

class DogfoodingAnalyzer {
  private data: ProjectData[] = [];

  /**
   * Parse Dogfooding data (manual input or from structured report)
   */
  loadData(projects: ProjectData[]): void {
    this.data = projects;
  }

  /**
   * Analyze all data and make Go/No-Go recommendation
   */
  analyze(): DogfoodingAnalysis {
    console.log('='.repeat(70));
    console.log('Dogfooding Data Analysis');
    console.log('='.repeat(70));
    console.log();

    // Calculate summary metrics
    const summary = this.calculateSummary();
    
    // Analyze issues
    const issues = this.analyzeIssues();
    
    // Evaluate metrics against thresholds
    const metrics = this.evaluateMetrics(summary, issues);
    
    // Make decision
    const decision = this.makeDecision(metrics, summary, issues);

    const analysis: DogfoodingAnalysis = {
      summary,
      issues,
      metrics,
      decision,
    };

    this.printReport(analysis);

    return analysis;
  }

  private calculateSummary() {
    const avgTimeToValue = this.average(this.data.map(p => p.timeToValue));
    const avgSatisfaction = this.average(this.data.map(p => p.satisfaction));
    const recommendCount = this.data.filter(p => p.wouldRecommend).length;
    const recommendationRate = recommendCount / this.data.length;

    return {
      projectsCompleted: this.data.length,
      avgTimeToValue,
      avgSatisfaction,
      recommendationRate,
    };
  }

  private analyzeIssues() {
    const allIssues = this.data.flatMap(p => p.issues);
    
    // Count by severity
    const critical = allIssues.filter(i => i.severity === 'Critical').length;
    const high = allIssues.filter(i => i.severity === 'High').length;
    const medium = allIssues.filter(i => i.severity === 'Medium').length;
    const low = allIssues.filter(i => i.severity === 'Low').length;

    // Find top issues by frequency
    const issueMap = new Map<string, { count: number; severity: string }>();
    for (const issue of allIssues) {
      const key = issue.description.toLowerCase().trim();
      if (issueMap.has(key)) {
        issueMap.get(key)!.count++;
      } else {
        issueMap.set(key, { count: 1, severity: issue.severity });
      }
    }

    const topIssues = Array.from(issueMap.entries())
      .map(([description, data]) => ({
        description,
        frequency: data.count,
        severity: data.severity,
      }))
      .sort((a, b) => {
        // Sort by severity (Critical > High > Medium > Low) then frequency
        const severityWeight = { Critical: 4, High: 3, Medium: 2, Low: 1 };
        const aScore = severityWeight[a.severity as keyof typeof severityWeight] * 10 + a.frequency;
        const bScore = severityWeight[b.severity as keyof typeof severityWeight] * 10 + b.frequency;
        return bScore - aScore;
      })
      .slice(0, 5); // Top 5

    return {
      critical,
      high,
      medium,
      low,
      topIssues,
    };
  }

  private evaluateMetrics(summary: any, issues: any) {
    // Thresholds from user-validation-plan.md
    const timeToValuePass = summary.avgTimeToValue <= 15; // ≤15 minutes
    const satisfactionPass = summary.avgSatisfaction >= 4.0; // ≥4.0/5
    const recommendationPass = summary.recommendationRate >= 0.7; // ≥70%
    const noCriticalIssues = issues.critical === 0; // 0 critical issues

    const passCount = [
      timeToValuePass,
      satisfactionPass,
      recommendationPass,
      noCriticalIssues,
    ].filter(Boolean).length;

    const overallPass = passCount >= 3; // 3/4 or better

    return {
      timeToValuePass,
      satisfactionPass,
      recommendationPass,
      noCriticalIssues,
      overallPass,
    };
  }

  private makeDecision(metrics: any, summary: any, issues: any) {
    const passCount = Object.values(metrics).filter(v => v === true).length - 1; // -1 for overallPass

    let result: 'GO' | 'GO_WITH_FIXES' | 'NO_GO';
    let reasoning: string[] = [];
    let confidence: 'HIGH' | 'MEDIUM' | 'LOW';
    let nextActions: string[] = [];

    if (passCount === 4) {
      // All metrics pass
      result = 'GO';
      confidence = 'HIGH';
      reasoning = [
        `✅ Time-to-value: ${summary.avgTimeToValue.toFixed(1)}分钟 ≤ 15分钟目标`,
        `✅ 满意度: ${summary.avgSatisfaction.toFixed(1)}/5 ≥ 4.0目标`,
        `✅ 推荐率: ${(summary.recommendationRate * 100).toFixed(0)}% ≥ 70%目标`,
        `✅ Critical问题: ${issues.critical}个 = 0目标`,
        '',
        '所有核心指标达标，产品已准备好进入Alpha测试。',
      ];
      nextActions = [
        'Week 9: 开始Alpha用户招募（目标5-10人）',
        '准备Onboarding Kit（email/指南/问卷）',
        '建立Discord支持渠道',
        '制定密切支持计划（每日check-in）',
      ];
    } else if (passCount === 3) {
      // 3/4 pass
      result = 'GO_WITH_FIXES';
      confidence = 'MEDIUM';
      
      const failedMetrics = [];
      if (!metrics.timeToValuePass) {
        failedMetrics.push(`⚠️ Time-to-value: ${summary.avgTimeToValue.toFixed(1)}分钟 > 15分钟`);
      }
      if (!metrics.satisfactionPass) {
        failedMetrics.push(`⚠️ 满意度: ${summary.avgSatisfaction.toFixed(1)}/5 < 4.0`);
      }
      if (!metrics.recommendationPass) {
        failedMetrics.push(`⚠️ 推荐率: ${(summary.recommendationRate * 100).toFixed(0)}% < 70%`);
      }
      if (!metrics.noCriticalIssues) {
        failedMetrics.push(`⚠️ Critical问题: ${issues.critical}个 > 0`);
      }

      reasoning = [
        ...failedMetrics,
        '',
        '大部分指标达标，但有1个关键指标未通过。',
        '建议：快速修复后进入Alpha（延后2-3天）。',
      ];

      nextActions = [
        '优先修复未达标的指标',
        `修复Top ${Math.min(3, issues.high + issues.critical)}个High/Critical问题`,
        '重新验证（mini dogfooding或单项测试）',
        '2-3天后进入Alpha',
      ];
    } else {
      // ≤2/4 pass
      result = 'NO_GO';
      confidence = issues.critical > 0 ? 'HIGH' : 'MEDIUM';
      
      reasoning = [
        `❌ 仅${passCount}/4核心指标达标`,
        '',
        '产品尚未准备好面对外部用户。',
        '建议：延后Alpha 1周，专注解决核心问题。',
        '',
        '原则（4.md）：质量>速度，不要给用户糟糕的第一印象。',
      ];

      nextActions = [
        'Week 8延长至Week 9：全力修复问题',
        `优先修复${issues.critical + issues.high}个Critical/High问题`,
        '如果是架构性问题，考虑重新设计',
        '修复后重新Dogfooding验证',
        'Week 10再评估Alpha readiness',
      ];
    }

    return { result, reasoning, confidence, nextActions };
  }

  private printReport(analysis: DogfoodingAnalysis): void {
    console.log('Summary Metrics:');
    console.log('-'.repeat(70));
    console.log(`Projects completed: ${analysis.summary.projectsCompleted}`);
    console.log(`Avg Time-to-value: ${analysis.summary.avgTimeToValue.toFixed(1)} minutes`);
    console.log(`Avg Satisfaction: ${analysis.summary.avgSatisfaction.toFixed(1)}/5`);
    console.log(`Recommendation rate: ${(analysis.summary.recommendationRate * 100).toFixed(0)}%`);
    console.log();

    console.log('Issues Breakdown:');
    console.log('-'.repeat(70));
    console.log(`Critical: ${analysis.issues.critical}`);
    console.log(`High: ${analysis.issues.high}`);
    console.log(`Medium: ${analysis.issues.medium}`);
    console.log(`Low: ${analysis.issues.low}`);
    console.log();

    if (analysis.issues.topIssues.length > 0) {
      console.log('Top Issues:');
      analysis.issues.topIssues.forEach((issue, index) => {
        console.log(`  ${index + 1}. [${issue.severity}] ${issue.description} (${issue.frequency}个项目)`);
      });
      console.log();
    }

    console.log('Metrics Evaluation:');
    console.log('-'.repeat(70));
    console.log(`Time-to-value ≤15分钟: ${analysis.metrics.timeToValuePass ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Satisfaction ≥4.0/5: ${analysis.metrics.satisfactionPass ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Recommendation ≥70%: ${analysis.metrics.recommendationPass ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`No Critical Issues: ${analysis.metrics.noCriticalIssues ? '✅ PASS' : '❌ FAIL'}`);
    console.log();

    console.log('='.repeat(70));
    console.log('ALPHA GO/NO-GO DECISION');
    console.log('='.repeat(70));
    console.log();

    const symbol = {
      'GO': '✅ GO - Enter Alpha (Week 9)',
      'GO_WITH_FIXES': '⚠️ GO WITH FIXES - Fix then Alpha (2-3 days delay)',
      'NO_GO': '❌ NO-GO - Delay Alpha 1 week',
    }[analysis.decision.result];

    console.log(`Decision: ${symbol}`);
    console.log(`Confidence: ${analysis.decision.confidence}`);
    console.log();
    
    console.log('Reasoning:');
    analysis.decision.reasoning.forEach(reason => console.log(`  ${reason}`));
    console.log();
    
    console.log('Next Actions:');
    analysis.decision.nextActions.forEach((action, i) => console.log(`  ${i + 1}. ${action}`));
    console.log();
    console.log('='.repeat(70));
  }

  private average(numbers: number[]): number {
    return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
  }

  /**
   * Generate markdown report
   */
  generateReport(analysis: DogfoodingAnalysis): string {
    const lines: string[] = [];
    
    lines.push('# Dogfooding Data Analysis Report');
    lines.push('');
    lines.push(`**Generated:** ${new Date().toISOString()}`);
    lines.push(`**Framework:** 4.md Data-Driven Decision Making`);
    lines.push('');
    
    lines.push('## Summary Metrics');
    lines.push('');
    lines.push('| Metric | Value | Target | Status |');
    lines.push('|--------|-------|--------|--------|');
    lines.push(`| Projects Completed | ${analysis.summary.projectsCompleted} | 3 | ✅ |`);
    lines.push(`| Avg Time-to-Value | ${analysis.summary.avgTimeToValue.toFixed(1)} min | ≤15 min | ${analysis.metrics.timeToValuePass ? '✅' : '❌'} |`);
    lines.push(`| Avg Satisfaction | ${analysis.summary.avgSatisfaction.toFixed(1)}/5 | ≥4.0/5 | ${analysis.metrics.satisfactionPass ? '✅' : '❌'} |`);
    lines.push(`| Recommendation Rate | ${(analysis.summary.recommendationRate * 100).toFixed(0)}% | ≥70% | ${analysis.metrics.recommendationPass ? '✅' : '❌'} |`);
    lines.push('');
    
    lines.push('## Issues Analysis');
    lines.push('');
    lines.push('| Severity | Count | Status |');
    lines.push('|----------|-------|--------|');
    lines.push(`| Critical | ${analysis.issues.critical} | ${analysis.metrics.noCriticalIssues ? '✅' : '❌'} |`);
    lines.push(`| High | ${analysis.issues.high} | - |`);
    lines.push(`| Medium | ${analysis.issues.medium} | - |`);
    lines.push(`| Low | ${analysis.issues.low} | - |`);
    lines.push('');
    
    if (analysis.issues.topIssues.length > 0) {
      lines.push('### Top Issues (by severity × frequency)');
      lines.push('');
      analysis.issues.topIssues.forEach((issue, index) => {
        lines.push(`${index + 1}. **[${issue.severity}]** ${issue.description}`);
        lines.push(`   - Frequency: ${issue.frequency}/${analysis.summary.projectsCompleted} projects`);
        lines.push('');
      });
    }
    
    lines.push('## Decision');
    lines.push('');
    const decisionText = {
      'GO': '✅ **GO** - Enter Alpha Testing (Week 9)',
      'GO_WITH_FIXES': '⚠️ **GO WITH FIXES** - Fix critical issues then Alpha (2-3 days)',
      'NO_GO': '❌ **NO-GO** - Delay Alpha 1 week, focus on fixes',
    }[analysis.decision.result];
    
    lines.push(decisionText);
    lines.push('');
    lines.push(`**Confidence:** ${analysis.decision.confidence}`);
    lines.push('');
    
    lines.push('### Reasoning');
    lines.push('');
    analysis.decision.reasoning.forEach(reason => lines.push(`- ${reason}`));
    lines.push('');
    
    lines.push('### Next Actions');
    lines.push('');
    analysis.decision.nextActions.forEach((action, i) => lines.push(`${i + 1}. ${action}`));
    lines.push('');
    
    lines.push('## 4.md Principles Applied');
    lines.push('');
    lines.push('- ✅ **Data-Driven**: Decision based on quantitative metrics, not gut feeling');
    lines.push('- ✅ **User-First**: Real user experience (Dogfooding) drives decision');
    lines.push('- ✅ **Quality>Speed**: Willing to delay if quality not ready');
    lines.push('- ✅ **Fail Fast**: Clear thresholds to identify issues early');
    lines.push('');
    
    lines.push('---');
    lines.push('');
    lines.push('*This analysis follows 4.md data-driven and user-first principles.*');
    
    return lines.join('\n');
  }

  /**
   * Example data for testing
   */
  static getExampleData(): ProjectData[] {
    return [
      {
        name: '@testmind/shared',
        size: 'Small',
        timeToValue: 12, // minutes
        satisfaction: 4.5,
        installEase: 5,
        configEase: 4,
        generationSpeed: 5,
        generationQuality: 4,
        wouldRecommend: true,
        issues: [
          { severity: 'Low', description: 'Config文件格式说明不够清晰', frequency: 1 },
        ],
      },
      {
        name: 'date-fns',
        size: 'Medium',
        timeToValue: 18, // minutes (over target)
        satisfaction: 3.8, // below target
        installEase: 4,
        configEase: 3,
        generationSpeed: 4,
        generationQuality: 4,
        wouldRecommend: true,
        issues: [
          { severity: 'High', description: 'Type推断对复杂泛型不准确', frequency: 1 },
          { severity: 'Medium', description: '首次配置有点confusing', frequency: 1 },
        ],
      },
      {
        name: 'TestMind Core',
        size: 'Large',
        timeToValue: 25, // minutes (significantly over)
        satisfaction: 4.0,
        installEase: 5,
        configEase: 4,
        generationSpeed: 3,
        generationQuality: 4,
        wouldRecommend: false, // complexity concerns
        issues: [
          { severity: 'High', description: '大项目分析较慢（25秒）', frequency: 1 },
          { severity: 'Medium', description: 'Monorepo配置需要手动调整', frequency: 1 },
          { severity: 'Low', description: 'Progress indicator缺失', frequency: 1 },
        ],
      },
    ];
  }
}

// Main execution
async function main() {
  const analyzer = new DogfoodingAnalyzer();
  
  console.log('Dogfooding Data Analyzer');
  console.log('');
  console.log('NOTE: 这是示例数据演示。实际使用时：');
  console.log('1. 完成3个项目的Dogfooding测试');
  console.log('2. 填充WEEK_8_DOGFOODING_REPORT.md');
  console.log('3. 修改此脚本loadData()来读取实际数据');
  console.log('');
  console.log('按Enter继续演示...');
  console.log();
  
  // Use example data for demonstration
  const exampleData = DogfoodingAnalyzer.getExampleData();
  analyzer.loadData(exampleData);
  
  // Analyze
  const analysis = analyzer.analyze();
  
  // Generate report
  const report = analyzer.generateReport(analysis);
  const reportPath = path.join(__dirname, '../DOGFOODING_ANALYSIS_AUTO.md');
  await fs.writeFile(reportPath, report, 'utf-8');
  
  console.log(`Full report saved to: DOGFOODING_ANALYSIS_AUTO.md`);
  console.log();
  
  // Exit code based on decision
  const exitCode = {
    'GO': 0,
    'GO_WITH_FIXES': 1,
    'NO_GO': 2,
  }[analysis.decision.result];
  
  process.exit(exitCode);
}

if (require.main === module) {
  main();
}

export { DogfoodingAnalyzer, type DogfoodingAnalysis, type ProjectData };




