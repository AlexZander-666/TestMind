/**
 * TestMind v0.6.0 新增功能导出
 * 
 * 包含所有 v0.6.0 版本新增的模块和功能
 */

// ==================== 自愈引擎增强 ====================

// 浏览器适配器
export * from './self-healing/adapters/BrowserAdapter';
export * from './self-healing/adapters/PlaywrightAdapter';
export * from './self-healing/adapters/CypressAdapter';
export { 
  BrowserAdapterRegistry,
  createBrowserAdapter,
  autoDetectAdapter 
} from './self-healing/adapters';

// 定位器策略（已升级为真实实现）
export { IdLocator } from './self-healing/strategies/IdLocator';
export { CssSelectorLocator } from './self-healing/strategies/CssSelectorLocator';
export { XPathLocator } from './self-healing/strategies/XPathLocator';
export { VisualLocator } from './self-healing/strategies/VisualLocator';
export { SemanticLocator } from './self-healing/strategies/SemanticLocator';

// 增强的失败分类器
export { 
  EnhancedFailureClassifier,
  createFailureClassifier 
} from './self-healing/FailureClassifier.enhanced';
export type {
  TestFailure,
  FailureType,
  ClassificationResult
} from './self-healing/FailureClassifier.enhanced';

// ==================== 向量数据库与 RAG ====================

// 增强的向量存储
export { 
  EnhancedVectorStore,
  createEnhancedVectorStore 
} from './db/VectorStore.enhanced';
export type {
  VectorStoreStats,
  SearchOptions 
} from './db/VectorStore.enhanced';

// Embedding 生成器
export {
  EmbeddingGenerator,
  createEmbeddingGenerator
} from './context/EmbeddingGenerator';
export type {
  EmbeddingConfig,
  EmbeddingGenerationResult,
  ProgressCallback
} from './context/EmbeddingGenerator';

// 混合搜索引擎
export {
  HybridSearchEngine,
  createHybridSearchEngine
} from './context/HybridSearchEngine';
export type {
  SearchQuery,
  HybridSearchResult,
  SearchStats
} from './context/HybridSearchEngine';

// ==================== CI/CD 深度集成 ====================

// 覆盖率分析器
export {
  CoverageAnalyzer,
  createCoverageAnalyzer
} from './ci-cd/CoverageAnalyzer';
export type {
  CoverageData,
  FileCoverage,
  UncoveredFunction,
  TestSuggestion,
  CoverageAnalysisResult
} from './ci-cd/CoverageAnalyzer';

// 性能监控器
export {
  PerformanceMonitor,
  createPerformanceMonitor
} from './ci-cd/PerformanceMonitor';
export type {
  TestRun,
  TestPerformance,
  PerformanceRegression,
  PerformanceImprovement,
  PerformanceComparisonResult
} from './ci-cd/PerformanceMonitor';

// ==================== 测试框架增强 ====================

// Enhanced Cypress
export { EnhancedCypressTestSkill } from './skills/CypressTestSkill.enhanced';
export { CypressConfigGenerator } from './skills/CypressTestSkill.enhanced';
export type {
  CypressTestContext,
  CypressAction,
  APIEndpoint
} from './skills/CypressTestSkill.enhanced';

// Enhanced Playwright
export { EnhancedPlaywrightTestSkill } from './skills/PlaywrightTestSkill.enhanced';
export { PlaywrightConfigGenerator } from './skills/PlaywrightTestSkill.enhanced';
export type {
  PlaywrightTestContext,
  PlaywrightAction
} from './skills/PlaywrightTestSkill.enhanced';

// Vitest Browser Mode
export { VitestBrowserSkill } from './skills/VitestBrowserSkill';
export type {
  VitestBrowserContext,
  BrowserAction
} from './skills/VitestBrowserSkill';

// WebdriverIO
export { WebdriverIOSkill } from './skills/WebdriverIOSkill';
export type {
  WebdriverIOContext,
  WebDriverAction
} from './skills/WebdriverIOSkill';

// ==================== 成本优化 ====================

// 成本优化器
export {
  CostOptimizer,
  CostTracker,
  createCostOptimizer,
  createCostTracker
} from './generation/CostOptimizer';
export type {
  TestGenerationContext,
  ModelSelection,
  PromptCompressionResult
} from './generation/CostOptimizer';

// ==================== 便捷导入 ====================

/**
 * 一站式导入 v0.6.0 所有新功能
 */
export const V0_6_0 = {
  // 自愈
  SelfHealing: {
    Adapters: { 
      create: createBrowserAdapter, 
      autoDetect: autoDetectAdapter 
    },
    Locators: { 
      Id: IdLocator, 
      Css: CssSelectorLocator, 
      XPath: XPathLocator, 
      Visual: VisualLocator, 
      Semantic: SemanticLocator 
    },
    Classifier: createFailureClassifier,
  },
  
  // 向量搜索
  VectorSearch: {
    Store: createEnhancedVectorStore,
    Embeddings: createEmbeddingGenerator,
    HybridSearch: createHybridSearchEngine,
  },
  
  // CI/CD
  CICD: {
    Coverage: createCoverageAnalyzer,
    Performance: createPerformanceMonitor,
  },
  
  // 成本优化
  Cost: {
    Optimizer: createCostOptimizer,
    Tracker: createCostTracker,
  },
  
  // 技能
  Skills: {
    Cypress: EnhancedCypressTestSkill,
    Playwright: EnhancedPlaywrightTestSkill,
    VitestBrowser: VitestBrowserSkill,
    WebdriverIO: WebdriverIOSkill,
  },
};


