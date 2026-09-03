import { cn } from "@/lib/utils";

function ProgressBar({
  value,
  max = 100,
  className,
  barClassName,
}: {
  value: number;
  max?: number;
  className?: string;
  barClassName?: string;
}) {
  const pct = Math.max(0, Math.min(100, max === 0 ? 0 : (value / max) * 100));
  return (
    <div
      role="progressbar"
      aria-valuenow={Number(pct.toFixed(1))}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn(
        "h-1.5 w-full overflow-hidden rounded-full bg-muted",
        className
      )}
    >
      <div
        className={cn(
          "h-full rounded-full bg-primary transition-[width] duration-300",
          barClassName
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export { ProgressBar };
