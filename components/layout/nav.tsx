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

