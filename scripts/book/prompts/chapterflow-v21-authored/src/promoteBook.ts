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

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { BookPackageV21, ChapterV21, V21_SCHEMA_VERSION } from "./types.js";
import { runShipGate, GateReport, formatGateReport } from "./critics/finalGate.js";
import { runBookGate, BookGateReport, formatBookGateReport } from "./critics/bookGate.js";
import { ChapterSpec } from "./generateChapter.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE = resolve(__dirname, "../state");
const REPO_ROOT = resolve(__dirname, "../../../../..");
const BOOK_PACKAGES_DIR = resolve(REPO_ROOT, "book-packages");
const QUARANTINE_DIR = resolve(STATE, "books", "_blocked");

export type PromotionResult = {
  promoted: boolean;
  bookId: string;
  packagePath?: string;          // set if promoted
  reportPath: string;            // always set; contains the gate findings
  shipGateBlockerCount: number;
  bookGateBlockerCount: number;
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

export function promoteBook(input: PromotionInput): PromotionResult {
  const { bookId, title, author, chapters } = input;

  // Step 1: Load every expected chapter from state/chapters/
  const loadedChapters: ChapterV21[] = [];
  const missingChapters: number[] = [];
  for (const spec of chapters) {
    const path = resolve(STATE, "chapters", `${spec.chapterId}.v21-native.chapter.json`);
    if (!existsSync(path)) {
      missingChapters.push(spec.chapterNumber);
      continue;
    }
    loadedChapters.push(JSON.parse(readFileSync(path, "utf8")) as ChapterV21);
  }
  if (missingChapters.length > 0) {
    return blockedResult({
      bookId,
      reason: `Missing chapters: ${missingChapters.join(", ")}. Generate them before promoting.`,
      missingChapters,
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

  // Step 3: Run book gate across all chapters.
  const bookGate = runBookGate(bookId, loadedChapters);
  const bookBlockerCount = bookGate.findings.filter((f) => f.severity === "blocker").length;
  const bookMajorCount = bookGate.findings.filter((f) => f.severity === "major").length;

  // Step 4: Write the report regardless of pass/fail.
  mkdirSync(resolve(STATE, "books"), { recursive: true });
  const reportPath = resolve(STATE, "books", `${bookId}.gate.json`);
  const fullReport = {
    bookId,
    title,
    author,
    promotedAt: new Date().toISOString(),
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
  };
  writeFileSync(reportPath, JSON.stringify(fullReport, null, 2), "utf8");

  // Step 5: Promote only if EVERY gate passes blocker-clean.
  if (shipBlockerCount > 0 || bookBlockerCount > 0) {
    mkdirSync(QUARANTINE_DIR, { recursive: true });
    const quarantinePath = resolve(QUARANTINE_DIR, `${bookId}.${Date.now()}.report.json`);
    writeFileSync(quarantinePath, JSON.stringify(fullReport, null, 2), "utf8");
    return {
      promoted: false,
      bookId,
      reportPath,
      shipGateBlockerCount: shipBlockerCount,
      bookGateBlockerCount: bookBlockerCount,
      shipGateMajorCount: shipMajorCount,
      bookGateMajorCount: bookMajorCount,
      reason: `BLOCKED: ${shipBlockerCount} ship-gate blocker(s) + ${bookBlockerCount} book-gate blocker(s). Quarantined at ${quarantinePath}.`,
    };
  }

  // Step 6: Build the BookPackageV21 and write it to the library.
  const pkg: BookPackageV21 = {
    schemaVersion: V21_SCHEMA_VERSION,
    packageId: `${bookId}-v21-${Date.now()}`,
    createdAt: new Date().toISOString(),
    contentOwner: input.contentOwner ?? "chapterflow",
    book: {
      bookId,
      title,
      author,
      categories: input.categories,
      tags: input.tags,
    },
    chapters: loadedChapters.sort((a, b) => a.number - b.number),
  };

  mkdirSync(BOOK_PACKAGES_DIR, { recursive: true });
  const packagePath = resolve(BOOK_PACKAGES_DIR, `${bookId}.v21.json`);
  writeFileSync(packagePath, JSON.stringify(pkg, null, 2), "utf8");

  return {
    promoted: true,
    bookId,
    packagePath,
    reportPath,
    shipGateBlockerCount: 0,
    bookGateBlockerCount: 0,
    shipGateMajorCount: shipMajorCount,
    bookGateMajorCount: bookMajorCount,
    reason: `PROMOTED: ${loadedChapters.length} chapter(s) shipped to ${packagePath}. Majors logged: ${shipMajorCount} ship + ${bookMajorCount} book.`,
  };
}

function blockedResult(args: { bookId: string; reason: string; missingChapters?: number[] }): PromotionResult {
  return {
    promoted: false,
    bookId: args.bookId,
    reportPath: "",
    shipGateBlockerCount: 0,
    bookGateBlockerCount: 0,
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
  lines.push(`  Book gate: ${r.bookGateBlockerCount} blockers, ${r.bookGateMajorCount} majors`);
  return lines.join("\n");
}
