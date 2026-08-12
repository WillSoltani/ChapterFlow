import type { BookContentReader, CandidateSnapshot } from "../books/candidateTypes.js";
import type { CandidateIdentity, Result } from "../contracts/v4Core.js";
import {
  buildExpectedProductionManifestForPackage,
  type BuildProductionManifestResult,
  type ProductionManifestVersion,
} from "../productionManifest.js";
import {
  buildLegacyReaderPackage,
  PRODUCTION_MANIFEST_SIDECAR_SCHEMA,
  type ProductionManifestSidecar,
} from "../promoteBook.js";
import { normSlug } from "../lib/chapterPaths.js";
import type { FingerprintRoots } from "../lib/pipelineFingerprint.js";
import { quarantineRefusalMessage, readQuarantineTombstone } from "../lib/quarantineTombstone.js";
import { verifyProductionPackage } from "../verifyProductionPackage.js";
import {
  createFileReleaseJournal,
  formatUnfinishedRelease,
  journalMatchesRelease,
  type ReleaseJournal,
  type ReleaseJournalRecord,
  type ReleaseJournalState,
  type ReleaseJournalWrite,
} from "./releaseJournal.js";
import type { PromotionService } from "./promotionTypes.js";
import type { BookPackageV21, ChapterV21 } from "../types.js";

export type CanonicalPackageMetadata = Readonly<{
  title: string;
  author: string;
  packageId: string;
  createdAt: string;
  contentOwner?: string;
  categories?: string[];
  tags?: string[];
}>;

export type CanonicalPackage = Readonly<{
  candidate: CandidateIdentity;
  package: BookPackageV21;
}>;

/** The release artifacts a candidate release publishes. `sidecar` is the
 *  state-side production manifest publish-final's preflight
 *  (verifyProductionPackage) loads next to the package — a package published
 *  WITHOUT it is unshippable (PPKG.sidecar_missing), so the writer must publish
 *  both or neither. */
export type CanonicalPackageWriter = (input: Readonly<{
  bookId: string;
  candidate: CandidateIdentity;
  package: BookPackageV21;
  sidecar: ProductionManifestSidecar;
}>) => void | Promise<void>;

/** Read-location seams for the production-manifest build. Production omits every
 *  field (the canonical state/runs roots and the real clock are the defaults);
 *  hermetic tests point the build at a disposable tree. */
export type CanonicalManifestOptions = Readonly<{
  stateRoot?: string;
  runsRoot?: string;
  recordPath?: string;
  exemptionsFile?: string;
  fingerprintRoots?: FingerprintRoots;
  env?: NodeJS.ProcessEnv;
  now?: Date;
}>;

export type CanonicalPackageAdapterOptions = Readonly<{
  contentReader: BookContentReader;
  promotionService: PromotionService;
  packageWriter: CanonicalPackageWriter;
  manifest?: CanonicalManifestOptions;
  /** The pipeline state root this release READS its quarantine tombstone from
   *  (`<stateRoot>/books/_quarantined/<bookId>.json`) and WRITES its release
   *  journal to (`<stateRoot>/books/_release-journal/<bookId>.json`).
   *
   *  Production omits it: the default is `manifest.stateRoot` when the manifest
   *  build has already been pointed at a disposable tree (so a hermetic test is
   *  hermetic in one move) and otherwise the canonical `<pipeline>/state` — the
   *  exact root `quarantine-book` writes to and promoteBook reads. */
  stateRoot?: string;
  /** Test seam: inject the release journal. Default is the file journal under
   *  the resolved state root. */
  journal?: ReleaseJournal;
  /** Test seam: deterministic transaction ids for journal records. */
  newTransactionId?: () => string;
}>;

export type CanonicalReleaseRequest = Readonly<{
  bookId: string;
  candidate: CandidateIdentity;
  reviewId: string;
  qcRoundId: string;
  expectedBookRevision: number;
  promotedAt: string;
  metadata: CanonicalPackageMetadata;
  /**
   * Opt-in recovery for the crash window between the pointer commit and the
   * package write.
   *
   * DEFAULT (absent/false) is unchanged and fail-closed: a CURRENT pointer that
   * already names this candidate at this revision NEVER licenses a package
   * write, whatever the journal says. Only an operator who has read the journal
   * record turns this on, and even then it publishes only when the journal
   * proves THIS release committed THIS candidate to THIS revision, the CURRENT
   * readback verifies content-addressed, and the pair passes the production
   * verifier — the same bar a first attempt has to clear, minus a second
   * revision.
   */
  resumeUnfinished?: boolean;
}>;

export type CanonicalReleaseResult = Readonly<{
  package: BookPackageV21;
  sidecar: ProductionManifestSidecar;
  bookRevision: number;
  readback: "VERIFIED";
}>;

export type CanonicalCurrentRelease = Readonly<{
  candidate: CandidateIdentity;
  bookRevision: number;
}>;

function failed<T>(code: string, message: string, retryable = false): Result<T> {
  return { ok: false, error: { code, message, retryable } };
}

function errorMessage(value: unknown): string {
  return value instanceof Error ? value.message : String(value);
}

function parseChapters(snapshot: CandidateSnapshot): Result<ChapterV21[]> {
  const chapters: ChapterV21[] = [];
  const chapterFiles = snapshot.files.filter((file) => file.kind === "CHAPTER");
  if (chapterFiles.length === 0) return failed("PACKAGE_CANDIDATE_INVALID", "candidate has no chapter artifacts");
  for (const file of chapterFiles) {
    let value: unknown;
    try {
      value = JSON.parse(Buffer.from(file.bytes).toString("utf8"));
    } catch (cause) {
      return failed("PACKAGE_CANDIDATE_INVALID", `${file.logicalPath} is not JSON: ${errorMessage(cause)}`);
    }
    if (
      value === null ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      (value as { schemaVersion?: unknown }).schemaVersion !== "chapterflow-v21-authored" ||
      typeof (value as { chapterId?: unknown }).chapterId !== "string" ||
      !Number.isSafeInteger((value as { number?: unknown }).number)
    ) {
      return failed("PACKAGE_CANDIDATE_INVALID", `${file.logicalPath} is not a v21 chapter`);
    }
    chapters.push(value as ChapterV21);
  }
  chapters.sort((left, right) => left.number - right.number);
  if (new Set(chapters.map((chapter) => chapter.chapterId)).size !== chapters.length) {
    return failed("PACKAGE_CANDIDATE_INVALID", "candidate contains duplicate chapter identities");
  }
  return { ok: true, value: chapters };
}

/** The package identity `verifyProductionPackage` (PPKG.package_id_shape) demands:
 *  `<normalised bookId>-v21-<epochMs>`. The package BODY always carries the
 *  normalised slug (buildLegacyReaderPackage normSlugs book.bookId), so a caller
 *  that derives the packageId from a RAW argv bookId ships a package whose id can
 *  never verify. Fail closed here, at release time, instead of at publish time. */
function checkPackageIdentity(bookId: string, metadata: CanonicalPackageMetadata): Result<null> {
  const slug = normSlug(bookId);
  if (!new RegExp(`^${slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-v21-\\d+$`).test(metadata.packageId)) {
    return failed(
      "PACKAGE_METADATA_INVALID",
      `packageId ${JSON.stringify(metadata.packageId)} must be "${slug}-v21-<epochMs>" (derived from the NORMALISED book id, which is what the package body and the production verifier carry)`,
    );
  }
  return { ok: true, value: null };
}

export async function assembleCanonicalPackage(input: Readonly<{
  bookId: string;
  candidate: CandidateIdentity;
  metadata: CanonicalPackageMetadata;
  contentReader: BookContentReader;
}>): Promise<Result<CanonicalPackage>> {
  const identity = checkPackageIdentity(input.bookId, input.metadata);
  if (!identity.ok) return identity;
  let opened;
  try {
    opened = await input.contentReader.open({
      bookId: input.bookId,
      selector: { kind: "CANDIDATE", candidateId: input.candidate.candidateId },
    });
  } catch (cause) {
    return failed("PACKAGE_CANDIDATE_UNAVAILABLE", `candidate read failed: ${errorMessage(cause)}`);
  }
  if (!opened.ok) return failed(opened.error.code, opened.error.message, opened.error.retryable);
  if (
    opened.value.manifest.bookId !== input.bookId ||
    opened.value.manifest.candidateId !== input.candidate.candidateId ||
    opened.value.manifest.manifestDigest !== input.candidate.manifestDigest ||
    opened.value.currentRevision !== undefined
  ) {
    return failed("PACKAGE_CANDIDATE_MISMATCH", "explicit candidate read returned different identity or CURRENT state");
  }
  const chapters = parseChapters(opened.value);
  if (!chapters.ok) return chapters;
  return {
    ok: true,
    value: {
      candidate: { ...input.candidate },
      package: buildLegacyReaderPackage({
        bookId: input.bookId,
        ...input.metadata,
        chapters: chapters.value,
      }),
    },
  };
}

/** Real V4 release route. Assembly is read-only; package write follows verified CAS/readback. */
export class CanonicalPackageAdapter {
  readonly #options: CanonicalPackageAdapterOptions;
  readonly #stateRoot: string | undefined;
  readonly #journal: ReleaseJournal;
  readonly #newTransactionId: () => string;

  constructor(options: CanonicalPackageAdapterOptions) {
    this.#options = options;
    this.#stateRoot = options.stateRoot ?? options.manifest?.stateRoot;
    this.#journal = options.journal ??
      createFileReleaseJournal(this.#stateRoot === undefined ? {} : { stateRoot: this.#stateRoot });
    this.#newTransactionId = options.newTransactionId ??
      (() => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);
  }

  async readCurrent(bookId: string): Promise<Result<CanonicalCurrentRelease | null>> {
    let opened;
    try {
      opened = await this.#options.contentReader.open({ bookId, selector: { kind: "CURRENT" } });
    } catch (cause) {
      return failed("CURRENT_UNAVAILABLE", `CURRENT read failed: ${errorMessage(cause)}`);
    }
    if (!opened.ok) {
      return opened.error.code === "CURRENT_NOT_SET"
        ? { ok: true, value: null }
        : failed("CURRENT_UNAVAILABLE", opened.error.message, opened.error.retryable);
    }
    if (!Number.isSafeInteger(opened.value.currentRevision) || (opened.value.currentRevision ?? 0) < 1) {
      return failed("CURRENT_UNAVAILABLE", "CURRENT read returned no valid revision");
    }
    return {
      ok: true,
      value: {
        candidate: {
          candidateId: opened.value.manifest.candidateId,
          manifestDigest: opened.value.manifest.manifestDigest,
        },
        bookRevision: opened.value.currentRevision as number,
      },
    };
  }

  async release(request: CanonicalReleaseRequest): Promise<Result<CanonicalReleaseResult>> {
    // ── Step 0: QUARANTINE TOMBSTONE ───────────────────────────────────────
    // `quarantine-book <bookId>` moves the shipped package aside AND writes
    // state/books/_quarantined/<bookId>.json, promising in its own output that
    // "promote-book and register-web now REFUSE this book". The legacy promoter
    // honours that record as its Step 0; this route did not, so a book an
    // operator had explicitly pulled could be released again — with a fresh
    // pointer revision and a freshly published reader package — while the
    // tombstone sat on disk. Shared reader, shared refusal, so the two promoters
    // cannot drift. Fail-closed BEFORE any read, any CAS and any write.
    let tombstone;
    try {
      tombstone = readQuarantineTombstone(request.bookId, this.#stateRoot);
    } catch (cause) {
      // A tombstone lookup that cannot complete is not proof of absence.
      return failed("BOOK_QUARANTINED", `quarantine tombstone lookup failed for ${request.bookId}: ${errorMessage(cause)}`);
    }
    if (tombstone) {
      return failed("BOOK_QUARANTINED", quarantineRefusalMessage(request.bookId, tombstone));
    }

    const assembled = await assembleCanonicalPackage({
      bookId: request.bookId,
      candidate: request.candidate,
      metadata: request.metadata,
      contentReader: this.#options.contentReader,
    });
    if (!assembled.ok) return assembled;

    // ── Step 0.5: JOURNAL THE INTENT, BEFORE THE POINTER CAS ───────────────
    // Everything from here to the package write is the window the promotion
    // audit named: the pointer can commit and the artifacts can fail to land,
    // and before this record existed nothing on disk said so.
    const targetBookRevision = request.expectedBookRevision + 1;
    const releaseIdentity = {
      bookId: request.bookId,
      candidateId: request.candidate.candidateId,
      manifestDigest: request.candidate.manifestDigest,
      targetBookRevision,
    };
    let priorRecord: ReleaseJournalRecord | null;
    try {
      // Records for OTHER candidates/revisions are left exactly where they are:
      // they belong to other transactions (a concurrent racer, or a crash whose
      // evidence must survive), and one release never speaks for another.
      const filed = this.#journal.list(request.bookId)
        .filter((record) => journalMatchesRelease(record, releaseIdentity));
      priorRecord = filed.length === 0 ? null : filed[filed.length - 1];
    } catch (cause) {
      // A record under this book's journal directory that cannot be parsed may
      // describe a committed pointer with no package. Not being able to rule
      // that out is the strongest reason to stop, not the weakest.
      return failed("RELEASE_UNFINISHED", errorMessage(cause));
    }
    const txId = priorRecord?.txId ?? this.#newTransactionId();
    let journalPath: string;
    try {
      journalPath = this.#journal.pathFor(request.bookId, txId);
    } catch (cause) {
      return failed("RELEASE_JOURNAL_UNAVAILABLE", `release journal path is unusable: ${errorMessage(cause)}`);
    }
    const entry: Omit<ReleaseJournalWrite, "state" | "detail"> = {
      bookId: request.bookId,
      txId,
      candidateId: request.candidate.candidateId,
      manifestDigest: request.candidate.manifestDigest,
      reviewId: request.reviewId,
      qcRoundId: request.qcRoundId,
      expectedBookRevision: request.expectedBookRevision,
      targetBookRevision,
      promotedAt: request.promotedAt,
      packageId: assembled.value.package.packageId,
    };
    const journal = (state: ReleaseJournalState, detail?: string): void => {
      this.#journal.write({ ...entry, state, ...(detail === undefined ? {} : { detail }) });
    };
    /** Best-effort annotation on a path that is already returning a failure —
     *  it must never replace the failure the caller actually needs to see. */
    const annotate = (state: ReleaseJournalState, detail: string): void => {
      try { journal(state, detail); } catch { /* the returned error is the signal */ }
    };
    /** Remove a record this call created that turned out to describe nothing.
     *  A record from a PRIOR attempt is evidence and is never removed here, and
     *  no other transaction's record is ever touched. */
    const discardOwnRecord = (): void => {
      if (priorRecord !== null) return;
      try { this.#journal.clear(request.bookId, txId); } catch { /* debris is inert */ }
    };
    if (priorRecord === null) {
      try {
        journal("pointer-pending");
      } catch (cause) {
        // Intent that cannot be recorded must not be acted on: committing a
        // pointer we could not journal recreates exactly the undiagnosable
        // window this record exists to close.
        return failed(
          "RELEASE_JOURNAL_UNAVAILABLE",
          `release intent could not be journalled at ${journalPath}, so nothing was committed and nothing was published: ${errorMessage(cause)}`,
        );
      }
    }

    const promoted = await this.#options.promotionService.promote({
      bookId: request.bookId,
      candidate: request.candidate,
      reviewId: request.reviewId,
      qcRoundId: request.qcRoundId,
      expectedBookRevision: request.expectedBookRevision,
      promotedAt: request.promotedAt,
    });
    let bookRevision: number;
    if (promoted.ok) {
      bookRevision = promoted.value.bookRevision;
      try {
        journal("pointer-committed");
      } catch (cause) {
        return failed(
          "RECONCILIATION_REQUIRED",
          `pointer committed at revision ${bookRevision} but the release journal could not be updated; nothing published: ${errorMessage(cause)}`,
        );
      }
    } else if (promoted.error.code === "REVISION_CONFLICT") {
      const current = await this.readCurrent(request.bookId);
      const currentIsThisRelease = current.ok &&
        current.value !== null &&
        current.value.bookRevision === targetBookRevision &&
        current.value.candidate.candidateId === request.candidate.candidateId &&
        current.value.candidate.manifestDigest === request.candidate.manifestDigest;
      if (!currentIsThisRelease) {
        // The CAS provably did not land for us — another revision owns CURRENT.
        // A record from a PRIOR attempt is left byte-identical: a refused retry
        // must not overwrite the crash cause the record was written to preserve.
        discardOwnRecord();
        return promoted;
      }
      if (priorRecord === null) {
        // CURRENT already names this candidate at this revision, and NOTHING on
        // disk says this process (or any journalled one) put it there. Unchanged
        // fail-closed behaviour: a pointer of unknown provenance never licenses
        // a package write.
        discardOwnRecord();
        return failed(
          "RECONCILIATION_REQUIRED",
          "CURRENT names this candidate, but prior release intent cannot be proven; package write suppressed",
        );
      }
      if (request.resumeUnfinished !== true) {
        // The journal PROVES the intent — but proving it is not the same as
        // being told to act on it. The default stays exactly as fail-closed as
        // it was; the only thing that changed is that the refusal can now say
        // where the evidence is and what would finish it. The record itself is
        // NOT rewritten: a read-only refusal must not overwrite the crash cause.
        return failed(
          "RECONCILIATION_REQUIRED",
          "CURRENT names this candidate, but prior release intent cannot be proven; package write suppressed. " +
            `${formatUnfinishedRelease(priorRecord, journalPath)}. ` +
            "Re-run this release with resumeUnfinished (CLI: --resume-unfinished-release) to finish it from that record.",
        );
      }
      // RECOVERY, explicitly requested. The journal proves this exact release
      // committed this exact candidate to this exact revision, and the CURRENT
      // read above is a full content-addressed verification (bookContentReader
      // recomputes the manifest digest and compares it to BOTH the stored
      // manifest and the pointer). The remaining work — build the sidecar,
      // verify the pair, write both artifacts — is exactly what a first attempt
      // would still have to do, at the same bar, so resuming it advances no
      // revision and skips no gate.
      bookRevision = targetBookRevision;
      try {
        journal("pointer-committed", `resumed from ${priorRecord.state} after a verified CURRENT readback`);
      } catch (cause) {
        return failed(
          "RECONCILIATION_REQUIRED",
          `release resume could not update the journal at ${journalPath}; nothing published: ${errorMessage(cause)}`,
        );
      }
    } else {
      // Every other promotion failure is pre-commit by construction (candidate,
      // review, QC and request validation all run before the CAS), except
      // RECONCILIATION_REQUIRED — whose whole meaning is "the commit outcome is
      // uncertain", so its record must survive.
      if (promoted.error.code === "RECONCILIATION_REQUIRED") {
        // Keep whatever state a prior attempt had already proven — an uncertain
        // commit must never regress a `package-pending` record to
        // `pointer-pending` and make an inspector think less had happened.
        annotate(priorRecord?.state ?? "pointer-pending", `promotion returned an uncertain commit: ${promoted.error.message}`);
      } else {
        discardOwnRecord();
      }
      return promoted;
    }
    // The production-manifest SIDECAR is built here, from the very package that
    // is about to be written, so the two can never disagree by construction:
    // packageId/createdAt/bookId are copied off the assembled package, and the
    // manifest payload is the same canonical build publish-final's verifier
    // recomputes from state. Without it a v25-released book is unshippable —
    // verifyProductionPackage fails PPKG.sidecar_missing and publish-final's
    // preflight refuses to copy anything.
    //
    // It runs AFTER the pointer commit for two reasons: the candidate-bound
    // assembly above must stay free of ambient-state reads (a candidate-only
    // release never touches state/indexes to build its package), and a manifest
    // that cannot be built must leave production untouched. An unbuildable
    // manifest therefore lands in the SAME recoverable state a failed package
    // write does — pointer committed, nothing published, RECONCILIATION_REQUIRED
    // — never a package on disk with no manifest behind it.
    const built = buildCanonicalPackageManifest({
      package: assembled.value.package,
      ...this.#options.manifest,
    });
    if (!built.ok) {
      const message = `production manifest unbuildable after pointer commit; nothing published: ${built.findings
        .map((finding) => `${finding.checkId}${finding.chapterNumber ? ` (ch${finding.chapterNumber})` : ""}: ${finding.message}`)
        .join("; ")}`;
      annotate("pointer-committed", message);
      return failed("RECONCILIATION_REQUIRED", message);
    }
    const sidecar: ProductionManifestSidecar = {
      schemaVersion: PRODUCTION_MANIFEST_SIDECAR_SCHEMA,
      bookId: assembled.value.package.book.bookId,
      packageId: assembled.value.package.packageId,
      createdAt: assembled.value.package.createdAt,
      manifest: built.manifest,
    };
    // RELEASE-TIME SELF-VERIFY — the same call promoteBook makes on its candidate
    // pair before it declares success (promoteBook.ts: verifyProductionPackage
    // with packageData + manifestData + compareLooseState). Building the sidecar
    // is not proof it is shippable: the manifest builder hashes the PACKAGE
    // chapters, so it cannot see a package whose reader content has drifted from
    // the loose state chapters — and register-web refuses to register exactly
    // that pair (it verifies with compareLooseState: true). Verifying the
    // in-memory pair here means a release can never report success on a pair a
    // later publish step would reject.
    //
    // Fail-closed AFTER the pointer commit lands in the same recoverable state an
    // unbuildable manifest or a failed package write does: pointer committed,
    // NOTHING published, RECONCILIATION_REQUIRED.
    const verification = verifyProductionPackage({
      packageData: assembled.value.package,
      manifestData: sidecar,
      compareLooseState: true,
      stateRoot: this.#options.manifest?.stateRoot,
      runsRoot: this.#options.manifest?.runsRoot,
      recordPath: this.#options.manifest?.recordPath,
      exemptionsFile: this.#options.manifest?.exemptionsFile,
      fingerprintRoots: this.#options.manifest?.fingerprintRoots,
      env: this.#options.manifest?.env,
      now: this.#options.manifest?.now,
    });
    if (!verification.ok) {
      const message = `released pair fails production verification after pointer commit; nothing published: ${verification.findings
        .map((finding) => `${finding.checkId}${finding.chapterNumber ? ` (ch${finding.chapterNumber})` : ""}: ${finding.message}`)
        .join("; ")}`;
      annotate("pointer-committed", message);
      return failed("RECONCILIATION_REQUIRED", message);
    }
    // The pair is proven shippable and the writer is about to run — the last
    // journalled state before the artifacts exist, so an inspector can tell
    // "never got as far as writing" from "was writing when it died".
    try {
      journal("package-pending");
    } catch (cause) {
      return failed(
        "RECONCILIATION_REQUIRED",
        `release journal could not record the package write at ${journalPath}; nothing published: ${errorMessage(cause)}`,
      );
    }
    try {
      await this.#options.packageWriter({
        bookId: request.bookId,
        candidate: { ...request.candidate },
        package: assembled.value.package,
        sidecar,
      });
    } catch (cause) {
      const message = `package write failed after pointer commit: ${errorMessage(cause)}`;
      annotate("package-pending", message);
      return failed("RECONCILIATION_REQUIRED", message);
    }
    // Both artifacts are live. Record that, then clear — a clean tree carries no
    // journals at all, and a surviving `published` record means only that the
    // clear was lost, never that anything is missing.
    annotate("published", "artifacts written");
    try { this.#journal.clear(request.bookId, txId); } catch { /* published; debris is inert */ }
    return {
      ok: true,
      value: {
        package: assembled.value.package,
        sidecar,
        bookRevision,
        readback: "VERIFIED",
      },
    };
  }
}

/** Real production-manifest builder used by legacy/V4 parity proof. */
export function buildCanonicalPackageManifest(args: Readonly<CanonicalManifestOptions & {
  package: BookPackageV21;
  manifestVersion?: ProductionManifestVersion;
}>): BuildProductionManifestResult {
  return buildExpectedProductionManifestForPackage({
    pkg: args.package,
    stateRoot: args.stateRoot,
    runsRoot: args.runsRoot,
    recordPath: args.recordPath,
    exemptionsFile: args.exemptionsFile,
    fingerprintRoots: args.fingerprintRoots,
    manifestVersion: args.manifestVersion,
    env: args.env,
    now: args.now,
  });
}
