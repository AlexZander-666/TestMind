import { BaseSkill, type SkillContext, type SkillResult } from './Skill';

const PLACEHOLDER_VERSION = '0.9.0-beta';

export class RestApiTestSkill extends BaseSkill {
  readonly name = 'rest-api-placeholder';
  readonly description = 'REST API skill placeholder (plan.md §2.4.2).';
  readonly category = 'testing' as const;
  readonly version = PLACEHOLDER_VERSION;
  readonly author = 'TestMind';

  canHandle(context: SkillContext): boolean {
    return context.testType === 'api' || (context.framework ?? '').toLowerCase() === 'supertest';
  }

  async execute(context: SkillContext): Promise<SkillResult> {
    this.log('RestApiTestSkill placeholder invoked', {
      endpoints: context.endpoints?.length ?? 0,
      baseUrl: context.baseUrl,
    });

    return this.failure(
      'REST API skill is not implemented yet. Track progress via plan.md §2.4.2.',
      { planRef: 'plan.md §2.4.2 · RestApiTestSkill placeholder' },
    );
  }
}
