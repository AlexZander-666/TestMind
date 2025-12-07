import type { TestContext } from '@testmind/shared';

/**
 * Placeholder prompt for Cypress generation.
 * Promotes transparency instead of leaving the file empty.
 */
export function buildCypressE2EPrompt(
  context: Partial<TestContext> & { targetFiles?: string[]; userPrompt?: string },
): string {
  const baseUrl = context.url ?? context.baseUrl ?? '<url>';
  const flow = context.userFlow ?? 'User performs the described steps.';

  return [
    '# TestMind Cypress Prompt (Placeholder)',
    '',
    'You are TestMind, an AI that writes maintainable Cypress E2E tests.',
    'The real prompt builder will be implemented per plan.md §2.4.2.',
    '',
    '## Project Context',
    `- Base URL: ${baseUrl}`,
    `- Target file(s): ${(context.targetFiles ?? []).join(', ') || 'not provided'}`,
    `- Flow: ${flow}`,
    '',
    '## Output Requirements',
    '1. Generate a Cypress spec using TypeScript + ESM syntax.',
    '2. Favor data-testid selectors; never use brittle CSS paths.',
    '3. Include comments explaining healing hooks (plan.md §2.3).',
    '',
    '## TODO',
    '- Replace this static template with dynamic sections pulled from ContextEngine.',
  ].join('\n');
}
