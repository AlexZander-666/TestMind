/**
 * Self-Healing Test Engine
 * 
 * Automatically detects and fixes flaky tests through:
 * - Multi-strategy element location
 * - Intelligent failure classification
 * - AI-powered fix suggestions
 */

export {
  // Locator Engine
  LocatorEngine,
  createLocatorEngine,
  LocatorStrategy,
  type ElementDescriptor,
  type LocatorResult,
  type LocatorEngineConfig
} from './LocatorEngine';

export {
  // Failure Classifier
  FailureClassifier,
  createFailureClassifier,
  FailureType,
  type TestFailure,
  type TestRunHistory,
  type ClassificationResult,
  type FailurePattern
} from './FailureClassifier';

export {
  // Fix Suggester
  FixSuggester,
  createFixSuggester,
  FixType,
  type FixSuggestion,
  type FixContext
} from './FixSuggester';

export {
  // Intent Tracker
  IntentTracker,
  createIntentTracker,
  ActionType,
  type TestIntent,
  type ElementFeatures,
  type IntentRecordOptions
} from './IntentTracker';

// Self-Healing Engine (集成所有组件)
export { SelfHealingEngine, createSelfHealingEngine } from './SelfHealingEngine';
