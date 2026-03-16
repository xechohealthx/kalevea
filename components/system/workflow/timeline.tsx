import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type TimelineItem = {
  id: string;
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
};

export type TimelineProps = {
  items: TimelineItem[];
  emptyState?: ReactNode;
  className?: string;
};

export function Timeline({ items, emptyState, className }: TimelineProps) {
  if (items.length === 0) {
    return emptyState ? <>{emptyState}</> : null;
  }

  return (
    <ol className={cn("space-y-4", className)}>
      {items.map((item) => (
        <li key={item.id} className="relative pl-5">
          <span
            aria-hidden="true"
            className="absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full bg-zinc-400 dark:bg-zinc-500"
          />
          <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
            <div className="flex items-start justify-between gap-3">
              <div className="text-sm font-medium">{item.title}</div>
              {item.meta ? (
                <div className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">{item.meta}</div>
              ) : null}
            </div>
            {item.description ? (
              <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{item.description}</div>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
