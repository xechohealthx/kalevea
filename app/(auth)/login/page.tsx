import { redirect } from "next/navigation";

import { auth } from "@/lib/auth/server";
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
          {isDevelopment
            ? "Sign in to the Kalevea Core platform (development auth enabled)."
            : "Sign in to the Kalevea Core platform."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <LoginForm />
      </CardContent>
    </Card>
  );
}

