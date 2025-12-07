import { metrics } from '@testmind/core';

const envValue = process.env.TESTMIND_METRICS_ENABLED?.toLowerCase();
const isCi = process.env.CI === '1' || process.env.CI === 'true';
const isEnabled =
  envValue === 'true' ? true : envValue === 'false' ? false : isCi;

const metricName = (name: string) => `cli.${name}`;

type MetricLabels = Record<string, string | number | boolean>;

export const recordCliEvent = (name: string, labels?: MetricLabels): void => {
  if (!isEnabled) return;
  metrics.incrementCounter(metricName(name), 1, labels);
};

export const recordCliGauge = (name: string, value: number, labels?: MetricLabels): void => {
  if (!isEnabled) return;
  metrics.recordGauge(metricName(name), value, labels);
};
