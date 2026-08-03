import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

// WS4-003: both session-status endpoints — /app/api/auth/session and
// /app/api/me — MUST return byte-identical bodies for the anonymous case and
// for the transient verifier-outage case. They now share one handler; this test
// drives BOTH route modules through GET and asserts they agree.
//
// The routes pull `server-only`, `next/server`, and (transitively, via
// requireUser) `next/headers` + `jose`. We reuse the auth.test.ts technique:
// neutralize `server-only`, mock `next/headers` to present NO credential, and
// swap `jose.createRemoteJWKSet` for a factory we can make throw on demand to
// simulate a JWKS outage. Static imports hoist, so the patch is installed at
// top level BEFORE any dynamic import of the route modules.

const require = createRequire(import.meta.url);
const Module = require("node:module") as {
  _load: (request: string, parent: unknown, isMain: boolean) => unknown;
};
const originalLoad = Module._load;

// When true, the mocked remote JWKS throws a transport error at verify time,
// which requireUser classifies as VERIFIER_UNAVAILABLE.
let jwksOutage = false;
// requireUser reads the credential from `next/headers`, NOT the Request arg, so
// the mocked header store is what decides whether a token is presented.
let currentAuthHeader: string | null = null;

Module._load = function patchedLoad(request: string, parent: unknown, isMain: boolean) {
  if (request === "server-only") return {};
  if (request === "next/headers") {
    return {
      // No cookie ever; the Authorization header is controlled per-test.
      cookies: async () => ({ get: () => undefined }),
      headers: async () => ({
        get: (name: string) =>
          name.toLowerCase() === "authorization" ? currentAuthHeader : null,
      }),
    };
  }
  if (request === "jose") {
    const real = originalLoad.call(this, "jose", parent, isMain) as Record<string, unknown>;
    return {
      ...real,
      createRemoteJWKSet: () => async () => {
        if (jwksOutage) throw new TypeError("simulated JWKS fetch failure");
        throw new TypeError("unexpected JWKS call");
      },
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};

type RouteModule = { GET: (req: Request) => Promise<Response> };
let sessionRoute: RouteModule;
let meRoute: RouteModule;
// A structurally-valid signed JWT: enough for jwtVerify to parse the header and
// call our (failing) key resolver, so the failure classifies as a transport
// outage (VERIFIER_UNAVAILABLE), not a malformed token (INVALID_TOKEN).
let wellFormedToken: string;

before(async () => {
  process.env.COGNITO_REGION = "us-east-1";
  process.env.COGNITO_USER_POOL_ID = "us-east-1_TESTPOOL";
  process.env.COGNITO_CLIENT_ID = "test-client-id";
  delete process.env.DEV_AUTH_BYPASS; // exercise the real requireUser path

  const jose = await import("jose");
  const { privateKey } = await jose.generateKeyPair("RS256");
  wellFormedToken = await new jose.SignJWT({ token_use: "id" })
    .setProtectedHeader({ alg: "RS256", kid: "test-kid" })
    .setIssuer("https://cognito-idp.us-east-1.amazonaws.com/us-east-1_TESTPOOL")
    .setAudience("test-client-id")
    .setSubject("user-sub-123")
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(privateKey);

  sessionRoute = (await import("../auth/session/route")) as unknown as RouteModule;
  meRoute = (await import("../me/route")) as unknown as RouteModule;
});

after(() => {
  Module._load = originalLoad;
});

test("anonymous: both routes return identical 200 { loggedIn: false }", async () => {
  jwksOutage = false;
  currentAuthHeader = null; // no credential → UNAUTHENTICATED → anonymous
  const req = new Request("https://example.com/probe");

  const sessRes = await sessionRoute.GET(req);
  const meRes = await meRoute.GET(req);

  assert.equal(sessRes.status, 200);
  assert.equal(meRes.status, 200);

  const sessBody = await sessRes.json();
  const meBody = await meRes.json();
  assert.deepEqual(sessBody, { loggedIn: false });
  assert.deepEqual(meBody, sessBody);
});

test("verifier outage: both routes return identical 503 loggedIn:null envelope", async () => {
  jwksOutage = true;
  // A credential must be PRESENT to reach the verifier; present a Bearer token
  // via the mocked header store so requireUser attempts JWKS retrieval (which
  // our mock makes fail → VERIFIER_UNAVAILABLE).
  currentAuthHeader = `Bearer ${wellFormedToken}`;
  const req = new Request("https://example.com/probe", {
    headers: { "x-amzn-trace-id": "trace-1" },
  });

  const sessRes = await sessionRoute.GET(req);
  const meRes = await meRoute.GET(req);

  assert.equal(sessRes.status, 503);
  assert.equal(meRes.status, 503);

  const sessBody = await sessRes.json();
  const meBody = await meRes.json();
  assert.equal(sessBody.loggedIn, null);
  assert.equal(sessBody.error.code, "verifier_unavailable");
  assert.deepEqual(meBody, sessBody);
});
