import type { StoreAccessors } from './register-tools';

export interface CheckRow {
  tool: string;
  expected: string;
  actual: string;
  pass: boolean;
}

function summarize(data: unknown): string {
  try {
    const text = JSON.stringify(data);
    return text.length > 160 ? `${text.slice(0, 160)}...` : text;
  } catch {
    return String(data);
  }
}

export function runSelfCheck(stores: StoreAccessors): CheckRow[] {
  const now = new Date();
  const currentEnd = now.toISOString();
  const currentStart = new Date(now.getTime() - 90 * 60_000).toISOString();
  const baselineEnd = currentStart;
  const baselineStart = new Date(now.getTime() - 180 * 60_000).toISOString();

  const rows: CheckRow[] = [];

  const push = (tool: string, expected: string, data: unknown, ok: (d: unknown) => boolean) => {
    const pass = ok(data);
    const row = { tool, expected, actual: summarize(data), pass };
    rows.push(row);
    const mark = pass ? 'pass' : 'FAIL';
    console.info(`[Ackboard] self-check ${mark} ${tool}`);
  };

  const status = stores.getServiceStatus() as { services?: unknown[] };
  push('get_service_status', '8 services including payment-gateway', status, (d) => {
    const s = d as { services?: Array<{ name: string }> };
    return Array.isArray(s.services) && s.services.length === 8 && s.services.some(x => x.name === 'payment-gateway');
  });

  const logs = stores.searchLogs({ service: 'payment-gateway', query: 'signature', severity: 'error', limit: 20 }) as { entries?: unknown[]; totalMatches?: number };
  push('search_logs', 'error lines for payment-gateway signature failures', logs, (d) => {
    const s = d as { totalMatches?: number; entries?: unknown[] };
    return (s.totalMatches ?? 0) > 0 && Array.isArray(s.entries);
  });

  const patterns = stores.analyzeErrors('payment-gateway', 5) as unknown[];
  push('analyze_error_patterns', 'clustered patterns with a suggested cause', patterns, (d) => Array.isArray(d) && d.length > 0);

  const metrics = stores.getMetrics('payment-gateway', 'error_rate') as { dataPoints?: unknown[] };
  push('get_metrics', 'time series with dataPoints', metrics, (d) => {
    const s = d as { dataPoints?: unknown[] };
    return Array.isArray(s.dataPoints) && s.dataPoints.length > 0;
  });

  const cmp = stores.compareMetrics('payment-gateway', 'error_rate', { start: currentStart, end: currentEnd }, { start: baselineStart, end: baselineEnd }) as { isAnomaly?: boolean };
  push('compare_metrics', 'comparison object with changePercent', cmp, (d) => d !== null && typeof d === 'object' && 'changePercent' in (d as object));

  const deploys = stores.getDeployments('payment-gateway', undefined, 10) as Array<{ id: string; changelog?: string }>;
  push('get_deployments', 'list includes v1.8.3 NTP change', deploys, (d) => Array.isArray(d) && d.some(x => String(x.changelog ?? '').toLowerCase().includes('chrony') || x.id === 'deploy_incident_root'));

  const one = stores.getDeployments(undefined, undefined, undefined, 'deploy_incident_root') as unknown[];
  push('get_deployments(id)', 'single deploy by id', one, (d) => Array.isArray(d) && d.length === 1);

  const missing = stores.generateReport('INC-999');
  push('generate_incident_report missing', 'null for unknown id (tool maps this to an error)', missing, (d) => d === null);

  const report = stores.generateReport('INC-001') as { incident?: { id: string } };
  push('generate_incident_report', 'compiled report for INC-001', report, (d) => {
    const s = d as { incident?: { id: string }; errorCount?: number };
    return s?.incident?.id === 'INC-001';
  });

  const ideas = stores.suggestRemediation('payment-gateway') as { suggestions?: unknown[] };
  push('suggest_remediation', 'ranked suggestions with a runbook id', ideas, (d) => {
    const s = d as { suggestions?: unknown[] };
    return Array.isArray(s.suggestions);
  });

  const failed = rows.filter(r => !r.pass);
  if (failed.length === 0) {
    console.info(`[Ackboard] self-check: ${rows.length} checks passed`);
  } else {
    console.warn(`[Ackboard] self-check: ${failed.length} failed`, failed);
  }
  return rows;
}
