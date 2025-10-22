/**
 * Vue 测试生成专用 Prompts
 */

import type { VueComponentMetadata } from '../VueComponentAnalyzer';

export interface VueTestPromptContext {
  metadata: VueComponentMetadata;
  vueVersion: 2 | 3;
  framework: 'vitest' | 'jest';
  testingLibrary: '@vue/test-utils' | 'vue-testing-library';
}

/**
 * 生成 Composition API 测试 Prompt
 */
export function buildCompositionAPITestPrompt(context: VueTestPromptContext): string {
  const { metadata, framework } = context;

  return `Generate comprehensive tests for a Vue 3 Composition API component.

Component: ${metadata.name}

Props:
${metadata.props.map(p => `- ${p.name}: ${p.type}${p.required ? ' (required)' : ''}`).join('\n')}

Emits:
${metadata.emits.map(e => `- ${e.name}`).join('\n')}

Composables:
${metadata.composables.map(c => `- ${c.name}`).join('\n')}

Generate tests using ${framework} and @vue/test-utils that cover:
1. Component rendering
2. Props validation
3. Event emission
4. Composables behavior
5. Reactive state updates

Use modern Vue 3 testing patterns.`;
}

/**
 * 生成 Options API 测试 Prompt
 */
export function buildOptionsAPITestPrompt(context: VueTestPromptContext): string {
  const { metadata, framework } = context;

  return `Generate comprehensive tests for a Vue ${context.vueVersion} Options API component.

Component: ${metadata.name}

Data:
${metadata.computed.map(c => `- ${c} (computed)`).join('\n')}

Methods:
${metadata.lifecycle.map(h => `- ${h} (lifecycle)`).join('\n')}

Generate tests using ${framework} and @vue/test-utils that cover:
1. Component mounting
2. Data reactivity
3. Computed properties
4. Methods execution
5. Lifecycle hooks

Use traditional Vue ${context.vueVersion} testing patterns.`;
}

/**
 * 生成 Pinia Store 集成测试 Prompt
 */
export function buildPiniaIntegrationTestPrompt(
  componentName: string,
  stores: string[]
): string {
  return `Generate tests for Vue component ${componentName} that uses Pinia stores: ${stores.join(', ')}.

Include:
1. Mock store setup
2. Component interaction with store
3. Store state changes
4. Store actions calls

Use createPinia() and setActivePinia() for test setup.`;
}

/**
 * 生成用户交互测试 Prompt
 */
export function buildUserInteractionTestPrompt(
  componentName: string,
  interactions: string[]
): string {
  return `Generate user interaction tests for ${componentName}.

Test these interactions:
${interactions.map((i, idx) => `${idx + 1}. ${i}`).join('\n')}

Use:
- await wrapper.find(...).trigger('click')
- await wrapper.find('input').setValue(...)
- await nextTick() for reactive updates
- expect(wrapper.emitted('...')).toBeTruthy()`;
}

