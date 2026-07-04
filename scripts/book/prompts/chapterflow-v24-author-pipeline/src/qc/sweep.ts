import { existsSync, readFileSync, readdirSync } from "fs";
import { writeFileAtomic } from "../lib/atomicWrite.js";
import { resolve } from "path";

import { ChapterV21 } from "../types.js";
import { CANONICAL_STATE, parseChapterId } from "../lib/chapterPaths.js";
import { chapterContentHash } from "../critics/qcAttestation.js";
import { loadQcRound, verifyQcRoundToken } from "./qcRound.js";
import { loadBookChapters } from "./manualKeyJudge.js";
import { evidenceSourceRef } from "./orchestrator/evidenceSource.js";
import { QC_ORCHESTRATOR_DIR, roundRecordPath as orchestratorRoundRecordPath, submissionsDir, sweepRoundRecordPath } from "./orchestrator/artifacts.js";
import type { ValidatedSweepSubmission } from "./orchestrator/schemas.js";
import { nondistinctiveRepetitionQuote } from "./orchestrator/findingValidity.js";
import {
  SWEEP_FAMILIES,
  isSweepFamily,
  sweepDefectKey,
  sweepDefectFingerprintV2,
  deriveDefectFingerprints,
  SWEEP_DEFECT_FINGERPRINT_VERSION,
  type SweepFamily as SweepSpecFamily,
  type SweepDefectFingerprintVersion,
  type SweepDefectFingerprintInput,
} from "./sweepSpec.js";

export const QC_DIR = resolve(CANONICAL_STATE, "qc");
export const SWEEP_PACKS_DIR = resolve(CANONICAL_STATE, "qc-packs");
// The canonical family list lives in sweepSpec (the ONE spec shared by the formal sweep and
// the pre-QC scout). Re-exported here under its historical name so existing importers are
// unchanged.
export const REQUIRED_SWEEP_FAMILIES = SWEEP_FAMILIES;
export type SweepFamily = SweepSpecFamily;
// Re-export the sweep-defect identity primitives (extracted to sweepSpec so scout and sweep
// share ONE definition of what "the same defect" is). Public API — imported by tests + QC code.
export { sweepDefectKey, sweepDefectFingerprintV2, SWEEP_DEFECT_FINGERPRINT_VERSION };
export type { SweepDefectFingerprintVersion, SweepDefectFingerprintInput };

export type SweepPack = {
  schemaVersion: "sweep-pack-v1";
  bookId: string;
  roundId: string;
  createdAt: string;
  chapters: Array<{
    chapterNumber: number;
    chapterId: string;
    contentHash: string;
    title: string;
    hook: string;
    counterintuition: string;
    keyTakeaway: string;
    tryThisNow: string;
    breakdown: {
      fastRead: string;
      deepRead: string;
      fullRead: string;
    };
    examples: Array<{
      title: string;
      scenario: string;
      whatToDo: string;
      whyItMatters: string;
    }>;
    quiz: Array<{
      prompt: string;
      choices: string[];
    }>;
    reviewCards: Array<{
      front: string;
      back: string;
    }>;
    implementationPlan: {
      coreSkill?: string;
      challenge?: string;
      twentyFourHourChallenge?: string;
      weeklyPractice?: string;
      ifThenPlans: Array<{ context: string; plan: string }>;
    };
    memorableLines: string[];
  }>;
};

export type SweepRecord = {
  schemaVersion: "sweep-attest-v1";
  bookId: string;
  roundId: string;
  verdict: "PASS" | "REVISE" | "CORRUPTION";
  reviewer: string;
  attestedAt: string;
  rawSubmissionFile?: string;
  rawEvidenceSourceId?: string;
  rawEvidenceSourceKind?: "raw_submission" | "derived_artifact";
  reviewerSessionId?: string;
  carriedFromRoundId?: string;
  /** Version marker for the per-affected-chapter defect fingerprints carried on each
   *  finding (`defectFingerprints`). New records set "sweep-defect-v2"; legacy records
   *  omit it and have their v2 fingerprints derived at read time (never rewritten on disk). */
  fingerprintVersion?: SweepDefectFingerprintVersion;
  contentHashes: Record<string, string>;
  checkedFamilies: SweepFamily[];
  findings: Array<{
    family: SweepFamily;
    /** Stable server-derived WHOLE-FINDING key (sweep-defect-v1) for the exact grounded
     *  sweep defect. New records always carry it; legacy records derive it at read time.
     *  Retained for v1 history compatibility; the effective corroboration evaluator now
     *  keys on the per-chapter `defectFingerprints` (sweep-defect-v2) instead. */
    defectKey?: string;
    /** Per-affected-chapter sweep-defect-v2 fingerprints — one entry per named chapter that
     *  has a content hash on this record. Server-derived & validated like `defectKey`; legacy
     *  records derive them at read time. Cross-round corroboration keys on THESE (per chapter),
     *  so two independent reads corroborate on the chapters they SHARE even when they phrase the
     *  problem differently or name overlapping (not identical) chapter sets. */
    defectFingerprints?: Array<{ chapter: number; fingerprint: string }>;
    // Whether this finding gates the chapters it names. Mirrors finalize's `openSerious`
    // ledger contract: a blocker (or major) sweep finding blocks; an advisory (or minor)
    // observation is surfaced but never gates. Collapsed to two tiers at write time.
    // Legacy records predate this field; readers treat an absent severity as "blocker"
    // (fail-closed — preserves the pre-severity "every named finding FAILs" behavior).
    severity: "blocker" | "advisory";
    chapters: number[];
    unitId: string;
    quote: string;
    problem: string;
    expectedFix: string;
  }>;
  notes?: string;
};

export type SweepFinding = { checkId: string; severity: "blocker" | "advisory"; message: string };

export function sweepPackPath(bookId: string, roundId: string): string {
  return resolve(SWEEP_PACKS_DIR, bookId, roundId, "sweep-pack.json");
}

export function sweepRecordPath(bookId: string): string {
  return resolve(QC_DIR, `${bookId}.sweep.json`);
}

export { sweepRoundRecordPath } from "./orchestrator/artifacts.js";

/** Cache/index path. The authoritative history is the immutable
 *  `qc-orchestrator/<book>/<round>/sweep-record.json` files; this JSONL is rebuilt
 *  from them and may be deleted without losing evidence. */
export function sweepHistoryPath(bookId: string): string {
  return resolve(QC_DIR, `${bookId}.sweep-history.jsonl`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}


function canonicalFingerprints(arr?: Array<{ chapter: number; fingerprint: string }>): string {
  return JSON.stringify(
    [...(arr ?? [])]
      .map((e) => [Number(e.chapter), String(e.fingerprint)] as const)
      .sort((a, b) => a[0] - b[0]),
  );
}

function normalizeSweepRecord(rec: SweepRecord): SweepRecord {
  const contentHashes = Object.fromEntries(Object.entries(rec.contentHashes ?? {}).map(([k, v]) => [String(k), String(v)]));
  const base = { ...rec, contentHashes };
  return {
    ...base,
    // New records carry the v2 fingerprint version; reading a legacy record derives v2 in memory
    // (its on-disk evidence is never rewritten) and the normalized form is marked v2 as well.
    fingerprintVersion: SWEEP_DEFECT_FINGERPRINT_VERSION,
    findings: (rec.findings ?? []).map((f) => {
      const normalized = {
        ...f,
        severity: f.severity ?? "blocker",
        chapters: [...new Set((f.chapters ?? []).map(Number).filter((n) => Number.isInteger(n) && n > 0))].sort((a, b) => a - b),
        unitId: String(f.unitId ?? ""),
        quote: String(f.quote ?? ""),
        problem: String(f.problem ?? ""),
        expectedFix: String(f.expectedFix ?? ""),
      };
      // v1 whole-finding key — kept for history compatibility; a stored v1 key must still validate.
      const derived = sweepDefectKey(base, normalized);
      if (normalized.defectKey && normalized.defectKey !== derived) {
        throw new Error(`sweep defectKey mismatch for ${rec.bookId} ${rec.roundId} ${normalized.family}/${normalized.unitId}: expected ${derived}, got ${normalized.defectKey}`);
      }
      // v2 per-chapter fingerprints — derive when enough fields are present; if a record already
      // carries them, they must match the re-derivation (tamper-evidence, same contract as defectKey).
      const fingerprints = deriveDefectFingerprints(base, normalized);
      if (normalized.defectFingerprints && canonicalFingerprints(normalized.defectFingerprints) !== canonicalFingerprints(fingerprints)) {
        throw new Error(`sweep defectFingerprints mismatch for ${rec.bookId} ${rec.roundId} ${normalized.family}/${normalized.unitId}: expected ${canonicalFingerprints(fingerprints)}, got ${canonicalFingerprints(normalized.defectFingerprints)}`);
      }
      return { ...normalized, defectKey: derived, defectFingerprints: fingerprints };
    }),
  };
}

function assertSweepRecordIntegrity(rec: SweepRecord, path: string, expected?: { bookId?: string; roundId?: string }): SweepRecord {
  if (rec.schemaVersion !== "sweep-attest-v1") throw new Error(`${path}: schemaVersion must be sweep-attest-v1`);
  if (expected?.bookId && rec.bookId !== expected.bookId) throw new Error(`${path}: bookId mismatch, expected ${expected.bookId}, got ${String(rec.bookId)}`);
  if (expected?.roundId && rec.roundId !== expected.roundId) throw new Error(`${path}: roundId mismatch, expected ${expected.roundId}, got ${String(rec.roundId)}`);
  if (!rec.bookId || !rec.roundId) throw new Error(`${path}: bookId and roundId are required`);
  if (!["PASS", "REVISE", "CORRUPTION"].includes(rec.verdict)) throw new Error(`${path}: verdict must be PASS, REVISE, or CORRUPTION`);
  if (!rec.reviewer) throw new Error(`${path}: reviewer is required`);
  if (!isRecord(rec.contentHashes) || Object.keys(rec.contentHashes).length === 0) throw new Error(`${path}: contentHashes is required and must not be empty`);
  for (const [chapter, hash] of Object.entries(rec.contentHashes)) {
    if (!/^\d+$/.test(chapter) || typeof hash !== "string" || !hash) throw new Error(`${path}: contentHashes.${chapter} must be a non-empty string hash`);
  }
  if (!Array.isArray(rec.checkedFamilies)) throw new Error(`${path}: checkedFamilies[] is required`);
  for (const family of rec.checkedFamilies) if (!isSweepFamily(family)) throw new Error(`${path}: unknown checkedFamily ${String(family)}`);
  if (!Array.isArray(rec.findings)) throw new Error(`${path}: findings[] is required`);
  const normalized = normalizeSweepRecord(rec);
  normalized.findings.forEach((f, i) => {
    if (!isSweepFamily(f.family)) throw new Error(`${path}: findings[${i}].family must be one of ${REQUIRED_SWEEP_FAMILIES.join(", ")}`);
    if (f.severity !== "blocker" && f.severity !== "advisory") throw new Error(`${path}: findings[${i}].severity must be blocker or advisory`);
    if (f.chapters.length === 0) throw new Error(`${path}: findings[${i}].chapters must list affected chapters`);
    for (const n of f.chapters) {
      if (!normalized.contentHashes[String(n)]) throw new Error(`${path}: findings[${i}] names chapter ${n} but contentHashes.${n} is missing`);
    }
    for (const key of ["unitId", "quote", "problem", "expectedFix"] as const) {
      if (!String(f[key] ?? "").trim()) throw new Error(`${path}: findings[${i}].${key} is required`);
    }
  });
  return normalized;
}

function readSweepRecordFile(path: string, expected?: { bookId?: string; roundId?: string }): SweepRecord {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    throw new Error(`${path}: corrupt sweep record (${(err as Error).message})`);
  }
  if (!isRecord(raw)) throw new Error(`${path}: sweep record must be a JSON object`);
  return assertSweepRecordIntegrity(raw as SweepRecord, path, expected);
}

function sameImmutableSweepEvidence(a: SweepRecord, b: SweepRecord): boolean {
  const strip = (rec: SweepRecord) => {
    const { attestedAt: _attestedAt, ...rest } = normalizeSweepRecord(rec);
    return rest;
  };
  return JSON.stringify(strip(a)) === JSON.stringify(strip(b));
}

function writeSweepHistoryCache(bookId: string, records: SweepRecord[]): void {
  const ordered = [...records].sort((a, b) => a.roundId.localeCompare(b.roundId));
  writeFileAtomic(sweepHistoryPath(bookId), `${ordered.map((r) => JSON.stringify(normalizeSweepRecord(r))).join("\n")}${ordered.length ? "\n" : ""}`);
  if (records[0]) writeFileAtomic(sweepRecordPath(bookId), JSON.stringify(normalizeSweepRecord(records[0]), null, 2));
}

function writeImmutableSweepRoundRecord(rec: SweepRecord): SweepRecord {
  const candidate = assertSweepRecordIntegrity(rec, sweepRoundRecordPath(rec.bookId, rec.roundId), { bookId: rec.bookId, roundId: rec.roundId });
  const p = sweepRoundRecordPath(candidate.bookId, candidate.roundId);
  if (existsSync(p)) {
    const existing = readSweepRecordFile(p, { bookId: candidate.bookId, roundId: candidate.roundId });
    if (!sameImmutableSweepEvidence(existing, candidate)) {
      throw new Error(`Immutable sweep record already exists with different evidence: ${p}. Start a fresh QC round instead of replacing per-round sweep evidence.`);
    }
    return existing;
  }
  writeFileAtomic(p, JSON.stringify(candidate, null, 2));
  return candidate;
}

function roundHasSweepSubmission(bookId: string, roundId: string): boolean {
  const dir = submissionsDir(bookId, roundId, "sweep");
  if (!existsSync(dir)) return false;
  return readdirSync(dir).some((f) => f.endsWith(".json") && !f.endsWith(".meta.json"));
}

function loadLegacySweepHistoryCache(bookId: string): SweepRecord[] {
  const p = sweepHistoryPath(bookId);
  if (!existsSync(p)) return [];
  let lines: string[];
  try {
    lines = readFileSync(p, "utf8").split("\n").filter((l) => l.trim());
  } catch {
    return [];
  }
  const byRound = new Map<string, SweepRecord>();
  for (const line of lines) {
    try {
      const rec = normalizeSweepRecord(JSON.parse(line) as SweepRecord);
      if (rec && typeof rec.roundId === "string") byRound.set(rec.roundId, rec);
    } catch {
      return [];
    }
  }
  return [...byRound.values()].sort((a, b) => String(b.roundId ?? "").localeCompare(String(a.roundId ?? "")));
}

function scanSweepRoundRecords(bookId: string): SweepRecord[] {
  const root = resolve(QC_ORCHESTRATOR_DIR, bookId);
  if (!existsSync(root)) return [];
  const records: SweepRecord[] = [];
  const seen = new Map<string, string>();
  const errors: string[] = [];
  for (const entry of readdirSync(root).sort()) {
    const roundPath = orchestratorRoundRecordPath(bookId, entry);
    const recordPath = sweepRoundRecordPath(bookId, entry);
    if (existsSync(recordPath)) {
      try {
        const rec = readSweepRecordFile(recordPath, { bookId, roundId: entry });
        const prior = seen.get(rec.roundId);
        if (prior) errors.push(`duplicate sweep round record for ${rec.roundId}: ${prior} and ${recordPath}`);
        else seen.set(rec.roundId, recordPath);
        records.push(rec);
      } catch (err) {
        errors.push((err as Error).message);
      }
    } else if (existsSync(roundPath) && roundHasSweepSubmission(bookId, entry)) {
      errors.push(`Missing immutable sweep record for ${bookId} ${entry}: expected ${recordPath}`);
    }
  }
  if (errors.length) throw new Error(`Sweep history integrity failure for ${bookId}:\n${errors.map((e) => `- ${e}`).join("\n")}`);
  return records.sort((a, b) => b.roundId.localeCompare(a.roundId));
}

export function rebuildSweepHistory(bookId: string): SweepRecord[] {
  const records = scanSweepRoundRecords(bookId);
  if (records.length > 0) writeSweepHistoryCache(bookId, records);
  return records;
}

/** Persist one immutable per-round sweep record and rebuild the non-authoritative
 *  latest/history cache from round records. Conflicting rewrites fail loudly. */
export function appendSweepHistory(rec: SweepRecord): SweepRecord {
  const stored = writeImmutableSweepRoundRecord(rec);
  rebuildSweepHistory(rec.bookId);
  // P09 — materialize the per-chapter clear ledger from the (now-updated) history. Its EXISTENCE
  // opts the book into per-chapter carry-forward; its contents are a rebuildable cache (the eval
  // derives from history, never from these bytes). Best-effort: a materialization failure must not
  // break attestation — the ledger is a derived view and will be rebuilt on the next append.
  try { writeChapterClearLedger(rec.bookId); } catch { /* derived cache; rebuilt next append */ }
  return stored;
}

/** Load per-round sweep history NEWEST-FIRST. Immutable round records are the
 *  authority; the JSONL cache is used only as a legacy fallback when no round
 *  records exist yet. */
export function loadSweepHistory(bookId: string): SweepRecord[] {
  const authoritative = scanSweepRoundRecords(bookId);
  return authoritative.length > 0 ? authoritative : loadLegacySweepHistoryCache(bookId);
}

/** The sweep record from the round immediately PRIOR to `currentRoundId` (the next-older record
 *  in newest-first history). null when there is no prior round. When `currentRoundId` is not yet in
 *  history (its record hasn't been appended), the newest existing record IS the prior. Used for
 *  cross-round corroboration — never returns a NEWER round (the oldest round has no prior). */
export function priorSweepRecord(bookId: string, currentRoundId: string): SweepRecord | null {
  const hist = loadSweepHistory(bookId); // newest-first
  const idx = hist.findIndex((r) => r.roundId === currentRoundId);
  if (idx === -1) return hist[0] ?? null; // current round not yet recorded → newest is the prior
  return hist[idx + 1] ?? null; // the next-older record (none ⇒ this is the oldest round)
}

/** Does this record's findings GATE the given chapter? (a non-advisory, distinctiveness-valid
 *  finding that NAMES the chapter). The pure per-record half of the gate, shared by the
 *  per-chapter status and the cross-round corroboration check. */
export function recordGatesChapter(rec: SweepRecord | null, chapterNumber: number): boolean {
  if (!rec) return false;
  if (rec.verdict === "PASS") return false;
  return (rec.findings ?? []).filter(sweepFindingBlocks).some((f) => (f.chapters ?? []).includes(chapterNumber));
}

// Per-field excerpt cap for the sweep pack. The sweep is the ONE book-wide reviewer (a
// single read gates the whole book), so an unbounded field would grow its context without
// limit on a large/aberrant book → higher timeout (→ SIGKILL → round fails) + noisier,
// less stable reads. Cross-chapter templating (scene skeletons, openers, repeated units)
// lives in the HEAD of each field, so a generous head-cap preserves the signal while bounding
// the pack. 6000 is a no-op for the entire current corpus (measured max field ≈ 3.9K chars);
// it only bites a pathological/future field. (We deliberately do NOT window the sweep across
// CHAPTERS — it exists to compare ACROSS chapters, so chunking would break its detection.)
const SWEEP_FIELD_MAX = 6000;
function capSweepField(s: string, max = SWEEP_FIELD_MAX): string {
  return s.length > max ? `${s.slice(0, max)}\n…[truncated for sweep — ${s.length - max} more chars]` : s;
}

export function writeSweepPack(bookId: string, roundId: string): string {
  const chapters = loadBookChapters(bookId);
  const pack: SweepPack = {
    schemaVersion: "sweep-pack-v1",
    bookId,
    roundId,
    createdAt: new Date().toISOString(),
    chapters: chapters.map((ch) => ({
      chapterNumber: ch.number,
      chapterId: ch.chapterId,
      contentHash: chapterContentHash(ch),
      title: ch.title ?? "",
      hook: ch.hook ?? "",
      counterintuition: ch.counterintuition ?? "",
      keyTakeaway: ch.keyTakeaway ?? "",
      tryThisNow: capSweepField(ch.tryThisNow ?? ""),
      breakdown: {
        fastRead: capSweepField(ch.breakdown?.fastRead ?? ""),
        deepRead: capSweepField(ch.breakdown?.deepRead ?? ""),
        fullRead: capSweepField(ch.breakdown?.fullRead ?? ""),
      },
      examples: (ch.examples ?? []).map((ex) => ({
        title: ex.title ?? "",
        scenario: capSweepField(ex.scenario ?? ""),
        whatToDo: capSweepField(ex.whatToDo ?? ""),
        whyItMatters: capSweepField(ex.whyItMatters ?? ""),
      })),
      quiz: (ch.quiz?.questions ?? []).map((q) => ({
        prompt: q.prompt ?? "",
        choices: Array.isArray(q.choices) ? q.choices.map(String) : [],
      })),
      reviewCards: (ch.reviewCards ?? []).map((card) => ({
        front: card.front ?? "",
        back: card.back ?? "",
      })),
      implementationPlan: {
        coreSkill: ch.implementationPlan?.coreSkill,
        // Only emit a REAL `challenge` (no v21 chapter has one). The old `?? twentyFourHourChallenge`
        // fallback duplicated the 24h-challenge text into a SECOND pack field, and the sweep correctly
        // flagged that self-duplication as repeated_unit ("challenge == twentyFourHourChallenge verbatim")
        // on EVERY chapter — a pack artifact, not a content defect, that false-gated the whole book.
        challenge: (ch.implementationPlan as any)?.challenge,
        twentyFourHourChallenge: ch.implementationPlan?.twentyFourHourChallenge,
        weeklyPractice: ch.implementationPlan?.weeklyPractice,
        ifThenPlans: (ch.implementationPlan?.ifThenPlans ?? []).map((plan) => ({ context: plan.context ?? "", plan: plan.plan ?? "" })),
      },
      memorableLines: (ch.memorableLines ?? []).map((line: any) => typeof line === "string" ? line : String(line?.text ?? "")),
    })),
  };
  const p = sweepPackPath(bookId, roundId);
  writeFileAtomic(p, JSON.stringify(pack, null, 2));
  return p;
}

export function writeSweepRecordFromSubmission(submission: ValidatedSweepSubmission, rawSubmissionFile?: string): string {
  const chapters = loadBookChapters(submission.bookId);
  const contentHashes: Record<string, string> = {};
  for (const ch of chapters) contentHashes[String(ch.number)] = chapterContentHash(ch);
  const p = sweepRecordPath(submission.bookId);
  const rawEvidenceSourceKind = rawSubmissionFile ? "raw_submission" as const : "derived_artifact" as const;
  const source = evidenceSourceRef({
    bookId: submission.bookId,
    roundId: submission.roundId,
    sourceRole: "sweep",
    submissionFile: rawSubmissionFile ?? p,
    sourceKind: rawEvidenceSourceKind,
  });
  const rec: SweepRecord = {
    schemaVersion: "sweep-attest-v1",
    bookId: submission.bookId,
    roundId: submission.roundId,
    verdict: submission.verdict,
    reviewer: submission.reviewer,
    reviewerSessionId: submission.reviewerSessionId,
    attestedAt: new Date().toISOString(),
    rawSubmissionFile,
    rawEvidenceSourceId: source.sourceId,
    rawEvidenceSourceKind,
    contentHashes,
    checkedFamilies: submission.checkedFamilies,
    findings: submission.findings.flatMap((f) => {
      // FIX 3 — map the finding's repairClass to a family. A clearly factual/numeric finding
      // (which the sweep has no source to verify) is DROPPED; a real templating finding — even
      // one labeled descriptively rather than with a canonical family id — is KEPT and mapped,
      // so it stays actionable instead of collapsing the round into an empty fail-closed REVISE.
      const family = sweepFamilyForRepairClass(f.repairClass);
      if (!family) return [];
      const mapped = {
        family,
        severity: f.severity === "blocker" || f.severity === "major" ? "blocker" as const : "advisory" as const,
        chapters: f.chapters ?? (f.chapterNumber !== undefined ? [f.chapterNumber] : []),
        unitId: f.unitId,
        quote: f.quote,
        problem: f.problem,
        expectedFix: f.expectedFix,
      };
      const defectKey = sweepDefectKey({ bookId: submission.bookId, contentHashes }, mapped);
      if (f.defectKey && f.defectKey !== defectKey) {
        throw new Error(`sweep submission defectKey mismatch for ${submission.bookId} ${submission.roundId} ${family}/${f.unitId}: expected ${defectKey}, got ${f.defectKey}`);
      }
      return [{ ...mapped, defectKey }];
    }),
  };
  const stored = appendSweepHistory(rec);
  writeFileAtomic(p, JSON.stringify(stored, null, 2));
  return p;
}

/** Map a sweep submission's `repairClass` to one of the 4 families, or null to DROP it.
 *  Reviewers routinely label a real templating finding descriptively ("vary_scene_action",
 *  "deduplicate_practice_unit") rather than with the canonical family id — those must be KEPT
 *  and mapped, not dropped (dropping a real finding leaves an empty REVISE that fails the whole
 *  book closed with no actionable repair). Only a finding that is clearly FACTUAL/numeric (which
 *  the sweep has no source pack to verify, and which belongs to the bar's factual_accuracy axis)
 *  is dropped. */
export function sweepFamilyForRepairClass(repairClass: unknown): SweepFamily | null {
  if (isSweepFamily(repairClass)) return repairClass;
  // Normalize _ / - to spaces so word-boundary anchors work on snake/kebab labels.
  const c = String(repairClass ?? "").toLowerCase().replace(/[_-]+/g, " ");
  // A repetition/templating SIGNAL wins over the factual terms: labels like "source moment
  // reuse", "scene figure repetition", "reused figure caption", "repeated date stamp" are
  // REAL cross-chapter templating findings that merely contain a factual-sounding word
  // (figure/source/date). Dropping them as "factual" left an empty record that failed the
  // whole book closed — keep them and map to a family.
  const templatingSignal = /reuse|reused|repeat|repetition|recur|recurr|duplicat|\bdupe\b|identical|\bsame\b|template|stamp|uniform|\becho\b|copy|carbon|boilerplate|formula/;
  if (!templatingSignal.test(c) && /\bfact|numeric|number|\bstats?\b|statistic|accuracy|verif|citation|\bfigure\b|\bsource\b|\bdate\b/.test(c)) return null; // clearly factual (no repetition signal) → out of scope → drop. \bstats?\b matches stat/stats but NOT static/statement.
  if (/scene|frame|skeleton|vignette|opening|opener/.test(c)) return "scene_skeleton";
  if (/persona|\bname|\bcharacter\b|protagonist/.test(c)) return "persona_drift"; // \bcharacter\b so "characteristic"/"characterization" don't misroute a repeated-unit finding into persona_drift (a non-distinctiveness family → false gate, same class as the place/location fix below)
  // \b on place/location/setting so "replace"/"allocation"/"resetting" can't misroute a
  // repeated-unit finding into location_stamping. Without this, "replace-repeated-rhetorical-unit"
  // matched /place/ inside "rePLACE" → location_stamping (not a distinctiveness-required family),
  // so nondistinctiveRepetitionQuote could not demote its non-distinctive quote and it gated the
  // round (the the-organized-mind round-3 8/9→3/9 false flip). stamp stays unanchored so "stamping"
  // still routes here.
  if (/venue|\blocation\b|\bplace\b|stamp|clock|timing|\bsetting\b/.test(c)) return "location_stamping";
  return "repeated_unit"; // default templating bucket (cards / plans / practice / quiz / hooks)
}

function loadFindingsFile(path: string): { checkedFamilies: SweepFamily[]; findings: SweepRecord["findings"]; errors: string[] } {
  let raw: any;
  try {
    raw = JSON.parse(readFileSync(resolve(path), "utf8"));
  } catch (err) {
    return { checkedFamilies: [], findings: [], errors: [`Could not read findings file: ${(err as Error).message}`] };
  }
  const errors: string[] = [];
  const checkedFamilies = Array.isArray(raw?.checkedFamilies)
    ? raw.checkedFamilies.filter(isSweepFamily)
    : [];
  if (!Array.isArray(raw?.checkedFamilies)) errors.push("findings file must include checkedFamilies[]");
  for (const fam of raw?.checkedFamilies ?? []) if (!isSweepFamily(fam)) errors.push(`unknown checkedFamily: ${String(fam)}`);
  const findings = Array.isArray(raw?.findings) ? raw.findings.map((f: any, i: number) => {
    const family = f?.family;
    if (!isSweepFamily(family)) errors.push(`findings[${i}].family must be one of ${REQUIRED_SWEEP_FAMILIES.join(", ")}`);
    const chapters = Array.isArray(f?.chapters) ? f.chapters.map((n: unknown) => Number(n)).filter((n: number) => Number.isInteger(n) && n > 0) : [];
    if (chapters.length === 0) errors.push(`findings[${i}].chapters must list affected chapters`);
    for (const key of ["unitId", "quote", "problem", "expectedFix"] as const) {
      if (typeof f?.[key] !== "string" || !f[key].trim()) errors.push(`findings[${i}].${key} is required`);
    }
    const sev = String(f?.severity ?? "").toLowerCase();
    const severity: "blocker" | "advisory" = sev === "advisory" || sev === "minor" ? "advisory" : "blocker";
    return {
      family: isSweepFamily(family) ? family : "scene_skeleton",
      severity,
      chapters,
      unitId: String(f?.unitId ?? ""),
      quote: String(f?.quote ?? ""),
      problem: String(f?.problem ?? ""),
      expectedFix: String(f?.expectedFix ?? ""),
    };
  }) : [];
  if (!Array.isArray(raw?.findings)) errors.push("findings file must include findings[] (empty array is allowed)");
  return { checkedFamilies, findings, errors };
}

export function writeSweepAttestation(bookId: string, roundId: string, token: string, verdict: SweepRecord["verdict"], reviewer: string, findingsFile: string, notes?: string): { path?: string; error?: string } {
  if (!verifyQcRoundToken(bookId, roundId, "sweep", token)) {
    return { error: `Invalid sweep token for ${bookId} round ${roundId}.` };
  }
  if (!findingsFile) return { error: "sweep-attest requires --findings-file." };
  const loaded = loadFindingsFile(findingsFile);
  if (loaded.errors.length > 0) return { error: loaded.errors.join("; ") };
  if (verdict === "PASS") {
    const missing = REQUIRED_SWEEP_FAMILIES.filter((family) => !loaded.checkedFamilies.includes(family));
    if (missing.length > 0) return { error: `PASS requires checkedFamilies to include: ${missing.join(", ")}.` };
  }
  const chapters = loadBookChapters(bookId);
  const contentHashes: Record<string, string> = {};
  for (const ch of chapters) contentHashes[String(ch.number)] = chapterContentHash(ch);
  const rec: SweepRecord = {
    schemaVersion: "sweep-attest-v1",
    bookId,
    roundId,
    verdict,
    reviewer,
    attestedAt: new Date().toISOString(),
    contentHashes,
    checkedFamilies: loaded.checkedFamilies,
    findings: loaded.findings,
    notes,
  };
  const p = sweepRecordPath(bookId);
  const stored = appendSweepHistory(rec);
  writeFileAtomic(p, JSON.stringify(stored, null, 2));
  return { path: p };
}

/**
 * Content-addressed sweep carry-forward. The book-wide sweep is the single most
 * stochastic reviewer (a fresh whole-book read flags a rotating subset round to round).
 * When the ENTIRE book is byte-IDENTICAL to a prior PASS sweep — every chapter's content
 * hash matches AND the chapter SET is unchanged — re-running it can only re-roll the dice,
 * never surface a genuinely new cross-chapter pattern (a cross-chapter pattern is a property
 * of the whole book; if nothing moved, it cannot have changed). `sweepCarryable` is true
 * exactly then, so the caller may carry the prior PASS forward instead of spawning a codex
 * sweep session. Conservative: ANY changed/added/removed chapter ⇒ false ⇒ full fresh sweep.
 */
export function sweepCarryable(priorRec: SweepRecord | null, chapters: ChapterV21[]): boolean {
  if (!priorRec || priorRec.verdict !== "PASS") return false;
  if (!REQUIRED_SWEEP_FAMILIES.every((fam) => (priorRec.checkedFamilies ?? []).includes(fam))) return false;
  const priorHashes = priorRec.contentHashes ?? {};
  // The chapter SET must be identical (a new/removed chapter could introduce a
  // cross-chapter collision the prior sweep never read).
  if (Object.keys(priorHashes).length !== chapters.length) return false;
  for (const ch of chapters) {
    if (priorHashes[String(ch.number)] !== chapterContentHash(ch)) return false;
  }
  return true;
}

/** Re-stamp a prior PASS SweepRecord onto a new roundId (used only when sweepCarryable is
 *  true, so the carried hashes still match the current book). Faithfully copies the verdict,
 *  findings, checkedFamilies and contentHashes of a REAL prior PASS — it never fabricates a
 *  pass. The reviewer is marked `carry-forward` for auditability. */
export function carryForwardSweep(bookId: string, priorRec: SweepRecord, roundId: string): string {
  const rec: SweepRecord = {
    ...priorRec,
    roundId,
    reviewer: "carry-forward",
    reviewerSessionId: undefined,
    carriedFromRoundId: priorRec.roundId,
    attestedAt: new Date().toISOString(),
  };
  const p = sweepRecordPath(bookId);
  const stored = appendSweepHistory(rec);
  writeFileAtomic(p, JSON.stringify(stored, null, 2));
  return p;
}

export function loadSweepRecord(bookId: string): SweepRecord | null {
  const hist = loadSweepHistory(bookId);
  if (hist[0]) return hist[0];
  const p = sweepRecordPath(bookId);
  if (!existsSync(p)) return null;
  try {
    return normalizeSweepRecord(JSON.parse(readFileSync(p, "utf8")) as SweepRecord);
  } catch {
    return null;
  }
}

/**
 * Per-chapter sweep status for a round. The sweep VERDICT is book-level, but a
 * REVISE/CORRUPTION must only FAIL the chapters its findings actually NAME — else one
 * global finding (e.g. persona_drift across ch2/ch3) strands every other, clean chapter
 * in a non-publishable "[re-QC only]" bucket with no actionable repair. A non-PASS
 * verdict whose findings name NO chapters fails closed (an unexplained REVISE still
 * blocks). Returns MISSING when the record is absent or from another round, STALE when
 * the chapter's content moved under the sweep.
 */
/** A sweep finding GATES the chapters it names iff it is non-advisory AND, for the
 *  distinctiveness-required repetition families (scene_skeleton / repeated_unit), anchored on a
 *  discriminating quote. A repetition finding quoting a non-distinctive common phrase (e.g. the
 *  tense auxiliary "had already") cannot prove structural reuse, so it is surfaced but never gates
 *  — same non-gating contract as an advisory. Both the per-chapter gate (sweepChapterStatus) and the
 *  publish gate (checkSweep) route their blocker filter through this ONE predicate so they can never
 *  drift. See `nondistinctiveRepetitionQuote`. */
export function sweepFindingBlocks(f: SweepRecord["findings"][number]): boolean {
  return f.severity !== "advisory" && !nondistinctiveRepetitionQuote(f);
}

function sweepReadIdentity(rec: SweepRecord): string | null {
  if (rec.reviewer === "carry-forward") return null;
  if (rec.reviewerSessionId) return `session:${rec.reviewerSessionId}`;
  return null;
}

function independentSweepReads(a: SweepRecord, b: SweepRecord): boolean {
  if (a.roundId === b.roundId) return false;
  if (a.reviewer === "carry-forward" || b.reviewer === "carry-forward") return false;
  const ai = sweepReadIdentity(a);
  const bi = sweepReadIdentity(b);
  return !!ai && !!bi && ai !== bi;
}

function findingKey(rec: SweepRecord, finding: SweepRecord["findings"][number]): string {
  return finding.defectKey ?? sweepDefectKey(rec, finding);
}

/** Mechanism 1 — sticky per-defect carry / cross-round corroboration. A gate raised by the
 *  current round survives over byte-frozen content only when an INDEPENDENT prior sweep read named
 *  the SAME grounded defect ON THIS CHAPTER. Corroboration is decided per chapter on the v2
 *  fingerprint (family + unit + distinctive quote + chapter + bytes) — NOT the whole-finding v1 key
 *  — so two honest reads agree on a real defect even when they word the problem differently or name
 *  overlapping (not identical) chapter sets, while two UNRELATED defects on the same chapter (a
 *  different family/unit/quote) still cannot corroborate. */
function gateSurvivesCorroboration(current: SweepRecord, finding: SweepRecord["findings"][number], prior: SweepRecord | null, chapterNumber: number, currentContentHash: string): boolean {
  const frozenSincePrior = !!prior && prior.contentHashes?.[String(chapterNumber)] === currentContentHash;
  if (!frozenSincePrior) return true;
  if (!prior) return true;
  if (!independentSweepReads(prior, current)) return false;
  const fingerprint = sweepDefectFingerprintV2(current, finding, chapterNumber);
  // No v2 identity (chapter has no bytes on this record) → fail-safe: never demote a gate without
  // positive evidence that it is an uncorroborated flip.
  if (!fingerprint) return true;
  const priorNorm = normalizeSweepRecord(prior);
  return (priorNorm.findings ?? []).filter(sweepFindingBlocks).some((priorFinding) =>
    (priorFinding.chapters ?? []).includes(chapterNumber) &&
    sweepDefectFingerprintV2(priorNorm, priorFinding, chapterNumber) === fingerprint);
}

export type EffectiveSweepFinding = {
  finding: SweepRecord["findings"][number];
  defectKey: string;
  effectiveChapters: number[];
};

export type EffectiveSweepDecision = {
  record: SweepRecord;
  prior: SweepRecord | null;
  blockingFindings: EffectiveSweepFinding[];
  blockingChapters: Set<number>;
  failClosed: boolean;
};

export function effectiveSweepFindings(rec: SweepRecord, currentHashes: Record<string, string>, prior?: SweepRecord | null): EffectiveSweepDecision {
  const current = normalizeSweepRecord(rec);
  const priorRec = prior !== undefined ? (prior ? normalizeSweepRecord(prior) : null) : priorSweepRecord(current.bookId, current.roundId);
  const blockingFindings: EffectiveSweepFinding[] = [];
  const blockingChapters = new Set<number>();
  if (current.verdict !== "PASS") {
    for (const f of (current.findings ?? []).filter(sweepFindingBlocks)) {
      const effectiveChapters: number[] = [];
      for (const n of f.chapters ?? []) {
        const h = currentHashes[String(n)] ?? current.contentHashes[String(n)];
        if (current.verdict === "CORRUPTION" || h === undefined || gateSurvivesCorroboration(current, f, priorRec, n, h)) {
          effectiveChapters.push(n);
          blockingChapters.add(n);
        }
      }
      if (effectiveChapters.length > 0) blockingFindings.push({ finding: f, defectKey: findingKey(current, f), effectiveChapters });
    }
  }
  const blockers = (current.findings ?? []).filter(sweepFindingBlocks);
  const hasNamedBlocker = blockers.some((f) => (f.chapters ?? []).length > 0);
  const failClosed = current.verdict !== "PASS" && (current.verdict === "CORRUPTION" || (!hasNamedBlocker && (current.findings ?? []).length === 0));
  return { record: current, prior: priorRec, blockingFindings, blockingChapters, failClosed };
}

export function sweepChapterStatus(rec: SweepRecord | null, chapterNumber: number, contentHash: string, roundId: string, prior?: SweepRecord | null): "PASS" | "FAIL" | "STALE" | "MISSING" {
  if (!rec || rec.roundId !== roundId) return "MISSING";
  if (rec.contentHashes?.[String(chapterNumber)] !== contentHash) return "STALE";
  if (rec.verdict === "PASS") return "PASS";
  const findings = rec.findings ?? [];
  // Only a BLOCKER-severity finding gates the chapters it names. An ADVISORY sweep
  // observation (e.g. a stochastic unverifiable-number nit) is surfaced but never FAILs a
  // chapter — this mirrors finalize's `openSerious` ledger gate so the sweep can't be a
  // STRICTER gate than the publish decision it feeds. A finding with no severity (a legacy,
  // pre-severity record) is treated as a blocker (fail-closed).
  const blockers = findings.filter(sweepFindingBlocks);
  // Mechanism 1: a gate on THIS chapter only FAILs it if it survives cross-round corroboration
  // (an uncorroborated stochastic flip on byte-frozen content is demoted — see
  // gateSurvivesCorroboration). `prior` is injectable for tests; default loads the prior round.
  // A CORRUPTION verdict is NEVER demoted — corroboration suppresses only stochastic REVISE flips,
  // and checkSweep keeps an unconditional CORRUPTION block, so demoting it here would break parity.
  const decision = effectiveSweepFindings(rec, { [String(chapterNumber)]: contentHash }, prior);
  if (decision.blockingChapters.has(chapterNumber)) return "FAIL";
  // A blocker exists but does not name THIS chapter → this chapter passes (a global verdict
  // must not strand a clean, unnamed chapter).
  if (blockers.some((f) => (f.chapters ?? []).length > 0)) return "PASS";
  // No blocker names anything. The sweep must NOT be a STRICTER gate than the publish decision
  // it feeds (which ignores advisory/minor via openSerious=blocker/major). So:
  //  - the sweep CITED advisory/minor observations (findings.length > 0) on a REVISE: they are
  //    surfaced but never gate — every chapter PASSES (the convergence fix: an all-advisory
  //    sweep can no longer demote the whole book, the treadmill that stalled certification).
  //  - it cited NOTHING yet returned non-PASS, OR it returned CORRUPTION: an unexplained or
  //    serious-but-uncited verdict → fail closed for every chapter (never ship on that).
  if (findings.length > 0 && rec.verdict !== "CORRUPTION") return "PASS";
  return "FAIL";
}

/** Publish calibration (2026-07-04): sweep families that describe cross-book
 *  TEXTURE (style sameness) — scored by the acceptance panel, advisory at the
 *  publish gate. Coherence/correctness families are deliberately absent. */
export const SWEEP_TEXTURE_FAMILIES = new Set(["scene_skeleton", "repeated_unit", "location_stamping"]);

export function checkSweep(chapters: ChapterV21[], enforce: boolean): SweepFinding[] {
  const sev: "blocker" | "advisory" = enforce ? "blocker" : "advisory";
  const parsed = chapters[0]?.chapterId ? parseChapterId(chapters[0].chapterId) : null;
  const bookId = parsed?.bookId ?? chapters[0]?.chapterId?.replace(/-ch\d+$/i, "") ?? "";
  const rec = loadSweepRecord(bookId);
  if (!rec) return [{ checkId: "QC3.sweep_missing", severity: sev, message: `No sweep attestation for ${bookId}. Run sweep-pack and sweep-attest.` }];
  if (!loadQcRound(rec.bookId, rec.roundId)?.roles?.sweep) return [{ checkId: "QC3.sweep_round_missing", severity: sev, message: `Sweep attestation is not backed by an existing QC round file. Re-open a round and re-attest the sweep.` }];
  // The publish gate must agree with the per-chapter sweep gate (sweepChapterStatus): an
  // all-advisory/minor REVISE is surfaced but NEVER blocks (the sweep is not a stricter gate than
  // the publish decision it feeds — else a book reads 11/11 PUBLISHABLE yet cannot ship). A blocker
  // finding still blocks (majors map to blocker at write time, so majors still block — no
  // loosening); an uncited CORRUPTION or an unexplained non-PASS (no findings) still blocks.
  if (rec.verdict !== "PASS") {
    const findings = rec.findings ?? [];
    const currentHashes = Object.fromEntries(chapters.map((ch) => [String(ch.number), chapterContentHash(ch)]));
    // Publish calibration (owner decision 2026-07-04, plan docs/v24/
    // PUBLISH-CALIBRATION-PLAN-2026-07-04.md): TEXTURE families are SCORED,
    // not blocking, at the publish gate — repetition/style sameness reduces
    // quality signals (the acceptance panel already prices it via churn +
    // composite) but must not hard-veto a book whose chapter reviews, panel,
    // gate votes, and key evidence all pass. A single-framework book's 45
    // examples share a teaching skeleton at SOME abstraction; three
    // instruments pricing it is calibration, a fourth hard-vetoing it is the
    // treadmill. Correctness/coherence families (persona_drift, key/factual
    // classes) keep blocking, as do uncited non-PASS and CORRUPTION verdicts.
    // The on-disk record is NEVER mutated — the downgrade is gate-local.
    const recForGate = {
      ...rec,
      findings: findings.map((f) => {
        const fam = String((f as { family?: unknown; repairClass?: unknown }).family ?? (f as { repairClass?: unknown }).repairClass ?? "");
        return f.severity === "blocker" && SWEEP_TEXTURE_FAMILIES.has(fam) ? { ...f, severity: "advisory" as const } : f;
      }),
    };
    const effective = effectiveSweepFindings(recForGate, currentHashes);
    if (effective.blockingChapters.size > 0 || rec.verdict === "CORRUPTION" || findings.length === 0) {
      return [{ checkId: "QC3.sweep_not_pass", severity: sev, message: `Sweep verdict is ${rec.verdict} with ${effective.blockingChapters.size} blocking chapter(s).` }];
    }
  }
  // Family-completeness is a PASS-only requirement (only a PASS attestation claims it checked all 4
  // families). A non-PASS record whose only gate was DEMOTED by corroboration is effectively clear —
  // sweepChapterStatus already PASSes its chapters — so applying this PASS-only check to it would make
  // the publish gate STRICTER than the per-chapter gate (the drift sweep.ts is built to prevent).
  const missingFamilies = rec.verdict === "PASS" ? REQUIRED_SWEEP_FAMILIES.filter((family) => !(rec.checkedFamilies ?? []).includes(family)) : [];
  if (missingFamilies.length > 0) return [{ checkId: "QC3.sweep_incomplete", severity: sev, message: `Sweep PASS is incomplete; missing checkedFamilies: ${missingFamilies.join(", ")}.` }];
  // P09: staleness is per-chapter. With a clear ledger, a chapter is stale only if NO genuine
  // independent read cleared it at its CURRENT hash (fail-closed for a chapter lacking evidence) —
  // so a sibling's repair no longer marks untouched, already-read chapters stale. Legacy books (no
  // ledger) keep the whole-book check: the latest record must cover this chapter at the current hash.
  const stale = hasChapterClearLedger(rec.bookId)
    ? chapters.filter((ch) => !chapterCoveredAtCurrentHash(rec.bookId, ch.number, chapterContentHash(ch)))
    : chapters.filter((ch) => rec.contentHashes[String(ch.number)] !== chapterContentHash(ch));
  if (stale.length > 0) return [{ checkId: "QC3.sweep_stale", severity: sev, message: `Sweep attestation is stale/missing for chapter(s): ${stale.map((ch) => ch.number).join(", ")}.` }];
  return [];
}

/** Is this record a CLEAR read over exactly the given (current) book bytes? Clear = not
 *  CORRUPTION, all required families checked, contentHashes match the current set 1:1, and NO
 *  read was over the CURRENT (byte-identical) book — same chapter set + every hash. */
function sweepReadOverCurrent(rec: SweepRecord, currentHashes: Record<string, string>): boolean {
  const recHashes = rec.contentHashes ?? {};
  const keys = Object.keys(currentHashes);
  if (Object.keys(recHashes).length !== keys.length) return false;
  for (const k of keys) if (recHashes[k] !== currentHashes[k]) return false;
  return true;
}

/** A clear read = over the current bytes, not CORRUPTION, all required families checked, and no
 *  finding gates any chapter (RAW gate — a disagreeing read must block confirmation; intentionally
 *  STRICTER than the per-round corroboration gate, paired with the confirmRounds reset on repair). */
function sweepRecordClearOver(rec: SweepRecord, currentHashes: Record<string, string>): boolean {
  if (!sweepReadOverCurrent(rec, currentHashes)) return false;
  if (rec.verdict === "CORRUPTION") return false;
  if (!REQUIRED_SWEEP_FAMILIES.every((fam) => (rec.checkedFamilies ?? []).includes(fam))) return false;
  return !(rec.findings ?? []).some(sweepFindingBlocks);
}

// ── P09: per-chapter clear ledger ─────────────────────────────────────────────────────────────
// The sweep's convergence unit is the CHAPTER at its content hash, not the whole book. A repair to
// one chapter invalidates ONLY that chapter's clears; untouched chapters keep the independent reads
// they already earned. Reads stay whole-book (a read still SEES the whole book — templating is
// cross-chapter); only the ACCOUNTING is per-chapter. See docs/v23/SWEEP-CARRYFORWARD-DESIGN.md.

export type SweepChapterClear = {
  chapterNumber: number;
  chapterId: string;
  contentHash: string;
  roundId: string;
  reviewerSessionId: string;
  families: SweepFamily[];
  clearedAt: string;
};

export type SweepChapterClearLedger = {
  schemaVersion: "sweep-chapter-clears-v1";
  bookId: string;
  updatedAt: string;
  clears: SweepChapterClear[];
};

/** Materialized cache path. The authoritative evidence is the immutable per-round sweep records;
 *  this file is rebuilt from them (like the sweep-history JSONL) and may be deleted without loss. */
export function chapterClearsPath(bookId: string): string {
  return resolve(QC_DIR, `${bookId}.sweep-chapter-clears.json`);
}

/** Feature switch: a book evaluates per-chapter iff its clear ledger exists. Legacy books (sweep
 *  history predating P09, no ledger yet) fall through to the unchanged whole-book logic — the first
 *  new-style attestation writes the ledger (backfilled from full history) and flips this on. */
export function hasChapterClearLedger(bookId: string): boolean {
  return existsSync(chapterClearsPath(bookId));
}

/** A history record grants per-chapter CLEARS iff it is a genuine INDEPENDENT read: not a
 *  carry-forward byte copy (has a reviewer-session identity), not CORRUPTION, and it checked all
 *  required families (only such a read attests it examined the whole book across every family). */
function readGrantsChapterClears(rec: SweepRecord): boolean {
  if (rec.verdict === "CORRUPTION") return false;
  if (!sweepReadIdentity(rec) || !rec.reviewerSessionId) return false; // carry / no session → not independent evidence
  return REQUIRED_SWEEP_FAMILIES.every((fam) => (rec.checkedFamilies ?? []).includes(fam));
}

/** The chapter numbers a read RAW-gates — non-advisory, distinctiveness-valid findings that name
 *  them (pre-corroboration; the disagreement check applies corroboration separately). A chapter a
 *  read raw-gates gets no clear from that read; every other examined chapter does. */
function rawGatedChapters(rec: SweepRecord): Set<number> {
  const gated = new Set<number>();
  for (const f of (rec.findings ?? []).filter(sweepFindingBlocks)) for (const n of f.chapters ?? []) gated.add(n);
  return gated;
}

/** Derive the per-chapter clear ledger from the full sweep history (newest-first). Pure over the
 *  immutable round records — chapterId is a best-effort audit label (blank when chapters aren't on
 *  disk, e.g. a pruned/published book). Never throws on missing chapters. */
export function buildChapterClearLedger(bookId: string): SweepChapterClearLedger {
  const history = loadSweepHistory(bookId).map(normalizeSweepRecord);
  const chapterIdByNumber = new Map<number, string>();
  try { for (const ch of loadBookChapters(bookId)) chapterIdByNumber.set(ch.number, ch.chapterId); } catch { /* chapters not on disk → id best-effort */ }
  const clears: SweepChapterClear[] = [];
  for (const rec of history) {
    if (!readGrantsChapterClears(rec)) continue;
    const gated = rawGatedChapters(rec);
    for (const [chStr, hash] of Object.entries(rec.contentHashes ?? {})) {
      const n = Number(chStr);
      if (!Number.isInteger(n) || n <= 0) continue;
      if (gated.has(n)) continue; // this read named this chapter → not a clear for it (rule b)
      clears.push({
        chapterNumber: n,
        chapterId: chapterIdByNumber.get(n) ?? "",
        contentHash: String(hash),
        roundId: rec.roundId,
        reviewerSessionId: rec.reviewerSessionId!,
        families: [...(rec.checkedFamilies ?? [])],
        clearedAt: rec.attestedAt,
      });
    }
  }
  return { schemaVersion: "sweep-chapter-clears-v1", bookId, updatedAt: new Date().toISOString(), clears };
}

/** Materialize the derived ledger to disk (called after every attestation). */
export function writeChapterClearLedger(bookId: string): string {
  const p = chapterClearsPath(bookId);
  writeFileAtomic(p, JSON.stringify(buildChapterClearLedger(bookId), null, 2));
  return p;
}

/** Does a full sweep read COVER this chapter at its CURRENT hash? — the per-chapter analog of the
 *  legacy whole-book "the record's hash for this chapter matches the current bytes" freshness check,
 *  and the input to the per-chapter QC3.sweep_stale gate. Coverage is a FRESHNESS notion (was the
 *  chapter examined at these bytes by a full, non-CORRUPTION, all-families read), NOT the two-read
 *  publish bar (that lives in sweepPerChapterConfirmed) and NOT a gate decision (blocking is the
 *  QC3.sweep_not_pass path). Carry-forward copies count — they carry the underlying read's hashes,
 *  exactly as the legacy check treated a carried record as covering. A chapter with NO covering read
 *  is stale (fail-closed). */
function chapterCoveredAtCurrentHash(bookId: string, chapterNumber: number, currentHash: string): boolean {
  return loadSweepHistory(bookId).map(normalizeSweepRecord).some((r) =>
    r.verdict !== "CORRUPTION" &&
    (r.contentHashes ?? {})[String(chapterNumber)] === currentHash &&
    REQUIRED_SWEEP_FAMILIES.every((fam) => (r.checkedFamilies ?? []).includes(fam)));
}

/** Per-chapter auto-publish confirmation (P09). For each chapter, over its CURRENT bytes: (1) no
 *  sweep read carries a CORROBORATED gate naming it (or a CORRUPTION over those bytes), AND (2) ≥2
 *  INDEPENDENT clear reads at that hash. A read that gated OTHER chapters still counts as a clear
 *  here for the chapters it did not name — so untouched chapters keep progress across a sibling's
 *  repair, while the two-independent-reads bar is preserved PER CHAPTER. */
function sweepPerChapterConfirmed(bookId: string, chapters: ChapterV21[]): { ok: boolean; reason?: string } {
  const currentHashes: Record<string, string> = {};
  for (const ch of chapters) currentHashes[String(ch.number)] = chapterContentHash(ch);
  const history = loadSweepHistory(bookId).map(normalizeSweepRecord);
  const problems: string[] = [];
  for (const ch of chapters) {
    const n = ch.number;
    const curHash = currentHashes[String(n)];
    // Reads that examined THIS chapter at its current bytes (regardless of other chapters' state).
    const touching = history.filter((r) => (r.contentHashes ?? {})[String(n)] === curHash);
    // (1) A CORROBORATED gate (or any CORRUPTION) on this chapter over current bytes disqualifies it.
    //     Corroboration is the same mechanism the round verdict uses — a lone uncorroborated flip is
    //     demoted as noise; two agreeing independent reads block. CORRUPTION is never demoted.
    const disagreeing = touching.some((r) => r.verdict === "CORRUPTION" || effectiveSweepFindings(r, currentHashes).blockingChapters.has(n));
    if (disagreeing) { problems.push(`ch${n}: a sweep read over its current content has a corroborated gate`); continue; }
    // (2) ≥2 INDEPENDENT clear reads at the current hash (carry-forward copies excluded upstream).
    const clearIds = new Set<string>();
    for (const r of touching) {
      if (readGrantsChapterClears(r) && !rawGatedChapters(r).has(n)) clearIds.add(r.reviewerSessionId!);
    }
    if (clearIds.size < 2) problems.push(`ch${n}: needs TWO independent clear sweep reads at its current bytes (have ${clearIds.size})`);
  }
  if (problems.length > 0) return { ok: false, reason: `per-chapter sweep confirmation incomplete — ${problems.slice(0, 3).join("; ")}${problems.length > 3 ? `; +${problems.length - 3} more` : ""}` };
  return { ok: true };
}

/** Item B — two-round confirmation before AUTO-PUBLISH. The cross-chapter sweep is the noisiest,
 *  most stochastic reviewer: a single fresh read flips verdict round-to-round on byte-identical
 *  content, and a read that misses a real pattern would silently flip a chapter to PASS and ship a
 *  book a re-read would block. Confirmation requires, over the CURRENT book bytes: (1) NO read gated
 *  any chapter or returned CORRUPTION (a single disagreeing read over identical content blocks — even
 *  if it is not the latest, so a clear→gate→clear sandwich cannot self-clear), AND (2) at least TWO
 *  INDEPENDENT (non-carry) clear reads (a carry-forward is a byte copy, never independent evidence, so
 *  copies can't self-confirm). The autopilot forces the confirming round to do a FRESH sweep. */
export function sweepTwoRoundConfirmed(bookId: string, chapters: ChapterV21[]): { ok: boolean; reason?: string } {
  // P09: books with a per-chapter clear ledger converge at the CHAPTER grain — a repair to one
  // chapter no longer discards the whole book's clear progress. Legacy books (no ledger) fall
  // through to the unchanged whole-book logic below, so they evaluate exactly as before.
  if (hasChapterClearLedger(bookId)) return sweepPerChapterConfirmed(bookId, chapters);
  return sweepWholeBookConfirmed(bookId, chapters);
}

/** Legacy whole-book confirmation (pre-P09). Preserved verbatim as the back-compat path for books
 *  without a clear ledger. ≥2 independent clear reads over the ENTIRE current book + no disagreeing
 *  read over identical bytes. */
function sweepWholeBookConfirmed(bookId: string, chapters: ChapterV21[]): { ok: boolean; reason?: string } {
  const currentHashes: Record<string, string> = {};
  for (const ch of chapters) currentHashes[String(ch.number)] = chapterContentHash(ch);
  const overCurrent = loadSweepHistory(bookId).filter((r) => sweepReadOverCurrent(r, currentHashes));
  // (1) ANY read over the current bytes that has a REAL gate disqualifies confirmation. "Real" is
  // decided by the SAME cross-round corroboration the round verdict uses (gateSurvivesCorroboration):
  // a single uncorroborated stochastic flip on byte-frozen content is noise here too (it was demoted
  // in the round verdict), so it must NOT block — else a confirming round's own stochastic flag would
  // poison history and false-HALT a genuinely converged book. CORRUPTION always disqualifies.
  const disagreeing = overCurrent.filter((r) => {
    if (r.verdict === "CORRUPTION") return true;
    return effectiveSweepFindings(r, currentHashes).blockingChapters.size > 0;
  });
  if (disagreeing.length > 0) return { ok: false, reason: `a sweep read over the current content has a corroborated gate (${disagreeing.length}); not corroborated-clear` };
  // (2) ≥2 INDEPENDENT clear reads (carry-forward copies don't count toward the corroboration total).
  const clears = overCurrent.filter((r) => sweepRecordClearOver(r, currentHashes));
  const independentClearIdentities = new Set<string>();
  for (const r of clears) {
    const id = sweepReadIdentity(r);
    if (id) independentClearIdentities.add(id);
  }
  if (independentClearIdentities.size >= 2) return { ok: true };
  return { ok: false, reason: `auto-publish needs TWO independent clear sweep reads over identical content (have ${clears.length} clear, ${independentClearIdentities.size} independent) — run one more confirming QC round` };
}

export function formatSweepStatus(bookId: string): string {
  const rec = loadSweepRecord(bookId);
  if (!rec) return `sweep-status: MISSING (${bookId})`;
  return `sweep-status: ${rec.verdict} (${bookId}, round=${rec.roundId}, reviewer=${rec.reviewer}, ${rec.attestedAt.slice(0, 10)})`;
}
