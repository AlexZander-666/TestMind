/**
 * DataFlowAnalyzer - Data flow analysis for tracking variable usage
 * 
 * Features:
 * - Track variable declarations and assignments
 * - Identify variable reads and writes
 * - Detect data dependencies
 * - Find unused variables
 * - Identify variable shadowing
 * - Track variable scope and lifetime
 */

import { createComponentLogger } from '../utils/logger';
import * as ts from 'typescript';

const logger = createComponentLogger('DataFlowAnalyzer');

// ============================================================================
// Types
// ============================================================================

export interface DataFlowAnalysis {
  variables: VariableInfo[];
  dataFlowGraph: DataFlowGraph;
  unusedVariables: string[];
  shadowedVariables: ShadowedVariable[];
  dependencies: VariableDependency[];
}

export interface VariableInfo {
  name: string;
  kind: 'const' | 'let' | 'var' | 'parameter' | 'function' | 'class';
  type?: string;
  scope: Scope;
  declarations: Declaration[];
  assignments: Assignment[];
  reads: Read[];
  isUnused: boolean;
  isMutated: boolean;
  isExported: boolean;
  isParameter: boolean;
}

export interface Scope {
  type: 'global' | 'function' | 'block' | 'class' | 'module';
  name?: string;
  startLine: number;
  endLine: number;
  parentScope?: Scope;
}

export interface Declaration {
  line: number;
  column: number;
  initialValue?: string;
}

export interface Assignment {
  line: number;
  column: number;
  operator: '=' | '+=' | '-=' | '*=' | '/=' | '&=' | '|=' | '^=' | '<<=' | '>>=' | '>>>=' | '**=' | '&&=' | '||=' | '??=';
  value?: string;
}

export interface Read {
  line: number;
  column: number;
  context: 'expression' | 'argument' | 'return' | 'condition' | 'assignment-rhs';
}

export interface ShadowedVariable {
  name: string;
  innerDeclaration: Declaration;
  outerDeclaration: Declaration;
  innerScope: Scope;
  outerScope: Scope;
}

export interface VariableDependency {
  variable: string;
  dependsOn: string[];
  line: number;
  type: 'declaration' | 'assignment' | 'calculation';
}

export interface DataFlowGraph {
  nodes: DataFlowNode[];
  edges: DataFlowEdge[];
}

export interface DataFlowNode {
  id: string;
  type: 'variable' | 'operation' | 'constant';
  name: string;
  line: number;
}

export interface DataFlowEdge {
  from: string;
  to: string;
  type: 'defines' | 'uses' | 'modifies';
}

// ============================================================================
// Data Flow Analyzer
// ============================================================================

export class DataFlowAnalyzer {
  private variables: Map<string, VariableInfo> = new Map();
  private currentScope: Scope | null = null;
  private scopeStack: Scope[] = [];
  private dependencies: VariableDependency[] = [];
  private shadowedVariables: ShadowedVariable[] = [];

  /**
   * Analyze data flow from TypeScript source file
   */
  analyze(sourceFile: ts.SourceFile): DataFlowAnalysis {
    logger.debug('Analyzing data flow');
    
    this.reset();
    
    // Create global scope
    this.currentScope = {
      type: 'global',
      startLine: 0,
      endLine: sourceFile.getLineAndCharacterOfPosition(sourceFile.end).line,
    };
    
    this.visit(sourceFile);
    
    // Detect unused variables
    const unusedVariables = this.detectUnusedVariables();
    
    // Build data flow graph
    const dataFlowGraph = this.buildDataFlowGraph();
    
    return {
      variables: Array.from(this.variables.values()),
      dataFlowGraph,
      unusedVariables,
      shadowedVariables: this.shadowedVariables,
      dependencies: this.dependencies,
    };
  }

  private reset(): void {
    this.variables.clear();
    this.currentScope = null;
    this.scopeStack = [];
    this.dependencies = [];
    this.shadowedVariables = [];
  }

  private visit(node: ts.Node): void {
    // Handle scope creation
    if (this.createsScopeNode(node)) {
      this.enterScope(node);
    }

    // Variable declarations
    if (ts.isVariableDeclaration(node)) {
      this.handleVariableDeclaration(node);
    }
    
    // Function/method parameters
    else if (ts.isParameter(node)) {
      this.handleParameter(node);
    }
    
    // Function declarations
    else if (ts.isFunctionDeclaration(node)) {
      this.handleFunctionDeclaration(node);
    }
    
    // Class declarations
    else if (ts.isClassDeclaration(node)) {
      this.handleClassDeclaration(node);
    }
    
    // Assignments
    else if (ts.isBinaryExpression(node) && this.isAssignment(node)) {
      this.handleAssignment(node);
    }
    
    // Variable reads
    else if (ts.isIdentifier(node)) {
      this.handleIdentifierRead(node);
    }

    // Visit children
    ts.forEachChild(node, child => this.visit(child));

    // Exit scope
    if (this.createsScopeNode(node)) {
      this.exitScope();
    }
  }

  private createsScopeNode(node: ts.Node): boolean {
    return (
      ts.isFunctionDeclaration(node) ||
      ts.isFunctionExpression(node) ||
      ts.isArrowFunction(node) ||
      ts.isMethodDeclaration(node) ||
      ts.isBlock(node) ||
      ts.isClassDeclaration(node) ||
      ts.isModuleBlock(node)
    );
  }

  private enterScope(node: ts.Node): void {
    const sourceFile = node.getSourceFile();
    const startPos = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    const endPos = sourceFile.getLineAndCharacterOfPosition(node.getEnd());

    let scopeType: Scope['type'] = 'block';
    let scopeName: string | undefined;

    if (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node)) {
      scopeType = 'function';
      if (ts.isFunctionDeclaration(node) && node.name) {
        scopeName = node.name.text;
      }
    } else if (ts.isClassDeclaration(node)) {
      scopeType = 'class';
      if (node.name) {
        scopeName = node.name.text;
      }
    } else if (ts.isModuleBlock(node)) {
      scopeType = 'module';
    }

    const newScope: Scope = {
      type: scopeType,
      name: scopeName,
      startLine: startPos.line + 1,
      endLine: endPos.line + 1,
      parentScope: this.currentScope || undefined,
    };

    this.scopeStack.push(this.currentScope!);
    this.currentScope = newScope;
  }

  private exitScope(): void {
    this.currentScope = this.scopeStack.pop() || null;
  }

  private handleVariableDeclaration(node: ts.VariableDeclaration): void {
    const sourceFile = node.getSourceFile();
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    
    const name = node.name.getText();
    const kind = this.getVariableKind(node);
    const type = node.type?.getText();
    const initialValue = node.initializer?.getText();

    // Check for shadowing
    if (this.variables.has(name)) {
      const existing = this.variables.get(name)!;
      this.shadowedVariables.push({
        name,
        innerDeclaration: {
          line: line + 1,
          column: character,
          initialValue,
        },
        outerDeclaration: existing.declarations[0],
        innerScope: this.currentScope!,
        outerScope: existing.scope,
      });
    }

    // Track variable
    const varInfo: VariableInfo = {
      name,
      kind,
      type,
      scope: this.currentScope!,
      declarations: [{
        line: line + 1,
        column: character,
        initialValue,
      }],
      assignments: [],
      reads: [],
      isUnused: true,
      isMutated: false,
      isExported: false,
      isParameter: false,
    };

    this.variables.set(name, varInfo);

    // Track dependencies if there's an initializer
    if (node.initializer) {
      this.trackDependencies(name, node.initializer, line + 1, 'declaration');
    }
  }

  private handleParameter(node: ts.ParameterDeclaration): void {
    const sourceFile = node.getSourceFile();
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    
    const name = node.name.getText();
    const type = node.type?.getText();
    const initialValue = node.initializer?.getText();

    const varInfo: VariableInfo = {
      name,
      kind: 'parameter',
      type,
      scope: this.currentScope!,
      declarations: [{
        line: line + 1,
        column: character,
        initialValue,
      }],
      assignments: [],
      reads: [],
      isUnused: true,
      isMutated: false,
      isExported: false,
      isParameter: true,
    };

    this.variables.set(name, varInfo);
  }

  private handleFunctionDeclaration(node: ts.FunctionDeclaration): void {
    if (!node.name) return;

    const sourceFile = node.getSourceFile();
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    
    const name = node.name.text;

    const varInfo: VariableInfo = {
      name,
      kind: 'function',
      scope: this.currentScope!,
      declarations: [{
        line: line + 1,
        column: character,
      }],
      assignments: [],
      reads: [],
      isUnused: true,
      isMutated: false,
      isExported: this.isExported(node),
      isParameter: false,
    };

    this.variables.set(name, varInfo);
  }

  private handleClassDeclaration(node: ts.ClassDeclaration): void {
    if (!node.name) return;

    const sourceFile = node.getSourceFile();
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    
    const name = node.name.text;

    const varInfo: VariableInfo = {
      name,
      kind: 'class',
      scope: this.currentScope!,
      declarations: [{
        line: line + 1,
        column: character,
      }],
      assignments: [],
      reads: [],
      isUnused: true,
      isMutated: false,
      isExported: this.isExported(node),
      isParameter: false,
    };

    this.variables.set(name, varInfo);
  }

  private handleAssignment(node: ts.BinaryExpression): void {
    const sourceFile = node.getSourceFile();
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    
    if (ts.isIdentifier(node.left)) {
      const name = node.left.text;
      const variable = this.variables.get(name);
      
      if (variable) {
        const operator = node.operatorToken.getText() as Assignment['operator'];
        const value = node.right.getText();
        
        variable.assignments.push({
          line: line + 1,
          column: character,
          operator,
          value,
        });
        
        variable.isMutated = true;

        // Track dependencies
        this.trackDependencies(name, node.right, line + 1, 'assignment');
      }
    }
  }

  private handleIdentifierRead(node: ts.Identifier): void {
    const name = node.text;
    const variable = this.variables.get(name);
    
    if (!variable) return;

    // Don't count as a read if it's the left side of an assignment
    const parent = node.parent;
    if (ts.isBinaryExpression(parent) && parent.left === node && this.isAssignment(parent)) {
      return;
    }

    // Don't count declaration as read
    if (ts.isVariableDeclaration(parent) && parent.name === node) {
      return;
    }

    const sourceFile = node.getSourceFile();
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());

    const context = this.getReadContext(node);

    variable.reads.push({
      line: line + 1,
      column: character,
      context,
    });

    variable.isUnused = false;
  }

  private trackDependencies(variable: string, expression: ts.Expression, line: number, type: VariableDependency['type']): void {
    const dependsOn: string[] = [];

    const findIdentifiers = (node: ts.Node): void => {
      if (ts.isIdentifier(node)) {
        if (this.variables.has(node.text)) {
          dependsOn.push(node.text);
        }
      }
      ts.forEachChild(node, findIdentifiers);
    };

    findIdentifiers(expression);

    if (dependsOn.length > 0) {
      this.dependencies.push({
        variable,
        dependsOn,
        line,
        type,
      });
    }
  }

  private getVariableKind(node: ts.VariableDeclaration): VariableInfo['kind'] {
    const parent = node.parent;
    if (ts.isVariableDeclarationList(parent)) {
      if (parent.flags & ts.NodeFlags.Const) return 'const';
      if (parent.flags & ts.NodeFlags.Let) return 'let';
      return 'var';
    }
    return 'let';
  }

  private isAssignment(node: ts.BinaryExpression): boolean {
    const op = node.operatorToken.kind;
    return (
      op === ts.SyntaxKind.EqualsToken ||
      op === ts.SyntaxKind.PlusEqualsToken ||
      op === ts.SyntaxKind.MinusEqualsToken ||
      op === ts.SyntaxKind.AsteriskEqualsToken ||
      op === ts.SyntaxKind.SlashEqualsToken ||
      op === ts.SyntaxKind.PercentEqualsToken ||
      op === ts.SyntaxKind.AmpersandEqualsToken ||
      op === ts.SyntaxKind.BarEqualsToken ||
      op === ts.SyntaxKind.CaretEqualsToken ||
      op === ts.SyntaxKind.LessThanLessThanEqualsToken ||
      op === ts.SyntaxKind.GreaterThanGreaterThanEqualsToken ||
      op === ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken ||
      op === ts.SyntaxKind.AsteriskAsteriskEqualsToken ||
      op === ts.SyntaxKind.AmpersandAmpersandEqualsToken ||
      op === ts.SyntaxKind.BarBarEqualsToken ||
      op === ts.SyntaxKind.QuestionQuestionEqualsToken
    );
  }

  private isExported(node: ts.Node): boolean {
    return node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword) || false;
  }

  private getReadContext(node: ts.Identifier): Read['context'] {
    const parent = node.parent;
    
    if (ts.isCallExpression(parent) && parent.arguments.includes(node as any)) {
      return 'argument';
    }
    
    if (ts.isReturnStatement(parent)) {
      return 'return';
    }
    
    if (ts.isIfStatement(parent) || ts.isWhileStatement(parent) || ts.isDoStatement(parent)) {
      return 'condition';
    }
    
    if (ts.isBinaryExpression(parent) && parent.right === node) {
      return 'assignment-rhs';
    }
    
    return 'expression';
  }

  private detectUnusedVariables(): string[] {
    const unused: string[] = [];
    
    for (const [name, variable] of this.variables.entries()) {
      // Exported variables and parameters are not considered unused
      if (variable.isExported || variable.isParameter) {
        variable.isUnused = false;
        continue;
      }
      
      if (variable.reads.length === 0) {
        unused.push(name);
      }
    }
    
    return unused;
  }

  private buildDataFlowGraph(): DataFlowGraph {
    const nodes: DataFlowNode[] = [];
    const edges: DataFlowEdge[] = [];

    // Create nodes for all variables
    for (const variable of this.variables.values()) {
      nodes.push({
        id: variable.name,
        type: 'variable',
        name: variable.name,
        line: variable.declarations[0].line,
      });
    }

    // Create edges based on dependencies
    for (const dependency of this.dependencies) {
      for (const dependsOn of dependency.dependsOn) {
        edges.push({
          from: dependsOn,
          to: dependency.variable,
          type: dependency.type === 'declaration' ? 'defines' : 'uses',
        });
      }
    }

    // Create edges for assignments
    for (const variable of this.variables.values()) {
      for (const assignment of variable.assignments) {
        // This would need more sophisticated analysis to track what's being assigned
        // For now, we just mark it as a modification
      }
    }

    return { nodes, edges };
  }
}

/**
 * Helper function to analyze data flow from source code
 */
export async function analyzeDataFlow(code: string): Promise<DataFlowAnalysis> {
  const sourceFile = ts.createSourceFile(
    'temp.ts',
    code,
    ts.ScriptTarget.Latest,
    true
  );
  
  const analyzer = new DataFlowAnalyzer();
  return analyzer.analyze(sourceFile);
}

