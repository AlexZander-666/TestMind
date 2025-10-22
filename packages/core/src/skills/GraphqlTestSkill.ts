/**
 * GraphqlTestSkill - GraphQL API test generation
 * 
 * Features:
 * - Parse GraphQL schemas
 * - Generate query tests (fields, nested objects, pagination)
 * - Generate mutation tests (input validation, side effects)
 * - Generate subscription tests
 * - Support fragments and variables
 * - Test error scenarios
 */

import { BaseSkill, SkillContext, SkillResult, CodeChange } from './Skill';
import { LLMService } from '../llm/LLMService';
import {
  GraphqlSchemaParser,
  ParsedGraphQLSchema,
  OperationDefinition,
  TypeDefinition,
  FieldDefinition,
} from '../context/GraphqlSchemaParser';
import * as fs from 'fs-extra';
import * as path from 'path';

export interface GraphQLTestOptions {
  // Schema file path
  schemaPath?: string;
  
  // Schema SDL string
  schemaSdl?: string;
  
  // Specific operations to test
  operations?: string[];
  
  // Test framework
  testFramework?: 'vitest' | 'jest' | 'mocha';
  
  // GraphQL client
  client?: 'apollo-client' | 'urql' | 'graphql-request' | 'axios';
  
  // Generate separate test files per operation
  separateFiles?: boolean;
  
  // Include fragment tests
  includeFragments?: boolean;
  
  // Include subscription tests
  includeSubscriptions?: boolean;
  
  // GraphQL endpoint URL
  endpoint?: string;
  
  // Output directory
  outputDir?: string;
}

export class GraphqlTestSkill extends BaseSkill {
  readonly name = 'graphql-test';
  readonly description = 'Generate comprehensive GraphQL API tests from schema';
  readonly category = 'testing' as const;
  readonly version = '1.0.0';
  readonly author = 'TestMind Core Team';

  readonly requiredDependencies = [
    'graphql',
    '@apollo/client', // or other GraphQL client
  ];

  private llmService: LLMService;
  private parser: GraphqlSchemaParser;

  constructor(llmService?: LLMService) {
    super();
    this.llmService = llmService || new LLMService();
    this.parser = new GraphqlSchemaParser();
  }

  /**
   * Check if this skill can handle the context
   */
  canHandle(context: SkillContext): boolean {
    const prompt = context.userPrompt.toLowerCase();
    
    // Check for GraphQL keywords
    const hasGraphQLKeyword =
      prompt.includes('graphql') ||
      prompt.includes('query') ||
      prompt.includes('mutation') ||
      prompt.includes('subscription');
    
    const hasTestKeyword =
      prompt.includes('test') ||
      prompt.includes('测试') ||
      prompt.includes('generate');
    
    // Check if schema file is provided
    const hasSchemaFile = context.targetFiles.some(f =>
      f.endsWith('.graphql') ||
      f.endsWith('.gql') ||
      f.includes('schema')
    );
    
    return hasGraphQLKeyword && hasTestKeyword && hasSchemaFile;
  }

  /**
   * Validate context
   */
  async validate(context: SkillContext): Promise<string | null> {
    const schemaFiles = context.targetFiles.filter(f =>
      f.endsWith('.graphql') || f.endsWith('.gql')
    );
    
    if (schemaFiles.length === 0) {
      return 'No GraphQL schema file found. Please provide a .graphql or .gql file.';
    }
    
    if (schemaFiles.length > 1) {
      return `Multiple schema files found: ${schemaFiles.join(', ')}. Please provide only one schema file.`;
    }
    
    const schemaPath = path.join(context.projectPath, schemaFiles[0]);
    if (!await fs.pathExists(schemaPath)) {
      return `Schema file not found: ${schemaFiles[0]}`;
    }
    
    return null;
  }

  /**
   * Generate preview
   */
  async preview(context: SkillContext): Promise<string> {
    const schemaFiles = context.targetFiles.filter(f =>
      f.endsWith('.graphql') || f.endsWith('.gql')
    );
    
    let preview = '🔮 GraphQL Test Generation Preview:\n\n';
    preview += `Schema file: ${schemaFiles[0]}\n`;
    preview += `Test framework: ${(context as any).testFramework || 'vitest'}\n`;
    preview += `GraphQL client: ${(context as any).client || 'apollo-client'}\n\n`;
    preview += 'Will analyze the GraphQL schema and generate comprehensive test suites.\n';
    
    return preview;
  }

  /**
   * Execute test generation
   */
  async execute(context: SkillContext): Promise<SkillResult> {
    const startTime = Date.now();
    
    try {
      this.log('Starting GraphQL test generation');
      
      // Extract options
      const options = this.extractOptions(context);
      
      // Parse GraphQL schema
      this.log('Parsing GraphQL schema', { schemaPath: options.schemaPath });
      const schemaPath = path.join(context.projectPath, options.schemaPath!);
      const parsedSchema = await this.parser.parseFromFile(schemaPath);
      
      this.log('Schema parsed successfully', {
        queryCount: parsedSchema.queries.length,
        mutationCount: parsedSchema.mutations.length,
        subscriptionCount: parsedSchema.subscriptions.length,
        typeCount: parsedSchema.types.length,
      });
      
      // Filter operations if specified
      const operations = this.filterOperations(parsedSchema, options);
      
      this.log('Generating tests', { operationCount: operations.length });
      
      // Generate tests
      const changes: CodeChange[] = [];
      
      if (options.separateFiles) {
        // Generate separate test file for each operation
        for (const operation of operations) {
          const testCode = await this.generateOperationTest(operation, parsedSchema, options);
          const fileName = this.getTestFileName(operation, options);
          const filePath = path.join(options.outputDir || 'tests/graphql', fileName);
          
          changes.push({
            type: 'create',
            path: filePath,
            content: testCode,
            description: `Test for ${operation.type} ${operation.name}`,
          });
        }
      } else {
        // Generate single test file with all operations
        const testCode = await this.generateGraphQLTestSuite(operations, parsedSchema, options);
        const filePath = path.join(options.outputDir || 'tests/graphql', 'graphql.test.ts');
        
        changes.push({
          type: 'create',
          path: filePath,
          content: testCode,
          description: 'Complete GraphQL test suite',
        });
      }
      
      // Generate type definitions
      const typeDefinitions = this.parser.generateTypeDefinitions();
      changes.push({
        type: 'create',
        path: path.join(options.outputDir || 'tests/graphql', 'graphql-types.ts'),
        content: typeDefinitions,
        description: 'TypeScript type definitions from GraphQL schema',
      });
      
      // Generate GraphQL client setup
      const clientSetup = this.generateClientSetup(options);
      changes.push({
        type: 'create',
        path: path.join(options.outputDir || 'tests/graphql', 'graphql-client.ts'),
        content: clientSetup,
        description: 'GraphQL client setup',
      });
      
      const duration = Date.now() - startTime;
      
      this.log('Test generation completed', {
        fileCount: changes.length,
        operationCount: operations.length,
        duration,
      });
      
      return this.success(
        `Generated ${changes.length} test files for ${operations.length} operations`,
        changes,
        {
          operationCount: operations.length,
          typeCount: parsedSchema.types.length,
          duration,
        }
      );
      
    } catch (error) {
      this.log('Test generation failed', { error });
      return this.failure(
        `Failed to generate GraphQL tests: ${(error as Error).message}`,
        { error: (error as Error).message }
      );
    }
  }

  /**
   * Extract options from context
   */
  private extractOptions(context: SkillContext): GraphQLTestOptions {
    const schemaFiles = context.targetFiles.filter(f =>
      f.endsWith('.graphql') || f.endsWith('.gql')
    );
    
    return {
      schemaPath: schemaFiles[0],
      testFramework: (context as any).testFramework || 'vitest',
      client: (context as any).client || 'apollo-client',
      separateFiles: (context as any).separateFiles || false,
      includeFragments: (context as any).includeFragments !== false,
      includeSubscriptions: (context as any).includeSubscriptions !== false,
      endpoint: (context as any).endpoint || 'http://localhost:4000/graphql',
      outputDir: (context as any).outputDir || 'tests/graphql',
      operations: (context as any).operations,
    };
  }

  /**
   * Filter operations based on options
   */
  private filterOperations(
    schema: ParsedGraphQLSchema,
    options: GraphQLTestOptions
  ): OperationDefinition[] {
    let operations: OperationDefinition[] = [
      ...schema.queries,
      ...schema.mutations,
    ];
    
    if (options.includeSubscriptions) {
      operations.push(...schema.subscriptions);
    }
    
    // Filter by operation names if specified
    if (options.operations && options.operations.length > 0) {
      operations = operations.filter(op =>
        options.operations!.includes(op.name)
      );
    }
    
    return operations;
  }

  /**
   * Generate test for single operation
   */
  private async generateOperationTest(
    operation: OperationDefinition,
    schema: ParsedGraphQLSchema,
    options: GraphQLTestOptions
  ): Promise<string> {
    const prompt = this.buildOperationTestPrompt(operation, schema, options);
    
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
   * Build prompt for operation test generation
   */
  private buildOperationTestPrompt(
    operation: OperationDefinition,
    schema: ParsedGraphQLSchema,
    options: GraphQLTestOptions
  ): string {
    const { testFramework, client, endpoint } = options;
    
    // Build operation signature
    const args = operation.arguments
      .map(arg => `${arg.name}: ${this.typeToString(arg.type)}`)
      .join(', ');
    
    const returnType = this.typeToString(operation.returnType);
    
    return `You are an expert GraphQL test engineer. Generate comprehensive test cases for the following GraphQL ${operation.type}.

# Operation Information

**Name**: ${operation.name}
**Type**: ${operation.type}
${operation.description ? `**Description**: ${operation.description}` : ''}
**Arguments**: ${args || 'None'}
**Return Type**: ${returnType}

${operation.arguments.length > 0 ? `
# Arguments

${operation.arguments.map(arg => `
**${arg.name}** (${this.typeToString(arg.type)}${arg.defaultValue !== undefined ? `, default: ${JSON.stringify(arg.defaultValue)}` : ''})
${arg.description ? `- ${arg.description}` : ''}
`).join('\n')}
` : ''}

# Test Requirements

Generate comprehensive test cases using **${testFramework}** and **${client}** that cover:

## 1. Happy Path Tests
- Test successful ${operation.type} with valid arguments
- Verify response data structure matches schema
- Check all requested fields are returned
- Validate nested object structures
- Test pagination if applicable (first, last, before, after)

${operation.arguments.length > 0 ? `
## 2. Argument Validation Tests
${operation.arguments.map(arg => `
- Test with missing ${arg.type.isNullable ? 'optional' : 'required'} argument: ${arg.name}
- Test with invalid type for ${arg.name}
${arg.type.kind === 'ENUM' ? `- Test with invalid enum value for ${arg.name}` : ''}
${arg.type.kind === 'SCALAR' && arg.type.name === 'String' ? `- Test with empty string for ${arg.name}` : ''}
${arg.type.kind === 'SCALAR' && (arg.type.name === 'Int' || arg.type.name === 'Float') ? `- Test with negative/zero/large values for ${arg.name}` : ''}
`).join('')}
` : ''}

## 3. Error Handling Tests
- Test with malformed query/mutation
- Test network errors
- Test server errors (500)
- Test validation errors
${operation.type === 'mutation' ? '- Test concurrent mutations' : ''}

## 4. Field Selection Tests
- Test requesting specific fields
- Test nested field selection
- Test with fragments
- Test field aliases

${operation.type === 'mutation' ? `
## 5. Mutation-Specific Tests
- Verify data is actually created/updated/deleted
- Test optimistic updates (if applicable)
- Test cache updates
- Test side effects
` : ''}

${operation.type === 'subscription' ? `
## 5. Subscription-Specific Tests
- Test subscription connection
- Test receiving updates
- Test unsubscribe
- Test reconnection on error
` : ''}

# Code Style Requirements

1. **Imports**: Import necessary testing utilities and GraphQL client
2. **Setup/Teardown**: Use appropriate hooks (beforeEach, afterEach, beforeAll, afterAll)
3. **GraphQL Operations**: Define operations as const with gql tag
4. **Test Structure**: Follow AAA pattern (Arrange, Act, Assert)
5. **Assertions**: Use ${testFramework} assertion methods
6. **Client**: Use ${client} for executing operations
7. **Type Safety**: Include TypeScript types for variables and results
8. **Mocking**: Mock GraphQL server responses where appropriate

# GraphQL Client Setup

Endpoint: ${endpoint}
Client: ${client}

# Output Format

Generate complete, runnable test code in TypeScript. Include:
- All necessary imports
- Type definitions for operation variables and results
- Test suite with descriptive name
- Multiple test cases covering all scenarios above
- Proper setup and teardown
- Clear comments for complex logic
- Sample GraphQL operations using gql tag

Do not include explanatory text outside the code block. Generate production-ready test code.`;
  }

  /**
   * Generate complete GraphQL test suite
   */
  private async generateGraphQLTestSuite(
    operations: OperationDefinition[],
    schema: ParsedGraphQLSchema,
    options: GraphQLTestOptions
  ): Promise<string> {
    let testSuite = this.generateTestFileHeader(schema, options);
    
    // Group operations by type
    const queries = operations.filter(op => op.type === 'query');
    const mutations = operations.filter(op => op.type === 'mutation');
    const subscriptions = operations.filter(op => op.type === 'subscription');
    
    // Generate tests for queries
    if (queries.length > 0) {
      testSuite += '\n  describe("Queries", () => {\n';
      for (const query of queries) {
        const testCode = await this.generateOperationTest(query, schema, options);
        const extracted = this.extractTestCases(testCode);
        testSuite += '\n' + this.indent(extracted, 2);
      }
      testSuite += '\n  });\n';
    }
    
    // Generate tests for mutations
    if (mutations.length > 0) {
      testSuite += '\n  describe("Mutations", () => {\n';
      for (const mutation of mutations) {
        const testCode = await this.generateOperationTest(mutation, schema, options);
        const extracted = this.extractTestCases(testCode);
        testSuite += '\n' + this.indent(extracted, 2);
      }
      testSuite += '\n  });\n';
    }
    
    // Generate tests for subscriptions
    if (subscriptions.length > 0) {
      testSuite += '\n  describe("Subscriptions", () => {\n';
      for (const subscription of subscriptions) {
        const testCode = await this.generateOperationTest(subscription, schema, options);
        const extracted = this.extractTestCases(testCode);
        testSuite += '\n' + this.indent(extracted, 2);
      }
      testSuite += '\n  });\n';
    }
    
    testSuite += '});\n';
    
    return testSuite;
  }

  /**
   * Generate test file header with imports and setup
   */
  private generateTestFileHeader(schema: ParsedGraphQLSchema, options: GraphQLTestOptions): string {
    const { testFramework, client } = options;
    
    let header = `/**
 * Auto-generated GraphQL tests
 * Generated by TestMind
 */

import { describe, it, expect, beforeAll, afterAll } from '${testFramework}';
import { gql } from 'graphql-tag';
`;
    
    // Add client-specific imports
    if (client === 'apollo-client') {
      header += `import { ApolloClient, InMemoryCache } from '@apollo/client';\n`;
    } else if (client === 'urql') {
      header += `import { createClient } from '@urql/core';\n`;
    } else if (client === 'graphql-request') {
      header += `import { GraphQLClient } from 'graphql-request';\n`;
    }
    
    header += `import * as Types from './graphql-types';\n`;
    header += `import { createGraphQLClient } from './graphql-client';\n`;
    header += `\n`;
    header += `const GRAPHQL_ENDPOINT = '${options.endpoint}';\n\n`;
    header += `describe('GraphQL API Tests', () => {\n`;
    header += `  let client: any;\n\n`;
    header += `  beforeAll(() => {\n`;
    header += `    client = createGraphQLClient(GRAPHQL_ENDPOINT);\n`;
    header += `  });\n\n`;
    header += `  afterAll(() => {\n`;
    header += `    // Cleanup\n`;
    header += `  });\n`;
    
    return header;
  }

  /**
   * Generate GraphQL client setup
   */
  private generateClientSetup(options: GraphQLTestOptions): string {
    const { client } = options;
    
    let code = `/**
 * GraphQL client setup
 * Auto-generated by TestMind
 */\n\n`;
    
    if (client === 'apollo-client') {
      code += `import { ApolloClient, InMemoryCache, HttpLink } from '@apollo/client';

export function createGraphQLClient(endpoint: string) {
  return new ApolloClient({
    link: new HttpLink({ uri: endpoint }),
    cache: new InMemoryCache(),
    defaultOptions: {
      query: {
        fetchPolicy: 'network-only',
      },
      watchQuery: {
        fetchPolicy: 'network-only',
      },
    },
  });
}
`;
    } else if (client === 'urql') {
      code += `import { createClient } from '@urql/core';

export function createGraphQLClient(endpoint: string) {
  return createClient({
    url: endpoint,
    requestPolicy: 'network-only',
  });
}
`;
    } else if (client === 'graphql-request') {
      code += `import { GraphQLClient } from 'graphql-request';

export function createGraphQLClient(endpoint: string) {
  return new GraphQLClient(endpoint, {
    headers: {
      'Content-Type': 'application/json',
    },
  });
}
`;
    }
    
    return code;
  }

  /**
   * Extract test cases from generated code
   */
  private extractTestCases(code: string): string {
    // Remove import statements
    let cleaned = code.replace(/^import\s+.*?;?\n/gm, '');
    
    // Remove describe wrapper
    cleaned = cleaned.replace(/^describe\s*\([^)]+\)\s*,\s*\(\s*\)\s*=>\s*\{/gm, '');
    cleaned = cleaned.replace(/^\}\s*\)\s*;?\s*$/gm, '');
    
    return cleaned.trim();
  }

  /**
   * Indent code
   */
  private indent(code: string, level: number): string {
    const spaces = '  '.repeat(level);
    return code.split('\n').map(line => line ? spaces + line : line).join('\n');
  }

  /**
   * Convert type reference to string
   */
  private typeToString(typeRef: any): string {
    let str = typeRef.name;
    
    if (typeRef.isList) {
      str = `[${str}]`;
    }
    
    if (!typeRef.isNullable) {
      str = `${str}!`;
    }
    
    return str;
  }

  /**
   * Get test file name for operation
   */
  private getTestFileName(operation: OperationDefinition, options: GraphQLTestOptions): string {
    return `${operation.name}.test.ts`;
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
 * Create GraphQL test skill instance
 */
export function createGraphqlTestSkill(llmService?: LLMService): GraphqlTestSkill {
  return new GraphqlTestSkill(llmService);
}

