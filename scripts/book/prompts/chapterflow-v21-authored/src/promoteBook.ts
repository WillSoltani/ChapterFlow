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
 *   - Failure report is written to state/books/_blocked/<bookId>.report.json.
 *   - The book remains in pre-production state until issues are fixed.
 *
 * If all gates pass:
 *   - Bundle is written to book-packages/<bookId>.v21.json.
 *   - A book-gate report sidecar is written to state/books/<bookId>.gate.json.
 *   - The promotion is logged.
 *
 * v21 packages coexist with legacy v13 `.modern.json` files in book-packages/.
 * Downstream consumers branch on `schemaVersion` to know which shape to read.
 */

import { randomBytes } from "crypto";
import { readFileSync, mkdirSync, existsSync, renameSync, rmSync, readdirSync, statSync } from "fs";
import { hostname as osHostname } from "os";
import { writeFileAtomic } from "./lib/atomicWrite.js";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import {
  acquirePromotionLease,
  defaultPromotionOwnerLiveness,
  heartbeatPromotionLease,
  releasePromotionLease,
  type OwnerLivenessProbe,
  type PromotionLease,
  type PromotionLeaseOptions,
} from "./promotionLease.js";

import { BookPackageV21, ChapterV21, V21_SCHEMA_VERSION } from "./types.js";
import { runShipGate, GateReport, formatGateReport } from "./critics/finalGate.js";
import { runBookGate, BookGateReport, formatBookGateReport } from "./critics/bookGate.js";
import { runIntraBookChecks } from "./critics/intraBook.js";
import { checkQcAttestation } from "./critics/qcAttestation.js";
import { checkKeyJudge } from "./critics/quizKeyGate.js";
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
import { stripInternalFields } from "./lib/readerContent.js";
import { buildProductionManifest, type ProductionManifestFinding } from "./productionManifest.js";
import { verifyProductionPackage } from "./verifyProductionPackage.js";
import { evaluateGenerationDebt } from "./generationDegradation.js";
import {
  compareChapterSetToCanonical,
  formatChapterSetBlockers,
  loadCanonicalChapterFiles,
  readCanonicalChapterIndex,
  type ChapterSetBlocker,
} from "./lib/chapterSet.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE = resolve(__dirname, "../state");
const REPO_ROOT = resolve(__dirname, "../../../../..");
const BOOK_PACKAGES_DIR = resolve(REPO_ROOT, "book-packages");
const QUARANTINE_DIR = resolve(STATE, "books", "_blocked");
const PROMOTION_TX_DIR = resolve(STATE, "books", "_transactions");

export type PromotionFaultPoint =
  | "beforeStaging"
  | "afterStaging"
  | "afterVerification"
  | "beforeFinalRename"
  | "beforeRegistryUpdate";

export type PromotionOptions = {
  /** Test seam: throw at a named transition after journaling that transition. */
  faultAt?: PromotionFaultPoint;
  /** Stable transaction id for deterministic fault/recovery tests. */
  transactionId?: string;
  now?: () => Date;
  /** Test seam: override the promotion lease TTL (ms). */
  leaseTtlMs?: number;
  /** Test seam: override the recorded host for the lease + transaction owner stamps. */
  leaseHostname?: string;
  /** Test seam: override the owner-liveness probe for lease recovery + tx-dir reaping. */
  leaseLiveness?: OwnerLivenessProbe;
  /** Test seam: invoked once, after verification, immediately before the final
   *  ownership re-assert + atomic rename. Used to simulate a successor stealing
   *  the lock mid-publish so the test can prove the owner aborts at the rename
   *  rather than force-publishing (requirement 15). */
  onBeforeFinalRename?: () => void;
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
  /** WS-4 source-REALITY policy: 0 unless the policy blocks (missing/invalid/stale record or
   *  exemption). Always-on production invariant — independent of the no-API mode or any env var. */
  sourceRealityBlockerCount: number;
  /** The reported source-reality decision: required-and-verified | legacy-exempt | missing |
   *  invalid | stale | not-applicable. */
  sourceRealityDecision: SourceRealityDecision;
  generationDebtBlockerCount: number;
  generationDebtAdvisoryCount: number;
  productionManifestBlockerCount: number;
  canonicalBlockerCount: number;
  canonicalBlockers?: ChapterSetBlocker[];
  shipGateMajorCount: number;
  bookGateMajorCount: number;
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
 *  directory to the lease that created it. This is the proof a later recovery
 *  needs to decide a leftover directory belongs to a now-dead owner before it
 *  may remove it (requirements 10 + 11). */
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

function txOwnerStampPath(txDir: string): string {
  return resolve(txDir, "owner.json");
}

function writeTxOwnerStamp(txDir: string, lease: PromotionLease, now: () => Date): void {
  const stamp: PromotionTxOwnerStamp = {
    schemaVersion: PROMOTION_TX_OWNER_SCHEMA,
    bookId: lease.bookId,
    transactionId: lease.transactionId,
    ownerId: lease.ownerId,
    ownerToken: lease.ownerToken,
    pid: lease.pid,
    hostname: lease.hostname,
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
  liveness?: OwnerLivenessProbe;
};

/**
 * Owner-proven, scoped cleanup of abandoned promotion transaction directories —
 * the safe replacement for the old broad `recoverPromotionTransactions` that
 * `rmSync`-removed EVERY `<bookId>.*` directory unconditionally (and so could
 * delete a live promotion's staging directory). A directory is removed ONLY when
 * its owner stamp proves the owner is DEAD (same host, pid gone). Directories
 * whose owner is alive, of unknown liveness, or that carry no readable owner
 * stamp are LEFT in place as forensic evidence — recovery never destroys a
 * directory it cannot prove is abandoned (requirements 11, 12).
 *
 * Only sound while the caller holds the per-book promotion lease: the lease
 * guarantees no other live promotion for this book exists, so any leftover
 * directory is from a crashed/dead prior owner, never a concurrent one.
 *
 * @returns the transactionIds reaped (for logging).
 */
function reapAbandonedTransactionDirs(bookId: string, options: ReapOptions = {}): string[] {
  if (!existsSync(PROMOTION_TX_DIR)) return [];
  const host = options.hostname ?? osHostname();
  const probe = options.liveness ?? ((owner) => defaultPromotionOwnerLiveness(owner, host));
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

/** Map promotion options onto the lease module's options (now-thunk -> instant). */
function leaseOptionsFrom(options: PromotionOptions): PromotionLeaseOptions {
  return {
    now: options.now ? options.now() : undefined,
    ttlMs: options.leaseTtlMs,
    hostname: options.leaseHostname,
    liveness: options.leaseLiveness,
  };
}

function injectFault(options: PromotionOptions, point: PromotionFaultPoint): void {
  if (options.faultAt === point) throw new Error(`Injected promotion fault at ${point}`);
}

function publishPackageTransactionally(args: {
  bookId: string;
  packagePath: string;
  candidatePackage: BookPackageV21;
  contentId: string | null;
  options: PromotionOptions;
  /** The held per-book lease. Heartbeated at every durable transition and
   *  re-asserted immediately before the final rename. */
  lease: PromotionLease;
  /** The transaction id this publish owns — identical to the lease's, so the
   *  lock and the staging directory `<bookId>.<txId>` share one identity. */
  txId: string;
}): void {
  const now = args.options.now ?? (() => new Date());
  const txId = args.txId;
  const txDir = transactionDir(args.bookId, txId);
  const stagedPackagePath = resolve(txDir, "package.v21.json");
  // Refresh the lease heartbeat (and re-assert ownership) at each durable
  // transition. heartbeat THROWS if a successor has taken the lock, so a lease
  // we have lost can never advance the transaction or reach the rename.
  const beat = (): void => { heartbeatPromotionLease(args.lease, leaseOptionsFrom(args.options)); };

  // Create + owner-stamp the transaction directory before the first journal, so
  // even a crash one instruction later leaves recoverable, owner-attributed
  // evidence (requirement 10).
  mkdirSync(txDir, { recursive: true });
  writeTxOwnerStamp(txDir, args.lease, now);

  writeJournal({ bookId: args.bookId, txId, state: "started", stagedPackagePath, packagePath: args.packagePath, contentId: args.contentId, now });
  beat();
  injectFault(args.options, "beforeStaging");

  writeFileAtomic(stagedPackagePath, JSON.stringify(args.candidatePackage, null, 2));
  writeJournal({ bookId: args.bookId, txId, state: "staged", stagedPackagePath, packagePath: args.packagePath, contentId: args.contentId, now });
  beat();
  injectFault(args.options, "afterStaging");

  const verification = verifyProductionPackage({ packagePath: stagedPackagePath, compareLooseState: true });
  if (!verification.ok) {
    throw new Error(`Staged package verification failed: ${verification.findings.map((f) => f.message).join("; ")}`);
  }
  writeJournal({ bookId: args.bookId, txId, state: "verified", stagedPackagePath, packagePath: args.packagePath, contentId: args.contentId, now });
  beat();
  injectFault(args.options, "afterVerification");
  injectFault(args.options, "beforeFinalRename");
  // promoteBook itself does not write web registries. This seam marks the final
  // pre-visibility point before any caller can safely run a registry update.
  injectFault(args.options, "beforeRegistryUpdate");

  // FINAL PUBLICATION. Re-assert ownership immediately before the atomic rename:
  // if a successor recovered the lock because we appeared dead, this throws and
  // we never force the package live behind the new owner's back (requirement 15).
  // The rename itself is unchanged — the atomic single-step publication and the
  // fault seams above are preserved exactly (requirement 14).
  args.options.onBeforeFinalRename?.();
  beat();
  mkdirSync(dirname(args.packagePath), { recursive: true });
  renameSync(stagedPackagePath, args.packagePath);
  writeJournal({ bookId: args.bookId, txId, state: "published", stagedPackagePath, packagePath: args.packagePath, contentId: args.contentId, now });
  beat();
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
  const perChapterGates: Array<{ chapter: number; report: GateReport }> = [];
  for (const ch of loadedChapters) {
    perChapterGates.push({ chapter: ch.number, report: runShipGate(ch) });
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
    runIntraBookChecks(ch, loadedChapters.filter((other) => other.number < ch.number)).map((f) => ({
      chapter: ch.number,
      ...f,
    })),
  );
  const intraBlockerCount = intraFindings.filter((f) => f.severity === "blocker").length;

  // Step 3: Run book gate across all chapters.
  const bookGate = runBookGate(bookId, loadedChapters);
  const bookBlockerCount = bookGate.findings.filter((f) => f.severity === "blocker").length;
  const bookMajorCount = bookGate.findings.filter((f) => f.severity === "major").length;
  const noApiMode = isNoApiCodexQcMode();
  const majorPolicy = evaluateMajorCleanliness(bookId, loadedChapters, {
    requireContentBound: true,
    requireRoundBacked: noApiMode,
  });
  const majorBlockerCount = majorPolicy.unresolved.length;
  const sourceIntegrity = checkSourceV2Gate(bookId, loadedChapters.map((ch) => ch.number));
  const sourceIntegrityFindings = sourceIntegrity.findings.map((f) => ({
    chapter: f.chapterNumber,
    checkId: f.checkId,
    severity: "blocker" as const,
    message: f.message,
  }));
  const sourceIntegrityBlockerCount = sourceIntegrityFindings.length;

  // WS-4 source-REALITY policy — the single point ALL promotion paths share, so a direct
  // `promote-book` produces the same verdict as `publish-after-qc` (which also runs it in
  // preflight). This is a PRODUCTION INVARIANT, not a no-API-mode or env-var convention: a newly
  // produced source-v2 book (one with sidecars) MUST carry a valid VERIFIED source-verify record
  // before it can ship. Absence blocks unless a content-bound legacy exemption covers it; a
  // present-but-bad record always blocks. CHAPTERFLOW_REQUIRE_SOURCE_VERIFY=1 only STRENGTHENS
  // (extends the requirement to books with no verifiable content) — it can never weaken the
  // new-book default.
  // Same call shape the publish-after-qc preflight makes (the wrapper itself derives the
  // canonicalIndexHash an exemption binds to), so the two paths cannot disagree.
  const sourceReality = evaluateSourceRealityPolicy({ bookId, env: process.env, now: now() });
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

  // Step 3.7: v21.1 no-API Codex QC mode. Default promotion remains backward
  // compatible; this stricter stack is active only when explicitly enabled.
  const noApiFindings: Array<{ chapter?: number; checkId: string; severity: "blocker"; message: string }> = [];
  if (noApiMode) {
    // NOTE: the WS-4 source-REALITY gate moved OUT of this no-API block to an always-on
    // production invariant above (sourceReality) — a direct `promote-book` cannot skip it by
    // omitting an env var or the no-API mode. The rest of the stricter no-API stack stays here.
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

  // ── Per-book promotion lease ───────────────────────────────────────────────
  // Acquire BEFORE any transaction recovery, candidate construction, or staging,
  // so only one promotion per book runs at a time and recovery can never destroy
  // a live owner's transaction. The lock and the staging directory share one
  // transaction id. Fail closed — touch no production state — when the lease is
  // unavailable: held live by another promotion, or held stale by an owner whose
  // death we cannot prove (alive, or unknown liveness).
  const txId = newTransactionId(options);
  let lease: PromotionLease;
  try {
    lease = acquirePromotionLease(bookId, txId, leaseOptionsFrom(options));
    console.error(`[ACQ] book=${bookId} tx=${txId} token=${lease.ownerToken.slice(0,6)} exp=${lease.expiresAt} recovered=${!!lease.recoveredFrom}`);
  } catch (err) {
    return blockedResult({
      bookId,
      reason: `PROMOTION_LEASE_UNAVAILABLE: ${(err as Error).message}`,
    });
  }

  try {
    // Owner-proven, scoped reap of abandoned transaction directories left by DEAD
    // prior owners. Runs under the held lease (so no concurrent owner can exist)
    // and never removes a directory it cannot prove is abandoned (requirements
    // 11, 12) — the safe replacement for the old broad delete.
    reapAbandonedTransactionDirs(bookId, {
      excludeTransactionId: txId,
      hostname: options.leaseHostname,
      liveness: options.leaseLiveness,
    });

    mkdirSync(BOOK_PACKAGES_DIR, { recursive: true });
    const packagePath = resolve(BOOK_PACKAGES_DIR, `${bookId}.v21.json`);
    let existingPkg: Partial<BookPackageV21> | null = null;
    if (existsSync(packagePath)) {
      try { existingPkg = JSON.parse(readFileSync(packagePath, "utf8")) as Partial<BookPackageV21>; } catch { existingPkg = null; }
    }
    const existingManifest = existingPkg?.productionManifest;
    const createdAt = typeof existingPkg?.createdAt === "string" ? existingPkg.createdAt : now().toISOString();
    const priorRunId = typeof existingManifest?.metadata?.runId === "string" ? existingManifest.metadata.runId : undefined;
    const contentOwner = input.contentOwner ?? "chapterflow";
    const shippedChapters = loadedChapters.map((c) => stripInternalFields(c));

    let candidatePackage: BookPackageV21 | null = null;
    let productionManifestFindings: ProductionManifestFinding[] = [];
    let verificationFindings: ProductionManifestFinding[] = [];
    let manifestContentId: string | null = null;

    if (preManifestBlockerCount === 0) {
      const manifestResult = buildProductionManifest({
        bookId,
        title,
        author,
        contentOwner,
        categories: input.categories,
        tags: input.tags,
        chapters: shippedChapters,
        createdAt,
        runId: priorRunId,
        packagePath,
      });
      if (!manifestResult.ok) {
        productionManifestFindings = manifestResult.findings;
      } else {
        manifestContentId = manifestResult.manifest.contentId;
        candidatePackage = {
          schemaVersion: V21_SCHEMA_VERSION,
          packageId: manifestResult.manifest.contentId,
          createdAt: manifestResult.manifest.metadata.createdAt,
          contentOwner,
          book: {
            bookId,
            title,
            author,
            categories: input.categories,
            tags: input.tags,
          },
          productionManifest: manifestResult.manifest,
          chapters: shippedChapters,
        };
        const verification = verifyProductionPackage({
          packagePath,
          packageData: candidatePackage,
          compareLooseState: true,
        });
        if (!verification.ok) verificationFindings = verification.findings;
      }
    }
    const productionManifestBlockerCount = productionManifestFindings.length + verificationFindings.length;

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
    };

    // Step 5: Promote only if EVERY gate passes blocker-clean — deterministic
    // gates (per-chapter + intra-book + book), the QC-attestation gate, AND the
    // quiz answer-key judge gate.
    if (preManifestBlockerCount > 0 || productionManifestBlockerCount > 0 || !candidatePackage) {
      mkdirSync(QUARANTINE_DIR, { recursive: true });
      const quarantinePath = resolve(QUARANTINE_DIR, `${bookId}.${now().getTime()}.report.json`);
      writeFileAtomic(quarantinePath, JSON.stringify(fullReport, null, 2) + "\n");
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
        canonicalBlockerCount: 0,
        shipGateMajorCount: shipMajorCount,
        bookGateMajorCount: bookMajorCount,
        reason: `BLOCKED: ${shipBlockerCount} ship-gate blocker(s)${intraSummary} + ${bookBlockerCount} book-gate blocker(s)${qcSummary}${keyJudgeSummary}${sourceIntegritySummary}${sourceRealitySummary}${generationDebtSummary}${noApiSummary}${majorSummary}${manifestSummary}. Quarantined at ${quarantinePath}.`,
      };
    }

    // Step 6: Write the independently verified BookPackageV21 to the library.
    // The packageId is the manifest content ID, so timestamp metadata no longer
    // defines production identity. createdAt remains metadata and is preserved
    // from the prior package to keep unchanged re-promotes byte-stable. The lease
    // is held across construction, staging, verification, the final rename,
    // journal completion, and cleanup (requirement 13).
    publishPackageTransactionally({
      bookId,
      packagePath,
      candidatePackage,
      contentId: manifestContentId,
      options,
      lease,
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
      canonicalBlockerCount: 0,
      shipGateMajorCount: shipMajorCount,
      bookGateMajorCount: bookMajorCount,
      reason: `PROMOTED: ${loadedChapters.length} chapter(s) shipped to ${packagePath}. Source-reality: ${sourceReality.decision}. Major policy clean with ${majorPolicy.current.length} current major(s) waived or absent.`,
    };
  } finally {
    // Compare-by-owner-token release. A lease that lost the lock mid-flight (a
    // successor recovered it) is a no-op here, so we never delete a successor's
    // lock (requirement 9). Best-effort; never masks the in-flight error.
    const __r = releasePromotionLease(lease);
    console.error(`[REL] book=${bookId} tx=${txId} token=${lease.ownerToken.slice(0,6)} removed=${__r} stillOnDisk=${require("fs").existsSync(lease.lockPath)}`);
  }
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
    // chapter file, lease unavailable): promotion never reached the source-reality evaluation.
    sourceRealityBlockerCount: 0,
    sourceRealityDecision: "not-applicable",
    generationDebtBlockerCount: 0,
    generationDebtAdvisoryCount: 0,
    productionManifestBlockerCount: 0,
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
  lines.push(`  Book gate: ${r.bookGateBlockerCount} blockers, ${r.bookGateMajorCount} majors`);
  return lines.join("\n");
}
