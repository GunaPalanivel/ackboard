import { useEffect, useRef, useState } from 'react';
import { setConfirmHandler } from '@/webmcp/register-tools';
import type { ConfirmRequest } from '@/webmcp/register-tools';
import { ShieldCheck } from 'lucide-react';

interface PendingRequest {
  req: ConfirmRequest;
  resolve: (value: boolean) => void;
}

export default function ConfirmDialog() {
  const [request, setRequest] = useState<PendingRequest | null>(null);
  const pendingRef = useRef<PendingRequest | null>(null);

  useEffect(() => {
    setConfirmHandler(
      (req) => {
        return new Promise<boolean>((resolve) => {
          const pending = { req, resolve };
          pendingRef.current = pending;
          setRequest(pending);
        });
      },
      () => {
        const pending = pendingRef.current;
        if (!pending) return;
        pending.resolve(false);
        pendingRef.current = null;
        setRequest(null);
      },
    );
    return () => setConfirmHandler(null, null);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!request) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        pendingRef.current = null;
        request.resolve(true);
        setRequest(null);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        pendingRef.current = null;
        request.resolve(false);
        setRequest(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [request]);

  if (!request) return null;

  const { req } = request;

  const handleApprove = () => {
    pendingRef.current = null;
    request.resolve(true);
    setRequest(null);
  };

  const handleDecline = () => {
    pendingRef.current = null;
    request.resolve(false);
    setRequest(null);
  };

  const getAccentColor = (variant: 'default' | 'warning' | 'destructive') => {
    switch (variant) {
      case 'warning': return 'text-amber-500 border-amber-500 bg-amber-500/10';
      case 'destructive': return 'text-red-500 border-red-500 bg-red-500/10';
      default: return 'text-blue-500 border-blue-500 bg-blue-500/10';
    }
  };

  const getButtonColor = (variant: 'default' | 'warning' | 'destructive') => {
    switch (variant) {
      case 'destructive': return 'bg-red-500 hover:bg-red-600 text-white border-transparent';
      case 'warning': return 'bg-green-500 hover:bg-green-600 text-white border-transparent';
      default: return 'bg-green-500 hover:bg-green-600 text-white border-transparent';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" role="dialog" aria-modal="true" aria-labelledby="ackboard-confirm-title">
      <div className="bg-slate-900 border border-slate-700 rounded-lg shadow-2xl max-w-md w-full p-6 flex flex-col gap-4 animate-zoom-in">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-full border ${getAccentColor(req.variant)}`}>
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h2 id="ackboard-confirm-title" className="text-xl font-semibold text-slate-50">{req.title}</h2>
        </div>
        
        <div className="text-slate-200 text-lg">
          {req.message}
        </div>
        
        {req.details && (
          <div className="text-sm text-slate-400 bg-slate-950 p-3 rounded-md font-mono whitespace-pre-wrap border border-slate-800 max-h-48 overflow-y-auto">
            {req.details}
          </div>
        )}

        <div className="flex justify-end gap-3 mt-4">
          <button
            onClick={handleDecline}
            className="px-4 py-2 rounded-md bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors border border-slate-700"
          >
            Decline
          </button>
          <button
            onClick={handleApprove}
            className={`px-4 py-2 rounded-md transition-colors border ${getButtonColor(req.variant)}`}
          >
            Approve
          </button>
        </div>
        
        <div className="text-xs text-slate-500 text-center mt-2">
          Enter to approve, Escape to decline
        </div>
      </div>
      <style>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes zoom-in {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fade-in {
          animation: fade-in 0.2s ease-out forwards;
        }
        .animate-zoom-in {
          animation: zoom-in 0.2s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
