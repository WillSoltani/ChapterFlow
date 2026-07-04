/**
 * Targeted review-repair lane (plan docs/v24/REPAIR-LANE-PLAN-2026-07-04.md).
 *
 * When a tiebreak UPHOLDS a review FAIL whose must-fix complaints CONVERGE on
 * field-scoped targets, repair those fields surgically instead of regenerating
 * the whole chapter — then let the normal (hash-keyed, repair-unaware) review
 * round confirm. The v21 scar contract is structural here:
 *  - patch-apply: the harness SPLICES only the allowed scopes from the repair
 *    session's output into the original bytes — out-of-scope drift is discarded
 *    by construction, never policed;
 *  - one repair per lineage (durable ledger), no repair retries, failure or
 *    no-op restores the ORIGINAL bytes (the review latest-pointer must keep
 *    matching the on-disk hash) and falls through to the regen path;
 *  - the confirming read is just the next normal review of the new content
 *    hash — no "confirm the fix" mode exists to rubber-stamp.
 */
import { readFileSync, writeFileSync } from "fs";
import { join, resolve } from "path";

import type { ChapterV21 } from "../types.js";
import { CANONICAL_STATE, chapterFileName } from "../lib/chapterPaths.js";
import { chapterBriefPath, sourcePacketPath } from "../artifacts/artifactStore.js";
import type { ChapterBriefV1, SourcePacketV1 } from "../artifacts/artifactTypes.js";
import type { AutopilotDeps } from "./autopilot.js";
import type { AuthorIo } from "./authorRun.js";
import { AUTHOR_WRITER_EFFORT, AUTHOR_WRITER_MODEL, authorWriteContractFindings } from "./authorRun.js";

const PIPELINE_DIR = resolve(__dirname, "../..");

/** Kill switch (plan R7): default ON; set CHAPTERFLOW_REVIEW_REPAIR=0 to disable. */
export function reviewRepairEnabled(): boolean {
  return process.env.CHAPTERFLOW_REVIEW_REPAIR !== "0";
}

/** Surgical edits are smaller than authoring — 30 min is generous at xhigh. */
export const REPAIR_TIMEOUT_MS = 1_800_000;

/** Median composite floor for the lane. The chapter bar is 84 and the book bar
 *  is 80; tiebreak-upholding reads routinely score 83.x on repair-worthy
 *  chapters (ch05 live: 83.7/83.8), so 84 would veto the lane's own
 *  population. 82 = comfortably above the book bar, below reader noise. */
export const REPAIR_COMPOSITE_FLOOR = 82;

export type RepairScope =
  | "quiz"
  | "practice"
  | "memorableLines"
  | "reviewCards"
  | "keyTakeaway"
  | `examples[${number}]`;

export type RepairEligibility = {
  eligible: boolean;
  scopes: RepairScope[];
  reason: string;
};

// Prose/tone targets are never repairable — patch-editing prose mints seams
// (22 corpus books capped for SEAMS). Quality adjectives are prose symptoms in
// field clothing. Count changes violate the dealt-count contract (A16/B15).
const PROSE_RX = /\b(hook|counterintuition|fast[- ]?read|deep[- ]?read|full[- ]?read|breakdown|prose|tone|voice|density|structure|pacing|opening|narrative)\b/i;
const QUALITY_RX = /\b(generic|padded|templated?|template|scaffold|boilerplate|formulaic|repetitive across)\b/i;
const COUNT_RX = /\b(add|cut|remove|drop|merge)\b[^.]{0,40}\b(example|question)s?\b/i;

/** Derive a complaint's top-level repair scope, or null when it must veto.
 *  ORDER MATTERS (live-tuned): quality/count vetoes bind first, but the field
 *  match runs BEFORE the prose veto — quiz-echo complaints legitimately say
 *  "repeats ... from the prose" while being entirely quiz-fixable; the prose
 *  veto exists for complaints whose TARGET is prose, not ones that cite it. */
export function deriveComplaintScope(complaint: string): RepairScope | "VETO" | null {
  const c = complaint.toLowerCase();
  if (QUALITY_RX.test(c) || COUNT_RX.test(c)) return "VETO";
  if (/\bquiz\b|\bq(?:uestion)?\s*\d\b|\bdistractor|\bcorrect (answer|option)|\bkey(ed)? (answer|option|choice)|\banswer (option|choice)/.test(c)) return "quiz";
  const ex = c.match(/example\s*(\d)/);
  if (ex && !PROSE_RX.test(c)) return `examples[${parseInt(ex[1], 10) - 1}]` as RepairScope;
  if (/\bexamples?\b/.test(c)) return "VETO"; // unindexed example complaints → regen (surface too wide)
  if (PROSE_RX.test(c)) return "VETO";
  if (/try this now|24[- ]?hour|twenty[- ]?four|weekly practice|if[- ]?then|timebox|practice/.test(c)) return "practice";
  if (/memorable/.test(c)) return "memorableLines";
  if (/review card|flash ?card|\bcards?\b/.test(c)) return "reviewCards";
  if (/takeaway/.test(c)) return "keyTakeaway";
  return null; // unclassifiable → veto (fail closed)
}

/**
 * Eligibility over the UPHELD tiebreak's reads (plan R1, grilled):
 * convergence binds at the SCOPE level — three readers naming Q2, Q5, and
 * "quiz overall" all derive to `quiz` and agree, even though their leaves
 * differ (live ch05 texture). readSets = per-read must-fix complaint arrays
 * (reads without complaints are agnostic); composites = the valid reads'.
 */
export function classifyRepairEligibility(readSets: string[][], composites: number[]): RepairEligibility {
  const sorted = [...composites].sort((a, b) => a - b);
  const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
  if (median < REPAIR_COMPOSITE_FLOOR) return { eligible: false, scopes: [], reason: `median composite ${median} < ${REPAIR_COMPOSITE_FLOOR}` };
  const perRead: Array<Set<string>> = [];
  for (const set of readSets) {
    if (!set.length) continue;
    const scopes = new Set<string>();
    for (const complaint of set) {
      const scope = deriveComplaintScope(complaint);
      if (scope === "VETO" || scope === null) {
        return { eligible: false, scopes: [], reason: `veto: "${complaint.slice(0, 80)}"` };
      }
      scopes.add(scope);
    }
    perRead.push(scopes);
  }
  if (perRead.length < 2) return { eligible: false, scopes: [], reason: "fewer than 2 reads carry must-fix complaints" };
  const counts = new Map<string, number>();
  for (const scopes of perRead) for (const s of scopes) counts.set(s, (counts.get(s) ?? 0) + 1);
  const convergent = [...counts.entries()].filter(([, n]) => n >= 2).map(([s]) => s);
  if (convergent.length === 0) return { eligible: false, scopes: [], reason: "no scope named by >=2 reads (diffuse texture)" };
  // EVERY complaint must land inside the convergent set — a stray outlier scope
  // means the repair would leave a named defect untouched.
  for (const scopes of perRead) {
    for (const s of scopes) {
      if (!convergent.includes(s)) return { eligible: false, scopes: [], reason: `outlier scope ${s} outside the convergent set` };
    }
  }
  const exampleScopes = convergent.filter((s) => s.startsWith("examples["));
  if (exampleScopes.length > 2) return { eligible: false, scopes: [], reason: "more than 2 distinct example targets" };
  if (convergent.length > 3) return { eligible: false, scopes: [], reason: "more than 3 distinct scopes" };
  return { eligible: true, scopes: convergent as RepairScope[], reason: `convergent on ${convergent.join(", ")}` };
}

/** Remedy-stripping (plan R2): keep the defect statement, drop the reviewer's
 *  prescription — the confirming reader is a different sample and prescriptions
 *  overfit to one reader's taste. Evidence enumerations survive. */
export function stripRemedyClauses(complaint: string): string {
  return complaint
    .split(/(?<=[.;])\s+/)
    .filter((sentence) => !/^\s*(fix|change|make|rewrite|reword|shorten|lengthen|replace|swap|use|instead)\b/i.test(sentence))
    .join(" ")
    .replace(/\s*(—|->|→)\s*(fix|change|make|rewrite|reword|shorten|lengthen|replace|swap|trim|grow)\b[^.;]*/gi, "")
    .trim() || complaint.trim();
}

function quizTellEvidence(chapter: ChapterV21): string[] {
  const lines: string[] = [];
  for (const q of chapter.quiz?.questions ?? []) {
    const choices = (q.choices ?? []).map((c) => (typeof c === "string" ? c : String((c as { direct?: unknown })?.direct ?? c)));
    const k = q.correctIndex;
    if (typeof k !== "number" || !Number.isInteger(k) || k < 0 || k >= choices.length || choices.length === 0) continue;
    const lens = choices.map((c) => c.length);
    lines.push(`- ${q.questionId ?? "q?"}: key=choice ${k} (${lens[k]} chars) vs distractors [${lens.filter((_, i) => i !== k).join(", ")}]`);
  }
  return lines;
}

export function buildRepairCard(opts: {
  bookId: string;
  chapter: ChapterV21;
  brief?: ChapterBriefV1;
  complaints: string[];
  scopes: RepairScope[];
  relPath: string;
}): string {
  const { chapter, brief, complaints, scopes, relPath } = opts;
  const criteria = [...new Set(complaints.map(stripRemedyClauses))].map((c) => `- ${c}`).join("\n");
  const dealt: string[] = [];
  if (scopes.includes("quiz") && brief?.quizStemShapes?.length) {
    dealt.push(`Quiz deals still bind: stem shapes ${brief.quizStemShapes.join(", ")}; distractor failure modes ${(brief.quizFailureModes ?? []).join(", ")}; fact order ${(brief.questionFactOrder ?? []).join(",")}; answer-index pattern unchanged. HARD length caps: the key may be the uniquely LONGEST choice in at most ONE of the 9 questions and uniquely SHORTEST in at most FOUR — land keys mid-length.`);
  }
  for (const s of scopes) {
    const m = s.match(/^examples\[(\d+)\]$/);
    if (m && brief?.exampleArcs) {
      const arc = brief.exampleArcs[parseInt(m[1], 10)];
      if (arc) dealt.push(`Example ${parseInt(m[1], 10) + 1}'s dealt arc still binds: entry=${arc.entry}, outcome=${arc.outcome}, register=${arc.fieldStyle}${arc.prop ? ", one concrete anchor" : ", no props"}.`);
    }
  }
  return [
    `SURGICAL REPAIR — ${chapter.chapterId}`,
    ``,
    `ROLE: You are a surgical editor, NOT an author. Three independent readers scored this chapter ≥${REPAIR_COMPOSITE_FLOOR} but withheld ship on the specific defects below. Your job is the SMALLEST change that makes every defect truly fixed. Everything outside your scope is APPROVED content — the harness will discard any edit outside the allowed fields, so spend zero effort there.`,
    ``,
    `ALLOWED SCOPE (edits anywhere else are discarded): ${scopes.join(", ")}`,
    ``,
    `DEFECTS TO FIX (acceptance criteria — what must be TRUE after your edit):`,
    criteria,
    ``,
    ...(scopes.includes("quiz") ? [`MEASURED QUIZ EVIDENCE (char counts on the current bytes):`, ...quizTellEvidence(chapter), ``] : []),
    ...(dealt.length ? [`DEALT CONSTRAINTS (these still bind your edits):`, ...dealt.map((d) => `- ${d}`), ``] : []),
    `RULES:`,
    `- Never reuse a reviewer's phrasing inside content fields — reviewer wording in a key or distractor is a fresh tell.`,
    `- Never change the NUMBER of examples, questions, choices, or cards.`,
    `- Quiz edits: derive every distractor FROM the key (half-measure / wrong-trigger / over-correction / borrowed-authority), keep key wording paraphrased from the chapter (no 5+ consecutive shared words), keep every correctIndex unchanged.`,
    ``,
    `OUTPUT: rewrite ${relPath} as the complete chapter JSON (same schema, same field order) with ONLY the scoped fields changed. Then run: npx tsx src/cli.ts gate-chapter ${relPath} — and fix any blocker it reports before finishing.`,
  ].join("\n");
}

/** Patch-apply (plan R3): splice ONLY the allowed scopes from the session's
 *  output into the original chapter. Throws on structural violations. */
export function spliceRepairScopes(original: ChapterV21, repaired: ChapterV21, scopes: RepairScope[]): ChapterV21 {
  const out: ChapterV21 = JSON.parse(JSON.stringify(original));
  for (const scope of scopes) {
    if (scope === "quiz") {
      const q = repaired.quiz;
      if (!q?.questions || q.questions.length !== (original.quiz?.questions?.length ?? 9)) throw new Error("repair changed the quiz question count");
      out.quiz = JSON.parse(JSON.stringify(q));
    } else if (scope === "practice") {
      out.tryThisNow = repaired.tryThisNow ?? out.tryThisNow;
      if (repaired.implementationPlan) out.implementationPlan = JSON.parse(JSON.stringify(repaired.implementationPlan));
    } else if (scope === "memorableLines") {
      if (repaired.memorableLines) out.memorableLines = JSON.parse(JSON.stringify(repaired.memorableLines));
    } else if (scope === "reviewCards") {
      if (!repaired.reviewCards || repaired.reviewCards.length !== (original.reviewCards?.length ?? 0)) throw new Error("repair changed the review-card count");
      out.reviewCards = JSON.parse(JSON.stringify(repaired.reviewCards));
    } else if (scope === "keyTakeaway") {
      out.keyTakeaway = repaired.keyTakeaway ?? out.keyTakeaway;
    } else {
      const m = scope.match(/^examples\[(\d+)\]$/);
      if (!m) throw new Error(`unknown repair scope ${scope}`);
      const i = parseInt(m[1], 10);
      if (!repaired.examples || repaired.examples.length !== (original.examples?.length ?? 0)) throw new Error("repair changed the example count");
      if (!repaired.examples[i]) throw new Error(`repair output missing examples[${i}]`);
      out.examples[i] = JSON.parse(JSON.stringify(repaired.examples[i]));
    }
  }
  return out;
}

/** F6: thrown by the review caller when a rejected repair could not restore the
 *  original bytes — the conductor must halt infra (disk no longer matches the
 *  persisted review pointers). */
export class RepairRestoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RepairRestoreError";
  }
}

export type RepairResult = {
  ok: boolean;
  reason?: string;
  sessionId?: string;
  /** F6 (FINAL-HARDENING-PLAN 2026-07-04): a rejected repair whose byte RESTORE
   *  also failed — disk now holds unreviewed repair-session bytes while the
   *  latest persisted review points at the pre-repair hash. The caller must
   *  treat this as an INFRA HALT, never continue routing (a regen-exhausted
   *  book would otherwise halt "content" with silently divergent bytes). */
  restoreFailed?: boolean;
};

/** Run one surgical repair end-to-end. On ANY failure the ORIGINAL bytes are
 *  restored (the persisted review's contentHash must keep matching the disk)
 *  and the caller falls through to regen. No retries. */
export async function doRepairOneChapter(
  bookId: string,
  chapterNumber: number,
  deps: AutopilotDeps,
  opts: { io: AuthorIo; scopes: RepairScope[]; complaints: string[] },
): Promise<RepairResult> {
  const nn = String(chapterNumber).padStart(2, "0");
  const chapterId = `${bookId}-ch${nn}`;
  const relPath = join("state", "chapters", chapterFileName(chapterId));
  const absPath = join(CANONICAL_STATE, "chapters", chapterFileName(chapterId));
  let originalBytes: string;
  let original: ChapterV21;
  try {
    originalBytes = readFileSync(absPath, "utf8");
    original = JSON.parse(originalBytes) as ChapterV21;
  } catch (err) {
    return { ok: false, reason: `ch${nn}: unreadable chapter for repair (${(err as Error).message})` };
  }
  let brief: ChapterBriefV1 | undefined;
  let packet: SourcePacketV1 | undefined;
  try { brief = JSON.parse(readFileSync(chapterBriefPath(bookId, chapterNumber), "utf8")); } catch { /* brief optional */ }
  try { packet = JSON.parse(readFileSync(sourcePacketPath(bookId, chapterNumber), "utf8")); } catch { /* packet optional */ }

  const card = buildRepairCard({ bookId, chapter: original, brief, complaints: opts.complaints, scopes: opts.scopes, relPath });
  const sessionId = `auto-author-repair-${bookId}-ch${nn}-${Date.now().toString(36)}`;
  deps.log(`[autopilot] author repair ch${nn}: surgical editor working (scopes ${opts.scopes.join(",")}, card ${card.length} chars, ${AUTHOR_WRITER_MODEL} @ ${AUTHOR_WRITER_EFFORT}, timeout ${Math.round(REPAIR_TIMEOUT_MS / 60000)}min)`);
  let restoreFailed = false;
  const restore = () => {
    try {
      writeFileSync(absPath, originalBytes);
    } catch (err) {
      // F6: a failed restore leaves unreviewed repair bytes on disk while the
      // persisted review still points at the pre-repair hash — surfaced to the
      // caller as an infra halt, never a silent divergence.
      restoreFailed = true;
      deps.log(`[autopilot] author repair ch${nn}: RESTORE FAILED — ${(err as Error).message}; disk holds unreviewed repair-session bytes`);
    }
  };
  try {
    const r = await deps.spawn({
      task: card,
      sessionId,
      cwd: PIPELINE_DIR,
      sandbox: "workspace-write",
      model: AUTHOR_WRITER_MODEL,
      reasoningEffort: AUTHOR_WRITER_EFFORT,
      timeoutMs: REPAIR_TIMEOUT_MS,
    });
    try { deps.logSession(bookId, `author-repair-ch${nn}`, r); } catch { /* best-effort */ }
    if (r.exitCode !== 0) { restore(); return { ok: false, reason: `ch${nn}: repair session exited ${r.exitCode}`, sessionId, restoreFailed }; }
  } catch (err) {
    restore();
    // Honest-accounting: a died repair spawn was minted but not logged on the
    // success path — record a synthetic failed session so the cost-report
    // invariant stays honest (same fix as the writer spawn in authorRun).
    try {
      deps.logSession(bookId, `author-repair-ch${nn}`, {
        ok: false, exitCode: -1, finalMessage: "", stdout: "",
        stderr: (err as Error)?.message ?? String(err), durationMs: 0, sessionId,
      });
    } catch { /* best-effort */ }
    return { ok: false, reason: `ch${nn}: repair session died (${(err as Error).message.slice(0, 200)})`, sessionId, restoreFailed };
  }
  // Patch-apply: splice allowed scopes from the session's file into the original.
  let spliced: ChapterV21;
  try {
    const written = JSON.parse(readFileSync(absPath, "utf8")) as ChapterV21;
    spliced = spliceRepairScopes(original, written, opts.scopes);
  } catch (err) {
    restore();
    return { ok: false, reason: `ch${nn}: repair output rejected at splice (${(err as Error).message})`, sessionId, restoreFailed };
  }
  const splicedBytes = JSON.stringify(spliced, null, 2) + "\n";
  if (JSON.stringify(spliced) === JSON.stringify(original)) {
    restore();
    return { ok: false, reason: `ch${nn}: repair was a no-op inside its scope`, sessionId, restoreFailed };
  }
  writeFileSync(absPath, splicedBytes);
  // Full deterministic stack on the SPLICED bytes (plan R4) — any FAIL restores.
  const gate = await deps.runVerb(["gate-chapter", relPath]);
  const gateOut = [gate.stdout, gate.stderr].join("\n");
  if (!/Gate verdict: PASS/.test(gateOut)) {
    restore();
    return { ok: false, reason: `ch${nn}: spliced repair fails the gate`, sessionId, restoreFailed };
  }
  const rubric = await deps.runVerb(["rubric-metrics", bookId]);
  const verdictLine = [rubric.stdout, rubric.stderr].join("\n").split("\n").find((l) => l.trim().startsWith(`ch${nn}:`)) ?? "";
  if (verdictLine.includes("FAIL")) {
    restore();
    return { ok: false, reason: `ch${nn}: spliced repair fails the rubric preflight — ${verdictLine.trim()}`, sessionId, restoreFailed };
  }
  if (brief && packet) {
    const contract = authorWriteContractFindings(spliced, brief, packet);
    if (contract.length > 0) {
      restore();
      return { ok: false, reason: `ch${nn}: spliced repair breaks the write contract — ${contract.join(" | ").slice(0, 300)}`, sessionId, restoreFailed };
    }
  }
  return { ok: true, sessionId };
}
