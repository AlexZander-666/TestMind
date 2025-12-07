import type { TestSkill, TestContext, TestSuite, ValidationResult, SkillMetadata } from '@testmind/shared';

import { createComponentLogger, Logger } from '../utils/logger';

import type { Skill, SkillContext, SkillResult, CodeChange } from './Skill';

type ExtendedSkillContext = SkillContext & Partial<TestContext> & {
  projectId?: string;
  framework?: string;
  frameworkVersion?: string;
  testPlanId?: string;
  testContextOverrides?: Partial<TestContext>;
  apiBaseUrl?: string;
  targetTestFile?: string;
  metadata?: Record<string, unknown>;
};

export interface TestSkillAdapterOptions {
  /**
   * Default test type when context does not specify one
   */
  defaultTestType?: TestContext['testType'];

  /**
   * Default framework fallback
   */
  defaultFramework?: string;

  /**
   * Allow caller to inject additional metadata for debugging
   */
  metadata?: Record<string, unknown>;
}

const DEFAULT_TEST_TYPE: TestContext['testType'] = 'unit';

/**
 * Wraps a {@link TestSkill} so it can be consumed through the generic {@link Skill} interface.
 */
export class TestSkillAdapter implements Skill {
  readonly category = 'testing' as const;
  readonly name: string;
  readonly description: string;
  readonly version: string;
  readonly author?: string;
  readonly metadata: SkillMetadata;

  private readonly logger: Logger;

  constructor(
    private readonly testSkill: TestSkill,
    private readonly options: TestSkillAdapterOptions = {},
  ) {
    this.name = testSkill.metadata.name;
    this.description = testSkill.metadata.description;
    this.version = testSkill.metadata.version;
    this.author = testSkill.metadata.author;
    this.metadata = testSkill.metadata;
    this.logger = createComponentLogger(`TestSkillAdapter:${this.name}`);
  }

  /**
   * Map SkillContext to TestContext and delegate to the underlying skill.
   */
  async canHandle(context: SkillContext): Promise<boolean> {
    try {
      const testContext = this.toTestContext(context);
      return Boolean(this.testSkill.canHandle(testContext));
    } catch (error) {
      this.logger.warn('Failed to evaluate canHandle', { error });
      return false;
    }
  }

  /**
   * Execute the wrapped test skill and convert the output into {@link SkillResult}.
   */
  async execute(context: SkillContext): Promise<SkillResult> {
    const testContext = this.toTestContext(context);

    try {
      this.logger.info('Executing wrapped test skill', {
        skill: this.name,
        testType: testContext.testType,
        framework: testContext.framework,
        target: testContext.filePath,
      });

      const suite = await this.testSkill.generateTest(testContext);
      const validation = await this.testSkill.validateTest(suite.code);

      if (!validation.valid) {
        return {
          success: false,
          message: `Generated tests failed validation: ${validation.issues.join('; ')}`,
          metadata: {
            validation,
            skill: this.testSkill.metadata.name,
          },
        };
      }

      const changes = [this.toCodeChange(suite)];

      return {
        success: true,
        message: `Test suite generated via ${this.name}`,
        changes,
        metadata: this.buildMetadata(testContext, validation, suite),
      };
    } catch (error: any) {
      const normalized = this.normalizeError(error);
      return {
        success: false,
        message: normalized.message,
        metadata: normalized.metadata,
      };
    }
  }

  private toTestContext(context: SkillContext): TestContext {
    const extended = context as ExtendedSkillContext;
    const projectConfig = extended.projectConfig ?? (extended as { config?: Record<string, any> }).config ?? {};

    const firstTarget = context.targetFiles?.[0];

    const testContext: TestContext = {
      projectId: extended.projectId ?? (projectConfig as any)?.id ?? 'unknown-project',
      testType: extended.testType ?? this.options.defaultTestType ?? DEFAULT_TEST_TYPE,
      framework: extended.framework ?? (projectConfig as any)?.testFramework ?? this.options.defaultFramework,
      filePath: extended.targetTestFile ?? firstTarget,
      componentPath: extended.componentPath ?? firstTarget,
      componentName: extended.componentName ?? extended.targetFunctions?.[0]?.name,
      componentCode: extended.componentCode,
      props: extended.props,
      hooks: extended.hooks,
      children: extended.children,
      url: extended.url,
      userFlow: extended.userFlow ?? extended.naturalLanguageRequest ?? extended.userPrompt,
      expectedBehavior: extended.expectedBehavior,
      browsers: extended.browsers,
      viewport: extended.viewport,
      pageElements: extended.pageElements,
      baseUrl: extended.baseUrl ?? extended.apiBaseUrl,
      endpoints: extended.endpoints ?? extended.apiEndpoints,
      authentication: extended.authentication,
      endpoint: extended.endpoint,
      operations: extended.operations,
      schema: extended.schema,
      functionName: extended.functionName ?? extended.targetFunctions?.[0]?.name,
    };

    if (extended.testContextOverrides) {
      Object.assign(testContext, extended.testContextOverrides);
    }

    return testContext;
  }

  private toCodeChange(suite: TestSuite): CodeChange {
    return {
      type: 'create',
      path: suite.filePath,
      content: suite.code,
      description: `Generated by ${this.name}`,
    };
  }

  private buildMetadata(
    context: TestContext,
    validation: ValidationResult,
    suite: TestSuite,
  ): Record<string, unknown> {
    return {
      adapter: 'test-skill',
      testSkill: this.testSkill.metadata,
      context,
      validation,
      suite: {
        id: suite.id,
        filePath: suite.filePath,
        testType: suite.testType,
        framework: suite.framework,
      },
      ...this.options.metadata,
    };
  }

  private normalizeError(error: unknown): { message: string; metadata: Record<string, unknown> } {
    if (error instanceof Error) {
      return {
        message: `Test skill "${this.name}" failed: ${error.message}`,
        metadata: {
          name: error.name,
          stack: error.stack,
        },
      };
    }

    return {
      message: `Test skill "${this.name}" failed with unknown error`,
      metadata: { error },
    };
  }
}

export const createTestSkillAdapter = (
  skill: TestSkill,
  options?: TestSkillAdapterOptions,
): TestSkillAdapter => new TestSkillAdapter(skill, options);
