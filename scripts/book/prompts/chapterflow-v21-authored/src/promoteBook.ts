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
import { runIntraBookChecks } from "./critics/intraBook.js";
import { checkQcAttestation } from "./critics/qcAttestation.js";
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
  /** AS5–AS12 cross-chapter blockers. Until Phase 1 these ran ONLY in
   *  gate-chapter, so promote shipped books the authoring gate would block. */
  intraBookBlockerCount: number;
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

/** Recursively remove every occurrence of `key` from a value (returns a copy).
 *  Used to strip the v2-only `sourceAnchorId` provenance field — which exists so
 *  SC11 can verify a unit uses its declared anchor at GATE time — from the
 *  shipped package, so internal pipeline metadata never reaches the web
 *  package validator / reader. */
function stripKeyDeep<T>(value: T, key: string): T {
  if (Array.isArray(value)) return value.map((v) => stripKeyDeep(v, key)) as unknown as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (k === key) continue;
      out[k] = stripKeyDeep(v, key);
    }
    return out as T;
  }
  return value;
}

export function promoteBook(input: PromotionInput): PromotionResult {
  const { bookId, title, author, chapters } = input;

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

  // Step 3.5: QC-attestation gate — the no-API semantic judge. Every chapter
  // must carry a fresh PUBLISHABLE attestation from a Claude reviewer; this is
  // what makes the reviewer's verdict an enforceable ship blocker instead of an
  // out-of-band manual step. Stale (chapter edited since review) or missing
  // attestations block here even when every deterministic gate is clean.
  const qcFindings = loadedChapters.flatMap((ch) =>
    checkQcAttestation(ch, true).map((f) => ({ chapter: ch.number, ...f })),
  );
  const qcBlockerCount = qcFindings.length;

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
    intraBook: { totalBlockers: intraBlockerCount, findings: intraFindings },
    qcAttestation: { totalBlockers: qcBlockerCount, findings: qcFindings },
  };
  writeFileSync(reportPath, JSON.stringify(fullReport, null, 2), "utf8");

  // Step 5: Promote only if EVERY gate passes blocker-clean — deterministic
  // gates (per-chapter + intra-book + book) AND the QC-attestation gate.
  if (shipBlockerCount > 0 || intraBlockerCount > 0 || bookBlockerCount > 0 || qcBlockerCount > 0) {
    mkdirSync(QUARANTINE_DIR, { recursive: true });
    const quarantinePath = resolve(QUARANTINE_DIR, `${bookId}.${Date.now()}.report.json`);
    writeFileSync(quarantinePath, JSON.stringify(fullReport, null, 2), "utf8");
    const qcSummary = qcBlockerCount > 0
      ? ` + ${qcBlockerCount} QC-attestation blocker(s): ${qcFindings.slice(0, 3).map((f) => `ch${f.chapter} ${f.checkId}`).join(", ")}${qcFindings.length > 3 ? ", …" : ""}`
      : "";
    const intraSummary = intraBlockerCount > 0
      ? ` + ${intraBlockerCount} intra-book blocker(s): ${intraFindings.filter((f) => f.severity === "blocker").slice(0, 3).map((f) => `ch${f.chapter} ${f.checkId}`).join(", ")}${intraBlockerCount > 3 ? ", …" : ""}`
      : "";
    return {
      promoted: false,
      bookId,
      reportPath,
      shipGateBlockerCount: shipBlockerCount,
      bookGateBlockerCount: bookBlockerCount,
      intraBookBlockerCount: intraBlockerCount,
      shipGateMajorCount: shipMajorCount,
      bookGateMajorCount: bookMajorCount,
      reason: `BLOCKED: ${shipBlockerCount} ship-gate blocker(s)${intraSummary} + ${bookBlockerCount} book-gate blocker(s)${qcSummary}. Quarantined at ${quarantinePath}.`,
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
    // Strip the v2-only sourceAnchorId provenance (gate-time metadata) so it
    // never ships into book-packages/ or reaches the web package validator.
    chapters: loadedChapters.map((c) => stripKeyDeep(c, "sourceAnchorId")).sort((a, b) => a.number - b.number),
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
    intraBookBlockerCount: 0,
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
    intraBookBlockerCount: 0,
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
  lines.push(`  Book gate: ${r.bookGateBlockerCount} blockers, ${r.bookGateMajorCount} majors`);
  return lines.join("\n");
}
