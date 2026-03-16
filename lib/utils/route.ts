import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { logger } from "@/lib/logger";
import { AppError, toAppError } from "@/lib/utils/errors";

export async function withRouteErrorHandling<T>(fn: () => Promise<T>) {
  try {
    const data = await fn();
    return NextResponse.json({ data });
  } catch (err) {
    if (err instanceof ZodError) {
      logger.warn("Route validation error", { code: "VALIDATION_ERROR" });
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Validation error",
            details: err.flatten(),
          },
        },
        { status: 400 },
      );
    }

    const appErr = toAppError(err);
    if (appErr.code === "INTERNAL") {
      logger.error("Route handler failed", { code: appErr.code, status: appErr.status });
    } else {
      logger.warn("Route request failed", { code: appErr.code, status: appErr.status });
    }
    const payload = {
      error: {
        code: appErr.code,
        message: appErr.message,
        details: appErr.details,
      },
    };
    return NextResponse.json(payload, { status: appErr.status });
  }
}

export function ok<T>(data: T) {
  return NextResponse.json({ data });
}

export function created<T>(data: T) {
  return NextResponse.json({ data }, { status: 201 });
}

export function fail(err: AppError) {
  return NextResponse.json(
    { error: { code: err.code, message: err.message, details: err.details } },
    { status: err.status },
  );
}

