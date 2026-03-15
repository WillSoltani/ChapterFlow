"use client";

export class BookClientError extends Error {
  status: number;
  code?: string;
  details?: unknown;

  constructor(message: string, status = 500, code?: string, details?: unknown) {
    super(message);
    this.name = "BookClientError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function fetchBookJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message =
      payload &&
      typeof payload === "object" &&
      "error" in payload &&
      payload.error &&
      typeof payload.error === "object" &&
      "message" in payload.error &&
      typeof payload.error.message === "string"
        ? payload.error.message
        : `Request failed with status ${response.status}`;
    const code =
      payload &&
      typeof payload === "object" &&
      "error" in payload &&
      payload.error &&
      typeof payload.error === "object" &&
      "code" in payload.error &&
      typeof payload.error.code === "string"
        ? payload.error.code
        : undefined;
    const details =
      payload &&
      typeof payload === "object" &&
      "error" in payload &&
      payload.error &&
      typeof payload.error === "object" &&
      "details" in payload.error
        ? payload.error.details
        : undefined;
    throw new BookClientError(message, response.status, code, details);
  }

  return payload as T;
}
