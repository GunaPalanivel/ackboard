import * as React from 'react';

import { cn } from '@/lib/utils';

const inputClass = cn(
  'h-8 w-full rounded-md border border-border bg-background px-2.5',
  'text-[13px] text-foreground placeholder:text-muted-foreground',
  'outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring',
  'disabled:cursor-not-allowed disabled:opacity-50',
);

function Input({
  className,
  leading,
  ...props
}: React.ComponentProps<'input'> & { leading?: React.ReactNode }) {
  if (leading) {
    return (
      <div className="relative min-w-0 flex-1">
        <span className="pointer-events-none absolute inset-y-0 left-0 flex w-9 items-center justify-center text-muted-foreground">
          {leading}
        </span>
        <input data-slot="input" className={cn(inputClass, 'pl-9', className)} {...props} />
      </div>
    );
  }

  return <input data-slot="input" className={cn(inputClass, className)} {...props} />;
}

export { Input };
