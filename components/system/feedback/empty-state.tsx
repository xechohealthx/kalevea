import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type EmptyStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({ title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-dashed border-zinc-300 px-5 py-8 text-center dark:border-zinc-700",
        className,
      )}
    >
      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{title}</p>
      {description ? <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{description}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
