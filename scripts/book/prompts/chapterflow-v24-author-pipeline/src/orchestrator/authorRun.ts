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

import { existsSync, readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import type { AutopilotDeps, AutopilotOutcome, HaltCategory, VerbResult } from "./autopilot.js";
import type { ChapterV21 } from "../types.js";
import type { ChapterBriefV1, SourcePacketV1 } from "../artifacts/artifactTypes.js";
import { chapterBriefMdPath, chapterBriefPath, readJsonFile, sourcePacketPath } from "../artifacts/artifactStore.js";
import { writerPacketProjection } from "../compiler/sourcePacketProjection.js";
import { DEFAULT_LENGTH_BUDGET_CHARS, LENGTH_BUDGET_TOLERANCE, briefVarietyInstructionLines } from "../compiler/chapterBrief.js";
import { voiceCard, voiceRegisterLine } from "../lib/voiceCard.js";
import { chapterFileName, normSlug, CHAPTERS_DIR } from "../lib/chapterPaths.js";
import { buildBudgetRepairComplaints, checkReaderBudgets, type BudgetFinding } from "../critics/readerBudgets.js";
import { loadNameBank } from "../librarian/namePlan.js";
import { loadBookChapters } from "../qc/manualKeyJudge.js";
import { chapterContentHash } from "../critics/qcAttestation.js";
import { loadAuthorProvenance, recordAuthorProvenance } from "../qc/sessionProvenance.js";
import { RegenLedgerError, migrateLegacyRegenCounts } from "./authorRegenLedger.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PIPELINE_DIR = resolve(__dirname, "../..");

/** Hard ceiling on the author card (the compiler pays ~160k chars/chapter across
 *  four section cards; the whole point of the author card is the ~18k diet). */
export const AUTHOR_CARD_MAX_CHARS = 25000;

/** Per authorWriteOneChapter call: the initial spawn + ONE retry with the gate
 *  blockers appended. (The review phase's regen budget is separate — see
 *  authorReview.ts AUTHOR_REGEN_CAP.) */
export const AUTHOR_WRITE_GATE_RETRIES = 1;

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
};

export function resolveAuthorIo(over?: Partial<AuthorIo>): AuthorIo {
  return {
    chapterExists: over?.chapterExists
      ?? ((bookId, n) => existsSync(resolve(CHAPTERS_DIR, chapterFileName(authorChapterId(bookId, n))))),
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
    loadChapters: over?.loadChapters ?? ((bookId) => loadBookChapters(bookId)),
    nameBankOk: over?.nameBankOk ?? (() => {
      try { return loadNameBank().length > 0; } catch { return false; }
    }),
    voiceCard: over?.voiceCard ?? ((bookId) => voiceCard(bookId)),
    authorSessionOf: over?.authorSessionOf ?? ((chapterId) => loadAuthorProvenance(chapterId)?.authorSessionId ?? undefined),
    recordProvenance: over?.recordProvenance
      ?? ((chapterId, sessionId, contentHash) => { recordAuthorProvenance(chapterId, sessionId, contentHash); }),
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
export const AUTHOR_HOUSE_RULES =
  "Plain verbs, short words, Flesch ease 72-84. Teach through this chapter's real cases as lived moments. " +
  "Honest about limits — say when the idea fails. No corporate filler, no template smell, no aphorism-stacking. " +
  "Every quiz key must be derivable from your prose alone; follow the brief's answer-key pattern exactly " +
  "(correctIndex per question, in order). Respect the brief's length budget — density beats coverage; cut " +
  "before padding. Never transcribe scaffold vocabulary (slot names, shape labels, anchor ids) into reader prose.";

/**
 * W1 (plan §WS5) QUALITY BAR — the write-time rules that the deterministic
 * preflight (W2) enforces after the fact. These live in the ALWAYS-SENT card, not
 * only the retry card: shipping them on the FIRST draft is what stops every draft
 * from paying a ~19-minute whole-chapter retry (first-draft preflight pass rate
 * was 40% — 10/10 first drafts failed tellRate). Each rule is stated as a concrete
 * write-time self-check, not an abstract goal, and is SYMMETRIC where a one-sided
 * fix would just mint the next detectable artifact (the longest-key tell v24 fixed
 * became a shortest-key tell).
 *
 * S-TIER CHANGE (2026-07-03, plan docs/v24/STIER-PLAN-2026-07-03.md): rule 1 gains
 * the mechanical length-audit protocol (the halted `execution` run still paid 5/9
 * first-draft tellRate rewrites — B7) and rule 5 (DISTRACTOR CRAFT) is new — 12.3%
 * of that run's distractors were tone-rejectable strawmen vs 0.5-4.8% in the top-5
 * corpus (B3).
 *
 * STIER-2 CHANGE (2026-07-03, plan docs/v24/STIER2-PLAN-2026-07-03.md): rule 1
 * loses its meta-parentheticals (prune ledger); rule 3 drops the "exact object to
 * touch" shape — that wording itself minted "touch X and say Y" theater across 6+
 * chapters (RC1); rule 5 becomes the TRANSFORM recipe (key-first, dealt failure
 * modes, echo symmetry) — the scan-only version just moved the wrongness
 * monoculture to the next lexicon (RC2; all 5 flip-tiebreaks led with quiz tells).
 *
 * STIER-2 LIVE FIX (2026-07-03, rerun round 1 — bottleneck B12): rule 1's original
 * "uniquely longest in at most 3" CONTRADICTED the binding gate. The score.py-ported
 * tellRate FAILS above 0.20 → at most ONE uniquely-longest key per 9 questions
 * (config/rubric-thresholds.json, calibration-frozen); W2's longestMax=9 is the
 * loose historical bound, and "at most 3" was an invented middle band that
 * satisfied neither — writers obeyed the card (2-3 longest keys) and the preflight
 * rejected them (ch01 twice, ch02, ch09 → write-phase halt). The card now states
 * the REAL constraint. Gates unchanged.
 * Verbatim; do not reword outside a documented plan change.
 */
export const AUTHOR_QUALITY_BAR =
  "QUALITY BAR — hit these on the FIRST draft (a deterministic preflight enforces them; missing any forces a full rewrite):\n" +
  "1. DISTRACTOR PARITY. Write every distractor as substantial as the key. The keyed answer must be NEITHER the longest NOR the shortest choice — aim for the middle length. Before you declare done: list the 9 keys' character lengths beside their distractors. HARD CONSTRAINTS (deterministic gates fail the chapter above EITHER): the key may be the uniquely LONGEST choice in AT MOST ONE of the 9 questions, AND the uniquely SHORTEST in AT MOST FOUR. Do not fix one tell by minting the other — never trim every key; land keys mid-length by growing a distractor past a long key and lengthening a too-short key.\n" +
  "2. KEY PARAPHRASE. The keyed answer must PARAPHRASE the idea in fresh words — never reuse 5 or more consecutive content words from anywhere in the chapter, INCLUDING the review cards and the implementation plan. If a key echoes a sentence you already wrote, reword the key.\n" +
  "3. PRACTICE CONCRETENESS. Each tryThisNow and each 24-hour challenge names ONE action with a number or a timebox, concrete enough to start within a minute. The action's FORM comes from your dealt practice shapes — never default to a touch-this-object or say-this-aloud ritual (the same staging in every chapter reads as theater). No \"a, b, or c\" option menus — one move, not a menu.\n" +
  "4. PLAIN LANGUAGE FROM SENTENCE ONE. Target whole-chapter Flesch ease 72-84: short sentences, common words, one idea per sentence. Open plain — no throat-clearing abstraction before the first concrete beat.\n" +
  "5. DISTRACTOR TRANSFORM. Write the KEY first, then TRANSFORM it: every wrong answer is the key warped by ONE of your brief's dealt failure modes — a smart half-reader would defend it out loud; a reader of YOUR prose can settle exactly why it fails. Never a generic bad practice; never rejectable without reading the chapter (unless the chapter explicitly teaches against that named move). KEY SUPPORT: every key must be defensible by pointing at a specific breakdown sentence that teaches it — a key the chapter never actually taught reads as arbitrary to the reader who did the work. ECHO SYMMETRY: if the key uses the chapter's signature vocabulary, at least two distractors must too — the key is never the only choice that sounds like the chapter. Every explanation names why one tempting wrong answer fails, in varied wording each time — NEVER a fixed stem like \"If you chose (b):\" (identical stems ×81 is its own template). A deterministic gate still counts mechanical-distractor words (polish/announce/slides/deck/briefing/morale/optics/louder/inspire/motivate) book-wide and blocks above 7% — build from your dealt failure modes and these never appear.\n" +
  "6. SURFACES THAT TRANSFER. Review cards drill the reusable TOOL, not source trivia — at most 2 cards may hinge on a named source case; every other card must be answerable by a reader applying the move in their own life. Practice prompts must be actions a person would actually do unprompted at a desk — if a prompt reads as a ritual or a meta-exercise (counting behaviors, scoring yourself), write the plain version instead: who owns it, what proof returns, when it comes back. Each example teaches a DIFFERENT facet or failure-mode of the move — if two examples teach the same lesson, merge them and spend the freed slot on a facet you have not shown.";

/**
 * S-tier P5 (plan §C, fixes B10) — the acceptance rubric's demands, stated to the
 * writer. The blinded reviewers score insight/limits/density/tone/quizzes against
 * RUBRIC.md definitions the writer otherwise never sees: the halted `execution`
 * run scored insight 66 / density 62 / tone 67 while every chapter individually
 * passed — writers were graded on rules they were never given. Compact on purpose
 * (rule-count dilution is real — B7); every line is checkable while writing.
 */
export const AUTHOR_PREMIUM_BLOCK =
  "WHAT PREMIUM MEANS — the independent reviewers score exactly these; hit them in the draft, not the retry:\n" +
  "- INSIGHT: the counterintuition must REVERSE a default the reader actually holds, not restate the thesis politely. Your dealt example arcs already assign the outcomes — write the failure/partial slots as REAL friction, not staged stumbles.\n" +
  "- LIMITS: say plainly when this chapter's move does NOT apply, what it costs, and when to do the opposite — one honest passage, living where your dealt LIMITS PLACEMENT puts it (not the same slot every chapter). Overselling is a scored defect.\n" +
  "- DENSITY: every paragraph adds NEW information. Never restate the previous paragraph in fresh words; never reuse a sentence across fastRead/deepRead/fullRead — each tier must ADD, not re-say.\n" +
  "- PLAIN WORDS: any compressed term this chapter coins (a 'return pass', a 'capability call') must be unpacked in plain words at first use — never dodge a vocabulary budget by minting jargon.\n" +
  "- READER AGENCY: teach the move so a reader with NO title power can run it today — at least one example or paragraph applies it to the reader's own promises, projects, or role choices, not only to people they manage.\n" +
  "- VOICE: this book's voice, not a house voice — four concrete moves: (1) in deepRead/fullRead, never let more than 2 consecutive paragraphs open on an abstraction; break runs with a person, scene, or object. (2) At least twice per tier, land a ≤6-word sentence beside a ≥25-word one — varied placement, not a ritual pair. (3) Ask 1-3 real rhetorical questions somewhere in the chapter. (4) Only the dealt +anchor example slots carry a physical/sensory detail — everywhere else, none.\n" +
  "- QUIZZES: a reader who skipped the chapter should score ~33%, not 60% — wrong answers must tempt someone who half-read. Explanations teach why the wrong answer fails, not only why the right one is right.";

/** Compact ChapterV21 schema hint — field names + types only, one line, the same
 *  style sectionTasks.ts uses for section artifacts. */
export function authorSchemaHint(bookId: string, chapterNumber: number): string {
  const chapterId = authorChapterId(bookId, chapterNumber);
  return `{"schemaVersion":"chapterflow-v21-authored","chapterId":"${chapterId}","number":${chapterNumber},"title":"...","readingTimeMinutes":7,"hook":"...(60-120 chars)","counterintuition":"...(1-2 sentences)","tryThisNow":"...(80-220 chars)","keyTakeaway":"...(140-220 chars)","breakdown":{"fastRead":"...(~400-700 chars)","deepRead":"...(~1200-1800 chars)","fullRead":"...(~2500-3500 chars)"},"examples":[{"exampleId":"ex01","title":"...","tags":["..."],"planSpec":{"domain":"...","audience":"...","stakes":"...","format":"...","requiredBeat":"..."},"scenario":"...(280-520 chars)","whatToDo":"...(120-240 chars)","whyItMatters":"...(120-240 chars)"}],"quiz":{"passingScorePercent":70,"questions":[{"questionId":"q01","prompt":"...","choices":["...","...","..."],"correctIndex":0,"explanation":"...(120-300 chars)","bloomsLevel":"apply","depthLevel":"standard"}]},"reviewCards":[{"cardId":"c01","front":"...(30-200 chars)","back":"...(80-400 chars)","difficulty":"medium"}],"implementationPlan":{"title":"...(4-7 words)","coreSkill":"...(2-4 sentences)","ifThenPlans":[{"context":"...","plan":"If X, then Y."}],"twentyFourHourChallenge":"...","weeklyPractice":"..."},"memorableLines":[{"text":"...(exact sentence from the chapter)","location":"breakdown.deepRead","why":"..."}]}`;
}

/** SELF-VERIFY block (4 checks; kept <= 1200 chars — pinned by test). */
export function authorSelfVerify(bookId: string, chapterNumber: number): string {
  const relPath = authorChapterRelPath(bookId, chapterNumber);
  return `SELF-VERIFY before declaring done — run ALL FOUR:
1. KEYS — derive every quiz answer from your own prose alone, blind; each derived answer must land on the stored correctIndex, and each explanation must argue for exactly that choice. Any mismatch: re-key or rewrite the question.
2. FACTS — confirm every claim, number, name, and case detail appears in the SOURCE PACKET above. Anything you cannot trace: delete or soften it. Never invent precision.
3. LENGTH — confirm the rendered chapter is inside the brief's length budget. Over budget: cut, never compress by jargon. Under: deepen a real case, never pad.
4. SCAFFOLD — scan every reader-facing field for scaffold vocabulary (slot names, shape labels, anchor ids, "Fact 2"-style numbering, internal " / " label seams). None may appear.
Then run: npx tsx src/cli.ts gate-chapter ${relPath} — 0 blockers required; fix and re-run until clean.`;
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
export const ROUND_TIMER_MINUTES = new Set([5, 10, 15, 20, 25, 30, 45, 60]);

/** STIER-2 M-lane (owner-directed): the author WRITE/REGEN sessions are pinned to an
 *  explicit model + reasoning effort instead of inheriting whatever the operator's
 *  ~/.codex/config.toml says that day. xhigh = the top codex tier — one level above
 *  the reviewers' pinned "high", thinking at maximum. HONESTY (plan §A RC5): the
 *  halted run's ambient default was very likely already xhigh, so NO content gain is
 *  booked to this pin — it buys provenance, reproducibility, and timeout headroom.
 *  Reviewers/readers/QC/research stay untouched (instrument stability). */
export const AUTHOR_WRITER_MODEL = process.env.CHAPTERFLOW_AUTHOR_MODEL ?? "gpt-5.5";
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
  const lead = brief?.leadThread;
  if (lead?.name) {
    const token = lead.kind === "invented"
      ? lead.name
      : (lead.name.split(/\s+/).find((w) => /^[A-Z][A-Za-z-]{3,}/.test(w) && !/^(The|This|That|When|What|From|Into|With)$/.test(w)) ?? "");
    if (token) {
      const hasToken = (text: string | undefined) => new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(text ?? "");
      if (!hasToken(chapter.breakdown?.fastRead)) {
        complaints.push(`lead thread: the dealt lead ${lead.kind === "invented" ? lead.name : `case "${lead.name}"`} never appears in the fastRead — the fastRead and at least 2 examples must carry this chapter's thread (dealt LEAD THREAD line).`);
      }
      const exampleHits = (chapter.examples ?? []).filter((ex) =>
        hasToken(typeof ex.scenario === "string" ? ex.scenario : undefined) || hasToken(ex.title) || hasToken(ex.whatToDo) || hasToken(ex.whyItMatters),
      ).length;
      if (exampleHits < 2) {
        complaints.push(`lead thread: the dealt lead (${token}) appears in ${exampleHits} example(s) — at least 2 examples must live on this thread; keep other cast in supporting roles.`);
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
};

/** Build the whole-chapter author card (target <= 25k chars; sections in the
 *  B4-specified order). Pure — all inputs are passed in. */
export function buildAuthorCard(args: AuthorCardArgs): string {
  const { bookId, chapterNumber, briefMd, packet, voice } = args;
  const nn = String(chapterNumber).padStart(2, "0");
  const relPath = authorChapterRelPath(bookId, chapterNumber);
  const sections: string[] = [];

  sections.push(
    "ROLE",
    `You are the AUTHOR of chapter ${nn} of ${bookId}. You own the whole chapter: hook, breakdown ` +
    "(fastRead ⊂ deepRead ⊂ fullRead), 4-6 examples, a 9-question quiz, review cards, implementation plan " +
    "(2-3 if-then plans + 24-hour challenge + weekly practice), memorable lines.",
  );

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

  sections.push(
    "",
    "SOURCE PACKET (writer projection)",
    "This is the ONLY allowed factual material. Every claim, number, name, and case detail must trace to it. Invent connective narration, not facts.",
    "Facts marked \"sharedSpine\" are the book's shared framework — EVERY chapter carries them. Reference them briefly through this chapter's own angle; never re-derive them at full length (nine chapters each re-teaching the spine is how a book becomes one stamped template). Your chapter's OWN core move is never spine-marked: teach it in full — the fast read alone must still leave the core idea.",
    JSON.stringify(writerPacketProjection(packet), null, 1),
  );

  if (args.complaints && args.complaints.length > 0) {
    sections.push(
      "",
      "PRIOR-ATTEMPT COMPLAINTS",
      "Your previous attempt failed independent review for the following specific reasons. Do not repeat them:",
      ...args.complaints.map((c) => `- ${c}`),
    );
  }

  sections.push(
    "",
    "OUTPUT",
    `Write EXACTLY one file: ${relPath}, a valid ChapterV21.`,
    "Schema hint (field names + types only):",
    authorSchemaHint(bookId, chapterNumber),
  );

  sections.push("", authorSelfVerify(bookId, chapterNumber));

  return sections.join("\n");
}

// ── One whole-chapter writer ──────────────────────────────────────────────────

export type AuthorWriteOneResult =
  | { ok: true; sessionId: string }
  | { ok: false; reason: string };

export type AuthorWriteOneOpts = {
  complaints?: string[];
  io?: Partial<AuthorIo>;
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
  const relPath = authorChapterRelPath(bookId, chapterNumber);

  const briefMd = io.readBriefMd(bookId, chapterNumber);
  if (!briefMd) return { ok: false, reason: `ch${nn}: no rendered brief (chNN.brief.md) — run compile-chapter-briefs first` };
  const packet = io.readPacket(bookId, chapterNumber);
  if (!packet) return { ok: false, reason: `ch${nn}: no source packet — run compile-source-packets first` };

  const machineBrief = io.readBrief(bookId, chapterNumber);
  const baseCard = buildAuthorCard({
    bookId,
    chapterNumber,
    briefMd,
    packet,
    voice: io.voiceCard(bookId),
    complaints: opts.complaints,
    brief: machineBrief,
  });
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
  for (let attempt = 1; attempt <= 1 + AUTHOR_WRITE_GATE_RETRIES; attempt++) {
    const label = attempt === 1 ? `author-ch${nn}` : `author-ch${nn}-retry${attempt - 1}`;
    const sessionId = deps.mkSessionId(label);
    deps.log(`[autopilot] author ch${nn}: whole-chapter writer working (attempt ${attempt}, card ${card.length} chars, ${AUTHOR_WRITER_MODEL} @ ${AUTHOR_WRITER_EFFORT}, timeout ${Math.round(AUTHOR_WRITE_TIMEOUT_MS / 60000)}min)`);
    // M-lane: pinned model/effort/timeout. The runner REJECTS on timeout (SIGKILL) —
    // catch it into the structured retry path; an unhandled throw here would escape
    // doAuthorWrite's halt taxonomy entirely (grill round-2b #12).
    let r: Awaited<ReturnType<typeof deps.spawn>>;
    try {
      r = await deps.spawn({
        task: card,
        sessionId,
        cwd: PIPELINE_DIR,
        sandbox: "workspace-write",
        model: AUTHOR_WRITER_MODEL,
        reasoningEffort: AUTHOR_WRITER_EFFORT,
        timeoutMs: AUTHOR_WRITE_TIMEOUT_MS,
      });
    } catch (err) {
      lastReason = `ch${nn}: writer session ${sessionId} died before completing (${(err as Error).message})`;
      deps.log(`[autopilot] author ch${nn}: ${lastReason}`);
      card = `${baseCard}\n\nPREVIOUS ATTEMPT DID NOT COMPLETE\nYour previous session was cut off before finishing. Write the complete chapter file this time.`;
      continue;
    }
    try { deps.logSession(bookId, label, r); } catch { /* best-effort */ }
    if (!r.ok) deps.log(`[autopilot] author ch${nn}: writer exited ${r.exitCode}`);

    if (!io.chapterExists(bookId, chapterNumber)) {
      lastReason = `ch${nn}: writer session ${sessionId} exited ${r.exitCode} without writing ${relPath}`;
      card = `${baseCard}\n\nPREVIOUS ATTEMPT WROTE NO FILE\nYour previous session ended without creating ${relPath}. Write the complete chapter file this time.`;
      continue;
    }

    const gate = await deps.runVerb(["gate-chapter", relPath]);
    if (gate.code === 0) {
      if (priorHash) {
        let freshHash: string | undefined;
        try {
          const fresh = io.loadChapters(bookId).find((c) => c.number === chapterNumber);
          freshHash = fresh ? chapterContentHash(fresh) : undefined;
        } catch { /* fall through — unreadable counts as changed */ }
        if (freshHash && freshHash === priorHash) {
          // Fail immediately, no retry: the gate-retry budget exists for gate
          // blockers, not for a session that ignored explicit complaints. The
          // chapter stays failing and the caller's cap/halt logic reports it.
          const reason = `ch${nn}: regen session ${sessionId} left the chapter byte-identical — a failing chapter regenerated to the same bytes is still failing`;
          deps.log(`[autopilot] author ch${nn}: ${reason}`);
          return { ok: false, reason };
        }
      }
      // Rubric preflight for THIS chapter (Phase-3 live finding, 2026-07-02:
      // writers shipped gate-clean chapters with tell 0.778 / ease 66). The
      // deterministic reader-facing metrics (Flesch band, distractor tell,
      // transfer ratio, memorable lines) are as binding as the ship gate in
      // the author arch — a FAIL feeds the retry card like a gate blocker.
      const rubric = await deps.runVerb(["rubric-metrics", bookId]);
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
            const draft = io.loadChapters(bookId).find((c) => c.number === chapterNumber);
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
        card = `${baseCard}\n\nRUBRIC PREFLIGHT FAILURES FROM YOUR PREVIOUS ATTEMPT\nYour previous draft passed the structural gate but FAILED the deterministic reader-metrics preflight. Rewrite the chapter so ALL of these clear:\n${rubricBlock}${tellEvidence}\nHow to read it: ease must land in 72-84 (write plainer, shorter sentences); tell must be <= 0.2 (at most ONE of the 9 keys may be the uniquely longest choice — fix the listed questions); transfer must be >= 0.7 (most quiz questions test a NEW scenario, not recall); memClean >= 2 (short portable memorable lines); lenTell — the keyed answer must NOT be the uniquely shortest choice (nor uniquely longest); give each key a middle length; practice — tryThisNow or the 24-hour challenge must be imperative-led with a concrete number/timebox; echo (advisory) — paraphrase any key that reuses 5+ consecutive words from the chapter.`;
        continue;
      }
      // STIER-2 D7/D9 — the write-time contract (lead thread + timer sanity) runs with
      // the BRIEF in scope, same retry semantics as the rubric preflight. Deterministic,
      // evidence-first complaints (the proven repair pattern).
      let writtenChapter: ChapterV21 | undefined;
      try {
        writtenChapter = io.loadChapters(bookId).find((c) => c.number === chapterNumber);
      } catch { /* unreadable → skip the contract check; the gate already passed */ }
      if (writtenChapter) {
        const contract = authorWriteContractFindings(writtenChapter, machineBrief, packet);
        if (contract.length > 0) {
          lastReason = `ch${nn}: STIER-2 write contract FAIL — ${contract.join(" | ")}`;
          deps.log(`[autopilot] author ch${nn}: ${lastReason}`);
          card = `${baseCard}\n\nWRITE-CONTRACT FAILURES FROM YOUR PREVIOUS ATTEMPT\nYour previous draft passed the structural gate but broke the dealt write contract. Rewrite the chapter so ALL of these clear:\n${contract.map((c) => `- ${c}`).join("\n")}`;
          continue;
        }
      }
      // Success: bind author provenance to the authored content (create-once per
      // content; a conflict means a prior author of identical bytes stands).
      try {
        const chapter = writtenChapter ?? io.loadChapters(bookId).find((c) => c.number === chapterNumber);
        io.recordProvenance(chapterId, sessionId, chapter ? chapterContentHash(chapter) : undefined);
      } catch (err) {
        deps.log(`[autopilot] author ch${nn}: provenance unchanged (${(err as Error).message.split(".")[0]})`);
      }
      deps.log(`[autopilot] author ch${nn}: done (gate-chapter clean)`);
      return { ok: true, sessionId };
    }
    const report = reportOf(gate);
    lastReason = `ch${nn}: gate-chapter still blocks after attempt ${attempt}:\n${report.slice(0, 1500)}`;
    card = `${baseCard}\n\nGATE BLOCKERS FROM YOUR PREVIOUS ATTEMPT\nYour previous draft of ${relPath} failed the deterministic gate. Rewrite the chapter (regenerate — do not minimally patch) so every blocker below is cleared, then re-run gate-chapter until clean:\n${report.slice(0, 2000)}`;
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

  let { findings, nameBankWarn } = runBudgetsCapturingWarn(chapters, packets, lengthBudget);
  if (nameBankWarn) {
    return haltHere("infra", `${opts.label}: readerBudgets reported the name bank unavailable (CHB3 silently disabled): ${nameBankWarn}. Fix config/name-bank.json; refusing to skip the check.`);
  }
  let blockers = findings.filter((f) => f.severity === "blocker");
  if (blockers.length > 0) {
    // ONE bounded budget-repair round (live-added 2026-07-03: the first S-tier run
    // halted here with CHB10+CHB12 while the evidence for a targeted repair was
    // sitting in the findings). Each offending chapter gets ITS OWN measured
    // complaints (band-word counts, verbatim strawman hits) and rewrites under the
    // byte-identical guard; then the budgets re-run ONCE. Still blocking → the
    // same fail-closed halt as before. The block is never weakened — this only
    // spends bounded writers where the halt previously spent the operator.
    const allTargets = buildBudgetRepairComplaints(chapters, blockers);
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
    ({ findings, nameBankWarn } = runBudgetsCapturingWarn(chapters, packets, lengthBudget));
    if (nameBankWarn) {
      return haltHere("infra", `${opts.label}: readerBudgets reported the name bank unavailable after repair: ${nameBankWarn}.`);
    }
    blockers = findings.filter((f) => f.severity === "blocker");
    if (blockers.length > 0) {
      const stillLines = blockers.map((f) => `  [${f.checkId}] ch${String(f.chapterNumber).padStart(2, "0")}: ${f.message}`);
      return haltHere("content", `${opts.label}: reader budgets STILL BLOCK after the one bounded repair round (${blockers.length} finding(s)):\n${stillLines.join("\n").slice(0, 3000)}`);
    }
    deps.log(`[autopilot] ${opts.label}: budget-repair round converged — blockers clear`);
  }
  const advisories = findings.filter((f) => f.severity === "advisory").length;
  deps.log(`[autopilot] ${opts.label}: reader budgets clean (${advisories} advisory finding(s)) — advancing`);
  return null;
}
