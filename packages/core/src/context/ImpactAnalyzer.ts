/**
 * ImpactAnalyzer - Analyze the impact of code changes
 * 
 * Features:
 * - Predict which modules/functions will be affected by changes
 * - Calculate change impact scope
 * - Identify critical paths in dependency graph
 * - Suggest affected test files
 * - Risk assessment for changes
 */

import { DependencyGraphBuilder } from './DependencyGraphBuilder';
import { createComponentLogger } from '../utils/logger';
import * as path from 'path';

const logger = createComponentLogger('ImpactAnalyzer');

// ============================================================================
// Types
// ============================================================================

export interface ImpactAnalysis {
  changedFiles: string[];
  directImpact: ImpactedFile[];
  transitiveImpact: ImpactedFile[];
  affectedTests: string[];
  criticalPaths: CriticalPath[];
  riskScore: number; // 0-100
  riskFactors: RiskFactor[];
  recommendations: string[];
}

export interface ImpactedFile {
  filePath: string;
  impactLevel: 'direct' | 'transitive';
  distance: number; // Hops from changed file
  dependencyType: 'import' | 'function-call' | 'type-reference';
  criticalityScore: number; // How critical is this file
}

export interface CriticalPath {
  path: string[]; // From changed file to critical component
  reason: string; // Why this path is critical
  components: string[]; // Key components along the path
}

export interface RiskFactor {
  type: 'high-fan-out' | 'circular-dependency' | 'core-module' | 'no-tests' | 'complex-file' | 'external-api';
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  affectedFiles: string[];
}

export interface ChangeImpactReport {
  summary: string;
  impactAnalysis: ImpactAnalysis;
  visualizations: {
    impactTree: string; // Mermaid diagram
    riskHeatmap: string; // Visual representation of risk
  };
  actionItems: ActionItem[];
}

export interface ActionItem {
  priority: 'high' | 'medium' | 'low';
  action: string;
  rationale: string;
  estimatedEffort?: string;
}

// ============================================================================
// Impact Analyzer
// ============================================================================

export class ImpactAnalyzer {
  constructor(private dependencyGraph: DependencyGraphBuilder) {}

  /**
   * Analyze impact of changes to specified files
   */
  async analyzeImpact(changedFiles: string[]): Promise<ImpactAnalysis> {
    logger.info('Analyzing impact', { changedFileCount: changedFiles.length });

    const directImpact = await this.analyzeDirectImpact(changedFiles);
    const transitiveImpact = await this.analyzeTransitiveImpact(changedFiles);
    const affectedTests = await this.findAffectedTests(changedFiles, directImpact, transitiveImpact);
    const criticalPaths = await this.identifyCriticalPaths(changedFiles);
    const riskFactors = await this.assessRiskFactors(changedFiles, directImpact, transitiveImpact);
    const riskScore = this.calculateRiskScore(riskFactors);
    const recommendations = this.generateRecommendations(riskFactors, affectedTests);

    return {
      changedFiles,
      directImpact,
      transitiveImpact,
      affectedTests,
      criticalPaths,
      riskScore,
      riskFactors,
      recommendations,
    };
  }

  /**
   * Generate a comprehensive change impact report
   */
  async generateImpactReport(changedFiles: string[]): Promise<ChangeImpactReport> {
    const impactAnalysis = await this.analyzeImpact(changedFiles);

    return {
      summary: this.generateSummary(impactAnalysis),
      impactAnalysis,
      visualizations: {
        impactTree: this.generateImpactTree(impactAnalysis),
        riskHeatmap: this.generateRiskHeatmap(impactAnalysis),
      },
      actionItems: this.generateActionItems(impactAnalysis),
    };
  }

  /**
   * Analyze files directly importing/calling changed files
   */
  private async analyzeDirectImpact(changedFiles: string[]): Promise<ImpactedFile[]> {
    const impactedFiles: ImpactedFile[] = [];
    const seen = new Set<string>();

    for (const file of changedFiles) {
      const callers = await this.dependencyGraph.getFunctionCallers(file, '');
      
      for (const caller of callers) {
        if (!seen.has(caller) && !changedFiles.includes(caller)) {
          seen.add(caller);
          impactedFiles.push({
            filePath: caller,
            impactLevel: 'direct',
            distance: 1,
            dependencyType: 'import',
            criticalityScore: await this.calculateCriticality(caller),
          });
        }
      }
    }

    // Sort by criticality
    impactedFiles.sort((a, b) => b.criticalityScore - a.criticalityScore);

    return impactedFiles;
  }

  /**
   * Analyze transitive impact (dependencies of dependencies)
   */
  private async analyzeTransitiveImpact(changedFiles: string[]): Promise<ImpactedFile[]> {
    const impactedFiles: ImpactedFile[] = [];
    const seen = new Set<string>(changedFiles);

    // BFS to find all affected files
    const queue: Array<{ file: string; distance: number }> = changedFiles.map(f => ({ file: f, distance: 0 }));
    const maxDistance = 3; // Limit transitive depth

    while (queue.length > 0) {
      const { file, distance } = queue.shift()!;

      if (distance >= maxDistance) continue;

      const callers = await this.dependencyGraph.getFunctionCallers(file, '');

      for (const caller of callers) {
        if (!seen.has(caller)) {
          seen.add(caller);
          
          impactedFiles.push({
            filePath: caller,
            impactLevel: 'transitive',
            distance: distance + 1,
            dependencyType: 'import',
            criticalityScore: await this.calculateCriticality(caller),
          });

          queue.push({ file: caller, distance: distance + 1 });
        }
      }
    }

    // Sort by distance (closest first) and criticality
    impactedFiles.sort((a, b) => {
      if (a.distance !== b.distance) return a.distance - b.distance;
      return b.criticalityScore - a.criticalityScore;
    });

    return impactedFiles;
  }

  /**
   * Calculate criticality score for a file
   * Higher score = more critical
   */
  private async calculateCriticality(filePath: string): Promise<number> {
    let score = 0;

    // Factor 1: Number of dependents (fan-out)
    const dependents = await this.dependencyGraph.getFunctionCallers(filePath, '');
    score += Math.min(dependents.length * 10, 50); // Max 50 points

    // Factor 2: Is it in critical directories?
    const criticalDirs = ['src/core', 'src/api', 'src/auth', 'lib', 'core'];
    if (criticalDirs.some(dir => filePath.includes(dir))) {
      score += 20;
    }

    // Factor 3: File name indicates importance
    const criticalFiles = ['index', 'main', 'app', 'config', 'constants'];
    const fileName = path.basename(filePath, path.extname(filePath));
    if (criticalFiles.includes(fileName.toLowerCase())) {
      score += 15;
    }

    // Factor 4: Exported utilities
    if (filePath.includes('utils') || filePath.includes('helpers') || filePath.includes('shared')) {
      score += 10;
    }

    return Math.min(score, 100);
  }

  /**
   * Find test files that should be run for changed files
   */
  private async findAffectedTests(
    changedFiles: string[],
    directImpact: ImpactedFile[],
    transitiveImpact: ImpactedFile[]
  ): Promise<string[]> {
    const affectedTests = new Set<string>();

    // Test files for changed files
    for (const file of changedFiles) {
      const testFile = this.getTestFilePath(file);
      if (testFile) {
        affectedTests.add(testFile);
      }
    }

    // Test files for directly impacted files
    for (const impacted of directImpact) {
      const testFile = this.getTestFilePath(impacted.filePath);
      if (testFile) {
        affectedTests.add(testFile);
      }
    }

    // For high-criticality transitive impacts, include their tests too
    for (const impacted of transitiveImpact) {
      if (impacted.criticalityScore >= 70) {
        const testFile = this.getTestFilePath(impacted.filePath);
        if (testFile) {
          affectedTests.add(testFile);
        }
      }
    }

    return Array.from(affectedTests);
  }

  /**
   * Get test file path for a source file
   */
  private getTestFilePath(filePath: string): string | null {
    const ext = path.extname(filePath);
    const base = filePath.replace(ext, '');

    // Common test file patterns
    const patterns = [
      `${base}.test${ext}`,
      `${base}.spec${ext}`,
      `${base.replace('/src/', '/__tests__/')}.test${ext}`,
      `${base.replace('/src/', '/tests/')}.test${ext}`,
    ];

    // For now, just return the most common pattern
    // In real implementation, would check if file exists
    return patterns[0];
  }

  /**
   * Identify critical paths from changed files to important components
   */
  private async identifyCriticalPaths(changedFiles: string[]): Promise<CriticalPath[]> {
    const criticalPaths: CriticalPath[] = [];

    for (const file of changedFiles) {
      // Check for circular dependencies
      const cycles = this.dependencyGraph.detectCircularDependencies(file);
      
      for (const cycle of cycles) {
        criticalPaths.push({
          path: cycle,
          reason: 'Circular dependency detected',
          components: cycle,
        });
      }

      // Check for paths to core modules
      const transitiveDeps = this.dependencyGraph.getTransitiveDependencies(file, 5);
      const corePaths: string[] = [];
      
      for (const dep of transitiveDeps) {
        if (dep.includes('/core/') || dep.includes('/api/') || dep.includes('/auth/')) {
          corePaths.push(dep);
        }
      }

      if (corePaths.length > 0) {
        criticalPaths.push({
          path: [file, ...corePaths],
          reason: 'Affects core system components',
          components: corePaths,
        });
      }
    }

    return criticalPaths;
  }

  /**
   * Assess risk factors for the changes
   */
  private async assessRiskFactors(
    changedFiles: string[],
    directImpact: ImpactedFile[],
    transitiveImpact: ImpactedFile[]
  ): Promise<RiskFactor[]> {
    const riskFactors: RiskFactor[] = [];

    // Risk 1: High fan-out (many files depend on changed files)
    if (directImpact.length > 10) {
      riskFactors.push({
        type: 'high-fan-out',
        description: `${directImpact.length} files directly depend on changed files`,
        severity: directImpact.length > 20 ? 'critical' : 'high',
        affectedFiles: directImpact.slice(0, 10).map(f => f.filePath),
      });
    }

    // Risk 2: Circular dependencies
    const circularDeps = changedFiles.flatMap(f =>
      this.dependencyGraph.detectCircularDependencies(f)
    );
    
    if (circularDeps.length > 0) {
      riskFactors.push({
        type: 'circular-dependency',
        description: `${circularDeps.length} circular dependency paths detected`,
        severity: 'high',
        affectedFiles: circularDeps.flat(),
      });
    }

    // Risk 3: Changes to core modules
    const coreChanges = changedFiles.filter(f =>
      f.includes('/core/') || f.includes('/api/') || f.includes('/auth/')
    );

    if (coreChanges.length > 0) {
      riskFactors.push({
        type: 'core-module',
        description: `${coreChanges.length} core module(s) modified`,
        severity: 'high',
        affectedFiles: coreChanges,
      });
    }

    // Risk 4: No test coverage
    const filesWithoutTests = changedFiles.filter(f => {
      const testFile = this.getTestFilePath(f);
      return testFile === null; // Simplified check
    });

    if (filesWithoutTests.length > 0) {
      riskFactors.push({
        type: 'no-tests',
        description: `${filesWithoutTests.length} changed file(s) lack test coverage`,
        severity: 'medium',
        affectedFiles: filesWithoutTests,
      });
    }

    return riskFactors;
  }

  /**
   * Calculate overall risk score
   */
  private calculateRiskScore(riskFactors: RiskFactor[]): number {
    let score = 0;

    const severityScores = {
      low: 10,
      medium: 25,
      high: 50,
      critical: 100,
    };

    for (const factor of riskFactors) {
      score += severityScores[factor.severity];
    }

    return Math.min(score, 100);
  }

  /**
   * Generate recommendations based on analysis
   */
  private generateRecommendations(riskFactors: RiskFactor[], affectedTests: string[]): string[] {
    const recommendations: string[] = [];

    // General recommendations
    recommendations.push(`Run ${affectedTests.length} affected test file(s) before merging`);

    // Risk-specific recommendations
    for (const factor of riskFactors) {
      switch (factor.type) {
        case 'high-fan-out':
          recommendations.push('Consider breaking down large modules to reduce coupling');
          recommendations.push('Add integration tests to verify cross-module behavior');
          break;

        case 'circular-dependency':
          recommendations.push('Refactor to eliminate circular dependencies');
          recommendations.push('Review module boundaries and responsibilities');
          break;

        case 'core-module':
          recommendations.push('Perform thorough manual testing of core functionality');
          recommendations.push('Consider feature flag or gradual rollout');
          break;

        case 'no-tests':
          recommendations.push('Add unit tests for modified files');
          recommendations.push('Improve test coverage before deploying');
          break;
      }
    }

    return Array.from(new Set(recommendations)); // Deduplicate
  }

  /**
   * Generate human-readable summary
   */
  private generateSummary(analysis: ImpactAnalysis): string {
    const totalImpact = analysis.directImpact.length + analysis.transitiveImpact.length;
    
    let summary = `Impact Analysis Summary:\n\n`;
    summary += `Changed Files: ${analysis.changedFiles.length}\n`;
    summary += `Direct Impact: ${analysis.directImpact.length} file(s)\n`;
    summary += `Transitive Impact: ${analysis.transitiveImpact.length} file(s)\n`;
    summary += `Total Affected: ${totalImpact} file(s)\n`;
    summary += `Affected Tests: ${analysis.affectedTests.length}\n`;
    summary += `Risk Score: ${analysis.riskScore}/100 (${this.getRiskLevel(analysis.riskScore)})\n\n`;
    
    if (analysis.riskFactors.length > 0) {
      summary += `Risk Factors:\n`;
      for (const factor of analysis.riskFactors) {
        summary += `  - [${factor.severity.toUpperCase()}] ${factor.description}\n`;
      }
    }

    return summary;
  }

  /**
   * Get risk level text
   */
  private getRiskLevel(score: number): string {
    if (score >= 75) return 'CRITICAL';
    if (score >= 50) return 'HIGH';
    if (score >= 25) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Generate impact tree visualization (Mermaid)
   */
  private generateImpactTree(analysis: ImpactAnalysis): string {
    let mermaid = 'graph TD\n';

    // Changed files (red)
    for (const file of analysis.changedFiles) {
      const label = path.basename(file);
      mermaid += `  ${this.sanitizeId(file)}["${label}"]:::changed\n`;
    }

    // Direct impact (orange)
    for (const impacted of analysis.directImpact.slice(0, 10)) {
      const label = path.basename(impacted.filePath);
      mermaid += `  ${this.sanitizeId(impacted.filePath)}["${label}"]:::direct\n`;
      
      // Find which changed file impacts this
      for (const changed of analysis.changedFiles) {
        mermaid += `  ${this.sanitizeId(changed)} --> ${this.sanitizeId(impacted.filePath)}\n`;
      }
    }

    // Styles
    mermaid += '\n  classDef changed fill:#ff6b6b\n';
    mermaid += '  classDef direct fill:#ffa94d\n';
    mermaid += '  classDef transitive fill:#74c0fc\n';

    return mermaid;
  }

  /**
   * Generate risk heatmap
   */
  private generateRiskHeatmap(analysis: ImpactAnalysis): string {
    // Simple text-based heatmap
    let heatmap = 'Risk Heatmap:\n\n';
    
    const allFiles = [
      ...analysis.directImpact,
      ...analysis.transitiveImpact,
    ].sort((a, b) => b.criticalityScore - a.criticalityScore);

    for (const file of allFiles.slice(0, 20)) {
      const bars = '█'.repeat(Math.floor(file.criticalityScore / 10));
      const spaces = '░'.repeat(10 - Math.floor(file.criticalityScore / 10));
      heatmap += `${path.basename(file.filePath).padEnd(30)} [${bars}${spaces}] ${file.criticalityScore}\n`;
    }

    return heatmap;
  }

  /**
   * Generate action items
   */
  private generateActionItems(analysis: ImpactAnalysis): ActionItem[] {
    const actionItems: ActionItem[] = [];

    // Critical risk factors require immediate action
    const criticalFactors = analysis.riskFactors.filter(f => f.severity === 'critical' || f.severity === 'high');
    
    for (const factor of criticalFactors) {
      switch (factor.type) {
        case 'circular-dependency':
          actionItems.push({
            priority: 'high',
            action: 'Eliminate circular dependencies before merging',
            rationale: 'Circular dependencies can cause runtime errors and make code hard to maintain',
            estimatedEffort: '2-4 hours',
          });
          break;

        case 'high-fan-out':
          actionItems.push({
            priority: 'high',
            action: 'Add integration tests for affected modules',
            rationale: 'Many modules depend on changed code, need comprehensive testing',
            estimatedEffort: '1-2 hours',
          });
          break;
      }
    }

    // Always run tests
    actionItems.push({
      priority: 'high',
      action: `Run ${analysis.affectedTests.length} affected test suite(s)`,
      rationale: 'Verify no regressions in dependent code',
      estimatedEffort: '10-30 minutes',
    });

    return actionItems;
  }

  /**
   * Sanitize ID for Mermaid diagrams
   */
  private sanitizeId(str: string): string {
    return str.replace(/[^a-zA-Z0-9]/g, '_');
  }
}

/**
 * Helper function to create impact analyzer
 */
export function createImpactAnalyzer(dependencyGraph: DependencyGraphBuilder): ImpactAnalyzer {
  return new ImpactAnalyzer(dependencyGraph);
}

