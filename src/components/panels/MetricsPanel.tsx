import { useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { format } from 'date-fns';

import Panel from '@/components/Panel';
import { nativeControlClass } from '@/lib/field';
import { useMetricStore, useServiceStore } from '@/stores';
import type { MetricName } from '@/types';

const METRICS: MetricName[] = ['cpu', 'memory', 'request_rate', 'error_rate', 'p99_latency'];

const METRIC_COLORS: Record<MetricName, string> = {
  error_rate: '#EF4444',
  cpu: '#3B82F6',
  request_rate: '#22C55E',
  p99_latency: '#A855F7',
  memory: '#F59E0B',
};

const METRIC_LABELS: Record<MetricName, string> = {
  cpu: 'CPU usage',
  memory: 'Memory',
  request_rate: 'Request rate',
  error_rate: 'Error rate',
  p99_latency: 'P99 latency',
};

export default function MetricsPanel() {
  const [selectedService, setSelectedService] = useState('payment-gateway');
  const [selectedMetric, setSelectedMetric] = useState<MetricName>('error_rate');

  const getMetrics = useMetricStore((state) => state.getMetrics);
  const services = useServiceStore((state) => state.services);
  const serviceNames = services.map((s) => s.name);
  const metricData = getMetrics(selectedService, selectedMetric);

  return (
    <Panel
      title="Metrics"
      actions={
        <>
          <select
            value={selectedService}
            onChange={(e) => setSelectedService(e.target.value)}
            className={nativeControlClass}
          >
            {serviceNames.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          <select
            value={selectedMetric}
            onChange={(e) => setSelectedMetric(e.target.value as MetricName)}
            className={nativeControlClass}
          >
            {METRICS.map((m) => (
              <option key={m} value={m}>{METRIC_LABELS[m]}</option>
            ))}
          </select>
        </>
      }
      bodyClassName="p-4"
    >
      {metricData.dataPoints.length === 0 ? (
        <div className="flex h-full min-h-[280px] items-center justify-center text-sm text-muted-foreground">
          No metrics data available
        </div>
      ) : (
        <div className="h-full min-h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={metricData.dataPoints} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={METRIC_COLORS[selectedMetric]} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={METRIC_COLORS[selectedMetric]} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="timestamp"
                stroke="var(--muted-foreground)"
                fontSize={12}
                tickFormatter={(val) => format(new Date(val), 'HH:mm')}
                tickMargin={8}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                stroke="var(--muted-foreground)"
                fontSize={12}
                tickFormatter={(val) => `${val}${metricData.unit}`}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="rounded-md border border-border bg-popover px-2.5 py-2">
                        <div className="mb-1 text-xs text-muted-foreground">
                          {label ? format(new Date(label), 'HH:mm:ss') : ''}
                        </div>
                        <div className="text-sm font-medium text-foreground">
                          {payload[0]?.value} {metricData.unit}
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={METRIC_COLORS[selectedMetric]}
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorValue)"
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </Panel>
  );
}
