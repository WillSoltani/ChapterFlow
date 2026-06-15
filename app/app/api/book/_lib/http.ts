import { NextResponse } from "next/server";
import { AuthError } from "@/app/app/api/_lib/auth";
import { BookApiError, isBookApiError } from "./errors";

type ErrorEnvelope = {
  error: {
    code: string;
    message: string;
    requestId: string;
    details?: unknown;
  };
};

function requestIdFromHeaders(req: Request): string {
  return req.headers.get("x-amzn-trace-id") || crypto.randomUUID();
}

export function bookOk<T>(data: T, init?: number | ResponseInit): NextResponse<T> {
  const resInit = typeof init === "number" ? { status: init } : init;
  return NextResponse.json(data, resInit);
}

export function bookErr(
  req: Request,
  status: number,
  code: string,
  message: string,
  details?: unknown,
  requestId?: string
): NextResponse<ErrorEnvelope> {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        requestId: requestId ?? requestIdFromHeaders(req),
        details,
      },
    },
    { status }
  );
}

/**
 * Fire-and-forget hook to surface unexpected server errors to an external
 * monitor. We reuse the established `ChapterFlow/Ops` CloudWatch metric path
 * (`putOpsMetric`) so the existing OpsFailure alarm fires on unhandled API
 * errors instead of relying on raw CloudWatch log scraping. Imported lazily so
 * the AWS-SDK / `server-only` cost is only paid on the (rare) error path and
 * never blocks the response. Swallows its own failures.
 */
function reportUnhandledError(name: string): void {
  void import("./cloudwatch-metrics")
    .then(({ putOpsMetric }) =>
      putOpsMetric("OpsFailure", 1, { context: "book_api_unhandled_error", error: name })
    )
    .catch(() => {
      /* monitoring must never break the request */
    });
}

export async function withBookApiErrors<T>(
  req: Request,
  fn: () => Promise<NextResponse<T | ErrorEnvelope>>
): Promise<NextResponse<T | ErrorEnvelope>> {
  // Compute the correlation id once so the logged line and the client envelope
  // carry the SAME requestId — needed to tie a user's 500 to its log entry.
  const requestId = requestIdFromHeaders(req);
  try {
    return await fn();
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return bookErr(req, 401, "unauthenticated", "Authentication is required.", undefined, requestId);
    }
    if (isBookApiError(error)) {
      return bookErr(req, error.status, error.code, error.message, error.details, requestId);
    }

    const name = error instanceof Error ? error.name : "UnknownError";
    const message = error instanceof Error ? error.message : String(error);
    // Cap the message so a runaway error string can't bloat the log line, and
    // never log the full stack in production: stacks can incidentally surface
    // identifiers, and CloudWatch is for correlation, not forensic dumps. In
    // non-production we keep the stack to aid local/staging debugging.
    const shortMessage = message.length > 300 ? `${message.slice(0, 300)}…` : message;
    if (process.env.NODE_ENV === "production") {
      console.error("book_api_unhandled_error", { name, message: shortMessage, requestId });
      reportUnhandledError(name);
    } else {
      console.error("book_api_unhandled_error", {
        name,
        message: shortMessage,
        requestId,
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
    return bookErr(req, 500, "server_error", "An unexpected server error occurred.", undefined, requestId);
  }
}

export function requireBodyObject(reqBody: unknown): Record<string, unknown> {
  if (!reqBody || typeof reqBody !== "object" || Array.isArray(reqBody)) {
    throw new BookApiError(400, "invalid_json", "Request body must be a JSON object.");
  }
  return reqBody as Record<string, unknown>;
}

export function requireString(
  value: unknown,
  field: string,
  opts?: { minLength?: number; maxLength?: number }
): string {
  if (typeof value !== "string") {
    throw new BookApiError(400, "invalid_input", `${field} must be a string.`);
  }
  const trimmed = value.trim();
  const minLength = opts?.minLength ?? 1;
  const maxLength = opts?.maxLength ?? 5000;
  if (trimmed.length < minLength) {
    throw new BookApiError(400, "invalid_input", `${field} is required.`);
  }
  if (trimmed.length > maxLength) {
    throw new BookApiError(400, "invalid_input", `${field} is too long.`);
  }
  return trimmed;
}

export function requireInteger(
  value: unknown,
  field: string,
  opts?: { min?: number; max?: number }
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new BookApiError(400, "invalid_input", `${field} must be a number.`);
  }
  const intVal = Math.floor(value);
  if (value !== intVal) {
    throw new BookApiError(400, "invalid_input", `${field} must be an integer.`);
  }
  const min = opts?.min ?? Number.MIN_SAFE_INTEGER;
  const max = opts?.max ?? Number.MAX_SAFE_INTEGER;
  if (intVal < min || intVal > max) {
    throw new BookApiError(
      400,
      "invalid_input",
      `${field} must be between ${min} and ${max}.`
    );
  }
  return intVal;
}
