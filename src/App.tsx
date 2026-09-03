// Ackboard: main application shell

import { useEffect, useState } from "react";
import {
  initializeStores,
  useServiceStore,
  useLogStore,
  useMetricStore,
  useDeploymentStore,
  useIncidentStore,
  useRunbookStore,
} from "./stores";
import {
  initializeWebMCP,
  getWebMCPStatus,
  onWebMCPStatusChange,
  requestConfirmation,
  type WebMCPStatus,
  type StoreAccessors,
} from "./webmcp/register-tools";

import ConfirmDialog from "./components/ConfirmDialog";
import AppSidebar from "./components/AppSidebar";
import AgentActivityIndicator from "./components/AgentActivityIndicator";
import Panel from "./components/Panel";
import LogViewer from "./components/panels/LogViewer";
import MetricsPanel from "./components/panels/MetricsPanel";
import DeploymentTimeline from "./components/panels/DeploymentTimeline";
import RunbookPanel from "./components/panels/RunbookPanel";
import { Badge } from "./components/ui/badge";
import { Tracker } from "./components/ui/tracker";
import { TooltipProvider } from "./components/ui/tooltip";
import { cn } from "./lib/utils";

function App() {
  const [initialized, setInitialized] = useState(false);
  const [webmcpStatus, setWebmcpStatus] = useState<WebMCPStatus>("unavailable");

  useEffect(() => {
    initializeStores();

    const storeAccessors: StoreAccessors = {
      getServiceStatus: (service) => {
        const store = useServiceStore.getState();
        if (service) {
          const svc = store.getByName(service);
          return svc
            ? { services: [svc] }
            : { error: "Service not found", services: [] };
        }
        return { services: store.getAll() };
      },
      searchLogs: (params) => useLogStore.getState().search(params),
      analyzeErrors: (service, topN) =>
        useLogStore.getState().analyzeErrors(service, topN),
      getMetrics: (service, metric, timeRange) =>
        useMetricStore
          .getState()
          .getMetrics(
            service,
            metric,
            timeRange as { start: string; end: string } | undefined
          ),
      compareMetrics: (service, metric, current, baseline) =>
        useMetricStore
          .getState()
          .compareMetrics(
            service,
            metric,
            current as { start: string; end: string },
            baseline as { start: string; end: string }
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
      updateIncident: (id, data) =>
        useIncidentStore.getState().update(id, data),
      executeRunbookStep: (runbookId, stepIndex) =>
        useRunbookStore.getState().executeStep(runbookId, stepIndex),
      generateReport: (incidentId) => {
        const incident = useIncidentStore.getState().getById(incidentId);
        if (!incident) return null;
        const logs = useLogStore.getState().search({
          service: incident.affectedServices[0],
          severity: "error",
          limit: 20,
        });
        const deployments = useDeploymentStore
          .getState()
          .getAll(incident.affectedServices[0]);
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
        const deployments = useDeploymentStore
          .getState()
          .getAll(service, undefined, 3);
        const runbooks = useRunbookStore
          .getState()
          .getAll()
          .filter(
            (r) =>
              !service || r.forService === service || r.forService === "any"
          );

        return {
          suggestions: errors.map((err, i) => ({
            priority: i + 1,
            action: err.suggestedCause,
            risk: i === 0 ? "low" : "medium",
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
      void import("./webmcp/self-check").then((m) =>
        m.runSelfCheck(storeAccessors)
      );
    }

    return () => {
      dispose();
      unsub();
    };
  }, []);

  const services = useServiceStore((s) => s.services);
  const incidents = useIncidentStore((s) => s.incidents);

  if (!initialized) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-muted-foreground">
        <div className="text-center">
          <div className="mb-2 text-2xl font-semibold tracking-tight text-foreground">
            Ackboard
          </div>
          <div className="text-sm">Loading simulated fleet data...</div>
          <div className="mx-auto mt-4 h-1 w-32 overflow-hidden rounded bg-muted">
            <div className="h-full w-1/2 animate-pulse bg-primary" />
          </div>
        </div>
      </div>
    );
  }

  const healthyCount = services.filter((s) => s.status === "healthy").length;
  const degradedCount = services.filter((s) => s.status === "degraded").length;
  const downCount = services.filter((s) => s.status === "down").length;
  const activeIncidents = incidents.filter((i) => i.status !== "resolved");

  return (
    <TooltipProvider>
      <div className="flex h-screen min-h-0 overflow-hidden bg-background text-foreground">
        <ConfirmDialog />
        <AppSidebar
          webmcpStatus={webmcpStatus}
          activeIncidentCount={activeIncidents.length}
        />

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-40 flex h-12 shrink-0 items-center gap-3 border-b border-border bg-background/90 px-4 backdrop-blur">
            <span className="text-sm font-semibold tracking-tight lg:hidden">
              Ackboard
            </span>
            <span className="hidden text-sm font-medium text-foreground lg:inline">
              Overview
            </span>
            <div
              id="overview"
              className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground"
            >
              <span className="inline-flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                {healthyCount} healthy
              </span>
              {degradedCount > 0 && (
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-amber-400" />
                  {degradedCount} degraded
                </span>
              )}
              {downCount > 0 && (
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-red-500" />
                  {downCount} down
                </span>
              )}
              {activeIncidents.length > 0 && (
                <span>
                  {activeIncidents.length} active incident
                  {activeIncidents.length > 1 ? "s" : ""}
                </span>
              )}
              <Badge variant="outline">Simulated data</Badge>
            </div>
          </header>

          <main className="grid min-h-0 flex-1 grid-cols-1 content-start gap-3 overflow-auto p-4 lg:grid-cols-2 lg:grid-rows-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] lg:overflow-hidden">
            <AgentActivityIndicator
              panelId="services"
              className="min-h-[20rem] lg:min-h-0"
            >
              <Panel id="services" title="Services" bodyClassName="overflow-y-auto">
                {services.length === 0 ? (
                  <p className="px-4 py-12 text-center text-sm text-muted-foreground">
                    No services in this session.
                  </p>
                ) : (
                  <>
                    <div className="grid grid-cols-[16px_minmax(0,1fr)_56px_48px_56px_48px] items-center gap-x-3 border-b border-border px-4 py-2 text-xs text-muted-foreground">
                      <span />
                      <span>Service</span>
                      <span className="text-right">Up</span>
                      <span className="text-right">Err</span>
                      <span className="text-right">p99</span>
                      <span />
                    </div>
                    {services.map((svc) => {
                      const tone =
                        svc.status === "healthy"
                          ? "ok"
                          : svc.status === "degraded"
                            ? "warn"
                            : "bad";
                      return (
                        <div
                          key={svc.name}
                          className="grid grid-cols-[16px_minmax(0,1fr)_56px_48px_56px_48px] items-center gap-x-3 border-b border-border px-4 py-2.5 text-[13px] hover:bg-white/[0.03]"
                        >
                          <span
                            className={cn(
                              "size-2 rounded-full",
                              svc.status === "healthy" && "bg-emerald-500",
                              svc.status === "degraded" && "bg-amber-400",
                              svc.status === "down" && "bg-red-500",
                            )}
                            title={svc.status}
                          />
                          <span className="min-w-0 font-medium text-foreground">
                            {svc.displayName}
                          </span>
                          <span className="text-right tabular-nums text-muted-foreground">
                            {svc.uptime}%
                          </span>
                          <span
                            className={cn(
                              "text-right tabular-nums",
                              svc.errorRate > 1
                                ? "text-red-400"
                                : "text-muted-foreground",
                            )}
                          >
                            {svc.errorRate}%
                          </span>
                          <span
                            className={cn(
                              "text-right tabular-nums",
                              svc.p99Latency > 500
                                ? "text-amber-400"
                                : "text-muted-foreground",
                            )}
                          >
                            {svc.p99Latency}ms
                          </span>
                          <Tracker value={svc.uptime} tone={tone} blocks={8} />
                        </div>
                      );
                    })}
                  </>
                )}
              </Panel>
            </AgentActivityIndicator>

            <AgentActivityIndicator
              panelId="incidents"
              className="min-h-[20rem] lg:min-h-0"
            >
              <Panel id="incidents" title="Incidents" bodyClassName="overflow-y-auto">
                {incidents.length === 0 ? (
                  <p className="px-4 py-12 text-center text-sm text-muted-foreground">
                    No incidents. An agent can open one with create_incident
                    after you approve it.
                  </p>
                ) : (
                  incidents.map((inc) => {
                    const latest = inc.timeline[inc.timeline.length - 1];
                    return (
                      <div
                        key={inc.id}
                        className="border-b border-border px-4 py-3 hover:bg-white/[0.03]"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-medium text-foreground">
                            {inc.title}
                          </h3>
                          <Badge
                            variant={
                              inc.severity.startsWith("P1")
                                ? "destructive"
                                : inc.severity.startsWith("P2")
                                  ? "warning"
                                  : "muted"
                            }
                          >
                            {inc.severity}
                          </Badge>
                          <Badge variant="outline">{inc.status}</Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {inc.affectedServices.join(", ")} ·{" "}
                          {inc.timeline.length} update
                          {inc.timeline.length > 1 ? "s" : ""}
                          {latest
                            ? ` · ${latest.author}: ${latest.content.slice(0, 100)}${latest.content.length > 100 ? "..." : ""}`
                            : ""}
                        </p>
                      </div>
                    );
                  })
                )}
              </Panel>
            </AgentActivityIndicator>

            <AgentActivityIndicator panelId="logs" className="min-h-[20rem] lg:min-h-0">
              <div id="logs" className="h-full">
                <LogViewer />
              </div>
            </AgentActivityIndicator>

            <AgentActivityIndicator panelId="metrics" className="min-h-[20rem] lg:min-h-0">
              <div id="metrics" className="h-full">
                <MetricsPanel />
              </div>
            </AgentActivityIndicator>

            <AgentActivityIndicator
              panelId="deployments"
              className="min-h-[20rem] lg:min-h-0"
            >
              <div id="deployments" className="h-full">
                <DeploymentTimeline />
              </div>
            </AgentActivityIndicator>

            <AgentActivityIndicator panelId="runbook" className="min-h-[20rem] lg:min-h-0">
              <div id="runbook" className="h-full">
                <RunbookPanel
                  onExecuteStep={async (runbookId, stepIndex) => {
                    const ok = await requestConfirmation({
                      title: `Execute runbook step ${stepIndex + 1}?`,
                      message: `Runbook: ${runbookId}, step ${stepIndex + 1}`,
                      details:
                        "This runs a remediation action. Review it before you approve.",
                      variant: "destructive",
                    });
                    if (!ok) return;
                    await useRunbookStore
                      .getState()
                      .executeStep(runbookId, stepIndex);
                  }}
                />
              </div>
            </AgentActivityIndicator>
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}

export default App;
