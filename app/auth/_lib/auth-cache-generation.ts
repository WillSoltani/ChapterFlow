import "server-only";

import type { NextRequest, NextResponse } from "next/server";

import {
  AUTH_CACHE_GENERATION_COOKIE,
  AUTH_CACHE_GENERATION_MAX_AGE_SECONDS,
  normalizeAuthCacheGeneration,
} from "@/lib/auth-cache-generation";
import { getAuthCookieBase } from "./auth-cookie";

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
