// Sevboard tool registration
// Chrome imperative API (docs updated 2026-08-20):
//   document.modelContext.registerTool(tool, { signal })
//   execute(input, { signal })
//   unregister by aborting the registration controller
// navigator.modelContext is the pre-Chromium-150 alias, kept for compat

import type {} from '@mcp-b/webmcp-types';
import type { ToolResult } from '../types';

export type ExecuteContext = {
  signal?: AbortSignal;
  requestUserInteraction?: (cb: () => Promise<boolean>) => Promise<boolean>;
};

function getModelContext(): {
  registerTool: (tool: Record<string, unknown>, opts?: { signal?: AbortSignal }) => Promise<unknown> | unknown;
} | null {
  if (typeof document !== 'undefined' && document.modelContext) {
    return document.modelContext as unknown as {
      registerTool: (tool: Record<string, unknown>, opts?: { signal?: AbortSignal }) => Promise<unknown> | unknown;
    };
  }
  const nav = navigator as Navigator & { modelContext?: unknown };
  if (nav.modelContext) {
    return nav.modelContext as unknown as {
      registerTool: (tool: Record<string, unknown>, opts?: { signal?: AbortSignal }) => Promise<unknown> | unknown;
    };
  }
  return null;
}

class ToolRateLimiter {
  private calls = new Map<string, number[]>();
  private readonly maxPerMinute: number;

  constructor(maxPerMinute = 20) {
    this.maxPerMinute = maxPerMinute;
  }

  canCall(toolName: string): boolean {
    const now = Date.now();
    const history = this.calls.get(toolName) ?? [];
    const recent = history.filter(t => now - t < 60_000);
    this.calls.set(toolName, recent);
    return recent.length < this.maxPerMinute;
  }

  record(toolName: string): void {
    const history = this.calls.get(toolName) ?? [];
    history.push(Date.now());
    this.calls.set(toolName, history);
  }
}

function toolError(error: string, suggestion?: string): ToolResult {
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({ error, suggestion: suggestion ?? 'Try adjusting your parameters.' }),
    }],
    isError: true,
  };
}

function toolSuccess(data: unknown): ToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
  };
}

export const SERVICE_NAMES = [
  'api-gateway',
  'auth-service',
  'payment-gateway',
  'order-service',
  'notification-worker',
  'user-service',
  'inventory-service',
  'analytics-service',
] as const;

export type ServiceName = (typeof SERVICE_NAMES)[number];

const SEVERITY_LEVELS = ['debug', 'info', 'warn', 'error', 'fatal'] as const;
const METRIC_NAMES = ['cpu', 'memory', 'request_rate', 'error_rate', 'p99_latency'] as const;

export type WebMCPStatus = 'connected' | 'unavailable' | 'registering';

let webmcpStatus: WebMCPStatus = 'unavailable';
const statusListeners = new Set<(status: WebMCPStatus) => void>();

export function getWebMCPStatus(): WebMCPStatus {
  return webmcpStatus;
}

export function onWebMCPStatusChange(listener: (status: WebMCPStatus) => void): () => void {
  statusListeners.add(listener);
  return () => statusListeners.delete(listener);
}

function setStatus(status: WebMCPStatus): void {
  webmcpStatus = status;
  statusListeners.forEach(l => l(status));
}

export interface ToolActivity {
  toolName: string;
  timestamp: number;
  panel: string;
}

let lastActivity: ToolActivity | null = null;
const activityListeners = new Set<(activity: ToolActivity) => void>();

export function getLastToolActivity(): ToolActivity | null {
  return lastActivity;
}

export function onToolActivity(listener: (activity: ToolActivity) => void): () => void {
  activityListeners.add(listener);
  return () => activityListeners.delete(listener);
}

function recordActivity(toolName: string, panel: string): void {
  lastActivity = { toolName, timestamp: Date.now(), panel };
  activityListeners.forEach(l => l(lastActivity!));
}

const TOOL_PANEL_MAP: Record<string, string> = {
  get_service_status: 'services',
  search_logs: 'logs',
  analyze_error_patterns: 'logs',
  get_metrics: 'metrics',
  compare_metrics: 'metrics',
  get_deployments: 'deployments',
  create_incident: 'incidents',
  update_incident: 'incidents',
  execute_runbook_step: 'runbook',
  generate_incident_report: 'incidents',
  suggest_remediation: 'services',
};

export interface ConfirmRequest {
  title: string;
  message: string;
  details: string;
  variant: 'default' | 'warning' | 'destructive';
}

let confirmHandler: ((req: ConfirmRequest) => Promise<boolean>) | null = null;

export function setConfirmHandler(handler: ((req: ConfirmRequest) => Promise<boolean>) | null): void {
  confirmHandler = handler;
}

async function requestConfirmation(req: ConfirmRequest): Promise<boolean> {
  if (!confirmHandler) {
    console.warn('[Sevboard] No confirmation handler set. Auto-rejecting write operation.');
    return false;
  }
  return confirmHandler(req);
}

// Prefer a browser-native elicitation API if it ever ships (issue #165).
// Today Chrome passes { signal } as the second execute argument, so this
// branch stays inert. See docs/adr/0002-human-in-the-loop.md.
async function gateWrite(req: ConfirmRequest, ctx?: ExecuteContext): Promise<boolean> {
  const showModal = () => requestConfirmation(req);
  if (typeof ctx?.requestUserInteraction === 'function') {
    return ctx.requestUserInteraction(showModal);
  }
  return showModal();
}

export interface StoreAccessors {
  getServiceStatus: (service?: string) => unknown;
  searchLogs: (params: Record<string, unknown>) => unknown;
  analyzeErrors: (service?: string, topN?: number) => unknown;
  getMetrics: (service: string, metric: string, timeRange?: unknown) => unknown;
  compareMetrics: (service: string, metric: string, current: unknown, baseline: unknown) => unknown;
  getDeployments: (service?: string, status?: string, limit?: number, id?: string) => unknown;
  createIncident: (data: Record<string, unknown>) => unknown;
  updateIncident: (id: string, data: Record<string, unknown>) => unknown;
  executeRunbookStep: (runbookId: string, stepIndex: number) => Promise<unknown>;
  generateReport: (incidentId: string) => unknown;
  suggestRemediation: (service?: string) => unknown;
}

function isAborted(signal?: AbortSignal): boolean {
  return Boolean(signal?.aborted);
}

async function runWithBudget<T>(
  work: Promise<T>,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('Tool call was aborted'));
      return;
    }
    const timer = setTimeout(
      () => reject(new Error(`Tool execution timed out after ${timeoutMs} milliseconds`)),
      timeoutMs,
    );
    const onAbort = () => {
      clearTimeout(timer);
      reject(new Error('Tool call was aborted'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    work.then(
      (value) => {
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
        reject(err);
      },
    );
  });
}

export function initializeWebMCP(stores: StoreAccessors): () => void {
  const registration = new AbortController();
  const ctx = getModelContext();

  if (!ctx) {
    console.info(
      '%c[Sevboard] %cWebMCP not detected. Running in standalone mode.',
      'color: #3B82F6; font-weight: bold',
      'color: #94A3B8',
    );
    console.info(
      '%c[Sevboard] %cTo enable: use ChatGPT in-app browser, or Chrome with chrome://flags/#enable-webmcp-testing',
      'color: #3B82F6; font-weight: bold',
      'color: #94A3B8',
    );
    setStatus('unavailable');
    return () => registration.abort();
  }

  setStatus('registering');
  const rateLimiter = new ToolRateLimiter(20);

  function wrapTool(
    name: string,
    fn: (input: Record<string, unknown>, exec: ExecuteContext) => Promise<ToolResult> | ToolResult,
  ) {
    return async (input: Record<string, unknown>, exec: ExecuteContext = {}): Promise<ToolResult> => {
      if (isAborted(exec.signal) || isAborted(registration.signal)) {
        return toolError('Tool call was aborted');
      }
      if (import.meta.env.DEV && input['__forceError'] === true) {
        throw new Error('Forced error for local tool-error test');
      }
      if (!rateLimiter.canCall(name)) {
        return toolError(
          `Rate limit exceeded for ${name}. Maximum 20 calls per minute.`,
          'Wait a moment before trying again.',
        );
      }
      rateLimiter.record(name);
      recordActivity(name, TOOL_PANEL_MAP[name] ?? 'unknown');

      try {
        const result = await runWithBudget(
          Promise.resolve(fn(input, exec)),
          10_000,
          exec.signal,
        );
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return toolError(`Tool "${name}" failed: ${message}`);
      }
    };
  }

  const tools: Array<{ name: string; definition: Record<string, unknown> }> = [
    {
      name: 'get_service_status',
      definition: {
        name: 'get_service_status',
        description: 'Read current health for all services or one named service. Returns name, status (healthy/degraded/down), uptime, error rate, request rate, and p99 latency. Example: call with no args to scan the fleet, then pass service=payment-gateway to zoom in. Use this before digging into logs.',
        inputSchema: {
          type: 'object',
          properties: {
            service: {
              type: 'string',
              description: 'Optional: filter to a specific service',
              enum: [...SERVICE_NAMES],
            },
          },
        },
        annotations: { readOnlyHint: true, untrustedContentHint: false },
        execute: wrapTool('get_service_status', (input) => {
          const data = stores.getServiceStatus(input['service'] as string | undefined);
          return toolSuccess(data);
        }),
      },
    },
    {
      name: 'search_logs',
      definition: {
        name: 'search_logs',
        description: 'Search application logs by service, minimum severity, time range, and free text. Returns up to 50 entries newest-first (max 100) with timestamp, service, severity, message, and traceId. Example: query="signature verification" service=payment-gateway severity=error. Log lines can contain user-originated text.',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Free-text search across log messages' },
            service: { type: 'string', description: 'Filter by service', enum: [...SERVICE_NAMES] },
            severity: { type: 'string', description: 'Minimum severity', enum: [...SEVERITY_LEVELS] },
            timeRange: {
              type: 'object',
              properties: {
                start: { type: 'string', description: 'ISO 8601 start' },
                end: { type: 'string', description: 'ISO 8601 end' },
              },
            },
            limit: { type: 'number', description: 'Max results (default 50, max 100)', minimum: 1, maximum: 100 },
          },
        },
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        execute: wrapTool('search_logs', (input) => {
          const data = stores.searchLogs(input);
          return toolSuccess(data);
        }),
      },
    },
    {
      name: 'analyze_error_patterns',
      definition: {
        name: 'analyze_error_patterns',
        description: 'Cluster recent error logs by message pattern. Returns count, affected services, first/last seen, and a suggested cause. This is not a log dump; it is the grouped view. Example: service=payment-gateway topN=5. Use after search_logs when the question is why, not what.',
        inputSchema: {
          type: 'object',
          properties: {
            service: { type: 'string', description: 'Analyze errors for a specific service', enum: [...SERVICE_NAMES] },
            topN: { type: 'number', description: 'Number of top patterns (default 5)', minimum: 1, maximum: 20 },
          },
        },
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        execute: wrapTool('analyze_error_patterns', (input) => {
          const data = stores.analyzeErrors(
            input['service'] as string | undefined,
            input['topN'] as number | undefined,
          );
          return toolSuccess(data);
        }),
      },
    },
    {
      name: 'get_metrics',
      definition: {
        name: 'get_metrics',
        description: 'Time series for one service and one metric at one-minute resolution. Metrics: cpu (%), memory (%), request_rate (req/s), error_rate (%), p99_latency (ms). Example: service=payment-gateway metric=error_rate. Different shape from logs; do not use search_logs for this.',
        inputSchema: {
          type: 'object',
          properties: {
            service: { type: 'string', description: 'Service name', enum: [...SERVICE_NAMES] },
            metric: { type: 'string', description: 'Metric to retrieve', enum: [...METRIC_NAMES] },
            timeRange: {
              type: 'object',
              properties: {
                start: { type: 'string', description: 'ISO 8601 start' },
                end: { type: 'string', description: 'ISO 8601 end' },
              },
            },
          },
          required: ['service', 'metric'],
        },
        annotations: { readOnlyHint: true, untrustedContentHint: false },
        execute: wrapTool('get_metrics', (input) => {
          const data = stores.getMetrics(
            input['service'] as string,
            input['metric'] as string,
            input['timeRange'],
          );
          return toolSuccess(data);
        }),
      },
    },
    {
      name: 'compare_metrics',
      definition: {
        name: 'compare_metrics',
        description: 'Compare two windows of the same metric. Returns current average, baseline average, percent change, and whether the delta is more than two standard deviations. Example: payment-gateway error_rate, current last 90 minutes vs the 90 minutes before that. This is derived stats, not a raw series.',
        inputSchema: {
          type: 'object',
          properties: {
            service: { type: 'string', enum: [...SERVICE_NAMES] },
            metric: { type: 'string', enum: [...METRIC_NAMES] },
            currentRange: {
              type: 'object',
              properties: { start: { type: 'string' }, end: { type: 'string' } },
              required: ['start', 'end'],
            },
            baselineRange: {
              type: 'object',
              properties: { start: { type: 'string' }, end: { type: 'string' } },
              required: ['start', 'end'],
            },
          },
          required: ['service', 'metric', 'currentRange', 'baselineRange'],
        },
        annotations: { readOnlyHint: true, untrustedContentHint: false },
        execute: wrapTool('compare_metrics', (input) => {
          const data = stores.compareMetrics(
            input['service'] as string,
            input['metric'] as string,
            input['currentRange'],
            input['baselineRange'],
          );
          return toolSuccess(data);
        }),
      },
    },
    {
      name: 'get_deployments',
      definition: {
        name: 'get_deployments',
        description: 'List recent deploys, or fetch one by id. Each row includes version, deployer, timestamp, status, commit, changelog, filesChanged, lines added/removed. Example: service=payment-gateway limit=5, then pass id=deploy_incident_root for the suspect change. One tool covers list and detail so the agent does not need a second round trip for the diff fields.',
        inputSchema: {
          type: 'object',
          properties: {
            service: { type: 'string', description: 'Filter by service', enum: [...SERVICE_NAMES] },
            status: { type: 'string', enum: ['success', 'failed', 'rolled-back', 'in-progress'] },
            limit: { type: 'number', description: 'Max results (default 10)', minimum: 1, maximum: 50 },
            id: { type: 'string', description: 'Optional: return this deployment only' },
          },
        },
        annotations: { readOnlyHint: true, untrustedContentHint: false },
        execute: wrapTool('get_deployments', (input) => {
          const data = stores.getDeployments(
            input['service'] as string | undefined,
            input['status'] as string | undefined,
            input['limit'] as number | undefined,
            input['id'] as string | undefined,
          );
          return toolSuccess(data);
        }),
      },
    },
    {
      name: 'create_incident',
      definition: {
        name: 'create_incident',
        description: 'Open a new incident ticket. Write tool: the page shows a confirmation modal and the call stays pending until the human approves or declines. Example: title="High error rate on payment-gateway", severity=P1-Critical, affectedServices=["payment-gateway"].',
        inputSchema: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Brief title (e.g., "High error rate on payment-gateway")' },
            severity: { type: 'string', enum: ['P1-Critical', 'P2-High', 'P3-Medium', 'P4-Low'] },
            affectedServices: { type: 'array', items: { type: 'string', enum: [...SERVICE_NAMES] } },
            description: { type: 'string', description: 'Detailed description' },
          },
          required: ['title', 'severity', 'affectedServices'],
        },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute: wrapTool('create_incident', async (input, exec) => {
          const confirmed = await gateWrite({
            title: 'Create Incident?',
            message: `${input['severity'] as string}: "${input['title'] as string}"`,
            details: `Affected: ${(input['affectedServices'] as string[]).join(', ')}`,
            variant: 'warning',
          }, exec);
          if (!confirmed) {
            return toolSuccess({ status: 'cancelled', reason: 'User declined to create incident' });
          }
          const incident = stores.createIncident(input);
          return toolSuccess({ status: 'created', incident });
        }),
      },
    },
    {
      name: 'update_incident',
      definition: {
        name: 'update_incident',
        description: 'Change status, severity, or add a timeline note on an existing incident. Write tool, confirmation required. Example: incidentId=INC-001 status=identified note="Clock skew from v1.8.3 NTP change".',
        inputSchema: {
          type: 'object',
          properties: {
            incidentId: { type: 'string', description: 'Incident ID to update' },
            status: { type: 'string', enum: ['investigating', 'identified', 'monitoring', 'resolved'] },
            note: { type: 'string', description: 'Add a timeline note' },
            severity: { type: 'string', enum: ['P1-Critical', 'P2-High', 'P3-Medium', 'P4-Low'] },
          },
          required: ['incidentId'],
        },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute: wrapTool('update_incident', async (input, exec) => {
          const confirmed = await gateWrite({
            title: 'Update Incident?',
            message: `Update ${input['incidentId'] as string}`,
            details: [
              input['status'] ? `Status -> ${input['status'] as string}` : '',
              input['note'] ? `Note: "${(input['note'] as string).slice(0, 100)}"` : '',
              input['severity'] ? `Severity -> ${input['severity'] as string}` : '',
            ].filter(Boolean).join('\n'),
            variant: 'default',
          }, exec);
          if (!confirmed) {
            return toolSuccess({ status: 'cancelled', reason: 'User declined the update' });
          }
          const result = stores.updateIncident(input['incidentId'] as string, input);
          if (!result) return toolError('Incident not found');
          return toolSuccess({ status: 'updated', incident: result });
        }),
      },
    },
    {
      name: 'execute_runbook_step',
      definition: {
        name: 'execute_runbook_step',
        description: 'Run one remediation step from a runbook (restart, rollback). Destructive write: confirmation uses a red modal. Returns the step result and the next index. Example: runbookId=rb-payment-rollback stepIndex=0. Never skip the human on this one.',
        inputSchema: {
          type: 'object',
          properties: {
            runbookId: { type: 'string', description: 'Runbook being followed' },
            stepIndex: { type: 'number', description: 'Step number to execute (0-indexed)' },
          },
          required: ['runbookId', 'stepIndex'],
        },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute: wrapTool('execute_runbook_step', async (input, exec) => {
          const runbookId = input['runbookId'] as string;
          const stepIndex = input['stepIndex'] as number;
          const confirmed = await gateWrite({
            title: `Execute Runbook Step ${stepIndex + 1}?`,
            message: `Runbook: ${runbookId}, Step: ${stepIndex + 1}`,
            details: 'This will execute a remediation action. Review carefully before approving.',
            variant: 'destructive',
          }, exec);
          if (!confirmed) {
            return toolSuccess({ status: 'skipped', reason: 'User chose not to execute this step' });
          }
          const result = await stores.executeRunbookStep(runbookId, stepIndex);
          return toolSuccess(result);
        }),
      },
    },
    {
      name: 'generate_incident_report',
      definition: {
        name: 'generate_incident_report',
        description: 'Compile a stakeholder summary for one incident: timeline, error count, recent error lines, related deploys. One call instead of stitching get_service_status, search_logs, and get_deployments by hand. Example: incidentId=INC-001.',
        inputSchema: {
          type: 'object',
          properties: {
            incidentId: { type: 'string', description: 'Incident to report on' },
          },
          required: ['incidentId'],
        },
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        execute: wrapTool('generate_incident_report', (input) => {
          const data = stores.generateReport(input['incidentId'] as string);
          if (!data) return toolError('Incident not found');
          return toolSuccess(data);
        }),
      },
    },
    {
      name: 'suggest_remediation',
      definition: {
        name: 'suggest_remediation',
        description: 'Join top error patterns with recent deploys and matching runbooks. Returns ranked actions with risk and an available runbook id. Example: service=payment-gateway. Product logic lives here so the agent is not asked to invent a rollback plan from raw rows.',
        inputSchema: {
          type: 'object',
          properties: {
            service: { type: 'string', description: 'Service to analyze', enum: [...SERVICE_NAMES] },
          },
        },
        annotations: { readOnlyHint: true, untrustedContentHint: false },
        execute: wrapTool('suggest_remediation', (input) => {
          const data = stores.suggestRemediation(input['service'] as string | undefined);
          return toolSuccess(data);
        }),
      },
    },
  ];

  void (async () => {
    let toolsRegistered = 0;
    for (const tool of tools) {
      if (registration.signal.aborted) return;
      try {
        await ctx.registerTool(tool.definition, { signal: registration.signal });
        toolsRegistered += 1;
      } catch (err) {
        console.warn(`[Sevboard] Failed to register ${tool.name}`, err);
      }
    }
    if (registration.signal.aborted) return;
    console.info(
      `%c[Sevboard] %cWebMCP connected, ${toolsRegistered} tools registered`,
      'color: #3B82F6; font-weight: bold',
      'color: #22C55E; font-weight: bold',
    );
    setStatus('connected');
  })();

  return () => {
    registration.abort();
    setStatus('unavailable');
  };
}
