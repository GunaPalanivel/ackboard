import { useState } from 'react';
import { Circle, CheckCircle, XCircle, Loader2, MinusCircle } from 'lucide-react';

import Panel from '@/components/Panel';
import { Button } from '@/components/ui/button';
import { nativeControlClass } from '@/lib/field';
import { cn } from '@/lib/utils';
import { useRunbookStore } from '@/stores';

interface RunbookPanelProps {
  onExecuteStep?: (runbookId: string, stepIndex: number) => void;
}

export default function RunbookPanel({ onExecuteStep }: RunbookPanelProps) {
  const runbooks = useRunbookStore((state) => state.runbooks);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const selectedRunbookId = pickedId ?? runbooks[0]?.id ?? '';
  const runbook = runbooks.find((r) => r.id === selectedRunbookId);

  return (
    <Panel
      title="Runbook"
      actions={
        <select
          value={selectedRunbookId}
          onChange={(e) => setPickedId(e.target.value)}
          className={cn(nativeControlClass, 'max-w-[220px] truncate')}
        >
          {runbooks.map((rb) => (
            <option key={rb.id} value={rb.id}>{rb.name}</option>
          ))}
        </select>
      }
      bodyClassName="overflow-y-auto"
    >
      {runbook ? (
        <>
          <div className="border-b border-border px-4 py-3">
            <p className="text-[13px] text-muted-foreground">{runbook.description}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Target <span className="text-foreground">{runbook.forService}</span>
            </p>
          </div>
          {runbook.steps.map((step, index) => {
            const prevCompleted = index === 0 || runbook.steps[index - 1]?.status === 'completed';
            const canExecute = step.status === 'pending' && prevCompleted;

            let Icon = Circle;
            let iconColor = 'text-muted-foreground/50';
            if (step.status === 'running') { Icon = Loader2; iconColor = 'text-blue-500 animate-spin'; }
            else if (step.status === 'completed') { Icon = CheckCircle; iconColor = 'text-emerald-500'; }
            else if (step.status === 'failed') { Icon = XCircle; iconColor = 'text-red-500'; }
            else if (step.status === 'skipped') { Icon = MinusCircle; iconColor = 'text-muted-foreground'; }

            return (
              <div
                key={index}
                className={cn(
                  'flex items-start gap-3 border-b border-border px-4 py-3',
                  step.status === 'running' && 'bg-blue-500/[0.04]',
                )}
              >
                <Icon className={cn('mt-0.5 size-4 shrink-0', iconColor)} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">Step {index + 1}</span>
                    {step.status === 'pending' && (
                      <Button
                        type="button"
                        size="sm"
                        variant={canExecute ? 'default' : 'secondary'}
                        disabled={!canExecute}
                        onClick={() => onExecuteStep?.(runbook.id, index)}
                      >
                        Execute
                      </Button>
                    )}
                  </div>
                  <p className="mt-1 text-[13px] text-muted-foreground">{step.description}</p>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">
                    {step.action}: {step.target}
                  </p>
                  {step.result && (
                    <p className="mt-2 text-[13px] text-foreground">{step.result}</p>
                  )}
                </div>
              </div>
            );
          })}
        </>
      ) : (
        <p className="px-4 py-12 text-center text-sm text-muted-foreground">No runbook selected</p>
      )}
    </Panel>
  );
}
