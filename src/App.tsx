// Ackboard: main application shell

import { useEffect, useState } from 'react';
import {
  initializeStores,
  useServiceStore,
  useLogStore,
  useMetricStore,
  useDeploymentStore,
  useIncidentStore,
  useRunbookStore,
} from './stores';
import {
  initializeWebMCP,
  getWebMCPStatus,
  onWebMCPStatusChange,
  requestConfirmation,
  type WebMCPStatus,
  type StoreAccessors,
} from './webmcp/register-tools';

import ConfirmDialog from './components/ConfirmDialog';
import AgentActivityIndicator from './components/AgentActivityIndicator';
import LogViewer from './components/panels/LogViewer';
import MetricsPanel from './components/panels/MetricsPanel';
import DeploymentTimeline from './components/panels/DeploymentTimeline';
import RunbookPanel from './components/panels/RunbookPanel';

function App() {
  const [initialized, setInitialized] = useState(false);
  const [webmcpStatus, setWebmcpStatus] = useState<WebMCPStatus>('unavailable');

  useEffect(() => {
    initializeStores();

    const storeAccessors: StoreAccessors = {
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
        useMetricStore.getState().getMetrics(service, metric, timeRange as { start: string; end: string } | undefined),
      compareMetrics: (service, metric, current, baseline) =>
        useMetricStore.getState().compareMetrics(
          service, metric,
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

    const dispose = initializeWebMCP(storeAccessors);
    setWebmcpStatus(getWebMCPStatus());
    const unsub = onWebMCPStatusChange(setWebmcpStatus);
    setInitialized(true);

    if (import.meta.env.DEV) {
      void import('./webmcp/self-check').then((m) => m.runSelfCheck(storeAccessors));
    }

    return () => {
      dispose();
      unsub();
    };
  }, []);

  const services = useServiceStore(s => s.services);
  const incidents = useIncidentStore(s => s.incidents);

  if (!initialized) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-950 text-slate-400 font-sans">
        <div className="text-center">
          <div className="text-2xl font-bold text-slate-50 mb-2">Ackboard</div>
          <div className="text-sm">Loading simulated fleet data...</div>
          <div className="mt-4 mx-auto h-1 w-32 overflow-hidden rounded bg-slate-800">
            <div className="h-full w-1/2 bg-blue-500 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  const healthyCount = services.filter(s => s.status === 'healthy').length;
  const degradedCount = services.filter(s => s.status === 'degraded').length;
  const downCount = services.filter(s => s.status === 'down').length;
  const activeIncidents = incidents.filter(i => i.status !== 'resolved');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans">
      <ConfirmDialog />

      <header className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b border-slate-800 bg-slate-950 sticky top-0 z-50">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-lg font-bold text-slate-50 tracking-tight">Ackboard</span>
          <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
            webmcpStatus === 'connected'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'bg-slate-800 text-slate-500 border border-slate-700'
          }`}>
            {webmcpStatus === 'connected' ? 'WebMCP connected' : 'WebMCP unavailable'}
          </span>
          <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20">
            Simulated data
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs flex-wrap">
          <span className="text-emerald-400">{healthyCount} healthy</span>
          {degradedCount > 0 && <span className="text-amber-400">{degradedCount} degraded</span>}
          {downCount > 0 && <span className="text-red-400">{downCount} down</span>}
          {activeIncidents.length > 0 && (
            <span className="bg-red-500/10 text-red-400 px-2 py-0.5 rounded border border-red-500/20 font-semibold">
              {activeIncidents.length} active incident{activeIncidents.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-2 gap-px bg-slate-800 m-px min-h-[calc(100vh-3.5rem)]">
        <AgentActivityIndicator panelId="services" className="bg-slate-950 p-4 min-h-[16rem]">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Service Health</h2>
          {services.length === 0 ? (
            <p className="text-sm text-slate-500">No services in this session.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {services.map(svc => (
                <div key={svc.name} className={`p-3 rounded-lg border ${
                  svc.status === 'healthy'
                    ? 'bg-emerald-500/5 border-emerald-500/20'
                    : svc.status === 'degraded'
                      ? 'bg-amber-500/5 border-amber-500/20'
                      : 'bg-red-500/5 border-red-500/20'
                }`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      svc.status === 'healthy' ? 'bg-emerald-400' : svc.status === 'degraded' ? 'bg-amber-400 animate-pulse' : 'bg-red-400 animate-pulse'
                    }`} />
                    <span className="text-xs font-semibold text-slate-50 truncate">{svc.displayName}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 space-x-1">
                    <span>{svc.uptime}%</span>
                    <span>·</span>
                    <span className={svc.errorRate > 1 ? 'text-red-400' : ''}>{svc.errorRate}% err</span>
                    <span>·</span>
                    <span className={svc.p99Latency > 500 ? 'text-amber-400' : ''}>{svc.p99Latency}ms</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </AgentActivityIndicator>

        <AgentActivityIndicator panelId="incidents" className="bg-slate-950 p-4 min-h-[16rem]">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Active Incidents</h2>
          {incidents.length === 0 ? (
            <p className="text-sm text-slate-500">No incidents. An agent can open one with create_incident after you approve it.</p>
          ) : (
            <div className="space-y-2 overflow-y-auto" style={{ maxHeight: 'calc(33vh - 60px)' }}>
              {incidents.map(inc => (
                <div key={inc.id} className={`p-3 rounded-lg border ${
                  inc.severity === 'P1-Critical' ? 'border-red-500/30 bg-red-500/5'
                    : inc.severity === 'P2-High' ? 'border-amber-500/30 bg-amber-500/5'
                      : 'border-slate-700 bg-slate-900'
                }`}>
                  <div className="flex items-center justify-between mb-1 gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                        inc.severity.startsWith('P1') ? 'bg-red-500/20 text-red-400'
                          : inc.severity.startsWith('P2') ? 'bg-amber-500/20 text-amber-400'
                            : 'bg-slate-800 text-slate-400'
                      }`}>{inc.severity}</span>
                      <span className="text-sm font-semibold text-slate-50 truncate">{inc.title}</span>
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 shrink-0">{inc.status}</span>
                  </div>
                  <div className="text-xs text-slate-500">
                    {inc.affectedServices.join(', ')} · {inc.timeline.length} update{inc.timeline.length > 1 ? 's' : ''}
                  </div>
                  <div className="mt-2 space-y-1">
                    {inc.timeline.slice(-2).map((note, i) => (
                      <div key={i} className="text-[10px] text-slate-500 pl-2 border-l border-slate-700">
                        <span className="text-slate-400 font-medium">{note.author}</span>: {note.content.slice(0, 120)}{note.content.length > 120 ? '...' : ''}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </AgentActivityIndicator>

        <AgentActivityIndicator panelId="logs" className="bg-slate-950 min-h-[22rem]">
          <LogViewer />
        </AgentActivityIndicator>

        <AgentActivityIndicator panelId="metrics" className="bg-slate-950 min-h-[22rem]">
          <MetricsPanel />
        </AgentActivityIndicator>

        <AgentActivityIndicator panelId="deployments" className="bg-slate-950 min-h-[22rem]">
          <DeploymentTimeline />
        </AgentActivityIndicator>

        <AgentActivityIndicator panelId="runbook" className="bg-slate-950 min-h-[22rem]">
          <RunbookPanel
            onExecuteStep={async (runbookId, stepIndex) => {
              const ok = await requestConfirmation({
                title: `Execute runbook step ${stepIndex + 1}?`,
                message: `Runbook: ${runbookId}, step ${stepIndex + 1}`,
                details: 'This runs a remediation action. Review it before you approve.',
                variant: 'destructive',
              });
              if (!ok) return;
              await useRunbookStore.getState().executeStep(runbookId, stepIndex);
            }}
          />
        </AgentActivityIndicator>
      </main>
    </div>
  );
}

export default App;
