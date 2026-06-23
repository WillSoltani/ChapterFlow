import { readFileSync } from "fs";
import { resolve } from "path";

import { hashText } from "../qc/sourceV2Gate.js";
import { REPO_ROOT, normSlug } from "../lib/chapterPaths.js";
import { canonicalJsonSha256 } from "../lib/canonicalJson.js";
import { findRunArtifact } from "../lib/runDirs.js";
import { stripMetaReferences } from "../source-loader.js";
import type {
  SourceAnchorForPrompt,
  SourceAnchorKind,
  SourceClaimType,
} from "../types.js";
import type { SourceSidecarV2 } from "./sidecarSchema.js";

export const SOURCE_EVIDENCE_SCHEMA_VERSION = "planning-source-evidence-v1" as const;

const DEFAULT_RUNS_ROOT = resolve(REPO_ROOT, ".chapterflow/runs");

export type PlanningSourceEvidenceRoots = {
  runsRoot?: string;
};

export type PlanningSourceEvidenceOptions = PlanningSourceEvidenceRoots & {
  requireSourceV2?: boolean;
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

function placeholderAnchorId(id: string): boolean {
  return (
    /^(anchor|source-anchor|sourceAnchor|id|todo|tbd|fixme|placeholder)([-_:]?\d*)?$/i.test(id.trim()) ||
    /\b(todo|tbd|fixme|placeholder)\b/i.test(id)
  );
}

function nonempty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function slug(value: string): string {
  return normSlug(value).replace(/-/g, ".");
}

function defaultClaimTypesFor(kind: SourceAnchorKind): SourceClaimType[] {
  if (kind === "named_example") return ["example", "hook", "breakdown_claim", "memorable_line"];
  if (kind === "testable_fact") {
    return [
      "book_thesis",
      "core_idea",
      "core_move",
      "hook",
      "breakdown_claim",
      "quiz_prompt",
      "quiz_explanation",
      "quiz_key_evidence",
      "review_card",
      "implementation_guidance",
      "takeaway",
      "memorable_line",
    ];
  }
  return [
    "book_thesis",
    "core_idea",
    "core_move",
    "hook",
    "breakdown_claim",
    "review_card",
    "implementation_guidance",
    "takeaway",
    "memorable_line",
  ];
}

export function validateSourceV2SidecarForPlanning(sc: unknown, chapterNumber: number): string[] {
  const blockers: string[] = [];
  const sidecar = sc as Partial<SourceSidecarV2> | null;
  const nn = String(chapterNumber).padStart(2, "0");
  if (!sidecar || typeof sidecar !== "object") return ["source sidecar must be an object"];
  if (sidecar.schemaVersion !== "source-v2") {
    blockers.push(`sidecar schemaVersion ${JSON.stringify((sidecar as any)?.schemaVersion)} is not "source-v2"`);
  }
  if (typeof sidecar.chapterNumber === "number" && sidecar.chapterNumber !== chapterNumber) {
    blockers.push(`sidecar chapterNumber ${sidecar.chapterNumber} does not match requested chapter ${chapterNumber}`);
  }
  if (!sidecar.centralConcept || typeof sidecar.centralConcept !== "object") {
    blockers.push("centralConcept missing");
  } else {
    if (!nonempty(sidecar.centralConcept.id)) blockers.push("centralConcept.id is required for stable provenance");
    if (!nonempty(sidecar.centralConcept.name)) blockers.push("centralConcept.name missing");
    if (!nonempty(sidecar.centralConcept.plainDefinition)) blockers.push("centralConcept.plainDefinition missing");
  }
  const seen = new Map<string, string>();
  const checkId = (id: unknown, location: string) => {
    if (!nonempty(id)) {
      blockers.push(`${location}.id is required`);
      return;
    }
    const anchorId = id.trim();
    if (placeholderAnchorId(anchorId)) blockers.push(`${location}.id "${anchorId}" is a placeholder`);
    if (!anchorId.includes(`ch${nn}.`)) {
      blockers.push(`${location}.id "${anchorId}" must include chapter prefix ch${nn}.`);
    }
    const prior = seen.get(anchorId);
    if (prior) blockers.push(`${location}.id "${anchorId}" duplicates ${prior}`);
    else seen.set(anchorId, location);
  };
  if (sidecar.centralConcept?.id) checkId(sidecar.centralConcept.id, "centralConcept");

  const namedExamples = Array.isArray(sidecar.namedExamples) ? sidecar.namedExamples : [];
  if (namedExamples.length < 3) blockers.push(`namedExamples has ${namedExamples.length}; need at least 3`);
  namedExamples.forEach((example, i) => {
    checkId((example as any)?.id, `namedExamples[${i}]`);
    if (!nonempty((example as any)?.label)) blockers.push(`namedExamples[${i}].label missing`);
    if (!nonempty((example as any)?.summary)) blockers.push(`namedExamples[${i}].summary missing`);
    const specifics = Array.isArray((example as any)?.hardSpecifics)
      ? (example as any).hardSpecifics.filter(nonempty)
      : [];
    if (specifics.length < 2) blockers.push(`namedExamples[${i}].hardSpecifics has ${specifics.length}; need at least 2`);
  });

  const facts = Array.isArray(sidecar.testableFacts) ? sidecar.testableFacts : [];
  if (facts.length < 9) blockers.push(`testableFacts has ${facts.length}; need at least 9`);
  facts.forEach((fact, i) => {
    checkId((fact as any)?.id, `testableFacts[${i}]`);
    for (const key of ["claim", "becauseMechanism", "commonError", "errorIsWhy"]) {
      if (!nonempty((fact as any)?.[key])) blockers.push(`testableFacts[${i}].${key} missing`);
    }
  });
  return blockers;
}

export function buildSourceAnchorCatalog(sc: SourceSidecarV2): SourceAnchorForPrompt[] {
  const anchors: SourceAnchorForPrompt[] = [];
  if (sc.centralConcept?.id) {
    anchors.push({
      id: sc.centralConcept.id,
      kind: "concept",
      label: sc.centralConcept.name,
      text: [sc.centralConcept.plainDefinition, sc.centralConcept.whyItMatters].filter(Boolean).join(" "),
      supportsClaimTypes: defaultClaimTypesFor("concept"),
    });
  }
  for (const example of sc.namedExamples ?? []) {
    if (!example?.id) continue;
    anchors.push({
      id: example.id,
      kind: "named_example",
      label: example.label,
      text: [example.summary, example.teachesWhat].filter(Boolean).join(" "),
      hardSpecifics: (example.hardSpecifics ?? []).map(String),
      supportsClaimTypes: defaultClaimTypesFor("named_example"),
    });
  }
  for (const fact of sc.testableFacts ?? []) {
    if (!fact?.id) continue;
    anchors.push({
      id: fact.id,
      kind: "testable_fact",
      label: fact.claim,
      text: [fact.claim, fact.becauseMechanism, fact.commonError, fact.errorIsWhy].filter(Boolean).join(" "),
      supportsClaimTypes: defaultClaimTypesFor("testable_fact"),
    });
  }
  for (const framework of sc.frameworks ?? []) {
    if (!framework?.name) continue;
    const id = `ch${String(sc.chapterNumber).padStart(2, "0")}.framework.${slug(framework.name)}`;
    anchors.push({
      id,
      kind: "framework",
      label: framework.name,
      text: (framework.members ?? []).join(", "),
      supportsClaimTypes: defaultClaimTypesFor("framework"),
    });
  }
  return anchors;
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
    const sidecarBlockers = validateSourceV2SidecarForPlanning(rawSidecar, chapterNumber);
    if (sidecarBlockers.length > 0) blockers.push(...sidecarBlockers);
    else chapterSidecar = rawSidecar as SourceSidecarV2;
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
  const anchors = chapterSidecar ? buildSourceAnchorCatalog(chapterSidecar) : [];
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
    parts.push("# Book source material");
    parts.push(evidence.bookSource);
  }
  if (evidence.toc) {
    parts.push("# Table of contents");
    parts.push(evidence.toc);
  }
  if (evidence.sourceV2) {
    parts.push("# Validated source-v2 anchor catalog");
    parts.push(JSON.stringify(evidence.anchors, null, 2));
  }
  const rendered = parts.join("\n\n").trim();
  return rendered || undefined;
}

export function renderChapterSourceForPlanner(evidence: PlanningSourceEvidence): string | undefined {
  const parts: string[] = [];
  if (evidence.chapterSidecar) {
    parts.push("# Exact validated chapter sidecar");
    parts.push(JSON.stringify(evidence.chapterSidecar, null, 2));
    parts.push("# Allowed source anchors");
    parts.push(JSON.stringify(evidence.anchors, null, 2));
  }
  if (evidence.chapterSource) {
    parts.push("# Chapter source excerpt");
    parts.push(evidence.chapterSource);
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
