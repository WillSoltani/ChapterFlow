// Seam test for POST /me/reading-sessions (API-04 / API-23): the optional
// `localDay` reaches the reading-day write, old clients without it keep the
// legacy key, and a bad `occurredAt` never lands raw in lastActiveAt.
import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import {
  guardStub,
  installRouteHarness,
  makeSpy,
} from "@/tests/_lib/route-harness";

const guard = guardStub();

// http.ts (loaded real) does `error instanceof AuthError` — provide a class.
class StubAuthError extends Error {}

type DayWrite = { userId: string; dayKey: string; deltaMs: number; occurredAt: string };
type ProgressWrite = { lastActiveAt: string; updatedAt: string };

const addReadingDayActivity = makeSpy(async (_table: string, input: DayWrite) => ({
  date: input.dayKey,
  totalActiveMs: input.deltaMs,
}));
const upsertUserProgress = makeSpy(async (_table: string, _item: ProgressWrite) => undefined);

const envStub = {
  getBookTableName: async () => "book-table-test",
  getBookAnalyticsTableName: async () => "",
  getAppBaseUrl: async () => "https://app.chapterflow.ca",
};

const harness = installRouteHarness({
  "@/app/app/api/book/_lib/account-guard": {
    requireActiveBookUser: guard.requireActiveBookUser,
  },
  "@/app/app/api/_lib/auth": { AuthError: StubAuthError },
  "@/app/app/api/book/_lib/env": envStub,
  "./env": envStub,
  "@/app/app/api/book/_lib/idempotency-repo": {
    createDynamoIdempotencyStore: () => ({}),
  },
  "@/app/app/api/book/_lib/repo": {
    addReadingDayActivity,
    getUserProgress: async () => ({ userId: "user-1", bookId: "book-1" }),
    getUserSettingsItem: async () => null,
    upsertUserProgress,
  },
  "@/app/app/api/book/_lib/analytics-repo": {
    analyticsTrackReadingSession: async () => undefined,
    analyticsSetUserLocale: async () => undefined,
  },
  "@/app/app/api/book/_lib/user-agent": { getUserAgentFromRequest: () => ({}) },
  "@/app/app/api/book/_lib/location": { resolveLocation: async () => null },
});

let POST: typeof import("./route").POST;

before(async () => {
  ({ POST } = await import("./route"));
});

beforeEach(() => {
  guard.reset();
  addReadingDayActivity.calls.length = 0;
  upsertUserProgress.calls.length = 0;
});

after(() => {
  harness.restore();
});

const FAKE_JWT = "eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiIxIn0.sig";

function sessionRequest(body: Record<string, unknown>): Request {
  return new Request("https://app.chapterflow.ca/app/api/book/me/reading-sessions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${FAKE_JWT}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function utcDay(offsetDays = 0): string {
  return new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);
}

test("a plausible localDay is the day the reading is filed under", async () => {
  // Pick a neighbouring UTC day that differs from the server-clock key, so the
  // assertion can only pass if localDay was used.
  const now = new Date();
  const legacy = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const localDay = utcDay(-1) !== legacy ? utcDay(-1) : utcDay(1);
  const res = await POST(sessionRequest({ bookId: "book-1", deltaMs: 5000, localDay }));
  assert.equal(res.status, 200);
  assert.equal(guard.requireActiveBookUser.calls.length, 1);
  assert.equal(addReadingDayActivity.calls.length, 1);
  assert.equal(addReadingDayActivity.calls[0]?.[1].dayKey, localDay);
});

test("without localDay the day comes from occurredAt, as before", async () => {
  // Midday UTC two days ago: the same date in any zone from UTC-11 to UTC+11.
  const day = utcDay(-2);
  const occurredAt = `${day}T12:00:00.000Z`;
  const res = await POST(sessionRequest({ bookId: "book-1", deltaMs: 5000, occurredAt }));
  assert.equal(res.status, 200);
  assert.equal(addReadingDayActivity.calls[0]?.[1].dayKey, day);
  assert.equal(upsertUserProgress.calls[0]?.[1].lastActiveAt, occurredAt);
});

test("an unparseable or future occurredAt is replaced by the server time", async () => {
  for (const occurredAt of ["not-a-date", "2999-01-01T00:00:00.000Z"]) {
    upsertUserProgress.calls.length = 0;
    const before = Date.now();
    const res = await POST(sessionRequest({ bookId: "book-1", deltaMs: 5000, occurredAt }));
    assert.equal(res.status, 200);
    const stored = upsertUserProgress.calls[0]?.[1].lastActiveAt ?? "";
    const storedMs = new Date(stored).getTime();
    assert.ok(storedMs >= before - 1000 && storedMs <= Date.now() + 1000, `${occurredAt} -> ${stored}`);
  }
});
