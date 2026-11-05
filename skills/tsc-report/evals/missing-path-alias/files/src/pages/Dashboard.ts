import { getJson } from '@/lib/http';
import type { Metric } from '@/lib/types';
import { metricList } from '@/components/MetricList';
import { formatDate } from '@/lib/dates';

export async function renderDashboard(): Promise<string> {
  const metrics = await getJson<Metric[]>('/api/metrics');
  const count: string = metrics.length;
  return `${formatDate(new Date())} ${count}\n${metricList(metrics)}`;
}
