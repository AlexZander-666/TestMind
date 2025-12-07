import type { TestContext } from '@testmind/shared';

export function buildRestApiPrompt(context: Partial<TestContext>): string {
  const baseUrl = context.baseUrl ?? 'http://localhost:3000';
  const endpoints = (context.endpoints ?? []).length;

  return [
    '# TestMind REST API Prompt (Placeholder)',
    '',
    `Base URL: ${baseUrl}`,
    `Detected endpoints: ${endpoints}`,
    '',
    '## Expectations',
    '1. Use Vitest + supertest style syntax by default.',
    '2. Include schema validation once OpenApiParser is wired (plan.md §2.4.2).',
    '3. Demonstrate happy-path + failure-path assertions.',
    '',
    '## TODO',
    '- Replace with context-aware sections when Database + SemanticIndexer expose endpoint metadata.',
  ].join('\n');
}
