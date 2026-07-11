/**
 * authorRun — the v24 AUTHOR architecture's WRITE phase (component B4).
 *
 * Panel-proven premise: ONE author owning a whole chapter beats four blind
 * section writers. This module compiles the same upstream artifacts the
 * compiler path proved out (source packets → book design → chapter briefs),
 * then spawns ONE whole-chapter writer per missing chapter with a ~18k-char
 * card (vs the compiler's ~160k across four section cards): the rendered
 * chapter BRIEF (reservations + intent), the book's VOICE CARD, the slim
 * writer packet PROJECTION, a compact ChapterV21 schema hint, and a 4-check
 * self-verify. Repair is REGENERATION with review complaints (authorReview.ts
 * threads them back through `authorWriteOneChapter`), never blind patching.
 *
 * THIRD architecture value: the compiler and legacy paths are byte-untouched —
 * nothing here is imported by them, and autopilot only routes here when
 * architecture === "author".
 *
 * All side effects go through an injectable AuthorIo (real defaults below) so
 * tests drive the whole phase against fixtures/tmp state, never real state.
 */

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import type { AutopilotDeps, AutopilotOutcome, HaltCategory, VerbResult } from "./autopilot.js";
import type { ChapterV21 } from "../types.js";
import type { ChapterBriefV1, SourcePacketV1 } from "../artifacts/artifactTypes.js";
import { chapterBriefMdPath, chapterBriefPath, leadOverridePath, readJsonFile, sourcePacketPath, sourceUsePlanPath } from "../artifacts/artifactStore.js";
import { WRITER_PACKET_PROJECTION_SCHEMA_VERSION, writerPacketProjection } from "../compiler/sourcePacketProjection.js";
import { sourcePacketHash } from "../compiler/sourcePacket.js";
import {
  embeddedPlanMutationFindings,
  renderSourceUsePlanLines,
  sourceUsePlanStale,
} from "../compiler/sourceUsePlanCompiler.js";
import { sourceUsePlanHash, validateSourceUsePlan, type SourceUsePlanV1 } from "../contracts/sourceUsePlan.js";
import { UNTRUSTED_ARTIFACT_RENDERER_VERSION, untrustedArtifact } from "../exec/untrustedArtifact.js";
import {
  DEFAULT_LENGTH_BUDGET_CHARS,
  LENGTH_BUDGET_TOLERANCE,
  ROUND_TIMER_MINUTES_LIST,
  applyLeadThreadOverride,
  briefVarietyInstructionLines,
  degradedLeadCandidates,
  renderBriefMd,
  type LeadThreadOverrideV1,
} from "../compiler/chapterBrief.js";
import { contentDeviceDealLines, dealContentDeviceBans } from "../compiler/contentDeviceDeal.js";
import { manualBriefRotationLines } from "../compiler/briefRotation.js";
import { voiceCard, voiceRegisterLine } from "../lib/voiceCard.js";
import { chapterFileName, normSlug, CHAPTERS_DIR } from "../lib/chapterPaths.js";
import { buildBudgetRepairComplaints, checkReaderBudgets, type BudgetFinding } from "../critics/readerBudgets.js";
import { anyAliasPresent, leadAliasSet, suppressGenericSuffixAliases } from "../critics/leadAliases.js";
import { loadNameBank } from "../librarian/namePlan.js";
import { loadBookChapters } from "../qc/manualKeyJudge.js";
import { chapterContentHash } from "../critics/qcAttestation.js";
import { registerAdvisoryRetryBlock } from "../critics/registerAdvisories.js";
import { loadAuthorProvenance, recordAuthorProvenance } from "../qc/sessionProvenance.js";
import {
  RegenLedgerError,
  budgetRepairConsumedFor,
  computeRegenLineage,
  loadAuthorRegenLedger,
  migrateLegacyRegenCounts,
  recordBudgetRepairConsumed,
} from "./authorRegenLedger.js";
import { appendReopenNote, holdsDurablePass } from "./authorReviewLedger.js";
import {
  ATTEMPTS_ROOT,
  commitChapterCandidate,
  finalizeAttempt,
  gateCandidate,
  importCandidate,
  mintChapterAttempt,
  rubricMetricsWithCandidate,
  unexpectedAttemptWrites,
} from "./chapterTransaction.js";
import { recordAttemptObject, recordSpawnEvidence } from "../evidence/attemptRecorder.js";
import { recordChapterDiversity } from "../telemetry/diversityLedger.js";
import { sha256Hex } from "../contracts/contractUtil.js";
import { writeFileAtomic } from "../lib/atomicWrite.js";
import { BASELINE_MODEL } from "./modelPolicy.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PIPELINE_DIR = resolve(__dirname, "../..");

/** Hard ceiling on the author card (the compiler pays ~160k chars/chapter across
 *  four section cards; the whole point of the author card is the ~18k diet). */
export const AUTHOR_CARD_MAX_CHARS = 25000;

/** Per authorWriteOneChapter call: the initial spawn + ONE retry with the gate
 *  blockers appended. (The review phase's regen budget is separate — see
 *  authorReview.ts AUTHOR_REGEN_CAP.) */
export const AUTHOR_WRITE_GATE_RETRIES = 1;

/** F-1: at most ONE extra attempt per call with a DEGRADED lead, taken only when
 *  EVERY configured attempt failed the write contract on lead-thread findings
 *  ALONE (a gate/rubric/spawn failure never triggers degradation — the writer, not
 *  the lead, is the problem there). Max writer spawns per call is therefore
 *  1 + AUTHOR_WRITE_GATE_RETRIES + AUTHOR_WRITE_LEAD_DEGRADE_RETRIES. */
export const AUTHOR_WRITE_LEAD_DEGRADE_RETRIES = 1;

// ── Injectable IO ─────────────────────────────────────────────────────────────

/** Every fs/module side effect the write phase performs, injectable so tests
 *  run against fixtures/tmp roots — never the repo's real state/. */
export type AuthorIo = {
  /** Is state/chapters/<book>-chNN.v21-native.chapter.json on disk? */
  chapterExists: (bookId: string, chapterNumber: number) => boolean;
  /** The rendered chNN.brief.md (verbatim writer page), or null when absent. */
  readBriefMd: (bookId: string, chapterNumber: number) => string | null;
  /** The machine brief (for lengthBudget), or null when absent. */
  readBrief: (bookId: string, chapterNumber: number) => ChapterBriefV1 | null;
  /** The compiled source packet for a chapter, or null when absent. */
  readPacket: (bookId: string, chapterNumber: number) => SourcePacketV1 | null;
  /** IMP-03: the compiler-owned source-use plan for a chapter, or null when the
   *  book predates plans (legacy path — absence grants nothing and blocks
   *  nothing). A PRESENT plan is validated + freshness-checked fail-closed
   *  before any writer/repair spawn. */
  readSourcePlan: (bookId: string, chapterNumber: number) => SourceUsePlanV1 | null;
  /** All on-disk chapters of the book (canonical state). */
  loadChapters: (bookId: string) => ChapterV21[];
  /** True iff config/name-bank.json loads and is non-empty. readerBudgets
   *  silently no-ops CHB3 on a missing/corrupt bank (console.warn only) — the
   *  author arch treats that as a HALT-worthy infra condition, so this is
   *  checked EXPLICITLY (and the warn is captured as a belt-and-braces). */
  nameBankOk: () => boolean;
  /** The book's paste-safe voice card (null when the book has no voice signal). */
  voiceCard: (bookId: string) => string | null;
  /** The recorded author session of a chapter (provenance sidecar), if any. */
  authorSessionOf: (chapterId: string) => string | undefined;
  /** Stamp author provenance bound to the authored content hash. */
  recordProvenance: (chapterId: string, sessionId: string, contentHash?: string) => void;
  /** Raw chapter-file bytes (null when absent) — the write-failure restore hooks
   *  (fresh-gold live finding, 2026-07-08): a writer session lands its draft on
   *  disk BEFORE the gate/rubric/contract self-checks, so a fully-failed
   *  authorWriteOneChapter used to leave an UNREVIEWED failing draft in place
   *  (or orphan one where no chapter existed) that the next entry would blindly
   *  review as legitimate. */
  readChapterFile: (bookId: string, chapterNumber: number) => string | null;
  writeChapterFile: (bookId: string, chapterNumber: number, bytes: string) => void;
  removeChapterFile: (bookId: string, chapterNumber: number) => void;
  /** F-1 lead-degradation sidecar (chNN.lead-override.json beside the compiled
   *  briefs) — read on every write call to resolve the EFFECTIVE brief; written
   *  only when a degraded attempt lands a passing chapter. */
  readLeadOverride: (bookId: string, chapterNumber: number) => LeadThreadOverrideV1 | null;
  writeLeadOverride: (bookId: string, chapterNumber: number, override: LeadThreadOverrideV1) => void;
  /** IMP-01 candidate validation seam. The conductor gates CANDIDATE bytes (the
   *  attempt-workspace draft) in process — never by exposing them at the
   *  canonical path. Tests that previously stubbed the `gate-chapter` /
   *  `rubric-metrics` runVerb calls override these two instead. */
  gateCandidate: (candidate: ChapterV21, canonicalAbsPath: string, attemptKey: string) => Promise<{ code: number; stdout: string; stderr: string }>;
  rubricWithCandidate: (bookId: string, chapterNumber: number, candidate: ChapterV21) => Promise<{ code: number; stdout: string; stderr: string }>;
  /** Root for per-attempt workspaces/evidence (.attempts by default; tests use
   *  tmp roots so unit runs never write the real pipeline tree). */
  attemptsRoot: () => string;
};

/** Disk implementations of the F-1 sidecar, exported so the repair lane
 *  (authorRepair) resolves the same EFFECTIVE brief its contract re-check needs. */
export function readLeadOverrideFromDisk(bookId: string, chapterNumber: number): LeadThreadOverrideV1 | null {
  try {
    const p = leadOverridePath(normSlug(bookId), chapterNumber);
    if (!existsSync(p)) return null;
    const rec = readJsonFile<LeadThreadOverrideV1>(p);
    return rec?.schemaVersion === "lead-thread-override-v1" ? rec : null;
  } catch { return null; }
}

export function writeLeadOverrideToDisk(bookId: string, chapterNumber: number, override: LeadThreadOverrideV1): void {
  const p = leadOverridePath(normSlug(bookId), chapterNumber);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(override, null, 2) + "\n");
}

export function resolveAuthorIo(over?: Partial<AuthorIo>): AuthorIo {
  // Hoisted: the candidate-rubric default substitutes the candidate into the
  // SAME chapter set the rest of the io reads (fixture/slot roots included).
  const loadChaptersResolved = over?.loadChapters ?? ((bookId: string) => loadBookChapters(bookId));
  return {
    chapterExists: over?.chapterExists
      ?? ((bookId, n) => existsSync(resolve(CHAPTERS_DIR, chapterFileName(authorChapterId(bookId, n))))),
    readChapterFile: over?.readChapterFile ?? ((bookId, n) => {
      const p = resolve(CHAPTERS_DIR, chapterFileName(authorChapterId(bookId, n)));
      try { return existsSync(p) ? readFileSync(p, "utf8") : null; } catch { return null; }
    }),
    // IMP-01: the canonical write default is ATOMIC (tmp + rename). A plain
    // writeFileSync here was the torn-read wedge (F-001): a concurrent status/
    // key-judge read could parse a half-written file and brick the conductor.
    writeChapterFile: over?.writeChapterFile
      ?? ((bookId, n, bytes) => writeFileAtomic(resolve(CHAPTERS_DIR, chapterFileName(authorChapterId(bookId, n))), bytes)),
    removeChapterFile: over?.removeChapterFile
      ?? ((bookId, n) => rmSync(resolve(CHAPTERS_DIR, chapterFileName(authorChapterId(bookId, n))), { force: true })),
    readBriefMd: over?.readBriefMd ?? ((bookId, n) => {
      try {
        const p = chapterBriefMdPath(normSlug(bookId), n);
        return existsSync(p) ? readFileSync(p, "utf8") : null;
      } catch { return null; }
    }),
    readBrief: over?.readBrief ?? ((bookId, n) => {
      try {
        const p = chapterBriefPath(normSlug(bookId), n);
        return existsSync(p) ? readJsonFile<ChapterBriefV1>(p) : null;
      } catch { return null; }
    }),
    readPacket: over?.readPacket ?? ((bookId, n) => {
      try {
        const p = sourcePacketPath(normSlug(bookId), n);
        return existsSync(p) ? readJsonFile<SourcePacketV1>(p) : null;
      } catch { return null; }
    }),
    // IMP-03: side-effect-free read (sourceUsePlanPath never mkdirs — fixture
    // book ids in tests must not mint state/books/<book>/runs/ dirs). ABSENT →
    // null (legacy path). PRESENT but unreadable/corrupt → THROW: swallowing it
    // into null would silently promote a broken plan to "no plan" and author
    // fail-open; callers convert the throw into a fail-closed refusal.
    readSourcePlan: over?.readSourcePlan ?? ((bookId, n) => {
      const p = sourceUsePlanPath(normSlug(bookId), n);
      if (!existsSync(p)) return null;
      return readJsonFile<SourceUsePlanV1>(p);
    }),
    loadChapters: loadChaptersResolved,
    nameBankOk: over?.nameBankOk ?? (() => {
      try { return loadNameBank().length > 0; } catch { return false; }
    }),
    voiceCard: over?.voiceCard ?? ((bookId) => voiceCard(bookId)),
    authorSessionOf: over?.authorSessionOf ?? ((chapterId) => loadAuthorProvenance(chapterId)?.authorSessionId ?? undefined),
    recordProvenance: over?.recordProvenance
      ?? ((chapterId, sessionId, contentHash) => { recordAuthorProvenance(chapterId, sessionId, contentHash); }),
    readLeadOverride: over?.readLeadOverride ?? readLeadOverrideFromDisk,
    writeLeadOverride: over?.writeLeadOverride ?? writeLeadOverrideToDisk,
    gateCandidate: over?.gateCandidate ?? gateCandidate,
    rubricWithCandidate: over?.rubricWithCandidate
      ?? ((bookId, n, candidate) => rubricMetricsWithCandidate(bookId, n, candidate, loadChaptersResolved)),
    attemptsRoot: over?.attemptsRoot ?? (() => ATTEMPTS_ROOT),
  };
}

// ── Small helpers ─────────────────────────────────────────────────────────────

export function authorChapterId(bookId: string, chapterNumber: number): string {
  return `${normSlug(bookId)}-ch${String(chapterNumber).padStart(2, "0")}`;
}

export function authorChapterRelPath(bookId: string, chapterNumber: number): string {
  return `state/chapters/${chapterFileName(authorChapterId(bookId, chapterNumber))}`;
}

function halt(bookId: string, category: HaltCategory, reason: string): AutopilotOutcome {
  return { status: "halt", bookId, phase: "write", category, reason };
}

function reportOf(r: VerbResult): string {
  return (r.stdout || r.stderr || "").trim();
}

/** Local bounded pool (compilerRun keeps its own too — importing autopilot's
 *  would create a runtime cycle: autopilot imports doAuthorWrite from here). */
async function mapPool<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length || 1)) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

// ── The card ──────────────────────────────────────────────────────────────────

/** HOUSE STYLE rules — verbatim per the B4 spec; do not reword. */
/**
 * IMP-05 (F-008/F-009/F-016/F-019/F-021) — the writer card is dieted to global
 * INVARIANTS + one explicit precedence order + compact chapter-local craft
 * targets. Every protection removed from the card text is enforced by a
 * deterministic gate, an advisory critic (C31-C35), the source-use plan
 * (IMP-03), the brief/deal compiler, or the blinded reviewers — the full
 * inventory + moved-enforcement map is docs/v25/IMP-05-REQUIREMENT-LEDGER.md.
 * No gate, threshold, blocker, retry cap, critic severity, or public schema
 * changed. The accumulated incident-lesson prose (CF-A..CF-J, STIER, W1-W4)
 * moved to that ledger; blocks are version-stamped (CARD_BLOCK_VERSIONS) so
 * evidence can identify card drift.
 */

/** Precedence (IMP-05 instruction 3): the conflict-resolution contract, rendered
 *  first so a lower-priority style/deal line can never override source or schema. */
export const AUTHOR_PRECEDENCE =
  "PRECEDENCE — when any two instructions conflict, the earlier wins:\n" +
  "1. Safety, source obedience, identity and product limits.\n" +
  "2. Schema and product completeness — a valid ChapterV21 with every required field.\n" +
  "3. Thesis, evidence, and quiz correctness.\n" +
  "4. This chapter's objective (the brief and the source-use plan).\n" +
  "5. Active book-level constraints (the VARIETY and CONTENT DEVICES deals).\n" +
  "6. Optional style and creative choices — these yield to everything above.";

/** The global INVARIANTS (IMP-05 instruction 2) — the minimal set that is true of
 *  every chapter, stated once. Export name kept for import stability. */
export const AUTHOR_HOUSE_RULES =
  "GLOBAL INVARIANTS (these outrank every style choice):\n" +
  "- COMPLETE: emit a valid ChapterV21 with every required field. If space is tight, finish every required field first and drop optional ornament before anything required — never make a product field optional to save length.\n" +
  "- FACTUAL: obey the SOURCE-USE PLAN; every claim, number, name, and case detail traces to the SOURCE PACKET — invent connective narration, never facts. Hedge any below-robust claim; never state it as settled.\n" +
  "- QUIZ: every key is derivable from your prose alone and tests a MOVE the reader makes, not a source; each distractor is the key warped by one of the brief's dealt failure modes; follow the brief's answer-key pattern exactly.\n" +
  "- IDENTITY: the reader never meets the machinery — no scaffold vocabulary (slot, shape, or beat labels, anchor ids, \"Fact 2\" numbering), no internal artifact or beat label as an acting subject, no drafting narration. Write the beat, not its name.\n" +
  "- PLAIN & DENSE: Flesch ease 72-84 on the breakdown; short words, one idea per sentence; every paragraph adds new information; be honest about where the move fails.";

/**
 * CRAFT TARGETS (was the W1 QUALITY BAR) — IMP-05 diet. The first-draft craft aims
 * whose PROTECTION lives in a deterministic gate ([GATED]) or the blinded reviewers
 * ([SCORED]); the card states each as a compact aim, not the accumulated
 * incident-lesson prose (that history + the moved-enforcement map is
 * docs/v25/IMP-05-REQUIREMENT-LEDGER.md). The mechanical-distractor word list, the
 * tell-length audit protocol, and the VOICE formula were REMOVED from the card
 * (their gates/critics/reviewers still enforce them) — naming banned words on the
 * card is the repeated-"X not Y" pattern the SOL guidance warns against.
 * Version-stamped CARD_BLOCK_VERSIONS.qualityBar.
 */
export const AUTHOR_QUALITY_BAR =
  "CRAFT TARGETS — hit these on the first draft ([GATED] = a deterministic check forces a rewrite if missed; [SCORED] = the blinded reviewers weigh it):\n" +
  "1. QUIZ DISTRACTORS [GATED]. Write the key first, then warp it into each distractor by one of the brief's dealt failure modes — a half-reader would defend a wrong answer aloud, and a reader of your prose settles exactly why it fails. Keep keys mid-length: a deterministic check caps uniquely-longest keys at one of nine and uniquely-shortest at four. For a WHY stem, the key names the one cause your prose shows — never the outcome restated or a remedy. A key tests a move the reader makes, never a source.\n" +
  "2. PRACTICE [GATED floor]. tryThisNow and the 24-hour challenge each name one action with a number or a timebox, concrete enough to start within a minute; the FORM is your dealt practice shape, not a fixed ritual, and never an \"a, b, or c\" menu.\n" +
  "3. EXAMPLES [SCORED]. Each example dramatizes a decision and its completed consequence in the scene's own voice, advances THIS chapter's job through a distinct facet, and carries whoever the CONTENT DEVICES deal assigns — never a default proxy. An arc that never lands is unfinished. Review cards drill the reusable move, not source trivia.\n" +
  "4. HOOK [SCORED]. Make the stake visible in plain words — who loses, pays, or misses what — before the first abstract term. FAIL: \"The team maps functions to shared standards.\" PASS: \"It shipped late because no one owned the date.\"\n" +
  "5. TAKE-HOME [SCORED]. coreSkill opens with a 2-5 word skill name (imperative verb + concrete object, never a virtue noun); at least one memorable line carries this chapter's central image.";

/**
 * WHAT THE REVIEWERS SCORE (was AUTHOR_PREMIUM_BLOCK) — IMP-05 diet. The blinded
 * reviewers own scoring against RUBRIC.md; the card names each axis compactly. The
 * VOICE 4-move mechanical formula was removed (a fixed formula is the anti-pattern
 * the diet targets). History + moved-enforcement: docs/v25/IMP-05-REQUIREMENT-LEDGER.md.
 * Version-stamped CARD_BLOCK_VERSIONS.premium.
 */
export const AUTHOR_PREMIUM_BLOCK =
  "WHAT THE REVIEWERS SCORE — name the axis, hit it in the draft (not the retry):\n" +
  "- INSIGHT: the counterintuition reverses a default the reader actually holds, not a polite restatement of the thesis.\n" +
  "- LIMITS: one honest passage on where the move does NOT apply, what it costs, and when to do the opposite. Overselling is a scored defect.\n" +
  "- DENSITY: every paragraph and every read-tier (fastRead/deepRead/fullRead) adds new information — never restate.\n" +
  "- PLAIN WORDS: unpack every load-bearing term, coined or inherited, in plain words at first use; action fields carry zero coined shorthand.\n" +
  "- READER AGENCY: someone with no title power can run the move today — at least one example applies it to the reader's own choices, not only to people they manage.\n" +
  "- VOICE: this book's voice, not a house voice — vary sentence length and rhythm; break long abstract runs with a person, scene, or object.\n" +
  "- QUIZZES: a chapter-skipper scores ~33%, not 60%; every explanation teaches why the tempting wrong answer fails, not only why the key is right.";

/** Compact ChapterV21 schema hint — field names + types only, one line, the same
 *  style sectionTasks.ts uses for section artifacts. */
export function authorSchemaHint(bookId: string, chapterNumber: number): string {
  const chapterId = authorChapterId(bookId, chapterNumber);
  return `{"schemaVersion":"chapterflow-v21-authored","chapterId":"${chapterId}","number":${chapterNumber},"title":"...","readingTimeMinutes":7,"hook":"...(60-120 chars)","counterintuition":"...(1-2 sentences)","tryThisNow":"...(80-220 chars)","keyTakeaway":"...(140-220 chars)","breakdown":{"fastRead":"...(~400-700 chars)","deepRead":"...(~1200-1800 chars)","fullRead":"...(~2500-3500 chars)"},"examples":[{"exampleId":"ex01","title":"...","tags":["..."],"planSpec":{"domain":"...","audience":"...","stakes":"...","format":"...","requiredBeat":"..."},"scenario":"...(280-520 chars)","whatToDo":"...(120-240 chars)","whyItMatters":"...(120-240 chars)"}],"quiz":{"passingScorePercent":70,"questions":[{"questionId":"q01","prompt":"...","choices":["...","...","..."],"correctIndex":0,"explanation":"...(120-300 chars; why the move works)","bloomsLevel":"apply","depthLevel":"standard"}]},"reviewCards":[{"cardId":"c01","front":"...(30-200 chars)","back":"...(80-400 chars)","difficulty":"medium"}],"implementationPlan":{"title":"...(2-5 word skill name)","coreSkill":"<skill name>. ...(2-4 sentences)","ifThenPlans":[{"context":"...","plan":"If X, then Y."}],"twentyFourHourChallenge":"...","weeklyPractice":"..."},"memorableLines":[{"text":"...(exact sentence from the chapter; >=1 carries the central image)","location":"breakdown.deepRead","why":"..."}]}`;
}

/** SELF-VERIFY (IMP-05 instruction 10): the ordered HIGHEST-RISK checks whose
 *  answer is structured evidence, not a restatement of the whole prompt. Four
 *  checks; the rest of the old seven are owned by their gates/critics (see the
 *  ledger). Kept <= 900 chars — pinned by test. */
export function authorSelfVerify(bookId: string, chapterNumber: number, outputRelPath?: string): string {
  const relPath = outputRelPath ?? authorChapterRelPath(bookId, chapterNumber);
  return `SELF-VERIFY before you exit — the conductor gates ${relPath} the moment you do, and a blocker costs a full rewrite:
1. KEYS — derive every quiz answer from your prose alone, blind; each must hit the stored correctIndex and test a move, not a source. Mismatch: re-key or rewrite.
2. FACTS — every claim, number, name, and case detail traces to the SOURCE PACKET and obeys the SOURCE-USE PLAN. Untraceable: delete or soften.
3. SCAFFOLD — no reader-facing field carries scaffold vocabulary (slot/shape/beat labels, anchor ids, "Fact 2" numbering, page/section citations, " / " label seams) or names the machinery.
4. COMPLETE — every required field present and full: hook, the three read tiers, the dealt example count, nine quiz questions, cards, the implementation plan (coreSkill opens with the skill name), memorable lines.`;
}

/** STIER-2 D7/D9 — deterministic write-time contract checks that need the BRIEF in
 *  scope (relocated here from the readerBudgets plan slot precisely because budgets
 *  never see briefs — grill round-2b #6). Pure; returns retry complaints, [] = clean.
 *
 *  D7 lead thread: the dealt lead (invented cast member or owned-case anchor token)
 *  must appear in fastRead and in ≥2 examples — ch05's Yvonne→Reagan→Eliana rotation
 *  was a 2nd-order variety-pressure effect with no coherence counterweight.
 *  D9 timers: writer-invented practice timers must be round (5/10/15/20/25/30/45/60
 *  minutes; packet-attested numbers exempt), and two practice surfaces that restate
 *  the same action verbatim (shared 6-gram) must agree on the minutes — the halted
 *  run shipped a "19-minute challenge" and a 12-vs-10-minute discrepancy. */
export const ROUND_TIMER_MINUTES = new Set<number>(ROUND_TIMER_MINUTES_LIST);

/** IMP-05 instruction 13: version-stamp each control block so evidence (IMP-10)
 *  can identify card drift independent of the per-chapter data payload. Bump the
 *  matching version whenever a block's text changes. */
export const CARD_BLOCK_VERSIONS = {
  precedence: "precedence-v1",
  invariants: "invariants-v1",     // was AUTHOR_HOUSE_RULES
  qualityBar: "quality-bar-v2",    // v2 = IMP-05 diet
  premium: "premium-v2",           // v2 = IMP-05 diet
  schemaHint: "schema-hint-v1",
  selfVerify: "self-verify-v2",    // v2 = IMP-05 diet (7→4 checks)
  dataEnvelope: UNTRUSTED_ARTIFACT_RENDERER_VERSION,
} as const;

/** The version-stamped CONTROL text of the card (invariant blocks only — excludes
 *  the per-chapter brief/packet/plan data payload and the relPath-specific
 *  self-verify tail), plus its hash. Lets IMP-10 evidence detect a card-composition
 *  change without diffing the whole rendered card. */
export function authorCardComposition(): { versions: typeof CARD_BLOCK_VERSIONS; controlSha256: string } {
  const control = [
    AUTHOR_PRECEDENCE,
    AUTHOR_HOUSE_RULES,
    AUTHOR_QUALITY_BAR,
    AUTHOR_PREMIUM_BLOCK,
    JSON.stringify(CARD_BLOCK_VERSIONS),
  ].join("\n\n");
  return { versions: CARD_BLOCK_VERSIONS, controlSha256: sha256Hex(control) };
}

/** IMP-05 instruction 12: prompt-size telemetry. `chars` is the normalized card
 *  length; `instructions` counts the numbered/bulleted directive lines across the
 *  control blocks (the rule-count-dilution signal). Pure. */
export function authorCardMetrics(card: string): { chars: number; instructions: number; controlChars: number } {
  const instructions = (card.match(/^\s*(?:\d+\.|-)\s+\S/gm) ?? []).length;
  const controlChars = AUTHOR_PRECEDENCE.length + AUTHOR_HOUSE_RULES.length + AUTHOR_QUALITY_BAR.length + AUTHOR_PREMIUM_BLOCK.length;
  return { chars: card.length, instructions, controlChars };
}

/** STIER-2 M-lane (owner-directed): the author WRITE/REGEN sessions are pinned to an
 *  explicit model + reasoning effort instead of inheriting whatever the operator's
 *  ~/.codex/config.toml says that day. xhigh = the top codex tier — one level above
 *  the reviewers' pinned "high", thinking at maximum. HONESTY (plan §A RC5): the
 *  halted run's ambient default was very likely already xhigh, so NO content gain is
 *  booked to this pin — it buys provenance, reproducibility, and timeout headroom.
 *  Reviewers/readers/QC/research stay untouched (instrument stability). */
export const AUTHOR_WRITER_MODEL = process.env.CHAPTERFLOW_AUTHOR_MODEL ?? BASELINE_MODEL;
export const AUTHOR_WRITER_EFFORT = (process.env.CHAPTERFLOW_AUTHOR_EFFORT ?? "xhigh") as
  "minimal" | "low" | "medium" | "high" | "xhigh";
/** xhigh whole-chapter writes need headroom over the 30-min codex default; the same-host
 *  run lock is PID-liveness-based, so a long session cannot cause a lock steal. */
export const AUTHOR_WRITE_TIMEOUT_MS = 3_600_000;

export function authorWriteContractFindings(
  chapter: ChapterV21,
  brief: ChapterBriefV1 | null | undefined,
  packet: SourcePacketV1,
): string[] {
  const complaints: string[] = [];

  // B15 — the dealt example count is EXACT (v3 briefs only). The A16 gate floor
  // honors the dealt count; this contract closes the other side — 5/8 round-1
  // writers padded a 4/5-deal up to 6 examples (the gate loop coached them to),
  // and the padded slots carried NO dealt arc: the house pattern leaking back in
  // through exactly the lever built to stop it.
  if (typeof brief?.exampleCount === "number" && brief.rotationSchemaVersion) {
    const wrote = chapter.examples?.length ?? 0;
    if (wrote !== brief.exampleCount) {
      complaints.push(
        `example count: your brief deals EXACTLY ${brief.exampleCount} examples — you wrote ${wrote}. ` +
        (wrote > brief.exampleCount
          ? `Cut ${wrote - brief.exampleCount}: fold any teaching they carry into the dealt slots (extra examples have no dealt arc and read as padding — the density defect).`
          : `Add ${brief.exampleCount - wrote}, following the dealt arc rows for those slots.`),
      );
    }
  }

  // D7 — lead-thread presence (v3 briefs only; legacy briefs skip by construction).
  //
  // IMP-09 (F-016): the old check reduced the case label to its FIRST
  // capitalized ASCII token ("Vincent van Gogh" → "Vincent") and rejected
  // chapters that carried the thread under the SURNAME ("Van Gogh",
  // "Malamud" — the R2 false negatives that burned regens and halted entry 1).
  // The invariant is unchanged — the dealt lead must carry the fastRead and
  // ≥2 examples — but presence is now judged against the COMPILER-DERIVED
  // alias set (brief.leadThread.aliases when dealt; else derived at check time
  // from the SAME deterministic utility): full label, family name with
  // particles, given name, diacritic-folded variants. A chapter using NO form
  // of the dealt name still fails — matching normalizes presentation
  // (case/diacritics/possessives/hyphens), never word choice, and no alias is
  // ever inferred beyond the label (leadAliases.ts).
  const lead = brief?.leadThread;
  if (lead?.name) {
    // Suffix demotion (G3) runs at CHECK time too: dealt briefs minted before
    // the hardening carry raw alias arrays that still list bare suffix tokens.
    const aliases = suppressGenericSuffixAliases(
      lead.name,
      (lead.aliases && lead.aliases.length > 0 ? lead.aliases : leadAliasSet(lead.name))
        .filter((a) => typeof a === "string" && a.trim().length >= 3),
    );
    if (aliases.length > 0) {
      const hasLead = (text: string | undefined) => anyAliasPresent(text, aliases);
      if (!hasLead(chapter.breakdown?.fastRead)) {
        complaints.push(`lead thread: the dealt lead ${lead.kind === "invented" ? lead.name : `case "${lead.name}"`} never appears in the fastRead — the fastRead and at least 2 examples must carry this chapter's thread (dealt LEAD THREAD line). Any natural form of the name counts (full name, surname).`);
      }
      const exampleHits = (chapter.examples ?? []).filter((ex) =>
        hasLead(typeof ex.scenario === "string" ? ex.scenario : undefined) || hasLead(ex.title) || hasLead(ex.whatToDo) || hasLead(ex.whyItMatters),
      ).length;
      if (exampleHits < 2) {
        complaints.push(`lead thread: the dealt lead (${lead.name}) appears in ${exampleHits} example(s) — at least 2 examples must live on this thread; keep other cast in supporting roles.`);
      }
    }
  }

  // D9 — practice-timer sanity, scoped to writer-invented minute timers.
  const packetNumbers = new Set((packet.allowedNumbers ?? []).map((v) => String(v)));
  const surfaces: Array<[string, string]> = [
    ["tryThisNow", chapter.tryThisNow ?? ""],
    ["twentyFourHourChallenge", chapter.implementationPlan?.twentyFourHourChallenge ?? ""],
    ["weeklyPractice", chapter.implementationPlan?.weeklyPractice ?? ""],
    ["ifThenPlans", (chapter.implementationPlan?.ifThenPlans ?? []).map((p) => `${p.context} ${p.plan}`).join(" ")],
  ];
  const minutesOf = (text: string): number[] => {
    const out: number[] = [];
    for (const m of text.matchAll(/\b(\d{1,3})[- ]?minutes?\b/gi)) out.push(Number(m[1]));
    return out;
  };
  const surfaceMinutes = new Map<string, number[]>();
  for (const [name, text] of surfaces) {
    const mins = minutesOf(text);
    surfaceMinutes.set(name, mins);
    for (const v of mins) {
      if (!ROUND_TIMER_MINUTES.has(v) && !packetNumbers.has(String(v))) {
        complaints.push(`practice timers: "${v} minutes" in ${name} is not a round timer (5/10/15/20/25/30/45/60) and is not a packet-attested number — invented odd timers read as fake precision (the "19-minute challenge" complaint).`);
      }
    }
  }
  // Cross-surface consistency: shared verbatim 6-gram + different minute sets = the
  // same action restated with different numbers (the 12-vs-10 discrepancy).
  const grams = (text: string): Set<string> => {
    const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
    const set = new Set<string>();
    for (let i = 0; i + 6 <= words.length; i++) set.add(words.slice(i, i + 6).join(" "));
    return set;
  };
  for (let a = 0; a < surfaces.length; a++) {
    for (let b = a + 1; b < surfaces.length; b++) {
      const [nameA, textA] = surfaces[a];
      const [nameB, textB] = surfaces[b];
      const minsA = surfaceMinutes.get(nameA) ?? [];
      const minsB = surfaceMinutes.get(nameB) ?? [];
      if (minsA.length === 0 || minsB.length === 0) continue;
      if (JSON.stringify([...new Set(minsA)].sort()) === JSON.stringify([...new Set(minsB)].sort())) continue;
      const gA = grams(textA);
      const shared = [...grams(textB)].some((g) => gA.has(g));
      if (shared) {
        complaints.push(`practice timers: ${nameA} (${minsA.join("/")} min) and ${nameB} (${minsB.join("/")} min) restate the same action with DIFFERENT minutes — make the numbers agree wherever the action repeats.`);
      }
    }
  }

  // W1 (repair-lane plan, live-caught twice): label text leaking into example
  // fields — ch08 shipped whyItMatters BEGINNING "Why it matters:" (own label)
  // and ch07 shipped whatToDo beginning "Why it works:" (CROSS-label), which
  // alone flipped the book-acceptance gate 0P/3F. Any label-family prefix on
  // either field is scaffold in reader-facing prose; the app renders the label.
  const LABEL_FAMILY = /^\s*(why it matters|what to do(?: instead)?|why it works|try this)\s*[:\-—]/i;
  (chapter.examples ?? []).forEach((ex, i) => {
    for (const field of ["whyItMatters", "whatToDo"] as const) {
      const v = (ex as unknown as Record<string, unknown>)[field];
      if (typeof v === "string" && LABEL_FAMILY.test(v)) {
        complaints.push(`duplicated label: examples[${i + 1}].${field} begins with a label ("${v.slice(0, 50)}...") — the app renders field labels; strip it from the text.`);
      }
    }
  });
  return complaints;
}

export type AuthorCardArgs = {
  bookId: string;
  chapterNumber: number;
  /** Total chapters in the book — gates the book-scale content-device deal (>=4) and
   *  is authoritative even before all chapters exist on disk. Omitted by single-chapter
   *  tools → no content-device deal rendered (exactly as before this field existed). */
  totalChapters?: number;
  /** The rendered chNN.brief.md, embedded verbatim. */
  briefMd: string;
  packet: SourcePacketV1;
  /** The book's voice card (null → the register rules alone carry house style). */
  voice: string | null;
  /** Review complaints from a failed prior attempt (regeneration only). */
  complaints?: string[];
  /** The machine brief (v24 W4) — its dealt openerType/challengeFrame/practiceShape render as
   *  EXPLICIT writer instructions. null when the brief md is present but the json is not
   *  readable (the md already carries the VARIETY section, so the card degrades gracefully). */
  brief?: ChapterBriefV1 | null;
  /** IMP-03: the compiler-owned source-use plan. Renders the binding license
   *  block (origin/form/claim-strength/detail permissions) + plan hash. Omitted/
   *  null → legacy books render exactly the pre-plan card (no block). */
  plan?: SourceUsePlanV1 | null;
  /** Model-bakeoff isolation: write the chapter to this pipeline-relative path instead of
   *  the canonical state/chapters/ path. ORCHESTRATION DATA ONLY — the card's substantive
   *  content is byte-identical across candidates; only this path (and the session id, which
   *  never enters the card) may differ. Omitted → the canonical path, exactly as before. */
  outputRelPath?: string;
};

/** Build the whole-chapter author card (target <= 25k chars; sections in the
 *  B4-specified order). Pure — all inputs are passed in. */
export function buildAuthorCard(args: AuthorCardArgs): string {
  const { bookId, chapterNumber, briefMd, packet, voice } = args;
  const nn = String(chapterNumber).padStart(2, "0");
  const relPath = args.outputRelPath ?? authorChapterRelPath(bookId, chapterNumber);
  const sections: string[] = [];

  sections.push(
    "ROLE",
    `You are the AUTHOR of chapter ${nn} of ${bookId}. You own the whole chapter: hook, breakdown ` +
    "(fastRead ⊂ deepRead ⊂ fullRead), 4-6 examples, a 9-question quiz, review cards, implementation plan " +
    "(2-3 if-then plans + 24-hour challenge + weekly practice), memorable lines.",
  );

  // IMP-05 instruction 3: the precedence contract rides first, so no lower-priority
  // style/deal line can override a source or schema invariant.
  sections.push("", AUTHOR_PRECEDENCE);

  // B0 (STIER-2, grill 2b #1): the card used to carry every dealt VARIETY line TWICE —
  // once inside the embedded brief md and once in the explicit block below — doubling
  // the card cost of every lever. When the machine brief is present, strip the md's
  // VARIETY section; the explicit block is the single render. (Without the machine
  // brief the md keeps its section — the card degrades gracefully as before.)
  let briefForCard = briefMd.trim();
  if (args.brief) {
    const mdLines = briefForCard.split("\n");
    const start = mdLines.findIndex((l) => l.startsWith("## VARIETY"));
    if (start >= 0) {
      let end = mdLines.length;
      for (let i = start + 1; i < mdLines.length; i++) {
        if (mdLines[i].startsWith("## ")) { end = i; break; }
      }
      mdLines.splice(start, end - start);
      briefForCard = mdLines.join("\n");
    }
  }
  sections.push("", "THE BRIEF", briefForCard);

  // v24 W4: the dealt variety reservations, rendered as EXPLICIT, non-negotiable writer
  // instructions from the machine brief (the single render — see B0 above).
  if (args.brief) {
    sections.push(
      "",
      "VARIETY (dealt for this chapter — non-negotiable; do NOT fall back to the house pattern)",
      ...briefVarietyInstructionLines(args.brief),
    );
  }

  // v24 (2026-07-06): the CONTENT-DEVICE deal — rotating per-chapter bans on the body
  // machinery (return-proof, proxy-cast, second-setting, hard-detail boundary, …) so no
  // device saturates the book. ALWAYS rendered (independent of the machine brief) — this
  // is the per-chapter variety manual-brief books otherwise never receive, and the fix
  // for the book-acceptance "one template, different nouns" churn. args.totalChapters
  // omitted (single-chapter tools) → no deal, exactly as before.
  if (args.totalChapters && args.totalChapters >= 4) {
    const dealLines = contentDeviceDealLines(chapterNumber, args.totalChapters);
    if (dealLines.length > 0) sections.push("", ...dealLines);

    // v24 (2026-07-07, F-07/F-08): manual-brief books (~113/119) never compile a
    // machine brief, so the whole VARIETY block above never renders for them. Deal
    // the two low-dependency rotational levers — architecture family + practice
    // shape — always-on here, exactly as the content-device deal reaches them. Skip
    // when a machine brief IS present: those books already carry the richer compiled
    // VARIETY block (double-dealing would fight it).
    if (!args.brief) {
      const shapeLines = manualBriefRotationLines(bookId, chapterNumber, args.totalChapters);
      if (shapeLines.length > 0) sections.push("", ...shapeLines);
    }
  }

  const styleLines = ["", "HOUSE STYLE"];
  if (voice) {
    styleLines.push(voice.trim());
    const register = voiceRegisterLine(voice);
    if (register) styleLines.push(`Register: ${register}`);
  }
  styleLines.push(AUTHOR_HOUSE_RULES);
  // W1: the QUALITY BAR travels in the ALWAYS-SENT card so first drafts clear the
  // W2 preflight without a retry (the retry card carried these before, which is
  // why every first draft paid a rewrite).
  styleLines.push("", AUTHOR_QUALITY_BAR);
  // S-tier P5: the rubric's premium demands, in the same always-sent position.
  styleLines.push("", AUTHOR_PREMIUM_BLOCK);
  sections.push(...styleLines);

  // IMP-03: research-derived material is DATA and rides inside the typed
  // untrusted-artifact envelope — instruction-like text inside the packet
  // (or a reviewer complaint) is quoted evidence, never a new instruction
  // channel. The conductor's own instructions stay OUTSIDE the blocks.
  sections.push(
    "",
    "SOURCE PACKET (writer projection)",
    "This is the ONLY allowed factual material. Every claim, number, name, and case detail must trace to it. Invent connective narration, not facts.",
    "Facts marked \"sharedSpine\" are the book's shared framework — EVERY chapter carries them. Reference them briefly through this chapter's own angle; never re-derive them at full length (nine chapters each re-teaching the spine is how a book becomes one stamped template). Your chapter's OWN core move is never spine-marked: teach it in full — the fast read alone must still leave the core idea.",
    "Facts carrying \"replicationStatus\" below robust are contested evidence: hedge them (\"evidence is mixed…\"), never state them as settled law. Case \"doNotRestamp\" specifics are protected: never move them onto other people, places, or dates.",
    untrustedArtifact(
      "source-packet-projection",
      `${bookId}/ch${nn}`,
      WRITER_PACKET_PROJECTION_SCHEMA_VERSION,
      JSON.stringify(writerPacketProjection(packet), null, 1),
      "json",
    ),
  );

  // IMP-03: the compiler-owned license table — conductor-rendered instruction
  // text (trusted), bound to this attempt by the plan hash it carries.
  if (args.plan) {
    sections.push("", ...renderSourceUsePlanLines(args.plan));
  }

  if (args.complaints && args.complaints.length > 0) {
    sections.push(
      "",
      "PRIOR-ATTEMPT COMPLAINTS",
      "Your previous attempt failed independent review. Fix every defect described in the data block below — the same independent review will re-read your new draft:",
      untrustedArtifact(
        "reviewer-finding",
        `${bookId}/ch${nn} prior-attempt complaints`,
        "complaint-lines-v1",
        args.complaints.map((c) => `- ${c}`).join("\n"),
      ),
    );
  }

  sections.push(
    "",
    "OUTPUT",
    `Write EXACTLY one file: ${relPath}, a valid ChapterV21.`,
    "Schema hint (field names + types only):",
    authorSchemaHint(bookId, chapterNumber),
  );

  sections.push("", authorSelfVerify(bookId, chapterNumber, args.outputRelPath));

  return sections.join("\n");
}

// ── One whole-chapter writer ──────────────────────────────────────────────────

export type AuthorWriteOneResult =
  | { ok: true; sessionId: string }
  | { ok: false; reason: string };

export type AuthorWriteOneOpts = {
  complaints?: string[];
  io?: Partial<AuthorIo>;
  /** Override the book's total-chapter count (gates the content-device deal). When
   *  omitted, resolved authoritatively from deps.expectedChapterNumbers. */
  totalChapters?: number;
  /** Model-bakeoff isolation: write to this pipeline-relative path instead of the
   *  canonical state/chapters/ path (threaded into the card, the gate verb, and the
   *  self-verify command). Callers overriding this MUST also override the io chapter
   *  file hooks to the same location. Omitted → canonical path, exactly as before. */
  outputRelPath?: string;
  /** Model-bakeoff candidate pinning: override the author model / reasoning effort
   *  for THIS call only. Omitted → the production pins (CHAPTERFLOW_AUTHOR_MODEL /
   *  CHAPTERFLOW_AUTHOR_EFFORT, defaults unchanged). */
  model?: string;
  effort?: "minimal" | "low" | "medium" | "high" | "xhigh";
  /** IMP-11 migration-experiment seam: exactly ONE first-write attempt — no gate
   *  retry, no lead degradation (the experiment's one-attempt rule; a bounded
   *  infrastructure replay lives at the SAMPLE layer, never here). Production
   *  callers never set this; the default budget is unchanged. */
  firstWriteOnly?: boolean;
  /** IMP-11 Stage-D prompt-stack seam: transform the fully-built author card
   *  before the first spawn (frozen snapshot stacks substitute their template).
   *  Consulted once for the base card; production callers never set this. */
  cardOverride?: (base: string, ctx: { bookId: string; chapterNumber: number; outputRelPath: string }) => string;
};

/**
 * Author ONE chapter: build the card, spawn the writer (workspace-write, a
 * distinct session id, cwd = pipeline root), then VERIFY — the chapter file
 * must exist and `gate-chapter` must pass. ONE retry appends the gate blockers
 * to the card. Author provenance (bound to the content hash) is recorded on
 * success. Exported so Phase-3 drivers (and the review phase's regeneration)
 * can write single chapters.
 */
export async function authorWriteOneChapter(
  bookId: string,
  chapterNumber: number,
  deps: AutopilotDeps,
  opts: AuthorWriteOneOpts = {},
): Promise<AuthorWriteOneResult> {
  const io = resolveAuthorIo(opts.io);
  const nn = String(chapterNumber).padStart(2, "0");
  const chapterId = authorChapterId(bookId, chapterNumber);
  const relPath = opts.outputRelPath ?? authorChapterRelPath(bookId, chapterNumber);
  const writerModel = opts.model ?? AUTHOR_WRITER_MODEL;
  const writerEffort = opts.effort ?? AUTHOR_WRITER_EFFORT;

  const briefMd = io.readBriefMd(bookId, chapterNumber);
  if (!briefMd) return { ok: false, reason: `ch${nn}: no rendered brief (chNN.brief.md) — run compile-chapter-briefs first` };
  const packet = io.readPacket(bookId, chapterNumber);
  if (!packet) return { ok: false, reason: `ch${nn}: no source packet — run compile-source-packets first` };

  // IMP-03: load the compiler-owned source-use plan. ABSENT → legacy path
  // (pre-plan books author exactly as before; absence grants nothing). PRESENT →
  // fail-closed: contract-invalid, unreadable, or stale-against-the-packet all
  // REFUSE to author — a plan that no longer matches its packet must be
  // recompiled upstream, never silently ignored or trusted.
  let plan: SourceUsePlanV1 | null = null;
  try {
    plan = io.readSourcePlan(bookId, chapterNumber);
  } catch (err) {
    return { ok: false, reason: `ch${nn}: source-use plan exists but is unreadable (${(err as Error).message.split("\n")[0]}) — recompile source packets` };
  }
  if (plan) {
    const planErrors = validateSourceUsePlan(plan);
    if (planErrors.length > 0) {
      return { ok: false, reason: `ch${nn}: source-use plan fails its frozen contract — ${planErrors.slice(0, 3).join("; ")} — recompile source packets` };
    }
    const stale = sourceUsePlanStale(plan, packet);
    if (stale) {
      return { ok: false, reason: `ch${nn}: source-use plan is STALE — ${stale} — recompile source packets before authoring` };
    }
  }

  // IMP-01 (F-001/F-020): the writer never touches the canonical path. Every
  // attempt gets an isolated workspace (the agent's cwd and ONLY writable dir);
  // the candidate is validated in memory against the COMMITTED book and lands
  // via one compare-and-swap atomic commit. The 2026-07-08 preWriteBytes
  // restore lane this replaced is structurally unnecessary now — a failed
  // attempt never changed canonical bytes to begin with, so there is nothing
  // to restore and no window where an unreviewed draft shadows reviewed bytes.
  const candidateName = chapterFileName(chapterId);
  // Sibling/gate context follows the same override the io hooks use (bakeoff
  // slot roots pass outputRelPath + slot-rooted io; production = canonical).
  const canonicalAbs = resolve(PIPELINE_DIR, relPath);

  const machineBrief = io.readBrief(bookId, chapterNumber);
  // Authoritative total-chapter count (works before all chapters exist on disk) —
  // gates the book-scale content-device deal. Explicit opt override wins.
  let totalChapters = opts.totalChapters;
  if (totalChapters === undefined) {
    try { totalChapters = deps.expectedChapterNumbers(bookId).length; }
    catch { try { totalChapters = io.loadChapters(bookId).length; } catch { totalChapters = 0; } }
  }
  // F-1: resolve the EFFECTIVE brief under a persisted lead override (a prior
  // entry's degraded lead that landed a passing chapter). The compiled brief on
  // disk still deals the failed lead — compile-chapter-briefs re-deals it every
  // entry — so the sidecar is what keeps write/regen/repair consistent with the
  // chapter's ACTUAL lead. Stale overrides (brief re-dealt) are ignored inside
  // applyLeadThreadOverride.
  const leadOverride = io.readLeadOverride(bookId, chapterNumber);
  // Failure MEMORY is honored under the same staleness rule as the overlay: only
  // while the compiled brief still deals the recorded failed lead (a re-deal
  // supersedes everything the memory proved).
  const leadMemory = leadOverride && leadOverride.failedLead === machineBrief?.leadThread?.name ? leadOverride : null;
  const effectiveBrief = applyLeadThreadOverride(machineBrief, leadOverride);
  if (effectiveBrief !== machineBrief) {
    deps.log(`[autopilot] author ch${nn}: persisted lead override active — writing to lead "${effectiveBrief?.leadThread?.name}" (the dealt lead "${leadOverride?.failedLead}" repeatedly failed the lead-thread write contract; override recorded ${leadOverride?.at}).`);
  }
  // The rendered md is a pure render of the machine brief — under an override (or a
  // degraded attempt below) it must be re-rendered from the EFFECTIVE brief, or the
  // card would carry two disagreeing LEAD THREAD/cast signals.
  const voice = io.voiceCard(bookId);
  const mkCard = (brief: ChapterBriefV1 | null, md: string): string => buildAuthorCard({
    bookId, chapterNumber, totalChapters, briefMd: md, packet, voice, complaints: opts.complaints, brief, plan,
    // IMP-01: the agent-facing output path is the candidate file in its own
    // working directory — never a repository path.
    outputRelPath: candidateName,
  });
  const briefMdEffective = effectiveBrief !== machineBrief && effectiveBrief ? renderBriefMd(effectiveBrief) : briefMd;
  const builtCard = mkCard(effectiveBrief, briefMdEffective);
  const baseCard = opts.cardOverride
    ? opts.cardOverride(builtCard, { bookId, chapterNumber, outputRelPath: candidateName })
    : builtCard;
  if (baseCard.length > AUTHOR_CARD_MAX_CHARS) {
    deps.log(`[autopilot] author ch${nn}: card is ${baseCard.length} chars (> ${AUTHOR_CARD_MAX_CHARS} target) — proceeding, but the packet/brief deserve a diet`);
  }

  // Regen no-op guard: a regeneration is only requested for a FAILING chapter,
  // so a writer session that leaves the bytes unchanged has produced nothing —
  // detect it by content hash instead of letting the stale file "pass" and
  // silently burn the regen attempt (verifier finding, 2026-07-02).
  const isRegen = (opts.complaints?.length ?? 0) > 0;
  let priorHash: string | undefined;
  if (isRegen && io.chapterExists(bookId, chapterNumber)) {
    try {
      const prior = io.loadChapters(bookId).find((c) => c.number === chapterNumber);
      priorHash = prior ? chapterContentHash(prior) : undefined;
    } catch { /* unreadable prior chapter — treat as no prior hash */ }
  }

  let card = baseCard;
  let lastReason = "";
  // CF-I-2 (owner decision 4): the C31–C35 register/machinery advisories surfaced as
  // retry fix lines. This closure loads the just-written draft and returns the labelled
  // block (or "" when clean/unreadable). It is ONLY ever appended to a card already
  // built for a BLOCKING failure (gate blocker, rubric FAIL, write-contract FAIL), so
  // an advisory NEVER triggers a retry by itself and NEVER changes a pass/fail predicate
  // — it only changes the TEXT the next attempt sees. Best-effort, deterministic.
  const advisoryRegisterBlock = (candidate?: ChapterV21): string => {
    try {
      // IMP-01: in-loop retries pass the failed CANDIDATE (it is not on disk);
      // the attempt-1 regen seed still reads the prior committed draft.
      const draft = candidate ?? io.loadChapters(bookId).find((c) => c.number === chapterNumber);
      // IMP-04: pass the source-use plan so the C37 source-register advisories
      // (claim-strength overreach, unsupported scene, generic-specific leak) ride
      // the same retry/repair routing as C31-C36. No-op without a plan.
      return draft ? registerAdvisoryRetryBlock(draft, plan) : "";
    } catch { return ""; }
  };
  // CF-I regen surfacing (live re-mint, multipliers ch02): a REGEN is always requested
  // for a chapter the blinded reviewers already read, and the reviewed draft is still
  // on disk at card-build time (the same bytes preWriteBytes snapshotted above) — but
  // its C31–C35 advisories never reached the regen card, so a review-FAIL regen
  // re-minted the exact register defects the reviewers could feel (ch02 re-minted 10
  // evaluator openers). Seed the ATTEMPT-1 regen card with the PRIOR draft's advisory
  // block; empty-string-safe when the prior draft is clean/unreadable. The card is
  // already being built for the regen's BLOCKING complaints, so this changes card TEXT
  // only — no new retry trigger, no pass/fail predicate change. (In-loop failures below
  // keep re-appending the block computed from the freshly-failed draft, as before.)
  if (isRegen) card = baseCard + advisoryRegisterBlock();
  // F-1 failure classification: the degraded extra slot opens ONLY when every
  // configured attempt failed at the write contract with lead-thread findings
  // alone. Any other failure (spawn death, no file, gate, rubric, mixed contract
  // findings) marks the call non-lead — the lead is not proven uncarriable there.
  const baseAttempts = 1 + AUTHOR_WRITE_GATE_RETRIES;
  let leadOnlyContractFails = 0;
  let nonLeadFailure = false;
  let activeBrief = effectiveBrief;
  let degraded: { from: string; to: { kind: "invented" | "owned-case"; name: string }; castEmptied: boolean } | null = null;
  let degradedFailedOnLead = false;
  const maxAttempts = opts.firstWriteOnly === true ? 1 : baseAttempts + AUTHOR_WRITE_LEAD_DEGRADE_RETRIES;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (attempt > baseAttempts) {
      // The extra slot exists ONLY for bounded lead degradation (F-1).
      if (nonLeadFailure || leadOnlyContractFails !== baseAttempts) break;
      const failedLead = activeBrief?.leadThread?.name;
      if (!failedLead) break;
      const proxyBanned = !!totalChapters && totalChapters >= 4
        && dealContentDeviceBans(chapterNumber, totalChapters).includes("proxy-cast");
      // Exclude every lead already proven uncarriable: this call's failed lead,
      // (when an override was active) the ORIGINAL dealt lead it replaced, and the
      // persisted cross-entry failure memory — candidates strictly shrink across
      // entries, so the halt cycle terminates instead of replaying forever.
      const alreadyFailed = [...new Set([
        failedLead,
        ...(leadMemory ? [leadMemory.failedLead] : []),
        ...(leadMemory?.failedLeads ?? []),
      ])];
      const candidates = degradedLeadCandidates(activeBrief?.ownedCases ?? [], activeBrief?.cast ?? [], proxyBanned, alreadyFailed);
      if (candidates.length === 0) {
        lastReason = `ch${nn}: the dealt lead "${failedLead}" failed the lead-thread write contract on every attempt, and NO degradation candidate remains (exhausted: ${alreadyFailed.map((x) => `"${x}"`).join(", ")}; ${proxyBanned ? "invented lead unavailable — this chapter's content-device deal bans proxy-cast" : "no invented cast remains"}) — honest halt, nothing carriable exists.`;
        deps.log(`[autopilot] author ch${nn}: ${lastReason}`);
        break;
      }
      const to = candidates[0];
      const castEmptied = proxyBanned && to.kind === "owned-case";
      degraded = { from: failedLead, to, castEmptied };
      activeBrief = activeBrief ? { ...activeBrief, leadThread: to, cast: castEmptied ? [] : activeBrief.cast } : activeBrief;
      deps.log(`[autopilot] author ch${nn}: lead degraded: "${failedLead}" → "${to.name}" after ${leadOnlyContractFails} contract failures (bounded +${AUTHOR_WRITE_LEAD_DEGRADE_RETRIES} attempt; the lead-thread contract enforces the NEW lead at full strength).`);
      card = `${mkCard(activeBrief, activeBrief ? renderBriefMd(activeBrief) : briefMdEffective)}\n\nLEAD CHANGE\nThe previously dealt lead ("${failedLead}") could not carry the fastRead + 2 examples across ${leadOnlyContractFails} attempts. The LEAD THREAD above now deals "${to.name}" — the same contract applies to it at full strength.`;
    }
    const label = attempt === 1 ? `author-ch${nn}` : attempt > baseAttempts ? `author-ch${nn}-degraded` : `author-ch${nn}-retry${attempt - 1}`;
    const sessionId = deps.mkSessionId(label);
    // IMP-01: mint the attempt AFTER the card is final (its hash is part of the
    // immutable identity). The workspace is the writer's cwd — its ONLY writable
    // directory; the canonical path is not reachable by this session at all.
    const chAttempt = mintChapterAttempt({
      bookId,
      chapterNumber,
      chapterId,
      attemptKind: isRegen ? "author-regeneration" : "author-initial",
      attemptSequence: attempt,
      promptSha256: sha256Hex(card),
      // IMP-03 lineage: the attempt is bound to the exact plan/packet/projection/
      // brief/renderer it was authored under — a change to any of them changes
      // these hashes, staling every dependent artifact (F-004..F-007 requirement 14).
      sourcePlanHash: plan ? sourceUsePlanHash(plan) : undefined,
      inputHashes: {
        sourcePacket: sourcePacketHash(packet),
        writerProjection: sha256Hex(JSON.stringify(writerPacketProjection(packet))),
        briefMd: sha256Hex(briefMdEffective),
        ...(plan ? { sourceUsePlan: sourceUsePlanHash(plan) } : {}),
        untrustedArtifactRenderer: UNTRUSTED_ARTIFACT_RENDERER_VERSION,
      },
      io,
      attemptsRoot: io.attemptsRoot(),
    });
    deps.log(`[autopilot] author ch${nn}: whole-chapter writer working (attempt ${attempt}, card ${card.length} chars, ${writerModel} @ ${writerEffort}, timeout ${Math.round(AUTHOR_WRITE_TIMEOUT_MS / 60000)}min)`);
    // M-lane: pinned model/effort/timeout. The runner REJECTS on timeout (SIGKILL) —
    // catch it into the structured retry path; an unhandled throw here would escape
    // doAuthorWrite's halt taxonomy entirely (grill round-2b #12).
    let r: Awaited<ReturnType<typeof deps.spawn>>;
    try {
      r = await deps.spawn({
        task: card,
        role: "author-writer",
        sessionId,
        cwd: chAttempt.workspaceDir,
        sandbox: "workspace-write",
        skipGitRepoCheck: true,
        model: writerModel,
        reasoningEffort: writerEffort,
        timeoutMs: AUTHOR_WRITE_TIMEOUT_MS,
      });
    } catch (err) {
      lastReason = `ch${nn}: writer session ${sessionId} died before completing (${(err as Error).message})`;
      deps.log(`[autopilot] author ch${nn}: ${lastReason}`);
      // Honest-accounting: the spawn id was MINTED (mkSessionId above) but the
      // throw skips the success-path logSession, so the cost-report invariant
      // trips ("minted but never logged"). Record a synthetic failed session —
      // the same drain-then-record pattern as spawnAndLog (autopilot.ts) — so a
      // died/timed-out writer still leaves a durable trace (live-caught on the
      // start-with-why gold run: ch04's retry spawn was unlogged).
      try {
        deps.logSession(bookId, label, {
          ok: false, exitCode: -1, finalMessage: "", stdout: "",
          stderr: (err as Error)?.message ?? String(err), durationMs: 0, sessionId,
        });
      } catch { /* best-effort: never convert a spawn error into a log error */ }
      finalizeAttempt(chAttempt, "infrastructure_failure", lastReason);
      card = `${baseCard}\n\nPREVIOUS ATTEMPT DID NOT COMPLETE\nYour previous session was cut off before finishing. Write the complete chapter file this time.`;
      nonLeadFailure = true;
      continue;
    }
    try { deps.logSession(bookId, label, r); } catch { /* best-effort */ }
    // IMP-10: link the spawn's IMP-00 effective-context manifest + store the
    // rendered card and final message content-addressed (no-op unless evidence
    // is enabled for this attempt). Best-effort — observability never gates.
    if (chAttempt.evidenceRoot) {
      recordSpawnEvidence({
        evidenceRoot: chAttempt.evidenceRoot,
        attemptId: chAttempt.identity.attemptId,
        taskCard: card,
        finalMessage: r.finalMessage,
        executionContextManifestPath: (r as { manifestPath?: string }).manifestPath,
        atIso: new Date().toISOString(),
      });
    }
    if (!r.ok) deps.log(`[autopilot] author ch${nn}: writer exited ${r.exitCode}`);

    // IMP-01: anything in the workspace beyond the single candidate file is an
    // unexpected write — a first-class attempt failure, never tolerated (F-020).
    const smuggled = unexpectedAttemptWrites(chAttempt);
    if (smuggled.length > 0) {
      lastReason = `ch${nn}: writer session ${sessionId} wrote unexpected workspace file(s): ${smuggled.join(", ")}`;
      finalizeAttempt(chAttempt, "unexpected_write", lastReason);
      card = `${baseCard}\n\nPREVIOUS ATTEMPT WROTE UNEXPECTED FILES\nWrite EXACTLY one file (${candidateName}). Your previous session also wrote: ${smuggled.join(", ")} — do not create any other file.`;
      nonLeadFailure = true;
      continue;
    }
    const imported = importCandidate(chAttempt);
    if (!imported.ok) {
      const missing = imported.reason.startsWith("no candidate file");
      lastReason = `ch${nn}: writer session ${sessionId} exited ${r.exitCode} — ${imported.reason}`;
      finalizeAttempt(chAttempt, imported.outcome, imported.reason);
      card = missing
        ? `${baseCard}\n\nPREVIOUS ATTEMPT WROTE NO FILE\nYour previous session ended without creating ${candidateName}. Write the complete chapter file this time.`
        : `${baseCard}\n\nPREVIOUS ATTEMPT WROTE A MALFORMED FILE\nYour previous session's ${candidateName} was rejected: ${imported.reason}. Write the complete, valid chapter JSON this time.`;
      nonLeadFailure = true;
      continue;
    }
    const candidate = imported.chapter;

    // IMP-03 (requirement 5/13): a candidate carrying source-plan control fields
    // is an attempted downstream relabel of compiler-owned semantics (origin/
    // form/claim-strength/permissions) — writers may REQUEST an upstream change,
    // never mutate those fields in their output. First-class attempt failure.
    const planMutation = embeddedPlanMutationFindings(candidate);
    if (planMutation.length > 0) {
      lastReason = `ch${nn}: writer session ${sessionId} embedded source-plan control field(s) in the chapter output (${planMutation.slice(0, 5).join(", ")}) — origin/form/claim-strength changes route upstream through source-plan recompile, never through writer output`;
      finalizeAttempt(chAttempt, "validation_failed", lastReason);
      deps.log(`[autopilot] author ch${nn}: ${lastReason}`);
      card = `${baseCard}\n\nPREVIOUS ATTEMPT EMBEDDED PLAN CONTROL FIELDS\nYour previous ${candidateName} carried compiler-owned source-plan fields (${planMutation.slice(0, 5).join(", ")}). The source-use plan is not yours to write or edit: remove every such field and write ONLY the ChapterV21 content schema. If you believe a license is wrong, say so in prose in your final message — do not relabel.`;
      nonLeadFailure = true;
      continue;
    }

    const gate = await io.gateCandidate(candidate, canonicalAbs, relPath);
    if (gate.code === 0) {
      if (priorHash) {
        // IMP-01: the no-op check reads the CANDIDATE (the prior draft is still
        // the committed canonical — a regen that reproduces it produced nothing).
        const freshHash = chapterContentHash(candidate);
        if (freshHash === priorHash) {
          // Fail immediately, no retry: the gate-retry budget exists for gate
          // blockers, not for a session that ignored explicit complaints. The
          // chapter stays failing and the caller's cap/halt logic reports it.
          const reason = `ch${nn}: regen session ${sessionId} left the chapter byte-identical — a failing chapter regenerated to the same bytes is still failing`;
          finalizeAttempt(chAttempt, "validation_failed", reason);
          deps.log(`[autopilot] author ch${nn}: ${reason}`);
          return { ok: false, reason };
        }
      }
      // Rubric preflight for THIS chapter (Phase-3 live finding, 2026-07-02:
      // writers shipped gate-clean chapters with tell 0.778 / ease 66). The
      // deterministic reader-facing metrics (Flesch band, distractor tell,
      // transfer ratio, memorable lines) are as binding as the ship gate in
      // the author arch — a FAIL feeds the retry card like a gate blocker.
      const rubric = await io.rubricWithCandidate(bookId, chapterNumber, candidate);
      // Capture THIS chapter's `chNN:` verdict line AND its follow-on
      // `chNN fix: …` reason lines. formatRubricMetrics emits the W2 card-quality
      // repair instructions (length-tell / practice-floor) as indented `chNN fix:`
      // lines beneath the verdict line; grabbing only the single `chNN:` line
      // would drop those concrete repairs, leaving the writer with an opaque
      // `lenTell=5✗` and no instruction on how to clear it.
      const rubricAll = [rubric.stdout, rubric.stderr].join("\n").split("\n");
      const rubricVerdictLine = rubricAll.find((l) => l.trim().startsWith(`ch${nn}:`)) ?? "";
      const rubricFixLines = rubricAll.filter((l) => l.trim().startsWith(`ch${nn} fix:`));
      const rubricBlock = [rubricVerdictLine.trim(), ...rubricFixLines.map((l) => l.trim())].filter(Boolean).join("\n");
      if (rubricVerdictLine.includes("FAIL")) {
        lastReason = `ch${nn}: rubric preflight FAIL — ${rubricBlock}`;
        deps.log(`[autopilot] author ch${nn}: ${lastReason}`);
        // B12 live fix: when tellRate is among the causes, hand the writer the
        // MEASURED per-question evidence (which key, exact char counts, the exact
        // repair) — the evidence-pack pattern that converges where prose metric
        // explanations do not (ch02 retried to IDENTICAL tell metrics without it).
        let tellEvidence = "";
        if (/tellRate/.test(rubricBlock)) {
          try {
            const draft = candidate;
            const evid: string[] = [];
            for (const q of draft?.quiz?.questions ?? []) {
              const choices = (q.choices ?? []).map((c) => {
                const raw = c as unknown;
                return typeof raw === "string" ? raw : String((raw as { direct?: unknown })?.direct ?? raw);
              });
              const k = q.correctIndex;
              if (typeof k !== "number" || !Number.isInteger(k) || k < 0 || k >= choices.length || choices.length === 0) continue;
              const lens = choices.map((c) => c.length);
              const max = Math.max(...lens);
              if (lens[k] === max && lens.filter((l) => l === max).length === 1) {
                const maxDistractor = Math.max(...lens.filter((_, i) => i !== k));
                evid.push(`- ${q.questionId ?? "q?"}: the KEY is the uniquely longest choice (${lens[k]} chars; longest distractor ${maxDistractor}) — trim the key to <= ${maxDistractor} chars OR grow one distractor past it.`);
              }
            }
            if (evid.length > 0) {
              tellEvidence = `\nTELL EVIDENCE — measured on YOUR draft (the gate allows AT MOST ONE uniquely-longest key across the 9 questions; you have ${evid.length}):\n${evid.join("\n")}`;
            }
          } catch { /* best-effort evidence — the metric block still stands */ }
        }
        finalizeAttempt(chAttempt, "validation_failed", lastReason);
        card = `${baseCard}\n\nRUBRIC PREFLIGHT FAILURES FROM YOUR PREVIOUS ATTEMPT\nYour previous draft passed the structural gate but FAILED the deterministic reader-metrics preflight. Rewrite the chapter so ALL of these clear:\n${rubricBlock}${tellEvidence}\nHow to read it: ease must land in 72-84 (write plainer, shorter sentences); tell must be <= 0.2 (at most ONE of the 9 keys may be the uniquely longest choice — fix the listed questions); transfer must be >= 0.7 (most quiz questions test a NEW scenario, not recall); memClean >= 2 (short portable memorable lines); lenTell — the key may be the uniquely SHORTEST choice in at most 4 of 9 questions and the uniquely LONGEST in at most 1 of 9 (the same caps as your quality bar — fix only the questions over a cap; do NOT purge every length extreme, that mints the opposite tell); practice — tryThisNow or the 24-hour challenge must be imperative-led with a concrete number/timebox; echo (advisory) — paraphrase any key that reuses 5+ consecutive words from the chapter.`;
        card += advisoryRegisterBlock(candidate);
        nonLeadFailure = true;
        continue;
      }
      // STIER-2 D7/D9 — the write-time contract (lead thread + timer sanity) runs with
      // the BRIEF in scope, same retry semantics as the rubric preflight. Deterministic,
      // evidence-first complaints (the proven repair pattern). IMP-01: the contract
      // reads the CANDIDATE directly — no disk round-trip, no unreadable case.
      const writtenChapter: ChapterV21 = candidate;
      {
        // F-1: the contract runs against the ACTIVE brief — the effective (override-
        // resolved) brief normally, the degraded-lead brief on the extra attempt —
        // so a degraded lead is verified at exactly the same strength.
        const contract = authorWriteContractFindings(writtenChapter, activeBrief, packet);
        if (contract.length > 0) {
          if (contract.every((c) => c.startsWith("lead thread"))) {
            leadOnlyContractFails++;
            if (attempt > baseAttempts) degradedFailedOnLead = true; // the DEGRADED lead is now proven uncarriable too
          } else nonLeadFailure = true;
          lastReason = `ch${nn}: STIER-2 write contract FAIL — ${contract.join(" | ")}`;
          finalizeAttempt(chAttempt, "validation_failed", lastReason);
          deps.log(`[autopilot] author ch${nn}: ${lastReason}`);
          card = `${baseCard}\n\nWRITE-CONTRACT FAILURES FROM YOUR PREVIOUS ATTEMPT\nYour previous draft passed the structural gate but broke the dealt write contract. Rewrite the chapter so ALL of these clear:\n${contract.map((c) => `- ${c}`).join("\n")}`;
          card += advisoryRegisterBlock(candidate);
          continue;
        }
      }
      // F-1: a degraded lead that LANDED is persisted to the sidecar so every future
      // entry (write, review-regen, repair contract re-check) resolves the chapter's
      // ACTUAL lead instead of re-dealing the proven-uncarriable one. Keyed on the
      // COMPILED brief's dealt lead (the staleness guard); best-effort but LOUD —
      // a persist failure means the next entry re-degrades from scratch.
      if (degraded) {
        try {
          io.writeLeadOverride(bookId, chapterNumber, {
            schemaVersion: "lead-thread-override-v1",
            bookId: normSlug(bookId),
            chapterNumber,
            failedLead: machineBrief?.leadThread?.name ?? degraded.from,
            lead: degraded.to,
            cast: degraded.castEmptied ? [] : (activeBrief?.cast ?? []),
            failedLeads: [...new Set([degraded.from, ...(leadMemory?.failedLeads ?? [])])],
            reason: `lead-thread contract failed ${leadOnlyContractFails}× on "${degraded.from}"; degraded per F-1 (bounded write-time recovery)`,
            at: new Date().toISOString(),
          });
          deps.log(`[autopilot] author ch${nn}: lead override persisted (chNN.lead-override.json) — future regens/repairs enforce the contract against "${degraded.to.name}".`);
        } catch (err) {
          deps.log(`[autopilot] author ch${nn}: degraded lead LANDED but the lead-override sidecar could not be persisted (${(err as Error).message.split("\n")[0]}) — the next entry will re-fail on the dealt lead and re-degrade; fix the briefs dir permissions.`);
        }
      }
      // IMP-03 freshness: the plan was verified against the packet at ENTRY; the
      // writer ran for many minutes since. Re-verify the source lineage right
      // before commit — a packet recompiled mid-attempt means this candidate was
      // authored under licenses that no longer exist. Reject; never rebase.
      if (plan) {
        const freshPacket = io.readPacket(bookId, chapterNumber);
        if (!freshPacket || sourceUsePlanStale(plan, freshPacket)) {
          const reason = `ch${nn}: source lineage went STALE mid-attempt (the source packet changed since this attempt's plan was verified) — candidate rejected; recompile packets+plans and re-run`;
          finalizeAttempt(chAttempt, "validation_failed", reason);
          deps.log(`[autopilot] author ch${nn}: ${reason}`);
          return { ok: false, reason };
        }
      }
      // IMP-01 commit: compare-and-swap against the attempt's expected canonical
      // base. A mismatch means another actor committed since this attempt was
      // minted — the stale attempt LOSES (no overwrite, no auto-retry; the
      // caller's existing bounded policy owns any further work).
      const committed = commitChapterCandidate({ attempt: chAttempt, bytes: imported.bytes, io });
      if (!committed.ok) {
        const reason = `ch${nn}: ${committed.reason}`;
        finalizeAttempt(chAttempt, "stale_base", committed.reason);
        deps.log(`[autopilot] author ch${nn}: ${reason}`);
        return { ok: false, reason };
      }
      // Success: bind author provenance to the authored content (create-once per
      // content; a conflict means a prior author of identical bytes stands).
      try {
        io.recordProvenance(chapterId, sessionId, chapterContentHash(candidate));
      } catch (err) {
        deps.log(`[autopilot] author ch${nn}: provenance unchanged (${(err as Error).message.split(".")[0]})`);
      }
      // IMP-06: passive first-write diversity snapshot (shadow telemetry; OPT-IN
      // via CHAPTERFLOW_DIVERSITY_LEDGER_ROOT — no-op otherwise, never throws).
      const divRec = recordChapterDiversity({
        bookId,
        chapterNumber,
        chapter: candidate,
        plan,
        attemptKind: chAttempt.identity.attemptKind,
        committedGeneration: chAttempt.identity.expectedBaseGeneration + 1,
      });
      // Instruction 12: the same record (with its config hash) rides the
      // attempt's evidence objects when evidence is opted-in.
      if (divRec && chAttempt.evidenceRoot) {
        recordAttemptObject(chAttempt.evidenceRoot, chAttempt.identity.attemptId, "diversity-features", JSON.stringify(divRec) + "\n");
      }
      finalizeAttempt(chAttempt, "committed");
      deps.log(`[autopilot] author ch${nn}: done (gate-chapter clean)`);
      return { ok: true, sessionId };
    }
    const report = reportOf(gate);
    lastReason = `ch${nn}: gate-chapter still blocks after attempt ${attempt}:\n${report.slice(0, 1500)}`;
    finalizeAttempt(chAttempt, "validation_failed", lastReason);
    card = `${baseCard}\n\nGATE BLOCKERS FROM YOUR PREVIOUS ATTEMPT\nYour previous draft of ${candidateName} failed the deterministic gate. Rewrite the chapter (regenerate — do not minimally patch) so every blocker below is cleared:\n${report.slice(0, 2000)}`;
    card += advisoryRegisterBlock(candidate);
    nonLeadFailure = true;
  }
  // All attempts failed. IMP-01: nothing to restore — no attempt ever wrote the
  // canonical path, so the last reviewed/known bytes are exactly what disk holds
  // (the 2026-07-08 restore lane this replaced is structurally unnecessary).
  deps.log(`[autopilot] author ch${nn}: all write attempts failed — canonical bytes untouched (candidates retained under .attempts/ for forensics).`);
  // F-1 honesty: when the bounded degradation also failed, the halt names BOTH
  // leads — the operator must see that the fallback was tried, not just the last
  // attempt's complaint. Failure MEMORY persists so the NEXT entry's degradation
  // advances to the next candidate instead of replaying this exact cycle (live:
  // the 2026-07-08 resume replayed dealt→"Corrective" identically until this).
  if (degraded) {
    const provenFailed = [...new Set([
      degraded.from,
      ...(degradedFailedOnLead ? [degraded.to.name] : []),
      ...(leadMemory?.failedLeads ?? []),
    ])];
    try {
      io.writeLeadOverride(bookId, chapterNumber, {
        schemaVersion: "lead-thread-override-v1",
        bookId: normSlug(bookId),
        chapterNumber,
        failedLead: machineBrief?.leadThread?.name ?? degraded.from,
        // Preserve a previously LANDED overlay (the on-disk chapter still carries
        // it after the byte restore above); null when nothing ever landed.
        lead: leadMemory?.lead ?? null,
        cast: leadMemory?.cast ?? machineBrief?.cast ?? [],
        failedLeads: provenFailed,
        reason: `degradation failed: dealt "${degraded.from}" ${baseAttempts}× lead-only; degraded "${degraded.to.name}" ${degradedFailedOnLead ? "also failed the lead contract" : "failed (non-lead)"} — memory so the next entry advances`,
        at: new Date().toISOString(),
      });
      deps.log(`[autopilot] author ch${nn}: lead-failure memory persisted (${provenFailed.map((x) => `"${x}"`).join(", ")}) — the next entry degrades PAST these instead of replaying them.`);
    } catch (err) {
      deps.log(`[autopilot] author ch${nn}: lead-failure memory could not be persisted (${(err as Error).message.split("\n")[0]}) — the next entry will replay this degradation cycle.`);
    }
    return { ok: false, reason: `ch${nn}: lead degradation did not converge — dealt lead "${degraded.from}" failed ${baseAttempts} lead-only contract attempts and the degraded lead "${degraded.to.name}" also failed: ${lastReason || "no reason recorded"}` };
  }
  return { ok: false, reason: lastReason || `ch${nn}: writer failed` };
}

// ── The write phase ───────────────────────────────────────────────────────────

export type AuthorWriteOptions = {
  maxParallel: number;
  heartbeat?: () => boolean;
  io?: Partial<AuthorIo>;
};

const AUTHOR_WRITE_VERBS: ReadonlyArray<readonly [string[], string]> = [
  [["compile-source-packets"], "source-packets"],
  [["source-packet-gate"], "source-packet-gate"],
  [["compile-book-design"], "book-design"],
  [["book-design-gate"], "book-design-gate"],
  [["compile-chapter-briefs"], "chapter-briefs"],
  [["chapter-brief-gate"], "chapter-brief-gate"],
];

/** Run reader budgets while CAPTURING readerBudgets' console.warn: its name-bank
 *  cache degrades CHB3 to a silent no-op on a missing/corrupt config — the
 *  author arch must treat that as infra, never silence. */
export function runBudgetsCapturingWarn(
  chapters: ChapterV21[],
  packets: Map<number, SourcePacketV1>,
  lengthBudget: { renderedChars: number; tolerance: number },
): { findings: BudgetFinding[]; nameBankWarn: string | null } {
  let nameBankWarn: string | null = null;
  const realWarn = console.warn;
  console.warn = (...warnArgs: unknown[]) => {
    const text = warnArgs.map(String).join(" ");
    if (/name-bank unavailable/i.test(text)) nameBankWarn = text;
    realWarn.apply(console, warnArgs);
  };
  try {
    const findings = checkReaderBudgets(chapters, { packets, lengthBudget });
    return { findings, nameBankWarn };
  } finally {
    console.warn = realWarn;
  }
}

/**
 * The author-architecture write phase: compile + gate the upstream artifacts
 * (packets → design → briefs), spawn ONE whole-chapter writer per MISSING
 * chapter (bounded pool), then run the reader budgets as a BLOCKING step.
 * Returns null on success, or a structured halt.
 */
export async function doAuthorWrite(
  bookId: string,
  deps: AutopilotDeps,
  opts: AuthorWriteOptions,
): Promise<AutopilotOutcome | null> {
  const io = resolveAuthorIo(opts.io);
  const heartbeat = opts.heartbeat ?? (() => true);

  // C1 (#7): stamp v1 legacy regen counts onto their design lineages NOW — while
  // the briefs/packets on disk are still the design those writes were consumed
  // against. The compile verbs below may re-deal the briefs (new rotation
  // schema), which legitimately re-keys budgets; migrating first keeps the old
  // counts bound to the old design instead of leaking onto the new one.
  // Idempotent; a book with no v1 ledger is a no-op.
  try {
    migrateLegacyRegenCounts(bookId, undefined, deps.log);
  } catch (err) {
    if (err instanceof RegenLedgerError) return halt(bookId, "infra", `author write regen ledger: ${err.message}`);
    throw err;
  }

  for (const [args, label] of AUTHOR_WRITE_VERBS) {
    if (!heartbeat()) return halt(bookId, "infra", `lost the run lock for ${bookId} during author ${label} — halting to avoid two conductors on the same book.`);
    const r = await deps.runVerb([...args, bookId]);
    if (r.code === 0) {
      const line = reportOf(r).split(/\r?\n/).slice(-1)[0] ?? "PASS";
      deps.log(`[autopilot] author ${label}: ${line}`);
      continue;
    }
    const category: HaltCategory = r.code >= 2 ? "infra" : "content";
    return halt(bookId, category, `author ${label} failed (exit ${r.code}).\n${reportOf(r).slice(0, 2000)}`);
  }

  const expected = deps.expectedChapterNumbers(bookId);
  if (expected.length === 0) {
    return halt(bookId, "infra", `author write: no expected chapters for ${bookId} (missing/empty state/indexes/${bookId}.json) — research must complete first.`);
  }
  const missing = expected.filter((n) => !io.chapterExists(bookId, n));
  deps.log(`[autopilot] author write: ${missing.length} missing chapter(s) of ${expected.length} (parallel ≤${opts.maxParallel})`);

  const failures: string[] = [];
  await mapPool(missing, opts.maxParallel, async (n) => {
    heartbeat(); // keep the run lock fresh across a long write phase
    const r = await authorWriteOneChapter(bookId, n, deps, { io: opts.io });
    if (!r.ok) failures.push(r.reason);
  });
  if (failures.length > 0) {
    return halt(bookId, "content", `author write: ${failures.length} chapter(s) failed to author within the retry budget:\n${failures.join("\n\n").slice(0, 3000)}`);
  }

  return ensureReaderBudgetsClean(bookId, deps, io, {
    maxParallel: opts.maxParallel,
    heartbeat,
    haltPhase: "write",
    label: "author write",
    io: opts.io,
  });
}

/**
 * Reader budgets: a BLOCKING author-arch step with ONE bounded repair round.
 *
 * Called from BOTH doAuthorWrite (after authoring) AND doAuthorReview (at
 * entry): the first S-tier run halted at the write-phase block, and the
 * RE-ENTRY conductor routed gate→qc past the write phase entirely — the
 * flagged bytes would have reached reviewers without the budgets ever
 * re-checking (live-caught 2026-07-03). The check is deterministic and
 * costs milliseconds on the happy path; enforcement at every downstream
 * entry is a pure strengthen.
 */
/**
 * CONVERGENCE-SAFE PASS (2026-07-05): split book-wide budget blockers into the
 * set to ROUTE into the repair round and the set to DOWNGRADE to advisory.
 *
 * A finding's CARRIER SET is exactly the chapters `buildBudgetRepairComplaints`
 * would fan its evidence out to (the same routing the round already uses — no new
 * detector). A finding carried ONLY by chapters holding a durable PASS is
 * downgraded: re-authoring a passing chapter to satisfy a book-wide budget that a
 * SIBLING's edit shifted is the carry-churn that regressed ch04 85.6→73.4, and the
 * durable PASS (an independent reviewer accepted these exact bytes at this bar) is
 * the evidence the block is not reader-harming. A finding with NO routable carrier
 * stays in `route` so the existing "no repair-routable evidence" halt still fires —
 * we never silently swallow a blocker we cannot attribute. Running the SAME
 * partition at the initial scan and the post-round re-check makes them agree, so a
 * band sustained purely by PASS-locked bytes can never deadlock the halt.
 */
export function partitionBudgetBlockers(
  chapters: ChapterV21[],
  blockers: BudgetFinding[],
  isPassLocked: (chapterNumber: number) => boolean,
): { route: BudgetFinding[]; downgraded: BudgetFinding[]; carriersOf: Map<BudgetFinding, number[]> } {
  const route: BudgetFinding[] = [];
  const downgraded: BudgetFinding[] = [];
  const carriersOf = new Map<BudgetFinding, number[]>();
  for (const f of blockers) {
    const carriers = [...buildBudgetRepairComplaints(chapters, [f]).keys()];
    carriersOf.set(f, carriers);
    const hasUnlocked = carriers.some((n) => !isPassLocked(n));
    if (carriers.length > 0 && !hasUnlocked) downgraded.push(f);
    else route.push(f);
  }
  return { route, downgraded, carriersOf };
}

export async function ensureReaderBudgetsClean(
  bookId: string,
  deps: AutopilotDeps,
  io: AuthorIo,
  opts: {
    maxParallel: number;
    heartbeat: () => boolean;
    haltPhase: "write" | "qc";
    label: string;
    io?: Partial<AuthorIo>;
    /** CONVERGENCE-SAFE PASS (2026-07-05): the current review bar. When present
     *  (review re-entry), a chapter holding a durable PASS at this bar is never
     *  full-re-authored by the budget-repair round. Omitted at the WRITE entry
     *  (no reviews exist yet) → the carry-aware path is entirely inert. */
    bar?: number;
  },
): Promise<AutopilotOutcome | null> {
  const haltHere = (category: HaltCategory, reason: string): AutopilotOutcome =>
    ({ status: "halt", bookId, phase: opts.haltPhase, category, reason });
  const heartbeat = opts.heartbeat;
  const expected = deps.expectedChapterNumbers(bookId);

  if (!io.nameBankOk()) {
    return haltHere("infra", `${opts.label}: config/name-bank.json is missing/corrupt/empty — readerBudgets would silently no-op CHB3 (cast disjointness). Fix the name bank; refusing to skip the check.`);
  }
  let chapters: ChapterV21[];
  try {
    chapters = io.loadChapters(bookId);
  } catch (err) {
    return haltHere("infra", `${opts.label}: could not load chapters for the reader-budget check: ${(err as Error).message}`);
  }
  const packets = new Map<number, SourcePacketV1>();
  for (const n of expected) {
    const packet = io.readPacket(bookId, n);
    if (packet) packets.set(n, packet);
  }
  const firstBrief = expected.map((n) => io.readBrief(bookId, n)).find((b) => b?.lengthBudget?.renderedChars);
  const lengthBudget = firstBrief?.lengthBudget ?? { renderedChars: DEFAULT_LENGTH_BUDGET_CHARS, tolerance: LENGTH_BUDGET_TOLERANCE };

  // CONVERGENCE-SAFE PASS (2026-07-05): compute the PASS-lock set for this bar.
  // A chapter is PASS-locked iff an INDEPENDENT reviewer PASSed its EXACT current
  // content+doc bytes at opts.bar (fail-closed via holdsDurablePass — any doubt →
  // not locked, so the guard can only ever protect, never hide a blocker). At the
  // WRITE entry opts.bar is undefined → the set is empty → every step below is
  // inert (byte-identical to the pre-fix behavior; regression only ever occurs on
  // a REVIEW re-entry). Snapshot each locked chapter's content hash up front so the
  // post-round regression guard can prove none was modified.
  const passLocked = new Set<number>();
  const passLockedHashBefore = new Map<number, string>();
  for (const ch of chapters) {
    if (holdsDurablePass(bookId, ch, opts.bar, io.authorSessionOf(ch.chapterId))) {
      passLocked.add(ch.number);
      try { passLockedHashBefore.set(ch.number, chapterContentHash(ch)); } catch { /* leave unset — guard skips it */ }
    }
  }
  const isPassLocked = (n: number): boolean => passLocked.has(n);
  if (passLocked.size > 0) {
    deps.log(`[autopilot] ${opts.label}: ${passLocked.size} chapter(s) hold a durable PASS at bar ${opts.bar} — protected from full re-author (${[...passLocked].sort((a, b) => a - b).map((n) => `ch${String(n).padStart(2, "0")}`).join(", ")})`);
  }

  let { findings, nameBankWarn } = runBudgetsCapturingWarn(chapters, packets, lengthBudget);
  if (nameBankWarn) {
    return haltHere("infra", `${opts.label}: readerBudgets reported the name bank unavailable (CHB3 silently disabled): ${nameBankWarn}. Fix config/name-bank.json; refusing to skip the check.`);
  }
  let blockers = findings.filter((f) => f.severity === "blocker");
  // CONVERGENCE-SAFE PASS: downgrade any blocker carried ONLY by PASS-locked
  // chapters to advisory — never re-author a passing chapter for a book-wide
  // budget a sibling's edit shifted. Records a forensic protection note per
  // protected carrier (best-effort). No-op when nothing is PASS-locked.
  if (passLocked.size > 0 && blockers.length > 0) {
    const part = partitionBudgetBlockers(chapters, blockers, isPassLocked);
    for (const f of part.downgraded) {
      deps.log(`[autopilot] ${opts.label}: [${f.checkId}] ch${String(f.chapterNumber).padStart(2, "0")} carried ONLY by PASS-locked chapter(s) — downgraded to advisory, no re-author (convergence-safe; deadlock avoided)`);
      for (const n of part.carriersOf.get(f) ?? []) {
        try {
          appendReopenNote(bookId, {
            chapterNumber: n,
            contentHash: passLockedHashBefore.get(n) ?? "",
            at: new Date().toISOString(),
            decision: "protected-downgrade",
            trigger: f.checkId,
            detail: "book-wide budget blocker carried only by PASS-locked chapters; not reopened",
          });
        } catch { /* forensic note is best-effort; never converts a decision into a halt */ }
      }
    }
    blockers = part.route;
  }
  if (blockers.length > 0) {
    // ONE bounded budget-repair round (live-added 2026-07-03: the first S-tier run
    // halted here with CHB10+CHB12 while the evidence for a targeted repair was
    // sitting in the findings). Each offending chapter gets ITS OWN measured
    // complaints (band-word counts, verbatim strawman hits) and rewrites under the
    // byte-identical guard; then the budgets re-run ONCE. Still blocking → the
    // same fail-closed halt as before. The block is never weakened — this only
    // spends bounded writers where the halt previously spent the operator.
    // CONVERGENCE-SAFE PASS: never route a PASS-locked chapter into a full
    // re-author, even when it co-carries a routed book-wide finding — trim it from
    // the target set (its UNLOCKED siblings carry the reduction). A routed finding
    // has ≥1 unlocked carrier by construction, so this can only shrink the set to a
    // still-non-empty one (a finding with no routable carrier stays a blocker and
    // hits the size===0 halt below). A locked chapter thus never consumes F4 cap.
    const allTargets = new Map(
      [...buildBudgetRepairComplaints(chapters, blockers)].filter(([n]) => !isPassLocked(n)),
    );
    const lines = blockers.map((f) => `  [${f.checkId}] ch${String(f.chapterNumber).padStart(2, "0")}: ${f.message}`);
    if (allTargets.size === 0) {
      return haltHere("content", `${opts.label}: reader budgets BLOCK (${blockers.length} finding(s)) with no repair-routable chapter evidence:\n${lines.join("\n").slice(0, 3000)}`);
    }
    // STIER-2 blast-radius cap (grill round-2b #8): book-rate blockers (CHB14/15)
    // can put evidence on nearly EVERY chapter — rewriting the whole book in one
    // "bounded" round is a halt-priced repair. Cap the round to the 4 chapters
    // carrying the most complaint evidence (ties → lower chapter number); if the
    // remaining tail still blocks the re-check, the fail-closed halt stands.
    const REPAIR_TARGET_CAP = 4;
    let targets = allTargets;
    if (allTargets.size > REPAIR_TARGET_CAP) {
      const ranked = [...allTargets.entries()]
        .sort((a, b) => (b[1].join("").length - a[1].join("").length) || (a[0] - b[0]))
        .slice(0, REPAIR_TARGET_CAP);
      targets = new Map(ranked);
      deps.log(`[autopilot] ${opts.label}: repair evidence spans ${allTargets.size} chapters — capping the round to the top ${REPAIR_TARGET_CAP} contributors (${ranked.map(([n]) => `ch${String(n).padStart(2, "0")}`).join(", ")}); the re-check still runs book-wide`);
    }
    // F4 (FINAL-HARDENING-PLAN 2026-07-04): the budget-repair round is bounded
    // WITHIN an entry, but it runs at BOTH the write and review entries and its
    // writer spawns never touched a durable ledger — a persistently blocking
    // book could re-spend the full round on every conductor re-entry, forever.
    // One budget-repair write per chapter LINEAGE, consumed durably BEFORE the
    // spawn (failed rounds count too). A chapter with no computable lineage
    // (pre-brief fixtures; real v24 books always compile briefs before writes)
    // runs uncounted rather than converting a safety net into an infra halt.
    {
      const skipped: number[] = [];
      const runnable = new Map<number, string[]>();
      for (const [n, complaints] of targets) {
        let lineage: string | null = null;
        try { lineage = computeRegenLineage(bookId, n); } catch { lineage = null; }
        if (!lineage) { runnable.set(n, complaints); continue; }
        let consumed = 1;
        try { consumed = budgetRepairConsumedFor(loadAuthorRegenLedger(bookId), n, lineage); } catch { consumed = 1; } // unreadable ledger → fail closed
        if (consumed >= 1) { skipped.push(n); continue; }
        recordBudgetRepairConsumed(bookId, n, lineage);
        runnable.set(n, complaints);
      }
      if (skipped.length > 0) {
        deps.log(`[autopilot] ${opts.label}: ${skipped.length} chapter(s) already consumed their durable budget-repair write for this lineage (${skipped.sort((a, b) => a - b).map((n) => `ch${String(n).padStart(2, "0")}`).join(", ")}) — not re-spending`);
      }
      if (runnable.size === 0) {
        return haltHere("content", `${opts.label}: reader budgets BLOCK and every routable chapter has already consumed its one durable budget-repair write for its current lineage (F4) — a byte/design change is required:\n${lines.join("\n").slice(0, 3000)}`);
      }
      targets = runnable;
    }
    deps.log(`[autopilot] ${opts.label}: reader budgets BLOCK (${blockers.length} finding(s)) — ONE bounded budget-repair round over ${targets.size} chapter(s): ${[...targets.keys()].sort((a, b) => a - b).map((n) => `ch${String(n).padStart(2, "0")}`).join(", ")}`);
    const repairFailures: string[] = [];
    await mapPool([...targets.entries()], opts.maxParallel, async ([n, complaints]) => {
      heartbeat();
      const r = await authorWriteOneChapter(bookId, n, deps, { complaints, io: opts.io });
      if (!r.ok) repairFailures.push(r.reason);
    });
    if (repairFailures.length > 0) {
      return haltHere("content", `${opts.label}: budget-repair round failed for ${repairFailures.length} chapter(s):\n${repairFailures.join("\n\n").slice(0, 3000)}`);
    }
    try {
      chapters = io.loadChapters(bookId);
    } catch (err) {
      return haltHere("infra", `${opts.label}: could not reload chapters after the budget-repair round: ${(err as Error).message}`);
    }
    // A4 REGRESSION GUARD (CONVERGENCE-SAFE PASS): no PASS-locked chapter may have
    // changed bytes across the round — the target filter guarantees it, so this is
    // a loud invariant assertion. If it EVER fires, a passing chapter was modified
    // (a bug) and its durable PASS may have regressed; refuse to advance rather
    // than ship a possibly-regressed PASS.
    for (const n of passLocked) {
      const before = passLockedHashBefore.get(n);
      if (!before) continue;
      const ch = chapters.find((c) => c.number === n);
      const after = ch ? chapterContentHash(ch) : undefined;
      if (after && after !== before) {
        try {
          appendReopenNote(bookId, {
            chapterNumber: n,
            contentHash: after,
            at: new Date().toISOString(),
            decision: "reopened-anomaly",
            trigger: "budget-repair-round",
            detail: `content hash ${before}→${after} despite PASS-lock`,
          });
        } catch { /* best-effort */ }
        return haltHere("infra", `${opts.label}: REGRESSION GUARD — ch${String(n).padStart(2, "0")} held a durable PASS at bar ${opts.bar} but its content hash CHANGED (${before}→${after}) across the budget-repair round. A passing chapter was modified; refusing to advance a possibly-regressed PASS.`);
      }
    }
    ({ findings, nameBankWarn } = runBudgetsCapturingWarn(chapters, packets, lengthBudget));
    if (nameBankWarn) {
      return haltHere("infra", `${opts.label}: readerBudgets reported the name bank unavailable after repair: ${nameBankWarn}.`);
    }
    blockers = findings.filter((f) => f.severity === "blocker");
    // Re-partition with the SAME pass-lock set (locked chapters are byte-unchanged,
    // proven by the guard above, so they still hold their PASS): a book-wide band
    // now sustained purely by PASS-locked bytes downgrades identically → no halt.
    if (passLocked.size > 0 && blockers.length > 0) {
      blockers = partitionBudgetBlockers(chapters, blockers, isPassLocked).route;
    }
    if (blockers.length > 0) {
      const stillLines = blockers.map((f) => `  [${f.checkId}] ch${String(f.chapterNumber).padStart(2, "0")}: ${f.message}`);
      return haltHere("content", `${opts.label}: reader budgets STILL BLOCK after the one bounded repair round (${blockers.length} finding(s)):\n${stillLines.join("\n").slice(0, 3000)}`);
    }
    deps.log(`[autopilot] ${opts.label}: budget-repair round converged — blockers clear`);
  }
  // Red-team LEAK-2 (publish calibration): advisories must be LISTED, not
  // collapsed to a count — a 29%-over chapter is polish debt the operator
  // should see in the log even though it never halts.
  const advisories = findings.filter((f) => f.severity === "advisory");
  deps.log(`[autopilot] ${opts.label}: reader budgets clean (${advisories.length} advisory finding(s)) — advancing`);
  for (const f of advisories) deps.log(`[autopilot] ${opts.label}: advisory [${f.checkId}] ${f.message.slice(0, 220)}`);
  return null;
}
