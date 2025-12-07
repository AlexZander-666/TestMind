import type {
  TestContext,
  TestSkill,
  TestSuite,
  ValidationResult,
} from '@testmind/shared';
import { afterEach, describe, expect, it } from 'vitest';

import { BaseSkill, type SkillContext, type SkillResult } from '../Skill';
import { SkillOrchestrator } from '../SkillOrchestrator';
import { SkillRegistry } from '../SkillRegistry';

class AlwaysFailsSkill extends BaseSkill {
  readonly name = 'always-fails';
  readonly description = 'Throws synchronously to test error bubbling';
  readonly category = 'testing' as const;
  readonly version = '0.0.1';

  async execute(): Promise<SkillResult> {
    throw new Error('simulated failure');
  }
}

class ValidationGuardSkill extends BaseSkill {
  readonly name = 'validation-guard';
  readonly description = 'Rejects contexts without target files';
  readonly category = 'testing' as const;
  readonly version = '0.0.1';

  canHandle(): boolean {
    return true;
  }

  async validate(context: SkillContext): Promise<string | null> {
    return context.targetFiles.length === 0 ? 'target files missing' : null;
  }

  async execute(): Promise<SkillResult> {
    return this.success('validated');
  }
}

const createExplodingTestSkill = (name: string): TestSkill => ({
  metadata: {
    name,
    version: '0.0.1',
    description: 'Throws during generateTest to test adapter error handling',
    author: 'contracts',
    supportedFrameworks: ['vitest'],
    supportedLanguages: ['typescript'],
  },
  canHandle: () => true,
  async generateTest(context: TestContext): Promise<TestSuite> {
    if (!context.filePath) {
      throw new Error('filePath missing');
    }
    return {
      id: `${name}-suite`,
      projectId: context.projectId ?? 'demo',
      targetEntityId: context.filePath,
      testType: context.testType ?? 'unit',
      framework: context.framework ?? 'vitest',
      code: '// adapter test',
      filePath: context.filePath,
      generatedAt: new Date(),
      generatedBy: 'ai',
      metadata: {},
    };
  },
  async validateTest(): Promise<ValidationResult> {
    return { valid: true, issues: [] };
  },
});

afterEach(() => {
  delete process.env.SKILL_ADAPTER_EXPERIMENTAL;
});

describe('SkillOrchestrator contracts', () => {
  it('propagates skill execution errors with telemetry', async () => {
    const registry = new SkillRegistry();
    registry.register(new AlwaysFailsSkill());
    const orchestrator = new SkillOrchestrator(registry);

    const context: SkillContext = {
      projectPath: process.cwd(),
      projectConfig: {},
      targetFiles: ['src/error.ts'],
      userPrompt: 'run failing skill',
    };

    const result = await orchestrator.executeSkill('always-fails', context);
    expect(result.success).toBe(false);
    expect(result.metadata?.error).toContain('simulated failure');
  });

  it('returns validation errors without invoking execute', async () => {
    const registry = new SkillRegistry();
    registry.register(new ValidationGuardSkill());
    const orchestrator = new SkillOrchestrator(registry);

    const context: SkillContext = {
      projectPath: process.cwd(),
      projectConfig: {},
      targetFiles: [],
      userPrompt: 'fail validation',
    };

    const result = await orchestrator.executeSkill('validation-guard', context);
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/Validation failed/i);
  });

  it('surfaces adapter context mapping errors when TestSkill throws', async () => {
    const registry = new SkillRegistry();
    registry.registerTestSkill(createExplodingTestSkill('adapter-error'), {
      enable: true,
    });
    const orchestrator = new SkillOrchestrator(registry);

    const context: SkillContext = {
      projectPath: process.cwd(),
      projectConfig: {},
      targetFiles: [],
      userPrompt: 'auto execute adapter skill',
    };

    const result = await orchestrator.executeAuto(context);
    expect(result.success).toBe(false);
    expect(result.message).toContain('Test skill "adapter-error" failed: filePath missing');
    expect(result.metadata?.name).toBe('Error');
  });
});
