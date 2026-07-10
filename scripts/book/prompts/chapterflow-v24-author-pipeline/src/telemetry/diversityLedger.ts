/**
 * IMP-06 — the first-write diversity ledger (instruction 6/7/12).
 *
 * Records a passive feature snapshot at every CHAPTER COMMIT, keyed by attempt
 * kind + committed generation, so first-write diversity is measured on the
 * immutable first bytes — never inferred from accepted final chapters (repair
 * can make a book LOOK diverse while first writes were identical; the ledger
 * keeps both versions distinguishable for diagnosis).
 *
 * Recording is OPT-IN, exactly like the IMP-10 evidence store: an explicit root
 * or `CHAPTERFLOW_DIVERSITY_LEDGER_ROOT`. Without one, `recordChapterDiversity`
 * is a no-op returning null — the 2,000+-test suite writes ZERO telemetry and
 * production/bakeoff activation is a one-line owner env. The recorder is
 * best-effort by contract: it must never fail a commit (a telemetry write
 * failure logs through the caller, not through an exception).
 *
 * Every record stamps the diversity-config hash and the feature-schema version
 * (instruction 12) so any later analysis names the exact measurement regime.
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import type { ChapterV21 } from "../types.js";
import type { SourceUsePlanV1 } from "../contracts/sourceUsePlan.js";
import type { AttemptKindV1 } from "../contracts/candidateTransaction.js";
import { normSlug } from "../lib/chapterPaths.js";
import {
  DIVERSITY_FEATURE_SCHEMA_VERSION,
  extractDiversityFeatures,
  type DiversityFeaturesV1,
} from "./diversityFeatures.js";
import { DEFAULT_DIVERSITY_CONFIG, diversityConfigHash, type DiversityConfigV1 } from "./diversityConfig.js";
import { taxonomyLeaksInProse } from "./internalTaxonomy.js";

export const DIVERSITY_LEDGER_SCHEMA_VERSION = "diversity-ledger-v1" as const;

export type DiversityLedgerRecordV1 = {
  schema: typeof DIVERSITY_LEDGER_SCHEMA_VERSION;
  bookId: string;
  chapterNumber: number;
  attemptKind: AttemptKindV1;
  committedGeneration: number;
  /** True only for the immutable FIRST write of a chapter (author-initial,
   *  generation 1). All later commits are diagnosis versions. */
  firstWrite: boolean;
  recordedAtIso: string;
  configHash: string;
  featureSchema: typeof DIVERSITY_FEATURE_SCHEMA_VERSION;
  features: DiversityFeaturesV1;
  /** Internal labels found verbatim in reader prose (instruction 11) — shadow. */
  taxonomyLeaks: string[];
};

/** OPT-IN root resolution (IMP-10 pattern): explicit wins, then the env, else
 *  null → recording disabled. */
export function resolveDiversityLedgerRoot(explicit?: string | null): string | null {
  if (explicit && explicit.trim().length > 0) return explicit;
  const env = process.env.CHAPTERFLOW_DIVERSITY_LEDGER_ROOT;
  return env && env.trim().length > 0 ? env : null;
}

export function diversityLedgerPath(root: string, bookId: string): string {
  return resolve(root, `${normSlug(bookId)}.diversity.jsonl`);
}

/** Append one record (jsonl). Throws on IO failure — callers that must not fail
 *  go through `recordChapterDiversity`, which contains the throw. */
export function appendDiversityLedger(root: string, record: DiversityLedgerRecordV1): void {
  const path = diversityLedgerPath(root, record.bookId);
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, JSON.stringify(record) + "\n");
}

/** Extract + append a chapter's feature record at commit time. Null (and no
 *  write) when no root is configured; null on any extraction/write failure —
 *  NEVER throws into a commit path. */
export function recordChapterDiversity(opts: {
  root?: string | null;
  bookId: string;
  chapterNumber: number;
  chapter: ChapterV21;
  plan?: SourceUsePlanV1 | null;
  attemptKind: AttemptKindV1;
  committedGeneration: number;
  config?: DiversityConfigV1;
  nowIso?: string;
}): DiversityLedgerRecordV1 | null {
  try {
    const root = resolveDiversityLedgerRoot(opts.root ?? null);
    if (!root) return null;
    const config = opts.config ?? DEFAULT_DIVERSITY_CONFIG;
    const extracted = extractDiversityFeatures(opts.bookId, opts.chapter, opts.plan ?? null);
    const record: DiversityLedgerRecordV1 = {
      schema: DIVERSITY_LEDGER_SCHEMA_VERSION,
      bookId: opts.bookId,
      chapterNumber: opts.chapterNumber,
      attemptKind: opts.attemptKind,
      committedGeneration: opts.committedGeneration,
      firstWrite: opts.attemptKind === "author-initial" && opts.committedGeneration === 1,
      recordedAtIso: opts.nowIso ?? new Date().toISOString(),
      configHash: diversityConfigHash(config),
      featureSchema: DIVERSITY_FEATURE_SCHEMA_VERSION,
      features: extracted.features,
      taxonomyLeaks: taxonomyLeaksInProse(opts.chapter),
    };
    appendDiversityLedger(root, record);
    return record;
  } catch {
    return null; // telemetry must never fail a commit
  }
}

/** Read a book's ledger (tolerant: skips malformed lines rather than failing —
 *  a diagnosis tool must read a partially-corrupt ledger). */
export function readDiversityLedger(root: string, bookId: string): DiversityLedgerRecordV1[] {
  const path = diversityLedgerPath(root, bookId);
  if (!existsSync(path)) return [];
  const out: DiversityLedgerRecordV1[] = [];
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      const rec = JSON.parse(line) as DiversityLedgerRecordV1;
      if (rec?.schema === DIVERSITY_LEDGER_SCHEMA_VERSION) out.push(rec);
    } catch { /* skip malformed line */ }
  }
  return out;
}

/** The immutable first-write records, one per chapter (the FIRST such record
 *  wins — append order is commit order). The diversity denominator. */
export function firstWriteRecords(records: DiversityLedgerRecordV1[]): DiversityLedgerRecordV1[] {
  const seen = new Set<number>();
  const out: DiversityLedgerRecordV1[] = [];
  for (const r of records) {
    if (!r.firstWrite || seen.has(r.chapterNumber)) continue;
    seen.add(r.chapterNumber);
    out.push(r);
  }
  return out;
}

/** Shadow concentration report over a record set: per feature, the value counts
 *  and the max share. Report-only — the activation contract owns whether any
 *  threshold ever becomes advisory/blocking. */
export type FeatureConcentration = {
  feature: keyof DiversityFeaturesV1;
  counts: Record<string, number>;
  maxShare: number;
  dominantValue: string | null;
};

export function featureConcentration(records: DiversityLedgerRecordV1[]): FeatureConcentration[] {
  const out: FeatureConcentration[] = [];
  if (records.length === 0) return out;
  const keys = Object.keys(records[0].features) as Array<keyof DiversityFeaturesV1>;
  for (const feature of keys) {
    const counts: Record<string, number> = {};
    for (const r of records) {
      const v = r.features[feature];
      counts[v] = (counts[v] ?? 0) + 1;
    }
    let dominantValue: string | null = null;
    let max = 0;
    for (const [v, c] of Object.entries(counts)) {
      if (c > max) { max = c; dominantValue = v; }
    }
    out.push({ feature, counts, maxShare: max / records.length, dominantValue });
  }
  return out;
}
