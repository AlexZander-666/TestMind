/**
 * Module C - Imports Module B (creates dependency chain)
 */

import { anotherHelper } from './moduleB';

export class UtilityClass {
  transform(input: string): string {
    const length = anotherHelper(input.length);
    return input.repeat(length);
  }
}

export const constants = {
  MAX_LENGTH: 100,
  MIN_LENGTH: 1,
};



























