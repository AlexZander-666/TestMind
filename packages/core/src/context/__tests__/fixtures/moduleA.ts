/**
 * Module A - Imports Module B and C
 */

import { helperFunction } from './moduleB';
import { UtilityClass } from './moduleC';

export function processData(input: string): string {
  const helper = helperFunction(input);
  const utility = new UtilityClass();
  return utility.transform(helper);
}

export class DataProcessor {
  process(data: string): string {
    return helperFunction(data);
  }
}



























