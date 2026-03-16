import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type AppShellProps = {
  sidebar: ReactNode;
  children: ReactNode;
  topbar?: ReactNode;
  contextPanel?: ReactNode;
  className?: string;
  mainClassName?: string;
  contentClassName?: string;
};

export function AppShell({
  sidebar,
  children,
  topbar,
  contextPanel,
  className,
  mainClassName,
  contentClassName,
}: AppShellProps) {
  return (
    <div
      className={cn(
        "min-h-screen bg-zinc-50 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50",
        className,
      )}
    >
      <div className="mx-auto grid min-h-screen w-full max-w-[1800px] grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="border-r border-zinc-200/80 bg-white/90 px-4 py-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
          {sidebar}
        </aside>

        <div className={cn("flex min-h-screen min-w-0 flex-col", mainClassName)}>
          {topbar ? (
            <header className="sticky top-0 z-30 border-b border-zinc-200/80 bg-white/95 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
              {topbar}
            </header>
          ) : null}

          <div className={cn("grid min-h-0 flex-1 grid-cols-1", contextPanel && "xl:grid-cols-[minmax(0,1fr)_360px]")}>
            <main className={cn("min-w-0 px-6 py-6", contentClassName)}>{children}</main>

            {contextPanel ? (
              <aside className="border-l border-zinc-200/80 bg-white/80 px-4 py-6 dark:border-zinc-800 dark:bg-zinc-950/60">
                {contextPanel}
              </aside>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
