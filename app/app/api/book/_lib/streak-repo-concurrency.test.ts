import { test, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
// keys.ts is pure (no server-only / AWS imports) — imported REAL and up front
// (before the Module._load patch below) so seeds/expected keys use the exact
// same helpers streak-repo.ts uses internally.
import { bookUserPk, engagementSk, streakSk } from "@/app/app/api/book/_lib/keys";

// WS4-008 (TDD red): updateStreakOnLoopComplete (streak-repo.ts) reads the
// streak (getOrCreateStreak), awaits an intervening QueryCommand
// (computeConsistencyLast30), then issues an UNCONDITIONAL UpdateCommand that
// SETs streakShieldsHeld = :ssh from that STALE read. purchaseStreakShield
// (same file) concurrently commits a TransactWrite that ADDs
// streakShieldsHeld +1 and deducts 100 IP. If the purchase lands in the
// read -> write window, the loop-complete SET clobbers it: IP spent, shield
// lost.
//
// This file drives the REAL streak-repo.ts against an in-memory fake
// DynamoDB (no server-only / no AWS), interleaving a real concurrent
// purchaseStreakShield() call mid-flight via a `beforeSend` hook on the fake
// client, and asserts the PINNED FIX end-state:
//   - loop-complete write stops SETting streakShieldsHeld; when
//     shieldsConsumed > 0 it uses a relative `ADD streakShieldsHeld
//     :negConsumed` guarded by `streakShieldsHeld >= :consumed`; when
//     shieldsConsumed === 0 it does not touch streakShieldsHeld at all.
//   - the write is additionally guarded by
//     `(attribute_not_exists(lastActiveDate) OR lastActiveDate = :prevLad)`
//     so concurrent same-day loop-completes serialize (retry -> no-op).
//
// Against CURRENT (unfixed) code these tests are RED — see the per-test
// comments for the exact current-vs-fixed derivation. Test 4 is a harness
// sanity check (purchaseStreakShield alone) and must be GREEN today.

const require = createRequire(import.meta.url);
const Module = require("node:module") as {
  _load: (request: string, parent: unknown, isMain: boolean) => unknown;
};
const originalLoad = Module._load;

// ── In-memory fake DynamoDB ─────────────────────────────────────────────────
//
// store: Map<"PK|SK", item>. Deep clones on read AND on write, mimicking
// DynamoDB item isolation (mutating a returned Item must never mutate the
// store).

type FakeItem = Record<string, unknown>;

const store = new Map<string, FakeItem>();

function clone<T>(value: T): T {
  return value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T);
}

function storeKey(pk: string, sk: string): string {
  return `${pk}|${sk}`;
}

function throwConditionalCheckFailed(): never {
  throw Object.assign(new Error("ConditionalCheckFailedException"), {
    name: "ConditionalCheckFailedException",
  });
}

function throwTransactionCanceled(): never {
  throw Object.assign(new Error("TransactionCanceledException"), {
    name: "TransactionCanceledException",
  });
}

// ── Minimal recursive condition-expression evaluator ────────────────────────
//
// Supports exactly: top-level AND of clauses; a clause is
// attribute_not_exists(name), attribute_exists(name), `name = :v`,
// `name >= :v`, `name < :v`, or a parenthesized OR-group
// `(clauseA OR clauseB)`. Throws loudly on anything else — a drift guard so a
// future UpdateExpression/ConditionExpression change can't silently pass this
// harness.

function splitTopLevel(expr: string, sep: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < expr.length; i++) {
    const c = expr[i];
    if (c === "(") depth++;
    else if (c === ")") depth--;
    if (depth === 0 && expr.slice(i, i + sep.length) === sep) {
      parts.push(expr.slice(start, i));
      i += sep.length - 1;
      start = i + 1;
    }
  }
  parts.push(expr.slice(start));
  return parts;
}

function resolveValue(token: string, values: Record<string, unknown>): unknown {
  if (!(token in values)) {
    throw new Error(`unsupported expression: unresolved value token ${token}`);
  }
  return values[token];
}

function evalClause(
  clause: string,
  item: FakeItem | undefined,
  values: Record<string, unknown>
): boolean {
  const trimmed = clause.trim();
  let m: RegExpExecArray | null;

  if ((m = /^attribute_not_exists\((\w+)\)$/.exec(trimmed))) {
    return !item || !(m[1]! in item); // regex capture group 1 is always present on a match
  }
  if ((m = /^attribute_exists\((\w+)\)$/.exec(trimmed))) {
    return !!item && m[1]! in item; // regex capture group 1 is always present on a match
  }
  if ((m = /^(\w+)\s*>=\s*(:\w+)$/.exec(trimmed))) {
    const [, name, token] = m;
    if (name === undefined || token === undefined) return false;
    if (!item || !(name in item)) return false;
    return Number(item[name]) >= Number(resolveValue(token, values));
  }
  if ((m = /^(\w+)\s*<\s*(:\w+)$/.exec(trimmed))) {
    const [, name, token] = m;
    if (name === undefined || token === undefined) return false;
    if (!item || !(name in item)) return false;
    return Number(item[name]) < Number(resolveValue(token, values));
  }
  if ((m = /^(\w+)\s*=\s*(:\w+)$/.exec(trimmed))) {
    const [, name, token] = m;
    if (name === undefined || token === undefined) return false;
    if (!item || !(name in item)) return false;
    const v = resolveValue(token, values);
    return item[name] === v;
  }

  throw new Error(`unsupported expression: ${clause}`);
}

function evalCondition(
  expr: string | undefined,
  item: FakeItem | undefined,
  values: Record<string, unknown>
): boolean {
  if (!expr) return true;
  const clauses = splitTopLevel(expr.trim(), " AND ");
  for (const raw of clauses) {
    const clause = raw.trim();
    if (clause.startsWith("(") && clause.endsWith(")")) {
      const inner = clause.slice(1, -1);
      const orParts = splitTopLevel(inner, " OR ");
      const ok = orParts.some((p) => evalClause(p, item, values));
      if (!ok) return false;
    } else if (!evalClause(clause, item, values)) {
      return false;
    }
  }
  return true;
}

// ── UpdateExpression applier ────────────────────────────────────────────────
//
// Supports exactly: `SET name = :v, name = :v, ...` optionally followed by
// ` ADD name :v, name :v, ...`. No ExpressionAttributeNames aliasing and no
// if_not_exists(...) — streak-repo.ts's own UpdateExpressions never use
// either (only flow-points-repo.ts does, via awardFlowPoints /
// getUserFlowPointsState, both of which are stubbed out below and never reach
// this fake client). Throws loudly on anything else.

function splitCommaTopLevel(s: string): string[] {
  return splitTopLevel(s, ",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function parseAssignments(s: string): Array<{ name: string; token: string }> {
  return splitCommaTopLevel(s).map((pair) => {
    const m = /^(\S+)\s*=\s*(:\S+)$/.exec(pair);
    if (!m) throw new Error(`unsupported expression: SET clause "${pair}"`);
    return { name: m[1]!, token: m[2]! }; // both capture groups present on a match
  });
}

function parseAdds(s: string): Array<{ name: string; token: string }> {
  return splitCommaTopLevel(s).map((pair) => {
    const m = /^(\S+)\s+(:\S+)$/.exec(pair);
    if (!m) throw new Error(`unsupported expression: ADD clause "${pair}"`);
    return { name: m[1]!, token: m[2]! }; // both capture groups present on a match
  });
}

function applyUpdateExpression(
  expr: string,
  item: FakeItem,
  values: Record<string, unknown>
): FakeItem {
  const trimmed = expr.trim();
  if (!trimmed.startsWith("SET ")) {
    throw new Error(`unsupported expression: ${expr}`);
  }
  const addIdx = trimmed.indexOf(" ADD ");
  const setStr = addIdx === -1 ? trimmed.slice(4) : trimmed.slice(4, addIdx);
  const addStr = addIdx === -1 ? null : trimmed.slice(addIdx + 5);

  const next: FakeItem = { ...item };
  for (const { name, token } of parseAssignments(setStr)) {
    next[name] = resolveValue(token, values);
  }
  if (addStr) {
    for (const { name, token } of parseAdds(addStr)) {
      const delta = Number(resolveValue(token, values));
      const prior = typeof next[name] === "number" ? (next[name] as number) : 0;
      next[name] = prior + delta;
    }
  }
  return next;
}

// ── Fake ddbDoc ──────────────────────────────────────────────────────────────

type FakeCommand = { constructor: { name: string }; input: Record<string, unknown> };

const fakeDdb: {
  beforeSend?: (cmd: FakeCommand) => Promise<void>;
  send: (cmd: FakeCommand) => Promise<Record<string, unknown>>;
} = {
  beforeSend: undefined,
  async send(cmd: FakeCommand) {
    const hook = fakeDdb.beforeSend;
    if (hook) {
      await hook(cmd);
    }

    switch (cmd.constructor.name) {
      case "GetCommand": {
        const key = cmd.input.Key as { PK: string; SK: string };
        return { Item: clone(store.get(storeKey(key.PK, key.SK))) };
      }
      case "QueryCommand": {
        if (cmd.input.Select === "COUNT") {
          return { Count: 0 };
        }
        throw new Error("unsupported expression: QueryCommand without Select COUNT");
      }
      case "PutCommand": {
        const item = cmd.input.Item as FakeItem;
        const key = storeKey(item.PK as string, item.SK as string);
        const existing = store.get(key);
        if (
          !evalCondition(
            cmd.input.ConditionExpression as string | undefined,
            existing,
            (cmd.input.ExpressionAttributeValues as Record<string, unknown>) ?? {}
          )
        ) {
          throwConditionalCheckFailed();
        }
        store.set(key, clone(item));
        return {};
      }
      case "UpdateCommand": {
        const keyAttr = cmd.input.Key as { PK: string; SK: string };
        const key = storeKey(keyAttr.PK, keyAttr.SK);
        const existing = store.get(key);
        if (
          !evalCondition(
            cmd.input.ConditionExpression as string | undefined,
            existing,
            (cmd.input.ExpressionAttributeValues as Record<string, unknown>) ?? {}
          )
        ) {
          throwConditionalCheckFailed();
        }
        const base: FakeItem = existing ?? { PK: keyAttr.PK, SK: keyAttr.SK };
        const next = applyUpdateExpression(
          cmd.input.UpdateExpression as string,
          base,
          (cmd.input.ExpressionAttributeValues as Record<string, unknown>) ?? {}
        );
        store.set(key, clone(next));
        return { Attributes: clone(next) };
      }
      case "TransactWriteCommand": {
        const items = cmd.input.TransactItems as Array<{
          Put?: { Item: FakeItem; ConditionExpression?: string; ExpressionAttributeValues?: Record<string, unknown> };
          Update?: {
            Key: { PK: string; SK: string };
            UpdateExpression: string;
            ConditionExpression?: string;
            ExpressionAttributeValues?: Record<string, unknown>;
          };
        }>;

        // Phase 1: validate every item's condition against the CURRENT store
        // before applying anything (atomicity).
        for (const it of items) {
          if (it.Put) {
            const key = storeKey(it.Put.Item.PK as string, it.Put.Item.SK as string);
            const existing = store.get(key);
            if (!evalCondition(it.Put.ConditionExpression, existing, it.Put.ExpressionAttributeValues ?? {})) {
              throwTransactionCanceled();
            }
          } else if (it.Update) {
            const key = storeKey(it.Update.Key.PK, it.Update.Key.SK);
            const existing = store.get(key);
            if (
              !evalCondition(it.Update.ConditionExpression, existing, it.Update.ExpressionAttributeValues ?? {})
            ) {
              throwTransactionCanceled();
            }
          } else {
            throw new Error("unsupported expression: unsupported TransactItem shape");
          }
        }

        // Phase 2: apply.
        for (const it of items) {
          if (it.Put) {
            const key = storeKey(it.Put.Item.PK as string, it.Put.Item.SK as string);
            store.set(key, clone(it.Put.Item));
          } else if (it.Update) {
            const key = storeKey(it.Update.Key.PK, it.Update.Key.SK);
            const existing = store.get(key);
            const base: FakeItem = existing ?? { PK: it.Update.Key.PK, SK: it.Update.Key.SK };
            const next = applyUpdateExpression(
              it.Update.UpdateExpression,
              base,
              it.Update.ExpressionAttributeValues ?? {}
            );
            store.set(key, clone(next));
          }
        }
        return {};
      }
      default:
        throw new Error(`unsupported expression: unknown command ${cmd.constructor.name}`);
    }
  },
};

// ── Module._load patch (established repo pattern — see
// app/app/api/book/billing/checkout-session/route.test.ts) ─────────────────

Module._load = function patchedLoad(request: string, parent: unknown, isMain: boolean) {
  if (request === "server-only") return {};

  if (request === "@/app/app/api/_lib/aws") {
    // streak-repo.ts imports ONLY `ddbDoc` from this module (confirmed by
    // grep of its import list) — no other symbol needs stubbing.
    return { ddbDoc: fakeDdb };
  }

  if (request === "@/app/app/api/book/_lib/flow-points-repo") {
    return {
      awardFlowPoints: async () => ({ awarded: true, reason: null, state: { points: 0 } }),
      getUserFlowPointsState: async (_tableName: string, userId: string) => {
        const item = store.get(storeKey(bookUserPk(userId), engagementSk()));
        return { points: typeof item?.points === "number" ? (item.points as number) : 0 };
      },
    };
  }

  return originalLoad.call(this, request, parent, isMain);
};

let updateStreakOnLoopComplete: typeof import("./streak-repo").updateStreakOnLoopComplete;
let purchaseStreakShield: typeof import("./streak-repo").purchaseStreakShield;
let getTodayInTimezone: typeof import("./streak-repo").getTodayInTimezone;

before(async () => {
  const mod = await import("./streak-repo");
  updateStreakOnLoopComplete = mod.updateStreakOnLoopComplete;
  purchaseStreakShield = mod.purchaseStreakShield;
  getTodayInTimezone = mod.getTodayInTimezone;
});

// ── Fixtures ─────────────────────────────────────────────────────────────────

const TABLE = "book-table-test";
const USER_ID = "user-1";

function addDaysUTC(date: string, offset: number): string {
  const ms = new Date(date + "T00:00:00Z").getTime() + offset * 24 * 60 * 60 * 1000;
  return new Date(ms).toISOString().slice(0, 10);
}

function streakKey(): string {
  return storeKey(bookUserPk(USER_ID), streakSk());
}

function engagementKey(): string {
  return storeKey(bookUserPk(USER_ID), engagementSk());
}

function seed(opts: { lastActiveDate: string | null; streakShieldsHeld: number; currentStreak?: number; points?: number }): void {
  store.clear();
  fakeDdb.beforeSend = undefined;

  const currentStreak = opts.currentStreak ?? 5;
  const seedIso = "2026-01-01T00:00:00.000Z";

  store.set(streakKey(), {
    PK: bookUserPk(USER_ID),
    SK: streakSk(),
    entity: "BOOK_USER_STREAK",
    userId: USER_ID,
    currentStreak,
    longestStreak: currentStreak,
    lastActiveDate: opts.lastActiveDate,
    lastActiveTimezone: "UTC",
    streakShieldsHeld: opts.streakShieldsHeld,
    shieldUsedDates: [],
    consistencyLast30: 0,
    consistencyAbove80Since: null,
    milestonesReached: [],
    createdAt: seedIso,
    updatedAt: seedIso,
  });

  store.set(engagementKey(), {
    PK: bookUserPk(USER_ID),
    SK: engagementSk(),
    entity: "BOOK_USER_ENGAGEMENT",
    userId: USER_ID,
    points: opts.points ?? 250,
    lifetimeSpent: 0,
    totalSpendEvents: 0,
    updatedAt: seedIso,
  });
}

function ledgerRows(): FakeItem[] {
  return [...store.entries()]
    .filter(([k]) => k.startsWith(`${bookUserPk(USER_ID)}|FLOWPOINTS#`))
    .map(([, v]) => v);
}

beforeEach(() => {
  fakeDdb.beforeSend = undefined;
});

// ── Tests ────────────────────────────────────────────────────────────────────

test("RED — concurrent shield purchase survives a loop-complete (lost-update)", async () => {
  const today = getTodayInTimezone("UTC");
  seed({ lastActiveDate: addDaysUTC(today, -2), streakShieldsHeld: 1, currentStreak: 5, points: 250 });
  // gapDays=2, standard mode, shieldsHeld=1 -> missedDays(1) <= shieldsHeld(1)
  // -> bridges the gap, consumes exactly 1 shield (decideStreakOnActiveDay).

  fakeDdb.beforeSend = async (cmd) => {
    if (cmd.constructor.name === "QueryCommand") {
      fakeDdb.beforeSend = undefined; // one-shot: clear before the nested call
      const purchase = await purchaseStreakShield(TABLE, USER_ID);
      assert.equal(purchase.purchased, true, "interleaved purchase must succeed");
    }
  };

  const result = await updateStreakOnLoopComplete(TABLE, USER_ID, "UTC");

  const finalStreak = store.get(streakKey());
  const finalEngagement = store.get(engagementKey());

  assert.equal(result.shieldsConsumed, 1, "the decision consumed exactly 1 shield to bridge the 2-day gap");
  assert.equal(
    finalEngagement?.points,
    150,
    "engagement points must reflect exactly one -100 shield purchase (250 - 100)"
  );
  assert.equal(
    finalStreak?.streakShieldsHeld,
    1,
    "final shields must be held(1) - consumed(1) + purchased(1) = 1 — CURRENT CODE clobbers the purchase with a stale unconditional SET"
  );
  assert.ok((finalStreak?.streakShieldsHeld as number) >= 0, "streakShieldsHeld must never go negative");
});

test("RED (pins retry/no-op contract) — concurrent same-day loop-complete no-ops instead of double-consuming", async () => {
  const today = getTodayInTimezone("UTC");
  seed({ lastActiveDate: addDaysUTC(today, -2), streakShieldsHeld: 1, currentStreak: 5, points: 250 });

  let innerResult: Awaited<ReturnType<typeof updateStreakOnLoopComplete>> | undefined;

  fakeDdb.beforeSend = async (cmd) => {
    if (cmd.constructor.name === "QueryCommand") {
      fakeDdb.beforeSend = undefined; // clear first so the inner call's own Query can't recurse
      innerResult = await updateStreakOnLoopComplete(TABLE, USER_ID, "UTC");
    }
  };

  const outerResult = await updateStreakOnLoopComplete(TABLE, USER_ID, "UTC");

  assert.ok(innerResult, "inner nested call must have run");
  const finalStreak = store.get(streakKey());

  assert.equal(
    outerResult.shieldsConsumed,
    0,
    "outer call must observe the conflict and no-op (0 shields consumed) — CURRENT CODE writes blindly and reports 1"
  );
  assert.equal(
    outerResult.streak.currentStreak,
    innerResult!.streak.currentStreak,
    "outer result must reflect the already-updated streak, not a second independent increment"
  );
  assert.equal(
    finalStreak?.streakShieldsHeld,
    0,
    "exactly one consumption must be persisted (held 1 - consumed 1 = 0), not double-consumed"
  );
});

test("RED — no-consumption path still lets a concurrent purchase get clobbered under current code", async () => {
  const today = getTodayInTimezone("UTC");
  seed({ lastActiveDate: addDaysUTC(today, -1), streakShieldsHeld: 1, currentStreak: 5, points: 250 });
  // gapDays=1 (consecutive day) -> decideStreakOnActiveDay takes the
  // gapDays===1 branch: newShieldsHeld = shieldsHeld (unchanged), consumed=0.
  // The PINNED FIX must not touch streakShieldsHeld at all on this path, so a
  // concurrent purchase's relative ADD survives untouched: final = 1 + 1 = 2.
  // CURRENT CODE still issues `SET streakShieldsHeld = :ssh` with :ssh equal
  // to the STALE pre-purchase value (1), clobbering the purchase's ADD
  // regardless of whether this decision even consumed a shield: final = 1,
  // not 2. That makes this a RED test too (not a pin), by design.

  fakeDdb.beforeSend = async (cmd) => {
    if (cmd.constructor.name === "QueryCommand") {
      fakeDdb.beforeSend = undefined;
      const purchase = await purchaseStreakShield(TABLE, USER_ID);
      assert.equal(purchase.purchased, true, "interleaved purchase must succeed");
    }
  };

  const result = await updateStreakOnLoopComplete(TABLE, USER_ID, "UTC");
  const finalStreak = store.get(streakKey());

  assert.equal(result.shieldsConsumed, 0, "consecutive day must not consume a shield");
  assert.equal(
    finalStreak?.streakShieldsHeld,
    2,
    "a concurrent purchase during a no-consumption loop-complete must survive (1 held + 1 purchased) — CURRENT CODE clobbers it to 1"
  );
});

test("PIN (harness sanity) — purchaseStreakShield alone: +1 shield, -100 IP, ledger row written once", async () => {
  seed({ lastActiveDate: "2026-01-01", streakShieldsHeld: 1, currentStreak: 5, points: 250 });

  const result = await purchaseStreakShield(TABLE, USER_ID);

  assert.equal(result.purchased, true);
  assert.equal(result.balance, 150);

  const finalStreak = store.get(streakKey());
  const finalEngagement = store.get(engagementKey());
  assert.equal(finalStreak?.streakShieldsHeld, 2);
  assert.equal(finalEngagement?.points, 150);

  const rows = ledgerRows();
  assert.equal(rows.length, 1, "exactly one ledger row must be written");
  assert.equal(rows[0]!.direction, "spend");
  assert.equal(rows[0]!.amount, 100);
  assert.equal(rows[0]!.sourceType, "reward_redemption");
  assert.equal(rows[0]!.sourceId, "streak_shield");
});

test("PIN (harness sanity) — shields_full at 3 refuses without deducting", async () => {
  seed({ lastActiveDate: "2026-01-01", streakShieldsHeld: 3, currentStreak: 5, points: 250 });

  const result = await purchaseStreakShield(TABLE, USER_ID);

  assert.equal(result.purchased, false);
  assert.equal(result.error, "shields_full");
  assert.equal(result.balance, 250, "no IP may be touched when shields are full");

  const finalStreak = store.get(streakKey());
  const finalEngagement = store.get(engagementKey());
  assert.equal(finalStreak?.streakShieldsHeld, 3, "shields must be unchanged");
  assert.equal(finalEngagement?.points, 250, "points must be unchanged");
  assert.equal(ledgerRows().length, 0, "no ledger row on a refused purchase");
});
