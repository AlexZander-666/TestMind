import { describe, it, expect } from 'vitest';
import { formatTokensAbbrev } from '../../lib/format'; // Assuming the file is in a sibling `lib` directory

// The prompt does not provide the type definition, so we define a minimal one for the test file.
// This ensures the test file is self-contained and type-correct.
interface FormatAbbrevOptions {
  decimals?: number;
}

describe('formatTokensAbbrev', () => {
  // Test Suite for Edge Cases and Invalid Inputs
  describe('Edge Cases and Invalid Inputs', () => {
    it('should return "0" for null input', () => {
      // Arrange
      const n = null;
      // Act
      const result = formatTokensAbbrev(n);
      // Assert
      expect(result).toBe('0');
    });

    it('should return "0" for undefined input', () => {
      // Arrange
      const n = undefined;
      // Act
      const result = formatTokensAbbrev(n);
      // Assert
      expect(result).toBe('0');
    });

    it('should return "0" for zero input', () => {
      // Arrange
      const n = 0;
      // Act
      const result = formatTokensAbbrev(n);
      // Assert
      expect(result).toBe('0');
    });

    it('should return "0" for negative numbers', () => {
      // Arrange
      const n = -12345;
      // Act
      const result = formatTokensAbbrev(n);
      // Assert
      expect(result).toBe('0');
    });
  });

  // Test Suite for Numbers without Abbreviation (< 1000)
  describe('Numbers without Abbreviation', () => {
    it('should format numbers less than 1000 without any abbreviation', () => {
      // Arrange, Act, Assert
      expect(formatTokensAbbrev(1)).toBe('1');
      expect(formatTokensAbbrev(123)).toBe('123');
      expect(formatTokensAbbrev(999)).toBe('999');
    });

    it('should round decimal numbers less than 1000 to the nearest integer', () => {
      // Arrange, Act, Assert
      expect(formatTokensAbbrev(123.4)).toBe('123');
      expect(formatTokensAbbrev(123.5)).toBe('124');
      expect(formatTokensAbbrev(999.9)).toBe('1000'); // Note: This rounds up to 1000, which is not abbreviated.
    });
  });

  // Test Suite for Standard Abbreviation Logic (K, M, B, T)
  describe('Standard Abbreviation', () => {
    it('should abbreviate thousands with a "K" and one decimal place by default', () => {
      // Arrange, Act, Assert
      expect(formatTokensAbbrev(1000)).toBe('1K');
      expect(formatTokensAbbrev(1001)).toBe('1K');
      expect(formatTokensAbbrev(1500)).toBe('1.5K');
      expect(formatTokensAbbrev(10500)).toBe('10.5K');
      expect(formatTokensAbbrev(123456)).toBe('123.4K');
      expect(formatTokensAbbrev(999999)).toBe('999.9K');
    });

    it('should abbreviate millions with an "M" and one decimal place by default', () => {
      // Arrange, Act, Assert
      expect(formatTokensAbbrev(1_000_000)).toBe('1M');
      expect(formatTokensAbbrev(1_500_000)).toBe('1.5M');
      expect(formatTokensAbbrev(12_345_678)).toBe('12.3M');
      expect(formatTokensAbbrev(999_999_999)).toBe('999.9M');
    });

    it('should abbreviate billions with a "B" and one decimal place by default', () => {
      // Arrange, Act, Assert
      expect(formatTokensAbbrev(1_000_000_000)).toBe('1B');
      expect(formatTokensAbbrev(2_500_000_000)).toBe('2.5B');
      expect(formatTokensAbbrev(123_456_789_012)).toBe('123.4B');
    });

    it('should abbreviate trillions with a "T" and one decimal place by default', () => {
      // Arrange, Act, Assert
      expect(formatTokensAbbrev(1_000_000_000_000)).toBe('1T');
      expect(formatTokensAbbrev(5_550_000_000_000)).toBe('5.5T');
      expect(formatTokensAbbrev(9.87e14)).toBe('987T');
    });

    it('should