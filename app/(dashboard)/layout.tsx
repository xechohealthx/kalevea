import * as React from "react";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/shell";
import { UserMenu } from "@/components/layout/user-menu";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  return (
    <AppShell
      header={
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
              Kalevea Core
            </div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              Multi-tenant operations backbone (foundation)
            </div>
          </div>
          <UserMenu name={session.user.name} email={session.user.email} />
        </div>
      }
    >
      {children}
    </AppShell>
  );
}

