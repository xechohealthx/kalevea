import * as React from "react";

import { SidebarNav } from "@/components/layout/nav";

export function AppShell({
  header,
  children,
}: {
  header: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <div className="mx-auto flex min-h-screen w-full max-w-[1400px]">
        <aside className="hidden w-64 shrink-0 border-r border-zinc-200 bg-white px-4 py-6 dark:border-zinc-800 dark:bg-zinc-950 md:block">
          <div className="mb-6">
            <div className="text-sm font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
              Kalevea
            </div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              MSO Operations Platform
            </div>
          </div>
          <SidebarNav />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/80 px-6 py-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/70">
            {header}
          </header>
          <main className="flex-1 px-6 py-6">{children}</main>
        </div>
      </div>
    </div>
  );
}

