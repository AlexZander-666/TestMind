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
export type TestFramework = 'jest' | 'vitest' | 'pytest' | 'junit' | 'mocha';
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
}

export interface FunctionSignature {
  name: string;
  filePath: string;
  parameters: Parameter[];
  returnType?: string;
  isAsync: boolean;
  documentation?: string;
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
}

export type TestType = 'unit' | 'integration' | 'e2e' | 'api';

export interface TestMetadata {
  targetFunction?: string;
  targetClass?: string;
  dependencies: string[];
  mocks: string[];
  fixtures: string[];
  estimatedRunTime: number;
}

export interface TestCase {
  name: string;
  description: string;
  assertions: Assertion[];
  setup?: string;
  teardown?: string;
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
  provider: LLMProvider;
  model: string;
  prompt: string;
  temperature: number;
  maxTokens: number;
  context?: unknown[];
}

export interface LLMResponse {
  content: string;
  usage: TokenUsage;
  finishReason: string;
  metadata?: Record<string, unknown>;
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
  embedding: number[];
  metadata: ChunkMetadata;
}

export interface ChunkMetadata {
  type: 'function' | 'class' | 'module';
  name: string;
  hasTests: boolean;
  testQuality?: number;
  language: ProgrammingLanguage;
}

export interface SemanticSearchResult {
  chunk: CodeChunk;
  score: number;
  relevance: number;
}

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
    public details?: Record<string, unknown>
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



























