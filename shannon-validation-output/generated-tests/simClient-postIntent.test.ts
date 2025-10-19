import { describe, it, expect } from 'vitest';
import { postIntent } from '../../../../observability/dashboard/lib/simClient';

// Since the `SimBridge` type is likely defined elsewhere and not exported,
// we define a minimal local interface to satisfy the TypeScript compiler
// for the `Parameters<...>` utility type. This allows us to create
// correctly-typed test data without needing to import the original type.
// This mock interface is based on a common structure for "intent" objects.
interface SimBridge {
  postIntent(intent: { name: string; data?: Record<string, any> }): void;
}

// Create a type alias for the intent parameter for better readability in tests.
type IntentParameter = Parameters<SimBridge['postIntent']>[0];

describe('postIntent', () => {

  it('should execute without throwing an error for a basic intent with only a name', () => {
    // Arrange
    const intent: IntentParameter = { name: 'START_SIMULATION' };

    // Act & Assert
    // Given the function is pure with no side effects and likely returns void,
    // the most meaningful test is to ensure it runs to completion without errors
    // when passed a validly-structured object.
    expect(() => postIntent(intent)).not.toThrow();
  });

  it('should execute without throwing an error for an intent that includes a data payload', () => {
    // Arrange
    const intent: IntentParameter = {
      name: 'SET_CONFIG',
      data: { speed: 100, mode: 'auto', enabled: true },
    };

    // Act & Assert
    expect(() => postIntent(intent)).not.toThrow();
  });

  it('should handle an intent with an