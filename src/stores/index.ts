// Ackboard Zustand stores

import { create } from 'zustand';
import type {
  Service, LogEntry, LogSearchParams, LogSearchResult,
  Deployment, Incident, Runbook, MetricDataPoint,
  ErrorPattern, MetricComparison, MetricName,
  IncidentSeverity, IncidentStatus,
} from '../types';
import {
  seedAll, generateMetricSeries,
  type SeedData,
} from '../data/seed';

// --- Seed data (generated once) ---

let seedData: SeedData | null = null;

function getSeedData(): SeedData {
  if (!seedData) {
    seedData = seedAll();
  }
  return seedData;
}

// === Service Store ===

interface ServiceStoreState {
  services: Service[];
  init: () => void;
  getAll: () => Service[];
  getByName: (name: string) => Service | undefined;
  getServiceNames: () => string[];
}

export const useServiceStore = create<ServiceStoreState>((set, get) => ({
  services: [],
  init: () => set({ services: getSeedData().services }),
  getAll: () => get().services,
  getByName: (name: string) => get().services.find(s => s.name === name),
  getServiceNames: () => get().services.map(s => s.name),
}));

// === Log Store ===

interface LogStoreState {
  logs: LogEntry[];
  init: () => void;
  search: (params: LogSearchParams) => LogSearchResult;
  analyzeErrors: (service?: string, topN?: number) => ErrorPattern[];
}

export const useLogStore = create<LogStoreState>((set, get) => ({
  logs: [],
  init: () => set({ logs: getSeedData().logs }),

  search: (params: LogSearchParams): LogSearchResult => {
    let entries = [...get().logs];

    // Filter by service
    if (params.service) {
      entries = entries.filter(e => e.service === params.service);
    }

    // Filter by severity (minimum level)
    if (params.severity) {
      const levels = ['debug', 'info', 'warn', 'error', 'fatal'];
      const minIndex = levels.indexOf(params.severity);
      if (minIndex >= 0) {
        entries = entries.filter(e => levels.indexOf(e.severity) >= minIndex);
      }
    }

    // Filter by time range
    if (params.timeRange) {
      const start = new Date(params.timeRange.start).getTime();
      const end = new Date(params.timeRange.end).getTime();
      entries = entries.filter(e => {
        const t = new Date(e.timestamp).getTime();
        return t >= start && t <= end;
      });
    }

    // Free-text search
    if (params.query) {
      const q = params.query.toLowerCase();
      entries = entries.filter(e =>
        e.message.toLowerCase().includes(q) ||
        e.service.toLowerCase().includes(q) ||
        e.traceId.includes(q),
      );
    }

    const total = entries.length;
    const limit = Math.min(params.limit ?? 50, 100);
    entries = entries.slice(0, limit);

    return { totalMatches: total, returned: entries.length, entries };
  },

  analyzeErrors: (service?: string, topN = 5): ErrorPattern[] => {
    let errors = get().logs.filter(e => e.severity === 'error' || e.severity === 'fatal');

    if (service) {
      errors = errors.filter(e => e.service === service);
    }

    // Group by message pattern (first 80 chars as pattern key)
    const patterns = new Map<string, { entries: LogEntry[]; services: Set<string> }>();
    for (const entry of errors) {
      const key = entry.message.slice(0, 80);
      const existing = patterns.get(key);
      if (existing) {
        existing.entries.push(entry);
        existing.services.add(entry.service);
      } else {
        patterns.set(key, { entries: [entry], services: new Set([entry.service]) });
      }
    }

    // Sort by count and take topN
    const sorted = [...patterns.entries()]
      .sort((a, b) => b[1].entries.length - a[1].entries.length)
      .slice(0, topN);

    return sorted.map(([pattern, data]) => {
      const timestamps = data.entries.map(e => new Date(e.timestamp).getTime());
      return {
        pattern,
        count: data.entries.length,
        services: [...data.services],
        firstSeen: new Date(Math.min(...timestamps)).toISOString(),
        lastSeen: new Date(Math.max(...timestamps)).toISOString(),
        suggestedCause: inferCause(pattern),
      };
    });
  },
}));

// Simple cause inference based on keywords
function inferCause(pattern: string): string {
  const p = pattern.toLowerCase();
  if (p.includes('timeout')) return 'Network connectivity or service overload causing request timeouts';
  if (p.includes('clock skew') || p.includes('ntp')) return 'Clock synchronization issue - check NTP configuration on affected hosts';
  if (p.includes('signature') || p.includes('verification')) return 'Webhook/API signature mismatch - likely clock skew or secret rotation issue';
  if (p.includes('rate limit')) return 'Traffic exceeding configured rate limits - consider scaling or adjusting limits';
  if (p.includes('connection pool')) return 'Connection pool exhaustion - increase pool size or investigate connection leaks';
  if (p.includes('oom') || p.includes('memory')) return 'Memory pressure - review memory allocation and potential memory leaks';
  if (p.includes('circuit breaker')) return 'Downstream dependency failure triggering circuit breaker - check dependent service health';
  if (p.includes('dead letter')) return 'Message processing failures accumulating - review DLQ messages for root cause';
  return 'Review recent deployments and configuration changes for potential root cause';
}

// === Metric Store ===

interface MetricStoreState {
  getMetrics: (service: string, metric: string, timeRange?: { start: string; end: string }) => {
    service: string;
    metric: string;
    unit: string;
    dataPoints: MetricDataPoint[];
  };
  compareMetrics: (
    service: string,
    metric: string,
    current: { start: string; end: string },
    baseline: { start: string; end: string },
  ) => MetricComparison;
}

const METRIC_UNITS: Record<string, string> = {
  cpu: '%',
  memory: '%',
  request_rate: 'req/s',
  error_rate: '%',
  p99_latency: 'ms',
};

export const useMetricStore = create<MetricStoreState>(() => ({
  getMetrics: (service, metric, timeRange) => {
    let points = generateMetricSeries(service, metric);

    if (timeRange) {
      const start = new Date(timeRange.start).getTime();
      const end = new Date(timeRange.end).getTime();
      points = points.filter(p => {
        const t = new Date(p.timestamp).getTime();
        return t >= start && t <= end;
      });
    }

    return {
      service,
      metric,
      unit: METRIC_UNITS[metric] ?? '',
      dataPoints: points,
    };
  },

  compareMetrics: (service, metric, current, baseline) => {
    const currentPoints = generateMetricSeries(service, metric);
    const baselinePoints = generateMetricSeries(service, metric, 240); // longer baseline

    const cStart = new Date(current.start).getTime();
    const cEnd = new Date(current.end).getTime();
    const bStart = new Date(baseline.start).getTime();
    const bEnd = new Date(baseline.end).getTime();

    const currentFiltered = currentPoints.filter(p => {
      const t = new Date(p.timestamp).getTime();
      return t >= cStart && t <= cEnd;
    });
    const baselineFiltered = baselinePoints.filter(p => {
      const t = new Date(p.timestamp).getTime();
      return t >= bStart && t <= bEnd;
    });

    const avg = (points: MetricDataPoint[]) =>
      points.length === 0 ? 0 : points.reduce((sum, p) => sum + p.value, 0) / points.length;

    const stdDev = (points: MetricDataPoint[], mean: number) =>
      points.length === 0 ? 0 : Math.sqrt(
        points.reduce((sum, p) => sum + Math.pow(p.value - mean, 2), 0) / points.length,
      );

    const currentAvg = Math.round(avg(currentFiltered) * 100) / 100;
    const baselineAvg = Math.round(avg(baselineFiltered) * 100) / 100;
    const baselineStd = stdDev(baselineFiltered, baselineAvg);
    const changePercent = baselineAvg === 0 ? 0 : Math.round(((currentAvg - baselineAvg) / baselineAvg) * 10000) / 100;
    const standardDeviations = baselineStd === 0 ? 0 : Math.round(Math.abs(currentAvg - baselineAvg) / baselineStd * 100) / 100;

    return {
      service,
      metric: metric as MetricName,
      currentAvg,
      baselineAvg,
      changePercent,
      isAnomaly: standardDeviations > 2,
      standardDeviations,
    };
  },
}));

// === Deployment Store ===

interface DeploymentStoreState {
  deployments: Deployment[];
  init: () => void;
  getAll: (service?: string, status?: string, limit?: number) => Deployment[];
  getById: (id: string) => Deployment | undefined;
}

export const useDeploymentStore = create<DeploymentStoreState>((set, get) => ({
  deployments: [],
  init: () => set({ deployments: getSeedData().deployments }),
  getAll: (service, status, limit = 10) => {
    let deps = [...get().deployments];
    if (service) deps = deps.filter(d => d.service === service);
    if (status) deps = deps.filter(d => d.status === status);
    return deps.slice(0, limit);
  },
  getById: (id) => get().deployments.find(d => d.id === id),
}));

// === Incident Store ===

interface IncidentStoreState {
  incidents: Incident[];
  init: () => void;
  getAll: () => Incident[];
  getById: (id: string) => Incident | undefined;
  create: (data: Record<string, unknown>) => Incident;
  update: (id: string, data: Record<string, unknown>) => Incident | undefined;
}

export const useIncidentStore = create<IncidentStoreState>((set, get) => ({
  incidents: [],
  init: () => set({ incidents: getSeedData().incidents }),
  getAll: () => get().incidents,
  getById: (id) => get().incidents.find(i => i.id === id),

  create: (data) => {
    const now = new Date().toISOString();
    const count = get().incidents.length;
    const incident: Incident = {
      id: `INC-${String(count + 1).padStart(3, '0')}`,
      title: (data['title'] as string) ?? 'Untitled incident',
      severity: (data['severity'] as IncidentSeverity) ?? 'P3-Medium',
      status: 'investigating',
      affectedServices: (data['affectedServices'] as string[]) ?? [],
      description: (data['description'] as string) ?? '',
      createdAt: now,
      updatedAt: now,
      timeline: [{
        timestamp: now,
        author: 'Ackboard Agent',
        content: `Incident created: ${data['title'] as string}`,
      }],
    };
    set(state => ({ incidents: [incident, ...state.incidents] }));
    return incident;
  },

  update: (id, data) => {
    const incidents = get().incidents.map(i => {
      if (i.id !== id) return i;
      const now = new Date().toISOString();
      const newTimeline = [...i.timeline];
      if (data['note']) {
        newTimeline.push({ timestamp: now, author: 'Ackboard Agent', content: data['note'] as string });
      }
      if (data['status']) {
        newTimeline.push({ timestamp: now, author: 'Ackboard Agent', content: `Status changed to ${data['status'] as string}` });
      }
      return {
        ...i,
        status: (data['status'] as IncidentStatus) ?? i.status,
        severity: (data['severity'] as IncidentSeverity) ?? i.severity,
        updatedAt: now,
        resolvedAt: data['status'] === 'resolved' ? now : i.resolvedAt,
        timeline: newTimeline,
      };
    });
    set({ incidents });
    return incidents.find(i => i.id === id);
  },
}));

// === Runbook Store ===

interface RunbookStoreState {
  runbooks: Runbook[];
  init: () => void;
  getAll: () => Runbook[];
  getById: (id: string) => Runbook | undefined;
  getStep: (runbookId: string, stepIndex: number) => { description: string; action: string; target: string } | undefined;
  executeStep: (runbookId: string, stepIndex: number) => Promise<{ status: string; result: string; nextStep?: number }>;
}

export const useRunbookStore = create<RunbookStoreState>((set, get) => ({
  runbooks: [],
  init: () => set({ runbooks: getSeedData().runbooks }),
  getAll: () => get().runbooks,
  getById: (id) => get().runbooks.find(r => r.id === id),
  getStep: (runbookId, stepIndex) => {
    const runbook = get().runbooks.find(r => r.id === runbookId);
    if (!runbook) return undefined;
    const step = runbook.steps[stepIndex];
    if (!step) return undefined;
    return { description: step.description, action: step.action, target: step.target };
  },
  executeStep: async (runbookId, stepIndex) => {
    // Simulate execution delay
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));

    const runbooks = get().runbooks.map(r => {
      if (r.id !== runbookId) return r;
      const newSteps = r.steps.map((s, i) => {
        if (i !== stepIndex) return s;
        return { ...s, status: 'completed' as const, result: `Step completed successfully at ${new Date().toISOString()}` };
      });
      return { ...r, steps: newSteps };
    });
    set({ runbooks });

    const runbook = runbooks.find(r => r.id === runbookId);
    const nextPendingIndex = runbook?.steps.findIndex((s, i) => i > stepIndex && s.status === 'pending');

    return {
      status: 'completed',
      result: `Step ${stepIndex + 1} executed successfully`,
      nextStep: nextPendingIndex !== undefined && nextPendingIndex >= 0 ? nextPendingIndex : undefined,
    };
  },
}));

// === Initialize All Stores ===

export function initializeStores(): void {
  useServiceStore.getState().init();
  useLogStore.getState().init();
  useDeploymentStore.getState().init();
  useIncidentStore.getState().init();
  useRunbookStore.getState().init();
}
