/**
 * @testmind/core
 * Core engine for test generation and analysis
 */

export type {
  ContextSummary,
  FileContext,
  FileFragment,
  ContextMetrics,
  DependencyGraph,
  DependencyNode,
  DependencyEdge,
  GenerationResult,
  GenerationMetadata,
  EvaluationReport,
  EvaluationStatus,
  EvaluationArtifact,
  HealingSuggestion,
  DiffPreview,
  DiffFile,
  RiskLevel,
  GitActionPlan,
  GitActionStatus,
} from '@testmind/shared';

// Context Engine
export { ContextEngine } from './context/ContextEngine';
export { ContextManager } from './context/ContextManager';
export { StaticAnalyzer } from './context/StaticAnalyzer';
export { SemanticIndexer } from './context/SemanticIndexer';
export { DependencyGraphBuilder } from './context/DependencyGraphBuilder';
export { ContextOptimizationService } from './context/ContextOptimizationService';

// Test Generation
export { TestGenerator } from './generation/TestGenerator';
export { TestStrategyPlanner } from './generation/TestStrategyPlanner';
export { PromptBuilder } from './generation/PromptBuilder';
export { TestReviewer } from './generation/TestReviewer';
export { TestValidator } from './generation/TestValidator';

// Agents
export { TestGenerationAgent } from './agents/TestGenerationAgent';

// Test Evaluation
export { TestEvaluator } from './evaluation/TestEvaluator';
export { TestRunner } from './evaluation/TestRunner';
export { QualityAnalyzer } from './evaluation/QualityAnalyzer';
export type { ExecutionResult } from './evaluation/TestRunner';

// LLM Integration
export { LLMService } from './llm/LLMService';
export { OpenAIProvider } from './llm/providers/OpenAIProvider';
export { AnthropicProvider } from './llm/providers/AnthropicProvider';
export { OllamaProvider } from './llm/providers/OllamaProvider';
export { LLMCache, llmCache } from './llm/LLMCache';

// Database
export { Database } from './db/Database';
export { VectorStore } from './db/VectorStore';

// Self-Healing Engine
export * from './self-healing';

// Diff-First Workflow
export * from './diff';

// CI/CD Integration
export * from './ci-cd';

// Skills Framework
export { 
  BaseSkill,
  Skill,
  SkillCategory,
  SkillResult,
  CodeChange,
  SkillConfiguration,
} from './skills/Skill';
export { SkillRegistry } from './skills/SkillRegistry';
export { SkillOrchestrator } from './skills/SkillOrchestrator';
export { TestGenerationSkill } from './skills/TestGenerationSkill';
export { RefactorSkill } from './skills/RefactorSkill';

// v0.6.0 features (disabled due to type conflicts)
// export * from './v0.6.0';

// Utilities
export { 
  GitAutomation,
  FileCache,
  logger,
  Logger,
  createComponentLogger,
  LogLevel,
  flushLogs,
  metrics,
  Metrics,
  timeOperation,
  MetricNames,
  initializeErrorTracking,
  captureError,
  captureMessage,
  setUserContext,
  clearUserContext,
  addBreadcrumb,
  startTransaction,
  withErrorTracking,
  ErrorTracker,
  createErrorTracker,
  flushErrorTracking,
  safeParseFile,
  ensureDir,
  safeWriteFile,
} from './utils';

// Config
export * from './config/SkillConfig';

// Errors
export * from './errors';























