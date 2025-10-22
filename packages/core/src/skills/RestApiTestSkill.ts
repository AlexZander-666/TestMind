/**
 * RestApiTestSkill - REST API test generation from OpenAPI specs
 * 
 * Features:
 * - Parse OpenAPI 3.0 and Swagger 2.0 specifications
 * - Generate comprehensive test suites for all endpoints
 * - Support multiple authentication strategies
 * - Test success and error scenarios
 * - Validate request/response schemas
 * - Test boundary conditions and edge cases
 */

import { BaseSkill, SkillContext, SkillResult, CodeChange } from './Skill';
import { LLMService } from '../llm/LLMService';
import { OpenApiParser, ParsedApiSpec, ApiEndpoint, SecurityScheme } from '../context/OpenApiParser';
import { buildRestApiTestPrompt, buildAuthenticationTestPrompt, ApiTestPromptContext } from '../generation/prompts/api-test-prompts';
import * as fs from 'fs-extra';
import * as path from 'path';

export interface RestApiTestOptions {
  // Spec path or URL
  specPath?: string;
  
  // Specific endpoints to test (operation IDs or paths)
  endpoints?: string[];
  
  // Specific tags to test
  tags?: string[];
  
  // Test framework
  testFramework?: 'vitest' | 'jest' | 'mocha';
  
  // HTTP client
  httpClient?: 'axios' | 'fetch' | 'supertest' | 'got';
  
  // Generate separate test files per endpoint
  separateFiles?: boolean;
  
  // Include authentication tests
  includeAuthTests?: boolean;
  
  // Include integration tests
  includeIntegrationTests?: boolean;
  
  // Base URL for tests
  baseUrl?: string;
  
  // Output directory
  outputDir?: string;
}

export class RestApiTestSkill extends BaseSkill {
  readonly name = 'rest-api-test';
  readonly description = 'Generate comprehensive REST API tests from OpenAPI/Swagger specifications';
  readonly category = 'testing' as const;
  readonly version = '1.0.0';
  readonly author = 'TestMind Core Team';

  readonly requiredDependencies = [
    '@apidevtools/swagger-parser',
    'axios', // Default HTTP client
  ];

  private llmService: LLMService;
  private parser: OpenApiParser;

  constructor(llmService?: LLMService) {
    super();
    this.llmService = llmService || new LLMService();
    this.parser = new OpenApiParser();
  }

  /**
   * Check if this skill can handle the context
   */
  canHandle(context: SkillContext): boolean {
    const prompt = context.userPrompt.toLowerCase();
    
    // Check for API test keywords
    const hasApiKeyword = 
      prompt.includes('api') ||
      prompt.includes('rest') ||
      prompt.includes('endpoint') ||
      prompt.includes('openapi') ||
      prompt.includes('swagger');
    
    const hasTestKeyword =
      prompt.includes('test') ||
      prompt.includes('测试') ||
      prompt.includes('generate');
    
    // Check if spec file is provided
    const hasSpecFile = context.targetFiles.some(f => 
      f.endsWith('.yaml') || 
      f.endsWith('.yml') || 
      f.endsWith('.json')
    );
    
    return hasApiKeyword && hasTestKeyword && hasSpecFile;
  }

  /**
   * Validate context
   */
  async validate(context: SkillContext): Promise<string | null> {
    // Check if spec file exists
    const specFiles = context.targetFiles.filter(f => 
      f.endsWith('.yaml') || f.endsWith('.yml') || f.endsWith('.json')
    );
    
    if (specFiles.length === 0) {
      return 'No OpenAPI/Swagger specification file found. Please provide a .yaml, .yml, or .json spec file.';
    }
    
    if (specFiles.length > 1) {
      return `Multiple spec files found: ${specFiles.join(', ')}. Please provide only one spec file.`;
    }
    
    const specPath = path.join(context.projectPath, specFiles[0]);
    if (!await fs.pathExists(specPath)) {
      return `Spec file not found: ${specFiles[0]}`;
    }
    
    return null;
  }

  /**
   * Generate preview
   */
  async preview(context: SkillContext): Promise<string> {
    const specFiles = context.targetFiles.filter(f => 
      f.endsWith('.yaml') || f.endsWith('.yml') || f.endsWith('.json')
    );
    
    let preview = '🔗 REST API Test Generation Preview:\n\n';
    preview += `Spec file: ${specFiles[0]}\n`;
    preview += `Test framework: ${(context as any).testFramework || 'vitest'}\n`;
    preview += `HTTP client: ${(context as any).httpClient || 'axios'}\n\n`;
    preview += 'Will analyze the OpenAPI specification and generate comprehensive test suites.\n';
    
    return preview;
  }

  /**
   * Execute test generation
   */
  async execute(context: SkillContext): Promise<SkillResult> {
    const startTime = Date.now();
    
    try {
      this.log('Starting REST API test generation');
      
      // Extract options
      const options = this.extractOptions(context);
      
      // Parse OpenAPI spec
      this.log('Parsing OpenAPI specification', { specPath: options.specPath });
      const specPath = path.join(context.projectPath, options.specPath!);
      const parsedSpec = await this.parser.parse(specPath);
      
      this.log('Spec parsed successfully', {
        endpointCount: parsedSpec.endpoints.length,
        schemaCount: Object.keys(parsedSpec.components.schemas).length,
      });
      
      // Filter endpoints if specified
      const endpoints = this.filterEndpoints(parsedSpec, options);
      
      this.log('Generating tests', { endpointCount: endpoints.length });
      
      // Generate tests
      const changes: CodeChange[] = [];
      
      if (options.separateFiles) {
        // Generate separate test file for each endpoint
        for (const endpoint of endpoints) {
          const testCode = await this.generateEndpointTest(endpoint, parsedSpec, options);
          const fileName = this.getTestFileName(endpoint, options);
          const filePath = path.join(options.outputDir || 'tests/api', fileName);
          
          changes.push({
            type: 'create',
            path: filePath,
            content: testCode,
            description: `Test for ${endpoint.method.toUpperCase()} ${endpoint.path}`,
          });
        }
      } else {
        // Generate single test file with all endpoints
        const testCode = await this.generateApiTestSuite(endpoints, parsedSpec, options);
        const filePath = path.join(options.outputDir || 'tests/api', 'api.test.ts');
        
        changes.push({
          type: 'create',
          path: filePath,
          content: testCode,
          description: 'Complete API test suite',
        });
      }
      
      // Generate type definitions
      if (Object.keys(parsedSpec.components.schemas).length > 0) {
        const typeDefinitions = this.parser.generateTypeDefinitions();
        changes.push({
          type: 'create',
          path: path.join(options.outputDir || 'tests/api', 'api-types.ts'),
          content: typeDefinitions,
          description: 'TypeScript type definitions from OpenAPI spec',
        });
      }
      
      // Generate authentication helper if needed
      if (options.includeAuthTests && Object.keys(parsedSpec.securitySchemes).length > 0) {
        const authHelper = this.generateAuthHelper(parsedSpec.securitySchemes, options);
        changes.push({
          type: 'create',
          path: path.join(options.outputDir || 'tests/api', 'auth-helper.ts'),
          content: authHelper,
          description: 'Authentication helper functions',
        });
      }
      
      const duration = Date.now() - startTime;
      
      this.log('Test generation completed', {
        fileCount: changes.length,
        endpointCount: endpoints.length,
        duration,
      });
      
      return this.success(
        `Generated ${changes.length} test files for ${endpoints.length} endpoints`,
        changes,
        {
          endpointCount: endpoints.length,
          schemaCount: Object.keys(parsedSpec.components.schemas).length,
          duration,
        }
      );
      
    } catch (error) {
      this.log('Test generation failed', { error });
      return this.failure(
        `Failed to generate API tests: ${(error as Error).message}`,
        { error: (error as Error).message }
      );
    }
  }

  /**
   * Extract options from context
   */
  private extractOptions(context: SkillContext): RestApiTestOptions {
    const specFiles = context.targetFiles.filter(f => 
      f.endsWith('.yaml') || f.endsWith('.yml') || f.endsWith('.json')
    );
    
    return {
      specPath: specFiles[0],
      testFramework: (context as any).testFramework || 'vitest',
      httpClient: (context as any).httpClient || 'axios',
      separateFiles: (context as any).separateFiles || false,
      includeAuthTests: (context as any).includeAuthTests !== false,
      includeIntegrationTests: (context as any).includeIntegrationTests || false,
      baseUrl: (context as any).baseUrl || 'http://localhost:3000',
      outputDir: (context as any).outputDir || 'tests/api',
      endpoints: (context as any).endpoints,
      tags: (context as any).tags,
    };
  }

  /**
   * Filter endpoints based on options
   */
  private filterEndpoints(spec: ParsedApiSpec, options: RestApiTestOptions): ApiEndpoint[] {
    let endpoints = spec.endpoints;
    
    // Filter by operation IDs or paths
    if (options.endpoints && options.endpoints.length > 0) {
      endpoints = endpoints.filter(e => 
        options.endpoints!.includes(e.operationId || '') ||
        options.endpoints!.includes(e.path)
      );
    }
    
    // Filter by tags
    if (options.tags && options.tags.length > 0) {
      endpoints = endpoints.filter(e => 
        e.tags?.some(tag => options.tags!.includes(tag))
      );
    }
    
    return endpoints;
  }

  /**
   * Generate test for single endpoint
   */
  private async generateEndpointTest(
    endpoint: ApiEndpoint,
    spec: ParsedApiSpec,
    options: RestApiTestOptions
  ): Promise<string> {
    // Build prompt context
    const promptContext: ApiTestPromptContext = {
      endpoint: {
        path: endpoint.path,
        method: endpoint.method,
        operationId: endpoint.operationId,
        summary: endpoint.summary,
        description: endpoint.description,
      },
      parameters: endpoint.parameters.map(p => ({
        name: p.name,
        in: p.in,
        required: p.required,
        type: p.schema.type || 'string',
        description: p.description,
      })),
      requestBody: endpoint.requestBody ? {
        required: endpoint.requestBody.required,
        contentType: Object.keys(endpoint.requestBody.content)[0] || 'application/json',
        schema: Object.values(endpoint.requestBody.content)[0]?.schema,
        example: Object.values(endpoint.requestBody.content)[0]?.example,
      } : undefined,
      responses: Object.entries(endpoint.responses).reduce((acc, [status, response]) => {
        const content = response.content ? Object.values(response.content)[0] : undefined;
        acc[status] = {
          description: response.description,
          schema: content?.schema,
          example: content?.example,
        };
        return acc;
      }, {} as Record<string, any>),
      security: this.extractSecurityInfo(endpoint, spec),
      framework: options.testFramework || 'vitest',
      httpClient: options.httpClient || 'axios',
    };
    
    // Build prompt
    const prompt = buildRestApiTestPrompt(promptContext);
    
    // Generate test code
    const response = await this.llmService.generate({
      provider: 'openai',
      model: 'gpt-4o',
      prompt,
      temperature: 0.3,
      maxTokens: 3000,
    });
    
    return this.cleanGeneratedCode(response.content);
  }

  /**
   * Generate complete API test suite
   */
  private async generateApiTestSuite(
    endpoints: ApiEndpoint[],
    spec: ParsedApiSpec,
    options: RestApiTestOptions
  ): Promise<string> {
    let testSuite = this.generateTestFileHeader(spec, options);
    
    // Generate tests for each endpoint
    for (const endpoint of endpoints) {
      const testCode = await this.generateEndpointTest(endpoint, spec, options);
      
      // Extract test cases (remove imports and setup from individual tests)
      const testCases = this.extractTestCases(testCode);
      testSuite += '\n' + testCases;
    }
    
    return testSuite;
  }

  /**
   * Generate test file header with imports and setup
   */
  private generateTestFileHeader(spec: ParsedApiSpec, options: RestApiTestOptions): string {
    const framework = options.testFramework || 'vitest';
    const httpClient = options.httpClient || 'axios';
    
    let header = `/**
 * Auto-generated API tests for ${spec.info.title}
 * Version: ${spec.info.version}
 * Generated by TestMind
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '${framework}';
import ${httpClient === 'axios' ? "axios, { AxiosInstance }" : httpClient} from '${httpClient}';
`;
    
    if (Object.keys(spec.components.schemas).length > 0) {
      header += `import * as Types from './api-types';\n`;
    }
    
    if (options.includeAuthTests) {
      header += `import { setupAuth, getAuthHeaders } from './auth-helper';\n`;
    }
    
    header += `
const BASE_URL = '${options.baseUrl}';

describe('${spec.info.title} API Tests', () => {
  let client: ${httpClient === 'axios' ? 'AxiosInstance' : 'any'};
  
  beforeAll(async () => {
    client = ${this.generateClientSetup(httpClient, options)};
  });
  
  afterAll(async () => {
    // Cleanup
  });
  
  beforeEach(async () => {
    // Reset state before each test
  });
`;
    
    return header;
  }

  /**
   * Generate HTTP client setup
   */
  private generateClientSetup(httpClient: string, options: RestApiTestOptions): string {
    if (httpClient === 'axios') {
      return `axios.create({
      baseURL: BASE_URL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    })`;
    } else if (httpClient === 'fetch') {
      return `{
      baseURL: BASE_URL,
      timeout: 10000,
    }`;
    }
    
    return `/* Configure ${httpClient} client */`;
  }

  /**
   * Extract test cases from generated code (remove duplicated imports/setup)
   */
  private extractTestCases(code: string): string {
    // Remove import statements
    let cleaned = code.replace(/^import\s+.*?;?\n/gm, '');
    
    // Remove const BASE_URL declarations
    cleaned = cleaned.replace(/^const\s+BASE_URL\s*=.*?;\n/gm, '');
    
    // Remove describe wrapper if present (we'll add our own)
    cleaned = cleaned.replace(/^describe\s*\([^)]+\)\s*,\s*\(\s*\)\s*=>\s*\{/gm, '');
    cleaned = cleaned.replace(/^\}\s*\)\s*;?\s*$/gm, '');
    
    return cleaned.trim();
  }

  /**
   * Extract security information for endpoint
   */
  private extractSecurityInfo(endpoint: ApiEndpoint, spec: ParsedApiSpec): Array<{ type: string; name: string; in?: string }> | undefined {
    if (!endpoint.security || endpoint.security.length === 0) {
      return undefined;
    }
    
    return endpoint.security.flatMap(req => {
      return Object.keys(req).map(schemeName => {
        const scheme = spec.securitySchemes[schemeName];
        if (!scheme) return null;
        
        return {
          type: scheme.type,
          name: schemeName,
          in: scheme.in,
        };
      }).filter(Boolean) as Array<{ type: string; name: string; in?: string }>;
    });
  }

  /**
   * Generate authentication helper
   */
  private generateAuthHelper(securitySchemes: Record<string, SecurityScheme>, options: RestApiTestOptions): string {
    const schemes = Object.entries(securitySchemes);
    
    let code = `/**
 * Authentication helper functions
 * Auto-generated by TestMind
 */

export interface AuthConfig {
${schemes.map(([name, _]) => `  ${name}?: string;`).join('\n')}
}

let authConfig: AuthConfig = {};

export function setupAuth(config: AuthConfig): void {
  authConfig = config;
}

export function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  
`;
    
    for (const [name, scheme] of schemes) {
      if (scheme.type === 'apiKey' && scheme.in === 'header') {
        code += `  if (authConfig.${name}) {
    headers['${scheme.name || 'X-API-Key'}'] = authConfig.${name};
  }
  
`;
      } else if (scheme.type === 'http' && scheme.scheme === 'bearer') {
        code += `  if (authConfig.${name}) {
    headers['Authorization'] = \`Bearer \${authConfig.${name}}\`;
  }
  
`;
      } else if (scheme.type === 'http' && scheme.scheme === 'basic') {
        code += `  if (authConfig.${name}) {
    headers['Authorization'] = \`Basic \${btoa(authConfig.${name})}\`;
  }
  
`;
      }
    }
    
    code += `  return headers;
}

export function clearAuth(): void {
  authConfig = {};
}
`;
    
    return code;
  }

  /**
   * Get test file name for endpoint
   */
  private getTestFileName(endpoint: ApiEndpoint, options: RestApiTestOptions): string {
    if (endpoint.operationId) {
      return `${endpoint.operationId}.test.ts`;
    }
    
    // Create file name from path and method
    const safePath = endpoint.path.replace(/[^a-zA-Z0-9]/g, '-').replace(/^-+|-+$/g, '');
    return `${endpoint.method}-${safePath}.test.ts`;
  }

  /**
   * Clean generated code
   */
  private cleanGeneratedCode(code: string): string {
    // Remove markdown code blocks if present
    let cleaned = code.replace(/^```(?:typescript|ts|javascript|js)?\n/gm, '');
    cleaned = cleaned.replace(/\n```$/gm, '');
    
    // Remove leading/trailing whitespace
    cleaned = cleaned.trim();
    
    return cleaned;
  }
}

/**
 * Create REST API test skill instance
 */
export function createRestApiTestSkill(llmService?: LLMService): RestApiTestSkill {
  return new RestApiTestSkill(llmService);
}




