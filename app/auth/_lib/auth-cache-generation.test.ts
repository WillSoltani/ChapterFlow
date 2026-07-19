import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { NextRequest, NextResponse } from "next/server";

import { installServerOnlyShim } from "@/tests/_lib/server-only-shim";
import {
  AUTH_CACHE_GENERATION_COOKIE,
  AUTH_CACHE_GENERATION_MAX_AGE_SECONDS,
} from "@/lib/auth-cache-generation";

const EXISTING = "123e4567-e89b-42d3-a456-426614174000";

let restoreServerOnly: (() => void) | undefined;
let rotateAuthCacheGeneration: typeof import("./auth-cache-generation").rotateAuthCacheGeneration;
let preserveOrCreateAuthCacheGeneration: typeof import("./auth-cache-generation").preserveOrCreateAuthCacheGeneration;

before(async () => {
  restoreServerOnly = installServerOnlyShim();
  ({ rotateAuthCacheGeneration, preserveOrCreateAuthCacheGeneration } =
    await import("./auth-cache-generation"));
});

after(() => restoreServerOnly?.());

test("rotation writes a new client-readable generation with auth-cookie attributes", () => {
  const response = NextResponse.next();
  const generated = rotateAuthCacheGeneration(response);
  const cookie = response.cookies.get(AUTH_CACHE_GENERATION_COOKIE);

  assert.match(generated, /^[0-9a-f-]{36}$/);
  assert.notEqual(generated, EXISTING);
  assert.equal(cookie?.value, generated);

  const header = response.headers.get("set-cookie") ?? "";
  assert.match(header, new RegExp(`Max-Age=${AUTH_CACHE_GENERATION_MAX_AGE_SECONDS}`));
  assert.match(header, /Path=\//);
  assert.match(header, /SameSite=lax/i);
  assert.doesNotMatch(header, /HttpOnly/i);
});

test("successful refresh preserves a valid generation", () => {
  const request = new NextRequest("https://app.chapterflow.ca/auth/refresh", {
    headers: { cookie: `${AUTH_CACHE_GENERATION_COOKIE}=${EXISTING}` },
  });
  const response = NextResponse.next();

  assert.equal(preserveOrCreateAuthCacheGeneration(request, response), EXISTING);
  assert.equal(response.cookies.get(AUTH_CACHE_GENERATION_COOKIE)?.value, EXISTING);
});

test("successful refresh creates a generation when the cookie is missing or malformed", () => {
  for (const cookie of [undefined, `${AUTH_CACHE_GENERATION_COOKIE}=not-a-uuid`]) {
    const request = new NextRequest("https://app.chapterflow.ca/auth/refresh", {
      headers: cookie ? { cookie } : undefined,
    });
    const response = NextResponse.next();
    const generated = preserveOrCreateAuthCacheGeneration(request, response);
    assert.match(generated, /^[0-9a-f-]{36}$/);
    assert.equal(response.cookies.get(AUTH_CACHE_GENERATION_COOKIE)?.value, generated);
  }
});
