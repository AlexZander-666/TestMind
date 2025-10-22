/**
 * GraphqlSchemaParser - Parse and analyze GraphQL schemas
 * 
 * Features:
 * - Parse GraphQL schema from SDL or introspection
 * - Extract types, queries, mutations, subscriptions
 * - Analyze field types, arguments, directives
 * - Generate TypeScript type definitions
 * - Support for custom scalars and directives
 */

import {
  parse,
  buildSchema,
  buildClientSchema,
  getIntrospectionQuery,
  IntrospectionQuery,
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLInputObjectType,
  GraphQLInterfaceType,
  GraphQLUnionType,
  GraphQLEnumType,
  GraphQLScalarType,
  GraphQLField,
  GraphQLInputField,
  GraphQLArgument,
  GraphQLType,
  GraphQLNamedType,
  GraphQLFieldMap,
  GraphQLInputFieldMap,
  isObjectType,
  isInterfaceType,
  isUnionType,
  isEnumType,
  isScalarType,
  isInputObjectType,
  isNonNullType,
  isListType,
  GraphQLNonNull,
  GraphQLList,
} from 'graphql';
import { createComponentLogger } from '../utils/logger';
import * as fs from 'fs-extra';
import * as path from 'path';

const logger = createComponentLogger('GraphqlSchemaParser');

// ============================================================================
// Types
// ============================================================================

export interface ParsedGraphQLSchema {
  schema: GraphQLSchema;
  types: TypeDefinition[];
  queries: OperationDefinition[];
  mutations: OperationDefinition[];
  subscriptions: OperationDefinition[];
  customScalars: ScalarDefinition[];
  enums: EnumDefinition[];
  interfaces: InterfaceDefinition[];
  unions: UnionDefinition[];
}

export interface TypeDefinition {
  name: string;
  kind: 'OBJECT' | 'INPUT_OBJECT' | 'INTERFACE' | 'UNION' | 'ENUM' | 'SCALAR';
  description?: string;
  fields: FieldDefinition[];
  interfaces?: string[];
  possibleTypes?: string[];
}

export interface FieldDefinition {
  name: string;
  type: TypeReference;
  description?: string;
  arguments: ArgumentDefinition[];
  isDeprecated: boolean;
  deprecationReason?: string;
}

export interface ArgumentDefinition {
  name: string;
  type: TypeReference;
  description?: string;
  defaultValue?: any;
}

export interface TypeReference {
  name: string;
  kind: 'SCALAR' | 'OBJECT' | 'INTERFACE' | 'UNION' | 'ENUM' | 'INPUT_OBJECT' | 'LIST' | 'NON_NULL';
  ofType?: TypeReference;
  isNullable: boolean;
  isList: boolean;
}

export interface OperationDefinition {
  name: string;
  type: 'query' | 'mutation' | 'subscription';
  description?: string;
  arguments: ArgumentDefinition[];
  returnType: TypeReference;
  isDeprecated: boolean;
  deprecationReason?: string;
}

export interface ScalarDefinition {
  name: string;
  description?: string;
  isCustom: boolean;
}

export interface EnumDefinition {
  name: string;
  description?: string;
  values: EnumValueDefinition[];
}

export interface EnumValueDefinition {
  name: string;
  description?: string;
  isDeprecated: boolean;
  deprecationReason?: string;
}

export interface InterfaceDefinition {
  name: string;
  description?: string;
  fields: FieldDefinition[];
  implementedBy: string[];
}

export interface UnionDefinition {
  name: string;
  description?: string;
  possibleTypes: string[];
}

// ============================================================================
// Parser Implementation
// ============================================================================

export class GraphqlSchemaParser {
  private schema?: GraphQLSchema;
  private parsedSchema?: ParsedGraphQLSchema;

  /**
   * Parse GraphQL schema from SDL string
   */
  parseFromSDL(sdl: string): ParsedGraphQLSchema {
    try {
      logger.info('Parsing GraphQL schema from SDL');
      
      this.schema = buildSchema(sdl);
      this.parsedSchema = this.parseSchema();
      
      logger.info('Schema parsed successfully', {
        typeCount: this.parsedSchema.types.length,
        queryCount: this.parsedSchema.queries.length,
        mutationCount: this.parsedSchema.mutations.length,
      });
      
      return this.parsedSchema;
    } catch (error) {
      logger.error('Failed to parse GraphQL schema', { error });
      throw new Error(`Failed to parse GraphQL schema: ${(error as Error).message}`);
    }
  }

  /**
   * Parse GraphQL schema from file
   */
  async parseFromFile(filePath: string): Promise<ParsedGraphQLSchema> {
    try {
      logger.info('Reading GraphQL schema file', { filePath });
      
      const sdl = await fs.readFile(filePath, 'utf-8');
      return this.parseFromSDL(sdl);
    } catch (error) {
      logger.error('Failed to read schema file', { error, filePath });
      throw new Error(`Failed to read schema file: ${(error as Error).message}`);
    }
  }

  /**
   * Parse GraphQL schema from introspection result
   */
  parseFromIntrospection(introspectionResult: IntrospectionQuery): ParsedGraphQLSchema {
    try {
      logger.info('Parsing GraphQL schema from introspection');
      
      this.schema = buildClientSchema(introspectionResult);
      this.parsedSchema = this.parseSchema();
      
      return this.parsedSchema;
    } catch (error) {
      logger.error('Failed to parse introspection result', { error });
      throw new Error(`Failed to parse introspection: ${(error as Error).message}`);
    }
  }

  /**
   * Main parsing logic
   */
  private parseSchema(): ParsedGraphQLSchema {
    if (!this.schema) {
      throw new Error('No schema loaded');
    }

    const typeMap = this.schema.getTypeMap();
    const queryType = this.schema.getQueryType();
    const mutationType = this.schema.getMutationType();
    const subscriptionType = this.schema.getSubscriptionType();

    // Filter out built-in types
    const customTypes = Object.values(typeMap).filter(
      type => !type.name.startsWith('__')
    );

    return {
      schema: this.schema,
      types: this.parseTypes(customTypes),
      queries: queryType ? this.parseOperations(queryType, 'query') : [],
      mutations: mutationType ? this.parseOperations(mutationType, 'mutation') : [],
      subscriptions: subscriptionType ? this.parseOperations(subscriptionType, 'subscription') : [],
      customScalars: this.parseCustomScalars(customTypes),
      enums: this.parseEnums(customTypes),
      interfaces: this.parseInterfaces(customTypes),
      unions: this.parseUnions(customTypes),
    };
  }

  /**
   * Parse all types
   */
  private parseTypes(types: readonly GraphQLNamedType[]): TypeDefinition[] {
    const result: TypeDefinition[] = [];

    for (const type of types) {
      if (isObjectType(type) || isInputObjectType(type)) {
        const fields = isObjectType(type)
          ? this.parseFields((type as GraphQLObjectType).getFields())
          : this.parseInputFields((type as GraphQLInputObjectType).getFields());

        result.push({
          name: type.name,
          kind: isObjectType(type) ? 'OBJECT' : 'INPUT_OBJECT',
          description: type.description || undefined,
          fields,
          interfaces: isObjectType(type)
            ? (type as GraphQLObjectType).getInterfaces().map(i => i.name)
            : undefined,
        });
      }
    }

    return result;
  }

  /**
   * Parse object type fields
   */
  private parseFields(fields: GraphQLFieldMap<any, any>): FieldDefinition[] {
    return Object.values(fields).map(field => ({
      name: field.name,
      type: this.parseTypeReference(field.type),
      description: field.description || undefined,
      arguments: field.args.map(arg => this.parseArgument(arg)),
      isDeprecated: field.deprecationReason !== undefined,
      deprecationReason: field.deprecationReason || undefined,
    }));
  }

  /**
   * Parse input object fields
   */
  private parseInputFields(fields: GraphQLInputFieldMap): FieldDefinition[] {
    return Object.values(fields).map(field => ({
      name: field.name,
      type: this.parseTypeReference(field.type),
      description: field.description || undefined,
      arguments: [],
      isDeprecated: false,
    }));
  }

  /**
   * Parse field argument
   */
  private parseArgument(arg: GraphQLArgument | GraphQLInputField): ArgumentDefinition {
    return {
      name: arg.name,
      type: this.parseTypeReference(arg.type),
      description: arg.description || undefined,
      defaultValue: (arg as any).defaultValue,
    };
  }

  /**
   * Parse type reference (handles NonNull and List wrappers)
   */
  private parseTypeReference(type: GraphQLType): TypeReference {
    let currentType = type;
    let isNullable = true;
    let isList = false;
    let innerType: GraphQLNamedType | undefined;

    // Unwrap NonNull
    if (isNonNullType(currentType)) {
      isNullable = false;
      currentType = currentType.ofType;
    }

    // Unwrap List
    if (isListType(currentType)) {
      isList = true;
      currentType = currentType.ofType;
      
      // Check if list items are non-null
      if (isNonNullType(currentType)) {
        currentType = currentType.ofType;
      }
    }

    // Get the named type
    innerType = currentType as GraphQLNamedType;

    let kind: TypeReference['kind'] = 'OBJECT';
    if (isScalarType(innerType)) kind = 'SCALAR';
    else if (isObjectType(innerType)) kind = 'OBJECT';
    else if (isInterfaceType(innerType)) kind = 'INTERFACE';
    else if (isUnionType(innerType)) kind = 'UNION';
    else if (isEnumType(innerType)) kind = 'ENUM';
    else if (isInputObjectType(innerType)) kind = 'INPUT_OBJECT';

    return {
      name: innerType.name,
      kind,
      isNullable,
      isList,
    };
  }

  /**
   * Parse operations (queries, mutations, subscriptions)
   */
  private parseOperations(
    rootType: GraphQLObjectType,
    operationType: 'query' | 'mutation' | 'subscription'
  ): OperationDefinition[] {
    const fields = rootType.getFields();
    
    return Object.values(fields).map(field => ({
      name: field.name,
      type: operationType,
      description: field.description || undefined,
      arguments: field.args.map(arg => this.parseArgument(arg)),
      returnType: this.parseTypeReference(field.type),
      isDeprecated: field.deprecationReason !== undefined,
      deprecationReason: field.deprecationReason || undefined,
    }));
  }

  /**
   * Parse custom scalars
   */
  private parseCustomScalars(types: readonly GraphQLNamedType[]): ScalarDefinition[] {
    const builtInScalars = ['String', 'Int', 'Float', 'Boolean', 'ID'];
    
    return types
      .filter(isScalarType)
      .map(type => ({
        name: type.name,
        description: type.description || undefined,
        isCustom: !builtInScalars.includes(type.name),
      }));
  }

  /**
   * Parse enums
   */
  private parseEnums(types: readonly GraphQLNamedType[]): EnumDefinition[] {
    return types
      .filter(isEnumType)
      .map(type => ({
        name: type.name,
        description: type.description || undefined,
        values: type.getValues().map(value => ({
          name: value.name,
          description: value.description || undefined,
          isDeprecated: value.deprecationReason !== undefined,
          deprecationReason: value.deprecationReason || undefined,
        })),
      }));
  }

  /**
   * Parse interfaces
   */
  private parseInterfaces(types: readonly GraphQLNamedType[]): InterfaceDefinition[] {
    return types
      .filter(isInterfaceType)
      .map(type => {
        const implementedBy = Object.values(this.schema!.getTypeMap())
          .filter(isObjectType)
          .filter(objType => objType.getInterfaces().some(i => i.name === type.name))
          .map(objType => objType.name);

        return {
          name: type.name,
          description: type.description || undefined,
          fields: this.parseFields(type.getFields()),
          implementedBy,
        };
      });
  }

  /**
   * Parse unions
   */
  private parseUnions(types: readonly GraphQLNamedType[]): UnionDefinition[] {
    return types
      .filter(isUnionType)
      .map(type => ({
        name: type.name,
        description: type.description || undefined,
        possibleTypes: type.getTypes().map(t => t.name),
      }));
  }

  /**
   * Generate TypeScript type definitions
   */
  generateTypeDefinitions(): string {
    if (!this.parsedSchema) {
      throw new Error('Must parse schema first');
    }

    let output = '// Auto-generated TypeScript types from GraphQL schema\n\n';

    // Generate scalars
    output += '// Custom Scalars\n';
    for (const scalar of this.parsedSchema.customScalars.filter(s => s.isCustom)) {
      output += `export type ${scalar.name} = any; // TODO: Define proper type\n`;
    }
    output += '\n';

    // Generate enums
    for (const enumDef of this.parsedSchema.enums) {
      if (enumDef.description) {
        output += `/** ${enumDef.description} */\n`;
      }
      output += `export enum ${enumDef.name} {\n`;
      for (const value of enumDef.values) {
        if (value.description) {
          output += `  /** ${value.description} */\n`;
        }
        output += `  ${value.name} = '${value.name}',\n`;
      }
      output += '}\n\n';
    }

    // Generate interfaces
    for (const interfaceDef of this.parsedSchema.interfaces) {
      if (interfaceDef.description) {
        output += `/** ${interfaceDef.description} */\n`;
      }
      output += `export interface ${interfaceDef.name} {\n`;
      for (const field of interfaceDef.fields) {
        if (field.description) {
          output += `  /** ${field.description} */\n`;
        }
        const optional = field.type.isNullable ? '?' : '';
        const typeName = this.typeReferenceToTypeScript(field.type);
        output += `  ${field.name}${optional}: ${typeName};\n`;
      }
      output += '}\n\n';
    }

    // Generate types
    for (const typeDef of this.parsedSchema.types) {
      if (typeDef.description) {
        output += `/** ${typeDef.description} */\n`;
      }
      
      const extendsClause = typeDef.interfaces && typeDef.interfaces.length > 0
        ? ` extends ${typeDef.interfaces.join(', ')}`
        : '';
      
      output += `export interface ${typeDef.name}${extendsClause} {\n`;
      
      for (const field of typeDef.fields) {
        if (field.description) {
          output += `  /** ${field.description} */\n`;
        }
        const optional = field.type.isNullable ? '?' : '';
        const typeName = this.typeReferenceToTypeScript(field.type);
        output += `  ${field.name}${optional}: ${typeName};\n`;
      }
      
      output += '}\n\n';
    }

    return output;
  }

  /**
   * Convert GraphQL type reference to TypeScript type
   */
  private typeReferenceToTypeScript(typeRef: TypeReference): string {
    let typeName: string;

    // Map GraphQL scalars to TypeScript types
    switch (typeRef.name) {
      case 'String':
        typeName = 'string';
        break;
      case 'Int':
      case 'Float':
        typeName = 'number';
        break;
      case 'Boolean':
        typeName = 'boolean';
        break;
      case 'ID':
        typeName = 'string';
        break;
      default:
        typeName = typeRef.name;
    }

    // Wrap in array if needed
    if (typeRef.isList) {
      typeName = `${typeName}[]`;
    }

    // Add null if nullable
    if (typeRef.isNullable && !typeRef.isList) {
      typeName = `${typeName} | null`;
    }

    return typeName;
  }

  /**
   * Get operation by name
   */
  getOperation(name: string): OperationDefinition | undefined {
    if (!this.parsedSchema) return undefined;

    return [
      ...this.parsedSchema.queries,
      ...this.parsedSchema.mutations,
      ...this.parsedSchema.subscriptions,
    ].find(op => op.name === name);
  }

  /**
   * Get type by name
   */
  getType(name: string): TypeDefinition | undefined {
    if (!this.parsedSchema) return undefined;
    return this.parsedSchema.types.find(t => t.name === name);
  }

  /**
   * Get parsed schema
   */
  getParsedSchema(): ParsedGraphQLSchema | undefined {
    return this.parsedSchema;
  }
}

/**
 * Helper function to parse GraphQL schema from SDL
 */
export function parseGraphQLSchema(sdl: string): ParsedGraphQLSchema {
  const parser = new GraphqlSchemaParser();
  return parser.parseFromSDL(sdl);
}

/**
 * Helper function to parse from file
 */
export async function parseGraphQLSchemaFromFile(filePath: string): Promise<ParsedGraphQLSchema> {
  const parser = new GraphqlSchemaParser();
  return await parser.parseFromFile(filePath);
}

/**
 * Helper function to get introspection query
 */
export function getGraphQLIntrospectionQuery(): string {
  return getIntrospectionQuery();
}

