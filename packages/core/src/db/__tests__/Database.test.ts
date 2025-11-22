/**
 * Database tests
 * Test the implemented database functionality
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs-extra';
import * as path from 'path';
import { DatabaseService } from '../Database';
import { generateUUID } from '@testmind/shared';

describe('DatabaseService', () => {
  let db: DatabaseService;
  const testDbPath = '.testmind/test.db';

  beforeEach(async () => {
    // Clean up test database
    await fs.remove(path.dirname(testDbPath));
    
    // Create new database instance
    db = new DatabaseService(testDbPath);
    await db.initialize();
  });

  afterEach(async () => {
    // Close database connection
    if (db) {
      await db.close();
    }
    
    // Clean up test database
    await fs.remove(path.dirname(testDbPath));
  });

  describe('Projects', () => {
    it('should save and retrieve a project', async () => {
      const project = {
        id: generateUUID(),
        name: 'Test Project',
        repoPath: '/test/repo',
        language: 'typescript',
        testFramework: 'vitest',
        config: {
          includePatterns: ['**/*.ts'],
          excludePatterns: ['node_modules']
        }
      };

      // Save project
      await db.saveProject(project);

      // Retrieve project
      const retrieved = await db.getProject(project.id);
      
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(project.id);
      expect(retrieved?.name).toBe(project.name);
      expect(retrieved?.repoPath).toBe(project.repoPath);
      expect(retrieved?.config).toEqual(project.config);
    });

    it('should update existing project', async () => {
      const project = {
        id: generateUUID(),
        name: 'Original Name',
        repoPath: '/test/repo',
        language: 'typescript',
        testFramework: 'vitest',
        config: {}
      };

      // Save project
      await db.saveProject(project);

      // Update project
      project.name = 'Updated Name';
      await db.saveProject(project);

      // Retrieve and verify
      const retrieved = await db.getProject(project.id);
      expect(retrieved?.name).toBe('Updated Name');
    });

    it('should return null for non-existent project', async () => {
      const result = await db.getProject('non-existent-id');
      expect(result).toBeNull();
    });

    it('should get all projects', async () => {
      const project1 = {
        id: generateUUID(),
        name: 'Project 1',
        repoPath: '/test/repo1',
        language: 'typescript',
        testFramework: 'jest',
        config: {}
      };

      const project2 = {
        id: generateUUID(),
        name: 'Project 2',
        repoPath: '/test/repo2',
        language: 'javascript',
        testFramework: 'vitest',
        config: {}
      };

      await db.saveProject(project1);
      await db.saveProject(project2);

      const projects = await db.getAllProjects();
      expect(projects).toHaveLength(2);
      expect(projects.map(p => p.name)).toContain('Project 1');
      expect(projects.map(p => p.name)).toContain('Project 2');
    });
  });

  describe('Transactions', () => {
    it('should support transactions', async () => {
      const project = {
        id: generateUUID(),
        name: 'Transaction Test',
        repoPath: '/test/repo',
        language: 'typescript',
        testFramework: 'vitest',
        config: {}
      };

      // Begin transaction
      db.beginTransaction();

      try {
        await db.saveProject(project);
        
        // Rollback
        db.rollbackTransaction();
      } catch (error) {
        db.rollbackTransaction();
        throw error;
      }

      // Project should not exist
      const retrieved = await db.getProject(project.id);
      expect(retrieved).toBeNull();
    });

    it('should commit transactions', async () => {
      const project = {
        id: generateUUID(),
        name: 'Commit Test',
        repoPath: '/test/repo',
        language: 'typescript',
        testFramework: 'vitest',
        config: {}
      };

      // Begin transaction
      db.beginTransaction();

      try {
        await db.saveProject(project);
        
        // Commit
        db.commitTransaction();
      } catch (error) {
        db.rollbackTransaction();
        throw error;
      }

      // Project should exist
      const retrieved = await db.getProject(project.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('Commit Test');
    });
  });

  describe('Statistics', () => {
    it('should return database statistics', async () => {
      const project = {
        id: generateUUID(),
        name: 'Stats Test',
        repoPath: '/test/repo',
        language: 'typescript',
        testFramework: 'vitest',
        config: {}
      };

      await db.saveProject(project);

      const stats = await db.getStats();
      
      expect(stats).toBeDefined();
      expect(stats.projects.count).toBe(1);
      expect(stats.codeFiles.count).toBe(0);
      expect(stats.testSuites.count).toBe(0);
    });
  });
});
