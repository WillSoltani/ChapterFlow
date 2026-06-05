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

export const QC_DIR = resolve(CANONICAL_STATE, "qc");

export type QcVerdict = "PUBLISHABLE" | "REVISE" | "CORRUPTION";

export type QcAttestation = {
  schemaVersion: "qc-attest-v1";
  bookId: string;
  chapterNumber: number;
  chapterId: string;
  verdict: QcVerdict;
  /** chapterContentHash() captured at review time. */
  contentHash: string;
  /** who/what produced the verdict, e.g. "claude-qc:wf_93f0a1dd" or a session id. */
  reviewer: string;
  reviewedAt: string;
  /** per-dimension booleans the reviewer checked (keysCorrect, grounded, …). */
  dimensions?: Record<string, boolean>;
  findings?: string[];
  notes?: string;
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

/** Canonical reader-facing projection of a chapter, in a fixed key order so
 *  JSON.stringify is deterministic. Anything a reader sees and the reviewer
 *  judged goes here; ids / metadata / provenance do not. */
function canonicalContent(ch: any): unknown {
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

/** Short stable content hash of a chapter's reader-facing fields. */
export function chapterContentHash(chapter: ChapterV21): string {
  return createHash("sha256").update(JSON.stringify(canonicalContent(chapter))).digest("hex").slice(0, 16);
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

/**
 * The gate check. `enforce` true → severities are "blocker" (promote);
 * false → "advisory" (gate-chapter, so iteration isn't blocked).
 * A chapter passes iff it carries a PUBLISHABLE attestation whose contentHash
 * still matches the chapter as it is on disk now.
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
  const now = chapterContentHash(chapter);
  if (att.contentHash !== now) {
    return [{ checkId: "QC0.stale_attestation", severity: sev,
      message: `QC attestation is STALE: the chapter changed since review (attested ${att.contentHash}, now ${now}). Re-review before shipping.` }];
  }
  return [];
}
