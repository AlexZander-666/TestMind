import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { debugLog } from './debug';

// Mock the config module to control DEBUG_LOGS constant
vi.mock('./config', () => ({
  DEBUG_LOGS: true, // Default to true for testing
}));

describe('debugLog', () => {
  let consoleLogSpy: vi.SpyInstance;

  // Setup a spy on console.log before each test
  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  // Restore all mocks after each test to ensure test isolation
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('when DEBUG_LOGS is true (default mock)', () => {
    it('should log a message with a tag and no additional arguments', () => {
      // Arrange
      const tag = 'INIT';

      // Act
      debugLog(tag);

      // Assert
      expect(consoleLogSpy).toHaveBeenCalledOnce();
      expect(consoleLogSpy).toHaveBeenCalledWith(`[${tag}]`);
    });

    it('should log a message with a tag and a single argument', () => {
      // Arrange
      const tag = 'API_CALL';
      const message = 'Fetching user data...';

      // Act
      debugLog(tag, message);

      // Assert
      expect(consoleLogSpy).toHaveBeenCalledOnce();
      expect(consoleLogSpy).toHaveBeenCalledWith(`[${tag}]`, message);
    });

    it('should log a message with a tag and multiple arguments of different types', () => {
      // Arrange
      const tag = 'DATA_PROCESS';
      const user = { id: 1, name: 'John Doe' };
      const count = 42;
      const success = true;

      // Act
      debugLog(tag, 'Processing data:', user, 'Count:', count, 'Success:', success);

      // Assert
      expect(consoleLogSpy).toHaveBeenCalledOnce();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        `[${tag}]`,
        'Processing data:',
        user,
        'Count:',
        count,
        'Success:',
        success
      );
    });

    it('should handle an empty string as a tag', () => {
      // Arrange
      const tag = '';
      const message = 'Empty tag test';

      // Act
      debugLog(tag, message);

      // Assert
      expect(consoleLogSpy).toHaveBeenCalledOnce();
      expect(consoleLogSpy).toHaveBeenCalledWith('[]', message);
    });

    it('should handle objects and arrays as arguments', () => {
      // Arrange
      const tag = 'DATA';
      const obj = { key: 'value', nested: { deep: true } };
      const arr = [1, 2, 3];

      // Act
      debugLog(tag, obj, arr);

      // Assert
      expect(consoleLogSpy).toHaveBeenCalledOnce();
      expect(consoleLogSpy).toHaveBeenCalledWith(`[${tag}]`, obj, arr);
    });
  });
});

// Note: Testing DEBUG_LOGS = false scenario would require re-mocking the module
// or using a separate test file with different mock values.
// For simplicity, we focus on the primary use case (DEBUG_LOGS = true).
// In production, DEBUG_LOGS is controlled via environment variable NEXT_PUBLIC_DEBUG_LOGS.





