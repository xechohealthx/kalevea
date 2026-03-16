import "server-only";

import { z } from "zod";

const authProviderModeSchema = z.enum([
  "development_credentials",
  "email",
  "google",
  "oidc",
]);

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
    NEXTAUTH_SECRET: z.string().min(1, "NEXTAUTH_SECRET is required"),
    NEXTAUTH_URL: z.string().url("NEXTAUTH_URL must be a valid URL"),
    AUTH_PROVIDER_MODE: authProviderModeSchema.optional(),
    AUTH_EMAIL_FROM: z.string().email().optional(),
    AUTH_EMAIL_SERVER: z.string().min(1).optional(),
    AUTH_GOOGLE_CLIENT_ID: z.string().min(1).optional(),
    AUTH_GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
    AUTH_OIDC_CLIENT_ID: z.string().min(1).optional(),
    AUTH_OIDC_CLIENT_SECRET: z.string().min(1).optional(),
    AUTH_OIDC_ISSUER: z.string().url().optional(),
    AUTH_OIDC_WELL_KNOWN: z.string().url().optional(),
    S3_BUCKET: z.string().min(1, "S3_BUCKET is required"),
    S3_REGION: z.string().min(1, "S3_REGION is required"),
    AWS_ACCESS_KEY_ID: z.string().min(1, "AWS_ACCESS_KEY_ID is required"),
    AWS_SECRET_ACCESS_KEY: z.string().min(1, "AWS_SECRET_ACCESS_KEY is required"),
    OPENAI_API_KEY: z.string().min(1).optional(),
    OPENAI_MODEL: z.string().min(1).optional(),
  })
  .superRefine((input, ctx) => {
    const resolvedMode =
      input.AUTH_PROVIDER_MODE ?? (input.NODE_ENV === "development" ? "development_credentials" : undefined);

    if (!resolvedMode) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["AUTH_PROVIDER_MODE"],
        message: "AUTH_PROVIDER_MODE is required outside development",
      });
      return;
    }

    if (resolvedMode === "development_credentials" && input.NODE_ENV !== "development") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["AUTH_PROVIDER_MODE"],
        message: "development_credentials mode can only run in development",
      });
    }

    if (resolvedMode === "email") {
      if (!input.AUTH_EMAIL_FROM) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["AUTH_EMAIL_FROM"],
          message: "AUTH_EMAIL_FROM is required when AUTH_PROVIDER_MODE=email",
        });
      }
      if (!input.AUTH_EMAIL_SERVER) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["AUTH_EMAIL_SERVER"],
          message: "AUTH_EMAIL_SERVER is required when AUTH_PROVIDER_MODE=email",
        });
      }
    }

    if (resolvedMode === "google") {
      if (!input.AUTH_GOOGLE_CLIENT_ID) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["AUTH_GOOGLE_CLIENT_ID"],
          message: "AUTH_GOOGLE_CLIENT_ID is required when AUTH_PROVIDER_MODE=google",
        });
      }
      if (!input.AUTH_GOOGLE_CLIENT_SECRET) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["AUTH_GOOGLE_CLIENT_SECRET"],
          message: "AUTH_GOOGLE_CLIENT_SECRET is required when AUTH_PROVIDER_MODE=google",
        });
      }
    }

    if (resolvedMode === "oidc") {
      if (!input.AUTH_OIDC_CLIENT_ID) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["AUTH_OIDC_CLIENT_ID"],
          message: "AUTH_OIDC_CLIENT_ID is required when AUTH_PROVIDER_MODE=oidc",
        });
      }
      if (!input.AUTH_OIDC_CLIENT_SECRET) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["AUTH_OIDC_CLIENT_SECRET"],
          message: "AUTH_OIDC_CLIENT_SECRET is required when AUTH_PROVIDER_MODE=oidc",
        });
      }
      if (!input.AUTH_OIDC_ISSUER && !input.AUTH_OIDC_WELL_KNOWN) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["AUTH_OIDC_ISSUER"],
          message: "AUTH_OIDC_ISSUER or AUTH_OIDC_WELL_KNOWN is required when AUTH_PROVIDER_MODE=oidc",
        });
      }
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.flatten().fieldErrors;
  throw new Error(`Invalid environment configuration: ${JSON.stringify(details)}`);
}

export const env = {
  ...parsed.data,
  AUTH_PROVIDER_MODE:
    parsed.data.AUTH_PROVIDER_MODE ??
    (parsed.data.NODE_ENV === "development" ? "development_credentials" : "email"),
};
