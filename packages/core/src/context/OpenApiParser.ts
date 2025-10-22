/**
 * OpenApiParser - OpenAPI 3.0 and Swagger 2.0 specification parser
 * 
 * Capabilities:
 * - Parse OpenAPI 3.0 and Swagger 2.0 specifications
 * - Extract endpoints, parameters, request bodies, responses
 * - Generate TypeScript type definitions
 * - Support multiple authentication strategies
 * - Extract validation rules and constraints
 */

import SwaggerParser from '@apidevtools/swagger-parser';
import type { OpenAPI, OpenAPIV2, OpenAPIV3, OpenAPIV3_1 } from 'openapi-types';
import { createComponentLogger } from '../utils/logger';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as yaml from 'js-yaml';

const logger = createComponentLogger('OpenApiParser');

// ============================================================================
// Types
// ============================================================================

export interface ApiEndpoint {
  // Basic info
  operationId?: string;
  path: string;
  method: HttpMethod;
  summary?: string;
  description?: string;
  tags?: string[];

  // Parameters
  parameters: ApiParameter[];
  
  // Request body
  requestBody?: ApiRequestBody;
  
  // Responses
  responses: Record<string, ApiResponse>;
  
  // Security
  security?: SecurityRequirement[];
  
  // Additional metadata
  deprecated?: boolean;
  servers?: ApiServer[];
}

export type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete' | 'options' | 'head' | 'trace';

export interface ApiParameter {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie';
  description?: string;
  required: boolean;
  deprecated?: boolean;
  schema: JsonSchema;
  example?: any;
  examples?: Record<string, any>;
}

export interface ApiRequestBody {
  description?: string;
  required: boolean;
  content: Record<string, MediaType>;
}

export interface MediaType {
  schema: JsonSchema;
  example?: any;
  examples?: Record<string, any>;
  encoding?: Record<string, EncodingObject>;
}

export interface EncodingObject {
  contentType?: string;
  headers?: Record<string, ApiParameter>;
  style?: string;
  explode?: boolean;
  allowReserved?: boolean;
}

export interface ApiResponse {
  description: string;
  content?: Record<string, MediaType>;
  headers?: Record<string, ApiParameter>;
  links?: Record<string, any>;
}

export interface JsonSchema {
  type?: string;
  format?: string;
  items?: JsonSchema;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  enum?: any[];
  default?: any;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
  additionalProperties?: boolean | JsonSchema;
  $ref?: string;
  allOf?: JsonSchema[];
  anyOf?: JsonSchema[];
  oneOf?: JsonSchema[];
  not?: JsonSchema;
  nullable?: boolean;
  description?: string;
  title?: string;
  example?: any;
}

export interface SecurityRequirement {
  [name: string]: string[];
}

export interface SecurityScheme {
  type: 'apiKey' | 'http' | 'oauth2' | 'openIdConnect';
  name?: string;
  in?: 'query' | 'header' | 'cookie';
  scheme?: string;
  bearerFormat?: string;
  flows?: OAuthFlows;
  openIdConnectUrl?: string;
  description?: string;
}

export interface OAuthFlows {
  implicit?: OAuthFlow;
  password?: OAuthFlow;
  clientCredentials?: OAuthFlow;
  authorizationCode?: OAuthFlow;
}

export interface OAuthFlow {
  authorizationUrl?: string;
  tokenUrl?: string;
  refreshUrl?: string;
  scopes: Record<string, string>;
}

export interface ApiServer {
  url: string;
  description?: string;
  variables?: Record<string, ServerVariable>;
}

export interface ServerVariable {
  default: string;
  enum?: string[];
  description?: string;
}

export interface ParsedApiSpec {
  openApiVersion: string;
  info: ApiInfo;
  servers: ApiServer[];
  endpoints: ApiEndpoint[];
  securitySchemes: Record<string, SecurityScheme>;
  components: Components;
  tags?: Tag[];
}

export interface ApiInfo {
  title: string;
  version: string;
  description?: string;
  termsOfService?: string;
  contact?: Contact;
  license?: License;
}

export interface Contact {
  name?: string;
  url?: string;
  email?: string;
}

export interface License {
  name: string;
  url?: string;
}

export interface Components {
  schemas: Record<string, JsonSchema>;
  responses: Record<string, ApiResponse>;
  parameters: Record<string, ApiParameter>;
  examples: Record<string, any>;
  requestBodies: Record<string, ApiRequestBody>;
  headers: Record<string, ApiParameter>;
  securitySchemes: Record<string, SecurityScheme>;
}

export interface Tag {
  name: string;
  description?: string;
  externalDocs?: ExternalDocumentation;
}

export interface ExternalDocumentation {
  description?: string;
  url: string;
}

// ============================================================================
// Parser Implementation
// ============================================================================

export class OpenApiParser {
  private spec?: OpenAPIV3.Document | OpenAPIV2.Document;
  private parsedSpec?: ParsedApiSpec;

  /**
   * Parse OpenAPI specification from file or URL
   */
  async parse(specPath: string): Promise<ParsedApiSpec> {
    try {
      logger.info('Parsing OpenAPI specification', { specPath });

      // Validate and dereference the spec
      this.spec = (await SwaggerParser.validate(specPath, {
        dereference: { circular: 'ignore' },
      })) as OpenAPIV3.Document | OpenAPIV2.Document;

      logger.debug('Spec validated successfully', {
        version: this.getOpenApiVersion(),
      });

      // Parse the spec
      this.parsedSpec = await this.parseSpec();

      logger.info('OpenAPI spec parsed successfully', {
        endpointCount: this.parsedSpec.endpoints.length,
        schemaCount: Object.keys(this.parsedSpec.components.schemas).length,
      });

      return this.parsedSpec;
    } catch (error) {
      logger.error('Failed to parse OpenAPI spec', { error, specPath });
      throw new Error(`Failed to parse OpenAPI spec: ${(error as Error).message}`);
    }
  }

  /**
   * Parse from raw spec object
   */
  async parseFromObject(spec: OpenAPIV3.Document | OpenAPIV2.Document): Promise<ParsedApiSpec> {
    try {
      // Validate the spec
      this.spec = (await SwaggerParser.validate(spec, {
        dereference: { circular: 'ignore' },
      })) as OpenAPIV3.Document | OpenAPIV2.Document;

      this.parsedSpec = await this.parseSpec();
      return this.parsedSpec;
    } catch (error) {
      logger.error('Failed to parse OpenAPI spec object', { error });
      throw new Error(`Failed to parse OpenAPI spec: ${(error as Error).message}`);
    }
  }

  /**
   * Main parsing logic
   */
  private async parseSpec(): Promise<ParsedApiSpec> {
    if (!this.spec) {
      throw new Error('No spec loaded');
    }

    const isV3 = this.isOpenAPIV3(this.spec);

    return {
      openApiVersion: this.getOpenApiVersion(),
      info: this.parseInfo(),
      servers: this.parseServers(),
      endpoints: this.parseEndpoints(),
      securitySchemes: this.parseSecuritySchemes(),
      components: this.parseComponents(),
      tags: this.parseTags(),
    };
  }

  /**
   * Check if spec is OpenAPI 3.x
   */
  private isOpenAPIV3(spec: any): spec is OpenAPIV3.Document {
    return spec.openapi && spec.openapi.startsWith('3.');
  }

  /**
   * Get OpenAPI version
   */
  private getOpenApiVersion(): string {
    if (!this.spec) return 'unknown';
    return (this.spec as any).openapi || (this.spec as any).swagger || 'unknown';
  }

  /**
   * Parse API info
   */
  private parseInfo(): ApiInfo {
    if (!this.spec) throw new Error('No spec loaded');
    
    const info = this.spec.info;
    return {
      title: info.title,
      version: info.version,
      description: info.description,
      termsOfService: (info as any).termsOfService,
      contact: info.contact,
      license: info.license,
    };
  }

  /**
   * Parse servers
   */
  private parseServers(): ApiServer[] {
    if (!this.spec) return [];

    if (this.isOpenAPIV3(this.spec)) {
      return (this.spec.servers || []).map((server: OpenAPIV3.ServerObject) => ({
        url: server.url,
        description: server.description,
        variables: server.variables as any,
      }));
    } else {
      // Swagger 2.0
      const swagger = this.spec as OpenAPIV2.Document;
      const schemes = swagger.schemes || ['https'];
      const host = swagger.host || 'localhost';
      const basePath = swagger.basePath || '';

      return schemes.map(scheme => ({
        url: `${scheme}://${host}${basePath}`,
        description: `${scheme.toUpperCase()} server`,
      }));
    }
  }

  /**
   * Parse all endpoints
   */
  private parseEndpoints(): ApiEndpoint[] {
    if (!this.spec || !this.spec.paths) return [];

    const endpoints: ApiEndpoint[] = [];

    for (const [path, pathItem] of Object.entries(this.spec.paths)) {
      if (!pathItem) continue;

      const methods: HttpMethod[] = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'trace'];

      for (const method of methods) {
        const operation = (pathItem as any)[method];
        if (!operation) continue;

        endpoints.push(this.parseEndpoint(path, method, operation, pathItem));
      }
    }

    return endpoints;
  }

  /**
   * Parse single endpoint
   */
  private parseEndpoint(
    path: string,
    method: HttpMethod,
    operation: OpenAPIV3.OperationObject | OpenAPIV2.OperationObject,
    pathItem: OpenAPIV3.PathItemObject | OpenAPIV2.PathItemObject
  ): ApiEndpoint {
    const isV3 = this.isOpenAPIV3(this.spec!);

    return {
      path,
      method,
      operationId: operation.operationId,
      summary: operation.summary,
      description: operation.description,
      tags: operation.tags,
      parameters: this.parseParameters(operation, pathItem),
      requestBody: isV3 ? this.parseRequestBody((operation as OpenAPIV3.OperationObject).requestBody) : undefined,
      responses: this.parseResponses(operation.responses),
      security: operation.security as SecurityRequirement[],
      deprecated: operation.deprecated,
      servers: isV3 ? ((operation as OpenAPIV3.OperationObject).servers as any) : undefined,
    };
  }

  /**
   * Parse parameters
   */
  private parseParameters(
    operation: OpenAPIV3.OperationObject | OpenAPIV2.OperationObject,
    pathItem: OpenAPIV3.PathItemObject | OpenAPIV2.PathItemObject
  ): ApiParameter[] {
    const params: ApiParameter[] = [];
    
    // Path-level parameters
    const pathParams = (pathItem as any).parameters || [];
    params.push(...pathParams.map((p: any) => this.parseParameter(p)));

    // Operation-level parameters
    const opParams = operation.parameters || [];
    params.push(...opParams.map((p: any) => this.parseParameter(p)));

    return params;
  }

  /**
   * Parse single parameter
   */
  private parseParameter(param: OpenAPIV3.ParameterObject | OpenAPIV2.Parameter): ApiParameter {
    const isV3 = this.isOpenAPIV3(this.spec!);

    if (isV3) {
      const p = param as OpenAPIV3.ParameterObject;
      return {
        name: p.name,
        in: p.in as any,
        description: p.description,
        required: p.required || false,
        deprecated: p.deprecated,
        schema: p.schema as JsonSchema || {},
        example: (p as any).example,
        examples: (p as any).examples,
      };
    } else {
      // Swagger 2.0
      const p = param as OpenAPIV2.Parameter;
      return {
        name: p.name,
        in: p.in as any,
        description: p.description,
        required: p.required || false,
        schema: {
          type: (p as any).type,
          format: (p as any).format,
          items: (p as any).items,
          enum: (p as any).enum,
          default: (p as any).default,
        },
        example: (p as any).example,
      };
    }
  }

  /**
   * Parse request body (OpenAPI 3.0 only)
   */
  private parseRequestBody(requestBody?: OpenAPIV3.RequestBodyObject | OpenAPIV3.ReferenceObject): ApiRequestBody | undefined {
    if (!requestBody || '$ref' in requestBody) return undefined;

    return {
      description: requestBody.description,
      required: requestBody.required || false,
      content: Object.entries(requestBody.content || {}).reduce((acc, [contentType, mediaType]) => {
        acc[contentType] = {
          schema: mediaType.schema as JsonSchema || {},
          example: (mediaType as any).example,
          examples: (mediaType as any).examples,
          encoding: (mediaType as any).encoding,
        };
        return acc;
      }, {} as Record<string, MediaType>),
    };
  }

  /**
   * Parse responses
   */
  private parseResponses(responses: OpenAPIV3.ResponsesObject | OpenAPIV2.ResponsesObject): Record<string, ApiResponse> {
    const parsed: Record<string, ApiResponse> = {};

    for (const [statusCode, response] of Object.entries(responses)) {
      if ('$ref' in response) continue;

      const isV3 = this.isOpenAPIV3(this.spec!);
      
      if (isV3) {
        const r = response as OpenAPIV3.ResponseObject;
        parsed[statusCode] = {
          description: r.description,
          content: r.content ? Object.entries(r.content).reduce((acc, [contentType, mediaType]) => {
            acc[contentType] = {
              schema: mediaType.schema as JsonSchema || {},
              example: (mediaType as any).example,
              examples: (mediaType as any).examples,
            };
            return acc;
          }, {} as Record<string, MediaType>) : undefined,
          headers: r.headers as any,
          links: r.links,
        };
      } else {
        const r = response as OpenAPIV2.ResponseObject;
        parsed[statusCode] = {
          description: r.description,
          content: r.schema ? {
            'application/json': {
              schema: r.schema as JsonSchema,
              example: (r as any).examples?.['application/json'],
            },
          } : undefined,
          headers: r.headers as any,
        };
      }
    }

    return parsed;
  }

  /**
   * Parse security schemes
   */
  private parseSecuritySchemes(): Record<string, SecurityScheme> {
    if (!this.spec) return {};

    const isV3 = this.isOpenAPIV3(this.spec);

    if (isV3) {
      const components = (this.spec as OpenAPIV3.Document).components;
      return (components?.securitySchemes || {}) as Record<string, SecurityScheme>;
    } else {
      const swagger = this.spec as OpenAPIV2.Document;
      return (swagger.securityDefinitions || {}) as Record<string, SecurityScheme>;
    }
  }

  /**
   * Parse components
   */
  private parseComponents(): Components {
    if (!this.spec) {
      return {
        schemas: {},
        responses: {},
        parameters: {},
        examples: {},
        requestBodies: {},
        headers: {},
        securitySchemes: {},
      };
    }

    const isV3 = this.isOpenAPIV3(this.spec);

    if (isV3) {
      const components = (this.spec as OpenAPIV3.Document).components || {};
      return {
        schemas: (components.schemas || {}) as Record<string, JsonSchema>,
        responses: (components.responses || {}) as Record<string, ApiResponse>,
        parameters: (components.parameters || {}) as Record<string, ApiParameter>,
        examples: components.examples || {},
        requestBodies: (components.requestBodies || {}) as Record<string, ApiRequestBody>,
        headers: (components.headers || {}) as Record<string, ApiParameter>,
        securitySchemes: (components.securitySchemes || {}) as Record<string, SecurityScheme>,
      };
    } else {
      // Swagger 2.0
      const swagger = this.spec as OpenAPIV2.Document;
      return {
        schemas: (swagger.definitions || {}) as Record<string, JsonSchema>,
        responses: (swagger.responses || {}) as Record<string, ApiResponse>,
        parameters: (swagger.parameters || {}) as Record<string, ApiParameter>,
        examples: {},
        requestBodies: {},
        headers: {},
        securitySchemes: (swagger.securityDefinitions || {}) as Record<string, SecurityScheme>,
      };
    }
  }

  /**
   * Parse tags
   */
  private parseTags(): Tag[] | undefined {
    if (!this.spec) return undefined;
    return (this.spec.tags || []) as Tag[];
  }

  /**
   * Generate TypeScript type definitions from schemas
   */
  generateTypeDefinitions(): string {
    if (!this.parsedSpec) {
      throw new Error('Must parse spec first');
    }

    const { schemas } = this.parsedSpec.components;
    let output = '// Auto-generated TypeScript types from OpenAPI spec\n\n';

    for (const [name, schema] of Object.entries(schemas)) {
      output += this.schemaToTypeScript(name, schema);
      output += '\n\n';
    }

    return output;
  }

  /**
   * Convert JSON Schema to TypeScript interface
   */
  private schemaToTypeScript(name: string, schema: JsonSchema, indent: number = 0): string {
    const spaces = '  '.repeat(indent);

    if (schema.$ref) {
      const refName = schema.$ref.split('/').pop()!;
      return refName;
    }

    if (schema.allOf) {
      const types = schema.allOf.map((s, i) => this.schemaToTypeScript(`${name}_${i}`, s, indent)).join(' & ');
      return `export type ${name} = ${types};`;
    }

    if (schema.anyOf || schema.oneOf) {
      const types = (schema.anyOf || schema.oneOf)!.map((s, i) => this.schemaToTypeScript(`${name}_${i}`, s, indent)).join(' | ');
      return `export type ${name} = ${types};`;
    }

    if (schema.enum) {
      const values = schema.enum.map(v => typeof v === 'string' ? `'${v}'` : v).join(' | ');
      return `export type ${name} = ${values};`;
    }

    if (schema.type === 'object' || schema.properties) {
      let output = `export interface ${name} {\n`;
      const props = schema.properties || {};
      const required = schema.required || [];

      for (const [propName, propSchema] of Object.entries(props)) {
        const isRequired = required.includes(propName);
        const propType = this.schemaToTypeScriptType(propSchema);
        const optional = isRequired ? '' : '?';
        const comment = propSchema.description ? `  /** ${propSchema.description} */\n${spaces}` : '';
        output += `${comment}  ${propName}${optional}: ${propType};\n`;
      }

      output += `${spaces}}`;
      return output;
    }

    if (schema.type === 'array') {
      const itemType = schema.items ? this.schemaToTypeScriptType(schema.items) : 'any';
      return `export type ${name} = ${itemType}[];`;
    }

    return `export type ${name} = ${this.schemaToTypeScriptType(schema)};`;
  }

  /**
   * Convert JSON Schema type to TypeScript type
   */
  private schemaToTypeScriptType(schema: JsonSchema): string {
    if (schema.$ref) {
      return schema.$ref.split('/').pop()!;
    }

    if (schema.allOf) {
      return schema.allOf.map(s => this.schemaToTypeScriptType(s)).join(' & ');
    }

    if (schema.anyOf || schema.oneOf) {
      return (schema.anyOf || schema.oneOf)!.map(s => this.schemaToTypeScriptType(s)).join(' | ');
    }

    if (schema.enum) {
      return schema.enum.map(v => typeof v === 'string' ? `'${v}'` : v).join(' | ');
    }

    if (schema.type === 'array') {
      const itemType = schema.items ? this.schemaToTypeScriptType(schema.items) : 'any';
      return `${itemType}[]`;
    }

    if (schema.type === 'object' || schema.properties) {
      if (!schema.properties) return 'Record<string, any>';
      
      const props = Object.entries(schema.properties)
        .map(([key, prop]) => `${key}: ${this.schemaToTypeScriptType(prop)}`)
        .join('; ');
      return `{ ${props} }`;
    }

    // Primitive types
    switch (schema.type) {
      case 'string':
        return 'string';
      case 'number':
      case 'integer':
        return 'number';
      case 'boolean':
        return 'boolean';
      case 'null':
        return 'null';
      default:
        return 'any';
    }
  }

  /**
   * Get parsed spec
   */
  getParsedSpec(): ParsedApiSpec | undefined {
    return this.parsedSpec;
  }

  /**
   * Get endpoints by tag
   */
  getEndpointsByTag(tag: string): ApiEndpoint[] {
    if (!this.parsedSpec) return [];
    return this.parsedSpec.endpoints.filter(e => e.tags?.includes(tag));
  }

  /**
   * Get endpoint by operation ID
   */
  getEndpointByOperationId(operationId: string): ApiEndpoint | undefined {
    if (!this.parsedSpec) return undefined;
    return this.parsedSpec.endpoints.find(e => e.operationId === operationId);
  }
}

/**
 * Helper function to parse OpenAPI spec
 */
export async function parseOpenApiSpec(specPath: string): Promise<ParsedApiSpec> {
  const parser = new OpenApiParser();
  return await parser.parse(specPath);
}

/**
 * Helper function to parse from object
 */
export async function parseOpenApiSpecFromObject(spec: OpenAPIV3.Document | OpenAPIV2.Document): Promise<ParsedApiSpec> {
  const parser = new OpenApiParser();
  return await parser.parseFromObject(spec);
}




