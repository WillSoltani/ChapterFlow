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

let storedSettings: Record<string, unknown> = {};
const putUserSettingsItem = makeSpy(async () => {
  throw new Error("the PATCH must not blind-write settings");
});
// Mirrors the real optimistic-concurrency helper: apply() runs on the CURRENT
// stored settings, and its result is what gets written.
const updateUserSettingsItem = makeSpy(
  async (
    _table: string,
    userId: string,
    apply: (current: Record<string, unknown>) => Record<string, unknown>,
  ) => {
    storedSettings = apply(storedSettings);
    return { userId, settings: storedSettings, createdAt: "c", updatedAt: "u" };
  },
);
const getUserSettingsItem = makeSpy(async () => ({
  userId: "user-1",
  settings: storedSettings,
  createdAt: "c",
  updatedAt: "u",
}));

const envStub = {
  getBookTableName: async () => "book-table-test",
  getAppBaseUrl: async () => "https://app.chapterflow.ca",
};

const harness = installRouteHarness({
  "@/app/app/api/book/_lib/account-guard": {
    requireActiveBookUser: guard.requireActiveBookUser,
  },
  "@/app/app/api/_lib/auth": { AuthError: StubAuthError },
  "@/app/app/api/book/_lib/env": envStub,
  "./env": envStub,
  "@/app/app/api/book/_lib/repo": {
    getUserSettingsItem,
    putUserSettingsItem,
    updateUserSettingsItem,
  },
});

let PATCH: typeof import("./route").PATCH;

before(async () => {
  ({ PATCH } = await import("./route"));
});

beforeEach(() => {
  guard.reset();
  storedSettings = {};
  putUserSettingsItem.calls.length = 0;
  updateUserSettingsItem.calls.length = 0;
  getUserSettingsItem.calls.length = 0;
});

after(() => {
  harness.restore();
});

const FAKE_JWT = "eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiIxIn0.sig";

function patchRequest(body: string): Request {
  return new Request("https://app.chapterflow.ca/app/api/book/me/onboarding/progress", {
    method: "PATCH",
    headers: { authorization: `Bearer ${FAKE_JWT}`, "content-type": "application/json" },
    body,
  });
}

async function errorCode(res: Response): Promise<string | undefined> {
  const body = (await res.json()) as { error?: { code?: string } };
  return body.error?.code;
}

test("merges the step into onboarding_progress without touching other settings", async () => {
  storedSettings = {
    theme: "dark",
    notifications: { email: false },
    onboarding_progress: { step: 1, interests: ["a"] },
  };
  const res = await PATCH(
    patchRequest(JSON.stringify({ step: 2, tone: "warm", updatedAt: "1999-01-01T00:00:00.000Z" })),
  );
  assert.equal(res.status, 200);
  assert.equal(guard.requireActiveBookUser.calls.length, 1);
  assert.equal(putUserSettingsItem.calls.length, 0, "no blind put");
  assert.equal(updateUserSettingsItem.calls.length, 1);
  assert.equal(storedSettings.theme, "dark");
  assert.deepEqual(storedSettings.notifications, { email: false });
  const progress = storedSettings.onboarding_progress as Record<string, unknown>;
  assert.equal(progress.step, 2);
  assert.equal(progress.tone, "warm");
  assert.deepEqual(progress.interests, ["a"]);
  // updatedAt is reserved: the server stamps it, the client value is dropped.
  assert.notEqual(progress.updatedAt, "1999-01-01T00:00:00.000Z");
  assert.equal(typeof progress.updatedAt, "string");
});

test("each write applies to the current stored settings, keeping other writers' changes", async () => {
  storedSettings = { theme: "light" };
  const res = await PATCH(patchRequest(JSON.stringify({ step: 3 })));
  assert.equal(res.status, 200);
  storedSettings = { ...storedSettings, emailUnsubscribed: true };
  const res2 = await PATCH(patchRequest(JSON.stringify({ step: 4 })));
  assert.equal(res2.status, 200);
  assert.equal(storedSettings.emailUnsubscribed, true);
  assert.equal((storedSettings.onboarding_progress as Record<string, unknown>).step, 4);
});

test("unknown keys are still accepted (iOS sends step, interests, tone)", async () => {
  const res = await PATCH(
    patchRequest(JSON.stringify({ step: 1, interests: ["x"], tone: "direct", somethingNew: true })),
  );
  assert.equal(res.status, 200);
  assert.equal((storedSettings.onboarding_progress as Record<string, unknown>).somethingNew, true);
});

test("more than 32 keys in the body is rejected and nothing is written", async () => {
  const body: Record<string, number> = {};
  for (let i = 0; i < 33; i += 1) body[`k${i}`] = i;
  const res = await PATCH(patchRequest(JSON.stringify(body)));
  assert.equal(res.status, 413);
  assert.equal(await errorCode(res), "payload_too_large");
  assert.equal(updateUserSettingsItem.calls.length, 0);
});

test("a body that would grow settings past the size cap is rejected", async () => {
  const res = await PATCH(patchRequest(JSON.stringify({ notes: "x".repeat(40_000) })));
  assert.equal(res.status, 413);
  assert.equal(await errorCode(res), "payload_too_large");
  assert.equal(storedSettings.onboarding_progress, undefined);
});

test("a malformed body is 400 invalid_json", async () => {
  const res = await PATCH(patchRequest("{not json"));
  assert.equal(res.status, 400);
  assert.equal(await errorCode(res), "invalid_json");
  assert.equal(updateUserSettingsItem.calls.length, 0);
});
