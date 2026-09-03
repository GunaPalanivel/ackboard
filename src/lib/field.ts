import { cn } from '@/lib/utils';

export const nativeControlClass = cn(
  'h-8 rounded-md border border-border bg-background px-2.5',
  'text-[13px] text-foreground outline-none',
  'focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring',
);
