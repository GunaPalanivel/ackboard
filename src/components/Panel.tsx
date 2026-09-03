import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

interface PanelProps {
  id?: string;
  title: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}

export default function Panel({
  id,
  title,
  actions,
  children,
  className,
  bodyClassName,
}: PanelProps) {
  return (
    <section
      id={id}
      className={cn(
        'flex h-full min-h-0 flex-col rounded-lg border border-border bg-card',
        className,
      )}
    >
      <header className="flex h-11 shrink-0 items-center gap-3 border-b border-border px-4">
        <h2 className="shrink-0 text-sm font-medium text-foreground">{title}</h2>
        {actions ? (
          <div className="ml-auto flex min-w-0 items-center justify-end gap-2">{actions}</div>
        ) : null}
      </header>
      <div className={cn('min-h-0 flex-1', bodyClassName)}>{children}</div>
    </section>
  );
}
