type LogLevel = "info" | "warn" | "error";

type LogMeta = Record<string, unknown>;

const PHI_KEYS = [
  "firstName",
  "lastName",
  "dob",
  "dateOfBirth",
  "ssn",
  "mrn",
  "email",
  "phone",
  "address",
  "patient",
  "diagnosis",
];

function sanitizeMeta(meta?: LogMeta): LogMeta | undefined {
  if (!meta) return undefined;
  const entries = Object.entries(meta).map(([key, value]) => {
    const shouldRedact = PHI_KEYS.some((phi) => key.toLowerCase().includes(phi.toLowerCase()));
    return [key, shouldRedact ? "[REDACTED]" : value];
  });
  return Object.fromEntries(entries);
}

function write(level: LogLevel, message: string, meta?: LogMeta) {
  const payload = {
    ts: new Date().toISOString(),
    level,
    message,
    meta: sanitizeMeta(meta),
  };

  if (level === "error") {
    console.error(JSON.stringify(payload));
    return;
  }

  if (level === "warn") {
    console.warn(JSON.stringify(payload));
    return;
  }

  console.info(JSON.stringify(payload));
}

export const logger = {
  info: (message: string, meta?: LogMeta) => write("info", message, meta),
  warn: (message: string, meta?: LogMeta) => write("warn", message, meta),
  error: (message: string, meta?: LogMeta) => write("error", message, meta),
};
