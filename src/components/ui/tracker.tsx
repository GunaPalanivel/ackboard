import { cn } from "@/lib/utils";

type Tone = "ok" | "warn" | "bad";

function Tracker({
  value,
  blocks = 12,
  tone = "ok",
  className,
}: {
  value: number;
  blocks?: number;
  tone?: Tone;
  className?: string;
}) {
  const filled = Math.round((Math.max(0, Math.min(100, value)) / 100) * blocks);
  const fill =
    tone === "bad"
      ? "bg-red-500"
      : tone === "warn"
      ? "bg-amber-400"
      : "bg-emerald-500";
  return (
    <div className={cn("flex gap-px", className)} aria-hidden="true">
      {Array.from({ length: blocks }, (_, i) => (
        <span
          key={i}
          className={cn(
            "h-1.5 flex-1 rounded-[1px]",
            i < filled ? fill : "bg-slate-800"
          )}
        />
      ))}
    </div>
  );
}

export { Tracker };
