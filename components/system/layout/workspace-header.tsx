import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

type WorkspaceHeaderProps = {
  title: string;
  description?: string;
  scopeLabel?: string;
  actions?: ReactNode;
  meta?: ReactNode;
  className?: string;
};

export function WorkspaceHeader({
  title,
  description,
  scopeLabel,
  actions,
  meta,
  className,
}: WorkspaceHeaderProps) {
  return (
    <header className={cn("flex flex-col gap-3 md:flex-row md:items-start md:justify-between", className)}>
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {scopeLabel ? (
            <Badge variant="outline" className="text-[11px] uppercase tracking-wide">
              {scopeLabel}
            </Badge>
          ) : null}
        </div>
        {description ? <p className="text-sm text-zinc-600 dark:text-zinc-400">{description}</p> : null}
        {meta ? <div className="text-xs text-zinc-500 dark:text-zinc-400">{meta}</div> : null}
      </div>

      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
