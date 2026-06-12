/**
 * QC attestation — the no-API semantic-verification model.
 *
 * The deterministic gates (gate-chapter / book-gate) catch mechanical defects
 * cheaply, but CANNOT judge semantic correctness: a confidently-wrong quiz
 * correctIndex, a plausible-but-false breakdown sentence, or grounded-looking
 * filler all pass them. The "No OpenAI/Anthropic API" constraint forbids an
 * automated model judge, so the semantic judge is a Claude reviewer (run in the
 * harness / Agent SDK — not a funded API). The problem with a reviewer alone is
 * that it is out-of-band: nothing stops promotion of a chapter the reviewer
 * never read, or one edited AFTER it passed.
 *
 * This module makes the reviewer's verdict an enforceable, un-stale-able gate:
 *
 *   1. The reviewer reaches a verdict (PUBLISHABLE / REVISE / CORRUPTION) after
 *      an adversarial read (hidden-key derivation, independent re-verification —
 *      see the qc-review workflow / QC-SESSION-PROMPT).
 *   2. `qc-attest` records it to state/qc/<bookId>-ch<NN>.qc.json together with
 *      a CONTENT HASH of the chapter's reader-facing fields at review time.
 *   3. `promote` requires every chapter to carry a PUBLISHABLE attestation whose
 *      contentHash still matches the chapter — so an edit after review makes the
 *      attestation STALE and forces re-review. gate-chapter shows the same status
 *      ADVISORY (so authoring iteration is never blocked).
 *
 * The hash deliberately covers only reader-facing content and EXCLUDES
 * sourceAnchorId, so the promote-time provenance strip never invalidates a
 * legitimate attestation.
 */

import { createHash } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

import { ChapterV21 } from "../types.js";
import { CANONICAL_STATE, parseChapterId } from "../lib/chapterPaths.js";
import { loadQcRound, type QcRoundRole } from "../qc/qcRound.js";
import { isNoApiCodexQcMode } from "../qc/noApiMode.js";
import { checkBarConfirmArtifactsForPublishable } from "../qc/orchestrator/artifacts.js";

export const QC_DIR = resolve(CANONICAL_STATE, "qc");

export type QcVerdict = "PUBLISHABLE" | "REVISE" | "CORRUPTION";

export type QcHashVersion = "v1" | "v2";

export type QcAttestation = {
  schemaVersion: "qc-attest-v1";
  bookId: string;
  chapterNumber: number;
  chapterId: string;
  verdict: QcVerdict;
  /** chapterContentHash() captured at review time. */
  contentHash: string;
  /** Which hash algorithm contentHash was computed with. Absent = "v1"
   *  (the original include-list projection — see chapterContentHashV1).
   *  New attestations are always "v2" (exclude-list, full coverage). */
  hashVersion?: QcHashVersion;
  /** who/what produced the verdict, e.g. "claude-qc:wf_93f0a1dd" or a session id. */
  reviewer: string;
  reviewedAt: string;
  /** v21.1 no-api QC mode: round-backed role that produced this attestation. */
  roundId?: string;
  roundRole?: QcRoundRole;
  /** per-dimension booleans the reviewer checked (keysCorrect, grounded, …). */
  dimensions?: Record<string, boolean>;
  findings?: string[];
  notes?: string;
  /** Prior attestations for this chapter, newest last (capped). Overwrites
   *  append the previous record here so verdict flips are auditable —
   *  qc-attest previously overwrote a reviewer's REVISE silently. */
  history?: Array<Omit<QcAttestation, "history">>;
  /** Required free-text reason when --supersede forced an overwrite that the
   *  same-content guard would otherwise refuse. */
  supersededReason?: string;
};

/** Remove every `sourceAnchorId` (and any other excluded key) so the hash is
 *  stable across the promote-time provenance strip. */
function stripKeyDeep<T>(value: T, key: string): T {
  if (Array.isArray(value)) return value.map((v) => stripKeyDeep(v, key)) as unknown as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (k === key) continue;
      out[k] = stripKeyDeep(v, key);
    }
    return out as T;
  }
  return value;
}

/** v1 projection — the ORIGINAL include-list. Kept verbatim so attestations
 *  recorded before the v2 switch still verify (hashVersion absent = v1).
 *  KNOWN GAPS (why v2 exists): misses quiz.passingScorePercent,
 *  readingTimeMinutes, examples[].tags, reviewCards[].difficulty; picks a
 *  nonexistent top-level `format` off examples; and hashes
 *  implementationPlan/memorableLines with on-disk key order. Do not extend —
 *  new coverage goes in v2. */
function canonicalContentV1(ch: any): unknown {
  const pick = (o: any, keys: string[]) => {
    const r: Record<string, unknown> = {};
    for (const k of keys) if (o?.[k] !== undefined) r[k] = o[k];
    return r;
  };
  const projected = {
    title: ch?.title ?? "",
    hook: ch?.hook ?? "",
    counterintuition: ch?.counterintuition ?? "",
    keyTakeaway: ch?.keyTakeaway ?? "",
    tryThisNow: ch?.tryThisNow ?? "",
    breakdown: pick(ch?.breakdown ?? {}, ["fastRead", "deepRead", "fullRead"]),
    examples: (ch?.examples ?? []).map((e: any) => pick(e, ["title", "format", "scenario", "whatToDo", "whyItMatters"])),
    quiz: (ch?.quiz?.questions ?? []).map((q: any) =>
      pick(q, ["prompt", "choices", "correctIndex", "correctAnswerIndex", "explanation"]),
    ),
    reviewCards: (ch?.reviewCards ?? []).map((c: any) => pick(c, ["front", "back"])),
    implementationPlan: ch?.implementationPlan ?? null,
    memorableLines: ch?.memorableLines ?? [],
  };
  return stripKeyDeep(projected, "sourceAnchorId");
}

export function chapterContentHashV1(chapter: ChapterV21): string {
  return createHash("sha256").update(JSON.stringify(canonicalContentV1(chapter))).digest("hex").slice(0, 16);
}

/** v0 — the ORIGINAL 2026-06-04 projection: v1 WITHOUT title/tryThisNow
 *  (those were added 2026-06-05 in the "hash gap" fix). Verified 2026-06-10:
 *  the 8 oldest live attestations (rework ch16-23, hashVersion absent) were
 *  recorded with THIS algorithm — checking them only against v1 falsely
 *  reported "chapter changed since review" for byte-identical content and
 *  stranded them in qc-rehash. Legacy attestations (no hashVersion) are
 *  fresh when they match v1 OR v0. */
export function chapterContentHashV0(chapter: ChapterV21): string {
  const projected = canonicalContentV1(chapter) as Record<string, unknown>;
  delete projected["title"];
  delete projected["tryThisNow"];
  return createHash("sha256").update(JSON.stringify(projected)).digest("hex").slice(0, 16);
}

/** v2 — EXCLUDE-list projection: hash the whole chapter minus an explicit
 *  list of non-reader fields, with deep key sorting so semantically no-op
 *  reorders never stale an attestation. A new reader-facing field added to
 *  ChapterV21 is covered BY DEFAULT (the v1 include-list silently missed
 *  additions; that's how passingScorePercent etc. escaped).
 *  tests/hash-coverage.test.ts pins the coverage to the type. */
const V2_EXCLUDE_DEEP = new Set([
  "sourceAnchorId", // gate-time provenance, stripped at promote
  "planSpec",       // writer scaffolding — "not shown to readers" (types.ts)
  "exampleId",      // unit identity, not content
  "questionId",
  "cardId",
]);
const V2_EXCLUDE_TOP = new Set([
  "chapterId",      // identity metadata — renames must not force re-review
  "number",
]);

function sortAndStrip(value: unknown, topLevel: boolean): unknown {
  if (Array.isArray(value)) return value.map((v) => sortAndStrip(v, false));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(value as Record<string, unknown>).sort()) {
      if (V2_EXCLUDE_DEEP.has(k)) continue;
      if (topLevel && V2_EXCLUDE_TOP.has(k)) continue;
      out[k] = sortAndStrip((value as Record<string, unknown>)[k], false);
    }
    return out;
  }
  return value;
}

/** Short stable content hash of a chapter's reader-facing fields (v2). */
export function chapterContentHash(chapter: ChapterV21): string {
  return createHash("sha256").update(JSON.stringify(sortAndStrip(chapter, true))).digest("hex").slice(0, 16);
}

export function hashForVersion(chapter: ChapterV21, version: QcHashVersion | undefined): string {
  return version === "v2" ? chapterContentHash(chapter) : chapterContentHashV1(chapter);
}

/** Whether an attestation's recorded hash still matches the chapter as it is
 *  now, using the hash version the attestation was RECORDED with. The single
 *  staleness predicate — qc-status and the promote gate must both use this,
 *  or they disagree the moment the hash algorithm evolves.
 *  Legacy attestations (hashVersion absent) predate version stamping and may
 *  carry either pre-v2 algorithm — they are fresh when EITHER matches. */
export function isAttestationFresh(att: QcAttestation, chapter: ChapterV21): boolean {
  if (att.hashVersion === "v2") return att.contentHash === chapterContentHash(chapter);
  if (att.hashVersion === "v1") return att.contentHash === chapterContentHashV1(chapter);
  return att.contentHash === chapterContentHashV1(chapter) || att.contentHash === chapterContentHashV0(chapter);
}

export function attestationPath(bookId: string, chapterNumber: number): string {
  return resolve(QC_DIR, `${bookId}-ch${String(chapterNumber).padStart(2, "0")}.qc.json`);
}

export function loadAttestation(bookId: string, chapterNumber: number): QcAttestation | null {
  const p = attestationPath(bookId, chapterNumber);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8")) as QcAttestation;
  } catch {
    return null;
  }
}

export function writeAttestation(att: QcAttestation): string {
  mkdirSync(QC_DIR, { recursive: true });
  const p = attestationPath(att.bookId, att.chapterNumber);
  writeFileSync(p, JSON.stringify(att, null, 2), "utf8");
  return p;
}

export type QcFinding = { checkId: string; severity: "blocker" | "advisory"; message: string };

/** Reviewer-identity allowlist. A PUBLISHABLE attestation only counts at the
 *  gate if its reviewer carries an approved QC ROLE prefix (the segment before
 *  the first ":"). This stops the WRITER agent from self-certifying its own
 *  output — the whole semantic gate assumes reviewer ≠ author (see
 *  QC-SESSION-PROMPT.md "a separate writer agent (Codex) produces the
 *  chapters; you evaluate them"). On-disk reviewers are
 *  claude-qc:/codex-qc:/harness:/human:; the writer identity is codex:writer.
 *
 *  NOTE: this is a default-safe GUARDRAIL, not a cryptographic guarantee — a
 *  single agent willing to relabel itself a reviewer can still pass it. The
 *  honesty-INDEPENDENT catch for the worst class (wrong quiz keys) is the model
 *  judge enforced via quizKeyGate.ts. Override the allowed roles with
 *  CHAPTERFLOW_QC_REVIEWERS (comma-separated role prefixes). */
const DEFAULT_QC_REVIEWERS = ["claude-qc", "codex-qc", "harness", "human"];

export function approvedReviewerRoles(): string[] {
  const env = process.env.CHAPTERFLOW_QC_REVIEWERS;
  if (env && env.trim()) return env.split(",").map((s) => s.trim()).filter(Boolean);
  return DEFAULT_QC_REVIEWERS;
}

/** True if the reviewer string carries an approved QC role prefix. */
export function isApprovedReviewer(reviewer: string): boolean {
  const role = (reviewer.split(":")[0] ?? "").trim().toLowerCase();
  return approvedReviewerRoles().some((r) => r.toLowerCase() === role);
}

/**
 * The gate check. `enforce` true → severities are "blocker" (promote);
 * false → "advisory" (gate-chapter, so iteration isn't blocked).
 * A chapter passes iff it carries a PUBLISHABLE attestation whose contentHash
 * still matches the chapter as it is on disk now AND whose reviewer is an
 * approved QC role (not the writer that produced it).
 */
export function checkQcAttestation(chapter: ChapterV21, enforce: boolean): QcFinding[] {
  const sev = enforce ? "blocker" : "advisory";
  const parsed = chapter.chapterId ? parseChapterId(chapter.chapterId) : null;
  const bookId = parsed?.bookId ?? "";
  const num = chapter.number;
  const att = loadAttestation(bookId, num);
  if (!att) {
    return [{ checkId: "QC0.missing_attestation", severity: sev,
      message: `No QC attestation at ${attestationPath(bookId, num)}. A Claude reviewer must read this chapter and run \`qc-attest\` before it can ship.` }];
  }
  if (att.verdict !== "PUBLISHABLE") {
    return [{ checkId: "QC0.not_publishable", severity: sev,
      message: `QC verdict is ${att.verdict}, not PUBLISHABLE${att.findings?.length ? ` — ${att.findings.slice(0, 3).join("; ")}` : ""}. Fix and re-review.` }];
  }
  if (!isAttestationFresh(att, chapter)) {
    const now = hashForVersion(chapter, att.hashVersion);
    return [{ checkId: "QC0.stale_attestation", severity: sev,
      message: `QC attestation is STALE: the chapter changed since review (attested ${att.contentHash}, now ${now}, hash ${att.hashVersion ?? "v1"}). Re-review before shipping.` }];
  }
  if (!isApprovedReviewer(att.reviewer)) {
    return [{ checkId: "QC0.unverified_reviewer", severity: sev,
      message: `QC reviewer "${att.reviewer}" is not an approved QC role (${approvedReviewerRoles().join(", ")}). A chapter cannot be certified by its own writer — review it in a QC session and re-attest as e.g. "claude-qc:<id>" or "codex-qc:<id>" (set CHAPTERFLOW_QC_REVIEWERS to change the allowed roles).` }];
  }
  if (isNoApiCodexQcMode()) {
    if (!att.roundId || !att.roundRole || !["bar", "confirm", "attest"].includes(att.roundRole)) {
      return [{ checkId: "QC0.no_api_round_missing", severity: sev,
        message: `No-api QC mode requires a fresh round-backed attestation (qc-attest --round <roundId> --token <bar|confirm|attest token>). Legacy attestations remain readable but cannot promote in this mode.` }];
    }
    if (!loadQcRound(att.bookId, att.roundId)?.roles?.[att.roundRole]) {
      return [{ checkId: "QC0.no_api_round_missing", severity: sev,
        message: `No-api QC mode requires an attestation backed by an existing QC round file. Re-open a round and re-attest ${chapter.chapterId}.` }];
    }
    const artifactFindings = checkBarConfirmArtifactsForPublishable(chapter, att, enforce);
    if (artifactFindings.length > 0) return artifactFindings;
  }
  return [];
}
