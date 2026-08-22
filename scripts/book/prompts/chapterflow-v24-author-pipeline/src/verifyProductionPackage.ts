import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

import type { BookPackageV21, ChapterV21 } from "./types.js";
import { V21_SCHEMA_VERSION } from "./types.js";
import { REPO_ROOT, CANONICAL_STATE, normSlug } from "./lib/chapterPaths.js";
import { canonicalJson, canonicalJsonSha256 } from "./lib/canonicalJson.js";
import {
  containsAuthoringInternalField,
  firstMachineryExampleTag,
  readerContentHash,
  stripInternalFields,
} from "./lib/readerContent.js";
import {
  buildExpectedProductionManifestForPackage,
  chapterSetSpecsSemanticHash,
  declaredChapterSetSource,
  productionManifestPayloadHash,
  recordedCandidateChapterSet,
  validateProductionManifest,
  type ExpectedChapterSetSource,
  type ProductionChapterSetSource,
  type ProductionManifestCandidateChapterSetBlock,
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

/** WS1/K1: the production manifest ships as a state-side sidecar, not embedded.
 *  Must stay in lockstep with promoteBook.PRODUCTION_MANIFEST_SIDECAR_SCHEMA and
 *  productionManifestSidecarPath. Defined here (not imported from promoteBook) to
 *  avoid a promoteBook⇄verifier import cycle. */
const PRODUCTION_MANIFEST_SIDECAR_SCHEMA = "chapterflow-production-manifest-sidecar-v1" as const;

/** Human-readable packageId shape stamped by promoteBook: `<bookId>-v21-<epochMs>`.
 *  A sha256 is a hash the owner asked to remove; identity is human-readable and the
 *  tamper-evidence lives in the sidecar's manifest.contentId. */
function isHumanReadablePackageId(bookId: string, packageId: unknown): boolean {
  return typeof packageId === "string" && new RegExp(`^${bookId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-v21-\\d+$`).test(packageId);
}

/** Default sidecar location, derived from stateRoot (default CANONICAL_STATE) +
 *  bookId, mirroring promoteBook.productionManifestSidecarPath. */
function defaultSidecarPath(stateRoot: string, bookId: string): string {
  return resolve(stateRoot, "books", `${normSlug(bookId)}.production-manifest.json`);
}

type SidecarShape = { schemaVersion?: unknown; bookId?: unknown; packageId?: unknown; createdAt?: unknown; manifest?: unknown };

/** Load + shape-validate the manifest sidecar (manifestData > manifestPath >
 *  derived path). Fail-closed with a structured finding — never throws — so a
 *  missing/unreadable/malformed sidecar blocks promotion instead of crashing. */
function loadSidecar(
  options: VerifyProductionPackageOptions,
  stateRoot: string,
  bookId: string | null,
  packagePath: string | null,
): { ok: true; manifest: unknown; sidecar: SidecarShape } | { ok: false; findings: ProductionPackageVerificationFinding[] } {
  let sidecar: unknown;
  let sourcePath: string | null = null;
  if (options.manifestData !== undefined) {
    sidecar = options.manifestData;
  } else {
    sourcePath = options.manifestPath ? resolve(options.manifestPath) : (bookId ? defaultSidecarPath(stateRoot, bookId) : null);
    if (!sourcePath) {
      return { ok: false, findings: [blocker({ checkId: "PPKG.sidecar_path_unresolvable", message: "Cannot resolve the production-manifest sidecar path (no bookId and no manifestPath)." })] };
    }
    if (!existsSync(sourcePath)) {
      return { ok: false, findings: [blocker({ checkId: "PPKG.sidecar_missing", path: sourcePath, message: `Production-manifest sidecar is missing at ${sourcePath}. Re-promote to (re)generate it.` })] };
    }
    try {
      sidecar = JSON.parse(readFileSync(sourcePath, "utf8")) as unknown;
    } catch (err) {
      return { ok: false, findings: [blocker({ checkId: "PPKG.sidecar_unreadable", path: sourcePath, message: `Production-manifest sidecar is not valid JSON: ${(err as Error).message}` })] };
    }
  }
  if (!isObject(sidecar)) {
    return { ok: false, findings: [blocker({ checkId: "PPKG.sidecar_malformed", path: sourcePath ?? undefined, message: "Production-manifest sidecar must be a JSON object." })] };
  }
  const s = sidecar as SidecarShape;
  if (s.schemaVersion !== PRODUCTION_MANIFEST_SIDECAR_SCHEMA) {
    return { ok: false, findings: [blocker({ checkId: "PPKG.sidecar_schema_mismatch", path: sourcePath ?? undefined, message: `Production-manifest sidecar schemaVersion is ${JSON.stringify(s.schemaVersion)}, expected ${PRODUCTION_MANIFEST_SIDECAR_SCHEMA}.`, expected: PRODUCTION_MANIFEST_SIDECAR_SCHEMA, actual: s.schemaVersion })] };
  }
  return { ok: true, manifest: s.manifest, sidecar: s };
}

/** Deep keys/paths that must NEVER reach the shipped distribution package (K3
 *  PPKG.forbidden_field). Names too generic for blanket deep removal
 *  (schemaVersion/title/location/why) are handled path-aware by
 *  containsAuthoringInternalField per chapter; this set is the deep-name layer
 *  for the whole package object. */
const FORBIDDEN_DEEP_KEYS = new Set([
  "productionManifest",
  "authoring",
  "planSpec",
  "namedCaseIds",
  "sourceFactIds",
  "depthLevel",
]);
const FORBIDDEN_SOURCE_ANCHOR_RE = /SourceAnchorIds?$/;

/** First forbidden deep key found anywhere in `value`, or null. */
function firstForbiddenDeepKey(value: unknown): string | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const hit = firstForbiddenDeepKey(item);
      if (hit) return hit;
    }
    return null;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (FORBIDDEN_DEEP_KEYS.has(key)) return key;
      if (FORBIDDEN_SOURCE_ANCHOR_RE.test(key)) return key;
      const hit = firstForbiddenDeepKey(child);
      if (hit) return hit;
    }
  }
  return null;
}

export type ProductionPackageVerificationFinding = ProductionManifestFinding;

export type VerifyProductionPackageOptions = {
  packagePath?: string;
  packageData?: unknown;
  /** Explicit manifest-sidecar path override (staging verify / tests). When
   *  omitted the sidecar path is derived from packagePath + bookId. */
  manifestPath?: string;
  /** In-memory manifest sidecar (promote's pre-publish self-verify). Mirrors
   *  packageData: neither is trusted until validated. Takes precedence over
   *  manifestPath/derived path. */
  manifestData?: unknown;
  stateRoot?: string;
  runsRoot?: string;
  compareLooseState?: boolean;
  /**
   * The chapter-set authority the CALLER independently expects this manifest to
   * declare (LAYER 1 of the two-layer chapter-set authority; see
   * `checkExpectedChapterSetSource`). Supplied by callers that know which
   * release they are looking at — the candidate-release adapter self-verifying
   * the candidate it just released. OMITTED by callers that legitimately hold no
   * release context: publish-final's preflight and the recovery flows verify an
   * already-shipped pair from the two files alone, and must keep verifying it.
   */
  expectedChapterSetSource?: ExpectedChapterSetSource;
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

/** One-line name for a chapter-set authority, for refusal messages. */
function describeChapterSetSource(source: ExpectedChapterSetSource | undefined): string {
  if (source === undefined || source === "canonical-index") return "canonical-index";
  return `candidate ${source.candidateId}@${source.manifestDigest}`;
}

/**
 * LAYER 1 — the caller's expectation outranks the manifest's declaration.
 *
 * `verifyProductionPackage` reconstructs the expected manifest under the regime
 * the manifest DECLARES. On its own that lets the artifact under test choose how
 * it is verified: a package released off the ambient canonical index could ship
 * with a manifest declaring itself candidate-sourced and never be checked against
 * that index again. When a caller independently knows which release this is, it
 * says so, and a declaration that disagrees is a blocker BEFORE the regime is
 * used for anything.
 *
 * Omitting the expectation is a supported, deliberate mode — an already-shipped
 * pair is verified by consumers that hold nothing but the two files (publish-final
 * preflight, register-web, the interrupted-release recovery flows), and those
 * must keep passing on a pair they have no release context for. For them the
 * declaration still picks the regime, and LAYER 2 below supplies the evidence.
 */
function checkExpectedChapterSetSource(
  expected: ExpectedChapterSetSource | undefined,
  declared: ProductionChapterSetSource | undefined,
): ProductionPackageVerificationFinding[] {
  if (expected === undefined) return [];
  const mismatch = (): ProductionPackageVerificationFinding[] => [blocker({
    checkId: "PPKG.chapter_set_source_mismatch",
    message:
      `Manifest declares chapter-set authority ${describeChapterSetSource(declared)}, but the caller ` +
      `released ${describeChapterSetSource(expected)}. A manifest does not get to choose the regime it is verified under.`,
    expected: describeChapterSetSource(expected),
    actual: describeChapterSetSource(declared),
  })];
  if (expected === "canonical-index") return declared === undefined ? [] : mismatch();
  if (declared === undefined) return mismatch();
  return declared.candidateId === expected.candidateId && declared.manifestDigest === expected.manifestDigest
    ? []
    : mismatch();
}

/**
 * LAYER 2 — the declaration sets the regime; the manifest's OWN RECORDED block
 * is the evidence.
 *
 * The canonical-index regime catches a package that lost, gained or reordered a
 * chapter because `state/indexes/<bookId>.json` is an authority that exists
 * independently of the package. The candidate regime has no such file — a
 * candidate-only book root has no index at all, which is the whole reason the
 * candidate route exists — so the independent authority is the chapter set the
 * RELEASE RECORDED in the manifest and bound into the contentId. The package is
 * compared to THAT, before any expected manifest is rebuilt, so the comparison
 * can never be satisfied by rebuilding the expectation out of the package under
 * test.
 *
 * WHAT THE RECORDED BLOCK PINS, exactly: per chapter, `chapterId`,
 * `chapterNumber` and `chapterTitle` — there is no per-chapter content hash in
 * the block (see ProductionManifestChapterSpec). So this check catches a package
 * whose chapter SET drifted from the manifest's: chapters dropped, added,
 * renumbered or reordered. It does NOT speak about chapter BODIES; reader
 * content is pinned separately and per chapter by
 * `payload.chapters[].readerContentHash`, which is checked below against the
 * RECORDED manifest chapters for the same non-circular reason.
 *
 * WHAT IT DOES NOT CATCH: a wholesale re-authoring of BOTH files — a truncated
 * package published with a freshly built candidate-declaring manifest whose
 * block, payload and contentId are all recomputed over the truncated set. Such a
 * pair is internally consistent, and nothing inside the two files can refute it.
 * The anchor for that is outside the pair: the CURRENT pointer / registry names
 * the candidateId and manifestDigest the release actually published, and the
 * candidate is content-addressed by that digest.
 *
 * BE PRECISE ABOUT WHAT LAYER 1 DOES AND DOES NOT DO (adversarial review
 * demonstrated the overclaim): supplying expectedChapterSetSource only
 * string-compares the manifest's DECLARATION against the expectation. A forger
 * who re-authors both files but KEEPS the true candidateId+manifestDigest in
 * the block passes Layer 1 untouched — this function never opens the candidate
 * at that digest. Actually closing the residual requires a caller to OPEN the
 * candidate from the content-addressed store and compare its files against the
 * package (the release adapter effectively has this property because it
 * assembles the package FROM the store immediately before verifying). That
 * candidate-store re-verification for publish-time callers is future work and
 * is deliberately not claimed here.
 */
function compareRecordedCandidateChapterSet(
  recorded: ProductionManifestCandidateChapterSetBlock,
  pkg: BookPackageV21,
): ProductionPackageVerificationFinding[] {
  const findings: ProductionPackageVerificationFinding[] = [];

  // (i) The block must be internally consistent with the hash the contentId is
  // derived over — otherwise "the recorded set" is not a fixed thing to compare
  // against. Recomputed with the builder's own function, not trusted as stored.
  const recomputed = chapterSetSpecsSemanticHash(recorded.chapters);
  if (recomputed !== recorded.semanticHash) {
    findings.push(blocker({
      checkId: "PPKG.candidate_chapter_set_hash_mismatch",
      message:
        "productionManifest.payload.candidateChapterSet.semanticHash does not match its own recorded chapters " +
        "(the recorded chapter set was edited without re-deriving the hash the contentId is bound over).",
      expected: recorded.semanticHash,
      actual: recomputed,
    }));
  }

  // (ii) The package chapters must BE that set — count, ids, numbers and order.
  const expectedSpecs = recorded.chapters.map((spec) => ({
    chapterId: typeof spec?.chapterId === "string" ? spec.chapterId : "",
    chapterNumber: typeof spec?.chapterNumber === "number" ? spec.chapterNumber : NaN,
  }));
  const packaged = (Array.isArray(pkg.chapters) ? pkg.chapters : []).map((chapter) => ({
    chapterId: typeof chapter?.chapterId === "string" ? chapter.chapterId : "",
    chapterNumber: typeof chapter?.number === "number" ? chapter.number : NaN,
  }));

  if (packaged.length !== expectedSpecs.length) {
    findings.push(blocker({
      checkId: "PPKG.candidate_chapter_set_mismatch",
      message:
        `Package ships ${packaged.length} chapter(s), but the manifest's recorded candidate chapter set has ` +
        `${expectedSpecs.length}. The package is not the chapter set this manifest is about.`,
      expected: expectedSpecs.length,
      actual: packaged.length,
    }));
  }
  const packagedIds = new Set(packaged.map((ref) => ref.chapterId));
  const expectedIds = new Set(expectedSpecs.map((ref) => ref.chapterId));
  for (const spec of expectedSpecs) {
    if (!packagedIds.has(spec.chapterId)) {
      findings.push(blocker({
        checkId: "PPKG.candidate_chapter_set_mismatch",
        chapterNumber: Number.isFinite(spec.chapterNumber) ? spec.chapterNumber : undefined,
        message: `Package is missing chapter ${spec.chapterId}, which the manifest's recorded candidate chapter set names.`,
        expected: spec.chapterId,
      }));
    }
  }
  for (const ref of packaged) {
    if (!expectedIds.has(ref.chapterId)) {
      findings.push(blocker({
        checkId: "PPKG.candidate_chapter_set_mismatch",
        chapterNumber: Number.isFinite(ref.chapterNumber) ? ref.chapterNumber : undefined,
        message: `Package ships chapter ${ref.chapterId}, which the manifest's recorded candidate chapter set does not name.`,
        actual: ref.chapterId,
      }));
    }
  }
  for (let i = 0; i < Math.min(packaged.length, expectedSpecs.length); i++) {
    const spec = expectedSpecs[i];
    const ref = packaged[i];
    if (spec.chapterId !== ref.chapterId || spec.chapterNumber !== ref.chapterNumber) {
      findings.push(blocker({
        checkId: "PPKG.candidate_chapter_set_mismatch",
        chapterNumber: Number.isFinite(ref.chapterNumber) ? ref.chapterNumber : undefined,
        message:
          `Package chapter[${i}] is ${ref.chapterId}#${ref.chapterNumber}, but the manifest's recorded candidate ` +
          `chapter set[${i}] is ${spec.chapterId}#${spec.chapterNumber}. Chapter order must match the recorded set.`,
        expected: spec,
        actual: ref,
      }));
    }
  }
  return findings;
}

function compareCanonicalPayloads(actual: unknown, expected: unknown): ProductionPackageVerificationFinding[] {
  if (canonicalJson(actual) === canonicalJson(expected)) return [];
  return [blocker({
    checkId: "PPKG.manifest_payload_mismatch",
    message: "Embedded production manifest payload does not match the chapter set (canonical index, or the candidate the payload names), package chapters, source evidence, source-reality evidence, build-input fingerprints, and QC evidence recomputed by the verifier.",
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

  // K3: a package that STILL embeds a productionManifest is the pre-v24 shape.
  // Single fail-closed code path — no legacy branch that verifies it in place;
  // the operator must re-promote through the sidecar promote.
  if ("productionManifest" in (pkg as Record<string, unknown>)) {
    findings.push(blocker({
      checkId: "PPKG.embedded_manifest_forbidden",
      message: "Package embeds a productionManifest (pre-v24 shape). The manifest now ships as a state-side sidecar; re-promote the book to emit the slim package + sidecar.",
    }));
  }

  // K3 PPKG.forbidden_field: the shipped package must carry reader content only.
  // Deep-name layer over the WHOLE package (productionManifest/authoring/planSpec/
  // *SourceAnchorIds/namedCaseIds/sourceFactIds/depthLevel) …
  const forbiddenDeep = firstForbiddenDeepKey(pkg);
  if (forbiddenDeep) {
    findings.push(blocker({
      checkId: "PPKG.forbidden_field",
      message: `Package contains forbidden non-reader field "${forbiddenDeep}" — the distribution package must carry reader content only.`,
      actual: forbiddenDeep,
    }));
  }
  // … plus the path-aware per-chapter internals (per-chapter schemaVersion,
  // implementationPlan.title, memorableLines[].location/why) via the strip's own
  // detector, so PPKG.forbidden_field and the reader-content strip stay in lockstep.
  for (const chapter of Array.isArray(pkg.chapters) ? pkg.chapters : []) {
    const internal = containsAuthoringInternalField(chapter);
    if (internal) {
      findings.push(blocker({
        checkId: "PPKG.forbidden_field",
        chapterNumber: typeof chapter?.number === "number" ? chapter.number : undefined,
        message: `Package chapter ${chapter?.chapterId ?? "(unknown)"} contains authoring-only field "${internal}".`,
        actual: internal,
      }));
    }
    // Machinery-tag hygiene (CF-I): dealt beat labels shipped as example display
    // tags ("early signal", "return point" — live: multipliers ch07). The
    // reader-content strip now filters them; this is the strip ⊇ verifier mirror
    // (readerContent.firstMachineryExampleTag), the same BLOCKER severity as the
    // planSpec/forbidden-field checks above.
    const machineryTag = firstMachineryExampleTag(chapter);
    if (machineryTag) {
      findings.push(blocker({
        checkId: "PPKG.machinery_tag",
        chapterNumber: typeof chapter?.number === "number" ? chapter.number : undefined,
        message: `Package chapter ${chapter?.chapterId ?? "(unknown)"} ships example display tag ${JSON.stringify(machineryTag)}, a machinery watchlist phrase — dealt beat labels are authoring vocabulary, not reader-facing tags. Re-promote to strip it.`,
        actual: machineryTag,
      }));
    }
  }

  // The manifest now comes from the SIDECAR, not an embedded field (K1/K3).
  const sidecarLoad = loadSidecar(options, stateRoot, bookId, loaded.packagePath);
  if (!sidecarLoad.ok) findings.push(...sidecarLoad.findings);
  const manifestCheck = sidecarLoad.ok ? validateProductionManifest(sidecarLoad.manifest) : { ok: false as const, findings: [] };
  if (sidecarLoad.ok && !manifestCheck.ok) findings.push(...manifestCheck.findings);
  if (findings.length > 0 || !sidecarLoad.ok || !manifestCheck.ok) {
    return { ok: false, bookId, packagePath: loaded.packagePath, contentId: null, manifestSchemaVersion: manifestCheck.ok ? manifestCheck.version : null, findings };
  }

  const manifest = manifestCheck.manifest;
  const version = manifestCheck.version;
  const sidecar = sidecarLoad.sidecar;

  // Identity (K1): packageId is human-readable `<bookId>-v21-<epochMs>` (NOT a
  // hash) and must match the sidecar's packageId. The manifest's contentId stays
  // the tamper-evidence anchor (verified below), but is no longer the packageId.
  if (bookId && !isHumanReadablePackageId(bookId, pkg.packageId)) {
    findings.push(blocker({
      checkId: "PPKG.package_id_shape",
      message: `Package packageId ${JSON.stringify(pkg.packageId)} must be human-readable "${bookId}-v21-<epochMs>" (no sha256).`,
      actual: pkg.packageId,
    }));
  }
  if (typeof sidecar.packageId === "string" && pkg.packageId !== sidecar.packageId) {
    findings.push(blocker({
      checkId: "PPKG.package_id_sidecar_mismatch",
      message: "Package packageId must match the manifest sidecar's packageId.",
      expected: sidecar.packageId,
      actual: pkg.packageId,
    }));
  }
  if (typeof sidecar.bookId === "string" && bookId && normSlug(sidecar.bookId) !== bookId) {
    findings.push(blocker({
      checkId: "PPKG.sidecar_bookid_mismatch",
      message: "Manifest sidecar bookId does not match the package book id.",
      expected: bookId,
      actual: sidecar.bookId,
    }));
  }
  if (pkg.createdAt !== manifest.metadata.createdAt) {
    findings.push(blocker({
      checkId: "PPKG.created_at_mismatch",
      message: "Package createdAt must match the sidecar manifest.metadata.createdAt.",
      expected: manifest.metadata.createdAt,
      actual: pkg.createdAt,
    }));
  }
  if (typeof sidecar.createdAt === "string" && pkg.createdAt !== sidecar.createdAt) {
    findings.push(blocker({
      checkId: "PPKG.sidecar_created_at_mismatch",
      message: "Package createdAt must match the manifest sidecar's createdAt.",
      expected: sidecar.createdAt,
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

  // ── Chapter-set authority, in two layers, BEFORE any reconstruction ────────
  // The reconstruction below is parameterised by what the manifest declares, so
  // on its own it would let the artifact under test pick its own regime AND
  // supply its own evidence. Both layers run first and neither reads the rebuilt
  // manifest: (1) a caller that knows which release this is has the last word on
  // the regime; (2) on the candidate regime the manifest's OWN recorded chapter
  // set — not the package's chapters — is what the package is checked against.
  const declaredSource = declaredChapterSetSource(manifest.payload);
  findings.push(...checkExpectedChapterSetSource(options.expectedChapterSetSource, declaredSource));
  const recordedSet = recordedCandidateChapterSet(manifest.payload);
  if (recordedSet) findings.push(...compareRecordedCandidateChapterSet(recordedSet, pkg));

  // Reader content, per chapter, against the hashes the MANIFEST RECORDED. This
  // iterates the recorded payload chapters rather than the reconstructed ones for
  // the same reason as above: the reconstruction is built out of the package, so
  // reconstructed hashes always agree with it. It also runs when the
  // reconstruction fails, which is when a precise per-chapter finding is worth
  // most. A recorded chapter with no packaged counterpart is not silently skipped
  // here — that is exactly the drift the recorded-set comparison reports.
  for (const chapter of manifest.payload.chapters ?? []) {
    const packaged = (Array.isArray(pkg.chapters) ? pkg.chapters : []).find((ch) => ch?.chapterId === chapter?.chapterId);
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

  const expected = buildExpectedProductionManifestForPackage({
    pkg,
    // Reconstruct against the chapter-set authority the manifest DECLARES. A
    // candidate-sourced manifest (v25 promote-book --candidate-id) is rebuilt
    // from the package's own chapters — the candidate artifacts the release
    // assembled — so it verifies on a machine with no state/indexes at all, which
    // is exactly where a v25 candidate release runs. A legacy manifest declares
    // canonicalIndex and is rebuilt against the ambient index, unchanged.
    // validateProductionManifest has already refused a payload that declares both
    // or neither, and the two layers above have already checked the declaration
    // against the caller's expectation and the package against the manifest's own
    // recorded set — so by here the regime is settled, not self-selected.
    chapterSetSource: declaredSource,
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
