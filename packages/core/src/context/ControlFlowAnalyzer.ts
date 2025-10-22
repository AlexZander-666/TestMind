/**
 * ControlFlowAnalyzer - Control flow analysis for code understanding
 * 
 * Features:
 * - Identify branches (if/else, switch/case, ternary)
 * - Detect loops (for, while, do-while, for-of, for-in)
 * - Analyze exception handling (try/catch/finally)
 * - Calculate cyclomatic complexity
 * - Identify early returns and guard clauses
 * - Detect unreachable code
 */

import { createComponentLogger } from '../utils/logger';
import * as Parser from 'tree-sitter';
import * as ts from 'typescript';

const logger = createComponentLogger('ControlFlowAnalyzer');

// ============================================================================
// Types
// ============================================================================

export interface ControlFlowAnalysis {
  branchingPoints: BranchingPoint[];
  loops: Loop[];
  exceptionHandlers: ExceptionHandler[];
  cyclomaticComplexity: number;
  earlyReturns: number;
  guardClauses: GuardClause[];
  unreachableCode: UnreachableCodeBlock[];
  complexity: ComplexityMetrics;
}

export interface BranchingPoint {
  type: 'if' | 'else' | 'switch' | 'case' | 'ternary' | 'logical-and' | 'logical-or' | 'nullish-coalescing' | 'optional-chaining';
  line: number;
  column: number;
  condition?: string;
  branches: number; // Number of branches (e.g., if-else has 2, switch with 5 cases has 5)
}

export interface Loop {
  type: 'for' | 'while' | 'do-while' | 'for-of' | 'for-in' | 'foreach';
  line: number;
  column: number;
  condition?: string;
  hasBreak: boolean;
  hasContinue: boolean;
  isInfinite: boolean; // Detected patterns like while(true)
  nestedLevel: number;
}

export interface ExceptionHandler {
  type: 'try-catch' | 'try-finally' | 'try-catch-finally';
  line: number;
  column: number;
  catchClauses: CatchClause[];
  hasFinallyBlock: boolean;
}

export interface CatchClause {
  errorType?: string; // Type of error being caught (if specified)
  line: number;
}

export interface GuardClause {
  type: 'early-return' | 'throw' | 'continue' | 'break';
  line: number;
  condition: string;
}

export interface UnreachableCodeBlock {
  startLine: number;
  endLine: number;
  reason: 'after-return' | 'after-throw' | 'impossible-condition' | 'other';
}

export interface ComplexityMetrics {
  cyclomatic: number; // McCabe's cyclomatic complexity
  cognitive: number; // Cognitive complexity
  nesting: number; // Maximum nesting level
  branches: number; // Total number of decision points
  loops: number; // Total number of loops
  conditions: number; // Total number of conditions
}

// ============================================================================
// Control Flow Analyzer
// ============================================================================

export class ControlFlowAnalyzer {
  /**
   * Analyze control flow from TypeScript AST
   */
  analyzeFromTypeScript(sourceFile: ts.SourceFile, node?: ts.Node): ControlFlowAnalysis {
    logger.debug('Analyzing control flow from TypeScript AST');
    
    const targetNode = node || sourceFile;
    const visitor = new TypeScriptControlFlowVisitor();
    
    this.visitNode(targetNode, visitor);
    
    return visitor.getAnalysis();
  }

  /**
   * Analyze control flow from Tree-sitter AST
   */
  analyzeFromTreeSitter(tree: Parser.Tree): ControlFlowAnalysis {
    logger.debug('Analyzing control flow from Tree-sitter AST');
    
    const visitor = new TreeSitterControlFlowVisitor();
    this.visitTreeSitterNode(tree.rootNode, visitor);
    
    return visitor.getAnalysis();
  }

  /**
   * Visit TypeScript node recursively
   */
  private visitNode(node: ts.Node, visitor: TypeScriptControlFlowVisitor, depth: number = 0): void {
    visitor.visitNode(node, depth);
    
    ts.forEachChild(node, child => {
      this.visitNode(child, visitor, depth + 1);
    });
  }

  /**
   * Visit Tree-sitter node recursively
   */
  private visitTreeSitterNode(node: Parser.SyntaxNode, visitor: TreeSitterControlFlowVisitor, depth: number = 0): void {
    visitor.visitNode(node, depth);
    
    for (const child of node.children) {
      this.visitTreeSitterNode(child, visitor, depth + 1);
    }
  }
}

// ============================================================================
// TypeScript Control Flow Visitor
// ============================================================================

class TypeScriptControlFlowVisitor {
  private branchingPoints: BranchingPoint[] = [];
  private loops: Loop[] = [];
  private exceptionHandlers: ExceptionHandler[] = [];
  private guardClauses: GuardClause[] = [];
  private unreachableCode: UnreachableCodeBlock[] = [];
  private cyclomaticComplexity: number = 1; // Start at 1
  private maxNestingLevel: number = 0;
  private currentNestingLevel: number = 0;

  visitNode(node: ts.Node, depth: number): void {
    // Track nesting level
    if (this.isNestingNode(node)) {
      this.currentNestingLevel = depth;
      if (depth > this.maxNestingLevel) {
        this.maxNestingLevel = depth;
      }
    }

    // If statement
    if (ts.isIfStatement(node)) {
      this.handleIfStatement(node);
    }
    
    // Switch statement
    else if (ts.isSwitchStatement(node)) {
      this.handleSwitchStatement(node);
    }
    
    // Conditional (ternary) expression
    else if (ts.isConditionalExpression(node)) {
      this.handleTernaryExpression(node);
    }
    
    // Loops
    else if (ts.isForStatement(node)) {
      this.handleForLoop(node, depth);
    }
    else if (ts.isWhileStatement(node)) {
      this.handleWhileLoop(node, depth);
    }
    else if (ts.isDoStatement(node)) {
      this.handleDoWhileLoop(node, depth);
    }
    else if (ts.isForOfStatement(node) || ts.isForInStatement(node)) {
      this.handleForOfInLoop(node, depth);
    }
    
    // Exception handling
    else if (ts.isTryStatement(node)) {
      this.handleTryStatement(node);
    }
    
    // Guard clauses
    else if (ts.isReturnStatement(node)) {
      this.handleReturnStatement(node);
    }
    else if (ts.isThrowStatement(node)) {
      this.handleThrowStatement(node);
    }
    else if (ts.isBreakStatement(node) || ts.isContinueStatement(node)) {
      this.handleBreakContinue(node);
    }
    
    // Logical operators (short-circuit evaluation)
    else if (ts.isBinaryExpression(node)) {
      this.handleBinaryExpression(node);
    }
  }

  private handleIfStatement(node: ts.IfStatement): void {
    const sourceFile = node.getSourceFile();
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    
    const branches = node.elseStatement ? 2 : 1;
    
    this.branchingPoints.push({
      type: 'if',
      line: line + 1,
      column: character,
      condition: node.expression.getText(),
      branches,
    });
    
    this.cyclomaticComplexity++;
  }

  private handleSwitchStatement(node: ts.SwitchStatement): void {
    const sourceFile = node.getSourceFile();
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    
    const caseCount = node.caseBlock.clauses.length;
    
    this.branchingPoints.push({
      type: 'switch',
      line: line + 1,
      column: character,
      condition: node.expression.getText(),
      branches: caseCount,
    });
    
    this.cyclomaticComplexity += caseCount;
  }

  private handleTernaryExpression(node: ts.ConditionalExpression): void {
    const sourceFile = node.getSourceFile();
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    
    this.branchingPoints.push({
      type: 'ternary',
      line: line + 1,
      column: character,
      condition: node.condition.getText(),
      branches: 2,
    });
    
    this.cyclomaticComplexity++;
  }

  private handleForLoop(node: ts.ForStatement, depth: number): void {
    const sourceFile = node.getSourceFile();
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    
    const condition = node.condition?.getText() || '';
    const isInfinite = !node.condition || condition === 'true';
    
    this.loops.push({
      type: 'for',
      line: line + 1,
      column: character,
      condition,
      hasBreak: this.hasBreakStatement(node.statement),
      hasContinue: this.hasContinueStatement(node.statement),
      isInfinite,
      nestedLevel: depth,
    });
    
    this.cyclomaticComplexity++;
  }

  private handleWhileLoop(node: ts.WhileStatement, depth: number): void {
    const sourceFile = node.getSourceFile();
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    
    const condition = node.expression.getText();
    const isInfinite = condition === 'true' || condition === '1';
    
    this.loops.push({
      type: 'while',
      line: line + 1,
      column: character,
      condition,
      hasBreak: this.hasBreakStatement(node.statement),
      hasContinue: this.hasContinueStatement(node.statement),
      isInfinite,
      nestedLevel: depth,
    });
    
    this.cyclomaticComplexity++;
  }

  private handleDoWhileLoop(node: ts.DoStatement, depth: number): void {
    const sourceFile = node.getSourceFile();
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    
    const condition = node.expression.getText();
    
    this.loops.push({
      type: 'do-while',
      line: line + 1,
      column: character,
      condition,
      hasBreak: this.hasBreakStatement(node.statement),
      hasContinue: this.hasContinueStatement(node.statement),
      isInfinite: false, // do-while always executes at least once
      nestedLevel: depth,
    });
    
    this.cyclomaticComplexity++;
  }

  private handleForOfInLoop(node: ts.ForOfStatement | ts.ForInStatement, depth: number): void {
    const sourceFile = node.getSourceFile();
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    
    const type = ts.isForOfStatement(node) ? 'for-of' : 'for-in';
    
    this.loops.push({
      type,
      line: line + 1,
      column: character,
      condition: node.expression.getText(),
      hasBreak: this.hasBreakStatement(node.statement),
      hasContinue: this.hasContinueStatement(node.statement),
      isInfinite: false,
      nestedLevel: depth,
    });
    
    this.cyclomaticComplexity++;
  }

  private handleTryStatement(node: ts.TryStatement): void {
    const sourceFile = node.getSourceFile();
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    
    const catchClauses: CatchClause[] = [];
    if (node.catchClause) {
      const catchLine = sourceFile.getLineAndCharacterOfPosition(node.catchClause.getStart()).line + 1;
      catchClauses.push({
        errorType: node.catchClause.variableDeclaration?.type?.getText(),
        line: catchLine,
      });
    }
    
    const type = node.catchClause && node.finallyBlock
      ? 'try-catch-finally'
      : node.catchClause
      ? 'try-catch'
      : 'try-finally';
    
    this.exceptionHandlers.push({
      type,
      line: line + 1,
      column: character,
      catchClauses,
      hasFinallyBlock: !!node.finallyBlock,
    });
    
    if (node.catchClause) {
      this.cyclomaticComplexity++;
    }
  }

  private handleReturnStatement(node: ts.ReturnStatement): void {
    const sourceFile = node.getSourceFile();
    const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    
    // Check if this is an early return (guard clause)
    const parent = node.parent;
    if (ts.isIfStatement(parent) && parent.thenStatement === node) {
      this.guardClauses.push({
        type: 'early-return',
        line: line + 1,
        condition: parent.expression.getText(),
      });
    }
  }

  private handleThrowStatement(node: ts.ThrowStatement): void {
    const sourceFile = node.getSourceFile();
    const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    
    const parent = node.parent;
    if (ts.isIfStatement(parent)) {
      this.guardClauses.push({
        type: 'throw',
        line: line + 1,
        condition: parent.expression.getText(),
      });
    }
  }

  private handleBreakContinue(node: ts.BreakStatement | ts.ContinueStatement): void {
    const sourceFile = node.getSourceFile();
    const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    
    const type = ts.isBreakStatement(node) ? 'break' : 'continue';
    
    const parent = node.parent;
    if (ts.isIfStatement(parent)) {
      this.guardClauses.push({
        type,
        line: line + 1,
        condition: parent.expression.getText(),
      });
    }
  }

  private handleBinaryExpression(node: ts.BinaryExpression): void {
    const sourceFile = node.getSourceFile();
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    
    // && and || operators create branching points
    if (node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
      this.branchingPoints.push({
        type: 'logical-and',
        line: line + 1,
        column: character,
        branches: 2,
      });
      this.cyclomaticComplexity++;
    } else if (node.operatorToken.kind === ts.SyntaxKind.BarBarToken) {
      this.branchingPoints.push({
        type: 'logical-or',
        line: line + 1,
        column: character,
        branches: 2,
      });
      this.cyclomaticComplexity++;
    } else if (node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken) {
      this.branchingPoints.push({
        type: 'nullish-coalescing',
        line: line + 1,
        column: character,
        branches: 2,
      });
      this.cyclomaticComplexity++;
    }
  }

  private hasBreakStatement(node: ts.Node): boolean {
    let hasBreak = false;
    
    const visit = (n: ts.Node): void => {
      if (ts.isBreakStatement(n)) {
        hasBreak = true;
        return;
      }
      ts.forEachChild(n, visit);
    };
    
    visit(node);
    return hasBreak;
  }

  private hasContinueStatement(node: ts.Node): boolean {
    let hasContinue = false;
    
    const visit = (n: ts.Node): void => {
      if (ts.isContinueStatement(n)) {
        hasContinue = true;
        return;
      }
      ts.forEachChild(n, visit);
    };
    
    visit(node);
    return hasContinue;
  }

  private isNestingNode(node: ts.Node): boolean {
    return (
      ts.isIfStatement(node) ||
      ts.isSwitchStatement(node) ||
      ts.isForStatement(node) ||
      ts.isWhileStatement(node) ||
      ts.isDoStatement(node) ||
      ts.isForOfStatement(node) ||
      ts.isForInStatement(node) ||
      ts.isTryStatement(node) ||
      ts.isFunctionDeclaration(node) ||
      ts.isFunctionExpression(node) ||
      ts.isArrowFunction(node)
    );
  }

  getAnalysis(): ControlFlowAnalysis {
    // Calculate cognitive complexity
    const cognitiveComplexity = this.calculateCognitiveComplexity();
    
    return {
      branchingPoints: this.branchingPoints,
      loops: this.loops,
      exceptionHandlers: this.exceptionHandlers,
      cyclomaticComplexity: this.cyclomaticComplexity,
      earlyReturns: this.guardClauses.filter(g => g.type === 'early-return').length,
      guardClauses: this.guardClauses,
      unreachableCode: this.unreachableCode,
      complexity: {
        cyclomatic: this.cyclomaticComplexity,
        cognitive: cognitiveComplexity,
        nesting: this.maxNestingLevel,
        branches: this.branchingPoints.length,
        loops: this.loops.length,
        conditions: this.branchingPoints.length + this.loops.length,
      },
    };
  }

  private calculateCognitiveComplexity(): number {
    // Simplified cognitive complexity calculation
    // Each nesting level adds to complexity
    let complexity = 0;
    
    for (const branch of this.branchingPoints) {
      complexity += 1; // Base complexity for branching
    }
    
    for (const loop of this.loops) {
      complexity += 1 + loop.nestedLevel; // Loop + nesting penalty
    }
    
    return complexity;
  }
}

// ============================================================================
// Tree-sitter Control Flow Visitor
// ============================================================================

class TreeSitterControlFlowVisitor {
  private branchingPoints: BranchingPoint[] = [];
  private loops: Loop[] = [];
  private cyclomaticComplexity: number = 1;

  visitNode(node: Parser.SyntaxNode, depth: number): void {
    switch (node.type) {
      case 'if_statement':
        this.handleIfStatement(node);
        break;
      case 'switch_statement':
        this.handleSwitchStatement(node);
        break;
      case 'ternary_expression':
        this.handleTernaryExpression(node);
        break;
      case 'for_statement':
      case 'while_statement':
      case 'do_statement':
      case 'for_in_statement':
        this.handleLoop(node, depth);
        break;
    }
  }

  private handleIfStatement(node: Parser.SyntaxNode): void {
    this.branchingPoints.push({
      type: 'if',
      line: node.startPosition.row + 1,
      column: node.startPosition.column,
      branches: 2,
    });
    this.cyclomaticComplexity++;
  }

  private handleSwitchStatement(node: Parser.SyntaxNode): void {
    const caseCount = node.children.filter(c => c.type === 'case_clause').length;
    
    this.branchingPoints.push({
      type: 'switch',
      line: node.startPosition.row + 1,
      column: node.startPosition.column,
      branches: caseCount,
    });
    this.cyclomaticComplexity += caseCount;
  }

  private handleTernaryExpression(node: Parser.SyntaxNode): void {
    this.branchingPoints.push({
      type: 'ternary',
      line: node.startPosition.row + 1,
      column: node.startPosition.column,
      branches: 2,
    });
    this.cyclomaticComplexity++;
  }

  private handleLoop(node: Parser.SyntaxNode, depth: number): void {
    const typeMap: Record<string, Loop['type']> = {
      'for_statement': 'for',
      'while_statement': 'while',
      'do_statement': 'do-while',
      'for_in_statement': 'for-in',
    };
    
    this.loops.push({
      type: typeMap[node.type] || 'for',
      line: node.startPosition.row + 1,
      column: node.startPosition.column,
      hasBreak: false, // Would need deeper analysis
      hasContinue: false,
      isInfinite: false,
      nestedLevel: depth,
    });
    this.cyclomaticComplexity++;
  }

  getAnalysis(): ControlFlowAnalysis {
    return {
      branchingPoints: this.branchingPoints,
      loops: this.loops,
      exceptionHandlers: [],
      cyclomaticComplexity: this.cyclomaticComplexity,
      earlyReturns: 0,
      guardClauses: [],
      unreachableCode: [],
      complexity: {
        cyclomatic: this.cyclomaticComplexity,
        cognitive: 0,
        nesting: 0,
        branches: this.branchingPoints.length,
        loops: this.loops.length,
        conditions: this.branchingPoints.length + this.loops.length,
      },
    };
  }
}

/**
 * Helper function to analyze control flow from TypeScript source
 */
export async function analyzeControlFlow(code: string): Promise<ControlFlowAnalysis> {
  const sourceFile = ts.createSourceFile(
    'temp.ts',
    code,
    ts.ScriptTarget.Latest,
    true
  );
  
  const analyzer = new ControlFlowAnalyzer();
  return analyzer.analyzeFromTypeScript(sourceFile);
}

