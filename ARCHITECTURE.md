# TestMind Architecture

This document provides a comprehensive overview of TestMind's architecture, design decisions, and implementation details.

## Table of Contents

1. [System Overview](#system-overview)
2. [Core Principles](#core-principles)
3. [Module Architecture](#module-architecture)
4. [Data Flow](#data-flow)
5. [Key Design Decisions](#key-design-decisions)
6. [Technology Stack](#technology-stack)

## System Overview

TestMind is built as a modular monorepo using TypeScript and Node.js. The system follows a layered architecture with clear separation of concerns:

```
┌─────────────────────────────────────────┐
│         User Interface Layer            │
│    (CLI, VS Code, Web UI, CI/CD)        │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│         Application Layer               │
│  (Command Handlers, API Controllers)    │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│         Domain Layer                    │
│  (Context, Generation, Evaluation)      │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│      Infrastructure Layer               │
│  (LLM, Database, Vector Store)          │
└─────────────────────────────────────────┘
```

## Core Principles

### 1. Separation of Concerns
Each module has a single, well-defined responsibility:
- **Context Engine**: Understand code
- **Test Generator**: Create tests
- **Test Evaluator**: Assess quality

### 2. Dependency Inversion
High-level modules don't depend on low-level details:
- Interfaces define contracts
- Implementations can be swapped
- Easy to test and mock

### 3. Open/Closed Principle
- Core engine is closed for modification
- Skills/plugins extend functionality
- Adapter pattern for frameworks

### 4. Type Safety
- Strict TypeScript throughout
- Zod schemas for runtime validation
- No `any` types in public APIs

## Module Architecture

### packages/shared

**Purpose**: Common types, utilities, and constants

**Key Components**:
- Type definitions for all entities
- Zod schemas for validation
- Utility functions (file handling, formatting)
- Application constants

**Dependencies**: None (foundational package)

### packages/core

**Purpose**: Core business logic and engines

**Structure**:
```
core/
├── context/              # Code understanding
│   ├── ContextEngine.ts       # Main orchestrator
│   ├── StaticAnalyzer.ts      # AST parsing
│   ├── SemanticIndexer.ts     # Vector embeddings
│   └── DependencyGraphBuilder.ts
├── generation/           # Test creation
│   ├── TestGenerator.ts       # Main orchestrator
│   ├── TestStrategyPlanner.ts # Strategy decisions
│   └── PromptBuilder.ts       # LLM prompts
├── evaluation/           # Quality assessment
│   ├── TestEvaluator.ts       # Main orchestrator
│   ├── TestRunner.ts          # Test execution
│   └── QualityAnalyzer.ts     # Quality scoring
├── llm/                  # LLM integration
│   ├── LLMService.ts          # Provider abstraction
│   └── providers/
│       ├── OpenAIProvider.ts
│       ├── AnthropicProvider.ts
│       └── OllamaProvider.ts
└── db/                   # Data persistence
    ├── Database.ts            # SQLite operations
    └── VectorStore.ts         # LanceDB operations
```

**Key Design Patterns**:
- **Strategy Pattern**: Test generation strategies (AAA, table-driven, property-based)
- **Factory Pattern**: LLM provider creation
- **Repository Pattern**: Database access
- **Adapter Pattern**: Test framework integration

### packages/cli

**Purpose**: Command-line interface

**Structure**:
```
cli/
├── commands/            # Command implementations
│   ├── init.ts              # Project initialization
│   ├── generate.ts          # Test generation
│   ├── run.ts               # Test execution
│   ├── analyze.ts           # Quality analysis
│   └── config.ts            # Configuration
└── utils/               # CLI utilities
    ├── config.ts            # Config loading/saving
    └── file.ts              # File operations
```

**User Experience Priorities**:
1. Clear, actionable feedback
2. Progress indicators for long operations
3. Interactive prompts with sensible defaults
4. Colorful, readable output

### packages/vscode

**Purpose**: VS Code extension (future)

**Planned Features**:
- Code lens for test coverage
- Quick actions for test generation
- Inline quality indicators
- Test result display

## Data Flow

### Test Generation Flow

```
1. User Input
   testmind generate src/utils/math.ts --function add
   │
2. Load Configuration
   └─> .testmind/config.json
   │
3. Context Analysis
   ├─> StaticAnalyzer: Parse AST
   ├─> DependencyGraphBuilder: Find dependencies
   └─> SemanticIndexer: Search similar code
   │
4. Strategy Planning
   └─> TestStrategyPlanner: Determine approach
   │
5. Prompt Construction
   └─> PromptBuilder: Build LLM prompt
   │
6. LLM Generation
   └─> LLMService: Call OpenAI/Anthropic/Ollama
   │
7. Validation & Formatting
   ├─> Validate syntax
   ├─> Apply code style
   └─> Generate test file
   │
8. User Review
   └─> Display generated test, prompt to save
```

### Test Evaluation Flow

```
1. User Input
   testmind run <suite-id>
   │
2. Load Test Suite
   └─> Database: Fetch test suite
   │
3. Execute Tests
   ├─> TestRunner: Run in isolated env
   └─> Collect coverage data
   │
4. Analyze Quality
   ├─> QualityAnalyzer: Score dimensions
   └─> Detect anti-patterns
   │
5. Generate Improvements
   └─> ImprovementAdvisor: Create suggestions
   │
6. Display Results
   └─> Show scores, suggestions, next steps
```

## Key Design Decisions

### 1. Why Monorepo?

**Decision**: Use pnpm workspace monorepo

**Rationale**:
- Shared types across packages
- Atomic changes across boundaries
- Easier dependency management
- Better developer experience

**Trade-offs**:
- Larger repo size
- More complex build setup
- Learning curve for contributors

### 2. Why TypeScript over Rust?

**Decision**: TypeScript for MVP, consider Rust for performance-critical parts later

**Rationale**:
- Faster development velocity
- Larger talent pool (target audience: JS/TS devs)
- Rich ecosystem for LLM integration
- Cross-platform without compilation

**Trade-offs**:
- Lower raw performance
- Larger memory footprint
- Runtime errors possible despite types

### 3. Why Tree-sitter?

**Decision**: Use Tree-sitter for code parsing

**Rationale**:
- Multi-language support (50+ languages)
- Incremental parsing for performance
- Error-tolerant (handles incomplete code)
- Battle-tested (used by GitHub, Emacs)

**Alternatives Considered**:
- Babel: JS-only, complex API
- ts-morph: TypeScript-only
- Language-specific parsers: Doesn't scale

### 4. Why LanceDB?

**Decision**: Use LanceDB for vector embeddings

**Rationale**:
- Embedded database (no separate server)
- Rust-based, high performance
- Columnar storage, efficient queries
- Easy deployment

**Alternatives Considered**:
- ChromaDB: Python dependency
- Pinecone/Weaviate: Cloud services, added latency
- PostgreSQL + pgvector: More setup required

### 5. Why LangChain?

**Decision**: Use LangChain.js for LLM orchestration

**Rationale**:
- Mature TypeScript support
- Multi-provider abstraction
- Prompt management utilities
- Active community

**Alternatives Considered**:
- LlamaIndex: Better for RAG, but LangChain more general
- Direct API calls: Reinventing the wheel
- Semantic Kernel: .NET-first

### 6. Test Generation Strategy

**Decision**: Hybrid approach - AI + heuristics

**Rationale**:
- AI alone is unpredictable
- Heuristics alone are limited
- Combination provides best of both

**Implementation**:
1. Heuristic analysis identifies patterns
2. AI generates creative test cases
3. Heuristic validation ensures quality

## Technology Stack

### Core Technologies

| Component | Technology | Version | Purpose |
|-----------|-----------|---------|----------|
| Runtime | Node.js | 20 LTS | JavaScript runtime |
| Language | TypeScript | 5.3+ | Type-safe development |
| Package Manager | pnpm | 8.12+ | Fast, efficient dependencies |
| Build Tool | tsup | 8.0+ | Fast TS bundling |
| Testing | Vitest | 1.0+ | Fast unit testing |

### Key Dependencies

| Package | Purpose | Why Chosen |
|---------|---------|------------|
| tree-sitter | AST parsing | Multi-language, fast, error-tolerant |
| ts-morph | TS analysis | Deep TypeScript understanding |
| langchain | LLM orchestration | Provider abstraction, prompt management |
| lancedb | Vector DB | Embedded, fast, Rust-based |
| better-sqlite3 | SQL DB | Embedded, fast, synchronous API |
| commander | CLI framework | Simple, declarative commands |
| inquirer | Interactive CLI | Rich prompts, great UX |
| chalk | Terminal colors | Beautiful output |
| zod | Schema validation | Type-safe runtime validation |

### Development Tools

| Tool | Purpose |
|------|---------|
| ESLint | Code linting |
| Prettier | Code formatting |
| Vitest | Testing framework |
| TypeDoc | API documentation |
| GitHub Actions | CI/CD |

## Performance Considerations

### 1. Incremental Indexing
- Only reindex changed files
- Use git diff to identify changes
- Cache AST and embeddings

### 2. Lazy Loading
- Load engines only when needed
- Stream LLM responses when possible
- Paginate large result sets

### 3. Caching Strategy
- Cache parsed AST per file hash
- Cache embeddings per code chunk
- Cache LLM responses (with TTL)

### 4. Parallel Processing
- Analyze files in parallel
- Batch embedding generation
- Concurrent test execution

## Security Considerations

### 1. API Key Management
- Never commit API keys
- Use environment variables
- Support .env files
- Validate keys on startup

### 2. Code Execution
- Run tests in isolated processes
- Limit execution time
- Sandbox dangerous operations
- Validate generated code

### 3. Data Privacy
- Don't send sensitive code to cloud LLMs without consent
- Support local models (Ollama)
- Encrypt stored data
- Clear consent for data collection

## Extensibility

### Adding New Languages

1. Install tree-sitter grammar: `pnpm add tree-sitter-<language>`
2. Add language type to `packages/shared/src/types/index.ts`
3. Implement analyzer in `packages/core/src/context/`
4. Add test framework adapter
5. Update prompts for language-specific patterns

### Adding New LLM Providers

1. Implement `LLMProvider` interface
2. Add provider to `packages/core/src/llm/providers/`
3. Register in `LLMService` constructor
4. Add configuration options
5. Update documentation

### Adding New Test Frameworks

1. Create framework adapter implementing common interface
2. Add prompt templates specific to framework
3. Implement code generation patterns
4. Add test execution logic
5. Update CLI options

## Future Architecture Evolution

### Phase 1: Distributed System (Month 12+)
- Separate API server for team features
- Message queue for async processing
- Redis for distributed caching
- Load balancer for scale

### Phase 2: Microservices (Month 18+)
- Context Service
- Generation Service
- Evaluation Service
- API Gateway
- Event bus for communication

### Phase 3: Enterprise Platform (Month 24+)
- Multi-tenancy support
- Advanced analytics
- Custom model training
- White-label solutions

---

For implementation details of specific modules, see the inline documentation in the source code.

For contributing guidelines, see [CONTRIBUTING.md](CONTRIBUTING.md).



























