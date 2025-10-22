/**
 * API Test Generation Prompts
 * 
 * Specialized prompts for generating API tests with comprehensive coverage
 */

export interface ApiTestPromptContext {
  endpoint: {
    path: string;
    method: string;
    operationId?: string;
    summary?: string;
    description?: string;
  };
  parameters?: Array<{
    name: string;
    in: string;
    required: boolean;
    type: string;
    description?: string;
  }>;
  requestBody?: {
    required: boolean;
    contentType: string;
    schema: any;
    example?: any;
  };
  responses: Record<string, {
    description: string;
    schema?: any;
    example?: any;
  }>;
  security?: Array<{
    type: string;
    name: string;
    in?: string;
  }>;
  framework: 'vitest' | 'jest' | 'mocha';
  httpClient: 'axios' | 'fetch' | 'supertest' | 'got';
}

/**
 * Generate comprehensive REST API test prompt
 */
export function buildRestApiTestPrompt(context: ApiTestPromptContext): string {
  const { endpoint, parameters, requestBody, responses, security, framework, httpClient } = context;

  return `You are an expert API test engineer. Generate comprehensive test cases for the following REST API endpoint.

# Endpoint Information

**Method**: ${endpoint.method.toUpperCase()}
**Path**: ${endpoint.path}
${endpoint.operationId ? `**Operation ID**: ${endpoint.operationId}` : ''}
${endpoint.summary ? `**Summary**: ${endpoint.summary}` : ''}
${endpoint.description ? `**Description**: ${endpoint.description}` : ''}

${parameters && parameters.length > 0 ? `
# Parameters

${parameters.map(p => `- **${p.name}** (${p.in}, ${p.required ? 'required' : 'optional'}, ${p.type})${p.description ? `: ${p.description}` : ''}`).join('\n')}
` : ''}

${requestBody ? `
# Request Body

**Required**: ${requestBody.required}
**Content-Type**: ${requestBody.contentType}

Schema:
\`\`\`json
${JSON.stringify(requestBody.schema, null, 2)}
\`\`\`

${requestBody.example ? `
Example:
\`\`\`json
${JSON.stringify(requestBody.example, null, 2)}
\`\`\`
` : ''}
` : ''}

# Expected Responses

${Object.entries(responses).map(([status, response]) => `
**${status}**: ${response.description}
${response.schema ? `
Schema:
\`\`\`json
${JSON.stringify(response.schema, null, 2)}
\`\`\`
` : ''}
${response.example ? `
Example:
\`\`\`json
${JSON.stringify(response.example, null, 2)}
\`\`\`
` : ''}
`).join('\n')}

${security && security.length > 0 ? `
# Security

${security.map(s => `- ${s.type}: ${s.name}${s.in ? ` (in ${s.in})` : ''}`).join('\n')}
` : ''}

# Requirements

Generate comprehensive test cases using **${framework}** and **${httpClient}** that cover:

## 1. Happy Path Tests
- Test successful ${endpoint.method.toUpperCase()} request with valid data
- Verify response status code (${Object.keys(responses).find(s => s.startsWith('2')) || '200'})
- Validate response schema matches specification
- Check response headers if specified
- Verify response body structure and data types

${parameters && parameters.length > 0 ? `
## 2. Parameter Validation Tests
${parameters.map(p => `- Test ${p.required ? 'missing required' : 'invalid'} parameter: ${p.name}
- Test ${p.name} with boundary values (min/max)
${p.type === 'string' ? `- Test ${p.name} with empty string and special characters` : ''}
${p.type === 'number' || p.type === 'integer' ? `- Test ${p.name} with negative, zero, and very large values` : ''}
`).join('')}
` : ''}

${requestBody ? `
## 3. Request Body Validation Tests
- Test with missing required fields
- Test with invalid data types
- Test with additional unexpected fields
- Test with boundary values for numeric fields
- Test with empty strings, null values
- Test with malformed JSON (if applicable)
${requestBody.required ? '- Test with completely missing request body' : ''}
` : ''}

## 4. Error Handling Tests
${Object.entries(responses).filter(([status]) => status.startsWith('4') || status.startsWith('5')).map(([status, response]) => `
- Test ${status} response: ${response.description}
`).join('')}
${!Object.keys(responses).some(s => s === '400') ? '- Test 400 Bad Request with invalid input' : ''}
${!Object.keys(responses).some(s => s === '401') && security ? '- Test 401 Unauthorized without authentication' : ''}
${!Object.keys(responses).some(s => s === '404') ? '- Test 404 Not Found with non-existent resource' : ''}
${!Object.keys(responses).some(s => s === '500') ? '- Test 500 Internal Server Error handling' : ''}

${security && security.length > 0 ? `
## 5. Authentication Tests
${security.map(s => `- Test with valid ${s.type} authentication
- Test with invalid/expired ${s.type} credentials
- Test with missing authentication
`).join('')}
` : ''}

## 6. Additional Considerations
- Use appropriate test data that matches the schema
- Include clear, descriptive test names
- Add comments explaining complex test scenarios
- Use proper assertions for all validations
- Handle async operations correctly
- Mock external dependencies if needed
- Clean up test data after each test

# Code Style Requirements

1. **Imports**: Import all necessary testing utilities and HTTP client
2. **Setup/Teardown**: Use appropriate hooks (beforeEach, afterEach, beforeAll, afterAll)
3. **Test Structure**: Follow AAA pattern (Arrange, Act, Assert)
4. **Assertions**: Use ${framework === 'vitest' ? 'vitest' : framework} assertion methods (expect, toBe, toEqual, etc.)
5. **HTTP Client**: Use ${httpClient} for making requests
6. **Error Handling**: Use try-catch or expect.rejects for error tests
7. **Type Safety**: Include TypeScript types for request/response if possible

# Output Format

Generate complete, runnable test code in TypeScript. Include:
- All necessary imports
- Type definitions (if applicable)
- Test suite with descriptive name
- Multiple test cases covering all scenarios above
- Proper setup and teardown
- Clear comments for complex logic

Do not include explanatory text outside the code block. Generate production-ready test code.`;
}

/**
 * Generate prompt for authentication-specific tests
 */
export function buildAuthenticationTestPrompt(
  endpoint: string,
  method: string,
  securitySchemes: Array<{ type: string; name: string; in?: string }>
): string {
  return `Generate comprehensive authentication tests for the ${method.toUpperCase()} ${endpoint} endpoint.

# Security Schemes

${securitySchemes.map(s => `- **${s.name}** (${s.type})${s.in ? ` in ${s.in}` : ''}`).join('\n')}

# Test Scenarios

1. **Valid Authentication**
   - Test with valid credentials
   - Verify successful response

2. **Invalid Authentication**
   - Test with invalid credentials
   - Test with expired token
   - Test with malformed authentication header

3. **Missing Authentication**
   - Test without authentication header
   - Verify 401 Unauthorized response

4. **Authorization Failures**
   - Test with valid auth but insufficient permissions (if applicable)
   - Verify 403 Forbidden response

Generate test code with proper authentication setup and error handling.`;
}

/**
 * Generate prompt for edge case tests
 */
export function buildEdgeCaseTestPrompt(
  endpoint: string,
  method: string,
  schema: any
): string {
  return `Generate edge case and boundary tests for ${method.toUpperCase()} ${endpoint}.

# Schema
\`\`\`json
${JSON.stringify(schema, null, 2)}
\`\`\`

# Edge Cases to Test

1. **Boundary Values**
   - Minimum and maximum values for numbers
   - Empty and maximum length strings
   - Empty arrays and objects
   - Null values where applicable

2. **Invalid Data Types**
   - String instead of number
   - Number instead of string
   - Null where not allowed
   - Undefined values

3. **Special Characters**
   - Unicode characters
   - SQL injection attempts
   - XSS attempts
   - Path traversal attempts

4. **Large Payloads**
   - Very large strings
   - Large arrays
   - Deeply nested objects

5. **Concurrent Requests**
   - Multiple simultaneous requests
   - Race conditions

Generate test code covering these edge cases with appropriate assertions.`;
}

/**
 * Generate prompt for response validation
 */
export function buildResponseValidationPrompt(
  endpoint: string,
  method: string,
  responseSchemas: Record<string, any>
): string {
  return `Generate comprehensive response validation tests for ${method.toUpperCase()} ${endpoint}.

# Response Schemas

${Object.entries(responseSchemas).map(([status, schema]) => `
## ${status}
\`\`\`json
${JSON.stringify(schema, null, 2)}
\`\`\`
`).join('\n')}

# Validation Tests

1. **Schema Validation**
   - Verify response matches schema structure
   - Check all required fields are present
   - Validate data types for each field
   - Verify nested object structures

2. **Data Validation**
   - Check value ranges and formats
   - Verify enum values are valid
   - Validate date/time formats
   - Check UUID/ID formats

3. **Header Validation**
   - Verify Content-Type header
   - Check custom headers if specified
   - Validate caching headers

4. **Performance Validation**
   - Check response time is acceptable
   - Verify response size

Generate test code with detailed assertions for all response validations.`;
}

/**
 * Generate prompt for integration tests
 */
export function buildIntegrationTestPrompt(
  endpoints: Array<{ path: string; method: string; operationId?: string }>,
  workflow: string
): string {
  return `Generate integration tests for a multi-step API workflow.

# Workflow: ${workflow}

# Endpoints Involved

${endpoints.map((e, i) => `${i + 1}. ${e.method.toUpperCase()} ${e.path}${e.operationId ? ` (${e.operationId})` : ''}`).join('\n')}

# Test Scenarios

1. **Happy Path Integration**
   - Execute all steps in sequence
   - Verify each step succeeds
   - Pass data between steps
   - Validate final state

2. **Failure Handling**
   - Test failure at each step
   - Verify error propagation
   - Check rollback if applicable

3. **Data Consistency**
   - Verify data created in step 1 is accessible in step 2
   - Check data modifications are reflected
   - Validate referential integrity

Generate integration test code with proper setup, execution, and cleanup.`;
}

/**
 * Simple prompt for basic endpoint test
 */
export function buildBasicEndpointTestPrompt(
  method: string,
  path: string,
  framework: string
): string {
  return `Generate a basic test for ${method.toUpperCase()} ${path} using ${framework}.

Include:
1. Success case (200/201)
2. Not found case (404)
3. Invalid input case (400)

Use clear test names and proper assertions.`;
}




