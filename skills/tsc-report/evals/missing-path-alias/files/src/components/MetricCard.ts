import type { Metric } from '@/lib/types';
import { formatDate } from '@/lib/dates';

export function metricCard(metric: Metric): string {
  return `${metric.name}: ${metric.value} (${formatDate(metric.updatedAt)})`;
}
