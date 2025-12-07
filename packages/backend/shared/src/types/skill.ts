/**
 * TestSkill - 测试技能标准接口
 * 
 * 定义所有测试技能必须遵循的接口
 * 为社区贡献和插件生态奠定基础
 */
import type { TestSuite as CoreTestSuite } from './index';

/**
 * 测试上下文
 * 包含生成测试所需的所有信息
 */
export interface TestContext {
  // 基础字段
  projectId?: string;
  testType: 'unit' | 'integration' | 'e2e' | 'api' | 'component' | 'graphql';
  framework?: string;
  filePath?: string;
  
  // 组件测试字段
  componentPath?: string;
  componentCode?: string;
  componentName?: string;
  props?: Record<string, unknown>;
  hooks?: string[];
  children?: boolean;
  
  // E2E 测试字段
  url?: string;
  userFlow?: string;
  expectedBehavior?: string;
  browsers?: Array<'chromium' | 'firefox' | 'webkit'>;
  viewport?: { width: number; height: number };
  pageElements?: Array<{
    name: string;
    selector?: string;
    role?: string;
    label?: string;
    type?: string;
  }>;
  
  // API 测试字段
  baseUrl?: string;
  endpoints?: unknown[];
  authentication?: {
    type: string;
    token?: string;
  };
  
  // GraphQL 字段
  endpoint?: string;
  operations?: unknown[];
  schema?: string;
  
  // 函数测试字段
  functionName?: string;
  
  // 其他
  apiEndpoints?: unknown[];
}

/**
 * 测试套件（简化声明，避免循环依赖）
 */
export type TestSuite = CoreTestSuite;

/**
 * 测试框架类型
 */
export type TestFramework = 'jest' | 'vitest' | 'pytest' | 'junit' | 'mocha' | 'cypress' | 'playwright';

/**
 * 测试技能元数据
 */
export interface SkillMetadata {
  /** 技能唯一标识符 */
  name: string;
  
  /** 语义化版本号 */
  version: string;
  
  /** 简短描述 */
  description: string;
  
  /** 作者信息 */
  author: string;
  
  /** 支持的测试框架 */
  supportedFrameworks: readonly TestFramework[];
  
  /** 支持的编程语言 */
  supportedLanguages: readonly string[];
  
  /** 标签（用于分类和搜索） */
  tags?: string[];
  
  /** 许可证 */
  license?: string;
  
  /** 仓库 URL */
  repository?: string;
  
  /** 依赖的其他技能 */
  dependencies?: string[];
}

/**
 * 验证结果
 */
export interface ValidationResult {
  valid: boolean;
  issues: string[];
  warnings?: string[];
  score?: number; // 0-100
}

/**
 * 测试改进建议
 */
export interface ImprovementSuggestion {
  type: 'coverage' | 'quality' | 'performance' | 'maintainability';
  description: string;
  code?: string; // 改进后的代码
  priority: 'low' | 'medium' | 'high';
}

/**
 * 测试技能接口
 * 
 * 所有测试生成技能必须实现此接口
 */
export interface TestSkill {
  /** 技能元数据 */
  readonly metadata: SkillMetadata;
  
  /**
   * 检查是否可以处理给定的测试上下文
   * 
   * @param context - 测试上下文
   * @returns true 如果此技能可以处理该上下文
   */
  canHandle(context: TestContext): boolean;
  
  /**
   * 生成测试套件
   * 
   * @param context - 测试上下文
   * @returns 生成的测试套件
   */
  generateTest(context: TestContext): Promise<TestSuite>;
  
  /**
   * 验证生成的测试代码
   * 
   * @param testCode - 测试代码
   * @returns 验证结果
   */
  validateTest(testCode: string): Promise<ValidationResult>;
  
  /**
   * 改进现有测试（可选）
   * 
   * @param testSuite - 现有测试套件
   * @returns 改进后的测试套件
   */
  improveTest?(testSuite: TestSuite): Promise<TestSuite>;
  
  /**
   * 修复失败的测试（可选）
   * 
   * @param failedTest - 失败的测试信息
   * @returns 修复结果
   */
  healTest?(failedTest: unknown): Promise<unknown>;
  
  /**
   * 获取改进建议（可选）
   * 
   * @param testCode - 测试代码
   * @returns 改进建议列表
   */
  getSuggestions?(testCode: string): Promise<ImprovementSuggestion[]>;
}

/**
 * 技能上下文（技能执行时的环境）
 * 兼容传统 SkillContext 字段，并扩展测试相关信息
 */
export interface SkillContext extends Partial<TestContext> {
  /**
   * 项目标识
   */
  projectId?: string;

  /**
   * 仓库根路径（绝对路径）
   */
  projectPath: string;

  /**
   * 项目配置（向后兼容 legacy `config`）
   */
  projectConfig: Record<string, any>;
  config?: Record<string, any>;

  /**
   * 仓库/分支信息
   */
  repository?: {
    branch?: string;
    commit?: string;
  };

  /**
   * 执行环境信息
   */
  environment?: {
    nodeVersion?: string;
    packageManager?: string;
    os?: string;
  };

  /**
   * 目标文件/函数
   */
  targetFiles: string[];
  targetFunctions?: Array<{ file: string; name: string }>;
  targetTestFile?: string;

  /**
   * 原始用户输入
   */
  userPrompt: string;
  naturalLanguageRequest?: string;
  acceptanceCriteria?: string;

  /**
   * 测试/计划相关标识
   */
  testPlanId?: string;
  frameworkVersion?: string;
  testContextOverrides?: Partial<TestContext>;

  /**
   * 扩展数据
   */
  analysisResult?: Partial<TestContext> & Record<string, unknown>;
  hybridContext?: unknown;
  metadata?: Record<string, unknown>;

  /**
   * 注入的 LLM 服务
   */
  llmService?: unknown;
}

/**
 * 技能加载选项
 */
export interface SkillLoadOptions {
  enabledOnly?: boolean;
  filterByFramework?: TestFramework;
  filterByLanguage?: string;
}
