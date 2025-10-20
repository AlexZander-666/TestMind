/**
 * CI/CD Integration Module
 * 
 * Provides deep integration with popular CI/CD platforms:
 * - GitHub Actions
 * - GitLab CI/CD
 * - (Future) Jenkins, CircleCI, Travis CI
 * 
 * Features:
 * - Auto-generate workflow configurations
 * - Test generation in CI
 * - Self-healing in CI
 * - Automatic PR creation
 * - Coverage reporting
 * - PR comments with results
 */

export {
  // GitHub Actions
  GitHubActionsIntegration,
  createGitHubActionsIntegration,
  type GitHubActionsConfig,
  type WorkflowResult
} from './GitHubActionsIntegration';

export {
  // GitLab CI
  GitLabCIIntegration,
  createGitLabCIIntegration,
  type GitLabCIConfig
} from './GitLabCIIntegration';

export {
  // Unified Manager
  CICDManager,
  createCICDManager,
  type CIPlatform,
  type CICDManagerConfig,
  type SetupResult
} from './CICDManager';

