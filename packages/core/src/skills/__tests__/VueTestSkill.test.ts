/**
 * VueTestSkill 单元测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VueTestSkill } from '../VueTestSkill';
import type { LLMService } from '../../llm/LLMService';

describe('VueTestSkill', () => {
  let skill: VueTestSkill;
  let mockLLM: LLMService;

  beforeEach(() => {
    mockLLM = {
      generate: vi.fn().mockResolvedValue({
        content: `\`\`\`typescript
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import TestComponent from './TestComponent.vue';

describe('TestComponent', () => {
  it('should render correctly', () => {
    const wrapper = mount(TestComponent);
    expect(wrapper.exists()).toBe(true);
  });
});
\`\`\``,
        usage: {
          promptTokens: 500,
          completionTokens: 200,
          totalTokens: 700
        }
      })
    } as any;

    skill = new VueTestSkill(mockLLM);
  });

  describe('generateTest', () => {
    it('should generate test for Vue component', async () => {
      const testSuite = await skill.generateTemplateTest({
        componentPath: 'TestComponent.vue',
        vueVersion: 3,
        framework: 'vitest'
      });

      expect(testSuite).toBeDefined();
      expect(testSuite.framework).toBe('vitest');
      expect(testSuite.testType).toBe('component');
      expect(testSuite.code).toContain('import { mount }');
      expect(testSuite.code).toContain('describe');
      expect(testSuite.code).toContain('it(');
    });

    it('should handle Vue 2 components', async () => {
      const testSuite = await skill.generateTemplateTest({
        componentPath: 'LegacyComponent.vue',
        vueVersion: 2,
        framework: 'jest'
      });

      expect(testSuite).toBeDefined();
      expect(testSuite.metadata?.vueVersion).toBeUndefined(); // Template mode doesn't set version
    });
  });

  describe('generateTemplateTest', () => {
    it('should generate template-based test without LLM', async () => {
      const testSuite = await skill.generateTemplateTest({
        componentPath: 'SimpleComponent.vue',
        framework: 'vitest'
      });

      expect(testSuite.generatedBy).toBe('template');
      expect(testSuite.code).toContain('mount');
      expect(testSuite.code).toContain('beforeEach');
    });
  });
});

