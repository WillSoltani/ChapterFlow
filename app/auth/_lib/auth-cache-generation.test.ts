import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { NextRequest, NextResponse } from "next/server";

import { installServerOnlyShim } from "@/tests/_lib/server-only-shim";
import {
  AUTH_CACHE_GENERATION_COOKIE,
  AUTH_CACHE_GENERATION_MAX_AGE_SECONDS,
  LOCAL_DATA_OWNER_COOKIE,
  normalizeLocalDataOwner,
} from "@/lib/auth-cache-generation";

const EXISTING = "123e4567-e89b-42d3-a456-426614174000";

let restoreServerOnly: (() => void) | undefined;
let rotateAuthCacheGeneration: typeof import("./auth-cache-generation").rotateAuthCacheGeneration;
let preserveOrCreateAuthCacheGeneration: typeof import("./auth-cache-generation").preserveOrCreateAuthCacheGeneration;
let writeLocalDataOwner: typeof import("./auth-cache-generation").writeLocalDataOwner;
let clearLocalDataOwner: typeof import("./auth-cache-generation").clearLocalDataOwner;

before(async () => {
  restoreServerOnly = installServerOnlyShim();
  ({
    rotateAuthCacheGeneration,
    preserveOrCreateAuthCacheGeneration,
    writeLocalDataOwner,
    clearLocalDataOwner,
  } = await import("./auth-cache-generation"));
});

function idTokenFor(claims: Record<string, unknown>): string {
  const part = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${part({ alg: "none" })}.${part(claims)}.sig`;
}

const SUB_A = "a1b2c3d4-0000-4000-8000-00000000000a";
const SUB_B = "a1b2c3d4-0000-4000-8000-00000000000b";

test("DATA-01: the local-data owner is the account, stable across sign-ins", () => {
  const first = NextResponse.next();
  const second = NextResponse.next();
  const other = NextResponse.next();
  const ownerA1 = writeLocalDataOwner(first, idTokenFor({ sub: SUB_A, iat: 1 }));
  const ownerA2 = writeLocalDataOwner(second, idTokenFor({ sub: SUB_A, iat: 2 }));
  const ownerB = writeLocalDataOwner(other, idTokenFor({ sub: SUB_B, iat: 1 }));

  assert.ok(ownerA1);
  assert.equal(ownerA1, ownerA2);
  assert.notEqual(ownerA1, ownerB);
  assert.equal(normalizeLocalDataOwner(ownerA1), ownerA1);
  // An opaque digest, never the raw subject.
  assert.ok(!ownerA1.includes(SUB_A));
  assert.equal(first.cookies.get(LOCAL_DATA_OWNER_COOKIE)?.value, ownerA1);

  const header = first.headers.get("set-cookie") ?? "";
  assert.match(header, new RegExp(`${LOCAL_DATA_OWNER_COOKIE}=${ownerA1}`));
  assert.match(header, /Path=\//);
  assert.doesNotMatch(header, /HttpOnly/i);
});

test("DATA-01: an id token without a subject clears the owner instead of keeping a stale one", () => {
  for (const token of ["not-a-jwt", idTokenFor({ email: "x@example.com" })]) {
    const response = NextResponse.next();
    assert.equal(writeLocalDataOwner(response, token), null);
    const header = response.headers.get("set-cookie") ?? "";
    assert.match(header, new RegExp(`${LOCAL_DATA_OWNER_COOKIE}=;`));
    assert.match(header, /Max-Age=0/);
  }
  const cleared = NextResponse.next();
  clearLocalDataOwner(cleared);
  assert.match(cleared.headers.get("set-cookie") ?? "", /Max-Age=0/);
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
      ...(cookie ? { headers: { cookie } } : {}),
    });
    const response = NextResponse.next();
    const generated = preserveOrCreateAuthCacheGeneration(request, response);
    assert.match(generated, /^[0-9a-f-]{36}$/);
    assert.equal(response.cookies.get(AUTH_CACHE_GENERATION_COOKIE)?.value, generated);
  }
});
