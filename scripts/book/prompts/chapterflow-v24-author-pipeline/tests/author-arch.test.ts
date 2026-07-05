/**
 * B4 — the v24 AUTHOR architecture (whole-chapter writer + review/regeneration
 * conductor). Stubbed deps like tests/autopilot.test.ts (no live codex, no real
 * state writes — every side effect goes through injected AuthorIo/deps).
 *
 * Pins: the author phase ladder (write→gate→review→ready) with the
 * sweepConfirmed substitution ONLY in the author arch; card composition (brief
 * md verbatim + writer projection + schema hint + self-verify) and the <=25k
 * size on the golden fixture packet; complaints section only on regen; the
 * write retry ladder; regen cap (2 write attempts) then a content halt; reader
 * budgets blocking; the name-bank infra halt; acceptance writing the exact
 * records the promote gate reads; acceptance rejection driving a <=3-chapter
 * targeted regen then halting; and compiler/legacy defaults unchanged.
 */
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { test } from "./harness.js";
import {
  architectureFromFlags,
  decidePhase,
  runAutopilot,
  type AutopilotDeps,
} from "../src/orchestrator/autopilot.js";
import {
  AUTHOR_CARD_MAX_CHARS,
  AUTHOR_HOUSE_RULES,
  AUTHOR_QUALITY_BAR,
  authorChapterRelPath,
  authorSchemaHint,
  authorSelfVerify,
  authorWriteOneChapter,
  buildAuthorCard,
  doAuthorWrite,
} from "../src/orchestrator/authorRun.js";
import {
  acceptanceRecordPath,
  acceptanceRoundSegment,
  complaintsOf,
  doAuthorReview,
  mapBookComplaintsToChapters,
  trueMedian,
  type AcceptanceWriters,
  type AuthorAcceptanceRecord,
  type AuthorReviewIo,
} from "../src/orchestrator/authorReview.js";
import { renderBriefMd } from "../src/compiler/chapterBrief.js";
import { reviewHistoryPath } from "../src/orchestrator/authorReviewLedger.js";
import { estimatedRenderedChars } from "../src/critics/readerBudgets.js";
import {
  chapterContentHash,
  isApprovedReviewer,
  isAttestationFresh,
  type QcAttestation,
} from "../src/critics/qcAttestation.js";
import {
  CHAPTER_BRIEF_SCHEMA_VERSION,
  REVIEW_FACTORS,
  type ChapterBriefV1,
  type SourcePacketV1,
} from "../src/artifacts/artifactTypes.js";
import type { ValidatedBarReadSubmission, ValidatedConfirmReadSubmission } from "../src/qc/orchestrator/schemas.js";
import type { ChapterV21 } from "../src/types.js";
import type { BookStatus, ChapterStatus } from "../src/lifecycle/bookStatus.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const GOLDEN_PACKET = JSON.parse(
  readFileSync(resolve(HERE, "fixtures", "fact-ranking-legacy-packet.json"), "utf8"),
) as SourcePacketV1;

// ── fixtures ─────────────────────────────────────────────────────────────────

function mkChapter(n: number, bookId = "zz"): ChapterV21 {
  const nn = String(n).padStart(2, "0");
  const one = n === 1;
  return {
    schemaVersion: "chapterflow-v21-authored",
    chapterId: `${bookId}-ch${nn}`,
    number: n,
    title: one ? "Fixture Chapter One Anchors" : "Fixture Chapter Two Momentum",
    readingTimeMinutes: 6,
    hook: `Hook line ${n}: a small change compounds into the whole result.`,
    counterintuition: `Counterintuition ${n}: the obvious fix points the wrong way here.`,
    tryThisNow: one
      ? "Write one sentence naming the next physical step you will take, then do only that."
      : "Close the single oldest open loop on your desk before you read anything else.",
    keyTakeaway: `Key takeaway ${n}: the mechanism you practice daily beats the plan you admire weekly, so keep the move concrete and small enough to repeat without willpower.`,
    breakdown: {
      fastRead: one
        ? "Fast read one: begin with the smallest visible action and repeat it until it stops needing a decision. The rule earns trust by being run, not by being explained."
        : "Fast read two: momentum comes from finishing one bounded thing before opening the next. A closed loop pays attention back; an open loop keeps charging interest.",
      deepRead: one
        ? "Deep read one: the anchor works because a fixed cue removes negotiation. When the cue fires, the action runs, and each run lowers the cost of the next one. That is the whole engine — friction falls with repetition, not with motivation."
        : "Deep read two: the finish-first rule works because unfinished work occupies working memory. Closing a loop releases that hold, so the next task starts cleaner. The gain is mechanical, not motivational, which is why it survives bad days.",
      fullRead: one
        ? "Full read one: run the anchor for two weeks before judging it. Expect the third day to feel pointless — that is the negotiation dying, not the method failing. The limit is real: an anchor cannot carry a task that needs an hour of setup, and it fails when the cue itself is rare."
        : "Full read two: apply the finish-first rule to the smallest open loop first, not the biggest. The limit is real: some loops should stay open because closing them early produces rework, and the rule fails on tasks whose finish line you cannot see from the start.",
    },
    examples: [
      {
        exampleId: "ex01",
        title: one ? "The Analyst Backlog" : "The Night Shift Chart",
        tags: ["work"],
        planSpec: { domain: "work", audience: "practitioner", stakes: "deadline", format: "scene", requiredBeat: "decision" },
        scenario: one
          ? "Monday morning a data analyst opens a backlog of forty tickets and freezes at the size of it, rereading the list instead of starting anywhere."
          : "A nurse ends a twelve-hour shift and still faces charting that piled up all afternoon, with handoff notes due in twenty minutes.",
        whatToDo: one
          ? "Pick the single oldest ticket and resolve only it before looking at the list again."
          : "Chart the one patient whose handoff happens first, completely, before touching any other record.",
        whyItMatters: one
          ? "Starting one bounded item converts a paralyzing list into a sequence of finishable moves."
          : "Finishing one record fully protects the handoff and releases the mental hold of the rest.",
      },
    ],
    quiz: {
      passingScorePercent: 70,
      questions: [
        {
          questionId: "q01",
          prompt: `Chapter ${n} Q1: which move does the chapter prescribe first?`,
          choices: one
            ? ["Resolve the single oldest ticket before rereading the list.", "Sort the full backlog by priority.", "Ask a teammate to split the list."]
            : ["Chart the first-handoff patient completely.", "Skim every chart to triage.", "Delay charting until after handoff."],
          correctIndex: 0,
          explanation: `The prose says to finish one bounded item first — that is chapter ${n}'s core move, and the other choices reopen the negotiation the rule exists to remove.`,
          bloomsLevel: "apply",
          depthLevel: "standard",
        },
        {
          questionId: "q02",
          prompt: `Chapter ${n} Q2: why does the mechanism survive low-motivation days?`,
          choices: one
            ? ["Because motivation compounds.", "Because a fixed cue removes negotiation, so friction falls with repetition.", "Because the list gets shorter."]
            : ["Because deadlines force focus.", "Because closing a loop releases working memory, a mechanical gain.", "Because charts are short."],
          correctIndex: 1,
          explanation: `The deep read grounds it: the gain is mechanical (cue/loop), not motivational, so it does not depend on how the day feels.`,
          bloomsLevel: "understand",
          depthLevel: "standard",
        },
      ],
    },
    reviewCards: [
      { cardId: "c01", front: `What is chapter ${n}'s core move?`, back: one ? "Run the smallest anchored action on its fixed cue until it needs no decision." : "Finish the first bounded loop completely before opening the next.", difficulty: "medium" },
    ],
    implementationPlan: {
      title: one ? "Anchor One Daily Action" : "Close One Loop First",
      coreSkill: one ? "Attach one small action to one fixed cue and run it without negotiation." : "Finish the single most time-bound item completely before starting anything else.",
      ifThenPlans: [
        { context: one ? "sitting down at your desk" : "ending a shift", plan: one ? "If I sit down at my desk, then I resolve the oldest open item before opening mail." : "If my shift ends, then I chart the first-handoff patient before any other record." },
      ],
      twentyFourHourChallenge: one
        ? "Before lunch tomorrow, resolve the single oldest item in your queue and note how long it actually took."
        : "Tonight after handoff, complete one full patient record first and mark the time you finished it.",
      weeklyPractice: one
        ? "Every Monday, run the anchor before email and tally whether it fired on its cue."
        : "Each Friday, count the loops you closed completely versus the ones you left open.",
    },
    memorableLines: [],
  } as ChapterV21;
}

const CH1 = mkChapter(1);
const CH2 = mkChapter(2);
const FIXTURE_CHAPTERS = [CH1, CH2];

function mkBrief(n: number, over: Partial<ChapterBriefV1> = {}): ChapterBriefV1 {
  const budget = Math.round((estimatedRenderedChars(CH1) + estimatedRenderedChars(CH2)) / 2);
  return {
    schemaVersion: CHAPTER_BRIEF_SCHEMA_VERSION,
    chapterId: `zz-ch${String(n).padStart(2, "0")}`,
    chapterNumber: n,
    title: `Fixture Chapter ${n}`,
    coreMove: "Anchor one small action to one fixed cue and run it without negotiation.",
    thesis: "Focused repetition on a fixed cue improves skill within two weeks.",
    readerPromise: "After this chapter, a reader can anchor one small action to one fixed cue.",
    ownedCases: [{ id: `ch${n}.case.1`, label: n === 1 ? "Ericsson violin study" : "Popsicle Hotline" }],
    notYours: n === 1 ? ["Popsicle Hotline", "Emerson Electric"] : ["Ericsson violin study"],
    cast: n === 1 ? ["Marisol", "Deshawn"] : ["Priya", "Tomas"],
    answerIndexPattern: [0, 1, 2, 0, 1, 2, 0, 1, 2],
    avoid: [],
    lengthBudget: { renderedChars: budget, tolerance: 0.2 },
    flavor: [],
    openerType: n === 1 ? "question" : "scene",
    challengeFrame: n === 1 ? "before-your-next-X" : "replace-one-Y",
    practiceShape: n === 1 ? "single-imperative" : "if-then-trigger",
    ...over,
  };
}

function reviewReply(ch: ChapterV21, over: { ship84?: boolean; score?: number; complaints?: Array<{ unit: string; problem: string; mustFix: boolean }>; quote?: string } = {}): string {
  const answers = ch.quiz.questions.map((q) => "abc"[q.correctIndex]);
  const scores = Object.fromEntries(REVIEW_FACTORS.map((f) => [f, over.score ?? 90]));
  const body = {
    quizDerivation: { answers, keyDisagreements: [], tells: [] },
    scores,
    ship84: over.ship84 ?? true,
    quotes: [{ quote: over.quote ?? ch.title, why: "the strongest concrete moment" }],
    complaints: over.complaints ?? [],
    oneParagraphVerdict: "reads as one authored chapter",
  };
  return "```json\n" + JSON.stringify(body) + "\n```";
}

function bookReply(chapters: ChapterV21[], over: { gate?: string; churn?: string; score?: number; verdictText?: string } = {}): string {
  const scores = Object.fromEntries(REVIEW_FACTORS.map((f) => [f, over.score ?? 90]));
  const quizDerivation = Object.fromEntries(
    chapters.map((ch) => [String(ch.number), { answers: ch.quiz.questions.map((q) => "abc"[q.correctIndex]), keyDisagreements: [] }]),
  );
  const body = {
    gate_verdict: over.gate ?? "PASS",
    book3_churn: over.churn ?? "LOW",
    quizDerivation,
    scores,
    quotes: [{ quote: chapters[0].title, why: "individually authored" }],
    oneParagraphVerdict: over.verdictText ?? "chapters feel individually authored",
  };
  return "```json\n" + JSON.stringify(body) + "\n```";
}

type SpawnRec = { sessionId: string; task: string; sandbox?: string };

/** Stub deps + a scripted spawn that answers per session-label. */
function mkDeps(
  spawnScript: (o: { sessionId: string; task: string }) => { ok?: boolean; finalMessage?: string },
  runVerbScript?: (args: string[]) => { code: number; stdout: string; stderr: string },
): { deps: AutopilotDeps; spawns: SpawnRec[]; verbs: string[][] } {
  const spawns: SpawnRec[] = [];
  const verbs: string[][] = [];
  let n = 0;
  const deps = {
    runVerb: async (args: string[]) => {
      verbs.push(args);
      return runVerbScript ? runVerbScript(args) : { code: 0, stdout: "", stderr: "" };
    },
    spawn: (async (o: { sessionId: string; task: string; sandbox?: string }) => {
      spawns.push({ sessionId: o.sessionId, task: o.task, sandbox: o.sandbox });
      const r = spawnScript(o);
      return { ok: r.ok ?? true, exitCode: (r.ok ?? true) ? 0 : 1, finalMessage: r.finalMessage ?? "done", stdout: r.finalMessage ?? "", stderr: "", durationMs: 1, sessionId: o.sessionId };
    }) as unknown as AutopilotDeps["spawn"],
    mkSessionId: (label: string) => `${label}#${++n}`,
    expectedChapterNumbers: () => [1, 2],
    logSession: () => {},
    log: () => {},
  } as unknown as AutopilotDeps;
  return { deps, spawns, verbs };
}

const TMP = mkdtempSync(join(tmpdir(), "author-arch-"));

function mkIo(over: Partial<AuthorReviewIo> = {}): Partial<AuthorReviewIo> & { attestations: QcAttestation[]; bars: ValidatedBarReadSubmission[]; confirms: ValidatedConfirmReadSubmission[]; acceptanceRecords: AuthorAcceptanceRecord[] } {
  const attestations: QcAttestation[] = [];
  const bars: ValidatedBarReadSubmission[] = [];
  const confirms: ValidatedConfirmReadSubmission[] = [];
  const acceptanceRecords: AuthorAcceptanceRecord[] = [];
  const regenLedger = new Map<number, number>(); // in-memory E2 regen-cap tracking, per io instance
  const acceptance: AcceptanceWriters = {
    openRound: () => ({ roundId: "r20260101000000-abcdef", tokens: {} }),
    writeBar: (s) => { bars.push(s); return "/tmp/bar.json"; },
    writeConfirm: (s) => { confirms.push(s); return "/tmp/confirm.json"; },
    writeAttestation: (a) => { attestations.push(a); return "/tmp/att.json"; },
  };
  const io: Partial<AuthorReviewIo> = {
    chapterExists: () => true,
    readBriefMd: (b, ch) => renderBriefMd(mkBrief(ch)),
    readBrief: (_b, ch) => mkBrief(ch),
    readPacket: () => GOLDEN_PACKET,
    loadChapters: () => FIXTURE_CHAPTERS,
    nameBankOk: () => true,
    voiceCard: () => "voice: warm, direct coaching register; second-person; medium cadence",
    authorSessionOf: () => undefined,
    recordProvenance: () => {},
    writeReviewDoc: (bookId, fileName, text) => {
      const abs = join(TMP, `${bookId}-${fileName}`);
      writeFileSync(abs, text, "utf8");
      return { absPath: abs, relPath: abs };
    },
    persistReview: () => "/tmp/review.json",
    persistAcceptance: (bookId, record) => { acceptanceRecords.push(record); return `/tmp/acceptance.${record.roundLabel || "round1"}.json`; },
    // Multi-read pool (F1/F3): mirror the in-memory persisted records with the
    // same quorum filter the real listAcceptanceReads applies, so cross-read and
    // cross-entry pooling is exercised without touching real state/.
    listAcceptanceReads: (_b, docSha256) =>
      acceptanceRecords.filter(
        (r) => r.docSha256 === docSha256
          && (r.verdict?.validCount ?? 0) >= 3
          && typeof r.verdict?.medianComposite === "number",
      ),
    acceptance,
    // B5 publish evidence is stubbed OK in these unit tests (its real
    // implementations are pinned by tests/author-evidence.test.ts against
    // fixture state + the real promote predicates).
    evidence: {
      runKeyJudge: async () => ({ ok: true as const }),
      runSweep: async () => ({ ok: true as const }),
    },
    // AUTO control-read stubbed: honor the env override exactly as the real
    // resolver does (env-first), else bar-80-only (no shipped package / no git in
    // these unit tests). This keeps the beat-shipped-when-set contract testable
    // without shelling out to git or spawning a control reader.
    resolveBeatShipped: async () => {
      const raw = process.env.CHAPTERFLOW_BEAT_SHIPPED_COMPOSITE;
      if (raw !== undefined && raw !== "") {
        const n = Number(raw);
        return { ok: true as const, composite: Number.isFinite(n) ? n : null, source: "env" as const };
      }
      return { ok: true as const, composite: null, source: "none" as const };
    },
    // E2 regen-cap: in-memory per-io so a test's GLOBAL cap is exercised WITHOUT
    // leaking a durable ledger into real state/ (and without one test's ledger
    // contaminating the next's — the fixture book id is shared).
    regenConsumedFor: (_b, n) => regenLedger.get(n) ?? 0,
    recordRegenConsumed: (_b, n) => { regenLedger.set(n, (regenLedger.get(n) ?? 0) + 1); },
    ...over,
  };
  return Object.assign(io, { attestations, bars, confirms, acceptanceRecords });
}

/** The default spawn script: writers succeed, chapter readers pass, book readers accept. */
function happyScript(o: { sessionId: string }): { finalMessage?: string } {
  if (o.sessionId.includes("author-book-reader")) return { finalMessage: bookReply(FIXTURE_CHAPTERS) };
  const m = o.sessionId.match(/author-review-ch0*(\d+)/);
  if (m) return { finalMessage: reviewReply(Number(m[1]) === 1 ? CH1 : CH2) };
  return {}; // whole-chapter writer: no output needed
}

// ── flags + phase pins (compiler/legacy unchanged) ───────────────────────────

test("architectureFromFlags: --author maps to author; --legacy keeps legacy; default stays compiler", () => {
  assert.equal(architectureFromFlags({ author: true }), "author");
  assert.equal(architectureFromFlags({ legacy: true }), "legacy");
  assert.equal(architectureFromFlags({ "legacy-whole-chapter-writer": true }), "legacy");
  assert.equal(architectureFromFlags({}), "compiler");
  // --legacy wins over --author when both are passed (legacy is checked first, unchanged).
  assert.equal(architectureFromFlags({ legacy: true, author: true }), "legacy");
});

test("decidePhase is byte-unchanged for compiler/legacy callers (same assertions as the autopilot suite)", () => {
  const mk = (o: Partial<BookStatus>): BookStatus => ({
    bookId: "zz", stage: "write-chapter", phase: "", expectedChapters: 2,
    writtenChapters: 0, gatedChapters: 0, qcdChapters: 0, bookGatePass: null,
    bookGateBlockers: 0, deterministicClean: true, packaged: false, publishable: false, guardrails: false,
    variety: null, nextCommand: "", nextLabel: "", chapters: [] as ChapterStatus[], ...o,
  });
  assert.equal(decidePhase(mk({ writtenChapters: 2, expectedChapters: 2, gatedChapters: 2, bookGatePass: true, qcdChapters: 2 })), "ready");
  assert.equal(decidePhase(mk({ writtenChapters: 2, expectedChapters: 2, gatedChapters: 2, bookGatePass: true, qcdChapters: 2 }), false), "qc");
  assert.equal(decidePhase(mk({ writtenChapters: 1, expectedChapters: 2 })), "write");
  assert.equal(decidePhase(mk({ packaged: true })), "shipped");
});

// ── the card ─────────────────────────────────────────────────────────────────

test("author card: brief md verbatim + writer projection + schema hint + self-verify, <= 25k on the golden fixture packet", () => {
  const brief = mkBrief(3, { chapterId: "zz-fixture-fact-ranking-ch03", chapterNumber: 3, title: "Deliberate Practice" });
  const briefMd = renderBriefMd(brief);
  const card = buildAuthorCard({
    bookId: "zz-fixture-fact-ranking",
    chapterNumber: 3,
    briefMd,
    packet: GOLDEN_PACKET,
    voice: "voice: warm, direct coaching register; second-person; medium cadence",
  });
  assert.ok(card.includes(briefMd.trim()), "the rendered brief md is embedded verbatim");
  assert.ok(card.includes('"schemaVersion": "chapterflow-writer-packet-v1"'), "the SLIM writer projection is embedded (not the raw packet)");
  assert.ok(!card.includes("groundedNumbers"), "projection dropped the grounding inventories (card diet)");
  assert.ok(card.includes(authorSchemaHint("zz-fixture-fact-ranking", 3)), "compact ChapterV21 schema hint present");
  assert.ok(card.includes("SELF-VERIFY"), "self-verify block present");
  assert.ok(card.includes(AUTHOR_HOUSE_RULES), "house-style rules verbatim");
  assert.ok(card.includes("gate-chapter state/chapters/zz-fixture-fact-ranking-ch03.v21-native.chapter.json"), "gate command names the exact output file");
  assert.ok(!card.includes("PRIOR-ATTEMPT COMPLAINTS"), "no complaints section on a first attempt");
  assert.ok(card.length <= AUTHOR_CARD_MAX_CHARS, `card must be <= ${AUTHOR_CARD_MAX_CHARS} chars, got ${card.length}`);
  assert.ok(authorSelfVerify("zz-fixture-fact-ranking", 3).length <= 1200, "self-verify stays <= 1200 chars");
  console.log(`  [measure] author card on the golden fixture packet: ${card.length} chars`);
});

// ── W1: the QUALITY BAR travels in the ALWAYS-SENT card ────────────────────────
test("author card: W1 QUALITY BAR (all four house rules) rides the ALWAYS-SENT card, not just the retry", () => {
  const brief = mkBrief(3, { chapterId: "zz-fixture-fact-ranking-ch03", chapterNumber: 3, title: "Deliberate Practice" });
  const briefMd = renderBriefMd(brief);
  // FIRST-ATTEMPT card (no complaints): the four rules must already be present, so
  // a compliant first draft clears the W2 preflight without the ~19-min retry.
  const card = buildAuthorCard({ bookId: "zz-fixture-fact-ranking", chapterNumber: 3, briefMd, packet: GOLDEN_PACKET, voice: null });
  assert.ok(card.includes(AUTHOR_QUALITY_BAR), "the QUALITY BAR block is embedded verbatim on the first attempt");
  // Rule 1 — distractor parity states the REAL symmetric caps (FINAL-HARDENING-PLAN
  // 2026-07-04 D1/D5 rebase: the old "NEITHER longest NOR shortest / aim middle" text
  // contradicted the 1-longest/4-shortest gates and CHB8's 20% shortest floor).
  assert.match(card, /uniquely LONGEST choice in AT MOST ONE/i, "rule 1 states the longest cap");
  assert.match(card, /uniquely SHORTEST in AT MOST FOUR/i, "rule 1 states the shortest cap");
  assert.match(card, /up to 4 of 9.*never make shortest the rule/i, "rule 1 reconciles the CHB8 shortest floor");
  // Rule 2 — key paraphrase incl. review cards + implementation plan.
  assert.match(card, /never reuse 5 or more consecutive content words/i, "rule 2 key-paraphrase 5-word rule");
  assert.match(card, /review cards and the implementation plan/i, "rule 2 names review cards + implementation plan explicitly");
  // Rule 3 — practice concreteness, no option menus. STIER-2 rebase (documented,
  // plan §B P13): the old "exact object to touch" wording itself minted "touch X
  // and say Y" theater across 6+ chapters — the concrete FORM now comes from the
  // dealt practice shapes.
  assert.match(card, /number or a timebox, concrete enough to start within a minute/i, "rule 3 concreteness");
  assert.match(card, /never default to a touch-this-object or say-this-aloud ritual/i, "rule 3 de-theaters the staging");
  assert.match(card, /No "a, b, or c" option menus/i, "rule 3 bans option menus");
  // Rule 4 — plain language / ease band from sentence one.
  assert.match(card, /Flesch ease 72-84/i, "rule 4 names the ease band");
  // Rule 7 — example craft (Phase 5): the thin/manufactured-example write-time
  // standard that shifts C29 + the reader's slot-filler judgment left.
  assert.match(card, /EXAMPLE CRAFT/i, "rule 7 names the example-craft standard");
  assert.match(card, /DECISION and its COMPLETED CONSEQUENCE/i, "rule 7 demands the decision→consequence arc");
  assert.match(card, /FAILED example/i, "rule 7 states the thin-example reject condition");

  // Length budget: the WHOLE card stays <= 16,700 chars (W1 spec, bumped from
  // 16,000 for the Phase-5 example-craft rule). The variable parts (brief md +
  // packet projection) are represented by the golden fixture.
  assert.ok(card.length <= 16700, `W1 card length budget: card must be <= 16,700 chars, got ${card.length}`);
  console.log(`  [measure] W1 card with QUALITY BAR: ${card.length} chars (budget 16,700)`);
});

test("author card: renders the W4 brief-derived VARIETY instructions (opener / 24h-frame / practice) when the machine brief is passed", () => {
  const brief = mkBrief(1, { openerType: "question", challengeFrame: "timebox-N-minutes", practiceShape: "say-aloud-script" });
  const briefMd = renderBriefMd(brief);
  const card = buildAuthorCard({ bookId: "zz", chapterNumber: 1, briefMd, packet: GOLDEN_PACKET, voice: null, brief });
  // the explicit VARIETY block sourced from the machine brief.
  assert.ok(card.includes("VARIETY (dealt for this chapter"), "explicit VARIETY reinforcement block present");
  assert.ok(/Open the hook with a QUESTION/.test(card), "opener instruction rendered for the dealt openerType");
  assert.ok(/Frame it as timebox-N-minutes/.test(card), "24-hour challenge framing rendered");
  assert.ok(card.includes('Do NOT use the "In the next 24 hours," stem.'), "the stem ban is stated");
  assert.ok(/say-aloud script/.test(card), "practice-shape instruction rendered");
  // graceful degradation: no machine brief → no explicit block (the md still carries VARIETY).
  const noBrief = buildAuthorCard({ bookId: "zz", chapterNumber: 1, briefMd, packet: GOLDEN_PACKET, voice: null });
  assert.ok(!noBrief.includes("VARIETY (dealt for this chapter"), "no explicit reinforcement block without the machine brief");
});

test("author card: complaints section appears ONLY on regeneration, with the review's bullets", () => {
  const briefMd = renderBriefMd(mkBrief(1));
  const complaints = ["quiz Q2: the key contradicts the prose", "deep read: restates the fast read"];
  const card = buildAuthorCard({ bookId: "zz", chapterNumber: 1, briefMd, packet: GOLDEN_PACKET, voice: null, complaints });
  assert.ok(card.includes("PRIOR-ATTEMPT COMPLAINTS"), "complaints header present on regen");
  assert.ok(card.includes("Do not repeat them:"), "regeneration framing present");
  for (const c of complaints) assert.ok(card.includes(`- ${c}`), `complaint bullet present: ${c}`);
  const empty = buildAuthorCard({ bookId: "zz", chapterNumber: 1, briefMd, packet: GOLDEN_PACKET, voice: null, complaints: [] });
  assert.ok(!empty.includes("PRIOR-ATTEMPT COMPLAINTS"), "an EMPTY complaints list adds no section");
});

// ── authorWriteOneChapter ────────────────────────────────────────────────────

test("authorWriteOneChapter: spawns one workspace-write writer, verifies file + gate, records content-bound provenance", async () => {
  const { deps, spawns, verbs } = mkDeps(() => ({}));
  const provenance: Array<{ chapterId: string; sessionId: string; contentHash?: string }> = [];
  const io = mkIo({ recordProvenance: (chapterId, sessionId, contentHash) => { provenance.push({ chapterId, sessionId, contentHash }); } });
  const r = await authorWriteOneChapter("zz", 1, deps, { io });
  assert.ok(r.ok, "chapter authored");
  assert.equal(spawns.length, 1, "exactly one writer spawn");
  assert.equal(spawns[0].sandbox, "workspace-write");
  assert.ok(spawns[0].sessionId.startsWith("author-ch01"), "distinct labeled session id");
  assert.deepEqual(verbs[0], ["gate-chapter", authorChapterRelPath("zz", 1)], "gate-chapter verifies the exact chapter file");
  assert.equal(provenance.length, 1, "author provenance recorded once");
  assert.equal(provenance[0].chapterId, "zz-ch01");
  assert.equal(provenance[0].contentHash, chapterContentHash(CH1), "provenance bound to the authored content hash");
});

test("authorWriteOneChapter: ONE retry appends the gate blockers to the card, then succeeds", async () => {
  let gateCalls = 0;
  const { deps, spawns } = mkDeps(
    () => ({}),
    (args) => args[0] === "gate-chapter"
      ? (++gateCalls === 1 ? { code: 1, stdout: "[BLOCKER A12] ch01: lowercase sentence boundary", stderr: "" } : { code: 0, stdout: "PASS", stderr: "" })
      : { code: 0, stdout: "", stderr: "" },
  );
  const r = await authorWriteOneChapter("zz", 1, deps, { io: mkIo() });
  assert.ok(r.ok, "retry converged");
  assert.equal(spawns.length, 2, "initial + exactly one retry");
  assert.ok(spawns[1].task.includes("GATE BLOCKERS FROM YOUR PREVIOUS ATTEMPT"), "retry card carries the gate framing");
  assert.ok(spawns[1].task.includes("[BLOCKER A12]"), "retry card carries the verbatim blocker");
});

test("authorWriteOneChapter: a DIED writer spawn is logged (honest-accounting invariant — start-with-why gold-run bug)", async () => {
  // The cost-report honest-accounting invariant tripped on the gold run: a
  // timed-out ch04 writer spawn was minted (mkSessionId) but the throw skipped
  // the success-path logSession. The catch must now record a synthetic failed
  // session so no minted spawn goes unlogged.
  const logged: Array<{ label: string; ok: boolean }> = [];
  let spawnCall = 0;
  const { deps } = mkDeps(() => {
    if (++spawnCall === 1) throw new Error("timeout SIGKILL");
    return {};
  });
  deps.logSession = ((_b: string, label: string, r: { ok: boolean }) => { logged.push({ label, ok: r.ok }); }) as never;
  const r = await authorWriteOneChapter("zz", 1, deps, { io: mkIo() });
  assert.ok(r.ok, "recovers on the retry after the first spawn dies");
  assert.ok(logged.some((l) => l.label === "author-ch01" && l.ok === false), "the DIED initial spawn was logged as a failed session (no minted-but-unlogged id)");
  assert.ok(logged.some((l) => l.label === "author-ch01-retry1"), "the successful retry was logged too");
});

test("authorWriteOneChapter: fails after the retry budget when gate-chapter keeps blocking", async () => {
  const { deps, spawns } = mkDeps(
    () => ({}),
    (args) => args[0] === "gate-chapter" ? { code: 1, stdout: "[BLOCKER SEC105] ch01: source label leak", stderr: "" } : { code: 0, stdout: "", stderr: "" },
  );
  const r = await authorWriteOneChapter("zz", 1, deps, { io: mkIo() });
  assert.ok(!r.ok, "must fail closed");
  assert.equal(spawns.length, 2, "the budget is the initial spawn + ONE retry");
  if (!r.ok) assert.match(r.reason, /SEC105/, "the failure carries the gate report");
});

// ── doAuthorWrite ────────────────────────────────────────────────────────────

test("doAuthorWrite: runs the six compile/gate verbs in order and halts content on a gate block", async () => {
  const { deps, verbs } = mkDeps(() => ({}), (args) =>
    args[0] === "book-design-gate" ? { code: 1, stdout: "book-design-gate: BLOCK", stderr: "" } : { code: 0, stdout: "PASS", stderr: "" });
  const halt = await doAuthorWrite("zz", deps, { maxParallel: 2, io: mkIo() });
  assert.ok(halt && halt.status === "halt" && halt.category === "content", "exit 1 = content halt");
  assert.deepEqual(verbs.map((v) => v[0]), ["compile-source-packets", "source-packet-gate", "compile-book-design", "book-design-gate"], "verbs run in order, halting at the failing gate");
});

test("doAuthorWrite: a verb erroring (exit >= 2) halts infra, not content", async () => {
  const { deps } = mkDeps(() => ({}), (args) =>
    args[0] === "compile-chapter-briefs" ? { code: 2, stdout: "", stderr: "crash" } : { code: 0, stdout: "PASS", stderr: "" });
  const halt = await doAuthorWrite("zz", deps, { maxParallel: 2, io: mkIo() });
  assert.ok(halt && halt.status === "halt" && halt.category === "infra");
});

test("doAuthorWrite: spawns ONE whole-chapter writer per MISSING chapter only, then passes budgets", async () => {
  const written = new Set<number>([1]); // ch01 already on disk
  const { deps, spawns } = mkDeps((o) => {
    const m = o.sessionId.match(/^author-ch0*(\d+)/);
    if (m) written.add(Number(m[1]));
    return {};
  });
  const io = mkIo({ chapterExists: (_b, n) => written.has(n) });
  const halt = await doAuthorWrite("zz", deps, { maxParallel: 2, io });
  assert.equal(halt, null, "phase completes");
  const writers = spawns.filter((s) => s.sessionId.startsWith("author-ch"));
  assert.equal(writers.length, 1, "only the missing chapter is authored");
  assert.ok(writers[0].sessionId.startsWith("author-ch02"), "ch02 was the missing one");
});

test("doAuthorWrite: a reader-budget BLOCKER halts content, naming the findings", async () => {
  const { deps } = mkDeps(() => ({}));
  // A budget wildly above the fixtures' real size → every chapter is 'under' → CHB2 blockers.
  const io = mkIo({ readBrief: (_b, ch) => mkBrief(ch, { lengthBudget: { renderedChars: 30000, tolerance: 0.2 } }) });
  const halt = await doAuthorWrite("zz", deps, { maxParallel: 2, io });
  assert.ok(halt && halt.status === "halt" && halt.category === "content", "budget blockers are write-time content defects");
  // STIER-3 rebase (documented): CHB2 findings are now REPAIR-ROUTABLE — the
  // round runs first (these no-op writers fail it), and the halt names either
  // the failed round or the still-blocking check. Fail-closed either way.
  if (halt && halt.status === "halt") assert.match(halt.reason, /CHB2\.length_budget|budget-repair round failed/, "the halt names the failing check or the failed repair round");
});

test("doAuthorWrite: a missing/corrupt name bank halts INFRA (never a silent CHB3 skip)", async () => {
  const { deps } = mkDeps(() => ({}));
  const halt = await doAuthorWrite("zz", deps, { maxParallel: 2, io: mkIo({ nameBankOk: () => false }) });
  assert.ok(halt && halt.status === "halt" && halt.category === "infra", "name-bank unavailability is infra, not content");
  if (halt && halt.status === "halt") assert.match(halt.reason, /name-bank/, "the halt names the name bank");
});

// ── doAuthorReview ───────────────────────────────────────────────────────────

test("doAuthorReview: acceptance writes the exact records the promote gate reads (attestation + bar + confirm per chapter)", async () => {
  const { deps, spawns } = mkDeps(happyScript);
  const io = mkIo();
  const result = await doAuthorReview("zz", deps, { maxParallel: 2, io });
  assert.equal(result, null, "review phase completes (same null-on-success shape as doQcWithRepair)");

  const readerSpawns = spawns.filter((s) => s.sessionId.includes("author-review-ch"));
  assert.equal(readerSpawns.length, 2, "one blinded reader per chapter");
  assert.ok(readerSpawns.every((s) => s.sandbox === "read-only"), "readers are read-only");
  const bookSpawns = spawns.filter((s) => s.sessionId.includes("author-book-reader"));
  assert.equal(bookSpawns.length, 3, "THREE independent book readers (Q5)");

  assert.equal(io.attestations.length, 2, "one attestation per chapter");
  for (const ch of FIXTURE_CHAPTERS) {
    const att = io.attestations.find((a) => a.chapterNumber === ch.number)!;
    assert.equal(att.verdict, "PUBLISHABLE");
    assert.equal(att.hashVersion, "v2");
    assert.equal(att.contentHash, chapterContentHash(ch), "bound to the chapter's content hash");
    assert.ok(isAttestationFresh(att, ch), "fresh by the promote gate's own predicate");
    assert.ok(isApprovedReviewer(att.reviewer), "reviewer role passes the promote gate's allowlist");
    assert.equal(att.roundId, "r20260101000000-abcdef", "backed by the opened QC round");
    assert.equal(att.roundRole, "confirm", "the role finalize stamps for PUBLISHABLE");
    assert.ok(att.reviewerSessionId && att.reviewerSessionId.includes(`author-review-ch0${ch.number}`), "reviewer session id comes from the chapter's review artifact");

    const bar = io.bars.find((b) => b.chapterNumber === ch.number)!;
    assert.equal(bar.contentHash, chapterContentHash(ch), "bar artifact hash-matches (checkBarConfirmArtifactsForPublishable)");
    assert.equal(bar.chapterId, ch.chapterId);
    const confirm = io.confirms.find((c) => c.chapterNumber === ch.number)!;
    assert.equal(confirm.decision, "PUBLISHABLE", "confirm decision the promote gate requires");
    assert.equal(confirm.contentHash, chapterContentHash(ch));
  }
});

test("doAuthorReview: regeneration carries the review complaints; cap = original + ONE regen, then a content halt with the table", async () => {
  const complaints = [{ unit: "quiz Q2", problem: "the key contradicts the prose", mustFix: true }];
  const { deps, spawns } = mkDeps((o) => {
    const m = o.sessionId.match(/author-review-ch0*(\d+)/);
    if (m) return { finalMessage: reviewReply(Number(m[1]) === 1 ? CH1 : CH2, { ship84: false, score: 60, complaints }) };
    if (o.sessionId.includes("author-book-reader")) return { finalMessage: bookReply(FIXTURE_CHAPTERS) };
    return {};
  });
  const result = await doAuthorReview("zz", deps, { maxParallel: 2, io: mkIo() });
  assert.ok(result && result.status === "halt" && result.category === "content", "still-failing chapters halt content");
  if (result && result.status === "halt") {
    assert.match(result.reason, /still fail independent review after the regen cap/);
    assert.match(result.reason, /ch01/);
    // The stub writer leaves the chapter byte-identical, so the no-op regen
    // guard (verifier finding) reports it — the complaint text still reaches
    // the WRITER via the card, asserted below.
    assert.match(result.reason, /byte-identical/, "the halt table carries the no-op regen reason");
  }
  const regens = spawns.filter((s) => s.sessionId.startsWith("author-ch"));
  assert.equal(regens.length, 2, "exactly ONE regen per failing chapter (cap 2 total write attempts)");
  for (const regen of regens) {
    assert.ok(regen.task.includes("PRIOR-ATTEMPT COMPLAINTS"), "regen is regeneration-with-complaints, not blind patching");
    assert.ok(regen.task.includes("quiz Q2: the key contradicts the prose (must fix)"), "the reader's complaint reaches the writer");
  }
  assert.equal(spawns.filter((s) => s.sessionId.includes("author-book-reader")).length, 0, "book acceptance never runs while chapters fail");
});

test("doAuthorReview: acceptance rejection drives ONE targeted regen round (<= 3 chapters), re-runs acceptance ONCE, then halts content", async () => {
  let bookRounds = 0;
  let regenBumps = 0; // regen writers CHANGE bytes (else the no-op guard correctly fails them)
  const chaptersNow = () => FIXTURE_CHAPTERS.map((c) => (regenBumps > 0 && c.number === 1 ? { ...c, hook: `${c.hook} (regen ${regenBumps})` } : c));
  const { deps, spawns } = mkDeps((o) => {
    if (o.sessionId.startsWith("author-ch01")) regenBumps++;
    if (o.sessionId.includes("author-book-reader")) {
      if (o.sessionId.includes("-r2")) return { finalMessage: "no json here" }; // never parses twice — keep 2 readers/round
      bookRounds++;
      return { finalMessage: bookReply(chaptersNow(), { gate: "FAIL", verdictText: "chapter 1 quiz key is contradicted by its own prose" }) };
    }
    const m = o.sessionId.match(/author-review-ch0*(\d+)/);
    if (m) return { finalMessage: reviewReply(Number(m[1]) === 1 ? chaptersNow()[0] : CH2) };
    return {};
  });
  const result = await doAuthorReview("zz", deps, { maxParallel: 2, io: mkIo({ loadChapters: () => chaptersNow() }) });
  assert.ok(result && result.status === "halt" && result.category === "content", "a twice-rejected acceptance halts content");
  if (result && result.status === "halt") assert.match(result.reason, /still REJECTED after the one targeted regen round/);
  const regens = spawns.filter((s) => s.sessionId.startsWith("author-ch"));
  assert.ok(regens.length >= 1 && regens.length <= 3, `targeted regen round is capped at 3 chapters (got ${regens.length})`);
  assert.ok(regens.every((s) => s.sessionId.startsWith("author-ch01")), "the book complaint was mapped to ITS chapter (ch01)");
  assert.ok(regens[0].task.includes("book reader verdict"), "regen complaints come from the book readers");
  const acceptanceSpawns = spawns.filter((s) => s.sessionId.includes("author-book-reader") && !s.sessionId.includes("-r2"));
  assert.equal(acceptanceSpawns.length, 6, "exactly two acceptance rounds (3 readers each, Q5) — re-run ONCE");
});

test("mapBookComplaintsToChapters: chapter-specific lines route to their chapters; cap 3; generic rejections fall back to the sample", () => {
  const mk = (o: { disagreements?: string[]; verdict?: string }) => ({
    keyCheck: { matches: 0, of: 0, disagreements: o.disagreements ?? [] },
    oneParagraphVerdict: o.verdict ?? "",
    gateVerdict: "FAIL" as const,
    churn: "HIGH" as const,
  });
  const routed = mapBookComplaintsToChapters(
    [mk({ disagreements: ["ch3 Q1: derived a vs key b"], verdict: "chapter 7 feels stamped" })],
    [1, 3, 7, 9],
  );
  assert.deepEqual([...routed.keys()], [3, 7], "named chapters routed; unmentioned sampled chapters excluded");
  const capped = mapBookComplaintsToChapters(
    [mk({ verdict: "chapter 1, chapter 3, chapter 7 and chapter 9 all share one skeleton" })],
    [1, 3, 7, 9],
  );
  assert.equal(capped.size, 3, "capped at 3 chapters");
  assert.deepEqual([...capped.keys()], [1, 3, 7], "deterministic: lowest chapter numbers first");
  const fallback = mapBookComplaintsToChapters([mk({ verdict: "one template stamped twelve times" })], [2, 5, 8, 11]);
  assert.deepEqual([...fallback.keys()], [2, 5, 8], "no chapter named → first 3 sampled chapters");
  assert.ok([...fallback.values()].every((lines) => lines.some((l) => l.includes("one template stamped"))), "fallback carries the readers' verdicts as complaints");
});

test("complaintsOf: explicit complaints win; else quote whys + key disagreements; never empty", () => {
  const base = {
    schemaVersion: "chapterflow-review-v1", chapterId: "zz-ch01", chapterNumber: 1, contentHash: "x",
    reviewerSessionId: "s", scores: {} as never, composite: 70, ship84: false, pass: false, valid: true,
    keyCheck: { derived: [], matches: 1, of: 2, disagreements: ["Q2: reader=a key=b"] },
    quotes: [{ quote: "q", why: "the deep read restates the fast read", verified: true }],
    tells: [], complaints: [], oneParagraphVerdict: "",
  } as never;
  const fromFallback = complaintsOf(base);
  assert.ok(fromFallback.some((c) => c.includes("restates the fast read")));
  assert.ok(fromFallback.some((c) => c.includes("Q2: reader=a key=b")));
  const explicit = complaintsOf({ ...(base as object), complaints: [{ unit: "hook", problem: "generic", mustFix: false }] } as never);
  assert.deepEqual(explicit, ["hook: generic"]);
  const generic = complaintsOf({ ...(base as object), quotes: [], keyCheck: { derived: [], matches: 0, of: 0, disagreements: [] } } as never);
  assert.equal(generic.length, 1, "a bare refusal still produces one actionable line");
});

// ── the full author ladder through runAutopilot ──────────────────────────────

test("author arch ladder: write→gate→review→ready; sweepConfirmed is SUBSTITUTED by book acceptance (deps.sweepConfirmed never consulted)", async () => {
  const mkStatus = (o: Partial<BookStatus>): BookStatus => ({
    bookId: "zz", stage: "write-chapter", phase: "", expectedChapters: 2,
    writtenChapters: 0, gatedChapters: 0, qcdChapters: 0, bookGatePass: null,
    bookGateBlockers: 0, deterministicClean: true, packaged: false, publishable: false, guardrails: false,
    variety: null, nextCommand: "", nextLabel: "", chapters: [] as ChapterStatus[],
    ...o,
  });
  const ch = (n: number, qc: ChapterStatus["qcVerdict"] = "NONE", fresh = false): ChapterStatus =>
    ({ number: n, chapterId: `zz-ch0${n}`, written: true, shipGatePass: true, shipBlockers: 0, qcVerdict: qc, qcFresh: fresh });
  const statuses = [
    mkStatus({ writtenChapters: 0, expectedChapters: 2 }), // write
    mkStatus({ writtenChapters: 2, expectedChapters: 2, gatedChapters: 1, bookGatePass: false, chapters: [ch(1), ch(2)] }), // gate
    mkStatus({ writtenChapters: 2, expectedChapters: 2, gatedChapters: 2, bookGatePass: true, qcdChapters: 0, chapters: [ch(1), ch(2)] }), // qc → doAuthorReview
    mkStatus({ writtenChapters: 2, expectedChapters: 2, gatedChapters: 2, bookGatePass: true, qcdChapters: 2, publishable: true, chapters: [ch(1, "PUBLISHABLE", true), ch(2, "PUBLISHABLE", true)] }), // ready (iff substituted confirm)
  ];
  let si = 0;
  let sweepConfirmedCalls = 0;
  const logs: string[] = [];
  const written = new Set<number>();
  const { deps, spawns, verbs } = mkDeps((o) => {
    const w = o.sessionId.match(/^author-ch0*(\d+)/);
    if (w) written.add(Number(w[1]));
    return happyScript(o);
  });
  const io = mkIo({ chapterExists: (_b, n) => written.has(n) });
  const fullDeps: Partial<AutopilotDeps> = {
    ...deps,
    statusOf: () => statuses[Math.min(si++, statuses.length - 1)],
    sweepConfirmed: () => { sweepConfirmedCalls++; return false; }, // would BLOCK ready if consulted
    blockingMajors: () => [],
    bookRisk: () => ({ schemaVersion: "chapterflow-risk-score-v1", bookId: "zz", generatedAt: "", lane: "low", chapters: [], bookWideRisks: [] }) as never,
    acquireLock: () => ({ ok: true, release: () => {} }),
    latestRoundId: () => null,
    log: (m: string) => logs.push(m),
  };
  const outcome = await runAutopilot({ bookId: "zz", architecture: "author", deps: fullDeps, authorIo: io });

  assert.equal(outcome.status, "ready", "the ladder converges to ready WITHOUT deps.sweepConfirmed ever corroborating");
  assert.equal(sweepConfirmedCalls, 0, "author arch substitutes book acceptance at the decidePhase call site — deps.sweepConfirmed is never consulted");
  assert.ok(verbs.some((v) => v[0] === "compile-chapter-briefs"), "author write compiled chapter briefs");
  assert.ok(verbs.some((v) => v[0] === "chapter-brief-gate"), "author write gated the briefs");
  assert.ok(!verbs.some((v) => v[0] === "fanout"), "legacy write fanout never runs in the author arch");
  assert.ok(!verbs.some((v) => v[0] === "deal-section-tasks"), "compiler section dealing never runs in the author arch");
  assert.ok(logs.some((l) => l.includes("skipping legacy broad pre-QC scouts")), "gate ran with preQcScouts:false (the existing skip path)");
  assert.equal(spawns.filter((s) => s.sessionId.startsWith("author-ch")).length, 2, "one whole-chapter writer per chapter");
  assert.equal(spawns.filter((s) => s.sessionId.includes("author-book-reader")).length, 3, "three book readers confirmed (Q5)");
  assert.equal(io.attestations.length, 2, "acceptance wrote the promote-gate attestations");
  const ids = spawns.map((s) => s.sessionId);
  assert.equal(new Set(ids).size, ids.length, "every spawn gets a DISTINCT session id");
});

test("legacy arch still consults deps.sweepConfirmed (the substitution is author-only)", async () => {
  const mkStatus = (o: Partial<BookStatus>): BookStatus => ({
    bookId: "zz", stage: "write-chapter", phase: "", expectedChapters: 2,
    writtenChapters: 2, gatedChapters: 2, qcdChapters: 2, bookGatePass: true,
    bookGateBlockers: 0, deterministicClean: true, packaged: false, publishable: true, guardrails: false,
    variety: null, nextCommand: "", nextLabel: "",
    chapters: [
      { number: 1, chapterId: "zz-ch01", written: true, shipGatePass: true, shipBlockers: 0, qcVerdict: "PUBLISHABLE", qcFresh: true },
      { number: 2, chapterId: "zz-ch02", written: true, shipGatePass: true, shipBlockers: 0, qcVerdict: "PUBLISHABLE", qcFresh: true },
    ],
    ...o,
  });
  let sweepConfirmedCalls = 0;
  const { deps } = mkDeps(() => ({}));
  const outcome = await runAutopilot({
    bookId: "zz",
    architecture: "legacy",
    deps: {
      ...deps,
      statusOf: () => mkStatus({}),
      sweepConfirmed: () => { sweepConfirmedCalls++; return true; },
      acquireLock: () => ({ ok: true, release: () => {} }),
      latestRoundId: () => "r20260101000000-abcdef",
    },
  });
  assert.equal(outcome.status, "ready");
  assert.ok(sweepConfirmedCalls > 0, "legacy/compiler call sites still read deps.sweepConfirmed — byte-unchanged behavior");
});


// ── Reviewer fixes (verifier findings 2026-07-02): no-op regen, global cap, regex ──

test("authorWriteOneChapter: a regen that leaves the chapter byte-identical fails IMMEDIATELY (no retry burned)", async () => {
  const { deps, spawns } = mkDeps(() => ({}));
  const r = await authorWriteOneChapter("zz", 1, deps, { complaints: ["quiz Q2: key contradicted"], io: mkIo() });
  assert.ok(!r.ok, "byte-identical regen must fail");
  if (!r.ok) assert.match(r.reason, /byte-identical/);
  assert.equal(spawns.length, 1, "no retry for a lazy session — the gate-retry budget is for gate blockers");
});

test("authorWriteOneChapter: a regen that CHANGES the chapter succeeds normally", async () => {
  let bumped = 0;
  const chaptersNow = () => FIXTURE_CHAPTERS.map((c) => (bumped > 0 && c.number === 1 ? { ...c, hook: `${c.hook} (v2)` } : c));
  const { deps, spawns } = mkDeps((o) => {
    if (o.sessionId.startsWith("author-ch01")) bumped++;
    return {};
  });
  const r = await authorWriteOneChapter("zz", 1, deps, { complaints: ["quiz Q2: key contradicted"], io: mkIo({ loadChapters: () => chaptersNow() }) });
  assert.ok(r.ok, "changed bytes = a real regeneration");
  assert.equal(spawns.length, 1);
});

test("mapBookComplaintsToChapters: 'launch 3' does not route to chapter 3 (word-boundary regex)", () => {
  const mk = (verdict: string) => ({ keyCheck: { matches: 0, of: 0, disagreements: [] }, oneParagraphVerdict: verdict, gateVerdict: "FAIL" as const, churn: "HIGH" as const });
  const routed = mapBookComplaintsToChapters([mk("the launch 3 metaphor is fine but chapter 5 repeats itself")], [3, 5]);
  assert.ok(!routed.has(3), "'launch 3' must not be read as ch3");
  assert.ok(routed.has(5), "'chapter 5' routes normally");
});

test("doAuthorReview: AUTHOR_REGEN_CAP is GLOBAL — a chapter regened in the review round is skipped by the book round, halting when nothing is actionable", async () => {
  let regenBumps = 0;
  const chaptersNow = () => FIXTURE_CHAPTERS.map((c) => (regenBumps > 0 && c.number === 1 ? { ...c, hook: `${c.hook} (regen ${regenBumps})` } : c));
  let ch1Reviews = 0;
  const { deps, spawns } = mkDeps((o) => {
    if (o.sessionId.startsWith("author-ch01")) regenBumps++;
    if (o.sessionId.includes("author-book-reader")) {
      return { finalMessage: bookReply(chaptersNow(), { gate: "FAIL", verdictText: "chapter 1 quiz key is contradicted by its own prose" }) };
    }
    const m = o.sessionId.match(/author-review-ch0*(\d+)/);
    if (m) {
      if (Number(m[1]) === 1) {
        ch1Reviews++;
        // first review FAILS (drives the review-round regen), the re-review PASSES
        return { finalMessage: reviewReply(chaptersNow()[0], ch1Reviews === 1 ? { ship84: false, score: 60 } : {}) };
      }
      return { finalMessage: reviewReply(CH2) };
    }
    return {};
  });
  const result = await doAuthorReview("zz", deps, { maxParallel: 2, io: mkIo({ loadChapters: () => chaptersNow() }) });
  assert.ok(result && result.status === "halt" && result.category === "content", "nothing actionable => content halt");
  if (result && result.status === "halt") assert.match(result.reason, /already consumed its regen budget/);
  const regens = spawns.filter((sp) => sp.sessionId.startsWith("author-ch01"));
  assert.equal(regens.length, 1, "exactly ONE regen ever for ch01 — the book round must not grant a third attempt");
});

test("authorWriteOneChapter: a rubric-preflight FAIL feeds the retry card like a gate blocker (Phase-3 live finding)", async () => {
  let rubricCalls = 0;
  const { deps, spawns } = mkDeps(
    () => ({}),
    (args) => {
      if (args[0] === "rubric-metrics") {
        rubricCalls++;
        return {
          code: 1,
          stdout: rubricCalls === 1
            ? "  ch01: FAIL ease=66.4✗ fk=6.9~ tell=0.778✗ transfer=0.556✗ memClean=3 — FAIL: fleschEase, tellRate, transferRatio"
            : "  ch01: WARN ease=75.1 fk=5.7~ tell=0.111 transfer=0.778 memClean=3",
          stderr: "",
        };
      }
      return { code: 0, stdout: "PASS", stderr: "" };
    },
  );
  const r = await authorWriteOneChapter("zz", 1, deps, { io: mkIo() });
  assert.ok(r.ok, "retry converged after the rubric complaint");
  assert.equal(spawns.length, 2, "rubric FAIL consumed the single retry");
  assert.ok(spawns[1].task.includes("RUBRIC PREFLIGHT FAILURES"), "retry card carries the rubric framing");
  assert.ok(spawns[1].task.includes("tell=0.778"), "the verbatim metrics line reaches the writer");
  // B12 rebase (STIER-2, documented): the guidance now states the gate's REAL
  // constraint — at most one uniquely-longest key — instead of the vague
  // "balance distractor lengths" that let card-compliant drafts fail the gate.
  assert.ok(spawns[1].task.includes("at most ONE of the 9 keys may be the uniquely longest"), "the how-to-read guidance is attached");
});

test("authorWriteOneChapter: a W2 card-quality FAIL carries its `chNN fix:` repair line VERBATIM into the retry card", async () => {
  // Verifier fix (2026-07-03): the retry grep must capture the follow-on
  // `chNN fix:` lines formatRubricMetrics emits beneath the verdict line, or the
  // W2 length-tell / practice-floor repair instruction never reaches the writer.
  let rubricCalls = 0;
  const { deps, spawns } = mkDeps(
    () => ({}),
    (args) => {
      if (args[0] === "rubric-metrics") {
        rubricCalls++;
        return rubricCalls === 1
          ? {
              code: 1,
              // The real formatRubricMetrics block: a verdict line + an indented
              // `chNN fix:` reason line (length-tell shortest-side).
              stdout:
                "  ch01: FAIL ease=80 fk=5~ tell=0 transfer=1 memClean=3 echo=0 lenTell=5✗ practice=2 — FAIL: lengthTell\n" +
                "    ch01 fix: length-tell: key is the uniquely-SHORTEST choice in 5/9 questions (max 4) — lengthen keys / balance distractors",
              stderr: "",
            }
          : { code: 0, stdout: "  ch01: PASS ease=80 fk=5~ tell=0 transfer=1 memClean=3 echo=0 lenTell=2 practice=2", stderr: "" };
      }
      return { code: 0, stdout: "PASS", stderr: "" };
    },
  );
  const r = await authorWriteOneChapter("zz", 1, deps, { io: mkIo() });
  assert.ok(r.ok, "retry converged after the card-quality complaint");
  assert.equal(spawns.length, 2, "the length-tell FAIL consumed the single retry");
  assert.ok(spawns[1].task.includes("FAIL: lengthTell"), "the verdict line reaches the writer");
  assert.ok(
    spawns[1].task.includes("ch01 fix: length-tell: key is the uniquely-SHORTEST choice in 5/9"),
    "the concrete `chNN fix:` repair line is carried VERBATIM into the retry card",
  );
  // FINAL-HARDENING-PLAN 2026-07-04 D1 rebase: the retry guidance states the real
  // caps (4-shortest/1-longest) instead of the old zero-extremes overreach.
  assert.ok(spawns[1].task.includes("uniquely SHORTEST choice in at most 4 of 9"), "the how-to-read guidance decodes lenTell with the REAL caps");
  assert.ok(spawns[1].task.includes("do NOT purge every length extreme"), "the retry guidance carries the anti-pendulum instruction");
});

// ── Book-acceptance bar calibration (owner decision 2026-07-03) ───────────────

test("book acceptance: floor 74 + beat-shipped margin 5 decide; gate stays hard (publish calibration 2026-07-04)", async () => {
  const run = async (score: number, shipped?: string) => {
    if (shipped === undefined) delete process.env.CHAPTERFLOW_BEAT_SHIPPED_COMPOSITE;
    else process.env.CHAPTERFLOW_BEAT_SHIPPED_COMPOSITE = shipped;
    try {
      const { deps } = mkDeps((o) => {
        if (o.sessionId.includes("author-book-reader")) return { finalMessage: bookReply(FIXTURE_CHAPTERS, { score }) };
        const m = o.sessionId.match(/author-review-ch0*(\d+)/);
        if (m) return { finalMessage: reviewReply(Number(m[1]) === 1 ? CH1 : CH2) };
        return {};
      });
      return await doAuthorReview("zz", deps, { maxParallel: 2, io: mkIo() });
    } finally {
      delete process.env.CHAPTERFLOW_BEAT_SHIPPED_COMPOSITE;
    }
  };
  // Publish calibration rebase (2026-07-04, documented): ACCEPT = gate PASS +
  // composite >= FLOOR(74) + composite >= shipped + MARGIN(5). Bar-80 is the
  // premium telemetry target, not the ship gate.
  assert.equal(await run(81), null, "81 clears the floor → accepted");
  assert.equal(await run(75), null, "75 clears the floor 74 → accepted (the old bar-80 world rejected a 9x85+ book at 75)");
  const rejected = await run(73);
  assert.ok(rejected && rejected.status === "halt", "73 < floor 74 → rejected → regen round → halt in this stub");
  const belowShipped = await run(81, "82.5");
  assert.ok(belowShipped && belowShipped.status === "halt", "81 < shipped 82.5 + margin 5 → rejected despite clearing the floor");
  assert.equal(await run(88, "82.5"), null, "88 beats the shipped control by the real margin");
});

// ── Q7: complaint-targeting guard (invalid reader's complaints ignored) ───────

test("Q7 mapBookComplaintsToChapters harvests ONLY still-VALID readers' complaints", () => {
  const mk = (o: { verdict?: string; valid?: boolean }) => ({
    keyCheck: { matches: 0, of: 0, disagreements: [] as string[] },
    oneParagraphVerdict: o.verdict ?? "",
    gateVerdict: "FAIL" as const,
    churn: "HIGH" as const,
    valid: o.valid ?? true,
  });
  // An INVALID reader (disproven structural claim) names ch05; a VALID reader names ch07.
  const routed = mapBookComplaintsToChapters(
    [mk({ verdict: "the answer key omits chapter 5 Q9", valid: false }), mk({ verdict: "chapter 7 reads as generic template", valid: true })],
    [3, 5, 7, 9],
  );
  assert.deepEqual([...routed.keys()], [7], "the disproven reader's ch05 target is dropped; only the valid reader's ch07 survives");

  // ALL readers invalid → no targets at all (caller halts on nothing-actionable).
  const none = mapBookComplaintsToChapters([mk({ verdict: "the key omits chapter 5 Q9", valid: false })], [3, 5, 7, 9]);
  assert.equal(none.size, 0, "an all-invalid panel steers no regen");

  // Backward-compatible: readers WITHOUT a `valid` field are treated as valid.
  const legacy = mapBookComplaintsToChapters([{ keyCheck: { matches: 0, of: 0, disagreements: [] }, oneParagraphVerdict: "chapter 3 is stamped", gateVerdict: "FAIL" as const, churn: "HIGH" as const }], [3, 5]);
  assert.deepEqual([...legacy.keys()], [3]);
});

// ── Q4: valid-count quorum blocks a sub-quorum accept ─────────────────────────

test("Q4 a book is NEVER accepted below the valid-reader quorum (2 of 3 readers unparseable)", async () => {
  // Two of the three book readers never parse (even on the -r2 respawn) → only
  // ONE valid reader. Even with a clean PASS from that reader, quorum blocks it.
  const { deps, spawns } = mkDeps((o) => {
    if (o.sessionId.includes("author-book-reader")) {
      // reader 1 parses a PASS; readers 2 & 3 never parse (both attempts).
      if (o.sessionId.includes("author-book-reader-1")) return { finalMessage: bookReply(FIXTURE_CHAPTERS) };
      return { finalMessage: "no json here" };
    }
    const m = o.sessionId.match(/author-review-ch0*(\d+)/);
    if (m) return { finalMessage: reviewReply(Number(m[1]) === 1 ? CH1 : CH2) };
    return {};
  });
  const io = mkIo();
  const result = await doAuthorReview("zz", deps, { maxParallel: 3, io });
  assert.ok(result && result.status === "halt", "below quorum → not accepted (halts, never READY)");
  // The durable record proves validCount was below quorum for round1.
  const round1 = io.acceptanceRecords.find((r) => r.roundLabel === "");
  assert.ok(round1, "a round-1 acceptance record was written");
  assert.equal(round1!.verdict.validCount, 1, "only one reader was valid");
  assert.equal(round1!.accepted, false, "sub-quorum round is not accepted even though the lone reader PASSed");
  assert.ok(spawns.some((s) => s.sessionId.includes("author-book-reader-2")), "the panel still spawned all three readers");
});

// ── Q6: durable acceptance record with all required fields ────────────────────

test("Q6 acceptance writes a durable record: verdict, readers, bar, sampled, docSha256, timestamp", async () => {
  const { deps } = mkDeps(happyScript);
  const io = mkIo();
  const result = await doAuthorReview("zz", deps, { maxParallel: 3, io });
  assert.equal(result, null, "accepted (happy path)");
  assert.equal(io.acceptanceRecords.length, 1, "exactly one acceptance round recorded on the happy path");
  const rec = io.acceptanceRecords[0];
  assert.equal(rec.schemaVersion, "author-acceptance-v1");
  assert.equal(rec.bookId, "zz");
  assert.equal(rec.roundLabel, "", "round 1 has the empty label");
  assert.equal(rec.accepted, true);
  assert.equal(rec.bar, 80, "the calibrated acceptance bar is recorded");
  assert.equal(rec.beatShipped, null, "no beat-shipped floor set in this run");
  assert.deepEqual(rec.sampledChapters, FIXTURE_CHAPTERS.map((c) => c.number));
  assert.match(rec.docSha256, /^[0-9a-f]{64}$/, "sha256 of the exact docText readers scored");
  assert.match(rec.at, /^\d{4}-\d\d-\d\dT/, "ISO timestamp");
  assert.equal(rec.readers.length, 3, "all three adjudicated reader results captured");
  for (const r of rec.readers) {
    assert.ok("gateVerdict" in r && "churn" in r && "scores" in r && "keyCheck" in r && "quotesVerified" in r, "reader fields present");
    assert.ok(r.structuralScreen, "each reader carries its Q3 structural-screen record");
  }
  assert.ok(rec.verdict.medianComposite !== null, "composed verdict captured");
});

// ── Multi-read acceptance median (FINAL-HARDENING-PLAN 2026-07-04) ────────────

const bookReaderSpawns = (spawns: SpawnRec[]) => spawns.filter((s) => s.sessionId.includes("author-book-reader")).length;

test("multi-read: a CLEAR pass spends exactly one panel; a CLEAR fail spends exactly one panel", async () => {
  // 90 is far above the floor-74 boundary → no extra reads.
  const pass = mkDeps(happyScript);
  const passIo = mkIo();
  assert.equal(await doAuthorReview("zz", pass.deps, { maxParallel: 3, io: passIo }), null, "clear pass accepted");
  assert.equal(bookReaderSpawns(pass.spawns), 3, "ONE 3-reader panel — no multi-read on an obvious accept");
  assert.equal(passIo.acceptanceRecords.length, 1, "one durable read record");
  assert.equal(passIo.acceptanceRecords[0].pooled?.reads, 1);

  // 60 is far below → one panel, reject.
  const fail = mkDeps((o) => {
    if (o.sessionId.includes("author-book-reader")) return { finalMessage: bookReply(FIXTURE_CHAPTERS, { score: 60 }) };
    const m = o.sessionId.match(/author-review-ch0*(\d+)/);
    if (m) return { finalMessage: reviewReply(Number(m[1]) === 1 ? CH1 : CH2) };
    return {};
  });
  const failIo = mkIo();
  const rejected = await doAuthorReview("zz", fail.deps, { maxParallel: 3, io: failIo });
  assert.ok(rejected && rejected.status === "halt", "clear fail rejected");
  assert.equal(bookReaderSpawns(fail.spawns), 3, "ONE 3-reader panel — no multi-read on an obvious reject");
});

test("multi-read: a borderline composite triggers extra panels; the TRUE median of 3 decides at the cap", async () => {
  // Panel scores 76 → 71 → 74: the old upper-median-of-2 pooling would have
  // decided max(76,71)=76; the true median of all three is 74 (accept at floor).
  const panelScores = [76, 71, 74];
  let bookSpawnCount = 0;
  const { deps, spawns } = mkDeps((o) => {
    if (o.sessionId.includes("author-book-reader")) {
      const panelIdx = Math.min(Math.floor(bookSpawnCount / 3), panelScores.length - 1);
      bookSpawnCount++;
      return { finalMessage: bookReply(FIXTURE_CHAPTERS, { score: panelScores[panelIdx] }) };
    }
    const m = o.sessionId.match(/author-review-ch0*(\d+)/);
    if (m) return { finalMessage: reviewReply(Number(m[1]) === 1 ? CH1 : CH2) };
    return {};
  });
  const io = mkIo();
  assert.equal(await doAuthorReview("zz", deps, { maxParallel: 3, io }), null, "median 74 >= floor 74 → accepted");
  assert.equal(bookReaderSpawns(spawns), 9, "three panels spawned (borderline stayed inside the ±3.7 band)");
  assert.equal(io.acceptanceRecords.length, 3, "every panel read persisted append-only");
  const last = io.acceptanceRecords[2];
  assert.equal(last.pooled?.reads, 3);
  assert.equal(last.pooled?.composite, 74, "TRUE median of [71, 74, 76]");
  assert.equal(last.pooled?.capped, true, "per-doc panel cap reached");
  assert.equal(last.accepted, true, "the pooled decision rides the record deriveDurableAcceptance corroborates");
});

test("multi-read: trueMedian is the standard median (even count averages the middle pair — never max)", () => {
  assert.equal(trueMedian([72, 75]), 73.5, "the BREAK-2 exploit case: two reads pool to their mean, not their max");
  assert.equal(trueMedian([71, 74, 76]), 74);
  assert.equal(trueMedian([80]), 80);
  assert.equal(trueMedian([1, 2, 3, 100]), 2.5, "outlier-resistant on even counts");
});

test("multi-read: a gate FAIL sticks for the docSha — no further reads, and a re-entry on identical bytes spawns NOTHING", async () => {
  const script = (o: { sessionId: string }) => {
    if (o.sessionId.includes("author-book-reader")) return { finalMessage: bookReply(FIXTURE_CHAPTERS, { score: 76, gate: "FAIL" }) };
    const m = o.sessionId.match(/author-review-ch0*(\d+)/);
    if (m) return { finalMessage: reviewReply(Number(m[1]) === 1 ? CH1 : CH2) };
    return {};
  };
  const io = mkIo();
  const entry1 = mkDeps(script);
  const r1 = await doAuthorReview("zz", entry1.deps, { maxParallel: 3, io });
  assert.ok(r1 && r1.status === "halt", "gate FAIL rejects despite composite 76 >= floor");
  assert.equal(bookReaderSpawns(entry1.spawns), 3, "76 is within the band of 74, but a stuck gate FAIL makes more reads pointless — one panel only");
  // Re-entry on the SAME bytes: the durable FAIL read is reused; zero panels spawn.
  const entry2 = mkDeps(script);
  const r2 = await doAuthorReview("zz", entry2.deps, { maxParallel: 3, io });
  assert.ok(r2 && r2.status === "halt", "still rejected");
  assert.equal(bookReaderSpawns(entry2.spawns), 0, "gate-FAIL stickiness survives re-entry (the old per-label overwrite decayed after one)");
});

test("multi-read: at the per-doc cap the decision FREEZES — a later entry on identical bytes reuses it without spawning", async () => {
  const script = (o: { sessionId: string }) => {
    if (o.sessionId.includes("author-book-reader")) return { finalMessage: bookReply(FIXTURE_CHAPTERS, { score: 75 }) };
    const m = o.sessionId.match(/author-review-ch0*(\d+)/);
    if (m) return { finalMessage: reviewReply(Number(m[1]) === 1 ? CH1 : CH2) };
    return {};
  };
  const io = mkIo();
  const entry1 = mkDeps(script);
  assert.equal(await doAuthorReview("zz", entry1.deps, { maxParallel: 3, io }), null, "borderline 75 accepted on the pooled median");
  assert.equal(bookReaderSpawns(entry1.spawns), 9, "cap of 3 panels consumed inside entry 1");
  const entry2 = mkDeps(script);
  assert.equal(await doAuthorReview("zz", entry2.deps, { maxParallel: 3, io }), null, "frozen pooled ACCEPT reused");
  assert.equal(bookReaderSpawns(entry2.spawns), 0, "no panel re-roll after the cap — the ±3.7 casino is closed");
  assert.equal(io.acceptanceRecords.length, 3, "no new records after the cap either");
});

test("multi-read: CHAPTERFLOW_PANEL_NOISE_BAND is fail-closed on garbage and honored at 0", async () => {
  process.env.CHAPTERFLOW_PANEL_NOISE_BAND = "abc";
  try {
    const { deps } = mkDeps(happyScript);
    const r = await doAuthorReview("zz", deps, { maxParallel: 3, io: mkIo() });
    assert.ok(r && r.status === "halt" && r.category === "infra", "set-but-invalid band halts infra (BREAK-1 lesson)");
    assert.match(r.reason, /CHAPTERFLOW_PANEL_NOISE_BAND/);
  } finally {
    delete process.env.CHAPTERFLOW_PANEL_NOISE_BAND;
  }
  // Band 0: even a knife-edge 75 is "clear" — exactly one panel.
  process.env.CHAPTERFLOW_PANEL_NOISE_BAND = "0";
  try {
    const { deps, spawns } = mkDeps((o) => {
      if (o.sessionId.includes("author-book-reader")) return { finalMessage: bookReply(FIXTURE_CHAPTERS, { score: 75 }) };
      const m = o.sessionId.match(/author-review-ch0*(\d+)/);
      if (m) return { finalMessage: reviewReply(Number(m[1]) === 1 ? CH1 : CH2) };
      return {};
    });
    assert.equal(await doAuthorReview("zz", deps, { maxParallel: 3, io: mkIo() }), null);
    assert.equal(bookReaderSpawns(spawns), 3, "band 0 disables the multi-read trigger");
  } finally {
    delete process.env.CHAPTERFLOW_PANEL_NOISE_BAND;
  }
});

test("multi-read: a quorum-met read whose durable record cannot be persisted FAILS CLOSED (cap can't be laundered)", async () => {
  // red-team #1: the per-doc cap survives re-entry ONLY through durable records;
  // without them the next entry re-seeds totalReads=0 and re-rolls the panel.
  const io = mkIo({ persistAcceptance: () => { throw new Error("disk full"); } });
  const { deps } = mkDeps(happyScript);
  const r = await doAuthorReview("zz", deps, { maxParallel: 3, io });
  assert.ok(r && r.status === "halt" && r.category === "infra", "unpersistable quorum-met read → infra halt");
  assert.match(r.reason, /per-doc read cap cannot be enforced/);
});

test("F5: a dead-ended chapter (exact bytes already FAILed, regen+repair spent) halts BEFORE any reader spawns", async () => {
  const hash = chapterContentHash(CH1);
  const p = reviewHistoryPath("zz", 1, hash);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify({ chapterNumber: 1, contentHash: hash, valid: true, pass: false, composite: 81 }), "utf8");
  try {
    const { deps, spawns } = mkDeps(happyScript);
    const io = mkIo({
      regenConsumedFor: () => 1, // >= AUTHOR_REGEN_CAP - 1
      repairConsumedFor: () => 1,
      recordRepairConsumed: () => {},
    });
    const r = await doAuthorReview("zz", deps, { maxParallel: 3, io });
    assert.ok(r && r.status === "halt" && r.category === "content", "dead end halts as content");
    assert.match(r.reason, /DEAD-ENDED/);
    assert.equal(spawns.filter((s) => s.sessionId.includes("author-review-ch")).length, 0, "no chapter readers spawned");
    assert.equal(bookReaderSpawns(spawns), 0, "no acceptance panel spawned");
  } finally {
    rmSync(p, { force: true });
  }
});

test("Q6 acceptanceRoundSegment + path: '' → round1, '-round2' → round2, fs-safe", () => {
  assert.equal(acceptanceRoundSegment(""), "round1");
  assert.equal(acceptanceRoundSegment("-round2"), "round2");
  assert.equal(acceptanceRoundSegment("-weird/label"), "weird_label");
  const p = acceptanceRecordPath("zz", "-round2", "/tmp/state-root");
  assert.match(p, /reviews\/zz\/acceptance\.round2\.json$/);
});

// ── Q3 respawn in the live acceptance path ────────────────────────────────────

test("Q3 a disproven structural FAIL reader is respawned in the acceptance loop", async () => {
  // reader 3 gate-FAILs on attempt 1 with a byte-false 'key omits ch1 Q9' claim
  // over the sampled doc; the Q3 screen invalidates it → the loop respawns it
  // (attempt 2), which PASSes. All three end valid → quorum met, accepted.
  // NOTE: FIXTURE_CHAPTERS have fewer than 9 quiz Qs, so the claim's Q number
  // must exist in the sampled doc for a positive disproof — use the ch1 Q1 row.
  let r3attempts = 0;
  const { deps, spawns } = mkDeps((o) => {
    if (o.sessionId.includes("author-book-reader-3")) {
      r3attempts++;
      if (!o.sessionId.includes("-r2")) {
        // attempt 1: a FAIL whose ONLY defect is a disproven structural claim.
        return { finalMessage: bookReply(FIXTURE_CHAPTERS, { gate: "FAIL", verdictText: "The combined answer key omits chapter 1 Q1." }) };
      }
      return { finalMessage: bookReply(FIXTURE_CHAPTERS) }; // respawn passes
    }
    if (o.sessionId.includes("author-book-reader")) return { finalMessage: bookReply(FIXTURE_CHAPTERS) };
    const m = o.sessionId.match(/author-review-ch0*(\d+)/);
    if (m) return { finalMessage: reviewReply(Number(m[1]) === 1 ? CH1 : CH2) };
    return {};
  });
  const io = mkIo();
  const result = await doAuthorReview("zz", deps, { maxParallel: 3, io });
  assert.equal(result, null, "after the respawn the panel is 3-valid and accepts");
  assert.ok(r3attempts >= 2, "reader 3 was respawned exactly once after the Q3 invalidation");
  const round1 = io.acceptanceRecords.find((r) => r.roundLabel === "");
  assert.ok(round1 && round1.verdict.validCount === 3, "all three readers valid after the respawn");
  // The invalidated attempt-1 read left a structural-screen decision on record.
  const respawnSpawns = spawns.filter((s) => s.sessionId.includes("author-book-reader-3"));
  assert.ok(respawnSpawns.length >= 2, "a second reader-3 session was spawned");
});
