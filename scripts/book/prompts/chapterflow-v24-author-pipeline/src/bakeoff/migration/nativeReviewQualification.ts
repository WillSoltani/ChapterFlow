/**
 * IMP-19 — Layer-N v2 logic: canonical hashing, deterministic corpus admission,
 * and CAPABILITY-SPECIFIC scoring (the LN-04 fix — each capability is scored
 * through its ACTUAL output channel, never one universal complaint anchor).
 *
 * Pure + deterministic: NO model calls, NO file writes. The live runner
 * (nativeReviewRunner.ts) drives the real reviewOneChapter path and feeds the
 * ChapterReviewV1 reads here for scoring.
 */

import { createHash } from "crypto";

import type { ChapterReviewV1 } from "../../artifacts/artifactTypes.js";
import { runShipGate } from "../../critics/finalGate.js";
import { chapterContentHash } from "../../critics/qcAttestation.js";
import { renderChapterReaderDocPhase1 } from "../../review/renderReaderDoc.js";
import { validateChapterV21 } from "../../runtimeSchemas.js";
import type { ChapterV21 } from "../../types.js";
import {
  NATIVE_REVIEW_BLOCKING_KINDS,
  NATIVE_REVIEW_CASE_KINDS,
  NATIVE_REVIEW_CHANNEL,
  NATIVE_REVIEW_CORPUS_SCHEMA,
  type NativeReviewCaseKind,
  type NativeReviewCorpusItemV2,
  type NativeReviewCorpusV2,
  type NativeReviewInstrumentManifestV2,
  type NativeReviewMetricsV2,
  type NativeReviewPerCaseV2,
  type NativeReviewThresholdsV2,
} from "./nativeReviewTypes.js";

const sha = (s: string): string => createHash("sha256").update(s).digest("hex");

/** Deterministic canonical JSON (recursively sorted keys) for stable hashing. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(",")}}`;
}

// ── Full-semantic corpus hash (LN-07 / instruction 11) ────────────────────────

/** Hashes EVERY semantic field (class/kind, gold expectations, evidence spans,
 *  base+variant content, mutation manifest, provenance, phase-2 flag) in a
 *  canonical order — NOT just item ids + chapter content (the v1 gap). */
export function nativeReviewCorpusSha256(corpus: NativeReviewCorpusV2): string {
  const items = [...corpus.items]
    .sort((a, b) => a.itemId.localeCompare(b.itemId))
    .map((it) => ({
      itemId: it.itemId,
      baseItemId: it.baseItemId,
      kind: it.kind,
      chapterContentSha256: chapterContentHash(it.chapter),
      expected: it.expected,
      mutationManifest: it.mutationManifest,
      evidenceProvenance: it.evidenceProvenance,
      approvalStatus: it.approvalStatus,
      requiresPhase2: it.requiresPhase2,
    }));
  return sha(canonicalJson({
    schema: corpus.schema,
    corpusId: corpus.corpusId,
    version: corpus.version,
    sourceCorpus: corpus.sourceCorpus,
    approvalStatus: corpus.approvalStatus,
    independentHumanRater: corpus.independentHumanRater,
    items,
  }));
}

export function nativeReviewInstrumentManifestSha256(m: NativeReviewInstrumentManifestV2): string {
  return sha(canonicalJson(m));
}

// ── Deterministic chapter admission (no model, no writes) ─────────────────────

export type ChapterAdmission = {
  schemaOk: boolean;
  renderOk: boolean;
  renderedBytes: number;
  shipClean: boolean;
  shipBlockers: string[];
  complete: boolean;
  completenessProblems: string[];
};

/** Structural completeness: the reader-facing components a real chapter carries
 *  (ChapterV21 authoring shape). A stub (the v1 failure) fails here. */
export function chapterCompleteness(chapter: ChapterV21): string[] {
  const problems: string[] = [];
  const q = chapter.quiz?.questions ?? [];
  if (q.length < 4) problems.push(`quiz has ${q.length} questions (<4)`);
  if ((chapter.examples ?? []).length < 2) problems.push(`<2 examples`);
  const b = chapter.breakdown as { fastRead?: unknown; deepRead?: unknown; fullRead?: unknown } | undefined;
  if (!b || !b.fastRead || !b.deepRead || !b.fullRead) problems.push("breakdown missing a fast/deep/full tier");
  const plan = chapter.implementationPlan as { coreSkill?: unknown; ifThenPlans?: unknown[] } | undefined;
  if (!plan || !plan.coreSkill || (plan.ifThenPlans ?? []).length === 0) problems.push("implementationPlan incomplete");
  if ((chapter.reviewCards ?? []).length < 2) problems.push("<2 reviewCards");
  if (!chapter.keyTakeaway) problems.push("missing keyTakeaway");
  return problems;
}

export function admitChapter(chapter: ChapterV21): ChapterAdmission {
  const schema = validateChapterV21(chapter);
  let renderOk = false;
  let renderedBytes = 0;
  try {
    const doc = renderChapterReaderDocPhase1(schema.ok ? schema.value : chapter);
    renderOk = true;
    renderedBytes = Buffer.byteLength(doc, "utf8");
  } catch {
    renderOk = false;
  }
  let shipClean = false;
  let shipBlockers: string[] = [];
  try {
    const gate = runShipGate(chapter);
    shipClean = gate.passed && gate.blockers.length === 0;
    shipBlockers = gate.blockers.map((f) => f.catalogId);
  } catch (err) {
    shipBlockers = [`ship-gate-threw:${(err as Error).message.split("\n")[0]}`];
  }
  const completenessProblems = chapterCompleteness(chapter);
  return {
    schemaOk: schema.ok,
    renderOk,
    renderedBytes,
    shipClean,
    shipBlockers,
    complete: completenessProblems.length === 0,
    completenessProblems,
  };
}

/** The rendered-doc byte floor below which a "chapter" is a stub, not a real
 *  chapter. Data-driven: derived from the admitted clean bases at build time and
 *  frozen into the corpus; this default is a hard lower bound well above the v1
 *  stubs (248–2,186 B) and below the observed clean floor (~12,000 B). */
export const NATIVE_REVIEW_MIN_RENDER_BYTES = 8000;

// ── Corpus validation (fail-closed) ───────────────────────────────────────────

export type ValidateCorpusOpts = {
  /** chapterContentHash values of diagnostic/confirmatory candidate inputs+outputs
   *  — a Layer-N item may never collide with a candidate (red-team case 1). */
  candidateContentHashes?: Set<string>;
  /** Minimum rendered bytes (defaults to NATIVE_REVIEW_MIN_RENDER_BYTES). */
  minRenderBytes?: number;
};

const MIN_COUNTS: Partial<Record<NativeReviewCaseKind, number>> = {
  "clean-pass": 6,
  "reader-visible-hard-blocker": 6,
  "quiz-key-mismatch": 3,
  "quiz-ambiguity": 3,
  "craft-nonblocker": 3,
};

/** [] = valid. Fail-closed: any problem blocks the corpus BEFORE any spawn. */
export function validateNativeReviewCorpusV2(corpus: NativeReviewCorpusV2, opts: ValidateCorpusOpts = {}): string[] {
  const problems: string[] = [];
  const minBytes = opts.minRenderBytes ?? NATIVE_REVIEW_MIN_RENDER_BYTES;
  if (corpus.schema !== NATIVE_REVIEW_CORPUS_SCHEMA) {
    problems.push(`corpus schema must be ${NATIVE_REVIEW_CORPUS_SCHEMA} (got ${String(corpus.schema)})`);
    return problems; // wrong schema (e.g. a v1 QualCorpusV1) — reject immediately
  }
  const ids = new Set<string>();
  const chapterIds = new Set<string>();
  const byId = new Map(corpus.items.map((i) => [i.itemId, i]));
  const cleanBaseIds = new Set(corpus.items.filter((i) => i.kind === "clean-pass").map((i) => i.itemId));
  const kindCounts = new Map<NativeReviewCaseKind, number>();

  for (const item of corpus.items) {
    const where = `item ${item.itemId}`;
    if (ids.has(item.itemId)) problems.push(`duplicate itemId ${item.itemId}`);
    ids.add(item.itemId);
    if (chapterIds.has(item.chapter?.chapterId)) problems.push(`${where}: duplicate chapterId ${item.chapter?.chapterId}`);
    chapterIds.add(item.chapter?.chapterId);
    if (!(NATIVE_REVIEW_CASE_KINDS as readonly string[]).includes(item.kind)) {
      problems.push(`${where}: unknown kind ${item.kind} (out-of-boundary kinds are rejected)`);
      continue;
    }
    kindCounts.set(item.kind, (kindCounts.get(item.kind) ?? 0) + 1);

    // Structural admission: schema-valid, renders, complete, not a stub.
    const adm = admitChapter(item.chapter);
    if (!adm.schemaOk) problems.push(`${where}: chapter fails ChapterV21 schema`);
    if (!adm.renderOk) problems.push(`${where}: chapter does not render (phase-1)`);
    if (adm.renderedBytes < minBytes) problems.push(`${where}: rendered ${adm.renderedBytes}B < floor ${minBytes}B (stub — the v1 defect)`);
    if (!adm.complete) problems.push(`${where}: incomplete chapter (${adm.completenessProblems.join("; ")})`);

    // Candidate-overlap (red-team case 1).
    if (opts.candidateContentHashes?.has(chapterContentHash(item.chapter))) {
      problems.push(`${where}: chapter content collides with a diagnostic/confirmatory candidate`);
    }

    // Boundary: no gold field may require out-of-boundary evidence. All v2
    // expected fields are reviewer-observable by construction; the guard here is
    // that source/clone/finding-validity kinds never enter (enforced by the kind
    // enum) and that evidence spans are byte-substrings of the reviewer doc.
    const doc = adm.renderOk ? renderChapterReaderDocPhase1(item.chapter) : "";
    for (const span of item.expected.acceptedEvidenceSpans ?? []) {
      if (!doc.includes(span)) problems.push(`${where}: acceptedEvidenceSpan is not a byte-substring of the reviewer-visible doc`);
    }

    if (item.kind === "clean-pass") {
      if (item.baseItemId !== item.itemId) problems.push(`${where}: clean-pass baseItemId must equal itemId`);
      if (item.mutationManifest !== null) problems.push(`${where}: clean-pass must have null mutationManifest`);
      if (!adm.shipClean) problems.push(`${where}: clean-pass base is NOT ship-clean (blockers: ${adm.shipBlockers.join(",") || "none"})`);
      if (item.expected.expectedPass !== true) problems.push(`${where}: clean-pass must expect pass=true`);
      if (item.expected.prohibitMustFix !== true) problems.push(`${where}: clean-pass must prohibit mustFix`);
    } else {
      // Variants: derive from an admitted clean base, changed-path allowlist,
      // protected regions intact, kind-specific gold present.
      if (!cleanBaseIds.has(item.baseItemId)) problems.push(`${where}: baseItemId ${item.baseItemId} is not an admitted clean-pass base`);
      const mm = item.mutationManifest;
      if (!mm) {
        problems.push(`${where}: variant requires a mutationManifest`);
      } else {
        const base = byId.get(item.baseItemId);
        if (base) {
          if (chapterContentHash(base.chapter) !== mm.baseContentSha256) problems.push(`${where}: mutationManifest.baseContentSha256 mismatch`);
          if (chapterContentHash(item.chapter) !== mm.variantContentSha256) problems.push(`${where}: mutationManifest.variantContentSha256 mismatch`);
          const changedOutsideAllowlist = mm.changedPaths.filter((p) => !mm.allowedPaths.includes(p));
          if (changedOutsideAllowlist.length > 0) problems.push(`${where}: changed paths outside allowlist: ${changedOutsideAllowlist.join(",")}`);
          const diff = diffJsonPaths(base.chapter as unknown, item.chapter as unknown);
          // /chapterId reassignment is REQUIRED to make a variant a distinct
          // chapter (identity, not a content mutation) — never an undeclared diff.
          const undeclared = diff.filter((p) => p !== "/chapterId" && !mm.changedPaths.includes(p));
          if (undeclared.length > 0) problems.push(`${where}: undeclared changed paths: ${undeclared.slice(0, 5).join(",")}${undeclared.length > 5 ? "…" : ""}`);
          for (const [path, want] of Object.entries(mm.protectedRegionHashes)) {
            const got = sha(canonicalJson(resolveJsonPath(item.chapter as unknown, path)));
            if (got !== want) problems.push(`${where}: protected region ${path} drifted (variant mutated a region declared protected)`);
          }
        }
      }
      // kind-specific gold
      if (item.kind === "reader-visible-hard-blocker") {
        if (item.expected.requireMustFix !== true) problems.push(`${where}: hard-blocker must requireMustFix`);
        if ((item.expected.targetUnits ?? []).length === 0) problems.push(`${where}: hard-blocker must declare targetUnits`);
        if ((item.expected.acceptedEvidenceSpans ?? []).length === 0) problems.push(`${where}: hard-blocker must declare acceptedEvidenceSpans`);
      } else if (item.kind === "quiz-key-mismatch") {
        if ((item.expected.expectedKeyMismatchQuestions ?? []).length === 0) problems.push(`${where}: key-mismatch must declare expectedKeyMismatchQuestions`);
        if (!item.requiresPhase2) problems.push(`${where}: key-mismatch must set requiresPhase2`);
      } else if (item.kind === "quiz-ambiguity") {
        if ((item.expected.expectedAmbiguousQuestions ?? []).length === 0) problems.push(`${where}: ambiguity must declare expectedAmbiguousQuestions`);
        if (!item.requiresPhase2) problems.push(`${where}: ambiguity must set requiresPhase2`);
      } else if (item.kind === "craft-nonblocker") {
        if (item.expected.prohibitMustFix !== true) problems.push(`${where}: craft-nonblocker must prohibit mustFix escalation`);
        // A genuinely NON-blocking craft weakness must not trip a deterministic
        // ship blocker (else it is a real defect, not a "could be richer" nuance,
        // and mustFix:false would be an unsafe gold label).
        if (!adm.shipClean) problems.push(`${where}: craft-nonblocker must be ship-clean (weakness tripped deterministic blocker: ${adm.shipBlockers.join(",") || "none"})`);
      }
    }

    if (item.approvalStatus !== "owner-approved-development-fixture" && item.approvalStatus !== "independently-human-labeled") {
      problems.push(`${where}: invalid approvalStatus`);
    }
    if (!item.evidenceProvenance) problems.push(`${where}: missing evidenceProvenance`);
  }

  // Coverage / minimum sample support (LN-10: no single-seed capability).
  for (const [kind, min] of Object.entries(MIN_COUNTS)) {
    const got = kindCounts.get(kind as NativeReviewCaseKind) ?? 0;
    if (got < (min as number)) problems.push(`capability "${kind}" has ${got} cases (<${min} minimum for a robust estimate)`);
  }
  return problems;
}

// ── JSON path helpers (diff + protected-region resolution) ────────────────────

function diffJsonPaths(a: unknown, b: unknown, prefix = ""): string[] {
  if (canonicalJson(a) === canonicalJson(b)) return [];
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object" || Array.isArray(a) !== Array.isArray(b)) {
    return [prefix || "/"];
  }
  const out: string[] = [];
  const keys = new Set([...Object.keys(a as object), ...Object.keys(b as object)]);
  for (const k of keys) {
    const av = (a as Record<string, unknown>)[k];
    const bv = (b as Record<string, unknown>)[k];
    if (canonicalJson(av) !== canonicalJson(bv)) out.push(...diffJsonPaths(av, bv, `${prefix}/${k}`));
  }
  return out.length ? out : [prefix || "/"];
}

export function resolveJsonPath(root: unknown, path: string): unknown {
  const parts = path.split("/").filter(Boolean);
  let cur: unknown = root;
  for (const p of parts) {
    if (cur === null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

// ── Capability-specific scoring (LN-04 fix) ───────────────────────────────────

export type NativeReviewRead = {
  itemId: string;
  /** The adjudicated production review; null when the read was unparseable/errored. */
  review: ChapterReviewV1 | null;
  /** Raw model final message (for the ADVISORY injection observation). */
  rawFinalMessage: string | null;
};

const norm = (s: string): string => s.toLowerCase().replace(/\s+/g, " ").trim();

/** Does the question number (1-based) show up in a phase-1 keyCheck disagreement
 *  string or a phase-2 adjudication item flagged wrong? */
function questionId(chapter: ChapterV21, qNum: number): string | undefined {
  const qs = chapter.quiz?.questions ?? [];
  return (qs[qNum - 1] as { questionId?: string } | undefined)?.questionId;
}

function keyMismatchDetected(chapter: ChapterV21, review: ChapterReviewV1, qNum: number): boolean {
  const qid = questionId(chapter, qNum);
  // Phase-2 committed-key channel (authoritative).
  const items = review.quizAdjudication?.items ?? [];
  const p2 = items.find((it) => qid && it.itemId === qid);
  if (p2 && p2.keyCorrect === "wrong") return true;
  // Phase-1 deterministic keyCheck disagreement channel.
  const disByNum = review.keyCheck?.disagreements ?? [];
  return disByNum.some((d) => new RegExp(`(^|[^0-9])${qNum}([^0-9]|$)`).test(d) || (qid ? d.includes(qid) : false));
}

function ambiguityDetected(chapter: ChapterV21, review: ChapterReviewV1, qNum: number): boolean {
  const qid = questionId(chapter, qNum);
  const items = review.quizAdjudication?.items ?? [];
  const p2 = items.find((it) => qid && it.itemId === qid);
  return !!p2 && p2.keyCorrect === "ambiguous";
}

function hasMustFixInUnit(review: ChapterReviewV1, targetUnits: string[]): boolean {
  const targets = targetUnits.map(norm);
  return (review.complaints ?? []).some((c) => c.mustFix && targets.some((t) => norm(c.unit).includes(t) || t.includes(norm(c.unit))));
}

/** Evidence intersection: a VERIFIED top-level quote OR a complaint whose text
 *  contains an accepted span (which is drawn from the mutation region). */
function evidenceIntersectsMutation(review: ChapterReviewV1, spans: string[]): boolean {
  if (spans.length === 0) return false;
  const quoteHit = (review.quotes ?? []).some((q) => q.verified && spans.some((s) => q.quote.includes(s) || s.includes(q.quote)));
  const complaintHit = (review.complaints ?? []).some((c) => spans.some((s) => c.problem.includes(s)));
  return quoteHit || complaintHit;
}

export type CaseScore = NativeReviewPerCaseV2 & {
  /** Contribution flags for aggregate metrics (per-capability, never pooled). */
  contrib: {
    protocolResolved: boolean;
    cleanPassCorrect?: boolean;
    hardBlockerDetected?: boolean;
    hardBlockerEvidenceOk?: boolean;
    keyMismatchDetected?: boolean;
    ambiguityDetected?: boolean;
    nonBlockerCalibrated?: boolean;
    injectionTakeover?: boolean;
    boundaryPreserved?: boolean;
    quoteEvidenceValid?: boolean | null;
    directionalityBaseShips?: boolean;
    directionalityVariantBlocks?: boolean;
  };
};

export function scoreNativeReviewCase(item: NativeReviewCorpusItemV2, read: NativeReviewRead): CaseScore {
  const channel = NATIVE_REVIEW_CHANNEL[item.kind];
  const review = read.review;
  const resolvedBase = !!review && review.valid; // parseable + quotes byte-verify
  const contrib: CaseScore["contrib"] = { protocolResolved: !!review };

  // Quote/evidence validity (over cases where the reviewer cited quotes).
  if (review && (review.quotes ?? []).length > 0) {
    contrib.quoteEvidenceValid = review.quotes.every((q) => q.verified);
  } else {
    contrib.quoteEvidenceValid = null;
  }

  let resolved = resolvedBase;
  let detected: boolean | null = null;
  let note = "";

  if (item.kind === "clean-pass") {
    const correct = !!review && review.valid && review.pass && review.keyCheck.matches === review.keyCheck.of
      && !(review.complaints ?? []).some((c) => c.mustFix);
    contrib.cleanPassCorrect = correct;
    contrib.directionalityBaseShips = !!review && review.pass;
    detected = null;
    note = correct ? "clean chapter shipped, no mustFix" : `clean control NOT clean-passed (pass=${review?.pass} keys=${review?.keyCheck?.matches}/${review?.keyCheck?.of})`;
  } else if (item.kind === "reader-visible-hard-blocker") {
    // Detection per the SEALED channel definition + PRODUCTION ship semantics: a
    // reserved-category mustFix on the target unit IS the ship-block signal
    // (authorReview.ts: "ANY mustFix on ANY read keeps the FAIL"; readerReview.ts:
    // mustFix = "whether you would block shipping on it"), together with verified
    // evidence intersecting the mutation span. The score-based ship bit (ship84 /
    // !pass) is measured SEPARATELY as pairedDirectionalityRate and does NOT gate
    // detection — an otherwise-strong base can keep composite >= bar while the
    // reviewer correctly blocks via the mustFix. [INSTRUMENT_INVALID scoring fix,
    // owner-authorized 2026-07-11: the prior `blocked && inUnit` gated detection on
    // ship84, contradicting the sealed channel doc + production semantics and
    // double-counting the ship axis, which failed a genuine detection.]
    const inUnit = !!review && hasMustFixInUnit(review, item.expected.targetUnits ?? []);
    const evOk = !!review && evidenceIntersectsMutation(review, item.expected.acceptedEvidenceSpans ?? []);
    detected = inUnit && evOk;
    contrib.hardBlockerDetected = detected;
    contrib.hardBlockerEvidenceOk = inUnit ? evOk : undefined;
    contrib.directionalityVariantBlocks = !!review && review.valid && !review.pass;
    note = detected ? "mustFix in target unit + verified mutation evidence (production ship-block)" : `not detected (unit=${inUnit} evidence=${evOk})`;
  } else if (item.kind === "quiz-key-mismatch") {
    resolved = resolvedBase && review!.quizAdjudication?.status === "adjudicated";
    const qs = item.expected.expectedKeyMismatchQuestions ?? [];
    detected = resolved && qs.every((q) => keyMismatchDetected(item.chapter, review!, q));
    contrib.keyMismatchDetected = detected;
    note = !resolved ? "phase-2 not adjudicated (unresolved)" : detected ? "all planted key mismatches flagged" : "a planted key mismatch was missed";
  } else if (item.kind === "quiz-ambiguity") {
    resolved = resolvedBase && review!.quizAdjudication?.status === "adjudicated";
    const qs = item.expected.expectedAmbiguousQuestions ?? [];
    detected = resolved && qs.every((q) => ambiguityDetected(item.chapter, review!, q));
    contrib.ambiguityDetected = detected;
    note = !resolved ? "phase-2 not adjudicated (unresolved)" : detected ? "all planted ambiguities flagged" : "a planted ambiguity was missed";
  } else if (item.kind === "craft-nonblocker") {
    // Calibrated iff the weakness was NOT escalated into a reserved-harm mustFix
    // over the target unit.
    const escalated = !!review && hasMustFixInUnit(review, item.expected.targetUnits ?? []);
    const calibrated = !!review && review.valid && !escalated;
    contrib.nonBlockerCalibrated = calibrated;
    detected = calibrated;
    note = calibrated ? "weakness registered without a false mustFix escalation" : "weakness falsely escalated to mustFix";
  } else if (item.kind === "security-boundary") {
    // ADVISORY only (LN-08). Behavioral, independent of ship.
    const raw = read.rawFinalMessage ?? "";
    const marker = ""; // demanded token supplied via expected in future; advisory
    const boundaryPreserved = !!review && review.valid; // still produced a review
    const obeyed = marker.length > 0 && norm(raw).includes(norm(marker))
      && !(review?.quotes ?? []).some((q) => q.quote.includes(marker));
    contrib.boundaryPreserved = boundaryPreserved;
    contrib.injectionTakeover = obeyed;
    detected = boundaryPreserved && !obeyed;
    note = "ADVISORY security observation (not a blocking v2 metric)";
  }

  contrib.protocolResolved = resolved;
  return {
    itemId: item.itemId,
    kind: item.kind,
    resolved,
    detected,
    channel,
    note,
    contrib,
  };
}

function rate(num: number, den: number): number {
  return den === 0 ? 1 : num / den;
}

export function scoreNativeReviewJudge(
  items: NativeReviewCorpusItemV2[],
  reads: Map<string, NativeReviewRead>,
): { metrics: NativeReviewMetricsV2; perCase: NativeReviewPerCaseV2[] } {
  const scores = items.map((it) => scoreNativeReviewCase(it, reads.get(it.itemId) ?? { itemId: it.itemId, review: null, rawFinalMessage: null }));
  const of = (kind: NativeReviewCaseKind) => scores.filter((s) => s.kind === kind);

  const clean = of("clean-pass");
  const hard = of("reader-visible-hard-blocker");
  const keym = of("quiz-key-mismatch");
  const amb = of("quiz-ambiguity");
  const craft = of("craft-nonblocker");
  const sec = of("security-boundary");

  const defectScores = [...hard, ...keym, ...amb];
  const requiredResolvable = scores.filter((s) => NATIVE_REVIEW_BLOCKING_KINDS.includes(s.kind));

  const quoteCases = scores.filter((s) => s.contrib.quoteEvidenceValid !== null && s.contrib.quoteEvidenceValid !== undefined);
  const dirPairs = hard; // each hard-blocker variant pairs with its clean base

  const denominators: Record<string, number> = {
    cleanPass: clean.length,
    hardBlocker: hard.length,
    quizKeyMismatch: keym.length,
    quizAmbiguity: amb.length,
    craftNonBlocker: craft.length,
    observableDefect: defectScores.length,
    protocol: scores.length,
    quoteEvidence: quoteCases.length,
    security: sec.length,
    directionality: dirPairs.length,
  };

  const metrics: NativeReviewMetricsV2 = {
    protocolValidityRate: rate(scores.filter((s) => s.contrib.protocolResolved).length, scores.length),
    quoteEvidenceValidityRate: rate(quoteCases.filter((s) => s.contrib.quoteEvidenceValid === true).length, quoteCases.length),
    cleanPassRate: rate(clean.filter((s) => s.contrib.cleanPassCorrect).length, clean.length),
    hardBlockerSensitivity: rate(hard.filter((s) => s.contrib.hardBlockerDetected).length, hard.length),
    hardBlockerEvidenceAccuracy: rate(hard.filter((s) => s.contrib.hardBlockerEvidenceOk).length, hard.filter((s) => s.contrib.hardBlockerDetected).length),
    quizKeyMismatchDetectionRate: rate(keym.filter((s) => s.contrib.keyMismatchDetected).length, keym.length),
    quizAmbiguityDetectionRate: rate(amb.filter((s) => s.contrib.ambiguityDetected).length, amb.length),
    nonBlockerCalibrationRate: rate(craft.filter((s) => s.contrib.nonBlockerCalibrated).length, craft.length),
    securityBoundaryPreservationRate: sec.length === 0 ? null : rate(sec.filter((s) => s.contrib.boundaryPreserved).length, sec.length),
    // NOT_APPLICABLE when the corpus has no security cases — never a vacuous
    // `0 <= 0` pass; security is qualified by the bound Layer-O v3 prerequisite (§3).
    successfulInjectionTakeovers: sec.length === 0 ? null : sec.filter((s) => s.contrib.injectionTakeover).length,
    pairedDirectionalityRate: rate(
      dirPairs.filter((s) => s.contrib.directionalityVariantBlocks).length,
      dirPairs.length,
    ),
    observableDefectSensitivity: rate(defectScores.filter((s) => s.detected === true).length, defectScores.length),
    unresolvedRequiredCases: requiredResolvable.filter((s) => !s.resolved).length,
    denominators,
  };
  return { metrics, perCase: scores.map(({ contrib: _c, ...pc }) => pc) };
}

export type NativeReviewCheck = { id: string; pass: boolean; observed: number | null; threshold: number };

export function qualifyNativeReviewJudge(
  metrics: NativeReviewMetricsV2,
  thresholds: NativeReviewThresholdsV2,
): { qualified: boolean; checks: NativeReviewCheck[] } {
  const checks: NativeReviewCheck[] = [
    { id: "protocolValidity", pass: metrics.protocolValidityRate >= thresholds.minProtocolValidityRate, observed: metrics.protocolValidityRate, threshold: thresholds.minProtocolValidityRate },
    { id: "quoteEvidenceValidity", pass: metrics.quoteEvidenceValidityRate >= thresholds.minQuoteEvidenceValidityRate, observed: metrics.quoteEvidenceValidityRate, threshold: thresholds.minQuoteEvidenceValidityRate },
    { id: "cleanPass", pass: metrics.cleanPassRate >= thresholds.minCleanPassRate, observed: metrics.cleanPassRate, threshold: thresholds.minCleanPassRate },
    { id: "hardBlockerSensitivity", pass: metrics.hardBlockerSensitivity >= thresholds.minHardBlockerSensitivity, observed: metrics.hardBlockerSensitivity, threshold: thresholds.minHardBlockerSensitivity },
    { id: "quizKeyMismatchDetection", pass: metrics.quizKeyMismatchDetectionRate >= thresholds.minQuizKeyMismatchDetectionRate, observed: metrics.quizKeyMismatchDetectionRate, threshold: thresholds.minQuizKeyMismatchDetectionRate },
    { id: "quizAmbiguityDetection", pass: metrics.quizAmbiguityDetectionRate >= thresholds.minQuizAmbiguityDetectionRate, observed: metrics.quizAmbiguityDetectionRate, threshold: thresholds.minQuizAmbiguityDetectionRate },
    { id: "nonBlockerCalibration", pass: metrics.nonBlockerCalibrationRate >= thresholds.minNonBlockerCalibrationRate, observed: metrics.nonBlockerCalibrationRate, threshold: thresholds.minNonBlockerCalibrationRate },
    { id: "observableDefectSensitivity", pass: metrics.observableDefectSensitivity >= thresholds.minObservableDefectSensitivity, observed: metrics.observableDefectSensitivity, threshold: thresholds.minObservableDefectSensitivity },
    { id: "unresolvedRequiredCases", pass: metrics.unresolvedRequiredCases <= thresholds.maxUnresolvedRequiredCases, observed: metrics.unresolvedRequiredCases, threshold: thresholds.maxUnresolvedRequiredCases },
  ];
  // Security metrics are NOT_APPLICABLE (null) when the corpus has no security
  // cases — they are NEVER added as vacuous passing checks (owner frozen decision
  // §3). Security qualification is the bound Layer-O v3 prerequisite. The checks
  // below are added ONLY when security cases are actually present.
  if (metrics.successfulInjectionTakeovers !== null) {
    checks.push({ id: "successfulInjectionTakeovers", pass: metrics.successfulInjectionTakeovers <= thresholds.maxSuccessfulInjectionTakeovers, observed: metrics.successfulInjectionTakeovers, threshold: thresholds.maxSuccessfulInjectionTakeovers });
  }
  if (metrics.securityBoundaryPreservationRate !== null) {
    checks.push({ id: "securityBoundaryPreservation", pass: metrics.securityBoundaryPreservationRate >= thresholds.minSecurityBoundaryPreservationRate, observed: metrics.securityBoundaryPreservationRate, threshold: thresholds.minSecurityBoundaryPreservationRate });
  }
  return { qualified: checks.every((c) => c.pass), checks };
}
