/**
 * Zod schemas for runtime validation
 */

import { z } from 'zod';

// ============================================================================
// Configuration Schemas
// ============================================================================

export const ProjectSettingsSchema = z.object({
  includePatterns: z.array(z.string()),
  excludePatterns: z.array(z.string()),
  testDirectory: z.string(),
  coverageThreshold: z.number().min(0).max(100),
  maxFileSize: z.number().positive(),
  llmProvider: z.enum(['openai', 'anthropic', 'ollama', 'custom']),
  llmModel: z.string(),
});

export const ProjectConfigSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  repoPath: z.string().min(1),
  language: z.enum(['typescript', 'javascript', 'python', 'java']),
  testFramework: z.enum(['jest', 'vitest', 'pytest', 'junit', 'mocha']),
  indexedAt: z.date().optional(),
  config: ProjectSettingsSchema,
});

// ============================================================================
// Test Generation Schemas
// ============================================================================

export const TestMetadataSchema = z.object({
  targetFunction: z.string().optional(),
  targetClass: z.string().optional(),
  dependencies: z.array(z.string()),
  mocks: z.array(z.string()),
  fixtures: z.array(z.string()),
  estimatedRunTime: z.number().nonnegative(),
});

export const TestSuiteSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  targetEntityId: z.string().uuid(),
  testType: z.enum(['unit', 'integration', 'e2e', 'api']),
  framework: z.enum(['jest', 'vitest', 'pytest', 'junit', 'mocha']),
  code: z.string().min(1),
  filePath: z.string().min(1),
  generatedAt: z.date(),
  generatedBy: z.enum(['ai', 'human', 'hybrid']),
  metadata: TestMetadataSchema,
});

// ============================================================================
// LLM Schemas
// ============================================================================

export const LLMRequestSchema = z.object({
  provider: z.enum(['openai', 'anthropic', 'ollama', 'custom']),
  model: z.string(),
  prompt: z.string().min(1),
  temperature: z.number().min(0).max(2),
  maxTokens: z.number().positive(),
  context: z.array(z.unknown()).optional(),
});

export const TokenUsageSchema = z.object({
  promptTokens: z.number().nonnegative(),
  completionTokens: z.number().nonnegative(),
  totalTokens: z.number().nonnegative(),
});

export const LLMResponseSchema = z.object({
  content: z.string(),
  usage: TokenUsageSchema,
  finishReason: z.string(),
  metadata: z.record(z.unknown()).optional(),
});

// ============================================================================
// Quality & Evaluation Schemas
// ============================================================================

export const CoverageInfoSchema = z.object({
  linesCovered: z.number().nonnegative(),
  linesTotal: z.number().nonnegative(),
  branchesCovered: z.number().nonnegative(),
  branchesTotal: z.number().nonnegative(),
  functionsCovered: z.number().nonnegative(),
  functionsTotal: z.number().nonnegative(),
  percentage: z.number().min(0).max(100),
});

export const AntiPatternSchema = z.object({
  type: z.enum([
    'over-mocking',
    'testing-implementation',
    'flaky-test',
    'slow-test',
    'no-assertions',
    'too-many-assertions',
    'global-state-dependency',
  ]),
  description: z.string(),
  location: z.object({
    filePath: z.string(),
    line: z.number(),
    column: z.number(),
  }),
  severity: z.enum(['low', 'medium', 'high']),
  suggestion: z.string(),
});

export const QualityScoreSchema = z.object({
  coverage: z.number().min(0).max(100),
  assertionQuality: z.number().min(0).max(1),
  independence: z.number().min(0).max(1),
  stability: z.number().min(0).max(1),
  maintainability: z.number().min(0).max(1),
  overallScore: z.number().min(0).max(100),
  antiPatterns: z.array(AntiPatternSchema),
});

export const TestRunResultSchema = z.object({
  id: z.string().uuid(),
  suiteId: z.string().uuid(),
  status: z.enum(['passed', 'failed', 'skipped', 'timeout']),
  coverage: CoverageInfoSchema,
  duration: z.number().nonnegative(),
  qualityScore: QualityScoreSchema,
  runAt: z.date(),
  errors: z.array(
    z.object({
      message: z.string(),
      stack: z.string().optional(),
      location: z
        .object({
          filePath: z.string(),
          line: z.number(),
          column: z.number(),
        })
        .optional(),
    })
  ),
});



























