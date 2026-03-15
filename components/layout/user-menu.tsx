"use client";

import * as React from "react";
import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";

export function UserMenu(props: { name?: string | null; email?: string | null }) {
  const { name, email } = props;
  const [isSigningOut, setIsSigningOut] = React.useState(false);

  async function onSignOut() {
    setIsSigningOut(true);
    await signOut({ callbackUrl: "/login" });
  }

  return (
    <div className="flex items-center gap-3">
      <div className="hidden text-right sm:block">
        <p className="text-sm font-medium leading-5 text-zinc-950 dark:text-zinc-50">
          {name || "User"}
        </p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">{email}</p>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onSignOut}
        disabled={isSigningOut}
      >
        <LogOut className="h-4 w-4" />
        <span className="hidden sm:inline">{isSigningOut ? "Signing out…" : "Sign out"}</span>
      </Button>
    </div>
  );
}

