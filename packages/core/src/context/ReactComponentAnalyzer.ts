/**
 * ReactComponentAnalyzer - Deep analysis of React components
 * 
 * Features:
 * - Analyze Props (types, required, defaults)
 * - Analyze State (useState, useReducer, Context)
 * - Analyze Hooks and their dependencies
 * - Detect side effects (useEffect, useLayoutEffect)
 * - Analyze event handlers
 * - Component hierarchy and composition
 * - React Testing Library best practices
 */

import { Project, SourceFile, Node, SyntaxKind } from 'ts-morph';
import { createComponentLogger } from '../utils/logger';
import * as path from 'path';

const logger = createComponentLogger('ReactComponentAnalyzer');

// ============================================================================
// Types
// ============================================================================

export interface ReactComponentAnalysis {
  components: ReactComponent[];
  hooks: CustomHook[];
  contexts: ReactContext[];
  totalComponents: number;
  functionalComponents: number;
  classComponents: number;
}

export interface ReactComponent {
  name: string;
  type: 'functional' | 'class' | 'forward-ref' | 'memo';
  filePath: string;
  location: CodeLocation;
  
  // Props analysis
  props: PropDefinition[];
  propsInterface?: string;
  
  // State analysis
  state: StateVariable[];
  
  // Hooks analysis
  hooks: HookUsage[];
  
  // Side effects
  effects: EffectInfo[];
  
  // Event handlers
  eventHandlers: EventHandler[];
  
  // Composition
  childComponents: string[];
  parentComponent?: string;
  
  // Rendering
  conditionalRendering: ConditionalRender[];
  listRendering: ListRender[];
  
  // Testing
  testingRecommendations: TestingRecommendation[];
}

export interface PropDefinition {
  name: string;
  type: string;
  required: boolean;
  defaultValue?: string;
  description?: string;
}

export interface StateVariable {
  name: string;
  setter: string;
  initialValue?: string;
  type?: string;
  hook: 'useState' | 'useReducer' | 'useContext';
}

export interface HookUsage {
  hookName: string;
  isBuiltIn: boolean;
  isCustom: boolean;
  arguments: string[];
  dependencies?: string[]; // For useEffect, useCallback, useMemo
  line: number;
}

export interface EffectInfo {
  type: 'useEffect' | 'useLayoutEffect';
  dependencies: string[];
  hasCleanup: boolean;
  runsOnMount: boolean; // Empty dependency array
  runsOnEveryRender: boolean; // No dependency array
  sideEffects: SideEffectType[];
  line: number;
}

export type SideEffectType =
  | 'api-call'
  | 'dom-manipulation'
  | 'event-listener'
  | 'timer'
  | 'subscription'
  | 'localStorage'
  | 'sessionStorage'
  | 'other';

export interface EventHandler {
  name: string;
  type: 'onClick' | 'onChange' | 'onSubmit' | 'onBlur' | 'onFocus' | 'custom';
  parameters: string[];
  handlerName: string;
  line: number;
}

export interface ConditionalRender {
  type: 'if' | 'ternary' | 'logical-and';
  condition: string;
  line: number;
}

export interface ListRender {
  arrayName: string;
  keyProp?: string;
  hasKey: boolean;
  line: number;
}

export interface CustomHook {
  name: string;
  filePath: string;
  location: CodeLocation;
  parameters: string[];
  returnType?: string;
  usedHooks: HookUsage[];
}

export interface ReactContext {
  name: string;
  defaultValue?: string;
  provider?: string;
  consumer?: string;
  location: CodeLocation;
}

export interface TestingRecommendation {
  type: 'props' | 'state' | 'events' | 'hooks' | 'rendering' | 'accessibility';
  priority: 'high' | 'medium' | 'low';
  description: string;
  example?: string;
}

export interface CodeLocation {
  line: number;
  column: number;
  filePath: string;
}

// ============================================================================
// React Component Analyzer
// ============================================================================

export class ReactComponentAnalyzer {
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
   * Analyze React components in source file
   */
  analyze(sourceFile: SourceFile): ReactComponentAnalysis {
    logger.debug('Analyzing React components', { filePath: sourceFile.getFilePath() });

    const components: ReactComponent[] = [];
    const hooks: CustomHook[] = [];
    const contexts: ReactContext[] = [];

    // Find components
    components.push(...this.findFunctionalComponents(sourceFile));
    components.push(...this.findClassComponents(sourceFile));

    // Find custom hooks
    hooks.push(...this.findCustomHooks(sourceFile));

    // Find contexts
    contexts.push(...this.findContexts(sourceFile));

    // Analyze component relationships
    this.analyzeComponentHierarchy(components);

    // Generate testing recommendations
    for (const component of components) {
      component.testingRecommendations = this.generateTestingRecommendations(component);
    }

    return {
      components,
      hooks,
      contexts,
      totalComponents: components.length,
      functionalComponents: components.filter(c => c.type === 'functional' || c.type === 'forward-ref' || c.type === 'memo').length,
      classComponents: components.filter(c => c.type === 'class').length,
    };
  }

  /**
   * Find functional components
   */
  private findFunctionalComponents(sourceFile: SourceFile): ReactComponent[] {
    const components: ReactComponent[] = [];

    // Function declarations
    for (const func of sourceFile.getFunctions()) {
      if (this.isReactComponent(func)) {
        components.push(this.analyzeFunctionalComponent(func, sourceFile));
      }
    }

    // Arrow functions and const declarations
    for (const varDecl of sourceFile.getVariableDeclarations()) {
      const initializer = varDecl.getInitializer();
      
      if (initializer && (Node.isArrowFunction(initializer) || Node.isFunctionExpression(initializer))) {
        if (this.isReactComponent(initializer)) {
          components.push(this.analyzeFunctionalComponent(initializer as any, sourceFile));
        }
      }
    }

    return components;
  }

  /**
   * Check if node is a React component
   */
  private isReactComponent(node: any): boolean {
    const text = node.getText();
    
    // Check for JSX/TSX return
    const hasJSXReturn = /return\s*\(?\s*</.test(text) || /return\s+</.test(text);
    
    // Check for React hooks usage
    const hasHooks = /use[A-Z]/.test(text);
    
    // Check for component naming convention (PascalCase)
    const name = node.getName?.();
    const isPascalCase = name && /^[A-Z]/.test(name);
    
    return (hasJSXReturn || hasHooks) && isPascalCase;
  }

  /**
   * Analyze a functional component
   */
  private analyzeFunctionalComponent(node: any, sourceFile: SourceFile): ReactComponent {
    const name = node.getName?.() || node.getSymbol()?.getName() || '<Anonymous>';
    const location = this.getLocation(node, sourceFile);

    // Analyze props
    const props = this.analyzeProps(node);
    
    // Analyze state
    const state = this.analyzeState(node);
    
    // Analyze hooks
    const hooks = this.analyzeHooks(node);
    
    // Analyze effects
    const effects = this.analyzeEffects(node);
    
    // Analyze event handlers
    const eventHandlers = this.analyzeEventHandlers(node);
    
    // Analyze rendering patterns
    const { conditionalRendering, listRendering } = this.analyzeRenderingPatterns(node);
    
    // Find child components
    const childComponents = this.findChildComponents(node);

    return {
      name,
      type: 'functional',
      filePath: sourceFile.getFilePath(),
      location,
      props,
      state,
      hooks,
      effects,
      eventHandlers,
      childComponents,
      conditionalRendering,
      listRendering,
      testingRecommendations: [],
    };
  }

  /**
   * Find class components
   */
  private findClassComponents(sourceFile: SourceFile): ReactComponent[] {
    const components: ReactComponent[] = [];

    for (const classDecl of sourceFile.getClasses()) {
      // Check if extends React.Component or Component
      const baseClass = classDecl.getBaseClass();
      if (baseClass && (baseClass.getName() === 'Component' || baseClass.getName() === 'PureComponent')) {
        components.push(this.analyzeClassComponent(classDecl, sourceFile));
      }
    }

    return components;
  }

  /**
   * Analyze a class component
   */
  private analyzeClassComponent(classDecl: any, sourceFile: SourceFile): ReactComponent {
    const name = classDecl.getName() || '<Anonymous>';
    const location = this.getLocation(classDecl, sourceFile);

    // For class components, analysis is different
    // Would need to analyze:
    // - this.props
    // - this.state
    // - lifecycle methods
    // - event handlers as class methods

    return {
      name,
      type: 'class',
      filePath: sourceFile.getFilePath(),
      location,
      props: [],
      state: [],
      hooks: [],
      effects: [],
      eventHandlers: [],
      childComponents: [],
      conditionalRendering: [],
      listRendering: [],
      testingRecommendations: [],
    };
  }

  /**
   * Analyze component props
   */
  private analyzeProps(node: any): PropDefinition[] {
    const props: PropDefinition[] = [];
    const parameters = node.getParameters();

    if (parameters.length === 0) return props;

    const propsParam = parameters[0];
    const type = propsParam.getType();

    // Get properties from the type
    const properties = type.getProperties();

    for (const prop of properties) {
      const propDecl = prop.getValueDeclaration();
      if (!propDecl) continue;

      const propType = prop.getTypeAtLocation(propDecl);
      
      props.push({
        name: prop.getName(),
        type: propType.getText(),
        required: !propType.isNullable(),
        defaultValue: this.getDefaultValue(propsParam, prop.getName()),
      });
    }

    return props;
  }

  /**
   * Get default value for a prop
   */
  private getDefaultValue(propsParam: any, propName: string): string | undefined {
    // Check for destructuring with defaults
    const initializer = propsParam.getInitializer();
    if (initializer) {
      const text = initializer.getText();
      const match = new RegExp(`${propName}\\s*=\\s*([^,}]+)`).exec(text);
      if (match) {
        return match[1].trim();
      }
    }
    return undefined;
  }

  /**
   * Analyze state (useState, useReducer)
   */
  private analyzeState(node: any): StateVariable[] {
    const stateVars: StateVariable[] = [];

    node.forEachDescendant((descendant: any) => {
      if (!Node.isCallExpression(descendant)) return;

      const expr = descendant.getExpression();
      const exprText = expr.getText();

      if (exprText === 'useState') {
        const parent = descendant.getParent();
        if (Node.isVariableDeclaration(parent)) {
          const destructure = parent.getNameNode();
          if (Node.isArrayBindingPattern(destructure)) {
            const elements = destructure.getElements();
            if (elements.length >= 2) {
              const stateVar = elements[0].getText();
              const setter = elements[1].getText();
              const args = descendant.getArguments();
              const initialValue = args[0]?.getText();

              stateVars.push({
                name: stateVar,
                setter,
                initialValue,
                hook: 'useState',
              });
            }
          }
        }
      } else if (exprText === 'useReducer') {
        // Similar analysis for useReducer
        const parent = descendant.getParent();
        if (Node.isVariableDeclaration(parent)) {
          const destructure = parent.getNameNode();
          if (Node.isArrayBindingPattern(destructure)) {
            const elements = destructure.getElements();
            if (elements.length >= 2) {
              const stateVar = elements[0].getText();
              const dispatch = elements[1].getText();

              stateVars.push({
                name: stateVar,
                setter: dispatch,
                hook: 'useReducer',
              });
            }
          }
        }
      }
    });

    return stateVars;
  }

  /**
   * Analyze all hooks usage
   */
  private analyzeHooks(node: any): HookUsage[] {
    const hooks: HookUsage[] = [];

    node.forEachDescendant((descendant: any) => {
      if (!Node.isCallExpression(descendant)) return;

      const expr = descendant.getExpression();
      const hookName = expr.getText();

      // Check if it's a hook (starts with 'use')
      if (/^use[A-Z]/.test(hookName)) {
        const args = descendant.getArguments().map((arg: any) => arg.getText());
        const line = descendant.getStartLineNumber();

        hooks.push({
          hookName,
          isBuiltIn: this.isBuiltInHook(hookName),
          isCustom: !this.isBuiltInHook(hookName),
          arguments: args,
          line,
        });
      }
    });

    return hooks;
  }

  /**
   * Check if hook is built-in
   */
  private isBuiltInHook(name: string): boolean {
    const builtInHooks = [
      'useState', 'useEffect', 'useContext', 'useReducer', 'useCallback',
      'useMemo', 'useRef', 'useImperativeHandle', 'useLayoutEffect',
      'useDebugValue', 'useDeferredValue', 'useTransition', 'useId',
    ];
    return builtInHooks.includes(name);
  }

  /**
   * Analyze effects (useEffect, useLayoutEffect)
   */
  private analyzeEffects(node: any): EffectInfo[] {
    const effects: EffectInfo[] = [];

    node.forEachDescendant((descendant: any) => {
      if (!Node.isCallExpression(descendant)) return;

      const expr = descendant.getExpression();
      const hookName = expr.getText();

      if (hookName === 'useEffect' || hookName === 'useLayoutEffect') {
        const args = descendant.getArguments();
        const line = descendant.getStartLineNumber();

        let dependencies: string[] = [];
        let runsOnMount = false;
        let runsOnEveryRender = false;
        
        // Check dependency array
        if (args.length > 1) {
          const depsArg = args[1];
          if (Node.isArrayLiteralExpression(depsArg)) {
            const elements = depsArg.getElements();
            dependencies = elements.map(el => el.getText());
            runsOnMount = elements.length === 0;
          }
        } else {
          runsOnEveryRender = true;
        }

        // Check for cleanup function
        const effectFn = args[0];
        let hasCleanup = false;
        if (effectFn && (Node.isArrowFunction(effectFn) || Node.isFunctionExpression(effectFn))) {
          const body = effectFn.getBody();
          if (body) {
            hasCleanup = /return\s+(?:function|\(|\{)/.test(body.getText());
          }
        }

        effects.push({
          type: hookName as any,
          dependencies,
          hasCleanup,
          runsOnMount,
          runsOnEveryRender,
          sideEffects: [], // Would need deeper analysis
          line,
        });
      }
    });

    return effects;
  }

  /**
   * Analyze event handlers
   */
  private analyzeEventHandlers(node: any): EventHandler[] {
    const handlers: EventHandler[] = [];

    node.forEachDescendant((descendant: any) => {
      if (!Node.isJsxAttribute(descendant)) return;

      const attrName = descendant.getName();
      if (/^on[A-Z]/.test(attrName)) {
        const initializer = descendant.getInitializer();
        if (!initializer) return;

        const handlerName = initializer.getText().replace(/[{}]/g, '').trim();
        const line = descendant.getStartLineNumber();

        handlers.push({
          name: attrName,
          type: this.getEventType(attrName),
          parameters: [],
          handlerName,
          line,
        });
      }
    });

    return handlers;
  }

  /**
   * Get event type from attribute name
   */
  private getEventType(attrName: string): EventHandler['type'] {
    const commonEvents: Record<string, EventHandler['type']> = {
      onClick: 'onClick',
      onChange: 'onChange',
      onSubmit: 'onSubmit',
      onBlur: 'onBlur',
      onFocus: 'onFocus',
    };

    return commonEvents[attrName] || 'custom';
  }

  /**
   * Analyze rendering patterns
   */
  private analyzeRenderingPatterns(node: any): {
    conditionalRendering: ConditionalRender[];
    listRendering: ListRender[];
  } {
    const conditionalRendering: ConditionalRender[] = [];
    const listRendering: ListRender[] = [];

    node.forEachDescendant((descendant: any) => {
      // Conditional rendering (ternary, &&)
      if (Node.isConditionalExpression(descendant) || Node.isBinaryExpression(descendant)) {
        const text = descendant.getText();
        if (text.includes('<')) { // Has JSX
          const line = descendant.getStartLineNumber();
          conditionalRendering.push({
            type: Node.isConditionalExpression(descendant) ? 'ternary' : 'logical-and',
            condition: '',
            line,
          });
        }
      }

      // List rendering (.map)
      if (Node.isCallExpression(descendant)) {
        const expr = descendant.getExpression();
        if (Node.isPropertyAccessExpression(expr) && expr.getName() === 'map') {
          const line = descendant.getStartLineNumber();
          listRendering.push({
            arrayName: expr.getExpression().getText(),
            hasKey: false, // Would need deeper analysis
            line,
          });
        }
      }
    });

    return { conditionalRendering, listRendering };
  }

  /**
   * Find child components used in this component
   */
  private findChildComponents(node: any): string[] {
    const children = new Set<string>();

    node.forEachDescendant((descendant: any) => {
      if (Node.isJsxSelfClosingElement(descendant) || Node.isJsxOpeningElement(descendant)) {
        const tagName = descendant.getTagNameNode().getText();
        
        // Only include custom components (PascalCase)
        if (/^[A-Z]/.test(tagName)) {
          children.add(tagName);
        }
      }
    });

    return Array.from(children);
  }

  /**
   * Analyze component hierarchy
   */
  private analyzeComponentHierarchy(components: ReactComponent[]): void {
    // Build parent-child relationships
    for (const component of components) {
      for (const childName of component.childComponents) {
        const child = components.find(c => c.name === childName);
        if (child) {
          child.parentComponent = component.name;
        }
      }
    }
  }

  /**
   * Find custom hooks
   */
  private findCustomHooks(sourceFile: SourceFile): CustomHook[] {
    const hooks: CustomHook[] = [];

    for (const func of sourceFile.getFunctions()) {
      const name = func.getName();
      if (name && /^use[A-Z]/.test(name) && !this.isBuiltInHook(name)) {
        hooks.push({
          name,
          filePath: sourceFile.getFilePath(),
          location: this.getLocation(func, sourceFile),
          parameters: func.getParameters().map(p => p.getName()),
          usedHooks: this.analyzeHooks(func),
        });
      }
    }

    return hooks;
  }

  /**
   * Find React contexts
   */
  private findContexts(sourceFile: SourceFile): ReactContext[] {
    const contexts: ReactContext[] = [];

    // Look for createContext calls
    sourceFile.forEachDescendant(node => {
      if (Node.isCallExpression(node)) {
        const expr = node.getExpression();
        if (expr.getText().includes('createContext')) {
          const parent = node.getParent();
          if (Node.isVariableDeclaration(parent)) {
            contexts.push({
              name: parent.getName(),
              defaultValue: node.getArguments()[0]?.getText(),
              location: this.getLocation(node, sourceFile),
            });
          }
        }
      }
    });

    return contexts;
  }

  /**
   * Generate testing recommendations
   */
  private generateTestingRecommendations(component: ReactComponent): TestingRecommendation[] {
    const recommendations: TestingRecommendation[] = [];

    // Props testing
    if (component.props.length > 0) {
      recommendations.push({
        type: 'props',
        priority: 'high',
        description: `Test component with different prop values (${component.props.map(p => p.name).join(', ')})`,
        example: `render(<${component.name} ${component.props[0].name}="test-value" />)`,
      });
    }

    // State testing
    if (component.state.length > 0) {
      recommendations.push({
        type: 'state',
        priority: 'high',
        description: `Test state changes using userEvent or fireEvent`,
        example: `await userEvent.click(screen.getByRole('button'))`,
      });
    }

    // Event handlers
    if (component.eventHandlers.length > 0) {
      recommendations.push({
        type: 'events',
        priority: 'high',
        description: `Test event handlers (${Array.from(new Set(component.eventHandlers.map(h => h.type))).join(', ')})`,
        example: `await userEvent.click(screen.getByRole('button'))`,
      });
    }

    // Effects
    if (component.effects.length > 0) {
      recommendations.push({
        type: 'hooks',
        priority: 'medium',
        description: `Test side effects and cleanup functions`,
        example: `await waitFor(() => expect(mockFn).toHaveBeenCalled())`,
      });
    }

    return recommendations;
  }

  /**
   * Get code location
   */
  private getLocation(node: any, sourceFile: SourceFile): CodeLocation {
    const line = node.getStartLineNumber();
    const column = node.getStart() - sourceFile.getLineStarts()[line - 1];
    
    return {
      line,
      column,
      filePath: sourceFile.getFilePath(),
    };
  }
}

/**
 * Helper function to analyze React components
 */
export async function analyzeReactComponents(code: string, filePath: string = 'Component.tsx'): Promise<ReactComponentAnalysis> {
  const analyzer = new ReactComponentAnalyzer();
  const sourceFile = analyzer.addSourceFile(filePath, code);
  return analyzer.analyze(sourceFile);
}

