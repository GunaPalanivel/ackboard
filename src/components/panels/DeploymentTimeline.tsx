import React, { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ChevronDown, ChevronRight, GitCommit } from 'lucide-react';
import { useDeploymentStore } from '@/stores';
import type { DeploymentStatus } from '@/types';

const STATUS_COLORS: Record<DeploymentStatus, string> = {
  success: 'bg-green-500/10 text-green-500 border-green-500/20',
  failed: 'bg-red-500/10 text-red-500 border-red-500/20',
  'rolled-back': 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  'in-progress': 'bg-blue-500/10 text-blue-500 border-blue-500/20',
};

const DeploymentTimeline: React.FC = () => {
  const [limit, setLimit] = useState(10);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const allDeployments = useDeploymentStore((state) => state.deployments);
  const deployments = allDeployments.slice(0, limit);
  const totalCount = allDeployments.length;

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
      <div className="p-4 border-b border-slate-800">
        <h3 className="text-sm font-semibold text-slate-200">Deployment History</h3>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4 relative">
        {deployments.length === 0 && (
          <p className="text-sm text-slate-500 relative z-10">No deployments match this view.</p>
        )}
        <div className="absolute left-6 top-4 bottom-4 w-px bg-slate-800 z-0"></div>
        {deployments.map((dep) => {
          const isIncidentRoot = dep.service === 'payment-gateway' && dep.version === 'v1.8.3' && dep.deployer === 'sarah.chen';
          const isExpanded = expandedId === dep.id;

          return (
            <div
              key={dep.id}
              className={`relative z-10 pl-8 transition-all ${isIncidentRoot ? 'opacity-100' : 'opacity-90 hover:opacity-100'}`}
            >
              <div
                className={`absolute left-0 top-1.5 w-3 h-3 rounded-full border-2 ${
                  isIncidentRoot ? 'bg-red-500 border-red-300 animate-pulse' : 'bg-slate-900 border-slate-500'
                }`}
                style={{ transform: 'translateX(2.5px)' }}
              />
              <div
                className={`p-3 rounded-lg border cursor-pointer ${
                  isIncidentRoot ? 'border-amber-500/50 bg-red-950/20' : 'border-slate-800 bg-slate-950 hover:border-slate-700'
                }`}
                onClick={() => setExpandedId(isExpanded ? null : dep.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
                    <span className="font-semibold text-sm text-slate-200">{dep.service}</span>
                    <span className="text-xs font-mono text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded">
                      {dep.version}
                    </span>
                    {isIncidentRoot && (
                      <span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded uppercase">
                        ⚠ Incident Correlation
                      </span>
                    )}
                  </div>
                  <div className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${STATUS_COLORS[dep.status]}`}>
                    {dep.status}
                  </div>
                </div>
                <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400">{dep.deployer}</span>
                  </div>
                  <div>{formatDistanceToNow(new Date(dep.timestamp))} ago</div>
                </div>
                
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-slate-800 space-y-2 text-xs">
                    <div className="flex items-center gap-1.5 text-slate-400 font-mono bg-slate-900 p-1.5 rounded">
                      <GitCommit className="w-3.5 h-3.5" />
                      {dep.commitHash}
                    </div>
                    <div className="text-slate-300">{dep.changelog}</div>
                    <div className="flex gap-4 text-slate-500 font-mono">
                      <span>Files: {dep.filesChanged}</span>
                      <span className="text-green-500/80">+{dep.linesAdded}</span>
                      <span className="text-red-500/80">-{dep.linesRemoved}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {totalCount > limit && (
          <button
            onClick={() => setLimit(l => l + 10)}
            className="w-full py-2 text-sm text-slate-400 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-md transition-colors"
          >
            Show more
          </button>
        )}
      </div>
    </div>
  );
};

export default DeploymentTimeline;
