/**
 * WS4 E5 (rejected-sweep persistence) + the AUTO control-read.
 *
 * E5: a validator-REJECTED sweep submission is persisted as ADVISORY forensic
 * history at state/qc-orchestrator/<book>/<round>/sweep-rejected.<attempt>.json,
 * and is NEVER read by checkSweep or the clears machinery (it grants nothing).
 *
 * Control-read: resolveBeatShippedBar's decision — env override / no shipped
 * package (bar-80-only) / git-pinned control read / pin reuse / fail-closed when a
 * shipped package exists but the control read cannot be produced. Fully injected
 * (no git, no real reader spawn).
 */
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { test } from "./harness.js";
import { makeChapter, STATE_CHAPTERS, writeFixtureBook, writeResearchRunManifestFixture } from "./helpers.js";
import { CANONICAL_STATE, REPO_ROOT } from "../src/lib/chapterPaths.js";
import { openQcRound, QC_ROUNDS_DIR } from "../src/qc/qcRound.js";
import { QC_DIR, QC_PACKS_DIR, loadBookChapters } from "../src/qc/manualKeyJudge.js";
import { checkSweep, loadSweepRecord } from "../src/qc/sweep.js";
import { QC_ORCHESTRATOR_DIR, orchestratorRoundDir } from "../src/qc/orchestrator/artifacts.js";
import { runSweepEvidence, type AuthorEvidenceRound } from "../src/orchestrator/authorEvidence.js";
import { sweepRejectedPath, type SweepRejectedRecord } from "../src/orchestrator/sweepRejectedRecord.js";
import { resolveAuthorReviewIo, type AuthorReviewIo } from "../src/orchestrator/authorReview.js";
import {
  loadShippedControlRecord,
  resolveBeatShippedBar,
  type ShippedControlIo,
} from "../src/orchestrator/shippedControl.js";
import { REVIEW_FACTORS, type ReviewFactor } from "../src/artifacts/artifactTypes.js";
import type { AutopilotDeps } from "../src/orchestrator/autopilot.js";
import type { BookPackageV21, ChapterV21 } from "../src/types.js";

const BOOK = "zz-fixture-e5-control";
const RUN = "20260703T000000Z";

// ── fixture state (evidence-style) ────────────────────────────────────────────

function sourceSidecar(chapterNumber: number): any {
  return {
    schemaVersion: "source-v2",
    chapterNumber,
    chapterTitle: `Chapter ${chapterNumber}`,
    centralConcept: { id: `ch${chapterNumber}.concept`, name: "Fixture concept", plainDefinition: "A test concept with concrete checks." },
    keyClaims: ["The fixture claim holds."],
    namedExamples: [
      { id: `ch${chapterNumber}.ex.a`, label: "Case Alpha", summary: "Alpha shows the move.", hardSpecifics: ["Alpha", "1999"], realWorld: true },
      { id: `ch${chapterNumber}.ex.b`, label: "Case Beta", summary: "Beta shows the miss.", hardSpecifics: ["Beta", "Toronto"], realWorld: true },
    ],
    hardEdge: "Do not invert the fixture claim.",
    paraphraseNotes: "Synthetic notes for a unit test.",
    testableFacts: Array.from({ length: 9 }, (_, i) => ({ id: `fact${i}`, claim: `Claim ${i} is true.`, becauseMechanism: `Because ${i}.`, commonError: `Mistake ${i}.`, errorIsWhy: `Ignores mechanism ${i}.` })),
  };
}

function rmMatching(dir: string, prefix: string): void {
  if (!existsSync(dir)) return;
  for (const f of readdirSync(dir)) if (f.startsWith(prefix)) rmSync(resolve(dir, f), { recursive: true, force: true });
}

function cleanup(): void {
  rmSync(resolve(REPO_ROOT, ".chapterflow/runs", BOOK), { recursive: true, force: true });
  rmMatching(STATE_CHAPTERS, `${BOOK}-ch`);
  rmMatching(QC_ROUNDS_DIR, `${BOOK}.`);
  rmSync(resolve(QC_PACKS_DIR, BOOK), { recursive: true, force: true });
  rmSync(resolve(QC_ORCHESTRATOR_DIR, BOOK), { recursive: true, force: true });
  rmMatching(QC_DIR, BOOK);
  rmSync(resolve(REPO_ROOT, "scratch/review", BOOK), { recursive: true, force: true });
}

function setup(): { chapters: ChapterV21[]; round: AuthorEvidenceRound } {
  cleanup();
  const chapters = [makeChapter(BOOK, 1), makeChapter(BOOK, 2)];
  writeFixtureBook(STATE_CHAPTERS, chapters);
  const runDir = resolve(REPO_ROOT, ".chapterflow/runs", BOOK, RUN);
  const sourceDir = resolve(runDir, "sidecars/source");
  mkdirSync(sourceDir, { recursive: true });
  writeResearchRunManifestFixture({ runDir, bookId: BOOK, chapters: chapters.map((c) => ({ number: c.number, title: `Chapter ${c.number}` })) });
  for (const ch of chapters) writeFileSync(resolve(sourceDir, `ch0${ch.number}.source.json`), JSON.stringify(sourceSidecar(ch.number), null, 2), "utf8");
  const { record, tokens } = openQcRound(BOOK);
  return { chapters, round: { roundId: record.roundId, tokens } };
}

async function withNoApiEnv<T>(fn: () => Promise<T> | T): Promise<T> {
  const prev = process.env.CHAPTERFLOW_NO_API_CODEX_QC;
  process.env.CHAPTERFLOW_NO_API_CODEX_QC = "1";
  try { return await fn(); } finally { if (prev === undefined) delete process.env.CHAPTERFLOW_NO_API_CODEX_QC; else process.env.CHAPTERFLOW_NO_API_CODEX_QC = prev; }
}

function mkDeps(script: (o: { sessionId: string; task: string }) => { finalMessage?: string }): { deps: AutopilotDeps; spawns: string[] } {
  const spawns: string[] = [];
  let n = 0;
  const deps = {
    spawn: (async (o: { sessionId: string; task: string }) => {
      spawns.push(o.sessionId);
      const r = script(o);
      return { ok: true, exitCode: 0, finalMessage: r.finalMessage ?? "done", stdout: r.finalMessage ?? "", stderr: "", durationMs: 1, sessionId: o.sessionId };
    }) as unknown as AutopilotDeps["spawn"],
    mkSessionId: (label: string) => `${label}#${++n}`,
    logSession: () => {},
    log: () => {},
  } as unknown as AutopilotDeps;
  return { deps, spawns };
}

function mkEvIo(): AuthorReviewIo {
  const dir = mkdtempSync(join(tmpdir(), "e5-"));
  return resolveAuthorReviewIo({
    writeReviewDoc: (bookId, fileName, text) => { const abs = join(dir, `${bookId}-${fileName}`); writeFileSync(abs, text, "utf8"); return { absPath: abs, relPath: abs }; },
    persistReview: () => "/tmp/r.json",
    persistAcceptance: (bookId, record) => join(dir, `${bookId}-acc.${record.roundLabel || "round1"}.json`),
    resolveBeatShipped: async () => ({ ok: true, composite: null, source: "none" }),
    regenConsumedFor: () => 0,
    recordRegenConsumed: () => {},
  });
}

/** A sweep reply whose ONLY finding has an EMPTY chapters array — the real
 *  validator rejects it every time (used to force a persistent rejection). */
function badSweepReply(): string {
  return "```json\n" + JSON.stringify({
    verdict: "PASS",
    checkedFamilies: ["scene_skeleton", "persona_drift", "repeated_unit", "location_stamping"],
    findings: [{ family: "repeated_unit", severity: "advisory", chapters: [], unitId: "examples[0].scenario", repairClass: "repeated_unit", quote: "shell", problem: "shell reuse", expectedFix: "vary it" }],
  }) + "\n```";
}

// ── E5 ─────────────────────────────────────────────────────────────────────────

test("E5: a sweep submission rejected on BOTH attempts persists sweep-rejected.1 AND sweep-rejected.2 forensic records — and the step fails closed", async () => {
  const { chapters, round } = setup();
  try {
    const { deps } = mkDeps((o) => (o.sessionId.includes("author-sweep") ? { finalMessage: badSweepReply() } : {}));
    const r = await runSweepEvidence(BOOK, chapters, deps, mkEvIo(), round);
    assert.ok(!r.ok, "a persistently-rejected sweep fails closed");

    const p1 = sweepRejectedPath(BOOK, round.roundId, 1);
    const p2 = sweepRejectedPath(BOOK, round.roundId, 2);
    assert.ok(existsSync(p1), "attempt-1 rejection persisted");
    assert.ok(existsSync(p2), "attempt-2 rejection persisted");
    const rec = JSON.parse(readFileSync(p1, "utf8")) as SweepRejectedRecord;
    assert.equal(rec.schemaVersion, "sweep-rejected-v1");
    assert.equal(rec.roundId, round.roundId);
    assert.ok(rec.errors.length > 0, "the validator errors are recorded");
    assert.ok(rec.submission && typeof rec.submission === "object", "the rejected submission bytes are recorded");
    assert.ok(String(rec.reviewerSessionId).includes("author-sweep"), "the reviewer session is recorded");
  } finally { cleanup(); }
});

test("E5: the rejected-sweep record is NEVER consumed — no sweep record is written and checkSweep still reports MISSING", async () => {
  const { chapters, round } = setup();
  try {
    const { deps } = mkDeps((o) => (o.sessionId.includes("author-sweep") ? { finalMessage: badSweepReply() } : {}));
    await runSweepEvidence(BOOK, chapters, deps, mkEvIo(), round);
    // The forensic record exists...
    assert.ok(existsSync(sweepRejectedPath(BOOK, round.roundId, 1)), "forensic record written");
    // ...but it granted NOTHING: no durable sweep record, and checkSweep is unsatisfied.
    assert.equal(loadSweepRecord(BOOK), null, "no sweep record written from a rejected submission");
    await withNoApiEnv(() => {
      const findings = checkSweep(loadBookChapters(BOOK), true);
      assert.ok(findings.length > 0, "checkSweep still reports the book as unswept (the rejected record grants nothing)");
    });
  } finally { cleanup(); }
});

test("E5: the rejected record lands under the qc-orchestrator round dir (advisory location, not the sweep history / clears path)", async () => {
  const { round } = setup();
  try {
    const expected = resolve(orchestratorRoundDir(BOOK, round.roundId), "sweep-rejected.1.json");
    assert.equal(sweepRejectedPath(BOOK, round.roundId, 1), expected, "path is under qc-orchestrator/<book>/<round>/");
  } finally { cleanup(); }
});

// ── AUTO control-read ──────────────────────────────────────────────────────────

const CTRL_BOOK = "zz-fixture-control";

function controlPkg(): BookPackageV21 {
  const chapters = Array.from({ length: 4 }, (_, i) => makeChapter(CTRL_BOOK, i + 1));
  return { schemaVersion: "chapterflow-v21", packageId: `${CTRL_BOOK}-v21-1`, createdAt: "", book: { bookId: CTRL_BOOK, title: "T", author: "A", categories: [], tags: [] }, chapters } as unknown as BookPackageV21;
}

function mkControlIo(over: Partial<ShippedControlIo> = {}): ShippedControlIo {
  const dir = mkdtempSync(join(tmpdir(), "control-io-"));
  return {
    shippedPackagePath: (b) => join(dir, `${b}.v21.json`),
    shippedPackageExists: () => true,
    pinHead: () => "PIN0",
    readShippedPackageAtPin: () => controlPkg(),
    controlRecordPath: (b) => join(dir, `${b}-shipped-control.json`),
    ...over,
  };
}

function bookReadReply(chapters: ChapterV21[], score = 82): string {
  return "```json\n" + JSON.stringify({
    gate_verdict: "PASS",
    book3_churn: "LOW",
    quizDerivation: Object.fromEntries(chapters.map((ch) => [String(ch.number), { answers: ch.quiz.questions.map((q) => "abc"[q.correctIndex]), keyDisagreements: [] }])),
    scores: Object.fromEntries(REVIEW_FACTORS.map((f) => [f, score])),
    quotes: [{ quote: chapters[0].title, why: "ok" }],
    oneParagraphVerdict: "control",
  }) + "\n```";
}

test("control-read: the env override wins and skips the shipped package entirely", async () => {
  const prev = process.env.CHAPTERFLOW_BEAT_SHIPPED_COMPOSITE;
  process.env.CHAPTERFLOW_BEAT_SHIPPED_COMPOSITE = "77.5";
  try {
    const { deps, spawns } = mkDeps(() => ({}));
    const r = await resolveBeatShippedBar(CTRL_BOOK, deps, mkEvIo(), mkControlIo());
    assert.ok(r.ok && r.source === "env" && r.composite === 77.5, `env override: ${JSON.stringify(r)}`);
    assert.equal(spawns.length, 0, "no control read spawned under an env override");
  } finally { if (prev === undefined) delete process.env.CHAPTERFLOW_BEAT_SHIPPED_COMPOSITE; else process.env.CHAPTERFLOW_BEAT_SHIPPED_COMPOSITE = prev; }
});

test("control-read: no shipped package → bar-80-only (composite null), no spawn", async () => {
  const prev = process.env.CHAPTERFLOW_BEAT_SHIPPED_COMPOSITE;
  delete process.env.CHAPTERFLOW_BEAT_SHIPPED_COMPOSITE;
  try {
    const { deps, spawns } = mkDeps(() => ({}));
    const r = await resolveBeatShippedBar(CTRL_BOOK, deps, mkEvIo(), mkControlIo({ shippedPackageExists: () => false }));
    assert.ok(r.ok && r.source === "none" && r.composite === null, `no package: ${JSON.stringify(r)}`);
    assert.equal(spawns.length, 0, "no control read when there is no shipped package");
  } finally { if (prev !== undefined) process.env.CHAPTERFLOW_BEAT_SHIPPED_COMPOSITE = prev; }
});

test("control-read: a shipped package with no env override runs the git-pinned 3-reader control read + persists the record", async () => {
  const prev = process.env.CHAPTERFLOW_BEAT_SHIPPED_COMPOSITE;
  delete process.env.CHAPTERFLOW_BEAT_SHIPPED_COMPOSITE;
  try {
    const io = mkControlIo();
    const { deps, spawns } = mkDeps((o) => (o.sessionId.includes("shipped-control") ? { finalMessage: bookReadReply(controlPkg().chapters, 82) } : {}));
    const r = await resolveBeatShippedBar(CTRL_BOOK, deps, mkEvIo(), io);
    assert.ok(r.ok && r.source === "control" && r.composite === 82, `control read: ${JSON.stringify(r)}`);
    assert.equal(spawns.filter((s) => s.includes("shipped-control")).length, 3, "THREE control readers");
    const rec = loadShippedControlRecord(CTRL_BOOK, io);
    assert.ok(rec && rec.pin === "PIN0" && rec.composite === 82, "control record persisted with the pin + composite");
  } finally { if (prev !== undefined) process.env.CHAPTERFLOW_BEAT_SHIPPED_COMPOSITE = prev; }
});

test("control-read: a persisted control record is REUSED while the pin matches (no re-spawn)", async () => {
  const prev = process.env.CHAPTERFLOW_BEAT_SHIPPED_COMPOSITE;
  delete process.env.CHAPTERFLOW_BEAT_SHIPPED_COMPOSITE;
  try {
    const io = mkControlIo();
    // First call runs the read.
    await resolveBeatShippedBar(CTRL_BOOK, mkDeps((o) => (o.sessionId.includes("shipped-control") ? { finalMessage: bookReadReply(controlPkg().chapters, 82) } : {})).deps, mkEvIo(), io);
    // Second call at the SAME pin reuses — a spawn here would throw.
    const { deps, spawns } = mkDeps(() => { throw new Error("must not spawn on a pin-matched reuse"); });
    const r = await resolveBeatShippedBar(CTRL_BOOK, deps, mkEvIo(), io);
    assert.ok(r.ok && r.source === "control" && r.composite === 82 && r.pin === "PIN0", `reuse: ${JSON.stringify(r)}`);
    assert.equal(spawns.length, 0, "no spawn on a pin-matched reuse");
  } finally { if (prev !== undefined) process.env.CHAPTERFLOW_BEAT_SHIPPED_COMPOSITE = prev; }
});

test("control-read: a DIFFERENT pin re-runs the read (the shipped bytes moved)", async () => {
  const prev = process.env.CHAPTERFLOW_BEAT_SHIPPED_COMPOSITE;
  delete process.env.CHAPTERFLOW_BEAT_SHIPPED_COMPOSITE;
  try {
    let pin = "PINA";
    const io = mkControlIo({ pinHead: () => pin });
    await resolveBeatShippedBar(CTRL_BOOK, mkDeps((o) => (o.sessionId.includes("shipped-control") ? { finalMessage: bookReadReply(controlPkg().chapters, 82) } : {})).deps, mkEvIo(), io);
    pin = "PINB"; // the outer HEAD advanced
    const { deps, spawns } = mkDeps((o) => (o.sessionId.includes("shipped-control") ? { finalMessage: bookReadReply(controlPkg().chapters, 85) } : {}));
    const r = await resolveBeatShippedBar(CTRL_BOOK, deps, mkEvIo(), io);
    assert.ok(r.ok && r.composite === 85 && r.pin === "PINB", `re-read at new pin: ${JSON.stringify(r)}`);
    assert.equal(spawns.filter((s) => s.includes("shipped-control")).length, 3, "re-read spawned 3 readers at the new pin");
  } finally { if (prev !== undefined) process.env.CHAPTERFLOW_BEAT_SHIPPED_COMPOSITE = prev; }
});

test("control-read: a shipped package that exists but whose bytes are unreadable → FAIL-CLOSED (never a silent null)", async () => {
  const prev = process.env.CHAPTERFLOW_BEAT_SHIPPED_COMPOSITE;
  delete process.env.CHAPTERFLOW_BEAT_SHIPPED_COMPOSITE;
  try {
    const io = mkControlIo({ readShippedPackageAtPin: () => { throw new Error("git show failed at the pin"); } });
    const { deps } = mkDeps(() => ({}));
    const r = await resolveBeatShippedBar(CTRL_BOOK, deps, mkEvIo(), io);
    assert.ok(!r.ok && /could not load the shipped package/.test(r.reason), `fail-closed: ${JSON.stringify(r)}`);
  } finally { if (prev !== undefined) process.env.CHAPTERFLOW_BEAT_SHIPPED_COMPOSITE = prev; }
});

test("control-read: a control read that yields no valid reader → FAIL-CLOSED (never drops beat-shipped protection)", async () => {
  const prev = process.env.CHAPTERFLOW_BEAT_SHIPPED_COMPOSITE;
  delete process.env.CHAPTERFLOW_BEAT_SHIPPED_COMPOSITE;
  try {
    const io = mkControlIo();
    // Every reader emits unparseable output on both attempts → no valid reader.
    const { deps } = mkDeps((o) => (o.sessionId.includes("shipped-control") ? { finalMessage: "not json" } : {}));
    const r = await resolveBeatShippedBar(CTRL_BOOK, deps, mkEvIo(), io);
    assert.ok(!r.ok && /no valid reader/.test(r.reason), `fail-closed on no valid reader: ${JSON.stringify(r)}`);
  } finally { if (prev !== undefined) process.env.CHAPTERFLOW_BEAT_SHIPPED_COMPOSITE = prev; }
});

test("control-read: a pin failure (empty HEAD) → FAIL-CLOSED", async () => {
  const prev = process.env.CHAPTERFLOW_BEAT_SHIPPED_COMPOSITE;
  delete process.env.CHAPTERFLOW_BEAT_SHIPPED_COMPOSITE;
  try {
    const io = mkControlIo({ pinHead: () => "" });
    const r = await resolveBeatShippedBar(CTRL_BOOK, mkDeps(() => ({})).deps, mkEvIo(), io);
    assert.ok(!r.ok && /could not pin/.test(r.reason), `fail-closed on pin failure: ${JSON.stringify(r)}`);
  } finally { if (prev !== undefined) process.env.CHAPTERFLOW_BEAT_SHIPPED_COMPOSITE = prev; }
});
