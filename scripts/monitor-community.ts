/**
 * 社区监控脚本
 * 
 * 监控GitHub活动并生成每日/每周报告
 */

import { execSync } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';

interface CommunityMetrics {
  date: string;
  stars: number;
  issues: {
    open: number;
    closed: number;
    newThisWeek: number;
  };
  pullRequests: {
    open: number;
    merged: number;
    newThisWeek: number;
  };
  discussions: {
    total: number;
    newThisWeek: number;
  };
  contributors: number;
}

class CommunityMonitor {
  private repoOwner = 'AlexZander-666';
  private repoName = 'TestMind';

  /**
   * 收集社区指标
   */
  async collectMetrics(): Promise<CommunityMetrics> {
    console.log('📊 收集社区指标...\n');

    const metrics: CommunityMetrics = {
      date: new Date().toISOString().split('T')[0],
      stars: await this.getStarCount(),
      issues: await this.getIssueStats(),
      pullRequests: await this.getPRStats(),
      discussions: await this.getDiscussionStats(),
      contributors: await this.getContributorCount()
    };

    return metrics;
  }

  /**
   * 获取Star数量
   */
  private async getStarCount(): Promise<number> {
    try {
      const result = this.exec(`gh api repos/${this.repoOwner}/${this.repoName} --jq .stargazers_count`);
      return parseInt(result.trim(), 10);
    } catch {
      return 0;
    }
  }

  /**
   * 获取Issue统计
   */
  private async getIssueStats() {
    try {
      const openIssues = this.exec(`gh issue list --limit 1000 --json state --jq '. | length'`);
      const closedIssues = this.exec(`gh issue list --state closed --limit 1000 --json state --jq '. | length'`);
      
      // 本周新建的Issues
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      const newThisWeek = this.exec(
        `gh issue list --search "created:>=${oneWeekAgo.toISOString().split('T')[0]}" --json number --jq '. | length'`
      );

      return {
        open: parseInt(openIssues.trim(), 10),
        closed: parseInt(closedIssues.trim(), 10),
        newThisWeek: parseInt(newThisWeek.trim(), 10)
      };
    } catch {
      return { open: 0, closed: 0, newThisWeek: 0 };
    }
  }

  /**
   * 获取PR统计
   */
  private async getPRStats() {
    try {
      const openPRs = this.exec(`gh pr list --limit 1000 --json state --jq '. | length'`);
      const mergedPRs = this.exec(`gh pr list --state merged --limit 1000 --json state --jq '. | length'`);
      
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      const newThisWeek = this.exec(
        `gh pr list --search "created:>=${oneWeekAgo.toISOString().split('T')[0]}" --json number --jq '. | length'`
      );

      return {
        open: parseInt(openPRs.trim(), 10),
        merged: parseInt(mergedPRs.trim(), 10),
        newThisWeek: parseInt(newThisWeek.trim(), 10)
      };
    } catch {
      return { open: 0, merged: 0, newThisWeek: 0 };
    }
  }

  /**
   * 获取Discussion统计
   */
  private async getDiscussionStats() {
    try {
      // Discussions需要GraphQL API
      const result = this.exec(`gh api graphql -f query='
        query($owner: String!, $repo: String!) {
          repository(owner: $owner, name: $repo) {
            discussions(first: 100) {
              totalCount
            }
          }
        }' -f owner=${this.repoOwner} -f repo=${this.repoName} --jq .data.repository.discussions.totalCount`);

      return {
        total: parseInt(result.trim(), 10) || 0,
        newThisWeek: 0 // TODO: 实现本周统计
      };
    } catch {
      return { total: 0, newThisWeek: 0 };
    }
  }

  /**
   * 获取贡献者数量
   */
  private async getContributorCount(): Promise<number> {
    try {
      const result = this.exec(`gh api repos/${this.repoOwner}/${this.repoName}/contributors --jq '. | length'`);
      return parseInt(result.trim(), 10);
    } catch {
      return 1; // 至少有你自己
    }
  }

  /**
   * 生成每日报告
   */
  generateDailyReport(metrics: CommunityMetrics): string {
    return `# TestMind Community Daily Report

**Date**: ${metrics.date}

## 📊 Key Metrics

- **GitHub Stars**: ${metrics.stars} ⭐
- **Contributors**: ${metrics.contributors} 👥

## 🐛 Issues

- Open: ${metrics.issues.open}
- Closed: ${metrics.issues.closed}
- **New this week**: ${metrics.issues.newThisWeek}

## 🔄 Pull Requests

- Open: ${metrics.pullRequests.open}
- Merged: ${metrics.pullRequests.merged}
- **New this week**: ${metrics.pullRequests.newThisWeek}

## 💬 Discussions

- Total: ${metrics.discussions.total}
- **New this week**: ${metrics.discussions.newThisWeek}

## 🎯 Action Items

${metrics.issues.newThisWeek > 0 ? `- ⚠️ Review ${metrics.issues.newThisWeek} new issue(s)` : '- ✅ No new issues'}
${metrics.pullRequests.newThisWeek > 0 ? `- ⚠️ Review ${metrics.pullRequests.newThisWeek} new PR(s)` : '- ✅ No new PRs'}

## 📈 Growth

${metrics.stars >= 100 ? '✅' : '⏳'} GitHub Stars milestone (${metrics.stars}/100)
${metrics.contributors >= 3 ? '✅' : '⏳'} Contributors milestone (${metrics.contributors}/3)

---

*Generated automatically by monitor-community.ts*
`;
  }

  /**
   * 执行命令
   */
  private exec(command: string): string {
    return execSync(command, { encoding: 'utf-8' });
  }

  /**
   * 保存报告
   */
  async saveReport(report: string, filename: string): Promise<void> {
    const reportsDir = path.join(__dirname, '../.community-reports');
    await fs.mkdir(reportsDir, { recursive: true });
    
    const reportPath = path.join(reportsDir, filename);
    await fs.writeFile(reportPath, report, 'utf-8');
    
    console.log(`✅ Report saved: ${reportPath}\n`);
  }
}

/**
 * 主执行函数
 */
async function main() {
  console.log('\n🔍 TestMind Community Monitor\n');
  console.log('═'.repeat(60));

  const monitor = new CommunityMonitor();

  try {
    // 收集指标
    const metrics = await monitor.collectMetrics();

    console.log('\n📊 Current Metrics:\n');
    console.log(`  Stars: ${metrics.stars} ⭐`);
    console.log(`  Open Issues: ${metrics.issues.open}`);
    console.log(`  New Issues (7d): ${metrics.issues.newThisWeek}`);
    console.log(`  Open PRs: ${metrics.pullRequests.open}`);
    console.log(`  Contributors: ${metrics.contributors}\n`);

    // 生成报告
    const report = monitor.generateDailyReport(metrics);
    
    const filename = `daily-${metrics.date}.md`;
    await monitor.saveReport(report, filename);

    console.log('═'.repeat(60));
    console.log('✅ Monitoring complete!\n');

  } catch (error) {
    console.error('\n❌ Monitoring failed:', error);
    console.error('\nNote: This script requires GitHub CLI (gh) to be installed and authenticated.\n');
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { CommunityMonitor, CommunityMetrics };

