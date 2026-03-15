import * as React from "react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <div className="mx-auto flex min-h-screen w-full max-w-md items-center px-6 py-12">
        {children}
      </div>
    </div>
  );
}

