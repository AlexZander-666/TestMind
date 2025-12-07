import { randomUUID } from 'node:crypto';

import type {
  FixCandidate,
  FilePatch,
  HealingTelemetry,
  RiskLevel,
  SelfHealingAction,
  SelfHealingPlan,
} from '@testmind/shared';

import { FixType, type FixSuggestion } from '../FixSuggester';
import type { TestFailure } from '../FailureClassifier';

export interface AutoFixPlannerOptions {
  minConfidence?: number;
  maxActions?: number;
}

type PlannerInput = {
  failure: TestFailure;
  suggestions: FixSuggestion[];
  telemetry: HealingTelemetry;
};

const FIX_TYPE_TO_ACTION: Record<FixType, SelfHealingAction['type']> = {
  [FixType.UPDATE_SELECTOR]: 'update_selector',
  [FixType.ADD_WAIT]: 'extend_timeout',
  [FixType.FIX_ASSERTION]: 'apply_patch',
  [FixType.ADD_RETRY]: 'retry',
  [FixType.UPDATE_TEST_DATA]: 'apply_patch',
  [FixType.OTHER]: 'manual_review',
};

const ESTIMATED_EFFORT_TO_RISK: Record<FixSuggestion['estimatedEffort'], RiskLevel> = {
  low: 'low',
  medium: 'medium',
  high: 'high',
};

export class AutoFixPlanner {
  private readonly options: Required<AutoFixPlannerOptions>;

  constructor(options: AutoFixPlannerOptions = {}) {
    this.options = {
      minConfidence: options.minConfidence ?? 0.4,
      maxActions: options.maxActions ?? 3,
    };
  }

  createPlan(input: PlannerInput): SelfHealingPlan {
    const candidates = this.buildCandidates(input.failure, input.suggestions);
    const actions = this.buildActions(candidates).slice(0, this.options.maxActions);

    return {
      id: this.generateId('plan'),
      failureId: input.failure.testName,
      createdAt: new Date(),
      updatedAt: new Date(),
      status: actions.length > 0 ? 'draft' : 'failed',
      actions,
      candidates,
      telemetry: input.telemetry,
      notes: actions.length === 0 ? 'No candidates met the confidence threshold.' : undefined,
    };
  }

  private buildCandidates(failure: TestFailure, suggestions: FixSuggestion[]): FixCandidate[] {
    return suggestions
      .filter(suggestion => suggestion.confidence >= this.options.minConfidence)
      .map(suggestion => {
        const patch = this.createFilePatch(failure, suggestion);
        return {
          id: this.generateId('candidate'),
          summary: suggestion.description,
          confidence: suggestion.confidence,
          impact: ESTIMATED_EFFORT_TO_RISK[suggestion.estimatedEffort],
          targetFiles: failure.testFile ? [failure.testFile] : [],
          patches: patch ? [patch] : [],
          reasoning: suggestion.reasoning,
          relatedTests: [failure.testName],
          metadata: {
            fixType: suggestion.type,
            alternatives: suggestion.alternativeApproaches,
          },
        };
      });
  }

  private buildActions(candidates: FixCandidate[]): SelfHealingAction[] {
    return candidates.map(candidate => {
      const sourceType = candidate.metadata?.fixType as FixType | undefined;
      const actionType = sourceType ? FIX_TYPE_TO_ACTION[sourceType] : 'manual_review';

      return {
        id: this.generateId('action'),
        type: actionType,
        summary: candidate.summary,
        confidence: candidate.confidence,
        patch: candidate.patches[0],
        metadata: candidate.metadata,
      };
    });
  }

  private createFilePatch(failure: TestFailure, suggestion: FixSuggestion): FilePatch | undefined {
    if (!suggestion.diff) {
      return undefined;
    }

    return {
      filePath: failure.testFile ?? 'unknown',
      description: suggestion.description,
      hunks: [
        {
          type: 'context',
          header: 'Suggested change',
          content: suggestion.diff,
        },
      ],
    };
  }

  private generateId(prefix: string): string {
    return `${prefix}-${randomUUID()}`;
  }
}
