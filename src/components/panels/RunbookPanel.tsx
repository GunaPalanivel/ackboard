import React, { useState } from 'react';
import { Circle, CheckCircle, XCircle, Loader2, MinusCircle } from 'lucide-react';
import { useRunbookStore } from '@/stores';

interface RunbookPanelProps {
  onExecuteStep?: (runbookId: string, stepIndex: number) => void;
}

const RunbookPanel: React.FC<RunbookPanelProps> = ({ onExecuteStep }) => {
  const runbooks = useRunbookStore((state) => state.getAll());
  const [selectedRunbookId, setSelectedRunbookId] = useState<string>(runbooks[0]?.id || '');

  const runbook = runbooks.find(r => r.id === selectedRunbookId);

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
      <div className="p-4 border-b border-slate-800 flex items-center justify-between gap-4">
        <h3 className="text-sm font-semibold text-slate-200 whitespace-nowrap">Runbook Executor</h3>
        <select
          value={selectedRunbookId}
          onChange={(e) => setSelectedRunbookId(e.target.value)}
          className="w-full bg-slate-950 border border-slate-800 rounded-md py-1 px-2 text-sm text-slate-50 focus:outline-none focus:border-blue-500 truncate"
        >
          {runbooks.map((rb) => (
            <option key={rb.id} value={rb.id}>{rb.name}</option>
          ))}
        </select>
      </div>
      
      {runbook ? (
        <div className="flex-1 overflow-y-auto p-4">
          <div className="mb-4">
            <h4 className="font-semibold text-slate-50 text-sm mb-1">{runbook.name}</h4>
            <p className="text-xs text-slate-400">{runbook.description}</p>
            <div className="mt-2 text-[10px] uppercase font-bold text-slate-500">
              Target: <span className="text-blue-400">{runbook.forService}</span>
            </div>
          </div>
          
          <div className="space-y-3">
            {runbook.steps.map((step, index) => {
              const prevCompleted = index === 0 || runbook.steps[index - 1]?.status === 'completed';
              const canExecute = step.status === 'pending' && prevCompleted;
              
              let Icon = Circle;
              let iconColor = 'text-slate-600';
              if (step.status === 'running') { Icon = Loader2; iconColor = 'text-blue-500 animate-spin'; }
              else if (step.status === 'completed') { Icon = CheckCircle; iconColor = 'text-green-500'; }
              else if (step.status === 'failed') { Icon = XCircle; iconColor = 'text-red-500'; }
              else if (step.status === 'skipped') { Icon = MinusCircle; iconColor = 'text-slate-500'; }

              return (
                <div key={index} className={`p-3 rounded-lg border ${step.status === 'running' ? 'bg-blue-950/20 border-blue-500/30' : 'bg-slate-950 border-slate-800'}`}>
                  <div className="flex items-start gap-3">
                    <Icon className={`w-5 h-5 mt-0.5 ${iconColor}`} />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-200">Step {index + 1}</span>
                        {step.status === 'pending' && (
                          <button
                            disabled={!canExecute}
                            onClick={() => onExecuteStep?.(runbook.id, index)}
                            className={`text-xs px-2.5 py-1 rounded transition-colors ${
                              canExecute
                                ? 'bg-blue-600 hover:bg-blue-500 text-white'
                                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                            }`}
                          >
                            Execute
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-1">{step.description}</p>
                      <div className="text-[10px] font-mono text-slate-500 mt-1.5 bg-slate-900 px-1.5 py-0.5 rounded inline-block">
                        {step.action}: {step.target}
                      </div>
                      {step.result && (
                        <div className="text-xs mt-2 p-2 rounded bg-slate-900 border border-slate-800 text-slate-300">
                          {step.result}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-sm text-slate-500">
          No runbook selected
        </div>
      )}
    </div>
  );
};

export default RunbookPanel;
