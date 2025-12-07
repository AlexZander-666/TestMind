/**
 * CI/CD CoverageAnalyzer adapter
 *
 * Delegates core analysis to evaluation/CoverageAnalyzer and adds CI-friendly outputs.
 */
import type { CoverageSummary } from '../evaluation/CoverageAnalyzer';
import { CoverageAnalyzer as BaseCoverageAnalyzer } from '../evaluation/CoverageAnalyzer';

export interface CIReport {
  summary: CoverageSummary | undefined;
  exitCode: number;
  badge: string;
}

export class CoverageAnalyzer extends BaseCoverageAnalyzer {
  /**
   * Generate CI-friendly coverage report with badge and exit code.
   */
  async generateCIReport(projectId: string): Promise<CIReport> {
    const baseReport = await this.analyzeCoverage(projectId, [], []);

    const lineCoverage = baseReport.summary?.lineCoverage ?? 0;
    return {
      summary: baseReport.summary,
      exitCode: lineCoverage >= 80 ? 0 : 1,
      badge: this.generateBadge(lineCoverage),
    };
  }

  private generateBadge(lineCoverage: number): string {
    const rounded = Math.round(lineCoverage);
    const color = rounded >= 90 ? 'brightgreen' : rounded >= 80 ? 'green' : 'orange';
    return `![coverage](https://img.shields.io/badge/coverage-${rounded}%25-${color})`;
  }
}
