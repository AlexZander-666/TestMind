# TestMind Skills Framework Guide

**Version**: 0.3.0  
**Last Updated**: 2025-10-20  
**Status**: Stable

---

## Table of Contents

1. [Overview](#overview)
2. [Core Concepts](#core-concepts)
3. [Skill Interface](#skill-interface)
4. [Creating Your First Skill](#creating-your-first-skill)
5. [Skill Lifecycle](#skill-lifecycle)
6. [Best Practices](#best-practices)
7. [Official Skills](#official-skills)
8. [Advanced Topics](#advanced-topics)
9. [Troubleshooting](#troubleshooting)

---

## Overview

### What is the Skills Framework?

The TestMind Skills Framework is an **extensible plugin system** that allows developers to:

- **Create custom AI-powered workflows** tailored to their specific needs
- **Share reusable capabilities** with the community
- **Extend TestMind's functionality** without modifying core code
- **Compose complex operations** from simpler skills

### Why Skills?

Traditional AI coding assistants are monolithic "black boxes." TestMind's Skills Framework makes AI capabilities:

- **Modular**: Each skill is self-contained and focused
- **Discoverable**: Skills can be listed, searched, and documented
- **Composable**: Skills can work together or independently
- **Community-driven**: Anyone can create and share skills

### Design Philosophy

From the [1.md strategic framework](../../archive/internal-specs/2.md):

> "The skill framework transforms TestMind from a tool into a platform. Community contributions in the form of skills bring domain-specific knowledge that our core team could never replicate at scale."

---

## Core Concepts

### Skill

A **Skill** is a self-contained module that:

1. Accepts a `SkillContext` (project info, files, user request)
2. Performs an AI-powered operation (analysis, generation, refactoring)
3. Returns a `SkillResult` (status, code changes, metadata)

```typescript
export interface Skill {
  // Metadata
  readonly name: string;
  readonly description: string;
  readonly category: SkillCategory;
  readonly version: string;

  // Core methods
  canHandle(context: SkillContext): boolean | Promise<boolean>;
  execute(context: SkillContext): Promise<SkillResult>;
}
```

### SkillContext

The **input** to a skill execution:

```typescript
interface SkillContext {
  // Project information
  projectPath: string;
  projectConfig: any;

  // Target files/functions
  targetFiles: string[];
  targetFunctions?: Array<{ file: string; name: string }>;

  // User request
  userPrompt: string;
  naturalLanguageRequest?: string;

  // Analysis results (if available)
  analysisResult?: any;
  
  // Hybrid context from ContextManager
  hybridContext?: any;
}
```

### SkillResult

The **output** from a skill execution:

```typescript
interface SkillResult {
  // Execution status
  success: boolean;
  message: string;

  // Code changes (if any)
  changes?: CodeChange[];

  // Analysis data
  analysis?: any;

  // Metadata for logging/debugging
  metadata?: Record<string, any>;

  // Execution time
  duration?: number;
}
```

### CodeChange

A proposed modification to the codebase:

```typescript
interface CodeChange {
  type: 'create' | 'modify' | 'delete';
  path: string;
  content?: string;
  diff?: string;
  description?: string;
}
```

---

## Skill Interface

### Required Properties

Every skill must define:

#### 1. Metadata

```typescript
class MySkill extends BaseSkill {
  readonly name = 'my-skill';
  readonly description = 'A brief description of what this skill does';
  readonly category: SkillCategory = 'testing'; // or 'refactoring', 'analysis', etc.
  readonly version = '1.0.0';
}
```

**Naming conventions:**
- Use kebab-case: `test-generation`, `refactor-code`
- Be descriptive but concise
- Avoid redundant words like "skill"

#### 2. Core Methods

**`canHandle(context: SkillContext): boolean`**

Determines if this skill can handle the given context.

```typescript
canHandle(context: SkillContext): boolean {
  // Example: Only handle TypeScript files
  return context.targetFiles.some(file => file.endsWith('.ts'));
}
```

**`execute(context: SkillContext): Promise<SkillResult>`**

The main logic of the skill.

```typescript
async execute(context: SkillContext): Promise<SkillResult> {
  try {
    // 1. Validate input
    const validation = await this.validate(context);
    if (validation) {
      return this.failure(validation);
    }

    // 2. Perform operation
    const result = await this.performOperation(context);

    // 3. Return result
    return this.success('Operation completed', result.changes, result.metadata);
  } catch (error) {
    return this.failure(`Error: ${error.message}`);
  }
}
```

### Optional Methods

#### `validate(context: SkillContext): Promise<string | null>`

Validate context before execution. Return error message if invalid, `null` if valid.

```typescript
async validate(context: SkillContext): Promise<string | null> {
  if (context.targetFiles.length === 0) {
    return 'No files specified. Please provide at least one file.';
  }
  
  if (!context.userPrompt) {
    return 'No user prompt provided.';
  }
  
  return null; // Valid
}
```

#### `preview(context: SkillContext): Promise<string>`

Generate a preview of what the skill will do.

```typescript
async preview(context: SkillContext): Promise<string> {
  return `This skill will analyze ${context.targetFiles.length} files and generate tests.`;
}
```

#### Lifecycle Hooks

```typescript
// Called once when skill is registered
async onRegister(): Promise<void> {
  console.log(`${this.name} registered`);
}

// Called before each execution
async beforeExecute(context: SkillContext): Promise<void> {
  console.log(`Executing ${this.name}...`);
}

// Called after each execution
async afterExecute(context: SkillContext, result: SkillResult): Promise<void> {
  console.log(`${this.name} completed in ${result.duration}ms`);
}

// Cleanup resources
async dispose(): Promise<void> {
  console.log(`${this.name} disposed`);
}
```

---

## Creating Your First Skill

### Step 1: Extend BaseSkill

Create a new file `packages/core/src/skills/MyCustomSkill.ts`:

```typescript
import { BaseSkill, SkillContext, SkillResult, CodeChange } from './Skill';

export class MyCustomSkill extends BaseSkill {
  readonly name = 'my-custom-skill';
  readonly description = 'Demonstrates how to create a custom skill';
  readonly category = 'analysis';
  readonly version = '1.0.0';

  canHandle(context: SkillContext): boolean {
    // Only handle JavaScript/TypeScript files
    return context.targetFiles.some(file => 
      file.endsWith('.js') || file.endsWith('.ts')
    );
  }

  async execute(context: SkillContext): Promise<SkillResult> {
    const startTime = Date.now();

    try {
      // Your skill logic here
      const result = await this.analyzeFiles(context);

      return this.success(
        `Analyzed ${context.targetFiles.length} files`,
        result.changes,
        {
          filesAnalyzed: context.targetFiles.length,
          duration: Date.now() - startTime,
        }
      );
    } catch (error) {
      return this.failure(`Failed to analyze: ${error.message}`);
    }
  }

  private async analyzeFiles(context: SkillContext) {
    // Implementation...
    return { changes: [] };
  }
}
```

### Step 2: Register the Skill

In your application code:

```typescript
import { globalSkillRegistry } from '@testmind/core';
import { MyCustomSkill } from './skills/MyCustomSkill';

// Register skill
const mySkill = new MyCustomSkill();
await globalSkillRegistry.register(mySkill);

console.log(`Registered: ${mySkill.name}`);
```

### Step 3: Use the Skill

```typescript
import { SkillOrchestrator } from '@testmind/core';

const orchestrator = new SkillOrchestrator(globalSkillRegistry);

const context = {
  projectPath: '/path/to/project',
  targetFiles: ['src/app.ts'],
  userPrompt: 'Analyze this file',
};

const result = await orchestrator.executeSkill('my-custom-skill', context);

if (result.success) {
  console.log('Success:', result.message);
} else {
  console.error('Failed:', result.message);
}
```

---

## Skill Lifecycle

### Registration

```
┌─────────────────────────────────────┐
│  new MySkill()                      │
│  ↓                                  │
│  globalSkillRegistry.register()    │
│  ↓                                  │
│  skill.onRegister() [if defined]   │
│  ↓                                  │
│  Skill ready for use                │
└─────────────────────────────────────┘
```

### Execution

```
┌─────────────────────────────────────┐
│  User request                       │
│  ↓                                  │
│  Orchestrator finds matching skill  │
│  ↓                                  │
│  skill.canHandle(context)           │
│  ↓ (if true)                        │
│  skill.validate(context)            │
│  ↓ (if valid)                       │
│  skill.beforeExecute() [optional]   │
│  ↓                                  │
│  skill.execute(context)             │
│  ↓                                  │
│  skill.afterExecute() [optional]    │
│  ↓                                  │
│  Return SkillResult                 │
└─────────────────────────────────────┘
```

### Disposal

```
┌─────────────────────────────────────┐
│  globalSkillRegistry.unregister()   │
│  ↓                                  │
│  skill.dispose() [if defined]       │
│  ↓                                  │
│  Skill removed                      │
└─────────────────────────────────────┘
```

---

## Best Practices

### 1. Single Responsibility

Each skill should do **one thing well**.

❌ **Bad:** A skill that generates tests, refactors code, AND writes documentation

```typescript
class DoEverythingSkill extends BaseSkill {
  // Too much responsibility!
}
```

✅ **Good:** Separate skills for each concern

```typescript
class TestGenerationSkill extends BaseSkill { /* ... */ }
class RefactorSkill extends BaseSkill { /* ... */ }
class DocumentationSkill extends BaseSkill { /* ... */ }
```

### 2. Clear Naming

Use descriptive names that indicate what the skill does.

❌ **Bad:** `skill1`, `helper`, `util`

✅ **Good:** `test-generation`, `extract-method`, `add-type-annotations`

### 3. Comprehensive Validation

Always validate input before executing.

```typescript
async validate(context: SkillContext): Promise<string | null> {
  // Check required fields
  if (!context.projectPath) {
    return 'Project path is required';
  }

  if (context.targetFiles.length === 0) {
    return 'At least one target file is required';
  }

  // Check file existence
  for (const file of context.targetFiles) {
    if (!fs.existsSync(file)) {
      return `File not found: ${file}`;
    }
  }

  return null; // Valid
}
```

### 4. Detailed Error Messages

Help users understand and fix problems.

❌ **Bad:**
```typescript
return this.failure('Error');
```

✅ **Good:**
```typescript
return this.failure(
  `Failed to parse ${filePath}: Syntax error on line 42. ` +
  `Expected '}' but found 'const'. Check for unclosed braces.`
);
```

### 5. Include Metadata

Provide useful information for debugging and monitoring.

```typescript
return this.success('Tests generated', changes, {
  filesProcessed: context.targetFiles.length,
  testsGenerated: changes.length,
  duration: Date.now() - startTime,
  llmModel: 'gpt-4',
  tokensUsed: 1234,
});
```

### 6. Use Logging Wisely

Log important events, but don't spam the console.

```typescript
this.log('Starting test generation...');
// ... do work ...
this.log(`Generated ${testCount} tests in ${duration}ms`);
```

---

## Official Skills

TestMind provides official skills out of the box:

### 1. TestGenerationSkill

**Purpose:** Generate unit tests for functions

**Category:** `testing`

**Usage:**
```typescript
const context = {
  projectPath: '/path/to/project',
  targetFiles: ['src/math.ts'],
  targetFunctions: [{ file: 'src/math.ts', name: 'add' }],
  userPrompt: 'Generate comprehensive unit tests',
};

const result = await orchestrator.executeSkill('test-generation', context);
```

**What it does:**
1. Analyzes function signature and dependencies
2. Identifies edge cases and boundary conditions
3. Generates test cases with proper framework syntax (Jest/Vitest)
4. Returns test file as CodeChange

### 2. RefactorSkill

**Purpose:** Refactor code to improve quality

**Category:** `refactoring`

**Usage:**
```typescript
const context = {
  projectPath: '/path/to/project',
  targetFiles: ['src/legacy.ts'],
  userPrompt: 'Refactor this code to reduce complexity',
};

const result = await orchestrator.executeSkill('refactor', context);
```

**What it does:**
1. Analyzes code complexity (cyclomatic complexity, nesting depth)
2. Identifies code smells
3. Suggests refactorings (extract method, simplify conditionals)
4. Generates refactored code

---

## Advanced Topics

### Skill Dependencies

Declare dependencies that your skill requires:

```typescript
export class MySkill extends BaseSkill {
  readonly requiredDependencies = [
    'fs-extra',
    'typescript',
  ];

  // ...
}
```

The registry will warn if dependencies are missing.

### Skill Configuration

Allow users to configure your skill:

```typescript
export class MySkill extends BaseSkill {
  configuration = {
    llmModel: 'gpt-4',
    temperature: 0.7,
    maxTokens: 2000,
    customSetting: 'value',
  };

  async execute(context: SkillContext): Promise<SkillResult> {
    const model = this.configuration.llmModel;
    // Use configuration...
  }
}
```

Users can override configuration:

```typescript
const skill = new MySkill();
skill.configuration.llmModel = 'gpt-3.5-turbo';
await globalSkillRegistry.register(skill);
```

### Composing Skills

Skills can call other skills:

```typescript
export class CompositeSkill extends BaseSkill {
  async execute(context: SkillContext): Promise<SkillResult> {
    // Execute first skill
    const result1 = await orchestrator.executeSkill('skill-1', context);
    
    if (!result1.success) {
      return result1;
    }

    // Execute second skill with result from first
    const result2 = await orchestrator.executeSkill('skill-2', {
      ...context,
      analysisResult: result1.analysis,
    });

    return result2;
  }
}
```

### Accessing LLM Services

Skills can use TestMind's LLM infrastructure:

```typescript
import { LLMService } from '../llm/LLMService';

export class MyAISkill extends BaseSkill {
  private llm: LLMService;

  constructor(llm: LLMService) {
    super();
    this.llm = llm;
  }

  async execute(context: SkillContext): Promise<SkillResult> {
    const response = await this.llm.generate({
      provider: 'openai',
      model: 'gpt-4',
      prompt: `Analyze this code: ${context.userPrompt}`,
      temperature: 0.7,
      maxTokens: 1000,
    });

    return this.success('Analysis complete', [], {
      analysis: response.content,
    });
  }
}
```

---

## Troubleshooting

### Skill Not Found

**Problem:** `Error: Skill 'my-skill' not found`

**Solutions:**
1. Check that the skill is registered: `globalSkillRegistry.hasSkill('my-skill')`
2. Verify the skill name matches exactly (case-sensitive)
3. Ensure `onRegister()` didn't throw an error

### canHandle Returns False

**Problem:** Skill never executes

**Solutions:**
1. Add debug logging to `canHandle()`:
   ```typescript
   canHandle(context: SkillContext): boolean {
     const result = /* your logic */;
     console.log(`canHandle result: ${result}`);
     return result;
   }
   ```
2. Check that context matches your expectations
3. Consider making `canHandle()` more permissive

### Validation Errors

**Problem:** Skill fails validation

**Solutions:**
1. Check the validation error message carefully
2. Ensure all required context fields are provided
3. Verify file paths are correct and accessible

### Dependencies Missing

**Problem:** `Warning: Skill has missing dependencies`

**Solutions:**
1. Install missing packages: `pnpm add fs-extra typescript`
2. Update `requiredDependencies` if you changed them
3. Check that packages are in node_modules

---

## Next Steps

- **[Creating Custom Skills](./creating-custom-skills.md)** - Detailed tutorial
- **[Skills API Reference](../api/skills.md)** - Complete API documentation
- **[Contributing Skills](../../CONTRIBUTING.md)** - Share your skills with the community
- **[1.md Strategic Framework](../../archive/internal-specs/2.md)** - Understand the vision

---

## Community & Support

- **GitHub Discussions**: Ask questions and share skills
- **Discord**: Join our community (link coming soon)
- **Examples**: See `packages/core/src/skills/` for official skills

---

**Happy skill building! 🎉**






























