/**
 * Model bake-off — corpus intake (no-draft; WP-703).
 *
 * The draft intake (`intake.ts`) requires an operator manuscript ≥200 chars and
 * grounds a fresh research session in it. The SCREENING corpus books have no such
 * draft: their research + compile shared inputs are frozen ON DISK (the sealed
 * bakeoff corpus, WP-701/701b). This module is the no-draft entry the conductor
 * uses for a COMPARE-ONLY chapter-subset run over that frozen state. It:
 *
 *   (a) verifies `docs/v25/bakeoff-corpus-v1/corpus-manifest.json` is
 *       `bakeoffReadiness === "ready-for-bakeoff"` AND the target unit's
 *       `authoringSource` is a RESOLVED repo-relative pointer (allowlist — the
 *       same derivation the corpus-fixtures test uses), failing CLOSED with a
 *       truthful message otherwise (the manifest is not-ready until D-7 resolves
 *       every authoringSource);
 *   (b) verifies the shared-input files exist on disk (reusing the freeze
 *       machinery's `collectSharedInputPaths`, which the freeze then hashes);
 *   (c) records a `CorpusIntakeV1` so the conductor can SKIP the draft-research
 *       phases idempotently and preserve compare-only semantics.
 *
 * Zero model calls. It reads the manifest + checks file existence; it never
 * authors, researches, promotes, or publishes.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { normSlug } from "../lib/chapterPaths.js";
import { collectSharedInputPaths } from "./freeze.js";
import { PIPELINE_DIR, pipelineRel } from "./paths.js";
import type { CorpusIntakeV1 } from "./types.js";

/** The repo git root (four levels up from the pipeline dir) — where the sealed
 *  corpus packet lives. Recomputed here so this module has no dependency on the
 *  conductor's own copy of the constant. */
export const CORPUS_REPOSITORY_ROOT = resolve(PIPELINE_DIR, "../../../..");

/** The default corpus manifest the screening reads. */
export const DEFAULT_CORPUS_MANIFEST_REL_PATH = "docs/v25/bakeoff-corpus-v1/corpus-manifest.json";

export class CorpusIntakeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CorpusIntakeError";
  }
}

/** Placeholder authoringSource values that must NEVER count as resolved — the
 *  fail-closed allowlist (mirrors the corpus-fixtures red-team FINDING-1). */
const AUTHORING_SOURCE_PLACEHOLDERS = new Set([
  "", "UNRESOLVED", "TODO", "PENDING", "TBD", "NULL", "NONE", "N/A",
]);

/** A unit's authoringSource is resolved ONLY when it looks like a real repo-
 *  relative pointer (path-shaped, containing a directory separator, optionally
 *  with a #fragment). Anything else stays fail-closed. The SAME derivation the
 *  corpus-fixtures verification test uses, so intake and the packet's own
 *  bakeoffReadiness can never disagree. */
export function isResolvedAuthoringSource(value: string): boolean {
  const trimmed = value.trim();
  if (AUTHORING_SOURCE_PLACEHOLDERS.has(trimmed.toUpperCase())) return false;
  return trimmed.includes("/") && /^[A-Za-z0-9][A-Za-z0-9._/-]*(#[A-Za-z0-9._-]+)?$/.test(trimmed);
}

type CorpusManifestUnit = {
  unit?: string;
  bookId?: string;
  chapterNumber?: number;
  authoringSource?: string;
  sourceHash?: string;
  sealedChapterDiagnostic?: number;
};

type CorpusManifest = {
  schema?: string;
  corpusId?: string;
  bakeoffReadiness?: string;
  bakeoffReadinessReason?: string;
  units?: CorpusManifestUnit[];
};

export type CorpusIntakeDeps = {
  /** Read the manifest bytes (injectable so tests point at a fixture). */
  readManifestText?: (manifestPath: string) => string;
  /** Verify + list the shared-input files for the book/chapters (default reuses
   *  the freeze machinery's collectSharedInputPaths — it THROWS when a required
   *  input is missing). Injectable so a fixture-manifest test proves the ready
   *  path without the on-disk compile outputs. */
  collectSharedInputs?: (bookId: string, chapters: number[]) => string[];
};

export type IntakeCorpusArgs = {
  bookId: string;
  /** The chapter subset under test (non-empty; the conductor enforces a strict
   *  subset ⇒ compare-only). */
  chapters: number[];
  /** Override the manifest location (tests point at a fixture). Absolute, or
   *  repo-relative to `repositoryRoot`. */
  manifestPath?: string;
  repositoryRoot?: string;
  deps?: CorpusIntakeDeps;
};

/**
 * Fail-closed corpus intake for a no-draft, compare-only chapter-subset run.
 * Returns the `CorpusIntakeV1` record on success; throws `CorpusIntakeError`
 * (readiness / authoringSource) or the freeze machinery's `SharedInputsError`
 * (missing shared input) otherwise. NEVER a silent partial success.
 */
export function intakeCorpus(args: IntakeCorpusArgs): CorpusIntakeV1 {
  const bookId = normSlug(args.bookId);
  const chapters = [...new Set(args.chapters)].sort((a, b) => a - b);
  if (chapters.length === 0) {
    throw new CorpusIntakeError(`corpus intake for ${bookId} needs at least one chapter (a compare-only subset).`);
  }
  const repositoryRoot = args.repositoryRoot ?? CORPUS_REPOSITORY_ROOT;
  const manifestRel = args.manifestPath ?? DEFAULT_CORPUS_MANIFEST_REL_PATH;
  const manifestAbs = resolve(repositoryRoot, manifestRel);
  const readManifestText = args.deps?.readManifestText ?? ((p: string) => readFileSync(p, "utf8"));
  const collectSharedInputs = args.deps?.collectSharedInputs ?? collectSharedInputPaths;

  if (args.deps?.readManifestText === undefined && !existsSync(manifestAbs)) {
    throw new CorpusIntakeError(`corpus manifest not found at ${manifestAbs} — the sealed bakeoff corpus packet must exist before a corpus run.`);
  }

  let manifest: CorpusManifest;
  try {
    manifest = JSON.parse(readManifestText(manifestAbs)) as CorpusManifest;
  } catch (err) {
    throw new CorpusIntakeError(`corpus manifest ${manifestAbs} is not valid JSON: ${(err as Error).message.split("\n")[0]}`);
  }

  // (a) readiness gate — fail closed with the manifest's OWN stated reason.
  if (manifest.bakeoffReadiness !== "ready-for-bakeoff") {
    const reason = manifest.bakeoffReadinessReason?.trim() || "no reason stated";
    throw new CorpusIntakeError(
      `corpus packet "${manifest.corpusId ?? "(unknown)"}" is not bakeoff-ready (bakeoffReadiness="${manifest.bakeoffReadiness ?? "(absent)"}"): ${reason}. ` +
      `No unit may enter the bakeoff until the packet is ready-for-bakeoff.`,
    );
  }

  const units = Array.isArray(manifest.units) ? manifest.units : [];
  const intakeUnits: CorpusIntakeV1["units"] = [];
  for (const chapterNumber of chapters) {
    const unit = units.find((u) => normSlug(u.bookId ?? "") === bookId && u.chapterNumber === chapterNumber);
    if (unit === undefined) {
      throw new CorpusIntakeError(
        `corpus manifest has no unit for ${bookId} chapter ${chapterNumber} — the requested chapter is not part of the sealed corpus.`,
      );
    }
    const authoringSource = String(unit.authoringSource ?? "");
    if (!isResolvedAuthoringSource(authoringSource)) {
      throw new CorpusIntakeError(
        `corpus unit ${unit.unit ?? `${bookId}-ch${String(chapterNumber).padStart(2, "0")}`} has an UNRESOLVED authoringSource (${JSON.stringify(authoringSource)}) — ` +
        `a unit may enter the bakeoff only once its authoringSource is a resolved draft/manuscript pointer (owner decision D-7).`,
      );
    }
    intakeUnits.push({
      unit: unit.unit ?? `${bookId}-ch${String(chapterNumber).padStart(2, "0")}`,
      chapterNumber,
      authoringSource,
      sourceHash: String(unit.sourceHash ?? ""),
      sealedChapterDiagnostic:
        typeof unit.sealedChapterDiagnostic === "number" && Number.isFinite(unit.sealedChapterDiagnostic)
          ? unit.sealedChapterDiagnostic
          : null,
    });
  }

  // (b) shared-input existence — reuse the freeze machinery (it throws on a
  // missing required input, so intake fails fast with a truthful message BEFORE
  // preflight/candidates rather than mid-generation).
  const sharedInputs = collectSharedInputs(bookId, chapters);

  return {
    schemaVersion: "model-bakeoff-corpus-intake-v1",
    corpusId: manifest.corpusId ?? "(unknown)",
    manifestRelPath: pipelineRel(manifestAbs).startsWith("..") ? manifestRel : pipelineRel(manifestAbs),
    bookId,
    chapters,
    units: intakeUnits,
    sharedInputCount: sharedInputs.length,
    intakeAt: new Date().toISOString(),
  };
}
