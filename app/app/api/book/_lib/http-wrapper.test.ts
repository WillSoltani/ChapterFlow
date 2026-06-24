import { test, before } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

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

before(async () => {
  ({ withBookApiErrors } = await import("./http"));
});

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

test("observe-only mode (CSRF_ORIGIN_ENFORCE=0) logs but lets a cross-site request through", async () => {
  const saved = process.env.CSRF_ORIGIN_ENFORCE;
  process.env.CSRF_ORIGIN_ENFORCE = "0";
  try {
    let bodyRan = false;
    const res = await withBookApiErrors(crossSitePost(), async () => {
      bodyRan = true;
      const { bookOk } = await import("./http");
      return bookOk({ ok: true });
    });
    assert.equal(bodyRan, true, "observe-only must not block");
    assert.equal(res.status, 200);
  } finally {
    if (saved === undefined) delete process.env.CSRF_ORIGIN_ENFORCE;
    else process.env.CSRF_ORIGIN_ENFORCE = saved;
  }
});
