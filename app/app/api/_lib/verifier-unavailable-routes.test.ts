import { test, before } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { VERIFIER_UNAVAILABLE_CODE } from "./session-response-core";

// Same neutralize-then-mock trick as http-wrapper.test.ts (lines 11-19):
// importing any route module transitively pulls `server-only` (via auth.ts /
// env.ts), which throws outside a bundler. Neutralize it BEFORE importing
// anything, then extend the patch to force auth.ts's `requireUser` to reject
// with AuthError("VERIFIER_UNAVAILABLE") so all three identity handlers
// (`/app/api/me`, `/app/api/auth/session`, and — separately, in
// http-wrapper.test.ts — `withBookApiErrors`) can be proven to agree on one
// 503 error code.
const require = createRequire(import.meta.url);
const Module = require("node:module") as {
  _load: (request: string, parent: unknown, isMain: boolean) => unknown;
  _resolveFilename: (request: string, parent: unknown, isMain?: boolean) => string;
};
const originalLoad = Module._load;

// Step 1: neutralize `server-only` only, so we can dynamically import the
// REAL auth.ts module below and capture its actual AuthError class.
Module._load = function neutralizeServerOnly(
  request: string,
  parent: unknown,
  isMain: boolean
) {
  if (request === "server-only") return {};
  return originalLoad.call(this, request, parent, isMain);
};

type MeRouteGet = typeof import("@/app/app/api/me/route").GET;
type SessionRouteGet = typeof import("@/app/app/api/auth/session/route").GET;
let meRouteGet: MeRouteGet;
let sessionRouteGet: SessionRouteGet;

before(async () => {
  // Capture the REAL AuthError class first — session-route-handler.ts does
  // `error instanceof AuthError`, so the mock must throw an instance of the
  // SAME class identity the handler checks against, not a lookalike.
  const realAuth = await import("@/app/app/api/_lib/auth");
  const { AuthError } = realAuth;

  // Resolve auth.ts's absolute path via the (still-real) loader so the mock
  // below intercepts ONLY that specific module, not any other "./auth"-shaped
  // relative import elsewhere in the tree.
  const authPath = require.resolve("@/app/app/api/_lib/auth");

  const mockAuthModule = {
    AuthError,
    requireUser: () => Promise.reject(new AuthError("VERIFIER_UNAVAILABLE")),
  };

  // Step 2: extend the patch — still neutralize `server-only`, and now also
  // intercept any load that RESOLVES to auth.ts (however it was required:
  // relative "./auth" from session-route-handler.ts, aliased, etc.) and hand
  // back the forced-VERIFIER_UNAVAILABLE mock instead.
  Module._load = function patchedLoad(request: string, parent: unknown, isMain: boolean) {
    if (request === "server-only") return {};
    try {
      const resolved = Module._resolveFilename(request, parent, isMain);
      if (resolved === authPath) return mockAuthModule;
    } catch {
      // Not resolvable as a file path (e.g. a Node built-in) — fall through.
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  // Dynamic imports AFTER the mock patch installs: both route modules pull in
  // session-route-handler.ts, which imports auth.ts's requireUser/AuthError —
  // that import now resolves to the mock above.
  ({ GET: meRouteGet } = await import("@/app/app/api/me/route"));
  ({ GET: sessionRouteGet } = await import("@/app/app/api/auth/session/route"));
});

test("me route returns canonical 503 verifier_unavailable envelope", async () => {
  const res = await meRouteGet(new Request("https://app.chapterflow.ca/app/api/me"));
  assert.equal(res.status, 503);
  const json = (await res.json()) as { error?: { code?: string } };
  assert.equal(json.error?.code, VERIFIER_UNAVAILABLE_CODE);
});

test("auth/session route returns canonical 503 verifier_unavailable envelope with loggedIn:null", async () => {
  const res = await sessionRouteGet(
    new Request("https://app.chapterflow.ca/app/api/auth/session")
  );
  assert.equal(res.status, 503);
  const json = (await res.json()) as { loggedIn?: unknown; error?: { code?: string } };
  assert.equal(json.loggedIn, null);
  assert.equal(json.error?.code, VERIFIER_UNAVAILABLE_CODE);
});

test("all identity handlers share one verifier-unavailable code", async () => {
  const [meRes, sessionRes] = await Promise.all([
    meRouteGet(new Request("https://app.chapterflow.ca/app/api/me")),
    sessionRouteGet(new Request("https://app.chapterflow.ca/app/api/auth/session")),
  ]);
  assert.equal(meRes.status, 503);
  assert.equal(sessionRes.status, 503);
  const meJson = (await meRes.json()) as { error?: { code?: string } };
  const sessionJson = (await sessionRes.json()) as { error?: { code?: string } };
  assert.equal(meJson.error?.code, sessionJson.error?.code);
  assert.equal(meJson.error?.code, VERIFIER_UNAVAILABLE_CODE);
});
