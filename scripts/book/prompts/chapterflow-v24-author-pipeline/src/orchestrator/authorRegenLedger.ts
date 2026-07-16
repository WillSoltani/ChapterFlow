/**
 * authorRegenLedger — E2 regen-cap persistence, v2: LINEAGE-KEYED.
 *
 * AUTHOR_REGEN_CAP is a GLOBAL cap on write attempts per chapter across the
 * review round + the book-rejection round, durable across conductor re-entries.
 *
 * v1 keyed `consumed` by bare chapterNumber — which meant a chapter number
 * stayed capped FOREVER, across complete redesigns: a fresh campaign (new
 * research, new briefs, all-new bytes) inherited the consumed counts of the
 * failed campaign before it and halted on its first review miss. That
 * contradicts the cap's own definition ("write attempts BEYOND the original
 * authoring" — a re-designed chapter IS a new original authoring).
 *
 * v2 keys each consumed count by `<chapterNumber>@<lineage>` where lineage is a
 * PER-CHAPTER fingerprint of the design the writes were consumed against:
 *   sha256(source-packet content identity + this chapter's dealt brief rotation
 *          fields + the rotation schema version), first 12 hex chars.
 * Same design → counts accumulate exactly as v1 (no weakening). New research or
 * a re-dealt brief → new lineage → a fresh budget, honestly. Book-level derived
 * lists (frameworkNouns) are EXCLUDED from the hash — one packet touch must not
 * re-key nine chapters' budgets (adversarial round-2 #10).
 *
 * MIGRATION (#7/#9): v1 files are dual-read. At `migrateLegacyRegenCounts`
 * (called by the conductor at ENTRY START, before any compile step can rewrite
 * briefs), each legacy count is stamped onto the lineage computed from the
 * design ON DISK AT THAT MOMENT — the design those writes were consumed
 * against. The raw v1 map is preserved verbatim under `legacyConsumed` for
 * audit and never counted again once `legacyMigratedAt` is set. If a legacy
 * count exists but its lineage cannot be computed (unreadable brief/packet),
 * migration THROWS RegenLedgerError — an infra halt, never a fail-open cap and
 * never a faked content cap-exhaustion (#8).
 *
 * FAIL-CLOSED strengthening (#11): a ledger file that EXISTS but cannot be
 * parsed now throws (infra) instead of silently starting empty. A missing file
 * is still a fresh empty ledger. Unmigrated legacy counts are conservatively
 * ADDED to any lineage's count (fail toward capping) so a code path that
 * forgot to migrate can never fail open.
 *
 * ROLLBACK HAZARD (documented, accepted): v1 code reading a v2 file sees a
 * schemaVersion mismatch and treats it as empty — do not run pre-v2 conductors
 * against a migrated state tree.
 */

import { createHash } from "crypto";
import { existsSync, readFileSync } from "fs";
import { dirname, resolve } from "path";

import { CANONICAL_STATE } from "../lib/chapterPaths.js";
import { writeFileAtomic } from "../lib/atomicWrite.js";
import { mkdirSync } from "fs";
import { chapterBriefPath, sourcePacketPath } from "../artifacts/artifactStore.js";
import type { ChapterBriefV1, SourcePacketV1 } from "../artifacts/artifactTypes.js";

/** Typed infra failure: the cap cannot be honored honestly (unreadable ledger
 *  file, or a lineage that cannot be computed while legacy counts exist). */
export class RegenLedgerError extends Error {}

export type AuthorRegenLedger = {
  schemaVersion: "author-regen-ledger-v2";
  bookId: string;
  updatedAt: string;
  /** `<chapterNumber>@<lineage12>` → regenerations consumed against that design. */
  consumed: Record<string, number>;
  /** Raw v1 counts (bare chapterNumber keys), preserved verbatim for audit. */
  legacyConsumed?: Record<string, number>;
  /** Set when legacyConsumed has been stamped onto lineage keys; never re-counted after. */
  legacyMigratedAt?: string;
  /** chapterNumber → the lineage its legacy count was migrated onto (forensics). */
  legacyMigratedTo?: Record<string, string>;
  /** Repair lane (plan docs/v24/REPAIR-LANE-PLAN-2026-07-04.md R6; cap raised
   *  1→2 by WP-404 per the target architecture's "typed repair ≤2/chapter"):
   *  `<chapterNumber>@<lineage12>` → surgical repairs consumed against that
   *  design (cap AUTHOR_REPAIR_ROUND_CAP, see authorReview.ts; rejected/
   *  failed/no-op repairs count too). Optional so v2 ledgers written before
   *  the lane load unchanged (absent = 0). */
  repairConsumed?: Record<string, number>;
  /** F4: reader-budget repair writes consumed, keyed `${chapter}@${lineage}` —
   *  additive to v2 (absent = 0 everywhere). */
  budgetRepairConsumed?: Record<string, number>;
  /** Book-sameness repair lane (2026-07-06): a SEPARATE, bounded lane for the
   *  book-level architecture-diversification re-author. Keyed `${chapter}@${lineage}`,
   *  cap 1 per lineage. Deliberately independent of the regen `consumed` lane so a
   *  diversification grant NEVER erases or resets prior regen evidence and can never
   *  hand a chapter unlimited attempts. Absent = 0 everywhere (additive). */
  samenessRepairConsumed?: Record<string, number>;
  /** Content-deal repair lane (2026-07-07): a SEPARATE, bounded lane for the
   *  book-level CONTENT-machinery de-saturation re-author — distinct from the
   *  architecture `samenessRepairConsumed` lane so a chapter that already spent its
   *  architecture-diversification grant can still receive ONE content-deal repair
   *  (and vice-versa) without a manual reset. Keyed `${chapter}@${lineage}`, cap 1
   *  per lineage. Never touches regen evidence. Absent = 0 everywhere (additive). */
  contentRepairConsumed?: Record<string, number>;
};

type AuthorRegenLedgerV1 = {
  schemaVersion: "author-regen-ledger-v1";
  bookId: string;
  updatedAt: string;
  consumed: Record<string, number>;
};

export function authorRegenLedgerPath(bookId: string, stateRoot: string = CANONICAL_STATE): string {
  return resolve(stateRoot, "books", `${bookId}.author-regen-ledger.json`);
}

/**
 * The per-chapter design fingerprint. Inputs: the chapter's source packet
 * (sourceHash when present, else its facts' ids+claims — new research changes
 * either) and the brief's DEALT rotation fields (a re-deal or a rotation schema
 * bump changes them). Returns null when the brief or packet is unreadable —
 * callers must treat null as an INFRA condition, never as "no cap".
 */
export function computeRegenLineage(
  bookId: string,
  chapterNumber: number,
  stateRoot: string = CANONICAL_STATE,
): string | null {
  try {
    const roots = { stateRoot };
    const briefP = chapterBriefPath(bookId, chapterNumber, roots);
    const packetP = sourcePacketPath(bookId, chapterNumber, roots);
    if (!existsSync(briefP) || !existsSync(packetP)) return null;
    const brief = JSON.parse(readFileSync(briefP, "utf8")) as ChapterBriefV1;
    const packet = JSON.parse(readFileSync(packetP, "utf8")) as SourcePacketV1 & { sourceHash?: string };
    const packetIdentity = typeof packet.sourceHash === "string" && packet.sourceHash.length > 0
      ? packet.sourceHash
      : (packet.facts ?? []).map((f) => `${f.id}:${f.claim ?? ""}`).join("|");
    // Grill round-2b #9: the lineage keys on the BRIEF'S OWN stamped rotation version,
    // never the binary's constant. Every lineage ever computed before the stamp existed
    // used schema "brief-rotation-v2" and the SIX v2 dealt keys — so an UNSTAMPED brief
    // must reproduce that hash byte-for-byte under any newer binary (same schema string,
    // same key set; adding v3 keys as nulls would silently re-key and RESET caps).
    const v2Dealt = {
      openerType: brief.openerType ?? null,
      challengeFrame: brief.challengeFrame ?? null,
      practiceShape: brief.practiceShape ?? null,
      exampleLenses: brief.exampleLenses ?? null,
      practiceVerb: brief.practiceVerb ?? null,
      requireFrictionExample: brief.requireFrictionExample ?? null,
    };
    const stamped = typeof brief.rotationSchemaVersion === "string" && brief.rotationSchemaVersion.length > 0;
    const schema = stamped ? brief.rotationSchemaVersion! : "brief-rotation-v2";
    const dealt = stamped
      ? {
          ...v2Dealt,
          exampleCount: brief.exampleCount ?? null,
          exampleArcs: brief.exampleArcs ?? null,
          practiceSlotShapes: brief.practiceSlotShapes ?? null,
          quizStemShapes: brief.quizStemShapes ?? null,
          quizFailureModes: brief.quizFailureModes ?? null,
          questionFactOrder: brief.questionFactOrder ?? null,
          memorableShapes: brief.memorableShapes ?? null,
          limitsPlacement: brief.limitsPlacement ?? null,
          groundingForm: brief.groundingForm ?? null,
          leadThread: brief.leadThread ?? null,
        }
      : v2Dealt;
    return createHash("sha256")
      .update(JSON.stringify({ schema, packetIdentity, dealt }))
      .digest("hex")
      .slice(0, 12);
  } catch {
    return null;
  }
}

export function loadAuthorRegenLedger(bookId: string, stateRoot: string = CANONICAL_STATE): AuthorRegenLedger {
  const p = authorRegenLedgerPath(bookId, stateRoot);
  if (!existsSync(p)) {
    return { schemaVersion: "author-regen-ledger-v2", bookId, updatedAt: new Date().toISOString(), consumed: {} };
  }
  let rec: unknown;
  try {
    rec = JSON.parse(readFileSync(p, "utf8"));
  } catch (err) {
    // #11 strengthen: a PRESENT ledger that cannot be parsed is an infra halt —
    // it cannot be trusted to have counted, and starting empty would fail the
    // cap OPEN across a re-entry.
    throw new RegenLedgerError(`regen ledger exists but is unreadable (${(err as Error).message}): ${p}`);
  }
  const v2 = rec as AuthorRegenLedger;
  if (v2 && v2.schemaVersion === "author-regen-ledger-v2" && v2.consumed && typeof v2.consumed === "object") {
    return v2;
  }
  const v1 = rec as AuthorRegenLedgerV1;
  if (v1 && v1.schemaVersion === "author-regen-ledger-v1" && v1.consumed && typeof v1.consumed === "object") {
    // Dual-read (#9): expose the v1 counts as UNMIGRATED legacy on a v2 view.
    // The raw map is preserved; migrateLegacyRegenCounts stamps it onto
    // lineage keys exactly once.
    return {
      schemaVersion: "author-regen-ledger-v2",
      bookId: v1.bookId || bookId,
      updatedAt: v1.updatedAt || new Date().toISOString(),
      consumed: {},
      legacyConsumed: { ...v1.consumed },
    };
  }
  throw new RegenLedgerError(`regen ledger exists but has an unknown schema: ${p}`);
}

function persist(ledger: AuthorRegenLedger, stateRoot: string): void {
  const p = authorRegenLedgerPath(ledger.bookId, stateRoot);
  mkdirSync(dirname(p), { recursive: true });
  writeFileAtomic(p, JSON.stringify(ledger, null, 2) + "\n");
}

/**
 * Stamp v1 legacy counts onto the lineage of the design ON DISK RIGHT NOW.
 * Call at conductor ENTRY START — before any compile step can rewrite briefs —
 * so the counts bind to the design they were actually consumed against
 * (adversarial round-2 #7: structural, not operator-ordering-dependent).
 * Idempotent. Throws RegenLedgerError when a legacy count's lineage cannot be
 * computed (#8: infra, never a faked content cap).
 */
export function migrateLegacyRegenCounts(
  bookId: string,
  stateRoot: string = CANONICAL_STATE,
  log?: (m: string) => void,
): AuthorRegenLedger {
  const ledger = loadAuthorRegenLedger(bookId, stateRoot);
  const legacy = ledger.legacyConsumed ?? {};
  const pending = Object.keys(legacy).filter((k) => Number.isInteger(Number(k)));
  if (ledger.legacyMigratedAt || pending.length === 0) return ledger;
  ledger.legacyMigratedTo = ledger.legacyMigratedTo ?? {};
  for (const key of pending) {
    const n = Number(key);
    const count = legacy[key];
    if (!Number.isInteger(count) || count <= 0) continue;
    const lineage = computeRegenLineage(bookId, n, stateRoot);
    if (!lineage) {
      throw new RegenLedgerError(
        `regen ledger migration: ch${String(n).padStart(2, "0")} carries ${count} legacy consumed regen(s) but its lineage is uncomputable (brief or source packet unreadable under ${stateRoot}) — cannot honor the cap honestly; repair the artifacts before re-entering`,
      );
    }
    const lineageKey = `${n}@${lineage}`;
    ledger.consumed[lineageKey] = (ledger.consumed[lineageKey] ?? 0) + count;
    ledger.legacyMigratedTo[key] = lineage;
  }
  ledger.legacyMigratedAt = new Date().toISOString();
  ledger.updatedAt = new Date().toISOString();
  persist(ledger, stateRoot);
  log?.(`[autopilot] regen ledger: migrated ${pending.length} legacy chapter count(s) onto their on-disk design lineages (${Object.entries(ledger.legacyMigratedTo).map(([k, v]) => `ch${k}→${v}`).join(", ")})`);
  return ledger;
}

/** Regens ALREADY consumed by this chapter AGAINST THIS LINEAGE (plus any
 *  still-unmigrated legacy count — conservative: fail toward capping). */
export function regenConsumedFor(ledger: AuthorRegenLedger, chapterNumber: number, lineage: string): number {
  const keyed = ledger.consumed[`${chapterNumber}@${lineage}`];
  const base = Number.isInteger(keyed) && keyed > 0 ? keyed : 0;
  if (!ledger.legacyMigratedAt) {
    const legacy = ledger.legacyConsumed?.[String(chapterNumber)];
    return base + (Number.isInteger(legacy) && (legacy as number) > 0 ? (legacy as number) : 0);
  }
  return base;
}

/** Record ONE additional consumed regeneration for a chapter's current lineage
 *  and persist. Counts only ever grow. Returns the persisted ledger. */
export function recordRegenConsumed(
  bookId: string,
  chapterNumber: number,
  lineage: string,
  stateRoot: string = CANONICAL_STATE,
): AuthorRegenLedger {
  const ledger = loadAuthorRegenLedger(bookId, stateRoot);
  const key = `${chapterNumber}@${lineage}`;
  ledger.consumed[key] = (Number.isInteger(ledger.consumed[key]) && ledger.consumed[key] > 0 ? ledger.consumed[key] : 0) + 1;
  ledger.updatedAt = new Date().toISOString();
  persist(ledger, stateRoot);
  return ledger;
}

/** Repair lane (R6): repairs consumed against the chapter's current lineage.
 *  No legacy dimension — the lane postdates the v2 ledger; absent map = 0. */
export function repairConsumedFor(ledger: AuthorRegenLedger, chapterNumber: number, lineage: string): number {
  const keyed = ledger.repairConsumed?.[`${chapterNumber}@${lineage}`];
  return Number.isInteger(keyed) && (keyed as number) > 0 ? (keyed as number) : 0;
}

/** Record ONE consumed surgical repair for a chapter's current lineage and
 *  persist. Counts only ever grow; rejected/failed/no-op repairs count too. */
export function recordRepairConsumed(
  bookId: string,
  chapterNumber: number,
  lineage: string,
  stateRoot: string = CANONICAL_STATE,
): AuthorRegenLedger {
  const ledger = loadAuthorRegenLedger(bookId, stateRoot);
  const key = `${chapterNumber}@${lineage}`;
  const map = ledger.repairConsumed ?? (ledger.repairConsumed = {});
  map[key] = (Number.isInteger(map[key]) && map[key] > 0 ? map[key] : 0) + 1;
  ledger.updatedAt = new Date().toISOString();
  persist(ledger, stateRoot);
  return ledger;
}

/** F4 (FINAL-HARDENING-PLAN 2026-07-04): reader-budget repair writes consumed
 *  against the chapter's current lineage. ensureReaderBudgetsClean spawns FULL
 *  whole-chapter rewrites outside the regen ledger, and it runs at BOTH the
 *  write and review entries — without a durable count, every conductor re-entry
 *  of a still-blocking book could re-spend up to 4 chapters × 2 writer spawns,
 *  forever. Absent map = 0 (the counter postdates the v2 ledger). */
export function budgetRepairConsumedFor(ledger: AuthorRegenLedger, chapterNumber: number, lineage: string): number {
  const keyed = ledger.budgetRepairConsumed?.[`${chapterNumber}@${lineage}`];
  return Number.isInteger(keyed) && (keyed as number) > 0 ? (keyed as number) : 0;
}

/** Record ONE consumed budget-repair write for a chapter's current lineage and
 *  persist. Counts only ever grow; failed repair writes count too. */
export function recordBudgetRepairConsumed(
  bookId: string,
  chapterNumber: number,
  lineage: string,
  stateRoot: string = CANONICAL_STATE,
): AuthorRegenLedger {
  const ledger = loadAuthorRegenLedger(bookId, stateRoot);
  const key = `${chapterNumber}@${lineage}`;
  const map = ledger.budgetRepairConsumed ?? (ledger.budgetRepairConsumed = {});
  map[key] = (Number.isInteger(map[key]) && map[key] > 0 ? map[key] : 0) + 1;
  ledger.updatedAt = new Date().toISOString();
  persist(ledger, stateRoot);
  return ledger;
}

/** Book-sameness repair lane (2026-07-06): how many diversification re-authors a
 *  chapter has consumed against its current lineage (cap 1). Absent = 0. Separate
 *  from every other lane, so a diversification grant is bounded and never touches
 *  the regen `consumed` evidence. */
export function samenessRepairConsumedFor(ledger: AuthorRegenLedger, chapterNumber: number, lineage: string): number {
  const keyed = ledger.samenessRepairConsumed?.[`${chapterNumber}@${lineage}`];
  return Number.isInteger(keyed) && (keyed as number) > 0 ? (keyed as number) : 0;
}

/** CONTROLLED reset of a chapter's book-sameness-repair grant for its lineage —
 *  the ONLY lane that can be reset, and ONLY for the sameness repair (a deliberate
 *  operator retry of a specific chapter). Bounded: it grants at most one fresh
 *  attempt (the next record re-consumes it). Never touches the regen/repair/budget
 *  evidence. Returns the persisted ledger. */
export function resetSamenessRepairConsumed(
  bookId: string,
  chapterNumber: number,
  lineage: string,
  stateRoot: string = CANONICAL_STATE,
): AuthorRegenLedger {
  const ledger = loadAuthorRegenLedger(bookId, stateRoot);
  if (ledger.samenessRepairConsumed) delete ledger.samenessRepairConsumed[`${chapterNumber}@${lineage}`];
  ledger.updatedAt = new Date().toISOString();
  persist(ledger, stateRoot);
  return ledger;
}

/** Record ONE consumed book-sameness-repair write for a chapter's lineage and
 *  persist, tagged with the repair reason for audit. Counts only ever grow (a
 *  failed diversification still counts — no unlimited retries). Never mutates the
 *  regen/repair/budgetRepair lanes. */
export function recordSamenessRepairConsumed(
  bookId: string,
  chapterNumber: number,
  lineage: string,
  stateRoot: string = CANONICAL_STATE,
): AuthorRegenLedger {
  const ledger = loadAuthorRegenLedger(bookId, stateRoot);
  const key = `${chapterNumber}@${lineage}`;
  const map = ledger.samenessRepairConsumed ?? (ledger.samenessRepairConsumed = {});
  map[key] = (Number.isInteger(map[key]) && map[key] > 0 ? map[key] : 0) + 1;
  ledger.updatedAt = new Date().toISOString();
  persist(ledger, stateRoot);
  return ledger;
}

// ── Content-deal repair lane (2026-07-07) — mirrors the sameness lane, separate map ──

/** How many content-deal de-saturation re-authors a chapter has consumed against its
 *  current lineage (cap 1). Absent = 0. Independent of the architecture sameness lane. */
export function contentRepairConsumedFor(ledger: AuthorRegenLedger, chapterNumber: number, lineage: string): number {
  const keyed = ledger.contentRepairConsumed?.[`${chapterNumber}@${lineage}`];
  return Number.isInteger(keyed) && (keyed as number) > 0 ? (keyed as number) : 0;
}

/** CONTROLLED reset of a chapter's content-deal-repair grant for its lineage — a
 *  deliberate operator retry (`--only`). Grants at most one fresh attempt. Never
 *  touches regen/repair/budget/sameness evidence. Returns the persisted ledger. */
export function resetContentRepairConsumed(
  bookId: string,
  chapterNumber: number,
  lineage: string,
  stateRoot: string = CANONICAL_STATE,
): AuthorRegenLedger {
  const ledger = loadAuthorRegenLedger(bookId, stateRoot);
  if (ledger.contentRepairConsumed) delete ledger.contentRepairConsumed[`${chapterNumber}@${lineage}`];
  ledger.updatedAt = new Date().toISOString();
  persist(ledger, stateRoot);
  return ledger;
}

/** Record ONE consumed content-deal-repair write for a chapter's lineage and persist.
 *  Counts only grow (a failed repair still counts — no unlimited retries). Never
 *  mutates the regen/repair/budgetRepair/sameness lanes. */
export function recordContentRepairConsumed(
  bookId: string,
  chapterNumber: number,
  lineage: string,
  stateRoot: string = CANONICAL_STATE,
): AuthorRegenLedger {
  const ledger = loadAuthorRegenLedger(bookId, stateRoot);
  const key = `${chapterNumber}@${lineage}`;
  const map = ledger.contentRepairConsumed ?? (ledger.contentRepairConsumed = {});
  map[key] = (Number.isInteger(map[key]) && map[key] > 0 ? map[key] : 0) + 1;
  ledger.updatedAt = new Date().toISOString();
  persist(ledger, stateRoot);
  return ledger;
}
