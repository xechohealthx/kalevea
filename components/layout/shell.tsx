import * as React from "react";
import { Command, Menu, PanelLeft, Search, Sparkles } from "lucide-react";

import { SidebarNav } from "@/components/layout/nav";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

function SidebarContent() {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-white/10 px-5 py-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.28em] text-zinc-500">
              Kalevea
            </div>
            <div className="mt-2 text-lg font-semibold tracking-tight text-white">
              Operations System
            </div>
            <div className="mt-1 text-sm text-zinc-400">
              MSO network workspace
            </div>
          </div>
          <div className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 text-[11px] font-medium text-cyan-200">
            Network
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4">
        <div className="mb-3 px-3 text-[11px] font-medium uppercase tracking-[0.24em] text-zinc-500">
          Workspaces
        </div>
        <SidebarNav />
      </div>

      <div className="border-t border-white/10 p-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-white">
            <Sparkles className="h-4 w-4 text-cyan-300" />
            Command layer ready
          </div>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Search workspaces, jump to records, and start workflows from one surface.
          </p>
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-zinc-400">
            <Command className="h-3.5 w-3.5" />
            <span>Press</span>
            <span className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[11px] text-zinc-300">
              Cmd K
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function CommandBar() {
  return (
    <div className="flex items-center gap-3">
      <div className="hidden lg:block">
        <div className="text-[11px] font-medium uppercase tracking-[0.24em] text-zinc-500">
          Global command bar
        </div>
        <div className="mt-1 flex items-center gap-2 text-sm text-zinc-300">
          <PanelLeft className="h-4 w-4 text-zinc-500" />
          <span>Search, navigate, and triage without leaving context.</span>
        </div>
      </div>
      <Button
        type="button"
        variant="outline"
        className="h-11 w-full justify-between rounded-2xl border-white/10 bg-white/[0.04] px-4 text-zinc-300 hover:bg-white/[0.08] hover:text-white dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-300 dark:hover:bg-white/[0.08] dark:hover:text-white lg:max-w-md"
      >
        <span className="flex items-center gap-3">
          <Search className="h-4 w-4 text-zinc-500" />
          <span className="text-sm">Search clinics, providers, tickets, documents...</span>
        </span>
        <span className="hidden items-center gap-1 rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-[11px] text-zinc-400 sm:flex">
          <Command className="h-3 w-3" />
          K
        </span>
      </Button>
    </div>
  );
}

export function AppShell({
  header,
  children,
}: {
  header: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="dark min-h-screen bg-[#06080d] text-zinc-50">
      <div className="flex min-h-screen">
        <aside className="hidden w-[296px] shrink-0 border-r border-white/10 bg-[#0a0d14] xl:block">
          <SidebarContent />
        </aside>

        <div className="relative flex min-w-0 flex-1 flex-col">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.12),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(59,130,246,0.10),_transparent_24%)]" />

          <header className="sticky top-0 z-40 border-b border-white/10 bg-[#06080d]/90 backdrop-blur-xl">
            <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3 sm:px-6">
              <Sheet>
                <SheetTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="border-white/10 bg-white/[0.04] text-zinc-200 hover:bg-white/[0.08] hover:text-white xl:hidden"
                  >
                    <Menu className="h-5 w-5" />
                    <span className="sr-only">Open navigation</span>
                  </Button>
                </SheetTrigger>
                <SheetContent
                  side="left"
                  className="w-[300px] border-r border-white/10 bg-[#0a0d14] p-0 text-zinc-50"
                >
                  <SheetHeader className="sr-only">
                    <SheetTitle>Navigation</SheetTitle>
                    <SheetDescription>Kalevea workspaces and utilities.</SheetDescription>
                  </SheetHeader>
                  <SidebarContent />
                </SheetContent>
              </Sheet>

              <div className="min-w-0 flex-1">
                <CommandBar />
              </div>
            </div>

            <div className="px-4 py-4 sm:px-6">{header}</div>
          </header>

          <main className="relative flex-1 px-4 py-4 sm:px-6 sm:py-6">
            <div className="mx-auto w-full max-w-[1440px]">
              <div className="min-h-[calc(100vh-11rem)] rounded-[28px] border border-white/10 bg-white/[0.03] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.28)] ring-1 ring-white/5 sm:p-6">
                {children}
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
