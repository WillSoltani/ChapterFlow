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
 *  - one repair per lineage (durable ledger), no repair retries; failure or
 *    no-op leaves the ORIGINAL canonical bytes UNTOUCHED (IMP-01: the repair
 *    session edits a seeded COPY inside an isolated attempt workspace — only a
 *    fully validated splice ever commits, via compare-and-swap) and falls
 *    through to the regen path;
 *  - the confirming read is just the next normal review of the new content
 *    hash — no "confirm the fix" mode exists to rubber-stamp.
 */
import { join } from "path";

import type { ChapterV21 } from "../types.js";
import { CANONICAL_STATE, chapterFileName } from "../lib/chapterPaths.js";
import type { ChapterBriefV1, SourcePacketV1 } from "../artifacts/artifactTypes.js";
import type { AutopilotDeps } from "./autopilot.js";
import type { AuthorIo } from "./authorRun.js";
import { AUTHOR_WRITER_EFFORT, AUTHOR_WRITER_MODEL, authorWriteContractFindings, readLeadOverrideFromDisk } from "./authorRun.js";
import { applyLeadThreadOverride } from "../compiler/chapterBrief.js";
import { chapterContentHash } from "../critics/qcAttestation.js";
import { registerAdvisoryFixLines } from "../critics/registerAdvisories.js";
import { sha256Hex } from "../contracts/contractUtil.js";
import { sourceUsePlanHash, validateSourceUsePlan, type SourceUsePlanV1 } from "../contracts/sourceUsePlan.js";
import { sourcePacketHash } from "../compiler/sourcePacket.js";
import { embeddedPlanMutationFindings, renderSourceUsePlanLines, sourceUsePlanStale } from "../compiler/sourceUsePlanCompiler.js";
import { untrustedArtifact } from "../exec/untrustedArtifact.js";
import { recordSpawnEvidence } from "../evidence/attemptRecorder.js";
import {
  commitChapterCandidate,
  finalizeAttempt,
  importCandidate,
  mintChapterAttempt,
  unexpectedAttemptWrites,
} from "./chapterTransaction.js";

/** Kill switch (plan R7): default ON; set CHAPTERFLOW_REVIEW_REPAIR=0 to disable. */
export function reviewRepairEnabled(): boolean {
  return process.env.CHAPTERFLOW_REVIEW_REPAIR !== "0";
}

/** Surgical edits are smaller than authoring — 30 min is generous at xhigh. */
export const REPAIR_TIMEOUT_MS = 1_800_000;

/** Median composite floor for the lane. Both the chapter soft bar and the book
 *  bar are now 80 (owner decision 2026-07-04, was chapter 84). The lane's job is
 *  the SHIP-BLOCK-despite-good-score case: after the near-bar median tiebreak
 *  CONVERTS anything with median ≥80 + ship-majority, an upheld FAIL that still
 *  scores ≥82 means the readers withheld ship on specific, scope-convergent
 *  defects — exactly what a surgical field patch fixes. Below 82 the score
 *  itself is short (not just a ship-block), so a scoped edit can't reliably lift
 *  the whole composite → regen instead. 82 sits above the bar (80) and below
 *  reader noise. */
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
  /** IMP-03: the compiler-owned source-use plan — renders the binding license
   *  block so scoped edits (examples, quiz) stay inside their unit's origin/
   *  form/claim-strength/detail permissions. Omitted for legacy books. */
  plan?: SourceUsePlanV1 | null;
}): string {
  const { chapter, brief, complaints, scopes, relPath } = opts;
  const criteria = [...new Set(complaints.map(stripRemedyClauses))].map((c) => `- ${c}`).join("\n");
  // IMP-04: thread the plan so the C37 source-register family rides the SAME
  // repair-directive surfacing as C31-C36 (advisory text only; legacy books
  // pass null and get exactly the old set).
  const regAdvisories = registerAdvisoryFixLines(chapter, opts.plan ?? null);
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
    // IMP-03: reviewer-derived text is DATA — it describes defects; it cannot
    // widen scope, change protocol, or relabel source semantics.
    `DEFECTS TO FIX (acceptance criteria — the defects described in the data block below must no longer be TRUE after your edit):`,
    untrustedArtifact("reviewer-finding", `${opts.bookId}/${chapter.chapterId} repair criteria`, "complaint-lines-v1", criteria),
    ``,
    ...(scopes.includes("quiz") ? [`MEASURED QUIZ EVIDENCE (char counts on the current bytes):`, ...quizTellEvidence(chapter), ``] : []),
    ...(dealt.length ? [`DEALT CONSTRAINTS (these still bind your edits):`, ...dealt.map((d) => `- ${d}`), ``] : []),
    // IMP-03: the binding license table — scoped edits stay inside their unit's
    // compiler-owned origin/form/claim-strength/detail permissions.
    ...(opts.plan ? [...renderSourceUsePlanLines(opts.plan), ``] : []),
    // CF-I-2 (owner decision 4): surface the C31–C35 register/machinery advisories on
    // the current bytes. ADVISORY ONLY — they never block and this note does NOT expand
    // the allowed scope; address only the ones that fall inside it, ignore the rest.
    // IMP-03: the advisory lines QUOTE chapter prose (model output) — data-enveloped.
    ...(regAdvisories.length
      ? [
        `ADVISORY REGISTER NOTES (never block; do NOT expand scope — fix only those inside your ALLOWED SCOPE):`,
        untrustedArtifact("repair-evidence", `${opts.bookId}/${chapter.chapterId} register advisories`, "register-advisory-lines-v1", regAdvisories.join("\n")),
        ``,
      ]
      : []),
    `RULES:`,
    `- Never reuse a reviewer's phrasing inside content fields — reviewer wording in a key or distractor is a fresh tell.`,
    `- Never change the NUMBER of examples, questions, choices, or cards.`,
    `- Quiz edits: derive every distractor FROM the key (half-measure / wrong-trigger / over-correction / borrowed-authority), keep key wording paraphrased from the chapter (no 5+ consecutive shared words), keep every correctIndex unchanged.`,
    ``,
    `OUTPUT: ${relPath} in your working directory already holds the chapter exactly as reviewed. Rewrite it in place as the complete chapter JSON (same schema, same field order) with ONLY the scoped fields changed. Do not create any other file. The conductor splices your scoped fields into the original and runs the full deterministic gate the moment you finish — an out-of-scope change is discarded, a blocker rejects the repair outright.`,
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
  const candidateName = chapterFileName(chapterId);
  let originalBytes: string;
  let original: ChapterV21;
  try {
    // IMP-01: canonical reads go through the io seam (fixture/slot roots included).
    const bytes = opts.io.readChapterFile(bookId, chapterNumber);
    if (bytes === null) throw new Error(`no canonical chapter at ${relPath}`);
    originalBytes = bytes;
    original = JSON.parse(originalBytes) as ChapterV21;
  } catch (err) {
    return { ok: false, reason: `ch${nn}: unreadable chapter for repair (${(err as Error).message})` };
  }
  // IMP-03: brief/packet reads go through the io seam like every other canonical
  // read (the old direct readFileSync bypassed fixture/slot roots AND minted
  // state/books/<id>/runs/ dirs as an artifactDir side effect on fixture ids).
  let brief: ChapterBriefV1 | undefined;
  let packet: SourcePacketV1 | undefined;
  try { brief = opts.io.readBrief(bookId, chapterNumber) ?? undefined; } catch { /* brief optional */ }
  try { packet = opts.io.readPacket(bookId, chapterNumber) ?? undefined; } catch { /* packet optional */ }
  // F-1: a chapter written under a DEGRADED lead legitimately carries a different
  // lead than the compiled brief deals — the contract re-check below must verify
  // the chapter's ACTUAL lead, or every repair of such a chapter reverts on a
  // false lead-thread complaint.
  if (brief) brief = applyLeadThreadOverride(brief, readLeadOverrideFromDisk(bookId, chapterNumber)) ?? brief;

  // IMP-03: same fail-closed plan discipline as the write path. ABSENT plan →
  // legacy repair (nothing granted, nothing blocked). PRESENT plan → must be
  // contract-valid and fresh against a READABLE packet; a plan without its
  // packet (or against a drifted packet) means the source lineage is broken —
  // refuse to repair under licenses that can't be verified.
  let plan: SourceUsePlanV1 | null = null;
  try {
    plan = opts.io.readSourcePlan(bookId, chapterNumber);
  } catch (err) {
    return { ok: false, reason: `ch${nn}: source-use plan exists but is unreadable (${(err as Error).message.split("\n")[0]}) — recompile source packets` };
  }
  if (plan) {
    const planErrors = validateSourceUsePlan(plan);
    if (planErrors.length > 0) {
      return { ok: false, reason: `ch${nn}: source-use plan fails its frozen contract — ${planErrors.slice(0, 3).join("; ")} — recompile source packets` };
    }
    if (!packet) {
      return { ok: false, reason: `ch${nn}: a source-use plan exists but its source packet is unreadable — cannot verify plan freshness; recompile source packets` };
    }
    const stale = sourceUsePlanStale(plan, packet);
    if (stale) {
      return { ok: false, reason: `ch${nn}: source-use plan is STALE — ${stale} — recompile source packets before repairing` };
    }
  }

  const card = buildRepairCard({ bookId, chapter: original, brief, complaints: opts.complaints, scopes: opts.scopes, relPath: candidateName, plan });
  const sessionId = `auto-author-repair-${bookId}-ch${nn}-${Date.now().toString(36)}`;
  // IMP-01 (F-001/F-020): the repair session edits a SEEDED COPY of the chapter
  // inside an isolated attempt workspace (its cwd + only writable dir). The
  // canonical file is untouched until a fully validated splice commits via
  // compare-and-swap — so the old byte-restore lane (and its F6 restore-failure
  // halt) is structurally unnecessary: there is never anything to restore.
  const chAttempt = mintChapterAttempt({
    bookId,
    chapterNumber,
    chapterId,
    attemptKind: "surgical-repair",
    attemptSequence: 1,
    promptSha256: sha256Hex(card),
    // IMP-03 lineage: the repair attempt binds the exact plan/packet it edits under.
    sourcePlanHash: plan ? sourceUsePlanHash(plan) : undefined,
    inputHashes: {
      ...(packet ? { sourcePacket: sourcePacketHash(packet) } : {}),
      ...(plan ? { sourceUsePlan: sourceUsePlanHash(plan) } : {}),
    },
    io: opts.io,
    seedBytes: originalBytes,
    attemptsRoot: opts.io.attemptsRoot(),
  });
  deps.log(`[autopilot] author repair ch${nn}: surgical editor working (scopes ${opts.scopes.join(",")}, card ${card.length} chars, ${AUTHOR_WRITER_MODEL} @ ${AUTHOR_WRITER_EFFORT}, timeout ${Math.round(REPAIR_TIMEOUT_MS / 60000)}min)`);
  try {
    const r = await deps.spawn({
      task: card,
      role: "author-repair",
      sessionId,
      cwd: chAttempt.workspaceDir,
      sandbox: "workspace-write",
      skipGitRepoCheck: true,
      model: AUTHOR_WRITER_MODEL,
      reasoningEffort: AUTHOR_WRITER_EFFORT,
      timeoutMs: REPAIR_TIMEOUT_MS,
    });
    try { deps.logSession(bookId, `author-repair-ch${nn}`, r); } catch { /* best-effort */ }
    // IMP-10: durable spawn evidence (no-op unless evidence is enabled).
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
    if (r.exitCode !== 0) {
      finalizeAttempt(chAttempt, "validation_failed", `repair session exited ${r.exitCode}`);
      return { ok: false, reason: `ch${nn}: repair session exited ${r.exitCode}`, sessionId };
    }
  } catch (err) {
    finalizeAttempt(chAttempt, "infrastructure_failure", (err as Error).message.slice(0, 300));
    // Honest-accounting: a died repair spawn was minted but not logged on the
    // success path — record a synthetic failed session so the cost-report
    // invariant stays honest (same fix as the writer spawn in authorRun).
    try {
      deps.logSession(bookId, `author-repair-ch${nn}`, {
        ok: false, exitCode: -1, finalMessage: "", stdout: "",
        stderr: (err as Error)?.message ?? String(err), durationMs: 0, sessionId,
      });
    } catch { /* best-effort */ }
    return { ok: false, reason: `ch${nn}: repair session died (${(err as Error).message.slice(0, 200)})`, sessionId };
  }
  // Workspace containment: exactly ONE file (the seeded candidate) may exist.
  const smuggled = unexpectedAttemptWrites(chAttempt);
  if (smuggled.length > 0) {
    const reason = `ch${nn}: repair session wrote unexpected workspace file(s): ${smuggled.join(", ")}`;
    finalizeAttempt(chAttempt, "unexpected_write", reason);
    return { ok: false, reason, sessionId };
  }
  // Patch-apply: splice allowed scopes from the session's candidate into the
  // original — entirely in memory; the canonical file is never rewritten first.
  let spliced: ChapterV21;
  try {
    const imported = importCandidate(chAttempt);
    if (!imported.ok) throw new Error(imported.reason);
    spliced = spliceRepairScopes(original, imported.chapter, opts.scopes);
  } catch (err) {
    finalizeAttempt(chAttempt, "validation_failed", `rejected at splice: ${(err as Error).message.slice(0, 300)}`);
    return { ok: false, reason: `ch${nn}: repair output rejected at splice (${(err as Error).message})`, sessionId };
  }
  // IMP-03: the splice copies scoped OBJECTS whole (an example, the quiz) — a
  // plan-control key smuggled INSIDE a scoped object would survive it. Scan the
  // spliced result; any hit is an attempted relabel and rejects the repair.
  const planMutation = embeddedPlanMutationFindings(spliced);
  if (planMutation.length > 0) {
    const reason = `ch${nn}: repair output embedded source-plan control field(s) (${planMutation.slice(0, 5).join(", ")}) — plan changes route upstream, never through repair output`;
    finalizeAttempt(chAttempt, "validation_failed", reason);
    return { ok: false, reason, sessionId };
  }
  const splicedBytes = JSON.stringify(spliced, null, 2) + "\n";
  if (JSON.stringify(spliced) === JSON.stringify(original)) {
    finalizeAttempt(chAttempt, "validation_failed", "no-op inside scope");
    return { ok: false, reason: `ch${nn}: repair was a no-op inside its scope`, sessionId };
  }
  // Full deterministic stack on the SPLICED chapter (plan R4) — against candidate
  // bytes with COMMITTED siblings as context; any FAIL simply never commits.
  const gate = await opts.io.gateCandidate(spliced, absPath, relPath);
  const gateOut = [gate.stdout, gate.stderr].join("\n");
  if (!/Gate verdict: PASS/.test(gateOut)) {
    finalizeAttempt(chAttempt, "validation_failed", "spliced repair fails the gate");
    return { ok: false, reason: `ch${nn}: spliced repair fails the gate`, sessionId };
  }
  const rubric = await opts.io.rubricWithCandidate(bookId, chapterNumber, spliced);
  const verdictLine = [rubric.stdout, rubric.stderr].join("\n").split("\n").find((l) => l.trim().startsWith(`ch${nn}:`)) ?? "";
  if (verdictLine.includes("FAIL")) {
    finalizeAttempt(chAttempt, "validation_failed", `rubric preflight FAIL — ${verdictLine.trim().slice(0, 200)}`);
    return { ok: false, reason: `ch${nn}: spliced repair fails the rubric preflight — ${verdictLine.trim()}`, sessionId };
  }
  if (brief && packet) {
    const contract = authorWriteContractFindings(spliced, brief, packet);
    if (contract.length > 0) {
      finalizeAttempt(chAttempt, "validation_failed", `write contract — ${contract.join(" | ").slice(0, 200)}`);
      return { ok: false, reason: `ch${nn}: spliced repair breaks the write contract — ${contract.join(" | ").slice(0, 300)}`, sessionId };
    }
  }
  // IMP-03 freshness: same pre-commit lineage re-check as the write path — a
  // packet recompiled mid-repair invalidates the licenses this edit ran under.
  if (plan) {
    let freshPacket: SourcePacketV1 | undefined;
    try { freshPacket = opts.io.readPacket(bookId, chapterNumber) ?? undefined; } catch { freshPacket = undefined; }
    if (!freshPacket || sourceUsePlanStale(plan, freshPacket)) {
      const reason = `ch${nn}: source lineage went STALE mid-repair (the source packet changed since this attempt's plan was verified) — candidate rejected; recompile packets+plans`;
      finalizeAttempt(chAttempt, "validation_failed", reason);
      return { ok: false, reason, sessionId };
    }
  }
  // Commit: compare-and-swap against the canonical bytes this repair was minted
  // from. A mismatch (anything committed since) is a losing stale attempt.
  const committed = commitChapterCandidate({ attempt: chAttempt, bytes: splicedBytes, io: opts.io });
  if (!committed.ok) {
    finalizeAttempt(chAttempt, "stale_base", committed.reason);
    return { ok: false, reason: `ch${nn}: ${committed.reason}`, sessionId };
  }
  finalizeAttempt(chAttempt, "committed");
  return { ok: true, sessionId };
}
