import { test, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { bookMetricsPk, dailyMetricsSk } from "@/app/app/api/book/_lib/keys";

// API-08: incrementDailyReaderMetrics added one to uniqueReaders on every
// loop, so "readers today" equalled loops completed. These tests drive the
// real book-metrics-repo.ts against an in-memory fake DynamoDB.

const require = createRequire(import.meta.url);
const Module = require("node:module") as {
  _load: (request: string, parent: unknown, isMain: boolean) => unknown;
};
const originalLoad = Module._load;

type FakeItem = Record<string, unknown>;
type FakeCommand = { constructor: { name: string }; input: Record<string, unknown> };

const store = new Map<string, FakeItem>();
const keyOf = (k: { PK: unknown; SK: unknown }) => `${String(k.PK)}|${String(k.SK)}`;

function applyUpdate(input: Record<string, unknown>) {
  const key = input.Key as { PK: string; SK: string };
  const values = input.ExpressionAttributeValues as Record<string, unknown>;
  const expr = input.UpdateExpression as string;
  const item: FakeItem = { ...(store.get(keyOf(key)) ?? { PK: key.PK, SK: key.SK }) };
  const [setPart = "", addPart = ""] = expr.replace(/^SET /, "").split(" ADD ");
  for (const assignment of setPart.split(",")) {
    const [name = "", value = ""] = assignment.split("=").map((s) => s.trim());
    item[name] = values[value];
  }
  for (const addition of addPart.split(",").filter((s) => s.trim())) {
    const [name = "", value = ""] = addition.trim().split(/\s+/);
    const current = item[name];
    item[name] = (typeof current === "number" ? current : 0) + (values[value] as number);
  }
  store.set(keyOf(key), item);
}

const fakeDdb = {
  failUpdates: false,
  async send(cmd: FakeCommand) {
    if (cmd.constructor.name === "PutCommand") {
      const item = cmd.input.Item as FakeItem;
      if (cmd.input.ConditionExpression !== "attribute_not_exists(PK)") {
        throw new Error(`unsupported condition: ${String(cmd.input.ConditionExpression)}`);
      }
      if (store.has(keyOf(item as { PK: string; SK: string }))) {
        throw Object.assign(new Error("ConditionalCheckFailedException"), {
          name: "ConditionalCheckFailedException",
        });
      }
      store.set(keyOf(item as { PK: string; SK: string }), { ...item });
      return {};
    }
    if (cmd.constructor.name === "UpdateCommand") {
      if (fakeDdb.failUpdates) throw new Error("throttled");
      applyUpdate(cmd.input);
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

let incrementDailyReaderMetrics: typeof import("./book-metrics-repo").incrementDailyReaderMetrics;

before(async () => {
  ({ incrementDailyReaderMetrics } = await import("./book-metrics-repo"));
});

beforeEach(() => {
  store.clear();
  fakeDdb.failUpdates = false;
});

const TABLE = "book-table-test";
const DAY = "2026-11-13";
const ts = `${DAY}T10:00:00.000Z`;

function dayRow(bookId: string, dayKey = DAY) {
  return store.get(`${bookMetricsPk(bookId)}|${dailyMetricsSk(dayKey)}`);
}

test("one reader finishing three loops in a day counts once as a reader, three times as loops", async () => {
  for (let i = 0; i < 3; i += 1) {
    await incrementDailyReaderMetrics(TABLE, { bookId: "b1", userId: "u1", dayKey: DAY, ts });
  }
  const row = dayRow("b1");
  assert.equal(row?.uniqueReaders, 1);
  assert.equal(row?.loopCompletions, 3);
  assert.equal(row?.dayKey, DAY);
  assert.equal(row?.entity, "BOOK_CHAPTER_DAILY_METRICS");
});

test("two readers count as two readers", async () => {
  await incrementDailyReaderMetrics(TABLE, { bookId: "b1", userId: "u1", dayKey: DAY, ts });
  await incrementDailyReaderMetrics(TABLE, { bookId: "b1", userId: "u2", dayKey: DAY, ts });
  await incrementDailyReaderMetrics(TABLE, { bookId: "b1", userId: "u2", dayKey: DAY, ts });
  const row = dayRow("b1");
  assert.equal(row?.uniqueReaders, 2);
  assert.equal(row?.loopCompletions, 3);
});

test("the same reader counts again on a new day and on another book", async () => {
  await incrementDailyReaderMetrics(TABLE, { bookId: "b1", userId: "u1", dayKey: DAY, ts });
  await incrementDailyReaderMetrics(TABLE, {
    bookId: "b1",
    userId: "u1",
    dayKey: "2026-11-14",
    ts: "2026-11-14T09:00:00.000Z",
  });
  await incrementDailyReaderMetrics(TABLE, { bookId: "b2", userId: "u1", dayKey: DAY, ts });
  assert.equal(dayRow("b1")?.uniqueReaders, 1);
  assert.equal(dayRow("b1", "2026-11-14")?.uniqueReaders, 1);
  assert.equal(dayRow("b2")?.uniqueReaders, 1);
});

test("the reader marker lives under the book metrics partition with a TTL", async () => {
  await incrementDailyReaderMetrics(TABLE, { bookId: "b1", userId: "u1", dayKey: DAY, ts });
  const marker = store.get(`${bookMetricsPk("b1")}|METRICSREADER#${DAY}#u1`);
  assert.ok(marker, "marker row written");
  assert.equal(typeof marker?.ttl, "number");
});

test("a failed counter update still rejects so the caller's best-effort catch sees it", async () => {
  fakeDdb.failUpdates = true;
  await assert.rejects(
    incrementDailyReaderMetrics(TABLE, { bookId: "b1", userId: "u1", dayKey: DAY, ts }),
  );
});
