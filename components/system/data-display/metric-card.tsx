import type { ReactNode } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { StatusBadge, type StatusTone } from "@/components/system/data-display/status-badge";

export type MetricCardProps = {
  label: string;
  value: ReactNode;
  supportingText?: string;
  trendLabel?: string;
  trendTone?: StatusTone;
  actionSlot?: ReactNode;
  className?: string;
};

export function MetricCard({
  label,
  value,
  supportingText,
  trendLabel,
  trendTone = "neutral",
  actionSlot,
  className,
}: MetricCardProps) {
  return (
    <Card className={cn("rounded-2xl", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-medium text-zinc-600 dark:text-zinc-400">{label}</CardTitle>
          {actionSlot}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="text-3xl font-semibold leading-none tracking-tight">{value}</div>
        <div className="flex min-h-5 items-center gap-2">
          {trendLabel ? <StatusBadge label={trendLabel} tone={trendTone} /> : null}
          {supportingText ? <p className="text-xs text-zinc-500 dark:text-zinc-400">{supportingText}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}
