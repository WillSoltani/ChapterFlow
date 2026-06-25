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
  type ProductionManifestPayloadV2,
  type ProductionManifestVersion,
  type ProductionSourceRealityEvidence,
} from "./productionManifest.js";
import {
  buildPipelineFingerprints,
  firstFingerprintFileDelta,
  type FingerprintRoots,
  type PipelineFingerprint,
} from "./lib/pipelineFingerprint.js";
import { evaluateSourceRealityPolicy } from "./qc/sourceRealityPolicy.js";
import { parseSourceVerifyRecord, sourceVerifyRecordPath } from "./critics/sourceVerify.js";

const BOOK_PACKAGES_DIR = resolve(REPO_ROOT, "book-packages");
const DEFAULT_RUNS_ROOT = resolve(REPO_ROOT, ".chapterflow", "runs");

export type ProductionPackageVerificationFinding = ProductionManifestFinding;

export type VerifyProductionPackageOptions = {
  packagePath?: string;
  packageData?: unknown;
  stateRoot?: string;
  runsRoot?: string;
  compareLooseState?: boolean;
  /** v2 build-input fingerprint root overrides (tests). Production omits these. */
  fingerprintRoots?: FingerprintRoots;
  /** v2 source-reality record/exemption read-location overrides (tests). */
  recordPath?: string;
  exemptionsFile?: string;
  env?: NodeJS.ProcessEnv;
  now?: Date;
};

export type VerifyProductionPackageResult = {
  ok: boolean;
  bookId: string | null;
  packagePath: string | null;
  contentId: string | null;
  /** The embedded manifest schema version ("v1" | "v2"), or null when unverifiable.
   *  Lets a caller distinguish a v1-legacy PASS from a v2 (source-reality-bound) PASS. */
  manifestSchemaVersion: ProductionManifestVersion | null;
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
    message: "Embedded production manifest payload does not match the canonical index, package chapters, source evidence, source-reality evidence, build-input fingerprints, and QC evidence recomputed by the verifier.",
    expected: canonicalJsonSha256(expected),
    actual: canonicalJsonSha256(actual),
  })];
}

/**
 * v2-only independent recompute: re-derive the source-reality verdict and the
 * three build-input fingerprints FROM DISK and check them against the bytes the
 * embedded payload bound. This is in addition to the whole-payload equality
 * check above; it exists to produce PRECISE findings (which evidence drifted,
 * which file moved) and to satisfy "recompute this evidence from disk and detect
 * tampering, deletion, replacement, wrong-book records, or stale exemptions"
 * (req 4, 11). Equality of the whole payload remains the authoritative gate.
 */
function verifyV2Evidence(
  bookId: string | null,
  payload: ProductionManifestPayloadV2,
  options: VerifyProductionPackageOptions,
  stateRoot: string,
  runsRoot: string,
): ProductionPackageVerificationFinding[] {
  const findings: ProductionPackageVerificationFinding[] = [];
  const evidence: ProductionSourceRealityEvidence | undefined = payload.sourceRealityEvidence;
  if (!isObject(evidence as unknown)) {
    return [blocker({ checkId: "PPKG.source_reality_evidence_missing", message: "v2 payload is missing sourceRealityEvidence." })];
  }

  // The trusted identity is the package's bookId (already validated upstream), not
  // the evidence's self-declared bookId. Recompute the verdict against it, and ALWAYS
  // flag a self-declared bookId that disagrees — independent of whether the policy
  // blocks. (The whole-payload compare is the authoritative gate; this is the precise
  // diagnostic.) `bookId` is non-null here: a missing book id fails closed upstream
  // before this function is reached.
  const subjectBookId = bookId ?? evidence.bookId;
  if (bookId && evidence.bookId !== bookId) {
    findings.push(blocker({
      checkId: "PPKG.source_reality_bookid_mismatch",
      message: "sourceRealityEvidence.bookId does not match the package book id.",
      expected: bookId,
      actual: evidence.bookId,
    }));
  }

  // 1) Source-reality verdict, recomputed from disk against the trusted bookId.
  const policy = evaluateSourceRealityPolicy({
    bookId: subjectBookId,
    env: options.env ?? process.env,
    now: options.now ?? new Date(),
    roots: { stateRoot, runsRoot, recordPath: options.recordPath, exemptionsFile: options.exemptionsFile },
  });
  if (policy.blocking) {
    // Deletion, tampering-to-invalid, wrong-book record (item-coverage miss),
    // or a stale/mismatched exemption all land here.
    for (const f of policy.findings) {
      findings.push(blocker({ checkId: `PPKG.source_reality.${f.checkId}`, chapterNumber: f.chapterNumber, message: f.message }));
    }
  } else {
    if (policy.decision !== evidence.policyResult) {
      findings.push(blocker({
        checkId: "PPKG.source_reality_decision_mismatch",
        message: "Recomputed source-reality decision does not match the decision bound in the manifest.",
        expected: evidence.policyResult,
        actual: policy.decision,
      }));
    }
    // Record-branch: recompute the record's semantic hash + bound bookId from disk.
    if (policy.decision === "required-and-verified" && isObject(evidence.record as unknown)) {
      const recordPath = options.recordPath ?? sourceVerifyRecordPath(subjectBookId);
      let parsed: any = null;
      try {
        parsed = parseSourceVerifyRecord(readFileSync(recordPath, "utf8")).record;
      } catch {
        parsed = null;
      }
      if (!parsed) {
        findings.push(blocker({ checkId: "PPKG.source_reality_record_unreadable", path: recordPath, message: `Source-verify record at ${recordPath} could not be re-read for verification.` }));
      } else {
        const recomputedHash = canonicalJsonSha256(parsed);
        if (recomputedHash !== evidence.record!.semanticHash) {
          findings.push(blocker({
            checkId: "PPKG.source_reality_record_hash_mismatch",
            message: "Source-verify record on disk does not match the semantic hash bound in the manifest (record was replaced or tampered).",
            expected: evidence.record!.semanticHash,
            actual: recomputedHash,
          }));
        }
        const diskBookId = typeof parsed.bookId === "string" ? parsed.bookId : null;
        if (diskBookId !== null && diskBookId !== subjectBookId) {
          findings.push(blocker({
            checkId: "PPKG.source_reality_record_wrong_book",
            message: "Source-verify record on disk names a different bookId than the package (wrong-book record).",
            expected: subjectBookId,
            actual: diskBookId,
          }));
        }
      }
    }
    // Exemption-branch: recompute the bound exemption's hash from disk.
    if (policy.decision === "legacy-exempt" && isObject(evidence.exemption as unknown) && policy.exemption) {
      const recomputedHash = canonicalJsonSha256(policy.exemption);
      if (recomputedHash !== evidence.exemption!.semanticHash) {
        findings.push(blocker({
          checkId: "PPKG.source_reality_exemption_hash_mismatch",
          message: "Legacy exemption on disk does not match the semantic hash bound in the manifest.",
          expected: evidence.exemption!.semanticHash,
          actual: recomputedHash,
        }));
      }
    }
  }

  // 2) Build-input fingerprints, recomputed from disk. Guard the embedded shape so a
  // malformed/forged v2 payload fails CLOSED with a structured finding rather than
  // throwing on a missing `versions` bundle (validateProductionManifest already
  // enforces this shape; this is defense in depth for direct callers).
  const versions = (payload as { versions?: ProductionManifestPayloadV2["versions"] }).versions;
  if (!isObject(versions as unknown)) {
    findings.push(blocker({ checkId: "PPKG.manifest_versions_missing", message: "v2 payload is missing the versions block with build-input fingerprints." }));
    return findings;
  }
  const fps = buildPipelineFingerprints(options.fingerprintRoots);
  if (!fps.ok) {
    for (const message of fps.errors) findings.push(blocker({ checkId: "PPKG.fingerprint_unbuildable", message }));
    return findings;
  }
  const compareBundle = (label: "prompt" | "config" | "code", embedded: PipelineFingerprint | undefined, actual: PipelineFingerprint): void => {
    if (!isObject(embedded as unknown) || typeof embedded!.bundleHash !== "string") {
      findings.push(blocker({ checkId: `PPKG.${label}_fingerprint_missing`, message: `v2 payload is missing a well-formed ${label} fingerprint bundle.` }));
      return;
    }
    if (embedded!.bundleHash === actual.bundleHash) return;
    const delta = firstFingerprintFileDelta(embedded!, actual);
    findings.push(blocker({
      checkId: `PPKG.${label}_fingerprint_mismatch`,
      message: `Recomputed ${label} fingerprint does not match the manifest${delta ? ` (first delta: ${delta.path} ${delta.reason})` : ""}.`,
      expected: embedded!.bundleHash,
      actual: actual.bundleHash,
    }));
  };
  compareBundle("prompt", versions!.promptBundle, fps.fingerprints.promptBundle);
  compareBundle("config", versions!.configBundle, fps.fingerprints.configBundle);
  compareBundle("code", versions!.codeFingerprint, fps.fingerprints.codeFingerprint);

  return findings;
}

export function verifyProductionPackage(options: VerifyProductionPackageOptions): VerifyProductionPackageResult {
  const loaded = loadPackage(options);
  if (!loaded.ok) {
    return { ok: false, bookId: null, packagePath: loaded.packagePath, contentId: null, manifestSchemaVersion: null, findings: loaded.findings };
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
      manifestSchemaVersion: null,
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
    return { ok: false, bookId, packagePath: loaded.packagePath, contentId: null, manifestSchemaVersion: manifestCheck.ok ? manifestCheck.version : null, findings };
  }

  const manifest = manifestCheck.manifest;
  const version = manifestCheck.version;
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
    // Reconstruct the expected manifest at the SAME schema version the package
    // declares — a v1 package is recomputed under v1 rules and is never granted
    // v2 (source-reality / fingerprint) evidence it does not actually carry.
    manifestVersion: version,
    fingerprintRoots: options.fingerprintRoots,
    recordPath: options.recordPath,
    exemptionsFile: options.exemptionsFile,
    env: options.env,
    now: options.now,
  });
  if (!expected.ok) {
    // Requirement 12: when the expected manifest cannot be reconstructed (e.g. a
    // v2 source-reality record was deleted, tampered to invalid, or its exemption
    // went stale), verification fails — promotion must not publish.
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

  // v2-only: independent recompute of source-reality evidence + fingerprints, for
  // precise diagnostics (the whole-payload compare above is the authoritative gate).
  if (version === "v2") {
    findings.push(...verifyV2Evidence(bookId, manifest.payload as ProductionManifestPayloadV2, options, stateRoot, runsRoot));
  }

  if (options.compareLooseState) {
    findings.push(...compareLooseStateChapters(pkg, stateRoot));
  }

  return {
    ok: findings.length === 0,
    bookId,
    packagePath: loaded.packagePath,
    contentId: manifest.contentId,
    manifestSchemaVersion: version,
    findings,
  };
}

export function packagePathForBook(bookId: string): string {
  return resolve(BOOK_PACKAGES_DIR, `${normSlug(bookId)}.v21.json`);
}

export function formatVerifyProductionPackageResult(result: VerifyProductionPackageResult): string {
  const lines: string[] = [];
  lines.push(`verify-production-package: ${result.ok ? "PASS" : "BLOCK"}${result.bookId ? ` (${result.bookId})` : ""}`);
  if (result.manifestSchemaVersion) lines.push(`manifest: ${result.manifestSchemaVersion}`);
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
