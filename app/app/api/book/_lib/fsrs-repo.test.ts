import { test, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { bookUserPk, fsrsCardSk } from "@/app/app/api/book/_lib/keys";
import { createNewCard, scheduleCard } from "./fsrs";
import type { FSRSCardState } from "./types";

// API-16: grading a review card read the card, scheduled it and wrote it back
// unconditionally, so two grades in flight both advanced the card and both
// wrote a review log. These tests drive the real fsrs-repo.ts against an
// in-memory fake DynamoDB.

const require = createRequire(import.meta.url);
const Module = require("node:module") as {
  _load: (request: string, parent: unknown, isMain: boolean) => unknown;
};
const originalLoad = Module._load;

type FakeItem = Record<string, unknown>;
type FakeCommand = { constructor: { name: string }; input: Record<string, unknown> };

const store = new Map<string, FakeItem>();
const clone = <T>(value: T): T =>
  value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T);

function conditionHolds(input: Record<string, unknown>, existing: FakeItem | undefined): boolean {
  const expr = input.ConditionExpression as string | undefined;
  if (!expr) return true;
  if (expr === "reps = :expectedReps") {
    const values = input.ExpressionAttributeValues as Record<string, unknown>;
    return !!existing && existing.reps === values[":expectedReps"];
  }
  throw new Error(`unsupported condition: ${expr}`);
}

const fakeDdb = {
  gets: 0,
  beforePut: undefined as ((item: FakeItem) => void) | undefined,
  async send(cmd: FakeCommand) {
    if (cmd.constructor.name === "GetCommand") {
      fakeDdb.gets += 1;
      const key = cmd.input.Key as { PK: string; SK: string };
      return { Item: clone(store.get(`${key.PK}|${key.SK}`)) };
    }
    if (cmd.constructor.name === "PutCommand") {
      const item = cmd.input.Item as FakeItem;
      fakeDdb.beforePut?.(item);
      const key = `${String(item.PK)}|${String(item.SK)}`;
      if (!conditionHolds(cmd.input, store.get(key))) {
        throw Object.assign(new Error("ConditionalCheckFailedException"), {
          name: "ConditionalCheckFailedException",
        });
      }
      store.set(key, clone(item));
      return {};
    }
    throw new Error(`unsupported command ${cmd.constructor.name}`);
  },
};

Module._load = function patchedLoad(request: string, parent: unknown, isMain: boolean) {
  if (request === "server-only") return {};
  if (request === "@/app/app/api/_lib/aws") return { ddbDoc: fakeDdb };
  if (request === "./repo") {
    // Free reader: the scheduler uses the default retention.
    return {
      getUserEntitlement: async () => null,
      getUserSettingsItem: async () => null,
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};

let recordReview: typeof import("./fsrs-repo").recordReview;

before(async () => {
  ({ recordReview } = await import("./fsrs-repo"));
});

const TABLE = "book-table-test";
const USER = "user-1";
const CARD_ID = "book-1#1#c1";
const CARD_KEY = `${bookUserPk(USER)}|${fsrsCardSk(CARD_ID)}`;

function seedCard(card: FSRSCardState): void {
  store.set(CARD_KEY, { PK: bookUserPk(USER), SK: fsrsCardSk(CARD_ID), ...clone(card) });
}

function storedCard(): FSRSCardState {
  return store.get(CARD_KEY) as unknown as FSRSCardState;
}

function reviewLogs(): FakeItem[] {
  return [...store.entries()]
    .filter(([key]) => key !== CARD_KEY)
    .map(([, item]) => item);
}

function freshCard(): FSRSCardState {
  return createNewCard(CARD_ID, USER, "book-1", 1, "Front", "Back");
}

beforeEach(() => {
  store.clear();
  fakeDdb.gets = 0;
  fakeDdb.beforePut = undefined;
});

test("recordReview advances the card it was given and writes one log", async () => {
  const card = freshCard();
  seedCard(card);
  const updated = await recordReview(TABLE, USER, CARD_ID, 3, card);
  assert.equal(updated.reps, card.reps + 1);
  assert.equal(storedCard().reps, card.reps + 1);
  assert.equal(reviewLogs().length, 1);
  // The route already read the card; recordReview must not read it again.
  assert.equal(fakeDdb.gets, 0);
});

test("a second grade from the same read does not advance the card again", async () => {
  const card = freshCard();
  seedCard(card);
  const first = await recordReview(TABLE, USER, CARD_ID, 3, card);
  // A double tap: the second request read the card before the first saved.
  const second = await recordReview(TABLE, USER, CARD_ID, 1, card);
  assert.equal(storedCard().reps, card.reps + 1);
  assert.deepEqual(second, storedCard());
  assert.equal(second.reps, first.reps);
  assert.equal(reviewLogs().length, 1);
});

test("losing the race returns the card the other grade saved", async () => {
  const card = freshCard();
  seedCard(card);
  fakeDdb.beforePut = (item) => {
    if (item.SK !== fsrsCardSk(CARD_ID)) return;
    fakeDdb.beforePut = undefined;
    // The other request's grade lands between our read and our write.
    const winner = scheduleCard(card, 4, new Date(), 0.9);
    seedCard(winner);
  };
  const result = await recordReview(TABLE, USER, CARD_ID, 1, card);
  assert.equal(result.reps, card.reps + 1);
  assert.deepEqual(result, storedCard());
  assert.equal(reviewLogs().length, 0);
});

test("recordReview without a card still reads it first (existing callers)", async () => {
  const card = freshCard();
  seedCard(card);
  const updated = await recordReview(TABLE, USER, CARD_ID, 3);
  assert.equal(updated.reps, card.reps + 1);
  assert.equal(fakeDdb.gets, 1);
  assert.equal(reviewLogs().length, 1);
});
