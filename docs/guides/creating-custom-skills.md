# Creating Custom Skills Guide

**Version**: 0.3.0  
**Last Updated**: 2025-10-20  
**Difficulty**: Intermediate

Welcome to the TestMind Skills Framework! This guide will help you create your own custom skills to extend TestMind's capabilities.

> 💡 **New to Skills?** Start with the [Skills Framework Guide](./skills-framework.md) first for a comprehensive overview.

## What is a Skill?

A **Skill** is a self-contained module that performs a specific task within TestMind. Skills can:

- Generate tests
- Refactor code
- Analyze complexity
- Optimize performance
- Document code
- And much more!

The Skills Framework is TestMind's core differentiator, enabling the community to extend the platform with specialized capabilities.

## Quick Start

### 1. Create a Skill Class

Every skill extends the `BaseSkill` class and implements the `Skill` interface:

```typescript
import { BaseSkill, SkillContext, SkillResult } from '@testmind/core';

export class MyCustomSkill extends BaseSkill {
  // Metadata
  readonly name = 'my-custom-skill';
  readonly description = 'Does something amazing';
  readonly category = 'analysis';
  readonly version = '1.0.0';
  readonly author = 'Your Name';

  // Check if this skill can handle the request
  canHandle(context: SkillContext): boolean {
    const prompt = context.userPrompt.toLowerCase();
    return prompt.includes('my-keyword');
  }

  // Main execution logic
  async execute(context: SkillContext): Promise<SkillResult> {
    // Your implementation here
    return this.success('Skill executed successfully!');
  }
}
```

### 2. Register the Skill

```typescript
import { globalSkillRegistry } from '@testmind/core';
import { MyCustomSkill } from './MyCustomSkill';

// Register your skill
await globalSkillRegistry.register(new MyCustomSkill());
```

### 3. Use the Skill

Your skill can now be invoked automatically or explicitly:

```bash
# Automatic selection
testmind interactive
> my-keyword in my code

# Explicit invocation
testmind execute my-custom-skill --target src/file.ts
```

## Skill Interface

### Required Properties

- **name**: Unique identifier for your skill
- **description**: Human-readable description
- **category**: One of: 'testing' | 'refactoring' | 'analysis' | 'optimization' | 'documentation'
- **version**: Semantic version (e.g., '1.0.0')

### Core Methods

#### `canHandle(context: SkillContext): boolean`

Determines if your skill can handle the given request.

**Example:**
```typescript
canHandle(context: SkillContext): boolean {
  // Check user prompt
  const prompt = context.userPrompt.toLowerCase();
  const keywords = ['performance', 'optimize', 'speed'];
  
  // Check if keywords match
  return keywords.some(k => prompt.includes(k)) && 
         context.targetFiles.length > 0;
}
```

#### `execute(context: SkillContext): Promise<SkillResult>`

Main execution logic. Returns a result with optional code changes.

**Example:**
```typescript
async execute(context: SkillContext): Promise<SkillResult> {
  try {
    // 1. Analyze
    const analysis = await this.analyzeCode(context);
    
    // 2. Generate changes
    const changes: CodeChange[] = [
      {
        type: 'modify',
        path: 'src/file.ts',
        content: '// optimized code',
        description: 'Optimized performance',
      },
    ];
    
    // 3. Return result
    return this.success('Optimization complete!', changes);
    
  } catch (error: any) {
    return this.failure(`Failed: ${error.message}`);
  }
}
```

### Optional Methods

#### `validate(context: SkillContext): Promise<string | null>`

Validate the context before execution. Return an error message if validation fails.

```typescript
async validate(context: SkillContext): Promise<string | null> {
  if (context.targetFiles.length === 0) {
    return 'No files specified';
  }
  
  if (!this.hasDependency('some-required-package')) {
    return 'Missing required dependency: some-required-package';
  }
  
  return null; // Validation passed
}
```

#### `preview(context: SkillContext): Promise<string>`

Generate a preview of what the skill will do.

```typescript
async preview(context: SkillContext): Promise<string> {
  return `Will optimize ${context.targetFiles.length} file(s) for performance`;
}
```

#### Lifecycle Hooks

- **onRegister()**: Called once when skill is registered
- **beforeExecute()**: Called before each execution
- **afterExecute()**: Called after each execution
- **dispose()**: Cleanup resources

## SkillContext

The `SkillContext` object provides everything your skill needs:

```typescript
interface SkillContext {
  // Project info
  projectPath: string;
  projectConfig: any;
  
  // Target files
  targetFiles: string[];
  targetFunctions?: Array<{ file: string; name: string }>;
  
  // User request
  userPrompt: string;
  naturalLanguageRequest?: string;
  
  // Context from ContextManager
  hybridContext?: any;
}
```

## SkillResult

Return a `SkillResult` from your `execute()` method:

```typescript
interface SkillResult {
  success: boolean;
  message: string;
  changes?: CodeChange[];     // Code changes to apply
  analysis?: any;             // Analysis data
  metadata?: Record<string, any>;
  duration?: number;
}
```

## Code Changes

Propose code changes using the `CodeChange` interface:

```typescript
interface CodeChange {
  type: 'create' | 'modify' | 'delete';
  path: string;
  content?: string;
  diff?: string;
  description?: string;
}
```

**Example:**
```typescript
const changes: CodeChange[] = [
  {
    type: 'create',
    path: 'src/optimized.ts',
    content: 'export function optimized() { ... }',
    description: 'Created optimized version',
  },
  {
    type: 'modify',
    path: 'src/index.ts',
    diff: '- slow()\n+ optimized()',
    description: 'Replaced slow function',
  },
];
```

## Example Skills

### 1. Hello World Skill

The simplest possible skill:

```typescript
import { BaseSkill, SkillContext, SkillResult } from '@testmind/core';

export class HelloWorldSkill extends BaseSkill {
  readonly name = 'hello-world';
  readonly description = 'Says hello!';
  readonly category = 'documentation';
  readonly version = '1.0.0';

  canHandle(context: SkillContext): boolean {
    return context.userPrompt.toLowerCase().includes('hello');
  }

  async execute(context: SkillContext): Promise<SkillResult> {
    return this.success('Hello, World! 👋');
  }
}
```

### 2. Code Complexity Analyzer

Analyzes code complexity without making changes:

```typescript
export class ComplexityAnalyzerSkill extends BaseSkill {
  readonly name = 'complexity-analyzer';
  readonly description = 'Analyze code complexity';
  readonly category = 'analysis';
  readonly version = '1.0.0';

  async execute(context: SkillContext): Promise<SkillResult> {
    const results = [];
    
    for (const file of context.targetFiles) {
      const complexity = await this.analyzeFile(file);
      results.push({ file, complexity });
    }
    
    return this.success(
      `Analyzed ${results.length} files`,
      undefined,
      { results }
    );
  }
  
  private async analyzeFile(filePath: string) {
    // Your analysis logic
    return { cyclomaticComplexity: 5, maintainabilityIndex: 80 };
  }
}
```

### 3. Import Optimizer

Makes code changes:

```typescript
export class ImportOptimizerSkill extends BaseSkill {
  readonly name = 'import-optimizer';
  readonly description = 'Optimize import statements';
  readonly category = 'optimization';
  readonly version = '1.0.0';

  async execute(context: SkillContext): Promise<SkillResult> {
    const changes: CodeChange[] = [];
    
    for (const file of context.targetFiles) {
      const optimized = await this.optimizeImports(file);
      
      changes.push({
        type: 'modify',
        path: file,
        content: optimized,
        description: `Optimized imports in ${file}`,
      });
    }
    
    return this.success(
      `Optimized imports in ${changes.length} files`,
      changes
    );
  }
  
  private async optimizeImports(filePath: string): Promise<string> {
    // Your optimization logic
    return '// optimized imports';
  }
}
```

## Best Practices

### 1. Single Responsibility

Each skill should do one thing well:

❌ **Bad:**
```typescript
// Skill that does too much
class MegaSkill extends BaseSkill {
  async execute(context: SkillContext) {
    await this.generateTests();
    await this.refactorCode();
    await this.analyzePerformance();
    await this.updateDocs();
  }
}
```

✅ **Good:**
```typescript
// Focused skills
class TestGenerationSkill extends BaseSkill { ... }
class RefactorSkill extends BaseSkill { ... }
class PerformanceAnalyzerSkill extends BaseSkill { ... }
class DocumentationSkill extends BaseSkill { ... }
```

### 2. Clear Error Handling

Always handle errors gracefully:

```typescript
async execute(context: SkillContext): Promise<SkillResult> {
  try {
    // Your logic
    return this.success('Done!');
  } catch (error: any) {
    this.log(`Error: ${error.message}`);
    return this.failure(`Failed: ${error.message}`, {
      error: error.message,
      stack: error.stack,
    });
  }
}
```

### 3. Informative Logging

Use the `log()` helper:

```typescript
async execute(context: SkillContext): Promise<SkillResult> {
  this.log('Starting analysis...');
  
  const result = await this.analyze();
  this.log(`Found ${result.issues} issues`);
  
  this.log('Complete!');
  return this.success('Analysis complete');
}
```

### 4. Configuration Support

Make your skill configurable:

```typescript
class MySkill extends BaseSkill {
  configuration = {
    maxComplexity: 10,
    includeComments: true,
    strictMode: false,
  };
  
  async execute(context: SkillContext): Promise<SkillResult> {
    // Use this.configuration.maxComplexity
  }
}
```

### 5. Comprehensive Testing

Write tests for your skill:

```typescript
import { describe, it, expect } from 'vitest';

describe('MyCustomSkill', () => {
  it('should handle valid context', async () => {
    const skill = new MyCustomSkill();
    const context: SkillContext = {
      projectPath: '/test',
      targetFiles: ['test.ts'],
      userPrompt: 'my-keyword',
      // ...
    };
    
    const result = await skill.execute(context);
    expect(result.success).toBe(true);
  });
});
```

## Submission Guidelines

Ready to contribute your skill to TestMind? Follow these steps:

### 1. Prerequisites

- [ ] Skill follows single responsibility principle
- [ ] Comprehensive tests (>80% coverage)
- [ ] Clear documentation with examples
- [ ] Error handling implemented
- [ ] No console.log (use this.log())

### 2. Code Structure

```
packages/core/src/skills/
  ├── MyCustomSkill.ts          # Your skill
  ├── __tests__/
  │   └── MyCustomSkill.test.ts # Tests
  └── index.ts                   # Export
```

### 3. Documentation

Include:
- Description of what the skill does
- When to use it
- Configuration options
- Examples
- Known limitations

### 4. Submit PR

1. Fork the repository
2. Create a branch: `feature/my-custom-skill`
3. Add your skill
4. Run tests: `npm test`
5. Submit PR with description

## Advanced Topics

### Using LLM Services

```typescript
import { LLMService } from '@testmind/core';

class MySkill extends BaseSkill {
  private llm?: LLMService;
  
  async execute(context: SkillContext): Promise<SkillResult> {
    this.llm = new LLMService(context.projectConfig.llm);
    
    const response = await this.llm.chat([
      { role: 'system', content: 'You are a code expert' },
      { role: 'user', content: 'Analyze this code...' },
    ]);
    
    return this.success(response);
  }
}
```

### Using Static Analysis

```typescript
import { StaticAnalyzer } from '@testmind/core';

class MySkill extends BaseSkill {
  async execute(context: SkillContext): Promise<SkillResult> {
    const analyzer = new StaticAnalyzer(context.projectConfig);
    
    const ast = await analyzer.analyzeFile(context.targetFiles[0]);
    const complexity = await analyzer.calculateComplexity(
      context.targetFiles[0],
      'myFunction'
    );
    
    return this.success(`Complexity: ${complexity.cyclomaticComplexity}`);
  }
}
```

### Using Context Engine

```typescript
import { ContextEngine } from '@testmind/core';

class MySkill extends BaseSkill {
  async execute(context: SkillContext): Promise<SkillResult> {
    const engine = new ContextEngine(context.projectConfig);
    
    // Semantic search
    const similar = await engine.semanticSearch('authentication', 5);
    
    // Get function context
    const funcCtx = await engine.getFunctionContext(
      context.targetFiles[0],
      'myFunction'
    );
    
    return this.success('Context retrieved');
  }
}
```

## Community & Support

- **Discord**: Join our community server
- **GitHub Discussions**: Ask questions and share ideas
- **Issues**: Report bugs or request features

## What's Next?

- Explore existing skills in `packages/core/src/skills/`
- Check out skill examples in `examples/skills/`
- Read the [Architecture Guide](../ARCHITECTURE.md)
- Join our [Discord community](https://discord.gg/testmind)

Happy skill building! 🚀



