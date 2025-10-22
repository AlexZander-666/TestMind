/**
 * Framework Adapter Module
 * 
 * 统一的测试框架适配器接口和实现
 */

export {
  BaseTestFrameworkAdapter,
  FrameworkRegistry,
  globalFrameworkRegistry,
  type TestFrameworkAdapter,
  type FrameworkCapabilities,
  type FrameworkTestContext, // Renamed to avoid conflict
  type TestCode as FrameworkTestCode,
  type ConfigOptions as FrameworkConfigOptions,
  type TestResult as FrameworkTestResult,
} from './TestFrameworkAdapter';

export {
  SeleniumTestSkill,
  createSeleniumTestSkill,
  type SeleniumTestContext,
  type SeleniumAction,
} from './SeleniumTestSkill';

export {
  FrameworkDetector,
  createFrameworkDetector,
  type DetectionResult,
  type FrameworkInfo,
  type DetectionEvidence,
} from './FrameworkDetector';

