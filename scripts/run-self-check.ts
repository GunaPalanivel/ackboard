import {
  initializeStores,
  useServiceStore,
  useLogStore,
  useMetricStore,
  useDeploymentStore,
  useIncidentStore,
  useRunbookStore,
} from '../src/stores/index.ts';
import { runSelfCheck, type CheckRow } from '../src/webmcp/self-check.ts';
import type { StoreAccessors } from '../src/webmcp/register-tools.ts';

function accessors(): StoreAccessors {
  return {
    getServiceStatus: (service) => {
      const store = useServiceStore.getState();
      if (service) {
        const svc = store.getByName(service);
        return svc ? { services: [svc] } : { error: 'Service not found', services: [] };
      }
      return { services: store.getAll() };
    },
    searchLogs: (params) => useLogStore.getState().search(params),
    analyzeErrors: (service, topN) => useLogStore.getState().analyzeErrors(service, topN),
    getMetrics: (service, metric, timeRange) =>
      useMetricStore.getState().getMetrics(
        service,
        metric,
        timeRange as { start: string; end: string } | undefined,
      ),
    compareMetrics: (service, metric, current, baseline) =>
      useMetricStore.getState().compareMetrics(
        service,
        metric,
        current as { start: string; end: string },
        baseline as { start: string; end: string },
      ),
    getDeployments: (service, status, limit, id) => {
      const store = useDeploymentStore.getState();
      if (id) {
        const dep = store.getById(id);
        return dep ? [dep] : [];
      }
      return store.getAll(service, status, limit);
    },
    createIncident: (data) => useIncidentStore.getState().create(data),
    updateIncident: (id, data) => useIncidentStore.getState().update(id, data),
    executeRunbookStep: (runbookId, stepIndex) =>
      useRunbookStore.getState().executeStep(runbookId, stepIndex),
    generateReport: (incidentId) => {
      const incident = useIncidentStore.getState().getById(incidentId);
      if (!incident) return null;
      const logs = useLogStore.getState().search({
        service: incident.affectedServices[0],
        severity: 'error',
        limit: 20,
      });
      const deployments = useDeploymentStore.getState().getAll(incident.affectedServices[0]);
      return {
        incident,
        errorCount: logs.totalMatches,
        recentErrors: logs.entries.slice(0, 5),
        relatedDeployments: deployments.slice(0, 3),
        generatedAt: new Date().toISOString(),
      };
    },
    suggestRemediation: (service) => {
      const errors = useLogStore.getState().analyzeErrors(service, 3);
      const deployments = useDeploymentStore.getState().getAll(service, undefined, 3);
      const runbooks = useRunbookStore.getState().getAll()
        .filter(r => !service || r.forService === service || r.forService === 'any');
      return {
        suggestions: errors.map((err, i) => ({
          priority: i + 1,
          action: err.suggestedCause,
          risk: i === 0 ? 'low' : 'medium',
          availableRunbook: runbooks[0]?.id ?? null,
          relatedDeployment: deployments[0]?.id ?? null,
        })),
        analyzedErrors: errors.length,
        analyzedDeployments: deployments.length,
      };
    },
  };
}

initializeStores();
const rows: CheckRow[] = runSelfCheck(accessors());
for (const row of rows) {
  const mark = row.pass ? 'ok' : 'FAIL';
  console.log(`${mark}\t${row.tool}\t${row.expected}`);
}
const failed = rows.filter(r => !r.pass);
if (failed.length > 0) {
  console.error(`self-check failed: ${failed.length} of ${rows.length}`);
  process.exit(1);
}
console.log(`self-check passed: ${rows.length} checks`);
