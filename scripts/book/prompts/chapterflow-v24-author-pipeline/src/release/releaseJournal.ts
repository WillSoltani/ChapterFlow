/**
 * The v25 release journal — the durable record of a release IN FLIGHT.
 *
 * The release route commits the CURRENT pointer first and writes the reader
 * package + production-manifest sidecar second. Between those two steps there is
 * a window in which the book has a new revision and no artifacts. Before this
 * journal existed, a crash in that window left NOTHING on disk that named the
 * candidate, the revision, or the intent — so the state was not diagnosable by
 * inspection, and a retry hit the fail-closed dead end
 *
 *     RECONCILIATION_REQUIRED: CURRENT names this candidate, but prior release
 *     intent cannot be proven; package write suppressed
 *
 * with no way to ever prove that intent.
 *
 * Discipline copied from the sibling stores:
 *  - promoteBook's `publishPackageTransactionally` journals every transition
 *    (started → staged → verified → published → complete) into
 *    `state/books/_transactions/<bookId>.<txId>/journal.json`, stamps the owning
 *    pid/hostname, and removes the directory only on completion.
 *  - evidenceStore appends state transitions to an append-only journal.jsonl.
 *  - fileRunStore folds an attempt journal to recover a crashed run.
 *
 * Layout, and why it is ONE FILE PER TRANSACTION rather than one per book:
 *
 *     state/books/_release-journal/<bookId>/<txId>.json
 *
 * Releases of the same book DO run concurrently — two racers for the same
 * expected revision are a supported, tested case, and exactly one of them wins
 * the pointer CAS. A single shared file per book would have them overwrite and
 * delete each other's records, and any "there is already a record here" rule
 * would turn that ordinary race into a blocking error. Giving every transaction
 * its own file means no writer ever touches another's record: the loser removes
 * only its own, and a crashed release's record cannot be buried by the next
 * release of a different candidate.
 *
 * Diagnosis is therefore "list `state/books/_release-journal/<bookId>/`": each
 * surviving record names its candidate, the revision it was committing to, the
 * state it stopped in, the owning pid/host, and the error the route returned.
 * A record is removed when its own release completes (or provably never
 * committed), so a clean tree carries no journals at all.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from "fs";
import { hostname as osHostname } from "os";
import { resolve } from "path";

import { writeFileAtomic } from "../lib/atomicWrite.js";
import { CANONICAL_PIPELINE_STATE_ROOT } from "../lib/quarantineTombstone.js";

export const RELEASE_JOURNAL_SCHEMA = "v25-release-journal-v1" as const;

/**
 * Where a release stopped. The ONLY state that can be reached with the pointer
 * un-committed is `pointer-pending`; every later state proves the CAS landed and
 * the post-commit readback verified.
 */
export type ReleaseJournalState =
  /** Intent recorded. The pointer CAS has been attempted; its outcome is not yet
   *  known to the journal (a crash here may or may not have committed). */
  | "pointer-pending"
  /** The CAS committed AND the post-commit CURRENT readback verified. Nothing is
   *  published yet — this is the window the audit named. */
  | "pointer-committed"
  /** The sidecar was built and the in-memory pair passed the production
   *  verifier. The package writer is about to run. */
  | "package-pending"
  /** The writer returned. Both artifacts are live; the journal is about to be
   *  cleared. A surviving `published` record means only that the clear was lost. */
  | "published";

export type ReleaseJournalRecord = Readonly<{
  schemaVersion: typeof RELEASE_JOURNAL_SCHEMA;
  bookId: string;
  txId: string;
  state: ReleaseJournalState;
  candidateId: string;
  manifestDigest: string;
  reviewId: string;
  qcRoundId: string;
  expectedBookRevision: number;
  /** The revision this release is committing TO (expectedBookRevision + 1). */
  targetBookRevision: number;
  promotedAt: string;
  /** The packageId of the assembled package. A resumed release re-assembles and
   *  mints a fresh id, so this is evidence, not a constraint. */
  packageId: string;
  pid: number;
  hostname: string;
  updatedAt: string;
  /** The failure the route returned, when it returned one. */
  detail?: string;
}>;

export type ReleaseJournalWrite = Omit<
  ReleaseJournalRecord,
  "schemaVersion" | "pid" | "hostname" | "updatedAt"
> & Readonly<{ detail?: string }>;

/** The durable record the release route writes. Every method is fail-loud: a
 *  journal that cannot be written must stop the release BEFORE it commits, which
 *  is only possible if the failure is visible. */
export interface ReleaseJournal {
  /** Every record filed for this book, oldest `updatedAt` first (txId breaks
   *  ties). Throws ReleaseJournalFault if a file under this book's journal
   *  directory cannot be parsed — a record that might describe a committed,
   *  unpublished revision of THIS book must never be read as "nothing here". */
  list(bookId: string): ReleaseJournalRecord[];
  write(record: ReleaseJournalWrite): void;
  /** Remove one transaction's record. A release only ever clears its OWN txId. */
  clear(bookId: string, txId: string): void;
  /** Where one transaction's record lives — quoted in refusals so an operator
   *  can go and read it. */
  pathFor(bookId: string, txId: string): string;
  /** The directory holding every record for this book — what to `ls` first. */
  dirFor(bookId: string): string;
}

export type FileReleaseJournalOptions = Readonly<{
  /** Pipeline state root. Production omits it (canonical `<pipeline>/state`);
   *  hermetic tests point it at a disposable tree. */
  stateRoot?: string;
  now?: () => Date;
  hostname?: string;
  pid?: number;
}>;

function journalRoot(stateRoot: string): string {
  return resolve(stateRoot, "books", "_release-journal");
}

function isSafePathSegment(value: unknown): value is string {
  return typeof value === "string" &&
    value.length > 0 &&
    value !== "." &&
    value !== ".." &&
    !value.includes("/") &&
    !value.includes("\\") &&
    !value.includes("\0") &&
    ![...value].some((character) => {
      const code = character.charCodeAt(0);
      return code < 0x20 || code === 0x7f;
    });
}

const STATES: readonly ReleaseJournalState[] = [
  "pointer-pending",
  "pointer-committed",
  "package-pending",
  "published",
];

/** Parse a record fail-closed. An unparseable journal is NOT treated as "no
 *  journal" — the caller is told the file is there and unreadable, because a
 *  corrupt in-flight record is the strongest reason to stop, not the weakest. */
export function parseReleaseJournalRecord(value: unknown, bookId: string): ReleaseJournalRecord | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (
    record.schemaVersion !== RELEASE_JOURNAL_SCHEMA ||
    record.bookId !== bookId ||
    typeof record.txId !== "string" || record.txId.length === 0 ||
    typeof record.state !== "string" || !STATES.includes(record.state as ReleaseJournalState) ||
    typeof record.candidateId !== "string" || record.candidateId.length === 0 ||
    typeof record.manifestDigest !== "string" || !/^[a-f0-9]{64}$/.test(record.manifestDigest) ||
    typeof record.reviewId !== "string" ||
    typeof record.qcRoundId !== "string" ||
    !Number.isSafeInteger(record.expectedBookRevision) ||
    !Number.isSafeInteger(record.targetBookRevision) ||
    typeof record.promotedAt !== "string" ||
    typeof record.packageId !== "string" ||
    !Number.isSafeInteger(record.pid) ||
    typeof record.hostname !== "string" ||
    typeof record.updatedAt !== "string" ||
    (record.detail !== undefined && typeof record.detail !== "string")
  ) {
    return null;
  }
  return {
    schemaVersion: RELEASE_JOURNAL_SCHEMA,
    bookId,
    txId: record.txId,
    state: record.state as ReleaseJournalState,
    candidateId: record.candidateId,
    manifestDigest: record.manifestDigest,
    reviewId: record.reviewId,
    qcRoundId: record.qcRoundId,
    expectedBookRevision: record.expectedBookRevision as number,
    targetBookRevision: record.targetBookRevision as number,
    promotedAt: record.promotedAt,
    packageId: record.packageId,
    pid: record.pid as number,
    hostname: record.hostname,
    updatedAt: record.updatedAt,
    ...(record.detail === undefined ? {} : { detail: record.detail as string }),
  };
}

export class ReleaseJournalFault extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReleaseJournalFault";
  }
}

class FileReleaseJournal implements ReleaseJournal {
  readonly #stateRoot: string;
  readonly #now: () => Date;
  readonly #hostname: string;
  readonly #pid: number;

  constructor(options: FileReleaseJournalOptions) {
    this.#stateRoot = options.stateRoot ?? CANONICAL_PIPELINE_STATE_ROOT;
    this.#now = options.now ?? (() => new Date());
    this.#hostname = options.hostname ?? osHostname();
    this.#pid = options.pid ?? process.pid;
  }

  dirFor(bookId: string): string {
    if (!isSafePathSegment(bookId)) {
      throw new ReleaseJournalFault(`bookId must be one safe opaque path segment: ${JSON.stringify(bookId)}`);
    }
    return resolve(journalRoot(this.#stateRoot), bookId);
  }

  pathFor(bookId: string, txId: string): string {
    if (!isSafePathSegment(txId)) {
      throw new ReleaseJournalFault(`txId must be one safe opaque path segment: ${JSON.stringify(txId)}`);
    }
    return resolve(this.dirFor(bookId), `${txId}.json`);
  }

  list(bookId: string): ReleaseJournalRecord[] {
    const directory = this.dirFor(bookId);
    if (!existsSync(directory)) return [];
    let names: string[];
    try {
      names = readdirSync(directory).filter((name) => name.endsWith(".json")).sort();
    } catch (cause) {
      throw new ReleaseJournalFault(
        `release journal directory ${directory} cannot be listed (${(cause as Error).message}); ` +
          `an unfinished release of ${bookId} cannot be ruled out, so it is not releasable until this is resolved`,
      );
    }
    const records: ReleaseJournalRecord[] = [];
    for (const name of names) {
      const path = resolve(directory, name);
      let parsed: unknown;
      try {
        parsed = JSON.parse(readFileSync(path, "utf8"));
      } catch (cause) {
        throw new ReleaseJournalFault(
          `release journal record ${path} exists but is unreadable (${(cause as Error).message}); ` +
            `it may describe a committed but unpublished revision of ${bookId}, so this book is not releasable until it is resolved`,
        );
      }
      const record = parseReleaseJournalRecord(parsed, bookId);
      if (!record) {
        throw new ReleaseJournalFault(
          `release journal record ${path} exists but does not match ${RELEASE_JOURNAL_SCHEMA}; ` +
            `it may describe a committed but unpublished revision of ${bookId}, so this book is not releasable until it is resolved`,
        );
      }
      records.push(record);
    }
    return records.sort((left, right) =>
      left.updatedAt === right.updatedAt
        ? left.txId.localeCompare(right.txId)
        : left.updatedAt.localeCompare(right.updatedAt));
  }

  write(record: ReleaseJournalWrite): void {
    const path = this.pathFor(record.bookId, record.txId);
    const full: ReleaseJournalRecord = {
      schemaVersion: RELEASE_JOURNAL_SCHEMA,
      bookId: record.bookId,
      txId: record.txId,
      state: record.state,
      candidateId: record.candidateId,
      manifestDigest: record.manifestDigest,
      reviewId: record.reviewId,
      qcRoundId: record.qcRoundId,
      expectedBookRevision: record.expectedBookRevision,
      targetBookRevision: record.targetBookRevision,
      promotedAt: record.promotedAt,
      packageId: record.packageId,
      pid: this.#pid,
      hostname: this.#hostname,
      updatedAt: this.#now().toISOString(),
      ...(record.detail === undefined ? {} : { detail: record.detail }),
    };
    mkdirSync(this.dirFor(record.bookId), { recursive: true });
    writeFileAtomic(path, `${JSON.stringify(full, null, 2)}\n`);
  }

  clear(bookId: string, txId: string): void {
    rmSync(this.pathFor(bookId, txId), { force: true });
  }
}

/** A journal that records nothing, for the candidate-only release path which has
 *  no state root to write under. Chosen over defaulting to the production root:
 *  that default made a hermetic release mutate real production state. list()
 *  returning empty means "no prior attempt to resume", which is exactly true. */
export function createNullReleaseJournal(): ReleaseJournal {
  return {
    list: () => [],
    dirFor: (bookId: string) => `<unjournalled:${bookId}>`,
    pathFor: (bookId: string, txId: string) => `<unjournalled:${bookId}:${txId}>`,
    write: () => {},
    clear: () => {},
  };
}

export function createFileReleaseJournal(options: FileReleaseJournalOptions = {}): ReleaseJournal {
  return new FileReleaseJournal(options);
}

/** Does `record` describe THIS release — same candidate, same checksum, same
 *  target revision? Identity only; it is never on its own a licence to publish
 *  (the route additionally requires CURRENT to verifiably name that candidate at
 *  that revision, and the pair to pass the production verifier). */
export function journalMatchesRelease(
  record: ReleaseJournalRecord,
  release: Readonly<{ bookId: string; candidateId: string; manifestDigest: string; targetBookRevision: number }>,
): boolean {
  return record.bookId === release.bookId &&
    record.candidateId === release.candidateId &&
    record.manifestDigest === release.manifestDigest &&
    record.targetBookRevision === release.targetBookRevision;
}

/** One line an operator can act on, for a journal that blocks a release. */
export function formatUnfinishedRelease(record: ReleaseJournalRecord, path: string): string {
  return `an unfinished v25 release is journalled at ${path} ` +
    `(state=${record.state}, candidate=${record.candidateId}, revision ${record.expectedBookRevision}->${record.targetBookRevision}, ` +
    `txId=${record.txId}, owner=${record.hostname}:${record.pid}, updatedAt=${record.updatedAt}` +
    `${record.detail === undefined ? "" : `, detail=${record.detail}`})`;
}
