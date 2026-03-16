import type { ReactNode } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type EntityPanelProps = {
  title: string;
  subtitle?: ReactNode;
  actionSlot?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
};

export function EntityPanel({
  title,
  subtitle,
  actionSlot,
  children,
  className,
  contentClassName,
}: EntityPanelProps) {
  return (
    <Card className={cn("rounded-2xl", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-base">{title}</CardTitle>
            {subtitle ? <p className="text-sm text-zinc-600 dark:text-zinc-400">{subtitle}</p> : null}
          </div>
          {actionSlot ? <div className="shrink-0">{actionSlot}</div> : null}
        </div>
      </CardHeader>
      <CardContent className={cn("space-y-3", contentClassName)}>{children}</CardContent>
    </Card>
  );
}
