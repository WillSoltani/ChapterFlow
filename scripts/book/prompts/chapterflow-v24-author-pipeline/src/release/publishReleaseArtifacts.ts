import { copyFileSync, existsSync, mkdirSync, renameSync, rmSync } from "fs";
import { dirname } from "path";

import { writeFileAtomic } from "../lib/atomicWrite.js";
import type { ProductionManifestSidecar } from "../promoteBook.js";
import type { BookPackageV21 } from "../types.js";
import {
  verifyProductionPackage,
  type VerifyProductionPackageOptions,
  type VerifyProductionPackageResult,
} from "../verifyProductionPackage.js";

/** Read-location overrides handed to the staged-pair verification. Production
 *  omits them (canonical state/runs roots, real clock); tests point the verify at
 *  a disposable tree. `packagePath`/`packageData`/`manifestPath`/`manifestData`/
 *  `compareLooseState` are owned by this module and cannot be overridden — the
 *  staged pair IS what gets verified, always against loose state. */
export type ReleaseVerifyOptions = Omit<
  VerifyProductionPackageOptions,
  "packagePath" | "packageData" | "manifestPath" | "manifestData" | "compareLooseState"
>;

export type PublishReleaseArtifactsSeams = Readonly<{
  /** Override the verifier (tests only). Default: verifyProductionPackage. */
  verify?: (options: VerifyProductionPackageOptions) => VerifyProductionPackageResult;
  /** Fires after the sidecar rename and before the package rename — the ONLY
   *  window in which the two published files can disagree. Tests use it to prove
   *  the rollback; nothing in production sets it. */
  onBeforePackageRename?: () => void;
}>;

export type PublishReleaseArtifactsInput = Readonly<{
  packagePath: string;
  sidecarPath: string;
  package: BookPackageV21;
  sidecar: ProductionManifestSidecar;
  verifyOptions?: ReleaseVerifyOptions;
  seams?: PublishReleaseArtifactsSeams;
}>;

function stagedPath(target: string): string {
  return `${target}.release-staging`;
}

function backupPath(target: string): string {
  return `${target}.pre-release-backup`;
}

/**
 * Publish the reader package and its production-manifest sidecar as ONE
 * transaction, the way `promoteBook.publishPackageTransactionally` does:
 *
 *   1. STAGE both artifacts beside their destinations (same directory, so the
 *      final moves are same-filesystem renames).
 *   2. VERIFY the staged PAIR with the production verifier, at the STRICTEST bar
 *      any consumer applies (compareLooseState: true — promoteBook's own staged
 *      verify and register-web's gate; publish-final's preflight is the same
 *      verifier without that flag). A pair that cannot verify is never published.
 *   3. PUBLISH with two adjacent renames, sidecar first (a package visible
 *      without its manifest is the silently-unshippable state).
 *
 * The property this buys, which two independent `writeFileAtomic` calls do not:
 * a re-release that FAILS — at staging, at verification, or on the package
 * rename — leaves the previously shipped package AND its sidecar byte-identical.
 * The prior sidecar is copied aside before the first rename and restored if the
 * package rename throws, so the observable failure modes never downgrade a book
 * that was already shippable.
 *
 * Residual window: a process KILL between the two renames (no code runs, so no
 * rollback). That leaves the new sidecar beside the stale package — a pair the
 * verifier REFUSES (PPKG.package_id_sidecar_mismatch: the re-release stamps a
 * fresh `<bookId>-v21-<epochMs>`), never one it ships wrongly. The prior sidecar
 * is still on disk at `<sidecarPath>.pre-release-backup` for recovery.
 *
 * Throws on any failure; the caller (the release adapter's packageWriter seam)
 * turns that into RECONCILIATION_REQUIRED.
 */
export function publishReleaseArtifacts(input: PublishReleaseArtifactsInput): void {
  const verify = input.seams?.verify ?? verifyProductionPackage;
  const stagedSidecar = stagedPath(input.sidecarPath);
  const stagedPackage = stagedPath(input.packagePath);
  const priorSidecarBackup = backupPath(input.sidecarPath);

  const discardStaging = (): void => {
    // Best-effort: staging debris must never mask the failure that caused it.
    try { rmSync(stagedSidecar, { force: true }); } catch { /* debris is inert */ }
    try { rmSync(stagedPackage, { force: true }); } catch { /* debris is inert */ }
  };

  mkdirSync(dirname(input.sidecarPath), { recursive: true });
  mkdirSync(dirname(input.packagePath), { recursive: true });
  try {
    writeFileAtomic(stagedSidecar, `${JSON.stringify(input.sidecar, null, 2)}\n`);
    writeFileAtomic(stagedPackage, `${JSON.stringify(input.package, null, 2)}\n`);
  } catch (cause) {
    discardStaging();
    throw cause;
  }

  let verification: VerifyProductionPackageResult;
  try {
    verification = verify({
      ...input.verifyOptions,
      packagePath: stagedPackage,
      manifestPath: stagedSidecar,
      compareLooseState: true,
    });
  } catch (cause) {
    discardStaging();
    throw cause;
  }
  if (!verification.ok) {
    discardStaging();
    throw new Error(
      `staged release pair failed production verification; nothing published: ${verification.findings
        .map((finding) => `${finding.checkId}: ${finding.message}`)
        .join("; ")}`,
    );
  }

  // The prior sidecar is the only artifact the first rename can destroy. Copy it
  // aside so an ordinary failure of the second rename restores it exactly.
  // A backup that cannot be taken means the first rename would be irreversible,
  // so refuse before touching anything.
  const hadPriorSidecar = existsSync(input.sidecarPath);
  try {
    if (hadPriorSidecar) copyFileSync(input.sidecarPath, priorSidecarBackup);
  } catch (cause) {
    discardStaging();
    throw cause;
  }

  try {
    renameSync(stagedSidecar, input.sidecarPath);
  } catch (cause) {
    // Nothing was replaced yet — the prior pair is untouched.
    try { rmSync(priorSidecarBackup, { force: true }); } catch { /* debris is inert */ }
    discardStaging();
    throw cause;
  }
  try {
    input.seams?.onBeforePackageRename?.();
    renameSync(stagedPackage, input.packagePath);
  } catch (cause) {
    // Roll the sidecar back to exactly what the shipped package was published
    // with. A failed re-release must never leave a shipped book worse off.
    try {
      if (hadPriorSidecar) renameSync(priorSidecarBackup, input.sidecarPath);
      else rmSync(input.sidecarPath, { force: true });
    } catch (rollbackCause) {
      // The rollback is the last line of defence. If it fails the book IS left
      // in the refused state, so say so loudly and name the recovery file rather
      // than letting the original error imply nothing changed.
      discardStaging();
      throw new Error(
        `package publish failed (${cause instanceof Error ? cause.message : String(cause)}) AND the sidecar rollback failed ` +
          `(${rollbackCause instanceof Error ? rollbackCause.message : String(rollbackCause)}). ` +
          `${input.sidecarPath} now describes an unpublished package; restore it from ${priorSidecarBackup} before shipping this book.`,
      );
    }
    discardStaging();
    throw cause;
  }
  // Both artifacts are live. Losing the backup sweep must never turn a completed
  // publish into a reported failure — the worst case is a stale backup file.
  try { rmSync(priorSidecarBackup, { force: true }); } catch { /* published; debris is harmless */ }
}
