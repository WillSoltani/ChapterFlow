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
import { checkReaderBudgets, type BudgetFinding } from "../critics/readerBudgets.js";
import { loadNameBank } from "../librarian/namePlan.js";
import { loadBookChapters } from "../qc/manualKeyJudge.js";
import { chapterContentHash } from "../critics/qcAttestation.js";
import { loadAuthorProvenance, recordAuthorProvenance } from "../qc/sessionProvenance.js";

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
 * corpus (B3). Verbatim; do not reword outside a documented plan change.
 */
export const AUTHOR_QUALITY_BAR =
  "QUALITY BAR — hit these on the FIRST draft (a deterministic preflight enforces them; missing any forces a full rewrite):\n" +
  "1. DISTRACTOR PARITY. Write every distractor as substantial as the key. The keyed answer must be NEITHER the longest NOR the shortest choice — aim for the middle length. (A right answer that is always the tersest choice is as much a tell as one that is always the wordiest; balance both directions across the 9 questions.) Before you declare done: list the 9 keys' character lengths beside their distractors; across the 9 questions the key should be uniquely shortest in about 2-4 and uniquely longest in at most 3 — outside those bands, rewrite the worst offenders (driving either count to zero just mints the opposite tell).\n" +
  "2. KEY PARAPHRASE. The keyed answer must PARAPHRASE the idea in fresh words — never reuse 5 or more consecutive content words from anywhere in the chapter, INCLUDING the review cards and the implementation plan. If a key echoes a sentence you already wrote, reword the key.\n" +
  "3. PRACTICE CONCRETENESS. Each tryThisNow and each 24-hour challenge names ONE action with a number or a timebox AND the exact sentence to say or the exact object to touch. No \"a, b, or c\" option menus — give the single concrete move, not a menu of categories.\n" +
  "4. PLAIN LANGUAGE FROM SENTENCE ONE. Target whole-chapter Flesch ease 72-84: short sentences, common words, one idea per sentence. Open plain — no throat-clearing abstraction before the first concrete beat.\n" +
  "5. DISTRACTOR CRAFT. Build wrong answers from the source packet's commonError material first — real misconceptions a competent practitioner would defend out loud. Every distractor must be wrong for a specific reason YOUR prose settles, and each explanation must name why the most tempting wrong answer fails — in your own varied words each time; NEVER a fixed stem like \"If you chose (b):\" repeated across questions (162 identical stems is its own template). Never a tone giveaway: no distractor a reader could reject WITHOUT reading the chapter (polish the deck, announce it louder, wait and see, boost morale) — unless the chapter explicitly teaches against that named move.";

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
  "- INSIGHT: the counterintuition must REVERSE a default the reader actually holds, not restate the thesis politely. At least one example ends in failure or partial success — a chapter of frictionless wins reads as fiction and scores as one.\n" +
  "- LIMITS: say plainly when this chapter's move does NOT apply, what it costs, and when to do the opposite — one honest paragraph in the deep or full read. Overselling is a scored defect.\n" +
  "- DENSITY: every paragraph adds NEW information. Never restate the previous paragraph in fresh words; never reuse a sentence across fastRead/deepRead/fullRead — each tier must ADD, not re-say.\n" +
  "- TONE: this book's voice, not a house voice. If a sentence could sit unchanged in any business book, sharpen it until it could only belong to this one.\n" +
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

  sections.push("", "THE BRIEF", briefMd.trim());

  // v24 W4: the dealt variety reservations, rendered as EXPLICIT, non-negotiable writer
  // instructions (brief-derived — the md already carries them, this reinforces from the machine
  // brief so the card states them even if the md's VARIETY section is edited out downstream).
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

  const baseCard = buildAuthorCard({
    bookId,
    chapterNumber,
    briefMd,
    packet,
    voice: io.voiceCard(bookId),
    complaints: opts.complaints,
    brief: io.readBrief(bookId, chapterNumber),
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
    deps.log(`[autopilot] author ch${nn}: whole-chapter writer working (attempt ${attempt}, card ${card.length} chars)`);
    const r = await deps.spawn({
      task: card,
      sessionId,
      cwd: PIPELINE_DIR,
      sandbox: "workspace-write",
    });
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
        card = `${baseCard}\n\nRUBRIC PREFLIGHT FAILURES FROM YOUR PREVIOUS ATTEMPT\nYour previous draft passed the structural gate but FAILED the deterministic reader-metrics preflight. Rewrite the chapter so ALL of these clear:\n${rubricBlock}\nHow to read it: ease must land in 72-84 (write plainer, shorter sentences); tell must be <= 0.2 (the keyed answer must NOT be the longest/most-hedged choice — balance distractor lengths); transfer must be >= 0.7 (most quiz questions test a NEW scenario, not recall); memClean >= 2 (short portable memorable lines); lenTell — the keyed answer must NOT be the uniquely shortest choice (nor uniquely longest); give each key a middle length; practice — tryThisNow or the 24-hour challenge must be imperative-led with a concrete number/timebox; echo (advisory) — paraphrase any key that reuses 5+ consecutive words from the chapter.`;
        continue;
      }
      // Success: bind author provenance to the authored content (create-once per
      // content; a conflict means a prior author of identical bytes stands).
      try {
        const chapter = io.loadChapters(bookId).find((c) => c.number === chapterNumber);
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

  // ── Reader budgets: a BLOCKING author-arch step (write-time defects the
  //    writer must not ship). Fail-closed on the CHB3 name-bank infra condition.
  if (!io.nameBankOk()) {
    return halt(bookId, "infra", "author write: config/name-bank.json is missing/corrupt/empty — readerBudgets would silently no-op CHB3 (cast disjointness). Fix the name bank; refusing to skip the check.");
  }
  let chapters: ChapterV21[];
  try {
    chapters = io.loadChapters(bookId);
  } catch (err) {
    return halt(bookId, "infra", `author write: could not load chapters for the reader-budget check: ${(err as Error).message}`);
  }
  const packets = new Map<number, SourcePacketV1>();
  for (const n of expected) {
    const packet = io.readPacket(bookId, n);
    if (packet) packets.set(n, packet);
  }
  const firstBrief = expected.map((n) => io.readBrief(bookId, n)).find((b) => b?.lengthBudget?.renderedChars);
  const lengthBudget = firstBrief?.lengthBudget ?? { renderedChars: DEFAULT_LENGTH_BUDGET_CHARS, tolerance: LENGTH_BUDGET_TOLERANCE };

  const { findings, nameBankWarn } = runBudgetsCapturingWarn(chapters, packets, lengthBudget);
  if (nameBankWarn) {
    return halt(bookId, "infra", `author write: readerBudgets reported the name bank unavailable (CHB3 silently disabled): ${nameBankWarn}. Fix config/name-bank.json; refusing to skip the check.`);
  }
  const blockers = findings.filter((f) => f.severity === "blocker");
  if (blockers.length > 0) {
    const lines = blockers.map((f) => `  [${f.checkId}] ch${String(f.chapterNumber).padStart(2, "0")}: ${f.message}`);
    return halt(bookId, "content", `author write: reader budgets BLOCK (${blockers.length} finding(s)) — these are write-time defects the writer must not ship:\n${lines.join("\n").slice(0, 3000)}`);
  }
  const advisories = findings.length - blockers.length;
  deps.log(`[autopilot] author write: reader budgets clean (${advisories} advisory finding(s)) — advancing to deterministic gates`);
  return null;
}
