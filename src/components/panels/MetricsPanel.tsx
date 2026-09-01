import React, { useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { useMetricStore, useServiceStore } from '@/stores';
import type { MetricName } from '@/types';
import { format } from 'date-fns';

const METRICS: MetricName[] = ['cpu', 'memory', 'request_rate', 'error_rate', 'p99_latency'];

const METRIC_COLORS: Record<MetricName, string> = {
  error_rate: '#EF4444', // red
  cpu: '#3B82F6', // blue
  request_rate: '#22C55E', // green
  p99_latency: '#A855F7', // purple
  memory: '#F59E0B', // amber
};

const METRIC_LABELS: Record<MetricName, string> = {
  cpu: 'CPU Usage',
  memory: 'Memory Usage',
  request_rate: 'Request Rate',
  error_rate: 'Error Rate',
  p99_latency: 'P99 Latency',
};

const MetricsPanel: React.FC = () => {
  const [selectedService, setSelectedService] = useState<string>('payment-gateway');
  const [selectedMetric, setSelectedMetric] = useState<MetricName>('error_rate');

  const getMetrics = useMetricStore((state) => state.getMetrics);
  const serviceNames = useServiceStore((state) => state.getServiceNames());

  const metricData = getMetrics(selectedService, selectedMetric);

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200">Metrics</h3>
        <div className="flex gap-3">
          <select
            value={selectedService}
            onChange={(e) => setSelectedService(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-md py-1 px-2 text-sm text-slate-50 focus:outline-none focus:border-blue-500"
          >
            {serviceNames.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          <select
            value={selectedMetric}
            onChange={(e) => setSelectedMetric(e.target.value as MetricName)}
            className="bg-slate-950 border border-slate-800 rounded-md py-1 px-2 text-sm text-slate-50 focus:outline-none focus:border-blue-500"
          >
            {METRICS.map((m) => (
              <option key={m} value={m}>{METRIC_LABELS[m]}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex-1 p-4 min-h-[300px]">
        {metricData.dataPoints.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-500 text-sm">No metrics data available</div>
        ) : (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={metricData.dataPoints} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={METRIC_COLORS[selectedMetric]} stopOpacity={0.3} />
                <stop offset="95%" stopColor={METRIC_COLORS[selectedMetric]} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
            <XAxis
              dataKey="timestamp"
              stroke="#64748B"
              fontSize={10}
              tickFormatter={(val) => format(new Date(val), 'HH:mm')}
              tickMargin={10}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              stroke="#64748B"
              fontSize={10}
              tickFormatter={(val) => `${val}${metricData.unit}`}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-slate-800 border border-slate-700 p-2 rounded shadow-lg">
                      <div className="text-xs text-slate-400 mb-1">{label ? format(new Date(label), 'HH:mm:ss') : ''}</div>
                      <div className="text-sm font-bold text-slate-50">
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
        )}
      </div>
    </div>
  );
};

export default MetricsPanel;
