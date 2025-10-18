/**
 * Test Helper Utilities
 * 
 * Centralized test utilities to eliminate path hardcoding (PD-2 debt repayment)
 * 
 * Benefits:
 * - Single source of truth for test paths
 * - Works across different environments (Windows/Linux/macOS)
 * - Easy to update if project structure changes
 */

import path from 'path';

/**
 * Get the absolute path to test fixtures directory
 */
export function getTestFixturesPath(): string {
  // Resolve relative to this file's location
  // __dirname → utils → __tests__ → context → __tests__ → fixtures
  return path.resolve(__dirname, '../../context/__tests__/fixtures');
}

/**
 * Get absolute path to a specific fixture file
 * @param filename - Fixture filename (e.g., 'sample.ts', 'moduleA.ts')
 */
export function getFixturePath(filename: string): string {
  return path.join(getTestFixturesPath(), filename);
}

/**
 * Get test fixtures path for data-flow tests
 * (Same as getTestFixturesPath, kept for backward compatibility)
 */
export function getDataFlowFixturesPath(): string {
  return getTestFixturesPath();
}

/**
 * Create a temporary test directory
 * @param prefix - Directory name prefix
 */
export async function createTempTestDir(prefix: string = 'testmind-test-'): Promise<string> {
  const { mkdtemp } = await import('fs/promises');
  const { tmpdir } = await import('os');
  return mkdtemp(path.join(tmpdir(), prefix));
}

/**
 * Clean up temporary test directory
 * @param dirPath - Directory to remove
 */
export async function cleanupTempTestDir(dirPath: string): Promise<void> {
  const { rm } = await import('fs/promises');
  await rm(dirPath, { recursive: true, force: true });
}




