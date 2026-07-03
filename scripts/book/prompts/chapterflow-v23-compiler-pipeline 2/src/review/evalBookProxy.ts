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
import { writeFileAtomic } from "../lib/atomicWrite.js";
import { spawnCodexAgent, codexAvailable } from "../orchestrator/codexAgent.js";
import { REVIEW_WEIGHTS } from "./readerReview.js";
import { renderChapterReaderDoc } from "./renderReaderDoc.js";

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
  return parts.join("\n");
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
};

/** Byte-verify quotes against the combined doc + check per-chapter key
 *  derivations. A reader with any fabricated quote (or zero quotes) is invalid
 *  and excluded from composition. */
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
  const invalidReason = quotesTotal === 0
    ? "zero quotes — nothing to byte-verify"
    : quotesVerified < quotesTotal
      ? `${quotesTotal - quotesVerified}/${quotesTotal} quotes failed byte-verification`
      : undefined;
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
    writeFileAtomic(docAbs, docText);
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
