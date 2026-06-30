/**
 * Library-state authority audit + chapter-identity migration.
 *
 * These pin the hardened rebuild contract: every rejected input is REPORTED (no
 * silent skips), the authority policy (published package wins; loose state is
 * authoritative only for unpublished books) is enforced rather than left to
 * file-system iteration order, a dry audit never writes, and the migration path
 * realigns chapterId/filename/index atomically with recoverable evidence.
 */

import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "fs";
import { resolve } from "path";

import {
  auditLibraryInputs,
  quarantineLibraryBlockers,
  rebuildLibraryState,
  saveLibraryState,
  verifyLibraryState,
  type LibraryAuditReport,
  type LibraryStateOptions,
} from "../src/librarian/libraryState.js";
import { applyChapterIdentityMigration, planChapterIdentityMigration } from "../src/librarian/identityMigration.js";
import { chapterContentHash } from "../src/critics/qcAttestation.js";
import { ChapterV21 } from "../src/types.js";
import { test } from "./harness.js";
import { makeChapter, PIPELINE_DIR, runCli, TMP_DIR } from "./helpers.js";

const ROOT = resolve(TMP_DIR, "library-audit");
const REPO_ROOT = PIPELINE_DIR;

type Fixture = {
  stateDir: string;
  chaptersDir: string;
  indexesDir: string;
  bookPackagesDir: string;
  opts: LibraryStateOptions;
};

function fresh(name: string): Fixture {
  const stateDir = resolve(ROOT, name);
  rmSync(stateDir, { recursive: true, force: true });
  const chaptersDir = resolve(stateDir, "chapters");
  const indexesDir = resolve(stateDir, "indexes");
  const bookPackagesDir = resolve(stateDir, "book-packages");
  for (const d of [chaptersDir, indexesDir, bookPackagesDir]) mkdirSync(d, { recursive: true });
  const opts: LibraryStateOptions = { stateDir, chaptersDir, indexesDir, bookPackagesDir, now: () => 0, lock: { heartbeatMs: 0 } };
  return { stateDir, chaptersDir, indexesDir, bookPackagesDir, opts };
}

function writePackage(dir: string, bookId: string, chapters: ChapterV21[], meta: { title?: string; author?: string } = {}): void {
  writeFileSync(
    resolve(dir, `${bookId}.v21.json`),
    JSON.stringify(
      {
        schemaVersion: "book-package-v21",
        packageId: `${bookId}-pkg`,
        createdAt: "2026-01-01T00:00:00.000Z",
        contentOwner: "test",
        book: { bookId, title: meta.title ?? bookId, author: meta.author ?? "Test Author" },
        chapters,
      },
      null,
      2,
    ),
    "utf8",
  );
}

function writeRaw(dir: string, fileName: string, raw: string): void {
  writeFileSync(resolve(dir, fileName), raw, "utf8");
}

function writeLoose(dir: string, fileName: string, chapter: unknown): void {
  writeFileSync(resolve(dir, fileName), JSON.stringify(chapter, null, 2) + "\n", "utf8");
}

function writeIndex(dir: string, bookId: string, entries: Array<{ chapterId: string; chapterNumber: number; chapterTitle?: string }>): void {
  writeFileSync(
    resolve(dir, `${bookId}.json`),
    JSON.stringify(entries.map((e) => ({ chapterId: e.chapterId, chapterNumber: e.chapterNumber, chapterTitle: e.chapterTitle ?? "" })), null, 2) + "\n",
    "utf8",
  );
}

function hasBlocker(report: LibraryAuditReport, checkId: string): boolean {
  return report.rejected.some((f) => f.checkId === checkId);
}

// ── Phase 1: the audit reports, never silently skips ────────────────────────

test("a malformed or unreadable package is reported as a blocker, not silently skipped", () => {
  const { bookPackagesDir, opts } = fresh("malformed-package");
  writeRaw(bookPackagesDir, "bad-book.v21.json", JSON.stringify({ book: { bookId: "bad-book" } })); // no `chapters`
  writeRaw(bookPackagesDir, "torn-book.v21.json", "{ not valid json ");
  const report = auditLibraryInputs(opts);
  assert.ok(hasBlocker(report, "library.malformed_package"), "malformed package must be a blocker");
  assert.ok(hasBlocker(report, "library.unreadable_json"), "unreadable package must be a blocker");
  assert.ok(report.rejected.every((f) => f.path && f.reason && f.severity === "blocker"), "every rejection names a path + reason");
});

test("a malformed loose chapter is reported as a blocker", () => {
  const { chaptersDir, opts } = fresh("malformed-loose");
  writeLoose(chaptersDir, "ghost-book-ch01.v21-native.chapter.json", { chapterId: "ghost-book-ch01", title: "x" }); // no `number`
  const report = auditLibraryInputs(opts);
  assert.ok(hasBlocker(report, "library.malformed_chapter"), "a loose chapter without an integer number must be reported");
});

// ── Authority policy ────────────────────────────────────────────────────────

test("an UNPUBLISHED book with an identity-mismatched loose chapter blocks the rebuild (its loose content is authoritative yet unattributable)", () => {
  const { chaptersDir, indexesDir, opts } = fresh("unpub-mismatch");
  const looseCh = makeChapter("solo-book", 1);
  looseCh.chapterId = "Solo-book-ch01"; // chapterId != filename stem, and no package exists
  writeLoose(chaptersDir, "solo-book-ch01.v21-native.chapter.json", looseCh);
  writeIndex(indexesDir, "solo-book", [{ chapterId: "solo-book-ch01", chapterNumber: 1 }]);

  const report = auditLibraryInputs(opts);
  assert.ok(report.blockerCount > 0, "an unpublished authoritative chapter with a mismatched id must block");
  assert.ok(hasBlocker(report, "library.chapterid_filename_mismatch"));
  assert.deepEqual(report.plannedWrites, [], "a real rebuild must not plan a write while blocked");
});

test("a published book's loose-draft anomaly is a non-blocking conflict; the package wins and the draft is never ingested", () => {
  const { bookPackagesDir, chaptersDir, indexesDir, opts } = fresh("pub-draft-conflict");
  const pkgCh = makeChapter("conf-book", 1);
  writePackage(bookPackagesDir, "conf-book", [pkgCh]);
  writeIndex(indexesDir, "conf-book", [{ chapterId: "conf-book-ch01", chapterNumber: 1 }]);
  // a draft that BOTH diverges in content AND carries a capitalized chapterId —
  // for a PUBLISHED book the package is authoritative, so this is reported (never
  // silently overwriting the package) but does not block the catalog rebuild.
  const looseCh = makeChapter("conf-book", 1, { overrides: { hook: "A divergent draft hook that changes the content hash." } });
  looseCh.chapterId = "Conf-book-ch01";
  writeLoose(chaptersDir, "conf-book-ch01.v21-native.chapter.json", looseCh);

  const report = auditLibraryInputs(opts);
  assert.equal(report.blockerCount, 0, "a published book's draft anomaly must not block the whole-catalog rebuild");
  assert.ok(report.findings.some((f) => f.checkId === "library.chapterid_filename_mismatch" && f.severity === "warning"), "the anomaly is reported as a warning");
  const expected = rebuildLibraryState(opts);
  assert.equal(expected.books["conf-book"].chapterContributions["1"].contentHash, chapterContentHash(pkgCh), "package content wins; the draft is not ingested");
});

test("a well-formed loose draft that diverges from the published package is a non-blocking conflict (package wins)", () => {
  const { bookPackagesDir, chaptersDir, indexesDir, opts } = fresh("pkg-loose-divergence");
  const pkgCh = makeChapter("div-book", 1);
  writePackage(bookPackagesDir, "div-book", [pkgCh]);
  writeIndex(indexesDir, "div-book", [{ chapterId: "div-book-ch01", chapterNumber: 1 }]);
  const looseCh = makeChapter("div-book", 1, { overrides: { hook: "Different hook — an unpublished divergent draft." } });
  writeLoose(chaptersDir, "div-book-ch01.v21-native.chapter.json", looseCh);

  const report = auditLibraryInputs(opts);
  assert.equal(report.blockerCount, 0, "a well-formed divergent draft must not block");
  assert.ok(report.conflicts.some((f) => f.checkId === "library.package_loose_divergence"), "divergence is reported as a conflict");
  const expected = rebuildLibraryState(opts);
  assert.equal(expected.books["div-book"].chapterContributions["1"].contentHash, chapterContentHash(pkgCh), "package content wins for a published book");
});

// ── Determinism + duplicates ────────────────────────────────────────────────

test("duplicate book identity is reported deterministically regardless of file-system ordering", () => {
  const { bookPackagesDir, opts } = fresh("dup-identity");
  const ch = makeChapter("dup-book", 1);
  writePackage(bookPackagesDir, "dup-book", [ch]); // file "dup-book.v21.json"
  writeRaw(bookPackagesDir, "zzz-dup.v21.json", JSON.stringify({ book: { bookId: "Dup Book" }, chapters: [ch] })); // normalizes to "dup-book"

  const r1 = auditLibraryInputs(opts);
  const r2 = auditLibraryInputs(opts);
  assert.ok(hasBlocker(r1, "library.duplicate_book_identity"));
  assert.equal(JSON.stringify(r1.findings), JSON.stringify(r2.findings), "findings are identical across runs");
  assert.equal(JSON.stringify(r1.accepted), JSON.stringify(r2.accepted), "accepted set is identical across runs");
  // the sorted-first package wins; the later file is the blocker
  const dup = r1.rejected.find((f) => f.checkId === "library.duplicate_book_identity");
  assert.match(dup!.path, /zzz-dup\.v21\.json$/);
  assert.match(JSON.stringify(r1.accepted), /dup-book\.v21\.json/);
});

test("a package that lists a chapter number twice is a blocker", () => {
  const { bookPackagesDir, opts } = fresh("dup-number");
  writePackage(bookPackagesDir, "twin", [makeChapter("twin", 1), makeChapter("twin", 1, { overrides: { hook: "second copy" } })]);
  assert.ok(hasBlocker(auditLibraryInputs(opts), "library.duplicate_chapter_number"));
});

// ── A dry run performs no writes ─────────────────────────────────────────────

test("auditing and dry-run rebuilding never write to disk", () => {
  const { stateDir, chaptersDir, indexesDir, opts } = fresh("no-write");
  writeLoose(chaptersDir, "ghost-ch01.v21-native.chapter.json", makeChapter("ghost", 1));
  writeIndex(indexesDir, "ghost", [{ chapterId: "ghost-ch01", chapterNumber: 1 }]);
  const ledgerPath = resolve(stateDir, "library-state.json");
  writeFileSync(ledgerPath, '{"version":"2.0.0","revision":7,"books":{}}', "utf8"); // deliberately stale
  const before = readFileSync(ledgerPath, "utf8");
  const beforeFiles = readdirSync(stateDir).sort();

  auditLibraryInputs(opts);
  rebuildLibraryState(opts); // returns a value; must not persist
  verifyLibraryState(opts);

  assert.equal(readFileSync(ledgerPath, "utf8"), before, "the ledger must be byte-identical after a dry audit/rebuild");
  assert.deepEqual(readdirSync(stateDir).sort(), beforeFiles, "no lock/journal/tmp files may appear");
});

// ── Phase 2: migration ──────────────────────────────────────────────────────

test("migrate-chapter-identity aligns filename, chapterId, and canonical index atomically", () => {
  const { stateDir, chaptersDir, indexesDir } = fresh("migrate-apply");
  const c1 = makeChapter("mig-book", 1);
  c1.chapterId = "Mig-book-ch01"; // chapterId-only mismatch (filename already canonical)
  writeLoose(chaptersDir, "mig-book-ch01.v21-native.chapter.json", c1);
  const c2 = makeChapter("mig-book", 2);
  c2.chapterId = "mig-book-ch2"; // unpadded filename + chapterId → needs a rename too
  writeLoose(chaptersDir, "mig-book-ch2.v21-native.chapter.json", c2);
  writeIndex(indexesDir, "mig-book", [
    { chapterId: "Mig-book-ch01", chapterNumber: 1 },
    { chapterId: "mig-book-ch2", chapterNumber: 2 },
  ]);

  const mopts = { stateDir, now: () => 0 };
  const plan = planChapterIdentityMigration("mig-book", mopts);
  assert.equal(plan.ok, true);
  assert.equal(plan.changeCount, 2);
  applyChapterIdentityMigration(plan, mopts);

  const f1 = resolve(chaptersDir, "mig-book-ch01.v21-native.chapter.json");
  assert.equal(JSON.parse(readFileSync(f1, "utf8")).chapterId, "mig-book-ch01");
  assert.ok(existsSync(resolve(chaptersDir, "mig-book-ch02.v21-native.chapter.json")), "ch02 renamed to the canonical padded filename");
  assert.ok(!existsSync(resolve(chaptersDir, "mig-book-ch2.v21-native.chapter.json")), "the unpadded original is gone");
  assert.equal(JSON.parse(readFileSync(resolve(chaptersDir, "mig-book-ch02.v21-native.chapter.json"), "utf8")).chapterId, "mig-book-ch02");

  const idx = JSON.parse(readFileSync(resolve(indexesDir, "mig-book.json"), "utf8")) as Array<{ chapterId: string }>;
  assert.deepEqual(idx.map((e) => e.chapterId).sort(), ["mig-book-ch01", "mig-book-ch02"]);

  const migDir = resolve(stateDir, "_migrations");
  assert.ok(readdirSync(migDir).some((f) => f.endsWith(".plan.json")), "a plan file is preserved");
  assert.ok(readdirSync(migDir).some((f) => f.endsWith(".report.json")), "a report file is preserved");
  assert.ok(readdirSync(chaptersDir).every((f) => !f.includes("migrate-tmp")), "no temp files leak");

  // idempotent: a second plan finds nothing to do
  assert.equal(planChapterIdentityMigration("mig-book", mopts).changeCount, 0);
});

test("an ambiguous mapping is refused and applies nothing", () => {
  const { stateDir, chaptersDir } = fresh("migrate-ambiguous");
  const a = makeChapter("amb-book", 1);
  const b = makeChapter("amb-book", 1, { overrides: { hook: "rival copy" } });
  // two distinct files both claim chapter 1
  writeLoose(chaptersDir, "amb-book-ch01.v21-native.chapter.json", a);
  writeLoose(chaptersDir, "amb-book-ch1.v21-native.chapter.json", b);
  const plan = planChapterIdentityMigration("amb-book", { stateDir, now: () => 0 });
  assert.equal(plan.ok, false);
  assert.ok(plan.ambiguities.some((m) => /chapter 1 is claimed by both/.test(m)));
  assert.throws(() => applyChapterIdentityMigration(plan, { stateDir, now: () => 0 }), /ambiguous/i);
  assert.ok(!existsSync(resolve(stateDir, "_migrations")), "an ambiguous plan writes nothing at all");
});

test("a migration interrupted before the first rename preserves the plan evidence and leaves no chapter file torn", () => {
  const { stateDir, chaptersDir, indexesDir } = fresh("migrate-interrupt");
  const c1 = makeChapter("crash-book", 1); c1.chapterId = "Crash-book-ch01";
  const c2 = makeChapter("crash-book", 2); c2.chapterId = "Crash-book-ch02";
  writeLoose(chaptersDir, "crash-book-ch01.v21-native.chapter.json", c1);
  writeLoose(chaptersDir, "crash-book-ch02.v21-native.chapter.json", c2);
  writeIndex(indexesDir, "crash-book", [{ chapterId: "Crash-book-ch01", chapterNumber: 1 }, { chapterId: "Crash-book-ch02", chapterNumber: 2 }]);

  const mopts = { stateDir, now: () => 0, faultInjection: { beforeFirstRename: true } };
  const plan = planChapterIdentityMigration("crash-book", mopts);
  assert.throws(() => applyChapterIdentityMigration(plan, mopts), /beforeFirstRename/);

  const migDir = resolve(stateDir, "_migrations");
  assert.ok(readdirSync(migDir).some((f) => f.endsWith(".plan.json")), "plan evidence survives the interruption");
  assert.ok(!readdirSync(migDir).some((f) => f.endsWith(".report.json")), "no report — the migration did not complete");
  for (const [f, id] of [["crash-book-ch01.v21-native.chapter.json", "Crash-book-ch01"], ["crash-book-ch02.v21-native.chapter.json", "Crash-book-ch02"]] as const) {
    const parsed = JSON.parse(readFileSync(resolve(chaptersDir, f), "utf8"));
    assert.equal(parsed.chapterId, id, "every original chapter file is intact and parseable");
  }
  assert.ok(readdirSync(chaptersDir).every((f) => !f.includes("migrate-tmp")), "no temp files leak");
});

test("a migration interrupted after the first rename is durably partial and the remainder re-plans cleanly", () => {
  const { stateDir, chaptersDir, indexesDir } = fresh("migrate-partial");
  const c1 = makeChapter("part-book", 1); c1.chapterId = "Part-book-ch01";
  const c2 = makeChapter("part-book", 2); c2.chapterId = "Part-book-ch02";
  writeLoose(chaptersDir, "part-book-ch01.v21-native.chapter.json", c1);
  writeLoose(chaptersDir, "part-book-ch02.v21-native.chapter.json", c2);
  writeIndex(indexesDir, "part-book", [{ chapterId: "Part-book-ch01", chapterNumber: 1 }, { chapterId: "Part-book-ch02", chapterNumber: 2 }]);

  const crash = { stateDir, now: () => 0, faultInjection: { afterFirstRename: true } };
  assert.throws(() => applyChapterIdentityMigration(planChapterIdentityMigration("part-book", crash), crash), /afterFirstRename/);
  // ch01 committed, ch02 still original — durable partial state, nothing torn
  assert.equal(JSON.parse(readFileSync(resolve(chaptersDir, "part-book-ch01.v21-native.chapter.json"), "utf8")).chapterId, "part-book-ch01");
  assert.equal(JSON.parse(readFileSync(resolve(chaptersDir, "part-book-ch02.v21-native.chapter.json"), "utf8")).chapterId, "Part-book-ch02");

  // re-running completes the remainder and converges
  const finish = { stateDir, now: () => 0 };
  applyChapterIdentityMigration(planChapterIdentityMigration("part-book", finish), finish);
  assert.equal(planChapterIdentityMigration("part-book", finish).changeCount, 0, "a final re-plan finds nothing left to align");
});

// ── Phase 3 properties: idempotent rebuild, drift, quarantine ───────────────

test("rebuilding twice yields identical logical state and verify reports no drift after a rebuild", async () => {
  const { bookPackagesDir, chaptersDir, indexesDir, opts } = fresh("idempotent");
  writePackage(bookPackagesDir, "pub-book", [makeChapter("pub-book", 1), makeChapter("pub-book", 2)]);
  writeIndex(indexesDir, "pub-book", [{ chapterId: "pub-book-ch01", chapterNumber: 1 }, { chapterId: "pub-book-ch02", chapterNumber: 2 }]);
  writeLoose(chaptersDir, "draft-book-ch01.v21-native.chapter.json", makeChapter("draft-book", 1));
  writeIndex(indexesDir, "draft-book", [{ chapterId: "draft-book-ch01", chapterNumber: 1 }]);

  const a = rebuildLibraryState(opts);
  const b = rebuildLibraryState(opts);
  assert.deepEqual(a.books, b.books);
  assert.deepEqual(a.globalNameUsage, b.globalNameUsage);
  assert.deepEqual(a.globalAnswerPositionCounts, b.globalAnswerPositionCounts);

  await saveLibraryState(a, opts);
  assert.equal(verifyLibraryState(opts).drift, false, "no drift right after a rebuild+save");
  assert.deepEqual(rebuildLibraryState(opts).books, a.books, "a third rebuild matches the saved state");
});

test("verify reports drift when an authoritative input changes and false again after rebuild", async () => {
  const { chaptersDir, indexesDir, opts } = fresh("drift");
  writeLoose(chaptersDir, "novel-ch01.v21-native.chapter.json", makeChapter("novel", 1));
  writeIndex(indexesDir, "novel", [{ chapterId: "novel-ch01", chapterNumber: 1 }]);
  await saveLibraryState(rebuildLibraryState(opts), opts);
  assert.equal(verifyLibraryState(opts).drift, false);

  writeLoose(chaptersDir, "novel-ch02.v21-native.chapter.json", makeChapter("novel", 2));
  writeIndex(indexesDir, "novel", [{ chapterId: "novel-ch01", chapterNumber: 1 }, { chapterId: "novel-ch02", chapterNumber: 2 }]);
  assert.equal(verifyLibraryState(opts).drift, true, "a new authoritative chapter must surface as drift");

  await saveLibraryState(rebuildLibraryState(opts), opts);
  assert.equal(verifyLibraryState(opts).drift, false, "drift clears after a rebuild");
});

test("a rebuilt ledger verifies clean even when re-checked at a later wall-clock time", async () => {
  const { stateDir, chaptersDir, indexesDir, bookPackagesDir } = fresh("time-determinism");
  writeLoose(chaptersDir, "clock-ch01.v21-native.chapter.json", makeChapter("clock", 1));
  writeIndex(indexesDir, "clock", [{ chapterId: "clock-ch01", chapterNumber: 1 }]);
  const base = { stateDir, chaptersDir, indexesDir, bookPackagesDir, lock: { heartbeatMs: 0 } } as const;
  // Save the rebuilt ledger stamped at T1, then verify by rebuilding at a much
  // later T2 — only `ingestedAt` would differ, and that must NOT count as drift.
  const early: LibraryStateOptions = { ...base, now: () => 1_000 };
  await saveLibraryState(rebuildLibraryState(early), early);
  const late: LibraryStateOptions = { ...base, now: () => 9_000_000 };
  assert.equal(verifyLibraryState(late).drift, false, "ingestedAt provenance drift must not be reported as logical drift");
});

test("a malformed loose chapter finding carries the filename-derived bookId and chapter", () => {
  const { chaptersDir, opts } = fresh("malformed-bookid");
  writeLoose(chaptersDir, "ghost-book-ch03.v21-native.chapter.json", { chapterId: "ghost-book-ch03" }); // no `number`
  const f = auditLibraryInputs(opts).rejected.find((x) => x.checkId === "library.malformed_chapter");
  assert.equal(f?.bookId, "ghost-book", "bookId is derivable from the filename even when the JSON is malformed");
  assert.equal(f?.chapter, 3, "chapter number is derivable from the filename");
});

test("a corrupt package never lets its loose drafts be ingested as published content; quarantine removes both", () => {
  const { bookPackagesDir, chaptersDir, indexesDir, opts } = fresh("corrupt-pkg-draft");
  writeRaw(bookPackagesDir, "pub.v21.json", "{ torn package json "); // unreadable package
  writeLoose(chaptersDir, "pub-ch01.v21-native.chapter.json", makeChapter("pub", 1)); // well-formed draft
  writeIndex(indexesDir, "pub", [{ chapterId: "pub-ch01", chapterNumber: 1 }]);

  const before = auditLibraryInputs(opts);
  assert.ok(before.blockerCount > 0, "the torn package is a blocker");
  assert.equal(rebuildLibraryState(opts).books["pub"], undefined, "the draft must NOT silently become the published book");

  const q = quarantineLibraryBlockers(opts, "test");
  assert.ok(q.movedFiles.some((m) => m.from.includes("pub.v21.json")), "the corrupt package is quarantined");
  assert.ok(q.movedFiles.some((m) => m.from.includes("pub-ch01")), "the draft of the quarantined package is pulled out too — no authority inversion");
  assert.equal(auditLibraryInputs(opts).blockerCount, 0, "the blocker is cleared");
  assert.equal(rebuildLibraryState(opts).books["pub"], undefined, "the book is fully removed, not draft-substituted");
});

test("a published book's looseOnly chapter is a non-blocking orphan conflict and is not ingested", () => {
  const { bookPackagesDir, chaptersDir, indexesDir, opts } = fresh("orphan");
  writePackage(bookPackagesDir, "orph", [makeChapter("orph", 1)]);
  writeIndex(indexesDir, "orph", [{ chapterId: "orph-ch01", chapterNumber: 1 }]);
  writeLoose(chaptersDir, "orph-ch02.v21-native.chapter.json", makeChapter("orph", 2)); // no package counterpart

  const report = auditLibraryInputs(opts);
  assert.equal(report.blockerCount, 0);
  assert.ok(report.findings.some((f) => f.checkId === "library.package_loose_orphan_chapter"));
  assert.deepEqual(rebuildLibraryState(opts).books["orph"].chaptersIngested, [1], "only the package's chapter is ingested");
});

test("an authoritative chapter absent from the canonical index is a non-blocking warning", () => {
  const { chaptersDir, indexesDir, opts } = fresh("index-gap");
  writeLoose(chaptersDir, "idx-ch01.v21-native.chapter.json", makeChapter("idx", 1));
  writeIndex(indexesDir, "idx", []); // empty index → ch01 is missing
  const report = auditLibraryInputs(opts);
  assert.equal(report.blockerCount, 0);
  assert.ok(report.warnings.some((f) => f.checkId === "library.missing_canonical_index_membership" && f.chapter === 1));
});

test("a corrupt stored ledger is reported as a blocker, never an unhandled throw (dry-run never crashes)", () => {
  const { stateDir, chaptersDir, indexesDir, opts } = fresh("corrupt-ledger");
  writeLoose(chaptersDir, "novel-ch01.v21-native.chapter.json", makeChapter("novel", 1));
  writeIndex(indexesDir, "novel", [{ chapterId: "novel-ch01", chapterNumber: 1 }]);
  writeFileSync(resolve(stateDir, "library-state.json"), "{ not valid json", "utf8");
  const report = auditLibraryInputs(opts); // must not throw
  assert.ok(hasBlocker(report, "library.unreadable_ledger"), "a corrupt ledger is surfaced as a blocker");
});

test("migrate-chapter-identity does not lose data on a case-only rename (case-insensitive FS safe)", () => {
  const { stateDir, chaptersDir, indexesDir } = fresh("case-rename");
  const ch = makeChapter("casebook", 1);
  ch.chapterId = "Casebook-ch01";
  writeLoose(chaptersDir, "Casebook-ch01.v21-native.chapter.json", ch); // capital filename → target differs only by case
  writeIndex(indexesDir, "casebook", [{ chapterId: "Casebook-ch01", chapterNumber: 1 }]);

  const mopts = { stateDir, now: () => 0 };
  const plan = planChapterIdentityMigration("casebook", mopts);
  assert.equal(plan.ok, true);
  applyChapterIdentityMigration(plan, mopts);

  const files = readdirSync(chaptersDir).filter((f) => f.endsWith(".chapter.json"));
  assert.equal(files.length, 1, "exactly one chapter file remains — a case-collision unlink did not delete it");
  const content = JSON.parse(readFileSync(resolve(chaptersDir, files[0]), "utf8"));
  assert.equal(content.chapterId, "casebook-ch01");
  assert.equal(content.number, 1, "the chapter content is intact, not lost");
});

// ── CLI contract (isolated via CHAPTERFLOW_STATE_DIR) ───────────────────────

test("CLI: rebuild-library-state --dry-run signals drift but writes nothing; a real rebuild is then idempotent", () => {
  const { stateDir, chaptersDir, indexesDir } = fresh("cli-dryrun");
  writeLoose(chaptersDir, "clibook-ch01.v21-native.chapter.json", makeChapter("clibook", 1));
  writeIndex(indexesDir, "clibook", [{ chapterId: "clibook-ch01", chapterNumber: 1 }]);
  const env = { CHAPTERFLOW_STATE_DIR: stateDir };
  const ledger = resolve(stateDir, "library-state.json");

  const dry = runCli(["rebuild-library-state", "--dry-run"], env);
  assert.equal(dry.status, 1, `drift with no blockers ⇒ exit 1\n${dry.out}`);
  assert.ok(!existsSync(ledger), "a dry run must not create the ledger");

  const real = runCli(["rebuild-library-state"], env);
  assert.equal(real.status, 0, real.out);
  assert.ok(existsSync(ledger), "a real rebuild writes the ledger");

  const bytes = readFileSync(ledger, "utf8");
  const again = runCli(["rebuild-library-state"], env);
  assert.equal(again.status, 0, again.out);
  assert.equal(readFileSync(ledger, "utf8"), bytes, "a second rebuild is a byte-identical no-op");
});

test("CLI: a blocker makes rebuild-library-state exit 2 and leaves the ledger untouched", () => {
  const { stateDir, chaptersDir } = fresh("cli-blocker");
  const ch = makeChapter("blk", 1);
  ch.chapterId = "Blk-ch01"; // unpublished + mismatched id → blocker
  writeLoose(chaptersDir, "blk-ch01.v21-native.chapter.json", ch);
  const r = runCli(["rebuild-library-state"], { CHAPTERFLOW_STATE_DIR: stateDir });
  assert.equal(r.status, 2, `a blocked rebuild must exit 2\n${r.out}`);
  assert.ok(!existsSync(resolve(stateDir, "library-state.json")), "a blocked rebuild writes nothing");
});

test("CLI: migrate-chapter-identity --apply clears an identity blocker so the rebuild then succeeds", () => {
  const { stateDir, chaptersDir, indexesDir } = fresh("cli-migrate");
  const ch = makeChapter("mig", 1);
  ch.chapterId = "Mig-ch01";
  writeLoose(chaptersDir, "mig-ch01.v21-native.chapter.json", ch);
  writeIndex(indexesDir, "mig", [{ chapterId: "Mig-ch01", chapterNumber: 1 }]);
  const env = { CHAPTERFLOW_STATE_DIR: stateDir };

  assert.equal(runCli(["rebuild-library-state"], env).status, 2, "blocked before migration");
  const m = runCli(["migrate-chapter-identity", "mig", "--apply"], env);
  assert.equal(m.status, 0, m.out);
  assert.equal(runCli(["rebuild-library-state"], env).status, 0, "clean after migration");
});

test("quarantine moves blocker files aside (preserving evidence) so a rebuild can proceed", () => {
  const { bookPackagesDir, indexesDir, opts } = fresh("quarantine");
  writePackage(bookPackagesDir, "ok-book", [makeChapter("ok-book", 1)]);
  writeIndex(indexesDir, "ok-book", [{ chapterId: "ok-book-ch01", chapterNumber: 1 }]);
  writeRaw(bookPackagesDir, "torn.v21.json", "{ broken json ");
  assert.ok(auditLibraryInputs(opts).blockerCount > 0);

  const q = quarantineLibraryBlockers(opts, "test");
  assert.equal(q.movedFiles.length, 1, "the one corrupt file is moved");
  assert.ok(!existsSync(resolve(bookPackagesDir, "torn.v21.json")), "the corrupt file leaves the authoritative set");
  const report = resolve(q.quarantineDir, "quarantine-report.json");
  assert.ok(existsSync(report), "a quarantine report preserves the evidence");
  const movedAbs = resolve(REPO_ROOT, q.movedFiles[0].to);
  assert.equal(readFileSync(movedAbs, "utf8"), "{ broken json ", "the original bytes are preserved, not deleted");
  assert.equal(auditLibraryInputs(opts).blockerCount, 0, "no blockers remain after quarantine");
});
