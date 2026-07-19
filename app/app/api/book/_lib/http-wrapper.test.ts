import { test, before } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { setLogSink, type LogLevel } from "@/lib/logging/logger";

// Importing http.ts transitively pulls `server-only` (via auth.ts / env.ts),
// which throws on import outside a bundler. Neutralize it the same way the
// book scripts do (see scripts/book/check-catalog-state.ts) BEFORE importing.
// The cross-site cases below reject via Sec-Fetch-Site with NO Origin header, so
// `requireSameOrigin` never resolves getAppBaseUrl → no AWS/SSM is touched.
const require = createRequire(import.meta.url);
const Module = require("node:module") as {
  _load: (request: string, parent: unknown, isMain: boolean) => unknown;
};
const originalLoad = Module._load;
Module._load = function patchedLoad(request: string, parent: unknown, isMain: boolean) {
  if (request === "server-only") return {};
  return originalLoad.call(this, request, parent, isMain);
};

type WithBookApiErrors = typeof import("./http").withBookApiErrors;
let withBookApiErrors: WithBookApiErrors;
let AuthError: typeof import("@/app/app/api/_lib/auth").AuthError;

const RUNTIME_ENV_KEYS = [
  "NODE_ENV",
  "CHAPTERFLOW_ENV",
  "CSRF_ORIGIN_ENFORCE",
] as const;

async function withRuntimeEnv(
  values: Partial<Record<(typeof RUNTIME_ENV_KEYS)[number], string>>,
  run: () => Promise<void>
): Promise<void> {
  const env = process.env as Record<string, string | undefined>;
  const saved = Object.fromEntries(RUNTIME_ENV_KEYS.map((key) => [key, env[key]]));
  try {
    for (const key of RUNTIME_ENV_KEYS) {
      const value = values[key];
      if (value === undefined) delete env[key];
      else env[key] = value;
    }
    await run();
  } finally {
    for (const key of RUNTIME_ENV_KEYS) {
      const value = saved[key];
      if (value === undefined) delete env[key];
      else env[key] = value;
    }
  }
}

before(async () => {
  ({ withBookApiErrors } = await import("./http"));
  // Dynamic import AFTER the server-only patch above (static imports hoist and
  // would evaluate auth.ts's `import "server-only"` before the patch installs).
  ({ AuthError } = await import("@/app/app/api/_lib/auth"));
});

// A JWT-shaped placeholder — the guard only checks for the PRESENCE of a Bearer
// token / id_token cookie, never verifies it (verification happens later, in
// requireUser). See auth.test.ts for the real-verification coverage.
const FAKE_JWT = "eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiIxIn0.sig";

function bearerMutation(method: string): Request {
  // A native client: Bearer id_token, NO Origin, NO Sec-Fetch-Site, NO cookie —
  // exactly the shape that WOULD trip the strict-default guard on an unsafe
  // method, but is immune to CSRF (no ambient cookie credential).
  return new Request("https://app.chapterflow.ca/app/api/book/me/settings", {
    method,
    headers: { authorization: `Bearer ${FAKE_JWT}` },
  });
}

function cookieCrossSitePost(): Request {
  // Cookie-authed (id_token cookie) cross-site POST — the canonical CSRF attempt.
  return new Request("https://app.chapterflow.ca/app/api/book/me/settings", {
    method: "POST",
    headers: { "sec-fetch-site": "cross-site", cookie: `id_token=${FAKE_JWT}` },
  });
}

function crossSitePost(): Request {
  // POST with Sec-Fetch-Site: cross-site and no Origin → guard rejects without
  // needing the canonical app origin (no AWS lookup).
  return new Request("https://app.chapterflow.ca/app/api/book/me/settings", {
    method: "POST",
    headers: { "sec-fetch-site": "cross-site" },
  });
}

function sameOriginPost(): Request {
  return new Request("https://app.chapterflow.ca/app/api/book/me/settings", {
    method: "POST",
    headers: { "sec-fetch-site": "same-origin", origin: "https://app.chapterflow.ca" },
  });
}

test("withBookApiErrors auto-rejects a cross-site mutation with 403 forbidden_origin", async () => {
  let bodyRan = false;
  const res = await withBookApiErrors(crossSitePost(), async () => {
    bodyRan = true;
    const { bookOk } = await import("./http");
    return bookOk({ ok: true });
  });
  assert.equal(res.status, 403, "cross-site POST must be blocked before the body");
  assert.equal(bodyRan, false, "route body must NOT run on a blocked request");
  const json = (await res.json()) as { error?: { code?: string } };
  assert.equal(json.error?.code, "forbidden_origin");
});

test("a whitespace-only Sec-Fetch-Site cannot skip the Origin fallback and fail open", async () => {
  const req = new Request("https://app.chapterflow.ca/app/api/book/me/settings", {
    method: "POST",
    headers: {
      "sec-fetch-site": "\u00a0",
      origin: "https://evil.example",
      cookie: `id_token=${FAKE_JWT}`,
    },
  });
  assert.equal(req.headers.get("sec-fetch-site"), "\u00a0");

  let bodyRan = false;
  const res = await withBookApiErrors(req, async () => {
    bodyRan = true;
    const { bookOk } = await import("./http");
    return bookOk({ ok: true });
  });
  assert.equal(res.status, 403);
  assert.equal(bodyRan, false);
  const json = (await res.json()) as { error?: { code?: string } };
  assert.equal(json.error?.code, "forbidden_origin");
});

test("opts.skipOriginCheck lets a cross-site request through (webhook/unsubscribe opt-out)", async () => {
  let bodyRan = false;
  const res = await withBookApiErrors(
    crossSitePost(),
    async () => {
      bodyRan = true;
      const { bookOk } = await import("./http");
      return bookOk({ ok: true });
    },
    { skipOriginCheck: true }
  );
  assert.equal(bodyRan, true, "body must run when origin check is skipped");
  assert.equal(res.status, 200);
});

test("a same-origin mutation runs the route body normally", async () => {
  let bodyRan = false;
  const res = await withBookApiErrors(sameOriginPost(), async () => {
    bodyRan = true;
    const { bookOk } = await import("./http");
    return bookOk({ ok: true });
  });
  assert.equal(bodyRan, true, "same-origin POST must reach the route body");
  assert.equal(res.status, 200);
});

test("a safe-method (GET) request is never origin-checked", async () => {
  const getReq = new Request("https://app.chapterflow.ca/app/api/book/me/settings", {
    method: "GET",
    // hostile headers that WOULD trip the guard on an unsafe method:
    headers: { "sec-fetch-site": "cross-site" },
  });
  let bodyRan = false;
  const res = await withBookApiErrors(getReq, async () => {
    bodyRan = true;
    const { bookOk } = await import("./http");
    return bookOk({ ok: true });
  });
  assert.equal(bodyRan, true, "GET must bypass the origin guard");
  assert.equal(res.status, 200);
});

test("production ignores CSRF_ORIGIN_ENFORCE=0, rejects with 403, and does not run the body", async () => {
  await withRuntimeEnv(
    { NODE_ENV: "production", CHAPTERFLOW_ENV: "prod", CSRF_ORIGIN_ENFORCE: "0" },
    async () => {
      let bodyRan = false;
      const res = await withBookApiErrors(cookieCrossSitePost(), async () => {
        bodyRan = true;
        const { bookOk } = await import("./http");
        return bookOk({ ok: true });
      });
      assert.equal(res.status, 403, "production cross-site POST must stay blocked");
      assert.equal(bodyRan, false, "production rejection must happen before the route body");
      const json = (await res.json()) as { error?: { code?: string } };
      assert.equal(json.error?.code, "forbidden_origin");
    }
  );
});

test("staging observe-only logs structurally and lets a cross-site request through", async () => {
  const logs: Array<{ level: LogLevel; line: string }> = [];
  setLogSink((level, line) => logs.push({ level, line }));
  try {
    await withRuntimeEnv(
      { NODE_ENV: "production", CHAPTERFLOW_ENV: "staging", CSRF_ORIGIN_ENFORCE: "0" },
      async () => {
        let bodyRan = false;
        const res = await withBookApiErrors(crossSitePost(), async () => {
          bodyRan = true;
          const { bookOk } = await import("./http");
          return bookOk({ ok: true });
        });
        assert.equal(bodyRan, true, "staging observe-only must not block");
        assert.equal(res.status, 200);
      }
    );
    assert.equal(logs.length, 1);
    assert.equal(logs[0]?.level, "warn");
    const record = JSON.parse(logs[0]?.line ?? "{}") as Record<string, unknown>;
    assert.equal(record.event, "csrf_origin_observe_only");
    assert.equal(record.method, "POST");
    assert.equal(record.path, "/app/api/book/me/settings");
    assert.equal(record.reason, "sec-fetch-site=cross-site");
    assert.equal(typeof record.requestId, "string");
  } finally {
    setLogSink();
  }
});

test("production-off mode keeps safe methods and Bearer-only native mutations unchanged", async () => {
  await withRuntimeEnv(
    { NODE_ENV: "production", CHAPTERFLOW_ENV: "prod", CSRF_ORIGIN_ENFORCE: "off" },
    async () => {
      for (const req of [
        new Request("https://app.chapterflow.ca/app/api/book/me/settings", {
          method: "GET",
          headers: { "sec-fetch-site": "cross-site" },
        }),
        bearerMutation("PATCH"),
      ]) {
        let bodyRan = false;
        const res = await withBookApiErrors(req, async () => {
          bodyRan = true;
          const { bookOk } = await import("./http");
          return bookOk({ ok: true });
        });
        assert.equal(bodyRan, true, `${req.method} request must reach the route body`);
        assert.equal(res.status, 200);
      }
    }
  );
});

// ─── Bearer (native-app) auth: CSRF guard skipped for header-authed requests ──

test("a Bearer-authed PATCH with NO Origin reaches the body (native app immune to CSRF)", async () => {
  // DoD (a): a header-authenticated mutation must NOT be 403'd for lacking an
  // Origin — it cannot be CSRF because there is no ambient cookie credential.
  let bodyRan = false;
  const res = await withBookApiErrors(bearerMutation("PATCH"), async () => {
    bodyRan = true;
    const { bookOk } = await import("./http");
    return bookOk({ ok: true });
  });
  assert.equal(bodyRan, true, "Bearer PATCH must reach the route body");
  assert.equal(res.status, 200);
});

test("a Bearer-authed GET with NO Origin reaches the body", async () => {
  let bodyRan = false;
  const res = await withBookApiErrors(bearerMutation("GET"), async () => {
    bodyRan = true;
    const { bookOk } = await import("./http");
    return bookOk({ ok: true });
  });
  assert.equal(bodyRan, true, "Bearer GET must reach the route body");
  assert.equal(res.status, 200);
});

test("a COOKIE-authed cross-site POST is STILL rejected with 403 (CSRF preserved)", async () => {
  // DoD (b): the presence of an id_token cookie keeps the same-origin guard.
  let bodyRan = false;
  const res = await withBookApiErrors(cookieCrossSitePost(), async () => {
    bodyRan = true;
    const { bookOk } = await import("./http");
    return bookOk({ ok: true });
  });
  assert.equal(res.status, 403, "cookie cross-site POST must be blocked");
  assert.equal(bodyRan, false, "route body must NOT run on a blocked cookie request");
  const json = (await res.json()) as { error?: { code?: string } };
  assert.equal(json.error?.code, "forbidden_origin");
});

test("a cross-site POST carrying BOTH a cookie AND a Bearer header is still rejected (cookie wins)", async () => {
  // Defense-in-depth: an attacker who also attaches a Bearer header must not be
  // able to downgrade a cookie-riding request out of CSRF protection.
  const req = new Request("https://app.chapterflow.ca/app/api/book/me/settings", {
    method: "POST",
    headers: {
      "sec-fetch-site": "cross-site",
      cookie: `id_token=${FAKE_JWT}`,
      authorization: `Bearer ${FAKE_JWT}`,
    },
  });
  const res = await withBookApiErrors(req, async () => {
    const { bookOk } = await import("./http");
    return bookOk({ ok: true });
  });
  assert.equal(res.status, 403, "a cookie credential keeps the guard even with a Bearer header");
});

// ─── AuthError → HTTP mapping (invalid_token vs unauthenticated) ───────────────

test("an INVALID_TOKEN from the route body maps to 401 invalid_token", async () => {
  // DoD (c): a bad/expired credential (Bearer or cookie) → 401 `invalid_token`,
  // distinct from `unauthenticated`. requireUser raising INVALID_TOKEN is covered
  // in auth.test.ts; here we assert the wrapper's mapping.
  const res = await withBookApiErrors(bearerMutation("PATCH"), async () => {
    throw new AuthError("INVALID_TOKEN");
  });
  assert.equal(res.status, 401);
  const json = (await res.json()) as { error?: { code?: string } };
  assert.equal(json.error?.code, "invalid_token");
});

test("an UNAUTHENTICATED (no credential) still maps to 401 unauthenticated", async () => {
  const res = await withBookApiErrors(sameOriginPost(), async () => {
    throw new AuthError("UNAUTHENTICATED");
  });
  assert.equal(res.status, 401);
  const json = (await res.json()) as { error?: { code?: string } };
  assert.equal(json.error?.code, "unauthenticated");
});
