import { test } from "node:test";
import assert from "node:assert/strict";
import { POST } from "./route";

// In-process tests of the public book-request intake contract the landing form
// depends on. With BOOK_TABLE_NAME unset and NODE_ENV !== "production", the
// handler takes its local-dev path (in-memory rate limiter + JSONL append, no
// AWS, no SES — notifyTeam early-returns without BOOK_REQUESTS_TO_EMAIL).

function post(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/book-requests", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    // Vary the source IP per call so the per-IP window cap can't bleed across
    // tests in the shared process.
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function withDevEnv(run: () => Promise<void>): Promise<void> {
  const savedTable = process.env.BOOK_TABLE_NAME;
  delete process.env.BOOK_TABLE_NAME;
  return run().finally(() => {
    if (savedTable === undefined) delete process.env.BOOK_TABLE_NAME;
    else process.env.BOOK_TABLE_NAME = savedTable;
  });
}

test("POST valid request → 201 with requestId + createdAt", () =>
  withDevEnv(async () => {
    const res = await POST(
      post(
        { title: "Some Real Book", author: "An Author", email: "reader@example.com" },
        { "x-forwarded-for": "203.0.113.10" },
      ),
    );
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(typeof body.requestId, "string");
    assert.equal(typeof body.createdAt, "string");
  }));

test("POST short title → 400 invalid_title", () =>
  withDevEnv(async () => {
    const res = await POST(
      post({ title: "x", email: "reader@example.com" }, { "x-forwarded-for": "203.0.113.11" }),
    );
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error.code, "invalid_title");
    assert.equal(typeof body.error.requestId, "string");
  }));

test("POST bad email → 400 invalid_email", () =>
  withDevEnv(async () => {
    const res = await POST(
      post({ title: "A Good Title", email: "not-an-email" }, { "x-forwarded-for": "203.0.113.12" }),
    );
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error.code, "invalid_email");
    assert.equal(typeof body.error.requestId, "string");
  }));

test("POST with honeypot filled → silent 201, no error surfaced", () =>
  withDevEnv(async () => {
    const res = await POST(
      post(
        { title: "Spam Title", email: "bot@example.com", website: "http://spam" },
        { "x-forwarded-for": "203.0.113.13" },
      ),
    );
    // Bots must not be able to tell their submission was dropped.
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.ok, true);
  }));

test("POST invalid JSON → 400 invalid_json", () =>
  withDevEnv(async () => {
    const res = await POST(post("{not json", { "x-forwarded-for": "203.0.113.14" }));
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error.code, "invalid_json");
    assert.equal(typeof body.error.requestId, "string");
  }));
