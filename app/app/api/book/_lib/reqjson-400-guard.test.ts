import { test, before } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

// Importing http.ts transitively pulls `server-only` (via auth.ts / env.ts),
// which throws on import outside a bundler. Neutralize it the same way the
// other _lib tests (http-wrapper.test.ts) do BEFORE importing.
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
type RequireBodyObject = typeof import("./http").requireBodyObject;
let withBookApiErrors: WithBookApiErrors;
let requireBodyObject: RequireBodyObject;

before(async () => {
  ({ withBookApiErrors, requireBodyObject } = await import("./http"));
});

// A same-origin POST (so the CSRF guard never rejects and never touches AWS),
// carrying a malformed/empty JSON body so `req.json()` throws a SyntaxError —
// exactly the shape that hit the bug on the reviews/shop/share-events routes.
function malformedBodyPost(): Request {
  return new Request("https://app.chapterflow.ca/app/api/book/me/share-events", {
    method: "POST",
    headers: {
      "sec-fetch-site": "same-origin",
      origin: "https://app.chapterflow.ca",
      "content-type": "application/json",
    },
    body: "not json at all {",
  });
}

// ─── Root-cause: the un-guarded pattern leaks a 500 ──────────────────────────
//
// This reproduces the ORIGINAL defect. A route body that calls
// `requireBodyObject(await req.json())` with NO try/catch lets the SyntaxError
// escape; withBookApiErrors does not special-case it, so it falls through to
// the generic 500 server_error (and, in prod, fires the OpsFailure metric).
test("UN-guarded req.json() on a malformed body leaks a 500 server_error (the bug)", async () => {
  const res = await withBookApiErrors(malformedBodyPost(), async (): Promise<never> => {
    // Mirror the pre-fix route body exactly: no try/catch around req.json().
    const body = requireBodyObject(await malformedBodyPost().json());
    // unreachable — req.json() throws first
    void body;
    throw new Error("unreachable");
  });
  assert.equal(res.status, 500, "un-guarded parse must currently surface as a 500");
  const json = (await res.json()) as { error?: { code?: string } };
  assert.equal(json.error?.code, "server_error");
});

// ─── Fix: parse-and-default never leaks a 500 — always a typed 400 ───────────
//
// This is the contract the reviews/[cardId], shop, and share-events routes now
// uphold: wrap `req.json()` in try/catch and default to {}, so a parse failure
// can never escape as a SyntaxError. The body then flows through
// requireBodyObject + the route's own field validators, every one of which
// throws a typed BookApiError(400, …) that withBookApiErrors maps to a clean
// 400 — never a 500, never the OpsFailure metric.
test("guarded req.json() on a malformed body surfaces as a 400, not a 500 (the fix)", async () => {
  const res = await withBookApiErrors(malformedBodyPost(), async () => {
    // Mirror the post-fix route body: parse → default {} → requireBodyObject →
    // a field validator (every fixed route has one: requireString /
    // VALID_RATINGS / VALID_CARD_TYPES).
    let bodyRaw: unknown;
    try {
      bodyRaw = await malformedBodyPost().json();
    } catch {
      bodyRaw = {};
    }
    const body = requireBodyObject(bodyRaw);
    const { requireString, bookOk } = await import("./http");
    const itemId = requireString(body.itemId, "itemId");
    return bookOk({ ok: true, itemId });
  });
  assert.equal(res.status, 400, "a malformed body must surface as a typed 400, not a 500");
  const json = (await res.json()) as { error?: { code?: string } };
  assert.equal(json.error?.code, "invalid_input", "the empty {} default fails the field validator with a typed 400");
});

// A parsed body that is a NON-object primitive or array (e.g. `5`, `"x"`,
// `[1,2]` — all valid JSON that survives req.json()) is rejected by
// requireBodyObject with the typed BookApiError(400, "invalid_json"), and
// withBookApiErrors maps it to a 400. This is the `invalid_json` path the
// cluster targets, proven end-to-end through the wrapper.
test("a non-object JSON body returns 400 invalid_json through the wrapper", async () => {
  const res = await withBookApiErrors(malformedBodyPost(), async () => {
    const body = requireBodyObject([1, 2, 3]); // a valid-JSON array is NOT a body object
    const { bookOk } = await import("./http");
    return bookOk({ ok: true, body });
  });
  assert.equal(res.status, 400);
  const json = (await res.json()) as { error?: { code?: string } };
  assert.equal(json.error?.code, "invalid_json");
});

// Unit-level: requireBodyObject is the typed-400 source. A non-object throws
// invalid_json; {} (the post-catch default) is accepted so field validators run.
test("requireBodyObject: non-object → invalid_json(400); {} → accepted", () => {
  assert.throws(
    () => requireBodyObject("not an object"),
    (err: unknown) =>
      typeof err === "object" &&
      err !== null &&
      (err as { code?: string }).code === "invalid_json" &&
      (err as { status?: number }).status === 400
  );
  assert.deepEqual(requireBodyObject({}), {});
});
