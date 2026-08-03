import { test } from "node:test";
import assert from "node:assert/strict";

import { buildSessionResponse } from "./session-response-core";

test("anonymous maps to 200 loggedIn:false", () => {
  assert.deepEqual(buildSessionResponse({ kind: "anonymous" }, "r1"), {
    status: 200,
    body: { loggedIn: false },
  });
});

test("verifier_unavailable maps to 503 loggedIn:null with envelope", () => {
  const r = buildSessionResponse({ kind: "verifier_unavailable" }, "r1");
  assert.equal(r.status, 503);
  assert.equal(r.body.loggedIn, null);
  assert.equal((r.body.error as { code: string }).code, "verifier_unavailable");
});

test("unexpected never returns 200 loggedIn:false", () => {
  const r = buildSessionResponse({ kind: "unexpected" }, "r1");
  assert.equal(r.status, 503);
  assert.equal(r.body.loggedIn, null);
});
