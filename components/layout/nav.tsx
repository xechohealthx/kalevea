"use client";

import type * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Hospital,
  ClipboardList,
  Users,
  LifeBuoy,
  GraduationCap,
  Files,
  ClipboardCheck,
  Receipt,
  LineChart,
  FileSearch,
  BarChart3,
  Scale,
  Zap,
  Bot,
  ShieldCheck,
  Settings,
} from "lucide-react";

import { cn } from "@/lib/utils";

type Item = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const items: Item[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clinics", label: "Clinics", icon: Hospital },
  { href: "/onboarding", label: "Onboarding", icon: ClipboardList },
  { href: "/providers", label: "Providers & Staff", icon: Users },
  { href: "/support", label: "Support", icon: LifeBuoy },
  { href: "/training", label: "Training", icon: GraduationCap },
  { href: "/documents", label: "Documents", icon: Files },
  { href: "/prior-auth", label: "Prior Auth", icon: ClipboardCheck },
  { href: "/buy-and-bill", label: "Buy & Bill", icon: Receipt },
  { href: "/reimbursement", label: "Reimbursement", icon: LineChart },
  { href: "/era", label: "ERA", icon: FileSearch },
  { href: "/analytics/reimbursement", label: "Analytics", icon: BarChart3 },
  { href: "/analytics/predictive", label: "Predictive", icon: BarChart3 },
  { href: "/analytics/revenue", label: "Revenue", icon: LineChart },
  { href: "/analytics/network", label: "Benchmarks", icon: BarChart3 },
  { href: "/command-center", label: "Command Center", icon: LayoutDashboard },
  { href: "/automation", label: "Automation", icon: Zap },
  { href: "/kal", label: "Kal Assistant", icon: Bot },
  { href: "/payer-rules", label: "Payer Rules", icon: Scale },
  { href: "/rems", label: "REMS", icon: ShieldCheck },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="space-y-1">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900",
              active &&
                "bg-zinc-100 text-zinc-950 dark:bg-zinc-900 dark:text-zinc-50",
            )}
          >
            <Icon className="h-4 w-4" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

