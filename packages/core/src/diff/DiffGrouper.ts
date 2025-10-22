/**
 * DiffGrouper - 智能 Diff 分组器
 * 
 * 将相关的 diff 分组，提高审查效率
 * 
 * 分组策略：
 * 1. 按改动类型（测试/重构/功能/修复）
 * 2. 按模块/目录
 * 3. 按依赖关系
 * 4. 按改动规模
 */

import type { FileDiff } from './DiffGenerator';
import type { DiffGroup } from './RichDiffUI';
import { createComponentLogger } from '../utils/logger';

export interface GroupingStrategy {
  /** 分组策略名称 */
  name: 'by-type' | 'by-module' | 'by-dependency' | 'by-size';
  
  /** 是否启用 */
  enabled: boolean;
  
  /** 权重（用于组合策略） */
  weight?: number;
}

export interface GroupingOptions {
  /** 分组策略列表 */
  strategies?: GroupingStrategy[];
  
  /** 最小分组大小 */
  minGroupSize?: number;
  
  /** 最大分组大小 */
  maxGroupSize?: number;
  
  /** 是否合并小分组 */
  mergeSmallGroups?: boolean;
}

/**
 * Diff 分组器
 */
export class DiffGrouper {
  private logger = createComponentLogger('DiffGrouper');
  
  /**
   * 按类型分组
   */
  groupByType(diffs: FileDiff[]): DiffGroup[] {
    const groups: Map<string, FileDiff[]> = new Map([
      ['test', []],
      ['config', []],
      ['source', []],
      ['doc', []],
    ]);
    
    for (const diff of diffs) {
      const type = this.detectFileType(diff.filePath);
      const group = groups.get(type) || groups.get('source')!;
      group.push(diff);
    }
    
    const result: DiffGroup[] = [];
    
    // 测试文件
    if (groups.get('test')!.length > 0) {
      result.push({
        type: 'test-generation',
        files: groups.get('test')!,
        description: `测试文件 (${groups.get('test')!.length} 个)`,
        confidence: 0.95,
      });
    }
    
    // 配置文件
    if (groups.get('config')!.length > 0) {
      result.push({
        type: 'other',
        files: groups.get('config')!,
        description: `配置文件 (${groups.get('config')!.length} 个)`,
        confidence: 0.9,
      });
    }
    
    // 源代码文件
    if (groups.get('source')!.length > 0) {
      // 进一步分析源代码类型
      const sourceFiles = groups.get('source')!;
      const isRefactor = this.detectRefactoring(sourceFiles);
      
      result.push({
        type: isRefactor ? 'refactor' : 'feature',
        files: sourceFiles,
        description: isRefactor ? 
          `代码重构 (${sourceFiles.length} 个文件)` : 
          `功能开发 (${sourceFiles.length} 个文件)`,
        confidence: 0.8,
      });
    }
    
    // 文档文件
    if (groups.get('doc')!.length > 0) {
      result.push({
        type: 'other',
        files: groups.get('doc')!,
        description: `文档更新 (${groups.get('doc')!.length} 个)`,
        confidence: 0.95,
      });
    }
    
    return result;
  }
  
  /**
   * 按模块分组
   */
  groupByModule(diffs: FileDiff[]): DiffGroup[] {
    const modules: Map<string, FileDiff[]> = new Map();
    
    for (const diff of diffs) {
      const module = this.extractModule(diff.filePath);
      
      if (!modules.has(module)) {
        modules.set(module, []);
      }
      modules.get(module)!.push(diff);
    }
    
    return Array.from(modules.entries()).map(([module, files]) => ({
      type: this.inferGroupType(files),
      files,
      description: `模块: ${module} (${files.length} 个文件)`,
      confidence: 0.85,
    }));
  }
  
  /**
   * 按改动规模分组
   */
  groupBySize(diffs: FileDiff[]): DiffGroup[] {
    const small: FileDiff[] = [];
    const medium: FileDiff[] = [];
    const large: FileDiff[] = [];
    
    for (const diff of diffs) {
      const changeSize = diff.additions + diff.deletions;
      
      if (changeSize < 20) {
        small.push(diff);
      } else if (changeSize < 100) {
        medium.push(diff);
      } else {
        large.push(diff);
      }
    }
    
    const groups: DiffGroup[] = [];
    
    if (small.length > 0) {
      groups.push({
        type: 'other',
        files: small,
        description: `小改动 (${small.length} 个, <20 行)`,
        confidence: 0.9,
        risk: 'low',
      });
    }
    
    if (medium.length > 0) {
      groups.push({
        type: 'feature',
        files: medium,
        description: `中等改动 (${medium.length} 个, 20-100 行)`,
        confidence: 0.8,
        risk: 'medium',
      });
    }
    
    if (large.length > 0) {
      groups.push({
        type: 'refactor',
        files: large,
        description: `大改动 (${large.length} 个, >100 行)`,
        confidence: 0.7,
        risk: 'high',
      });
    }
    
    return groups;
  }
  
  /**
   * 自动选择最佳分组策略
   */
  async autoGroup(diffs: FileDiff[], options: GroupingOptions = {}): Promise<DiffGroup[]> {
    if (diffs.length === 0) {
      return [];
    }
    
    // 默认使用类型分组
    if (diffs.length <= 5) {
      // 小量 diff，按类型分组最直观
      return this.groupByType(diffs);
    } else if (diffs.length <= 20) {
      // 中等量，按模块分组
      return this.groupByModule(diffs);
    } else {
      // 大量 diff，按规模分组，便于逐步审查
      return this.groupBySize(diffs);
    }
  }
  
  // ============================================================================
  // 辅助方法
  // ============================================================================
  
  /**
   * 检测文件类型
   */
  private detectFileType(filePath: string): 'test' | 'config' | 'doc' | 'source' {
    const lower = filePath.toLowerCase();
    
    // 测试文件
    if (lower.includes('.test.') || lower.includes('.spec.') || lower.includes('__tests__')) {
      return 'test';
    }
    
    // 配置文件
    if (lower.includes('config') || lower.endsWith('.json') || lower.endsWith('.yml') || lower.endsWith('.yaml')) {
      return 'config';
    }
    
    // 文档
    if (lower.endsWith('.md') || lower.endsWith('.txt') || lower.includes('docs/')) {
      return 'doc';
    }
    
    // 源代码
    return 'source';
  }
  
  /**
   * 提取模块名
   */
  private extractModule(filePath: string): string {
    // 提取顶级目录作为模块名
    const parts = filePath.split('/');
    
    if (parts.length >= 2) {
      // src/context/... -> context
      // packages/core/... -> core
      if (parts[0] === 'src' || parts[0] === 'packages') {
        return parts[1];
      }
      return parts[0];
    }
    
    return 'root';
  }
  
  /**
   * 检测是否为重构
   */
  private detectRefactoring(diffs: FileDiff[]): boolean {
    // 简单的启发式规则
    for (const diff of diffs) {
      const content = diff.diff.toLowerCase();
      
      // 重构关键词
      if (
        content.includes('extract') ||
        content.includes('rename') ||
        content.includes('move') ||
        content.includes('refactor') ||
        content.includes('simplify')
      ) {
        return true;
      }
      
      // 大量删除（可能是清理/重构）
      const deletionRatio = diff.deletions / (diff.additions + diff.deletions);
      if (deletionRatio > 0.6) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * 推断分组类型
   */
  private inferGroupType(files: FileDiff[]): DiffGroup['type'] {
    const hasTest = files.some(f => this.detectFileType(f.filePath) === 'test');
    if (hasTest) return 'test-generation';
    
    const isRefactor = this.detectRefactoring(files);
    if (isRefactor) return 'refactor';
    
    return 'feature';
  }
}

/**
 * 工厂函数
 */
export function createDiffGrouper(): DiffGrouper {
  return new DiffGrouper();
}




