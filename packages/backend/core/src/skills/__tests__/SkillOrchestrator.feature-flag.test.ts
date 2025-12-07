import { afterEach, describe, expect, it } from 'vitest';

import type { SkillContext } from '../Skill';
import { SkillOrchestrator } from '../SkillOrchestrator';
import { SkillRegistry } from '../SkillRegistry';
import { FakeTestSkill } from '../built-in';

const minimalContext: SkillContext = {
  projectPath: process.cwd(),
  projectConfig: {},
  targetFiles: ['src/example.ts'],
  userPrompt: 'stabilize selector',
  analysisResult: undefined,
  hybridContext: undefined,
};

afterEach(() => {
  delete process.env.SKILL_ADAPTER_EXPERIMENTAL;
});

describe('SkillOrchestrator feature flag guard', () => {
  it('returns a feature-flag error when a skill is not enabled', async () => {
    process.env.SKILL_ADAPTER_EXPERIMENTAL = 'some-other-skill';

    const registry = new SkillRegistry();
    const orchestrator = new SkillOrchestrator(registry);
    const fakeSkill = new FakeTestSkill({
      requestId: 'ff-request',
      testName: 'stabilizes login flow',
      testFile: 'tests/e2e/login.spec.ts',
      selector: '#legacy-selector',
      stabilizedSelector: '[data-testid="login-submit"]',
      userPrompt: 'stabilize selector',
    });

    registry.register(fakeSkill);
    expect(registry.isSkillEnabled(fakeSkill.name)).toBe(false);

    const result = await orchestrator.executeSkill(fakeSkill.name, minimalContext);

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/disabled/i);
    expect(result.metadata?.featureFlag?.experimentalSkills).toContain('some-other-skill');
  });
});
