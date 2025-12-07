import type { Labels } from '../utils/metrics';
import { metrics } from '../utils/metrics';

type ExecutionMode = 'direct' | 'auto' | 'sequence';

interface ExecutionStatsKey {
  skill: string;
  mode?: ExecutionMode;
}

interface ExecutionStats {
  success: number;
  total: number;
}

const executionStats = new Map<string, ExecutionStats>();

const METRIC_NAMES = {
  selectionLatency: 'skills.selection_latency_ms',
  executionGauge: 'skills.execution_success_rate',
  executionTotal: 'skills.execution_total',
  executionSuccess: 'skills.execution_success_total',
} as const;

function serializeKey(key: ExecutionStatsKey): string {
  return `${key.skill}:${key.mode ?? 'direct'}`;
}

export function recordSkillSelectionLatency(
  skillName: string,
  duration: number,
  labels: Labels = {},
): void {
  metrics.recordHistogram(METRIC_NAMES.selectionLatency, duration, {
    skill: skillName,
    ...labels,
  });
}

export function recordSkillExecutionOutcome(
  skillName: string,
  success: boolean,
  mode: ExecutionMode,
  labels: Labels = {},
): void {
  const baseLabels = { skill: skillName, mode, ...labels };

  metrics.incrementCounter(METRIC_NAMES.executionTotal, 1, baseLabels);
  if (success) {
    metrics.incrementCounter(METRIC_NAMES.executionSuccess, 1, baseLabels);
  }

  const key = serializeKey({ skill: skillName, mode });
  const stats = executionStats.get(key) ?? { success: 0, total: 0 };
  stats.total += 1;
  stats.success += success ? 1 : 0;
  executionStats.set(key, stats);

  const ratio = stats.success / stats.total;
  metrics.recordGauge(METRIC_NAMES.executionGauge, Number.isFinite(ratio) ? ratio : 0, baseLabels);
}

export function getExecutionStatsSnapshot(): Array<ExecutionStatsKey & ExecutionStats> {
  const snapshot: Array<ExecutionStatsKey & ExecutionStats> = [];

  for (const [key, value] of executionStats.entries()) {
    const [rawSkill, rawMode] = key.split(':');
    const skill = rawSkill || 'unknown';
    const mode: ExecutionMode =
      rawMode === 'auto' || rawMode === 'sequence' || rawMode === 'direct'
        ? (rawMode as ExecutionMode)
        : 'direct';

    snapshot.push({
      skill,
      mode,
      ...value,
    });
  }

  return snapshot;
}

export type { ExecutionMode };
