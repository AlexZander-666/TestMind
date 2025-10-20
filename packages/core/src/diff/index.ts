/**
 * Diff-First Workflow Module
 * 
 * Implements the core diff-first interaction model:
 * 1. Generate diffs for all code changes
 * 2. Review diffs interactively or automatically
 * 3. Apply approved diffs safely
 * 4. Integrate with Git for automatic branching and commits
 * 
 * Philosophy:
 * - Transparency: All changes presented as diffs before application
 * - User Control: Developers always have final say
 * - Safety: Backups and rollback support
 * - Automation: AI-powered commit messages and conflict resolution
 */

export {
  // Diff Generator
  DiffGenerator,
  createDiffGenerator,
  type DiffLine,
  type DiffHunk,
  type FileDiff,
  type DiffOptions
} from './DiffGenerator';

export {
  // Diff Applier
  DiffApplier,
  createDiffApplier,
  type ApplyResult,
  type Conflict,
  type ApplyOptions
} from './DiffApplier';

export {
  // Diff Reviewer
  DiffReviewer,
  createDiffReviewer,
  type ReviewDecision,
  type ReviewResult,
  type ReviewOptions
} from './DiffReviewer';

export {
  // Git Integration
  GitIntegration,
  createGitIntegration,
  type GitOperationResult,
  type CommitOptions,
  type BranchOptions
} from './GitIntegration';

