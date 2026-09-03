import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ChevronDown, ChevronRight, GitCommit } from 'lucide-react';

import Panel from '@/components/Panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useDeploymentStore } from '@/stores';
import type { DeploymentStatus } from '@/types';

const STATUS_VARIANT: Record<DeploymentStatus, 'success' | 'destructive' | 'warning' | 'default'> = {
  success: 'success',
  failed: 'destructive',
  'rolled-back': 'warning',
  'in-progress': 'default',
};

export default function DeploymentTimeline() {
  const [limit, setLimit] = useState(10);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const allDeployments = useDeploymentStore((state) => state.deployments);
  const deployments = allDeployments.slice(0, limit);
  const totalCount = allDeployments.length;

  return (
    <Panel title="Deployments" bodyClassName="overflow-y-auto">
      {deployments.length === 0 ? (
        <p className="px-4 py-12 text-center text-sm text-muted-foreground">
          No deployments match this view.
        </p>
      ) : (
        deployments.map((dep) => {
          const isIncidentRoot =
            dep.service === 'payment-gateway' &&
            dep.version === 'v1.8.3' &&
            dep.deployer === 'sarah.chen';
          const isExpanded = expandedId === dep.id;

          return (
            <div key={dep.id} className="border-b border-border">
              <button
                type="button"
                onClick={() => setExpandedId(isExpanded ? null : dep.id)}
                className={cn(
                  'flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-white/[0.03]',
                  isIncidentRoot && 'bg-amber-500/[0.04]',
                )}
              >
                {isExpanded ? (
                  <ChevronDown className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{dep.service}</span>
                    <span className="font-mono text-xs text-muted-foreground">{dep.version}</span>
                    {isIncidentRoot && <Badge variant="warning">Incident correlation</Badge>}
                    <Badge variant={STATUS_VARIANT[dep.status]} className="ml-auto">
                      {dep.status}
                    </Badge>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {dep.deployer} · {formatDistanceToNow(new Date(dep.timestamp))} ago
                  </div>
                </div>
              </button>
              {isExpanded && (
                <div className="space-y-2 border-t border-border px-4 py-3 pl-11 text-xs">
                  <div className="flex items-center gap-1.5 font-mono text-muted-foreground">
                    <GitCommit className="size-3.5" />
                    {dep.commitHash}
                  </div>
                  <p className="text-[13px] text-foreground">{dep.changelog}</p>
                  <div className="flex gap-4 font-mono text-muted-foreground">
                    <span>Files: {dep.filesChanged}</span>
                    <span className="text-emerald-400">+{dep.linesAdded}</span>
                    <span className="text-red-400">-{dep.linesRemoved}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}
      {totalCount > limit && (
        <div className="px-4 py-3">
          <Button type="button" variant="outline" className="w-full" onClick={() => setLimit((l) => l + 10)}>
            Show more
          </Button>
        </div>
      )}
    </Panel>
  );
}
