/**
 * Library promotion — the final gate.
 *
 * After every chapter of a book has been generated and ship-gated individually,
 * this function bundles the chapters into a single BookPackageV21, re-validates
 * the entire bundle against both gates (defense in depth), and only then
 * writes it to the production library at `book-packages/<bookId>.v21.json`.
 *
 * If any blocker fails:
 *   - Bundle is NOT written to book-packages/.
 *   - A failure report is written to state/books/_blocked/<bookId>.<epoch>.report.json,
 *     and this book's blocked history is bounded to the newest 5 (older reports are
 *     MOVED — never deleted — into _blocked/_archive-<date>/; see blockedReportRetention).
 *   - The book remains in pre-production state until issues are fixed.
 *
 * If all gates pass:
 *   - Bundle is written to book-packages/<bookId>.v21.json.
 *   - A book-gate report sidecar is written to state/books/<bookId>.gate.json.
 *   - The promotion is logged.
 *
 * v21 packages coexist with legacy v13 `.modern.json` files in book-packages/.
 * Downstream consumers branch on `schemaVersion` to know which shape to read.
 *
 * Concurrency: the autopilot serializes per-book work behind its own run lock, so
 * two concurrent promotions of the same book do not occur. Promotion is still
 * crash-safe — staging happens in a per-transaction directory and goes live via a
 * single atomic rename, and a leftover staging directory from a CRASHED (provably
 * dead) prior owner is reaped scoped-by-owner-stamp (never a broad unconditional
 * delete that could wipe a live promotion's staging).
 */

import { randomBytes } from "crypto";
import { readFileSync, mkdirSync, existsSync, renameSync, rmSync, readdirSync, statSync } from "fs";
import { hostname as osHostname } from "os";
import { writeFileAtomic } from "./lib/atomicWrite.js";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { BookPackageV21, ChapterV21, V21_SCHEMA_VERSION } from "./types.js";
import { GateReport, formatGateReport } from "./critics/finalGate.js";
import { BookGateReport, formatBookGateReport } from "./critics/bookGate.js";
import {
  chapterFloorGate,
  bookFloorGate,
  chapterFloorIntra,
  createFloorLedger,
} from "./critics/deterministicFloor.js";
import { checkQcAttestation } from "./critics/qcAttestation.js";
import { checkKeyJudge } from "./critics/quizKeyGate.js";
import { resolveBookKeyEvidence } from "./critics/quizKeyEvidence.js";
import { isNoApiCodexQcMode } from "./qc/noApiMode.js";
import { checkSourceV2Gate } from "./qc/sourceV2Gate.js";
import {
  evaluateSourceRealityPolicy,
  type SourceRealityDecision,
} from "./qc/sourceRealityPolicy.js";
import { checkPlanEnforcement } from "./qc/planEnforcement.js";
import { checkManualKeyJudge } from "./qc/manualKeyJudge.js";
import { checkSweep } from "./qc/sweep.js";
import { evaluateMajorCleanliness } from "./qc/majorDisposition.js";
import { ChapterSpec } from "./generateChapter.js";
import { normSlug } from "./lib/chapterPaths.js";
import { pruneBlockedReports } from "./publish/blockedReportRetention.js";
import { stripInternalFields } from "./lib/readerContent.js";
import { buildProductionManifest, type ProductionManifestFinding, type ProductionPackageManifest } from "./productionManifest.js";
import { verifyProductionPackage } from "./verifyProductionPackage.js";
import { evaluateGenerationDebt } from "./generationDegradation.js";
import {
  compareChapterSetToCanonical,
  formatChapterSetBlockers,
  loadCanonicalChapterFiles,
  readCanonicalChapterIndex,
  type ChapterSetBlocker,
} from "./lib/chapterSet.js";
import {
  CHAPTERFLOW_REQUIRE_D7_SHIP_GATE_ENV,
  d7ShipGateHaltPath,
  runD7ShipGate,
  type D7ShipGateDecision,
  type D7ShipGateResult,
} from "./critics/d7ShipGate.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE = resolve(__dirname, "../state");
const REPO_ROOT = resolve(__dirname, "..");
/** The git repo root (REPO_ROOT is the extractable-package root, i.e. the pipeline
 *  dir). The retained rubric-audit dir the D7 gate re-verifies custody against is
 *  addressed relative to the git root. */
const REPOSITORY_ROOT = resolve(REPO_ROOT, "../../../..");
const BOOK_PACKAGES_DIR = resolve(REPO_ROOT, "book-packages");
const QUARANTINE_DIR = resolve(STATE, "books", "_blocked");
const PROMOTION_TX_DIR = resolve(STATE, "books", "_transactions");

/** The production manifest now ships as a STATE-SIDE SIDECAR (WS1 / K1): the
 *  distribution package carries reader content only, and the manifest (hashes,
 *  attestation evidence, internal run paths, code inventory) lives next to the
 *  gate report. Gitignored like the other state/books/*.json artifacts. */
export const PRODUCTION_MANIFEST_SIDECAR_SCHEMA = "chapterflow-production-manifest-sidecar-v1" as const;

export function productionManifestSidecarPath(bookId: string): string {
  return resolve(STATE, "books", `${normSlug(bookId)}.production-manifest.json`);
}

/** State-side manifest sidecar. `packageId`/`createdAt` mirror the shipped
 *  package's identity fields so the verifier can bind the two without re-deriving
 *  them, and `manifest` is the full production manifest that used to be embedded
 *  in the package. */
export type ProductionManifestSidecar = {
  schemaVersion: typeof PRODUCTION_MANIFEST_SIDECAR_SCHEMA;
  bookId: string;
  packageId: string;
  createdAt: string;
  manifest: ProductionPackageManifest;
};

/** Best-effort read of a prior manifest sidecar for identity carry-over. A
 *  missing/unreadable sidecar => treat as a fresh promote (stamp new identity). */
function readSidecarIfPresent(path: string): Partial<ProductionManifestSidecar> | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as Partial<ProductionManifestSidecar>;
  } catch {
    return null;
  }
}

/**
 * K1 identity decision (pure). Given the recomputed manifest contentId and the
 * prior sidecar's identity, decide the shipped package's {packageId, createdAt}:
 *   - content UNCHANGED vs the prior sidecar's contentId ⇒ PRESERVE the prior
 *     packageId + createdAt (a byte-stable no-op re-promote never moves the date).
 *   - content CHANGED, or no prior sidecar ⇒ STAMP a fresh createdAt = now and a
 *     human-readable packageId `<bookId>-v21-<epochMs>` (epochMs from the same
 *     instant as createdAt; a sha256 is a hash the owner asked to remove).
 * Exported so the semantics are unit-testable without a full gate-clean promote.
 */
export function decidePackageIdentity(args: {
  bookId: string;
  recomputedContentId: string;
  priorContentId: string | null;
  priorPackageId: string | null;
  priorCreatedAt: string | null;
  now: Date;
}): { packageId: string; createdAt: string; freshStamp: boolean } {
  const contentUnchanged = args.priorContentId !== null && args.priorContentId === args.recomputedContentId;
  if (contentUnchanged && args.priorCreatedAt && args.priorPackageId) {
    return { packageId: args.priorPackageId, createdAt: args.priorCreatedAt, freshStamp: false };
  }
  const createdAt = args.now.toISOString();
  return { packageId: `${normSlug(args.bookId)}-v21-${Date.parse(createdAt)}`, createdAt, freshStamp: true };
}

export type PromotionFaultPoint =
  | "beforeStaging"
  | "afterStaging"
  | "afterVerification"
  | "beforeFinalRename"
  | "beforeRegistryUpdate";

export type OwnerLiveness = "alive" | "dead" | "unknown";
/** Minimal owner identity the transaction-dir reaper probes for liveness. */
export type TxOwnerIdentity = { hostname: string; pid: number };
export type TxOwnerLivenessProbe = (owner: TxOwnerIdentity) => OwnerLiveness;

/**
 * Same-host pid-liveness probe for the transaction-dir reaper. A leftover staging
 * directory is removed ONLY when its owner stamp proves the owner is provably DEAD
 * (same host, pid gone). A remote host or a missing/invalid pid is "unknown" and
 * fails closed (the directory is left as forensic evidence).
 */
export function txOwnerLiveness(owner: TxOwnerIdentity, host: string = osHostname()): OwnerLiveness {
  if (!owner.hostname || owner.hostname !== host) return "unknown";
  if (!Number.isInteger(owner.pid) || owner.pid <= 0) return "unknown";
  try {
    process.kill(owner.pid, 0);
    return "alive";
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === "ESRCH") return "dead";
    if (code === "EPERM") return "alive";
    return "unknown";
  }
}

export type PromotionOptions = {
  /** Test seam: throw at a named transition after journaling that transition. */
  faultAt?: PromotionFaultPoint;
  /** Stable transaction id for deterministic fault/recovery tests. */
  transactionId?: string;
  now?: () => Date;
  /** Test seam: override the recorded host for the transaction owner stamp + reaper host. */
  leaseHostname?: string;
  /** Test seam: override the owner-liveness probe for tx-dir reaping. */
  leaseLiveness?: TxOwnerLivenessProbe;
  /** Test seam: invoked once, after verification, immediately before the final
   *  atomic rename. */
  onBeforeFinalRename?: () => void;
  /** R5(a): read-root for state-backed lookups that promote resolves through
   *  defaults today (the quiz-key EVIDENCE resolver reads the review ledger).
   *  Promote does NOT currently inject a state root anywhere else (P11 left
   *  chapter loading on the canonical dir), so this is forward-looking plumbing:
   *  undefined preserves the exact default behavior, and if a promote-wide
   *  state-root injection is ever added it can flow through here so key evidence
   *  reads the SAME root as the rest of promote. */
  stateRoot?: string;
};

export type PromotionResult = {
  promoted: boolean;
  bookId: string;
  packagePath?: string;          // set if promoted
  reportPath: string;            // always set; contains the gate findings
  shipGateBlockerCount: number;
  bookGateBlockerCount: number;
  /** AS5–AS12 cross-chapter blockers. Until Phase 1 these ran ONLY in
   *  gate-chapter, so promote shipped books the authoring gate would block. */
  intraBookBlockerCount: number;
  /** Fresh wrong-key (or, in require mode, missing/stale) quiz answer-key judge
   *  results. The model-backed catch the deterministic gates structurally
   *  cannot do — enforced here from the sidecar `quiz-judge` writes. */
  keyJudgeBlockerCount: number;
  noApiBlockerCount: number;
  majorBlockerCount: number;
  sourceIntegrityBlockerCount: number;
  /** WS-4 source-REALITY policy: 0 unless the policy blocks (a present-but-bad record,
   *  or — only under CHAPTERFLOW_REQUIRE_SOURCE_VERIFY=1 — a missing record/exemption). */
  sourceRealityBlockerCount: number;
  /** The reported source-reality decision: required-and-verified | legacy-exempt | missing |
   *  invalid | stale | not-applicable. */
  sourceRealityDecision: SourceRealityDecision;
  generationDebtBlockerCount: number;
  generationDebtAdvisoryCount: number;
  productionManifestBlockerCount: number;
  /** WP-401 D7 rubric-audit SHIP GATE: 0 unless a new/changed book is missing a
   *  required receipt, or its receipt is FAIL/VOID/stale/tampered/corrupt. An
   *  exempt (byte-identical to the shipped corpus) or advisory (no receipt, gate
   *  not required) book counts 0. */
  d7ShipGateBlockerCount: number;
  /** The reported D7 ship-gate decision: exempt | pass | advisory-skip | block |
   *  not-evaluated (the book was blocked before the gate ran). */
  d7ShipGateDecision: D7ShipGateDecision | "not-evaluated";
  canonicalBlockerCount: number;
  canonicalBlockers?: ChapterSetBlocker[];
  shipGateMajorCount: number;
  bookGateMajorCount: number;
  /** R5(b): the F-10 quiz answer-key EVIDENCE, surfaced on the result so the
   *  operator-facing CLI can print the PER-CHAPTER lines — not just the summary
   *  folded into `reason`. Advisory only (mirrors the report sidecar; never
   *  affects `promoted`). Absent on pre-gate fail-closed returns that never
   *  resolved key evidence (e.g. a quarantine tombstone / unreadable chapter). */
  quizKeyEvidence?: {
    summary: string;
    counts: { judgeVerified: number; readerVerified: number; unverified: number };
    unverifiedChapters: number[];
    lines: string[];
  };
  reason: string;                // human-readable explanation
};

export type PromotionInput = {
  bookId: string;
  title: string;
  author: string;
  /** Chapter index. Used to verify every expected chapter has been generated. */
  chapters: ChapterSpec[];
  /** Optional contentOwner for the package. Defaults to "chapterflow". */
  contentOwner?: string;
  /** Optional book-level metadata. */
  categories?: string[];
  tags?: string[];
};

type PromotionTransactionState = "started" | "staged" | "verified" | "published" | "complete";

function safeTxId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, 80) || "tx";
}

function newTransactionId(options: PromotionOptions): string {
  return safeTxId(options.transactionId ?? `${Date.now()}-${randomBytes(4).toString("hex")}`);
}

function transactionDir(bookId: string, txId: string): string {
  return resolve(PROMOTION_TX_DIR, `${bookId}.${txId}`);
}

function writeJournal(args: {
  bookId: string;
  txId: string;
  state: PromotionTransactionState;
  stagedPackagePath: string;
  packagePath: string;
  contentId?: string | null;
  now: () => Date;
}): void {
  mkdirSync(transactionDir(args.bookId, args.txId), { recursive: true });
  writeFileAtomic(resolve(transactionDir(args.bookId, args.txId), "journal.json"), JSON.stringify({
    schemaVersion: "promotion-transaction-v1",
    bookId: args.bookId,
    txId: args.txId,
    state: args.state,
    stagedPackagePath: args.stagedPackagePath,
    packagePath: args.packagePath,
    contentId: args.contentId ?? null,
    updatedAt: args.now().toISOString(),
  }, null, 2) + "\n");
}

const PROMOTION_TX_OWNER_SCHEMA = "promotion-tx-owner-v1" as const;

/** Owner stamp written into every staging transaction directory, tying the
 *  directory to the process that created it. This is the proof a later recovery
 *  needs to decide a leftover directory belongs to a now-dead owner before it
 *  may remove it. */
type PromotionTxOwnerStamp = {
  schemaVersion: typeof PROMOTION_TX_OWNER_SCHEMA;
  bookId: string;
  transactionId: string;
  ownerId: string;
  ownerToken: string;
  pid: number;
  hostname: string;
  createdAt: string;
};

/** Full owner identity for a promotion staging transaction. */
type TxOwner = {
  bookId: string;
  transactionId: string;
  ownerId: string;
  ownerToken: string;
  pid: number;
  hostname: string;
};

function txOwnerStampPath(txDir: string): string {
  return resolve(txDir, "owner.json");
}

function writeTxOwnerStamp(txDir: string, owner: TxOwner, now: () => Date): void {
  const stamp: PromotionTxOwnerStamp = {
    schemaVersion: PROMOTION_TX_OWNER_SCHEMA,
    bookId: owner.bookId,
    transactionId: owner.transactionId,
    ownerId: owner.ownerId,
    ownerToken: owner.ownerToken,
    pid: owner.pid,
    hostname: owner.hostname,
    createdAt: now().toISOString(),
  };
  writeFileAtomic(txOwnerStampPath(txDir), JSON.stringify(stamp, null, 2) + "\n");
}

function readTxOwnerStamp(txDir: string): PromotionTxOwnerStamp | null {
  try {
    const raw = JSON.parse(readFileSync(txOwnerStampPath(txDir), "utf8")) as PromotionTxOwnerStamp;
    return raw?.schemaVersion === PROMOTION_TX_OWNER_SCHEMA ? raw : null;
  } catch {
    return null;
  }
}

type ReapOptions = {
  /** The current owner's transaction — never reaped even if its stamp is present. */
  excludeTransactionId?: string;
  hostname?: string;
  liveness?: TxOwnerLivenessProbe;
};

/**
 * Owner-proven, scoped cleanup of abandoned promotion transaction directories —
 * the safe replacement for the old broad `recoverPromotionTransactions` that
 * `rmSync`-removed EVERY `<bookId>.*` directory unconditionally (and so could
 * delete a live promotion's staging directory). A directory is removed ONLY when
 * its owner stamp proves the owner is DEAD (same host, pid gone). Directories
 * whose owner is alive, of unknown liveness, or that carry no readable owner
 * stamp are LEFT in place as forensic evidence — recovery never destroys a
 * directory it cannot prove is abandoned.
 *
 * @returns the transactionIds reaped (for logging).
 */
function reapAbandonedTransactionDirs(bookId: string, options: ReapOptions = {}): string[] {
  if (!existsSync(PROMOTION_TX_DIR)) return [];
  const host = options.hostname ?? osHostname();
  const probe = options.liveness ?? ((owner) => txOwnerLiveness(owner, host));
  const reaped: string[] = [];
  for (const name of readdirSync(PROMOTION_TX_DIR)) {
    if (!name.startsWith(`${bookId}.`)) continue;
    const dir = resolve(PROMOTION_TX_DIR, name);
    let isDir = false;
    try { isDir = statSync(dir).isDirectory(); } catch { continue; }
    if (!isDir) continue;
    const stamp = readTxOwnerStamp(dir);
    // No readable owner stamp => cannot prove abandonment => leave it.
    if (!stamp) continue;
    if (options.excludeTransactionId && stamp.transactionId === options.excludeTransactionId) continue;
    if (probe({ hostname: stamp.hostname, pid: stamp.pid }) !== "dead") continue;
    rmSync(dir, { recursive: true, force: true });
    reaped.push(stamp.transactionId);
  }
  return reaped;
}

function injectFault(options: PromotionOptions, point: PromotionFaultPoint): void {
  if (options.faultAt === point) throw new Error(`Injected promotion fault at ${point}`);
}

function publishPackageTransactionally(args: {
  bookId: string;
  packagePath: string;
  candidatePackage: BookPackageV21;
  /** The state-side manifest sidecar bytes to publish alongside the package. Both
   *  go live via a single pair of atomic renames — either both land or neither
   *  does. */
  sidecar: ProductionManifestSidecar;
  contentId: string | null;
  options: PromotionOptions;
  /** Owner identity stamped into the staging directory, so a crash leaves
   *  owner-attributed evidence the reaper can later prove dead. */
  owner: TxOwner;
  /** The transaction id this publish owns — the staging directory is
   *  `<bookId>.<txId>`. */
  txId: string;
}): void {
  const now = args.options.now ?? (() => new Date());
  const txId = args.txId;
  const txDir = transactionDir(args.bookId, txId);
  const stagedPackagePath = resolve(txDir, "package.v21.json");
  const stagedSidecarPath = resolve(txDir, "production-manifest.json");
  const sidecarPath = productionManifestSidecarPath(args.bookId);

  // Create + owner-stamp the transaction directory before the first journal, so
  // even a crash one instruction later leaves recoverable, owner-attributed
  // evidence.
  mkdirSync(txDir, { recursive: true });
  writeTxOwnerStamp(txDir, args.owner, now);

  writeJournal({ bookId: args.bookId, txId, state: "started", stagedPackagePath, packagePath: args.packagePath, contentId: args.contentId, now });
  injectFault(args.options, "beforeStaging");

  // Stage BOTH artifacts before verifying. The sidecar is staged first so the
  // verifier (which reads the manifest from the sidecar) can validate the staged
  // pair against the same on-disk state the final publish will expose.
  writeFileAtomic(stagedSidecarPath, JSON.stringify(args.sidecar, null, 2) + "\n");
  writeFileAtomic(stagedPackagePath, JSON.stringify(args.candidatePackage, null, 2));
  writeJournal({ bookId: args.bookId, txId, state: "staged", stagedPackagePath, packagePath: args.packagePath, contentId: args.contentId, now });
  injectFault(args.options, "afterStaging");

  // Verify the staged package against its staged sidecar (manifestPath override)
  // — the same fail-closed PPKG.* checks, now reading the manifest from the
  // sidecar instead of an embedded field.
  const verification = verifyProductionPackage({ packagePath: stagedPackagePath, manifestPath: stagedSidecarPath, compareLooseState: true });
  if (!verification.ok) {
    throw new Error(`Staged package verification failed: ${verification.findings.map((f) => f.message).join("; ")}`);
  }
  writeJournal({ bookId: args.bookId, txId, state: "verified", stagedPackagePath, packagePath: args.packagePath, contentId: args.contentId, now });
  injectFault(args.options, "afterVerification");
  injectFault(args.options, "beforeFinalRename");
  // promoteBook itself does not write web registries. This seam marks the final
  // pre-visibility point before any caller can safely run a registry update.
  injectFault(args.options, "beforeRegistryUpdate");

  // FINAL PUBLICATION — a pair of atomic renames. The sidecar is renamed FIRST so
  // that if the process dies between the two renames the package is never visible
  // without its manifest sidecar (a package-without-sidecar fails verification;
  // a sidecar-without-package is inert). The fault seams above are preserved, and
  // the staged pair is independently verified, so a pre-rename fault leaves the
  // prior package + sidecar byte-stable.
  args.options.onBeforeFinalRename?.();
  mkdirSync(dirname(sidecarPath), { recursive: true });
  renameSync(stagedSidecarPath, sidecarPath);
  mkdirSync(dirname(args.packagePath), { recursive: true });
  renameSync(stagedPackagePath, args.packagePath);
  writeJournal({ bookId: args.bookId, txId, state: "published", stagedPackagePath, packagePath: args.packagePath, contentId: args.contentId, now });
  writeJournal({ bookId: args.bookId, txId, state: "complete", stagedPackagePath, packagePath: args.packagePath, contentId: args.contentId, now });
  rmSync(txDir, { recursive: true, force: true });
}

/** Authoring-internal fields that must never reach the shipped package:
 *  sourceAnchorId (gate-time provenance) and planSpec (the planner's design
 *  rationale — types.ts: "Not shown to readers", but it shipped anyway until
 *  Phase 1 because only sourceAnchorId was stripped). Pure copy — the
 *  state/chapters files are never mutated, and the v2 content hash excludes
 *  both keys, so stripping cannot stale a QC attestation
 *  (tests/promote-gate.test.ts pins both properties). */
export { stripInternalFields } from "./lib/readerContent.js";

export function promoteBook(input: PromotionInput, options: PromotionOptions = {}): PromotionResult {
  const bookId = normSlug(input.bookId);
  const { title, author, chapters } = input;
  const now = options.now ?? (() => new Date());

  // Step 0: Quarantine tombstone. quarantine-book used to only MOVE the
  // shipped package aside — every piece of state that made the book
  // promotable survived, so the next promote/batch --run silently re-shipped
  // a book an operator had explicitly pulled (verified 2026-06-09). The
  // tombstone makes quarantine sticky until `unquarantine-book` releases it.
  const tombstonePath = resolve(STATE, "books", "_quarantined", `${bookId}.json`);
  if (existsSync(tombstonePath)) {
    let why = "";
    try {
      why = (JSON.parse(readFileSync(tombstonePath, "utf8")) as { reason?: string }).reason ?? "";
    } catch { /* unreadable tombstone still blocks */ }
    return blockedResult({
      bookId,
      reason:
        `QUARANTINED: ${bookId} was explicitly quarantined${why ? ` (${why})` : ""}. ` +
        `Promote refuses until \`unquarantine-book ${bookId}\` releases it (after the defect is fixed and re-QC'd).`,
    });
  }

  // Step 0.5: Canonical chapter-set proof. The production package must be
  // complete according to the promoter-loaded state/indexes/<bookId>.json, not
  // according to a caller-supplied range. This runs before report/quarantine/
  // package writes so a rejected subset leaves production state untouched.
  const canonical = readCanonicalChapterIndex(bookId);
  if (!canonical.ok) {
    return blockedResult({
      bookId,
      canonicalBlockers: canonical.blockers,
      reason: `CANONICAL_CHAPTER_SET_BLOCKED: ${formatChapterSetBlockers(canonical.blockers)}`,
    });
  }
  const inputSet = compareChapterSetToCanonical({
    bookId,
    canonical: canonical.chapters,
    actual: chapters,
    actualLabel: "promotion input",
  });
  if (!inputSet.ok) {
    return blockedResult({
      bookId,
      canonicalBlockers: inputSet.blockers,
      reason: `CANONICAL_CHAPTER_SET_BLOCKED: ${formatChapterSetBlockers(inputSet.blockers)}`,
    });
  }

  // Step 1: Load every canonical chapter from state/chapters/ through the single
  // safe loader. Read + JSON.parse happen inside CHSET (try/catch per file), so a
  // missing file, an unreadable file, or invalid JSON becomes a structured
  // CHSET.chapter_file_missing / CHSET.chapter_file_unreadable blocker instead of
  // a raw exception. The old inline `JSON.parse(readFileSync(...))` threw before
  // promotion could return a deterministic PromotionResult — unattended
  // automation got a stack trace, not a fail-closed verdict. Valid JSON is
  // returned unverified so a malformed shape still reaches the schema-first ship
  // gate below; invalid syntax never reaches the deeper critics.
  const loaded = loadCanonicalChapterFiles(canonical.chapters);
  if (!loaded.ok) {
    return blockedResult({
      bookId,
      canonicalBlockers: loaded.blockers,
      reason: `CANONICAL_CHAPTER_SET_BLOCKED: ${formatChapterSetBlockers(loaded.blockers)}`,
    });
  }
  const loadedChapters: ChapterV21[] = loaded.chapters;
  const loadedSet = compareChapterSetToCanonical({
    bookId,
    canonical: canonical.chapters,
    actual: loadedChapters,
    actualLabel: "state chapter files",
  });
  if (!loadedSet.ok) {
    return blockedResult({
      bookId,
      canonicalBlockers: loadedSet.blockers,
      reason: `CANONICAL_CHAPTER_SET_BLOCKED: ${formatChapterSetBlockers(loadedSet.blockers)}`,
    });
  }

  // Step 1.5: chapter-number integrity. The intra-book priors filter (Step
  // 2.5) keys on the chapter's self-declared `number`; a duplicate or
  // missing number makes chapters mutually invisible to AS5–AS12 — the
  // silent-skip class again (verified 2026-06-10: identical quizzes across a
  // duplicate-numbered pair produced zero findings). Agent-authored metadata
  // drift is this pipeline's documented failure mode, so fail loud here.
  const numberProblems: string[] = [];
  const seenNumbers = new Map<number, string>();
  for (let i = 0; i < loadedChapters.length; i++) {
    const ch = loadedChapters[i];
    const spec = chapters[i];
    if (typeof ch.number !== "number" || !Number.isFinite(ch.number)) {
      numberProblems.push(`${spec.chapterId}: chapter.number is ${JSON.stringify(ch.number)} (not a number)`);
      continue;
    }
    if (spec.chapterNumber !== undefined && ch.number !== spec.chapterNumber) {
      numberProblems.push(`${spec.chapterId}: chapter.number=${ch.number} disagrees with the index (${spec.chapterNumber})`);
    }
    const prior = seenNumbers.get(ch.number);
    if (prior) numberProblems.push(`duplicate chapter.number=${ch.number} in ${prior} and ${spec.chapterId}`);
    else seenNumbers.set(ch.number, spec.chapterId);
  }
  if (numberProblems.length > 0) {
    return blockedResult({
      bookId,
      reason: `Chapter-number integrity failed (intra-book checks would silently skip): ${numberProblems.join("; ")}. Run fix-chapter-ids / repair the number fields before promoting.`,
    });
  }

  // Step 2: Re-run ship gate against every chapter.
  // Defense in depth: chapters in state/chapters/ should already have passed
  // the per-chapter ship gate at generation time, but re-validate before
  // letting them into the production library.
  //
  // WP-205: ONE floor ledger for this whole promote gate section. The ship gate
  // computed here is memoized by content, so the major-policy scan below
  // (evaluateMajorCleanliness → currentMajorFindings) reuses it instead of
  // re-running runShipGate/runBookGate a second time on the identical bytes.
  const floor = createFloorLedger();
  const perChapterGates: Array<{ chapter: number; report: GateReport }> = [];
  for (const ch of loadedChapters) {
    perChapterGates.push({ chapter: ch.number, report: chapterFloorGate(ch, { ledger: floor }) });
  }
  const shipBlockerCount = perChapterGates.reduce((acc, g) => acc + g.report.blockers.length, 0);
  const shipMajorCount = perChapterGates.reduce((acc, g) => acc + g.report.majors.length, 0);

  // Step 2.5: Intra-book AS5–AS12 cross-chapter checks, against the SAME
  // in-memory chapter set being shipped (no disk re-discovery, so no slug/
  // casing mismatch can silently skip them — the gate-chapter bug class).
  // Until Phase 1 this suite ran only in gate-chapter; the identical-card-
  // backs incident class passed promote cleanly.
  // Priors-only so each pairwise collision reports exactly once, from the
  // later chapter (the finding messages read "matches prior Ch<N>").
  const intraFindings = loadedChapters.flatMap((ch) =>
    chapterFloorIntra(ch, loadedChapters.filter((other) => other.number < ch.number), { ledger: floor }).map((f) => ({
      chapter: ch.number,
      ...f,
    })),
  );
  const intraBlockerCount = intraFindings.filter((f) => f.severity === "blocker").length;

  // Step 3: Run book gate across all chapters.
  const bookGate = bookFloorGate(bookId, loadedChapters, { ledger: floor });
  const bookBlockerCount = bookGate.findings.filter((f) => f.severity === "blocker").length;
  const bookMajorCount = bookGate.findings.filter((f) => f.severity === "major").length;
  const noApiMode = isNoApiCodexQcMode();
  const majorPolicy = evaluateMajorCleanliness(bookId, loadedChapters, {
    requireContentBound: true,
    requireRoundBacked: noApiMode,
  }, floor);
  // Deterministic majors are ADVISORY by default — the calibrated, empty-by-design
  // behavior (QC_ENFORCED_MAJORS empty) that `5c7f899f3` reversed. They are surfaced
  // in the gate report but do NOT block promotion, so a book that fires clean-corpus
  // majors (a non-deterministic set of ~145-155) still converges unattended. Opt in
  // to hard enforcement (every current major must be closed by a content-bound waiver)
  // with CHAPTERFLOW_ENFORCE_MAJORS=1; the waiver machinery is preserved for it.
  const enforceMajors = process.env.CHAPTERFLOW_ENFORCE_MAJORS === "1";
  const majorBlockerCount = enforceMajors ? majorPolicy.unresolved.length : 0;
  const sourceIntegrity = checkSourceV2Gate(bookId, loadedChapters.map((ch) => ch.number));
  const sourceIntegrityFindings = sourceIntegrity.findings
    .filter((f) => f.severity === "blocker")
    .map((f) => ({
      chapter: f.chapterNumber,
      checkId: f.checkId,
      severity: "blocker" as const,
      message: f.message,
    }));
  const sourceIntegrityBlockerCount = sourceIntegrityFindings.length;

  // WS-4 source-REALITY policy — the single point ALL promotion paths share, so a direct
  // `promote-book` produces the same verdict as `publish-after-qc` (which also runs it in
  // preflight). A PRESENT-but-bad record always blocks. A MISSING record/exemption blocks only
  // under CHAPTERFLOW_REQUIRE_SOURCE_VERIFY=1 (the operator opt-in); by default the unattended
  // path treats an absent record as not-applicable so it can converge without a human source
  // check. The same call shape the publish-after-qc preflight makes, so the two paths agree.
  // One instant is captured for BOTH the gate verdict here and the manifest evidence built later,
  // so a sub-second exemption-expiry boundary cannot flip the verdict between gate and evidence.
  const sourceRealityNow = now();
  const sourceReality = evaluateSourceRealityPolicy({ bookId, env: process.env, now: sourceRealityNow });
  const sourceRealityFindings = sourceReality.blocking
    ? sourceReality.findings.map((f) => ({
        chapter: f.chapterNumber,
        checkId: f.checkId,
        severity: "blocker" as const,
        message: f.message,
      }))
    : [];
  const sourceRealityBlockerCount = sourceRealityFindings.length;

  const generationDebt = evaluateGenerationDebt(bookId, loadedChapters);
  const generationDebtBlockerCount = generationDebt.totalBlockers;
  const generationDebtAdvisoryCount = generationDebt.totalAdvisories;

  // Step 3.5: QC-attestation gate — the no-API semantic judge. Every chapter
  // must carry a fresh PUBLISHABLE attestation from a Claude reviewer; this is
  // what makes the reviewer's verdict an enforceable ship blocker instead of an
  // out-of-band manual step. Stale (chapter edited since review) or missing
  // attestations block here even when every deterministic gate is clean.
  const qcFindings = loadedChapters.flatMap((ch) =>
    checkQcAttestation(ch, true).map((f) => ({ chapter: ch.number, ...f })),
  );
  const qcBlockerCount = qcFindings.length;

  // Step 3.6: Quiz answer-key judge gate — the model-backed wrong-key catch the
  // deterministic gates structurally cannot do (they only range-check
  // correctIndex; the `hooked` book shipped 21/72 wrong keys past a GREEN gate).
  // The judge is async + model-backed, so it runs out-of-band via `quiz-judge`
  // and writes a per-chapter result; promote stays sync + offline and merely
  // ENFORCES that result. A fresh result that flagged a confident wrong key
  // blocks. With CHAPTERFLOW_REQUIRE_KEYJUDGE=1 every chapter must also carry a
  // fresh CLEAN result — the setting for a single agent that both writes and QCs
  // a book, where the catch must not depend on that agent's honesty.
  const requireKeyJudge = process.env.CHAPTERFLOW_REQUIRE_KEYJUDGE === "1";
  const keyJudgeFindings = loadedChapters.flatMap((ch) =>
    checkKeyJudge(ch, true, requireKeyJudge).map((f) => ({ chapter: ch.number, ...f })),
  );
  const keyJudgeBlockerCount = keyJudgeFindings.length;

  // Step 3.6b: Quiz answer-key EVIDENCE resolution (F-10). Independent of the
  // block/no-block gate above: for EVERY chapter, state loudly what key evidence
  // promote actually has — a fresh judge result, a durable reader review that
  // re-derived all keys at the current content, or NONE. A chapter with no
  // evidence is reported prominently (never silently promoted with unverified
  // keys), but this is ADVISORY — it does not block. Escalating UNVERIFIED to a
  // hard gate is an owner decision (see F-10), deliberately NOT taken here.
  const keyEvidence = resolveBookKeyEvidence(loadedChapters, options.stateRoot);

  // Step 3.7: v21.1 no-API Codex QC mode. Default promotion remains backward
  // compatible; this stricter stack is active only when explicitly enabled.
  const noApiFindings: Array<{ chapter?: number; checkId: string; severity: "blocker"; message: string }> = [];
  if (noApiMode) {
    noApiFindings.push(...checkPlanEnforcement(bookId, loadedChapters).map((f) => ({
      chapter: f.chapterNumber,
      checkId: f.checkId,
      severity: "blocker" as const,
      message: f.message,
    })));
    noApiFindings.push(...loadedChapters.flatMap((ch) =>
      checkManualKeyJudge(ch, true).map((f) => ({
        chapter: ch.number,
        checkId: f.checkId,
        severity: "blocker" as const,
        message: f.message,
      })),
    ));
    noApiFindings.push(...checkSweep(loadedChapters, true).map((f) => ({
      checkId: f.checkId,
      severity: "blocker" as const,
      message: f.message,
    })));
  }
  const noApiBlockerCount = noApiFindings.length;
  const preManifestBlockerCount =
    shipBlockerCount + intraBlockerCount + bookBlockerCount + qcBlockerCount + keyJudgeBlockerCount + noApiBlockerCount + majorBlockerCount + sourceIntegrityBlockerCount + sourceRealityBlockerCount + generationDebtBlockerCount;

  // Promotion identity for this run. The staging directory + owner stamp let the
  // reaper later prove a CRASHED prior owner is dead before removing its leftover
  // staging dir. No cross-process lease is taken — the autopilot already
  // serializes per-book work behind its own run lock.
  const txId = newTransactionId(options);
  const owner: TxOwner = {
    bookId,
    transactionId: txId,
    ownerId: `promo-${process.pid}-${randomBytes(6).toString("hex")}`,
    ownerToken: randomBytes(16).toString("hex"),
    pid: process.pid,
    hostname: options.leaseHostname ?? osHostname(),
  };

  // Owner-proven, scoped reap of abandoned transaction directories left by DEAD
  // prior owners. Never removes a directory it cannot prove is abandoned — the
  // safe replacement for the old broad unconditional delete.
  reapAbandonedTransactionDirs(bookId, {
    excludeTransactionId: txId,
    hostname: options.leaseHostname,
    liveness: options.leaseLiveness,
  });

  mkdirSync(BOOK_PACKAGES_DIR, { recursive: true });
  const packagePath = resolve(BOOK_PACKAGES_DIR, `${bookId}.v21.json`);

  // Prior identity + content id come from the state-side SIDECAR (K1). The prior
  // sidecar contentId decides whether this promote reuses the prior identity
  // (byte-stable content) or stamps a fresh packageId + createdAt. runId is
  // carried from the prior sidecar so an unchanged re-promote reproduces the same
  // manifest bytes.
  const priorSidecar = readSidecarIfPresent(productionManifestSidecarPath(bookId));
  const priorContentId = typeof priorSidecar?.manifest?.contentId === "string" ? priorSidecar.manifest.contentId : null;
  const priorPackageId = typeof priorSidecar?.packageId === "string" ? priorSidecar.packageId : null;
  const priorCreatedAt = typeof priorSidecar?.createdAt === "string" ? priorSidecar.createdAt
    : (typeof priorSidecar?.manifest?.metadata?.createdAt === "string" ? priorSidecar.manifest.metadata.createdAt : null);
  const priorRunId = typeof priorSidecar?.manifest?.metadata?.runId === "string" ? priorSidecar.manifest.metadata.runId : undefined;
  const contentOwner = input.contentOwner ?? "chapterflow";
  const shippedChapters = loadedChapters.map((c) => stripInternalFields(c));

  // The promote instant. epochMs derives the human-readable packageId from the
  // SAME instant as createdAt (K1) — a package stamped fresh carries a packageId
  // and createdAt that agree on when it was published.
  const nowInstant = now();

  let candidatePackage: BookPackageV21 | null = null;
  let candidateSidecar: ProductionManifestSidecar | null = null;
  let productionManifestFindings: ProductionManifestFinding[] = [];
  let verificationFindings: ProductionManifestFinding[] = [];
  let manifestContentId: string | null = null;

  if (preManifestBlockerCount === 0) {
    // First build the manifest with a PROVISIONAL createdAt to learn the content
    // id. contentId excludes createdAt/packageId (it is the canonical payload
    // hash over content + evidence), so the provisional value never affects it.
    const probe = buildProductionManifest({
      bookId, title, author, contentOwner,
      categories: input.categories,
      tags: input.tags,
      chapters: shippedChapters,
      createdAt: priorCreatedAt ?? nowInstant.toISOString(),
      runId: priorRunId,
      packagePath,
      now: sourceRealityNow,
    });
    if (!probe.ok) {
      productionManifestFindings = probe.findings;
    } else {
      // K1 identity: stamp a fresh packageId + createdAt whenever the recomputed
      // content id differs from the prior sidecar's (or none exists); preserve the
      // prior identity on a byte-stable no-op re-promote. This replaces the old
      // always-preserve-createdAt (which made a later publish carry an earlier
      // run's date).
      const { packageId, createdAt } = decidePackageIdentity({
        bookId,
        recomputedContentId: probe.manifest.contentId,
        priorContentId,
        priorPackageId,
        priorCreatedAt,
        now: nowInstant,
      });

      const manifestResult = buildProductionManifest({
        bookId, title, author, contentOwner,
        categories: input.categories,
        tags: input.tags,
        chapters: shippedChapters,
        createdAt,
        runId: priorRunId,
        packagePath,
        now: sourceRealityNow,
      });
      if (!manifestResult.ok) {
        productionManifestFindings = manifestResult.findings;
      } else {
        manifestContentId = manifestResult.manifest.contentId;
        candidatePackage = {
          schemaVersion: V21_SCHEMA_VERSION,
          packageId,
          createdAt,
          contentOwner,
          book: {
            bookId,
            title,
            author,
            categories: input.categories,
            tags: input.tags,
          },
          // Reader content ONLY — the manifest moves to the sidecar (K1).
          chapters: shippedChapters,
        };
        candidateSidecar = {
          schemaVersion: PRODUCTION_MANIFEST_SIDECAR_SCHEMA,
          bookId,
          packageId,
          createdAt,
          manifest: manifestResult.manifest,
        };
        const verification = verifyProductionPackage({
          packagePath,
          packageData: candidatePackage,
          manifestData: candidateSidecar,
          compareLooseState: true,
        });
        if (!verification.ok) verificationFindings = verification.findings;
      }
    }
  }
  const productionManifestBlockerCount = productionManifestFindings.length + verificationFindings.length;

  // Step 3.8: D7 rubric-audit SHIP GATE (WP-401). The LAST gate on the ship path:
  // a NEW or CHANGED book must carry a fresh, sealed D7 PASS receipt bound to the
  // exact bytes being shipped. Runs only when the book is otherwise shippable (a
  // candidate package was built and verified) — an already-blocked book is not
  // re-gated. The rating itself stays Claude-side/external; this gate only reads
  // the sealed receipt and re-derives the current content hashes (zero model
  // calls). Exemption (byte-identical to the shipped corpus package) and the
  // require-flag semantics live in runD7ShipGate.
  const requireD7 = process.env[CHAPTERFLOW_REQUIRE_D7_SHIP_GATE_ENV] === "1";
  let d7Result: D7ShipGateResult | null = null;
  let d7ShipGateBlockerCount = 0;
  if (candidatePackage && candidateSidecar && productionManifestBlockerCount === 0) {
    d7Result = runD7ShipGate({
      bookId,
      // The EXACT bytes publishPackageTransactionally will write (no trailing newline).
      candidatePackageBytes: JSON.stringify(candidatePackage, null, 2),
      packagePath,
      stateBooksDir: resolve(STATE, "books"),
      repositoryRoot: REPOSITORY_ROOT,
      require: requireD7,
    });
    d7ShipGateBlockerCount = d7Result.blockers.length;
  }
  const d7ShipGateDecision: D7ShipGateDecision | "not-evaluated" = d7Result?.decision ?? "not-evaluated";

  // Step 4: Write the report regardless of pass/fail.
  mkdirSync(resolve(STATE, "books"), { recursive: true });
  const reportPath = resolve(STATE, "books", `${bookId}.gate.json`);
  const fullReport = {
    bookId,
    title,
    author,
    promotedAt: now().toISOString(),
    chapterCount: loadedChapters.length,
    shipGate: {
      perChapter: perChapterGates.map((g) => ({
        chapter: g.chapter,
        passed: g.report.passed,
        blockers: g.report.blockers,
        majors: g.report.majors,
        minors: g.report.minors,
      })),
      totalBlockers: shipBlockerCount,
      totalMajors: shipMajorCount,
    },
    bookGate,
    intraBook: { totalBlockers: intraBlockerCount, findings: intraFindings },
    qcAttestation: { totalBlockers: qcBlockerCount, findings: qcFindings },
    quizKeyJudge: { totalBlockers: keyJudgeBlockerCount, findings: keyJudgeFindings },
    // F-10: per-chapter key-evidence lines + a prominent UNVERIFIED summary. This
    // is advisory (does not affect promotion) — it makes a silent fail-open loud.
    quizKeyEvidence: {
      schemaVersion: keyEvidence.schemaVersion,
      summary: keyEvidence.summary,
      counts: keyEvidence.counts,
      unverifiedChapters: keyEvidence.unverifiedChapters,
      lines: keyEvidence.perChapter.map((c) => c.line),
    },
    sourceIntegrity: { totalBlockers: sourceIntegrityBlockerCount, findings: sourceIntegrityFindings },
    sourceReality: {
      schemaVersion: "source-reality-policy-v1",
      decision: sourceReality.decision,
      classification: sourceReality.classification,
      applies: sourceReality.applies,
      itemCount: sourceReality.itemCount,
      totalBlockers: sourceRealityBlockerCount,
      findings: sourceRealityFindings,
      summary: sourceReality.summary,
      exemption: sourceReality.exemption ?? null,
    },
    generationDebt: {
      schemaVersion: generationDebt.schemaVersion,
      totalBlockers: generationDebtBlockerCount,
      totalAdvisories: generationDebtAdvisoryCount,
      findings: generationDebt.findings,
      waived: generationDebt.waived,
    },
    noApiCodexQc: { enabled: noApiMode, totalBlockers: noApiBlockerCount, findings: noApiFindings },
    majorPolicy: {
      schemaVersion: "major-production-policy-v1",
      totalCurrent: majorPolicy.current.length,
      totalBlockers: majorBlockerCount,
      current: majorPolicy.current,
      decisions: majorPolicy.decisions,
    },
    canonicalChapterSet: { indexPath: canonical.path, chapterCount: canonical.chapters.length, totalBlockers: 0, findings: [] },
    productionManifest: {
      contentId: manifestContentId,
      skipped: preManifestBlockerCount > 0,
      totalBlockers: productionManifestBlockerCount,
      findings: [...productionManifestFindings, ...verificationFindings],
    },
    d7ShipGate: {
      schemaVersion: "d7-ship-gate-report-v1",
      decision: d7ShipGateDecision,
      require: requireD7,
      verdict: d7Result?.verdict ?? null,
      totalBlockers: d7ShipGateBlockerCount,
      blockers: d7Result?.blockers ?? [],
      reason: d7Result?.reason ?? "not evaluated (book blocked before the D7 gate)",
      halt: d7Result?.halt ?? null,
    },
  };

  // Step 5: Promote only if EVERY gate passes blocker-clean — deterministic
  // gates (per-chapter + intra-book + book), the QC-attestation gate, AND the
  // quiz answer-key judge gate.
  if (preManifestBlockerCount > 0 || productionManifestBlockerCount > 0 || d7ShipGateBlockerCount > 0 || !candidatePackage || !candidateSidecar) {
    mkdirSync(QUARANTINE_DIR, { recursive: true });
    const quarantinePath = resolve(QUARANTINE_DIR, `${bookId}.${now().getTime()}.report.json`);
    writeFileAtomic(quarantinePath, JSON.stringify(fullReport, null, 2) + "\n");
    // On a D7 quality-bar FAIL/VOID, persist the owner-visible halt record that
    // carries the D-8 on-fail policy DATA (one full re-author round, then a
    // terminal owner halt). The re-author EXECUTION is the author loop's job.
    if (d7Result?.halt) {
      mkdirSync(resolve(STATE, "books"), { recursive: true });
      writeFileAtomic(d7ShipGateHaltPath(bookId, resolve(STATE, "books")), JSON.stringify(d7Result.halt, null, 2) + "\n");
    }
    // Bound this book's blocked-report history: keep the newest 5, MOVE the rest
    // into _blocked/_archive-<date>/ (never delete — F-14). The just-written report
    // is always the newest, so it is never archived by its own write.
    pruneBlockedReports({ dir: QUARANTINE_DIR, bookId, keep: 5, now });
    const qcSummary = qcBlockerCount > 0
      ? ` + ${qcBlockerCount} QC-attestation blocker(s): ${qcFindings.slice(0, 3).map((f) => `ch${f.chapter} ${f.checkId}`).join(", ")}${qcFindings.length > 3 ? ", …" : ""}`
      : "";
    const intraSummary = intraBlockerCount > 0
      ? ` + ${intraBlockerCount} intra-book blocker(s): ${intraFindings.filter((f) => f.severity === "blocker").slice(0, 3).map((f) => `ch${f.chapter} ${f.checkId}`).join(", ")}${intraBlockerCount > 3 ? ", …" : ""}`
      : "";
    const keyJudgeSummary = keyJudgeBlockerCount > 0
      ? ` + ${keyJudgeBlockerCount} quiz-key blocker(s): ${keyJudgeFindings.slice(0, 3).map((f) => `ch${f.chapter} ${f.checkId}`).join(", ")}${keyJudgeBlockerCount > 3 ? ", …" : ""}`
      : "";
    const noApiSummary = noApiBlockerCount > 0
      ? ` + ${noApiBlockerCount} no-api QC blocker(s): ${noApiFindings.slice(0, 3).map((f) => `${f.chapter ? `ch${f.chapter} ` : ""}${f.checkId}`).join(", ")}${noApiBlockerCount > 3 ? ", …" : ""}`
      : "";
    const majorSummary = majorBlockerCount > 0
      ? ` + ${majorBlockerCount} unresolved major(s): ${majorPolicy.unresolved.slice(0, 3).map((f) => `${f.scope} ${f.checkId}`).join(", ")}${majorBlockerCount > 3 ? ", …" : ""}`
      : "";
    const sourceIntegritySummary = sourceIntegrityBlockerCount > 0
      ? ` + ${sourceIntegrityBlockerCount} source-integrity blocker(s): ${sourceIntegrityFindings.slice(0, 3).map((f) => `${f.chapter ? `ch${f.chapter} ` : ""}${f.checkId}`).join(", ")}${sourceIntegrityBlockerCount > 3 ? ", …" : ""}`
      : "";
    const sourceRealitySummary = sourceRealityBlockerCount > 0
      ? ` + source-reality ${sourceReality.decision} (${sourceRealityBlockerCount} blocker(s)): ${sourceRealityFindings.slice(0, 3).map((f) => `${f.chapter ? `ch${f.chapter} ` : ""}${f.checkId}`).join(", ")}${sourceRealityBlockerCount > 3 ? ", …" : ""}`
      : "";
    const generationDebtSummary = generationDebtBlockerCount > 0
      ? ` + ${generationDebtBlockerCount} generation-debt blocker(s): ${generationDebt.findings.filter((f) => f.severity === "blocker").slice(0, 3).map((f) => `${f.chapterNumber ? `ch${f.chapterNumber} ` : ""}${f.stage}`).join(", ")}${generationDebtBlockerCount > 3 ? ", …" : ""}`
      : "";
    const manifestSummary = productionManifestBlockerCount > 0
      ? ` + ${productionManifestBlockerCount} production-manifest blocker(s): ${[...productionManifestFindings, ...verificationFindings].slice(0, 3).map((f) => `${f.chapterNumber ? `ch${f.chapterNumber} ` : ""}${f.checkId}`).join(", ")}${productionManifestBlockerCount > 3 ? ", …" : ""}`
      : "";
    const d7Summary = d7ShipGateBlockerCount > 0
      ? ` + D7 ship-gate ${d7Result?.verdict ?? "BLOCK"} (${d7ShipGateBlockerCount} blocker(s)): ${(d7Result?.blockers ?? []).slice(0, 2).map((b) => b.split(":")[0]).join(", ")}${d7ShipGateBlockerCount > 2 ? ", …" : ""}`
      : "";
    writeFileAtomic(reportPath, JSON.stringify(fullReport, null, 2) + "\n");
    return {
      promoted: false,
      bookId,
      reportPath,
      shipGateBlockerCount: shipBlockerCount,
      bookGateBlockerCount: bookBlockerCount,
      intraBookBlockerCount: intraBlockerCount,
      keyJudgeBlockerCount,
      noApiBlockerCount,
      majorBlockerCount,
      sourceIntegrityBlockerCount,
      sourceRealityBlockerCount,
      sourceRealityDecision: sourceReality.decision,
      generationDebtBlockerCount,
      generationDebtAdvisoryCount,
      productionManifestBlockerCount,
      d7ShipGateBlockerCount,
      d7ShipGateDecision,
      canonicalBlockerCount: 0,
      shipGateMajorCount: shipMajorCount,
      bookGateMajorCount: bookMajorCount,
      quizKeyEvidence: {
        summary: keyEvidence.summary,
        counts: keyEvidence.counts,
        unverifiedChapters: keyEvidence.unverifiedChapters,
        lines: keyEvidence.perChapter.map((c) => c.line),
      },
      reason: `BLOCKED: ${shipBlockerCount} ship-gate blocker(s)${intraSummary} + ${bookBlockerCount} book-gate blocker(s)${qcSummary}${keyJudgeSummary}${sourceIntegritySummary}${sourceRealitySummary}${generationDebtSummary}${noApiSummary}${majorSummary}${manifestSummary}${d7Summary}. Quarantined at ${quarantinePath}.${keyEvidence.unverifiedChapters.length > 0 ? ` ${keyEvidence.summary}` : ""}`,
    };
  }

  // Step 6: Write the independently verified BookPackageV21 to the library and
  // its production-manifest SIDECAR to state/books/, transactionally (both or
  // neither). The shipped package carries reader content only; the packageId is
  // human-readable `<bookId>-v21-<epochMs>` and createdAt is stamped fresh only
  // when the recomputed content id differs from the prior sidecar's (K1).
  publishPackageTransactionally({
    bookId,
    packagePath,
    candidatePackage,
    sidecar: candidateSidecar,
    contentId: manifestContentId,
    options,
    owner,
    txId,
  });
  writeFileAtomic(reportPath, JSON.stringify(fullReport, null, 2) + "\n");

  return {
    promoted: true,
    bookId,
    packagePath,
    reportPath,
    shipGateBlockerCount: 0,
    bookGateBlockerCount: 0,
    intraBookBlockerCount: 0,
    keyJudgeBlockerCount: 0,
    noApiBlockerCount: 0,
    majorBlockerCount: 0,
    sourceIntegrityBlockerCount: 0,
    sourceRealityBlockerCount: 0,
    sourceRealityDecision: sourceReality.decision,
    generationDebtBlockerCount: 0,
    generationDebtAdvisoryCount,
    productionManifestBlockerCount: 0,
    d7ShipGateBlockerCount: 0,
    d7ShipGateDecision,
    canonicalBlockerCount: 0,
    shipGateMajorCount: shipMajorCount,
    bookGateMajorCount: bookMajorCount,
    quizKeyEvidence: {
      summary: keyEvidence.summary,
      counts: keyEvidence.counts,
      unverifiedChapters: keyEvidence.unverifiedChapters,
      lines: keyEvidence.perChapter.map((c) => c.line),
    },
    reason: `PROMOTED: ${loadedChapters.length} chapter(s) shipped to ${packagePath}. Source-reality: ${sourceReality.decision}. D7 ship gate: ${d7ShipGateDecision}. Major policy clean with ${majorPolicy.current.length} current major(s) waived or absent.${keyEvidence.unverifiedChapters.length > 0 ? ` ${keyEvidence.summary}` : ""}`,
  };
}

function blockedResult(args: { bookId: string; reason: string; canonicalBlockers?: ChapterSetBlocker[] }): PromotionResult {
  return {
    promoted: false,
    bookId: args.bookId,
    reportPath: "",
    shipGateBlockerCount: 0,
    bookGateBlockerCount: 0,
    intraBookBlockerCount: 0,
    keyJudgeBlockerCount: 0,
    noApiBlockerCount: 0,
    majorBlockerCount: 0,
    sourceIntegrityBlockerCount: 0,
    // A pre-gate fail-closed return (quarantine tombstone, canonical-set rejection, unreadable
    // chapter file): promotion never reached the source-reality evaluation.
    sourceRealityBlockerCount: 0,
    sourceRealityDecision: "not-applicable",
    generationDebtBlockerCount: 0,
    generationDebtAdvisoryCount: 0,
    productionManifestBlockerCount: 0,
    // A pre-gate fail-closed return never reached the D7 ship gate.
    d7ShipGateBlockerCount: 0,
    d7ShipGateDecision: "not-evaluated",
    canonicalBlockerCount: args.canonicalBlockers?.length ?? 0,
    canonicalBlockers: args.canonicalBlockers,
    shipGateMajorCount: 0,
    bookGateMajorCount: 0,
    reason: args.reason,
  };
}

export function formatPromotionResult(r: PromotionResult): string {
  const lines: string[] = [];
  lines.push(r.promoted ? `✓ PROMOTED: ${r.bookId}` : `✗ BLOCKED: ${r.bookId}`);
  lines.push(`  ${r.reason}`);
  if (r.packagePath) lines.push(`  Package: ${r.packagePath}`);
  if (r.reportPath) lines.push(`  Report: ${r.reportPath}`);
  lines.push(`  Ship gate: ${r.shipGateBlockerCount} blockers, ${r.shipGateMajorCount} majors`);
  lines.push(`  Intra-book (AS5–AS12): ${r.intraBookBlockerCount} blockers`);
  lines.push(`  Canonical chapter set: ${r.canonicalBlockerCount} blockers`);
  lines.push(`  Quiz answer-key judge: ${r.keyJudgeBlockerCount} blockers`);
  lines.push(`  No-api Codex QC: ${r.noApiBlockerCount} blockers`);
  lines.push(`  Source integrity: ${r.sourceIntegrityBlockerCount} blockers`);
  lines.push(`  Source reality: ${r.sourceRealityDecision} (${r.sourceRealityBlockerCount} blockers)`);
  lines.push(`  Generation debt: ${r.generationDebtBlockerCount} blockers, ${r.generationDebtAdvisoryCount} advisories`);
  lines.push(`  Major policy: ${r.majorBlockerCount} blockers`);
  lines.push(`  Production manifest: ${r.productionManifestBlockerCount} blockers`);
  lines.push(`  D7 ship gate: ${r.d7ShipGateDecision} (${r.d7ShipGateBlockerCount} blockers)`);
  lines.push(`  Book gate: ${r.bookGateBlockerCount} blockers, ${r.bookGateMajorCount} majors`);
  // R5(b): the F-10 quiz answer-key EVIDENCE, per chapter. The `reason` only
  // folds in the one-line summary (and only when a chapter is UNVERIFIED), so the
  // operator never saw WHICH chapters carry which evidence. Print every
  // per-chapter line under a header. Advisory — this never reflects a block.
  if (r.quizKeyEvidence) {
    const ev = r.quizKeyEvidence;
    lines.push(
      `  Quiz key evidence: ${ev.counts.judgeVerified} judge, ${ev.counts.readerVerified} reader, ${ev.counts.unverified} unverified`,
    );
    for (const line of ev.lines) lines.push(`    ${line}`);
  }
  return lines.join("\n");
}
