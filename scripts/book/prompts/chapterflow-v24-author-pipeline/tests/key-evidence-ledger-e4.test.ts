/**
 * WS4 E4 — key-evidence-clears ledger + REVERIFICATION, proof obligations T1–T13.
 *
 * The ledger (state/qc/<book>.key-evidence-clears.json) is a DERIVED CACHE, never
 * the evidence: before the author-arch stale/skip decision trusts a clear it
 * REVERIFIES the round-token-anchored derivation/pack artifacts against the
 * CURRENT bytes (reverifyClear / reverifiedFreshChapters). These tests build REAL
 * evidence via runKeyJudgeEvidence (real writers, real promote predicates,
 * stubbed spawns) on fixture state, then mutate and assert:
 *
 *   T1  mutate one CHOICE → invalidate + only that chapter re-derives
 *   T2  mutate correctIndex → same
 *   T3  mutate PROSE only → STILL invalidates (keys derive from prose)
 *   T4  delete ledger → rebuild-or-fresh, never a silent pass
 *   T5  delete keyA.answers.json → reverify fails → fresh
 *   T6  delete the round dir → fresh round
 *   T7  tamper ledger contentHash → reverify catches → fail closed
 *   T8  keyA===keyB session → reject regardless of env
 *   T9  carried session === author session → reject
 *   T10 sourceHash change → invalidate
 *   T11 newer CORRUPTION never masked by an older PASS (newest-round-wins)
 *   T12 partial-round strand (keyA only) → subset re-derive + resolver stitches
 *   T13 end-to-end: full carry → evidence phase spawns ZERO sessions; flip a byte → re-derives
 */
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { test } from "./harness.js";
import { makeChapter, STATE_CHAPTERS, writeFixtureBook, writeResearchRunManifestFixture } from "./helpers.js";
import { CANONICAL_STATE, REPO_ROOT } from "../src/lib/chapterPaths.js";
import { openQcRound, QC_ROUNDS_DIR } from "../src/qc/qcRound.js";
import {
  checkManualKeyJudge,
  keyDerivationPath,
  keyPackDir,
  keyPackPath,
  loadBookChapters,
  loadManualKeyJudge,
  QC_DIR,
  QC_PACKS_DIR,
} from "../src/qc/manualKeyJudge.js";
import { QC_ORCHESTRATOR_DIR } from "../src/qc/orchestrator/artifacts.js";
import {
  runKeyJudgeEvidence,
  type AuthorEvidenceRound,
} from "../src/orchestrator/authorEvidence.js";
import {
  answerKeyHashFor,
  keyEvidenceClearsPath,
  loadKeyEvidenceClears,
  packContentKeyOf,
  reverifiedFreshChapters,
  reverifyClear,
} from "../src/orchestrator/keyEvidenceLedger.js";
import { resolveAuthorReviewIo, type AuthorReviewIo } from "../src/orchestrator/authorReview.js";
import type { AutopilotDeps } from "../src/orchestrator/autopilot.js";
import type { ChapterV21 } from "../src/types.js";

const BOOK = "zz-fixture-keyev-e4";
const RUN = "20260703T000000Z";

// ── fixture state (mirrors author-evidence.test.ts) ───────────────────────────

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
      { id: `ch${chapterNumber}.ex.c`, label: "Case Gamma", summary: "Gamma shows the limit.", hardSpecifics: ["Gamma", "42"], realWorld: true },
    ],
    hardEdge: "Do not invert the fixture claim.",
    paraphraseNotes: "Synthetic notes for a unit test.",
    testableFacts: Array.from({ length: 9 }, (_, i) => ({
      id: `fact${i}`,
      claim: `Claim ${i} is true.`,
      becauseMechanism: `Because mechanism ${i} explains the fixture.`,
      commonError: `Mistake ${i} is plausible.`,
      errorIsWhy: `Mistake ${i} ignores the mechanism.`,
    })),
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
  rmMatching(resolve(CANONICAL_STATE, "provenance"), `${BOOK}-`);
  rmSync(resolve(REPO_ROOT, "scratch/review", BOOK), { recursive: true, force: true });
}

/** Write chapters + sidecars + manifest to REAL fixture state. */
function writeChapters(chapters: ChapterV21[]): void {
  writeFixtureBook(STATE_CHAPTERS, chapters);
  const runDir = resolve(REPO_ROOT, ".chapterflow/runs", BOOK, RUN);
  const sourceDir = resolve(runDir, "sidecars/source");
  mkdirSync(sourceDir, { recursive: true });
  writeResearchRunManifestFixture({ runDir, bookId: BOOK, chapters: chapters.map((c) => ({ number: c.number, title: `Chapter ${c.number}` })) });
  for (const ch of chapters) writeFileSync(resolve(sourceDir, `ch0${ch.number}.source.json`), JSON.stringify(sourceSidecar(ch.number), null, 2), "utf8");
}

function setup(): { chapters: ChapterV21[]; round: AuthorEvidenceRound } {
  cleanup();
  const chapters = [makeChapter(BOOK, 1), makeChapter(BOOK, 2)];
  writeChapters(chapters);
  const { record, tokens } = openQcRound(BOOK);
  return { chapters, round: { roundId: record.roundId, tokens } };
}

async function withNoApiEnv<T>(fn: () => Promise<T> | T): Promise<T> {
  const prev = process.env.CHAPTERFLOW_NO_API_CODEX_QC;
  process.env.CHAPTERFLOW_NO_API_CODEX_QC = "1";
  try { return await fn(); } finally {
    if (prev === undefined) delete process.env.CHAPTERFLOW_NO_API_CODEX_QC; else process.env.CHAPTERFLOW_NO_API_CODEX_QC = prev;
  }
}

// ── stubbed deps + io (no live codex) ─────────────────────────────────────────

function keyAnswersReply(chapters: ChapterV21[]): (o: { sessionId: string }) => { finalMessage?: string } {
  const reply = "```json\n" + JSON.stringify({
    chapters: chapters.map((ch) => ({
      chapterNumber: ch.number,
      packHash: "(echoed)",
      answers: ch.quiz.questions.map((q, i) => ({
        questionIndex: i,
        choiceIndex: q.correctIndex,
        confidence: "high",
        reason: `The chapter's early-check mechanism (fact${i}) forces this choice; the alternatives reopen the ruled-out negotiation.`,
        sourceFactIds: [`fact${i}`],
      })),
    })),
  }) + "\n```";
  return (o) => (o.sessionId.includes("author-key-") ? { finalMessage: reply } : {});
}

function mkDeps(script: (o: { sessionId: string }) => { finalMessage?: string }, mkSession?: (label: string, n: number) => string): { deps: AutopilotDeps; spawns: string[] } {
  const spawns: string[] = [];
  let n = 0;
  const deps = {
    spawn: (async (o: { sessionId: string }) => {
      spawns.push(o.sessionId);
      const r = script(o);
      return { ok: true, exitCode: 0, finalMessage: r.finalMessage ?? "done", stdout: r.finalMessage ?? "", stderr: "", durationMs: 1, sessionId: o.sessionId };
    }) as unknown as AutopilotDeps["spawn"],
    mkSessionId: (label: string) => (mkSession ? mkSession(label, ++n) : `${label}#${++n}`),
    logSession: () => {},
    log: () => {},
  } as unknown as AutopilotDeps;
  return { deps, spawns };
}

function mkEvIo(): AuthorReviewIo {
  const dir = mkdtempSync(join(tmpdir(), "keyev-e4-"));
  return resolveAuthorReviewIo({
    writeReviewDoc: (bookId, fileName, text) => {
      const abs = join(dir, `${bookId}-${fileName}`);
      writeFileSync(abs, text, "utf8");
      return { absPath: abs, relPath: abs };
    },
    persistReview: () => "/tmp/review.json",
    persistAcceptance: (bookId, record) => join(dir, `${bookId}-acc.${record.roundLabel || "round1"}.json`),
    resolveBeatShipped: async () => ({ ok: true, composite: null, source: "none" }),
    regenConsumedFor: () => 0,
    recordRegenConsumed: () => {},
  });
}

/** Rewrite a chapter file on disk (so loadBookChapters sees the mutation). */
function rewriteChapter(ch: ChapterV21): void {
  writeFixtureBook(STATE_CHAPTERS, [ch]);
}

/** Produce a full round of REAL key evidence for the current chapters. Returns
 *  the spawn labels so callers can assert how many derivations happened. */
async function produceEvidence(chapters: ChapterV21[], round: AuthorEvidenceRound): Promise<string[]> {
  const { deps, spawns } = mkDeps(keyAnswersReply(chapters));
  const r = await runKeyJudgeEvidence(BOOK, chapters, deps, mkEvIo(), round);
  assert.ok(r.ok, `evidence production failed: ${JSON.stringify(r)}`);
  return spawns;
}

// ── T-series ────────────────────────────────────────────────────────────────

test("T1: mutate one CHOICE → answer-key hash changes → clear invalidates; ONLY that chapter re-derives", async () => {
  const { chapters, round } = setup();
  try {
    await produceEvidence(chapters, round);
    const before = loadKeyEvidenceClears(BOOK)!;
    assert.equal(before.clears.length, 2, "both chapters cleared");

    // Mutate ch1's first choice text (a choice edit, not correctIndex/prose).
    const ch1 = { ...chapters[0], quiz: { ...chapters[0].quiz, questions: chapters[0].quiz.questions.map((q, i) => i === 0 ? { ...q, choices: [q.choices[0] + " (edited)", ...q.choices.slice(1)] } : q) } };
    rewriteChapter(ch1);
    const now = loadBookChapters(BOOK);
    const fresh = reverifiedFreshChapters(BOOK, now, () => undefined);
    assert.ok(!fresh.has(1), "ch1 no longer ledger-fresh after a choice edit");
    assert.ok(fresh.has(2), "ch2 untouched → still fresh");

    // A second run re-derives ONLY ch1 (ch2 carries). We assert the stale subset
    // is exactly {ch1} by checking checkManualKeyJudge staleness pre-run.
    assert.ok(checkManualKeyJudge(now.find((c) => c.number === 1)!, true).length > 0, "ch1 keyjudge stale");
  } finally { cleanup(); }
});

test("T2: mutate correctIndex → clear invalidates", async () => {
  const { chapters, round } = setup();
  try {
    await produceEvidence(chapters, round);
    const ch1 = { ...chapters[0], quiz: { ...chapters[0].quiz, questions: chapters[0].quiz.questions.map((q, i) => i === 0 ? { ...q, correctIndex: (q.correctIndex + 1) % 3 } : q) } };
    rewriteChapter(ch1);
    const now = loadBookChapters(BOOK);
    assert.ok(!reverifiedFreshChapters(BOOK, now, () => undefined).has(1), "correctIndex flip invalidates the clear");
  } finally { cleanup(); }
});

test("T3: mutate PROSE only → clear STILL invalidates (keys derive from prose)", async () => {
  const { chapters, round } = setup();
  try {
    await produceEvidence(chapters, round);
    const ch1 = { ...chapters[0], keyTakeaway: chapters[0].keyTakeaway + " A materially different prose claim that changes the content hash." };
    rewriteChapter(ch1);
    const now = loadBookChapters(BOOK);
    assert.ok(!reverifiedFreshChapters(BOOK, now, () => undefined).has(1), "a prose-only edit invalidates the clear (content hash changed)");
  } finally { cleanup(); }
});

test("T4: delete the ledger → no silent pass; every chapter is treated as needing rebuild-or-fresh", async () => {
  const { chapters, round } = setup();
  try {
    await produceEvidence(chapters, round);
    rmSync(keyEvidenceClearsPath(BOOK), { force: true });
    const fresh = reverifiedFreshChapters(BOOK, loadBookChapters(BOOK), () => undefined);
    assert.equal(fresh.size, 0, "no ledger → no chapter is ledger-fresh (never a silent pass)");
  } finally { cleanup(); }
});

test("T5: delete keyA.answers.json → reverify FAILS → the chapter is stale", async () => {
  const { chapters, round } = setup();
  try {
    await produceEvidence(chapters, round);
    const clear = loadKeyEvidenceClears(BOOK)!.clears.find((c) => c.chapterNumber === 1)!;
    rmSync(keyDerivationPath(BOOK, clear.roundId, "keyA"), { force: true });
    const r = reverifyClear(BOOK, loadBookChapters(BOOK).find((c) => c.number === 1)!, clear, undefined);
    assert.ok(!r.fresh && /keyA\/keyB derivation file is missing/.test(r.reason), `got ${JSON.stringify(r)}`);
  } finally { cleanup(); }
});

test("T6: delete the round dir → reverify FAILS (no round-anchored artifacts) → fresh", async () => {
  const { chapters, round } = setup();
  try {
    await produceEvidence(chapters, round);
    const clear = loadKeyEvidenceClears(BOOK)!.clears.find((c) => c.chapterNumber === 1)!;
    rmSync(keyPackDir(BOOK, clear.roundId), { recursive: true, force: true });
    assert.ok(!reverifyClear(BOOK, loadBookChapters(BOOK).find((c) => c.number === 1)!, clear, undefined).fresh, "no round dir → stale");
  } finally { cleanup(); }
});

test("T7: TAMPER the ledger contentHash → reverify catches it → fail closed", async () => {
  const { chapters, round } = setup();
  try {
    await produceEvidence(chapters, round);
    const p = keyEvidenceClearsPath(BOOK);
    const ledger = JSON.parse(readFileSync(p, "utf8"));
    ledger.clears[0].contentHash = "tampered0000tamp"; // forge a match to a different content
    writeFileSync(p, JSON.stringify(ledger, null, 2) + "\n", "utf8");
    const fresh = reverifiedFreshChapters(BOOK, loadBookChapters(BOOK), () => undefined);
    assert.ok(!fresh.has(ledger.clears[0].chapterNumber), "a tampered contentHash never reverifies (it must equal the CURRENT bytes' hash)");
  } finally { cleanup(); }
});

test("T8: keyA session === keyB session → reverify REJECTS regardless of env (hard independence)", async () => {
  const { chapters, round } = setup();
  try {
    await produceEvidence(chapters, round);
    const clear = { ...loadKeyEvidenceClears(BOOK)!.clears.find((c) => c.chapterNumber === 1)!, keyBSessionId: "" };
    clear.keyBSessionId = clear.keyASessionId; // force collision
    const noEnv = reverifyClear(BOOK, loadBookChapters(BOOK).find((c) => c.number === 1)!, clear, undefined);
    assert.ok(!noEnv.fresh && /same session/.test(noEnv.reason), `collision must reject: ${JSON.stringify(noEnv)}`);
    // Even with the env independence flag OFF, it still rejects (hard check).
    const prev = process.env.CHAPTERFLOW_ENFORCE_SESSION_INDEPENDENCE;
    delete process.env.CHAPTERFLOW_ENFORCE_SESSION_INDEPENDENCE;
    try {
      assert.ok(!reverifyClear(BOOK, loadBookChapters(BOOK).find((c) => c.number === 1)!, clear, undefined).fresh, "still rejects with the env flag unset");
    } finally { if (prev !== undefined) process.env.CHAPTERFLOW_ENFORCE_SESSION_INDEPENDENCE = prev; }
  } finally { cleanup(); }
});

test("T9: a key session === the chapter's AUTHOR session → reverify REJECTS", async () => {
  const { chapters, round } = setup();
  try {
    await produceEvidence(chapters, round);
    const clear = loadKeyEvidenceClears(BOOK)!.clears.find((c) => c.chapterNumber === 1)!;
    const r = reverifyClear(BOOK, loadBookChapters(BOOK).find((c) => c.number === 1)!, clear, clear.keyASessionId);
    assert.ok(!r.fresh && /author session/.test(r.reason), `author collision must reject: ${JSON.stringify(r)}`);
  } finally { cleanup(); }
});

test("T10: sourceHash change → clear invalidates", async () => {
  const { chapters, round } = setup();
  try {
    await produceEvidence(chapters, round);
    const clear = loadKeyEvidenceClears(BOOK)!.clears.find((c) => c.chapterNumber === 1)!;
    // Rewrite ch1's source sidecar with materially different facts → new sourceHash.
    const runDir = resolve(REPO_ROOT, ".chapterflow/runs", BOOK, RUN);
    const sc = sourceSidecar(1);
    sc.testableFacts[0].claim = "A completely different fact claim to move the source hash.";
    writeFileSync(resolve(runDir, "sidecars/source", "ch01.source.json"), JSON.stringify(sc, null, 2), "utf8");
    const r = reverifyClear(BOOK, loadBookChapters(BOOK).find((c) => c.number === 1)!, clear, undefined);
    assert.ok(!r.fresh && /source hash changed/.test(r.reason), `source change must invalidate: ${JSON.stringify(r)}`);
  } finally { cleanup(); }
});

test("T11: a NEWER CORRUPTION is never masked by an OLDER PASS clear (ledger rebuilt from newest round)", async () => {
  const { chapters, round } = setup();
  try {
    // Round 1: honest evidence → PASS clears.
    await produceEvidence(chapters, round);
    assert.equal(loadManualKeyJudge(BOOK, 1)?.status, "PASS");
    // Edit ch1's prose so it goes STALE and re-derives in round 2 (re-derivation
    // only happens on changed content — the carry is correct for unchanged bytes).
    const ch1Edited = { ...chapters[0], keyTakeaway: chapters[0].keyTakeaway + " A materially altered prose claim that moves ch1's content hash." };
    rewriteChapter(ch1Edited);
    // Round 2: both keys agree AGAINST the stored key for the now-stale ch1 → CORRUPTION.
    const round2 = (() => { const { record, tokens } = openQcRound(BOOK); return { roundId: record.roundId, tokens }; })();
    const now = loadBookChapters(BOOK);
    const corruptReply = "```json\n" + JSON.stringify({
      chapters: now.map((ch) => ({
        chapterNumber: ch.number,
        packHash: "(echoed)",
        answers: ch.quiz.questions.map((q, i) => ({
          questionIndex: i,
          choiceIndex: ch.number === 1 && i === 0 ? (q.correctIndex + 1) % 3 : q.correctIndex, // ch1 q0: agree against stored key
          confidence: "high",
          reason: `Both readers independently derive this from mechanism fact${i}; the prose forces it and rules out the stored option.`,
          sourceFactIds: [`fact${i}`],
        })),
      })),
    }) + "\n```";
    const { deps } = mkDeps((o) => (o.sessionId.includes("author-key-") ? { finalMessage: corruptReply } : {}));
    const r = await runKeyJudgeEvidence(BOOK, now, deps, mkEvIo(), round2);
    assert.ok(!r.ok, "a CORRUPTION round fails CLOSED (never masked by the older PASS)");
    assert.equal(loadManualKeyJudge(BOOK, 1)?.status, "CORRUPTION", "newest-round-wins: ch1 is now CORRUPTION");
    // The ledger no longer clears ch1 (its keyjudge is not PASS).
    assert.ok(!reverifiedFreshChapters(BOOK, loadBookChapters(BOOK), () => undefined).has(1), "ch1 is not ledger-fresh under the newer corruption");
  } finally { cleanup(); }
});

test("T12: a partial-round strand (only ch1 stale) re-derives the SUBSET in a fresh round; the resolver stitches ch2", async () => {
  const { chapters, round } = setup();
  try {
    await produceEvidence(chapters, round);
    // Edit ONLY ch1's prose → ch1 stale, ch2 fresh.
    const ch1 = { ...chapters[0], keyTakeaway: chapters[0].keyTakeaway + " A distinct new prose claim to move ch1's content hash only." };
    rewriteChapter(ch1);
    const round2 = (() => { const { record, tokens } = openQcRound(BOOK); return { roundId: record.roundId, tokens }; })();
    const now = loadBookChapters(BOOK);
    const { deps, spawns } = mkDeps(keyAnswersReply(now));
    const r = await runKeyJudgeEvidence(BOOK, now, deps, mkEvIo(), round2);
    assert.ok(r.ok, `expected ok, got ${JSON.stringify(r)}`);
    // Exactly 2 spawns (keyA + keyB) — the SUBSET (ch1) drives them; ch2 is carried.
    assert.equal(spawns.length, 2, "one keyA + one keyB (subset re-derivation, not a full re-derive)");
    // The keyA derivation in round2 covers ONLY the stale subset (ch1).
    const a = JSON.parse(readFileSync(keyDerivationPath(BOOK, round2.roundId, "keyA"), "utf8"));
    assert.deepEqual(a.chapters.map((c: any) => c.chapterNumber).sort(), [1], "round2 keyA covers ONLY the stale ch1");
    // Both chapters resolve PASS (ch1 fresh in round2, ch2 stitched from round1).
    await withNoApiEnv(() => { for (const ch of now) assert.deepEqual(checkManualKeyJudge(ch, true), [], `promote PASS for ch${ch.number}`); });
  } finally { cleanup(); }
});

test("T13: end-to-end — a full carry spawns ZERO sessions; flipping one byte re-derives that chapter", async () => {
  const { chapters, round } = setup();
  try {
    await produceEvidence(chapters, round);
    // Re-run over UNCHANGED content → the promote predicate + ledger say fresh → ZERO spawns.
    const { deps, spawns } = mkDeps(() => ({}));
    const again = await runKeyJudgeEvidence(BOOK, loadBookChapters(BOOK), deps, mkEvIo(), round);
    assert.ok(again.ok && again.skipped === true, "full carry → skip");
    assert.equal(spawns.length, 0, "zero sessions on a full carry");

    // Flip one byte in ch2 → ch2 re-derives (a fresh round), ch1 carries.
    const ch2 = { ...chapters[1], hook: chapters[1].hook + " A new distinct opening beat that moves the content hash." };
    rewriteChapter(ch2);
    const round2 = (() => { const { record, tokens } = openQcRound(BOOK); return { roundId: record.roundId, tokens }; })();
    const now = loadBookChapters(BOOK);
    const { deps: deps2, spawns: spawns2 } = mkDeps(keyAnswersReply(now));
    const r2 = await runKeyJudgeEvidence(BOOK, now, deps2, mkEvIo(), round2);
    assert.ok(r2.ok, `expected ok, got ${JSON.stringify(r2)}`);
    assert.equal(spawns2.length, 2, "one flipped byte → exactly one keyA + one keyB re-derivation");
    const a = JSON.parse(readFileSync(keyDerivationPath(BOOK, round2.roundId, "keyA"), "utf8"));
    assert.deepEqual(a.chapters.map((c: any) => c.chapterNumber).sort(), [2], "only the flipped ch2 re-derives");
  } finally { cleanup(); }
});

// ── projection unit checks (packContentKey / answerKeyHash) ───────────────────

test("E4: packContentKey is round/time-INDEPENDENT (same bytes+source, different rounds → same key)", async () => {
  const { chapters, round } = setup();
  try {
    await produceEvidence(chapters, round);
    const pack1 = JSON.parse(readFileSync(keyPackPath(BOOK, round.roundId, 1), "utf8"));
    // A second round over identical bytes yields a pack with a different createdAt/roundId
    // but the SAME content projection.
    const round2 = (() => { const { record, tokens } = openQcRound(BOOK); return { roundId: record.roundId, tokens }; })();
    // Edit nothing — but to force round2 packs we mutate then restore is overkill;
    // instead assert the projection excludes roundId/createdAt directly.
    const withDifferentRoundTime = { ...pack1, roundId: round2.roundId, createdAt: "2099-01-01T00:00:00.000Z" };
    assert.equal(packContentKeyOf(pack1), packContentKeyOf(withDifferentRoundTime), "projection ignores roundId + createdAt");
    // A choice edit DOES move the projection.
    const edited = { ...pack1, questions: pack1.questions.map((q: any, i: number) => i === 0 ? { ...q, choices: [q.choices[0] + "x", ...q.choices.slice(1)] } : q) };
    assert.notEqual(packContentKeyOf(pack1), packContentKeyOf(edited), "a choice edit changes the projection");
  } finally { cleanup(); }
});

test("E4: answerKeyHash moves on a choice OR correctIndex edit, and is stable otherwise", () => {
  const ch = makeChapter(BOOK, 1);
  const base = answerKeyHashFor(ch);
  assert.equal(base, answerKeyHashFor(makeChapter(BOOK, 1)), "stable for identical bytes");
  const choiceEdit = { ...ch, quiz: { ...ch.quiz, questions: ch.quiz.questions.map((q, i) => i === 0 ? { ...q, choices: [q.choices[0] + "!", ...q.choices.slice(1)] } : q) } };
  assert.notEqual(base, answerKeyHashFor(choiceEdit), "choice edit moves it");
  const idxEdit = { ...ch, quiz: { ...ch.quiz, questions: ch.quiz.questions.map((q, i) => i === 0 ? { ...q, correctIndex: (q.correctIndex + 1) % 3 } : q) } };
  assert.notEqual(base, answerKeyHashFor(idxEdit), "correctIndex edit moves it");
  // A pure PROSE edit (not touching the quiz) leaves answerKeyHash unchanged (contentHash is the prose guard).
  const proseEdit = { ...ch, keyTakeaway: ch.keyTakeaway + " changed" };
  assert.equal(base, answerKeyHashFor(proseEdit), "answerKeyHash is quiz-only; prose is guarded by contentHash");
});
