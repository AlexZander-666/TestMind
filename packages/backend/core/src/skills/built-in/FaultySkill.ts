import type {
  TestContext,
  TestSkill,
  TestSuite,
  ValidationResult,
} from '@testmind/shared';

import { BaseSkill, type SkillContext, type SkillResult } from '../Skill';

export interface FaultySkillOptions {
  failMessage?: string;
}

export class FaultySkill extends BaseSkill implements TestSkill {
  readonly name = 'faulty-skill';
  readonly description =
    'Intentionally throws to exercise orchestrator rollback and error telemetry.';
  readonly category = 'testing' as const;
  readonly version = '0.1.0';
  readonly author = 'TestMind QA';

  readonly metadata = {
    name: this.name,
    version: this.version,
    description: this.description,
    author: this.author,
    supportedFrameworks: ['playwright'] as const,
    supportedLanguages: ['typescript'] as const,
    tags: ['self-healing', 'fixtures', 'negative-path'],
  };

  constructor(private readonly options: FaultySkillOptions = {}) {
    super();
  }

  canHandle(): boolean {
    return true;
  }

  async execute(context: SkillContext): Promise<SkillResult> {
    this.log('Intentionally triggering failure', {
      projectPath: context.projectPath,
    });

    throw new Error(this.options.failMessage ?? 'Faulty skill executed');
  }

  async generateTest(_context: TestContext): Promise<TestSuite> {
    throw new Error('FaultySkill does not generate tests');
  }

  async validateTest(): Promise<ValidationResult> {
    return {
      valid: false,
      issues: ['FaultySkill only exists for regression paths'],
      warnings: [],
    };
  }
}
