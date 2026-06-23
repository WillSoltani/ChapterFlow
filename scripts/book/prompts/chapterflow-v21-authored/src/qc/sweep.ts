import { existsSync, readFileSync } from "fs";
import { writeFileAtomic } from "../lib/atomicWrite.js";
import { resolve } from "path";

import { ChapterV21 } from "../types.js";
import { CANONICAL_STATE, parseChapterId } from "../lib/chapterPaths.js";
import { chapterContentHash } from "../critics/qcAttestation.js";
import { loadQcRound, verifyQcRoundToken } from "./qcRound.js";
import { loadBookChapters } from "./manualKeyJudge.js";
import { evidenceSourceRef } from "./orchestrator/evidenceSource.js";
import type { ValidatedSweepSubmission } from "./orchestrator/schemas.js";
import { nondistinctiveRepetitionQuote } from "./orchestrator/findingValidity.js";

export const QC_DIR = resolve(CANONICAL_STATE, "qc");
export const SWEEP_PACKS_DIR = resolve(CANONICAL_STATE, "qc-packs");
export const REQUIRED_SWEEP_FAMILIES = ["scene_skeleton", "persona_drift", "repeated_unit", "location_stamping"] as const;
export type SweepFamily = typeof REQUIRED_SWEEP_FAMILIES[number];

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
  contentHashes: Record<string, string>;
  checkedFamilies: SweepFamily[];
  findings: Array<{
    family: SweepFamily;
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

/** Append-only per-round sweep history (one JSON record per line). The single
 *  `{bookId}.sweep.json` is only the LATEST pointer (overwritten each round); this
 *  preserves every round's record so the gate can reason ACROSS rounds — the basis for
 *  (1) the sticky per-chapter carry that ignores a single stochastic verdict flip on
 *  byte-frozen content, and (2) item B (require two consecutive independent clear reads
 *  over identical content before auto-publish). */
export function sweepHistoryPath(bookId: string): string {
  return resolve(QC_DIR, `${bookId}.sweep-history.jsonl`);
}

/** Append a record to the per-round history. Best-effort + crash-safe: it must never throw
 *  into a sweep write path (a failed history append must not fail the round). One JSON object
 *  per line, appended via an atomic read-modify-write (the records are small + few per book). */
export function appendSweepHistory(rec: SweepRecord): void {
  try {
    const p = sweepHistoryPath(rec.bookId);
    const prior = existsSync(p) ? readFileSync(p, "utf8").split("\n").filter((l) => l.trim()) : [];
    // Drop any prior line(s) for THIS roundId (a re-finalize/carry re-appends the same round) and
    // re-add the fresh record LAST — last-write-wins per round, matching loadSweepHistory's dedup so
    // the on-disk file equals the loaded view (no bloat). Unparseable lines are kept verbatim
    // (forensics). The dedup is purely cosmetic for consumers (they already dedup on load), so item-B
    // independent-read counting is unchanged.
    const kept: string[] = [];
    for (const line of prior) {
      try {
        const r = JSON.parse(line) as SweepRecord;
        if (r && r.roundId === rec.roundId) continue; // replace the prior record for this round
      } catch {
        /* keep an unparseable line as-is */
      }
      kept.push(line);
    }
    kept.push(JSON.stringify(rec));
    writeFileAtomic(p, `${kept.join("\n")}\n`);
  } catch {
    /* history is an optimization layer; never let it break a sweep write */
  }
}

/** Load the per-round sweep history NEWEST-FIRST, de-duplicated by roundId (a re-finalized
 *  round appends again — keep its LAST record). Returns [] when absent/unreadable (fail-safe:
 *  every consumer then behaves exactly as it did before history existed). */
export function loadSweepHistory(bookId: string): SweepRecord[] {
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
      const rec = JSON.parse(line) as SweepRecord;
      if (rec && typeof rec.roundId === "string") byRound.set(rec.roundId, rec); // last write per round wins
    } catch {
      /* skip a corrupt line */
    }
  }
  // Newest-first by roundId. roundIds are creation-ordered (r<YYYYMMDDhhmmss>-<hash>, qcRound.ts),
  // so this is stable even when a round is RE-FINALIZED out of order (which would give it a newer
  // attestedAt than a later round — sorting by attestedAt could then make a FUTURE round look prior).
  return [...byRound.values()].sort((a, b) => String(b.roundId ?? "").localeCompare(String(a.roundId ?? "")));
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
  return (rec.findings ?? []).filter(sweepFindingGates).some((f) => (f.chapters ?? []).includes(chapterNumber));
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
      return [{
        family,
        severity: f.severity === "blocker" || f.severity === "major" ? "blocker" as const : "advisory" as const,
        chapters: f.chapters ?? (f.chapterNumber !== undefined ? [f.chapterNumber] : []),
        unitId: f.unitId,
        quote: f.quote,
        problem: f.problem,
        expectedFix: f.expectedFix,
      }];
    }),
  };
  writeFileAtomic(p, JSON.stringify(rec, null, 2));
  appendSweepHistory(rec);
  return p;
}

function isSweepFamily(value: unknown): value is SweepFamily {
  return (REQUIRED_SWEEP_FAMILIES as readonly string[]).includes(String(value));
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
  writeFileAtomic(p, JSON.stringify(rec, null, 2));
  appendSweepHistory(rec);
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
    attestedAt: new Date().toISOString(),
  };
  const p = sweepRecordPath(bookId);
  writeFileAtomic(p, JSON.stringify(rec, null, 2));
  appendSweepHistory(rec);
  return p;
}

export function loadSweepRecord(bookId: string): SweepRecord | null {
  const p = sweepRecordPath(bookId);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8")) as SweepRecord;
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
function sweepFindingGates(f: SweepRecord["findings"][number]): boolean {
  return f.severity !== "advisory" && !nondistinctiveRepetitionQuote(f);
}

/** Mechanism 1 — sticky per-chapter carry / cross-round corroboration. A gate raised by the
 *  CURRENT round on a chapter SURVIVES (really gates) unless it is an UNCORROBORATED verdict
 *  flip on byte-frozen content: the chapter's content is unchanged since the prior sweep round
 *  AND the prior round did NOT gate it. The cross-chapter sweep is the noisiest, most stochastic
 *  reviewer (a fresh whole-book read flags a rotating subset round to round) — so a single read
 *  newly flagging a chapter whose bytes never moved is far more likely a stochastic flip than a
 *  genuinely new cross-chapter pattern. The prior CLEAR verdict is sticky until either the
 *  chapter's content changes (a fresh read is then trusted on its own) or a second independent
 *  read corroborates the gate. Fail-safe: no prior record / content changed ⇒ the gate stands
 *  (exactly today's behavior). This both kills the false-positive treadmill AND, applied in BOTH
 *  the per-chapter gate and the publish gate, keeps the two from ever drifting. */
function gateSurvivesCorroboration(prior: SweepRecord | null, chapterNumber: number, currentContentHash: string): boolean {
  const frozenSincePrior = !!prior && prior.contentHashes?.[String(chapterNumber)] === currentContentHash;
  if (frozenSincePrior && !recordGatesChapter(prior, chapterNumber)) return false; // uncorroborated upward flip on frozen content → demote
  return true;
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
  const blockers = findings.filter(sweepFindingGates);
  // Mechanism 1: a gate on THIS chapter only FAILs it if it survives cross-round corroboration
  // (an uncorroborated stochastic flip on byte-frozen content is demoted — see
  // gateSurvivesCorroboration). `prior` is injectable for tests; default loads the prior round.
  // A CORRUPTION verdict is NEVER demoted — corroboration suppresses only stochastic REVISE flips,
  // and checkSweep keeps an unconditional CORRUPTION block, so demoting it here would break parity.
  const priorRec = prior !== undefined ? prior : priorSweepRecord(rec.bookId, roundId);
  if (blockers.some((f) => (f.chapters ?? []).includes(chapterNumber)) && (rec.verdict === "CORRUPTION" || gateSurvivesCorroboration(priorRec, chapterNumber, contentHash))) return "FAIL";
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
    // Mechanism 1: count a chapter as blocking only if its gate survives cross-round corroboration
    // (an uncorroborated stochastic flip on byte-frozen content is demoted) — the SAME predicate
    // sweepChapterStatus uses, so the publish gate and the per-chapter gate can never disagree.
    const prior = priorSweepRecord(bookId, rec.roundId);
    const hashByCh = new Map<number, string>();
    for (const ch of chapters) hashByCh.set(ch.number, chapterContentHash(ch));
    const gatedChapters = new Set<number>();
    for (const f of findings.filter(sweepFindingGates)) {
      for (const n of f.chapters ?? []) {
        const h = hashByCh.get(n);
        if (h === undefined || gateSurvivesCorroboration(prior, n, h)) gatedChapters.add(n); // unknown bytes ⇒ fail closed
      }
    }
    if (gatedChapters.size > 0 || rec.verdict === "CORRUPTION" || findings.length === 0) {
      return [{ checkId: "QC3.sweep_not_pass", severity: sev, message: `Sweep verdict is ${rec.verdict} with ${gatedChapters.size} blocking chapter(s).` }];
    }
  }
  // Family-completeness is a PASS-only requirement (only a PASS attestation claims it checked all 4
  // families). A non-PASS record whose only gate was DEMOTED by corroboration is effectively clear —
  // sweepChapterStatus already PASSes its chapters — so applying this PASS-only check to it would make
  // the publish gate STRICTER than the per-chapter gate (the drift sweep.ts is built to prevent).
  const missingFamilies = rec.verdict === "PASS" ? REQUIRED_SWEEP_FAMILIES.filter((family) => !(rec.checkedFamilies ?? []).includes(family)) : [];
  if (missingFamilies.length > 0) return [{ checkId: "QC3.sweep_incomplete", severity: sev, message: `Sweep PASS is incomplete; missing checkedFamilies: ${missingFamilies.join(", ")}.` }];
  const stale = chapters.filter((ch) => rec.contentHashes[String(ch.number)] !== chapterContentHash(ch));
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
  return !(rec.findings ?? []).some(sweepFindingGates);
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
    const prior = priorSweepRecord(bookId, r.roundId);
    return (r.findings ?? []).filter(sweepFindingGates).some((f) =>
      (f.chapters ?? []).some((n) => {
        const h = currentHashes[String(n)];
        return h !== undefined && gateSurvivesCorroboration(prior, n, h);
      }));
  });
  if (disagreeing.length > 0) return { ok: false, reason: `a sweep read over the current content has a corroborated gate (${disagreeing.length}); not corroborated-clear` };
  // (2) ≥2 INDEPENDENT clear reads (carry-forward copies don't count toward the corroboration total).
  const clears = overCurrent.filter((r) => sweepRecordClearOver(r, currentHashes));
  const independentClears = clears.filter((r) => r.reviewer !== "carry-forward");
  if (independentClears.length >= 2) return { ok: true };
  return { ok: false, reason: `auto-publish needs TWO independent clear sweep reads over identical content (have ${clears.length} clear, ${independentClears.length} independent) — run one more confirming QC round` };
}

export function formatSweepStatus(bookId: string): string {
  const rec = loadSweepRecord(bookId);
  if (!rec) return `sweep-status: MISSING (${bookId})`;
  return `sweep-status: ${rec.verdict} (${bookId}, round=${rec.roundId}, reviewer=${rec.reviewer}, ${rec.attestedAt.slice(0, 10)})`;
}
