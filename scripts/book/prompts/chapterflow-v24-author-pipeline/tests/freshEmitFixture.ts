/**
 * Fresh-emit fixture harness (WP-101 — V25 S-Tier §8 Lane 1).
 *
 * Builds a hermetic, gate-clean, ONE-chapter book and drives it through the
 * REAL `promoteBook()` machinery (the same assemble → ship-gate → strip →
 * write path every shipped book goes through) so callers get a genuinely
 * PRODUCED `book-packages/<bookId>.v21.json` byte stream — never a hand-typed
 * package object. This is the "fresh emission" WP-101 feeds through the two
 * hand-maintained web adapters (server `adaptV21ToV13`, client
 * `normalizeV21Package`/`extractV21ChapterExtras`).
 *
 * The chapter is built from `makeGateCleanChapter` (the shared pipeline test
 * fixture already used by tests/promote-gate.test.ts) plus an ADDED
 * `experiencePlan` (failureRecovery + transferPrompt + behaviorLoop) so the
 * emission exercises every richness field WP-101 must assert parity for:
 * hook, memorableLines, examples, implementationPlan, reviewCards,
 * experiencePlan.
 *
 * Everything this module writes lives under a single `zz-` prefixed bookId
 * and is removed by `cleanupFreshEmission()` — mirroring the cleanup
 * convention in tests/promote-gate.test.ts. Zero live model/API calls: every
 * gate promoteBook runs here is deterministic/file-based (ship gate, book
 * gate, source-v2 structural gate, source-reality policy, QC-attestation
 * presence) — see promote-gate.test.ts's identical pattern.
 */

import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "fs";
import { createHash } from "crypto";
import { resolve } from "path";

import type { ChapterV21, ExperiencePlanV21 } from "../src/types.js";
import { promoteBook, productionManifestSidecarPath } from "../src/promoteBook.js";
import { chapterContentHash, writeAttestation, attestationPath } from "../src/critics/qcAttestation.js";
import { sourceVerifyRecordPath } from "../src/critics/sourceVerify.js";
import {
  makeGateCleanChapter,
  makeSourceV2SidecarFixture,
  writeFixtureBook,
  writeCanonicalIndexFixture,
  writeResearchRunManifestFixture,
  writeVerifiedSourceVerifyRecord,
  PIPELINE_DIR,
  STATE_CHAPTERS,
  STATE_INDEXES,
  RUNS_DIR,
} from "./helpers.js";

export const FRESH_EMIT_BOOK_ID = "zz-fixture-wp101-fresh-emit";
const RUN_ID = "zz-test-wp101-fresh-emit";

// ─── source-v2 provenance (SC11) ────────────────────────────────────────────
//
// promoteBook's checkSourceV2Gate (Step in promoteBook.ts) requires a
// source-v2 sidecar on disk for every promoted chapter number — there is no
// way to opt a book out of it. The moment a source-v2 sidecar exists, the
// ship gate's SC11 (declared provenance, src/critics/sourceGrounding.ts)
// ALSO activates for that chapter and requires every claim-bearing unit
// (hook, breakdown tiers, examples, quiz, review cards, implementation plan,
// memorable lines — NOT experiencePlan, which SC11 does not walk) to declare
// a source anchor id that (a) exists in the sidecar's anchor catalog, (b)
// supports that unit's claim type, and (c) — for anchors that carry
// `hardSpecifics` (named-example anchors only; fact anchors carry none, see
// `buildSourceAnchorCatalog`) — has at least one hardSpecific literally
// present in the unit's own text.
//
// This is the SAME recipe tests/promote-gate.test.ts's `setupMajorCleanFixture`
// fixture uses (`applySourceProvenance` + `sourceSidecarForChapter`), ported
// here rather than imported because those helpers are private to that test
// file. Named-example hardSpecifics are DERIVED from the chapter's own
// example text (via `sourceSpecifics`) so the "must appear in the unit's
// text" check is satisfied by construction — not asserted as a coincidence.

function sourceAnchorId(chapterNumber: number, kind: "fact" | "ex" | "concept", index = 1): string {
  const nn = String(chapterNumber).padStart(2, "0");
  if (kind === "concept") return `ch${nn}.concept.intake-checkpoint`;
  return `ch${nn}.${kind}.${index}`;
}

/** Pull 2-3 "significant" (4+ letter, non-stopword) words out of a text block
 *  so a named-example anchor's hardSpecifics are guaranteed to already be
 *  present in the example they're attached to. */
function sourceSpecifics(text: string): string[] {
  const stop = new Set("about above after again against also because before below between chapter could every first from have into more must only other should their there these those through under where which while with would your".split(" "));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const word of text.toLowerCase().match(/[a-z][a-z'-]{3,}/g) ?? []) {
    const clean = word.replace(/^'+|'+$/g, "");
    if (clean.length < 4 || stop.has(clean) || seen.has(clean)) continue;
    seen.add(clean);
    out.push(clean);
    if (out.length >= 3) break;
  }
  return out.length >= 2 ? out : ["source", "fixture"];
}

/** Stamp every SC11-visible unit (and the chapter's `authoring.sourceAnchors`
 *  provenance map) with a source anchor id from the anchor scheme above.
 *  Mirrors tests/promote-gate.test.ts's `applySourceProvenance`. */
function applySourceProvenance(chapter: any): any {
  const chapterNumber = chapter.number;
  const nn = String(chapterNumber).padStart(2, "0");
  const factIds = Array.from({ length: 9 }, (_, i) => sourceAnchorId(chapterNumber, "fact", i + 1));
  const effectiveAnchors: Record<string, string[]> = {
    hook: [factIds[0]],
    counterintuition: [factIds[0]],
    "breakdown.fastRead": [factIds[0]],
    "breakdown.deepRead": [factIds[1]],
    "breakdown.fullRead": [factIds[2]],
    keyTakeaway: [factIds[3]],
    tryThisNow: [factIds[4]],
    "implementationPlan.title": [factIds[4]],
    "implementationPlan.coreSkill": [factIds[4]],
    "implementationPlan.twentyFourHourChallenge": [factIds[4]],
    "implementationPlan.weeklyPractice": [factIds[4]],
  };

  chapter.hookSourceAnchorIds = [factIds[0]];
  chapter.counterintuitionSourceAnchorIds = [factIds[0]];
  chapter.keyTakeawaySourceAnchorIds = [factIds[3]];
  chapter.tryThisNowSourceAnchorIds = [factIds[4]];
  chapter.examples?.forEach((example: any, i: number) => {
    const id = sourceAnchorId(chapterNumber, "ex", i + 1);
    example.sourceAnchorId = id;
    example.sourceAnchorIds = [id];
    effectiveAnchors[`examples[${i}]`] = [id];
  });
  chapter.quiz?.questions?.forEach((question: any, i: number) => {
    const id = factIds[i % factIds.length];
    question.sourceAnchorId = id;
    effectiveAnchors[`quiz.questions[${i}]`] = [id];
    effectiveAnchors[`quiz.questions[${i}].keyEvidence`] = [id];
  });
  chapter.reviewCards?.forEach((card: any, i: number) => {
    const id = factIds[(i + 3) % factIds.length];
    card.sourceAnchorId = id;
    card.sourceAnchorIds = [id];
    effectiveAnchors[`reviewCards[${i}]`] = [id];
  });
  if (chapter.implementationPlan) {
    chapter.implementationPlan.titleSourceAnchorIds = [factIds[4]];
    chapter.implementationPlan.coreSkillSourceAnchorIds = [factIds[4]];
    chapter.implementationPlan.twentyFourHourChallengeSourceAnchorIds = [factIds[4]];
    chapter.implementationPlan.weeklyPracticeSourceAnchorIds = [factIds[4]];
    chapter.implementationPlan.ifThenPlans?.forEach((item: any, i: number) => {
      const id = factIds[(i + 4) % factIds.length];
      item.sourceAnchorId = id;
      item.sourceAnchorIds = [id];
      effectiveAnchors[`implementationPlan.ifThenPlans[${i}]`] = [id];
    });
  }
  chapter.memorableLines?.forEach((line: any, i: number) => {
    const id = factIds[i % factIds.length];
    line.sourceAnchorIds = [id];
    effectiveAnchors[`memorableLines[${i}]`] = [id];
  });
  chapter.authoring = {
    ...(chapter.authoring ?? {}),
    schemaVersion: "chapter-authoring-v1",
    sourceAnchors: {
      schemaVersion: "chapter-source-anchor-map-v1",
      sourceHash: `fixture-source-${chapter.chapterId}`,
      observedAnchorIds: [
        sourceAnchorId(chapterNumber, "concept"),
        ...Array.from({ length: chapter.examples?.length ?? 0 }, (_, i) => sourceAnchorId(chapterNumber, "ex", i + 1)),
        ...factIds,
      ],
      effectiveAnchors,
    },
  };
  return chapter;
}

/** Build a source-v2 sidecar whose namedExamples mirror the chapter's OWN
 *  examples (one per example, id-aligned with `applySourceProvenance`) and
 *  whose hardSpecifics are extracted FROM that example's own text — so SC11.2
 *  ("unit must use its cited anchor's hardSpecifics") is satisfied by
 *  construction, not by luck. Mirrors tests/promote-gate.test.ts's
 *  `sourceSidecarForChapter`. */
function sourceSidecarForChapter(chapter: any, chapterTitle: string): any {
  const base = makeSourceV2SidecarFixture({ chapterNumber: chapter.number, chapterTitle });
  base.namedExamples = (chapter.examples ?? []).map((example: any, i: number) => {
    const text = [example.title, example.scenario, example.whatToDo, example.whyItMatters].filter(Boolean).join(" ");
    const specifics = sourceSpecifics(text);
    return {
      id: sourceAnchorId(chapter.number, "ex", i + 1),
      label: String(example.title ?? `Chapter ${chapter.number} sourced example ${i + 1}`),
      summary: `${String(example.scenario ?? "").slice(0, 260)} ${specifics.join(" ")}.`,
      teachesWhat: String(example.whyItMatters ?? "Use the chapter's concrete source example."),
      hardSpecifics: specifics,
      realWorld: false,
    };
  });
  base.testableFacts = base.testableFacts.map((fact: any) => ({
    ...fact,
    derivedFrom: sourceAnchorId(chapter.number, "concept"),
  }));
  base.paraphraseNotes = `${chapterTitle} source fixture names ${base.namedExamples.map((ex: any) => ex.hardSpecifics.slice(0, 2).join(" ")).join("; ")}.`;
  return base;
}

function sourceRunDir(bookId: string, runId: string): string {
  return resolve(RUNS_DIR, bookId, runId);
}

/** Stamp `chapter` with source provenance, then write the matching
 *  research-run manifest + source-v2 sidecar so checkSourceV2Gate AND SC11
 *  both see a consistent, satisfiable source-v2 record. Returns the
 *  provenance-stamped chapter (same object, mutated). */
function provisionSourceProvenance(bookId: string, chapter: ChapterV21): ChapterV21 {
  applySourceProvenance(chapter);
  writeResearchRunManifestFixture({
    runDir: sourceRunDir(bookId, RUN_ID),
    bookId,
    chapters: [{ number: chapter.number, title: chapter.title }],
  });
  const dir = resolve(sourceRunDir(bookId, RUN_ID), "sidecars", "source");
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    resolve(dir, `ch${String(chapter.number).padStart(2, "0")}.source.json`),
    `${JSON.stringify(sourceSidecarForChapter(chapter, chapter.title), null, 2)}\n`,
    "utf8",
  );
  return chapter;
}

/** A richness-complete, structurally valid experiencePlan. Plain, concrete
 *  prose (no em dash, no "chapter"/meta-reference, no self-compassion or
 *  archetype clichés) so it survives the ship-gate register checks the same
 *  way the rest of makeGateCleanChapter's prose does. */
function buildExperiencePlan(): ExperiencePlanV21 {
  return {
    failureRecovery: {
      normalizingLine: "A skipped check on a busy day is a scheduling gap, not proof the habit failed.",
      cueQuestion: "What was different about today that pushed the check aside?",
      options: [
        "Run the check now, even a few hours late.",
        "Shrink it to the single fastest comparison.",
        "Pick the exact time it will happen tomorrow.",
      ],
      repairLine: "Restart at the very next natural checkpoint instead of waiting for a clean week.",
    },
    transferPrompt: {
      prompt: "Where else does a small unnoticed gap turn into a large, expensive one?",
      contexts: ["a home budget", "a shared calendar", "a group project handoff"],
    },
    behaviorLoop: {
      readerPatterns: [
        {
          id: "unit-opens-without-checking",
          label: "Opens a new task before closing yesterday's open item",
          mapsToPlanIndex: 0,
          mapsToExampleIndex: 0,
        },
        {
          id: "unit-trusts-the-summary",
          label: "Trusts a polished summary over the original source note",
          mapsToPlanIndex: 1,
          mapsToExampleIndex: 1,
        },
      ],
    },
  };
}

function chapterStatePath(chapterId: string): string {
  return resolve(STATE_CHAPTERS, `${chapterId}.v21-native.chapter.json`);
}

function gateReportPath(bookId: string): string {
  return resolve(PIPELINE_DIR, "state", "books", `${bookId}.gate.json`);
}

function productionPackagePath(bookId: string): string {
  return resolve(PIPELINE_DIR, "book-packages", `${bookId}.v21.json`);
}

/** Remove every artifact this module can have written for `bookId`. Safe to
 *  call before AND after building (idempotent; never throws on absence). */
export function cleanupFreshEmission(bookId: string = FRESH_EMIT_BOOK_ID): void {
  rmSync(chapterStatePath(`${bookId}-ch01`), { force: true });
  rmSync(resolve(STATE_INDEXES, `${bookId}.json`), { force: true });
  rmSync(gateReportPath(bookId), { force: true });
  rmSync(productionPackagePath(bookId), { force: true });
  rmSync(productionManifestSidecarPath(bookId), { force: true });
  rmSync(sourceVerifyRecordPath(bookId), { force: true });
  rmSync(attestationPath(bookId, 1), { force: true });
  rmSync(resolve(RUNS_DIR, bookId), { recursive: true, force: true });
  rmSync(resolve(PIPELINE_DIR, "state", "books", "_transactions"), { recursive: true, force: true });
  rmSync(resolve(PIPELINE_DIR, "state", "briefs", `${bookId}.manual-brief.json`), { force: true });
  rmSync(resolve(PIPELINE_DIR, "state", "plans", `${bookId}-ch01.manual-plan.json`), { force: true });
  // bookGate's reader-budgets check (CHB6) mints state/books/<bookId>/current-run.json
  // as a side effect of the default (non-injected-briefLookup) brief read.
  rmSync(resolve(PIPELINE_DIR, "state", "books", bookId), { recursive: true, force: true });
  const blockedDir = resolve(PIPELINE_DIR, "state", "books", "_blocked");
  try {
    for (const f of readdirSync(blockedDir)) {
      if (f.startsWith(`${bookId}.`)) rmSync(resolve(blockedDir, f), { force: true });
    }
  } catch { /* dir absent — nothing to clean */ }
}

/** Temporarily clear the no-API/require-keyjudge env toggles for the duration
 *  of `fn` so promoteBook takes the same "clean production promote" path
 *  tests/promote-gate.test.ts's happy-path fixtures use (no live model calls
 *  either way — these toggles only pick which deterministic file-based
 *  checks run, see promoteBook.ts step 3.7). Restores the prior values
 *  (present or absent) afterwards. */
function withPromotionEnvCleared<T>(fn: () => T): T {
  const prevNoApi = process.env.CHAPTERFLOW_NO_API_CODEX_QC;
  const prevRequireKeyJudge = process.env.CHAPTERFLOW_REQUIRE_KEYJUDGE;
  try {
    delete process.env.CHAPTERFLOW_NO_API_CODEX_QC;
    delete process.env.CHAPTERFLOW_REQUIRE_KEYJUDGE;
    return fn();
  } finally {
    if (prevNoApi === undefined) delete process.env.CHAPTERFLOW_NO_API_CODEX_QC;
    else process.env.CHAPTERFLOW_NO_API_CODEX_QC = prevNoApi;
    if (prevRequireKeyJudge === undefined) delete process.env.CHAPTERFLOW_REQUIRE_KEYJUDGE;
    else process.env.CHAPTERFLOW_REQUIRE_KEYJUDGE = prevRequireKeyJudge;
  }
}

export type FreshEmission = {
  bookId: string;
  packagePath: string;
  bytes: string;
  parsed: Record<string, unknown>;
  sha256: string;
};

/**
 * Build a hermetic one-chapter book and genuinely promote it through
 * `promoteBook()`. Throws (with `result.reason`) if the fixture fails to
 * promote — a setup bug, never something a consuming test should swallow.
 * Caller MUST call `cleanupFreshEmission()` in a finally block.
 */
export function buildFreshEmission(bookId: string = FRESH_EMIT_BOOK_ID): FreshEmission {
  cleanupFreshEmission(bookId); // idempotent: clear any crash-leftover from a prior run first

  const chapter: ChapterV21 = makeGateCleanChapter(bookId, 1);
  chapter.experiencePlan = buildExperiencePlan();
  provisionSourceProvenance(bookId, chapter);

  writeFixtureBook(STATE_CHAPTERS, [chapter]);
  writeCanonicalIndexFixture(bookId, [{ chapterId: chapter.chapterId, number: chapter.number, title: chapter.title }]);
  writeVerifiedSourceVerifyRecord(bookId);

  // Book-gate (runBookGate) auto-derives brief/plan artifacts from the
  // research run and blocks without them (mirrors setupMajorCleanFixture in
  // tests/promote-gate.test.ts).
  mkdirSync(resolve(PIPELINE_DIR, "state", "briefs"), { recursive: true });
  writeFileSync(
    resolve(PIPELINE_DIR, "state", "briefs", `${bookId}.manual-brief.json`),
    JSON.stringify({ schemaVersion: "manual-book-brief-v1", bookId, title: "WP-101 Fresh Emit Fixture", author: "Fixture Author" }, null, 2) + "\n",
    "utf8",
  );
  mkdirSync(resolve(PIPELINE_DIR, "state", "plans"), { recursive: true });
  writeFileSync(
    resolve(PIPELINE_DIR, "state", "plans", `${chapter.chapterId}.manual-plan.json`),
    JSON.stringify({
      schemaVersion: "manual-chapter-plan-v1",
      bookId,
      chapterId: chapter.chapterId,
      chapterNumber: chapter.number,
      title: chapter.title,
      coreMove: "Use the fixture signal.",
    }, null, 2) + "\n",
    "utf8",
  );

  mkdirSync(resolve(PIPELINE_DIR, "state", "qc"), { recursive: true });
  writeAttestation({
    schemaVersion: "qc-attest-v1",
    bookId,
    chapterNumber: chapter.number,
    chapterId: chapter.chapterId,
    verdict: "PUBLISHABLE",
    contentHash: chapterContentHash(chapter),
    hashVersion: "v2",
    reviewer: "human:wp101-fresh-emit-fixture",
    reviewedAt: "2026-07-16T00:00:00.000Z",
    roundId: "r-wp101-fresh-emit",
    roundRole: "confirm",
  });

  const result = withPromotionEnvCleared(() =>
    promoteBook(
      {
        bookId,
        title: "WP-101 Fresh Emit Fixture",
        author: "Fixture Author",
        chapters: [{ chapterId: chapter.chapterId, chapterNumber: chapter.number, chapterTitle: chapter.title }],
        categories: ["Business"],
        tags: ["fixture"],
      },
      { now: () => new Date("2026-07-16T00:00:00.000Z") },
    ),
  );

  if (!result.promoted || !result.packagePath) {
    throw new Error(`freshEmitFixture: promoteBook did not promote the fixture book: ${result.reason}`);
  }

  const packagePath = result.packagePath;
  const bytes = readFileSync(packagePath, "utf8");
  const parsed = JSON.parse(bytes) as Record<string, unknown>;
  const sha256 = createHash("sha256").update(bytes).digest("hex");

  return { bookId, packagePath, bytes, parsed, sha256 };
}
