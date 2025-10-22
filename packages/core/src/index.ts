/**
 * @testmind/core
 * Core engine for test generation and analysis
 */

// Context Engine
export { ContextEngine } from './context/ContextEngine';
export { ContextManager } from './context/ContextManager';
export { StaticAnalyzer } from './context/StaticAnalyzer';
export { SemanticIndexer } from './context/SemanticIndexer';
export { DependencyGraphBuilder } from './context/DependencyGraphBuilder';

// v0.7.0+: Explicit Context Management (Aider-style)
export { ExplicitContextManager, createExplicitContextManager } from './context/ExplicitContextManager';
export { ContextFusion, createContextFusion } from './context/ContextFusion';
export { TokenBudgetManager, createTokenBudgetManager } from './context/TokenBudgetManager';
export type {
  PinnedChunk,
  ContextSnapshot,
  AddFileOptions
} from './context/ExplicitContextManager';
export type {
  FusionOptions,
  FusionResult
} from './context/ContextFusion';
export type {
  TokenBudget,
  TokenUsage,
  TruncationResult,
  CostEstimate
} from './context/TokenBudgetManager';

// Test Generation
export { TestGenerator } from './generation/TestGenerator';
export { TestStrategyPlanner } from './generation/TestStrategyPlanner';
export { PromptBuilder } from './generation/PromptBuilder';
export { TestReviewer } from './generation/TestReviewer';
export { TestValidator } from './generation/TestValidator';

// v0.7.0+: Prompt Optimization & Model Selection
export { PromptOptimizer, createPromptOptimizer } from './generation/PromptOptimizer';
export { ModelSelector, createModelSelector } from './generation/ModelSelector';
export type {
  OptimizationOptions,
  OptimizationResult
} from './generation/PromptOptimizer';
export type {
  ModelConfig,
  TaskComplexity,
  SelectionCriteria,
  ModelRecommendation
} from './generation/ModelSelector';

// Test Evaluation
export { TestEvaluator } from './evaluation/TestEvaluator';
export { TestRunner } from './evaluation/TestRunner';
export { QualityAnalyzer } from './evaluation/QualityAnalyzer';

// LLM Integration
export { LLMService } from './llm/LLMService';
export { OpenAIProvider } from './llm/providers/OpenAIProvider';
export { AnthropicProvider } from './llm/providers/AnthropicProvider';
export { OllamaProvider } from './llm/providers/OllamaProvider';
export { LLMCache, llmCache } from './llm/LLMCache';

// v0.7.0+: Advanced LLM Features
export { SemanticCache, createSemanticCache } from './llm/SemanticCache';
export { LocalModelManager, createLocalModelManager } from './llm/LocalModelManager';
export type {
  CacheEntry,
  SemanticCacheOptions,
  CacheStats as SemanticCacheStats
} from './llm/SemanticCache';
export type {
  LocalModel,
  ModelBenchmark,
  HybridStrategy
} from './llm/LocalModelManager';

// Database
export { Database } from './db/Database';
export { VectorStore } from './db/VectorStore';

// v0.7.0+: Vector Search Optimization
export { VectorSearchOptimizer, createVectorSearchOptimizer } from './db/VectorSearchOptimizer';
export type {
  QueryOptimizationOptions,
  SearchOptimizationResult,
  IndexOptimizationConfig,
  PerformanceMetrics
} from './db/VectorSearchOptimizer';

// Self-Healing Engine
export * from './self-healing';

// Diff-First Workflow
export * from './diff';

// CI/CD Integration
export * from './ci-cd';

// Skills Framework
export type { SkillContext, SkillResult, SkillMetadata, SkillConfiguration } from './skills/Skill';
export { BaseSkill } from './skills/Skill';
// Note: SkillRegistry and SkillOrchestrator disabled due to type issues
// export { SkillRegistry } from './skills/SkillRegistry';
// export { SkillOrchestrator } from './skills/SkillOrchestrator';
export { TestGenerationSkill } from './skills/TestGenerationSkill';
export { RefactorSkill } from './skills/RefactorSkill';

// v0.7.0+: Framework Adapters
export * from './skills/framework-adapter';

// v0.6.0 features (disabled due to type conflicts)
// export * from './v0.6.0';

// Utilities
export * from './utils';




























