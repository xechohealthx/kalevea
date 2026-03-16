import { Badge } from "@/components/ui/badge";
import type { BadgeProps } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type StatusTone =
  | "default"
  | "neutral"
  | "success"
  | "warning"
  | "danger"
  | "info";

export type StatusBadgeProps = {
  label: string;
  tone?: StatusTone;
  className?: string;
  title?: string;
};

function toneToVariant(tone: StatusTone): BadgeProps["variant"] {
  if (tone === "neutral") return "outline";
  if (tone === "success") return "success";
  if (tone === "warning") return "warning";
  if (tone === "danger") return "danger";
  if (tone === "info") return "secondary";
  return "default";
}

export function StatusBadge({ label, tone = "default", className, title }: StatusBadgeProps) {
  return (
    <Badge
      variant={toneToVariant(tone)}
      className={cn("rounded-full text-[11px] font-medium tracking-wide", className)}
      title={title}
    >
      {label}
    </Badge>
  );
}
