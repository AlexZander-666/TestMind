/**
 * Application-wide constants
 */

export const APP_NAME = 'TestMind';
export const APP_VERSION = '0.1.0';

// Default configuration values
export const DEFAULT_CONFIG = {
  includePatterns: ['**/*.ts', '**/*.js', '**/*.py', '**/*.java'],
  excludePatterns: [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/coverage/**',
    '**/*.test.*',
    '**/*.spec.*',
  ],
  testDirectory: '__tests__',
  coverageThreshold: 80,
  maxFileSize: 1024 * 1024, // 1MB
  llmProvider: 'openai' as const,
  llmModel: 'gpt-4-turbo-preview',
};

// Supported languages and their extensions
export const LANGUAGE_EXTENSIONS: Record<string, string[]> = {
  typescript: ['.ts', '.tsx'],
  javascript: ['.js', '.jsx', '.mjs'],
  python: ['.py'],
  java: ['.java'],
};

// Test framework configurations
export const TEST_FRAMEWORKS = {
  jest: {
    configFiles: ['jest.config.js', 'jest.config.ts', 'jest.config.json'],
    testPattern: /\.(test|spec)\.[jt]sx?$/,
    command: 'jest',
  },
  vitest: {
    configFiles: ['vitest.config.js', 'vitest.config.ts'],
    testPattern: /\.(test|spec)\.[jt]sx?$/,
    command: 'vitest',
  },
  pytest: {
    configFiles: ['pytest.ini', 'pyproject.toml', 'setup.cfg'],
    testPattern: /test_.*\.py$|.*_test\.py$/,
    command: 'pytest',
  },
  junit: {
    configFiles: ['pom.xml', 'build.gradle'],
    testPattern: /Test.*\.java$|.*Test\.java$/,
    command: 'mvn test',
  },
  mocha: {
    configFiles: ['.mocharc.js', '.mocharc.json'],
    testPattern: /\.(test|spec)\.js$/,
    command: 'mocha',
  },
} as const;

// LLM Provider configurations
export const LLM_PROVIDERS = {
  openai: {
    name: 'OpenAI',
    models: ['gpt-4-turbo-preview', 'gpt-4', 'gpt-3.5-turbo'],
    endpoint: 'https://api.openai.com/v1',
  },
  anthropic: {
    name: 'Anthropic',
    models: ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'],
    endpoint: 'https://api.anthropic.com/v1',
  },
  ollama: {
    name: 'Ollama',
    models: ['codellama', 'llama2', 'mistral'],
    endpoint: 'http://localhost:11434',
  },
} as const;

// Quality score thresholds
export const QUALITY_THRESHOLDS = {
  excellent: 90,
  good: 75,
  acceptable: 60,
  poor: 40,
};

// Complexity thresholds
export const COMPLEXITY_THRESHOLDS = {
  cyclomaticComplexity: {
    low: 5,
    medium: 10,
    high: 20,
  },
  cognitiveComplexity: {
    low: 7,
    medium: 15,
    high: 30,
  },
};

// Database configuration
export const DB_CONFIG = {
  sqlite: {
    filename: '.testmind/testmind.db',
    options: {
      verbose: false,
    },
  },
  postgres: {
    host: 'localhost',
    port: 5432,
    database: 'testmind',
  },
};

// Vector embedding dimensions
export const EMBEDDING_DIMENSIONS = {
  'text-embedding-3-small': 1536,
  'text-embedding-3-large': 3072,
  'text-embedding-ada-002': 1536,
};



























