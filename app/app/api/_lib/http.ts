import { NextResponse } from "next/server";
import { AuthError } from "./auth";

export function ok<T>(data: T, init?: number | ResponseInit) {
  const resInit = typeof init === "number" ? { status: init } : init;
  return NextResponse.json(data, resInit);
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function unauthorized() {
  return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
}

export function notFound(message = "not found") {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function conflict(message: string) {
  return NextResponse.json({ error: message }, { status: 409 });
}

export function serverError() {
  return NextResponse.json({ error: "server error" }, { status: 500 });
}

export function getErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  try {
    return JSON.stringify(e);
  } catch {
    return "unknown error";
  }
}

// Wrapper: routes become `return withApiErrors(async () => { ... })`
export async function withApiErrors<T>(fn: () => Promise<NextResponse<T>>) {
  try {
    return await fn();
  } catch (e: unknown) {
    if (e instanceof AuthError) return unauthorized();
    console.error(e);
    return serverError();
  }
}
