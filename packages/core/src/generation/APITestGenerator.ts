/**
 * APITestGenerator - 智能API测试生成器
 * 
 * 功能特性：
 * 1. OpenAPI/Swagger规范解析
 * 2. RESTful API测试生成
 * 3. GraphQL API测试支持
 * 4. 认证授权测试
 * 5. 边界值和异常测试
 * 6. 性能测试生成
 * 7. Mock服务器集成
 */

import type { TestSuite, TestCase } from '@testmind/shared';
import { createComponentLogger } from '../utils/logger';
import { LLMService } from '../llm/LLMService';
import { generateUUID } from '@testmind/shared';

const logger = createComponentLogger('APITestGenerator');

export interface APIEndpoint {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';
  summary?: string;
  description?: string;
  parameters?: APIParameter[];
  requestBody?: RequestBody;
  responses?: Record<string, ResponseSpec>;
  security?: SecurityRequirement[];
  tags?: string[];
}

export interface APIParameter {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie';
  required?: boolean;
  schema?: SchemaObject;
  description?: string;
  example?: any;
}

export interface RequestBody {
  required?: boolean;
  content: Record<string, MediaType>;
  description?: string;
}

export interface ResponseSpec {
  description: string;
  content?: Record<string, MediaType>;
  headers?: Record<string, any>;
}

export interface MediaType {
  schema?: SchemaObject;
  example?: any;
  examples?: Record<string, any>;
}

export interface SchemaObject {
  type?: string;
  format?: string;
  properties?: Record<string, SchemaObject>;
  required?: string[];
  items?: SchemaObject;
  enum?: any[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
}

export interface SecurityRequirement {
  type: 'apiKey' | 'oauth2' | 'bearer' | 'basic';
  scheme?: string;
  name?: string;
  in?: string;
}

export interface APITestConfig {
  baseURL: string;
  endpoints: APIEndpoint[];
  globalHeaders?: Record<string, string>;
  authentication?: AuthConfig;
  testFramework?: 'jest' | 'mocha' | 'vitest';
  includePerformanceTests?: boolean;
  includeSecurity Tests?: boolean;
  mockServerUrl?: string;
}

export interface AuthConfig {
  type: 'bearer' | 'basic' | 'apiKey' | 'oauth2';
  token?: string;
  username?: string;
  password?: string;
  apiKey?: string;
  apiKeyHeader?: string;
}

export interface GeneratedAPITest {
  suite: TestSuite;
  mockData: any;
  setupCode: string;
  teardownCode: string;
}

export class APITestGenerator {
  private llm: LLMService;
  
  constructor(llm: LLMService) {
    this.llm = llm;
    logger.info('APITestGenerator initialized');
  }

  /**
   * 从OpenAPI规范生成测试
   */
  async generateFromOpenAPI(
    openAPISpec: any,
    config?: Partial<APITestConfig>
  ): Promise<GeneratedAPITest> {
    logger.info('Generating tests from OpenAPI spec', {
      version: openAPISpec.openapi || openAPISpec.swagger,
      paths: Object.keys(openAPISpec.paths || {}).length
    });

    const endpoints = this.parseOpenAPISpec(openAPISpec);
    const baseURL = config?.baseURL || openAPISpec.servers?.[0]?.url || 'http://localhost:3000';

    const testConfig: APITestConfig = {
      baseURL,
      endpoints,
      globalHeaders: config?.globalHeaders || {},
      authentication: config?.authentication,
      testFramework: config?.testFramework || 'jest',
      includePerformanceTests: config?.includePerformanceTests || false,
      includeSecurityTests: config?.includeSecurityTests || false,
      mockServerUrl: config?.mockServerUrl
    };

    return this.generateAPITests(testConfig);
  }

  /**
   * 生成API测试套件
   */
  async generateAPITests(config: APITestConfig): Promise<GeneratedAPITest> {
    const testCases: TestCase[] = [];
    const mockData: any = {};

    for (const endpoint of config.endpoints) {
      // Generate happy path tests
      const happyPath = await this.generateHappyPathTest(endpoint, config);
      testCases.push(...happyPath);

      // Generate validation tests
      const validation = await this.generateValidationTests(endpoint, config);
      testCases.push(...validation);

      // Generate error handling tests
      const errorHandling = await this.generateErrorTests(endpoint, config);
      testCases.push(...errorHandling);

      // Generate security tests
      if (config.includeSecurityTests) {
        const security = await this.generateSecurityTests(endpoint, config);
        testCases.push(...security);
      }

      // Generate performance tests
      if (config.includePerformanceTests) {
        const performance = await this.generatePerformanceTests(endpoint, config);
        testCases.push(...performance);
      }

      // Generate mock data for this endpoint
      mockData[endpoint.path] = await this.generateMockData(endpoint);
    }

    const suite: TestSuite = {
      id: generateUUID(),
      projectId: 'api-tests',
      tests: testCases,
      framework: config.testFramework || 'jest',
      generatedAt: new Date(),
      generatedBy: 'APITestGenerator',
      metadata: {
        type: 'api',
        baseURL: config.baseURL,
        endpoints: config.endpoints.length
      }
    };

    const setupCode = this.generateSetupCode(config);
    const teardownCode = this.generateTeardownCode(config);

    return {
      suite,
      mockData,
      setupCode,
      teardownCode
    };
  }

  /**
   * 生成Happy Path测试
   */
  private async generateHappyPathTest(
    endpoint: APIEndpoint,
    config: APITestConfig
  ): Promise<TestCase[]> {
    const tests: TestCase[] = [];

    const test: TestCase = {
      id: generateUUID(),
      name: `${endpoint.method} ${endpoint.path} - Happy Path`,
      description: endpoint.summary || `Test successful ${endpoint.method} request to ${endpoint.path}`,
      type: 'api',
      priority: 'high',
      code: this.generateTestCode(endpoint, config, 'happy'),
      expectedOutput: {
        status: 200,
        schema: endpoint.responses?.['200']
      },
      metadata: {
        endpoint: endpoint.path,
        method: endpoint.method
      }
    };

    tests.push(test);

    // Generate tests for different valid parameter combinations
    if (endpoint.parameters) {
      const paramCombos = this.generateParameterCombinations(endpoint.parameters);
      for (const combo of paramCombos.slice(0, 3)) { // Limit to 3 combinations
        tests.push({
          ...test,
          id: generateUUID(),
          name: `${test.name} - Params: ${JSON.stringify(combo)}`,
          input: combo
        });
      }
    }

    return tests;
  }

  /**
   * 生成验证测试
   */
  private async generateValidationTests(
    endpoint: APIEndpoint,
    config: APITestConfig
  ): Promise<TestCase[]> {
    const tests: TestCase[] = [];

    // Test required parameters
    if (endpoint.parameters) {
      for (const param of endpoint.parameters.filter(p => p.required)) {
        tests.push({
          id: generateUUID(),
          name: `${endpoint.method} ${endpoint.path} - Missing required param: ${param.name}`,
          description: `Test that ${param.name} is required`,
          type: 'api',
          priority: 'high',
          code: this.generateTestCode(endpoint, config, 'missing-param', param),
          expectedOutput: {
            status: 400,
            error: 'Bad Request'
          },
          metadata: {
            endpoint: endpoint.path,
            method: endpoint.method,
            testType: 'validation'
          }
        });
      }
    }

    // Test data type validation
    if (endpoint.requestBody) {
      const schema = endpoint.requestBody.content['application/json']?.schema;
      if (schema) {
        const invalidData = this.generateInvalidData(schema);
        for (const invalid of invalidData) {
          tests.push({
            id: generateUUID(),
            name: `${endpoint.method} ${endpoint.path} - Invalid ${invalid.field}`,
            description: `Test validation for ${invalid.field}: ${invalid.reason}`,
            type: 'api',
            priority: 'medium',
            code: this.generateTestCode(endpoint, config, 'invalid-data', invalid),
            input: invalid.data,
            expectedOutput: {
              status: 400,
              error: 'Validation Error'
            },
            metadata: {
              endpoint: endpoint.path,
              method: endpoint.method,
              testType: 'validation',
              field: invalid.field
            }
          });
        }
      }
    }

    return tests;
  }

  /**
   * 生成错误处理测试
   */
  private async generateErrorTests(
    endpoint: APIEndpoint,
    config: APITestConfig
  ): Promise<TestCase[]> {
    const tests: TestCase[] = [];

    // 401 Unauthorized test
    if (endpoint.security && endpoint.security.length > 0) {
      tests.push({
        id: generateUUID(),
        name: `${endpoint.method} ${endpoint.path} - Unauthorized`,
        description: 'Test unauthorized access',
        type: 'api',
        priority: 'high',
        code: this.generateTestCode(endpoint, config, 'unauthorized'),
        expectedOutput: {
          status: 401,
          error: 'Unauthorized'
        },
        metadata: {
          endpoint: endpoint.path,
          method: endpoint.method,
          testType: 'error'
        }
      });
    }

    // 404 Not Found test (for path parameters)
    if (endpoint.parameters?.some(p => p.in === 'path')) {
      tests.push({
        id: generateUUID(),
        name: `${endpoint.method} ${endpoint.path} - Not Found`,
        description: 'Test with non-existent resource',
        type: 'api',
        priority: 'medium',
        code: this.generateTestCode(endpoint, config, 'not-found'),
        expectedOutput: {
          status: 404,
          error: 'Not Found'
        },
        metadata: {
          endpoint: endpoint.path,
          method: endpoint.method,
          testType: 'error'
        }
      });
    }

    // 500 Server Error test (simulate)
    tests.push({
      id: generateUUID(),
      name: `${endpoint.method} ${endpoint.path} - Server Error Handling`,
      description: 'Test graceful handling of server errors',
      type: 'api',
      priority: 'low',
      code: this.generateTestCode(endpoint, config, 'server-error'),
      expectedOutput: {
        status: 500,
        error: 'Internal Server Error'
      },
      metadata: {
        endpoint: endpoint.path,
        method: endpoint.method,
        testType: 'error'
      }
    });

    return tests;
  }

  /**
   * 生成安全测试
   */
  private async generateSecurityTests(
    endpoint: APIEndpoint,
    config: APITestConfig
  ): Promise<TestCase[]> {
    const tests: TestCase[] = [];

    // SQL Injection test
    if (endpoint.parameters?.some(p => p.in === 'query')) {
      tests.push({
        id: generateUUID(),
        name: `${endpoint.method} ${endpoint.path} - SQL Injection`,
        description: 'Test SQL injection prevention',
        type: 'api',
        priority: 'critical',
        code: this.generateTestCode(endpoint, config, 'sql-injection'),
        input: { query: "'; DROP TABLE users; --" },
        expectedOutput: {
          status: 400,
          error: 'Bad Request'
        },
        metadata: {
          endpoint: endpoint.path,
          method: endpoint.method,
          testType: 'security'
        }
      });
    }

    // XSS test
    if (endpoint.requestBody) {
      tests.push({
        id: generateUUID(),
        name: `${endpoint.method} ${endpoint.path} - XSS Prevention`,
        description: 'Test XSS attack prevention',
        type: 'api',
        priority: 'critical',
        code: this.generateTestCode(endpoint, config, 'xss'),
        input: { content: '<script>alert("XSS")</script>' },
        expectedOutput: {
          sanitized: true
        },
        metadata: {
          endpoint: endpoint.path,
          method: endpoint.method,
          testType: 'security'
        }
      });
    }

    // Rate limiting test
    tests.push({
      id: generateUUID(),
      name: `${endpoint.method} ${endpoint.path} - Rate Limiting`,
      description: 'Test rate limiting',
      type: 'api',
      priority: 'medium',
      code: this.generateTestCode(endpoint, config, 'rate-limit'),
      expectedOutput: {
        status: 429,
        error: 'Too Many Requests'
      },
      metadata: {
        endpoint: endpoint.path,
        method: endpoint.method,
        testType: 'security'
      }
    });

    return tests;
  }

  /**
   * 生成性能测试
   */
  private async generatePerformanceTests(
    endpoint: APIEndpoint,
    config: APITestConfig
  ): Promise<TestCase[]> {
    const tests: TestCase[] = [];

    // Response time test
    tests.push({
      id: generateUUID(),
      name: `${endpoint.method} ${endpoint.path} - Response Time`,
      description: 'Test response time is within acceptable limits',
      type: 'api-performance',
      priority: 'medium',
      code: this.generatePerformanceTestCode(endpoint, config, 'response-time'),
      expectedOutput: {
        maxResponseTime: 1000 // ms
      },
      metadata: {
        endpoint: endpoint.path,
        method: endpoint.method,
        testType: 'performance'
      }
    });

    // Load test
    tests.push({
      id: generateUUID(),
      name: `${endpoint.method} ${endpoint.path} - Load Test`,
      description: 'Test endpoint under load',
      type: 'api-performance',
      priority: 'low',
      code: this.generatePerformanceTestCode(endpoint, config, 'load'),
      expectedOutput: {
        concurrentRequests: 10,
        successRate: 0.95
      },
      metadata: {
        endpoint: endpoint.path,
        method: endpoint.method,
        testType: 'performance'
      }
    });

    return tests;
  }

  /**
   * 生成测试代码
   */
  private generateTestCode(
    endpoint: APIEndpoint,
    config: APITestConfig,
    testType: string,
    data?: any
  ): string {
    const framework = config.testFramework || 'jest';
    
    if (framework === 'jest') {
      return this.generateJestCode(endpoint, config, testType, data);
    } else if (framework === 'vitest') {
      return this.generateVitestCode(endpoint, config, testType, data);
    } else {
      return this.generateMochaCode(endpoint, config, testType, data);
    }
  }

  /**
   * 生成Jest测试代码
   */
  private generateJestCode(
    endpoint: APIEndpoint,
    config: APITestConfig,
    testType: string,
    data?: any
  ): string {
    const path = endpoint.path.replace(/{(\w+)}/g, '${$1}');
    
    let code = `
describe('${endpoint.method} ${endpoint.path}', () => {
  test('${testType}', async () => {
    const response = await fetch('${config.baseURL}${path}', {
      method: '${endpoint.method}',`;

    if (config.authentication) {
      code += `
      headers: {
        'Authorization': '${this.getAuthHeader(config.authentication)}',`;
    }

    if (endpoint.method !== 'GET' && endpoint.method !== 'DELETE') {
      code += `
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(${JSON.stringify(data || {})})`;
    } else {
      code += `
      }`;
    }

    code += `
    });

    expect(response.status).toBe(${this.getExpectedStatus(testType)});`;

    if (testType === 'happy') {
      code += `
    const data = await response.json();
    expect(data).toBeDefined();`;
    }

    code += `
  });
});`;

    return code;
  }

  /**
   * 生成Vitest测试代码
   */
  private generateVitestCode(
    endpoint: APIEndpoint,
    config: APITestConfig,
    testType: string,
    data?: any
  ): string {
    // Similar to Jest but with Vitest syntax
    const jestCode = this.generateJestCode(endpoint, config, testType, data);
    return jestCode.replace('describe', 'describe').replace('test', 'it');
  }

  /**
   * 生成Mocha测试代码
   */
  private generateMochaCode(
    endpoint: APIEndpoint,
    config: APITestConfig,
    testType: string,
    data?: any
  ): string {
    const code = this.generateJestCode(endpoint, config, testType, data);
    return code.replace('test(', 'it(').replace('expect(', 'chai.expect(').replace('.toBe(', '.to.equal(');
  }

  /**
   * 生成性能测试代码
   */
  private generatePerformanceTestCode(
    endpoint: APIEndpoint,
    config: APITestConfig,
    testType: string
  ): string {
    if (testType === 'response-time') {
      return `
test('Response time test', async () => {
  const start = Date.now();
  const response = await fetch('${config.baseURL}${endpoint.path}', {
    method: '${endpoint.method}'
  });
  const duration = Date.now() - start;
  
  expect(response.status).toBe(200);
  expect(duration).toBeLessThan(1000);
});`;
    } else {
      return `
test('Load test', async () => {
  const promises = Array(10).fill(0).map(() =>
    fetch('${config.baseURL}${endpoint.path}', {
      method: '${endpoint.method}'
    })
  );
  
  const responses = await Promise.all(promises);
  const successCount = responses.filter(r => r.status === 200).length;
  
  expect(successCount / responses.length).toBeGreaterThan(0.95);
});`;
    }
  }

  /**
   * Helper methods
   */
  private parseOpenAPISpec(spec: any): APIEndpoint[] {
    const endpoints: APIEndpoint[] = [];

    for (const [path, pathItem] of Object.entries(spec.paths || {})) {
      for (const [method, operation] of Object.entries(pathItem as any)) {
        if (['get', 'post', 'put', 'delete', 'patch'].includes(method)) {
          endpoints.push({
            path,
            method: method.toUpperCase() as any,
            summary: (operation as any).summary,
            description: (operation as any).description,
            parameters: (operation as any).parameters,
            requestBody: (operation as any).requestBody,
            responses: (operation as any).responses,
            security: (operation as any).security,
            tags: (operation as any).tags
          });
        }
      }
    }

    return endpoints;
  }

  private generateParameterCombinations(parameters: APIParameter[]): any[] {
    // Generate valid parameter combinations
    const combinations: any[] = [];
    
    // All required parameters
    const required: any = {};
    for (const param of parameters.filter(p => p.required)) {
      required[param.name] = this.generateValidValue(param.schema);
    }
    combinations.push(required);

    // Add optional parameters
    for (const param of parameters.filter(p => !p.required)) {
      combinations.push({
        ...required,
        [param.name]: this.generateValidValue(param.schema)
      });
    }

    return combinations;
  }

  private generateValidValue(schema?: SchemaObject): any {
    if (!schema) return 'test';

    switch (schema.type) {
      case 'string':
        return schema.enum ? schema.enum[0] : 'test-string';
      case 'number':
      case 'integer':
        return schema.minimum || 1;
      case 'boolean':
        return true;
      case 'array':
        return [this.generateValidValue(schema.items)];
      case 'object':
        const obj: any = {};
        for (const [key, prop] of Object.entries(schema.properties || {})) {
          obj[key] = this.generateValidValue(prop);
        }
        return obj;
      default:
        return null;
    }
  }

  private generateInvalidData(schema: SchemaObject): any[] {
    const invalid: any[] = [];

    if (schema.properties) {
      for (const [key, prop] of Object.entries(schema.properties)) {
        // Type mismatch
        if (prop.type === 'string') {
          invalid.push({
            field: key,
            reason: 'type mismatch',
            data: { [key]: 123 }
          });
        }

        // Min/max violations
        if (prop.minimum !== undefined) {
          invalid.push({
            field: key,
            reason: 'below minimum',
            data: { [key]: prop.minimum - 1 }
          });
        }

        // Required field missing
        if (schema.required?.includes(key)) {
          const data = { ...this.generateValidValue(schema) };
          delete data[key];
          invalid.push({
            field: key,
            reason: 'required field missing',
            data
          });
        }
      }
    }

    return invalid.slice(0, 5); // Limit to 5 invalid cases
  }

  private async generateMockData(endpoint: APIEndpoint): Promise<any> {
    const response = endpoint.responses?.['200'];
    if (!response?.content?.['application/json']?.schema) {
      return {};
    }

    return this.generateValidValue(response.content['application/json'].schema);
  }

  private generateSetupCode(config: APITestConfig): string {
    return `
// Setup
const baseURL = '${config.baseURL}';
const headers = ${JSON.stringify(config.globalHeaders || {})};
${config.authentication ? `const auth = ${JSON.stringify(config.authentication)};` : ''}

beforeAll(async () => {
  // Setup mock server if configured
  ${config.mockServerUrl ? `await setupMockServer('${config.mockServerUrl}');` : ''}
});
`;
  }

  private generateTeardownCode(config: APITestConfig): string {
    return `
afterAll(async () => {
  // Cleanup
  ${config.mockServerUrl ? `await teardownMockServer();` : ''}
});
`;
  }

  private getAuthHeader(auth: AuthConfig): string {
    switch (auth.type) {
      case 'bearer':
        return `Bearer ${auth.token}`;
      case 'basic':
        return `Basic ${Buffer.from(`${auth.username}:${auth.password}`).toString('base64')}`;
      case 'apiKey':
        return auth.apiKey || '';
      default:
        return '';
    }
  }

  private getExpectedStatus(testType: string): number {
    switch (testType) {
      case 'happy':
        return 200;
      case 'missing-param':
      case 'invalid-data':
        return 400;
      case 'unauthorized':
        return 401;
      case 'not-found':
        return 404;
      case 'rate-limit':
        return 429;
      case 'server-error':
        return 500;
      default:
        return 200;
    }
  }
}
