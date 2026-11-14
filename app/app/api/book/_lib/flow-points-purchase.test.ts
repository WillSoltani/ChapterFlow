import { test, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { BookApiError } from "./errors";

// API-10: every cancelled shop purchase said "insufficient points", even when
// the reader had plenty and the item was already owned or the write merely
// collided. These tests drive the real purchase functions in
// flow-points-repo.ts against a fake DynamoDB that cancels the transaction
// with chosen reasons.

const require = createRequire(import.meta.url);
const Module = require("node:module") as {
  _load: (request: string, parent: unknown, isMain: boolean) => unknown;
};
const originalLoad = Module._load;

type Reason = { Code: string };

function cancelled(reasons: Reason[]): Error {
  return Object.assign(new Error("Transaction cancelled"), {
    name: "TransactionCanceledException",
    CancellationReasons: reasons,
  });
}

const fakeDdb = {
  sends: 0,
  outcomes: [] as Array<Error | null>,
  async send(cmd: { constructor: { name: string } }) {
    if (cmd.constructor.name !== "TransactWriteCommand") {
      throw new Error(`unsupported command ${cmd.constructor.name}`);
    }
    fakeDdb.sends += 1;
    const outcome = fakeDdb.outcomes.shift() ?? null;
    if (outcome) throw outcome;
    return {};
  },
};

Module._load = function patchedLoad(request: string, parent: unknown, isMain: boolean) {
  if (request === "server-only") return {};
  if (request === "@/app/app/api/_lib/aws") return { ddbDoc: fakeDdb };
  return originalLoad.call(this, request, parent, isMain);
};

let repo: typeof import("./flow-points-repo");

before(async () => {
  repo = await import("./flow-points-repo");
});

beforeEach(() => {
  fakeDdb.sends = 0;
  fakeDdb.outcomes = [];
});

const TABLE = "book-table-test";
const NONE = { Code: "None" };
const FAILED = { Code: "ConditionalCheckFailed" };
const CONFLICT = { Code: "TransactionConflict" };

const gift = () =>
  repo.purchaseGiftAFriend(TABLE, {
    userId: "u1",
    cost: 1000,
    giftCode: "GIFT-TEST",
    now: "2026-11-13T10:00:00.000Z",
    transactionId: "tx-1",
    sourceId: "gift-a-friend",
    rewardName: "Gift a Friend",
  });

const item = () =>
  repo.purchasePersonalizationItem(TABLE, {
    userId: "u1",
    cost: 200,
    itemId: "theme-ocean",
    itemType: "theme",
    itemName: "Ocean",
    now: "2026-11-13T10:00:00.000Z",
    transactionId: "tx-1",
  });

function isApiError(status: number, code: string) {
  return (error: unknown) =>
    error instanceof BookApiError && error.status === status && error.code === code;
}

test("item: balance condition failed -> 400 insufficient_points", async () => {
  fakeDdb.outcomes = [cancelled([FAILED, NONE, NONE])];
  await assert.rejects(item(), isApiError(400, "insufficient_points"));
  assert.equal(fakeDdb.sends, 1);
});

test("item: inventory condition failed -> 409 already_owned", async () => {
  fakeDdb.outcomes = [cancelled([NONE, FAILED, NONE])];
  await assert.rejects(item(), isApiError(409, "already_owned"));
  assert.equal(fakeDdb.sends, 1);
});

test("item: a conflicting write is retried once and then succeeds", async () => {
  fakeDdb.outcomes = [cancelled([CONFLICT, NONE, NONE]), null];
  await item();
  assert.equal(fakeDdb.sends, 2);
});

test("item: a conflict on both attempts -> 503 throttled", async () => {
  fakeDdb.outcomes = [cancelled([CONFLICT, NONE, NONE]), cancelled([NONE, CONFLICT, NONE])];
  await assert.rejects(item(), isApiError(503, "throttled"));
  assert.equal(fakeDdb.sends, 2);
});

test("gift: balance condition failed -> 400 insufficient_points", async () => {
  fakeDdb.outcomes = [cancelled([FAILED, NONE, NONE])];
  await assert.rejects(gift(), isApiError(400, "insufficient_points"));
  assert.equal(fakeDdb.sends, 1);
});

test("gift: gift-code condition failed -> 409 already_owned", async () => {
  fakeDdb.outcomes = [cancelled([NONE, NONE, FAILED])];
  await assert.rejects(gift(), isApiError(409, "already_owned"));
  assert.equal(fakeDdb.sends, 1);
});

test("gift: a cancellation without a known reason is retried once, then 503 throttled", async () => {
  fakeDdb.outcomes = [cancelled([]), cancelled([])];
  await assert.rejects(gift(), isApiError(503, "throttled"));
  assert.equal(fakeDdb.sends, 2);
});

test("gift: a retried purchase that then succeeds resolves", async () => {
  fakeDdb.outcomes = [cancelled([NONE, CONFLICT, NONE]), null];
  await gift();
  assert.equal(fakeDdb.sends, 2);
});

test("admin deduction over the user's balance keeps the admin-facing message", async () => {
  fakeDdb.outcomes = [cancelled([FAILED, NONE])];
  await assert.rejects(
    repo.adjustEngagementPointsAdmin(TABLE, {
      userId: "u1",
      amount: -500,
      reason: "test",
      adminUserId: "admin-1",
    }),
    (error: unknown) =>
      error instanceof BookApiError &&
      error.status === 400 &&
      error.code === "insufficient_balance" &&
      error.message === "User does not have enough points for this deduction."
  );
  assert.equal(fakeDdb.sends, 1);
});

test("a non-transaction error is rethrown unchanged and not retried", async () => {
  const boom = Object.assign(new Error("boom"), { name: "InternalServerError" });
  fakeDdb.outcomes = [boom];
  await assert.rejects(item(), (error: unknown) => error === boom);
  assert.equal(fakeDdb.sends, 1);
});
