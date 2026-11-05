/** The publish step behind the gate: the landed chapters become one v21-authored book package, the app's validator
 *  checks it, and (unless --dry-run) it is committed on the current branch, uploaded to the content bucket the server
 *  reads at runtime, registered in the API catalog that the logged-in library and iOS read, and checked live. The
 *  static bundled catalog (the public grid) changes only on a web deploy the owner approves; a new book still needs that.
 *
 *  Band rules come from <runDir>/score.json (the `score` verb): auto publishes; manual needs --approve (the owner's
 *  yes); fail refuses and names the chapters to redo. A score older than any chapter's final.json is stale. */
import { execFileSync, spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import type { PipelineCtx } from "./pipeline";
import type { BookScore } from "./score";
import type { Chapter } from "./types";
import { wordsIn } from "./validate";

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const chapterName = (n: number): string => `ch${String(n).padStart(2, "0")}`;

export interface BookPackage {
  schemaVersion: "chapterflow-v21-authored";
  packageId: string;
  createdAt: string;
  contentOwner: "chapterflow";
  book: { bookId: string; title: string; author: string; categories: string[]; tags: string[] };
  chapters: Array<{ chapterId: string; number: number; readingTimeMinutes: number } & Chapter>;
}

/** The names the AWS steps need; from the environment, else SSM /chapterflow/<env>/BOOK_*. */
export interface AwsNames { table: string; contentBucket: string; ingestBucket: string; region: string; profile: string }

/** The outward steps, behind an interface so tests run with fakes. */
export interface Publisher {
  names(): Promise<AwsNames>;
  putPackage(names: AwsNames, key: string, body: string): Promise<void>;
  register(names: AwsNames, bookId: string): Promise<string>;
  verifyLive(bookId: string, packageId: string): Promise<{ ok: boolean; detail: string }>;
}

export interface PublishOptions {
  dryRun?: boolean;
  approve?: boolean;
  /** Where the package file goes; default <repo>/book-packages. */
  packagesDir?: string;
  /** Skip git (tests, or a run dir outside the repo). */
  noGit?: boolean;
  publisher?: Publisher;
  now?: () => Date;
}

export interface PublishReport {
  bookId: string;
  band: BookScore["band"];
  score: number;
  outcome: "published" | "dry-run" | "needs-approval" | "refused";
  reasons: string[];
  packageFile?: string;
  packageId?: string;
  steps: string[];
  /** What the owner still has to do (the static catalog wiring and the prod deploy for a new book). */
  remaining: string[];
}

function readJson<T>(file: string): T | null {
  return fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf8")) as T) : null;
}

/** Every landed chapter, in order, with the three fields the package adds. */
export function buildPackage(ctx: PipelineCtx, now: Date = new Date()): BookPackage {
  const { bookId, title, author, categories, tags, runDir } = ctx.config;
  const numbers = ctx.source.spans.map((s) => s.chapterNumber).sort((a, b) => a - b);
  const chapters = numbers.flatMap((n) => {
    const c = readJson<Chapter>(path.join(runDir, chapterName(n), "final.json"));
    if (!c) return [];
    return [{ chapterId: `${bookId}-${chapterName(n)}`, number: n, readingTimeMinutes: Math.max(1, Math.round(wordsIn(c.breakdown.fullRead) / 230)), ...c }];
  });
  return {
    schemaVersion: "chapterflow-v21-authored",
    packageId: `${bookId}-v26-${now.getTime()}`,
    createdAt: now.toISOString(),
    contentOwner: "chapterflow",
    book: { bookId, title, author, categories, tags },
    chapters,
  };
}

/** The app's own validator and its category taxonomy, as the ingest path runs them. */
export async function validatePackage(pkg: BookPackage, expectedChapters: number): Promise<string[]> {
  const problems: string[] = [];
  if (pkg.chapters.length !== expectedChapters) problems.push(`${pkg.chapters.length} of ${expectedChapters} chapters have landed`);
  try {
    const { validateBookPackage } = await import("@/app/app/api/book/_lib/validate-book-package");
    validateBookPackage(pkg as unknown as Record<string, unknown>);
  } catch (err) {
    const e = err as { message?: string; issues?: unknown; details?: unknown };
    problems.push(`app validator: ${e.message ?? String(err)}${e.issues ?? e.details ? ` ${JSON.stringify(e.issues ?? e.details).slice(0, 400)}` : ""}`);
  }
  try {
    const taxonomy = (await import("@/lib/category-taxonomy")) as { isCanonicalCategory?: (c: string) => boolean; CANONICAL_CATEGORIES?: readonly string[] };
    const known = taxonomy.isCanonicalCategory ?? ((c: string) => (taxonomy.CANONICAL_CATEGORIES ?? []).includes(c));
    for (const c of pkg.book.categories) if (!known(c)) problems.push(`category "${c}" is not canonical`);
  } catch {
    problems.push("category taxonomy could not be loaded");
  }
  return problems;
}

/** The band from score.json, refused when the score is missing or older than a landed chapter. */
export function gateFor(ctx: PipelineCtx): { ok: true; score: BookScore } | { ok: false; reason: string } {
  const file = path.join(ctx.config.runDir, "score.json");
  const score = readJson<BookScore>(file);
  if (!score) return { ok: false, reason: `no score yet: run \`score --book <cfg>\` first (${file})` };
  const at = Date.parse(score.at);
  for (const c of score.chapters) {
    const f = path.join(ctx.config.runDir, chapterName(c.chapter), "final.json");
    if (fs.existsSync(f) && fs.statSync(f).mtimeMs > at) return { ok: false, reason: `${chapterName(c.chapter)} changed after the score; run \`score\` again` };
  }
  return { ok: true, score };
}

/** The real outward steps: SSM for the names, S3 for the package, the repo's register script for the catalog, the live API for the check. */
export function awsPublisher(): Publisher {
  const env = process.env.CHAPTERFLOW_ENV ?? "prod";
  return {
    async names() {
      const region = process.env.AWS_REGION ?? "us-east-1";
      const profile = process.env.AWS_PROFILE ?? "chapterflow";
      process.env.AWS_PROFILE = profile;
      const want = { table: "BOOK_TABLE_NAME", contentBucket: "BOOK_CONTENT_BUCKET", ingestBucket: "BOOK_INGEST_BUCKET" } as const;
      const got: Record<string, string> = {};
      const missing = (Object.entries(want) as Array<[keyof typeof want, string]>).filter(([k, v]) => {
        if (process.env[v]) got[k] = process.env[v] as string;
        return !process.env[v];
      });
      if (missing.length > 0) {
        const { SSMClient, GetParameterCommand } = await import("@aws-sdk/client-ssm");
        const ssm = new SSMClient({ region });
        for (const [k, v] of missing) {
          const r = await ssm.send(new GetParameterCommand({ Name: `/chapterflow/${env}/${v}` }));
          if (!r.Parameter?.Value) throw new Error(`SSM /chapterflow/${env}/${v} has no value`);
          got[k] = r.Parameter.Value;
        }
      }
      return { table: got.table!, contentBucket: got.contentBucket!, ingestBucket: got.ingestBucket!, region, profile };
    },
    async putPackage(names, key, body) {
      const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
      const s3 = new S3Client({ region: names.region });
      await s3.send(new PutObjectCommand({ Bucket: names.contentBucket, Key: key, Body: body, ContentType: "application/json" }));
    },
    async register(names, bookId) {
      const r = spawnSync("npx", ["tsx", "scripts/book/register-api-books.ts", bookId], {
        cwd: REPO_ROOT,
        encoding: "utf8",
        env: { ...process.env, AWS_PROFILE: names.profile, AWS_REGION: names.region, BOOK_TABLE_NAME: names.table, BOOK_CONTENT_BUCKET: names.contentBucket, BOOK_INGEST_BUCKET: names.ingestBucket },
        maxBuffer: 64 * 1024 * 1024,
      });
      if (r.status !== 0) throw new Error(`register:api failed (exit ${r.status}): ${(r.stdout + r.stderr).slice(-1500)}`);
      return r.stdout.trim().split("\n").slice(-5).join("\n");
    },
    async verifyLive(bookId, packageId) {
      const origin = process.env.CHAPTERFLOW_LIVE_ORIGIN ?? "https://chapterflow.ca";
      try {
        const res = await fetch(`${origin}/app/api/book/books/${bookId}`, { headers: { "cache-control": "no-cache" } });
        const text = await res.text();
        if (!res.ok) return { ok: false, detail: `GET ${origin}/app/api/book/books/${bookId} -> ${res.status}` };
        return text.includes(packageId) ? { ok: true, detail: `live: ${bookId} serves ${packageId}` } : { ok: false, detail: `live response does not carry ${packageId} yet (the CDN caches the list for up to an hour)` };
      } catch (err) {
        return { ok: false, detail: `live check failed: ${(err as Error).message}` };
      }
    },
  };
}

function gitCommitPackage(file: string, message: string, steps: string[]): void {
  const rel = path.relative(REPO_ROOT, file);
  const status = execFileSync("git", ["status", "--porcelain", "--", rel], { cwd: REPO_ROOT, encoding: "utf8" }).trim();
  if (status === "") {
    steps.push(`git: ${rel} unchanged, nothing to commit`);
    return;
  }
  execFileSync("git", ["add", "--", rel], { cwd: REPO_ROOT });
  execFileSync("git", ["commit", "-q", "-m", message], { cwd: REPO_ROOT });
  const sha = execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: REPO_ROOT, encoding: "utf8" }).trim();
  steps.push(`git: committed ${rel} as ${sha}`);
  try {
    execFileSync("git", ["push", "-q"], { cwd: REPO_ROOT, stdio: "pipe" });
    steps.push("git: pushed");
  } catch (err) {
    steps.push(`git: push failed (${(err as Error).message.split("\n")[0]}); push by hand`);
  }
}

export async function publishBook(ctx: PipelineCtx, opts: PublishOptions = {}): Promise<PublishReport> {
  const { bookId } = ctx.config;
  const steps: string[] = [];
  const gate = gateFor(ctx);
  if (!gate.ok) return { bookId, band: "fail", score: 0, outcome: "refused", reasons: [gate.reason], steps, remaining: [] };
  const { score } = gate;
  const base = { bookId, band: score.band, score: score.score, steps };
  if (score.band === "fail") return { ...base, outcome: "refused", reasons: [`band fail: ${score.reasons.join("; ")}`, `redo ${score.redo.map(chapterName).join(", ")} with the owner's permission, then score again`], remaining: [] };
  if (score.band === "manual" && !opts.approve) return { ...base, outcome: "needs-approval", reasons: [`band manual: ${score.reasons.join("; ")}`, "the owner reads the pack and says yes; then publish --approve"], remaining: [] };

  const pkg = buildPackage(ctx, opts.now?.() ?? new Date());
  const problems = await validatePackage(pkg, ctx.source.spans.length);
  if (problems.length > 0) return { ...base, outcome: "refused", reasons: problems, packageId: pkg.packageId, remaining: [] };
  const dir = opts.packagesDir ?? path.join(REPO_ROOT, "book-packages");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${bookId}.v21.json`);
  const existed = fs.existsSync(file);
  const body = JSON.stringify(pkg, null, 2) + "\n";
  fs.writeFileSync(file, body);
  steps.push(`package: ${pkg.chapters.length} chapters, ${pkg.packageId}, ${existed ? "replaced" : "wrote"} ${file}`);
  // A book the app's bundle already lists is replaced in place; a new one still needs the static catalog wiring and a deploy.
  const registry = path.join(REPO_ROOT, "app/book/data/bookPackages.ts");
  const wired = fs.existsSync(registry) && fs.readFileSync(registry, "utf8").includes(`book-packages/${bookId}.v21.json`);
  const remaining = wired
    ? ["replaces a book the app already lists: the server's warm cache may serve the old package until the next deploy or cold start"]
    : ["new book: register it in app/book/data/bookPackages.ts and lib/books-catalog.metadata.json, run generate-chapter-meta, verify, then dispatch deploy.yml (prod, owner-approved) so the public grid shows it"];
  const reasons = score.band === "manual" ? [`band manual, approved by the owner: ${score.reasons.join("; ")}`] : [];
  if (opts.dryRun) {
    steps.push("dry run: no git, no S3, no catalog registration");
    return { ...base, outcome: "dry-run", reasons, packageFile: file, packageId: pkg.packageId, remaining };
  }
  if (!opts.noGit) gitCommitPackage(file, `chore(books): publish ${bookId} from the v26 run (score ${score.score}, band ${score.band})\n\nCo-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`, steps);
  const publisher = opts.publisher ?? awsPublisher();
  const names = await publisher.names();
  const key = `book-content/packages/${bookId}.v21.json`;
  await publisher.putPackage(names, key, body);
  steps.push(`s3: put s3://${names.contentBucket}/${key}`);
  const reg = await publisher.register(names, bookId);
  steps.push(`catalog: registered ${bookId} (${reg.split("\n").slice(-1)[0]})`);
  const live = await publisher.verifyLive(bookId, pkg.packageId);
  steps.push(live.ok ? `verified ${live.detail}` : `not verified: ${live.detail}`);
  const record = { bookId, packageId: pkg.packageId, at: new Date().toISOString(), score: score.score, band: score.band, approved: opts.approve === true, steps, remaining, live };
  fs.writeFileSync(path.join(ctx.config.runDir, "publish.json"), JSON.stringify(record, null, 2) + "\n");
  return { ...base, outcome: "published", reasons, packageFile: file, packageId: pkg.packageId, remaining };
}
