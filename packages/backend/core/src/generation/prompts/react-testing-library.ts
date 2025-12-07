import type { TestContext } from '@testmind/shared';

export function buildReactTestingLibraryPrompt(context: Partial<TestContext>): string {
  const componentName = context.componentName ?? 'MyComponent';

  return [
    '# TestMind React Testing Library Prompt (Placeholder)',
    '',
    `Component: ${componentName}`,
    `Props: ${JSON.stringify(context.props ?? {}, null, 2)}`,
    '',
    '## Requirements',
    '1. Use @testing-library/react best practices (findByRole, userEvent).',
    '2. Cover hooks mentioned in context.hooks.',
    '3. Provide TODO comments when referenced props are missing sample data.',
    '',
    '## TODO',
    '- Replace with dynamic prompt builder after React analyzer ships (plan.md §2.4.2).',
  ].join('\n');
}
