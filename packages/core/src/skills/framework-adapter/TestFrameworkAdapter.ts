/**
 * TestFrameworkAdapter - 测试框架统一适配器接口
 * 
 * 参考 gpt.md，支持多个测试框架的统一接口
 * 
 * 支持的框架：
 * - Jest/Vitest (单元测试)
 * - Cypress (E2E)
 * - Playwright (E2E)
 * - Selenium WebDriver (E2E)
 * - WebdriverIO (E2E + 移动端)
 * - Supertest (API 测试)
 */

import type { LLMService } from '../../llm/LLMService';

/**
 * 框架能力描述
 */
export interface FrameworkCapabilities {
  /** 支持 E2E 测试 */
  supportsE2E: boolean;
  
  /** 支持单元测试 */
  supportsUnit: boolean;
  
  /** 支持 API 测试 */
  supportsAPI: boolean;
  
  /** 支持组件测试 */
  supportsComponent: boolean;
  
  /** 支持视觉回归测试 */
  supportsVisualRegression: boolean;
  
  /** 支持移动端测试 */
  supportsMobile: boolean;
  
  /** 支持的浏览器 */
  browsers: string[];
  
  /** 支持的平台 */
  platforms: ('web' | 'mobile' | 'desktop' | 'api')[];
}

/**
 * 框架测试上下文
 */
export interface FrameworkTestContext {
  /** 测试名称 */
  testName: string;
  
  /** 测试类型 */
  testType: 'unit' | 'e2e' | 'api' | 'component';
  
  /** 目标文件路径 */
  targetFile: string;
  
  /** 目标函数/类名 */
  targetEntity?: string;
  
  /** 用户描述 */
  description?: string;
  
  /** 额外配置 */
  config?: Record<string, any>;
}

/**
 * 测试代码
 */
export interface TestCode {
  /** 测试代码 */
  code: string;
  
  /** 测试文件路径 */
  filePath: string;
  
  /** 导入语句 */
  imports: string[];
  
  /** 依赖的 fixtures/mocks */
  dependencies?: string[];
}

/**
 * 配置选项
 */
export interface ConfigOptions {
  /** 项目路径 */
  projectPath: string;
  
  /** 测试目录 */
  testDir?: string;
  
  /** 浏览器列表（E2E） */
  browsers?: string[];
  
  /** 额外配置 */
  [key: string]: any;
}

/**
 * 测试结果
 */
export interface TestResult {
  /** 测试名称 */
  name: string;
  
  /** 是否通过 */
  passed: boolean;
  
  /** 耗时（毫秒） */
  duration: number;
  
  /** 错误信息 */
  error?: string;
  
  /** 截图路径（E2E） */
  screenshot?: string;
}

/**
 * 测试框架适配器接口
 */
export interface TestFrameworkAdapter {
  // ============================================================================
  // 元数据
  // ============================================================================
  
  /** 框架名称 */
  readonly name: string;
  
  /** 框架版本 */
  readonly version: string;
  
  /** 框架能力 */
  readonly capabilities: FrameworkCapabilities;
  
  /** 框架描述 */
  readonly description?: string;
  
  // ============================================================================
  // 核心方法
  // ============================================================================
  
  /**
   * 检查框架是否已安装
   */
  isInstalled(): Promise<boolean>;
  
  /**
   * 生成测试代码
   */
  generateTest(context: FrameworkTestContext): Promise<TestCode>;
  
  /**
   * 生成框架配置文件
   */
  generateConfig(options: ConfigOptions): Promise<string>;
  
  /**
   * 运行测试
   */
  runTests(testFiles: string[]): Promise<TestResult[]>;
  
  /**
   * 验证测试代码语法
   */
  validateTest(code: string): Promise<{ valid: boolean; errors: string[] }>;
  
  // ============================================================================
  // 可选方法
  // ============================================================================
  
  /**
   * 生成推荐的依赖列表
   */
  getRecommendedDependencies?(): string[];
  
  /**
   * 生成安装命令
   */
  getInstallCommand?(): string;
  
  /**
   * 生成运行命令
   */
  getRunCommand?(testFile: string): string;
}

/**
 * 基础测试框架适配器
 * 提供通用功能的默认实现
 */
export abstract class BaseTestFrameworkAdapter implements TestFrameworkAdapter {
  abstract readonly name: string;
  abstract readonly version: string;
  abstract readonly capabilities: FrameworkCapabilities;
  abstract readonly description: string;
  
  protected llmService?: LLMService;
  
  constructor(llmService?: LLMService) {
    this.llmService = llmService;
  }
  
  // 必须实现的抽象方法
  abstract generateTest(context: FrameworkTestContext): Promise<TestCode>;
  abstract generateConfig(options: ConfigOptions): Promise<string>;
  abstract runTests(testFiles: string[]): Promise<TestResult[]>;
  
  /**
   * 默认的安装检查
   */
  async isInstalled(): Promise<boolean> {
    try {
      const { execSync } = await import('child_process');
      execSync(`npm list ${this.name}`, { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * 默认的测试验证
   */
  async validateTest(code: string): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];
    
    // 基础语法检查
    if (!code.trim()) {
      errors.push('Test code is empty');
    }
    
    if (!code.includes('describe') && !code.includes('test') && !code.includes('it')) {
      errors.push('No test cases found');
    }
    
    if (!code.includes('expect') && !code.includes('assert')) {
      errors.push('No assertions found');
    }
    
    return {
      valid: errors.length === 0,
      errors,
    };
  }
  
  /**
   * 默认的依赖推荐
   */
  getRecommendedDependencies(): string[] {
    return [this.name];
  }
  
  /**
   * 默认的安装命令
   */
  getInstallCommand(): string {
    return `pnpm add -D ${this.name}`;
  }
  
  /**
   * 默认的运行命令
   */
  getRunCommand(testFile: string): string {
    return `pnpm test ${testFile}`;
  }
}

/**
 * 框架注册表
 */
export class FrameworkRegistry {
  private adapters: Map<string, TestFrameworkAdapter> = new Map();
  
  /**
   * 注册适配器
   */
  register(adapter: TestFrameworkAdapter): void {
    this.adapters.set(adapter.name, adapter);
  }
  
  /**
   * 获取适配器
   */
  get(name: string): TestFrameworkAdapter | undefined {
    return this.adapters.get(name);
  }
  
  /**
   * 列出所有适配器
   */
  listAll(): TestFrameworkAdapter[] {
    return Array.from(this.adapters.values());
  }
  
  /**
   * 查找支持特定能力的适配器
   */
  findByCapability(capability: keyof FrameworkCapabilities): TestFrameworkAdapter[] {
    return this.listAll().filter(adapter => adapter.capabilities[capability]);
  }
  
  /**
   * 自动检测项目中已安装的框架
   */
  async detectInstalled(): Promise<TestFrameworkAdapter[]> {
    const installed: TestFrameworkAdapter[] = [];
    
    for (const adapter of this.listAll()) {
      if (await adapter.isInstalled()) {
        installed.push(adapter);
      }
    }
    
    return installed;
  }
}

/**
 * 全局框架注册表
 */
export const globalFrameworkRegistry = new FrameworkRegistry();

