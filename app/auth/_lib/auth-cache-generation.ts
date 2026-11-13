import "server-only";

import { createHash } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";

import {
  AUTH_CACHE_GENERATION_COOKIE,
  AUTH_CACHE_GENERATION_MAX_AGE_SECONDS,
  LOCAL_DATA_OWNER_COOKIE,
  normalizeAuthCacheGeneration,
} from "@/lib/auth-cache-generation";
import { getAuthCookieBase } from "./auth-cookie";

/**
 * Read the `sub` from an id token this request just received from Cognito's
 * token endpoint over TLS. Reading a claim without re-verifying the signature
 * is safe only for such freshly issued tokens, never for client input.
 */
export function subFromIssuedIdToken(idToken: string): string | null {
  try {
    const payload = idToken.split(".")[1];
    if (!payload) return null;
    const json = JSON.parse(
      Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"),
    ) as Record<string, unknown>;
    return typeof json.sub === "string" && json.sub.length > 0 ? json.sub : null;
  } catch {
    return null;
  }
}

/** Remove the local-data owner (sign-out, deleted account). */
export function clearLocalDataOwner(response: NextResponse): void {
  response.cookies.set(LOCAL_DATA_OWNER_COOKIE, "", {
    ...getAuthCookieBase(),
    httpOnly: false,
    maxAge: 0,
  });
}

/**
 * DATA-01: record which account this browser's stored data belongs to, as an
 * opaque digest of the account's `sub` (stable across sign-ins of the same
 * account, different for every other account). A token without a readable
 * subject clears the owner, so the client treats it as unknown and keeps or
 * wipes nothing on a guess.
 */
export function writeLocalDataOwner(
  response: NextResponse,
  issuedIdToken: string,
): string | null {
  const sub = subFromIssuedIdToken(issuedIdToken);
  if (!sub) {
    clearLocalDataOwner(response);
    return null;
  }
  const owner = createHash("sha256")
    .update(`chapterflow:local-data-owner:v1:${sub}`)
    .digest("hex")
    .slice(0, 32);
  response.cookies.set(LOCAL_DATA_OWNER_COOKIE, owner, {
    ...getAuthCookieBase(),
    httpOnly: false,
    maxAge: AUTH_CACHE_GENERATION_MAX_AGE_SECONDS,
  });
  return owner;
}

function writeAuthCacheGeneration(
  response: NextResponse,
  generation: string,
): string {
  response.cookies.set(AUTH_CACHE_GENERATION_COOKIE, generation, {
    ...getAuthCookieBase(),
    httpOnly: false,
    maxAge: AUTH_CACHE_GENERATION_MAX_AGE_SECONDS,
  });
  return generation;
}

/** Rotate after an effective identity replacement or explicit session clear. */
export function rotateAuthCacheGeneration(response: NextResponse): string {
  return writeAuthCacheGeneration(response, crypto.randomUUID());
}

/** Preserve a same-subject silent refresh, creating a marker for legacy sessions. */
export function preserveOrCreateAuthCacheGeneration(
  request: NextRequest,
  response: NextResponse,
): string {
  const existing = normalizeAuthCacheGeneration(
    request.cookies.get(AUTH_CACHE_GENERATION_COOKIE)?.value,
  );
  return writeAuthCacheGeneration(response, existing ?? crypto.randomUUID());
}
