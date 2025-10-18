/**
 * Issue Classification and Prioritization Tool
 * 
 * Purpose: Automatically classify and prioritize issues discovered during testing
 * Framework: 4.md System Thinking + Impact Analysis
 * 
 * Classification:
 * - Severity: Critical/High/Medium/Low (based on keywords and impact)
 * - Priority: P0/P1/P2/P3 (based on severity × frequency)
 * - Category: Performance/Quality/UX/Documentation/etc
 */

import path from 'path';
import fs from 'fs/promises';

interface Issue {
  id: string;
  description: string;
  severity?: 'Critical' | 'High' | 'Medium' | 'Low';
  category?: string;
  frequency?: number; // how many projects encountered
  impact?: string;
  effortEstimate?: number; // hours
}

interface ClassifiedIssue extends Issue {
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  category: string;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  recommendedAction: string;
  estimatedEffort: number;
}

class IssueClassifier {
  /**
   * Classify issue severity based on keywords and impact
   */
  classifySeverity(issue: Issue): 'Critical' | 'High' | 'Medium' | 'Low' {
    if (issue.severity) {
      return issue.severity; // Use manual classification if provided
    }

    const desc = issue.description.toLowerCase();

    // Critical: System broken, cannot use
    const criticalKeywords = [
      'crash', 'hang', 'fail completely', 'broken', 'cannot use',
      'not working', 'error', 'exception', 'fatal',
    ];
    if (this.containsAny(desc, criticalKeywords)) {
      return 'Critical';
    }

    // High: Significant impact on usability
    const highKeywords = [
      'very slow', 'confusing', 'unclear', 'difficult',
      'frustrating', 'wrong result', 'incorrect', 'missing',
    ];
    if (this.containsAny(desc, highKeywords)) {
      return 'High';
    }

    // Medium: Noticeable but tolerable
    const mediumKeywords = [
      'slightly slow', 'could be better', 'not ideal',
      'minor issue', 'improvement needed',
    ];
    if (this.containsAny(desc, mediumKeywords)) {
      return 'Medium';
    }

    // Low: Minor annoyance
    return 'Low';
  }

  /**
   * Classify issue category
   */
  classifyCategory(issue: Issue): string {
    if (issue.category) {
      return issue.category;
    }

    const desc = issue.description.toLowerCase();

    if (this.containsAny(desc, ['slow', 'performance', 'speed', 'time'])) {
      return 'Performance';
    }
    if (this.containsAny(desc, ['quality', 'incorrect', 'wrong', 'bad test'])) {
      return 'Quality';
    }
    if (this.containsAny(desc, ['confusing', 'unclear', 'difficult', 'ux', 'ui'])) {
      return 'UX';
    }
    if (this.containsAny(desc, ['documentation', 'doc', 'guide', 'help'])) {
      return 'Documentation';
    }
    if (this.containsAny(desc, ['install', 'setup', 'config'])) {
      return 'Onboarding';
    }
    if (this.containsAny(desc, ['error message', 'error handling'])) {
      return 'Error Handling';
    }

    return 'Other';
  }

  /**
   * Calculate priority based on severity × frequency
   */
  calculatePriority(severity: string, frequency: number): 'P0' | 'P1' | 'P2' | 'P3' {
    const severityWeight = { Critical: 4, High: 3, Medium: 2, Low: 1 };
    const weight = severityWeight[severity as keyof typeof severityWeight] || 1;
    const score = weight * frequency;

    // P0: Critical issues (any frequency) or High issues in 2+ projects
    if (severity === 'Critical' || (severity === 'High' && frequency >= 2)) {
      return 'P0';
    }

    // P1: High issues (1 project) or Medium issues in 2+ projects
    if (severity === 'High' || (severity === 'Medium' && frequency >= 2)) {
      return 'P1';
    }

    // P2: Medium issues (1 project) or Low issues in 2+ projects
    if (severity === 'Medium' || (severity === 'Low' && frequency >= 2)) {
      return 'P2';
    }

    // P3: Low issues (1 project)
    return 'P3';
  }

  /**
   * Estimate fix effort based on category and severity
   */
  estimateEffort(category: string, severity: string): number {
    const baseEffort = {
      'Performance': 4,
      'Quality': 6,
      'UX': 2,
      'Documentation': 1,
      'Onboarding': 2,
      'Error Handling': 3,
      'Other': 3,
    }[category] || 3;

    const severityMultiplier = {
      'Critical': 1.5,
      'High': 1.2,
      'Medium': 1.0,
      'Low': 0.5,
    }[severity] || 1;

    return Math.ceil(baseEffort * severityMultiplier);
  }

  /**
   * Recommend action based on priority
   */
  recommendAction(priority: string, severity: string): string {
    if (priority === 'P0') {
      return severity === 'Critical' 
        ? '立即修复（不管多久）- 阻碍使用'
        : '2小时内修复或明确plan - 显著影响体验';
    }
    if (priority === 'P1') {
      return '本周修复 - 改善用户体验';
    }
    if (priority === 'P2') {
      return 'Week 9-10修复 - 持续改进';
    }
    return 'Month 3考虑 - 低优先级优化';
  }

  /**
   * Classify and prioritize a list of issues
   */
  classifyAll(issues: Issue[]): ClassifiedIssue[] {
    return issues.map(issue => {
      const severity = this.classifySeverity(issue);
      const category = this.classifyCategory(issue);
      const frequency = issue.frequency || 1;
      const priority = this.calculatePriority(severity, frequency);
      const estimatedEffort = issue.effortEstimate || this.estimateEffort(category, severity);
      const recommendedAction = this.recommendAction(priority, severity);

      return {
        ...issue,
        severity,
        category,
        frequency,
        priority,
        estimatedEffort,
        recommendedAction,
      };
    });
  }

  /**
   * Prioritize issues for fixing
   */
  prioritize(issues: ClassifiedIssue[]): {
    p0: ClassifiedIssue[];
    p1: ClassifiedIssue[];
    p2: ClassifiedIssue[];
    p3: ClassifiedIssue[];
  } {
    return {
      p0: issues.filter(i => i.priority === 'P0').sort((a, b) => 
        (a.severity === 'Critical' ? 0 : 1) - (b.severity === 'Critical' ? 0 : 1)
      ),
      p1: issues.filter(i => i.priority === 'P1'),
      p2: issues.filter(i => i.priority === 'P2'),
      p3: issues.filter(i => i.priority === 'P3'),
    };
  }

  /**
   * Generate fix plan
   */
  generateFixPlan(issues: ClassifiedIssue[]): string {
    const prioritized = this.prioritize(issues);
    const lines: string[] = [];

    lines.push('# Issue Fix Plan');
    lines.push('');
    lines.push('**Generated:** ' + new Date().toISOString());
    lines.push('**Total Issues:** ' + issues.length);
    lines.push('');

    const totalEffort = {
      p0: prioritized.p0.reduce((sum, i) => sum + i.estimatedEffort, 0),
      p1: prioritized.p1.reduce((sum, i) => sum + i.estimatedEffort, 0),
      p2: prioritized.p2.reduce((sum, i) => sum + i.estimatedEffort, 0),
      p3: prioritized.p3.reduce((sum, i) => sum + i.estimatedEffort, 0),
    };

    lines.push('## Summary');
    lines.push('');
    lines.push('| Priority | Count | Total Effort | Timeline |');
    lines.push('|----------|-------|--------------|----------|');
    lines.push(`| P0 (Critical) | ${prioritized.p0.length} | ${totalEffort.p0}h | Week 8 Day 5 |`);
    lines.push(`| P1 (High) | ${prioritized.p1.length} | ${totalEffort.p1}h | Week 8-9 |`);
    lines.push(`| P2 (Medium) | ${prioritized.p2.length} | ${totalEffort.p2}h | Week 9-10 |`);
    lines.push(`| P3 (Low) | ${prioritized.p3.length} | ${totalEffort.p3}h | Month 3 |`);
    lines.push('');

    // P0 Issues (Critical)
    if (prioritized.p0.length > 0) {
      lines.push('## P0 Issues (立即修复)');
      lines.push('');
      prioritized.p0.forEach((issue, index) => {
        lines.push(`### ${index + 1}. [${issue.severity}] ${issue.description}`);
        lines.push('');
        lines.push(`- **Category:** ${issue.category}`);
        lines.push(`- **Frequency:** ${issue.frequency} project(s)`);
        lines.push(`- **Effort:** ${issue.estimatedEffort}h`);
        lines.push(`- **Action:** ${issue.recommendedAction}`);
        lines.push('');
      });
    }

    // P1 Issues
    if (prioritized.p1.length > 0) {
      lines.push('## P1 Issues (本周修复)');
      lines.push('');
      prioritized.p1.forEach((issue, index) => {
        lines.push(`${index + 1}. **[${issue.category}]** ${issue.description}`);
        lines.push(`   - Effort: ${issue.estimatedEffort}h, Frequency: ${issue.frequency}x`);
      });
      lines.push('');
    }

    // P2/P3 summary
    if (prioritized.p2.length > 0) {
      lines.push(`## P2 Issues (${prioritized.p2.length} items, ${totalEffort.p2}h total)`);
      lines.push('');
      lines.push('_Record in backlog, address in Week 9-10._');
      lines.push('');
    }

    if (prioritized.p3.length > 0) {
      lines.push(`## P3 Issues (${prioritized.p3.length} items, ${totalEffort.p3}h total)`);
      lines.push('');
      lines.push('_Record in backlog, address if time permits in Month 3._');
      lines.push('');
    }

    return lines.join('\n');
  }

  private containsAny(text: string, keywords: string[]): boolean {
    return keywords.some(keyword => text.includes(keyword));
  }
}

// Demo execution
async function main() {
  console.log('Issue Classifier Demo');
  console.log('='.repeat(70));
  console.log();

  const classifier = new IssueClassifier();

  // Example issues
  const rawIssues: Issue[] = [
    {
      id: '1',
      description: 'Application crashes when analyzing large files',
      frequency: 2,
    },
    {
      id: '2',
      description: 'Type推断对复杂泛型不准确',
      frequency: 1,
    },
    {
      id: '3',
      description: 'Config文件格式说明不够清晰',
      frequency: 1,
    },
    {
      id: '4',
      description: '大项目分析较慢（30+ seconds）',
      frequency: 2,
    },
    {
      id: '5',
      description: 'Error messages are confusing',
      frequency: 3,
    },
  ];

  // Classify
  const classified = classifier.classifyAll(rawIssues);
  
  console.log('Classified Issues:');
  console.log();
  classified.forEach(issue => {
    console.log(`[${issue.priority}] [${issue.severity}] ${issue.description}`);
    console.log(`  Category: ${issue.category}`);
    console.log(`  Frequency: ${issue.frequency} project(s)`);
    console.log(`  Effort: ${issue.estimatedEffort}h`);
    console.log(`  Action: ${issue.recommendedAction}`);
    console.log();
  });

  // Generate fix plan
  const fixPlan = classifier.generateFixPlan(classified);
  const planPath = path.join(__dirname, '../ISSUE_FIX_PLAN.md');
  await fs.writeFile(planPath, fixPlan, 'utf-8');
  
  console.log(`Fix plan saved to: ISSUE_FIX_PLAN.md`);
}

if (require.main === module) {
  main();
}

export { IssueClassifier, type Issue, type ClassifiedIssue };

