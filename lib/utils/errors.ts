export type AppErrorCode =
  | "UNAUTHENTICATED"
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "CONFLICT"
  | "INTERNAL";

export class AppError extends Error {
  code: AppErrorCode;
  status: number;
  details?: unknown;

  constructor(message: string, code: AppErrorCode, status: number, details?: unknown) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}

export function toAppError(err: unknown): AppError {
  if (isAppError(err)) return err;
  if (err instanceof Error) return new AppError(err.message, "INTERNAL", 500);
  return new AppError("Unknown error", "INTERNAL", 500);
}

