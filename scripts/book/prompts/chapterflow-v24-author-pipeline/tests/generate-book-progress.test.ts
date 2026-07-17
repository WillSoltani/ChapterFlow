/**
 * WP-603 — the `generate-book` stage-level progress emitter (generateBookProgress.ts).
 *
 * Pure unit tests: a fake `log`/`now` are injected (no fs, no process, no conductor),
 * matching the module's own "deterministic and injectable" contract.
 */

import assert from "node:assert/strict";

import { test } from "./harness.js";
import {
  createProgressReporter,
  formatProgressLine,
  GENERATE_BOOK_STEP_DEFS,
  GENERATE_BOOK_STEP_ORDER,
  type GenerateBookStepId,
} from "../src/orchestrator/generateBookProgress.js";

/** A deterministic, injectable clock: each call returns the next value from `ticks`
 *  (or the last one, once exhausted) — never `Date.now()`. */
function fakeClock(ticks: number[]): () => number {
  let i = 0;
  return () => (i < ticks.length ? ticks[i++] : ticks[ticks.length - 1]);
}

// ── step table sanity ────────────────────────────────────────────────────────────

test("GENERATE_BOOK_STEP_ORDER: every step in the canonical order has a def, and vice versa", () => {
  const orderSet = new Set<GenerateBookStepId>(GENERATE_BOOK_STEP_ORDER);
  const defKeys = Object.keys(GENERATE_BOOK_STEP_DEFS) as GenerateBookStepId[];
  assert.equal(orderSet.size, GENERATE_BOOK_STEP_ORDER.length, "no duplicate step ids in the order");
  assert.equal(defKeys.length, GENERATE_BOOK_STEP_ORDER.length, "every def has exactly one order entry");
  for (const id of defKeys) assert.ok(orderSet.has(id), `${id} is defined but missing from GENERATE_BOOK_STEP_ORDER`);
});

test("GENERATE_BOOK_STEP_DEFS: at least one milestone and one non-milestone step exist (quiet-mode gating is exercised)", () => {
  const values = Object.values(GENERATE_BOOK_STEP_DEFS);
  assert.ok(values.some((d) => d.milestone), "at least one milestone step");
  assert.ok(values.some((d) => !d.milestone), "at least one non-milestone step");
});

// ── formatProgressLine: pure formatting ──────────────────────────────────────────

test("formatProgressLine: a start event has no elapsed and no status suffix", () => {
  const line = formatProgressLine({ step: "config", num: "2", title: "load + resolve config", phase: "start", elapsedMs: null });
  assert.equal(line, "[progress] [2/12] … load + resolve config");
});

test("formatProgressLine: a complete event carries the status suffix + elapsed", () => {
  const line = formatProgressLine({ step: "config", num: "2", title: "load + resolve config", phase: "ok", elapsedMs: 12 });
  assert.equal(line, "[progress] [2/12] ✓ load + resolve config: ok (12ms)");
});

test("formatProgressLine: fatal/warn render distinct icons; detail appends with an em-dash", () => {
  const fatal = formatProgressLine({ step: "preflight", num: "1", title: "validate prerequisites", phase: "fatal", elapsedMs: 3, detail: "2 fatal finding(s)" });
  assert.match(fatal, /^\[progress\] \[1\/12\] ✗ validate prerequisites: fatal \(3ms\) — 2 fatal finding\(s\)$/);
  const warn = formatProgressLine({ step: "preflight", num: "1", title: "validate prerequisites", phase: "warn", elapsedMs: 3 });
  assert.match(warn, /⚠ validate prerequisites: warn/);
});

// ── createProgressReporter: quiet vs verbose ─────────────────────────────────────

test("quiet mode: only a MILESTONE step's completion prints; its start never prints", () => {
  const logs: string[] = [];
  const reporter = createProgressReporter({ log: (l) => logs.push(l), now: fakeClock([100, 150]), verbose: false });
  reporter.start("preflight"); // milestone
  reporter.complete("preflight", "ok");
  assert.equal(logs.length, 1, "only the completion line prints in quiet mode");
  assert.match(logs[0], /\[1\/12\] ✓ validate prerequisites \(doctor preflight\): ok \(50ms\)/);
});

test("quiet mode: a non-milestone step's clean 'ok' completion is silent (start AND complete)", () => {
  const logs: string[] = [];
  const reporter = createProgressReporter({ log: (l) => logs.push(l), now: fakeClock([0, 1]), verbose: false });
  reporter.start("config"); // not a milestone
  reporter.complete("config", "ok");
  assert.equal(logs.length, 0, "a clean, non-milestone step is silent in quiet mode");
});

test("quiet mode: a non-milestone step's FATAL completion still prints — a halt is never silent", () => {
  const logs: string[] = [];
  const reporter = createProgressReporter({ log: (l) => logs.push(l), now: fakeClock([0, 5]), verbose: false });
  reporter.start("model-check");
  reporter.complete("model-check", "fatal", "unsupported model");
  assert.equal(logs.length, 1);
  assert.match(logs[0], /✗ confirm the model is supported: fatal \(5ms\) — unsupported model/);
});

test("verbose mode: every step prints BOTH a start and a complete line, milestone or not", () => {
  const logs: string[] = [];
  const reporter = createProgressReporter({ log: (l) => logs.push(l), now: fakeClock([0, 7]), verbose: true });
  reporter.start("clobber-check");
  reporter.complete("clobber-check", "ok");
  assert.equal(logs.length, 2, "verbose prints both the start and the complete line");
  assert.match(logs[0], /… refuse-clobber guard$/);
  assert.match(logs[1], /✓ refuse-clobber guard: ok \(7ms\)/);
});

test("elapsed is computed from the injected clock (deterministic), never wall time", () => {
  const reporter = createProgressReporter({ log: () => {}, now: fakeClock([1000, 1250]), verbose: true });
  reporter.start("author-pipeline");
  reporter.complete("author-pipeline", "ok");
  const complete = reporter.events.find((e) => e.phase === "ok");
  assert.equal(complete?.elapsedMs, 250);
});

test("a complete() with no matching start() reports elapsedMs=null (never a fabricated 0)", () => {
  const reporter = createProgressReporter({ log: () => {}, now: fakeClock([999]), verbose: true });
  reporter.complete("classify", "ok");
  assert.equal(reporter.events[0].elapsedMs, null);
});

test(".events records every step in call order regardless of what actually printed", () => {
  const reporter = createProgressReporter({ log: () => {}, now: fakeClock([0, 1, 2, 3, 4, 5]), verbose: false });
  reporter.start("config");
  reporter.complete("config", "ok");
  reporter.start("preflight");
  reporter.complete("preflight", "warn", "1 warning");
  const steps = reporter.events.map((e) => `${e.step}:${e.phase}`);
  assert.deepEqual(steps, ["config:start", "config:ok", "preflight:start", "preflight:warn"]);
});
