// Sevboard domain types

// --- Service Health ---

export type ServiceStatus = 'healthy' | 'degraded' | 'down';

export interface Service {
  readonly name: string;
  readonly displayName: string;
  readonly language: string;
  readonly team: string;
  readonly status: ServiceStatus;
  readonly uptime: number; // percentage, 0-100
  readonly errorRate: number; // percentage
  readonly requestRate: number; // req/s
  readonly p99Latency: number; // ms
  readonly lastChecked: string; // ISO 8601
}

// --- Logs ---

export type LogSeverity = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogEntry {
  readonly id: string;
  readonly timestamp: string; // ISO 8601
  readonly service: string;
  readonly severity: LogSeverity;
  readonly message: string;
  readonly traceId: string;
  readonly spanId: string;
  readonly metadata?: Record<string, string>;
}

export interface LogSearchParams {
  query?: string;
  service?: string;
  severity?: LogSeverity;
  timeRange?: TimeRange;
  limit?: number;
}

export interface LogSearchResult {
  readonly totalMatches: number;
  readonly returned: number;
  readonly entries: readonly LogEntry[];
}

// --- Metrics ---

export type MetricName = 'cpu' | 'memory' | 'request_rate' | 'error_rate' | 'p99_latency';

export interface MetricDataPoint {
  readonly timestamp: string;
  readonly value: number;
}

export interface MetricSeries {
  readonly service: string;
  readonly metric: MetricName;
  readonly unit: string;
  readonly dataPoints: readonly MetricDataPoint[];
}

export interface MetricComparison {
  readonly service: string;
  readonly metric: MetricName;
  readonly currentAvg: number;
  readonly baselineAvg: number;
  readonly changePercent: number;
  readonly isAnomaly: boolean;
  readonly standardDeviations: number;
}

// --- Deployments ---

export type DeploymentStatus = 'success' | 'failed' | 'rolled-back' | 'in-progress';

export interface Deployment {
  readonly id: string;
  readonly service: string;
  readonly version: string;
  readonly previousVersion: string;
  readonly deployer: string;
  readonly timestamp: string;
  readonly status: DeploymentStatus;
  readonly commitHash: string;
  readonly changelog: string;
  readonly filesChanged: number;
  readonly linesAdded: number;
  readonly linesRemoved: number;
}

// --- Incidents ---

export type IncidentSeverity = 'P1-Critical' | 'P2-High' | 'P3-Medium' | 'P4-Low';
export type IncidentStatus = 'investigating' | 'identified' | 'monitoring' | 'resolved';

export interface IncidentNote {
  readonly timestamp: string;
  readonly author: string;
  readonly content: string;
}

export interface Incident {
  readonly id: string;
  readonly title: string;
  readonly severity: IncidentSeverity;
  readonly status: IncidentStatus;
  readonly affectedServices: readonly string[];
  readonly description: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly resolvedAt?: string;
  readonly timeline: readonly IncidentNote[];
}

// --- Runbooks ---

export type RunbookStepStatus = 'pending' | 'running' | 'completed' | 'skipped' | 'failed';

export interface RunbookStep {
  readonly description: string;
  readonly action: string;
  readonly target: string;
  readonly status: RunbookStepStatus;
  readonly result?: string;
}

export interface Runbook {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly forService: string;
  readonly steps: RunbookStep[];
}

// --- Shared ---

export interface TimeRange {
  readonly start: string; // ISO 8601
  readonly end: string;   // ISO 8601
}

// --- WebMCP ---

export interface ToolResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

// --- App Stores ---

export interface AppStores {
  readonly services: ServiceStore;
  readonly logs: LogStore;
  readonly metrics: MetricStore;
  readonly deployments: DeploymentStore;
  readonly incidents: IncidentStore;
  readonly runbooks: RunbookStore;
}

// Store interfaces (implemented by Zustand stores)
export interface ServiceStore {
  getAll(): Service[];
  getByName(name: string): Service | undefined;
  getServiceNames(): string[];
}

export interface LogStore {
  search(params: LogSearchParams): LogSearchResult;
  analyzeErrors(service?: string, topN?: number): ErrorPattern[];
}

export interface ErrorPattern {
  readonly pattern: string;
  readonly count: number;
  readonly services: readonly string[];
  readonly firstSeen: string;
  readonly lastSeen: string;
  readonly suggestedCause: string;
}

export interface MetricStore {
  getMetrics(service: string, metric: MetricName, timeRange?: TimeRange): MetricSeries;
  compareMetrics(service: string, metric: MetricName, current: TimeRange, baseline: TimeRange): MetricComparison;
}

export interface DeploymentStore {
  getAll(service?: string, status?: DeploymentStatus, limit?: number): Deployment[];
  getById(id: string): Deployment | undefined;
}

export interface IncidentStore {
  getAll(): Incident[];
  getById(id: string): Incident | undefined;
  create(data: Omit<Incident, 'id' | 'createdAt' | 'updatedAt' | 'timeline'>): Incident;
  update(id: string, data: Partial<Pick<Incident, 'status' | 'severity'>> & { note?: string }): Incident | undefined;
}

export interface RunbookStore {
  getAll(): Runbook[];
  getById(id: string): Runbook | undefined;
  getStep(runbookId: string, stepIndex: number): RunbookStep | undefined;
  executeStep(runbookId: string, stepIndex: number): Promise<{ status: string; result: string; nextStep?: number }>;
}
