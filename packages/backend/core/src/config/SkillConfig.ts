import type { SkillCategory } from '../skills/Skill';

export type SkillLifecycleStatus = 'beta' | 'preview' | 'planned';

export interface SkillConfigEntry {
  name: string;
  description: string;
  category: SkillCategory;
  status: SkillLifecycleStatus;
  eta: string;
  owner: string;
  frameworks: string[];
  languages: string[];
  planRef: string;
}

/**
 * Skill roadmap derived from plan.md §2.4.2.
 * Keeping this data in code avoids 0-byte placeholders and gives the CLI a single source of truth.
 */
export const skillConfigRoadmap: SkillConfigEntry[] = [
  {
    name: 'cypress-e2e',
    description: 'Generates Cypress workflows with locator hardening and diff-first review.',
    category: 'testing',
    status: 'planned',
    eta: 'W4',
    owner: 'Self-Healing Guild',
    frameworks: ['cypress'],
    languages: ['ts', 'js'],
    planRef: 'plan.md §2.4.2 · Code placeholder #5',
  },
  {
    name: 'playwright-e2e',
    description: 'Playwright browser skill with adaptive selectors and screenshot diffing.',
    category: 'testing',
    status: 'planned',
    eta: 'W3',
    owner: 'Self-Healing Guild',
    frameworks: ['playwright'],
    languages: ['ts', 'js'],
    planRef: 'plan.md §2.4.2 · Code placeholder #7',
  },
  {
    name: 'react-testing-library',
    description: 'Component-level assertions, prop heuristics, and hook coverage.',
    category: 'testing',
    status: 'planned',
    eta: 'W3',
    owner: 'Frontend Guild',
    frameworks: ['react-testing-library'],
    languages: ['ts', 'js'],
    planRef: 'plan.md §2.4.2 · Code placeholder #8',
  },
  {
    name: 'rest-api',
    description: 'REST API skill powered by OpenAPI parser and schema-aware prompts.',
    category: 'testing',
    status: 'planned',
    eta: 'W3',
    owner: 'Platform Guild',
    frameworks: ['vitest', 'jest'],
    languages: ['ts', 'js'],
    planRef: 'plan.md §2.4.2 · Code placeholder #9',
  },
  {
    name: 'graphql',
    description: 'GraphQL operations with schema awareness and mock server hooks.',
    category: 'testing',
    status: 'planned',
    eta: 'W4',
    owner: 'Platform Guild',
    frameworks: ['vitest', 'jest'],
    languages: ['ts', 'js'],
    planRef: 'plan.md §2.4.2 · Code placeholder #6',
  },
];

export function getSkillConfig(name: string): SkillConfigEntry | undefined {
  return skillConfigRoadmap.find(entry => entry.name === name);
}

export function listSkillConfigs(
  filter: Partial<Pick<SkillConfigEntry, 'status' | 'owner' | 'frameworks' | 'languages'>> = {},
): SkillConfigEntry[] {
  return skillConfigRoadmap.filter(entry => {
    if (filter.status && filter.status !== entry.status) return false;
    if (filter.owner && filter.owner !== entry.owner) return false;
    if (filter.frameworks && !filter.frameworks.some(framework => entry.frameworks.includes(framework))) {
      return false;
    }
    if (filter.languages && !filter.languages.some(language => entry.languages.includes(language))) {
      return false;
    }
    return true;
  });
}
