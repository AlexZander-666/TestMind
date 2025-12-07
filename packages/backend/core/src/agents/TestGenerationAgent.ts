import type { TestContext } from '@testmind/shared';

import type { SkillContext } from '../skills/Skill';

export interface TestGenerationAgentOptions {
  defaultFramework?: string;
  defaultTestType?: TestContext['testType'];
}

export interface BuildSkillContextInput {
  projectPath: string;
  userPrompt: string;
  targetFiles: string[];
  projectConfig?: SkillContext['projectConfig'];
  naturalLanguageRequest?: string;
  hybridContext?: SkillContext['hybridContext'];
  analysisResult?: SkillContext['analysisResult'];
}

/**
 * TestGenerationAgent 负责在技能上下文与 TestContext 之间转换。
 * 这允许编排器以类型安全的方式把技能结果交给自愈/生成管线。
 */
export class TestGenerationAgent {
  private readonly defaultFramework: string;
  private readonly defaultTestType: TestContext['testType'];

  constructor(options: TestGenerationAgentOptions = {}) {
    this.defaultFramework = options.defaultFramework ?? 'vitest';
    this.defaultTestType = options.defaultTestType ?? 'unit';
  }

  buildSkillContext(input: BuildSkillContextInput): SkillContext {
    const targetFiles = Array.from(new Set(input.targetFiles)).filter(Boolean);
    if (targetFiles.length === 0) {
      throw new Error('TestGenerationAgent requires at least one target file.');
    }

    const userPrompt = input.userPrompt.trim();
    if (!userPrompt) {
      throw new Error('TestGenerationAgent requires a non-empty user prompt.');
    }

    return {
      projectPath: input.projectPath,
      projectConfig: input.projectConfig ?? {},
      targetFiles,
      userPrompt,
      naturalLanguageRequest: input.naturalLanguageRequest ?? userPrompt,
      hybridContext: input.hybridContext,
      analysisResult: input.analysisResult,
    };
  }

  validateSkillContext(context: SkillContext): void {
    if (!context.projectPath) {
      throw new Error('SkillContext.projectPath is required.');
    }

    if (!context.targetFiles || context.targetFiles.length === 0) {
      throw new Error('SkillContext.targetFiles must contain at least one file.');
    }

    if (!context.userPrompt) {
      throw new Error('SkillContext.userPrompt is required.');
    }
  }

  /**
   * 将 SkillContext 转换为 TestContext（可组合 CLI/SDK 输入）。
   */
  toTestContext(
    context: SkillContext,
    overrides: Partial<TestContext> = {},
  ): TestContext {
    this.validateSkillContext(context);

    const primaryFile = overrides.filePath ?? context.targetFiles[0];
    const projectId =
      overrides.projectId ??
      (context.projectConfig as { id?: string })?.id ??
      'unknown-project';

    return {
      projectId,
      testType: overrides.testType ?? this.defaultTestType,
      framework: overrides.framework ?? this.resolveFramework(context),
      filePath: primaryFile,
      componentPath: overrides.componentPath ?? context.analysisResult?.componentPath,
      componentCode: overrides.componentCode ?? context.analysisResult?.componentCode,
      componentName: overrides.componentName ?? context.analysisResult?.componentName,
      props: overrides.props ?? context.analysisResult?.props,
      hooks: overrides.hooks ?? context.analysisResult?.hooks,
      url: overrides.url ?? context.analysisResult?.url,
      userFlow:
        overrides.userFlow ??
        context.analysisResult?.userFlow ??
        context.naturalLanguageRequest ??
        context.userPrompt,
      expectedBehavior: overrides.expectedBehavior,
      browsers: overrides.browsers,
      viewport: overrides.viewport,
      pageElements: overrides.pageElements,
      baseUrl: overrides.baseUrl ?? (context.projectConfig as { baseUrl?: string })?.baseUrl,
      endpoints: overrides.endpoints,
      authentication: overrides.authentication,
      endpoint: overrides.endpoint,
      operations: overrides.operations,
      schema: overrides.schema,
      functionName: overrides.functionName ?? context.targetFunctions?.[0]?.name,
      apiEndpoints: overrides.apiEndpoints ?? context.analysisResult?.apiEndpoints,
    };
  }

  private resolveFramework(context: SkillContext): string {
    const configFramework = (context.projectConfig as { testFramework?: string })?.testFramework;
    return configFramework ?? this.defaultFramework;
  }
}
