import {
  Activity,
  AlertTriangle,
  BookOpen,
  LayoutGrid,
  LineChart,
  Rocket,
  ScrollText,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import type { WebMCPStatus } from '@/webmcp/register-tools';

const NAV = [
  { id: 'overview', label: 'Overview', icon: LayoutGrid },
  { id: 'incidents', label: 'Incidents', icon: AlertTriangle },
  { id: 'services', label: 'Services', icon: Activity },
  { id: 'logs', label: 'Logs', icon: ScrollText },
  { id: 'metrics', label: 'Metrics', icon: LineChart },
  { id: 'deployments', label: 'Deployments', icon: Rocket },
  { id: 'runbook', label: 'Runbook', icon: BookOpen },
] as const;

interface AppSidebarProps {
  webmcpStatus: WebMCPStatus;
  activeIncidentCount: number;
}

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export default function AppSidebar({ webmcpStatus, activeIncidentCount }: AppSidebarProps) {
  return (
    <aside className="hidden w-56 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex">
      <div className="border-b border-sidebar-border px-4 py-4">
        <div className="text-base font-semibold tracking-tight text-foreground">Ackboard</div>
        <p className="mt-1 text-xs text-muted-foreground">
          {webmcpStatus === 'connected' ? 'WebMCP connected' : 'WebMCP unavailable'}
        </p>
      </div>

      <nav className="flex-1 space-y-0.5 px-2 py-3">
        {NAV.map((item) => {
          const Icon = item.icon;
          const showCount = item.id === 'incidents' && activeIncidentCount > 0;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => scrollToSection(item.id)}
              className={cn(
                'flex h-8 w-full items-center gap-2 rounded-md px-2 text-sm text-muted-foreground',
                'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
              )}
            >
              <Icon className="size-4 shrink-0" />
              <span className="flex-1 text-left">{item.label}</span>
              {showCount && (
                <span className="tabular-nums text-xs text-muted-foreground">{activeIncidentCount}</span>
              )}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
