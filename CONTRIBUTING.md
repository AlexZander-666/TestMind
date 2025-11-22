# Contributing to TestMind

Thank you for your interest in contributing to TestMind! This document provides guidelines and instructions for contributing.

## 🌟 Ways to Contribute

### 1. Code Contributions
- Implement new features from the roadmap
- Fix bugs and improve performance
- Add support for new languages or test frameworks
- Improve documentation and examples

### 2. Community Contributions
- Create test strategy templates
- Share use cases and success stories
- Help answer questions in Discussions
- Write blog posts or tutorials

### 3. Bug Reports & Feature Requests
- Report bugs with detailed reproduction steps
- Suggest new features with clear use cases
- Provide feedback on existing features

## 🚀 Getting Started

### Prerequisites

- Node.js 20+ and pnpm 8+
- Git
- A code editor (VS Code recommended)

### Development Setup

```bash
# 1. Fork and clone
git clone https://github.com/YOUR_USERNAME/testmind.git
cd testmind

# 2. Install dependencies
pnpm install

# 3. Build packages
pnpm build

# 4. Run tests
pnpm test

# 5. Start development
pnpm dev
```

### Project Structure

```
testmind/
├── packages/
│   ├── shared/    # Shared types and utilities
│   ├── core/      # Core engines
│   ├── cli/       # Command-line interface
│   └── vscode/    # VS Code extension (future)
├── docs/          # Documentation
└── .github/       # CI/CD workflows
```

## 📝 Development Workflow

### 1. Create a Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/bug-description
```

### 2. Make Changes

- Write code following our style guide (ESLint + Prettier)
- Add tests for new functionality
- Update documentation as needed
- Ensure all tests pass: `pnpm test`
- Check types: `pnpm typecheck`
- Lint code: `pnpm lint`

### 3. Commit Changes

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```bash
git commit -m "feat: add Python support to StaticAnalyzer"
git commit -m "fix: resolve memory leak in VectorStore"
git commit -m "docs: update API reference for ContextEngine"
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

### 4. Push and Create PR

```bash
git push origin feature/your-feature-name
```

Then create a Pull Request on GitHub with:
- Clear title and description
- Link to related issues
- Screenshots/demos if applicable
- Checklist of changes

## ✅ Code Quality Standards

### TypeScript

- Use TypeScript strict mode
- Prefer interfaces over types for public APIs
- Export all public APIs explicitly
- Add JSDoc comments for public functions

```typescript
/**
 * Generate unit test for a function
 * @param context - Function context from analysis
 * @param projectId - Project identifier
 * @returns Generated test suite
 */
async generateUnitTest(context: FunctionContext, projectId: string): Promise<TestSuite> {
  // Implementation
}
```

### Testing

- Write tests for all new features
- Aim for >80% coverage
- Use descriptive test names
- Follow AAA pattern (Arrange-Act-Assert)

```typescript
describe('TestGenerator', () => {
  it('should generate unit test with proper assertions', async () => {
    // Arrange
    const context = createMockContext();
    const generator = new TestGenerator(llmService);

    // Act
    const result = await generator.generateUnitTest(context, 'project-id');

    // Assert
    expect(result.code).toContain('describe');
    expect(result.testType).toBe('unit');
  });
});
```

### Error Handling

- Use custom error classes from `@testmind/shared`
- Provide helpful error messages
- Log errors appropriately

```typescript
try {
  await this.analyzeFile(filePath);
} catch (error) {
  throw new AnalysisError(
    `Failed to analyze ${filePath}`,
    { originalError: error }
  );
}
```

## 🏗️ Adding New Features

### Example: Adding a New Language

1. **Update types** in `packages/shared/src/types/index.ts`:
```typescript
export type ProgrammingLanguage = 'typescript' | 'javascript' | 'python' | 'java' | 'rust';
```

2. **Add parser** in `packages/core/src/context/`:
```typescript
// Add tree-sitter-rust dependency
// Implement RustAnalyzer
```

3. **Add tests** in `packages/core/src/**/*.test.ts`:
```typescript
describe('RustAnalyzer', () => {
  it('should parse Rust functions', async () => {
    // Test implementation
  });
});
```

4. **Update documentation** in `README.md` and `docs/`.

5. **Add example** in `examples/rust-project/`.

## 📚 Documentation

- Update README.md for user-facing changes
- Update API.md for API changes
- Add examples for new features
- Keep ARCHITECTURE.md in sync

## 🐛 Bug Reports

When reporting bugs, include:

1. **Description**: Clear summary of the issue
2. **Reproduction**: Step-by-step instructions
3. **Expected**: What should happen
4. **Actual**: What actually happens
5. **Environment**: OS, Node version, TestMind version
6. **Logs**: Relevant error messages or logs

## 🎯 Feature Requests

When suggesting features, include:

1. **Problem**: What problem does this solve?
2. **Solution**: Proposed solution
3. **Alternatives**: Other options considered
4. **Use Cases**: Real-world scenarios
5. **Priority**: How important is this?

## 🔍 Code Review Process

All PRs go through:

1. **Automated checks**: CI/CD must pass
2. **Code review**: At least one maintainer approval
3. **Testing**: Manual testing if needed
4. **Documentation**: Docs must be updated

Reviewers will check for:
- Code quality and style
- Test coverage
- Documentation completeness
- Performance implications
- Breaking changes

## 🤝 Community Guidelines

- Be respectful and inclusive
- Assume good intentions
- Provide constructive feedback
- Help others learn and grow
- Follow our [Code of Conduct](CODE_OF_CONDUCT.md)

## 📞 Getting Help

- **Questions**: Use GitHub Discussions
- **Bugs**: Create GitHub Issues
- **Chat**: Join our Discord
- **Security**: Email security@testmind.dev

## 🎉 Recognition

Contributors are recognized:
- In release notes
- In CONTRIBUTORS.md
- On our website
- With special Discord roles

Thank you for contributing to TestMind! 🧠✨



























