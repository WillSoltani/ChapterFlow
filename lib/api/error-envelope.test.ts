import test from "node:test";
import assert from "node:assert/strict";
import { jsonErrorResponse, requestIdFromHeaders } from "./error-envelope";
test("envelope carries code/message/requestId", async () => {
  const req = new Request("https://x.test/", { headers: { "x-amzn-trace-id": "trace-1" } });
  const res = jsonErrorResponse(req, 429, "rate_limited", "Too many requests.");
  assert.equal(res.status, 429);
  const body = await res.json();
  assert.deepEqual(Object.keys(body), ["error"]);
  assert.equal(body.error.code, "rate_limited");
  assert.equal(body.error.requestId, "trace-1");
});
test("requestId prefers x-amzn-trace-id", () => {
  assert.equal(requestIdFromHeaders(new Request("https://x.test/", { headers: { "x-amzn-trace-id": "t2" } })), "t2");
});
test("details omitted when undefined", async () => {
  const body = await jsonErrorResponse(new Request("https://x.test/"), 400, "bad", "Bad.").json();
  assert.equal("details" in body.error, false);
});
test("extra fields merge beside error object", async () => {
  const body = await jsonErrorResponse(new Request("https://x.test/"), 401, "unauthenticated", "Sign in.", { extra: { authenticated: false } }).json();
  assert.equal(body.authenticated, false);
  assert.equal(body.error.code, "unauthenticated");
});
