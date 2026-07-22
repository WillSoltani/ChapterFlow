import { test, before } from "node:test";
import assert from "node:assert/strict";

import { installServerOnlyShim } from "@/tests/_lib/server-only-shim";

// The route now reaches the shared AWS client factory in _lib/aws.ts, whose
// import chain includes `server-only` — shim it before loading the handler.
let GET: typeof import("./route").GET;
before(async () => {
  const restore = installServerOnlyShim();
  ({ GET } = await import("./route"));
  restore();
});

// A real route-handler test: invokes the Next.js GET handler in-process and
// asserts the contract the deploy health gate depends on.

test("GET /api/health returns 200 with status ok (basic, no DB probe)", async () => {
  const res = await GET(new Request("http://localhost/api/health"));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, "ok");
  assert.equal(typeof body.time, "string");
  assert.equal(body.checks, undefined); // no deep probe unless ?deep=1
});

test("GET /api/health?deep=1 never returns 5xx and reports dynamo:false when no table is configured", async () => {
  // Guarantees the deep probe short-circuits (no network) so the assertion is
  // deterministic and the endpoint can never false-fail a deploy gate.
  const saved = process.env.BOOK_TABLE_NAME;
  delete process.env.BOOK_TABLE_NAME;
  try {
    const res = await GET(new Request("http://localhost/api/health?deep=1"));
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, "degraded");
    assert.equal(body.checks.dynamo, false);
  } finally {
    if (saved === undefined) delete process.env.BOOK_TABLE_NAME;
    else process.env.BOOK_TABLE_NAME = saved;
  }
});
