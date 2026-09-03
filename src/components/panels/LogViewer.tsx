import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { format } from "date-fns";

import Panel from "@/components/Panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { nativeControlClass } from "@/lib/field";
import { cn } from "@/lib/utils";
import { useLogStore, useServiceStore } from "@/stores";
import type { LogSeverity } from "@/types";

const SEVERITIES: LogSeverity[] = ["debug", "info", "warn", "error", "fatal"];

function severityVariant(
  sev: LogSeverity
): "muted" | "default" | "warning" | "destructive" {
  if (sev === "fatal" || sev === "error") return "destructive";
  if (sev === "warn") return "warning";
  if (sev === "info") return "default";
  return "muted";
}

export default function LogViewer() {
  const [query, setQuery] = useState("");
  const [selectedSeverity, setSelectedSeverity] = useState<LogSeverity | "">(
    ""
  );
  const [selectedService, setSelectedService] = useState("");
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
    <Panel
      title="Logs"
      actions={
        <span className="text-xs text-muted-foreground tabular-nums">
          {result.totalMatches} matches
        </span>
      }
      bodyClassName="flex flex-col"
    >
      <div className="flex h-11 shrink-0 items-center gap-2 overflow-x-auto border-b border-border px-4">
        <Input
          leading={<Search className="size-4" />}
          type="text"
          placeholder="Search logs..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          value={selectedService}
          onChange={(e) => setSelectedService(e.target.value)}
          className={cn(nativeControlClass, "max-w-[160px] shrink-0")}
        >
          <option value="">All services</option>
          {serviceNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <div className="flex h-8 shrink-0 items-center gap-0.5 rounded-md border border-border p-0.5">
          <button
            type="button"
            onClick={() => setSelectedSeverity("")}
            className={cn(
              "h-7 shrink-0 rounded px-2 text-xs font-medium whitespace-nowrap",
              selectedSeverity === ""
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            All
          </button>
          {SEVERITIES.map((sev) => (
            <button
              key={sev}
              type="button"
              onClick={() =>
                setSelectedSeverity(selectedSeverity === sev ? "" : sev)
              }
              className={cn(
                "h-7 shrink-0 rounded px-2 text-xs font-medium capitalize whitespace-nowrap",
                selectedSeverity === sev
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {sev}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {result.entries.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-muted-foreground">
            No log lines match these filters.
          </p>
        ) : (
          result.entries.map((entry) => (
            <div
              key={entry.id}
              className="grid grid-cols-[72px_52px_140px_minmax(0,1fr)] items-start gap-x-3 border-b border-border px-4 py-2 hover:bg-white/[0.03]"
            >
              <time className="pt-0.5 font-mono text-xs tabular-nums text-muted-foreground">
                {format(new Date(entry.timestamp), "HH:mm:ss")}
              </time>
              <Badge
                variant={severityVariant(entry.severity)}
                className="w-[52px] justify-center px-0 text-[11px] uppercase"
              >
                {entry.severity}
              </Badge>
              <span className="truncate pt-0.5 text-xs text-muted-foreground">
                {entry.service}
              </span>
              <p className="min-w-0 break-words font-mono text-xs leading-5 text-foreground">
                {entry.message}
              </p>
            </div>
          ))
        )}
        {result.totalMatches > limit && (
          <div className="px-4 py-3">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => setLimit((l) => l + 100)}
            >
              Load more
            </Button>
          </div>
        )}
      </div>
    </Panel>
  );
}
