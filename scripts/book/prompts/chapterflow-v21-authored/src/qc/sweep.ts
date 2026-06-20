import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";

import { ChapterV21 } from "../types.js";
import { CANONICAL_STATE, parseChapterId } from "../lib/chapterPaths.js";
import { chapterContentHash } from "../critics/qcAttestation.js";
import { loadQcRound, verifyQcRoundToken } from "./qcRound.js";
import { loadBookChapters } from "./manualKeyJudge.js";
import type { ValidatedSweepSubmission } from "./orchestrator/schemas.js";

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
      tryThisNow: ch.tryThisNow ?? "",
      breakdown: {
        fastRead: ch.breakdown?.fastRead ?? "",
        deepRead: ch.breakdown?.deepRead ?? "",
        fullRead: ch.breakdown?.fullRead ?? "",
      },
      examples: (ch.examples ?? []).map((ex) => ({
        title: ex.title ?? "",
        scenario: ex.scenario ?? "",
        whatToDo: ex.whatToDo ?? "",
        whyItMatters: ex.whyItMatters ?? "",
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
        challenge: (ch.implementationPlan as any)?.challenge ?? ch.implementationPlan?.twentyFourHourChallenge,
        twentyFourHourChallenge: ch.implementationPlan?.twentyFourHourChallenge,
        weeklyPractice: ch.implementationPlan?.weeklyPractice,
        ifThenPlans: (ch.implementationPlan?.ifThenPlans ?? []).map((plan) => ({ context: plan.context ?? "", plan: plan.plan ?? "" })),
      },
      memorableLines: (ch.memorableLines ?? []).map((line: any) => typeof line === "string" ? line : String(line?.text ?? "")),
    })),
  };
  const p = sweepPackPath(bookId, roundId);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(pack, null, 2), "utf8");
  return p;
}

export function writeSweepRecordFromSubmission(submission: ValidatedSweepSubmission): string {
  const chapters = loadBookChapters(submission.bookId);
  const contentHashes: Record<string, string> = {};
  for (const ch of chapters) contentHashes[String(ch.number)] = chapterContentHash(ch);
  const rec: SweepRecord = {
    schemaVersion: "sweep-attest-v1",
    bookId: submission.bookId,
    roundId: submission.roundId,
    verdict: submission.verdict,
    reviewer: submission.reviewer,
    attestedAt: new Date().toISOString(),
    contentHashes,
    checkedFamilies: submission.checkedFamilies,
    findings: submission.findings.flatMap((f) => {
      // FIX 3 — DROP a finding whose repairClass is not one of the 4 sweep families instead
      // of silently coercing it to scene_skeleton. The old coercion let a factual/number
      // doubt (which the sweep has no source to verify) masquerade as a templating defect and
      // gate the book on a non-templating basis. A real templating family is kept untouched.
      if (!isSweepFamily(f.repairClass)) return [];
      return [{
        family: f.repairClass,
        severity: f.severity === "blocker" || f.severity === "major" ? "blocker" as const : "advisory" as const,
        chapters: f.chapters ?? (f.chapterNumber !== undefined ? [f.chapterNumber] : []),
        unitId: f.unitId,
        quote: f.quote,
        problem: f.problem,
        expectedFix: f.expectedFix,
      }];
    }),
  };
  mkdirSync(QC_DIR, { recursive: true });
  const p = sweepRecordPath(submission.bookId);
  writeFileSync(p, JSON.stringify(rec, null, 2), "utf8");
  return p;
}

function isSweepFamily(value: unknown): value is SweepFamily {
  return (REQUIRED_SWEEP_FAMILIES as readonly string[]).includes(String(value));
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
  mkdirSync(QC_DIR, { recursive: true });
  const p = sweepRecordPath(bookId);
  writeFileSync(p, JSON.stringify(rec, null, 2), "utf8");
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
  mkdirSync(QC_DIR, { recursive: true });
  const p = sweepRecordPath(bookId);
  writeFileSync(p, JSON.stringify(rec, null, 2), "utf8");
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
export function sweepChapterStatus(rec: SweepRecord | null, chapterNumber: number, contentHash: string, roundId: string): "PASS" | "FAIL" | "STALE" | "MISSING" {
  if (!rec || rec.roundId !== roundId) return "MISSING";
  if (rec.contentHashes?.[String(chapterNumber)] !== contentHash) return "STALE";
  if (rec.verdict === "PASS") return "PASS";
  const findings = rec.findings ?? [];
  // Only a BLOCKER-severity finding gates the chapters it names. An ADVISORY sweep
  // observation (e.g. a stochastic unverifiable-number nit) is surfaced but never FAILs a
  // chapter — this mirrors finalize's `openSerious` ledger gate so the sweep can't be a
  // STRICTER gate than the publish decision it feeds. A finding with no severity (a legacy,
  // pre-severity record) is treated as a blocker (fail-closed).
  const blockers = findings.filter((f) => f.severity !== "advisory");
  if (blockers.some((f) => (f.chapters ?? []).includes(chapterNumber))) return "FAIL";
  // A non-PASS verdict explained by NO blocker (all-advisory, or naming nothing) fails
  // closed — an unexplained REVISE/CORRUPTION still blocks rather than silently passing
  // every chapter. (Advisory-only findings do not "explain" the verdict at blocker level.)
  return blockers.some((f) => (f.chapters ?? []).length > 0) ? "PASS" : "FAIL";
}

export function checkSweep(chapters: ChapterV21[], enforce: boolean): SweepFinding[] {
  const sev: "blocker" | "advisory" = enforce ? "blocker" : "advisory";
  const parsed = chapters[0]?.chapterId ? parseChapterId(chapters[0].chapterId) : null;
  const bookId = parsed?.bookId ?? chapters[0]?.chapterId?.replace(/-ch\d+$/i, "") ?? "";
  const rec = loadSweepRecord(bookId);
  if (!rec) return [{ checkId: "QC3.sweep_missing", severity: sev, message: `No sweep attestation for ${bookId}. Run sweep-pack and sweep-attest.` }];
  if (!loadQcRound(rec.bookId, rec.roundId)?.roles?.sweep) return [{ checkId: "QC3.sweep_round_missing", severity: sev, message: `Sweep attestation is not backed by an existing QC round file. Re-open a round and re-attest the sweep.` }];
  if (rec.verdict !== "PASS") return [{ checkId: "QC3.sweep_not_pass", severity: sev, message: `Sweep verdict is ${rec.verdict}, not PASS.` }];
  const missingFamilies = REQUIRED_SWEEP_FAMILIES.filter((family) => !(rec.checkedFamilies ?? []).includes(family));
  if (missingFamilies.length > 0) return [{ checkId: "QC3.sweep_incomplete", severity: sev, message: `Sweep PASS is incomplete; missing checkedFamilies: ${missingFamilies.join(", ")}.` }];
  const stale = chapters.filter((ch) => rec.contentHashes[String(ch.number)] !== chapterContentHash(ch));
  if (stale.length > 0) return [{ checkId: "QC3.sweep_stale", severity: sev, message: `Sweep attestation is stale/missing for chapter(s): ${stale.map((ch) => ch.number).join(", ")}.` }];
  return [];
}

export function formatSweepStatus(bookId: string): string {
  const rec = loadSweepRecord(bookId);
  if (!rec) return `sweep-status: MISSING (${bookId})`;
  return `sweep-status: ${rec.verdict} (${bookId}, round=${rec.roundId}, reviewer=${rec.reviewer}, ${rec.attestedAt.slice(0, 10)})`;
}
