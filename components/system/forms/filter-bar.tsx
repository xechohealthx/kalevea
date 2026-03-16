import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type FilterBarProps = {
  left?: ReactNode;
  right?: ReactNode;
  className?: string;
};

export function FilterBar({ left, right, className }: FilterBarProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-zinc-200 bg-zinc-50/50 px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-900/40 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2">{left}</div>
      <div className="flex flex-wrap items-center gap-2">{right}</div>
    </div>
  );
}
