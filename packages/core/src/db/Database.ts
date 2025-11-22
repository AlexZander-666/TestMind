/**
 * Database: SQLite database for project metadata and test history
 * 
 * IMPROVED: Implementing actual database functionality using better-sqlite3
 * This replaces the previous TODO placeholders with working implementations
 */

import Database from 'better-sqlite3';
import * as fs from 'fs-extra';
import * as path from 'path';
import type {
  ProjectConfig,
  CodeFile,
  TestSuite,
  TestRunResult,
  Improvement,
} from '@testmind/shared';
import { createComponentLogger } from '../utils/logger';

const logger = createComponentLogger('Database');

export class DatabaseService {
  private db: Database.Database | null = null;
  private dbPath: string;

  constructor(dbPath = '.testmind/testmind.db') {
    this.dbPath = dbPath;
  }

  /**
   * Initialize database schema
   */
  async initialize(): Promise<void> {
    logger.info('Initializing database schema');
    
    // Ensure directory exists
    await fs.ensureDir(path.dirname(this.dbPath));
    
    // Open database connection
    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    
    // Create tables
    this.createTables();
    
    logger.info('Database initialized successfully');
  }

  /**
   * Create database tables
   */
  private createTables(): void {
    if (!this.db) throw new Error('Database not initialized');

    // Projects table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        repo_path TEXT NOT NULL,
        language TEXT,
        test_framework TEXT,
        config TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `);

    // Code files table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS code_files (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        file_path TEXT NOT NULL,
        language TEXT,
        content TEXT,
        analysis_result TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      )
    `);

    // Test suites table  
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS test_suites (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        target_entity_id TEXT,
        test_type TEXT,
        framework TEXT,
        code TEXT,
        file_path TEXT,
        generated_at INTEGER,
        generated_by TEXT,
        metadata TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      )
    `);

    // Test runs table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS test_runs (
        id TEXT PRIMARY KEY,
        suite_id TEXT NOT NULL,
        status TEXT,
        passed INTEGER,
        failed INTEGER,
        skipped INTEGER,
        duration INTEGER,
        error TEXT,
        coverage TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (suite_id) REFERENCES test_suites(id) ON DELETE CASCADE
      )
    `);

    // Improvements table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS improvements (
        id TEXT PRIMARY KEY,
        suite_id TEXT NOT NULL,
        type TEXT,
        description TEXT,
        impact TEXT,
        suggested_changes TEXT,
        status TEXT DEFAULT 'pending',
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        applied_at INTEGER,
        FOREIGN KEY (suite_id) REFERENCES test_suites(id) ON DELETE CASCADE
      )
    `);

    // Create indexes for performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_code_files_project_id ON code_files(project_id);
      CREATE INDEX IF NOT EXISTS idx_test_suites_project_id ON test_suites(project_id);
      CREATE INDEX IF NOT EXISTS idx_test_runs_suite_id ON test_runs(suite_id);
      CREATE INDEX IF NOT EXISTS idx_improvements_suite_id ON improvements(suite_id);
    `);
  }

  // ============================================================================
  // Project Methods
  // ============================================================================

  async saveProject(project: ProjectConfig): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    logger.info('Saving project', { projectId: project.id });
    
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO projects 
      (id, name, repo_path, language, test_framework, config, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      project.id,
      project.name,
      project.repoPath,
      project.language,
      project.testFramework,
      JSON.stringify(project.config),
      Date.now()
    );
    
    logger.debug('Project saved successfully', { projectId: project.id });
  }

  async getProject(id: string): Promise<ProjectConfig | null> {
    if (!this.db) throw new Error('Database not initialized');
    
    logger.debug('Getting project', { projectId: id });
    
    const stmt = this.db.prepare(`
      SELECT * FROM projects WHERE id = ?
    `);
    
    const row = stmt.get(id) as any;
    
    if (!row) {
      return null;
    }
    
    return {
      id: row.id,
      name: row.name,
      repoPath: row.repo_path,
      language: row.language,
      testFramework: row.test_framework,
      config: JSON.parse(row.config || '{}')
    } as ProjectConfig;
  }

  async getAllProjects(): Promise<ProjectConfig[]> {
    if (!this.db) throw new Error('Database not initialized');
    
    logger.debug('Getting all projects');
    
    const stmt = this.db.prepare(`
      SELECT * FROM projects ORDER BY updated_at DESC
    `);
    
    const rows = stmt.all() as any[];
    
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      repoPath: row.repo_path,
      language: row.language,
      testFramework: row.test_framework,
      config: JSON.parse(row.config || '{}')
    } as ProjectConfig));
  }

  // ============================================================================
  // Code File Methods
  // ============================================================================

  async saveCodeFile(file: CodeFile): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    logger.debug('Saving code file', { filePath: file.filePath });
    
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO code_files
      (id, project_id, file_path, language, content, analysis_result, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      file.id,
      file.projectId,
      file.filePath,
      file.language,
      file.content,
      JSON.stringify(file.analysisResult),
      Date.now()
    );
  }

  async getCodeFile(id: string): Promise<CodeFile | null> {
    if (!this.db) throw new Error('Database not initialized');
    
    const stmt = this.db.prepare(`
      SELECT * FROM code_files WHERE id = ?
    `);
    
    const row = stmt.get(id) as any;
    
    if (!row) return null;
    
    return {
      id: row.id,
      projectId: row.project_id,
      filePath: row.file_path,
      language: row.language,
      content: row.content,
      analysisResult: JSON.parse(row.analysis_result || '{}')
    } as CodeFile;
  }

  async getCodeFilesByProject(projectId: string): Promise<CodeFile[]> {
    if (!this.db) throw new Error('Database not initialized');
    
    const stmt = this.db.prepare(`
      SELECT * FROM code_files WHERE project_id = ? ORDER BY file_path
    `);
    
    const rows = stmt.all(projectId) as any[];
    
    return rows.map(row => ({
      id: row.id,
      projectId: row.project_id,
      filePath: row.file_path,
      language: row.language,
      content: row.content,
      analysisResult: JSON.parse(row.analysis_result || '{}')
    } as CodeFile));
  }

  // ============================================================================
  // Test Suite Methods
  // ============================================================================

  async saveTestSuite(suite: TestSuite): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    logger.info('Saving test suite', { suiteId: suite.id });
    
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO test_suites
      (id, project_id, target_entity_id, test_type, framework, code, file_path, generated_at, generated_by, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      suite.id,
      suite.projectId,
      suite.targetEntityId,
      suite.testType,
      suite.framework,
      suite.code,
      suite.filePath,
      suite.generatedAt?.getTime() || Date.now(),
      suite.generatedBy,
      JSON.stringify(suite.metadata || {})
    );
  }

  async getTestSuite(id: string): Promise<TestSuite | null> {
    if (!this.db) throw new Error('Database not initialized');
    
    const stmt = this.db.prepare(`
      SELECT * FROM test_suites WHERE id = ?
    `);
    
    const row = stmt.get(id) as any;
    
    if (!row) return null;
    
    return {
      id: row.id,
      projectId: row.project_id,
      targetEntityId: row.target_entity_id,
      testType: row.test_type,
      framework: row.framework,
      code: row.code,
      filePath: row.file_path,
      generatedAt: new Date(row.generated_at),
      generatedBy: row.generated_by,
      metadata: JSON.parse(row.metadata || '{}')
    } as TestSuite;
  }

  async getTestSuitesByProject(projectId: string): Promise<TestSuite[]> {
    if (!this.db) throw new Error('Database not initialized');
    
    const stmt = this.db.prepare(`
      SELECT * FROM test_suites WHERE project_id = ? ORDER BY generated_at DESC
    `);
    
    const rows = stmt.all(projectId) as any[];
    
    return rows.map(row => ({
      id: row.id,
      projectId: row.project_id,
      targetEntityId: row.target_entity_id,
      testType: row.test_type,
      framework: row.framework,
      code: row.code,
      filePath: row.file_path,
      generatedAt: new Date(row.generated_at),
      generatedBy: row.generated_by,
      metadata: JSON.parse(row.metadata || '{}')
    } as TestSuite));
  }

  // ============================================================================
  // Test Run Methods
  // ============================================================================

  async saveTestRun(run: TestRunResult): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    logger.info('Saving test run', { runId: run.id });
    
    const stmt = this.db.prepare(`
      INSERT INTO test_runs
      (id, suite_id, status, passed, failed, skipped, duration, error, coverage)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      run.id,
      run.suiteId,
      run.status,
      run.passed,
      run.failed,
      run.skipped,
      run.duration,
      run.error,
      JSON.stringify(run.coverage || null)
    );
  }

  async getTestRunsBySuite(suiteId: string): Promise<TestRunResult[]> {
    if (!this.db) throw new Error('Database not initialized');
    
    const stmt = this.db.prepare(`
      SELECT * FROM test_runs WHERE suite_id = ? ORDER BY created_at DESC
    `);
    
    const rows = stmt.all(suiteId) as any[];
    
    return rows.map(row => ({
      id: row.id,
      suiteId: row.suite_id,
      status: row.status,
      passed: row.passed,
      failed: row.failed,
      skipped: row.skipped,
      duration: row.duration,
      error: row.error,
      coverage: row.coverage ? JSON.parse(row.coverage) : null,
      executedAt: new Date(row.created_at * 1000)
    } as TestRunResult));
  }

  // ============================================================================
  // Improvement Methods
  // ============================================================================

  async saveImprovement(improvement: Improvement): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    logger.info('Saving improvement', { improvementId: improvement.id });
    
    const stmt = this.db.prepare(`
      INSERT INTO improvements
      (id, suite_id, type, description, impact, suggested_changes, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      improvement.id,
      improvement.suiteId,
      improvement.type,
      improvement.description,
      improvement.impact,
      JSON.stringify(improvement.suggestedChanges),
      improvement.status
    );
  }

  async getImprovementsBySuite(suiteId: string): Promise<Improvement[]> {
    if (!this.db) throw new Error('Database not initialized');
    
    const stmt = this.db.prepare(`
      SELECT * FROM improvements WHERE suite_id = ? ORDER BY created_at DESC
    `);
    
    const rows = stmt.all(suiteId) as any[];
    
    return rows.map(row => ({
      id: row.id,
      suiteId: row.suite_id,
      type: row.type,
      description: row.description,
      impact: row.impact,
      suggestedChanges: JSON.parse(row.suggested_changes || '[]'),
      status: row.status,
      appliedAt: row.applied_at ? new Date(row.applied_at * 1000) : null
    } as Improvement));
  }

  async updateImprovementStatus(
    id: string,
    status: Improvement['status']
  ): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    logger.debug('Updating improvement status', { improvementId: id, status });
    
    const stmt = this.db.prepare(`
      UPDATE improvements
      SET status = ?, applied_at = ?
      WHERE id = ?
    `);
    
    stmt.run(
      status,
      status === 'applied' ? Date.now() : null,
      id
    );
  }

  /**
   * Begin a transaction
   */
  beginTransaction(): void {
    if (!this.db) throw new Error('Database not initialized');
    this.db.exec('BEGIN TRANSACTION');
  }

  /**
   * Commit a transaction
   */
  commitTransaction(): void {
    if (!this.db) throw new Error('Database not initialized');
    this.db.exec('COMMIT');
  }

  /**
   * Rollback a transaction
   */
  rollbackTransaction(): void {
    if (!this.db) throw new Error('Database not initialized');
    this.db.exec('ROLLBACK');
  }

  /**
   * Clean up database connection
   */
  async close(): Promise<void> {
    logger.info('Closing database connection');
    
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  /**
   * Get database statistics
   */
  async getStats(): Promise<any> {
    if (!this.db) throw new Error('Database not initialized');
    
    const stats = {
      projects: this.db.prepare('SELECT COUNT(*) as count FROM projects').get(),
      codeFiles: this.db.prepare('SELECT COUNT(*) as count FROM code_files').get(),
      testSuites: this.db.prepare('SELECT COUNT(*) as count FROM test_suites').get(),
      testRuns: this.db.prepare('SELECT COUNT(*) as count FROM test_runs').get(),
      improvements: this.db.prepare('SELECT COUNT(*) as count FROM improvements').get(),
    };
    
    return stats;
  }
}

// Export for backward compatibility
export { DatabaseService as Database };

























