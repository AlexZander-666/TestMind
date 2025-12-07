import type { TestContext } from '@testmind/shared';

type PlaywrightPromptContext = Partial<TestContext> & {
  targetFiles?: string[];
  userPrompt?: string;
};

export function buildPlaywrightPrompt(context: PlaywrightPromptContext): string {
  const browsers = (context.browsers ?? ['chromium']).join(', ');

  return [
    '# TestMind Playwright Prompt (Placeholder)',
    '',
    'You are TestMind, generating Playwright tests that align with the diff-first workflow.',
    'Follow plan.md §2.4.2 to replace this template with contextual prompts.',
    '',
    '## Execution Targets',
    `- Browsers: ${browsers}`,
    `- Target files: ${(context.targetFiles ?? []).join(', ') || 'n/a'}`,
    `- User prompt: ${context.userPrompt ?? 'N/A'}`,
    '',
    '## Expectations',
    '1. Use Playwright Test runner with TypeScript.',
    '2. Capture screenshots when healing requires visual confirmation.',
    '3. Emit helpful test.step annotations for undo/analysis tooling.',
  ].join('\n');
}
