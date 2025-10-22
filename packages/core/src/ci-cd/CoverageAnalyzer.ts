/**
 * CoverageAnalyzer - 测试覆盖率缺口分析器
 * 
 * 功能：
 * 1. 解析 Istanbul/c8 覆盖率报告
 * 2. 识别未覆盖的函数
 * 3. 按重要性排序
 * 4. 使用 LLM 生成测试建议
 * 5. 生成优先级列表
 */

import type { LLMService } from '../llm/LLMService';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * 覆盖率数据（Istanbul 格式）
 */
export interface CoverageData {
  /** 总覆盖率 */
  total: {
    lines: { pct: number };
    statements: { pct: number };
    functions: { pct: number };
    branches: { pct: number };
  };
  
  /** 文件级覆盖率 */
  files: Record<string, FileCoverage>;
}

export interface FileCoverage {
  path: string;
  lines: { pct: number; covered: number; total: number };
  functions: { pct: number; covered: number; total: number };
  statements: { pct: number; covered: number; total: number };
  branches: { pct: number; covered: number; total: number };
  
  /** 未覆盖的行号 */
  uncoveredLines?: number[];
  
  /** 未覆盖的函数 */
  uncoveredFunctions?: UncoveredFunction[];
}

/**
 * 未覆盖的函数
 */
export interface UncoveredFunction {
  /** 函数名 */
  name: string;
  
  /** 所在文件 */
  filePath: string;
  
  /** 起始行号 */
  line: number;
  
  /** 圈复杂度 */
  complexity?: number;
  
  /** 是否公共 API */
  isPublic?: boolean;
  
  /** 被调用次数 */
  callSites?: string[];
  
  /** 最近是否修改 */
  recentlyModified?: boolean;
  
  /** 函数签名 */
  signature?: string;
}

/**
 * 测试建议
 */
export interface TestSuggestion {
  /** 目标函数 */
  function: UncoveredFunction;
  
  /** 建议的测试用例 */
  testCases: string[];
  
  /** Mock 需求 */
  mockRequirements: string[];
  
  /** 边界条件 */
  edgeCases: string[];
  
  /** 优先级分数 (0-100) */
  priority: number;
  
  /** 估算编写时间（分钟） */
  estimatedEffort?: number;
}

/**
 * 分析结果
 */
export interface CoverageAnalysisResult {
  /** 总覆盖率 */
  overallCoverage: number;
  
  /** 未覆盖函数总数 */
  totalUncovered: number;
  
  /** 高优先级建议 */
  highPriority: TestSuggestion[];
  
  /** 中优先级建议 */
  mediumPriority: TestSuggestion[];
  
  /** 低优先级建议 */
  lowPriority: TestSuggestion[];
  
  /** 统计信息 */
  stats: {
    totalFiles: number;
    uncoveredFiles: number;
    avgComplexity: number;
  };
}

/**
 * 覆盖率分析器
 */
export class CoverageAnalyzer {
  private llmService?: LLMService;

  constructor(llmService?: LLMService) {
    this.llmService = llmService;
  }

  /**
   * 分析覆盖率缺口
   */
  async analyzeCoverageGaps(
    coverageReportPath: string
  ): Promise<CoverageAnalysisResult> {
    console.log('[CoverageAnalyzer] Analyzing coverage gaps...');

    // 1. 解析覆盖率报告
    const coverageData = await this.parseCoverageReport(coverageReportPath);

    // 2. 提取未覆盖的函数
    const uncoveredFunctions = await this.extractUncoveredFunctions(coverageData);

    console.log(`[CoverageAnalyzer] Found ${uncoveredFunctions.length} uncovered functions`);

    // 3. 按优先级排序
    const prioritized = this.prioritizeFunctions(uncoveredFunctions);

    // 4. 生成测试建议（for top N functions）
    const suggestions = await this.generateTestSuggestions(
      prioritized.slice(0, 15) // 限制数量
    );

    // 5. 分类建议
    const highPriority = suggestions.filter(s => s.priority >= 80);
    const mediumPriority = suggestions.filter(s => s.priority >= 50 && s.priority < 80);
    const lowPriority = suggestions.filter(s => s.priority < 50);

    // 6. 计算统计
    const stats = this.calculateStats(coverageData, uncoveredFunctions);

    return {
      overallCoverage: coverageData.total.functions.pct,
      totalUncovered: uncoveredFunctions.length,
      highPriority,
      mediumPriority,
      lowPriority,
      stats,
    };
  }

  /**
   * 解析覆盖率报告
   */
  private async parseCoverageReport(reportPath: string): Promise<CoverageData> {
    try {
      const content = await fs.readFile(reportPath, 'utf-8');
      const report = JSON.parse(content);

      // Istanbul 格式
      if (report.total && report.files) {
        return report as CoverageData;
      }

      // c8 格式转换
      if (Array.isArray(report)) {
        return this.convertC8Format(report);
      }

      throw new Error('Unknown coverage report format');
    } catch (error) {
      throw new Error(`Failed to parse coverage report: ${error}`);
    }
  }

  /**
   * 转换 c8 格式
   */
  private convertC8Format(c8Report: any[]): CoverageData {
    // 简化实现
    const files: Record<string, FileCoverage> = {};
    
    for (const file of c8Report) {
      files[file.path] = {
        path: file.path,
        lines: { pct: file.lines.pct, covered: 0, total: 0 },
        functions: { pct: file.functions.pct, covered: 0, total: 0 },
        statements: { pct: file.statements.pct, covered: 0, total: 0 },
        branches: { pct: file.branches.pct, covered: 0, total: 0 },
      };
    }

    return {
      total: {
        lines: { pct: 0 },
        statements: { pct: 0 },
        functions: { pct: 0 },
        branches: { pct: 0 },
      },
      files,
    };
  }

  /**
   * 提取未覆盖的函数
   */
  private async extractUncoveredFunctions(
    coverageData: CoverageData
  ): Promise<UncoveredFunction[]> {
    const uncovered: UncoveredFunction[] = [];

    // 遍历每个文件
    for (const [filePath, fileCoverage] of Object.entries(coverageData.files)) {
      // 跳过测试文件
      if (this.isTestFile(filePath)) {
        continue;
      }

      // 如果有未覆盖的函数信息
      if (fileCoverage.uncoveredFunctions) {
        uncovered.push(...fileCoverage.uncoveredFunctions);
      } else {
        // 通过 AST 分析提取函数（如果报告中没有详细信息）
        const functions = await this.extractFunctionsFromFile(filePath, fileCoverage);
        uncovered.push(...functions);
      }
    }

    return uncovered;
  }

  /**
   * 从文件中提取函数（通过 AST）
   */
  private async extractFunctionsFromFile(
    filePath: string,
    coverage: FileCoverage
  ): Promise<UncoveredFunction[]> {
    // TODO: 使用 StaticAnalyzer 分析文件
    // 这里返回空数组，实际应该解析文件
    return [];
  }

  /**
   * 按优先级排序函数
   */
  private prioritizeFunctions(functions: UncoveredFunction[]): UncoveredFunction[] {
    return functions.sort((a, b) => {
      // 计算优先级分数
      const scoreA = this.calculatePriorityScore(a);
      const scoreB = this.calculatePriorityScore(b);
      
      return scoreB - scoreA;
    });
  }

  /**
   * 计算优先级分数
   */
  private calculatePriorityScore(fn: UncoveredFunction): number {
    let score = 0;

    // 1. 公共 API（权重最高）
    if (fn.isPublic) {
      score += 40;
    } else {
      score += 10;
    }

    // 2. 圈复杂度
    if (fn.complexity) {
      score += Math.min(20, fn.complexity * 2); // 最多 20 分
    }

    // 3. 被调用次数
    if (fn.callSites) {
      score += Math.min(20, fn.callSites.length * 4); // 最多 20 分
    }

    // 4. 最近修改
    if (fn.recentlyModified) {
      score += 20;
    }

    return Math.min(100, score);
  }

  /**
   * 生成测试建议
   */
  private async generateTestSuggestions(
    functions: UncoveredFunction[]
  ): Promise<TestSuggestion[]> {
    if (!this.llmService) {
      // 没有 LLM，返回基础建议
      return functions.map(fn => this.generateBasicSuggestion(fn));
    }

    const suggestions: TestSuggestion[] = [];

    for (const fn of functions) {
      try {
        const suggestion = await this.suggestTestForFunction(fn);
        suggestions.push(suggestion);
      } catch (error) {
        console.error(`[CoverageAnalyzer] Failed to generate suggestion for ${fn.name}:`, error);
        // 回退到基础建议
        suggestions.push(this.generateBasicSuggestion(fn));
      }
    }

    return suggestions;
  }

  /**
   * 为单个函数生成测试建议（使用 LLM）
   */
  private async suggestTestForFunction(
    fn: UncoveredFunction
  ): Promise<TestSuggestion> {
    const prompt = `Generate test suggestions for this uncovered function:

File: ${fn.filePath}
Function: ${fn.name}
Signature: ${fn.signature || 'N/A'}
Complexity: ${fn.complexity || 'Unknown'}
Is Public API: ${fn.isPublic ? 'Yes' : 'No'}
Call Sites: ${fn.callSites?.length || 0}

Please suggest:
1. **Test Cases** (3-5 key scenarios to test):
   - List specific test scenarios with expected outcomes

2. **Mocking Requirements**:
   - What dependencies/services need to be mocked
   - Mock data needed

3. **Edge Cases**:
   - Boundary conditions
   - Error scenarios
   - Special inputs

Respond in JSON format:
{
  "testCases": ["test case 1", "test case 2", ...],
  "mockRequirements": ["mock 1", "mock 2", ...],
  "edgeCases": ["edge case 1", "edge case 2", ...],
  "estimatedEffort": 15 // minutes
}`;

    const response = await this.llmService!.generate({
      provider: 'openai',
      model: 'gpt-4',
      prompt,
      temperature: 0.3,
      maxTokens: 500,
    });

    const parsed = this.parseLLMSuggestion(response.content);

    return {
      function: fn,
      testCases: parsed.testCases,
      mockRequirements: parsed.mockRequirements,
      edgeCases: parsed.edgeCases,
      priority: this.calculatePriorityScore(fn),
      estimatedEffort: parsed.estimatedEffort,
    };
  }

  /**
   * 解析 LLM 建议
   */
  private parseLLMSuggestion(content: string): {
    testCases: string[];
    mockRequirements: string[];
    edgeCases: string[];
    estimatedEffort: number;
  } {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          testCases: parsed.testCases || [],
          mockRequirements: parsed.mockRequirements || [],
          edgeCases: parsed.edgeCases || [],
          estimatedEffort: parsed.estimatedEffort || 15,
        };
      }
    } catch {
      // JSON 解析失败
    }

    // 回退：简单解析
    return {
      testCases: ['Test basic functionality', 'Test error handling'],
      mockRequirements: [],
      edgeCases: ['Test with null input', 'Test with invalid data'],
      estimatedEffort: 15,
    };
  }

  /**
   * 生成基础建议（无 LLM）
   */
  private generateBasicSuggestion(fn: UncoveredFunction): TestSuggestion {
    const testCases: string[] = [];
    const edgeCases: string[] = [];

    // 基于函数名推断测试场景
    if (fn.name.includes('get') || fn.name.includes('fetch')) {
      testCases.push('Test successful data retrieval');
      testCases.push('Test with invalid ID');
      edgeCases.push('Test when resource not found');
    }

    if (fn.name.includes('create') || fn.name.includes('save')) {
      testCases.push('Test creating with valid data');
      testCases.push('Test validation errors');
      edgeCases.push('Test duplicate creation');
    }

    if (fn.name.includes('update')) {
      testCases.push('Test updating existing record');
      testCases.push('Test updating non-existent record');
      edgeCases.push('Test concurrent updates');
    }

    if (fn.name.includes('delete')) {
      testCases.push('Test deleting existing record');
      testCases.push('Test deleting non-existent record');
      edgeCases.push('Test cascading deletes');
    }

    // 默认测试用例
    if (testCases.length === 0) {
      testCases.push('Test basic functionality');
      testCases.push('Test with valid input');
      testCases.push('Test with invalid input');
    }

    return {
      function: fn,
      testCases,
      mockRequirements: [],
      edgeCases: edgeCases.length > 0 ? edgeCases : ['Test edge cases', 'Test error handling'],
      priority: this.calculatePriorityScore(fn),
      estimatedEffort: 10 + (fn.complexity || 5) * 2, // 基于复杂度估算
    };
  }

  /**
   * 计算统计信息
   */
  private calculateStats(
    coverageData: CoverageData,
    uncoveredFunctions: UncoveredFunction[]
  ): {
    totalFiles: number;
    uncoveredFiles: number;
    avgComplexity: number;
  } {
    const totalFiles = Object.keys(coverageData.files).length;
    const uncoveredFiles = Object.values(coverageData.files).filter(
      f => f.functions.pct < 100
    ).length;

    const complexities = uncoveredFunctions
      .map(f => f.complexity || 0)
      .filter(c => c > 0);
    
    const avgComplexity = complexities.length > 0
      ? complexities.reduce((sum, c) => sum + c, 0) / complexities.length
      : 0;

    return {
      totalFiles,
      uncoveredFiles,
      avgComplexity: parseFloat(avgComplexity.toFixed(2)),
    };
  }

  /**
   * 生成 Markdown 报告
   */
  generateMarkdownReport(result: CoverageAnalysisResult): string {
    let report = `# 📊 Coverage Analysis Report\n\n`;
    
    report += `**Overall Coverage**: ${result.overallCoverage.toFixed(1)}%\n`;
    report += `**Uncovered Functions**: ${result.totalUncovered}\n`;
    report += `**Files**: ${result.stats.totalFiles} total, ${result.stats.uncoveredFiles} need improvement\n`;
    report += `**Avg Complexity**: ${result.stats.avgComplexity}\n\n`;

    // 高优先级
    if (result.highPriority.length > 0) {
      report += `## 🎯 High Priority (${result.highPriority.length})\n\n`;
      
      for (const suggestion of result.highPriority.slice(0, 5)) {
        report += `### ${suggestion.function.name}\n`;
        report += `**File**: \`${suggestion.function.filePath}\`\n`;
        report += `**Priority**: ${suggestion.priority}/100\n`;
        report += `**Estimated Effort**: ${suggestion.estimatedEffort || '?'} minutes\n\n`;
        
        report += `**Test Cases**:\n`;
        suggestion.testCases.forEach(tc => {
          report += `- ${tc}\n`;
        });
        
        if (suggestion.edgeCases.length > 0) {
          report += `\n**Edge Cases**:\n`;
          suggestion.edgeCases.forEach(ec => {
            report += `- ${ec}\n`;
          });
        }
        
        report += `\n`;
      }
    }

    // 中优先级
    if (result.mediumPriority.length > 0) {
      report += `## 📌 Medium Priority (${result.mediumPriority.length})\n\n`;
      
      for (const suggestion of result.mediumPriority.slice(0, 5)) {
        report += `- \`${suggestion.function.name}\` (${suggestion.function.filePath}): ${suggestion.testCases.join(', ')}\n`;
      }
      
      report += `\n`;
    }

    // 总结
    report += `## 💡 Recommendations\n\n`;
    report += `1. Focus on high priority functions first (higher risk/impact)\n`;
    report += `2. Estimated total effort: ${this.estimateTotalEffort(result)} hours\n`;
    report += `3. Target coverage: ${Math.min(95, result.overallCoverage + 10).toFixed(0)}%\n`;

    return report;
  }

  /**
   * 估算总工作量
   */
  private estimateTotalEffort(result: CoverageAnalysisResult): number {
    const totalMinutes = [
      ...result.highPriority,
      ...result.mediumPriority.slice(0, 10),
    ].reduce((sum, s) => sum + (s.estimatedEffort || 15), 0);

    return parseFloat((totalMinutes / 60).toFixed(1));
  }

  /**
   * 判断是否为测试文件
   */
  private isTestFile(filePath: string): boolean {
    return /\.(test|spec)\.(ts|js|tsx|jsx)$/.test(filePath) ||
           filePath.includes('__tests__') ||
           filePath.includes('test/');
  }

  /**
   * 生成 JSON 报告
   */
  generateJSONReport(result: CoverageAnalysisResult): string {
    return JSON.stringify(result, null, 2);
  }

  /**
   * 批量分析多个项目
   */
  async analyzeBatch(reportPaths: string[]): Promise<Map<string, CoverageAnalysisResult>> {
    const results = new Map<string, CoverageAnalysisResult>();

    for (const reportPath of reportPaths) {
      try {
        const result = await this.analyzeCoverageGaps(reportPath);
        results.set(reportPath, result);
      } catch (error) {
        console.error(`[CoverageAnalyzer] Failed to analyze ${reportPath}:`, error);
      }
    }

    return results;
  }
}

/**
 * 便捷工厂函数
 */
export function createCoverageAnalyzer(llmService?: LLMService): CoverageAnalyzer {
  return new CoverageAnalyzer(llmService);
}














