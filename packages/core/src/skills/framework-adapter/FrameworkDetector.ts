/**
 * FrameworkDetector - 测试框架自动检测器
 * 
 * 分析项目配置，自动检测已安装的测试框架
 * 
 * 检测方式：
 * 1. 分析 package.json 的 dependencies 和 devDependencies
 * 2. 检查配置文件（jest.config.js, cypress.config.ts 等）
 * 3. 检查测试文件模式
 * 4. 推荐最合适的框架
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { TestFrameworkAdapter } from './TestFrameworkAdapter';
import { createComponentLogger } from '../../utils/logger';

export interface DetectionResult {
  /** 检测到的框架列表 */
  detected: FrameworkInfo[];
  
  /** 推荐使用的框架 */
  recommended?: FrameworkInfo;
  
  /** 检测置信度 */
  confidence: number;
  
  /** 检测依据 */
  evidence: DetectionEvidence[];
}

export interface FrameworkInfo {
  /** 框架名称 */
  name: string;
  
  /** 版本 */
  version?: string;
  
  /** 是否已安装 */
  installed: boolean;
  
  /** 是否已配置 */
  configured: boolean;
  
  /** 检测置信度 (0-1) */
  confidence: number;
}

export interface DetectionEvidence {
  /** 证据类型 */
  type: 'dependency' | 'config-file' | 'test-file' | 'script';
  
  /** 证据描述 */
  description: string;
  
  /** 关联的框架 */
  framework: string;
  
  /** 证据权重 */
  weight: number;
}

/**
 * 框架检测器
 */
export class FrameworkDetector {
  private logger = createComponentLogger('FrameworkDetector');
  
  /**
   * 检测项目中的测试框架
   */
  async detect(projectPath: string): Promise<DetectionResult> {
    const evidence: DetectionEvidence[] = [];
    
    // 1. 检查 package.json
    const packageEvidence = await this.checkPackageJson(projectPath);
    evidence.push(...packageEvidence);
    
    // 2. 检查配置文件
    const configEvidence = await this.checkConfigFiles(projectPath);
    evidence.push(...configEvidence);
    
    // 3. 检查测试文件
    const testFileEvidence = await this.checkTestFiles(projectPath);
    evidence.push(...testFileEvidence);
    
    // 4. 检查 npm scripts
    const scriptEvidence = await this.checkScripts(projectPath);
    evidence.push(...scriptEvidence);
    
    // 5. 聚合证据，计算每个框架的总分
    const frameworkScores = this.aggregateEvidence(evidence);
    
    // 6. 生成检测结果
    const detected = Object.entries(frameworkScores)
      .filter(([_, score]) => score > 0.3) // 阈值
      .map(([name, confidence]) => ({
        name,
        installed: evidence.some(e => e.framework === name && e.type === 'dependency'),
        configured: evidence.some(e => e.framework === name && e.type === 'config-file'),
        confidence,
      }))
      .sort((a, b) => b.confidence - a.confidence);
    
    // 7. 推荐框架
    const recommended = detected.length > 0 ? detected[0] : undefined;
    
    this.logger.info('Framework detection completed', {
      detected: detected.length,
      recommended: recommended?.name,
    });
    
    return {
      detected,
      recommended,
      confidence: recommended?.confidence || 0,
      evidence,
    };
  }
  
  /**
   * 检查 package.json
   */
  private async checkPackageJson(projectPath: string): Promise<DetectionEvidence[]> {
    const evidence: DetectionEvidence[] = [];
    
    try {
      const packagePath = path.join(projectPath, 'package.json');
      const content = await fs.readFile(packagePath, 'utf-8');
      const pkg = JSON.parse(content);
      
      const allDeps = {
        ...pkg.dependencies,
        ...pkg.devDependencies,
      };
      
      // 检测各个框架
      const frameworkDeps = {
        'jest': ['jest', '@types/jest'],
        'vitest': ['vitest'],
        'cypress': ['cypress'],
        'playwright': ['@playwright/test', 'playwright'],
        'selenium-webdriver': ['selenium-webdriver'],
        'webdriverio': ['webdriverio', '@wdio/cli'],
        'mocha': ['mocha'],
        'jasmine': ['jasmine'],
      };
      
      for (const [framework, deps] of Object.entries(frameworkDeps)) {
        const found = deps.find(dep => dep in allDeps);
        if (found) {
          evidence.push({
            type: 'dependency',
            description: `Found ${found} in package.json`,
            framework,
            weight: 0.4,
          });
          
          // 记录版本
          if (allDeps[found]) {
            this.logger.debug(`Detected ${framework}`, { version: allDeps[found] });
          }
        }
      }
    } catch (error) {
      this.logger.debug('Failed to read package.json', { error });
    }
    
    return evidence;
  }
  
  /**
   * 检查配置文件
   */
  private async checkConfigFiles(projectPath: string): Promise<DetectionEvidence[]> {
    const evidence: DetectionEvidence[] = [];
    
    const configFiles = [
      { file: 'jest.config.js', framework: 'jest', weight: 0.3 },
      { file: 'jest.config.ts', framework: 'jest', weight: 0.3 },
      { file: 'vitest.config.ts', framework: 'vitest', weight: 0.3 },
      { file: 'cypress.config.ts', framework: 'cypress', weight: 0.3 },
      { file: 'cypress.config.js', framework: 'cypress', weight: 0.3 },
      { file: 'playwright.config.ts', framework: 'playwright', weight: 0.3 },
      { file: 'wdio.conf.ts', framework: 'webdriverio', weight: 0.3 },
      { file: 'wdio.conf.js', framework: 'webdriverio', weight: 0.3 },
      { file: '.mocharc.json', framework: 'mocha', weight: 0.2 },
    ];
    
    for (const { file, framework, weight } of configFiles) {
      try {
        await fs.access(path.join(projectPath, file));
        evidence.push({
          type: 'config-file',
          description: `Found ${file}`,
          framework,
          weight,
        });
      } catch {
        // 文件不存在，跳过
      }
    }
    
    return evidence;
  }
  
  /**
   * 检查测试文件
   */
  private async checkTestFiles(projectPath: string): Promise<DetectionEvidence[]> {
    const evidence: DetectionEvidence[] = [];
    
    try {
      // 检查常见测试目录
      const testDirs = ['test', 'tests', '__tests__', 'cypress', 'e2e'];
      
      for (const dir of testDirs) {
        try {
          const testPath = path.join(projectPath, dir);
          await fs.access(testPath);
          
          // 检查目录下的文件
          const files = await fs.readdir(testPath);
          
          // Cypress 特征
          if (dir === 'cypress' || files.some(f => f.includes('cypress'))) {
            evidence.push({
              type: 'test-file',
              description: `Found ${dir} directory`,
              framework: 'cypress',
              weight: 0.2,
            });
          }
          
          // Playwright 特征
          if (files.some(f => f.includes('.spec.ts') || f.includes('.spec.js'))) {
            evidence.push({
              type: 'test-file',
              description: `Found .spec.ts files in ${dir}`,
              framework: 'playwright',
              weight: 0.15,
            });
          }
          
          // Jest/Vitest 特征
          if (files.some(f => f.includes('.test.ts') || f.includes('.test.js'))) {
            evidence.push({
              type: 'test-file',
              description: `Found .test.ts files in ${dir}`,
              framework: 'jest', // 或 vitest，需要进一步区分
              weight: 0.1,
            });
          }
        } catch {
          // 目录不存在
        }
      }
    } catch (error) {
      this.logger.debug('Failed to check test files', { error });
    }
    
    return evidence;
  }
  
  /**
   * 检查 npm scripts
   */
  private async checkScripts(projectPath: string): Promise<DetectionEvidence[]> {
    const evidence: DetectionEvidence[] = [];
    
    try {
      const packagePath = path.join(projectPath, 'package.json');
      const content = await fs.readFile(packagePath, 'utf-8');
      const pkg = JSON.parse(content);
      
      if (!pkg.scripts) {
        return evidence;
      }
      
      const scripts = pkg.scripts;
      const scriptPatterns = {
        'jest': /\bjest\b/,
        'vitest': /\bvitest\b/,
        'cypress': /\bcypress\b/,
        'playwright': /\bplaywright\b/,
        'mocha': /\bmocha\b/,
        'webdriverio': /\bwdio\b/,
      };
      
      for (const [framework, pattern] of Object.entries(scriptPatterns)) {
        const matchingScripts = Object.entries(scripts).filter(([_, cmd]) => 
          pattern.test(cmd as string)
        );
        
        if (matchingScripts.length > 0) {
          evidence.push({
            type: 'script',
            description: `Found npm script using ${framework}`,
            framework,
            weight: 0.2,
          });
        }
      }
    } catch (error) {
      this.logger.debug('Failed to check scripts', { error });
    }
    
    return evidence;
  }
  
  /**
   * 聚合证据，计算框架得分
   */
  private aggregateEvidence(evidence: DetectionEvidence[]): Record<string, number> {
    const scores: Record<string, number> = {};
    
    for (const e of evidence) {
      if (!scores[e.framework]) {
        scores[e.framework] = 0;
      }
      scores[e.framework] += e.weight;
    }
    
    // 归一化到 0-1 范围
    const maxScore = Math.max(...Object.values(scores));
    if (maxScore > 0) {
      for (const framework in scores) {
        scores[framework] = Math.min(scores[framework] / maxScore, 1.0);
      }
    }
    
    return scores;
  }
  
  /**
   * 推荐框架（当未检测到时）
   */
  async recommendFramework(
    projectType: 'web' | 'api' | 'mobile' | 'library'
  ): Promise<string> {
    const recommendations = {
      'web': 'playwright',      // 现代 Web E2E
      'api': 'jest',            // API 单元测试
      'mobile': 'webdriverio',  // 移动端
      'library': 'vitest',      // 库项目
    };
    
    return recommendations[projectType];
  }
}

/**
 * 工厂函数
 */
export function createFrameworkDetector(): FrameworkDetector {
  return new FrameworkDetector();
}

