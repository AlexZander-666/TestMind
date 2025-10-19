import { describe, it, expect } from 'vitest';
import { formatTokensAbbrev } from '../lib/format';
import type { FormatAbbrevOptions } from '../lib/format';

// Assuming FormatAbbrevOptions is an interface like:
// interface FormatAbbrevOptions {
//   precision?: number;
// }

describe('formatTokensAbbrev', () => {
  // Test cases for null, undefined, and zero inputs
  describe('Boundary and Nullish Inputs', () => {
    it('should return a placeholder "--" for a null input', () => {
      // Arrange
      const n = null;

      // Act
      const result = formatTokensAbbrev(n);

      // Assert
      expect(result).toBe('--');
    });

    it('should return a placeholder "--" for an undefined input', () => {
      // Arrange
      const n = undefined;

      // Act
      const result = formatTokensAbbrev(n);

      // Assert
      expect(result).toBe('--');
    });

    it('should return "0" for an input of 0', () => {
      // Arrange
      const n = 0;

      // Act
      const result = formatTokensAbbrev(n);

      // Assert
      expect(result).toBe('0');
    });
  });

  // Test cases for numbers that do not require abbreviation (< 1000)
  describe('Numbers without Abbreviation', () => {
    it('should format positive integers less than 1000 without abbreviation', () => {
      // Arrange
      const n = 999;

      // Act
      const result = formatTokensAbbrev(n);

      // Assert
      expect(result).toBe('99