/**
 * CoverageAnalyzer - 高级测试覆盖率分析器
 * 
 * 功能特性：
 * 1. 行覆盖率计算
 * 2. 分支覆盖率分析
 * 3. 函数覆盖率统计
 * 4. 路径覆盖率追踪
 * 5. 覆盖率热图生成
 * 6. 覆盖率趋势分析
 * 7. 未覆盖代码建议
 */

import type { CodeFile, TestSuite, TestCase, FunctionContext } from '@testmind/shared';
import { createComponentLogger } from '../utils/logger';
import { DatabaseService } from '../db/Database';
import { StaticAnalyzer } from '../context/StaticAnalyzer';
import { generateUUID } from '@testmind/shared';

const logger = createComponentLogger('CoverageAnalyzer');

export interface CoverageReport {
  id: string;
  projectId: string;
  timestamp: Date;
  summary: CoverageSummary;
  files: FileCoverage[];
  uncoveredFunctions: UncoveredFunction[];
  recommendations: CoverageRecommendation[];
  trends: CoverageTrend[];
}

export interface CoverageSummary {
  lineCoverage: number;
  branchCoverage: number;
  functionCoverage: number;
  statementCoverage: number;
  totalLines: number;
  coveredLines: number;
  totalBranches: number;
  coveredBranches: number;
  totalFunctions: number;
  coveredFunctions: number;
  totalStatements: number;
  coveredStatements: number;
}

export interface FileCoverage {
  filePath: string;
  lineCoverage: number;
  branchCoverage: number;
  functionCoverage: number;
  lines: LineCoverage[];
  branches: BranchCoverage[];
  functions: FunctionCoverage[];
  uncoveredRegions: CodeRegion[];
}

export interface LineCoverage {
  lineNumber: number;
  executed: boolean;
  hitCount: number;
}

export interface BranchCoverage {
  branchId: string;
  lineNumber: number;
  type: 'if' | 'switch' | 'ternary' | 'logical';
  covered: boolean;
  branches: {
    taken: boolean;
    hitCount: number;
  }[];
}

export interface FunctionCoverage {
  name: string;
  startLine: number;
  endLine: number;
  executed: boolean;
  hitCount: number;
  complexity: number;
}

export interface CodeRegion {
  startLine: number;
  endLine: number;
  startColumn: number;
  endColumn: number;
  type: 'function' | 'branch' | 'statement';
  reason: string;
}

export interface UncoveredFunction {
  name: string;
  filePath: string;
  startLine: number;
  endLine: number;
  complexity: number;
  importance: 'critical' | 'high' | 'medium' | 'low';
  suggestedTests: string[];
}

export interface CoverageRecommendation {
  type: 'add-test' | 'improve-test' | 'refactor-code';
  priority: 'high' | 'medium' | 'low';
  description: string;
  targetFile?: string;
  targetFunction?: string;
  estimatedImpact: number;
}

export interface CoverageTrend {
  date: Date;
  lineCoverage: number;
  branchCoverage: number;
  functionCoverage: number;
}

export interface CoverageHeatmap {
  filePath: string;
  heatmap: number[][];
  maxHitCount: number;
  minHitCount: number;
}

export class CoverageAnalyzer {
  private db: DatabaseService;
  private staticAnalyzer: StaticAnalyzer;
  private coverageHistory: Map<string, CoverageReport[]> = new Map();
  
  constructor(db: DatabaseService, staticAnalyzer: StaticAnalyzer) {
    this.db = db;
    this.staticAnalyzer = staticAnalyzer;
    logger.info('CoverageAnalyzer initialized');
  }

  /**
   * 分析测试覆盖率
   */
  async analyzeCoverage(
    projectId: string,
    testSuites: TestSuite[],
    codeFiles: CodeFile[]
  ): Promise<CoverageReport> {
    const startTime = Date.now();
    logger.info('Starting coverage analysis', {
      projectId,
      testSuiteCount: testSuites.length,
      codeFileCount: codeFiles.length
    });

    // Collect execution data
    const executionData = await this.collectExecutionData(testSuites);

    // Analyze each file
    const fileCoverages: FileCoverage[] = [];
    const uncoveredFunctions: UncoveredFunction[] = [];

    for (const file of codeFiles) {
      const fileCoverage = await this.analyzeFileCoverage(file, executionData);
      fileCoverages.push(fileCoverage);

      // Identify uncovered functions
      const uncovered = this.identifyUncoveredFunctions(file, fileCoverage);
      uncoveredFunctions.push(...uncovered);
    }

    // Calculate summary
    const summary = this.calculateSummary(fileCoverages);

    // Generate recommendations
    const recommendations = await this.generateRecommendations(
      summary,
      uncoveredFunctions,
      fileCoverages
    );

    // Analyze trends
    const trends = await this.analyzeTrends(projectId);

    const report: CoverageReport = {
      id: generateUUID(),
      projectId,
      timestamp: new Date(),
      summary,
      files: fileCoverages,
      uncoveredFunctions,
      recommendations,
      trends
    };

    // Store report
    await this.storeCoverageReport(report);

    logger.info('Coverage analysis complete', {
      projectId,
      lineCoverage: summary.lineCoverage,
      branchCoverage: summary.branchCoverage,
      functionCoverage: summary.functionCoverage,
      duration: Date.now() - startTime
    });

    return report;
  }

  /**
   * 收集测试执行数据
   */
  private async collectExecutionData(testSuites: TestSuite[]): Promise<ExecutionData> {
    const executionData: ExecutionData = {
      executedLines: new Map(),
      executedBranches: new Map(),
      executedFunctions: new Set(),
      hitCounts: new Map()
    };

    for (const suite of testSuites) {
      // Simulate collecting execution data from test runs
      // In real implementation, this would integrate with test runners
      if (suite.metadata?.coverage) {
        this.mergeExecutionData(executionData, suite.metadata.coverage);
      }
    }

    return executionData;
  }

  /**
   * 分析单个文件的覆盖率
   */
  private async analyzeFileCoverage(
    file: CodeFile,
    executionData: ExecutionData
  ): Promise<FileCoverage> {
    const lines: LineCoverage[] = [];
    const branches: BranchCoverage[] = [];
    const functions: FunctionCoverage[] = [];
    const uncoveredRegions: CodeRegion[] = [];

    // Analyze line coverage
    const fileLines = file.content.split('\n');
    for (let i = 0; i < fileLines.length; i++) {
      const lineNumber = i + 1;
      const executed = executionData.executedLines.get(file.filePath)?.has(lineNumber) || false;
      const hitCount = executionData.hitCounts.get(`${file.filePath}:${lineNumber}`) || 0;

      lines.push({
        lineNumber,
        executed,
        hitCount
      });

      // Track uncovered regions
      if (!executed && this.isExecutableLine(fileLines[i])) {
        const region = this.findCodeRegion(file, lineNumber);
        if (region) {
          uncoveredRegions.push(region);
        }
      }
    }

    // Analyze function coverage
    for (const func of file.astData.functions) {
      const funcKey = `${file.filePath}:${func.name}`;
      const executed = executionData.executedFunctions.has(funcKey);
      const hitCount = executionData.hitCounts.get(funcKey) || 0;

      functions.push({
        name: func.name,
        startLine: func.startLine,
        endLine: func.endLine,
        executed,
        hitCount,
        complexity: await this.calculateComplexity(func)
      });
    }

    // Analyze branch coverage
    const branchData = await this.analyzeBranches(file);
    for (const branch of branchData) {
      const branchKey = `${file.filePath}:${branch.branchId}`;
      const covered = executionData.executedBranches.get(branchKey) || false;

      branches.push({
        ...branch,
        covered
      });
    }

    // Calculate file-level metrics
    const lineCoverage = this.calculateLineCoverage(lines);
    const branchCoverage = this.calculateBranchCoverage(branches);
    const functionCoverage = this.calculateFunctionCoverage(functions);

    return {
      filePath: file.filePath,
      lineCoverage,
      branchCoverage,
      functionCoverage,
      lines,
      branches,
      functions,
      uncoveredRegions
    };
  }

  /**
   * 计算行覆盖率
   */
  private calculateLineCoverage(lines: LineCoverage[]): number {
    const executableLines = lines.filter(l => this.isExecutableLineNumber(l.lineNumber));
    if (executableLines.length === 0) return 100;

    const coveredLines = executableLines.filter(l => l.executed).length;
    return Math.round((coveredLines / executableLines.length) * 100);
  }

  /**
   * 计算分支覆盖率
   */
  private calculateBranchCoverage(branches: BranchCoverage[]): number {
    if (branches.length === 0) return 100;

    const coveredBranches = branches.filter(b => b.covered).length;
    return Math.round((coveredBranches / branches.length) * 100);
  }

  /**
   * 计算函数覆盖率
   */
  private calculateFunctionCoverage(functions: FunctionCoverage[]): number {
    if (functions.length === 0) return 100;

    const coveredFunctions = functions.filter(f => f.executed).length;
    return Math.round((coveredFunctions / functions.length) * 100);
  }

  /**
   * 识别未覆盖的函数
   */
  private identifyUncoveredFunctions(
    file: CodeFile,
    coverage: FileCoverage
  ): UncoveredFunction[] {
    const uncovered: UncoveredFunction[] = [];

    for (const func of coverage.functions) {
      if (!func.executed) {
        const importance = this.assessFunctionImportance(func, file);
        const suggestedTests = this.suggestTestsForFunction(func, file);

        uncovered.push({
          name: func.name,
          filePath: file.filePath,
          startLine: func.startLine,
          endLine: func.endLine,
          complexity: func.complexity,
          importance,
          suggestedTests
        });
      }
    }

    return uncovered;
  }

  /**
   * 评估函数重要性
   */
  private assessFunctionImportance(
    func: FunctionCoverage,
    file: CodeFile
  ): 'critical' | 'high' | 'medium' | 'low' {
    // Critical: Public API or exported functions
    const funcNode = file.astData.functions.find(f => f.name === func.name);
    if (funcNode?.isExported) {
      return 'critical';
    }

    // High: High complexity functions
    if (func.complexity > 10) {
      return 'high';
    }

    // Medium: Moderate complexity
    if (func.complexity > 5) {
      return 'medium';
    }

    // Low: Simple functions
    return 'low';
  }

  /**
   * 为函数建议测试
   */
  private suggestTestsForFunction(
    func: FunctionCoverage,
    file: CodeFile
  ): string[] {
    const suggestions: string[] = [];

    // Basic test
    suggestions.push(`Test ${func.name} with valid inputs`);

    // Edge cases
    if (func.complexity > 3) {
      suggestions.push(`Test ${func.name} with edge cases`);
    }

    // Error handling
    const funcNode = file.astData.functions.find(f => f.name === func.name);
    if (funcNode?.throws) {
      suggestions.push(`Test ${func.name} error handling`);
    }

    // Null/undefined handling
    suggestions.push(`Test ${func.name} with null/undefined inputs`);

    return suggestions;
  }

  /**
   * 计算汇总统计
   */
  private calculateSummary(fileCoverages: FileCoverage[]): CoverageSummary {
    let totalLines = 0;
    let coveredLines = 0;
    let totalBranches = 0;
    let coveredBranches = 0;
    let totalFunctions = 0;
    let coveredFunctions = 0;
    let totalStatements = 0;
    let coveredStatements = 0;

    for (const file of fileCoverages) {
      // Lines
      const executableLines = file.lines.filter(l => 
        this.isExecutableLineNumber(l.lineNumber)
      );
      totalLines += executableLines.length;
      coveredLines += executableLines.filter(l => l.executed).length;

      // Branches
      totalBranches += file.branches.length;
      coveredBranches += file.branches.filter(b => b.covered).length;

      // Functions
      totalFunctions += file.functions.length;
      coveredFunctions += file.functions.filter(f => f.executed).length;

      // Statements (approximation)
      totalStatements += executableLines.length;
      coveredStatements += executableLines.filter(l => l.executed).length;
    }

    return {
      lineCoverage: totalLines > 0 ? Math.round((coveredLines / totalLines) * 100) : 100,
      branchCoverage: totalBranches > 0 ? Math.round((coveredBranches / totalBranches) * 100) : 100,
      functionCoverage: totalFunctions > 0 ? Math.round((coveredFunctions / totalFunctions) * 100) : 100,
      statementCoverage: totalStatements > 0 ? Math.round((coveredStatements / totalStatements) * 100) : 100,
      totalLines,
      coveredLines,
      totalBranches,
      coveredBranches,
      totalFunctions,
      coveredFunctions,
      totalStatements,
      coveredStatements
    };
  }

  /**
   * 生成覆盖率改进建议
   */
  private async generateRecommendations(
    summary: CoverageSummary,
    uncoveredFunctions: UncoveredFunction[],
    fileCoverages: FileCoverage[]
  ): Promise<CoverageRecommendation[]> {
    const recommendations: CoverageRecommendation[] = [];

    // Recommend tests for critical uncovered functions
    for (const func of uncoveredFunctions) {
      if (func.importance === 'critical' || func.importance === 'high') {
        recommendations.push({
          type: 'add-test',
          priority: 'high',
          description: `Add tests for function "${func.name}" with complexity ${func.complexity}`,
          targetFile: func.filePath,
          targetFunction: func.name,
          estimatedImpact: func.complexity * 2 // Rough estimate
        });
      }
    }

    // Recommend improving low coverage files
    for (const file of fileCoverages) {
      if (file.lineCoverage < 50) {
        recommendations.push({
          type: 'improve-test',
          priority: 'medium',
          description: `Improve test coverage for ${file.filePath} (currently ${file.lineCoverage}%)`,
          targetFile: file.filePath,
          estimatedImpact: 100 - file.lineCoverage
        });
      }
    }

    // Recommend refactoring complex uncovered code
    for (const func of uncoveredFunctions) {
      if (func.complexity > 15) {
        recommendations.push({
          type: 'refactor-code',
          priority: 'medium',
          description: `Consider refactoring complex function "${func.name}" (complexity: ${func.complexity})`,
          targetFile: func.filePath,
          targetFunction: func.name,
          estimatedImpact: func.complexity
        });
      }
    }

    // Sort by priority and impact
    recommendations.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return b.estimatedImpact - a.estimatedImpact;
    });

    return recommendations.slice(0, 10); // Top 10 recommendations
  }

  /**
   * 分析覆盖率趋势
   */
  private async analyzeTrends(projectId: string): Promise<CoverageTrend[]> {
    const history = this.coverageHistory.get(projectId) || [];
    
    return history.slice(-30).map(report => ({
      date: report.timestamp,
      lineCoverage: report.summary.lineCoverage,
      branchCoverage: report.summary.branchCoverage,
      functionCoverage: report.summary.functionCoverage
    }));
  }

  /**
   * 生成覆盖率热图
   */
  async generateHeatmap(filePath: string, coverage: FileCoverage): Promise<CoverageHeatmap> {
    const lines = coverage.lines;
    const maxLine = Math.max(...lines.map(l => l.lineNumber));
    const heatmap: number[][] = [];

    // Create heatmap grid (10 lines per row for visualization)
    const rowSize = 10;
    const rows = Math.ceil(maxLine / rowSize);

    for (let row = 0; row < rows; row++) {
      const rowData: number[] = [];
      for (let col = 0; col < rowSize; col++) {
        const lineNumber = row * rowSize + col + 1;
        const line = lines.find(l => l.lineNumber === lineNumber);
        rowData.push(line ? line.hitCount : -1); // -1 for non-executable
      }
      heatmap.push(rowData);
    }

    const hitCounts = lines.filter(l => l.hitCount > 0).map(l => l.hitCount);
    const maxHitCount = hitCounts.length > 0 ? Math.max(...hitCounts) : 0;
    const minHitCount = hitCounts.length > 0 ? Math.min(...hitCounts) : 0;

    return {
      filePath,
      heatmap,
      maxHitCount,
      minHitCount
    };
  }

  /**
   * 比较两次覆盖率报告
   */
  async compareCoverage(
    reportId1: string,
    reportId2: string
  ): Promise<CoverageComparison> {
    // In real implementation, fetch reports from database
    const report1 = await this.getCoverageReport(reportId1);
    const report2 = await this.getCoverageReport(reportId2);

    if (!report1 || !report2) {
      throw new Error('Coverage reports not found');
    }

    const lineDiff = report2.summary.lineCoverage - report1.summary.lineCoverage;
    const branchDiff = report2.summary.branchCoverage - report1.summary.branchCoverage;
    const functionDiff = report2.summary.functionCoverage - report1.summary.functionCoverage;

    const newUncovered = report2.uncoveredFunctions.filter(f2 =>
      !report1.uncoveredFunctions.some(f1 => 
        f1.name === f2.name && f1.filePath === f2.filePath
      )
    );

    const nowCovered = report1.uncoveredFunctions.filter(f1 =>
      !report2.uncoveredFunctions.some(f2 => 
        f1.name === f2.name && f1.filePath === f2.filePath
      )
    );

    return {
      report1Id: reportId1,
      report2Id: reportId2,
      lineCoverageDiff: lineDiff,
      branchCoverageDiff: branchDiff,
      functionCoverageDiff: functionDiff,
      improved: lineDiff > 0,
      newUncoveredFunctions: newUncovered,
      nowCoveredFunctions: nowCovered
    };
  }

  /**
   * Helper methods
   */
  private isExecutableLine(line: string): boolean {
    const trimmed = line.trim();
    return trimmed.length > 0 &&
           !trimmed.startsWith('//') &&
           !trimmed.startsWith('/*') &&
           !trimmed.startsWith('*') &&
           trimmed !== '{' &&
           trimmed !== '}';
  }

  private isExecutableLineNumber(lineNumber: number): boolean {
    // Simplified check - in real implementation would use AST
    return lineNumber > 0;
  }

  private findCodeRegion(file: CodeFile, lineNumber: number): CodeRegion | null {
    // Find the code region for uncovered line
    for (const func of file.astData.functions) {
      if (lineNumber >= func.startLine && lineNumber <= func.endLine) {
        return {
          startLine: func.startLine,
          endLine: func.endLine,
          startColumn: 0,
          endColumn: 0,
          type: 'function',
          reason: `Function ${func.name} is not covered`
        };
      }
    }
    return null;
  }

  private async calculateComplexity(func: any): Promise<number> {
    // Simplified complexity calculation
    return func.complexity || 5;
  }

  private async analyzeBranches(file: CodeFile): Promise<BranchCoverage[]> {
    // Simplified branch analysis
    const branches: BranchCoverage[] = [];
    let branchId = 0;

    const lines = file.content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes('if') || line.includes('else')) {
        branches.push({
          branchId: `branch-${branchId++}`,
          lineNumber: i + 1,
          type: 'if',
          covered: false,
          branches: [
            { taken: false, hitCount: 0 },
            { taken: false, hitCount: 0 }
          ]
        });
      }
    }

    return branches;
  }

  private mergeExecutionData(target: ExecutionData, source: any): void {
    // Merge execution data from test coverage
    // Implementation would parse actual coverage data
  }

  private async storeCoverageReport(report: CoverageReport): Promise<void> {
    // Store report in database
    const history = this.coverageHistory.get(report.projectId) || [];
    history.push(report);
    this.coverageHistory.set(report.projectId, history);
    
    // In real implementation, would save to database
    logger.debug('Coverage report stored', { reportId: report.id });
  }

  private async getCoverageReport(reportId: string): Promise<CoverageReport | null> {
    // In real implementation, fetch from database
    for (const reports of this.coverageHistory.values()) {
      const report = reports.find(r => r.id === reportId);
      if (report) return report;
    }
    return null;
  }
}

// Supporting interfaces
interface ExecutionData {
  executedLines: Map<string, Set<number>>;
  executedBranches: Map<string, boolean>;
  executedFunctions: Set<string>;
  hitCounts: Map<string, number>;
}

interface CoverageComparison {
  report1Id: string;
  report2Id: string;
  lineCoverageDiff: number;
  branchCoverageDiff: number;
  functionCoverageDiff: number;
  improved: boolean;
  newUncoveredFunctions: UncoveredFunction[];
  nowCoveredFunctions: UncoveredFunction[];
}
