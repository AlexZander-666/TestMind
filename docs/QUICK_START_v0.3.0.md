# TestMind Quick Start Guide (v0.3.0)

**Get from zero to your first AI-generated test in 2 minutes.**

---

## Prerequisites

- Node.js 20+ installed
- An OpenAI API key (or Gemini/Anthropic/Ollama)
- A TypeScript/JavaScript project

**Don't have an API key?**
- OpenAI: [platform.openai.com/api-keys](https://platform.openai.com/api-keys) (最流行)
- Gemini: 自定义端点配置（见下文）
- Ollama: 本地模型（免费但需本地运行）

---

## Step 1: Install TestMind (30 seconds)

```bash
# Global installation
npm install -g testmind

# Verify installation
testmind --version
# Output: 0.3.0
```

---

## Step 2: Configure API Key (30 seconds)

### Option A: OpenAI (推荐)

```bash
export OPENAI_API_KEY=sk-your-openai-api-key-here
export OPENAI_MODEL=gpt-4-turbo-preview
```

### Option B: Gemini (经济实惠)

```bash
export OPENAI_API_BASE_URL=https://metahk.zenymes.com/v1
export OPENAI_API_KEY=sk-your-gemini-api-key-here
export OPENAI_MODEL=gemini-2.5-pro
```

### Option C: Anthropic Claude

```bash
export ANTHROPIC_API_KEY=sk-ant-your-key-here
export ANTHROPIC_MODEL=claude-3-sonnet-20240229
```

### Option D: Ollama (Local, Free)

```bash
# First install Ollama: https://ollama.ai
ollama pull codellama

export OLLAMA_API_BASE_URL=http://localhost:11434
export OLLAMA_MODEL=codellama
```

**Tip:** Add to `.bashrc` or `.zshrc` for persistence

---

## Step 3: Initialize Project (20 seconds)

Navigate to your project:

```bash
cd /path/to/your/project
testmind init
```

**What this does:**
- Creates `.testmind/` directory
- Generates `testmind.config.json`
- Detects your test framework (Jest/Vitest)
- Indexes your project files

**Output:**
```
🧠 Initializing TestMind...

✅ Detected test framework: vitest
✅ Found 27 source files
✅ Indexed 144 functions
✅ Configuration saved to testmind.config.json

Ready to generate tests! 🎉
```

---

## Step 4: Generate Your First Test (30 seconds)

### Option A: Generate test for a specific function

```bash
testmind generate src/utils/math.ts --function add
```

### Option B: Generate tests for entire file

```bash
testmind generate src/utils/math.ts
```

### Option C: Interactive mode

```bash
testmind interactive
> generate test for src/auth.ts::login function
```

**What happens:**
1. TestMind analyzes your function
2. AI generates comprehensive test cases
3. Shows you a diff to review
4. You accept, reject, or edit

**Example interaction:**
```
🔍 Analyzing function: add(a: number, b: number)

📝 Generating test...

+++ src/utils/math.test.ts
@@ -0,0 +1,15 @@
+import { describe, it, expect } from 'vitest';
+import { add } from './math';
+
+describe('add', () => {
+  it('should add two positive numbers', () => {
+    expect(add(2, 3)).toBe(5);
+  });
+  
+  it('should handle negative numbers', () => {
+    expect(add(-2, 3)).toBe(1);
+  });
+  
+  it('should handle zero', () => {
+    expect(add(0, 5)).toBe(5);
+  });
+});

[a]ccept  [r]eject  [e]dit
> a

✅ Test accepted!
✅ Created: src/utils/math.test.ts
✅ Committed to branch: add-tests-math

Run tests: npm test src/utils/math.test.ts
```

---

## Step 5: Run Tests (10 seconds)

```bash
# Run all tests
npm test

# Or use TestMind's test runner (coming in v0.5)
testmind run
```

---

## 🎉 Success!

You just:
1. ✅ Installed TestMind
2. ✅ Configured AI provider
3. ✅ Initialized your project
4. ✅ Generated AI-powered tests
5. ✅ Ran your test suite

**Total time: ~2 minutes**

---

## What's Next?

### Explore Features

```bash
# Generate tests for multiple files
testmind generate src/**/*.ts --batch

# Refactor code
testmind refactor src/legacy.ts

# Analyze code quality
testmind analyze src/

# Show help
testmind --help
```

### CI/CD Integration

Add to `.github/workflows/tests.yml`:
```yaml
- uses: testmind/action@v1
  with:
    openai-api-key: ${{ secrets.OPENAI_API_KEY }}
    auto-heal: true
```

[See full CI/CD examples →](../examples/github-actions/)

### Custom Skills

Build your own AI-powered workflows:
```typescript
import { BaseSkill } from '@testmind/core';

export class MySkill extends BaseSkill {
  // Your custom logic
}
```

[Skills Framework Guide →](./guides/skills-framework.md)

---

## Common Issues

### "OPENAI_API_KEY not set"

**Solution:**
```bash
export OPENAI_API_KEY=sk-your-key
```

Add to `.bashrc` or `.zshrc` for persistence.

### "No files found"

**Solution:** Check your include/exclude patterns in `testmind.config.json`:
```json
{
  "includePatterns": ["**/*.ts", "**/*.js"],
  "excludePatterns": ["**/node_modules/**", "**/*.test.ts"]
}
```

### "Generated test failed"

**Solutions:**
- Check that your function is well-typed
- Try a more powerful model: `export OPENAI_MODEL=gpt-4`
- Use interactive mode for manual refinement

### More help

- [Troubleshooting Guide](./TROUBLESHOOTING.md)
- [GitHub Discussions](https://github.com/yourusername/testmind/discussions)
- [Discord Community](https://discord.gg/testmind)

---

## Configuration Reference

### testmind.config.json

```json
{
  "version": "0.3.0",
  "language": "typescript",
  "testFramework": "vitest",
  "testDirectory": "__tests__",
  "includePatterns": ["src/**/*.ts"],
  "excludePatterns": [
    "**/node_modules/**",
    "**/*.test.ts",
    "**/*.spec.ts"
  ],
  "llm": {
    "provider": "openai",
    "model": "gpt-4-turbo-preview",
    "temperature": 0.2,
    "maxTokens": 4000
  },
  "quality": {
    "minCoverage": 80,
    "maxFlakyRate": 5
  }
}
```

### Environment Variables

```bash
# LLM Provider (openai, anthropic, gemini, ollama)
LLM_PROVIDER=openai

# OpenAI Configuration
OPENAI_API_KEY=sk-...
OPENAI_API_BASE_URL=https://api.openai.com/v1  # Optional
OPENAI_MODEL=gpt-4-turbo-preview

# Anthropic Configuration
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-3-sonnet-20240229

# Gemini Configuration (via OpenAI-compatible endpoint)
OPENAI_API_BASE_URL=https://metahk.zenymes.com/v1
OPENAI_API_KEY=sk-your-gemini-key
OPENAI_MODEL=gemini-2.5-pro

# Ollama Configuration
OLLAMA_API_BASE_URL=http://localhost:11434
OLLAMA_MODEL=codellama

# Logging
LOG_LEVEL=info  # error, warn, info, debug

# Observability (optional)
SENTRY_DSN=https://...  # Error tracking
ENABLE_METRICS=true     # Performance metrics
```

---

## CLI Commands Reference

### Core Commands

```bash
# Initialize project
testmind init [--yes]

# Generate tests
testmind generate <file> [--function <name>] [--batch] [--auto-accept]

# Run tests (coming in v0.5)
testmind run [--auto-heal] [--report]

# Interactive REPL
testmind interactive

# Show project stats
testmind stats

# Show configuration
testmind config [--show]
```

### Skills Commands

```bash
# List available skills
testmind skills list

# Execute specific skill
testmind skill execute <skill-name> --target <file>

# Get skill info
testmind skill info <skill-name>
```

### Analysis Commands

```bash
# Analyze code quality
testmind analyze <file>

# Show test coverage
testmind coverage

# Detect flaky tests
testmind analyze --flaky

# Show complexity metrics
testmind analyze --complexity
```

---

## Performance Tips

### Faster Test Generation

```bash
# Use faster model for simpler functions
export OPENAI_MODEL=gpt-3.5-turbo

# Use local model (no API cost)
export OLLAMA_MODEL=codellama
testmind generate src/simple.ts
```

### Cost Optimization

```bash
# Use Gemini (cheaper than OpenAI)
export OPENAI_API_BASE_URL=https://metahk.zenymes.com/v1
export OPENAI_MODEL=gemini-2.5-pro

# Batch processing (reuses context)
testmind generate src/**/*.ts --batch

# Set quality threshold (skip low-quality)
testmind generate src/file.ts --min-quality=85
```

---

## Next Steps

1. **Read the Full Documentation**: [DOCS.md](../DOCS.md)
2. **Join the Community**: [Discord](https://discord.gg/testmind)
3. **Contribute**: [CONTRIBUTING.md](../CONTRIBUTING.md)
4. **Report Issues**: [GitHub Issues](https://github.com/yourusername/testmind/issues)
5. **Star the Repo**: Help us grow! ⭐

---

**Need help?** We're here for you:
- GitHub Discussions for questions
- Discord for real-time chat
- Issues for bugs

**Love TestMind?** Share it with your team! 🚀
















