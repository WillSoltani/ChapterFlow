import { test, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { bookUserPk, profileSk } from "@/app/app/api/book/_lib/keys";

// API-12: profile writes were unconditional read-modify-write Puts, so two
// saves in flight (two devices, or onboarding completion racing a profile
// edit) silently dropped one side's fields. These tests drive the real
// user-profile-repo.ts against an in-memory fake DynamoDB.

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
  if (expr === "attribute_not_exists(PK)") return !existing;
  if (expr === "updatedAt = :expected") {
    const values = input.ExpressionAttributeValues as Record<string, unknown>;
    return !!existing && existing.updatedAt === values[":expected"];
  }
  throw new Error(`unsupported condition: ${expr}`);
}

const fakeDdb = {
  puts: 0,
  beforePut: undefined as ((attempt: number) => void) | undefined,
  async send(cmd: FakeCommand) {
    if (cmd.constructor.name === "GetCommand") {
      const key = cmd.input.Key as { PK: string; SK: string };
      return { Item: clone(store.get(`${key.PK}|${key.SK}`)) };
    }
    if (cmd.constructor.name === "PutCommand") {
      fakeDdb.puts += 1;
      fakeDdb.beforePut?.(fakeDdb.puts);
      const item = cmd.input.Item as FakeItem;
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
  return originalLoad.call(this, request, parent, isMain);
};

let repo: typeof import("./user-profile-repo");

before(async () => {
  repo = await import("./user-profile-repo");
});

const TABLE = "book-table-test";
const USER = "user-1";
const KEY = `${bookUserPk(USER)}|${profileSk()}`;

function seed(profile: Record<string, unknown>, updatedAt = "2026-01-01T00:00:00.000Z") {
  store.set(KEY, {
    PK: bookUserPk(USER),
    SK: profileSk(),
    entity: "BOOK_USER_PROFILE",
    userId: USER,
    profile,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt,
  });
}

function storedProfile(): Record<string, unknown> {
  return (store.get(KEY)?.profile ?? {}) as Record<string, unknown>;
}

beforeEach(() => {
  store.clear();
  fakeDdb.puts = 0;
  fakeDdb.beforePut = undefined;
});

test("putUserProfileItem without expectedUpdatedAt still writes unconditionally", async () => {
  seed({ displayName: "Old" });
  await repo.putUserProfileItem(TABLE, { userId: USER, profile: { displayName: "New" } });
  assert.equal(storedProfile().displayName, "New");
});

test("putUserProfileItem rejects a stale expectedUpdatedAt", async () => {
  seed({ displayName: "Old" }, "2026-01-02T00:00:00.000Z");
  await assert.rejects(
    repo.putUserProfileItem(TABLE, {
      userId: USER,
      profile: { displayName: "New" },
      expectedUpdatedAt: "2026-01-01T00:00:00.000Z",
    }),
    { name: "ConditionalCheckFailedException" }
  );
  assert.equal(storedProfile().displayName, "Old");
});

test("putUserProfileItem with expectedUpdatedAt '' only creates a missing row", async () => {
  seed({ displayName: "Old" });
  await assert.rejects(
    repo.putUserProfileItem(TABLE, {
      userId: USER,
      profile: { displayName: "New" },
      expectedUpdatedAt: "",
    }),
    { name: "ConditionalCheckFailedException" }
  );
  store.clear();
  await repo.putUserProfileItem(TABLE, {
    userId: USER,
    profile: { displayName: "New" },
    expectedUpdatedAt: "",
  });
  assert.equal(storedProfile().displayName, "New");
});

test("updateUserProfileItem re-reads and keeps a concurrent write", async () => {
  seed({ displayName: "Ada", dailyGoalMinutes: 20 });
  fakeDdb.beforePut = (attempt) => {
    // Another device saves between our read and our first write.
    if (attempt === 1) seed({ displayName: "Ada", dailyGoalMinutes: 20, bio: "Hi" }, "2026-01-03T00:00:00.000Z");
  };
  let calls = 0;
  const saved = await repo.updateUserProfileItem(TABLE, USER, (current) => {
    calls += 1;
    return { ...current, dailyGoalMinutes: 5 };
  });
  assert.equal(calls, 2);
  assert.deepEqual(storedProfile(), { displayName: "Ada", dailyGoalMinutes: 5, bio: "Hi" });
  assert.deepEqual(saved.profile, storedProfile());
  assert.equal(saved.createdAt, "2026-01-01T00:00:00.000Z");
});

test("updateUserProfileItem creates the row when none exists", async () => {
  const saved = await repo.updateUserProfileItem(TABLE, USER, (current) => ({
    ...current,
    displayName: "Ada",
  }));
  assert.deepEqual(storedProfile(), { displayName: "Ada" });
  assert.ok(saved.updatedAt);
});

test("updateUserProfileItem gives up with 409 profile_write_conflict", async () => {
  seed({ displayName: "Ada" });
  fakeDdb.beforePut = (attempt) => {
    seed({ displayName: `Other ${attempt}` }, `2026-02-0${attempt}T00:00:00.000Z`);
  };
  await assert.rejects(
    repo.updateUserProfileItem(TABLE, USER, (current) => ({ ...current, bio: "Mine" })),
    (error: unknown) => {
      const e = error as { status?: number; code?: string };
      return e.status === 409 && e.code === "profile_write_conflict";
    }
  );
  assert.equal(fakeDdb.puts, 4);
  assert.equal(storedProfile().bio, undefined);
});

test("updateUserProfileItem skips the write when apply returns null", async () => {
  seed({ displayName: "Ada", termsAcceptedAt: "2026-01-01T00:00:00.000Z" });
  const saved = await repo.updateUserProfileItem(TABLE, USER, () => null);
  assert.equal(fakeDdb.puts, 0);
  assert.equal(saved?.profile.displayName, "Ada");
});
