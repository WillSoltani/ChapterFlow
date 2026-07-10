/**
 * CF-I-2 (owner decision 4) — C31–C35 register/machinery advisory SURFACING.
 *
 * S5's root cause (verification report §7.2): advisory critic findings never reached
 * the retry/repair lanes, so a chapter re-authored for some OTHER blocking reason
 * carried its register defect through the round unmentioned. CF-I-2 surfaces the
 * C31–C35 advisories as concrete fix lines into (a) the write-retry card and (b) the
 * surgical review-repair directive.
 *
 * The load-bearing invariant these tests pin: the surfacing NEVER introduces a
 * blocking path. Every surfaced finding is severity "minor"; the fix line is only
 * ever appended to a card ALREADY built for a blocking failure. A draft that trips
 * ONLY these advisories therefore still passes the gate — the surfacing changes the
 * TEXT the next writer sees, never a pass/fail predicate.
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "fs";
import { resolve } from "path";

import { test, skip } from "./harness.js";
import { STATE_CHAPTERS } from "./helpers.js";
import { runShipGate } from "../src/critics/finalGate.js";
import {
  collectRegisterAdvisories,
  registerAdvisoryFixLines,
  registerAdvisoryRetryBlock,
} from "../src/critics/registerAdvisories.js";
import { buildRepairCard } from "../src/orchestrator/authorRepair.js";
import { authorWriteOneChapter, type AuthorIo } from "../src/orchestrator/authorRun.js";
import type { AutopilotDeps } from "../src/orchestrator/autopilot.js";
import { CHAPTER_BRIEF_SCHEMA_VERSION, type ChapterBriefV1, type SourcePacketV1 } from "../src/artifacts/artifactTypes.js";
import type { ChapterV21 } from "../src/types.js";

// A chapter whose three example whatToDo fields open with a short evaluator question
// answered in the next clause — the C31 (exampleRegister) tic, ≥3 fields ⇒ fires.
function c31Chapter(chapterId = "zz-adv-surface-ch01", number = 1): ChapterV21 {
  return {
    chapterId,
    number,
    title: "Advisory Surfacing Fixture",
    examples: [
      { exampleId: "ex01", scenario: "A team scene unfolds at the desk.", whatToDo: "What changed? The lead owned the date.", whyItMatters: "It shipped on time." },
      { exampleId: "ex02", scenario: "Another scene in the office.", whatToDo: "Why does it work? It closes the loop.", whyItMatters: "Focus returns." },
      { exampleId: "ex03", scenario: "A third scene by the window.", whatToDo: "What nearly failed? The handoff slipped.", whyItMatters: "The cost landed." },
    ],
  } as unknown as ChapterV21;
}

// A clean chapter — narrated example voice, no evaluator openers.
function cleanChapter(): ChapterV21 {
  return {
    chapterId: "zz-adv-clean-ch01",
    number: 1,
    title: "Clean Fixture",
    examples: [
      { exampleId: "ex01", scenario: "A nurse ends a twelve-hour shift.", whatToDo: "Mark the day before you leave the floor.", whyItMatters: "The streak stays honest." },
    ],
  } as unknown as ChapterV21;
}

// A chapter carrying the CF-J C36 apparatus classes: a page citation + guide-structure
// narration in prose, machinery vocabulary inside a quiz choice, and a spec-narration
// sentence in an example — the radical-candor §7 inventory in miniature.
function c36Chapter(chapterId = "zz-adv-c36-ch01", number = 1): ChapterV21 {
  return {
    chapterId,
    number,
    title: "Apparatus Fixture",
    breakdown: {
      fastRead: "The official guide places the tool at Ch. 6 pp. 137-141 for reference.",
      deepRead: "",
      fullRead: "",
    },
    examples: [
      { exampleId: "ex01", scenario: "The outcome is not claimed here. The proof is earlier: the mug sat where he left it.", whatToDo: "Name the behavior.", whyItMatters: "The habit holds." },
    ],
    quiz: {
      questions: [{
        questionId: "q01",
        prompt: "A trainer stretches the checklist into a culture slogan. What went wrong?",
        choices: [
          "The checklist was applied too late.",
          "A delivery checklist was used as a culture label.",
          "Page references were accepted as proof the tools are interchangeable.",
        ],
        correctIndex: 1,
        explanation: "The tool belongs to feedback mechanics, not every culture problem.",
      }],
    },
  } as unknown as ChapterV21;
}

test("CF-J: C36 rides the SAME advisory routing — collected minor-only, with the strip-apparatus directives", () => {
  const advisories = collectRegisterAdvisories(c36Chapter());
  const c36 = advisories.filter((f) => String(f.checkId).startsWith("C36."));
  assert.ok(c36.length >= 3, `page-citation + guide-structure + machinery + spec-narration advisories expected; got ${advisories.map((f) => f.checkId).join(", ")}`);
  assert.ok(advisories.every((f) => f.severity === "minor"), "every C36 finding is severity minor (never blocks)");

  const lines = registerAdvisoryFixLines(c36Chapter());
  // The directive text per the CF-J spec rides the fix lines verbatim.
  assert.ok(lines.some((l) => l.includes("[C36.apparatus_page_citation]") && /internal coordinates/i.test(l)), "strip-apparatus directive (page citations are internal coordinates)");
  assert.ok(lines.some((l) => l.includes("[C36.apparatus_guide_structure]") && /replace the structure-talk with the idea/i.test(l)), "structure-talk → the idea directive");
  assert.ok(lines.some((l) => l.includes("[C36.apparatus_machinery_term]") && /quiz\/card surfaces/i.test(l)), "machinery-out-of-quiz/card directive");
  assert.ok(lines.some((l) => l.includes("[C36.apparatus_spec_narration]") && /natural explanation/i.test(l)), "spec-narration → natural explanation directive");
  // Facts/keys/schema preservation is stated on the lines that touch graded surfaces.
  assert.ok(lines.some((l) => /key/i.test(l) && /unchanged/i.test(l)), "the preserve-facts/keys/schema clause rides the directives");

  const block = registerAdvisoryRetryBlock(c36Chapter());
  assert.match(block, /ADVISORY REGISTER NOTES/, "the C36 lines ride the same retry block as C31–C35");
  assert.match(block, /\[C36\.apparatus_page_citation\]/);
});

test("CF-J: the surgical review-repair directive carries the C36 fix lines (same routing as C31–C35)", () => {
  const card = buildRepairCard({
    bookId: "zz-adv-c36",
    chapter: c36Chapter(),
    complaints: ["Quiz question 1's distractor teaches pipeline vocabulary."],
    scopes: ["quiz"],
    relPath: "state/chapters/zz-adv-c36-ch01.v21-native.chapter.json",
  });
  assert.match(card, /ADVISORY REGISTER NOTES \(never block; do NOT expand scope/);
  assert.match(card, /\[C36\.apparatus_machinery_term\]/, "the machinery fix line rides the repair directive");
  assert.match(card, /\[C36\.apparatus_page_citation\]/, "the page-citation fix line rides the repair directive");
});

test("CF-I-2 helper: register advisories collect as MINOR-only fix lines; a clean draft yields none", () => {
  const advisories = collectRegisterAdvisories(c31Chapter());
  assert.ok(advisories.length >= 1, "the C31 fixture trips at least one register advisory");
  // The no-new-blocking-path proof: EVERY surfaced finding is advisory (minor). The
  // surfacing can therefore never turn an advisory into a gate blocker.
  assert.ok(advisories.every((f) => f.severity === "minor"), "every surfaced register finding is severity minor (never blocks)");

  const lines = registerAdvisoryFixLines(c31Chapter());
  assert.equal(lines.length, advisories.length, "one fix line per finding");
  assert.ok(lines.some((l) => l.includes("[C31.example_evaluator_register]")), "the C31 fix line names its check id");

  assert.deepEqual(registerAdvisoryFixLines(cleanChapter()), [], "a clean draft surfaces no fix lines");
  assert.equal(registerAdvisoryRetryBlock(cleanChapter()), "", "a clean draft yields an empty retry block");
});

test("CF-I-2 (b): the surgical review-repair directive surfaces register advisories WITHOUT expanding scope", () => {
  const card = buildRepairCard({
    bookId: "zz-adv-surface",
    chapter: c31Chapter(),
    complaints: ["Quiz question 3's key repeats a whole sentence from the deep read."],
    scopes: ["quiz"],
    relPath: "state/chapters/zz-adv-surface-ch01.v21-native.chapter.json",
  });
  assert.match(card, /ADVISORY REGISTER NOTES \(never block; do NOT expand scope/, "the repair directive carries the advisory notes header");
  assert.match(card, /\[C31\.example_evaluator_register\]/, "the C31 fix line rides the repair directive");
  // Scope is unchanged — the advisory note explicitly does not widen it.
  assert.match(card, /ALLOWED SCOPE \(edits anywhere else are discarded\): quiz/, "the allowed scope is still exactly what the reviewer complaints justified");

  const clean = buildRepairCard({
    bookId: "zz-adv-clean",
    chapter: cleanChapter(),
    complaints: ["Quiz question 3's key repeats a whole sentence from the deep read."],
    scopes: ["quiz"],
    relPath: "state/chapters/zz-adv-clean-ch01.v21-native.chapter.json",
  });
  assert.doesNotMatch(clean, /ADVISORY REGISTER NOTES/, "a clean chapter adds no advisory section");
});

// ── Driven write-retry: attempt-1 trips C31 → attempt-2 card carries the fix line ──
const PACKET = { facts: [], allowedNumbers: [] } as unknown as SourcePacketV1;

function mkBrief(n: number): ChapterBriefV1 {
  return {
    schemaVersion: CHAPTER_BRIEF_SCHEMA_VERSION,
    chapterId: `zz-adv-retry-ch${String(n).padStart(2, "0")}`,
    chapterNumber: n,
    title: `Fixture Chapter ${n}`,
    coreMove: "One move.",
    thesis: "One thesis.",
    readerPromise: "One promise.",
    ownedCases: [],
    notYours: [],
    cast: [],
    answerIndexPattern: [0, 1, 2, 0, 1, 2, 0, 1, 2],
    avoid: [],
    lengthBudget: { renderedChars: 16000, tolerance: 0.2 },
    flavor: [],
    openerType: "question",
    challengeFrame: "before-your-next-X",
    practiceShape: "single-imperative",
  };
}

test("CF-I-2 (a): a C31-tripping attempt-1 draft (that also fails the gate) puts the advisory fix line on the attempt-2 card", async () => {
  const draftBytes = JSON.stringify(c31Chapter("zz-adv-retry-ch01", 1)) + "\n";
  const tasks: string[] = [];
  const files = new Map<number, string>();
  let sid = 0;
  const deps = {
    // Gate blocks EVERY attempt — this forces the retry lane; the advisory block is
    // appended to the gate-blocker card, never a trigger of its own.
    runVerb: async (args: string[]) => args[0] === "gate-chapter"
      ? { code: 1, stdout: "[BLOCKER A12] ch: lowercase sentence boundary", stderr: "" }
      : { code: 0, stdout: "", stderr: "" },
    spawn: (async (o: { sessionId: string; task: string }) => {
      tasks.push(o.task);
      files.set(1, draftBytes); // the writer lands its draft before any self-check
      return { ok: true, exitCode: 0, finalMessage: "done", stdout: "", stderr: "", durationMs: 1, sessionId: o.sessionId };
    }) as unknown as AutopilotDeps["spawn"],
    mkSessionId: (label: string) => `${label}#${++sid}`,
    expectedChapterNumbers: () => [1],
    logSession: () => {},
    log: () => {},
  } as unknown as AutopilotDeps;
  const io: Partial<AuthorIo> = {
    chapterExists: (_b, n) => files.has(n),
    readChapterFile: (_b, n) => files.get(n) ?? null,
    writeChapterFile: (_b, n, bytes) => { files.set(n, bytes); },
    removeChapterFile: (_b, n) => { files.delete(n); },
    readBriefMd: () => "# brief\n",
    readBrief: () => mkBrief(1),
    readPacket: () => PACKET,
    loadChapters: () => [...files.values()].map((f) => JSON.parse(f)),
    nameBankOk: () => true,
    voiceCard: () => null,
    authorSessionOf: () => undefined,
    recordProvenance: () => {},
    readLeadOverride: () => null,
    writeLeadOverride: () => {},
  };

  const r = await authorWriteOneChapter("zz-adv-retry", 1, deps, { io, totalChapters: 2 });
  assert.ok(!r.ok, "the chapter still fails closed on the gate blocker (the advisory changed no verdict)");
  assert.ok(tasks.length >= 2, "the gate blocker drove at least one retry (≥2 spawns)");

  // Attempt 1's card is the clean base — no advisory block yet.
  assert.doesNotMatch(tasks[0], /ADVISORY REGISTER NOTES/, "attempt-1 (first) card has no advisory block");
  // Attempt 2's card carries BOTH the real gate blocker AND the surfaced C31 fix line.
  assert.match(tasks[1], /GATE BLOCKERS FROM YOUR PREVIOUS ATTEMPT/, "attempt-2 card still leads with the real blocking failure");
  assert.match(tasks[1], /ADVISORY REGISTER NOTES \(these never fail the gate/, "attempt-2 card surfaces the advisory register notes");
  assert.match(tasks[1], /\[C31\.example_evaluator_register\]/, "attempt-2 card carries the concrete C31 fix line");
});

// ── CF-I regen surfacing (Fix A) — the re-mint bug. A REGEN (review-FAIL,
// acceptance-round, budget-repair — all reach authorWriteOneChapter with
// complaints) previously built its attempt-1 card blind to the PRIOR reviewed
// draft's C31–C35 advisories, so the regen re-minted the exact register defects
// (live: multipliers ch02 re-minted 10 evaluator openers). ──

/** Shared driver: seed disk with `priorDraft`, run a regen (complaints present)
 *  whose writer lands `writerDraft`; the gate blocks every attempt. Returns the
 *  cards each spawn received. */
async function driveRegen(bookId: string, priorDraft: ChapterV21, writerDraft: ChapterV21): Promise<{ tasks: string[]; result: { ok: boolean } }> {
  const tasks: string[] = [];
  const files = new Map<number, string>([[1, JSON.stringify(priorDraft) + "\n"]]);
  let sid = 0;
  const deps = {
    runVerb: async (args: string[]) => args[0] === "gate-chapter"
      ? { code: 1, stdout: "[BLOCKER A12] ch: lowercase sentence boundary", stderr: "" }
      : { code: 0, stdout: "", stderr: "" },
    spawn: (async (o: { sessionId: string; task: string }) => {
      tasks.push(o.task);
      files.set(1, JSON.stringify(writerDraft) + "\n");
      return { ok: true, exitCode: 0, finalMessage: "done", stdout: "", stderr: "", durationMs: 1, sessionId: o.sessionId };
    }) as unknown as AutopilotDeps["spawn"],
    mkSessionId: (label: string) => `${label}#${++sid}`,
    expectedChapterNumbers: () => [1],
    logSession: () => {},
    log: () => {},
  } as unknown as AutopilotDeps;
  const io: Partial<AuthorIo> = {
    chapterExists: (_b, n) => files.has(n),
    readChapterFile: (_b, n) => files.get(n) ?? null,
    writeChapterFile: (_b, n, bytes) => { files.set(n, bytes); },
    removeChapterFile: (_b, n) => { files.delete(n); },
    readBriefMd: () => "# brief\n",
    readBrief: () => mkBrief(1),
    readPacket: () => PACKET,
    loadChapters: () => [...files.values()].map((f) => JSON.parse(f)),
    nameBankOk: () => true,
    voiceCard: () => null,
    authorSessionOf: () => undefined,
    recordProvenance: () => {},
    readLeadOverride: () => null,
    writeLeadOverride: () => {},
  };
  const result = await authorWriteOneChapter(bookId, 1, deps, {
    complaints: ["Reviewer must-fix: ex01 whatToDo opens on an evaluator question."],
    io,
    totalChapters: 2,
  });
  return { tasks, result };
}

test("CF-I Fix A (a): a review-FAIL regen of an advisory-tripping reviewed draft seeds the ATTEMPT-1 card with the advisory block", async () => {
  // Disk holds the reviewed C31 draft; the writer's fresh draft is CLEAN — so the
  // attempt-1 block can only have come from the PRIOR draft the reviewers saw, and
  // the attempt-2 (gate-blocker) card proves the in-loop block tracks the FRESH draft.
  const { tasks, result } = await driveRegen("zz-adv-regen", c31Chapter("zz-adv-regen-ch01", 1), { ...cleanChapter(), chapterId: "zz-adv-regen-ch01", number: 1 } as unknown as ChapterV21);
  assert.ok(!result.ok, "the regen still fails closed on the gate blocker (no verdict changed)");
  assert.ok(tasks.length >= 2, "the gate blocker still drives the retry lane");
  assert.match(tasks[0], /ADVISORY REGISTER NOTES \(these never fail the gate/, "the attempt-1 REGEN card carries the prior draft's advisory block");
  assert.match(tasks[0], /\[C31\.example_evaluator_register\]/, "the attempt-1 regen card carries the concrete C31 fix line");
  assert.doesNotMatch(tasks[1], /ADVISORY REGISTER NOTES/, "the attempt-2 card reflects the FRESH (clean) draft — the block is not sticky");
});

test("CF-J: a regen of a C36-tripping reviewed draft seeds the ATTEMPT-1 card with the apparatus fix lines", async () => {
  const { tasks, result } = await driveRegen(
    "zz-adv-regen-c36",
    c36Chapter("zz-adv-regen-c36-ch01", 1),
    { ...cleanChapter(), chapterId: "zz-adv-regen-c36-ch01", number: 1 } as unknown as ChapterV21,
  );
  assert.ok(!result.ok, "the regen still fails closed on the gate blocker (no verdict changed)");
  assert.match(tasks[0], /\[C36\.apparatus_page_citation\]/, "the attempt-1 regen card carries the prior draft's C36 page-citation fix line");
  assert.match(tasks[0], /\[C36\.apparatus_machinery_term\]/, "…and the machinery fix line (quiz surface)");
  assert.doesNotMatch(tasks[1], /ADVISORY REGISTER NOTES/, "the attempt-2 card reflects the FRESH (clean) draft");
});

test("CF-I Fix A (b): a regen of an advisory-CLEAN reviewed draft adds no block to the attempt-1 card", async () => {
  const { tasks } = await driveRegen("zz-adv-regen-clean", { ...cleanChapter(), chapterId: "zz-adv-regen-clean-ch01", number: 1 } as unknown as ChapterV21, c31Chapter("zz-adv-regen-clean-ch01", 1));
  assert.doesNotMatch(tasks[0], /ADVISORY REGISTER NOTES/, "a clean prior draft yields an empty block — the attempt-1 card is the plain base");
  // The in-loop surfacing is unchanged: attempt 2 sees the fresh (C31) draft's block.
  assert.match(tasks[1], /ADVISORY REGISTER NOTES/, "the attempt-2 card surfaces the freshly-written draft's advisories, as before");
});

// (c) the non-regen fresh write is pinned above ("attempt-1 (first) card has no
// advisory block") — no complaints ⇒ no block before any failure.

// ── The no-new-blocking-path proof, asserted DIRECTLY on the real gold corpus:
// every start-with-why chapter that trips a C31–C36 advisory still PASSES the ship
// gate (`passed === true`) — the surfacing changed text, never a predicate.
// (collectRegisterAdvisories now includes CF-J's C36, so this assertion set covers
// it by construction; the C36-specific planted-vs-clean passed-parity proof lives
// in tests/apparatus-leakage.test.ts.) ──
{
  const bookId = "start-with-why";
  const files = existsSync(STATE_CHAPTERS)
    ? readdirSync(STATE_CHAPTERS).filter((f) => f.startsWith(`${bookId}-ch`) && f.endsWith(".v21-native.chapter.json"))
    : [];
  if (files.length === 0) {
    skip("CF-I Fix A: advisory-only gold chapters pass the ship gate", `no ${bookId} chapters in state/chapters/ on this machine`);
  } else {
    test("CF-I Fix A: every advisory-carrying gold chapter still passes the ship gate (passed === true)", () => {
      let advisoryChapters = 0;
      for (const f of files) {
        const ch = JSON.parse(readFileSync(resolve(STATE_CHAPTERS, f), "utf8")) as ChapterV21;
        if (collectRegisterAdvisories(ch).length === 0) continue;
        advisoryChapters++;
        const report = runShipGate(ch);
        assert.equal(report.passed, true, `${ch.chapterId} trips only advisories yet must PASS the ship gate; blockers: ${report.blockers.map((b) => b.catalogId).join(", ")}`);
      }
      assert.ok(advisoryChapters >= 1, "the gold corpus exercises the advisory-only-still-passes property (measured 7 chapters on 2026-07-09)");
    });
  }
}
