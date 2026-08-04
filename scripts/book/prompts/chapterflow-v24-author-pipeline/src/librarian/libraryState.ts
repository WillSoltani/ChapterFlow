/**
 * Library state — persistent JSON ledger that tracks generated content across
 * the catalog. The accounting invariant is intentionally simple:
 *
 *   stored aggregate = sum(current per-chapter content-hash-bound contributions)
 *
 * Writes are serialized by an owned lease. A lease can be recovered only when it
 * is stale AND the owner is known dead; a contender's wait time alone is never
 * proof of staleness.
 */

import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "fs";
import { randomBytes } from "crypto";
import { hostname as osHostname } from "os";
import { basename, dirname, relative, resolve } from "path";
import { fileURLToPath } from "url";

import { chapterContentHash } from "../critics/qcAttestation.js";
import { chapterIdFromFileName, normSlug } from "../lib/chapterPaths.js";
import { ChapterV21 } from "../types.js";
import {
  forbiddenNamesByPolicy,
  loadNamePolicy,
  type NamePolicyV1,
} from "./namePolicy.js";
import { createBookWriteLock } from "../books/bookLease.js";
import { assertV4LibrarianWriterPreflight } from "../books/legacyLibrarianStateAdapter.js";
import type { BookWriteLock } from "../books/leaseTypes.js";
import { writeFileAtomic } from "../lib/atomicWrite.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PIPELINE_DIR = resolve(__dirname, "../..");
const REPO_ROOT = PIPELINE_DIR;
const DEFAULT_STATE_DIR = resolve(PIPELINE_DIR, "state");
const DEFAULT_BOOK_PACKAGES_DIR = resolve(REPO_ROOT, "book-packages");

export type AnswerPositionCounts = [number, number, number];

export type ChapterContribution = {
  schemaVersion: "library-chapter-contribution-v1";
  bookId: string;
  chapterNumber: number;
  chapterId: string;
  contentHash: string;
  contentHashVersion: "qc-attestation-v2";
  ingestedAt: string;
  names: {
    effective: string[];
    source: "planner-allocation" | "missing-authoritative-source";
    audit: {
      capitalizedWordHeuristic: string[];
      namePlanPath?: string;
      policyId: string;
    };
  };
  phrasesFlagged: Record<string, number>;
  answerPositionCounts: AnswerPositionCounts;
};

export type BookLedgerEntry = {
  bookId: string;
  title: string;
  author: string;
  generatedAt: string;
  chapterCount: number;
  chaptersIngested: number[];
  namesUsed: string[];
  phrasesFlagged: Record<string, number>;
  answerPositionCounts: AnswerPositionCounts;
  chapterContributions: Record<string, ChapterContribution>;
};

export type LibraryState = {
  version: "2.0.0";
  lastUpdatedAt: string;
  revision: number;
  policy: {
    namePolicyVersion: "name-policy-v1";
    namePolicyId: string;
  };
  books: Record<string, BookLedgerEntry>;
  globalNameUsage: Record<string, { books: string[]; total: number }>;
  globalPhraseUsage: Record<string, { books: string[]; total: number }>;
  globalAnswerPositionCounts: AnswerPositionCounts;
};

export type LibraryStatePaths = {
  stateDir: string;
  ledgerPath: string;
  lockPath: string;
  journalPath: string;
  journalLogPath: string;
  chaptersDir: string;
  namePlansDir: string;
  bookPackagesDir: string;
  indexesDir: string;
};

export type OwnerLiveness = "alive" | "dead" | "unknown";

export type LibraryLockRecord = {
  schemaVersion: "library-state-lock-v1";
  token: string;
  pid: number;
  hostname: string;
  acquiredAt: string;
  lastHeartbeatAt: string;
  expiresAt: string;
};

export type LibraryLease = {
  token: string;
  record: LibraryLockRecord;
  path: string;
  heartbeat: () => boolean;
  release: () => boolean;
};

export type LibraryStateOptions = {
  stateDir?: string;
  ledgerPath?: string;
  chaptersDir?: string;
  namePlansDir?: string;
  bookPackagesDir?: string;
  indexesDir?: string;
  bookMetadata?: Record<string, { title: string; author: string }>;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  randomToken?: () => string;
  pid?: number;
  hostname?: string;
  ownerLiveness?: (record: LibraryLockRecord) => OwnerLiveness;
  namePolicy?: NamePolicyV1;
  lock?: Partial<{
    leaseMs: number;
    staleAfterMs: number;
    pollMs: number;
    maxWaitMs: number;
    heartbeatMs: number;
  }>;
  faultInjection?: Partial<{
    afterJournal: boolean;
    afterTmpWrite: boolean;
    beforeRename: boolean;
    afterRename: boolean;
  }>;
};

export type LibraryStateV4Options = LibraryStateOptions & {
  writeLock?: BookWriteLock;
  legacyWriterEnabled?: boolean;
};

export type LibraryStateDriftReport = {
  statePath: string;
  drift: boolean;
  differences: string[];
  actual: unknown;
  expected: unknown;
};

const DEFAULT_LOCK = {
  leaseMs: 30_000,
  staleAfterMs: 30_000,
  pollMs: 50,
  maxWaitMs: 60_000,
  heartbeatMs: 10_000,
};

const NAME_STOPWORDS = new Set([
  "The","A","An","If","When","That","But","Chapter","Monday","Tuesday","Wednesday",
  "Thursday","Friday","Saturday","Sunday","She","He","They","It","This","And","Or",
  "So","Her","His","Then","Because","Before","After","While","Once","During","Without",
  "Within","Even","Only","Often","Now","Whenever","Here","There","Judge","Dr",
  "For","Under","Inter","Over","About","Between","Through","Beyond","Against","Among",
  "Morning","Evening","Today","Tomorrow","Yesterday","Later","Earlier","Meanwhile",
  "Afterward","Afterwards","Eventually","Suddenly","Finally","Soon","Sometimes","Usually",
  "Tonight","Midnight","Noon","Instead","Otherwise","However","Somewhere","Everywhere","Nowhere",
  "You","Your","Yours","We","Us","Our","Ours","My","Mine","Their","Theirs",
  "I","Me","Myself","Yourself","Ourselves","Themselves","Himself","Herself","Itself",
  "Him","Them","Who","Whom","Whose","Which","What",
  "One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten",
  "Both","Neither","Either","Each","Every","Some","Another","Other","None","Nothing",
  "Nobody","Anyone","Everyone","Someone","Anybody","Everybody","Somebody","Anything",
  "Everything","Something","Most","Many","Much","Few","Fewer","Several","All","Any",
  "Half","Plenty","Enough","Less","More","Nowadays","First","Second","Third","Last","Next",
  "Further","Furthermore","Moreover","Nevertheless","Nonetheless","Besides","Additionally",
  "Similarly","Likewise","Certainly","Surely","Clearly","Obviously","Naturally","Ultimately",
  "Altogether","Regardless","Indeed","Rather","Otherwise","Thus","Hence","Therefore","Accordingly",
  // Positional/temporal sentence-openers (SEC35 false-positive family, live hit:
  // "Partway through the week, …" flagged undealt protagonist "Partway" 3/3 and
  // killed a compile slot) plus the scene-opening prepositions the list missed —
  // "Behind the counter, …", "Beside the press, …" would fire identically.
  // Exclusion-only: adding a stopword can suppress a detection, never invent one.
  "Partway","Midway","Halfway","Overnight","Nearby","Upstairs","Downstairs",
  "Inside","Outside","Elsewhere","Downtown","Uptown","Overhead","Underfoot",
  "Behind","Beside","Above","Below","Across","Along","Around","Near","Past",
  "Beneath","Toward","Towards","Onto","Into","Upon","Amid","Amidst","Atop",
  "Bed","Room","Desk","Office","Floor","Table","Counter","Kitchen","Lab",
  "Rereading","Reading","Looking","Walking","Sitting","Standing",
  "Reject","Accept","Call","Ask","Start","Stop","Wait","Keep","Pull","Push",
  "Yes","No","Not","Nor","Yet","Still","Just","Even","Also","Okay","Maybe","Actually","Really","Truly","Simply","Perhaps",
  "Version","Versions","Option","Options","Picture","Suppose","Route","Imagine","Predict","Sketch","Word","Words",
  "Hospital","School","Court","Dept","Department","Team","Board","Committee",
  "Weber","Finzi","Mozart","Bach","Beethoven","Brahms","Stravinsky","Ravel",
  "Garamond","Helvetica","Arial","Times","Courier",
  "EMR","MAR","NIH","EU","USA","UK","CEO","VP","PM","HR","IT",
  "Finish","Proposal","Civic","Excerpt","Swallows","Drafts","Hands","Replays",
  "Weighs","Called","Listens","Finishes","Meets","Thanks","Reads","Writes",
  "Tastes","Tosses","Rereading","Has","Heard","Too","Been","Made",
  "Mr","Mrs","Ms","Mx","Sir","Madam",
]);

const TRACKED_PHRASES = [
  "I fall for it",
  "the effect is real and the effect is modest",
  "I am reporting a tendency",
  "the feeling is not evidence",
  "ease disarms",
  "difficulty alerts",
  "neither do I",
  "knowing is not the same as",
];

function pathsFor(opts: LibraryStateOptions = {}): LibraryStatePaths {
  const stateDir = opts.stateDir ? resolve(opts.stateDir) : DEFAULT_STATE_DIR;
  const ledgerPath = opts.ledgerPath ? resolve(opts.ledgerPath) : resolve(stateDir, "library-state.json");
  return {
    stateDir,
    ledgerPath,
    lockPath: `${ledgerPath}.lock`,
    journalPath: `${ledgerPath}.journal`,
    journalLogPath: `${ledgerPath}.journal.jsonl`,
    chaptersDir: opts.chaptersDir ? resolve(opts.chaptersDir) : resolve(stateDir, "chapters"),
    namePlansDir: opts.namePlansDir ? resolve(opts.namePlansDir) : resolve(stateDir, "name-plans"),
    bookPackagesDir: opts.bookPackagesDir
      ? resolve(opts.bookPackagesDir)
      : opts.stateDir
        ? resolve(stateDir, "book-packages")
        : DEFAULT_BOOK_PACKAGES_DIR,
    indexesDir: opts.indexesDir ? resolve(opts.indexesDir) : resolve(stateDir, "indexes"),
  };
}

function nowMs(opts: LibraryStateOptions): number {
  return opts.now ? opts.now() : Date.now();
}

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function uniqueSorted(values: Iterable<string>): string[] {
  return [...new Set([...values].map((s) => s.trim()).filter(Boolean))].sort();
}

function emptyState(opts: LibraryStateOptions = {}): LibraryState {
  const policy = opts.namePolicy ?? loadNamePolicy();
  return {
    version: "2.0.0",
    lastUpdatedAt: iso(nowMs(opts)),
    revision: 0,
    policy: { namePolicyVersion: policy.schemaVersion, namePolicyId: policy.policyId },
    books: {},
    globalNameUsage: {},
    globalPhraseUsage: {},
    globalAnswerPositionCounts: [0, 0, 0],
  };
}

export function createEmptyLibraryState(opts: LibraryStateOptions = {}): LibraryState {
  return emptyState(opts);
}

function normalizeCounts(input: unknown): AnswerPositionCounts {
  if (!Array.isArray(input)) return [0, 0, 0];
  return [Number(input[0] ?? 0) || 0, Number(input[1] ?? 0) || 0, Number(input[2] ?? 0) || 0];
}

function normalizeContribution(raw: unknown, fallback: { bookId: string; chapterNumber: number }, opts: LibraryStateOptions): ChapterContribution | null {
  if (!isRecord(raw)) return null;
  const names = isRecord(raw.names) ? raw.names : {};
  const audit = isRecord(names.audit) ? names.audit : {};
  const policy = opts.namePolicy ?? loadNamePolicy();
  const chapterNumber = Number(raw.chapterNumber ?? fallback.chapterNumber);
  if (!Number.isInteger(chapterNumber) || chapterNumber < 1) return null;
  const contentHash = typeof raw.contentHash === "string" ? raw.contentHash : "";
  if (!contentHash) return null;
  return {
    schemaVersion: "library-chapter-contribution-v1",
    bookId: typeof raw.bookId === "string" ? raw.bookId : fallback.bookId,
    chapterNumber,
    chapterId: typeof raw.chapterId === "string" ? raw.chapterId : `${fallback.bookId}-ch${String(chapterNumber).padStart(2, "0")}`,
    contentHash,
    contentHashVersion: "qc-attestation-v2",
    ingestedAt: typeof raw.ingestedAt === "string" ? raw.ingestedAt : iso(nowMs(opts)),
    names: {
      effective: uniqueSorted(Array.isArray(names.effective) ? names.effective.filter((n) => typeof n === "string") : []),
      source: names.source === "planner-allocation" ? "planner-allocation" : "missing-authoritative-source",
      audit: {
        capitalizedWordHeuristic: uniqueSorted(
          Array.isArray(audit.capitalizedWordHeuristic) ? audit.capitalizedWordHeuristic.filter((n) => typeof n === "string") : [],
        ),
        namePlanPath: typeof audit.namePlanPath === "string" ? audit.namePlanPath : undefined,
        policyId: typeof audit.policyId === "string" ? audit.policyId : policy.policyId,
      },
    },
    phrasesFlagged: normalizePhraseMap(raw.phrasesFlagged),
    answerPositionCounts: normalizeCounts(raw.answerPositionCounts),
  };
}

function normalizePhraseMap(input: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!isRecord(input)) return out;
  for (const [key, value] of Object.entries(input)) {
    const count = Number(value);
    if (Number.isFinite(count) && count > 0) out[key] = count;
  }
  return out;
}

/** Normalize a raw [a,b,c] answer-position triple into a clean non-negative triple. */
function normalizeAnswerCounts(input: unknown): AnswerPositionCounts {
  const a = Array.isArray(input) ? input : [];
  const at = (i: number): number => {
    const x = Number(a[i]);
    return Number.isFinite(x) && x >= 0 ? x : 0;
  };
  return [at(0), at(1), at(2)];
}

function normalizeBook(raw: unknown, bookId: string, opts: LibraryStateOptions): BookLedgerEntry {
  const obj = isRecord(raw) ? raw : {};
  const contributions: Record<string, ChapterContribution> = {};
  const rawContributions = isRecord(obj.chapterContributions) ? obj.chapterContributions : {};
  for (const [key, value] of Object.entries(rawContributions)) {
    const chapterNumber = Number(key);
    const c = normalizeContribution(value, { bookId, chapterNumber }, opts);
    if (c) contributions[String(c.chapterNumber)] = c;
  }
  const base: BookLedgerEntry = {
    bookId,
    title: typeof obj.title === "string" ? obj.title : bookId,
    author: typeof obj.author === "string" ? obj.author : "",
    generatedAt: typeof obj.generatedAt === "string" ? obj.generatedAt : iso(nowMs(opts)),
    chapterCount: 0,
    chaptersIngested: [],
    namesUsed: [],
    phrasesFlagged: {},
    answerPositionCounts: [0, 0, 0],
    chapterContributions: contributions,
  };
  // v2 entry: recompute the aggregates authoritatively from per-chapter contributions.
  if (Object.keys(contributions).length > 0) return recalcBook(base);
  // v1 BACK-COMPAT: a pre-v2 ledger entry stored top-level namesUsed/phrasesFlagged/etc. but NO
  // per-chapter contributions. PRESERVE those aggregates rather than recalc-wiping them to empty —
  // recalc-wiping silently dropped the live 7127-name cross-book ledger on the first v2 load.
  base.namesUsed = [...new Set((Array.isArray(obj.namesUsed) ? obj.namesUsed : [])
    .filter((n): n is string => typeof n === "string" && n.trim().length > 0))].sort();
  base.phrasesFlagged = normalizePhraseMap(obj.phrasesFlagged);
  base.answerPositionCounts = normalizeAnswerCounts(obj.answerPositionCounts);
  base.chapterCount = typeof obj.chapterCount === "number" && Number.isFinite(obj.chapterCount) ? obj.chapterCount : 0;
  base.chaptersIngested = (Array.isArray(obj.chaptersIngested) ? obj.chaptersIngested : [])
    .map(Number).filter((n) => Number.isInteger(n) && n > 0);
  return base;
}

function recalcBook(book: BookLedgerEntry): BookLedgerEntry {
  const contributions = Object.values(book.chapterContributions).sort((a, b) => a.chapterNumber - b.chapterNumber);
  const names = new Set<string>();
  const phrases: Record<string, number> = {};
  const answer: AnswerPositionCounts = [0, 0, 0];
  for (const c of contributions) {
    for (const name of c.names.effective) names.add(name);
    for (const [phrase, count] of Object.entries(c.phrasesFlagged)) phrases[phrase] = (phrases[phrase] ?? 0) + count;
    answer[0] += c.answerPositionCounts[0];
    answer[1] += c.answerPositionCounts[1];
    answer[2] += c.answerPositionCounts[2];
  }
  book.chaptersIngested = contributions.map((c) => c.chapterNumber);
  book.chapterCount = contributions.reduce((max, c) => Math.max(max, c.chapterNumber), 0);
  book.namesUsed = [...names].sort();
  book.phrasesFlagged = phrases;
  book.answerPositionCounts = answer;
  return book;
}

function normalizeState(raw: unknown, opts: LibraryStateOptions = {}): LibraryState {
  if (!isRecord(raw)) return emptyState(opts);
  const policy = opts.namePolicy ?? loadNamePolicy();
  const state: LibraryState = {
    version: "2.0.0",
    lastUpdatedAt: typeof raw.lastUpdatedAt === "string" ? raw.lastUpdatedAt : iso(nowMs(opts)),
    revision: Number.isInteger(raw.revision) ? Number(raw.revision) : 0,
    policy: { namePolicyVersion: policy.schemaVersion, namePolicyId: policy.policyId },
    books: {},
    globalNameUsage: {},
    globalPhraseUsage: {},
    globalAnswerPositionCounts: [0, 0, 0],
  };
  const books = isRecord(raw.books) ? raw.books : {};
  for (const [bookId, value] of Object.entries(books)) {
    state.books[bookId] = normalizeBook(value, bookId, opts);
  }
  recalcGlobal(state);
  return state;
}

function recalcGlobal(state: LibraryState): LibraryState {
  state.globalNameUsage = {};
  state.globalPhraseUsage = {};
  state.globalAnswerPositionCounts = [0, 0, 0];
  for (const book of Object.values(state.books)) {
    const hasContributions = Object.keys(book.chapterContributions).length > 0;
    // Only recalc a v2 book FROM its contributions; a v1 book (no contributions) keeps the
    // top-level aggregates normalizeBook preserved (recalcBook would wipe them back to empty).
    if (hasContributions) recalcBook(book);
    state.globalAnswerPositionCounts[0] += book.answerPositionCounts[0];
    state.globalAnswerPositionCounts[1] += book.answerPositionCounts[1];
    state.globalAnswerPositionCounts[2] += book.answerPositionCounts[2];
    if (hasContributions) {
      for (const c of Object.values(book.chapterContributions)) {
        for (const name of c.names.effective) {
          const usage = state.globalNameUsage[name] ?? { books: [], total: 0 };
          if (!usage.books.includes(book.bookId)) usage.books.push(book.bookId);
          usage.total += 1;
          state.globalNameUsage[name] = usage;
        }
        for (const [phrase, count] of Object.entries(c.phrasesFlagged)) {
          const usage = state.globalPhraseUsage[phrase] ?? { books: [], total: 0 };
          if (!usage.books.includes(book.bookId)) usage.books.push(book.bookId);
          usage.total += count;
          state.globalPhraseUsage[phrase] = usage;
        }
      }
    } else {
      // v1 book: feed its PRESERVED top-level aggregates into the cross-book global usage, so the
      // 7127-name dedup ledger survives a v1→v2 load instead of being silently emptied.
      for (const name of book.namesUsed) {
        const usage = state.globalNameUsage[name] ?? { books: [], total: 0 };
        if (!usage.books.includes(book.bookId)) usage.books.push(book.bookId);
        usage.total += 1;
        state.globalNameUsage[name] = usage;
      }
      for (const [phrase, count] of Object.entries(book.phrasesFlagged)) {
        const usage = state.globalPhraseUsage[phrase] ?? { books: [], total: 0 };
        if (!usage.books.includes(book.bookId)) usage.books.push(book.bookId);
        usage.total += count;
        state.globalPhraseUsage[phrase] = usage;
      }
    }
  }
  for (const usage of Object.values(state.globalNameUsage)) usage.books.sort();
  for (const usage of Object.values(state.globalPhraseUsage)) usage.books.sort();
  return state;
}

export function loadLibraryState(opts: LibraryStateOptions = {}): LibraryState {
  const paths = pathsFor(opts);
  if (!existsSync(paths.ledgerPath)) return emptyState(opts);
  try {
    return normalizeState(JSON.parse(readFileSync(paths.ledgerPath, "utf8")), opts);
  } catch (err) {
    throw new Error(`Could not parse library state at ${paths.ledgerPath}: ${(err as Error).message}`);
  }
}

function defaultOwnerLiveness(record: LibraryLockRecord, host: string): OwnerLiveness {
  if (record.hostname !== host || !Number.isInteger(record.pid)) return "unknown";
  try {
    process.kill(record.pid, 0);
    return "alive";
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === "ESRCH") return "dead";
    if (code === "EPERM") return "alive";
    return "unknown";
  }
}

function readLockRecord(path: string): LibraryLockRecord | null {
  try {
    const raw = JSON.parse(readFileSync(path, "utf8"));
    if (!isRecord(raw) || raw.schemaVersion !== "library-state-lock-v1" || typeof raw.token !== "string") return null;
    return raw as LibraryLockRecord;
  } catch {
    return null;
  }
}

function sameLock(a: LibraryLockRecord | null, b: LibraryLockRecord | null): boolean {
  return !!a && !!b && a.token === b.token && a.acquiredAt === b.acquiredAt;
}

function appendJournal(paths: LibraryStatePaths, event: unknown): void {
  try {
    mkdirSync(dirname(paths.journalLogPath), { recursive: true });
    appendFileSync(paths.journalLogPath, `${JSON.stringify(event)}\n`, "utf8");
  } catch {
    // Journal logging must not make recovery worse; the pending journal still
    // protects the atomic write path.
  }
}

export class LibraryStateLockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LibraryStateLockError";
  }
}

function makeLockRecord(token: string, opts: LibraryStateOptions, acquiredAtMs: number): LibraryLockRecord {
  const cfg = { ...DEFAULT_LOCK, ...opts.lock };
  const host = opts.hostname ?? osHostname();
  return {
    schemaVersion: "library-state-lock-v1",
    token,
    pid: opts.pid ?? process.pid,
    hostname: host,
    acquiredAt: iso(acquiredAtMs),
    lastHeartbeatAt: iso(acquiredAtMs),
    expiresAt: iso(acquiredAtMs + cfg.leaseMs),
  };
}

function ownsLock(path: string, token: string): boolean {
  return readLockRecord(path)?.token === token;
}

function rewriteOwnedLock(path: string, record: LibraryLockRecord): boolean {
  const current = readLockRecord(path);
  if (!current || current.token !== record.token) return false;
  const tmp = `${path}.hb-${record.token}-${randomBytes(4).toString("hex")}`;
  try {
    writeFileSync(tmp, JSON.stringify(record, null, 2), "utf8");
    renameSync(tmp, path);
    return true;
  } catch {
    try { if (existsSync(tmp)) unlinkSync(tmp); } catch { /* best-effort */ }
    return false;
  }
}

function createLease(record: LibraryLockRecord, paths: LibraryStatePaths, opts: LibraryStateOptions): LibraryLease {
  const cfg = { ...DEFAULT_LOCK, ...opts.lock };
  let released = false;
  const lease: LibraryLease = {
    token: record.token,
    record,
    path: paths.lockPath,
    heartbeat: () => {
      if (released) return false;
      const at = nowMs(opts);
      const next = { ...record, lastHeartbeatAt: iso(at), expiresAt: iso(at + cfg.leaseMs) };
      const ok = rewriteOwnedLock(paths.lockPath, next);
      if (ok) lease.record = next;
      return ok;
    },
    release: () => {
      if (released) return false;
      released = true;
      try {
        if (ownsLock(paths.lockPath, record.token)) {
          unlinkSync(paths.lockPath);
          return true;
        }
      } catch {
        return false;
      }
      return false;
    },
  };
  if (cfg.heartbeatMs > 0 && opts.sleep === undefined) {
    const timer = setInterval(() => {
      if (!lease.heartbeat()) clearInterval(timer);
    }, cfg.heartbeatMs);
    if (typeof timer.unref === "function") timer.unref();
  }
  return lease;
}

export async function acquireLibraryLease(opts: LibraryStateOptions = {}): Promise<LibraryLease> {
  const paths = pathsFor(opts);
  const cfg = { ...DEFAULT_LOCK, ...opts.lock };
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((resolveSleep) => setTimeout(resolveSleep, ms)));
  const token = opts.randomToken ? opts.randomToken() : randomBytes(24).toString("hex");
  const startedAt = nowMs(opts);
  mkdirSync(paths.stateDir, { recursive: true });

  while (true) {
    const record = makeLockRecord(token, opts, nowMs(opts));
    try {
      writeFileSync(paths.lockPath, JSON.stringify(record, null, 2), { flag: "wx" });
      return createLease(record, paths, opts);
    } catch (err) {
      if ((err as NodeJS.ErrnoException)?.code !== "EEXIST") throw err;
    }

    const current = readLockRecord(paths.lockPath);
    const ageMs = current ? nowMs(opts) - Date.parse(current.acquiredAt) : Number.POSITIVE_INFINITY;
    const expired = current ? nowMs(opts) >= Date.parse(current.expiresAt) : true;
    const staleByAge = Number.isFinite(ageMs) && ageMs >= cfg.staleAfterMs && expired;
    const liveness = current
      ? opts.ownerLiveness
        ? opts.ownerLiveness(current)
        : defaultOwnerLiveness(current, opts.hostname ?? osHostname())
      : "unknown";

    if (staleByAge && liveness === "dead") {
      const observed = readLockRecord(paths.lockPath);
      if (sameLock(current, observed)) {
        const aside = `${paths.lockPath}.recovered-${token}`;
        try {
          renameSync(paths.lockPath, aside);
          appendJournal(paths, {
            schemaVersion: "library-lock-recovery-v1",
            recoveredAt: iso(nowMs(opts)),
            recoveredBy: token,
            priorOwner: current,
          });
          try { unlinkSync(aside); } catch { /* journal has the raw owner record */ }
          continue;
        } catch {
          // Lost a recovery race; loop and observe the new lock.
        }
      }
    }

    if (staleByAge && liveness === "unknown") {
      throw new LibraryStateLockError(
        `library state lock at ${paths.lockPath} is stale but owner liveness is unknowable; refusing automatic recovery. Remove or recover the lock explicitly after verifying the owner is dead.`,
      );
    }

    if (nowMs(opts) - startedAt >= cfg.maxWaitMs) {
      const heldBy = current ? `pid ${current.pid}@${current.hostname} token ${current.token} since ${current.acquiredAt}` : "an unreadable lock";
      throw new LibraryStateLockError(`library state lock at ${paths.lockPath} is still held by ${heldBy}; refusing to steal a live lease`);
    }
    await sleep(cfg.pollMs);
  }
}

function acquireLibraryLeaseSync(opts: LibraryStateOptions = {}): LibraryLease {
  const paths = pathsFor(opts);
  const token = opts.randomToken ? opts.randomToken() : randomBytes(24).toString("hex");
  const record = makeLockRecord(token, opts, nowMs(opts));
  mkdirSync(paths.stateDir, { recursive: true });
  try {
    writeFileSync(paths.lockPath, JSON.stringify(record, null, 2), { flag: "wx" });
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code === "EEXIST") {
      throw new LibraryStateLockError(`library state lock at ${paths.lockPath} is held; sync writes fail closed instead of stealing`);
    }
    throw err;
  }
  return createLease(record, paths, { ...opts, lock: { ...opts.lock, heartbeatMs: 0 } });
}

function saveLibraryStateUnlocked(
  state: LibraryState,
  opts: LibraryStateOptions,
  lease: LibraryLease | null,
  priorRevision?: number,
): void {
  const paths = pathsFor(opts);
  const normalized = normalizeState(state, opts);
  normalized.revision = Math.max(priorRevision ?? normalized.revision, normalized.revision) + 1;
  normalized.lastUpdatedAt = iso(nowMs(opts));
  const tmp = `${paths.ledgerPath}.tmp-${lease?.token ?? "sync"}-${randomBytes(4).toString("hex")}`;
  const pending = {
    schemaVersion: "library-state-journal-v1",
    token: lease?.token ?? "sync",
    startedAt: iso(nowMs(opts)),
    fromRevision: priorRevision ?? null,
    toRevision: normalized.revision,
    ledgerPath: paths.ledgerPath,
  };
  mkdirSync(dirname(paths.ledgerPath), { recursive: true });
  writeFileSync(paths.journalPath, JSON.stringify(pending, null, 2), "utf8");
  if (opts.faultInjection?.afterJournal) throw new Error("fault injection: afterJournal");
  writeFileSync(tmp, JSON.stringify(normalized, null, 2), "utf8");
  if (opts.faultInjection?.afterTmpWrite) throw new Error("fault injection: afterTmpWrite");
  if (opts.faultInjection?.beforeRename) throw new Error("fault injection: beforeRename");
  renameSync(tmp, paths.ledgerPath);
  if (opts.faultInjection?.afterRename) throw new Error("fault injection: afterRename");
  appendJournal(paths, { ...pending, committedAt: iso(nowMs(opts)), status: "committed" });
  try { unlinkSync(paths.journalPath); } catch { /* keep pending evidence when cleanup fails */ }
  Object.assign(state, normalized);
}

export async function saveLibraryState(state: LibraryState, opts: LibraryStateOptions = {}): Promise<void> {
  const lease = await acquireLibraryLease(opts);
  try {
    const before = existsSync(pathsFor(opts).ledgerPath) ? loadLibraryState(opts) : emptyState(opts);
    saveLibraryStateUnlocked(state, opts, lease, before.revision);
  } finally {
    lease.release();
  }
}

/** V4 authority route: optimistic revision check under one short lock, then one replacement. */
export async function saveLibraryStateV4(
  state: LibraryState,
  opts: LibraryStateV4Options = {},
): Promise<LibraryState> {
  assertV4LibrarianWriterPreflight(opts.legacyWriterEnabled);
  const paths = pathsFor(opts);
  mkdirSync(paths.stateDir, { recursive: true });
  const writeLock = opts.writeLock ?? createBookWriteLock({ booksRoot: paths.stateDir, timeoutMs: 1_000, pollMs: 1 });
  const locked = await writeLock.run("library-state", async () => {
    try {
      const before = existsSync(paths.ledgerPath) ? loadLibraryState(opts) : emptyState(opts);
      if (state.revision !== before.revision) {
        return {
          ok: false,
          error: {
            code: "LIBRARIAN_STATE_STALE",
            message: `library state revision ${state.revision} does not match stored revision ${before.revision}`,
          },
        } as const;
      }
      const normalized = normalizeState(state, opts);
      normalized.revision = before.revision + 1;
      normalized.lastUpdatedAt = iso(nowMs(opts));
      writeFileAtomic(paths.ledgerPath, JSON.stringify(normalized, null, 2), "utf8");
      Object.assign(state, normalized);
      return { ok: true, value: state } as const;
    } catch (cause) {
      return { ok: false, error: { code: "LIBRARIAN_STATE_IO", message: (cause as Error).message } } as const;
    }
  });
  if (!locked.ok) throw new Error(`${locked.error.code}: ${locked.error.message}`);
  return locked.value;
}

export async function withLibraryStateV4(
  mutate: (state: LibraryState) => LibraryState | void | Promise<LibraryState | void>,
  opts: LibraryStateV4Options = {},
): Promise<LibraryState> {
  assertV4LibrarianWriterPreflight(opts.legacyWriterEnabled);
  const before = existsSync(pathsFor(opts).ledgerPath) ? loadLibraryState(opts) : emptyState(opts);
  const after = ((await mutate(before)) ?? before) as LibraryState;
  return saveLibraryStateV4(after, opts);
}

export async function withLibraryState(
  mutate: (state: LibraryState) => LibraryState | void | Promise<LibraryState | void>,
  opts: LibraryStateOptions = {},
): Promise<LibraryState> {
  const lease = await acquireLibraryLease(opts);
  try {
    const before = loadLibraryState(opts);
    const after = ((await mutate(before)) ?? before) as LibraryState;
    saveLibraryStateUnlocked(after, opts, lease, before.revision);
    return after;
  } finally {
    lease.release();
  }
}

export function saveLibraryStateSync(state: LibraryState, opts: LibraryStateOptions = {}): void {
  const lease = acquireLibraryLeaseSync(opts);
  try {
    const before = existsSync(pathsFor(opts).ledgerPath) ? loadLibraryState(opts) : emptyState(opts);
    saveLibraryStateUnlocked(state, opts, lease, before.revision);
  } finally {
    lease.release();
  }
}

export function extractNamesFromText(text: string): string[] {
  const ascii = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const matches = Array.from(ascii.matchAll(/\b[A-Z][a-z]{2,}\b/g)).map((m) => m[0]);
  return matches.filter((w) => !NAME_STOPWORDS.has(w));
}

function phraseCounts(chapter: ChapterV21): Record<string, number> {
  const allText = [
    chapter.hook,
    chapter.counterintuition ?? "",
    chapter.keyTakeaway,
    chapter.breakdown.fastRead,
    chapter.breakdown.deepRead,
    chapter.breakdown.fullRead,
    ...chapter.examples.flatMap((e) => [String(e.scenario ?? ""), String(e.whatToDo ?? ""), String(e.whyItMatters ?? "")]),
    ...chapter.quiz.questions.flatMap((q) => [q.prompt, String(q.explanation ?? ""), ...q.choices]),
    ...chapter.reviewCards.flatMap((c) => [String(c.front ?? ""), String(c.back ?? "")]),
  ].join(" \n ").toLowerCase();
  const out: Record<string, number> = {};
  for (const phrase of TRACKED_PHRASES) {
    const re = new RegExp(phrase.toLowerCase().replace(/[^a-z0-9 ]/g, "\\$&"), "g");
    const count = (allText.match(re) ?? []).length;
    if (count > 0) out[phrase] = count;
  }
  return out;
}

function answerCounts(chapter: ChapterV21): AnswerPositionCounts {
  const out: AnswerPositionCounts = [0, 0, 0];
  for (const q of chapter.quiz.questions) {
    const idx = q.correctIndex;
    if (idx === 0 || idx === 1 || idx === 2) out[idx] += 1;
  }
  return out;
}

function auditNames(chapter: ChapterV21): string[] {
  const names = new Set<string>();
  for (const ex of chapter.examples ?? []) {
    for (const name of extractNamesFromText(String(ex.scenario ?? ""))) names.add(name);
  }
  return [...names].sort();
}

function allocationFromNamePlan(bookId: string, chapterNumber: number, opts: LibraryStateOptions): { names: string[]; path?: string } {
  const path = resolve(pathsFor(opts).namePlansDir, `${bookId}.name-plan.json`);
  if (!existsSync(path)) return { names: [] };
  try {
    const plan = JSON.parse(readFileSync(path, "utf8"));
    const allocation = isRecord(plan?.allocation) ? plan.allocation[String(chapterNumber)] ?? plan.allocation[chapterNumber] : undefined;
    if (!Array.isArray(allocation)) return { names: [], path };
    return { names: uniqueSorted(allocation.filter((n) => typeof n === "string")), path };
  } catch {
    return { names: [], path };
  }
}

export function chapterContribution(
  bookId: string,
  chapter: ChapterV21,
  opts: LibraryStateOptions = {},
): ChapterContribution {
  const policy = opts.namePolicy ?? loadNamePolicy();
  const allocation = allocationFromNamePlan(bookId, chapter.number, opts);
  const effective = allocation.names;
  return {
    schemaVersion: "library-chapter-contribution-v1",
    bookId,
    chapterNumber: chapter.number,
    chapterId: chapter.chapterId,
    contentHash: chapterContentHash(chapter),
    contentHashVersion: "qc-attestation-v2",
    ingestedAt: iso(nowMs(opts)),
    names: {
      effective,
      source: effective.length > 0 ? "planner-allocation" : "missing-authoritative-source",
      audit: {
        capitalizedWordHeuristic: auditNames(chapter),
        // Store repo-root-relative so the ledger carries no machine-absolute
        // path — keeps the committed canonical state portable and the drift
        // comparison deterministic across checkouts (invariant #7).
        namePlanPath: allocation.path ? relReport(allocation.path) : undefined,
        policyId: policy.policyId,
      },
    },
    phrasesFlagged: phraseCounts(chapter),
    answerPositionCounts: answerCounts(chapter),
  };
}

export function ingestChapter(
  state: LibraryState,
  bookId: string,
  title: string,
  author: string,
  chapter: ChapterV21,
  opts: LibraryStateOptions = {},
): LibraryState {
  const normalized = normalizeState(state, opts);
  let book = normalized.books[bookId];
  if (!book) {
    book = {
      bookId,
      title,
      author,
      generatedAt: iso(nowMs(opts)),
      chapterCount: 0,
      chaptersIngested: [],
      namesUsed: [],
      phrasesFlagged: {},
      answerPositionCounts: [0, 0, 0],
      chapterContributions: {},
    };
    normalized.books[bookId] = book;
  }
  book.title = title;
  book.author = author;
  book.chapterContributions[String(chapter.number)] = chapterContribution(bookId, chapter, opts);
  recalcGlobal(normalized);
  Object.assign(state, normalized);
  return state;
}

export function removeChapterContribution(
  state: LibraryState,
  bookId: string,
  chapterNumber: number,
  opts: LibraryStateOptions = {},
): LibraryState {
  const normalized = normalizeState(state, opts);
  const book = normalized.books[bookId];
  if (book) {
    delete book.chapterContributions[String(chapterNumber)];
    if (Object.keys(book.chapterContributions).length === 0) delete normalized.books[bookId];
  }
  recalcGlobal(normalized);
  Object.assign(state, normalized);
  return state;
}

export function getForbiddenNames(
  state: LibraryState,
  currentBookId: string,
  lookback?: number,
): string[] {
  const policy = loadNamePolicy();
  const effectivePolicy = lookback === undefined
    ? policy
    : { ...policy, catalogCooldown: { ...policy.catalogCooldown, lookbackBooks: lookback } };
  const books = Object.values(normalizeState(state).books).map((book) => ({
    bookId: book.bookId,
    generatedAt: book.generatedAt,
    namesUsed: book.namesUsed,
  }));
  return [...forbiddenNamesByPolicy(books, currentBookId, effectivePolicy)].sort();
}

export type LibraryAuditSeverity = "blocker" | "warning" | "info";

/** A single structured finding from the authoritative-inputs audit. Every
 *  rejection that used to be a silent `continue` now becomes one of these. */
export type LibraryAuditFinding = {
  checkId: string;
  severity: LibraryAuditSeverity;
  /** Repo-root-relative when the file is inside the checkout (so the report is
   *  deterministic across checkout paths), absolute otherwise. */
  path: string;
  bookId?: string;
  chapter?: number;
  reason: string;
};

export type LibraryAcceptedFile = {
  path: string;
  kind: "package" | "loose";
  authority: "published-package" | "loose-authoring" | "loose-shadow-of-published";
  bookId: string;
  chapters: number[];
};

type AuthoritativeBook = {
  title: string;
  author: string;
  /** True once a production package claims this bookId — the package is then the
   *  sole authoritative source for the ledger and loose files are non-ingested
   *  drafts. */
  published: boolean;
  chapters: Map<number, ChapterV21>;
};

export type AuthoritativeChapters = {
  byBook: Map<string, AuthoritativeBook>;
  accepted: LibraryAcceptedFile[];
  findings: LibraryAuditFinding[];
};

/** Render an absolute path repo-root-relative so audit output is identical
 *  regardless of where the checkout lives (determinism invariant #7). */
function relReport(abs: string): string {
  const rel = relative(REPO_ROOT, abs);
  return rel && !rel.startsWith("..") ? rel : abs;
}

type ReadResult = { ok: true; value: unknown } | { ok: false; error: string };

function readJsonResult(path: string): ReadResult {
  try {
    return { ok: true, value: JSON.parse(readFileSync(path, "utf8")) };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

const LOOSE_FILE_RE = /^(.+)-ch\d{1,3}\.v21-native\.chapter\.json$/i;

/**
 * Walk the authoritative inputs (production packages + loose chapter state) and
 * return the resolved per-book chapter set ALONGSIDE a structured finding for
 * every file or chapter that was rejected, conflicted, or fell outside the
 * canonical index. Nothing is skipped silently.
 *
 * Authority policy:
 *   - A book with a production package is PUBLISHED; the package is the sole
 *     authoritative reader content. Loose files for that book are unpublished
 *     drafts — never ingested, never allowed to overwrite the package. When a
 *     loose draft diverges from (or has no counterpart in) the package, that is
 *     reported as a non-blocking package/loose conflict; the package still wins.
 *   - A book with no package is UNPUBLISHED; its loose chapter files are the
 *     authoritative authoring state and ARE ingested.
 *   - Corrupt, malformed, identity-mismatched, or duplicate inputs are blockers
 *     — a real rebuild refuses to write while any blocker stands.
 */
export function collectAuthoritativeChapters(opts: LibraryStateOptions = {}): AuthoritativeChapters {
  const paths = pathsFor(opts);
  const byBook = new Map<string, AuthoritativeBook>();
  const accepted: LibraryAcceptedFile[] = [];
  const findings: LibraryAuditFinding[] = [];
  const add = (f: LibraryAuditFinding) => findings.push(f);

  const ensureBook = (bookId: string, title: string, author: string, published: boolean): AuthoritativeBook => {
    const meta = opts.bookMetadata?.[bookId];
    let book = byBook.get(bookId);
    if (!book) {
      book = { title: meta?.title ?? title, author: meta?.author ?? author, published, chapters: new Map() };
      byBook.set(bookId, book);
      return book;
    }
    if (meta) { book.title = meta.title; book.author = meta.author; }
    else { if (title) book.title = title; if (author) book.author = author; }
    book.published = book.published || published;
    return book;
  };

  // Pass 1 — production packages (authoritative for published reader content).
  const packageOf = new Map<string, string>();
  if (existsSync(paths.bookPackagesDir)) {
    for (const file of readdirSync(paths.bookPackagesDir).filter((f) => f.endsWith(".json")).sort()) {
      const abs = resolve(paths.bookPackagesDir, file);
      const read = readJsonResult(abs);
      if (!read.ok) {
        add({ checkId: "library.unreadable_json", severity: "blocker", path: relReport(abs), reason: `package JSON did not parse: ${read.error}` });
        continue;
      }
      const raw = read.value;
      if (!isRecord(raw) || !isRecord(raw.book) || !Array.isArray(raw.chapters)) {
        add({ checkId: "library.malformed_package", severity: "blocker", path: relReport(abs), reason: "package must have an object `book` and an array `chapters`" });
        continue;
      }
      const rawBookId = typeof raw.book.bookId === "string" && raw.book.bookId ? raw.book.bookId : file.replace(/\.v21\.json$|\.json$/i, "");
      const bookId = normSlug(rawBookId);
      const prior = packageOf.get(bookId);
      if (prior) {
        add({ checkId: "library.duplicate_book_identity", severity: "blocker", path: relReport(abs), bookId, reason: `package "${file}" normalizes to bookId "${bookId}" already claimed by "${prior}"` });
        continue;
      }
      packageOf.set(bookId, file);
      const book = ensureBook(
        bookId,
        typeof raw.book.title === "string" ? raw.book.title : bookId,
        typeof raw.book.author === "string" ? raw.book.author : "",
        true,
      );
      const acceptedNums: number[] = [];
      for (let i = 0; i < raw.chapters.length; i++) {
        const chapter = raw.chapters[i];
        if (!isRecord(chapter) || !Number.isInteger(chapter.number)) {
          add({ checkId: "library.malformed_chapter", severity: "blocker", path: relReport(abs), bookId, reason: `chapters[${i}] is missing an integer \`number\`` });
          continue;
        }
        const num = Number(chapter.number);
        if (book.chapters.has(num)) {
          add({ checkId: "library.duplicate_chapter_number", severity: "blocker", path: relReport(abs), bookId, chapter: num, reason: `package lists chapter number ${num} more than once` });
          continue;
        }
        book.chapters.set(num, chapter as ChapterV21);
        acceptedNums.push(num);
      }
      accepted.push({ path: relReport(abs), kind: "package", authority: "published-package", bookId, chapters: acceptedNums.sort((a, b) => a - b) });
    }
  }
  // A book that has a package FILE on disk is "packaged" — its loose files are
  // drafts, never authoritative for the ledger — even if the package failed to
  // parse. Deriving this from the FILENAME (not just successfully-parsed
  // packages) is what stops a corrupt/torn package from letting its loose drafts
  // be silently promoted to published reader content, and what keeps quarantine
  // from inverting authority.
  const packagedIds = new Set<string>(byBook.keys());
  if (existsSync(paths.bookPackagesDir)) {
    for (const file of readdirSync(paths.bookPackagesDir).filter((f) => f.endsWith(".json"))) {
      packagedIds.add(normSlug(file.replace(/\.v21\.json$|\.json$/i, "")));
    }
  }

  // Pass 2 — loose chapter state.
  if (existsSync(paths.chaptersDir)) {
    const looseSeen = new Map<string, Map<number, string>>();
    for (const file of readdirSync(paths.chaptersDir).filter((f) => f.endsWith(".v21-native.chapter.json")).sort()) {
      const abs = resolve(paths.chaptersDir, file);
      const fileMatch = basename(file).match(LOOSE_FILE_RE);
      const bookId = normSlug(fileMatch ? fileMatch[1] : chapterIdFromFileName(file));
      const fileNumMatch = basename(file).match(/-ch0*(\d{1,3})\.v21-native\.chapter\.json$/i);
      const fileChapter = fileNumMatch ? parseInt(fileNumMatch[1], 10) : undefined;
      const packaged = packagedIds.has(bookId);
      // For a packaged book the package is authoritative; a loose-draft anomaly
      // is a non-blocking conflict (the draft is never ingested). For an
      // unpublished book the loose chapter IS the authoritative content, so the
      // same anomaly is a blocker.
      const anomaly = (checkId: string, reason: string, chapter?: number) =>
        add({
          checkId,
          severity: packaged ? "warning" : "blocker",
          path: relReport(abs),
          bookId,
          chapter,
          reason: packaged ? `${reason} — book is published; package is authoritative, loose draft not ingested` : reason,
        });

      const read = readJsonResult(abs);
      if (!read.ok) {
        anomaly("library.unreadable_json", `chapter JSON did not parse: ${read.error}`, fileChapter);
        continue;
      }
      const raw = read.value;
      if (!isRecord(raw) || !Number.isInteger(raw.number) || typeof raw.chapterId !== "string" || !raw.chapterId) {
        anomaly("library.malformed_chapter", "loose chapter must carry an integer `number` and a non-empty string `chapterId`", fileChapter);
        continue;
      }
      const stem = chapterIdFromFileName(file);
      const num = Number(raw.number);
      if (raw.chapterId !== stem) {
        anomaly("library.chapterid_filename_mismatch", `in-file chapterId "${raw.chapterId}" != filename stem "${stem}"; reconcile with \`migrate-chapter-identity ${bookId}\``, num);
        if (packaged) accepted.push({ path: relReport(abs), kind: "loose", authority: "loose-shadow-of-published", bookId, chapters: [num] });
        continue;
      }
      const chapter = raw as ChapterV21;
      if (packaged) {
        const pkgBook = byBook.get(bookId);
        const pkgChapter = pkgBook?.chapters.get(num);
        if (!pkgBook) {
          add({ checkId: "library.package_loose_unverifiable", severity: "warning", path: relReport(abs), bookId, chapter: num, reason: `loose draft cannot be compared — "${bookId}" has a package file that did not load; the package remains authoritative and the draft is not ingested` });
        } else if (!pkgChapter) {
          add({ checkId: "library.package_loose_orphan_chapter", severity: "warning", path: relReport(abs), bookId, chapter: num, reason: `loose chapter ${num} has no counterpart in the published package; package is authoritative, loose treated as an unpublished draft` });
        } else if (chapterContentHash(chapter) !== chapterContentHash(pkgChapter)) {
          add({ checkId: "library.package_loose_divergence", severity: "warning", path: relReport(abs), bookId, chapter: num, reason: `loose chapter ${num} diverges from the published package; package is authoritative (loose not ingested)` });
        }
        accepted.push({ path: relReport(abs), kind: "loose", authority: "loose-shadow-of-published", bookId, chapters: [num] });
        continue;
      }
      const seen = looseSeen.get(bookId) ?? new Map<number, string>();
      const dupOf = seen.get(num);
      if (dupOf) {
        add({ checkId: "library.duplicate_chapter_number", severity: "blocker", path: relReport(abs), bookId, chapter: num, reason: `loose file collides on chapter ${num} for "${bookId}" with "${dupOf}"` });
        continue;
      }
      seen.set(num, file);
      looseSeen.set(bookId, seen);
      const book = ensureBook(bookId, bookId, "", false);
      book.chapters.set(num, chapter);
      accepted.push({ path: relReport(abs), kind: "loose", authority: "loose-authoring", bookId, chapters: [num] });
    }
  }

  // Pass 3 — canonical-index membership (advisory: report, never block).
  for (const [bookId, book] of [...byBook].sort((a, b) => a[0].localeCompare(b[0]))) {
    const idxAbs = resolve(paths.indexesDir, `${bookId}.json`);
    if (!existsSync(idxAbs)) {
      add({ checkId: "library.missing_canonical_index", severity: "warning", path: relReport(idxAbs), bookId, reason: `no canonical index for on-disk book "${bookId}"` });
      continue;
    }
    const read = readJsonResult(idxAbs);
    if (!read.ok || !Array.isArray(read.value)) {
      add({ checkId: "library.malformed_canonical_index", severity: "warning", path: relReport(idxAbs), bookId, reason: "canonical index is unreadable or not an array" });
      continue;
    }
    const indexed = new Set<number>();
    for (const entry of read.value) if (isRecord(entry) && Number.isInteger(entry.chapterNumber)) indexed.add(Number(entry.chapterNumber));
    for (const numKey of [...book.chapters.keys()].sort((a, b) => a - b)) {
      if (!indexed.has(numKey)) add({ checkId: "library.missing_canonical_index_membership", severity: "warning", path: relReport(idxAbs), bookId, chapter: numKey, reason: `authoritative chapter ${numKey} is absent from the canonical index` });
    }
  }

  return { byBook, accepted, findings };
}

/** Ingest an already-resolved authoritative collection into a fresh ledger.
 *  Split out so a single audit can reuse one directory walk for both the
 *  findings and the rebuild instead of collecting twice. */
function rebuildFromCollection(byBook: AuthoritativeChapters["byBook"], opts: LibraryStateOptions): LibraryState {
  const state = emptyState(opts);
  for (const [bookId, book] of [...byBook].sort((a, b) => a[0].localeCompare(b[0]))) {
    for (const chapter of [...book.chapters.values()].sort((a, b) => a.number - b.number)) {
      ingestChapter(state, bookId, book.title, book.author, chapter, opts);
    }
  }
  state.revision = 0;
  state.lastUpdatedAt = iso(nowMs(opts));
  return normalizeState(state, opts);
}

export function rebuildLibraryState(opts: LibraryStateOptions = {}): LibraryState {
  return rebuildFromCollection(collectAuthoritativeChapters(opts).byBook, opts);
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value as Record<string, unknown>).sort().map((key) => `${JSON.stringify(key)}:${stable((value as Record<string, unknown>)[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

/** Project a contribution to its content-bound fields. `ingestedAt` is a
 *  wall-clock provenance stamp, fresh on every rebuild — excluding it (like the
 *  state-level lastUpdatedAt/revision and book-level generatedAt already are)
 *  is what makes the drift comparison deterministic across time, so a rebuilt
 *  ledger can actually verify clean. */
function logicalContribution(c: ChapterContribution): unknown {
  const { ingestedAt: _ingestedAt, ...rest } = c;
  return rest;
}

function logicalState(state: LibraryState): unknown {
  const normalized = normalizeState(state);
  return {
    version: normalized.version,
    policy: normalized.policy,
    books: Object.fromEntries(Object.entries(normalized.books).sort((a, b) => a[0].localeCompare(b[0])).map(([bookId, book]) => [
      bookId,
      {
        title: book.title,
        author: book.author,
        chapterCount: book.chapterCount,
        chaptersIngested: book.chaptersIngested,
        namesUsed: book.namesUsed,
        phrasesFlagged: book.phrasesFlagged,
        answerPositionCounts: book.answerPositionCounts,
        chapterContributions: Object.fromEntries(
          Object.entries(book.chapterContributions)
            .sort((a, b) => Number(a[0]) - Number(b[0]))
            .map(([key, contribution]) => [key, logicalContribution(contribution)]),
        ),
      },
    ])),
    globalNameUsage: normalized.globalNameUsage,
    globalPhraseUsage: normalized.globalPhraseUsage,
    globalAnswerPositionCounts: normalized.globalAnswerPositionCounts,
  };
}

export function verifyLibraryState(opts: LibraryStateOptions = {}): LibraryStateDriftReport {
  const actualState = loadLibraryState(opts);
  const expectedState = rebuildLibraryState(opts);
  const actual = logicalState(actualState);
  const expected = logicalState(expectedState);
  const differences: string[] = [];
  if (stable(actual) !== stable(expected)) {
    differences.push("stored logical state differs from recomputed authoritative chapter/package state");
  }
  return {
    statePath: pathsFor(opts).ledgerPath,
    drift: differences.length > 0,
    differences,
    actual,
    expected,
  };
}

export type LibraryAuditReport = {
  ledgerPath: string;
  drift: boolean;
  blockerCount: number;
  accepted: LibraryAcceptedFile[];
  /** Files/chapters rejected from the authoritative set (all blocker severity). */
  rejected: LibraryAuditFinding[];
  /** Package-vs-loose conflicts on published books (advisory; package wins). */
  conflicts: LibraryAuditFinding[];
  /** Other advisory findings (e.g. canonical-index membership). */
  warnings: LibraryAuditFinding[];
  findings: LibraryAuditFinding[];
  expectedLogicalState: unknown;
  actualLogicalState: unknown;
  plannedWrites: Array<{ path: string; action: string; reason: string }>;
};

const PACKAGE_LOOSE_CONFLICT_PREFIX = "library.package_loose";

/**
 * Full read-only audit of the authoritative inputs vs the stored ledger. This
 * is what `rebuild-library-state --dry-run --json` prints: accepted files,
 * rejected files, conflicts, the expected vs actual logical state, and the
 * writes a real rebuild WOULD perform. It never mutates state.
 */
export function auditLibraryInputs(opts: LibraryStateOptions = {}): LibraryAuditReport {
  const { byBook, accepted, findings } = collectAuthoritativeChapters(opts);
  // A corrupt stored ledger is itself a "corrupt input" — report it as a blocker
  // and treat the actual state as empty, so a dry run reports it deterministically
  // instead of crashing with an unhandled throw.
  let actualState: LibraryState;
  try {
    actualState = loadLibraryState(opts);
  } catch (err) {
    findings.push({ checkId: "library.unreadable_ledger", severity: "blocker", path: relReport(pathsFor(opts).ledgerPath), reason: `stored ledger could not be parsed: ${(err as Error).message}` });
    actualState = emptyState(opts);
  }
  const rejected = findings.filter((f) => f.severity === "blocker");
  const conflicts = findings.filter((f) => f.checkId.startsWith(PACKAGE_LOOSE_CONFLICT_PREFIX));
  const warnings = findings.filter((f) => f.severity !== "blocker" && !f.checkId.startsWith(PACKAGE_LOOSE_CONFLICT_PREFIX));
  const expected = logicalState(rebuildFromCollection(byBook, opts));
  const actual = logicalState(actualState);
  const drift = stable(actual) !== stable(expected);
  const plannedWrites =
    rejected.length === 0 && drift
      ? [{ path: relReport(pathsFor(opts).ledgerPath), action: "replace-ledger", reason: "stored ledger drifts from the authoritative inputs" }]
      : [];
  return {
    ledgerPath: relReport(pathsFor(opts).ledgerPath),
    drift,
    blockerCount: rejected.length,
    accepted,
    rejected,
    conflicts,
    warnings,
    findings,
    expectedLogicalState: expected,
    actualLogicalState: actual,
    plannedWrites,
  };
}

export type LibraryQuarantineResult = {
  quarantineDir: string;
  reportPath: string;
  movedFiles: Array<{ from: string; to: string }>;
  findings: LibraryAuditFinding[];
};

/**
 * Move every file that produced a blocker out of the authoritative set into a
 * timestamped quarantine dir (preserving its repo-relative layout) and write a
 * report capturing the findings. The original bytes are PRESERVED — the file is
 * renamed, never deleted — so the evidence survives for forensic review. This
 * is the dedicated, explicit escape hatch a real rebuild requires before it
 * will write past blockers.
 */
export function quarantineLibraryBlockers(opts: LibraryStateOptions = {}, label = "manual"): LibraryQuarantineResult {
  const paths = pathsFor(opts);
  const { findings } = collectAuthoritativeChapters(opts);
  const blockers = findings.filter((f) => f.severity === "blocker");
  const stamp = iso(nowMs(opts)).replace(/[:.]/g, "-");
  const quarantineDir = resolve(paths.stateDir, "_quarantine", `library-${stamp}-${label}`);
  mkdirSync(quarantineDir, { recursive: true });
  const movedFiles: Array<{ from: string; to: string }> = [];
  const movedAbs = new Set<string>();
  const move = (fromAbs: string, reason: string) => {
    if (movedAbs.has(fromAbs) || !existsSync(fromAbs)) return;
    const rel = relReport(fromAbs);
    const toAbs = resolve(quarantineDir, rel);
    mkdirSync(dirname(toAbs), { recursive: true });
    renameSync(fromAbs, toAbs);
    movedAbs.add(fromAbs);
    movedFiles.push({ from: `${rel} (${reason})`, to: relReport(toAbs) });
  };
  for (const finding of blockers) move(resolve(REPO_ROOT, finding.path), finding.checkId);
  // Quarantining a corrupt PACKAGE must not silently promote that book's loose
  // drafts to authoritative on the next rebuild. Pull the drafts of any
  // quarantined packaged book out together, so the book is removed entirely
  // (package + drafts) pending repair — never half-removed into a draft swap.
  const quarantinedPackageBooks = new Set<string>();
  for (const finding of blockers) {
    if (resolve(REPO_ROOT, finding.path).startsWith(paths.bookPackagesDir + "/")) {
      quarantinedPackageBooks.add(normSlug(basename(finding.path).replace(/\.v21\.json$|\.json$/i, "")));
    }
  }
  if (quarantinedPackageBooks.size > 0 && existsSync(paths.chaptersDir)) {
    for (const file of readdirSync(paths.chaptersDir).filter((f) => f.endsWith(".v21-native.chapter.json")).sort()) {
      const m = basename(file).match(LOOSE_FILE_RE);
      if (m && quarantinedPackageBooks.has(normSlug(m[1]))) move(resolve(paths.chaptersDir, file), "draft-of-quarantined-package");
    }
  }
  const reportPath = resolve(quarantineDir, "quarantine-report.json");
  writeFileSync(
    reportPath,
    JSON.stringify({ schemaVersion: "library-quarantine-v1", quarantinedAt: iso(nowMs(opts)), label, movedFiles, findings: blockers }, null, 2),
    "utf8",
  );
  return { quarantineDir, reportPath, movedFiles, findings: blockers };
}

export async function replaceWithRebuiltLibraryState(opts: LibraryStateOptions = {}): Promise<LibraryStateDriftReport> {
  let report = verifyLibraryState(opts);
  await withLibraryState(() => rebuildLibraryState(opts), opts);
  report = verifyLibraryState(opts);
  return report;
}

export function getLedgerPath(opts: LibraryStateOptions = {}): string {
  return pathsFor(opts).ledgerPath;
}

export function getLibraryStatePaths(opts: LibraryStateOptions = {}): LibraryStatePaths {
  return pathsFor(opts);
}
