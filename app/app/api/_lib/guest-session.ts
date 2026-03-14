import "server-only";

import { cookies } from "next/headers";

export const GUEST_PROJECT_ID = "guest";
export const GUEST_SESSION_COOKIE = "guest_sid";
export const GUEST_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 365; // 1 year

const GUEST_SESSION_ID_RE = /^[a-z0-9-]{16,128}$/i;

export function isGuestProjectId(projectId: string): boolean {
  return projectId === GUEST_PROJECT_ID;
}

export function normalizeGuestSessionId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return GUEST_SESSION_ID_RE.test(trimmed) ? trimmed : null;
}

export function newGuestSessionId(): string {
  return crypto.randomUUID();
}

export function guestSubFromSessionId(sessionId: string): string {
  return `guest-${sessionId}`;
}

export async function readGuestSessionId(): Promise<string | null> {
  const jar = await cookies();
  return normalizeGuestSessionId(jar.get(GUEST_SESSION_COOKIE)?.value ?? null);
}

export function guestCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: GUEST_SESSION_MAX_AGE_SECONDS,
  };
}

