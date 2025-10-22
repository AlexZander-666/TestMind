/**
 * TypeScriptAnalyzer - Deep TypeScript analysis using ts-morph
 * 
 * Features:
 * - Type inference and analysis
 * - Interface and type alias detection
 * - Generic constraints analysis
 * - Function purity detection
 * - Dependency injection analysis
 * - Decorator analysis
 * - Type complexity metrics
 */

import { Project, SourceFile, Node, SyntaxKind, Type, TypeFormatFlags } from 'ts-morph';
import { createComponentLogger } from '../utils/logger';

const logger = createComponentLogger('TypeScriptAnalyzer');

// ============================================================================
// Types
// ============================================================================

export interface TypeScriptAnalysis {
  types: TypeInfo[];
  interfaces: InterfaceInfo[];
  typeAliases: TypeAliasInfo[];
  generics: GenericInfo[];
  functions: FunctionTypeInfo[];
  pureFunctions: string[];
  sideEffectFunctions: SideEffectFunction[];
  decorators: DecoratorInfo[];
  dependencies: TypeDependency[];
  complexity: TypeComplexityMetrics;
}

export interface TypeInfo {
  name: string;
  kind: 'primitive' | 'object' | 'array' | 'tuple' | 'union' | 'intersection' | 'function' | 'class' | 'interface' | 'generic' | 'unknown';
  text: string;
  isNullable: boolean;
  isOptional: boolean;
  isReadonly: boolean;
  genericParameters?: string[];
}

export interface InterfaceInfo {
  name: string;
  isExported: boolean;
  properties: PropertyInfo[];
  methods: MethodInfo[];
  extends: string[];
  genericParameters?: string[];
  location: CodeLocation;
}

export interface TypeAliasInfo {
  name: string;
  isExported: boolean;
  type: TypeInfo;
  genericParameters?: string[];
  location: CodeLocation;
}

export interface PropertyInfo {
  name: string;
  type: TypeInfo;
  isOptional: boolean;
  isReadonly: boolean;
  hasGetter: boolean;
  hasSetter: boolean;
}

export interface MethodInfo {
  name: string;
  parameters: ParameterInfo[];
  returnType: TypeInfo;
  isAsync: boolean;
  isStatic: boolean;
}

export interface ParameterInfo {
  name: string;
  type: TypeInfo;
  isOptional: boolean;
  isRest: boolean;
  defaultValue?: string;
}

export interface GenericInfo {
  name: string;
  constraint?: TypeInfo;
  default?: TypeInfo;
  usage: 'function' | 'class' | 'interface' | 'type-alias';
  location: CodeLocation;
}

export interface FunctionTypeInfo {
  name: string;
  signature: string;
  parameters: ParameterInfo[];
  returnType: TypeInfo;
  isAsync: boolean;
  isPure: boolean;
  hasSideEffects: boolean;
  sideEffects?: SideEffect[];
  location: CodeLocation;
}

export interface SideEffectFunction {
  name: string;
  sideEffects: SideEffect[];
  location: CodeLocation;
}

export interface SideEffect {
  type: 'io' | 'mutation' | 'network' | 'dom' | 'global-state' | 'console' | 'random' | 'time';
  description: string;
  line: number;
}

export interface DecoratorInfo {
  name: string;
  target: 'class' | 'method' | 'property' | 'parameter';
  targetName: string;
  arguments: string[];
  location: CodeLocation;
}

export interface TypeDependency {
  from: string;
  to: string;
  kind: 'extends' | 'implements' | 'uses' | 'imports';
}

export interface CodeLocation {
  line: number;
  column: number;
  filePath: string;
}

export interface TypeComplexityMetrics {
  totalTypes: number;
  complexTypes: number; // Union, intersection, mapped types
  genericTypes: number;
  nestedDepth: number; // Maximum type nesting depth
  averageTypeParameters: number;
}

// ============================================================================
// TypeScript Analyzer
// ============================================================================

export class TypeScriptAnalyzer {
  private project: Project;

  constructor(tsConfigFilePath?: string) {
    this.project = new Project({
      tsConfigFilePath,
      skipAddingFilesFromTsConfig: !tsConfigFilePath,
    });
  }

  /**
   * Add source file to analysis
   */
  addSourceFile(filePath: string, content?: string): SourceFile {
    if (content) {
      return this.project.createSourceFile(filePath, content, { overwrite: true });
    }
    return this.project.addSourceFileAtPath(filePath);
  }

  /**
   * Analyze TypeScript source file
   */
  analyze(sourceFile: SourceFile): TypeScriptAnalysis {
    logger.debug('Analyzing TypeScript source file', { filePath: sourceFile.getFilePath() });

    const interfaces = this.extractInterfaces(sourceFile);
    const typeAliases = this.extractTypeAliases(sourceFile);
    const functions = this.extractFunctions(sourceFile);
    const decorators = this.extractDecorators(sourceFile);
    const pureFunctions = this.detectPureFunctions(functions);
    const sideEffectFunctions = this.detectSideEffects(functions);
    const dependencies = this.extractTypeDependencies(sourceFile);
    const generics = this.extractGenerics(sourceFile);
    const types = this.extractAllTypes(sourceFile);
    const complexity = this.calculateTypeComplexity(types, interfaces, typeAliases);

    return {
      types,
      interfaces,
      typeAliases,
      generics,
      functions,
      pureFunctions,
      sideEffectFunctions,
      decorators,
      dependencies,
      complexity,
    };
  }

  /**
   * Extract all interfaces
   */
  private extractInterfaces(sourceFile: SourceFile): InterfaceInfo[] {
    const interfaces: InterfaceInfo[] = [];

    for (const interfaceDecl of sourceFile.getInterfaces()) {
      const location = this.getLocation(interfaceDecl);
      
      interfaces.push({
        name: interfaceDecl.getName(),
        isExported: interfaceDecl.isExported(),
        properties: interfaceDecl.getProperties().map(prop => ({
          name: prop.getName(),
          type: this.getTypeInfo(prop.getType()),
          isOptional: prop.hasQuestionToken() || false,
          isReadonly: prop.isReadonly(),
          hasGetter: false, // Interfaces don't have getters/setters
          hasSetter: false,
        })),
        methods: interfaceDecl.getMethods().map(method => ({
          name: method.getName(),
          parameters: method.getParameters().map(p => this.getParameterInfo(p)),
          returnType: this.getTypeInfo(method.getReturnType()),
          isAsync: method.isAsync(),
          isStatic: false, // Interfaces don't have static methods
        })),
        extends: interfaceDecl.getExtends().map(e => e.getText()),
        genericParameters: interfaceDecl.getTypeParameters().map(tp => tp.getName()),
        location,
      });
    }

    return interfaces;
  }

  /**
   * Extract type aliases
   */
  private extractTypeAliases(sourceFile: SourceFile): TypeAliasInfo[] {
    const aliases: TypeAliasInfo[] = [];

    for (const typeAlias of sourceFile.getTypeAliases()) {
      const location = this.getLocation(typeAlias);
      
      aliases.push({
        name: typeAlias.getName(),
        isExported: typeAlias.isExported(),
        type: this.getTypeInfo(typeAlias.getType()),
        genericParameters: typeAlias.getTypeParameters().map(tp => tp.getName()),
        location,
      });
    }

    return aliases;
  }

  /**
   * Extract all functions
   */
  private extractFunctions(sourceFile: SourceFile): FunctionTypeInfo[] {
    const functions: FunctionTypeInfo[] = [];

    // Function declarations
    for (const funcDecl of sourceFile.getFunctions()) {
      functions.push(this.analyzeFunctionNode(funcDecl));
    }

    // Arrow functions and function expressions
    for (const varDecl of sourceFile.getVariableDeclarations()) {
      const initializer = varDecl.getInitializer();
      if (initializer && (Node.isArrowFunction(initializer) || Node.isFunctionExpression(initializer))) {
        functions.push(this.analyzeFunctionNode(initializer as any));
      }
    }

    return functions;
  }

  /**
   * Analyze a single function node
   */
  private analyzeFunctionNode(node: any): FunctionTypeInfo {
    const name = node.getName?.() || '<anonymous>';
    const location = this.getLocation(node);
    const parameters = node.getParameters().map((p: any) => this.getParameterInfo(p));
    const returnType = this.getTypeInfo(node.getReturnType());
    const isAsync = node.isAsync();
    
    // Detect side effects
    const sideEffects = this.detectFunctionSideEffects(node);
    const isPure = sideEffects.length === 0;

    return {
      name,
      signature: node.getText().split('\n')[0], // First line of function
      parameters,
      returnType,
      isAsync,
      isPure,
      hasSideEffects: !isPure,
      sideEffects: isPure ? undefined : sideEffects,
      location,
    };
  }

  /**
   * Extract decorator information
   */
  private extractDecorators(sourceFile: SourceFile): DecoratorInfo[] {
    const decorators: DecoratorInfo[] = [];

    // Class decorators
    for (const classDecl of sourceFile.getClasses()) {
      for (const decorator of classDecl.getDecorators()) {
        decorators.push({
          name: decorator.getName(),
          target: 'class',
          targetName: classDecl.getName() || '<anonymous>',
          arguments: decorator.getArguments().map(arg => arg.getText()),
          location: this.getLocation(decorator),
        });
      }

      // Method decorators
      for (const method of classDecl.getMethods()) {
        for (const decorator of method.getDecorators()) {
          decorators.push({
            name: decorator.getName(),
            target: 'method',
            targetName: `${classDecl.getName()}.${method.getName()}`,
            arguments: decorator.getArguments().map(arg => arg.getText()),
            location: this.getLocation(decorator),
          });
        }
      }

      // Property decorators
      for (const prop of classDecl.getProperties()) {
        for (const decorator of prop.getDecorators()) {
          decorators.push({
            name: decorator.getName(),
            target: 'property',
            targetName: `${classDecl.getName()}.${prop.getName()}`,
            arguments: decorator.getArguments().map(arg => arg.getText()),
            location: this.getLocation(decorator),
          });
        }
      }
    }

    return decorators;
  }

  /**
   * Extract generic type parameters
   */
  private extractGenerics(sourceFile: SourceFile): GenericInfo[] {
    const generics: GenericInfo[] = [];

    // From functions
    for (const funcDecl of sourceFile.getFunctions()) {
      for (const typeParam of funcDecl.getTypeParameters()) {
        generics.push({
          name: typeParam.getName(),
          constraint: typeParam.getConstraint() ? this.getTypeInfo(typeParam.getConstraint()!.getType()) : undefined,
          default: typeParam.getDefault() ? this.getTypeInfo(typeParam.getDefault()!.getType()) : undefined,
          usage: 'function',
          location: this.getLocation(typeParam),
        });
      }
    }

    // From interfaces
    for (const interfaceDecl of sourceFile.getInterfaces()) {
      for (const typeParam of interfaceDecl.getTypeParameters()) {
        generics.push({
          name: typeParam.getName(),
          constraint: typeParam.getConstraint() ? this.getTypeInfo(typeParam.getConstraint()!.getType()) : undefined,
          default: typeParam.getDefault() ? this.getTypeInfo(typeParam.getDefault()!.getType()) : undefined,
          usage: 'interface',
          location: this.getLocation(typeParam),
        });
      }
    }

    // From type aliases
    for (const typeAlias of sourceFile.getTypeAliases()) {
      for (const typeParam of typeAlias.getTypeParameters()) {
        generics.push({
          name: typeParam.getName(),
          constraint: typeParam.getConstraint() ? this.getTypeInfo(typeParam.getConstraint()!.getType()) : undefined,
          default: typeParam.getDefault() ? this.getTypeInfo(typeParam.getDefault()!.getType()) : undefined,
          usage: 'type-alias',
          location: this.getLocation(typeParam),
        });
      }
    }

    // From classes
    for (const classDecl of sourceFile.getClasses()) {
      for (const typeParam of classDecl.getTypeParameters()) {
        generics.push({
          name: typeParam.getName(),
          constraint: typeParam.getConstraint() ? this.getTypeInfo(typeParam.getConstraint()!.getType()) : undefined,
          default: typeParam.getDefault() ? this.getTypeInfo(typeParam.getDefault()!.getType()) : undefined,
          usage: 'class',
          location: this.getLocation(typeParam),
        });
      }
    }

    return generics;
  }

  /**
   * Extract all type information
   */
  private extractAllTypes(sourceFile: SourceFile): TypeInfo[] {
    const types: TypeInfo[] = [];
    const seenTypes = new Set<string>();

    const collectTypes = (type: Type) => {
      const typeText = type.getText(undefined, TypeFormatFlags.None);
      if (seenTypes.has(typeText)) return;
      seenTypes.add(typeText);

      types.push(this.getTypeInfo(type));
    };

    // Collect types from all declarations
    sourceFile.forEachDescendant(node => {
      if (Node.hasType(node)) {
        collectTypes(node.getType());
      }
    });

    return types;
  }

  /**
   * Extract type dependencies
   */
  private extractTypeDependencies(sourceFile: SourceFile): TypeDependency[] {
    const dependencies: TypeDependency[] = [];

    // Interface extends
    for (const interfaceDecl of sourceFile.getInterfaces()) {
      const name = interfaceDecl.getName();
      for (const extend of interfaceDecl.getExtends()) {
        dependencies.push({
          from: name,
          to: extend.getText(),
          kind: 'extends',
        });
      }
    }

    // Class implements/extends
    for (const classDecl of sourceFile.getClasses()) {
      const name = classDecl.getName() || '<anonymous>';
      
      const baseClass = classDecl.getBaseClass();
      if (baseClass) {
        dependencies.push({
          from: name,
          to: baseClass.getName(),
          kind: 'extends',
        });
      }

      for (const impl of classDecl.getImplements()) {
        dependencies.push({
          from: name,
          to: impl.getText(),
          kind: 'implements',
        });
      }
    }

    return dependencies;
  }

  /**
   * Detect pure functions
   */
  private detectPureFunctions(functions: FunctionTypeInfo[]): string[] {
    return functions
      .filter(f => f.isPure)
      .map(f => f.name);
  }

  /**
   * Detect functions with side effects
   */
  private detectSideEffects(functions: FunctionTypeInfo[]): SideEffectFunction[] {
    return functions
      .filter(f => f.hasSideEffects)
      .map(f => ({
        name: f.name,
        sideEffects: f.sideEffects || [],
        location: f.location,
      }));
  }

  /**
   * Detect side effects in a function
   */
  private detectFunctionSideEffects(node: any): SideEffect[] {
    const sideEffects: SideEffect[] = [];

    node.forEachDescendant((descendant: any) => {
      const kind = descendant.getKind();
      const line = descendant.getStartLineNumber();

      // I/O operations
      if (Node.isCallExpression(descendant)) {
        const expr = descendant.getExpression();
        const text = expr.getText();
        
        if (text.includes('fs.') || text.includes('readFile') || text.includes('writeFile')) {
          sideEffects.push({
            type: 'io',
            description: 'File system operation',
            line,
          });
        }
        
        if (text.includes('fetch') || text.includes('axios') || text.includes('http')) {
          sideEffects.push({
            type: 'network',
            description: 'Network request',
            line,
          });
        }

        if (text.includes('console.')) {
          sideEffects.push({
            type: 'console',
            description: 'Console output',
            line,
          });
        }

        if (text.includes('Math.random') || text.includes('Date.now')) {
          sideEffects.push({
            type: text.includes('Math.random') ? 'random' : 'time',
            description: text.includes('Math.random') ? 'Non-deterministic (random)' : 'Non-deterministic (time)',
            line,
          });
        }

        if (text.includes('window.') || text.includes('document.')) {
          sideEffects.push({
            type: 'dom',
            description: 'DOM manipulation',
            line,
          });
        }
      }

      // Property access (could be global state)
      if (Node.isPropertyAccessExpression(descendant)) {
        const text = descendant.getText();
        if (text.startsWith('global.') || text.startsWith('window.') || text.startsWith('process.')) {
          sideEffects.push({
            type: 'global-state',
            description: 'Global state access',
            line,
          });
        }
      }

      // Mutations
      if (kind === SyntaxKind.PostfixUnaryExpression || kind === SyntaxKind.PrefixUnaryExpression) {
        sideEffects.push({
          type: 'mutation',
          description: 'Variable mutation (++/--)',
          line,
        });
      }
    });

    return sideEffects;
  }

  /**
   * Get type information from Type object
   */
  private getTypeInfo(type: Type): TypeInfo {
    const text = type.getText(undefined, TypeFormatFlags.UseAliasDefinedOutsideCurrentScope);
    
    return {
      name: type.getSymbol()?.getName() || text,
      kind: this.getTypeKind(type),
      text,
      isNullable: type.isNullable(),
      isOptional: false, // Would need context
      isReadonly: false, // Would need context
      genericParameters: type.getTypeArguments().map(t => t.getText()),
    };
  }

  /**
   * Determine type kind
   */
  private getTypeKind(type: Type): TypeInfo['kind'] {
    if (type.isString() || type.isNumber() || type.isBoolean()) return 'primitive';
    if (type.isArray()) return 'array';
    if (type.isTuple()) return 'tuple';
    if (type.isUnion()) return 'union';
    if (type.isIntersection()) return 'intersection';
    if (type.isInterface()) return 'interface';
    if (type.isClass()) return 'class';
    if (type.getCallSignatures().length > 0) return 'function';
    if (type.isObject()) return 'object';
    return 'unknown';
  }

  /**
   * Get parameter information
   */
  private getParameterInfo(param: any): ParameterInfo {
    return {
      name: param.getName(),
      type: this.getTypeInfo(param.getType()),
      isOptional: param.isOptional(),
      isRest: param.isRestParameter(),
      defaultValue: param.getInitializer()?.getText(),
    };
  }

  /**
   * Get code location
   */
  private getLocation(node: any): CodeLocation {
    const sourceFile = node.getSourceFile();
    const line = node.getStartLineNumber();
    const column = node.getStart() - sourceFile.getLineStarts()[line - 1];
    
    return {
      line,
      column,
      filePath: sourceFile.getFilePath(),
    };
  }

  /**
   * Calculate type complexity metrics
   */
  private calculateTypeComplexity(
    types: TypeInfo[],
    interfaces: InterfaceInfo[],
    aliases: TypeAliasInfo[]
  ): TypeComplexityMetrics {
    const complexTypes = types.filter(t =>
      t.kind === 'union' ||
      t.kind === 'intersection' ||
      (t.genericParameters && t.genericParameters.length > 0)
    ).length;

    const genericTypes = types.filter(t =>
      t.genericParameters && t.genericParameters.length > 0
    ).length;

    const totalTypeParams = types.reduce((sum, t) =>
      sum + (t.genericParameters?.length || 0), 0
    );

    const averageTypeParameters = genericTypes > 0 ? totalTypeParams / genericTypes : 0;

    // Calculate max nesting depth (simplified)
    const nestedDepth = Math.max(
      ...types.map(t => this.calculateTypeNestingDepth(t.text))
    );

    return {
      totalTypes: types.length,
      complexTypes,
      genericTypes,
      nestedDepth,
      averageTypeParameters,
    };
  }

  /**
   * Calculate type nesting depth
   */
  private calculateTypeNestingDepth(typeText: string): number {
    let depth = 0;
    let maxDepth = 0;

    for (const char of typeText) {
      if (char === '<' || char === '{' || char === '[') {
        depth++;
        maxDepth = Math.max(maxDepth, depth);
      } else if (char === '>' || char === '}' || char === ']') {
        depth--;
      }
    }

    return maxDepth;
  }
}

/**
 * Helper function to analyze TypeScript code
 */
export async function analyzeTypeScript(code: string, filePath: string = 'temp.ts'): Promise<TypeScriptAnalysis> {
  const analyzer = new TypeScriptAnalyzer();
  const sourceFile = analyzer.addSourceFile(filePath, code);
  return analyzer.analyze(sourceFile);
}

