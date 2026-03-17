import { redirect } from "next/navigation";

import { auth } from "@/lib/auth/server";
import { env } from "@/lib/env";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "./ui";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user?.id) redirect("/dashboard");
  const isDevelopment = process.env.NODE_ENV === "development";

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Kalevea</CardTitle>
        <CardDescription>
          {env.AUTH_PROVIDER_MODE === "email"
            ? "Sign in to the Kalevea Core platform using a secure email magic link."
            : isDevelopment
              ? "Sign in to the Kalevea Core platform (development auth enabled)."
              : "Sign in to the Kalevea Core platform."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <LoginForm authProviderMode={env.AUTH_PROVIDER_MODE} />
      </CardContent>
    </Card>
  );
}

