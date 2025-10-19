/**
 * StaticAnalyzer: Parse and analyze code structure using AST
 * Integrates Tree-sitter for multi-language parsing
 */

import Parser from 'tree-sitter';
import TypeScript from 'tree-sitter-typescript';
import JavaScript from 'tree-sitter-javascript';
import type {
  ProjectConfig,
  CodeFile,
  FunctionNode,
  ClassNode,
  SideEffect,
  TestCase,
  ComplexityMetrics,
  ImportNode,
  ExportNode,
  Parameter,
  Property,
} from '@testmind/shared';
import { generateUUID, hashString } from '@testmind/shared';
import { promises as fs } from 'fs';
import fg from 'fast-glob';
import path from 'path';
import { FileCache } from '../utils/FileCache';

export interface AnalysisResult {
  files: CodeFile[];
  totalFunctions: number;
  totalClasses: number;
}

export class StaticAnalyzer {
  private tsParser: Parser;
  private jsParser: Parser;
  private fileCache: FileCache;

  constructor(private config: ProjectConfig, fileCache?: FileCache) {
    // Initialize TypeScript parser
    this.tsParser = new Parser();
    this.tsParser.setLanguage(TypeScript.typescript);

    // Initialize JavaScript parser
    this.jsParser = new Parser();
    this.jsParser.setLanguage(JavaScript);

    // Initialize file cache (use provided instance or create new one)
    this.fileCache = fileCache || new FileCache();
  }

  /**
   * Analyze entire project
   */
  async analyzeProject(projectPath: string): Promise<AnalysisResult> {
    console.log(`[StaticAnalyzer] Analyzing project: ${projectPath}`);

    const startTime = Date.now();

    // Find all source files based on configuration
    // Note: patterns should be relative to projectPath, not absolute
    const patterns = this.config.config.includePatterns;

    console.log(`[StaticAnalyzer] Searching with patterns:`, patterns);
    console.log(`[StaticAnalyzer] Project path:`, projectPath);

    const files = await fg(patterns, {
      ignore: this.config.config.excludePatterns,
      absolute: false,
      cwd: projectPath,
      onlyFiles: true,
    });

    console.log(`[StaticAnalyzer] Found ${files.length} files to analyze`);
    
    // Debug: show first few files if found
    if (files.length > 0) {
      console.log(`[StaticAnalyzer] Sample files:`, files.slice(0, 3));
    }

    // Analyze files in parallel
    const analyzedFiles: CodeFile[] = [];
    let totalFunctions = 0;
    let totalClasses = 0;

    // Process files in batches to avoid overwhelming the system
    const batchSize = 10;
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(async (file) => {
          try {
            const absolutePath = path.join(projectPath, file);
            return await this.analyzeFile(absolutePath);
          } catch (error) {
            console.warn(`[StaticAnalyzer] Failed to analyze ${file}:`, error);
            return null;
          }
        })
      );

      for (const result of batchResults) {
        if (result) {
          analyzedFiles.push(result);
          totalFunctions += result.astData.functions.length;
          totalClasses += result.astData.classes.length;
        }
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[StaticAnalyzer] Analysis complete in ${duration}ms`);

    return {
      files: analyzedFiles,
      totalFunctions,
      totalClasses,
    };
  }

  /**
   * Analyze a single file
   */
  async analyzeFile(filePath: string): Promise<CodeFile> {
    console.log(`[StaticAnalyzer] Analyzing file: ${filePath}`);

    // Read file content with hash (using FileCache for DRY and performance)
    const { content, hash: fileHash } = await this.fileCache.readFileWithHash(filePath);

    // Determine parser based on file extension
    const ext = path.extname(filePath);
    const parser = ext === '.ts' || ext === '.tsx' ? this.tsParser : this.jsParser;

    // Parse file
    const tree = parser.parse(content);
    const rootNode = tree.rootNode;

    // Extract code elements
    const functions = this.extractFunctions(rootNode, content);
    const classes = this.extractClasses(rootNode, content);
    const imports = this.extractImports(rootNode, content);
    const exports = this.extractExports(rootNode, content);

    return {
      id: generateUUID(),
      projectId: this.config.id,
      filePath,
      language: this.config.language,
      hash: fileHash,
      astData: {
        functions,
        classes,
        imports,
        exports,
      },
      indexedAt: new Date(),
    };
  }

  /**
   * Extract functions from AST
   */
  private extractFunctions(node: Parser.SyntaxNode, source: string): FunctionNode[] {
    const functions: FunctionNode[] = [];

    const visit = (n: Parser.SyntaxNode) => {
      // Check for function declarations
      if (
        n.type === 'function_declaration' ||
        n.type === 'function' ||
        n.type === 'arrow_function' ||
        n.type === 'method_definition'
      ) {
        const func = this.parseFunctionNode(n, source);
        if (func) {
          functions.push(func);
        }
      }

      // Recursively visit children
      for (const child of n.children) {
        visit(child);
      }
    };

    visit(node);
    return functions;
  }

  /**
   * Parse a function node
   */
  private parseFunctionNode(node: Parser.SyntaxNode, source: string): FunctionNode | null {
    try {
      // Get function name
      const nameNode = node.childForFieldName('name');
      const name = nameNode ? source.substring(nameNode.startIndex, nameNode.endIndex) : '<anonymous>';

      // Get parameters
      const parameters = this.extractParameters(node, source);

      // Get return type (TypeScript)
      const typeNode = node.childForFieldName('return_type');
      const returnType = typeNode
        ? source.substring(typeNode.startIndex, typeNode.endIndex)
        : undefined;

      // Check if async
      const isAsync = source
        .substring(node.startIndex, node.startIndex + 10)
        .includes('async');

      // Check if exported
      let isExported = false;
      let current = node.parent;
      while (current) {
        if (
          current.type === 'export_statement' ||
          current.type === 'export_declaration' ||
          source.substring(current.startIndex, current.startIndex + 6) === 'export'
        ) {
          isExported = true;
          break;
        }
        current = current.parent;
      }

      return {
        name,
        startLine: node.startPosition.row + 1,
        endLine: node.endPosition.row + 1,
        parameters,
        returnType,
        isAsync,
        isExported,
      };
    } catch (error) {
      console.warn(`[StaticAnalyzer] Failed to parse function:`, error);
      return null;
    }
  }

  /**
   * Extract function parameters
   */
  private extractParameters(node: Parser.SyntaxNode, source: string): Parameter[] {
    const parameters: Parameter[] = [];

    const paramsNode = node.childForFieldName('parameters');
    if (!paramsNode) return parameters;

    for (const child of paramsNode.children) {
      if (
        child.type === 'required_parameter' ||
        child.type === 'optional_parameter' ||
        child.type === 'identifier'
      ) {
        const nameNode = child.childForFieldName('pattern') || child;
        const name = source.substring(nameNode.startIndex, nameNode.endIndex);

        const typeNode = child.childForFieldName('type');
        const type = typeNode
          ? source.substring(typeNode.startIndex, typeNode.endIndex)
          : undefined;

        const optional = child.type === 'optional_parameter' || name.includes('?');

        const valueNode = child.childForFieldName('value');
        const defaultValue = valueNode
          ? source.substring(valueNode.startIndex, valueNode.endIndex)
          : undefined;

        parameters.push({
          name: name.replace('?', ''),
          type,
          optional,
          defaultValue,
        });
      }
    }

    return parameters;
  }

  /**
   * Extract classes from AST
   */
  private extractClasses(node: Parser.SyntaxNode, source: string): ClassNode[] {
    const classes: ClassNode[] = [];

    const visit = (n: Parser.SyntaxNode) => {
      if (n.type === 'class_declaration' || n.type === 'class') {
        const cls = this.parseClassNode(n, source);
        if (cls) {
          classes.push(cls);
        }
      }

      for (const child of n.children) {
        visit(child);
      }
    };

    visit(node);
    return classes;
  }

  /**
   * Parse a class node
   */
  private parseClassNode(node: Parser.SyntaxNode, source: string): ClassNode | null {
    try {
      const nameNode = node.childForFieldName('name');
      const name = nameNode ? source.substring(nameNode.startIndex, nameNode.endIndex) : '<anonymous>';

      // Extract methods
      const methods: FunctionNode[] = [];
      const properties: Property[] = [];

      const bodyNode = node.childForFieldName('body');
      if (bodyNode) {
        for (const child of bodyNode.children) {
          if (child.type === 'method_definition') {
            const method = this.parseFunctionNode(child, source);
            if (method) {
              methods.push(method);
            }
          } else if (child.type === 'field_definition' || child.type === 'public_field_definition') {
            const prop = this.parsePropertyNode(child, source);
            if (prop) {
              properties.push(prop);
            }
          }
        }
      }

      // Extract extends
      const heritageNode = node.childForFieldName('heritage');
      let extendsClass: string | undefined;
      if (heritageNode) {
        extendsClass = source.substring(heritageNode.startIndex, heritageNode.endIndex);
      }

      return {
        name,
        startLine: node.startPosition.row + 1,
        endLine: node.endPosition.row + 1,
        methods,
        properties,
        extends: extendsClass,
        implements: [], // TODO: Extract implements
      };
    } catch (error) {
      console.warn(`[StaticAnalyzer] Failed to parse class:`, error);
      return null;
    }
  }

  /**
   * Parse a property node
   */
  private parsePropertyNode(node: Parser.SyntaxNode, source: string): Property | null {
    try {
      const nameNode = node.childForFieldName('name');
      const name = nameNode ? source.substring(nameNode.startIndex, nameNode.endIndex) : '';

      const typeNode = node.childForFieldName('type');
      const type = typeNode
        ? source.substring(typeNode.startIndex, typeNode.endIndex)
        : undefined;

      // Check visibility
      const nodeText = source.substring(node.startIndex, node.startIndex + 20);
      const visibility: Property['visibility'] = nodeText.includes('private')
        ? 'private'
        : nodeText.includes('protected')
        ? 'protected'
        : 'public';

      const isStatic = nodeText.includes('static');

      return {
        name,
        type,
        visibility,
        isStatic,
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Extract imports
   */
  private extractImports(node: Parser.SyntaxNode, source: string): ImportNode[] {
    const imports: ImportNode[] = [];

    const visit = (n: Parser.SyntaxNode) => {
      if (n.type === 'import_statement') {
        const imp = this.parseImportNode(n, source);
        if (imp) {
          imports.push(imp);
        }
      }

      for (const child of n.children) {
        visit(child);
      }
    };

    visit(node);
    return imports;
  }

  /**
   * Parse import node
   */
  private parseImportNode(node: Parser.SyntaxNode, source: string): ImportNode | null {
    try {
      const sourceNode = node.childForFieldName('source');
      const sourceText = sourceNode
        ? source.substring(sourceNode.startIndex, sourceNode.endIndex).replace(/['"]/g, '')
        : '';

      const specifiers: string[] = [];
      let isDefault = false;

      for (const child of node.children) {
        if (child.type === 'import_clause') {
          for (const spec of child.children) {
            if (spec.type === 'identifier') {
              specifiers.push(source.substring(spec.startIndex, spec.endIndex));
              isDefault = true;
            } else if (spec.type === 'named_imports') {
              for (const named of spec.children) {
                if (named.type === 'import_specifier') {
                  const nameNode = named.childForFieldName('name');
                  if (nameNode) {
                    specifiers.push(source.substring(nameNode.startIndex, nameNode.endIndex));
                  }
                }
              }
            }
          }
        }
      }

      return {
        source: sourceText,
        specifiers,
        isDefault,
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Extract exports
   */
  private extractExports(node: Parser.SyntaxNode, source: string): ExportNode[] {
    const exports: ExportNode[] = [];

    const visit = (n: Parser.SyntaxNode) => {
      if (
        n.type === 'export_statement' ||
        n.type === 'export_declaration'
      ) {
        const exp = this.parseExportNode(n, source);
        if (exp) {
          exports.push(...exp);
        }
      }

      for (const child of n.children) {
        visit(child);
      }
    };

    visit(node);
    return exports;
  }

  /**
   * Parse export node
   */
  private parseExportNode(node: Parser.SyntaxNode, source: string): ExportNode[] {
    const exports: ExportNode[] = [];

    try {
      const nodeText = source.substring(node.startIndex, node.endIndex);
      const isDefault = nodeText.includes('export default');

      // Handle different export types
      for (const child of node.children) {
        if (child.type === 'function_declaration' || child.type === 'class_declaration') {
          const nameNode = child.childForFieldName('name');
          if (nameNode) {
            exports.push({
              name: source.substring(nameNode.startIndex, nameNode.endIndex),
              isDefault,
            });
          }
        } else if (child.type === 'lexical_declaration') {
          // export const/let/var
          for (const decl of child.children) {
            if (decl.type === 'variable_declarator') {
              const nameNode = decl.childForFieldName('name');
              if (nameNode) {
                exports.push({
                  name: source.substring(nameNode.startIndex, nameNode.endIndex),
                  isDefault: false,
                });
              }
            }
          }
        }
      }
    } catch (error) {
      console.warn(`[StaticAnalyzer] Failed to parse export:`, error);
    }

    return exports;
  }

  /**
   * Get specific function details
   */
  async getFunction(filePath: string, functionName: string): Promise<FunctionNode | null> {
    const fileData = await this.analyzeFile(filePath);
    return fileData.astData.functions.find((f) => f.name === functionName) || null;
  }

  /**
   * Analyze function for side effects
   * Fixed: Only analyze function body, exclude comments
   */
  async analyzeSideEffects(filePath: string, functionName: string): Promise<SideEffect[]> {
    console.log(`[StaticAnalyzer] Analyzing side effects: ${functionName}`);

    const sideEffects: SideEffect[] = [];
    const content = await this.fileCache.readFile(filePath);

    // Fix 1: Only analyze target function body, not entire file
    const func = await this.getFunction(filePath, functionName);
    if (!func) {
      console.log(`[StaticAnalyzer] Function ${functionName} not found, skipping side effect analysis`);
      return [];
    }

    // Extract function body
    const lines = content.split('\n');
    const functionBody = lines.slice(func.startLine - 1, func.endLine).join('\n');

    // Fix 2: Exclude comments to avoid false positives
    const codeOnly = functionBody
      .replace(/\/\/.*$/gm, '')           // Single line comments
      .replace(/\/\*[\s\S]*?\*\//g, '')   // Multi-line comments
      .replace(/^\s*$/gm, '');            // Empty lines

    // Fix 3: Detect side effects only in actual code
    const patterns = [
      { regex: /\bfetch\b|\baxios\b|\bhttp\./g, type: 'network' as const },
      { regex: /\bfs\.|readFile|writeFile/g, type: 'filesystem' as const },
      { regex: /\.query\(|\.execute\(|\.save\(/g, type: 'database' as const },
      { regex: /console\.|logger\./g, type: 'io' as const },
      { regex: /this\.|state\.|setState/g, type: 'state' as const },
    ];

    for (const pattern of patterns) {
      const matches = codeOnly.matchAll(pattern.regex);
      for (const match of matches) {
        if (match.index !== undefined) {
          // Calculate line number relative to function start
          const relativeLines = codeOnly.substring(0, match.index).split('\n').length;
          sideEffects.push({
            type: pattern.type,
            description: `Detected ${pattern.type} operation: ${match[0]}`,
            location: {
              filePath,
              line: func.startLine + relativeLines - 1,
              column: 0,
            },
          });
        }
      }
    }

    console.log(`[StaticAnalyzer] Found ${sideEffects.length} side effects in ${functionName}`);
    return sideEffects;
  }

  /**
   * Find existing tests for a function
   */
  async findExistingTests(_filePath: string, functionName: string): Promise<TestCase[]> {
    console.log(`[StaticAnalyzer] Finding tests for: ${functionName}`);

    // TODO: Implement test discovery
    // Look for test files matching the pattern
    // const testPatterns = [
    //   _filePath.replace(/\.ts$/, '.test.ts'),
    //   _filePath.replace(/\.ts$/, '.spec.ts'),
    //   _filePath.replace(/\/src\//, '/__tests__/'),
    // ];

    return [];
  }

  /**
   * Calculate complexity metrics
   */
  async calculateComplexity(filePath: string, functionName: string): Promise<ComplexityMetrics> {
    console.log(`[StaticAnalyzer] Calculating complexity: ${functionName}`);

    const func = await this.getFunction(filePath, functionName);
    if (!func) {
      return {
        cyclomaticComplexity: 1,
        cognitiveComplexity: 1,
        linesOfCode: 0,
        maintainabilityIndex: 100,
      };
    }

    const linesOfCode = func.endLine - func.startLine;

    // Read function body for complexity analysis
    const content = await this.fileCache.readFile(filePath);
    const lines = content.split('\n').slice(func.startLine - 1, func.endLine);
    const functionBody = lines.join('\n');

    // Calculate cyclomatic complexity (count decision points)
    const cyclomaticComplexity = this.calculateCyclomaticComplexity(functionBody);

    // Calculate cognitive complexity (nested complexity)
    const cognitiveComplexity = this.calculateCognitiveComplexity(functionBody);

    // Calculate maintainability index (simple heuristic)
    const maintainabilityIndex = Math.max(
      0,
      Math.min(100, 100 - cyclomaticComplexity * 2 - linesOfCode / 10)
    );

    return {
      cyclomaticComplexity,
      cognitiveComplexity,
      linesOfCode,
      maintainabilityIndex,
    };
  }

  /**
   * Calculate cyclomatic complexity
   */
  private calculateCyclomaticComplexity(code: string): number {
    let complexity = 1; // Base complexity

    // Count decision points
    const patterns = [
      /\bif\b/g,
      /\belse if\b/g,
      /\bfor\b/g,
      /\bwhile\b/g,
      /\bcase\b/g,
      /\bcatch\b/g,
      /\b\?\s*.*\s*:/g, // Ternary operator
      /&&/g,
      /\|\|/g,
    ];

    for (const pattern of patterns) {
      const matches = code.match(pattern);
      if (matches) {
        complexity += matches.length;
      }
    }

    return complexity;
  }

  /**
   * Calculate cognitive complexity (with nesting)
   */
  private calculateCognitiveComplexity(code: string): number {
    let complexity = 0;
    let nestingLevel = 0;

    const lines = code.split('\n');
    for (const line of lines) {
      // Track nesting
      if (line.includes('{')) nestingLevel++;
      if (line.includes('}')) nestingLevel = Math.max(0, nestingLevel - 1);

      // Add complexity with nesting multiplier
      if (/\b(if|for|while|switch|catch)\b/.test(line)) {
        complexity += 1 + nestingLevel;
      }

      // Logical operators in conditions add complexity
      if (/&&|\|\|/.test(line)) {
        complexity += 1;
      }
    }

    return complexity;
  }

  /**
   * Get module exports
   */
  async getModuleExports(modulePath: string): Promise<string[]> {
    const fileData = await this.analyzeFile(modulePath);
    return fileData.astData.exports.map((e) => e.name);
  }

  /**
   * Helper: Get line and column from character index
   */
  private getLineColumn(text: string, index: number): { line: number; column: number } {
    const lines = text.substring(0, index).split('\n');
    return {
      line: lines.length,
      column: lines[lines.length - 1]?.length ?? 0,
    };
  }
}
