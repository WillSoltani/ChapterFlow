import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { BookApiError } from "@/app/app/api/book/_lib/errors";

const require = createRequire(import.meta.url);
const Module = require("node:module") as {
  _load: (request: string, parent: unknown, isMain: boolean) => unknown;
};
const originalLoad = Module._load;

function makeSpy<TArgs extends unknown[], TResult>(
  impl: (...args: TArgs) => TResult,
) {
  const spy = ((...args: TArgs) => {
    spy.calls.push(args);
    return impl(...args);
  }) as ((...args: TArgs) => TResult) & { calls: TArgs[] };
  spy.calls = [];
  return spy;
}

const purchaseStreakShield = makeSpy(async () => ({
  purchased: true as const,
  shieldsHeld: 2,
  balance: 125,
}));

let accountGuardError: BookApiError | null = null;

Module._load = function patchedLoad(
  request: string,
  parent: unknown,
  isMain: boolean,
) {
  if (request === "server-only") return {};

  if (request === "@/app/app/api/book/_lib/account-guard") {
    return {
      requireActiveBookUser: async () => {
        if (accountGuardError) throw accountGuardError;
        return { sub: "user-1", email: "user@test" };
      },
    };
  }

  if (request === "@/app/app/api/book/_lib/env" || request === "./env") {
    return {
      getBookTableName: async () => "book-table-test",
      getAppBaseUrl: async () => "https://app.chapterflow.ca",
    };
  }

  if (request === "@/app/app/api/book/_lib/streak-repo") {
    return {
      getOrCreateStreak: async () => {
        throw new Error("GET is outside this route test");
      },
      purchaseStreakShield,
      STREAK_MILESTONES: [],
    };
  }

  return originalLoad.call(this, request, parent, isMain);
};

let POST: typeof import("./route").POST;

before(async () => {
  ({ POST } = await import("./route"));
});

beforeEach(() => {
  accountGuardError = null;
  purchaseStreakShield.calls.length = 0;
});

after(() => {
  Module._load = originalLoad;
});

const FAKE_JWT = "eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiIxIn0.sig";

function streakRequest(body?: string): Request {
  return new Request("https://app.chapterflow.ca/app/api/book/me/streak", {
    method: "POST",
    headers: {
      authorization: `Bearer ${FAKE_JWT}`,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(body === undefined ? {} : { body }),
  });
}

async function assertValidationError(
  body: string,
  expectedCode: "invalid_action" | "invalid_input" | "invalid_json",
): Promise<void> {
  const response = await POST(streakRequest(body));
  assert.equal(response.status, 400);
  const payload = (await response.json()) as {
    error?: { code?: string; message?: string; requestId?: string };
  };
  assert.equal(payload.error?.code, expectedCode);
  assert.equal(typeof payload.error?.message, "string");
  assert.equal(typeof payload.error?.requestId, "string");
  assert.equal(
    purchaseStreakShield.calls.length,
    0,
    "invalid input must never spend Insight Points",
  );
}

test("missing body keeps the documented purchase_shield default", async () => {
  const response = await POST(streakRequest());
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    ok: true,
    shieldsHeld: 2,
    balance: 125,
    message:
      "Streak Shield purchased. It will automatically protect your streak if you miss a day.",
  });
  assert.deepEqual(purchaseStreakShield.calls, [["book-table-test", "user-1"]]);
});

test("explicit empty body returns invalid_json without purchasing", async () => {
  await assertValidationError("", "invalid_json");
});

test("explicit purchase_shield action purchases exactly once", async () => {
  const response = await POST(
    streakRequest(JSON.stringify({ action: "purchase_shield" })),
  );
  assert.equal(response.status, 200);
  assert.equal(purchaseStreakShield.calls.length, 1);
});

test("unknown action returns invalid_action without purchasing", async () => {
  await assertValidationError(
    JSON.stringify({ action: "foo" }),
    "invalid_action",
  );
});

test("numeric action returns invalid_input without purchasing", async () => {
  await assertValidationError(
    JSON.stringify({ action: 123 }),
    "invalid_input",
  );
});

test("overlong action returns invalid_input without purchasing", async () => {
  await assertValidationError(
    JSON.stringify({ action: "x".repeat(51) }),
    "invalid_input",
  );
});

test("non-object body returns invalid_json without purchasing", async () => {
  await assertValidationError(JSON.stringify(["purchase_shield"]), "invalid_json");
});

test("malformed non-empty JSON returns invalid_json without purchasing", async () => {
  await assertValidationError('{"action":', "invalid_json");
});

test("inactive-account guard error uses the real route envelope and never purchases", async () => {
  accountGuardError = new BookApiError(
    403,
    "account_inactive",
    "An active account is required.",
  );

  const response = await POST(streakRequest());
  assert.equal(response.status, 403);
  const payload = (await response.json()) as {
    error?: { code?: string; message?: string; requestId?: string };
  };
  assert.equal(payload.error?.code, "account_inactive");
  assert.equal(payload.error?.message, "An active account is required.");
  assert.equal(typeof payload.error?.requestId, "string");
  assert.equal(purchaseStreakShield.calls.length, 0);
});
