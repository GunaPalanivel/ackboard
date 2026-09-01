import React, { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useLogStore, useServiceStore } from '@/stores';
import type { LogSeverity } from '@/types';

const SEVERITIES: LogSeverity[] = ['debug', 'info', 'warn', 'error', 'fatal'];

const SEVERITY_COLORS: Record<LogSeverity, string> = {
  fatal: 'bg-red-500/10 text-red-500 border-red-500/20',
  error: 'bg-red-500/10 text-red-500 border-red-500/20',
  warn: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  info: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  debug: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
};

const LogViewer: React.FC = () => {
  const [query, setQuery] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState<LogSeverity | ''>('');
  const [selectedService, setSelectedService] = useState<string>('');
  const [limit, setLimit] = useState(100);

  const searchLogs = useLogStore((state) => state.search);
  const services = useServiceStore((state) => state.services);
  const serviceNames = services.map((s) => s.name);

  const result = useMemo(() => {
    return searchLogs({
      query: query || undefined,
      severity: selectedSeverity || undefined,
      service: selectedService || undefined,
      limit,
    });
  }, [query, selectedSeverity, selectedService, limit, searchLogs]);

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
      <div className="p-4 border-b border-slate-800 space-y-4">
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search logs..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-md py-1.5 pl-9 pr-3 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <select
            value={selectedService}
            onChange={(e) => setSelectedService(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-md py-1.5 px-3 text-sm text-slate-50 focus:outline-none focus:border-blue-500"
          >
            <option value="">All Services</option>
            {serviceNames.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {SEVERITIES.map((sev) => (
              <button
                key={sev}
                onClick={() => setSelectedSeverity(selectedSeverity === sev ? '' : sev)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  selectedSeverity === sev
                    ? 'bg-slate-700 border-slate-500 text-slate-50'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800'
                }`}
              >
                {sev.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="text-xs text-slate-400">
            {result.totalMatches} matches
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {result.entries.length === 0 && (
          <p className="text-sm text-slate-500 py-8 text-center">No log lines match these filters.</p>
        )}
        {result.entries.map((entry) => (
          <div key={entry.id} className="flex items-start gap-3 text-sm border-b border-slate-800/50 pb-2 last:border-0">
            <div className="text-xs text-slate-500 whitespace-nowrap min-w-[60px] pt-0.5">
              {formatDistanceToNow(new Date(entry.timestamp))} ago
            </div>
            <div className={`text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase min-w-[50px] text-center ${SEVERITY_COLORS[entry.severity]}`}>
              {entry.severity}
            </div>
            <div className="text-xs text-slate-400 font-medium min-w-[120px] pt-0.5 truncate">
              {entry.service}
            </div>
            <div className="text-slate-300 font-mono text-xs break-all pt-0.5">
              {entry.message}
            </div>
          </div>
        ))}
        {result.totalMatches > limit && (
          <button
            onClick={() => setLimit(l => l + 100)}
            className="w-full py-2 text-sm text-slate-400 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-md transition-colors"
          >
            Load more
          </button>
        )}
      </div>
    </div>
  );
};

export default LogViewer;
