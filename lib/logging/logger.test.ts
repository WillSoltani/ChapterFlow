import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { logger, setLogSink, type LogLevel } from "./logger";
import { runWithRequestContext } from "./request-context";

// WS6-031: pins the structured logger's line shape + correlation-id resolution.
// A regression here means either malformed JSON in CloudWatch (breaking Logs
// Insights joins) or a dropped requestId (a 500 that can't be tied to its cause).

type Captured = { level: LogLevel; record: Record<string, unknown> };

// @types/node types NODE_ENV as a read-only union; cast through to flip it for
// the production/non-production stack-suppression assertions.
function setNodeEnv(value: string | undefined): void {
  (process.env as Record<string, string | undefined>).NODE_ENV = value;
}

function capture(): { lines: Captured[]; restore: () => void } {
  const lines: Captured[] = [];
  setLogSink((level, line) => {
    lines.push({ level, record: JSON.parse(line) as Record<string, unknown> });
  });
  return { lines, restore: () => setLogSink() };
}

afterEach(() => setLogSink());

test("emits exactly one line of well-formed JSON per call", () => {
  const { lines, restore } = capture();
  logger.info("something_happened", { count: 3 });
  restore();
  assert.equal(lines.length, 1);
  const { level, record } = lines[0]!;
  assert.equal(level, "info");
  assert.equal(record.level, "info");
  assert.equal(record.event, "something_happened");
  assert.equal(record.count, 3);
  // time is a valid ISO-8601 timestamp.
  assert.equal(typeof record.time, "string");
  assert.equal(new Date(record.time as string).toISOString(), record.time);
});

test("snake_case event passes through verbatim for each level", () => {
  const { lines, restore } = capture();
  logger.info("info_event");
  logger.warn("warn_event");
  logger.error("error_event");
  restore();
  assert.deepEqual(
    lines.map((l) => [l.level, l.record.event]),
    [
      ["info", "info_event"],
      ["warn", "warn_event"],
      ["error", "error_event"],
    ]
  );
});

test("requestId is injected from the ALS request context", () => {
  const { lines, restore } = capture();
  runWithRequestContext("trace-123", () => {
    logger.info("in_context");
  });
  logger.info("out_of_context");
  restore();
  assert.equal(lines[0]!.record.requestId, "trace-123");
  assert.equal("requestId" in lines[1]!.record, false);
});

test("an explicit requestId field overrides the ambient context", () => {
  const { lines, restore } = capture();
  runWithRequestContext("ambient", () => {
    logger.warn("override_event", { requestId: "explicit" });
  });
  restore();
  assert.equal(lines[0]!.record.requestId, "explicit");
});

test("an Error `err` field is normalized to {name, message} with stack in dev", () => {
  const prev = process.env.NODE_ENV;
  setNodeEnv("development");
  const { lines, restore } = capture();
  logger.error("boom", { err: new TypeError("kaboom") });
  restore();
  setNodeEnv(prev);
  const err = lines[0]!.record.err as Record<string, unknown>;
  assert.equal(err.name, "TypeError");
  assert.equal(err.message, "kaboom");
  assert.equal(typeof err.stack, "string");
});

test("Error message is capped at 300 chars with an ellipsis", () => {
  const { lines, restore } = capture();
  logger.error("long", { err: new Error("x".repeat(500)) });
  restore();
  const err = lines[0]!.record.err as Record<string, unknown>;
  const message = err.message as string;
  // 300 characters + the single-char ellipsis.
  assert.equal(message.length, 301);
  assert.ok(message.endsWith("…"));
  assert.equal(message.slice(0, 300), "x".repeat(300));
});

test("stack is suppressed when NODE_ENV=production", () => {
  const prev = process.env.NODE_ENV;
  setNodeEnv("production");
  const { lines, restore } = capture();
  logger.error("prod_err", { err: new Error("nope") });
  restore();
  setNodeEnv(prev);
  const err = lines[0]!.record.err as Record<string, unknown>;
  assert.equal(err.name, "Error");
  assert.equal(err.message, "nope");
  assert.equal("stack" in err, false);
});

test("a non-Error `err` value passes through untouched", () => {
  const { lines, restore } = capture();
  logger.warn("string_err", { err: "just a string" });
  restore();
  assert.equal(lines[0]!.record.err, "just a string");
});
