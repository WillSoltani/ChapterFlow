/** The public-site step after a runtime publish: the file edits a checkout of main needs so the public grid shows the book,
 *  for a session to commit and open as a pull request. The verb never commits, pushes or opens the pull request.
 *
 *  Why it touches more than one title: a prod deploy re-uploads every file of main's book-packages/ to the content bucket
 *  (a BucketDeployment with prune off) whenever that folder changes. Titles republished at runtime leave older copies on
 *  main, and the deploy that follows any pull request touching book-packages/ would put those old copies back live. So
 *  every package in the checkout that differs from the live store is brought up to the live bytes ("the revert guard").
 *
 *  Order: everything that can refuse (preconditions, the live list, the fetches, the ledger's leaf) runs before the first
 *  write, so a refusal leaves the checkout as it was. The approval record is the last edit, since it hashes the final
 *  bookPackages.ts. See the spec this follows: what main needs for a new or replaced title, read from main itself. */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { awsPublisher, type Publisher } from "./publish";

// ---------------------------------------------------------------- the repo's paths (main)

export const REGISTRY = "app/book/data/bookPackages.ts";
export const METADATA = "lib/books-catalog.metadata.json";
export const CHAPTER_META = "app/book/data/book-chapter-meta.json";
export const PACKAGES_DIR = "book-packages";
export const CATALOG_GENERATOR = "scripts/book/generate-catalog-metadata.ts";
export const CHAPTER_META_GENERATOR = "scripts/book/generate-chapter-meta.ts";
/** Where generate-catalog-metadata.ts wrote before the file moved to lib/ (ac27796d2); nothing reads it. */
export const DEAD_METADATA = "app/book/data/booksCatalog.metadata.json";
export const COVER_SOURCE = "lib/use-book-cover-source.ts";
export const LEDGER = "scripts/ci/ws7-shared-repair-approvals.json";
export const LIVE_PREFIX = "book-content/packages/";
const TOOL_TAG = "v26 site";

// ---------------------------------------------------------------- the live store

/** The live packages, read-only. ETag and size for every book-content/packages/<bookId>.v21.json, and one file's bytes. */
export interface PackageStore {
  list(): Promise<Map<string, { etag: string; size: number }>>;
  get(bookId: string): Promise<Buffer>;
}

/** Runs one aws CLI call and returns its stdout. Injectable so the store is testable without AWS. */
export type AwsCli = (args: string[]) => string;

const defaultAws: AwsCli = (args) => execFileSync("aws", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 256 * 1024 * 1024 });

/** The content bucket the publisher resolves (same names, profile and region), through read-only aws CLI calls only:
 *  list-objects-v2 (paged by --starting-token) and get-object to a temp file. */
export function awsPackageStore(publisher: Publisher = awsPublisher(), aws: AwsCli = defaultAws): PackageStore {
  let names: ReturnType<Publisher["names"]> | undefined;
  const resolve = () => (names ??= publisher.names());
  return {
    async list() {
      const n = await resolve();
      const out = new Map<string, { etag: string; size: number }>();
      let token: string | undefined;
      do {
        const args = ["s3api", "list-objects-v2", "--bucket", n.contentBucket, "--prefix", LIVE_PREFIX, "--max-items", "1000", "--output", "json", "--profile", n.profile, "--region", n.region];
        if (token) args.push("--starting-token", token);
        const raw = aws(args).trim();
        const page = (raw === "" ? {} : JSON.parse(raw)) as { Contents?: Array<{ Key?: string; ETag?: string; Size?: number }>; NextToken?: string };
        for (const o of page.Contents ?? []) {
          const id = liveBookId(o.Key ?? "");
          if (id) out.set(id, { etag: String(o.ETag ?? "").replace(/^"|"$/g, ""), size: Number(o.Size ?? 0) });
        }
        token = page.NextToken;
      } while (token);
      return out;
    },
    async get(bookId) {
      const n = await resolve();
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), "v26-site-"));
      try {
        const file = path.join(dir, "package.json");
        aws(["s3api", "get-object", "--bucket", n.contentBucket, "--key", `${LIVE_PREFIX}${bookId}.v21.json`, "--profile", n.profile, "--region", n.region, file]);
        return fs.readFileSync(file);
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    },
  };
}

/** The bookId of a live package key, or null for anything else under the prefix (nested folders, other files). */
export function liveBookId(key: string): string | null {
  const m = /^book-content\/packages\/([^/]+)\.v21\.json$/.exec(key);
  return m ? m[1]! : null;
}

// ---------------------------------------------------------------- small pure helpers

export const md5 = (b: Buffer | string): string => createHash("md5").update(b).digest("hex");
export const sha256 = (b: Buffer | string): string => createHash("sha256").update(b).digest("hex");
/** A single-part upload's ETag is the MD5 of the bytes; a multipart one ("<hex>-<parts>") is not. */
export const isPlainMd5 = (etag: string): boolean => /^[0-9a-f]{32}$/.test(etag);
export const normalizeTitle = (t: string): string => t.trim().toLowerCase().replace(/\s+/g, " ");
/** The identifier the registry's auto imports use: every non-alphanumeric character becomes "_". */
export const importIdent = (id: string): string => `auto_${id.replace(/[^a-zA-Z0-9]/g, "_")}_Json`;
const importLine = (id: string): string => `import ${importIdent(id)} from "@/book-packages/${id}.v21.json";`;
export const isWired = (registry: string, id: string): boolean => registry.includes(`from "@/book-packages/${id}.v21.json"`);

/** The import goes after the last package import, the way register-web and publish-final place it. No-op when present. */
export function addRegistryImport(src: string, id: string): string {
  if (isWired(src, id)) return src;
  const lines = src.split("\n");
  let last = -1;
  lines.forEach((l, i) => {
    if (l.includes('from "@/book-packages/') && l.includes(".v21.json")) last = i;
  });
  if (last < 0) throw new Error(`SITE_REGISTRY_SHAPE: ${REGISTRY} has no package import to place ${id}'s after`);
  lines.splice(last + 1, 0, importLine(id));
  return lines.join("\n");
}

/** The self-contained block that pushes the package and registers its tone getter, appended at the end of the file. */
export function registryBlock(id: string): string {
  const ident = importIdent(id);
  return (
    `\n// --- auto-registered by \`${TOOL_TAG}\` for "${id}" (do not edit by hand) ---\n` +
    "{\n" +
    `  const __autoPkg = normalizeAnyPackage(${ident}, "direct");\n` +
    "  BOOK_PACKAGES.push(__autoPkg);\n" +
    `  BOOK_PACKAGE_TONE_GETTERS["${id}"] = (tone) => normalizeAnyPackage(${ident}, tone);\n` +
    "}\n"
  );
}

export function appendRegistryBlock(src: string, id: string): string {
  if (src.includes(`BOOK_PACKAGE_TONE_GETTERS["${id}"] =`)) return src;
  return src.replace(/\s*$/, "\n") + registryBlock(id);
}

/** What the presentation entry carries besides the synopsis. */
export interface PresentationFields {
  icon: string;
  difficulty: "Easy" | "Medium" | "Hard";
  pages: number;
}

/** Package fields the presentation reads (a v21 package, raw). */
export interface PackageLike {
  book: { bookId: string; title: string; categories?: string[]; tags?: string[] };
  chapters: Array<{ readingTimeMinutes?: number }>;
}

function hashText(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  return Math.abs(hash);
}

/** Icon, difficulty and pages as bookPackages.ts's inferFallbackPresentation picks them (copied from main, same order of
 *  rules), so an entry that only adds an authored synopsis shows the same icon the fallback would. */
export function inferredPresentation(pkg: PackageLike): PresentationFields {
  const categories = (pkg.book.categories ?? []).filter(Boolean);
  const tags = (pkg.book.tags ?? []).filter(Boolean);
  const source = [pkg.book.title, ...categories, ...tags].join(" ").toLowerCase();
  const normalized = source.replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  const tokens = new Set(normalized.split(" ").filter(Boolean));
  const hasAny = (...terms: string[]): boolean => terms.some((t) => (t.includes(" ") ? normalized.includes(t) : tokens.has(t)));
  const keyword: Array<[string[], string]> = [
    [["black swan", "swan"], "🦢"],
    [["checklist"], "✅"],
    [["forecast", "superforecasting"], "🔮"],
    [["mental model", "mental models"], "🧩"],
    [["denial of death", "death"], "🕯️"],
    [["gift of fear", "fear"], "🚨"],
    [["ultralearning"], "📚"],
    [["innovators dilemma", "innovation"], "💡"],
    [["noise"], "📉"],
    [["peak"], "🏔️"],
    [["war"], "⚔️"],
    [["money", "wealth", "finance"], "💰"],
  ];
  let icon = keyword.find(([terms]) => hasAny(...terms))?.[1];
  if (!icon) {
    const pools: Array<[(s: string) => boolean, string[]]> = [
      [(s) => s.includes("strategy"), ["♟️", "🧠", "🧭", "🎯", "⚖️"]],
      [(s) => s.includes("productivity"), ["⏱️", "📌", "🗂️", "✅", "🎯"]],
      [(s) => s.includes("learning") || s.includes("skill"), ["📘", "🧠", "📚", "🧪", "🛠️"]],
      [(s) => s.includes("communication") || s.includes("negotiation"), ["💬", "🗣️", "🤝", "🎤", "📣"]],
      [(s) => s.includes("philosophy") || s.includes("meaning"), ["🏛️", "🕯️", "📜", "🧭", "⚖️"]],
      [(s) => s.includes("business") || s.includes("startup"), ["📈", "🏢", "💼", "📊", "🚀"]],
      [(s) => s.includes("psychology") || s.includes("behavior"), ["🧠", "🫀", "🧭", "🧩", "👁️"]],
    ];
    const pool = pools.find(([test]) => test(source))?.[1] ?? ["📘", "📗", "📙", "📕", "📓"];
    icon = pool[hashText(pkg.book.bookId) % pool.length] ?? "📘";
  }
  const cats = categories.join(" ").toLowerCase();
  const difficulty = cats.includes("strategy") || cats.includes("philosophy") || cats.includes("decision making") ? "Hard" : "Medium";
  const minutes = pkg.chapters.reduce((sum, c) => sum + Math.max(Number(c.readingTimeMinutes) || 0, 1), 0);
  return { icon, difficulty, pages: Math.max(160, Math.round(minutes * 3.2)) };
}

/** An object key as prettier writes it: bare when it is an identifier, quoted otherwise. */
const objectKey = (id: string): string => (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(id) ? id : JSON.stringify(id));

/** The BOOK_PACKAGE_PRESENTATION entry in the file's own form (one field per line, the synopsis on its own line). */
export function presentationEntry(id: string, synopsis: string, f: PresentationFields): string {
  return [
    `  ${objectKey(id)}: {`,
    `    icon: ${JSON.stringify(f.icon)},`,
    `    coverImage: getBookCoverPath(${JSON.stringify(id)}),`,
    `    difficulty: ${JSON.stringify(f.difficulty)},`,
    "    synopsis:",
    `      ${JSON.stringify(synopsis)},`,
    `    pages: ${f.pages},`,
    "  },",
  ].join("\n");
}

/** The presentation object's body: from its declaration to its closing "};". */
function presentationRange(src: string): { start: number; close: number } {
  const start = src.indexOf("export const BOOK_PACKAGE_PRESENTATION");
  if (start < 0) throw new Error(`SITE_REGISTRY_SHAPE: ${REGISTRY} has no BOOK_PACKAGE_PRESENTATION`);
  const close = src.indexOf("\n};", start);
  if (close < 0) throw new Error(`SITE_REGISTRY_SHAPE: ${REGISTRY}: BOOK_PACKAGE_PRESENTATION has no closing "};"`);
  return { start, close };
}

export function hasPresentationEntry(src: string, id: string): boolean {
  const { start, close } = presentationRange(src);
  const body = src.slice(start, close);
  return body.includes(`\n  ${JSON.stringify(id)}: {`) || body.includes(`\n  ${objectKey(id)}: {`);
}

/** Adds the entry before the object's closing "};". No-op when the book already has one (an edit by hand stays). */
export function addPresentationEntry(src: string, id: string, synopsis: string, f: PresentationFields): string {
  if (hasPresentationEntry(src, id)) return src;
  const { close } = presentationRange(src);
  return `${src.slice(0, close)}\n${presentationEntry(id, synopsis, f)}${src.slice(close)}`;
}

/** The authored synopsis on one line; empty is refused. */
export function cleanSynopsis(s: string): string {
  const one = s.replace(/\s+/g, " ").trim();
  if (one === "") throw new Error("SITE_SYNOPSIS_EMPTY: --synopsis is empty");
  return one;
}

/** The generator's output path expression moved to lib/: only the string inside OUTPUT_FILE's path.join changes. */
export function fixGeneratorPath(src: string): string {
  const re = /(const OUTPUT_FILE = path\.join\(\s*ROOT,\s*)"app\/book\/data\/booksCatalog\.metadata\.json"/;
  if (re.test(src)) return src.replace(re, `$1"${METADATA}"`);
  if (src.includes(DEAD_METADATA)) throw new Error(`SITE_GENERATOR_SHAPE: ${CATALOG_GENERATOR} names ${DEAD_METADATA} somewhere other than its OUTPUT_FILE expression; fix it by hand`);
  return src;
}

/** Adds the id to FALLBACK_ONLY_BOOK_COVERS, one line, before the first entry that sorts after it (the set is kept sorted). */
export function addFallbackCover(src: string, id: string): string {
  const m = /const FALLBACK_ONLY_BOOK_COVERS = new Set\(\[\n((?:[ \t]*"[^"\n]*",\n)*)\]\);/.exec(src);
  if (!m) throw new Error(`SITE_COVER_SHAPE: ${COVER_SOURCE} has no FALLBACK_ONLY_BOOK_COVERS set in the expected form`);
  const lines = m[1]!.split("\n").filter(Boolean);
  const ids = lines.map((l) => /"([^"]*)"/.exec(l)![1]!);
  if (ids.includes(id)) return src;
  const indent = /^[ \t]*/.exec(lines[0] ?? "  ")![0] || "  ";
  const at = ids.findIndex((x) => x > id);
  lines.splice(at < 0 ? lines.length : at, 0, `${indent}${JSON.stringify(id)},`);
  const block = `const FALLBACK_ONLY_BOOK_COVERS = new Set([\n${lines.join("\n")}\n]);`;
  return src.slice(0, m.index) + block + src.slice(m.index + m[0].length);
}

export const isFallbackCover = (src: string, id: string): boolean => {
  const m = /const FALLBACK_ONLY_BOOK_COVERS = new Set\(\[([^\]]*)\]\);/.exec(src);
  return m !== null && m[1]!.includes(JSON.stringify(id));
};

// ---------------------------------------------------------------- the approval ledger (scripts/ci/verify-shared-ts-closure.mjs)

export interface LedgerRecord {
  recordId: string;
  changeId: string;
  purpose: "shared-maintenance";
  flag: null;
  path: string;
  appOwner: string;
  bookOwner: string;
  supersedesRecordId: string | null;
  repairedBlobSha256: string;
  evidenceRefs: string[];
}
type AnyRecord = { recordId: string; path: string; supersedesRecordId: string | null; appOwner?: string; bookOwner?: string };

/** Keys sorted at every depth, as the verifier's canonicalize does. */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((k) => [k, canonicalize((value as Record<string, unknown>)[k])]));
  }
  return value;
}
export const canonicalJson = (value: unknown): string => JSON.stringify(canonicalize(value));
export const recordIdOf = (body: Omit<LedgerRecord, "recordId">): string => sha256(canonicalJson(body));

/** The record for the path that no other record supersedes; null when the path has none. More than one is refused,
 *  since the verifier refuses it too. */
export function currentLeaf(records: AnyRecord[], file: string): AnyRecord | null {
  const superseded = new Set(records.map((r) => r.supersedesRecordId).filter((x): x is string => x !== null));
  const leaves = records.filter((r) => r.path === file && !superseded.has(r.recordId));
  if (leaves.length > 1) throw new Error(`SITE_LEDGER_LEAF: ${LEDGER} has ${leaves.length} current records for ${file}; the verifier refuses that too`);
  return leaves[0] ?? null;
}

/** Parses the ledger and checks it is in the form we write back (2-space JSON plus a newline), so the old records stay
 *  byte-identical when one is appended. */
export function readLedger(text: string): { schemaVersion?: unknown; records: AnyRecord[] } {
  let ledger: { records?: unknown };
  try {
    ledger = JSON.parse(text) as { records?: unknown };
  } catch (e) {
    throw new Error(`SITE_LEDGER_FORMAT: ${LEDGER} is not JSON (${(e as Error).message})`);
  }
  if (!Array.isArray(ledger.records)) throw new Error(`SITE_LEDGER_FORMAT: ${LEDGER} has no records array`);
  if (JSON.stringify(ledger, null, 2) + "\n" !== text) throw new Error(`SITE_LEDGER_FORMAT: ${LEDGER} is not 2-space JSON with a trailing newline; appending would rewrite its records`);
  return ledger as { records: AnyRecord[] };
}

/** The record that approves the new bytes of one shared file, owners copied from the leaf it supersedes. */
export function approvalRecord(records: AnyRecord[], file: string, finalBytes: Buffer | string, changeId: string, evidenceRefs: string[]): LedgerRecord {
  const leaf = currentLeaf(records, file);
  if (!leaf || !leaf.appOwner || !leaf.bookOwner) throw new Error(`SITE_LEDGER_NO_OWNER: ${LEDGER} has no current record for ${file} to copy appOwner and bookOwner from; add the record by hand`);
  const body: Omit<LedgerRecord, "recordId"> = {
    changeId,
    purpose: "shared-maintenance",
    flag: null,
    path: file,
    appOwner: leaf.appOwner,
    bookOwner: leaf.bookOwner,
    supersedesRecordId: leaf.recordId,
    repairedBlobSha256: sha256(finalBytes),
    evidenceRefs,
  };
  return { recordId: recordIdOf(body), ...body };
}

/** The ledger text with one more record; the existing text up to the end of the last record is kept byte for byte. */
export function appendLedgerRecord(text: string, record: LedgerRecord): string {
  const ledger = readLedger(text) as Record<string, unknown> & { records: unknown[] };
  const next = JSON.stringify({ ...ledger, records: [...ledger.records, record] }, null, 2) + "\n";
  const kept = text.slice(0, text.lastIndexOf("\n  ]"));
  if (ledger.records.length > 0 && !next.startsWith(kept)) throw new Error(`SITE_LEDGER_FORMAT: appending to ${LEDGER} would change its existing records`);
  return next;
}

// ---------------------------------------------------------------- the verb

export type Runner = (cmd: string, args: string[], cwd: string) => void;

const defaultRunner: Runner = (cmd, args, cwd) => {
  execFileSync(cmd, args, { cwd, stdio: "pipe", maxBuffer: 256 * 1024 * 1024 });
};

export interface SiteCtx {
  config: { bookId: string; runDir: string; title: string };
}

export interface SiteOptions {
  /** Absolute path to a clean checkout of main. */
  repo: string;
  /** Authored synopsis for a NEW title; without one the generic fallback applies. */
  synopsis?: string;
  dryRun?: boolean;
  store?: PackageStore;
  run?: Runner;
  now?: () => Date;
}

export interface SyncedPackage {
  bookId: string;
  file: string;
  /** null when the checkout had no file for it. */
  oldMd5: string | null;
  newMd5: string;
  sha256: string;
  size: number;
}

export interface SiteReport {
  bookId: string;
  title: string;
  kind: "new" | "replaced";
  dryRun: boolean;
  /** Packages brought up to the live bytes (or that would be, in a dry run). */
  synced: SyncedPackage[];
  /** Packages in the checkout that the live store does not have; left alone. */
  repoOnly: string[];
  /** How many packages already equalled the live store. */
  equal: number;
  /** Repo-relative paths the caller stages with `git add` (in a dry run: what would change, generated files excluded). */
  filesChanged: string[];
  ledgerRecordId: string | null;
  supersedesRecordId: string | null;
  synopsis: "authored" | "generic";
  cover: "file" | "fallback" | "missing";
  generatorPathFixed: boolean;
  /** Ids whose rows or chapter lists the regeneration changed, other than this title (unrelated drift). */
  drift: { metadata: string[]; chapterMeta: string[] };
  notes: string[];
  /** The commands the caller still has to run. */
  next: string[];
  prBody: string | null;
  reportFile: string | null;
}

const rel = (...p: string[]): string => p.join("/");
const pkgRel = (id: string): string => rel(PACKAGES_DIR, `${id}.v21.json`);
/** A path as one shell word. */
const sh = (s: string): string => (/^[\w./@:=+-]+$/.test(s) ? s : `'${s.replace(/'/g, `'\\''`)}'`);

function git(repo: string, args: string[]): string {
  return execFileSync("git", ["-C", repo, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

/** The repo must be main's layout and clean, so the verb's edits are the only ones a caller stages. */
function checkRepo(repo: string): void {
  for (const f of [REGISTRY, METADATA, PACKAGES_DIR]) {
    if (!fs.existsSync(path.join(repo, f))) throw new Error(`SITE_REPO_INVALID: ${repo} has no ${f}; give --repo a checkout of main`);
  }
  let status: string;
  let top: string;
  try {
    top = git(repo, ["rev-parse", "--show-toplevel"]).trim();
    status = git(repo, ["status", "--porcelain", "--untracked-files=no"]);
  } catch (e) {
    throw new Error(`SITE_REPO_INVALID: ${repo} is not a git checkout (${(e as Error).message.split("\n")[0]})`);
  }
  // git walks up from a subfolder, so a main-shaped folder inside another repo would pass the clean check for that repo.
  if (fs.realpathSync(top) !== fs.realpathSync(repo)) throw new Error(`SITE_REPO_INVALID: ${repo} is not the root of a git checkout (its repo is ${top})`);
  if (status.trim() !== "") throw new Error(`SITE_REPO_DIRTY: ${repo} has uncommitted changes; the verb's edits must not mix with them:\n${status.trimEnd()}`);
  // An earlier run of the unfixed generator leaves this untracked file; it would be mistaken for this run's output.
  if (fs.existsSync(path.join(repo, DEAD_METADATA))) throw new Error(`SITE_REPO_DIRTY: ${repo} has an untracked ${DEAD_METADATA} (an old generator run wrote the dead path); delete it first`);
}

type MetadataRow = { id?: unknown; title?: unknown } & Record<string, unknown>;

function readMetadata(repo: string): MetadataRow[] {
  try {
    const rows = JSON.parse(fs.readFileSync(path.join(repo, METADATA), "utf8")) as unknown;
    if (!Array.isArray(rows)) throw new Error("not an array");
    return rows as MetadataRow[];
  } catch (e) {
    throw new Error(`SITE_REPO_INVALID: ${METADATA} is not a JSON array (${(e as Error).message})`);
  }
}

/** Ids whose entry differs between two JSON files keyed by id (an array of rows or an object), this title left out. */
function changedIds(before: string | null, after: string | null, skip: string): string[] {
  const index = (text: string | null): Map<string, string> => {
    if (text === null) return new Map();
    try {
      const v = JSON.parse(text) as unknown;
      const entries: Array<[string, unknown]> = Array.isArray(v) ? v.map((r) => [String((r as MetadataRow).id), r]) : Object.entries(v as Record<string, unknown>);
      return new Map(entries.map(([k, r]) => [k, JSON.stringify(r)]));
    } catch {
      return new Map();
    }
  };
  const a = index(before);
  const b = index(after);
  return [...new Set([...a.keys(), ...b.keys()])].filter((k) => k !== skip && a.get(k) !== b.get(k)).sort();
}

const readOrNull = (file: string): string | null => (fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null);
const readBytesOrNull = (file: string): Buffer | null => (fs.existsSync(file) ? fs.readFileSync(file) : null);

/** The repo's own tsx, which the generators run through. */
export const TSX_BIN = "node_modules/.bin/tsx";

const storeFailed = (e: unknown): Error =>
  new Error(`SITE_STORE_FAILED: ${String(e instanceof Error ? e.message : e).split("\n")[0]}; check that the aws CLI is installed and that AWS_PROFILE and the SSM names resolve`);

export async function siteBook(ctx: SiteCtx, opts: SiteOptions): Promise<SiteReport> {
  const { bookId, runDir, title } = ctx.config;
  const repo = path.resolve(opts.repo);
  const dryRun = opts.dryRun === true;
  const now = opts.now?.() ?? new Date();
  const notes: string[] = [];

  // 1. Preconditions.
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(bookId)) throw new Error(`SITE_BAD_ID: "${bookId}" is not kebab-case; the registry and its tests key books by kebab-case ids`);
  const publishFile = path.join(runDir, "publish.json");
  if (!fs.existsSync(publishFile)) throw new Error(`SITE_NOT_PUBLISHED: ${publishFile} does not exist; run publish first (the site step wires a book that is already live)`);
  const packageId = (JSON.parse(fs.readFileSync(publishFile, "utf8")) as { packageId?: string }).packageId ?? null;
  checkRepo(repo);
  // Without the repo's own tsx, npx (stdin not a TTY) would install whatever tsx the registry serves, after the edits.
  if (!dryRun && !fs.existsSync(path.join(repo, TSX_BIN))) throw new Error(`SITE_REPO_INVALID: ${repo} has no ${TSX_BIN} (run npm ci there first)`);

  // 2. The live list. A store failure (no aws CLI, a wrong profile, an SSM name) comes before any write.
  const store = opts.store ?? awsPackageStore();
  let live: Map<string, { etag: string; size: number }>;
  try {
    live = await store.list();
  } catch (e) {
    throw storeFailed(e);
  }
  if (!live.has(bookId)) throw new Error(`SITE_NOT_LIVE: ${LIVE_PREFIX}${bookId}.v21.json is not in the live store`);

  // 3. New or replaced.
  const registryFile = path.join(repo, REGISTRY);
  const registry = fs.readFileSync(registryFile, "utf8");
  const metadata = readMetadata(repo);
  const imported = isWired(registry, bookId);
  const row = metadata.some((r) => r.id === bookId);
  if (imported !== row) {
    throw new Error(`SITE_HALF_WIRED: ${bookId} is ${imported ? `imported in ${REGISTRY} but has no row in ${METADATA}` : `in ${METADATA} but not imported in ${REGISTRY}`}; settle it by hand first`);
  }
  const kind: SiteReport["kind"] = imported ? "replaced" : "new";
  if (kind === "new") {
    const dup = metadata.find((r) => typeof r.title === "string" && normalizeTitle(r.title) === normalizeTitle(title));
    if (dup) throw new Error(`SITE_DUPLICATE_TITLE: "${title}" is already in ${METADATA} as ${String(dup.id)}; the catalog integrity gate refuses two rows with one title`);
  }

  // 4. The revert guard: every package the live store has, at its live bytes. Fetches happen before any write.
  const pkgDir = path.join(repo, PACKAGES_DIR);
  const repoIds = fs.readdirSync(pkgDir).flatMap((f) => {
    const m = /^(.+)\.v21\.json$/.exec(f);
    return m ? [m[1]!] : [];
  });
  const repoOnly = repoIds.filter((id) => !live.has(id)).sort();
  // An untracked package (say, left by an interrupted run) counts as missing: written and staged, never skipped as equal,
  // so the commit cannot import a file it does not hold.
  const untracked = new Set(git(repo, ["ls-files", "--others", "--exclude-standard", "--", PACKAGES_DIR]).split("\n").filter(Boolean));
  const writes = new Map<string, Buffer>();
  const synced: SyncedPackage[] = [];
  let equal = 0;
  for (const id of [...new Set([...repoIds.filter((x) => live.has(x)), bookId])].sort()) {
    const { etag, size } = live.get(id)!;
    const file = path.join(repo, pkgRel(id));
    const have = fs.existsSync(file) && !untracked.has(pkgRel(id)) ? fs.readFileSync(file) : null;
    if (have && isPlainMd5(etag) && md5(have) === etag) {
      equal++;
      continue;
    }
    let bytes: Buffer;
    try {
      bytes = await store.get(id);
    } catch (e) {
      throw storeFailed(e);
    }
    if ((isPlainMd5(etag) && md5(bytes) !== etag) || bytes.length !== size) {
      throw new Error(`SITE_FETCH_MISMATCH: the fetched ${id} package (md5 ${md5(bytes)}, ${bytes.length} bytes) does not match the live listing (ETag ${etag}, ${size} bytes)`);
    }
    // A multipart ETag says nothing about the bytes, so the fetch is the comparison.
    if (have && have.equals(bytes)) {
      equal++;
      continue;
    }
    writes.set(pkgRel(id), bytes);
    synced.push({ bookId: id, file: pkgRel(id), oldMd5: have ? md5(have) : null, newMd5: md5(bytes), sha256: sha256(bytes), size: bytes.length });
  }

  // 5. The registry (new titles only): the import, the presentation entry when a synopsis was authored, the block.
  let nextRegistry = registry;
  let synopsis: SiteReport["synopsis"] = hasPresentationEntry(registry, bookId) ? "authored" : "generic";
  if (kind === "new") {
    nextRegistry = addRegistryImport(nextRegistry, bookId);
    if (opts.synopsis !== undefined) {
      const bytes = writes.get(pkgRel(bookId)) ?? fs.readFileSync(path.join(repo, pkgRel(bookId)));
      const pkg = JSON.parse(bytes.toString("utf8")) as PackageLike;
      nextRegistry = addPresentationEntry(nextRegistry, bookId, cleanSynopsis(opts.synopsis), inferredPresentation(pkg));
      synopsis = "authored";
    }
    nextRegistry = appendRegistryBlock(nextRegistry, bookId);
  } else if (opts.synopsis !== undefined) {
    notes.push(`--synopsis was not used: ${bookId} is already wired, and its presentation entry is edited by hand`);
  }
  const registryChanged = nextRegistry !== registry;
  if (registryChanged) writes.set(REGISTRY, Buffer.from(nextRegistry));

  // 6. The generator's dead output path.
  const generatorFile = path.join(repo, CATALOG_GENERATOR);
  const generator = readOrNull(generatorFile);
  const fixedGenerator = generator === null ? null : fixGeneratorPath(generator);
  const generatorPathFixed = generator !== null && fixedGenerator !== generator;
  if (generatorPathFixed) writes.set(CATALOG_GENERATOR, Buffer.from(fixedGenerator!));
  if (generator === null) notes.push(`${CATALOG_GENERATOR} not found; the metadata regeneration will fail`);

  // 7. The cover (new titles only): no raster means the fallback tile at once, with no 404s first.
  const coverFile = path.join(repo, "public/book-covers", `${bookId}.webp`);
  const coverSrc = readOrNull(path.join(repo, COVER_SOURCE));
  let cover: SiteReport["cover"] = fs.existsSync(coverFile) ? "file" : coverSrc !== null && isFallbackCover(coverSrc, bookId) ? "fallback" : "missing";
  if (kind === "new" && cover === "missing") {
    if (coverSrc === null) throw new Error(`SITE_COVER_SHAPE: ${COVER_SOURCE} not found`);
    writes.set(COVER_SOURCE, Buffer.from(addFallbackCover(coverSrc, bookId)));
    cover = "fallback";
  }

  // 9 (checked now). The ledger's leaf and form, so a ledger that cannot take the record refuses before any write.
  const ledgerFile = path.join(repo, LEDGER);
  const ledgerText = registryChanged ? readOrNull(ledgerFile) : null;
  const changeId = `v26-site-${bookId}-${now.toISOString().slice(0, 10)}`;
  const evidenceRefs = [pkgRel(bookId), `scripts/book/v26 site verb: public catalog wiring for ${bookId}`];
  let planned: LedgerRecord | null = null;
  if (registryChanged) {
    if (ledgerText === null) throw new Error(`SITE_LEDGER_NO_OWNER: ${LEDGER} not found`);
    planned = approvalRecord(readLedger(ledgerText).records, REGISTRY, nextRegistry, changeId, evidenceRefs);
  }

  const filesChanged = [...writes.keys()];
  const drift = { metadata: [] as string[], chapterMeta: [] as string[] };
  let record = planned;
  if (dryRun) {
    if (planned) filesChanged.push(LEDGER);
    notes.push(`dry run: nothing written; the generators would also rewrite ${METADATA} and ${CHAPTER_META}`);
  } else {
    // From the first write on, a failure puts every file back as it was, so a rerun starts from a clean checkout instead
    // of a refusal (dirty) or a cleanup that leaves this run's untracked package behind.
    const originals = new Map([...writes.keys(), METADATA, CHAPTER_META, LEDGER, DEAD_METADATA].map((f) => [f, readBytesOrNull(path.join(repo, f))]));
    try {
      for (const [f, bytes] of writes) fs.writeFileSync(path.join(repo, f), bytes);

      // 8. The generated files, from the edited registry. `--no`: npx must never install a package.
      const before = { metadata: readOrNull(path.join(repo, METADATA)), chapterMeta: readOrNull(path.join(repo, CHAPTER_META)) };
      const run = opts.run ?? defaultRunner;
      for (const script of [CATALOG_GENERATOR, CHAPTER_META_GENERATOR]) {
        try {
          run("npx", ["--no", "tsx", script], repo);
        } catch (e) {
          const err = e as { message?: string; stderr?: Buffer | string };
          throw new Error(`SITE_GENERATOR_FAILED: ${script} failed in ${repo} (${String(err.stderr ?? err.message ?? e).trim().slice(-800)})`);
        }
      }
      if (fs.existsSync(path.join(repo, DEAD_METADATA))) throw new Error(`SITE_DEAD_PATH_WRITTEN: the generator wrote ${DEAD_METADATA}, which nothing reads; ${METADATA} was not refreshed`);
      const after = { metadata: readOrNull(path.join(repo, METADATA)), chapterMeta: readOrNull(path.join(repo, CHAPTER_META)) };
      if (!readMetadata(repo).some((r) => r.id === bookId)) throw new Error(`SITE_GENERATOR_NO_ROW: ${METADATA} has no row for ${bookId} after the generator ran`);
      if (after.metadata !== before.metadata) filesChanged.push(METADATA);
      if (after.chapterMeta !== before.chapterMeta) filesChanged.push(CHAPTER_META);
      drift.metadata = changedIds(before.metadata, after.metadata, bookId).filter((id) => !synced.some((s) => s.bookId === id));
      drift.chapterMeta = changedIds(before.chapterMeta, after.chapterMeta, bookId).filter((id) => !synced.some((s) => s.bookId === id));

      // 9. The approval record, last: it hashes bookPackages.ts as it is now on disk.
      if (registryChanged) {
        const finalBytes = fs.readFileSync(registryFile);
        record = approvalRecord(readLedger(ledgerText!).records, REGISTRY, finalBytes, changeId, evidenceRefs);
        fs.writeFileSync(ledgerFile, appendLedgerRecord(ledgerText!, record));
        filesChanged.push(LEDGER);
      }
    } catch (e) {
      for (const [f, bytes] of originals) {
        if (bytes === null) fs.rmSync(path.join(repo, f), { force: true });
        else fs.writeFileSync(path.join(repo, f), bytes);
      }
      if (e instanceof Error) e.message += "; the checkout was restored";
      throw e;
    }
  }

  const report: SiteReport = {
    bookId,
    title,
    kind,
    dryRun,
    synced,
    repoOnly,
    equal,
    filesChanged,
    ledgerRecordId: record?.recordId ?? null,
    supersedesRecordId: record?.supersedesRecordId ?? null,
    synopsis,
    cover,
    generatorPathFixed,
    drift,
    notes,
    next: [],
    prBody: null,
    reportFile: null,
  };
  report.next = nextCommands(repo, report, runDir);
  // A run that changed nothing (say, after the commit) keeps the earlier body: rebuilt now, it would describe a refresh.
  if (!dryRun && filesChanged.length > 0) {
    fs.mkdirSync(runDir, { recursive: true });
    report.prBody = path.join(runDir, "site-pr.md");
    report.reportFile = path.join(runDir, "site.json");
    fs.writeFileSync(report.prBody, prBody(report, packageId));
    fs.writeFileSync(report.reportFile, JSON.stringify(report, null, 2) + "\n");
  }
  return report;
}

/** The package and catalog tests the spec lists, all of them reading book-packages/ or the metadata. */
export const SITE_TESTS = [
  "lib/category-taxonomy.test.ts",
  "lib/catalog-integrity-gate.test.ts",
  "lib/book-covers.test.ts",
  "lib/library-catalog-stub.test.ts",
  "app/book/data/bookPackages.test.ts",
  "app/book/data/bookPackages.slim-contract.test.ts",
  "app/book/data/book-package-normalize-roundtrip.test.ts",
  "app/app/api/book/_lib/v21-adapter.test.ts",
  "app/app/api/book/_lib/book-packages-title-quality.test.ts",
  "components/ui/BookCover.optimizer.test.ts",
];

/** What the caller runs after the verb: commit by explicit path (the shared-closure check compares commits), the checks,
 *  the push and the pull request. */
function nextCommands(repo: string, r: SiteReport, runDir: string): string[] {
  if (r.dryRun) return [`run again without --dry-run to make these edits in ${repo}`];
  if (r.filesChanged.length === 0) return [`nothing to commit: ${repo} already matches the live store for ${r.bookId}`];
  const files = r.filesChanged.map(sh).join(" ");
  let branch = "";
  try {
    branch = git(repo, ["rev-parse", "--abbrev-ref", "HEAD"]).trim();
  } catch {
    branch = "";
  }
  const cmds = [`cd ${sh(repo)}`];
  if (branch === "main" || branch === "HEAD" || branch === "") cmds.push(`git switch -c books/site-${r.bookId}`);
  cmds.push(
    `git add -- ${files}`,
    `git commit -m ${sh(`books(site): ${r.kind === "new" ? "wire" : "refresh"} ${r.bookId} on the public catalog`)} -- ${files}`,
    `npm run typecheck:shared-closure -- --base "$(git merge-base origin/main HEAD)" --report "$TMPDIR/sc.json"   # expect: shared TypeScript closure: PASS${r.ledgerRecordId ? ", mode: prepare" : ""}`,
    `npx tsx --test ${SITE_TESTS.join(" ")}   # expect 0 failed`,
    "npm run verify   # expect exit 0",
    `npx tsx scripts/ci/check-cover-coverage.ts --warn-only   # ${r.cover === "file" ? `${r.bookId} must not be listed` : `${r.bookId} may be listed: it is in the fallback set`}`,
    `git status --short   # expect no ${DEAD_METADATA}`,
    "git push -u origin HEAD",
    `gh pr create --base main --title ${sh(`books(site): ${r.title} on the public catalog`)} --body-file ${sh(path.join(runDir, "site-pr.md"))}`,
  );
  return cmds;
}

/** The pull request body: what merging does and does not do, and what the deploy after it will upload. */
export function prBody(r: SiteReport, packageId: string | null): string {
  const others = r.synced.filter((s) => s.bookId !== r.bookId);
  const lines: string[] = [];
  lines.push(`## ${r.title}: public catalog ${r.kind === "new" ? "wiring (new title)" : "refresh (replaced title)"}`, "");
  lines.push(`Prepared by the v26 tool's \`site\` verb. \`${r.bookId}\` is already live at runtime${packageId ? ` (package \`${packageId}\`)` : ""}; this pull request brings main's static catalog and packages up to it.`, "");

  lines.push("### Merging changes nothing live", "");
  lines.push("Merging only changes main. The public grid, the chapter metadata and the packages change on the next prod deploy, which the owner runs and approves:", "");
  lines.push("```", "gh workflow run deploy.yml --ref main -f environment=prod -f deploy_app=true", "```", "");

  lines.push("### The deploy re-uploads every package", "");
  lines.push("That deploy uploads every `book-packages/*.v21.json` to the content bucket (`DeployBookPackages`, prune off) whenever the folder changed, over the live copies the server grades quizzes from. Every package this pull request changes equals the live store byte for byte (md5 = the live ETag):", "");
  if (r.synced.length > 0) {
    lines.push("| File | md5 (live ETag) | sha256 | Bytes | Was |", "|---|---|---|---|---|");
    for (const s of r.synced) lines.push(`| \`${s.file}\` | \`${s.newMd5}\` | \`${s.sha256}\` | ${s.size} | ${s.oldMd5 ? `md5 \`${s.oldMd5}\` (older)` : "not in main"} |`);
  } else {
    lines.push("No package changes: every package already equalled the live store.");
  }
  lines.push("", `The other ${r.equal} package${r.equal === 1 ? "" : "s"} in \`book-packages/\` already equalled the live store.${r.repoOnly.length > 0 ? ` ${r.repoOnly.length} ${r.repoOnly.length === 1 ? "is" : "are"} only in the repo (not in the live store) and ${r.repoOnly.length === 1 ? "was" : "were"} left alone: ${r.repoOnly.map((x) => `\`${x}\``).join(", ")}.` : ""}`, "");

  lines.push("### Titles the revert guard brought along", "");
  if (others.length > 0) {
    lines.push(`Main held older copies of these titles than the live store (they were republished at runtime). Without them here, the deploy after this pull request would overwrite the live packages with main's old ones, and quizzes, answer keys, ask and audio text would revert for every reader:`, "");
    for (const s of others) lines.push(`- \`${s.bookId}\``);
  } else {
    lines.push("None: no other package in main differed from the live store.");
  }
  lines.push("");

  lines.push("### Regenerated files", "");
  lines.push(`\`${METADATA}\` and \`${CHAPTER_META}\` are regenerated from every wired package, so their diff can carry drift unrelated to \`${r.bookId}\`, for titles whose packages changed without a regeneration.`);
  if (r.drift.metadata.length > 0) lines.push(`- Catalog rows that changed for other titles: ${r.drift.metadata.map((x) => `\`${x}\``).join(", ")}.`);
  if (r.drift.chapterMeta.length > 0) lines.push(`- Chapter lists that changed or were added for other titles: ${r.drift.chapterMeta.length} (${r.drift.chapterMeta.slice(0, 40).map((x) => `\`${x}\``).join(", ")}${r.drift.chapterMeta.length > 40 ? ", ..." : ""}).`);
  if (r.generatorPathFixed) lines.push(`- \`${CATALOG_GENERATOR}\` wrote to \`${DEAD_METADATA}\`, which nothing reads since the file moved to \`lib/\`; its output path now points at \`${METADATA}\` (that one string only).`);
  lines.push("");

  lines.push("### Synopsis and cover", "");
  lines.push(r.synopsis === "authored"
    ? `- Synopsis: authored, in \`BOOK_PACKAGE_PRESENTATION\` in \`${REGISTRY}\` (the only place it survives regeneration).`
    : `- Synopsis: generic. No authored synopsis, so the catalog shows the fallback "A modern reading of <tags> with concise summaries, scenarios, quizzes, and gated chapter progression."`);
  lines.push(r.cover === "file"
    ? `- Cover: \`public/book-covers/${r.bookId}.webp\` is in the repo.`
    : r.cover === "fallback"
      ? `- Cover: no cover file, so \`${r.bookId}\` is in \`FALLBACK_ONLY_BOOK_COVERS\` (\`${COVER_SOURCE}\`): the designed title tile shows at once, with no 404s first. Remove it there when a cover pair lands.`
      : `- Cover: no cover file and not in the fallback set; the grid tries four URLs before the title tile.`);
  lines.push("");

  lines.push("### Shared-file approval", "");
  if (r.ledgerRecordId) {
    lines.push(`\`${REGISTRY}\` is a guarded shared file, so this pull request appends one approval record to \`${LEDGER}\`: \`${r.ledgerRecordId}\`, superseding \`${r.supersedesRecordId}\`. **Merging this pull request is the approval.** If another pull request that changes \`${REGISTRY}\` merges first, this record supersedes a stale leaf and CI fails: rebase and run the verb again on a fresh branch.`);
  } else {
    lines.push(`No change to \`${REGISTRY}\`, so no approval record.`);
  }
  lines.push("");
  lines.push("### CI", "", "The film job runs because the catalog files changed (about 15 minutes per shard); it is not required.", "");
  if (r.notes.length > 0) lines.push("### Notes", "", ...r.notes.map((n) => `- ${n}`), "");
  return lines.join("\n");
}
