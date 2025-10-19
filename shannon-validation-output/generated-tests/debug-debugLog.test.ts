import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { debugLog } from './debug'; // Assuming debugLog is in './debug.ts'
import { config } from './config'; // Assuming config is in './config.ts'

// Mock the config module dependency
vi.mock('./config', () => ({
  config: {
    debug: true, // Default to enabled for most tests
  },
}));

describe('debugLog', () => {
  let consoleLogSpy: vi.SpyInstance;

  // Arrange: Set up spies before each test
  beforeEach(() => {
    // Spy on console.log to track its calls without actually logging to the console during tests
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  // Teardown: Restore original implementations after each test
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should log a message with a tag when debugging is enabled', () => {
    // Arrange
    const tag = 'TEST';
    const message = 'This is a test message';
    const data = { id: 123, status: 'ok' };
    vi.mocked(config).debug = true;

    // Act
    debugLog(tag, message, data);

    // Assert
    expect(consoleLogSpy).toHaveBeenCalledTimes(1);
    expect(consoleLogSpy).toHaveBeenCalledWith(`[${tag}]`, message, data);
  });

  it('should not log anything when debugging is disabled', () => {
    // Arrange
    vi.mocked(config).debug = false;
    const tag = 'DISABLED';
    const message = 'This should not appear';

    // Act
    debugLog(tag, message);

    // Assert
    expect(consoleLogSpy).not.toHaveBeenCalled();
  });

  describe('Boundary Conditions', () => {
    beforeEach(() => {
      // Ensure debugging is enabled for all boundary tests
      vi.mocked(config).debug = true;
    });

    it('should handle an empty tag string', () => {
      // Arrange
      const tag = '';
      const message = 'Message with empty tag';

      // Act
      debugLog(tag, message);

      // Assert
      expect(consoleLogSpy).toHaveBeenCalledWith('[]', message);
    });

    it('should handle a single character tag', () => {
      // Arrange
      const tag = 'A';
      const message = 'Message with single char tag';

      // Act
      debugLog(tag, message);

      // Assert
      expect(consoleLogSpy).toHaveBeenCalledWith(`[${tag}]`, message);
    });

    it('should handle a very long tag string', () => {
      // Arrange
      const longTag = 'A'.repeat(1024);
      const message = 'Message with long tag';

      // Act
      debugLog(longTag, message);

      // Assert
      expect(consoleLogSpy).toHaveBeenCalledWith(`[${longTag}]`, message);
    });

    it('should handle a call with no arguments after the tag', () => {
      // Arrange
      const tag = 'NO_ARGS';

      // Act
      debugLog(tag);

      // Assert
      expect(consoleLogSpy).toHaveBeenCalledWith(`[${tag}]`);
    });

    it('should handle a single argument of various types', () => {
      // Arrange
      const tag = 'SINGLE_ARG';
      const numberArg = 42;
      const objectArg = { key: 'value' };
      const nullArg = null;

      // Act
      debugLog(tag, numberArg);
      debugLog(tag, objectArg);
      debugLog(tag, nullArg);

      // Assert
      expect(consoleLogSpy).toHaveBeenCalledTimes(3);
      expect(consoleLogSpy).toHaveBeenCalledWith(`[${tag}]`, numberArg);
      expect(consoleLogSpy).toHaveBeenCalledWith(`[${tag}]`, objectArg);
      expect(consoleLogSpy).toHaveBeenCalledWith(`[${tag}]`, nullArg);
    });

    it('should handle multiple arguments of various types', () => {
      // Arrange
      const tag = 'MULTI_ARGS';
      const args = ['string', 123, { a: 1 }, [1, 2, 3], true, null, undefined];

      // Act
      debugLog(tag, ...args);

      // Assert
      expect(consoleLogSpy).toHaveBeenCalledWith(`[${tag}]`, ...args);
    });
  });

  describe('Edge Cases', () => {
    it('should handle IO failure gracefully and not throw an error', () => {
      // Arrange
      vi.mocked(config).debug = true;
      const errorMessage = 'Console is not available';
      consoleLogSpy.mockImplementation(() => {
        throw new Error(errorMessage);
      });
      const tag = 'IO_FAILURE';
      const message = 'This log will fail';

      // Act
      const act = () => debugLog(tag, message);

      // Assert
      // The function should catch the internal error and not let it bubble up.
      expect(act).not.toThrow();
    });
  });
});