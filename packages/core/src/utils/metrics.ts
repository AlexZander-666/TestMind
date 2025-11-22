/**
 * Metrics Collection System
 * Collects and aggregates performance and usage metrics
 * 
 * Metric Types:
 * - Counter: Incrementing values (e.g., test count, error count)
 * - Gauge: Point-in-time values (e.g., cache size, memory usage)
 * - Histogram: Distribution of values (e.g., latency, duration)
 */

export interface Labels {
  [key: string]: string | number | boolean;
}

export interface MetricValue {
  type: 'counter' | 'gauge' | 'histogram';
  value: number | number[];
  labels?: Labels;
  timestamp: number;
}

export interface MetricSnapshot {
  name: string;
  type: 'counter' | 'gauge' | 'histogram';
  value: number | number[];
  labels?: Labels;
  timestamp: number;
  // Histogram statistics
  p50?: number;
  p95?: number;
  p99?: number;
  avg?: number;
  min?: number;
  max?: number;
  count?: number;
}

/**
 * Metrics collector
 */
export class Metrics {
  private counters: Map<string, Map<string, number>> = new Map();
  private gauges: Map<string, Map<string, number>> = new Map();
  private histograms: Map<string, Map<string, number[]>> = new Map();
  private enabled: boolean;

  constructor() {
    this.enabled = process.env.ENABLE_METRICS !== 'false';
  }

  /**
   * Record a histogram value (for latencies, durations, etc.)
   */
  recordHistogram(name: string, value: number, labels?: Labels): void {
    if (!this.enabled) return;

    const labelKey = this.serializeLabels(labels);
    
    if (!this.histograms.has(name)) {
      this.histograms.set(name, new Map());
    }
    
    const histogram = this.histograms.get(name)!;
    if (!histogram.has(labelKey)) {
      histogram.set(labelKey, []);
    }
    
    histogram.get(labelKey)!.push(value);
    
    // Keep only last 1000 values to prevent memory leak
    const values = histogram.get(labelKey)!;
    if (values.length > 1000) {
      values.shift();
    }
  }

  /**
   * Record a gauge value (for point-in-time measurements)
   */
  recordGauge(name: string, value: number, labels?: Labels): void {
    if (!this.enabled) return;

    const labelKey = this.serializeLabels(labels);
    
    if (!this.gauges.has(name)) {
      this.gauges.set(name, new Map());
    }
    
    this.gauges.get(name)!.set(labelKey, value);
  }

  /**
   * Increment a counter
   */
  incrementCounter(name: string, delta: number = 1, labels?: Labels): void {
    if (!this.enabled) return;

    const labelKey = this.serializeLabels(labels);
    
    if (!this.counters.has(name)) {
      this.counters.set(name, new Map());
    }
    
    const counter = this.counters.get(name)!;
    const current = counter.get(labelKey) || 0;
    counter.set(labelKey, current + delta);
  }

  /**
   * Get snapshot of all metrics
   */
  getSnapshot(): MetricSnapshot[] {
    const snapshots: MetricSnapshot[] = [];
    const timestamp = Date.now();

    // Counters
    for (const [name, labeledValues] of this.counters.entries()) {
      for (const [labelKey, value] of labeledValues.entries()) {
        snapshots.push({
          name,
          type: 'counter',
          value,
          labels: this.deserializeLabels(labelKey),
          timestamp,
        });
      }
    }

    // Gauges
    for (const [name, labeledValues] of this.gauges.entries()) {
      for (const [labelKey, value] of labeledValues.entries()) {
        snapshots.push({
          name,
          type: 'gauge',
          value,
          labels: this.deserializeLabels(labelKey),
          timestamp,
        });
      }
    }

    // Histograms
    for (const [name, labeledValues] of this.histograms.entries()) {
      for (const [labelKey, values] of labeledValues.entries()) {
        const stats = this.calculateHistogramStats(values);
        snapshots.push({
          name,
          type: 'histogram',
          value: values,
          labels: this.deserializeLabels(labelKey),
          timestamp,
          ...stats,
        });
      }
    }

    return snapshots;
  }

  /**
   * Get metrics for a specific name
   */
  getMetric(name: string): MetricSnapshot[] {
    return this.getSnapshot().filter(m => m.name === name);
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
  }

  /**
   * Get counter value
   */
  getCounter(name: string, labels?: Labels): number {
    const labelKey = this.serializeLabels(labels);
    return this.counters.get(name)?.get(labelKey) || 0;
  }

  /**
   * Get histogram average
   */
  getHistogramAverage(name: string, labels?: Labels): number {
    const labelKey = this.serializeLabels(labels);
    const values = this.histograms.get(name)?.get(labelKey);
    
    if (!values || values.length === 0) return 0;
    
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  /**
   * Export metrics in Prometheus format (for future integration)
   */
  exportPrometheus(): string {
    const lines: string[] = [];
    const snapshot = this.getSnapshot();

    for (const metric of snapshot) {
      const labelsStr = metric.labels
        ? Object.entries(metric.labels)
            .map(([k, v]) => `${k}="${v}"`)
            .join(',')
        : '';

      if (metric.type === 'counter' || metric.type === 'gauge') {
        lines.push(`${metric.name}{${labelsStr}} ${metric.value}`);
      } else if (metric.type === 'histogram') {
        lines.push(`${metric.name}_count{${labelsStr}} ${metric.count || 0}`);
        lines.push(`${metric.name}_sum{${labelsStr}} ${metric.avg ? metric.avg * (metric.count || 0) : 0}`);
        if (metric.p50) lines.push(`${metric.name}_p50{${labelsStr}} ${metric.p50}`);
        if (metric.p95) lines.push(`${metric.name}_p95{${labelsStr}} ${metric.p95}`);
        if (metric.p99) lines.push(`${metric.name}_p99{${labelsStr}} ${metric.p99}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Serialize labels to string key
   */
  private serializeLabels(labels?: Labels): string {
    if (!labels) return '__default__';
    
    return Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}:${v}`)
      .join(',');
  }

  /**
   * Deserialize labels from string key
   */
  private deserializeLabels(key: string): Labels | undefined {
    if (key === '__default__') return undefined;
    
    const labels: Labels = {};
    for (const pair of key.split(',')) {
      const [k, v] = pair.split(':');
      if (k && v !== undefined) {
        labels[k] = v;
      }
    }
    
    return labels;
  }

  /**
   * Calculate histogram statistics
   */
  private calculateHistogramStats(values: number[]): {
    p50: number;
    p95: number;
    p99: number;
    avg: number;
    min: number;
    max: number;
    count: number;
  } {
    if (values.length === 0) {
      return {
        p50: 0,
        p95: 0,
        p99: 0,
        avg: 0,
        min: 0,
        max: 0,
        count: 0,
      };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const count = sorted.length;
    
    return {
      p50: sorted[Math.floor(count * 0.5)] || 0,
      p95: sorted[Math.floor(count * 0.95)] || 0,
      p99: sorted[Math.floor(count * 0.99)] || 0,
      avg: sorted.reduce((a, b) => a + b, 0) / count,
      min: sorted[0] || 0,
      max: sorted[count - 1] || 0,
      count,
    };
  }
}

/**
 * Global metrics instance
 */
export const metrics = new Metrics();

/**
 * Convenience function to time an operation
 */
export async function timeOperation<T>(
  metricName: string,
  fn: () => Promise<T>,
  labels?: Labels
): Promise<T> {
  const start = Date.now();
  
  try {
    const result = await fn();
    const duration = Date.now() - start;
    
    metrics.recordHistogram(metricName, duration, labels);
    
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    
    metrics.recordHistogram(metricName, duration, { 
      ...labels, 
      status: 'error' 
    });
    
    throw error;
  }
}

// Export commonly used metric names as constants
export const MetricNames = {
  // Analysis metrics
  ANALYSIS_DURATION: 'analysis.duration',
  ANALYSIS_FILE_COUNT: 'analysis.file_count',
  ANALYSIS_FUNCTION_COUNT: 'analysis.function_count',
  
  // Cache metrics
  CACHE_HIT_RATE: 'cache.hit_rate',
  CACHE_MEMORY_USAGE: 'cache.memory_usage',
  CACHE_SIZE: 'cache.size',
  
  // LLM metrics
  LLM_CALL_COUNT: 'llm.call_count',
  LLM_DURATION: 'llm.duration',
  LLM_TOKEN_USAGE: 'llm.token_usage',
  LLM_COST: 'llm.cost',
  
  // Test generation metrics
  TEST_GENERATION_COUNT: 'test.generation_count',
  TEST_GENERATION_DURATION: 'test.generation_duration',
  TEST_QUALITY_SCORE: 'test.quality_score',
  
  // Healing metrics (新增)
  HEALING_ATTEMPTS: 'healing.attempts',
  HEALING_SUCCESS: 'healing.success',
  HEALING_FAILURES: 'healing.failures',
  HEALING_DURATION: 'healing.duration',
  
  // Error metrics
  ERROR_COUNT: 'error.count',
  ERROR_RATE: 'error.rate',
} as const;



