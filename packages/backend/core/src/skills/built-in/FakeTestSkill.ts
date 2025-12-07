import type {
  TestContext,
  TestFramework,
  TestSkill,
  TestSuite,
  ValidationResult,
} from '@testmind/shared';

import { BaseSkill, type SkillContext, type SkillResult } from '../Skill';

/**
 * FakeTestSkill - Legacy demo stub
 *
 * This fixture was used by the experimental self-healing flow but the real
 * implementation depends on heavy browser automation mocks that currently block
 * type-checking. To keep the public API stable we expose a lightweight stub
 * that logs intent and returns deterministic placeholder objects.
 */
export class FakeTestSkill extends BaseSkill implements TestSkill {
  readonly name = 'fake-test-skill';
  readonly description =
    'Stub implementation kept for compatibility with legacy self-healing demos.';
  readonly category = 'testing' as const;
  readonly version = '0.0.0-experimental';
  readonly author = 'TestMind Experimental';

  readonly metadata = {
    name: this.name,
    version: this.version,
    description: this.description,
    author: this.author,
    supportedFrameworks: ['playwright'] as const,
    supportedLanguages: ['typescript'] as const,
    tags: ['experimental', 'stub'],
  };

  canHandle(_context: SkillContext | TestContext): boolean {
    return false;
  }

  async execute(_context: SkillContext): Promise<SkillResult> {
    this.log('FakeTestSkill is stubbed and does not execute any browser actions');
    return {
      success: false,
      message: 'FakeTestSkill is not available in this build.',
      metadata: {
        skillName: this.name,
        experimental: true,
      },
    };
  }

  async generateTest(context: TestContext): Promise<TestSuite> {
    const allowedFrameworks: TestFramework[] = [
      'jest',
      'vitest',
      'pytest',
      'junit',
      'mocha',
      'cypress',
      'playwright',
    ];

    const framework = allowedFrameworks.includes(context.framework as TestFramework)
      ? (context.framework as TestFramework)
      : 'playwright';

    return {
      id: `fake-skill-${context.projectId ?? 'unknown'}`,
      projectId: context.projectId ?? 'unknown-project',
      targetEntityId: context.filePath ?? 'unknown-file',
      testType: context.testType ?? 'e2e',
      framework,
      code: '// FakeTestSkill stub: no test generated',
      filePath: context.filePath ?? 'tests/fake-skill.stub.ts',
      generatedAt: new Date(),
      generatedBy: 'ai',
      metadata: {
        skill: this.name,
        experimental: true,
      },
    };
  }

  async validateTest(_testCode: string): Promise<ValidationResult> {
    return {
      valid: false,
      issues: ['FakeTestSkill is a placeholder and cannot validate tests.'],
      warnings: [],
    };
  }
}

export const fakeTestSkill = new FakeTestSkill();
