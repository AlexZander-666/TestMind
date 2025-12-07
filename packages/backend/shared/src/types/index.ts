/**
 * Core type definitions for TestMind
 */

// ============================================================================
// Project & Configuration Types
// ============================================================================

export interface ProjectConfig {
  id: string;
  name: string;
  repoPath: string;
  language: ProgrammingLanguage;
  testFramework: TestFramework;
  indexedAt?: Date;
  config: ProjectSettings;
}

export interface ProjectSettings {
  includePatterns: string[];
  excludePatterns: string[];
  testDirectory: string;
  coverageThreshold: number;
  maxFileSize: number;
  llmProvider: LLMProvider;
  llmModel: string;
  testLocationStrategy?: 'colocated' | 'separate' | 'nested';
  testFilePattern?: string;
}

export interface TestLocationStrategy {
  type: 'colocated' | 'separate' | 'nested';
  // colocated: lib/format.ts → lib/format.test.ts
  // separate: lib/format.ts → __tests__/lib/format.test.ts
  // nested: lib/format.ts → lib/__tests__/format.test.ts
}

export type ProgrammingLanguage = 'typescript' | 'javascript' | 'python' | 'java';
export type TestFramework = 'jest' | 'vitest' | 'pytest' | 'junit' | 'mocha' | 'cypress' | 'playwright';
export type LLMProvider = 'openai' | 'anthropic' | 'ollama' | 'custom';

// ============================================================================
// Code Analysis Types
// ============================================================================

export interface CodeFile {
  id: string;
  projectId: string;
  filePath: string;
  language: ProgrammingLanguage;
  hash: string;
  astData: ASTData;
  indexedAt: Date;
  content?: string;
  analysisResult?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  relativePath?: string;
  repoPath?: string;
  summary?: string;
  sizeInBytes?: number;
  coverage?: CoverageInfo;
  tags?: string[];
}

export interface ASTData {
  functions: FunctionNode[];
  classes: ClassNode[];
  imports: ImportNode[];
  exports: ExportNode[];
}

export interface FunctionNode {
  name: string;
  startLine: number;
  endLine: number;
  parameters: Parameter[];
  returnType?: string;
  isAsync: boolean;
  isExported: boolean;
  throws?: string[];
  documentation?: string;
  complexity?: number;
}

export interface ClassNode {
  name: string;
  startLine: number;
  endLine: number;
  methods: FunctionNode[];
  properties: Property[];
  extends?: string;
  implements?: string[];
}

export interface Parameter {
  name: string;
  type?: string;
  optional: boolean;
  defaultValue?: string;
}

export interface Property {
  name: string;
  type?: string;
  visibility: 'public' | 'private' | 'protected';
  isStatic: boolean;
}

export interface ImportNode {
  source: string;
  specifiers: string[];
  isDefault: boolean;
}

export interface ExportNode {
  name: string;
  isDefault: boolean;
}

// ============================================================================
// Context Engine Types
// ============================================================================

export interface FunctionContext {
  signature: FunctionSignature;
  dependencies: Dependency[];
  callers: string[];
  sideEffects: SideEffect[];
  existingTests: TestCase[];
  coverage: CoverageInfo;
  complexity: ComplexityMetrics;
  strategy?: string;
  metadata?: Record<string, unknown>;
  recommendedTests?: TestCase[];
  notes?: string;
}

export interface FunctionSignature {
  name: string;
  filePath: string;
  parameters: Parameter[];
  returnType?: string;
  isAsync: boolean;
  documentation?: string;
  throws?: string[];
}

export interface Dependency {
  type: 'internal' | 'external' | 'builtin';
  name: string;
  version?: string;
  usedIn: string[];
}

export interface SideEffect {
  type: 'io' | 'network' | 'state' | 'database' | 'filesystem';
  description: string;
  location: CodeLocation;
}

export interface CodeLocation {
  filePath: string;
  line: number;
  column: number;
}

export interface CoverageInfo {
  linesCovered: number;
  linesTotal: number;
  branchesCovered: number;
  branchesTotal: number;
  functionsCovered: number;
  functionsTotal: number;
  percentage: number;
}

export interface ComplexityMetrics {
  cyclomaticComplexity: number;
  cognitiveComplexity: number;
  linesOfCode: number;
  maintainabilityIndex: number;
}

// ============================================================================
// Test Generation Types
// ============================================================================

export interface TestSuite {
  id: string;
  projectId: string;
  targetEntityId: string;
  testType: TestType;
  framework: TestFramework;
  code: string;
  filePath: string;
  generatedAt: Date;
  generatedBy: 'ai' | 'human' | 'hybrid';
  metadata: TestMetadata;
  tests?: TestCase[];
  summary?: string;
  description?: string;
  status?: 'draft' | 'active' | 'deprecated' | 'archived';
  tags?: string[];
  version?: string;
  strategy?: TestStrategy;
  lastRunAt?: Date;
  runStats?: {
    passed: number;
    failed: number;
    skipped: number;
    durationMs?: number;
    coverage?: CoverageInfo;
  };
}

export type TestType = 'unit' | 'integration' | 'e2e' | 'api' | 'component' | 'graphql';

export interface TestMetadata {
  targetFunction?: string;
  targetClass?: string;
  dependencies?: string[];
  mocks?: string[];
  fixtures?: string[];
  estimatedRunTime?: number;
  strategy?: string;
  testPlanId?: string;
  requirements?: string[];
  riskLevel?: 'low' | 'medium' | 'high';
  environment?: string;
  coverageTarget?: number;
  dataset?: string;
  datasetSize?: number;
  stabilityScore?: number;
  owner?: string;
  // 扩展字段（用于不同类型的测试）
  url?: string;
  userFlow?: string;
  browsers?: string[];
  componentPath?: string;
  componentName?: string;
  baseUrl?: string;
  endpointsCount?: number;
  endpoint?: string;
  skill?: string;
  version?: string;
  [key: string]: unknown; // 允许额外的元数据
}

export interface TestCase {
  id?: string;
  name: string;
  description: string;
  type?: TestType | string;
  priority?: Priority;
  tags?: string[];
  assertions: Assertion[];
  setup?: string;
  teardown?: string;
  input?: Record<string, unknown> | unknown;
  expectedOutput?: unknown;
  steps?: TestStep[];
  metadata?: Record<string, unknown>;
  mocks?: string[];
  dependencies?: Dependency[];
  scenario?: string;
  code?: string;
  stabilityScore?: number;
  lastRunAt?: Date;
  owner?: string;
}

export interface TestStep {
  description: string;
  action?: string;
  expectedResult?: string;
  metadata?: Record<string, unknown>;
}

export interface Assertion {
  type: 'equal' | 'notEqual' | 'truthy' | 'falsy' | 'throws' | 'resolves' | 'rejects';
  expected?: unknown;
  actual?: unknown;
  message?: string;
}

export interface TestStrategy {
  type: 'AAA' | 'table-driven' | 'property-based';
  boundaryConditions: BoundaryCondition[];
  edgeCases: EdgeCase[];
  mockStrategy: MockStrategy;
}

export interface BoundaryCondition {
  parameter: string;
  values: unknown[];
  reasoning: string;
}

export interface EdgeCase {
  scenario: string;
  input: unknown;
  expectedBehavior: string;
}

export interface MockStrategy {
  dependencies: string[];
  mockType: 'full' | 'partial' | 'spy';
  mockData: Record<string, unknown>;
}

// ============================================================================
// Test Evaluation Types
// ============================================================================

export interface TestRunResult {
  id: string;
  suiteId: string;
  status: TestStatus;
  coverage: CoverageInfo;
  duration: number;
  qualityScore: QualityScore;
  runAt: Date;
  errors: TestError[];
  passed?: number;
  failed?: number;
  skipped?: number;
  error?: string;
  logs?: string[];
  executedAt?: Date;
  artifacts?: EvaluationArtifact[];
  metadata?: Record<string, unknown>;
  retries?: number;
  triggeredBy?: string;
  environment?: Record<string, unknown>;
  summary?: string;
}

export type TestStatus = 'passed' | 'failed' | 'skipped' | 'timeout';

export interface QualityScore {
  coverage: number;
  assertionQuality: number;
  independence: number;
  stability: number;
  maintainability: number;
  overallScore: number;
  antiPatterns: AntiPattern[];
}

export interface AntiPattern {
  type: AntiPatternType;
  description: string;
  location: CodeLocation;
  severity: 'low' | 'medium' | 'high';
  suggestion: string;
}

export type AntiPatternType =
  | 'over-mocking'
  | 'testing-implementation'
  | 'flaky-test'
  | 'slow-test'
  | 'no-assertions'
  | 'too-many-assertions'
  | 'global-state-dependency';

export interface TestError {
  message: string;
  stack?: string;
  location?: CodeLocation;
}

// ============================================================================
// Improvement & Suggestion Types
// ============================================================================

export interface Improvement {
  id: string;
  suiteId: string;
  type: ImprovementType;
  description: string;
  priority: Priority;
  status: 'pending' | 'applied' | 'rejected';
  estimatedEffort: Effort;
  expectedImpact: Impact;
  createdAt: Date;
  impact?: Impact | string;
  suggestedChanges?: Array<{ filePath: string; diff: string; summary?: string }> | string;
  appliedAt?: Date | null;
  metadata?: Record<string, unknown>;
}

export type ImprovementType =
  | 'add-test-case'
  | 'fix-flaky-test'
  | 'reduce-mocking'
  | 'improve-assertion'
  | 'refactor-test'
  | 'add-coverage';

export type Priority = 'low' | 'medium' | 'high' | 'critical';
export type Effort = 'trivial' | 'low' | 'medium' | 'high';
export type Impact = 'low' | 'medium' | 'high';

// ============================================================================
// LLM & Prompt Types
// ============================================================================

export interface PromptTemplate {
  id: string;
  name: string;
  type: TestType;
  template: string;
  variables: string[];
  examples: PromptExample[];
}

export interface PromptExample {
  input: string;
  output: string;
  explanation: string;
}

export interface LLMRequest {
  provider?: LLMProvider;
  model?: string;
  prompt: string;
  temperature?: number;
  maxTokens?: number;
  context?: unknown[];
  stop?: string[];
  user?: string;
  metadata?: Record<string, unknown>;
  stream?: boolean;
  format?: 'text' | 'json' | 'tool';
}

export interface LLMResponse {
  content: string;
  usage: TokenUsage;
  finishReason: string;
  metadata?: Record<string, unknown>;
  text?: string;
  raw?: unknown;
  cached?: boolean;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

// ============================================================================
// Vector & Embedding Types
// ============================================================================

export interface CodeChunk {
  id: string;
  content: string;
  filePath: string;
  startLine: number;
  endLine: number;
  embedding?: number[];
  functionName?: string;
  metadata?: ChunkMetadata;
  chunkIndex?: number;
  language?: ProgrammingLanguage;
  summary?: string;
  score?: number;
  tokens?: number;
  repoPath?: string;
  projectId?: string;
  source?: 'explicit' | 'semantic' | 'dependency' | 'manual';
  
  // v0.6.0: Additional properties for enhanced features
  name?: string;           // Function/class name (alias for functionName)
  type?: 'function' | 'class' | 'module' | 'method';  // Chunk type
  complexity?: number;     // Cyclomatic complexity
  loc?: number;            // Lines of code
  parameters?: string[];   // Function parameters
  returnType?: string;     // Return type annotation
  imports?: string[];      // Import statements
  exports?: string[];      // Export statements
  dependencies?: string[]; // Dependencies
}

export interface ChunkMetadata {
  type?: 'function' | 'class' | 'module';
  name?: string;
  hasTests?: boolean;
  testQuality?: number;
  language?: ProgrammingLanguage;
  lastModified?: Date | string;
  chunkIndex?: number;
  fileId?: string;
  repoPath?: string;
  projectId?: string;
  coverage?: CoverageInfo;
  tokens?: number;
  failureType?: string;
  failureCount?: number;
  tags?: string[];
  
  // v0.6.0: Additional metadata
  documentation?: string;  // JSDoc or comments
  complexity?: number;     // Cyclomatic complexity (also at chunk level)
  isPublic?: boolean;      // Is this a public API
  callSites?: string[];    // Where this is called
  recentlyModified?: boolean;  // Modified in last N days
  focusScore?: number;
  importance?: 'low' | 'medium' | 'high';
  owner?: string;
  gitCommit?: string;
}

export interface SemanticSearchResult {
  chunk: CodeChunk;
  score: number;
  relevance: number;  // Semantic relevance score (same as score for backward compatibility)
  chunkId?: string;
  filePath?: string;
  content?: string;
  metadata?: ChunkMetadata;
  startLine?: number;
  endLine?: number;
  matchHighlights?: string[];
}

// ================================================================================
// Contract Surface Types
// ================================================================================

export interface ContextSummary {
  projectId: string;
  indexedAt: Date;
  files: FileContext[];
  dependencyGraph: DependencyGraph;
  metrics: ContextMetrics;
  generatedBy?: 'cli' | 'web' | 'api';
}

export interface FileContext {
  filePath: string;
  fragments: FileFragment[];
  dependencies: Dependency[];
  coverage: CoverageInfo;
  complexity: ComplexityMetrics;
  existingTests: TestSuite[];
  summary: string;
}

export interface FileFragment {
  id: string;
  filePath: string;
  startLine: number;
  endLine: number;
  snippet: string;
  tags?: string[];
  metadata?: ChunkMetadata;
}

export interface ContextMetrics {
  totalFiles: number;
  totalDependencies: number;
  totalFunctions: number;
  averageCoverage: number;
  lastUpdated: Date;
}

export interface DependencyGraph {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
  generatedAt: Date;
}

export interface DependencyNode {
  id: string;
  label: string;
  type: 'file' | 'module' | 'package' | 'function';
  metadata?: Record<string, unknown>;
}

export interface DependencyEdge {
  from: string;
  to: string;
  type: 'import' | 'call' | 'extends' | 'implements';
  weight?: number;
  description?: string;
}

export interface GenerationResult {
  id: string;
  projectId: string;
  requestId: string;
  generatedAt: Date;
  targetFilePath: string;
  diff: string;
  summary: string;
  strategy: TestStrategy;
  metadata: GenerationMetadata;
  preview?: DiffPreview;
}

export interface GenerationMetadata {
  provider: LLMProvider;
  model: string;
  temperature: number;
  promptSummary: string;
  warnings?: string[];
  suggestions?: string[];
}

export interface EvaluationReport {
  id: string;
  projectId: string;
  suiteId?: string;
  status: EvaluationStatus;
  runAt: Date;
  durationMs: number;
  coverage: CoverageInfo;
  qualityScore: QualityScore;
  logs: string[];
  artifacts?: EvaluationArtifact[];
  improvements: Improvement[];
}

export type EvaluationStatus = 'passed' | 'failed' | 'flaky' | 'partial';

export interface EvaluationArtifact {
  name: string;
  path: string;
  type: 'log' | 'screenshot' | 'report' | 'trace';
  createdAt: Date;
}

export interface HealingSuggestion {
  id: string;
  projectId: string;
  targetFilePath: string;
  summary: string;
  diff: string;
  confidence: number;
  reason: string;
  createdAt: Date;
  relatedInspectionIds?: string[];
}

// ============================================================================
// Self-Healing Plan Types
// ============================================================================

export type HealingActionType =
  | 'apply_patch'
  | 'update_selector'
  | 'extend_timeout'
  | 'retry'
  | 'manual_review';

export interface FilePatchHunk {
  type: 'context' | 'insert' | 'delete' | 'replace';
  header?: string;
  content: string;
}

export interface FilePatch {
  filePath: string;
  hunks: FilePatchHunk[];
  description?: string;
  metadata?: {
    startLine?: number;
    endLine?: number;
    language?: ProgrammingLanguage;
  };
}

export interface FixCandidate {
  id: string;
  summary: string;
  confidence: number;
  impact: RiskLevel;
  targetFiles: string[];
  patches: FilePatch[];
  reasoning?: string;
  relatedTests?: string[];
  metadata?: Record<string, unknown>;
}

export interface HealingTelemetry {
  classificationTimeMs: number;
  locatorTimeMs: number;
  suggestionTimeMs: number;
  plannerTimeMs?: number;
  executionTimeMs?: number;
  totalTimeMs: number;
  cacheHit: boolean;
  retries?: number;
  successRate?: number;
}

export interface SelfHealingAction {
  id: string;
  type: HealingActionType;
  summary: string;
  confidence: number;
  patch?: FilePatch;
  selectorUpdate?: {
    from: string;
    to: string;
  };
  timeoutUpdate?: {
    from: number;
    to: number;
  };
  metadata?: Record<string, unknown>;
}

export interface SelfHealingPlan {
  id: string;
  failureId: string;
  createdAt: Date;
  updatedAt?: Date;
  status: 'draft' | 'validated' | 'applied' | 'failed';
  actions: SelfHealingAction[];
  candidates: FixCandidate[];
  telemetry: HealingTelemetry;
  notes?: string;
}

export interface DiffPreview {
  id: string;
  projectId: string;
  diff: string;
  files: DiffFile[];
  summary: string;
  riskLevel: RiskLevel;
  metadata?: Record<string, unknown>;
}

export interface DiffFile {
  filePath: string;
  status: 'modified' | 'added' | 'removed';
  diff: string;
  additions: number;
  deletions: number;
}

export type RiskLevel = 'low' | 'medium' | 'high';

export interface TestRunHistory {
  timestamp: Date;
  passed: boolean;
  duration: number;
  errorMessage?: string;
}

export interface TestFailure {
  testName: string;
  testFile: string;
  errorMessage: string;
  stackTrace: string;
  screenshot?: string;
  timestamp: Date;
  selector?: string;
  expectedValue?: unknown;
  actualValue?: unknown;
  timeout?: number;
  previousRuns?: TestRunHistory[];
  metadata?: Record<string, unknown>;
}

export interface TestGenerationResult {
  id: string;
  suites: TestSuite[];
  generatedAt: Date;
  summary: string;
  metadata?: Record<string, unknown>;
  provider?: LLMProvider;
  model?: string;
  diffPreview?: DiffPreview;
}

export interface TestExecutionResult {
  id: string;
  suiteId: string;
  status: TestStatus;
  startedAt?: Date;
  completedAt?: Date;
  durationMs?: number;
  errors?: TestError[];
  logs?: string[];
  coverage?: CoverageInfo;
  artifacts?: EvaluationArtifact[];
  metadata?: Record<string, unknown>;
}

export interface GitActionPlan {
  id: string;
  projectId: string;
  branchName: string;
  commitMessage: string;
  commands: string[];
  files: string[];
  status: GitActionStatus;
  createdAt: Date;
  actor?: string;
}

export type GitActionStatus = 'planned' | 'applied' | 'reverted';

// ============================================================================
// CLI Types
// ============================================================================

export interface CLICommand {
  name: string;
  description: string;
  options: CLIOption[];
  action: (...args: unknown[]) => Promise<void>;
}

export interface CLIOption {
  flags: string;
  description: string;
  defaultValue?: unknown;
  required?: boolean;
}

// ============================================================================
// Error Types
// ============================================================================

export class TestMindError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'TestMindError';
  }
}

export class AnalysisError extends TestMindError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'ANALYSIS_ERROR', details);
    this.name = 'AnalysisError';
  }
}

export class GenerationError extends TestMindError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'GENERATION_ERROR', details);
    this.name = 'GenerationError';
  }
}

export class EvaluationError extends TestMindError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'EVALUATION_ERROR', details);
    this.name = 'EvaluationError';
  }
}

// ============================================================================
// Skill Framework Types
// ============================================================================

export type {
  TestSkill,
  SkillMetadata,
  TestContext,
  ValidationResult,
  ImprovementSuggestion,
  SkillContext,
  SkillLoadOptions,
  TestFramework as SkillTestFramework,
} from './skill';











