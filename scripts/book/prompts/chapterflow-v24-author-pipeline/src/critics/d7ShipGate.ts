/**
 * D7 rubric-audit SHIP GATE (WP-401).
 *
 * Makes a fresh, sealed D7 rubric-audit PASS a precondition of promoting a
 * NEW or CHANGED book. The rating itself stays EXTERNAL — isolated Claude
 * worker agents rate the app-faithful audit documents (zero codex/API); this
 * module never invokes a model. It only (a) MINTS a sealed gate receipt from an
 * already-adjudicated audit (model-free: it consumes rating outputs), and (b)
 * EVALUATES that receipt at promote/publish time against the exact bytes being
 * shipped.
 *
 * Two operating modes, mirroring the codebase's opt-in-strictness pattern
 * (CHAPTERFLOW_ENFORCE_MAJORS / _REQUIRE_KEYJUDGE / _REQUIRE_SOURCE_VERIFY):
 *   - DEFAULT: a PRESENT receipt must be a fresh PASS bound to the current
 *     bytes, or promotion is BLOCKED (a book you audited and it FAILED, or that
 *     changed since the audit, can never ship). A MISSING receipt is advisory —
 *     it does not block (backward-compat for the shipped 140-book corpus and
 *     every existing automation path).
 *   - REQUIRE (`CHAPTERFLOW_REQUIRE_D7_SHIP_GATE=1`, set by the S-tier terminal
 *     command / pilot): a MISSING receipt ALSO blocks. This is the "new book
 *     requires a sealed D7 PASS" ship discipline.
 *
 * NO-RETROACTIVITY (rt-D3): the gate applies ONLY to books whose package is
 * NEW or CHANGED relative to the shipped corpus. A candidate package
 * byte-identical to the already-shipped `book-packages/<id>.v21.json` is EXEMPT
 * (an unchanged re-promote of already-shipped content is never re-gated). The
 * 140 historical books therefore stay untouchable — even in REQUIRE mode an
 * unchanged re-promote is exempt, and a blocked promote never mutates the
 * existing shipped file.
 *
 * On a FAIL/VOID receipt the gate emits a `d7-ship-gate-halt-v1` record carrying
 * the D-8 on-fail policy DATA (one full re-author round per book per audit, then
 * a terminal owner halt). The re-author EXECUTION belongs to the author loop —
 * this module emits the directive and blocks, it never loops or re-authors.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { hashCanonical, sha256Hex } from "../contracts/contractUtil.js";
import { normSlug } from "../lib/chapterPaths.js";
import { assembleAuditPackage } from "../bakeoff/auditPackageAssembler.js";
import { artifactSha256FromText } from "../bakeoff/migration/rubricAuditCanonical.js";
import { rubricAuditDirRelPath } from "../bakeoff/migration/rubricAuditInstrument.js";
import {
  RUBRIC_AUDIT_BAR_D7,
  RUBRIC_AUDIT_RUBRIC_VERSION,
  buildRubricAuditReport,
  headingInventorySha256,
  renderAuditChapterDocument,
  type RubricAuditBar,
  type RubricAuditBatchManifestV1,
  type RubricAuditReportV1,
} from "../bakeoff/migration/rubricAuditInstrument.js";

export class D7ShipGateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "D7ShipGateError";
  }
}

// ── Schema identity ───────────────────────────────────────────────────────────

export const D7_SHIP_GATE_RECEIPT_SCHEMA_VERSION = "1.0.0" as const;
export const D7_SHIP_GATE_RECEIPT_ARTIFACT_TYPE = "chapterflow_d7_ship_gate_receipt" as const;
export const D7_SHIP_GATE_RECEIPT_ISSUER = "chapterflow_evaluation_orchestrator" as const;

export const D7_SHIP_GATE_HALT_SCHEMA_VERSION = "1.0.0" as const;
export const D7_SHIP_GATE_HALT_ARTIFACT_TYPE = "chapterflow_d7_ship_gate_halt" as const;

/** The halt taxonomy category for a book that cannot clear the D7 quality bar
 *  (D-8 / target-architecture on-fail: `fail → BLOCKED_QUALITY_BAR`). */
export const D7_HALT_CATEGORY_QUALITY_BAR = "BLOCKED_QUALITY_BAR" as const;

/** D-8: ONE full re-author round per book per audit. Round 1 FAIL buys a single
 *  re-author; a round-2 FAIL is terminal (owner escalation). */
export const D7_REAUTHOR_BUDGET_PER_AUDIT = 1 as const;

export const CHAPTERFLOW_REQUIRE_D7_SHIP_GATE_ENV = "CHAPTERFLOW_REQUIRE_D7_SHIP_GATE" as const;

export type D7ShipGateVerdict = "PASS" | "FAIL" | "VOID_CALIBRATION";
export type D7ShipGateDecision = "exempt" | "pass" | "advisory-skip" | "block";

// ── Receipt shape ─────────────────────────────────────────────────────────────

/** Per-chapter binding: the D7 result (from the adjudicated audit) plus the
 *  content-derived hashes the gate re-derives from CURRENT canonical state to
 *  prove the receipt is bound to the exact bytes being shipped. */
export type D7ShipGateChapterBinding = {
  unit: string;
  chapterNumber: number;
  chapterDiagnostic: number;
  coreDomainMin: number;
  coreDomainsPass: boolean;
  gatesPass: boolean;
  layerIndependencePass: boolean;
  pass: boolean;
  /** sha256 of the app-faithful audit document (renderAuditChapterDocument). */
  contentDocSha256: string;
  headingInventorySha256: string;
};

/** The sealed rater/adjudication chain-of-custody hashes for one unit. */
export type D7ShipGateCustody = {
  unit: string;
  primaryDispatchSha256: string;
  verificationDispatchSha256: string;
  pairSealSha256: string;
  adjudicationCanonicalSha256: string;
};

export type D7ShipGateReceiptV1 = {
  schema_version: typeof D7_SHIP_GATE_RECEIPT_SCHEMA_VERSION;
  artifact_type: typeof D7_SHIP_GATE_RECEIPT_ARTIFACT_TYPE;
  issuer: typeof D7_SHIP_GATE_RECEIPT_ISSUER;
  book_id: string;
  audit_id: string;
  /** Which audit round this receipt seals (1-based). D-8 one-round policy. */
  round: number;
  reauthor_budget_per_audit: number;
  instrument: { rubric_version: string; bar: RubricAuditBar };
  verdict: D7ShipGateVerdict;
  /** Book Composite Diagnostic Score = the audit mean. */
  book_cds: number;
  summary: {
    chapter_count: number;
    mean: number;
    min: number;
    mean_pass: boolean;
    min_pass: boolean;
    all_core_domains_pass: boolean;
    all_gates_pass: boolean;
    all_layer_independence_pass: boolean;
    calibration_pass: boolean;
  };
  calibration: {
    unit: string;
    expected: number;
    observed: number;
    abs_delta: number;
    tolerance: number;
    pass: boolean;
  };
  chapters: D7ShipGateChapterBinding[];
  custody: D7ShipGateCustody[];
  report_sha256: string;
  binding_sha256: string;
};

export type D7ShipGateHaltV1 = {
  schema_version: typeof D7_SHIP_GATE_HALT_SCHEMA_VERSION;
  artifact_type: typeof D7_SHIP_GATE_HALT_ARTIFACT_TYPE;
  halt_category: typeof D7_HALT_CATEGORY_QUALITY_BAR;
  book_id: string;
  audit_id: string;
  verdict: D7ShipGateVerdict;
  round: number;
  failing_chapters: Array<{ unit: string; chapter_number: number; chapter_diagnostic: number }>;
  /** D-8 on-fail policy DATA. `allowed_reauthors` = 1 while a re-author round is
   *  still owed (round 1); 0 + terminal once exhausted (round >= 2 → owner). */
  re_author_directive: { allowed_reauthors: number; round: number; terminal: boolean };
  binding_sha256: string;
};

// ── Hashing / integrity helpers ───────────────────────────────────────────────

function barEquals(a: RubricAuditBar, b: RubricAuditBar): boolean {
  return a.perChapterMin === b.perChapterMin
    && a.meanMin === b.meanMin
    && a.coreDomainFloor === b.coreDomainFloor
    && a.calibrationTolerance === b.calibrationTolerance;
}

/** Bind hash over the receipt minus its own `binding_sha256` (rubricAuditReceipts
 *  convention). Key order is irrelevant — hashCanonical sorts recursively. */
function receiptBindingHash(receipt: Record<string, unknown>): string {
  const payload: Record<string, unknown> = {};
  for (const key of Object.keys(receipt)) {
    if (key !== "binding_sha256") payload[key] = receipt[key];
  }
  return hashCanonical(payload);
}

function haltBindingHash(halt: Record<string, unknown>): string {
  const payload: Record<string, unknown> = {};
  for (const key of Object.keys(halt)) {
    if (key !== "binding_sha256") payload[key] = halt[key];
  }
  return hashCanonical(payload);
}

export function sealD7ShipGateReceipt(core: Omit<D7ShipGateReceiptV1, "binding_sha256">): D7ShipGateReceiptV1 {
  return { ...core, binding_sha256: receiptBindingHash(core as unknown as Record<string, unknown>) };
}

// ── Minting (model-free; consumes rating outputs) ─────────────────────────────

/** Map an adjudicated D7 report + the frozen batch content hashes into the
 *  sealed gate-receipt CORE. Pure — no filesystem, no model. The verdict and
 *  every per-chapter pass/score come straight from `buildRubricAuditReport`, so
 *  a sub-bar audit mints a FAIL receipt (which the gate then rejects). */
export function buildD7ShipGateReceiptCore(args: {
  bookId: string;
  auditId: string;
  round: number;
  report: RubricAuditReportV1;
  /** unit → { chapterNumber, contentDocSha256, headingInventorySha256 } (from the batch manifest). */
  contentBindings: Map<string, { chapterNumber: number; contentDocSha256: string; headingInventorySha256: string }>;
  custody: D7ShipGateCustody[];
}): Omit<D7ShipGateReceiptV1, "binding_sha256"> {
  const { report } = args;
  const chapters: D7ShipGateChapterBinding[] = report.chapters.map((chapter) => {
    const binding = args.contentBindings.get(chapter.unit);
    if (binding === undefined) {
      throw new D7ShipGateError(`no content binding for audited unit '${chapter.unit}'`);
    }
    return {
      unit: chapter.unit,
      chapterNumber: binding.chapterNumber,
      chapterDiagnostic: chapter.chapterDiagnostic,
      coreDomainMin: chapter.coreDomainMin,
      coreDomainsPass: chapter.coreDomainsPass,
      gatesPass: chapter.gatesPass,
      layerIndependencePass: chapter.layerIndependencePass,
      pass: chapter.pass,
      contentDocSha256: binding.contentDocSha256,
      headingInventorySha256: binding.headingInventorySha256,
    };
  });
  return {
    schema_version: D7_SHIP_GATE_RECEIPT_SCHEMA_VERSION,
    artifact_type: D7_SHIP_GATE_RECEIPT_ARTIFACT_TYPE,
    issuer: D7_SHIP_GATE_RECEIPT_ISSUER,
    book_id: normSlug(args.bookId),
    audit_id: args.auditId,
    round: args.round,
    reauthor_budget_per_audit: D7_REAUTHOR_BUDGET_PER_AUDIT,
    instrument: { rubric_version: report.rubricVersion, bar: report.bar },
    verdict: report.summary.verdict,
    book_cds: report.summary.mean,
    summary: {
      chapter_count: report.summary.chapterCount,
      mean: report.summary.mean,
      min: report.summary.min,
      mean_pass: report.summary.meanPass,
      min_pass: report.summary.minPass,
      all_core_domains_pass: report.summary.allCoreDomainsPass,
      all_gates_pass: report.summary.allGatesPass,
      all_layer_independence_pass: report.summary.allLayerIndependencePass,
      calibration_pass: report.summary.calibrationPass,
    },
    calibration: {
      unit: report.calibration.unit,
      expected: report.calibration.expected,
      observed: report.calibration.observed,
      abs_delta: report.calibration.absDelta,
      tolerance: report.calibration.tolerance,
      pass: report.calibration.pass,
    },
    chapters,
    custody: args.custody,
    report_sha256: report.reportSha256,
  };
}

/** Mint a sealed D7 ship-gate receipt from a COMPLETED audit directory (batch
 *  manifest + adjudications + custody). Model-free: it reads the retained rating
 *  outputs, rebuilds the deterministic report, and seals — it never rates. The
 *  content hashes are the batch's frozen per-chapter doc hashes; the GATE binds
 *  them to the current bytes at promote time. */
export function mintD7ShipGateReceiptFromAudit(args: {
  repositoryRoot: string;
  auditId: string;
  round?: number;
}): D7ShipGateReceiptV1 {
  const auditDir = resolve(args.repositoryRoot, rubricAuditDirRelPath(args.auditId));
  const manifestPath = resolve(auditDir, "batch-manifest.json");
  if (!existsSync(manifestPath)) {
    throw new D7ShipGateError(`no batch manifest at ${manifestPath} — run rubric-audit-batch --write first`);
  }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as RubricAuditBatchManifestV1;
  if (manifest.chapters.length === 0) {
    throw new D7ShipGateError("audit batch covers no chapters");
  }
  const bookIds = new Set(manifest.chapters.map((chapter) => chapter.bookId));
  if (bookIds.size !== 1) {
    throw new D7ShipGateError(`an audit batch must cover exactly one book (found ${[...bookIds].join(", ")})`);
  }
  const bookId = manifest.chapters[0].bookId;

  const adjudications = new Map<string, Record<string, unknown>>();
  for (const chapter of manifest.chapters) {
    const adjPath = resolve(auditDir, `raw/adjudicated/${chapter.unit}.json`);
    if (!existsSync(adjPath)) {
      throw new D7ShipGateError(`missing adjudication for ${chapter.unit} — the audit is incomplete`);
    }
    adjudications.set(chapter.unit, JSON.parse(readFileSync(adjPath, "utf8")) as Record<string, unknown>);
  }
  const calibrationPath = resolve(auditDir, `calibration/${manifest.calibration.unit}.adjudicated.json`);
  if (!existsSync(calibrationPath)) {
    throw new D7ShipGateError(`missing calibration adjudication for ${manifest.calibration.unit} — the audit is incomplete`);
  }
  const calibrationAdjudication = JSON.parse(readFileSync(calibrationPath, "utf8")) as Record<string, unknown>;

  const report = buildRubricAuditReport({ manifest, adjudications, calibrationAdjudication });

  const contentBindings = new Map(manifest.chapters.map((chapter) => [
    chapter.unit,
    {
      chapterNumber: chapter.chapterNumber,
      contentDocSha256: chapter.docSha256,
      headingInventorySha256: chapter.headingInventorySha256,
    },
  ]));

  const custody: D7ShipGateCustody[] = manifest.chapters.map((chapter) => ({
    unit: chapter.unit,
    primaryDispatchSha256: artifactSha256FromText(
      readFileSync(resolve(auditDir, `jobs/${chapter.unit}.receipts/primary.dispatch.json`), "utf8")),
    verificationDispatchSha256: artifactSha256FromText(
      readFileSync(resolve(auditDir, `jobs/${chapter.unit}.receipts/verification.dispatch.json`), "utf8")),
    pairSealSha256: artifactSha256FromText(
      readFileSync(resolve(auditDir, `jobs/${chapter.unit}.receipts/pair.seal.json`), "utf8")),
    adjudicationCanonicalSha256: artifactSha256FromText(
      readFileSync(resolve(auditDir, `raw/adjudicated/${chapter.unit}.json`), "utf8")),
  }));

  const core = buildD7ShipGateReceiptCore({
    bookId,
    auditId: args.auditId,
    round: args.round ?? 1,
    report,
    contentBindings,
    custody,
  });
  return sealD7ShipGateReceipt(core);
}

// ── Receipt resolution ────────────────────────────────────────────────────────

/** The per-book state-side path the gate resolves at promote/publish time. Kept
 *  next to the other promote sidecars (`<bookId>.gate.json`, `<bookId>.production-manifest.json`). */
export function d7ShipGateReceiptPath(bookId: string, stateBooksDir: string): string {
  return resolve(stateBooksDir, `${normSlug(bookId)}.d7-ship-gate.json`);
}

export function d7ShipGateHaltPath(bookId: string, stateBooksDir: string): string {
  return resolve(stateBooksDir, `${normSlug(bookId)}.d7-ship-gate-halt.json`);
}

// ── Current-content re-derivation ─────────────────────────────────────────────

export type D7CurrentContentEntry = {
  chapterNumber: number;
  contentDocSha256: string;
  headingInventorySha256: string;
};
export type D7CurrentContent = Map<string, D7CurrentContentEntry>;

/** Re-derive, from CURRENT canonical chapter state, the per-chapter app-faithful
 *  audit-document hashes the receipt binds against — the SAME transform the audit
 *  itself went through (assemble-audit-package → renderAuditChapterDocument), so
 *  the hashes are directly comparable to the batch/receipt docSha256. */
export function deriveCurrentD7Content(args: { bookId: string; chaptersDir?: string }): D7CurrentContent {
  const pkg = assembleAuditPackage({ bookId: args.bookId, chaptersDir: args.chaptersDir });
  const out: D7CurrentContent = new Map();
  for (const chapter of pkg.chapters) {
    const unit = `${pkg.book.id}-ch${String(chapter.number).padStart(2, "0")}`;
    const document = renderAuditChapterDocument({ bookId: pkg.book.id, chapter });
    out.set(unit, {
      chapterNumber: chapter.number,
      contentDocSha256: sha256Hex(Buffer.from(document, "utf8")),
      headingInventorySha256: headingInventorySha256(document),
    });
  }
  return out;
}

// ── Halt record ───────────────────────────────────────────────────────────────

function buildHaltRecord(receipt: D7ShipGateReceiptV1, bookId: string): D7ShipGateHaltV1 {
  const failing = receipt.chapters
    .filter((chapter) => !chapter.pass)
    .map((chapter) => ({
      unit: chapter.unit,
      chapter_number: chapter.chapterNumber,
      chapter_diagnostic: chapter.chapterDiagnostic,
    }));
  // Round 1 FAIL owes one full re-author; round >= 2 FAIL is terminal (owner).
  const terminal = receipt.round > D7_REAUTHOR_BUDGET_PER_AUDIT;
  const core = {
    schema_version: D7_SHIP_GATE_HALT_SCHEMA_VERSION,
    artifact_type: D7_SHIP_GATE_HALT_ARTIFACT_TYPE,
    halt_category: D7_HALT_CATEGORY_QUALITY_BAR,
    book_id: bookId,
    audit_id: receipt.audit_id,
    verdict: receipt.verdict,
    round: receipt.round,
    failing_chapters: failing,
    re_author_directive: {
      allowed_reauthors: terminal ? 0 : D7_REAUTHOR_BUDGET_PER_AUDIT,
      round: receipt.round,
      terminal,
    },
  };
  return { ...core, binding_sha256: haltBindingHash(core) };
}

// ── Pure evaluation ───────────────────────────────────────────────────────────

export type D7ShipGateResult = {
  decision: D7ShipGateDecision;
  blockers: string[];
  verdict: D7ShipGateVerdict | null;
  halt: D7ShipGateHaltV1 | null;
  reason: string;
};

/** Pure gate decision. Given the candidate bytes, the shipped bytes, the loaded
 *  receipt (or null), the current-content hashes (or null if underivable), and
 *  the require flag — decide exempt / pass / advisory-skip / block. No IO. */
export function evaluateD7ShipGate(input: {
  bookId: string;
  candidatePackageBytes: string;
  shippedPackageBytes: string | null;
  receipt: D7ShipGateReceiptV1 | null;
  /** True when a receipt file EXISTS on disk but could not be parsed. */
  receiptCorrupt?: boolean;
  currentContent: D7CurrentContent | null;
  require: boolean;
}): D7ShipGateResult {
  const bookId = normSlug(input.bookId);

  // 1. NO-RETROACTIVITY exemption: byte-identical to the shipped corpus package.
  if (input.shippedPackageBytes !== null && input.candidatePackageBytes === input.shippedPackageBytes) {
    return {
      decision: "exempt",
      blockers: [],
      verdict: null,
      halt: null,
      reason: "D7 ship gate: candidate package is byte-identical to the already-shipped corpus package — no-retroactivity exemption (rt-D3).",
    };
  }

  // 2. A receipt file that exists but is corrupt must NEVER fail open.
  if (input.receiptCorrupt === true) {
    return {
      decision: "block",
      blockers: ["D7.receipt_corrupt: a D7 ship-gate receipt file exists but is not valid JSON — fail-closed (re-mint from the audit)."],
      verdict: null,
      halt: null,
      reason: "D7 ship gate BLOCKED: the receipt file is present but unreadable.",
    };
  }

  // 3. No receipt: block only in REQUIRE mode; advisory otherwise.
  if (input.receipt === null) {
    if (input.require) {
      return {
        decision: "block",
        blockers: [`D7.receipt_missing: no sealed D7 ship-gate receipt for new/changed book '${bookId}'. Run: assemble-audit-package -> rubric-audit-batch -> (rate, external) -> rubric-audit-ingest -> rubric-audit-report -> rubric-audit-mint-ship-receipt.`],
        verdict: null,
        halt: null,
        reason: "D7 ship gate BLOCKED: a fresh D7 PASS receipt is required and none is present.",
      };
    }
    return {
      decision: "advisory-skip",
      blockers: [],
      verdict: null,
      halt: null,
      reason: `D7 ship gate: no receipt present; advisory (set ${CHAPTERFLOW_REQUIRE_D7_SHIP_GATE_ENV}=1 to require a sealed PASS bound to the shipped bytes).`,
    };
  }

  // 4. Receipt present — validate integrity, instrument, content binding, verdict.
  const receipt = input.receipt;
  const blockers: string[] = [];

  if (receiptBindingHash(receipt as unknown as Record<string, unknown>) !== receipt.binding_sha256) {
    blockers.push("D7.receipt_tampered: binding_sha256 does not match the receipt payload.");
  }
  if (receipt.schema_version !== D7_SHIP_GATE_RECEIPT_SCHEMA_VERSION
    || receipt.artifact_type !== D7_SHIP_GATE_RECEIPT_ARTIFACT_TYPE
    || receipt.issuer !== D7_SHIP_GATE_RECEIPT_ISSUER) {
    blockers.push("D7.receipt_schema_invalid: receipt schema/artifact_type/issuer is not the D7 ship-gate receipt identity.");
  }
  if (receipt.instrument?.rubric_version !== RUBRIC_AUDIT_RUBRIC_VERSION
    || !barEquals(receipt.instrument?.bar ?? ({} as RubricAuditBar), RUBRIC_AUDIT_BAR_D7)) {
    blockers.push("D7.instrument_mismatch: receipt rubric version / bar differs from the frozen D7 instrument (RUBRIC_AUDIT_BAR_D7).");
  }
  if (normSlug(receipt.book_id) !== bookId) {
    blockers.push(`D7.book_mismatch: receipt book_id '${receipt.book_id}' does not match the book being promoted '${bookId}'.`);
  }

  // Content binding: every shipped chapter must be covered by the receipt at the
  // EXACT current bytes (a change since the audit stales the receipt).
  if (input.currentContent === null) {
    blockers.push("D7.content_underivable: cannot re-derive the current canonical audit content to bind the receipt (fail-closed).");
  } else {
    const receiptUnits = new Set(receipt.chapters.map((chapter) => chapter.unit));
    const currentUnits = new Set(input.currentContent.keys());
    const sameSet = receiptUnits.size === currentUnits.size
      && [...currentUnits].every((unit) => receiptUnits.has(unit));
    if (!sameSet) {
      blockers.push(
        `D7.stale_content: the receipt covers {${[...receiptUnits].sort().join(", ")}} but the current book ships {${[...currentUnits].sort().join(", ")}} — re-audit the current chapter set.`);
    } else {
      for (const chapter of receipt.chapters) {
        const current = input.currentContent.get(chapter.unit)!;
        if (current.contentDocSha256 !== chapter.contentDocSha256) {
          blockers.push(
            `D7.stale_content: ${chapter.unit} content changed since the audit (receipt ${chapter.contentDocSha256.slice(0, 12)}… != current ${current.contentDocSha256.slice(0, 12)}…).`);
        }
      }
    }
  }

  // Quality bar: only a PASS verdict ships.
  const verdict = receipt.verdict;
  if (verdict !== "PASS") {
    blockers.push(
      `D7.quality_bar_failed: D7 verdict is ${verdict} (mean ${receipt.summary.mean.toFixed(2)}, min ${receipt.summary.min.toFixed(2)}; bar mean>=${RUBRIC_AUDIT_BAR_D7.meanMin}, min>=${RUBRIC_AUDIT_BAR_D7.perChapterMin}, core>=${RUBRIC_AUDIT_BAR_D7.coreDomainFloor}, +-${RUBRIC_AUDIT_BAR_D7.calibrationTolerance} calibration).`);
  }

  if (blockers.length > 0) {
    const halt = verdict !== "PASS" ? buildHaltRecord(receipt, bookId) : null;
    return {
      decision: "block",
      blockers,
      verdict,
      halt,
      reason: `D7 ship gate BLOCKED: ${blockers.join(" ")}`,
    };
  }
  return {
    decision: "pass",
    blockers: [],
    verdict,
    halt: null,
    reason: `D7 ship gate PASS: verdict PASS bound to the shipped bytes (book CDS ${receipt.book_cds.toFixed(2)}, min ${receipt.summary.min.toFixed(2)}).`,
  };
}

// ── Wired entrypoint (reads state, no writes, no model) ───────────────────────

/** Resolve + evaluate the D7 ship gate for a book about to be promoted. Reads
 *  the shipped package (for the exemption), the receipt, and — only when a
 *  receipt is present — re-derives current canonical content. Never writes, never
 *  invokes a model. promoteBook / publishAfterQc pass the `require` flag they read
 *  from the environment; this module reads no ambient environment itself. */
export function runD7ShipGate(args: {
  bookId: string;
  candidatePackageBytes: string;
  /** The existing shipped package path (`book-packages/<id>.v21.json`). */
  packagePath: string;
  /** The state/books dir where the receipt sidecar lives. */
  stateBooksDir: string;
  /** Canonical chapters dir override (test seam); defaults to CHAPTERS_DIR. */
  chaptersDir?: string;
  require: boolean;
}): D7ShipGateResult {
  const bookId = normSlug(args.bookId);
  const shippedPackageBytes = readTextIfExists(args.packagePath);

  // Exemption fast-path — no receipt / content derivation needed.
  if (shippedPackageBytes !== null && shippedPackageBytes === args.candidatePackageBytes) {
    return evaluateD7ShipGate({
      bookId,
      candidatePackageBytes: args.candidatePackageBytes,
      shippedPackageBytes,
      receipt: null,
      currentContent: null,
      require: args.require,
    });
  }

  const receiptPath = d7ShipGateReceiptPath(bookId, args.stateBooksDir);
  let receipt: D7ShipGateReceiptV1 | null = null;
  let receiptCorrupt = false;
  if (existsSync(receiptPath)) {
    try {
      receipt = JSON.parse(readFileSync(receiptPath, "utf8")) as D7ShipGateReceiptV1;
    } catch {
      receiptCorrupt = true;
    }
  }

  // Current content is only needed when a receipt is present (a missing receipt
  // is decided by the require flag; a corrupt one blocks regardless).
  let currentContent: D7CurrentContent | null = null;
  if (receipt !== null) {
    try {
      currentContent = deriveCurrentD7Content({ bookId, chaptersDir: args.chaptersDir });
    } catch {
      currentContent = null;
    }
  }

  return evaluateD7ShipGate({
    bookId,
    candidatePackageBytes: args.candidatePackageBytes,
    shippedPackageBytes,
    receipt,
    receiptCorrupt,
    currentContent,
    require: args.require,
  });
}

function readTextIfExists(path: string): string | null {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

/** Defense-in-depth D7 evaluation for the publish-after-qc PREFLIGHT, which runs
 *  BEFORE promote and has no candidate package bytes yet. There is therefore no
 *  byte-identity exemption here — a PRESENT receipt is validated (verdict /
 *  content-binding / integrity) and a MISSING one blocks only in require mode.
 *  promoteBook remains the authority (it also runs the byte-identity exemption). */
export function evaluateD7ShipGateForPreflight(args: {
  bookId: string;
  stateBooksDir: string;
  chaptersDir?: string;
  require: boolean;
}): D7ShipGateResult {
  const bookId = normSlug(args.bookId);
  const receiptPath = d7ShipGateReceiptPath(bookId, args.stateBooksDir);
  let receipt: D7ShipGateReceiptV1 | null = null;
  let receiptCorrupt = false;
  if (existsSync(receiptPath)) {
    try {
      receipt = JSON.parse(readFileSync(receiptPath, "utf8")) as D7ShipGateReceiptV1;
    } catch {
      receiptCorrupt = true;
    }
  }
  let currentContent: D7CurrentContent | null = null;
  if (receipt !== null) {
    try {
      currentContent = deriveCurrentD7Content({ bookId, chaptersDir: args.chaptersDir });
    } catch {
      currentContent = null;
    }
  }
  return evaluateD7ShipGate({
    bookId,
    candidatePackageBytes: "",
    shippedPackageBytes: null,
    receipt,
    receiptCorrupt,
    currentContent,
    require: args.require,
  });
}
