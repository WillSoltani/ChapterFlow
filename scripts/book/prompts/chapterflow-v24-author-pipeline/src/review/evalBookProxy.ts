/**
 * evalBookProxy — the `eval-book-proxy` CLI verb: a faithful replica of the
 * owner's book-score instrument (.claude/skills/book-score) with blinded codex
 * readers standing in for the human panel.
 *
 * Why this exists (Phase-0 judge iteration 1): the per-chapter eval-reader-proxy
 * calibrated at Spearman 0.30 against the owner's baseline — single-chapter
 * reads compress at the ceiling and cannot see book-level defects (churn,
 * cross-chapter sameness) that the owner's panel scores. The owner instrument:
 * score.py picks 4 md5-SEEDED chapters; each panel reader reads ALL of them and
 * emits the 10 factor scores at BOOK level + a PASS/FAIL correctness gate +
 * book3_churn; compose.py medians factors across readers and applies the same
 * weights. This module replicates that shape exactly:
 *   - selectSeededChapters: score.py's (md5(bookId) + i*2654435761) % N walk
 *   - one combined book-sample doc (per-chapter answer keys stripped, single
 *     combined key at the bottom so derive-first still works)
 *   - reader prompt embedding the RUBRIC.md factor definitions + tier bands
 *   - composeBookVerdict: compose.py's median/majority/mode math verbatim
 * Measurement instrument only — never touches autopilot/conductor code.
 */

import { existsSync, mkdirSync, readFileSync } from "fs";
import { createHash } from "crypto";
import { dirname, resolve } from "path";

import type { BookPackageV21, ChapterV21 } from "../types.js";
import { REVIEW_FACTORS, type ReviewFactor } from "../artifacts/artifactTypes.js";
import { REPO_ROOT, FORBIDDEN_STATE } from "../lib/chapterPaths.js";
import { writeFileAtomic, ensureTrailingNewline } from "../lib/atomicWrite.js";
import { spawnCodexAgent, codexAvailable } from "../orchestrator/codexAgent.js";
import { REVIEW_WEIGHTS, DocIntegrityError } from "./readerReview.js";
import { renderChapterReaderDoc } from "./renderReaderDoc.js";

export { DocIntegrityError } from "./readerReview.js";

const OUTER_CHECKOUT_ROOT = resolve(FORBIDDEN_STATE, "..");
const READER_CONCURRENCY = 4;

// ── Seeded sampling (score.py parity) ─────────────────────────────────────────

/** score.py's exact chapter selection: seed = md5(bookId) as a big integer,
 *  then walk (seed + i * 2654435761) % N collecting unique indices. BigInt
 *  arithmetic — the seed is a 128-bit number. Parity is test-pinned against
 *  values computed by the python original. */
export function selectSeededIdxs(bookId: string, chapterCount: number, n = 4): number[] {
  const seed = BigInt("0x" + createHash("md5").update(bookId).digest("hex"));
  // BigInt() constructor calls, not literals: the OUTER repo's tsconfig sweeps
  // this dir with a pre-ES2020 target where 123n is a syntax-level error.
  const step = BigInt("2654435761");
  const N = BigInt(Math.max(1, chapterCount));
  const idxs = new Set<number>();
  let i = BigInt(0);
  while (idxs.size < Math.min(n, chapterCount)) {
    idxs.add(Number((seed + i * step) % N));
    i += BigInt(1);
  }
  return [...idxs].sort((a, b) => a - b);
}

export function selectSeededChapters(bookId: string, chapters: ChapterV21[], n = 4): ChapterV21[] {
  return selectSeededIdxs(bookId, chapters.length, n).map((i) => chapters[i]);
}

// ── Combined book-sample document ─────────────────────────────────────────────

const ANSWER_KEY_HEADER = "## ANSWER KEY";

/** One blinded doc for the whole sampled set: each chapter rendered with the
 *  panel renderer but WITHOUT its own answer key; a single combined key at the
 *  very bottom preserves the derive-your-answers-first protocol. */
export function renderBookSampleDoc(chapters: ChapterV21[]): string {
  const parts: string[] = [];
  const keyLines: string[] = [];
  for (const ch of chapters) {
    const doc = renderChapterReaderDoc(ch);
    const cut = doc.indexOf(ANSWER_KEY_HEADER);
    const body = cut >= 0 ? doc.slice(0, cut).replace(/\s+$/, "") : doc;
    parts.push(`==== CHAPTER ${ch.number}: ${ch.title} ====`, "", body, "");
    (ch.quiz?.questions ?? []).forEach((q, i) => {
      keyLines.push(`CHAPTER ${ch.number} Q${i + 1}: ${"abc"[q.correctIndex] ?? "?"}`);
    });
  }
  parts.push(ANSWER_KEY_HEADER + " (for key-soundness checking — derive your own answers from the prose FIRST)");
  parts.push(...keyLines);
  // TRAILING NEWLINE (Q1 / S0b root-cause fix): the doc MUST end with "\n".
  // Without it `wc -l` under-counts the file (756 for a 757-line doc) and a
  // reader that chunks with `sed -n 'A,Bp'` off that count silently never sees
  // the final line — which is systematically this doc's LAST combined-key row
  // (`CHAPTER <n> Q<k>: <letter>`). That trap produced the false "ch05 Q9 is
  // missing from the key" acceptance FAIL in 3 of 4 POM rounds. The newline is
  // interior to no quote (readers quote content, not the terminal byte), so
  // quote byte-verification (`docText.includes(q.quote)`) is unaffected.
  return parts.join("\n") + "\n";
}

// ── Doc-structure recount (Q2 postcondition + Q3 structural-claim screen) ──────
//
// The single source of truth for the doc's line formats is renderBookSampleDoc
// above + renderChapterReaderDoc. These recounters are DERIVED from that render
// code, not guessed:
//   - a chapter section opens with `==== CHAPTER <n>: <title> ====`;
//   - inside it, a quiz question renders (renderReaderDoc.ts:37) as `Q<i>. <prompt>`
//     at the START of a line — matched by /^Q\d+\. /m;
//   - the combined key at the bottom renders one row per question (line 78) as
//     `CHAPTER <n> Q<i>: <letter>` — matched by /^CHAPTER <n> Q(\d+): [abc?]$/m.
// The recount reads the EXACT doc bytes readers receive, so a "key omits Q<k>"
// claim can be machine-checked against ground truth.

/** A line that opens a chapter section header in the book-sample doc. */
const CHAPTER_MARKER_RE = /^==== CHAPTER (\d+): /;

/** Question lines (`Q<i>. …`) inside a specific chapter's section of the doc.
 *  Bounded by that chapter's `==== CHAPTER n: … ====` marker and the next
 *  chapter marker (or the ANSWER KEY / end of doc). */
export function chapterQuestionLineIndexes(docText: string, chapterNumber: number): number[] {
  const lines = docText.split("\n");
  let inSection = false;
  const found: number[] = [];
  for (const line of lines) {
    const marker = line.match(CHAPTER_MARKER_RE);
    if (marker) { inSection = Number(marker[1]) === chapterNumber; continue; }
    if (line.startsWith(ANSWER_KEY_HEADER)) { inSection = false; continue; }
    if (!inSection) continue;
    const q = line.match(/^Q(\d+)\. /);
    if (q) found.push(Number(q[1]));
  }
  return found;
}

/** 1-indexed doc line numbers of the combined-key rows for a chapter
 *  (`CHAPTER <n> Q<i>: <letter>`), keyed by question number. */
export function chapterKeyRowLines(docText: string, chapterNumber: number): Map<number, number> {
  const lines = docText.split("\n");
  const rowRe = new RegExp(`^CHAPTER ${chapterNumber} Q(\\d+): [abc?]$`);
  const out = new Map<number, number>();
  lines.forEach((line, i) => {
    const m = line.match(rowRe);
    if (m) out.set(Number(m[1]), i + 1); // 1-indexed for human-legible line refs
  });
  return out;
}

/** Ground-truth recount for one chapter, straight off the doc bytes. */
export function recountChapterInDoc(docText: string, chapterNumber: number): { questionLines: number; keyRows: number; keyRowByQ: Map<number, number> } {
  const keyRowByQ = chapterKeyRowLines(docText, chapterNumber);
  return {
    questionLines: chapterQuestionLineIndexes(docText, chapterNumber).length,
    keyRows: keyRowByQ.size,
    keyRowByQ,
  };
}

/** Q2 — doc-integrity postcondition. Machine-assert over the EXACT doc bytes,
 *  before any reader spawns, that for every sampled chapter:
 *    question-line count === chapter.quiz.questions.length === key-row count,
 *  and that the doc ends with a trailing newline. On any mismatch this THROWS a
 *  precise, halt-worthy infra error — the caller must fail-closed (never spawn
 *  readers). This makes any later "the key omits chapter N Q<k>" reader claim
 *  provably a reader error (Q3), and catches a real render truncation that no
 *  reader panel would reliably notice. */
export function assertBookSampleDocIntegrity(docText: string, chapters: ChapterV21[]): void {
  const problems: string[] = [];
  if (!docText.endsWith("\n")) problems.push("doc does not end with a trailing newline (the wc-l/sed under-read trap — see renderBookSampleDoc)");
  for (const ch of chapters) {
    const expected = (ch.quiz?.questions ?? []).length;
    const { questionLines, keyRows } = recountChapterInDoc(docText, ch.number);
    if (questionLines !== expected) problems.push(`chapter ${ch.number}: ${questionLines} question line(s) in the doc vs ${expected} quiz question(s) in the chapter`);
    if (keyRows !== expected) problems.push(`chapter ${ch.number}: ${keyRows} combined-key row(s) in the doc vs ${expected} quiz question(s) in the chapter`);
  }
  if (problems.length > 0) {
    throw new DocIntegrityError(`book-sample doc integrity check FAILED — the rendered doc does not match the chapters, so no reader may score it:\n  ${problems.join("\n  ")}`);
  }
}

// ── Q3 — structural key-coverage claim screen ─────────────────────────────────
//
// A gate-FAIL reader sometimes asserts a MECHANICAL/structural defect —
// "chapter 5's Q9 is missing from the combined answer key" — that is provably
// false against the doc bytes (the POM incident: the row was the doc's last
// line, dropped by a chunked `sed` read off a wc-l miscount). Such a claim is
// a byte-checkable statement about the doc, so — exactly like quote fabrication
// — the machine cross-checks it. This screen ONLY fires on a POSITIVE byte-level
// disproof of a SPECIFICALLY NAMED chapter+question key row; fuzzy or
// unparseable claims are a strict NO-OP (never invalidate on regex guesswork).

/** A structural key-coverage claim family: "the answer key … omits/misses/
 *  stops/absent/unkeyed/does not include/lacks …". Kept deliberately narrow so
 *  a semantic gate reason (prose contradicts the key) never matches. */
const KEY_COVERAGE_CLAIM_RE = /(answer\s*key|the\s+key|combined\s+key|key\s+row)/i;
const OMISSION_VERB_RE = /(omit|miss|stops?\b|absent|unkey|does\s+not\s+(include|cover|list|contain)|lacks?|leaves?\s+\w+\s+unkeyed|no\s+(key|entry|row)\s+for)/i;
const CHAPTER_REF_RE = /\bch(?:apter)?\s*0*(\d+)\b/i;
const QUESTION_REF_RE = /\bq\s*0*(\d+)\b/i;

export type StructuralClaimDecision = {
  claim: string;
  chapter: number;
  q: number;
  verdict: "disproven" | "confirmed";
  keyRowLine?: number;
};

export type StructuralScreen = {
  claimsScanned: number;
  decisions: StructuralClaimDecision[];
  /** The disproof line that flipped this reader valid→false, when it did. */
  invalidatedBy?: string;
};

/** Extract the free-text rationale fields a structural claim can live in. */
function rationaleFields(parsed: ParsedBookReview): string[] {
  const out: string[] = [];
  if (parsed.oneParagraphVerdict) out.push(parsed.oneParagraphVerdict);
  for (const entry of Object.values(parsed.quizDerivation ?? {})) {
    for (const d of entry?.keyDisagreements ?? []) if (typeof d === "string") out.push(d);
  }
  for (const q of parsed.quotes ?? []) if (typeof q?.why === "string" && q.why.length > 0) out.push(q.why);
  return out;
}

/** Split a rationale field into candidate CLAIMS: sentence-ish fragments, so a
 *  chapter/question named in ONE sentence isn't spuriously paired with an
 *  omission verb from a different sentence. */
function claimFragments(text: string): string[] {
  return text.split(/(?<=[.!?;])\s+|\n+/).map((s) => s.trim()).filter((s) => s.length > 0);
}

/** Screen a gate-FAIL reader's structural key-coverage claims against the doc.
 *  Returns the screen record; on a positive byte-level disproof it sets a
 *  `.invalidatedBy` disproof line. Throws DocIntegrityError if the recount
 *  CONFIRMS a named key row is genuinely absent (machine truth, not a vote).
 *  A NO-OP (empty decisions, no invalidation) for PASS readers and for
 *  fuzzy/unparseable claims. `chapters` scopes recounts to the sampled set. */
export function screenStructuralClaims(
  parsed: ParsedBookReview,
  docText: string,
  chapters: ChapterV21[],
): StructuralScreen {
  const screen: StructuralScreen = { claimsScanned: 0, decisions: [] };
  if (parsed.gate_verdict !== "FAIL") return screen; // only a FAIL veto can be screened away
  const sampled = new Set(chapters.map((c) => c.number));
  for (const field of rationaleFields(parsed)) {
    for (const fragment of claimFragments(field)) {
      if (!KEY_COVERAGE_CLAIM_RE.test(fragment) || !OMISSION_VERB_RE.test(fragment)) continue;
      const chMatch = fragment.match(CHAPTER_REF_RE);
      const qMatch = fragment.match(QUESTION_REF_RE);
      if (!chMatch || !qMatch) continue; // fuzzy: no specific chapter+question → NO-OP
      const chapter = Number(chMatch[1]);
      const q = Number(qMatch[1]);
      if (!sampled.has(chapter)) continue; // a chapter not in this doc — cannot recount → NO-OP
      screen.claimsScanned += 1;
      const keyRowLine = chapterKeyRowLines(docText, chapter).get(q);
      if (keyRowLine !== undefined) {
        // POSITIVE DISPROOF: the specifically-named key row IS present in the doc.
        screen.decisions.push({ claim: fragment.slice(0, 200), chapter, q, verdict: "disproven", keyRowLine });
        if (!screen.invalidatedBy) screen.invalidatedBy = `structural claim disproven: ch${chapter} Q${q} key row present (doc line ${keyRowLine})`;
      } else {
        // The recount CONFIRMS the claim — machine truth. Never leave this to a
        // vote; halt(infra). (Unreachable once Q2 certifies the doc first.)
        screen.decisions.push({ claim: fragment.slice(0, 200), chapter, q, verdict: "confirmed" });
        throw new DocIntegrityError(`structural claim CONFIRMED by recount: ch${chapter} Q${q} key row genuinely absent from the book-sample doc — this is a real render defect, not a reader error; halting instead of voting. Claim: "${fragment.slice(0, 200)}"`);
      }
    }
  }
  return screen;
}

// ── Reader prompt (RUBRIC.md factor definitions, tier bands, gate + churn) ────

const FACTOR_RUBRIC = `- retention (weight 13, THE NORTH STAR): will the reader remember the idea a week later? Memorable lines are portable compact aphorisms (complete claims, not 16-23-word explanations); review-card backs answer their fronts in their own words; cards atomic; sticky framing, not forgettable restatement.
- quizzes (12): the keyed answer must not be guessable as the longest/most-hedged choice; most questions should test a NEW scenario, not bare recall; distractors are real misconceptions, not junk absolutes; answerable from the chapter alone; explanations teach WHY wrong answers are wrong.
- transfer (11): hands a reusable LENS (a way of seeing a class of situations), not a one-off tactic; framed as a principle; carries to work/health/money/relationships; mechanism over recipe.
- practical (11): if-then plans imperative and specific, naming the chapter's tool; the 24-hour challenge and weekly practice are concrete and realistic; behaviorally NATURAL (real things a person would do, not performative theater); doable tomorrow with no special setup; action, not exhortation.
- summaries (11): faithful and complete; fast ⊂ deep ⊂ full where each tier ADDS; tight, no padding; each tier self-contained; the fast read alone leaves the core idea; no sentences pasted across tiers.
- tone (10): matches THIS book's voice, not one interchangeable house voice; non-generic; warm without condescension; no aphorism-stacking; every term plain on first use.
- limits (9): teaches when the idea does NOT apply and its failure modes; no overselling; acknowledges exceptions/tradeoffs/when to do the opposite; claim strength matches evidence.
- insight (8): non-obvious — reverses a default rather than confirming priors; counterintuitions actually reverse; concrete named moments over hollow proxy characters; outcome variety (at least one failed/partial example, not all frictionless successes).
- density (8): every paragraph earns its place with NEW information; no restating the paragraph above; no padding to hit a length; the chapters could not be meaningfully shorter without loss.
- beginner (7): reads in the Flesch 72-84 band (plain, short sentences); ~zero undefined jargon; core examples are taught, not assumed; gentle on-ramp; the reader is not tracking a dense unintroduced cast.`;

export function buildBookReviewTask(docRelPath: string): string {
  return `BLINDED BOOK-SAMPLE REVIEW — you are one independent reader on a scoring panel. You do not know how this book was produced; judge only what is on the page.

A sample of chapters from one book of a book-learning product is at: ${docRelPath}
Read ONLY this file. Do not write any files. Chapters are separated by "==== CHAPTER N: title ====" lines; the combined ANSWER KEY for every chapter's quiz is at the very bottom.

PROCESS (strict order):
1. Read EVERY chapter in the sample, top to bottom. For each chapter, answer its quiz YOURSELF from the prose BEFORE looking at the combined ANSWER KEY at the bottom. Record your per-chapter answers and any disagreement with the key.
2. CORRECTNESS GATE (veto, not a score): gate_verdict is "FAIL" if you find any hard correctness failure — a keyed quiz answer the chapter's own prose contradicts or cannot support, corrupted/incoherent prose, facts that smell fabricated or unsupported by the material, or template-paste artifacts (scaffold text leaking into reader prose). Otherwise "PASS".
3. CROSS-CHAPTER CHURN: having read the whole sample, book3_churn is "LOW" if chapters feel individually authored; "MEDIUM" if noticeable scaffolding repeats across chapters (same scene skeletons, same practice shells, same rhetorical moves with nouns swapped); "HIGH" if the chapters read as one template stamped repeatedly.
4. Score the BOOK (the whole sample, not any single chapter) 0-100 on each factor:
${FACTOR_RUBRIC}
   Calibration: 90+ premium · 80-90 strong/ships · 70-80 solid draft · 60-70 mediocre · <60 not-publishable. Score as a demanding professional editor; use the full scale — most shipped material lands in the 70s and low 80s, and 85+ means genuinely excellent on that factor.
5. EVIDENCE: 3-6 VERBATIM quotes (exact copy-paste substrings of the file, each <=200 chars): the strongest moments and the worst defects across the sample, each with a one-line why. Quotes are mechanically byte-verified — one altered character invalidates your review. Do not paraphrase inside quote fields.

FINAL MESSAGE: exactly one fenced json block, no prose outside it:
{
  "gate_verdict": "PASS",
  "book3_churn": "LOW",
  "quizDerivation": { "<chapterNumber>": { "answers": ["a|b|c", ...], "keyDisagreements": ["..."] } },
  "scores": {"retention": 0, "quizzes": 0, "transfer": 0, "practical": 0, "summaries": 0, "tone": 0, "limits": 0, "insight": 0, "density": 0, "beginner": 0},
  "quotes": [{"quote": "...", "why": "..."}],
  "oneParagraphVerdict": "..."
}`;
}

// ── Parse + adjudicate ────────────────────────────────────────────────────────

export type ParsedBookReview = {
  gate_verdict: "PASS" | "FAIL";
  book3_churn: "LOW" | "MEDIUM" | "HIGH";
  quizDerivation: Record<string, { answers: string[]; keyDisagreements?: string[] }>;
  scores: Record<ReviewFactor, number>;
  quotes: Array<{ quote: string; why: string }>;
  oneParagraphVerdict?: string;
};

export function parseBookReview(text: string): ParsedBookReview | null {
  const blocks = [...(text ?? "").matchAll(/```(?:json)?\s*([\s\S]*?)```/g)].map((m) => m[1]);
  for (let i = blocks.length - 1; i >= 0; i--) {
    let obj: unknown;
    try { obj = JSON.parse(blocks[i]); } catch { continue; }
    const r = obj as ParsedBookReview;
    if (r == null || typeof r !== "object") continue;
    if (r.gate_verdict !== "PASS" && r.gate_verdict !== "FAIL") continue;
    if (r.book3_churn !== "LOW" && r.book3_churn !== "MEDIUM" && r.book3_churn !== "HIGH") continue;
    if (r.scores == null || typeof r.scores !== "object") continue;
    const factorsOk = REVIEW_FACTORS.every((f) => {
      const v = (r.scores as Record<string, unknown>)[f];
      return typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 100;
    });
    if (!factorsOk) continue;
    if (!Array.isArray(r.quotes)) continue;
    if (r.quizDerivation == null || typeof r.quizDerivation !== "object") continue;
    return r;
  }
  return null;
}

export type BookReaderResult = {
  reviewerSessionId: string;
  valid: boolean;
  invalidReason?: string;
  gateVerdict: "PASS" | "FAIL";
  churn: "LOW" | "MEDIUM" | "HIGH";
  scores: Record<ReviewFactor, number>;
  composite: number;
  keyCheck: { matches: number; of: number; disagreements: string[] };
  quotesVerified: number;
  quotesTotal: number;
  oneParagraphVerdict: string;
  /** Q3 structural key-coverage screen record (what was scanned, what each named
   *  claim recounted to, and the disproof line if it flipped valid→false).
   *  Present on every adjudicated result so Q6 can persist it. */
  structuralScreen: StructuralScreen;
};

/** Byte-verify quotes against the combined doc + check per-chapter key
 *  derivations. A reader with any fabricated quote (or zero quotes) is invalid
 *  and excluded from composition. Additionally (Q3): on a gate FAIL, screen the
 *  reader's structural key-coverage claims against the doc bytes — a claim
 *  disproven at the byte level (a specifically-named key row that IS present)
 *  invalidates the vote (respawn a replacement, exactly like quote fabrication);
 *  a confirmed claim throws DocIntegrityError (machine truth, halt not vote). */
export function adjudicateBookReview(
  parsed: ParsedBookReview,
  docText: string,
  chapters: ChapterV21[],
  reviewerSessionId: string,
): BookReaderResult {
  const quotesTotal = parsed.quotes.length;
  const quotesVerified = parsed.quotes.filter((q) => typeof q.quote === "string" && q.quote.length > 0 && docText.includes(q.quote)).length;
  let matches = 0;
  let of = 0;
  const disagreements: string[] = [];
  for (const ch of chapters) {
    const key = (ch.quiz?.questions ?? []).map((q) => "abc"[q.correctIndex] ?? "?");
    const derived = (parsed.quizDerivation[String(ch.number)]?.answers ?? []).map((a) => String(a).trim().toLowerCase());
    of += key.length;
    key.forEach((k, i) => {
      if (derived[i] === k) matches += 1;
      else disagreements.push(`ch${ch.number} Q${i + 1}: derived ${derived[i] ?? "∅"} vs key ${k}`);
    });
  }
  const composite = Math.round(REVIEW_FACTORS.reduce((acc, f) => acc + REVIEW_WEIGHTS[f] * parsed.scores[f], 0) / 100 * 10) / 10;
  // Q3 structural screen (may throw DocIntegrityError on a confirmed claim).
  const structuralScreen = screenStructuralClaims(parsed, docText, chapters);
  // Quote fabrication is the first invalidation reason; a disproven structural
  // claim is the second. Either one invalidates → excluded from composition and
  // respawned by the acceptance attempt loop.
  const quoteInvalidReason = quotesTotal === 0
    ? "zero quotes — nothing to byte-verify"
    : quotesVerified < quotesTotal
      ? `${quotesTotal - quotesVerified}/${quotesTotal} quotes failed byte-verification`
      : undefined;
  const invalidReason = quoteInvalidReason ?? structuralScreen.invalidatedBy;
  return {
    reviewerSessionId,
    valid: invalidReason === undefined,
    invalidReason,
    gateVerdict: parsed.gate_verdict,
    churn: parsed.book3_churn,
    scores: parsed.scores,
    composite,
    keyCheck: { matches, of, disagreements },
    quotesVerified,
    quotesTotal,
    oneParagraphVerdict: parsed.oneParagraphVerdict ?? "",
    structuralScreen,
  };
}

// ── Compose (compose.py parity) ───────────────────────────────────────────────

export type BookVerdict = {
  id: string;
  medianComposite: number | null;
  factors: Record<ReviewFactor, number> | null;
  gate: "PASS" | "FAIL" | null;
  gateVotes: string;
  churn: string;
  validCount: number;
  readerCount: number;
  chapters: number[];
  readers: Array<Record<string, unknown>>;
};

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** compose.py verbatim semantics over the VALID readers: per-factor medians →
 *  weighted composite; gate = PASS when passes >= fails; churn = mode. */
export function composeBookVerdict(id: string, chapterNumbers: number[], readers: BookReaderResult[]): BookVerdict {
  const valid = readers.filter((r) => r.valid);
  const readerJson = readers.map((r) => ({ ...r })) as Array<Record<string, unknown>>;
  if (valid.length === 0) {
    return { id, medianComposite: null, factors: null, gate: null, gateVotes: "0P/0F", churn: "?", validCount: 0, readerCount: readers.length, chapters: chapterNumbers, readers: readerJson };
  }
  const med = {} as Record<ReviewFactor, number>;
  for (const f of REVIEW_FACTORS) med[f] = median(valid.map((r) => r.scores[f]));
  const comp = Math.round(REVIEW_FACTORS.reduce((acc, f) => acc + REVIEW_WEIGHTS[f] * med[f], 0) / 100 * 10) / 10;
  const npass = valid.filter((r) => r.gateVerdict === "PASS").length;
  const nfail = valid.length - npass;
  const churnCounts = new Map<string, number>();
  for (const r of valid) churnCounts.set(r.churn, (churnCounts.get(r.churn) ?? 0) + 1);
  const churn = [...churnCounts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  return {
    id,
    medianComposite: comp,
    factors: med,
    gate: npass >= nfail ? "PASS" : "FAIL",
    gateVotes: `${npass}P/${nfail}F`,
    churn,
    validCount: valid.length,
    readerCount: readers.length,
    chapters: chapterNumbers,
    readers: readerJson,
  };
}

// ── The verb ──────────────────────────────────────────────────────────────────

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

function loadBookPackage(bookId: string): { pkg: BookPackageV21; path: string } | { error: string } {
  const candidates = [
    resolve(REPO_ROOT, "book-packages", `${bookId}.v21.json`),
    resolve(OUTER_CHECKOUT_ROOT, "book-packages", `${bookId}.v21.json`),
  ];
  const path = candidates.find((p) => existsSync(p));
  if (!path) return { error: `package not found: tried ${candidates.join(" , ")}` };
  try {
    const pkg = JSON.parse(readFileSync(path, "utf8")) as BookPackageV21;
    if (!Array.isArray(pkg.chapters) || pkg.chapters.length === 0) return { error: `package has no chapters: ${path}` };
    return { pkg, path };
  } catch (err) {
    return { error: `package unreadable (${path}): ${(err as Error).message}` };
  }
}

export async function runEvalBookProxy(args: string[], flags: Record<string, string | boolean>): Promise<number> {
  const bookIds = args.filter((a) => !a.startsWith("--"));
  if (bookIds.length === 0) {
    console.error("Usage: eval-book-proxy <bookId> [<bookId2> ...] [--readers 3] [--json]");
    return 2;
  }
  const readerCount = typeof flags["readers"] === "string" ? Math.max(1, parseInt(flags["readers"], 10) || 3) : 3;
  const asJson = flags["json"] === true;
  const log = (line: string) => (asJson ? console.error(line) : console.log(line));
  if (!codexAvailable()) {
    console.error("codex CLI not available — eval-book-proxy needs live readers");
    return 1;
  }

  const books: BookVerdict[] = [];
  for (const id of bookIds) {
    const loaded = loadBookPackage(id);
    if ("error" in loaded) {
      log(`[eval-book] ${id}: ${loaded.error}`);
      books.push({ id, medianComposite: null, factors: null, gate: null, gateVotes: "0P/0F", churn: "?", validCount: 0, readerCount: 0, chapters: [], readers: [] });
      continue;
    }
    const sampled = selectSeededChapters(id, loaded.pkg.chapters, 4);
    const docText = renderBookSampleDoc(sampled);
    const docRelPath = `scratch/eval-proxy/${id}/book-sample.txt`;
    const docAbs = resolve(REPO_ROOT, docRelPath);
    mkdirSync(dirname(docAbs), { recursive: true });
    // Q1: reader-facing doc always ends with a newline (renderBookSampleDoc
    // already appends it; ensureTrailingNewline keeps this write-site robust).
    writeFileAtomic(docAbs, ensureTrailingNewline(docText));
    log(`[eval-book] ${id}: sampled ch ${sampled.map((c) => c.number).join(", ")} → ${docText.length} chars; spawning ${readerCount} readers`);

    const task = buildBookReviewTask(docRelPath);
    const readers = await mapWithConcurrency(
      Array.from({ length: readerCount }, (_, i) => i + 1),
      READER_CONCURRENCY,
      async (readerNo) => {
        for (let attempt = 1; attempt <= 2; attempt++) {
          const sessionId = `eval-book-${id}-r${readerNo}-${Date.now()}`;
          log(`[eval-book] ${id} r${readerNo}: attempt ${attempt} (session ${sessionId})`);
          const r = await spawnCodexAgent({
            task,
            sessionId,
            cwd: REPO_ROOT,
            sandbox: "read-only",
            skipGitRepoCheck: true,
            reasoningEffort: "high",
          });
          const parsed = parseBookReview(r.finalMessage) ?? parseBookReview(r.stdout);
          if (!parsed) {
            log(`[eval-book] ${id} r${readerNo}: attempt ${attempt} unparseable (exit ${r.exitCode})`);
            continue;
          }
          const adjudicated = adjudicateBookReview(parsed, docText, sampled, sessionId);
          if (adjudicated.valid || attempt === 2) {
            if (!adjudicated.valid) log(`[eval-book] ${id} r${readerNo}: INVALID — ${adjudicated.invalidReason}`);
            return adjudicated;
          }
          log(`[eval-book] ${id} r${readerNo}: attempt ${attempt} failed verification (${adjudicated.invalidReason}) — respawning once`);
        }
        return adjudicateBookReview(
          { gate_verdict: "FAIL", book3_churn: "HIGH", quizDerivation: {}, scores: Object.fromEntries(REVIEW_FACTORS.map((f) => [f, 0])) as Record<ReviewFactor, number>, quotes: [], oneParagraphVerdict: "INVALID: unparseable after retry" },
          docText,
          sampled,
          "invalid",
        );
      },
    );

    const verdict = composeBookVerdict(id, sampled.map((c) => c.number), readers);
    books.push(verdict);
    log(`[eval-book] ${id}: composite ${verdict.medianComposite ?? "n/a"} gate ${verdict.gate ?? "?"} (${verdict.gateVotes}) churn ${verdict.churn} (${verdict.validCount}/${verdict.readerCount} valid)`);
    for (const r of readers) {
      log(`  r: comp=${r.composite} gate=${r.gateVerdict} churn=${r.churn} keys=${r.keyCheck.matches}/${r.keyCheck.of} valid=${r.valid ? "yes" : `NO (${r.invalidReason})`}`);
    }
  }

  if (asJson) {
    const payload = {
      books: books.map((b) => ({
        ...b,
        readers: b.readers.map((r) => {
          const { oneParagraphVerdict: _o, ...rest } = r as Record<string, unknown>;
          return rest;
        }),
      })),
    };
    console.log(JSON.stringify(payload, null, 1));
  }
  return 0;
}
