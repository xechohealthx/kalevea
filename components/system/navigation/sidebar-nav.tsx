"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type SidebarNavItem = {
  href: string;
  label: string;
  icon?: LucideIcon;
  badge?: string | number;
  exact?: boolean;
};

type SidebarNavProps = {
  items: SidebarNavItem[];
  className?: string;
  itemClassName?: string;
};

function isActivePath(pathname: string, item: SidebarNavItem) {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(item.href + "/");
}

export function SidebarNav({ items, className, itemClassName }: SidebarNavProps) {
  const pathname = usePathname();

  return (
    <nav className={cn("space-y-1", className)} aria-label="Primary">
      {items.map((item) => {
        const active = isActivePath(pathname, item);
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              "text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-zinc-50",
              active && "bg-zinc-100 text-zinc-950 dark:bg-zinc-900 dark:text-zinc-50",
              itemClassName,
            )}
          >
            {Icon ? (
              <Icon className={cn("h-4 w-4 shrink-0", active ? "opacity-100" : "opacity-80")} aria-hidden />
            ) : null}
            <span className="truncate">{item.label}</span>
            {item.badge !== undefined && item.badge !== null ? (
              <span className="ml-auto rounded-full border border-zinc-200 px-2 py-0.5 text-[11px] tabular-nums text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
                {item.badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
