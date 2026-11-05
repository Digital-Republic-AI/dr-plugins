import type { Metric } from '@/lib/types';
import { metricCard } from '@/components/MetricCard';

export function metricList(metrics: Metric[]): string {
  return metrics.map(metricCard).join('\n');
}
