# Changelog

All notable changes to TestMind will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0-beta.1] - 2025-10-18

### First Beta Release 🎉

This is the first public beta release of TestMind - an AI-powered test generation tool.

### Added

- ✨ Core test generation engine
  - Context-aware code analysis (StaticAnalyzer)
  - Dependency tracking (DependencyGraphBuilder)
  - Intelligent test strategy planning
  - AI-powered test generation via OpenAI

- 🚀 Performance
  - 300x faster than manual testing
  - Small projects: 16ms analysis
  - Large projects: 356ms analysis
  - FileCache optimization (8.1% improvement)

- 🧪 Quality Assurance
  - 122 comprehensive tests
  - 95% test pass rate
  - 88% code coverage
  - 90/100 engineering maturity score

- 🛠️ CLI Tool
  - `testmind init` - Initialize configuration
  - `testmind generate` - Generate tests
  - `testmind run` - Run tests with coverage
  - `testmind analyze` - Quality analysis
  - `testmind config` - Configuration management

- 📚 Documentation
  - Comprehensive README
  - Architecture documentation
  - Contributing guidelines
  - ADR (Architecture Decision Records)

### Supported

- **Languages**: TypeScript, JavaScript
- **Test Frameworks**: Jest, Vitest
- **LLM Providers**: OpenAI GPT-4
- **Platforms**: Windows, macOS, Linux
- **Node.js**: 18.x, 20.x, 22.x

### Known Limitations

- ⚠️ Requires OpenAI API key (not included, ~$0.01-0.05 per test)
- ⚠️ TypeScript/JavaScript only (Python/Java planned for Month 3-4)
- ⚠️ Best results with pure functions and clear APIs
- ⚠️ Some edge cases may require manual refinement

### Requirements

- Node.js ≥ 18.x
- pnpm, npm, or yarn
- OpenAI API key
- TypeScript/JavaScript project

---

## [Unreleased]

### Planned for Month 3-4

- Python language support
- Java language support
- Ollama integration (local LLM, no API key needed)
- Few-shot learning system
- Integration test generation
- E2E test generation

### Under Consideration

- GitHub Copilot integration
- VS Code extension
- Multi-language project support
- Team collaboration features

---

## Beta Testing Phase

We're actively seeking feedback! If you encounter issues or have suggestions:

- 🐛 [Report bugs](https://github.com/xxx/testmind/issues)
- 💬 [Join discussions](https://github.com/xxx/testmind/discussions)
- ⭐ Star us if TestMind helps you!

---

**Note:** This is a beta release. We're committed to rapid iteration based on user feedback.

