/** The site verb: the edits a checkout of main needs for the public site, in a temp git repo built from small copies of
 *  main's real files. Hermetic: a fake live store, a recording generator runner, no AWS and no network. */
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { main } from "../cli";
import {
  addFallbackCover,
  addPresentationEntry,
  addRegistryImport,
  appendLedgerRecord,
  appendRegistryBlock,
  awsPackageStore,
  currentLeaf,
  fixGeneratorPath,
  inferredPresentation,
  registryBlock,
  removeFallbackCover,
  removeOptimizerListEntry,
  siteBook,
  type LedgerRecord,
  type PackageStore,
  type Runner,
  type SiteCtx,
} from "../src/site";
import type { Publisher } from "../src/publish";

const FAKE = fileURLToPath(new URL("./fixtures/fake-claude.mjs", import.meta.url));
const NOW = () => new Date("2026-11-12T10:00:00Z");
const md5 = (b: Buffer | string) => createHash("md5").update(b).digest("hex");
const sha256 = (b: Buffer | string) => createHash("sha256").update(b).digest("hex");

const roots: string[] = [];
after(() => {
  for (const d of roots) fs.rmSync(d, { recursive: true, force: true });
});
const tmp = (prefix: string): string => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  roots.push(d);
  return d;
};

// ---------------------------------------------------------------- fixture files, in the shapes of main's

/** bookPackages.ts: hand-named and auto imports, the cover import after them, the presentation object (a quoted key and a
 *  bare one, one without pages), the fallback lookup, and auto blocks at the end. */
const REGISTRY_TS = `import thePowerOfHabitPackageJson from "@/book-packages/the-power-of-habit.v21.json";
// --- 7A launch wire-in: previously-orphaned book packages ---
import auto_radical_candor_Json from "@/book-packages/radical-candor.v21.json";
import auto_tiny_habits_Json from "@/book-packages/tiny-habits.v21.json";
import { getBookCoverPath } from "@/lib/book-covers";
import {
  normalizeAnyPackage,
} from "@/app/book/data/book-package-core";

export const BOOK_PACKAGES = [normalizeAnyPackage(thePowerOfHabitPackageJson, "direct")];
const BOOK_PACKAGE_TONE_GETTERS = {};

export const BOOK_PACKAGE_PRESENTATION: Record<string, BookPackagePresentation> = {
  "the-power-of-habit": {
    icon: "🧭",
    coverImage: getBookCoverPath("the-power-of-habit"),
    difficulty: "Medium",
    synopsis:
      "A modern reading of cues, cravings and routines.",
    pages: 371,
  },
  ultralearning: {
    icon: "📚",
    coverImage: getBookCoverPath("ultralearning"),
    difficulty: "Medium",
    synopsis:
      "A modern reading of self-directed skill acquisition.",
  },
};

export function getBookPackagePresentation(bookId: string): BookPackagePresentation {
  return BOOK_PACKAGE_PRESENTATION[bookId] ?? inferFallbackPresentation(bookId);
}

// --- auto-registered by \`publish-final\` for "radical-candor" (do not edit by hand) ---
{
  const __autoPkg = normalizeAnyPackage(auto_radical_candor_Json, "direct");
  BOOK_PACKAGES.push(__autoPkg);
  BOOK_PACKAGE_TONE_GETTERS["radical-candor"] = (tone) => normalizeAnyPackage(auto_radical_candor_Json, tone);
}

// --- auto-registered by \`publish-final\` for "tiny-habits" (do not edit by hand) ---
{
  const __autoPkg = normalizeAnyPackage(auto_tiny_habits_Json, "direct");
  BOOK_PACKAGES.push(__autoPkg);
  BOOK_PACKAGE_TONE_GETTERS["tiny-habits"] = (tone) => normalizeAnyPackage(auto_tiny_habits_Json, tone);
}
`;

const GENERATOR_TS = `import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../..");
const OUTPUT_FILE = path.join(
  ROOT,
  "app/book/data/booksCatalog.metadata.json",
);
`;

const CHAPTER_META_TS = `const dest = path.join(process.cwd(), "app/book/data/book-chapter-meta.json");\n`;

const COVER_TS = `"use client";

// Keep this list narrow and remove an id when its AVIF/WebP pair lands.
const FALLBACK_ONLY_BOOK_COVERS = new Set([
  "behave",
  "decisive",
  "multipliers",
  "the-first-90-days",
  "the-now-habit",
]);

export function getBookCoverSourceCandidates(bookId: string): string[] {
  return FALLBACK_ONLY_BOOK_COVERS.has(bookId) ? [] : [bookId];
}
`;

/** main's components/ui/BookCover.optimizer.test.ts, small: the loop over the fallback-only ids in its real form, and a
 *  later test that names one of them outside the list. */
const OPTIMIZER_TS = `import assert from "node:assert/strict";
import { test } from "node:test";
import { getBookCoverSourceCandidates } from "@/lib/use-book-cover-source";

test("catalog titles without committed rasters render their fallback immediately", () => {
  for (const bookId of [
    "behave",
    "decisive",
    "multipliers",
    "the-first-90-days",
    "the-now-habit",
  ]) {
    assert.deepEqual(
      getBookCoverSourceCandidates(bookId, \`/book-covers/\${bookId}.webp\`),
      [],
    );
  }
});

test("fallback-only catalog titles still preserve an authored remote cover", () => {
  const remote = "https://chapterflow-covers.s3.amazonaws.com/behave.webp";
  assert.deepEqual(getBookCoverSourceCandidates("behave", remote), [remote]);
});
`;

/** A v21 package; `compact` writes it the way no generator would, to prove the bytes are kept as they are. */
function pkg(id: string, title: string, chapters: number, opts: { categories?: string[]; tags?: string[]; rev?: string; compact?: boolean; createdAt?: string } = {}): string {
  const body = {
    schemaVersion: "chapterflow-v21-authored",
    packageId: `${id}-${opts.rev ?? "v1"}`,
    ...(opts.createdAt !== undefined ? { createdAt: opts.createdAt } : {}),
    book: { bookId: id, title, author: "A. Author", categories: opts.categories ?? ["Psychology"], tags: opts.tags ?? ["habits"] },
    chapters: Array.from({ length: chapters }, (_, i) => ({ chapterId: `${id}-ch0${i + 1}`, number: i + 1, readingTimeMinutes: 7 })),
  };
  return opts.compact ? JSON.stringify(body) : JSON.stringify(body, null, 2) + "\n";
}

/** The fake generators' rows: id, title, chapterCount. */
const metaRow = (text: string) => {
  const p = JSON.parse(text) as { book: { bookId: string; title: string }; chapters: unknown[] };
  return { id: p.book.bookId, title: p.book.title, chapterCount: p.chapters.length };
};

// The approval ledger: a bookPackages.ts chain of two (the second is the leaf, with its own owners) and another path.
function canonicalize(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canonicalize);
  if (v && typeof v === "object") return Object.fromEntries(Object.keys(v).sort().map((k) => [k, canonicalize((v as Record<string, unknown>)[k])]));
  return v;
}
/** recordId as scripts/ci/verify-shared-ts-closure.mjs checks it, written out again here so the test does not trust site.ts. */
const recomputeId = (record: object): string => {
  const { recordId: _drop, ...body } = record as Record<string, unknown>;
  return sha256(JSON.stringify(canonicalize(body)));
};
const withId = (body: Omit<LedgerRecord, "recordId">): LedgerRecord => ({ recordId: recomputeId(body), ...body });
const ROOT_REC = withId({ changeId: "c1", purpose: "shared-maintenance", flag: null, path: "app/book/data/bookPackages.ts", appOwner: "Root App", bookOwner: "Root Book", supersedesRecordId: null, repairedBlobSha256: "a".repeat(64), evidenceRefs: ["#1"] });
const LEAF_REC = withId({ changeId: "c2", purpose: "shared-maintenance", flag: null, path: "app/book/data/bookPackages.ts", appOwner: "Ada App", bookOwner: "Bo Book", supersedesRecordId: ROOT_REC.recordId, repairedBlobSha256: sha256(REGISTRY_TS), evidenceRefs: ["#2", "ünïcode ref"] });
const OTHER_REC = withId({ changeId: "c3", purpose: "shared-maintenance", flag: null, path: "lib/pricing.ts", appOwner: "X", bookOwner: "Y", supersedesRecordId: null, repairedBlobSha256: "b".repeat(64), evidenceRefs: ["#3"] });
const ledgerText = (records: unknown[]) => JSON.stringify({ schemaVersion: 1, records }, null, 2) + "\n";

const LIVE: Record<string, string> = {
  "the-power-of-habit": pkg("the-power-of-habit", "The Power of Habit", 3),
  "radical-candor": pkg("radical-candor", "Radical Candor", 2),
  "tiny-habits": pkg("tiny-habits", "Tiny Habits", 8, { rev: "v26" }),
  "demo-book": pkg("demo-book", "Demo Book", 4, { compact: true, tags: ["focus", "attention"] }),
  ghost: pkg("ghost", "Ghost", 1),
};

interface Fixture {
  repo: string;
  runDir: string;
  ctx: SiteCtx;
  store: PackageStore & { gets: string[]; lists: number };
  /** The tool repo's cover folder for this fixture: empty unless a test puts a pair in it. */
  coversDir: string;
  runs: Array<{ cmd: string; cwd: string }>;
  run: Runner;
  git(...a: string[]): string;
  read(f: string): string;
  write(f: string, s: string | Buffer): void;
  commit(msg?: string): void;
}

/** A clean main-like checkout (git, branch main) and a run dir with publish.json, for the book `bookId`. publish.json names
 *  the live package's packageId unless `publishedId` says otherwise (null: no packageId at all). */
function fixture(opts: { bookId?: string; title?: string; ledger?: unknown[]; published?: boolean; publishedId?: string | null; live?: Record<string, string>; etags?: Record<string, string> } = {}): Fixture {
  const dir = tmp("v26-site-");
  const repo = path.join(dir, "main");
  const runDir = path.join(dir, "run");
  fs.mkdirSync(runDir, { recursive: true });
  const bookId = opts.bookId ?? "demo-book";
  const liveBody = (opts.live ?? LIVE)[bookId];
  const liveId = (() => {
    try {
      return liveBody ? (JSON.parse(liveBody) as { packageId?: string }).packageId : undefined;
    } catch {
      return undefined;
    }
  })();
  const publishedId = opts.publishedId === undefined ? liveId ?? `${bookId}-v26-1` : opts.publishedId;
  if (opts.published !== false) fs.writeFileSync(path.join(runDir, "publish.json"), JSON.stringify({ bookId, ...(publishedId !== null ? { packageId: publishedId } : {}) }));
  const write = (f: string, s: string | Buffer) => {
    fs.mkdirSync(path.dirname(path.join(repo, f)), { recursive: true });
    fs.writeFileSync(path.join(repo, f), s);
  };
  const read = (f: string) => fs.readFileSync(path.join(repo, f), "utf8");
  write("app/book/data/bookPackages.ts", REGISTRY_TS);
  write("scripts/book/generate-catalog-metadata.ts", GENERATOR_TS);
  write("scripts/book/generate-chapter-meta.ts", CHAPTER_META_TS);
  write("lib/use-book-cover-source.ts", COVER_TS);
  write("components/ui/BookCover.optimizer.test.ts", OPTIMIZER_TS);
  write("scripts/ci/ws7-shared-repair-approvals.json", ledgerText(opts.ledger ?? [ROOT_REC, LEAF_REC, OTHER_REC]));
  // The packages: one equal to live, one equal behind a multipart ETag, one stale (main's old copy), one only in the repo.
  const tinyOld = pkg("tiny-habits", "Tiny Habits", 8, { rev: "v21-old" });
  write("book-packages/the-power-of-habit.v21.json", LIVE["the-power-of-habit"]!);
  write("book-packages/radical-candor.v21.json", LIVE["radical-candor"]!);
  write("book-packages/tiny-habits.v21.json", tinyOld);
  write("book-packages/outliers.v21.json", pkg("outliers", "Outliers", 2));
  write("book-packages/.pending-deploy.json", "{\"pending\":[]}\n");
  write("public/book-covers/radical-candor.webp", "webp");
  // The committed rows: the power of habit's is stale (unrelated drift a regeneration brings), tiny-habits' is main's old one.
  const rows = [{ ...metaRow(LIVE["the-power-of-habit"]!), chapterCount: 99 }, metaRow(LIVE["radical-candor"]!), metaRow(tinyOld)];
  write("lib/books-catalog.metadata.json", JSON.stringify(rows, null, 2) + "\n");
  write("app/book/data/book-chapter-meta.json", "{}\n");
  // The repo's own tsx (after npm ci), ignored as main ignores node_modules.
  write(".gitignore", "node_modules/\n");
  write("node_modules/.bin/tsx", "#!/bin/sh\n");

  const git = (...a: string[]) => execFileSync("git", a, { cwd: repo, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  git("init", "-q", "-b", "main");
  git("config", "user.email", "test@example.test");
  git("config", "user.name", "Test");
  git("config", "commit.gpgsign", "false");
  const commit = (msg = "seed") => {
    git("add", "-A");
    git("commit", "-q", "-m", msg);
  };
  commit();

  const live = opts.live ?? LIVE;
  const store = {
    gets: [] as string[],
    lists: 0,
    async list() {
      store.lists++;
      const m = new Map<string, { etag: string; size: number }>();
      for (const [id, body] of Object.entries(live)) m.set(id, { etag: opts.etags?.[id] ?? md5(body), size: Buffer.byteLength(body) });
      return m;
    },
    async get(id: string) {
      store.gets.push(id);
      return Buffer.from(live[id]!);
    },
  };

  // The generators as main runs them, small: the catalog one honours its OUTPUT_FILE path (the dead one until fixed),
  // and both read the packages the registry imports.
  const runs: Array<{ cmd: string; cwd: string }> = [];
  const run: Runner = (cmd, args, cwd) => {
    runs.push({ cmd: `${cmd} ${args.join(" ")}`, cwd });
    const ids = [...read("app/book/data/bookPackages.ts").matchAll(/from "@\/book-packages\/(.+)\.v21\.json"/g)].map((m) => m[1]!);
    const pkgs = ids.map((id) => read(`book-packages/${id}.v21.json`));
    if (args.at(-1) === "scripts/book/generate-catalog-metadata.ts") {
      const out = read("scripts/book/generate-catalog-metadata.ts").includes('"lib/books-catalog.metadata.json"') ? "lib/books-catalog.metadata.json" : "app/book/data/booksCatalog.metadata.json";
      const rows2 = pkgs.map(metaRow).sort((a, b) => a.title.localeCompare(b.title));
      write(out, JSON.stringify(rows2, null, 2) + "\n");
    } else {
      write("app/book/data/book-chapter-meta.json", JSON.stringify(Object.fromEntries(pkgs.map((p) => [metaRow(p).id, metaRow(p).chapterCount]))) + "\n");
    }
  };

  const coversDir = path.join(dir, "covers");
  fs.mkdirSync(coversDir);

  return {
    repo,
    runDir,
    coversDir,
    ctx: { config: { bookId: opts.bookId ?? "demo-book", runDir, title: opts.title ?? "Demo Book" } },
    store,
    runs,
    run,
    git,
    read,
    write,
    commit,
  };
}

const site = (f: Fixture, extra: { synopsis?: string; dryRun?: boolean; run?: Runner; coversDir?: string } = {}) =>
  siteBook(f.ctx, { repo: f.repo, store: f.store, run: f.run, now: NOW, coversDir: f.coversDir, ...extra });

const ledgerRecords = (f: Fixture) => (JSON.parse(f.read("scripts/ci/ws7-shared-repair-approvals.json")) as { records: Array<Record<string, unknown>> }).records;

// ---------------------------------------------------------------- a new title, end to end

test("site, new title with a synopsis: packages synced to the live bytes, registry wired, cover fallback, generators, approval record", async () => {
  const f = fixture();
  const r = await site(f, { synopsis: "  Small changes,\n made on purpose, that last.  " });
  assert.equal(r.kind, "new");

  // The revert guard: the stale title and the new one at the live bytes, unchanged (the new one is compact JSON).
  assert.deepEqual(r.synced.map((s) => s.bookId), ["demo-book", "tiny-habits"]);
  assert.equal(f.read("book-packages/demo-book.v21.json"), LIVE["demo-book"]);
  assert.equal(f.read("book-packages/tiny-habits.v21.json"), LIVE["tiny-habits"]);
  assert.equal(r.synced[0]!.oldMd5, null);
  assert.equal(r.synced[1]!.newMd5, md5(LIVE["tiny-habits"]!));
  // Files equal to their ETag are not fetched; the repo-only one is untouched; a title only the live store has is not pulled in.
  assert.deepEqual(f.store.gets, ["demo-book", "tiny-habits"]);
  assert.equal(r.equal, 2);
  assert.deepEqual(r.repoOnly, ["outliers"]);
  assert.ok(!fs.existsSync(path.join(f.repo, "book-packages/ghost.v21.json")));

  // The import right after the last package import; the block at the end, in the auto blocks' form.
  const reg = f.read("app/book/data/bookPackages.ts");
  assert.ok(reg.includes(`import auto_tiny_habits_Json from "@/book-packages/tiny-habits.v21.json";\nimport auto_demo_book_Json from "@/book-packages/demo-book.v21.json";\nimport { getBookCoverPath }`));
  assert.ok(reg.endsWith(`normalizeAnyPackage(auto_tiny_habits_Json, tone);\n}\n\n// --- auto-registered by \`v26 site\` for "demo-book" (do not edit by hand) ---\n{\n  const __autoPkg = normalizeAnyPackage(auto_demo_book_Json, "direct");\n  BOOK_PACKAGES.push(__autoPkg);\n  BOOK_PACKAGE_TONE_GETTERS["demo-book"] = (tone) => normalizeAnyPackage(auto_demo_book_Json, tone);\n}\n`));
  // The presentation entry: the last one in the object, icon/difficulty/pages as the fallback picks them, the synopsis on one line.
  const fields = inferredPresentation(JSON.parse(LIVE["demo-book"]!));
  assert.equal(fields.pages, 160);
  assert.equal(fields.difficulty, "Medium");
  assert.ok(reg.includes(`      "A modern reading of self-directed skill acquisition.",\n  },\n  "demo-book": {\n    icon: ${JSON.stringify(fields.icon)},\n    coverImage: getBookCoverPath("demo-book"),\n    difficulty: "Medium",\n    synopsis:\n      "Small changes, made on purpose, that last.",\n    pages: 160,\n  },\n};\n`), reg);
  assert.equal(r.synopsis, "authored");

  // The cover: no raster, so the fallback set, kept sorted.
  assert.equal(r.cover, "fallback");
  assert.ok(f.read("lib/use-book-cover-source.ts").includes(`  "decisive",\n  "demo-book",\n  "multipliers",`));
  // The generator's output path, and nothing else in that file.
  assert.equal(f.read("scripts/book/generate-catalog-metadata.ts"), GENERATOR_TS.replace('"app/book/data/booksCatalog.metadata.json"', '"lib/books-catalog.metadata.json"'));
  assert.equal(r.generatorPathFixed, true);

  // The generators, in order, in the repo; their output is the live one and the dead path stays absent.
  assert.deepEqual(f.runs, [
    { cmd: "npx --no tsx scripts/book/generate-catalog-metadata.ts", cwd: f.repo },
    { cmd: "npx --no tsx scripts/book/generate-chapter-meta.ts", cwd: f.repo },
  ]);
  assert.ok(JSON.parse(f.read("lib/books-catalog.metadata.json")).some((x: { id: string }) => x.id === "demo-book"));
  assert.ok(!fs.existsSync(path.join(f.repo, "app/book/data/booksCatalog.metadata.json")));
  assert.deepEqual(r.drift.metadata, ["the-power-of-habit"], "the stale row of an unrelated title is reported as drift");

  // The approval record: last, superseding the leaf, owners copied from it, its id recomputed independently.
  const recs = ledgerRecords(f);
  assert.equal(recs.length, 4);
  const rec = recs[3]!;
  assert.deepEqual(Object.keys(rec), ["recordId", "changeId", "purpose", "flag", "path", "appOwner", "bookOwner", "supersedesRecordId", "repairedBlobSha256", "evidenceRefs"]);
  assert.equal(rec.recordId, recomputeId(rec));
  assert.equal(rec.recordId, r.ledgerRecordId);
  assert.equal(rec.supersedesRecordId, LEAF_REC.recordId);
  assert.equal(rec.appOwner, "Ada App");
  assert.equal(rec.bookOwner, "Bo Book");
  assert.equal(rec.purpose, "shared-maintenance");
  assert.equal(rec.flag, null);
  assert.equal(rec.path, "app/book/data/bookPackages.ts");
  assert.equal(rec.changeId, "v26-site-demo-book-2026-11-12");
  assert.equal(rec.repairedBlobSha256, sha256(fs.readFileSync(path.join(f.repo, "app/book/data/bookPackages.ts"))));
  assert.deepEqual(rec.evidenceRefs, ["book-packages/demo-book.v21.json", "scripts/book/v26 site verb: public catalog wiring for demo-book"]);
  // Existing records byte for byte, and the file in its own form.
  const before = ledgerText([ROOT_REC, LEAF_REC, OTHER_REC]);
  const after = f.read("scripts/ci/ws7-shared-repair-approvals.json");
  assert.ok(after.startsWith(before.slice(0, before.lastIndexOf("\n  ]"))));
  assert.equal(after, JSON.stringify(JSON.parse(after), null, 2) + "\n");

  // What the caller stages is exactly what changed in the checkout.
  const status = f.git("status", "--porcelain", "--untracked-files=all").split("\n").filter(Boolean).map((l) => l.slice(3)).sort();
  assert.deepEqual([...r.filesChanged].sort(), status);
  assert.deepEqual(r.filesChanged, [
    "book-packages/demo-book.v21.json",
    "book-packages/tiny-habits.v21.json",
    "app/book/data/bookPackages.ts",
    "scripts/book/generate-catalog-metadata.ts",
    "lib/use-book-cover-source.ts",
    "lib/books-catalog.metadata.json",
    "app/book/data/book-chapter-meta.json",
    "scripts/ci/ws7-shared-repair-approvals.json",
  ]);

  // The commands left: a branch (the checkout is on main), explicit paths, the checks, the push and the pull request.
  const next = r.next.join("\n");
  assert.match(next, /git switch -c books\/site-demo-book/);
  assert.match(next, /git add -- book-packages\/demo-book\.v21\.json .*scripts\/ci\/ws7-shared-repair-approvals\.json/);
  assert.ok(!/git add -A|git add \./.test(next));
  assert.match(next, /git commit -m .* -- book-packages\/demo-book\.v21\.json/);
  assert.match(next, /typecheck:shared-closure -- --base "\$\(git merge-base origin\/main HEAD\)"/);
  assert.match(next, /npx tsx --test lib\/category-taxonomy\.test\.ts .*components\/ui\/BookCover\.optimizer\.test\.ts/);
  assert.match(next, /npm run verify/);
  assert.match(next, /check-cover-coverage\.ts --warn-only/);
  assert.match(next, /git push -u origin HEAD/);
  assert.match(next, /gh pr create --base main .*--body-file .*site-pr\.md/);

  // The pull request body and the report.
  const body = fs.readFileSync(path.join(f.runDir, "site-pr.md"), "utf8");
  assert.match(body, /Merging changes nothing live/);
  assert.match(body, /gh workflow run deploy\.yml --ref main -f environment=prod -f deploy_app=true/);
  assert.match(body, /re-uploads every package/);
  assert.ok(body.includes(md5(LIVE["tiny-habits"]!)) && body.includes(md5(LIVE["demo-book"]!)));
  assert.match(body, /Titles the revert guard brought along[\s\S]*- `tiny-habits`/);
  assert.match(body, /unrelated to `demo-book`[\s\S]*`the-power-of-habit`/);
  assert.match(body, /Synopsis: authored/);
  assert.match(body, /FALLBACK_ONLY_BOOK_COVERS/);
  assert.ok(body.includes(String(r.ledgerRecordId)) && body.includes("Merging this pull request is the approval"));
  assert.match(body, /`outliers`/);
  const saved = JSON.parse(fs.readFileSync(path.join(f.runDir, "site.json"), "utf8"));
  assert.equal(saved.ledgerRecordId, r.ledgerRecordId);
  assert.deepEqual(saved.filesChanged, r.filesChanged);

  // Run again once committed: nothing changes and no second record, and the first run's body and report stay (rebuilt,
  // they would call the title replaced and say there is no approval record).
  f.commit("wire");
  f.runs.length = 0;
  const savedText = fs.readFileSync(path.join(f.runDir, "site.json"), "utf8");
  const again = await site(f, { synopsis: "Small changes, made on purpose, that last." });
  assert.equal(fs.readFileSync(path.join(f.runDir, "site-pr.md"), "utf8"), body);
  assert.equal(fs.readFileSync(path.join(f.runDir, "site.json"), "utf8"), savedText);
  assert.equal(again.prBody, null);
  assert.equal(again.kind, "replaced");
  assert.deepEqual(again.synced, []);
  assert.deepEqual(again.filesChanged, []);
  assert.equal(again.ledgerRecordId, null);
  assert.equal(again.synopsis, "authored");
  assert.equal(again.cover, "fallback");
  assert.equal(f.git("status", "--porcelain", "--untracked-files=all"), "");
  assert.equal(ledgerRecords(f).length, 4);
  assert.match(again.next.join("\n"), /nothing to commit/);
});

test("site, new title without a synopsis: no presentation entry (the fallback applies), the rest as with one", async () => {
  const f = fixture();
  const r = await site(f);
  assert.equal(r.synopsis, "generic");
  const reg = f.read("app/book/data/bookPackages.ts");
  assert.ok(!reg.includes(`"demo-book": {`));
  assert.ok(reg.includes(`BOOK_PACKAGE_TONE_GETTERS["demo-book"]`));
  assert.match(fs.readFileSync(path.join(f.runDir, "site-pr.md"), "utf8"), /Synopsis: generic/);
  assert.equal(ledgerRecords(f).at(-1)!.repairedBlobSha256, sha256(reg));
});

test("site, new title with a cover file: the fallback set is left alone", async () => {
  const f = fixture();
  f.write("public/book-covers/demo-book.webp", "webp");
  f.commit("cover");
  const r = await site(f);
  assert.equal(r.cover, "file");
  assert.equal(f.read("lib/use-book-cover-source.ts"), COVER_TS);
  assert.ok(!r.filesChanged.includes("lib/use-book-cover-source.ts"));
});

// ---------------------------------------------------------------- a cover from the cover verb

/** Stand-ins for the cover verb's pair: the site step copies bytes and never decodes them. */
const WEBP = Buffer.from([0x52, 0x49, 0x46, 0x46, 0xff, 0x00, 0x10, 0x80, ...Array.from({ length: 64 }, (_, i) => (i * 37) % 256)]);
const AVIF = Buffer.from([0x00, 0x00, 0x00, 0x1c, 0x66, 0x74, 0x79, 0x70, ...Array.from({ length: 48 }, (_, i) => (i * 53) % 256)]);
/** The pair in the cover folder and, as the cover verb leaves it, in the run's own cover folder (unless `run` is false). */
const putPair = (f: Fixture, id: string, which: Array<"webp" | "avif"> = ["webp", "avif"], run = true) => {
  const runCover = path.join(f.runDir, "cover");
  if (run) fs.mkdirSync(runCover, { recursive: true });
  for (const [ext, bytes] of [["webp", WEBP], ["avif", AVIF]] as const) {
    if (!which.includes(ext)) continue;
    fs.writeFileSync(path.join(f.coversDir, `${id}.${ext}`), bytes);
    if (run) fs.writeFileSync(path.join(runCover, `${id}.${ext}`), bytes);
  }
};

test("site, new title with a cover pair from the cover verb: both files land byte for byte, no fallback entry, cover file", async () => {
  const f = fixture();
  // A checkout with no public/book-covers folder at all: the folder is made.
  f.git("rm", "-q", "public/book-covers/radical-candor.webp");
  f.commit("no covers");
  putPair(f, "demo-book");
  const r = await site(f);
  assert.ok(fs.readFileSync(path.join(f.repo, "public/book-covers/demo-book.webp")).equals(WEBP));
  assert.ok(fs.readFileSync(path.join(f.repo, "public/book-covers/demo-book.avif")).equals(AVIF));
  assert.ok(r.filesChanged.includes("public/book-covers/demo-book.webp") && r.filesChanged.includes("public/book-covers/demo-book.avif"));
  assert.equal(f.read("lib/use-book-cover-source.ts"), COVER_TS, "the id is not added to the fallback set");
  assert.ok(!r.filesChanged.includes("lib/use-book-cover-source.ts"));
  assert.equal(r.cover, "file");
  assert.equal(r.coverCopied, true);
  assert.deepEqual(r.coverFiles, [{ file: "public/book-covers/demo-book.webp", size: WEBP.length }, { file: "public/book-covers/demo-book.avif", size: AVIF.length }]);
  // What the caller stages is exactly what changed, the binaries included.
  const status = f.git("status", "--porcelain", "--untracked-files=all").split("\n").filter(Boolean).map((l) => l.slice(3)).sort();
  assert.deepEqual([...r.filesChanged].sort(), status);
  const body = fs.readFileSync(path.join(f.runDir, "site-pr.md"), "utf8");
  assert.ok(body.includes(`- Cover: original generated art for this edition`), body);
  assert.ok(body.includes(`\`public/book-covers/demo-book.webp\` (${WEBP.length} bytes) and \`public/book-covers/demo-book.avif\` (${AVIF.length} bytes)`), body);
  assert.ok(!body.includes("FALLBACK_ONLY_BOOK_COVERS"));

  // The CLI line, and a second run once committed changes nothing.
  f.commit("wire with cover");
  const again = await site(f);
  assert.deepEqual(again.filesChanged, []);
  assert.equal(again.coverCopied, false);
  assert.equal(again.cover, "file");
  assert.equal(f.git("status", "--porcelain", "--untracked-files=all"), "");

  // A new image (another cover run) replaces the committed one.
  const newer = Buffer.concat([WEBP, Buffer.from([1, 2, 3])]);
  fs.writeFileSync(path.join(f.coversDir, "demo-book.webp"), newer);
  fs.writeFileSync(path.join(f.runDir, "cover", "demo-book.webp"), newer);
  const third = await site(f, { dryRun: true });
  assert.deepEqual(third.coverFiles, [{ file: "public/book-covers/demo-book.webp", size: newer.length }]);
  assert.deepEqual(third.filesChanged, ["public/book-covers/demo-book.webp"]);
  assert.equal(f.git("status", "--porcelain", "--untracked-files=all"), "", "a dry run writes nothing");
});

test("site, replaced title in the fallback set gets its cover: out of the set and out of the optimizer test's list", async () => {
  // "decisive" is on main, wired, in the fallback set and in the optimizer test's list.
  const live = { ...LIVE, decisive: pkg("decisive", "Decisive", 2) };
  const f = fixture({ bookId: "decisive", title: "Decisive", live });
  f.write("book-packages/decisive.v21.json", live.decisive);
  f.write("app/book/data/bookPackages.ts", appendRegistryBlock(addRegistryImport(REGISTRY_TS, "decisive"), "decisive"));
  const rows = JSON.parse(f.read("lib/books-catalog.metadata.json")) as unknown[];
  f.write("lib/books-catalog.metadata.json", JSON.stringify([...rows, metaRow(live.decisive)], null, 2) + "\n");
  f.commit("decisive on main");
  putPair(f, "decisive");

  const r = await site(f);
  assert.equal(r.kind, "replaced");
  assert.equal(r.cover, "file");
  assert.equal(r.coverCopied, true);
  assert.ok(fs.readFileSync(path.join(f.repo, "public/book-covers/decisive.avif")).equals(AVIF));
  assert.equal(f.read("lib/use-book-cover-source.ts"), COVER_TS.replace(`  "decisive",\n`, ""));
  assert.equal(f.read("components/ui/BookCover.optimizer.test.ts"), OPTIMIZER_TS.replace(`    "decisive",\n`, ""));
  for (const file of ["public/book-covers/decisive.webp", "public/book-covers/decisive.avif", "lib/use-book-cover-source.ts", "components/ui/BookCover.optimizer.test.ts"]) {
    assert.ok(r.filesChanged.includes(file), file);
  }
  assert.equal(r.ledgerRecordId, null, "no registry edit, no approval record");
  assert.match(r.notes.join("\n"), /out of FALLBACK_ONLY_BOOK_COVERS/);
  const status = f.git("status", "--porcelain", "--untracked-files=all").split("\n").filter(Boolean).map((l) => l.slice(3)).sort();
  assert.deepEqual([...r.filesChanged].sort(), status);

  // A second run once committed changes nothing.
  f.commit("cover");
  const again = await site(f);
  assert.deepEqual(again.filesChanged, []);
  assert.equal(f.git("status", "--porcelain", "--untracked-files=all"), "");

  // "behave" is also named outside the list: the line goes, and a note says to check the rest by hand.
  const live2 = { ...LIVE, behave: pkg("behave", "Behave", 2) };
  const g = fixture({ bookId: "behave", title: "Behave", live: live2 });
  g.write("book-packages/behave.v21.json", live2.behave);
  g.write("app/book/data/bookPackages.ts", appendRegistryBlock(addRegistryImport(REGISTRY_TS, "behave"), "behave"));
  g.write("lib/books-catalog.metadata.json", JSON.stringify([...(JSON.parse(g.read("lib/books-catalog.metadata.json")) as unknown[]), metaRow(live2.behave)], null, 2) + "\n");
  g.commit("behave on main");
  putPair(g, "behave");
  const r2 = await site(g, { dryRun: true });
  assert.ok(r2.filesChanged.includes("components/ui/BookCover.optimizer.test.ts"));
  assert.match(r2.notes.join("\n"), /still names "behave" elsewhere/);
});

test("site, a fallback-only title whose pair is already in the checkout leaves the set; one with only a webp stays", async () => {
  const live = { ...LIVE, decisive: pkg("decisive", "Decisive", 2) };
  const setup = (files: Array<"webp" | "avif">) => {
    const f = fixture({ bookId: "decisive", title: "Decisive", live });
    f.write("book-packages/decisive.v21.json", live.decisive);
    f.write("app/book/data/bookPackages.ts", appendRegistryBlock(addRegistryImport(REGISTRY_TS, "decisive"), "decisive"));
    f.write("lib/books-catalog.metadata.json", JSON.stringify([...(JSON.parse(f.read("lib/books-catalog.metadata.json")) as unknown[]), metaRow(live.decisive)], null, 2) + "\n");
    for (const ext of files) f.write(`public/book-covers/decisive.${ext}`, ext === "webp" ? WEBP : AVIF);
    f.commit("decisive on main");
    return f;
  };
  // (The fixture's stale tiny-habits package and generator path come along as in every run; only the cover files matter here.)
  const coverEdits = (files: string[]) => files.filter((x) => /cover/i.test(x));
  const both = await site(setup(["webp", "avif"]), { dryRun: true });
  assert.equal(both.coverCopied, false);
  assert.deepEqual(coverEdits(both.filesChanged), ["lib/use-book-cover-source.ts", "components/ui/BookCover.optimizer.test.ts"]);
  const half = await site(setup(["webp"]), { dryRun: true });
  assert.deepEqual(coverEdits(half.filesChanged), []);
});

test("site SITE_COVER_INCOMPLETE: only one of the two files in the cover folder is refused, the checkout untouched", async () => {
  for (const which of [["webp"], ["avif"]] as Array<Array<"webp" | "avif">>) {
    for (const dryRun of [false, true]) {
      const f = fixture();
      putPair(f, "demo-book", which);
      await assert.rejects(site(f, { dryRun }), new RegExp(`^Error: SITE_COVER_INCOMPLETE: .*demo-book\\.${which[0]} has no \\.${which[0] === "webp" ? "avif" : "webp"} sibling`));
      assert.equal(f.git("status", "--porcelain", "--untracked-files=all"), "");
      assert.deepEqual(f.runs, []);
      assert.ok(!fs.existsSync(path.join(f.runDir, "site.json")));
    }
  }
});

test("site: a pair in the cover folder that this run's cover step did not make is not carried in", async () => {
  // A new title: no run pair, or a run pair that differs, leaves the cover handling as before (the fallback set).
  for (const runBytes of [null, Buffer.from("another image")]) {
    const f = fixture();
    putPair(f, "demo-book", ["webp", "avif"], false);
    if (runBytes) {
      fs.mkdirSync(path.join(f.runDir, "cover"), { recursive: true });
      fs.writeFileSync(path.join(f.runDir, "cover", "demo-book.webp"), runBytes);
      fs.writeFileSync(path.join(f.runDir, "cover", "demo-book.avif"), AVIF);
    }
    const r = await site(f, { dryRun: true });
    assert.equal(r.coverCopied, false);
    assert.deepEqual(r.coverFiles, []);
    assert.equal(r.cover, "fallback");
    assert.ok(!r.filesChanged.some((x) => x.startsWith("public/book-covers/")), r.filesChanged.join(" "));
    // Said only when the run made a cover and the folder now holds another: with no run cover there is nothing to report
    // (the tool branch tracks every catalog cover, so a silent pass is the everyday case).
    if (runBytes) assert.match(r.notes.join("\n"), /is not the one this run's cover step made/);
    else assert.doesNotMatch(r.notes.join("\n"), /cover step/);
  }
  // A replaced title whose cover on main differs from the stale one in the tool repo's folder: main's file is kept.
  const g = fixture({ bookId: "radical-candor", title: "Radical Candor" });
  putPair(g, "radical-candor", ["webp", "avif"], false);
  const r = await site(g);
  assert.equal(r.coverCopied, false);
  assert.ok(!r.filesChanged.some((x) => x.startsWith("public/book-covers/")), r.filesChanged.join(" "));
  assert.equal(g.read("public/book-covers/radical-candor.webp"), "webp");
  assert.ok(!fs.readFileSync(path.join(g.runDir, "site-pr.md"), "utf8").includes("original generated art"));
});

test("site with no cover in the cover folder (empty or absent) behaves as before", async () => {
  const expected = [
    "book-packages/demo-book.v21.json",
    "book-packages/tiny-habits.v21.json",
    "app/book/data/bookPackages.ts",
    "scripts/book/generate-catalog-metadata.ts",
    "lib/use-book-cover-source.ts",
    "scripts/ci/ws7-shared-repair-approvals.json",
  ];
  for (const coversDir of [undefined, "absent"]) {
    const f = fixture();
    // Another book's pair in the folder is not this book's cover.
    putPair(f, "tiny-habits");
    const r = await site(f, { dryRun: true, ...(coversDir ? { coversDir: path.join(f.coversDir, coversDir) } : {}) });
    assert.deepEqual(r.filesChanged, expected);
    assert.equal(r.coverCopied, false);
    assert.deepEqual(r.coverFiles, []);
    assert.equal(r.cover, "fallback");
  }
  const g = fixture();
  await site(g);
  assert.match(fs.readFileSync(path.join(g.runDir, "site-pr.md"), "utf8"), /FALLBACK_ONLY_BOOK_COVERS/);
  assert.ok(!fs.readFileSync(path.join(g.runDir, "site-pr.md"), "utf8").includes("original generated art"));
});

test("site: a late failure takes the carried-in cover back out of the checkout", async () => {
  const f = fixture();
  putPair(f, "demo-book");
  await assert.rejects(site(f, { run: () => { throw new Error("exit 1"); } }), /SITE_GENERATOR_FAILED: .*; the checkout was restored$/);
  assert.equal(f.git("status", "--porcelain", "--untracked-files=all"), "");
  assert.ok(!fs.existsSync(path.join(f.repo, "public/book-covers/demo-book.webp")));
});

// ---------------------------------------------------------------- a replaced title

test("site, replaced title: its package (and every stale one) at the live bytes, no registry edit, no approval record", async () => {
  const f = fixture({ bookId: "tiny-habits", title: "Tiny Habits" });
  const r = await site(f, { synopsis: "ignored" });
  assert.equal(r.kind, "replaced");
  assert.deepEqual(r.synced.map((s) => s.bookId), ["tiny-habits"]);
  assert.ok(fs.readFileSync(path.join(f.repo, "book-packages/tiny-habits.v21.json")).equals(Buffer.from(LIVE["tiny-habits"]!)));
  assert.equal(f.read("app/book/data/bookPackages.ts"), REGISTRY_TS);
  assert.equal(f.read("lib/use-book-cover-source.ts"), COVER_TS);
  assert.equal(r.ledgerRecordId, null);
  assert.equal(ledgerRecords(f).length, 3);
  assert.ok(!r.filesChanged.includes("scripts/ci/ws7-shared-repair-approvals.json"));
  assert.ok(r.filesChanged.includes("lib/books-catalog.metadata.json"), "the stale row is regenerated");
  assert.match(r.notes.join(" "), /--synopsis was not used/);
  assert.equal(r.cover, "missing");
  assert.match(fs.readFileSync(path.join(f.runDir, "site-pr.md"), "utf8"), /No change to `app\/book\/data\/bookPackages\.ts`, so no approval record/);
});

test("site: a multipart ETag is checked by fetching; equal bytes are left alone, different bytes are written", async () => {
  const f = fixture({ etags: { "radical-candor": "0123456789abcdef0123456789abcdef-2" } });
  const r = await site(f);
  assert.ok(f.store.gets.includes("radical-candor"));
  assert.ok(!r.synced.some((s) => s.bookId === "radical-candor"));
  assert.equal(r.equal, 2);

  const g = fixture({ live: { ...LIVE, "radical-candor": pkg("radical-candor", "Radical Candor", 3, { rev: "v26" }) }, etags: { "radical-candor": "ffff-3" } });
  const r2 = await site(g);
  assert.ok(r2.synced.some((s) => s.bookId === "radical-candor"));
  assert.equal(g.read("book-packages/radical-candor.v21.json"), pkg("radical-candor", "Radical Candor", 3, { rev: "v26" }));
});

// ---------------------------------------------------------------- dry run

test("site --dry-run: no write anywhere, no generator, and the report still says what would change", async () => {
  const f = fixture();
  const r = await site(f, { dryRun: true, synopsis: "A synopsis." });
  assert.equal(f.git("status", "--porcelain", "--untracked-files=all"), "");
  assert.deepEqual(f.runs, []);
  assert.ok(!fs.existsSync(path.join(f.runDir, "site.json")) && !fs.existsSync(path.join(f.runDir, "site-pr.md")));
  assert.equal(r.prBody, null);
  assert.deepEqual(r.synced.map((s) => s.bookId), ["demo-book", "tiny-habits"]);
  assert.deepEqual(r.filesChanged, [
    "book-packages/demo-book.v21.json",
    "book-packages/tiny-habits.v21.json",
    "app/book/data/bookPackages.ts",
    "scripts/book/generate-catalog-metadata.ts",
    "lib/use-book-cover-source.ts",
    "scripts/ci/ws7-shared-repair-approvals.json",
  ]);
  assert.match(r.ledgerRecordId ?? "", /^[0-9a-f]{64}$/);
  // The same record the real run then writes (the generators do not touch bookPackages.ts).
  const real = await site(f, { synopsis: "A synopsis." });
  assert.equal(real.ledgerRecordId, r.ledgerRecordId);
});

// ---------------------------------------------------------------- refusals

const clean = (f: Fixture) => assert.equal(f.git("status", "--porcelain", "--untracked-files=all"), "", "a refusal leaves the checkout as it was");

test("site refusals: each SITE_ code, and the checkout untouched by every refusal that comes before the writes", async () => {
  let f = fixture({ published: false });
  await assert.rejects(site(f), /^Error: SITE_NOT_PUBLISHED/);

  f = fixture();
  fs.rmSync(path.join(f.repo, "lib/books-catalog.metadata.json"));
  await assert.rejects(site(f), /SITE_REPO_INVALID: .* has no lib\/books-catalog\.metadata\.json/);

  f = fixture();
  fs.rmSync(path.join(f.repo, ".git"), { recursive: true });
  await assert.rejects(site(f), /SITE_REPO_INVALID: .* is not a git checkout/);

  f = fixture();
  f.write("lib/use-book-cover-source.ts", COVER_TS + "// someone's work\n");
  await assert.rejects(site(f), /SITE_REPO_DIRTY/);
  f.git("checkout", "--", ".");
  f.write("app/book/data/booksCatalog.metadata.json", "[]\n");
  await assert.rejects(site(f), /SITE_REPO_DIRTY: .*untracked app\/book\/data\/booksCatalog\.metadata\.json/);

  f = fixture({ live: { "tiny-habits": LIVE["tiny-habits"]! } });
  await assert.rejects(site(f), /SITE_NOT_LIVE/);
  clean(f);

  f = fixture();
  f.write("lib/books-catalog.metadata.json", JSON.stringify([{ id: "demo-book", title: "Demo Book" }], null, 2) + "\n");
  f.commit("row only");
  await assert.rejects(site(f), /SITE_HALF_WIRED: demo-book is in lib\/books-catalog\.metadata\.json but not imported/);

  f = fixture();
  f.write("app/book/data/bookPackages.ts", addRegistryImport(REGISTRY_TS, "demo-book"));
  f.commit("import only");
  await assert.rejects(site(f), /SITE_HALF_WIRED: demo-book is imported in app\/book\/data\/bookPackages\.ts but has no row/);

  f = fixture({ title: "  the power  OF habit " });
  await assert.rejects(site(f), /SITE_DUPLICATE_TITLE: .* as the-power-of-habit/);
  clean(f);

  f = fixture();
  const bad: PackageStore = { list: f.store.list, get: async (id) => Buffer.from(id === "tiny-habits" ? "tampered" : LIVE[id]!) };
  await assert.rejects(siteBook(f.ctx, { repo: f.repo, store: bad, run: f.run, now: NOW }), /SITE_FETCH_MISMATCH: the fetched tiny-habits package/);
  clean(f);

  f = fixture({ ledger: [OTHER_REC] });
  await assert.rejects(site(f), /SITE_LEDGER_NO_OWNER/);
  clean(f);
  assert.deepEqual(f.runs, [], "no generator runs before a refusal");

  f = fixture();
  f.write("scripts/ci/ws7-shared-repair-approvals.json", JSON.stringify({ schemaVersion: 1, records: [ROOT_REC, LEAF_REC] }) + "\n");
  f.commit("compact ledger");
  await assert.rejects(site(f), /SITE_LEDGER_FORMAT/);
  clean(f);

  f = fixture({ bookId: "Demo_Book" });
  await assert.rejects(site(f), /SITE_BAD_ID/);

  // The unfixed generator (or any run that writes the dead path) is caught after the generators.
  f = fixture();
  const deadRun: Runner = (cmd, args, cwd) => {
    f.run(cmd, args, cwd);
    f.write("app/book/data/booksCatalog.metadata.json", "[]\n");
  };
  await assert.rejects(site(f, { run: deadRun }), /SITE_DEAD_PATH_WRITTEN.*; the checkout was restored$/);
  clean(f);

  f = fixture();
  await assert.rejects(site(f, { run: () => { throw Object.assign(new Error("exit 1"), { stderr: Buffer.from("TS2307 cannot find module") }); } }), /SITE_GENERATOR_FAILED: .*TS2307.*; the checkout was restored$/);
  clean(f);

  f = fixture();
  await assert.rejects(site(f, { run: () => {} }), /SITE_GENERATOR_NO_ROW/);
  clean(f);

  // The live store unreachable (no aws CLI, a wrong profile): a SITE_ refusal before any write, for the list and a fetch.
  f = fixture();
  await assert.rejects(siteBook(f.ctx, { repo: f.repo, store: { list: async () => { throw new Error("spawnSync aws ENOENT"); }, get: f.store.get }, run: f.run, now: NOW }), /^Error: SITE_STORE_FAILED: spawnSync aws ENOENT; check that the aws CLI/);
  await assert.rejects(siteBook(f.ctx, { repo: f.repo, store: { list: f.store.list, get: async () => { throw new Error("Command failed: aws s3api get-object\nThe config profile (cf) could not be found"); } }, run: f.run, now: NOW }), /^Error: SITE_STORE_FAILED: Command failed: aws s3api get-object;/);
  clean(f);

  // No node_modules: npx would fetch tsx from the registry, so a real run refuses before any write; a dry run needs none.
  f = fixture();
  fs.rmSync(path.join(f.repo, "node_modules"), { recursive: true });
  await assert.rejects(site(f), /SITE_REPO_INVALID: .* has no node_modules\/\.bin\/tsx \(run npm ci/);
  clean(f);
  assert.equal((await site(f, { dryRun: true })).kind, "new");

  // A main-shaped folder inside another (clean) repo: git would answer for the outer repo, so it is refused.
  f = fixture();
  fs.rmSync(path.join(f.repo, ".git"), { recursive: true });
  const outer = path.dirname(f.repo);
  const og = (...a: string[]) => execFileSync("git", a, { cwd: outer, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  fs.writeFileSync(path.join(outer, ".gitignore"), "main/\nrun/\n");
  og("init", "-q", "-b", "main");
  og("-c", "user.email=t@example.test", "-c", "user.name=T", "-c", "commit.gpgsign=false", "commit", "-q", "--allow-empty", "-m", "outer");
  await assert.rejects(site(f), /SITE_REPO_INVALID: .* is not the root of a git checkout/);
  assert.equal(f.read("app/book/data/bookPackages.ts"), REGISTRY_TS);
});

test("site after a failed run: the checkout is restored, and a leftover untracked package is still staged on the rerun", async () => {
  // The second generator fails after every edit is on disk: everything goes back, the new package file included.
  const f = fixture();
  let calls = 0;
  const failSecond: Runner = (cmd, args, cwd) => {
    if (++calls === 2) throw new Error("exit 1");
    f.run(cmd, args, cwd);
  };
  await assert.rejects(site(f, { run: failSecond }), /SITE_GENERATOR_FAILED: .*; the checkout was restored$/);
  clean(f);
  assert.ok(!fs.existsSync(path.join(f.runDir, "site-pr.md")));
  const r = await site(f);
  assert.ok(r.filesChanged.includes("book-packages/demo-book.v21.json"));

  // A leftover package already at the live bytes but untracked (an interrupted run, then `git checkout -- .`) is staged.
  const g = fixture();
  g.write("book-packages/demo-book.v21.json", LIVE["demo-book"]!);
  const r2 = await site(g);
  assert.ok(r2.filesChanged.includes("book-packages/demo-book.v21.json"));
  assert.deepEqual(r2.synced.map((s) => [s.bookId, s.oldMd5]), [["demo-book", null], ["tiny-habits", md5(pkg("tiny-habits", "Tiny Habits", 8, { rev: "v21-old" }))]]);
  const status = g.git("status", "--porcelain", "--untracked-files=all").split("\n").filter(Boolean).map((l) => l.slice(3)).sort();
  assert.deepEqual([...r2.filesChanged].sort(), status, "every change in the checkout is in the list the caller stages");
});

// ---------------------------------------------------------------- a live store a deploy rolled back

test("site SITE_LIVE_STALE: the called-for title is live with another package than this run published; refused before any write, dry run too", async () => {
  const noReport = (f: Fixture) => assert.ok(!fs.existsSync(path.join(f.runDir, "site.json")) && !fs.existsSync(path.join(f.runDir, "site-pr.md")));
  // The repo file equals the live bytes (radical-candor-v1 on both), but this run published radical-candor-v2.
  // The repo file differs from the live bytes: main holds the newer published package, a deploy put tiny-habits-v26 back.
  const cases = [
    { bookId: "radical-candor", title: "Radical Candor", published: "radical-candor-v2", liveId: "radical-candor-v1" },
    { bookId: "tiny-habits", title: "Tiny Habits", published: "tiny-habits-v21-old", liveId: "tiny-habits-v26" },
  ];
  for (const c of cases) {
    for (const dryRun of [false, true]) {
      const f = fixture({ bookId: c.bookId, title: c.title, publishedId: c.published });
      const msg = `SITE_LIVE_STALE: the live store holds package ${c.liveId} for ${c.bookId}, but this run last published ${c.published}. A deploy from an older main has probably put an older package back, or the book was published from another run dir. Deploy main or publish again, then run site.`;
      await assert.rejects(site(f, { dryRun }), (e: Error) => e.message === msg);
      clean(f);
      noReport(f);
      assert.deepEqual(f.runs, []);
    }
  }

  // Cannot tell: no packageId in publish.json, or live bytes with no packageId (a real run) or not JSON (a dry run, since
  // the fake generators parse every package). Each proceeds with a note.
  const f = fixture({ publishedId: null });
  const r = await site(f);
  assert.ok(r.filesChanged.length > 0);
  assert.match(r.notes.join("\n"), /the live package check could not be made: .*publish\.json has no packageId/);
  const noId = JSON.stringify({ book: { bookId: "demo-book", title: "Demo Book" }, chapters: [{ chapterId: "d1" }] });
  const g = fixture({ live: { ...LIVE, "demo-book": noId }, publishedId: "demo-book-v26-1" });
  const r2 = await site(g);
  assert.equal(g.read("book-packages/demo-book.v21.json"), noId);
  assert.match(r2.notes.join("\n"), /the live package check could not be made: the live demo-book package is not JSON or has no packageId/);
  const h = fixture({ live: { ...LIVE, "demo-book": "not json" }, publishedId: "demo-book-v26-1" });
  const r3 = await site(h, { dryRun: true });
  assert.match(r3.notes.join("\n"), /the live package check could not be made: the live demo-book package/);
  // The ids agree: no note.
  const k = fixture();
  assert.ok(!(await site(k, { dryRun: true })).notes.some((n) => /live package check/.test(n)));
});

test("site: another title whose package on main is newer than the live one is left alone and reported as ahead; older, equal or undated is synced", async () => {
  const tinyRepo = (createdAt?: string) => pkg("tiny-habits", "Tiny Habits", 8, { rev: "v27", ...(createdAt !== undefined ? { createdAt } : {}) });
  const tinyLive = (createdAt?: string) => pkg("tiny-habits", "Tiny Habits", 8, { rev: "v26", ...(createdAt !== undefined ? { createdAt } : {}) });
  const setup = (repoAt?: string, liveAt?: string) => {
    const f = fixture({ live: { ...LIVE, "tiny-habits": tinyLive(liveAt) } });
    f.write("book-packages/tiny-habits.v21.json", tinyRepo(repoAt));
    f.commit("main is ahead");
    return f;
  };

  const f = setup("2026-11-12T09:00:00.000Z", "2026-11-10T09:00:00.000Z");
  const r = await site(f);
  assert.equal(f.read("book-packages/tiny-habits.v21.json"), tinyRepo("2026-11-12T09:00:00.000Z"), "byte-identical");
  assert.deepEqual(r.ahead, [{ bookId: "tiny-habits", file: "book-packages/tiny-habits.v21.json", repoCreatedAt: "2026-11-12T09:00:00.000Z", liveCreatedAt: "2026-11-10T09:00:00.000Z" }]);
  assert.ok(!r.synced.some((s) => s.bookId === "tiny-habits"));
  assert.ok(!r.filesChanged.includes("book-packages/tiny-habits.v21.json"));
  assert.equal(r.equal, 2, "not counted as equal");
  const body = fs.readFileSync(path.join(f.runDir, "site-pr.md"), "utf8");
  assert.match(body, /### Titles where main is ahead of the live store\n\n.*next prod deploy of main puts main's copy live; nothing in this pull request changes them:\n\n- `tiny-habits`: main `2026-11-12T09:00:00\.000Z`, live `2026-11-10T09:00:00\.000Z`/);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(f.runDir, "site.json"), "utf8")).ahead, r.ahead);

  // The CLI line.
  const c = setup("2026-11-12T09:00:00.000Z", "2026-11-10T09:00:00.000Z");
  let out = "";
  const code = await main(["site", "--book", cliConfig(c), "--repo", c.repo], { out: (s) => (out += s), err: () => {} }, { store: c.store, run: c.run, coversDir: c.coversDir });
  assert.equal(code, 0);
  assert.ok(out.includes("  main is ahead of the live store for tiny-habits (main 2026-11-12T09:00:00.000Z, live 2026-11-10T09:00:00.000Z): left alone; a prod deploy of main puts it live\n"), out);

  // Repo older, equal, either date missing or not a date: synced to the live bytes as before.
  for (const [repoAt, liveAt] of [
    ["2026-11-09T09:00:00.000Z", "2026-11-10T09:00:00.000Z"],
    ["2026-11-10T09:00:00.000Z", "2026-11-10T09:00:00.000Z"],
    [undefined, "2026-11-10T09:00:00.000Z"],
    ["2026-11-12T09:00:00.000Z", undefined],
    ["not a date", "2026-11-10T09:00:00.000Z"],
  ] as Array<[string | undefined, string | undefined]>) {
    const g = setup(repoAt, liveAt);
    const r2 = await site(g);
    assert.deepEqual(r2.ahead, [], `${repoAt} vs ${liveAt}`);
    assert.ok(r2.synced.some((s) => s.bookId === "tiny-habits"), `${repoAt} vs ${liveAt}`);
    assert.equal(g.read("book-packages/tiny-habits.v21.json"), tinyLive(liveAt));
    assert.ok(!fs.readFileSync(path.join(g.runDir, "site-pr.md"), "utf8").includes("main is ahead"));
  }

  // An untracked newer copy counts as missing, not ahead: it is written and staged like any missing package.
  const u = setup("2026-11-12T09:00:00.000Z", "2026-11-10T09:00:00.000Z");
  u.git("rm", "-q", "--cached", "book-packages/tiny-habits.v21.json");
  u.git("commit", "-q", "-m", "untrack");
  const r3 = await site(u, { dryRun: true });
  assert.deepEqual(r3.ahead, []);
  assert.deepEqual(r3.synced.filter((s) => s.bookId === "tiny-habits").map((s) => s.oldMd5), [null]);

  // The called-for title is never ahead: the stale check covers it, and with the ids agreeing main goes to the live bytes.
  const w = fixture({ bookId: "tiny-habits", title: "Tiny Habits", live: { ...LIVE, "tiny-habits": tinyLive("2026-11-10T09:00:00.000Z") } });
  w.write("book-packages/tiny-habits.v21.json", tinyRepo("2026-11-12T09:00:00.000Z"));
  w.commit("main is newer");
  const r4 = await site(w, { dryRun: true });
  assert.deepEqual(r4.ahead, []);
  assert.ok(r4.synced.some((s) => s.bookId === "tiny-habits"));
});

test("site: the pull request body says to merge before the next prod deploy, and next says it after gh pr create", async () => {
  const f = fixture();
  const r = await site(f);
  const body = fs.readFileSync(path.join(f.runDir, "site-pr.md"), "utf8");
  assert.ok(body.includes("### Merging changes nothing live\n\n**Merge this before the next production deploy.** A deploy that runs from main without this pull request uploads main's older copy of these packages over the live ones.\n\nMerging only changes main."), body);
  const i = r.next.findIndex((c) => c.startsWith("gh pr create "));
  assert.ok(i >= 0);
  assert.equal(r.next[i + 1], "# merge that pull request BEFORE any prod deploy: a deploy from main without it puts the older package back live");
  // Nothing to commit (or a dry run): no git or gh lines, so no comment either.
  f.commit("site");
  assert.ok(!(await site(f)).next.some((c) => c.includes("BEFORE any prod deploy")));
  assert.ok(!(await site(fixture(), { dryRun: true })).next.some((c) => c.includes("BEFORE any prod deploy")));
});

// ---------------------------------------------------------------- helpers

test("registry edits are idempotent and the import lands after the last package import", () => {
  const once = appendRegistryBlock(addRegistryImport(REGISTRY_TS, "the-4-hour-workweek"), "the-4-hour-workweek");
  assert.equal(appendRegistryBlock(addRegistryImport(once, "the-4-hour-workweek"), "the-4-hour-workweek"), once);
  assert.ok(once.includes(`import auto_the_4_hour_workweek_Json from "@/book-packages/the-4-hour-workweek.v21.json";\nimport { getBookCoverPath }`));
  assert.ok(once.endsWith(registryBlock("the-4-hour-workweek")));
  // Trailing blank lines are folded to one before the block, as publish-final does.
  assert.ok(appendRegistryBlock(REGISTRY_TS + "\n\n\n", "x").endsWith("tone);\n}\n" + registryBlock("x")));
  const f = { icon: "📘", difficulty: "Medium" as const, pages: 200 };
  const p1 = addPresentationEntry(REGISTRY_TS, "ultralearning", "x", f);
  assert.equal(p1, REGISTRY_TS, "an existing bare-key entry is left alone");
  const p2 = addPresentationEntry(REGISTRY_TS, "zen", "Calm.", f);
  assert.ok(p2.includes("\n  zen: {\n    icon: \"📘\","), "a key that is an identifier is written bare, as prettier does");
  assert.equal(addPresentationEntry(p2, "zen", "Other.", f), p2);
  assert.throws(() => addRegistryImport("const x = 1;\n", "a"), /SITE_REGISTRY_SHAPE/);
});

test("the fallback set and the optimizer list lose one id, keep their form, and are idempotent", () => {
  const a = removeFallbackCover(COVER_TS, "multipliers");
  assert.equal(a, COVER_TS.replace(`  "multipliers",\n`, ""));
  assert.equal(removeFallbackCover(a, "multipliers"), a);
  assert.equal(removeFallbackCover(COVER_TS, "zzz"), COVER_TS);
  assert.equal(removeFallbackCover(addFallbackCover(COVER_TS, "zzz"), "zzz"), COVER_TS);
  assert.throws(() => removeFallbackCover("const x = 1;", "a"), /SITE_COVER_SHAPE/);
  const b = removeOptimizerListEntry(OPTIMIZER_TS, "the-now-habit");
  assert.ok(b.includes(`    "the-first-90-days",\n  ]) {`));
  assert.equal(b, OPTIMIZER_TS.replace(`    "the-now-habit",\n`, ""));
  assert.equal(removeOptimizerListEntry(b, "the-now-habit"), b);
  // A prefix of a listed id, or the id only inside a string or a call, not as a list line, is left alone.
  assert.equal(removeOptimizerListEntry(OPTIMIZER_TS, "the-now"), OPTIMIZER_TS);
  assert.equal(removeOptimizerListEntry(OPTIMIZER_TS, "atomic-habits"), OPTIMIZER_TS);
  assert.ok(removeOptimizerListEntry(OPTIMIZER_TS, "behave").includes(`getBookCoverSourceCandidates("behave", remote)`));
});

test("the fallback set keeps its order and is not added to twice; the generator fix touches one string", () => {
  const a = addFallbackCover(COVER_TS, "zzz");
  assert.ok(a.includes(`  "the-now-habit",\n  "zzz",\n]);`));
  assert.ok(addFallbackCover(COVER_TS, "aaa").includes(`new Set([\n  "aaa",\n  "behave",`));
  assert.equal(addFallbackCover(a, "zzz"), a);
  assert.equal(addFallbackCover(COVER_TS, "decisive"), COVER_TS);
  assert.throws(() => addFallbackCover("const x = 1;", "a"), /SITE_COVER_SHAPE/);
  const fixed = fixGeneratorPath(GENERATOR_TS);
  assert.equal(fixed, GENERATOR_TS.replace("app/book/data/booksCatalog.metadata.json", "lib/books-catalog.metadata.json"));
  assert.equal(fixGeneratorPath(fixed), fixed);
  assert.throws(() => fixGeneratorPath(`const X = "app/book/data/booksCatalog.metadata.json";`), /SITE_GENERATOR_SHAPE/);
});

test("the presentation fields follow inferFallbackPresentation's rules", () => {
  const base = { book: { bookId: "b", title: "B", categories: ["Psychology"], tags: [] as string[] }, chapters: [{ readingTimeMinutes: 100 }, { readingTimeMinutes: 0 }] };
  assert.deepEqual(inferredPresentation({ ...base, book: { ...base.book, title: "Your Money or Your Life" } }), { icon: "💰", difficulty: "Medium", pages: 323 });
  assert.equal(inferredPresentation({ ...base, book: { ...base.book, categories: ["Strategy"] } }).difficulty, "Hard");
  assert.equal(inferredPresentation({ ...base, book: { ...base.book, categories: ["Decision Making"] } }).difficulty, "Hard");
  assert.ok(["🧠", "🫀", "🧭", "🧩", "👁️"].includes(inferredPresentation(base).icon));
  assert.equal(inferredPresentation({ ...base, chapters: [{ readingTimeMinutes: 5 }] }).pages, 160);
});

test("the ledger: the leaf is the record nobody supersedes, two leaves are refused, and appending keeps the old text", () => {
  assert.equal(currentLeaf([ROOT_REC, LEAF_REC, OTHER_REC], "app/book/data/bookPackages.ts")?.recordId, LEAF_REC.recordId);
  assert.equal(currentLeaf([OTHER_REC], "app/book/data/bookPackages.ts"), null);
  assert.throws(() => currentLeaf([ROOT_REC, { ...LEAF_REC, supersedesRecordId: null }], "app/book/data/bookPackages.ts"), /SITE_LEDGER_LEAF/);
  const text = ledgerText([ROOT_REC, LEAF_REC]);
  const rec = withId({ changeId: "z", purpose: "shared-maintenance", flag: null, path: "p.ts", appOwner: "a", bookOwner: "b", supersedesRecordId: null, repairedBlobSha256: "c".repeat(64), evidenceRefs: ["e"] });
  const next = appendLedgerRecord(text, rec);
  assert.ok(next.startsWith(text.slice(0, text.lastIndexOf("\n  ]"))));
  assert.equal(JSON.parse(next).records.length, 3);
  assert.throws(() => appendLedgerRecord(text.replace(/\n$/, ""), rec), /SITE_LEDGER_FORMAT/);
});

test("awsPackageStore: read-only aws calls with the publisher's names, every page of the listing, ETags unquoted", async () => {
  const calls: string[][] = [];
  const publisher = {
    async names() { return { table: "T", contentBucket: "content-b", ingestBucket: "ingest-b", region: "ca-central-1", profile: "cf" }; },
  } as unknown as Publisher;
  const pages: Record<string, unknown> = {
    first: { Contents: [{ Key: "book-content/packages/a.v21.json", ETag: '"' + "1".repeat(32) + '"', Size: 10 }, { Key: "book-content/packages/_quarantined/x.v21.json", ETag: '"z"', Size: 1 }], NextToken: "tok-2" },
    "tok-2": { Contents: [{ Key: "book-content/packages/b.v21.json", ETag: '"abc-2"', Size: 20 }, { Key: "book-content/packages/.pending-deploy.json", ETag: '"y"', Size: 1 }] },
  };
  const store = awsPackageStore(publisher, (args) => {
    calls.push(args);
    if (args[1] === "list-objects-v2") {
      const i = args.indexOf("--starting-token");
      return JSON.stringify(pages[i < 0 ? "first" : args[i + 1]!]);
    }
    fs.writeFileSync(args.at(-1)!, "bytes of b");
    return "{}";
  });
  const listing = await store.list();
  assert.deepEqual([...listing.entries()], [["a", { etag: "1".repeat(32), size: 10 }], ["b", { etag: "abc-2", size: 20 }]]);
  assert.equal((await store.get("b")).toString(), "bytes of b");
  assert.ok(calls.every((c) => c[0] === "s3api" && ["list-objects-v2", "get-object"].includes(c[1]!)), "no write call of any kind");
  assert.ok(calls.every((c) => c.includes("content-b") && c.includes("cf") && c.includes("ca-central-1")));
  assert.equal(calls.filter((c) => c[1] === "list-objects-v2").length, 2);
  assert.ok(calls.at(-1)!.includes("book-content/packages/b.v21.json"));
  assert.ok(!fs.existsSync(calls.at(-1)!.at(-1)!), "the temp file is removed");
});

// ---------------------------------------------------------------- the CLI

function cliConfig(f: Fixture): string {
  const dir = path.dirname(f.runDir);
  fs.writeFileSync(path.join(dir, "source.txt"), "Chapter 1 text.");
  fs.writeFileSync(path.join(dir, "map.json"), JSON.stringify({ sourceTextSha256: sha256("Chapter 1 text."), spans: [{ chapterNumber: 1, chapterTitle: "One", startOffset: 0, endOffset: 15 }] }));
  fs.writeFileSync(path.join(dir, "brief.md"), "BRIEF\n");
  const role = { bin: FAKE, model: "claude-opus-5-5", effort: "high" };
  const file = path.join(dir, "demo.json");
  fs.writeFileSync(file, JSON.stringify({
    bookId: f.ctx.config.bookId, title: f.ctx.config.title, author: "A. Author", bookType: "memoir", categories: ["Memoir"], tags: ["habits"],
    source: { textPath: "source.txt", chapterMapPath: "map.json" }, briefPath: "brief.md",
    shape: { examples: 2, quizQuestions: 3, choices: 3, reviewCards: 2, memorableLines: 1, ifThenPlans: 1, fastRead: [10, 100], deepRead: [10, 170], fullRead: [10, 320] },
    writer: role, checker: role, solver: role, budgetUsd: 1, runDir: "run",
  }));
  return file;
}

test("cli site: wired with --repo, --synopsis and --dry-run; usage errors exit 1, SITE_ refusals exit 2", async () => {
  const f = fixture();
  const config = cliConfig(f);
  const cli = async (...args: string[]) => {
    let out = "";
    let err = "";
    const code = await main(args, { out: (s) => (out += s), err: (s) => (err += s) }, { store: f.store, run: f.run, coversDir: f.coversDir });
    return { code, out, err };
  };

  for (const args of [
    ["site", "--book", config],
    ["status", "--book", config, "--repo", f.repo],
    ["publish", "--book", config, "--synopsis", "x"],
    ["site", "--repo", f.repo],
  ]) {
    const r = await cli(...args);
    assert.equal(r.code, 1, `args ${JSON.stringify(args)}: ${r.err}`);
    assert.match(r.err, /Usage:/);
  }
  assert.match((await cli("status", "--book", config, "--repo", f.repo)).err, /--repo only goes with the site command/);
  assert.match((await cli("site", "--book", config)).err, /site needs --repo/);

  const dry = await cli("site", "--book", config, "--repo", f.repo, "--dry-run", "--synopsis", "Short and true.");
  assert.equal(dry.code, 0, dry.err);
  assert.match(dry.out, /demo-book: site NEW, dry run/);
  assert.match(dry.out, /files that would change: .*app\/book\/data\/bookPackages\.ts/);
  clean(f);

  const ok = await cli("site", "--book", config, "--repo", f.repo, "--synopsis", "Short and true.");
  assert.equal(ok.code, 0, ok.err);
  assert.match(ok.out, /demo-book: site NEW/);
  assert.match(ok.out, /synced book-packages\/tiny-habits\.v21\.json: md5 [0-9a-f]{32} -> [0-9a-f]{32} \(revert guard\)/);
  assert.match(ok.out, /repo only, left alone: outliers/);
  assert.match(ok.out, /synopsis: authored; cover: fallback/);
  assert.match(ok.out, /approval record [0-9a-f]{64} \(supersedes [0-9a-f]{64}\)/);
  assert.match(ok.out, /next:\n {4}cd /);
  assert.ok(ok.out.trimEnd().endsWith(path.join(f.runDir, "site-pr.md")));

  fs.rmSync(path.join(f.runDir, "publish.json"));
  const refused = await cli("site", "--book", config, "--repo", f.repo);
  assert.equal(refused.code, 2);
  assert.match(refused.err, /^error: SITE_NOT_PUBLISHED/);

  // A cover pair from the cover verb: one line names the files carried in (dry run: to carry in).
  const h = fixture();
  const hConfig = cliConfig(h);
  putPair(h, "demo-book");
  for (const [args, verb] of [[["--dry-run"], "to carry in"], [[], "carried in"]] as Array<[string[], string]>) {
    let out = "";
    const code = await main(["site", "--book", hConfig, "--repo", h.repo, ...args], { out: (s) => (out += s), err: () => {} }, { store: h.store, run: h.run, coversDir: h.coversDir });
    assert.equal(code, 0);
    assert.match(out, new RegExp(`\\n {2}cover ${verb}: public/book-covers/demo-book\\.webp \\(${WEBP.length} bytes\\), public/book-covers/demo-book\\.avif \\(${AVIF.length} bytes\\)\\n`), out);
  }

  // The real store with no aws CLI, then a wrong profile: SITE_STORE_FAILED and exit 2, not a raw error and exit 1.
  const g = fixture();
  const gConfig = cliConfig(g);
  const publisher = { async names() { return { table: "T", contentBucket: "content-b", ingestBucket: "ingest-b", region: "ca-central-1", profile: "cf" }; } } as unknown as Publisher;
  for (const fail of [
    () => { throw Object.assign(new Error("spawnSync aws ENOENT"), { code: "ENOENT" }); },
    () => { throw new Error("Command failed: aws s3api list-objects-v2\nThe config profile (cf) could not be found"); },
  ]) {
    let err = "";
    const code = await main(["site", "--book", gConfig, "--repo", g.repo], { out: () => {}, err: (s) => (err += s) }, { store: awsPackageStore(publisher, fail), run: g.run, coversDir: g.coversDir });
    assert.equal(code, 2, err);
    assert.match(err, /^error: SITE_STORE_FAILED: (spawnSync aws ENOENT|Command failed: aws s3api list-objects-v2);/);
  }
  clean(g);
});
