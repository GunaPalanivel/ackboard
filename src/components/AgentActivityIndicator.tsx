import { useEffect, useState, type ReactNode } from "react";
import { onToolActivity } from "@/webmcp/register-tools";
import type { ToolActivity } from "@/webmcp/register-tools";

export function useAgentActivity(): ToolActivity | null {
  const [activity, setActivity] = useState<ToolActivity | null>(null);

  useEffect(() => {
    const unsub = onToolActivity((newActivity) => {
      setActivity(newActivity);
    });
    return unsub;
  }, []);

  return activity;
}

interface AgentActivityIndicatorProps {
  panelId: string;
  children: ReactNode;
  className?: string;
}

export default function AgentActivityIndicator({
  panelId,
  children,
  className = "",
}: AgentActivityIndicatorProps) {
  const activity = useAgentActivity();
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    if (activity && activity.panel === panelId) {
      setIsActive(true);
      const timer = setTimeout(() => {
        setIsActive(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [activity, panelId]);

  return (
    <div className={`relative h-full min-h-0 ${className}`}>
      {isActive && (
        <div className="absolute -top-2 right-3 z-10 flex items-center gap-1.5 rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
          <span className="font-medium">Agent examining</span>
        </div>
      )}
      <div
        className={`h-full min-h-0 ${
          isActive ? "agent-examining-glow rounded-lg" : ""
        }`}
      >
        {children}
      </div>
    </div>
  );
}
