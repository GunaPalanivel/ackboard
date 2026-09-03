import { useEffect, useRef, useState } from "react";
import { ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { setConfirmHandler } from "@/webmcp/register-tools";
import type { ConfirmRequest } from "@/webmcp/register-tools";

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
        settle(false);
      }
    );
    return () => setConfirmHandler(null, null);
  }, []);

  function settle(value: boolean) {
    const pending = pendingRef.current;
    if (!pending) return;
    pendingRef.current = null;
    pending.resolve(value);
    setRequest(null);
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!pendingRef.current) return;
      if (e.key === "Enter") {
        e.preventDefault();
        settle(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const req = request?.req;
  const isDestructive = req?.variant === "destructive";

  return (
    <Dialog
      open={request !== null}
      onOpenChange={(open) => {
        if (!open) settle(false);
      }}
    >
      <DialogContent aria-labelledby="ackboard-confirm-title">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div
              className={`rounded-full border p-2 ${
                isDestructive
                  ? "border-red-500/40 bg-red-500/10 text-red-400"
                  : req?.variant === "warning"
                  ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
                  : "border-blue-500/40 bg-blue-500/10 text-blue-400"
              }`}
            >
              <ShieldCheck className="size-5" />
            </div>
            <DialogTitle id="ackboard-confirm-title">
              {req?.title ?? "Confirm"}
            </DialogTitle>
          </div>
          <DialogDescription className="text-base text-foreground pt-1">
            {req?.message}
          </DialogDescription>
        </DialogHeader>

        {req?.details && (
          <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-md border border-border bg-background p-3 font-mono text-xs text-muted-foreground">
            {req.details}
          </pre>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => settle(false)}>
            Decline
          </Button>
          <Button
            type="button"
            variant={isDestructive ? "destructive" : "default"}
            onClick={() => settle(true)}
          >
            Approve
          </Button>
        </DialogFooter>

        <p className="text-center text-xs text-muted-foreground">
          Enter to approve, Escape to decline
        </p>
      </DialogContent>
    </Dialog>
  );
}
