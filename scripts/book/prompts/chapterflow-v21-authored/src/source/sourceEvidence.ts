import { readFileSync } from "fs";
import { resolve } from "path";

import { hashText } from "../qc/sourceV2Gate.js";
import { REPO_ROOT, normSlug } from "../lib/chapterPaths.js";
import { canonicalJsonSha256 } from "../lib/canonicalJson.js";
import { findRunArtifact } from "../lib/runDirs.js";
import { renderUntrustedSourceBlock } from "../providers/types.js";
import { stripMetaReferences } from "../source-loader.js";
import type {
  SourceAnchorForPrompt,
  SourceClaimType,
} from "../types.js";
import type { SourceSidecarV2 } from "./sidecarSchema.js";
import { evaluateSourceV2Integrity } from "./sourceIntegrity.js";
export { buildSourceAnchorCatalog } from "./sourceIntegrity.js";

export const SOURCE_EVIDENCE_SCHEMA_VERSION = "planning-source-evidence-v1" as const;

const DEFAULT_RUNS_ROOT = resolve(REPO_ROOT, ".chapterflow/runs");

export type PlanningSourceEvidenceRoots = {
  runsRoot?: string;
};

export type PlanningSourceEvidenceOptions = PlanningSourceEvidenceRoots & {
  requireSourceV2?: boolean;
  chapterTitle?: string;
};

export type PlanningSourceEvidence = {
  schemaVersion: typeof SOURCE_EVIDENCE_SCHEMA_VERSION;
  bookId: string;
  chapterNumber: number;
  bookSource: string | null;
  toc: string | null;
  chapterSource: string | null;
  chapterSidecar: SourceSidecarV2 | null;
  chapterSidecarPath: string | null;
  chapterSourcePath: string | null;
  bookSourcePath: string | null;
  tocPath: string | null;
  sourceHash: string;
  anchorCatalogHash: string;
  anchors: SourceAnchorForPrompt[];
  available: boolean;
  sourceV2: boolean;
};

export class SourceEvidenceError extends Error {
  readonly blockers: string[];

  constructor(message: string, blockers: string[]) {
    super(`${message}: ${blockers.join("; ")}`);
    this.name = "SourceEvidenceError";
    this.blockers = blockers;
  }
}

function readText(path: string | null): string | null {
  if (!path) return null;
  const stripped = stripMetaReferences(readFileSync(path, "utf8"));
  return stripped;
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

function sourceRel(chapterNumber: number): string {
  return `sidecars/source/ch${String(chapterNumber).padStart(2, "0")}.source.json`;
}

function sourceTextRel(chapterNumber: number): string {
  return `sidecars/source/ch${String(chapterNumber).padStart(2, "0")}.source.txt`;
}

export function validateSourceV2SidecarForPlanning(sc: unknown, chapterNumber: number): string[] {
  // Only structural blockers gate planning; realness heuristics are advisory.
  return evaluateSourceV2Integrity(sc, { chapterNumber }).findings
    .filter((finding) => finding.severity === "blocker")
    .map((finding) => `${finding.checkId}: ${finding.message}`);
}

export function loadPlanningSourceEvidence(
  bookId: string,
  chapterNumber: number,
  options: PlanningSourceEvidenceOptions = {},
): PlanningSourceEvidence {
  const runsRoot = options.runsRoot ?? DEFAULT_RUNS_ROOT;
  const requireSourceV2 =
    options.requireSourceV2 ??
    (process.env.CHAPTERFLOW_REQUIRE_SOURCE_V2 === "1" ||
      process.env.CHAPTERFLOW_NO_API_CODEX_QC === "1");

  const bookSourcePath = findRunArtifact(runsRoot, bookId, "source-freeze/book-source.md");
  const tocPath = findRunArtifact(runsRoot, bookId, "source-freeze/toc.json");
  const chapterSourcePath = findRunArtifact(runsRoot, bookId, sourceTextRel(chapterNumber));
  const chapterSidecarPath = findRunArtifact(runsRoot, bookId, sourceRel(chapterNumber));
  const blockers: string[] = [];

  let rawSidecar: unknown = null;
  let chapterSidecar: SourceSidecarV2 | null = null;
  let anchors: SourceAnchorForPrompt[] = [];
  if (!chapterSidecarPath) {
    if (requireSourceV2) blockers.push(`Missing source-v2 sidecar for ch${String(chapterNumber).padStart(2, "0")}`);
  } else {
    try {
      rawSidecar = readJson(chapterSidecarPath);
    } catch (err) {
      blockers.push(`Unreadable source sidecar ${chapterSidecarPath}: ${(err as Error).message}`);
    }
  }

  if (rawSidecar && ((rawSidecar as any).schemaVersion === "source-v2" || requireSourceV2)) {
    const integrity = evaluateSourceV2Integrity(rawSidecar, {
      chapterNumber,
      chapterTitle: options.chapterTitle,
      rawText: chapterSidecarPath ? readFileSync(chapterSidecarPath, "utf8") : undefined,
    });
    if (!integrity.passed) blockers.push(...integrity.findings.filter((finding) => finding.severity === "blocker").map((finding) => `${finding.checkId}: ${finding.message}`));
    else {
      chapterSidecar = integrity.sidecar;
      anchors = integrity.anchors;
    }
  }
  if (requireSourceV2 && !chapterSidecar) {
    blockers.push("Validated source-v2 chapter evidence is required before planning");
  }
  if (blockers.length > 0) {
    throw new SourceEvidenceError(`${bookId} ch${String(chapterNumber).padStart(2, "0")} source evidence blocked`, blockers);
  }

  const bookSource = readText(bookSourcePath);
  const chapterSource = readText(chapterSourcePath);
  const toc = tocPath ? readFileSync(tocPath, "utf8") : null;
  const sourceFingerprint = {
    schemaVersion: SOURCE_EVIDENCE_SCHEMA_VERSION,
    bookId: normSlug(bookId),
    chapterNumber,
    bookSource,
    toc,
    chapterSource,
    chapterSidecar: rawSidecar,
    anchors,
  };
  const sourceHash = canonicalJsonSha256(sourceFingerprint);
  return {
    schemaVersion: SOURCE_EVIDENCE_SCHEMA_VERSION,
    bookId: normSlug(bookId),
    chapterNumber,
    bookSource,
    toc,
    chapterSource,
    chapterSidecar,
    chapterSidecarPath,
    chapterSourcePath,
    bookSourcePath,
    tocPath,
    sourceHash,
    anchorCatalogHash: canonicalJsonSha256(anchors),
    anchors,
    available: !!(bookSource || toc || chapterSource || rawSidecar),
    sourceV2: !!chapterSidecar,
  };
}

export function renderBookSourceForEditor(evidence: PlanningSourceEvidence): string | undefined {
  const parts: string[] = [];
  if (evidence.bookSource) {
    parts.push(renderUntrustedSourceBlock("Book source material", evidence.bookSource));
  }
  if (evidence.toc) {
    parts.push(renderUntrustedSourceBlock("Table of contents", evidence.toc, "json"));
  }
  if (evidence.sourceV2) {
    parts.push(renderUntrustedSourceBlock("Validated source-v2 anchor catalog", JSON.stringify(evidence.anchors, null, 2), "json"));
  }
  const rendered = parts.join("\n\n").trim();
  return rendered || undefined;
}

export function renderChapterSourceForPlanner(evidence: PlanningSourceEvidence): string | undefined {
  const parts: string[] = [];
  if (evidence.chapterSidecar) {
    parts.push(renderUntrustedSourceBlock("Exact validated chapter sidecar", JSON.stringify(evidence.chapterSidecar, null, 2), "json"));
    parts.push(renderUntrustedSourceBlock("Allowed source anchors", JSON.stringify(evidence.anchors, null, 2), "json"));
  }
  if (evidence.chapterSource) {
    parts.push(renderUntrustedSourceBlock("Chapter source excerpt", evidence.chapterSource));
  }
  const rendered = parts.join("\n\n").trim();
  return rendered || undefined;
}

export function selectAnchorsForClaim(
  evidence: PlanningSourceEvidence,
  claimTypes: SourceClaimType[],
  preferredIds: string[] = [],
  limit = 8,
): SourceAnchorForPrompt[] {
  const preferred = new Set(preferredIds.filter(Boolean));
  const matchesClaim = (anchor: SourceAnchorForPrompt) =>
    anchor.supportsClaimTypes.some((claimType) => claimTypes.includes(claimType));
  const selected = [
    ...evidence.anchors.filter((anchor) => preferred.has(anchor.id) && matchesClaim(anchor)),
    ...evidence.anchors.filter((anchor) => !preferred.has(anchor.id) && matchesClaim(anchor)),
  ];
  return selected.slice(0, limit);
}

export function anchorIds(anchors: SourceAnchorForPrompt[]): string[] {
  return anchors.map((anchor) => anchor.id);
}

export function sourceEvidenceDependencyValue(evidence: PlanningSourceEvidence | undefined): unknown {
  if (!evidence || !evidence.available) return { schemaVersion: SOURCE_EVIDENCE_SCHEMA_VERSION, available: false };
  return {
    schemaVersion: evidence.schemaVersion,
    sourceHash: evidence.sourceHash,
    anchorCatalogHash: evidence.anchorCatalogHash,
    sourceV2: evidence.sourceV2,
    sidecarPath: evidence.chapterSidecarPath,
  };
}

export function sourceEvidenceShortHash(evidence: PlanningSourceEvidence): string {
  return hashText(`${evidence.sourceHash}:${evidence.anchorCatalogHash}`);
}
