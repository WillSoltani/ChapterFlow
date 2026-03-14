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
  details?: unknown
): NextResponse<ErrorEnvelope> {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        requestId: requestIdFromHeaders(req),
        details,
      },
    },
    { status }
  );
}

export async function withBookApiErrors<T>(
  req: Request,
  fn: () => Promise<NextResponse<T | ErrorEnvelope>>
): Promise<NextResponse<T | ErrorEnvelope>> {
  try {
    return await fn();
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return bookErr(req, 401, "unauthenticated", "Authentication is required.");
    }
    if (isBookApiError(error)) {
      return bookErr(req, error.status, error.code, error.message, error.details);
    }

    console.error("book_api_unhandled_error", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return bookErr(req, 500, "server_error", "An unexpected server error occurred.");
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
