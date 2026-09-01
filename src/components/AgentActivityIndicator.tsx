import { useEffect, useState, type ReactNode } from 'react';
import { onToolActivity } from '@/webmcp/register-tools';
import type { ToolActivity } from '@/webmcp/register-tools';

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

export default function AgentActivityIndicator({ panelId, children, className = '' }: AgentActivityIndicatorProps) {
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
    <div className={`relative h-full ${className}`}>
      {isActive && (
        <div className="absolute -top-3 right-4 z-10 flex items-center gap-1.5 bg-blue-500 text-white text-xs px-2.5 py-1 rounded-full shadow-lg shadow-blue-500/20 animate-indicator-badge">
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          <span className="font-medium">Agent examining</span>
        </div>
      )}
      <div 
        className={`h-full rounded-lg transition-all duration-300 ${isActive ? 'agent-examining-glow' : ''}`}
      >
        {children}
      </div>
      <style>{`
        @keyframes agent-glow {
          0% {
            box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7), inset 0 0 0 2px rgba(59, 130, 246, 1);
          }
          70% {
            box-shadow: 0 0 0 10px rgba(59, 130, 246, 0), inset 0 0 0 2px rgba(59, 130, 246, 0.5);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(59, 130, 246, 0), inset 0 0 0 0 transparent;
          }
        }
        @keyframes indicator-badge-in {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .agent-examining-glow {
          animation: agent-glow 2s cubic-bezier(0.4, 0, 0.6, 1) forwards;
        }
        .animate-indicator-badge {
          animation: indicator-badge-in 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
