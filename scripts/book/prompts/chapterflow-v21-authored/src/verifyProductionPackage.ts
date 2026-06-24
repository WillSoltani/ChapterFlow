import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

import type { BookPackageV21, ChapterV21 } from "./types.js";
import { V21_SCHEMA_VERSION } from "./types.js";
import { REPO_ROOT, CANONICAL_STATE, normSlug } from "./lib/chapterPaths.js";
import { canonicalJson, canonicalJsonSha256 } from "./lib/canonicalJson.js";
import {
  containsAuthoringInternalField,
  readerContentHash,
  stripInternalFields,
} from "./lib/readerContent.js";
import {
  buildExpectedProductionManifestForPackage,
  productionManifestPayloadHash,
  validateProductionManifest,
  type ProductionManifestFinding,
} from "./productionManifest.js";

const BOOK_PACKAGES_DIR = resolve(REPO_ROOT, "book-packages");
const DEFAULT_RUNS_ROOT = resolve(REPO_ROOT, ".chapterflow", "runs");

export type ProductionPackageVerificationFinding = ProductionManifestFinding;

export type VerifyProductionPackageOptions = {
  packagePath?: string;
  packageData?: unknown;
  stateRoot?: string;
  runsRoot?: string;
  compareLooseState?: boolean;
};

export type VerifyProductionPackageResult = {
  ok: boolean;
  bookId: string | null;
  packagePath: string | null;
  contentId: string | null;
  findings: ProductionPackageVerificationFinding[];
};

function blocker(args: Omit<ProductionPackageVerificationFinding, "severity">): ProductionPackageVerificationFinding {
  return { severity: "blocker", ...args };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function loadPackage(options: VerifyProductionPackageOptions): { ok: true; pkg: unknown; packagePath: string | null } | { ok: false; findings: ProductionPackageVerificationFinding[]; packagePath: string | null } {
  // The package is `unknown` here on purpose: neither caller-supplied data nor
  // file-loaded JSON is trusted to be an object until verifyProductionPackage
  // validates its top-level shape. No cast to BookPackageV21 happens at load.
  if (options.packageData !== undefined) {
    return { ok: true, pkg: options.packageData, packagePath: options.packagePath ?? null };
  }
  const packagePath = options.packagePath ? resolve(options.packagePath) : null;
  if (!packagePath) {
    return { ok: false, packagePath: null, findings: [blocker({ checkId: "PPKG.package_path_missing", message: "verifyProductionPackage requires packagePath or packageData." })] };
  }
  if (!existsSync(packagePath)) {
    return { ok: false, packagePath, findings: [blocker({ checkId: "PPKG.package_missing", path: packagePath, message: `Production package is missing at ${packagePath}.` })] };
  }
  try {
    return { ok: true, pkg: JSON.parse(readFileSync(packagePath, "utf8")) as unknown, packagePath };
  } catch (err) {
    return {
      ok: false,
      packagePath,
      findings: [blocker({ checkId: "PPKG.package_unreadable", path: packagePath, message: `Production package is not valid JSON: ${(err as Error).message}` })],
    };
  }
}

function packageChapterPath(stateRoot: string, chapterId: string): string {
  return resolve(stateRoot, "chapters", `${chapterId}.v21-native.chapter.json`);
}

function compareLooseStateChapters(pkg: BookPackageV21, stateRoot: string): ProductionPackageVerificationFinding[] {
  const findings: ProductionPackageVerificationFinding[] = [];
  for (const chapter of pkg.chapters ?? []) {
    const path = packageChapterPath(stateRoot, chapter.chapterId);
    if (!existsSync(path)) {
      findings.push(blocker({
        checkId: "PPKG.loose_chapter_missing",
        chapterNumber: chapter.number,
        path,
        message: `Loose state chapter is missing for packaged ${chapter.chapterId}.`,
      }));
      continue;
    }
    let loose: ChapterV21;
    try {
      loose = JSON.parse(readFileSync(path, "utf8")) as ChapterV21;
    } catch (err) {
      findings.push(blocker({
        checkId: "PPKG.loose_chapter_unreadable",
        chapterNumber: chapter.number,
        path,
        message: `Loose state chapter ${path} is unreadable: ${(err as Error).message}`,
      }));
      continue;
    }
    const stripped = stripInternalFields(loose);
    const packagedHash = canonicalJsonSha256(chapter);
    const looseHash = canonicalJsonSha256(stripped);
    if (packagedHash !== looseHash) {
      findings.push(blocker({
        checkId: "PPKG.loose_chapter_mismatch",
        chapterNumber: chapter.number,
        path,
        message: `Packaged ${chapter.chapterId} differs from loose state after reader-content stripping.`,
        expected: looseHash,
        actual: packagedHash,
      }));
    }
  }
  return findings;
}

function compareCanonicalPayloads(actual: unknown, expected: unknown): ProductionPackageVerificationFinding[] {
  if (canonicalJson(actual) === canonicalJson(expected)) return [];
  return [blocker({
    checkId: "PPKG.manifest_payload_mismatch",
    message: "Embedded production manifest payload does not match the canonical index, package chapters, source evidence, and QC evidence recomputed by the verifier.",
    expected: canonicalJsonSha256(expected),
    actual: canonicalJsonSha256(actual),
  })];
}

export function verifyProductionPackage(options: VerifyProductionPackageOptions): VerifyProductionPackageResult {
  const loaded = loadPackage(options);
  if (!loaded.ok) {
    return { ok: false, bookId: null, packagePath: loaded.packagePath, contentId: null, findings: loaded.findings };
  }

  // Prove the top-level shape is a non-null, non-array object BEFORE reading any
  // property. Valid JSON that is null, a primitive (boolean/number/string), or an
  // array would otherwise throw on `pkg.book` / `pkg.chapters` access. Such input
  // fails closed with a single structured blocker instead of a stack trace.
  if (!isObject(loaded.pkg)) {
    return {
      ok: false,
      bookId: null,
      packagePath: loaded.packagePath,
      contentId: null,
      findings: [blocker({ checkId: "PPKG.package_malformed", message: "Production package must be a JSON object." })],
    };
  }

  const pkg = loaded.pkg as BookPackageV21;
  const stateRoot = options.stateRoot ?? CANONICAL_STATE;
  const runsRoot = options.runsRoot ?? DEFAULT_RUNS_ROOT;
  const findings: ProductionPackageVerificationFinding[] = [];
  const bookId = isObject(pkg.book) && typeof pkg.book.bookId === "string" ? normSlug(pkg.book.bookId) : null;

  if (pkg.schemaVersion !== V21_SCHEMA_VERSION) {
    findings.push(blocker({
      checkId: "PPKG.package_schema_mismatch",
      message: `Package schemaVersion is ${JSON.stringify((pkg as any).schemaVersion)}, expected ${V21_SCHEMA_VERSION}.`,
      expected: V21_SCHEMA_VERSION,
      actual: (pkg as any).schemaVersion,
    }));
  }
  if (!bookId) {
    findings.push(blocker({ checkId: "PPKG.book_id_missing", message: "Package book.bookId must be a non-empty string." }));
  }
  if (!Array.isArray(pkg.chapters) || pkg.chapters.length === 0) {
    findings.push(blocker({ checkId: "PPKG.chapters_missing", message: "Package chapters must be a non-empty array." }));
  }

  for (const chapter of Array.isArray(pkg.chapters) ? pkg.chapters : []) {
    const internal = containsAuthoringInternalField(chapter);
    if (internal) {
      findings.push(blocker({
        checkId: "PPKG.internal_field_present",
        chapterNumber: typeof chapter?.number === "number" ? chapter.number : undefined,
        message: `Package chapter ${chapter?.chapterId ?? "(unknown)"} contains authoring-only field "${internal}".`,
        actual: internal,
      }));
    }
  }

  const manifestCheck = validateProductionManifest((pkg as any).productionManifest);
  if (!manifestCheck.ok) findings.push(...manifestCheck.findings);
  if (findings.length > 0 || !manifestCheck.ok) {
    return { ok: false, bookId, packagePath: loaded.packagePath, contentId: null, findings };
  }

  const manifest = manifestCheck.manifest;
  if (pkg.packageId !== manifest.contentId) {
    findings.push(blocker({
      checkId: "PPKG.package_id_mismatch",
      message: "Package packageId must equal productionManifest.contentId.",
      expected: manifest.contentId,
      actual: pkg.packageId,
    }));
  }
  if (pkg.createdAt !== manifest.metadata.createdAt) {
    findings.push(blocker({
      checkId: "PPKG.created_at_mismatch",
      message: "Package createdAt must match productionManifest.metadata.createdAt.",
      expected: manifest.metadata.createdAt,
      actual: pkg.createdAt,
    }));
  }
  const payloadHash = productionManifestPayloadHash(manifest.payload);
  if (manifest.payloadHash !== payloadHash) {
    findings.push(blocker({
      checkId: "PPKG.manifest_hash_mismatch",
      message: "productionManifest.payloadHash does not match the canonical payload bytes.",
      expected: payloadHash,
      actual: manifest.payloadHash,
    }));
  }
  if (manifest.contentId !== payloadHash) {
    findings.push(blocker({
      checkId: "PPKG.content_id_mismatch",
      message: "productionManifest.contentId must be derived from the canonical manifest payload.",
      expected: payloadHash,
      actual: manifest.contentId,
    }));
  }

  const expected = buildExpectedProductionManifestForPackage({
    pkg,
    stateRoot,
    runsRoot,
    createdAt: manifest.metadata.createdAt,
    generator: manifest.metadata.generator,
    runId: manifest.metadata.runId,
    packagePath: loaded.packagePath ?? undefined,
  });
  if (!expected.ok) {
    findings.push(...expected.findings);
  } else {
    findings.push(...compareCanonicalPayloads(manifest.payload, expected.manifest.payload));
    if (manifest.contentId !== expected.manifest.contentId) {
      findings.push(blocker({
        checkId: "PPKG.content_id_recomputed_mismatch",
        message: "productionManifest.contentId does not match the verifier-recomputed content ID.",
        expected: expected.manifest.contentId,
        actual: manifest.contentId,
      }));
    }
    for (const chapter of expected.manifest.payload.chapters) {
      const packaged = pkg.chapters.find((ch) => ch.chapterId === chapter.chapterId);
      if (!packaged) continue;
      const actualHash = readerContentHash(packaged);
      if (actualHash !== chapter.readerContentHash) {
        findings.push(blocker({
          checkId: "PPKG.chapter_hash_mismatch",
          chapterNumber: chapter.chapterNumber,
          message: `Packaged reader content hash for ${chapter.chapterId} does not match manifest.`,
          expected: chapter.readerContentHash,
          actual: actualHash,
        }));
      }
    }
  }

  if (options.compareLooseState) {
    findings.push(...compareLooseStateChapters(pkg, stateRoot));
  }

  return {
    ok: findings.length === 0,
    bookId,
    packagePath: loaded.packagePath,
    contentId: manifest.contentId,
    findings,
  };
}

export function packagePathForBook(bookId: string): string {
  return resolve(BOOK_PACKAGES_DIR, `${normSlug(bookId)}.v21.json`);
}

export function formatVerifyProductionPackageResult(result: VerifyProductionPackageResult): string {
  const lines: string[] = [];
  lines.push(`verify-production-package: ${result.ok ? "PASS" : "BLOCK"}${result.bookId ? ` (${result.bookId})` : ""}`);
  if (result.packagePath) lines.push(`package: ${result.packagePath}`);
  if (result.contentId) lines.push(`contentId: ${result.contentId}`);
  if (result.findings.length > 0) {
    lines.push(`findings: ${result.findings.length}`);
    for (const f of result.findings) {
      lines.push(`  [${f.checkId}${f.chapterNumber ? ` ch${String(f.chapterNumber).padStart(2, "0")}` : ""}] ${f.message}`);
    }
  }
  return lines.join("\n");
}
