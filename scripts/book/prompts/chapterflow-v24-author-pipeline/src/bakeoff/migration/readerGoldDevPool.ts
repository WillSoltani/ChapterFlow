/**
 * reader-gold-dev-pool-v1 — the PROSE-BLIND frozen candidate pool for the
 * development reader-gold controls (owner-ratified D2/D3, 2026-07-15 — see
 * docs/v25/reports/V25_PILOT_READINESS_OWNER_RATIFICATION.md).
 *
 * The IMP-24F adjudication packet requires new reader gold whose selection was
 * frozen BEFORE any prose inspection and independent of every candidate-model
 * output. This module selects 24 of the 46 unused chapters across the four
 * independent books (absent from every frozen corpus, below the clean-base
 * floor, disjoint from pilot/gold candidate books) using ONLY chapter counts
 * and arithmetic — no prose field ever influences the selection:
 *
 *   1. Books in lexicographic order; target 24 across 4 books.
 *   2. A book with chapterCount <= floor(24/4) contributes ALL its chapters.
 *   3. The remaining quota is split across the remaining books proportionally
 *      to chapter count (largest-remainder rounding; ties lexicographic).
 *   4. Within a book taking k of N chapters: 1-based chapter numbers
 *      round(i*(N-1)/(k-1)) + 1 for i in 0..k-1 (even position spacing).
 *
 * The manifest is create-once: re-materialization must be byte-identical.
 * Adjudication labels come later and NEVER modify this manifest.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { hashCanonical, sha256Hex } from "../../contracts/contractUtil.js";
import { canonicalPretty } from "./corpusBuilderCore.js";
import { writeFileAtomic } from "../../lib/atomicWrite.js";

const PIPELINE_REL = "scripts/book/prompts/chapterflow-v24-author-pipeline";

export const READER_GOLD_DEV_POOL_ID = "reader-gold-dev-pool-v1" as const;
export const READER_GOLD_DEV_POOL_SCHEMA = "reader-gold-dev-pool-selection-manifest-v1" as const;
export const READER_GOLD_DEV_POOL_MANIFEST_REL_PATH =
  `${PIPELINE_REL}/state/migration-experiments/${READER_GOLD_DEV_POOL_ID}/selection-manifest.json` as const;
export const READER_GOLD_DEV_POOL_TARGET = 24 as const;
export const READER_GOLD_DEV_POOL_BOOKS = Object.freeze([
  "factfulness",
  "made-to-stick",
  "nudge",
  "the-happiness-hypothesis",
] as const);

export type ReaderGoldDevPoolStratum = "early" | "middle" | "late";

export type ReaderGoldDevPoolBookSelectionV1 = {
  bookId: string;
  packagePath: string;
  packageBytesSha256: string;
  chapterCount: number;
  quota: number;
  selectedChapters: Array<{ chapterNumber: number; positionStratum: ReaderGoldDevPoolStratum }>;
};

export type ReaderGoldDevPoolSelectionManifestV1 = {
  schema: typeof READER_GOLD_DEV_POOL_SCHEMA;
  poolId: typeof READER_GOLD_DEV_POOL_ID;
  ratification: {
    document: "docs/v25/reports/V25_PILOT_READINESS_OWNER_RATIFICATION.md";
    ownerApprovedForDevelopmentBakeoff: true;
    independentHumanRater: false;
    publicationCertification: false;
    candidateOutputsUsedForLabels: false;
    selectionFrozenBeforeProseInspection: true;
  };
  selectionRule: string;
  targetTotal: typeof READER_GOLD_DEV_POOL_TARGET;
  books: ReaderGoldDevPoolBookSelectionV1[];
  totalSelected: number;
  adjudication: {
    method: "dual-context-isolated-mixed-family-with-arbitration";
    aSideFamily: "gpt-5.6-sol (codex exec, ChatGPT-authenticated)";
    bSideFamily: "claude (session-isolated subagent, zero codex calls)";
    aSideCallBudget: { base: 24; hardMaximum: 48 };
    ownerSpotCheckControls: 3;
  };
  selectionSha256: string;
};

export class ReaderGoldDevPoolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReaderGoldDevPoolError";
  }
}

function requireCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new ReaderGoldDevPoolError(message);
}

/** Evenly spaced 1-based chapter numbers: round(i*(N-1)/(k-1)) + 1. */
export function evenlySpacedChapters(chapterCount: number, quota: number): number[] {
  requireCondition(Number.isInteger(chapterCount) && Number.isInteger(quota)
    && quota >= 1 && chapterCount >= quota, "invalid evenly-spaced selection inputs");
  if (quota === chapterCount) return Array.from({ length: chapterCount }, (_, i) => i + 1);
  const picks = Array.from({ length: quota }, (_, i) =>
    Math.round((i * (chapterCount - 1)) / (quota - 1)) + 1);
  requireCondition(new Set(picks).size === picks.length, "even spacing produced a duplicate chapter");
  return picks;
}

export function positionStratum(chapterNumber: number, chapterCount: number): ReaderGoldDevPoolStratum {
  const position = chapterNumber / chapterCount;
  if (position <= 1 / 3) return "early";
  if (position <= 2 / 3) return "middle";
  return "late";
}

/** Largest-remainder proportional quotas (ties broken by lexicographic bookId). */
function proportionalQuotas(
  books: Array<{ bookId: string; chapterCount: number }>,
  target: number,
): Map<string, number> {
  const totalChapters = books.reduce((sum, book) => sum + book.chapterCount, 0);
  requireCondition(totalChapters >= target, "pool has fewer chapters than the target");
  const raw = books.map((book) => ({
    bookId: book.bookId,
    exact: (target * book.chapterCount) / totalChapters,
  }));
  const quotas = new Map(raw.map((entry) => [entry.bookId, Math.floor(entry.exact)]));
  let assigned = [...quotas.values()].reduce((sum, quota) => sum + quota, 0);
  const byRemainder = [...raw].sort((a, b) => {
    const remainderDelta = (b.exact - Math.floor(b.exact)) - (a.exact - Math.floor(a.exact));
    return remainderDelta !== 0 ? remainderDelta : a.bookId.localeCompare(b.bookId);
  });
  for (const entry of byRemainder) {
    if (assigned >= target) break;
    quotas.set(entry.bookId, (quotas.get(entry.bookId) ?? 0) + 1);
    assigned += 1;
  }
  return quotas;
}

const SELECTION_RULE_TEXT =
  "lexicographic books; target 24; full-take books with count <= floor(target/books); "
  + "largest-remainder proportional quotas for the rest; within a book, 1-based chapters "
  + "round(i*(N-1)/(k-1))+1 — arithmetic over chapter counts only, no prose input";

export function buildReaderGoldDevPoolSelection(args: {
  repositoryRoot: string;
}): ReaderGoldDevPoolSelectionManifestV1 {
  const repositoryRoot = resolve(args.repositoryRoot);
  const loaded = [...READER_GOLD_DEV_POOL_BOOKS].sort().map((bookId) => {
    const packagePath = `book-packages/${bookId}.v21.json`;
    const bytes = readFileSync(resolve(repositoryRoot, packagePath));
    const parsed = JSON.parse(bytes.toString("utf8")) as { chapters?: unknown[] };
    requireCondition(Array.isArray(parsed.chapters) && parsed.chapters.length > 0,
      `pool package has no chapters: ${packagePath}`);
    // Selection uses ONLY chapters.length from here on — prose stays uninspected.
    return { bookId, packagePath, packageBytesSha256: sha256Hex(bytes), chapterCount: parsed.chapters.length };
  });

  const fullTakeFloor = Math.floor(READER_GOLD_DEV_POOL_TARGET / loaded.length);
  const fullTake = loaded.filter((book) => book.chapterCount <= fullTakeFloor);
  const partial = loaded.filter((book) => book.chapterCount > fullTakeFloor);
  const fullTakeTotal = fullTake.reduce((sum, book) => sum + book.chapterCount, 0);
  const remainingTarget = READER_GOLD_DEV_POOL_TARGET - fullTakeTotal;
  requireCondition(remainingTarget >= partial.length,
    "remaining quota cannot cover at least one chapter per remaining book");
  const quotas = proportionalQuotas(partial, remainingTarget);

  const books: ReaderGoldDevPoolBookSelectionV1[] = loaded.map((book) => {
    const quota = fullTake.includes(book) ? book.chapterCount : (quotas.get(book.bookId) ?? 0);
    const selectedChapters = evenlySpacedChapters(book.chapterCount, quota).map((chapterNumber) => ({
      chapterNumber,
      positionStratum: positionStratum(chapterNumber, book.chapterCount),
    }));
    return { ...book, quota, selectedChapters };
  });
  const totalSelected = books.reduce((sum, book) => sum + book.selectedChapters.length, 0);
  requireCondition(totalSelected === READER_GOLD_DEV_POOL_TARGET,
    `selection produced ${totalSelected} chapters, expected ${READER_GOLD_DEV_POOL_TARGET}`);

  const core: Omit<ReaderGoldDevPoolSelectionManifestV1, "selectionSha256"> = {
    schema: READER_GOLD_DEV_POOL_SCHEMA,
    poolId: READER_GOLD_DEV_POOL_ID,
    ratification: {
      document: "docs/v25/reports/V25_PILOT_READINESS_OWNER_RATIFICATION.md",
      ownerApprovedForDevelopmentBakeoff: true,
      independentHumanRater: false,
      publicationCertification: false,
      candidateOutputsUsedForLabels: false,
      selectionFrozenBeforeProseInspection: true,
    },
    selectionRule: SELECTION_RULE_TEXT,
    targetTotal: READER_GOLD_DEV_POOL_TARGET,
    books,
    totalSelected,
    adjudication: {
      method: "dual-context-isolated-mixed-family-with-arbitration",
      aSideFamily: "gpt-5.6-sol (codex exec, ChatGPT-authenticated)",
      bSideFamily: "claude (session-isolated subagent, zero codex calls)",
      aSideCallBudget: { base: 24, hardMaximum: 48 },
      ownerSpotCheckControls: 3,
    },
  };
  return { ...core, selectionSha256: hashCanonical(core) };
}

export function validateReaderGoldDevPoolSelectionManifest(value: unknown): string[] {
  const issues: string[] = [];
  if (value === null || typeof value !== "object" || Array.isArray(value)) return ["manifest must be an object"];
  const manifest = value as ReaderGoldDevPoolSelectionManifestV1;
  if (manifest.schema !== READER_GOLD_DEV_POOL_SCHEMA) issues.push("schema mismatch");
  if (manifest.poolId !== READER_GOLD_DEV_POOL_ID) issues.push("pool identity mismatch");
  if (manifest.ratification?.selectionFrozenBeforeProseInspection !== true
    || manifest.ratification?.candidateOutputsUsedForLabels !== false
    || manifest.ratification?.independentHumanRater !== false
    || manifest.ratification?.publicationCertification !== false) {
    issues.push("ratification flags must record the development-grade, prose-blind provenance exactly");
  }
  if (manifest.totalSelected !== READER_GOLD_DEV_POOL_TARGET) issues.push("selection total mismatch");
  if (typeof manifest.selectionSha256 !== "string" || !/^[a-f0-9]{64}$/.test(manifest.selectionSha256)) {
    issues.push("selectionSha256 missing");
  } else {
    const { selectionSha256: _ignored, ...core } = manifest;
    if (hashCanonical(core) !== manifest.selectionSha256) issues.push("selection manifest self-hash mismatch");
  }
  return [...new Set(issues)];
}

export type ReaderGoldDevPoolMaterializationV1 = {
  schema: "reader-gold-dev-pool-materialization-v1";
  poolId: typeof READER_GOLD_DEV_POOL_ID;
  manifestPath: string;
  selectionSha256: string;
  totalSelected: number;
  written: boolean;
  modelCalls: 0;
  apiCalls: 0;
};

/** Create-once materializer: an existing manifest must be byte-identical to
 * the deterministic rebuild (idempotent re-run) — any divergence fails closed
 * because a re-selected pool after prose inspection would be worthless. */
export function materializeReaderGoldDevPoolSelection(args: {
  repositoryRoot: string;
  write?: boolean;
}): ReaderGoldDevPoolMaterializationV1 {
  const repositoryRoot = resolve(args.repositoryRoot);
  const manifestPath = resolve(repositoryRoot, READER_GOLD_DEV_POOL_MANIFEST_REL_PATH);
  const manifest = buildReaderGoldDevPoolSelection({ repositoryRoot });
  const issues = validateReaderGoldDevPoolSelectionManifest(manifest);
  requireCondition(issues.length === 0, `built selection manifest is invalid: ${issues.join("; ")}`);
  const bytes = canonicalPretty(manifest);
  if (existsSync(manifestPath)) {
    const retained = readFileSync(manifestPath, "utf8");
    requireCondition(retained === bytes,
      "retained selection manifest differs from the deterministic rebuild — the pool is frozen and may never be re-selected");
  } else if (args.write === true) {
    writeFileAtomic(manifestPath, bytes);
    requireCondition(readFileSync(manifestPath, "utf8") === bytes, "selection manifest read-back drift");
  }
  return {
    schema: "reader-gold-dev-pool-materialization-v1",
    poolId: READER_GOLD_DEV_POOL_ID,
    manifestPath,
    selectionSha256: manifest.selectionSha256,
    totalSelected: manifest.totalSelected,
    written: args.write === true || existsSync(manifestPath),
    modelCalls: 0,
    apiCalls: 0,
  };
}
