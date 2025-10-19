import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { debugLog } from '../../lib/debug';
import { config } from '../../lib/config';

// Mock the config dependency to control the debug flag for tests
vi.mock('../../lib/config', () => ({
  config: {
    debug: false, // Default to false, tests can override this
  },
}));

describe('debugLog', () => {
  let consoleLogSpy: vi.SpyInstance;

  // Setup a spy on console.log before each test to monitor its calls
  beforeEach(() => {
    // Mock the implementation to prevent logs from cluttering the test output
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  // Restore all mocks after each test to ensure test isolation
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('when config.debug is true', () => {
    beforeEach(() => {
      // Arrange: Enable debugging for this suite of tests
      config.debug = true;
    });

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
      expect(consoleLogSpy).toHaveBeenCalledWith(`[${tag}]`, 'Processing data:', user, 'Count:', count, 'Success:', success);
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

    it('should handle a single character string as a tag', () => {
      // Arrange
      const tag = 'i';
      const message = 'Info message';

      // Act
      debugLog(tag, message);

      // Assert
      expect(consoleLogSpy).toHaveBeenCalledOnce();
      expect(consoleLogSpy).toHaveBeenCalledWith(`[${tag}]`, message);
    });

    it('should handle a very long string as a tag', () => {
      // Arrange
      const longTag = 'A'.repeat(500);
      const message = 'Long tag test';

      // Act
      debugLog(longTag, message);

      // Assert
      expect(consoleLogSpy).toHaveBeenCalledOnce();
      expect(consoleLogSpy).toHaveBeenCalledWith(`[${longTag}]`, message);
    });
  });

  describe('when config.debug is false', () => {
    beforeEach(() => {
      // Arrange: Ensure debugging is disabled for this suite
      config.debug = false;
    });

    it('should not call console.log, regardless of arguments', () => {
      // Arrange
      const tag = 'IMPORTANT';
      const message = 'This should not be logged';
      const data = { key: 'value' };

      // Act
      debugLog(tag, message, data);

      // Assert
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should not call console.log even with an empty tag and no args', () => {
        // Arrange
        const tag = '';

        // Act
        debugLog(tag);

        // Assert
        expect(consoleLogSpy).not.toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should not throw an error if console.log fails (IO failure)', () => {
      // Arrange
      config.debug = true;
      const consoleError = new Error('Console is not available');
      consoleLogSpy.mockImplementation(() => {
        throw consoleError;
      });

      // Act
      const action = () => debugLog('FAIL_TEST', 'This call will fail internally');

      // Assert
      // The function should catch or ignore the error from console.log and not crash the application.
      expect(action).not.toThrow();
    });
  });
});