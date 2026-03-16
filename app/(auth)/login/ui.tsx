"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

type FormValues = z.infer<typeof schema>;
const isDevelopment = process.env.NODE_ENV === "development";

const demoAccounts = [
  { label: "Super Admin", email: "superadmin@kalevea.local" },
  { label: "MSO Executive", email: "exec@kalevea.local" },
  { label: "Implementation", email: "impl@kalevea.local" },
  { label: "Support", email: "support@kalevea.local" },
  { label: "Billing", email: "billing@kalevea.local" },
  { label: "Compliance", email: "compliance@kalevea.local" },
  { label: "Clinic Admin (Northside)", email: "clinicadmin@northside.local" },
  { label: "Provider (Lakeshore)", email: "provider@lakeshore.local" },
  { label: "Read Only (Riverside)", email: "readonly@riverside.local" },
] as const;

const authErrorMessages: Record<string, string> = {
  ACCESS_PENDING: "Your account is pending activation. Please contact an administrator.",
  NO_WORKSPACE_ACCESS: "No workspace access is configured for your account. Contact an administrator.",
  ACCOUNT_INACTIVE: "Your account is inactive. Contact an administrator.",
  AUTH_EMAIL_REQUIRED: "Your identity provider did not return an email address.",
  INVITE_REVOKED: "Your invite has been revoked. Please contact an administrator.",
};

export function LoginForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const next = searchParams.get("next") || "/dashboard";
  const authErrorCode = searchParams.get("error");

  const [error, setError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: FormValues) {
    setError(null);
    setIsSubmitting(true);

    const res = await signIn("credentials", {
      email: values.email,
      password: values.password,
      redirect: false,
      callbackUrl: next,
    });

    setIsSubmitting(false);

    if (!res?.ok) {
      setError("Invalid email or password.");
      return;
    }

    router.replace(res.url ?? next);
  }

  function fillDemo(email: string) {
    form.setValue("email", email, { shouldValidate: true });
    form.setValue("password", "password", { shouldValidate: true });
  }

  return (
    <div className="space-y-6">
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" {...form.register("email")} />
          {form.formState.errors.email?.message ? (
            <p className="text-sm text-red-600">{form.formState.errors.email.message}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            {...form.register("password")}
          />
          {form.formState.errors.password?.message ? (
            <p className="text-sm text-red-600">{form.formState.errors.password.message}</p>
          ) : null}
        </div>

        {authErrorCode && authErrorMessages[authErrorCode] ? (
          <p className="text-sm text-amber-700 dark:text-amber-300">
            {authErrorMessages[authErrorCode]}
          </p>
        ) : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      {isDevelopment ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Demo accounts (password: <span className="font-mono">password</span>)
          </p>
          <div className="flex flex-wrap gap-2">
            {demoAccounts.map((a) => (
              <Button
                key={a.email}
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => fillDemo(a.email)}
              >
                {a.label}
              </Button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

