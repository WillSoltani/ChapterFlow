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
import {
  loadRecord,
  validatePairChain,
  type RubricInspection,
} from "../bakeoff/migration/rubricAuditReceipts.js";
// WP-E23 route proof: the receipt's rater_route is verified against the SAME
// authorities the D7 dispatch itself is bound to — the recognized codex-exec
// model family (not just today's provisional baseline, so a later WP-705
// winner change does not retroactively invalidate an honest past route) and the
// single ultra-effort token. Both are leaf/type-safe imports (no runtime cycle:
// modelPolicy.ts and ultraSession.ts import neither this module nor
// rubricAuditHarness.ts).
import { SUPPORTED_MODEL_IDS } from "../orchestrator/modelPolicy.js";
import { ULTRA_EFFORT } from "../exec/ultraSession.js";
import { rubricAuditDirRelPath } from "../bakeoff/migration/rubricAuditInstrument.js";
import { resolveAuditUnit } from "../bakeoff/migration/rubricAuditHarness.js";
import {
  RUBRIC_AUDIT_BAR_D7,
  RUBRIC_AUDIT_RUBRIC_VERSION,
  RUBRIC_CALIBRATION_REFERENCES,
  buildRubricAuditReport,
  headingInventorySha256,
  renderAuditChapterDocument,
  validateChapterAdjudicationRecord,
  type RubricAuditBar,
  type RubricAuditBatchManifestV1,
  type RubricAuditProfile,
  type RubricAuditReportV1,
} from "../bakeoff/migration/rubricAuditInstrument.js";

export class D7ShipGateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "D7ShipGateError";
  }
}

// ── Schema identity ───────────────────────────────────────────────────────────

/** WP-E23 (P3, "a prompt string claiming Sol Ultra is not proof"): bumped from
 *  1.0.0 to add `rater_route` (§ below) — the receipt now PROVES which family/
 *  model/effort rated the book, not merely a claim. A receipt sealed under the
 *  PRIOR version predates this proof by honest construction (the D7 rater was a
 *  Claude-side session before WP-E21/22 flipped it to codex-exec) — see
 *  `D7_SHIP_GATE_RECEIPT_LEGACY_SCHEMA_VERSION_V1`. */
export const D7_SHIP_GATE_RECEIPT_SCHEMA_VERSION = "1.1.0" as const;
/** The sole prior schema version, still RECOGNIZED (not `D7.receipt_schema_
 *  invalid`) so a book already shipped under it is never retroactively broken.
 *  A receipt at this version verifies with `routeProof: "unproven"` — visible,
 *  never silently reported as a proven route (see `deriveRouteProof`). */
export const D7_SHIP_GATE_RECEIPT_LEGACY_SCHEMA_VERSION_V1 = "1.0.0" as const;
export const D7_SHIP_GATE_RECEIPT_ARTIFACT_TYPE = "chapterflow_d7_ship_gate_receipt" as const;
export const D7_SHIP_GATE_RECEIPT_ISSUER = "chapterflow_evaluation_orchestrator" as const;

/** The only rater transport a D7 route may claim (V25-NEW-01: no Claude-family
 *  model may rate a book or chapter). */
export const D7_RATER_ROUTE_FAMILY = "codex-exec" as const;

/** The D7 rater route PROOF carried on a current-schema receipt: which family/
 *  model/effort rated the book, bound to the campaign's ultra-acceptance probe
 *  (`ultraSession.ts` `UltraAcceptanceProbeV1.sidecarSha256`) so a claimed route
 *  is tied to evidence the installed CLI actually accepted it. */
export type D7ShipGateRaterRouteV1 = {
  family: typeof D7_RATER_ROUTE_FAMILY;
  model: string;
  effort: string;
  ultra_probe_sha256: string;
};

/** Whether a receipt's D7 rater route is backed by verifiable proof.
 *   - `proven`   — current schema, `rater_route` present and structurally valid
 *                  (family/model/effort/probe-hash-shape all check out).
 *   - `unproven` — a legacy-schema receipt: the route was never recorded because
 *                  the receipt predates this proof (honest gap, not a lie).
 *   - `invalid`  — current schema but `rater_route` is missing or does not match
 *                  the authorized route (a spoof/tamper) — always a blocker. */
export type D7ShipGateRouteProofStatus = "proven" | "unproven" | "invalid";

export const D7_SHIP_GATE_HALT_SCHEMA_VERSION = "1.0.0" as const;
export const D7_SHIP_GATE_HALT_ARTIFACT_TYPE = "chapterflow_d7_ship_gate_halt" as const;

/** The halt taxonomy category for a book that cannot clear the D7 quality bar
 *  (D-8 / target-architecture on-fail: `fail → BLOCKED_QUALITY_BAR`). */
export const D7_HALT_CATEGORY_QUALITY_BAR = "BLOCKED_QUALITY_BAR" as const;

/** D-8: ONE full re-author round per book per audit. Round 1 FAIL buys a single
 *  re-author; a round-2 FAIL is terminal (owner escalation). */
export const D7_REAUTHOR_BUDGET_PER_AUDIT = 1 as const;

export const CHAPTERFLOW_REQUIRE_D7_SHIP_GATE_ENV = "CHAPTERFLOW_REQUIRE_D7_SHIP_GATE" as const;

/** A lowercase SHA-256 digest (the shape every custody artifact hash must take). */
const SHA256_RE = /^[0-9a-f]{64}$/;

/** A plain audit-id slug. `audit_id` is interpolated raw into the retained-audit
 *  directory path (`rubricAuditDirRelPath`), so anything that is not a plain slug
 *  (a '/'/'\\' separator, a '..' traversal, an absolute or leading-dot path) is a
 *  path-traversal / injection vector and is refused at BOTH mint and gate time
 *  (rt-401 round 2, finding A(b)). Kebab and the `zz-`/upper-case test ids remain
 *  valid — only separators, dots, and traversal are rejected. */
const SAFE_AUDIT_ID_RE = /^[A-Za-z0-9_-]+$/;

function isSafeAuditId(auditId: unknown): auditId is string {
  return typeof auditId === "string" && SAFE_AUDIT_ID_RE.test(auditId);
}

export type D7ShipGateVerdict = "PASS" | "FAIL" | "VOID_CALIBRATION";
export type D7ShipGateDecision = "exempt" | "pass" | "advisory-skip" | "block";

/** Result of re-verifying a receipt's chain-of-custody against the RETAINED audit
 *  artifacts on disk.
 *   - `verified`        — the audit dir is present and every custody hash matched
 *                          the retained bytes AND every blind-pair chain validated.
 *   - `retained-absent` — no retained audit dir for `audit_id` on disk (e.g. a
 *                          fresh worktree consuming a sealed receipt); the
 *                          MINT-TIME pair-chain check is the load-bearing one,
 *                          gate-time re-verification is best-effort.
 *   - `failed`          — a custody hash or blind-pair chain did not verify;
 *                          `blockers` carries the D7.custody_mismatch /
 *                          D7.pair_chain_invalid reasons (fail-closed). */
export type D7CustodyVerifyStatus = "verified" | "retained-absent" | "failed";
export type D7CustodyVerification = { status: D7CustodyVerifyStatus; blockers: string[] };

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
  /** WP-E23 route proof: sha256 of the retained `adjudicator.envelope-manifest.
   *  json` sidecar (rubricAuditHarness.ts persists it from
   *  `D7IngestDispatchMetaV1.envelopeManifestSha256`, the sha of the adjudicator's
   *  ultra-session effective-context manifest — same hashing convention as the
   *  other four fields: the retained FILE's bytes, not a value parsed out of it).
   *  Optional: absent for a pre-WP-E23 / hand-off ingest that never observed
   *  dispatch metadata — never fabricated. When present, the gate re-verifies it
   *  against the retained sidecar and a mismatch fails closed
   *  (`verifyRetainedD7Custody`), exactly like the other four hashes. */
  envelopeManifestSha256?: string;
};

export type D7ShipGateReceiptV1 = {
  /** Current-schema receipts carry `rater_route` (proof); the recognized legacy
   *  version predates it (see `D7_SHIP_GATE_RECEIPT_LEGACY_SCHEMA_VERSION_V1`). */
  schema_version: typeof D7_SHIP_GATE_RECEIPT_SCHEMA_VERSION | typeof D7_SHIP_GATE_RECEIPT_LEGACY_SCHEMA_VERSION_V1;
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
  /** WP-E23 route proof. Present on current-schema receipts; absent on a
   *  recognized-legacy receipt (`routeProof` reports "unproven", never a silent
   *  "proven"). Included in `binding_sha256` — tampering it invalidates the
   *  seal, and `deriveRouteProof` independently checks it structurally so a
   *  forger who ALSO recomputes the binding hash is still caught. */
  rater_route?: D7ShipGateRaterRouteV1;
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

/** Whether a `rater_route`'s CONTENT matches the sole authorized D7 transport:
 *  family `codex-exec`, a RECOGNIZED codex-exec family member (not pinned to
 *  today's provisional baseline — a later WP-705 winner change must not
 *  retroactively invalidate an honest past route), the single ultra effort token,
 *  and a sha256-shaped probe hash. A Claude string, a spoofed family, or a
 *  malformed probe hash all fail this. */
function isAuthorizedRouteShape(route: D7ShipGateRaterRouteV1 | undefined): route is D7ShipGateRaterRouteV1 {
  if (route === undefined) return false;
  const wellFormedProbe = typeof route.ultra_probe_sha256 === "string" && SHA256_RE.test(route.ultra_probe_sha256);
  return route.family === D7_RATER_ROUTE_FAMILY
    && SUPPORTED_MODEL_IDS.has(route.model)
    && route.effort === ULTRA_EFFORT
    && wellFormedProbe;
}

/** A full route-proof assessment: the status PLUS how it should surface.
 *   - `hardBlock`    — a spoof/tamper (a Claude string, a spoofed family, a probe
 *                      that does not match the campaign's) — blocks in BOTH modes.
 *   - `requireBlock` — a vestigial proof (rt FINDING A leg 2): a current-schema
 *                      receipt whose deciding-unit custody lacks the envelope-
 *                      manifest binding — blocks ONLY under REQUIRE.
 *   - `note`         — a visible line folded into `reason` so a non-fully-proven
 *                      route is NEVER silently reported as full proof. */
type D7RouteProofAssessmentV1 = {
  status: D7ShipGateRouteProofStatus;
  hardBlock: string | null;
  requireBlock: string | null;
  note: string;
};

/** WP-E23 route proof (P3, "a prompt string claiming Sol Ultra is not proof") +
 *  rt FINDING A (route proof vestigial). Classify a receipt's D7 rater route.
 *  Pure, structural, independent of `binding_sha256` — a self-consistent forgery
 *  is still caught because this checks the route CONTENT (and its custody binding)
 *  against the authorized shape, not merely internal consistency.
 *
 *   - legacy schema            → "unproven" (honest gap; predates this proof).
 *   - current schema, missing/spoofed `rater_route` → "invalid" (hard block).
 *   - current schema, authorized route shape, but the deciding-unit custody lacks
 *     a well-formed `envelopeManifestSha256` binding it to the real ultra session
 *     → "invalid" (the proof is vestigial — a claim with no binding; REQUIRE fails
 *     closed, advisory records a visible note) — rt FINDING A leg 2.
 *   - current schema, authorized + custody-bound, and (when the caller supplies
 *     the campaign probe sha) `ultra_probe_sha256` MATCHES it → "proven"; a
 *     mismatch → "invalid" (hard block) — rt FINDING A leg 3. When the caller
 *     supplies no expected probe sha, the route is "proven" but carries a
 *     "probe-unbound" note (never silently full-proven). */
function assessRouteProof(receipt: D7ShipGateReceiptV1, expectedUltraProbeSha256?: string): D7RouteProofAssessmentV1 {
  if (receipt.schema_version === D7_SHIP_GATE_RECEIPT_LEGACY_SCHEMA_VERSION_V1) {
    return {
      status: "unproven",
      hardBlock: null,
      requireBlock: null,
      note: " [D7 rater route: UNPROVEN — receipt predates route-proof (legacy schema); external rater identity not verifiable.]",
    };
  }
  const route = receipt.rater_route;
  if (!isAuthorizedRouteShape(route)) {
    return {
      status: "invalid",
      hardBlock: "D7.rater_route_invalid: the receipt's rater_route is missing or does not match the authorized Sol-ultra codex-exec route (family/model/effort/probe-hash-shape) — a Claude-family or spoofed route can never ship.",
      requireBlock: null,
      note: "",
    };
  }
  // rt FINDING A leg 2: an authorized route SHAPE is only PROVEN when the deciding
  // (adjudicator) session's envelope-manifest custody actually binds it. A current-
  // schema receipt whose custody lacks a well-formed envelopeManifestSha256 on any
  // unit is a vestigial claim — route proof was never wired through to the sidecar.
  const custody = Array.isArray(receipt.custody) ? receipt.custody : [];
  const custodyBound = custody.length > 0
    && custody.every((entry) => typeof entry.envelopeManifestSha256 === "string" && SHA256_RE.test(entry.envelopeManifestSha256));
  if (!custodyBound) {
    return {
      status: "invalid",
      hardBlock: null,
      requireBlock: "D7.rater_route_unbound: the receipt claims a proven codex-exec route but a deciding-unit custody entry lacks a well-formed envelope-manifest sha256 binding it to the real ultra session — route proof is vestigial (REQUIRE fails closed; re-mint from a retained audit that observed the dispatch).",
      note: " [D7 rater route: UNBOUND — current-schema route claim has no deciding-unit envelope-manifest custody binding it.]",
    };
  }
  // rt FINDING A leg 3: when the caller supplies the campaign ultra-acceptance
  // probe sha, the route's ultra_probe_sha256 MUST equal it (a mismatch is a route
  // not backed by the accepted probe → hard block). When absent, the proof is not
  // fully bound to a specific probe — a visible note, never silent.
  if (expectedUltraProbeSha256 !== undefined) {
    if (route.ultra_probe_sha256 !== expectedUltraProbeSha256) {
      return {
        status: "invalid",
        hardBlock: `D7.rater_route_probe_mismatch: the receipt's ultra_probe_sha256 (${route.ultra_probe_sha256.slice(0, 12)}…) does not equal the campaign ultra-acceptance probe (${expectedUltraProbeSha256.slice(0, 12)}…) — the claimed route is not backed by the accepted probe.`,
        requireBlock: null,
        note: "",
      };
    }
    return { status: "proven", hardBlock: null, requireBlock: null, note: "" };
  }
  return {
    status: "proven",
    hardBlock: null,
    requireBlock: null,
    note: " [D7 rater route: PROBE-UNBOUND — proven route shape + custody, but no campaign ultra-probe sha was supplied to bind it; pass expectedUltraProbeSha256 for full proof.]",
  };
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
  /** WP-E23: the proven D7 rater route for this receipt. Supplying it stamps
   *  the CURRENT schema (route-proof carrying); omitting it stamps the
   *  RECOGNIZED LEGACY schema — a receipt never claims proof it does not carry
   *  (see `D7_SHIP_GATE_RECEIPT_LEGACY_SCHEMA_VERSION_V1`). */
  raterRoute?: D7ShipGateRaterRouteV1;
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
    // A receipt never CLAIMS proof it does not carry: current schema only when
    // a rater route was actually supplied, legacy otherwise (WP-E23).
    schema_version: args.raterRoute !== undefined
      ? D7_SHIP_GATE_RECEIPT_SCHEMA_VERSION
      : D7_SHIP_GATE_RECEIPT_LEGACY_SCHEMA_VERSION_V1,
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
    ...(args.raterRoute !== undefined ? { rater_route: args.raterRoute } : {}),
  };
}

/** Resolve the source text + rubric profile needed to re-validate a retained
 *  adjudication with `validateChapterAdjudicationRecord`, bound to the frozen
 *  inspection's `source_hash`. Two resolution paths, each verified against the
 *  inspection BEFORE use so a wrong doc can never satisfy the binding:
 *   - the canonical `resolveAuditUnit` rebuild — real v25 book audits (and the
 *     real calibration reference) whose audit documents rebuild from the frozen
 *     manifest's package, and
 *   - the owner-adjudicated calibration references — the sealed-baseline /
 *     owner-run-compat units, read from `docRelPath` relative to the repo root.
 *  Returns null when neither path yields bytes whose sha256 equals the frozen
 *  `inspection.source_hash` (an incomplete/tampered audit; the caller fails
 *  closed). */
function resolveAdjudicationSource(args: {
  repositoryRoot: string;
  manifest: RubricAuditBatchManifestV1;
  unit: string;
  inspection: RubricInspection;
}): { sourceText: string; profile: RubricAuditProfile } | null {
  const wantHash = args.inspection.source_hash;
  if (typeof wantHash !== "string" || !SHA256_RE.test(wantHash)) return null;
  try {
    const resolution = resolveAuditUnit({
      repositoryRoot: args.repositoryRoot,
      manifest: args.manifest,
      unit: args.unit,
    });
    if (sha256Hex(Buffer.from(resolution.sourceText, "utf8")) === wantHash) {
      return { sourceText: resolution.sourceText, profile: resolution.profile };
    }
  } catch {
    // The canonical rebuild is unavailable (e.g. an owner-run-compat unit whose
    // source package is not in this tree) — fall through to the reference docs.
  }
  const reference = RUBRIC_CALIBRATION_REFERENCES.find((ref) => ref.unit === args.unit);
  if (reference !== undefined) {
    const abs = resolve(args.repositoryRoot, reference.docRelPath);
    if (existsSync(abs)) {
      const text = readFileSync(abs, "utf8");
      if (sha256Hex(Buffer.from(text, "utf8")) === wantHash) {
        return { sourceText: text, profile: "owner-run-compat" };
      }
    }
  }
  return null;
}

/** Cross-check every adjudicated GATE status against the two blind raters' gate
 *  records — the NOTE 1 closure (rt-401 round 3). The frozen instrument's
 *  `validateChapterAdjudicationRecord` fully rebinds SCORES (arithmetic) and
 *  DOMAINS, and binds the agreement metrics to the untampered blind pair, but it
 *  never binds a gate's STATUS to content: `validateGates` only checks the status
 *  enum + a non-empty rationale. Yet `chapterResultFromAdjudication` computes
 *  `gatesPass`/`layerIndependencePass` — and thus the ship verdict — DIRECTLY from
 *  those statuses. So a state-writing adversary could flip one adjudicated gate on
 *  otherwise-genuine retained evidence (e.g. a genuinely-failing `external_accuracy`
 *  / `epistemic_instructional_safety` / `layer_independence` → `pass`, or a passing
 *  `chapter_artifact_completeness` → `fail`) and the arithmetic validator would
 *  return zero errors (runtime-proven).
 *
 *  The blind-pair rater records (`raw/primary/<unit>.json`, `raw/verification/<unit>.json`)
 *  carry a per-gate `{status, rationale}` for every gate key. An adjudicator has
 *  genuine authority to SIDE WITH EITHER rater when they disagree (the owner run
 *  itself does this: happiness-ch06 `epistemic_instructional_safety` is primary
 *  `pass` / verification `conditional` / adjudicated `pass`). What it may NOT do is
 *  invent a THIRD status that NEITHER blind rater assigned — that is precisely the
 *  hand-edit signature. RULE: an adjudicated gate whose status matches neither
 *  rater's status for that gate is a BINDING error. This binds gates the way scores
 *  are bound to arithmetic and agreement is bound to the blind pair — a hand-edited
 *  gate now breaks validation exactly as a hand-edited score does. (The gate schema
 *  carries no dedicated override field beyond `{status, rationale}` — verified
 *  against the real retained bytes — so siding-with-a-rater IS the only recorded
 *  authority path, and it is honoured.) */
function validateAdjudicationGateBinding(args: {
  unit: string;
  adjudicationRaw: string;
  primaryRaw: string;
  verificationRaw: string;
}): string[] {
  const gatesOf = (raw: string): Record<string, unknown> => {
    const value = loadRecord(raw).value;
    return (value.gates ?? {}) as Record<string, unknown>;
  };
  const statusOf = (gates: Record<string, unknown>, key: string): string =>
    String(((gates[key] ?? {}) as Record<string, unknown>).status ?? "");
  const adjGates = gatesOf(args.adjudicationRaw);
  const primaryGates = gatesOf(args.primaryRaw);
  const verificationGates = gatesOf(args.verificationRaw);
  const errors: string[] = [];
  for (const key of Object.keys(adjGates)) {
    const adj = statusOf(adjGates, key);
    if (adj === "") continue; // shape is the frozen validator's job; skip the empty case
    const primary = statusOf(primaryGates, key);
    const verification = statusOf(verificationGates, key);
    if (adj !== primary && adj !== verification) {
      errors.push(
        `D7.adjudication_gate_mismatch: ${args.unit} gate '${key}' adjudicated status '${adj}' matches NEITHER blind rater (primary '${primary || "<absent>"}', verification '${verification || "<absent>"}') — a gate status the raters never assigned is a hand-edit and cannot ship.`);
    }
  }
  return errors;
}

/** Re-validate a retained adjudication END-TO-END with the SAME validator the
 *  owner's ingest pipeline runs (`validateChapterAdjudicationRecord`): its blind-
 *  pair chain, its arithmetic (every `domain_score` / `chapter_diagnostic_score`
 *  recomputed from the sub-criteria ratings), its agreement metrics bound to the
 *  untampered blind pair, its source binding, and its gates. The retained
 *  ADJUDICATION is the artifact whose scores SOLELY set the D7 verdict, yet the
 *  round-1 fix bound only the pair chain — so tampering the adjudication alone
 *  minted a shippable PASS with custody "verified" (rt-401 round 2, finding B).
 *  Binding it here closes that bypass. The frozen validator leaves gate STATUS
 *  unbound (it feeds the verdict yet is only shape-checked), so this ALSO cross-
 *  checks every adjudicated gate status against the blind-pair rater gate records
 *  (rt-401 round 3, NOTE 1). Returns `resolved:false` when the audit source could
 *  not be resolved (fail-closed at the call sites). */
function validateRetainedAdjudication(args: {
  repositoryRoot: string;
  manifest: RubricAuditBatchManifestV1;
  unit: string;
  adjudicationRaw: string;
  primaryRaw: string;
  verificationRaw: string;
  primaryDispatchRaw: string;
  verificationDispatchRaw: string;
  pairSealRaw: string;
  inspectionRaw: string;
}): { resolved: boolean; errors: string[] } {
  const inspection = loadRecord(args.inspectionRaw).value as RubricInspection;
  const source = resolveAdjudicationSource({
    repositoryRoot: args.repositoryRoot,
    manifest: args.manifest,
    unit: args.unit,
    inspection,
  });
  if (source === null) return { resolved: false, errors: [] };
  const errors = validateChapterAdjudicationRecord({
    record: loadRecord(args.adjudicationRaw),
    primary: loadRecord(args.primaryRaw),
    verification: loadRecord(args.verificationRaw),
    primaryDispatch: loadRecord(args.primaryDispatchRaw),
    verificationDispatch: loadRecord(args.verificationDispatchRaw),
    pairSeal: loadRecord(args.pairSealRaw),
    inspection,
    sourceText: source.sourceText,
    profile: source.profile,
  });
  // NOTE 1 closure (rt-401 round 3): the frozen validator rebinds scores/domains/
  // agreement but leaves gate STATUS unbound, even though gate statuses set the
  // ship verdict. Bind each adjudicated gate status to the blind-pair rater gate
  // records so a hand-edited gate breaks validation exactly as a hand-edited score
  // does. Additive — never removes a frozen-validator error.
  errors.push(...validateAdjudicationGateBinding({
    unit: args.unit,
    adjudicationRaw: args.adjudicationRaw,
    primaryRaw: args.primaryRaw,
    verificationRaw: args.verificationRaw,
  }));
  return { resolved: true, errors: [...new Set(errors)].sort() };
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
  /** WP-E23: the proven D7 rater route for this mint. Omitting it mints a
   *  RECOGNIZED-LEGACY receipt (honest — see `buildD7ShipGateReceiptCore`); the
   *  production `rubric-audit-mint-ship-receipt` driver supplies it once it
   *  resolves the campaign's route + ultra-acceptance-probe sha (out of this
   *  module's scope — it never reads that proof off disk itself). */
  raterRoute?: D7ShipGateRaterRouteV1;
}): D7ShipGateReceiptV1 {
  if (!isSafeAuditId(args.auditId)) {
    throw new D7ShipGateError(
      `D7.audit_id_invalid: audit_id '${String(args.auditId)}' is not a plain slug — refusing to mint (path-traversal / injection guard).`);
  }
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

  // Custody + integrity: for EVERY audited chapter, VALIDATE the retained blind-
  // pair chain (dispatch/result/pair-seal against the frozen source inspection)
  // and only then bind its artifact hashes. A missing artifact or any chain error
  // REFUSES the mint — a sealed PASS receipt can only be minted from a real,
  // tamper-consistent rating run, never conjured from nothing (rt-401).
  const custody: D7ShipGateCustody[] = [];
  for (const chapter of manifest.chapters) {
    const unit = chapter.unit;
    const readArtifact = (relPath: string): string => {
      const abs = resolve(auditDir, relPath);
      if (!existsSync(abs)) {
        throw new D7ShipGateError(
          `cannot mint a D7 ship-gate receipt: missing retained audit artifact '${relPath}' for ${unit} — the audit is incomplete or tampered.`);
      }
      return readFileSync(abs, "utf8");
    };
    const inspectionRaw = readArtifact(`jobs/${unit}.inspection.json`);
    const primaryRaw = readArtifact(`raw/primary/${unit}.json`);
    const verificationRaw = readArtifact(`raw/verification/${unit}.json`);
    const primaryDispatchRaw = readArtifact(`jobs/${unit}.receipts/primary.dispatch.json`);
    const verificationDispatchRaw = readArtifact(`jobs/${unit}.receipts/verification.dispatch.json`);
    const pairSealRaw = readArtifact(`jobs/${unit}.receipts/pair.seal.json`);
    const adjudicationRaw = readArtifact(`raw/adjudicated/${unit}.json`);
    const chainErrors = validatePairChain({
      primary: loadRecord(primaryRaw),
      verification: loadRecord(verificationRaw),
      primaryDispatch: loadRecord(primaryDispatchRaw),
      verificationDispatch: loadRecord(verificationDispatchRaw),
      pairSeal: loadRecord(pairSealRaw),
      inspection: loadRecord(inspectionRaw).value as RubricInspection,
    });
    if (chainErrors.length > 0) {
      throw new D7ShipGateError(
        `cannot mint a D7 ship-gate receipt: the retained blind-pair chain for ${unit} is invalid — ${chainErrors.join("; ")}`);
    }
    // Bind the ADJUDICATION whose scores set the verdict, not only the pair chain
    // (rt-401 round 2, finding B). A tamper-inflated adjudication is arithmetically
    // inconsistent (and breaks its agreement binding to the blind pair), so this
    // REFUSES the mint — a sealed PASS can only be minted from a self-consistent
    // rating run, never from a hand-edited score.
    const adjudication = validateRetainedAdjudication({
      repositoryRoot: args.repositoryRoot,
      manifest,
      unit,
      adjudicationRaw,
      primaryRaw,
      verificationRaw,
      primaryDispatchRaw,
      verificationDispatchRaw,
      pairSealRaw,
      inspectionRaw,
    });
    if (!adjudication.resolved) {
      throw new D7ShipGateError(
        `cannot mint a D7 ship-gate receipt: the retained audit source for ${unit} could not be resolved to re-validate its adjudication — the audit is incomplete or tampered.`);
    }
    if (adjudication.errors.length > 0) {
      throw new D7ShipGateError(
        `cannot mint a D7 ship-gate receipt: the retained adjudication for ${unit} is invalid — ${adjudication.errors.join("; ")}`);
    }
    // WP-E23 route proof (optional, non-fail-closed AT MINT when absent — a
    // pre-WP-E23 / hand-off-ingested unit legitimately has no sidecar; the
    // gate's re-verification is what fails closed on a MISMATCH, not on an
    // absence). Hashed exactly like the other four custody artifacts (the
    // retained FILE's bytes, not a field parsed out of it) — the sidecar
    // itself (schema, model, effort, and the spawning session's manifest sha)
    // is the retained evidence being bound.
    const envelopeManifestPath = resolve(auditDir, `jobs/${unit}.receipts/adjudicator.envelope-manifest.json`);
    const envelopeManifestSha256 = existsSync(envelopeManifestPath)
      ? artifactSha256FromText(readFileSync(envelopeManifestPath, "utf8"))
      : undefined;

    custody.push({
      unit,
      primaryDispatchSha256: artifactSha256FromText(primaryDispatchRaw),
      verificationDispatchSha256: artifactSha256FromText(verificationDispatchRaw),
      pairSealSha256: artifactSha256FromText(pairSealRaw),
      adjudicationCanonicalSha256: artifactSha256FromText(adjudicationRaw),
      ...(envelopeManifestSha256 !== undefined ? { envelopeManifestSha256 } : {}),
    });
  }

  const core = buildD7ShipGateReceiptCore({
    bookId,
    auditId: args.auditId,
    round: args.round ?? 1,
    report,
    contentBindings,
    custody,
    raterRoute: args.raterRoute,
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

// ── Custody re-verification (defense-in-depth; reads retained artifacts) ──────

/** Re-verify a receipt's chain-of-custody against the RETAINED audit artifacts on
 *  disk. When the audit directory for `receipt.audit_id` is present, every custody
 *  hash is recomputed from the retained bytes and compared, and every chapter's
 *  blind-pair chain is re-run through `validatePairChain` — a mismatch/error is a
 *  fail-closed BLOCK. When the directory is ABSENT (fresh worktree consuming a
 *  sealed receipt), nothing can be re-verified, so this reports `retained-absent`
 *  honestly: the MINT-TIME pair-chain check is the load-bearing one, and the pure
 *  evaluation still enforces the seal + a non-empty, well-formed custody shape. */
export function verifyRetainedD7Custody(args: {
  repositoryRoot: string;
  receipt: D7ShipGateReceiptV1;
}): D7CustodyVerification {
  // audit_id is interpolated raw into the retained-audit path — refuse an unsafe
  // id BEFORE touching the filesystem (rt-401 round 2, finding A(b)).
  if (!isSafeAuditId(args.receipt.audit_id)) {
    return {
      status: "failed",
      blockers: [`D7.audit_id_invalid: receipt audit_id '${String(args.receipt.audit_id)}' is not a plain slug (path-traversal / injection guard).`],
    };
  }
  const auditDir = resolve(args.repositoryRoot, rubricAuditDirRelPath(args.receipt.audit_id));
  // The batch manifest is the canonical "a real audit was retained here" signal.
  const manifestPath = resolve(auditDir, "batch-manifest.json");
  if (!existsSync(manifestPath)) {
    return { status: "retained-absent", blockers: [] };
  }
  let manifest: RubricAuditBatchManifestV1;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as RubricAuditBatchManifestV1;
  } catch {
    return {
      status: "failed",
      blockers: [`D7.adjudication_invalid: the retained batch manifest for audit '${args.receipt.audit_id}' is unreadable — cannot re-verify the adjudication chain.`],
    };
  }
  const custodyByUnit = new Map(args.receipt.custody.map((entry) => [entry.unit, entry]));
  const blockers: string[] = [];
  for (const chapter of args.receipt.chapters) {
    const unit = chapter.unit;
    const custody = custodyByUnit.get(unit);
    if (custody === undefined) {
      blockers.push(`D7.custody_mismatch: the receipt carries no custody entry for retained-audited unit '${unit}'.`);
      continue;
    }
    try {
      const readArtifact = (relPath: string): string => {
        const abs = resolve(auditDir, relPath);
        if (!existsSync(abs)) {
          throw new D7ShipGateError(`retained audit artifact '${relPath}' for ${unit} is missing`);
        }
        return readFileSync(abs, "utf8");
      };
      const inspectionRaw = readArtifact(`jobs/${unit}.inspection.json`);
      const primaryRaw = readArtifact(`raw/primary/${unit}.json`);
      const verificationRaw = readArtifact(`raw/verification/${unit}.json`);
      const primaryDispatchRaw = readArtifact(`jobs/${unit}.receipts/primary.dispatch.json`);
      const verificationDispatchRaw = readArtifact(`jobs/${unit}.receipts/verification.dispatch.json`);
      const pairSealRaw = readArtifact(`jobs/${unit}.receipts/pair.seal.json`);
      const adjudicationRaw = readArtifact(`raw/adjudicated/${unit}.json`);

      const retained: Record<"primaryDispatchSha256" | "verificationDispatchSha256" | "pairSealSha256" | "adjudicationCanonicalSha256", string> = {
        primaryDispatchSha256: artifactSha256FromText(primaryDispatchRaw),
        verificationDispatchSha256: artifactSha256FromText(verificationDispatchRaw),
        pairSealSha256: artifactSha256FromText(pairSealRaw),
        adjudicationCanonicalSha256: artifactSha256FromText(adjudicationRaw),
      };
      for (const key of Object.keys(retained) as Array<keyof typeof retained>) {
        if (custody[key] !== retained[key]) {
          blockers.push(
            `D7.custody_mismatch: ${unit} ${key} in the receipt (${String(custody[key]).slice(0, 12)}…) does not match the retained artifact (${retained[key].slice(0, 12)}…).`);
        }
      }
      // WP-E23 route proof: ONLY when the receipt's custody entry CLAIMS an
      // envelope-manifest sha (a pre-WP-E23 / hand-off unit legitimately has
      // none — nothing to re-verify there). When claimed, the retained sidecar
      // MUST exist and MUST match — a claim with no retained backing, or one
      // that does not match, is exactly the "manifest sha mismatch" this proof
      // exists to catch (fail closed).
      if (custody.envelopeManifestSha256 !== undefined) {
        const manifestSidecarPath = resolve(auditDir, `jobs/${unit}.receipts/adjudicator.envelope-manifest.json`);
        if (!existsSync(manifestSidecarPath)) {
          blockers.push(
            `D7.envelope_manifest_mismatch: ${unit} claims a rater-route envelope-manifest sha256 but no retained sidecar exists for it.`);
        } else {
          const retainedManifestSha = artifactSha256FromText(readFileSync(manifestSidecarPath, "utf8"));
          if (custody.envelopeManifestSha256 !== retainedManifestSha) {
            blockers.push(
              `D7.envelope_manifest_mismatch: ${unit} envelopeManifestSha256 in the receipt (${custody.envelopeManifestSha256.slice(0, 12)}…) does not match the retained sidecar (${retainedManifestSha.slice(0, 12)}…).`);
          }
        }
      }
      const chainErrors = validatePairChain({
        primary: loadRecord(primaryRaw),
        verification: loadRecord(verificationRaw),
        primaryDispatch: loadRecord(primaryDispatchRaw),
        verificationDispatch: loadRecord(verificationDispatchRaw),
        pairSeal: loadRecord(pairSealRaw),
        inspection: loadRecord(inspectionRaw).value as RubricInspection,
      });
      if (chainErrors.length > 0) {
        blockers.push(`D7.pair_chain_invalid: the retained blind-pair chain for ${unit} does not validate — ${chainErrors.join("; ")}.`);
      }
      // Re-validate the retained ADJUDICATION whose scores set the verdict (rt-401
      // round 2, finding B): a forged PASS receipt pointing at a tamper-inflated
      // adjudication whose custody hash it matched would otherwise re-verify
      // "verified". A tampered adjudication is internally inconsistent → BLOCK.
      const adjudication = validateRetainedAdjudication({
        repositoryRoot: args.repositoryRoot,
        manifest,
        unit,
        adjudicationRaw,
        primaryRaw,
        verificationRaw,
        primaryDispatchRaw,
        verificationDispatchRaw,
        pairSealRaw,
        inspectionRaw,
      });
      if (!adjudication.resolved) {
        blockers.push(`D7.adjudication_invalid: cannot resolve the retained audit source for ${unit} to re-validate its adjudication — the audit is incomplete or tampered.`);
      } else if (adjudication.errors.length > 0) {
        blockers.push(`D7.adjudication_invalid: the retained adjudication for ${unit} does not validate — ${adjudication.errors.join("; ")}.`);
      }
    } catch (error) {
      blockers.push(`D7.pair_chain_invalid: cannot re-verify the retained audit chain for ${unit} — ${(error as Error).message}.`);
    }
  }
  return { status: blockers.length > 0 ? "failed" : "verified", blockers };
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
  /** How the receipt's chain-of-custody was checked against the retained audit
   *  artifacts: `verified` (re-verified on disk), `retained-absent` (no retained
   *  audit dir; seal + custody-shape only — mint-time is load-bearing), or
   *  `failed` (a custody hash / blind-pair chain did not verify). */
  custodyVerified: D7CustodyVerifyStatus;
  /** WP-E23: the D7 rater route's proof status. `null` when no receipt was
   *  evaluated (exempt / missing / corrupt) — there is no route to assess. */
  routeProof: D7ShipGateRouteProofStatus | null;
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
  /** Defense-in-depth re-verification of the receipt's custody against the
   *  retained audit artifacts (from `verifyRetainedD7Custody`). When omitted, no
   *  retained artifacts were re-verified and the decision records
   *  `retained-absent` — the seal + custody-shape checks still hold. */
  custodyVerification?: D7CustodyVerification;
  /** rt FINDING A leg 3 (probe binding): the campaign ultra-acceptance probe sha
   *  (`UltraAcceptanceProbeV1.sidecarSha256`). When supplied, a current-schema
   *  receipt's `rater_route.ultra_probe_sha256` MUST equal it or the route is
   *  invalid (blocks). When omitted, the gate records a visible "probe-unbound"
   *  note — a proven route shape is never silently reported as full proof. */
  expectedUltraProbeSha256?: string;
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
      custodyVerified: "retained-absent",
      routeProof: null,
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
      custodyVerified: "retained-absent",
      routeProof: null,
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
        custodyVerified: "retained-absent",
        routeProof: null,
        reason: "D7 ship gate BLOCKED: a fresh D7 PASS receipt is required and none is present.",
      };
    }
    return {
      decision: "advisory-skip",
      blockers: [],
      verdict: null,
      halt: null,
      custodyVerified: "retained-absent",
      routeProof: null,
      reason: `D7 ship gate: no receipt present; advisory (set ${CHAPTERFLOW_REQUIRE_D7_SHIP_GATE_ENV}=1 to require a sealed PASS bound to the shipped bytes).`,
    };
  }

  // 4. Receipt present — validate integrity, instrument, content binding, verdict.
  const receipt = input.receipt;
  const blockers: string[] = [];

  if (receiptBindingHash(receipt as unknown as Record<string, unknown>) !== receipt.binding_sha256) {
    blockers.push("D7.receipt_tampered: binding_sha256 does not match the receipt payload.");
  }
  // WP-E23: the recognized LEGACY schema version is also accepted here — a
  // receipt sealed under it predates route-proof by honest construction and is
  // not retroactively invalid; `deriveRouteProof` below reports its route as
  // "unproven" (a distinct, visible status), never a silently-proven one.
  if ((receipt.schema_version !== D7_SHIP_GATE_RECEIPT_SCHEMA_VERSION
      && receipt.schema_version !== D7_SHIP_GATE_RECEIPT_LEGACY_SCHEMA_VERSION_V1)
    || receipt.artifact_type !== D7_SHIP_GATE_RECEIPT_ARTIFACT_TYPE
    || receipt.issuer !== D7_SHIP_GATE_RECEIPT_ISSUER) {
    blockers.push("D7.receipt_schema_invalid: receipt schema/artifact_type/issuer is not the D7 ship-gate receipt identity.");
  }
  const routeAssessment = assessRouteProof(receipt, input.expectedUltraProbeSha256);
  const routeProof = routeAssessment.status;
  // A spoof/tamper (a Claude string, a spoofed family, a probe that does not match
  // the campaign's) blocks in BOTH modes; a vestigial-but-authorized proof (rt
  // FINDING A leg 2: current-schema route with no deciding-unit custody binding)
  // blocks ONLY under REQUIRE — advisory keeps the honest note below.
  if (routeAssessment.hardBlock !== null) blockers.push(routeAssessment.hardBlock);
  if (routeAssessment.requireBlock !== null && input.require) blockers.push(routeAssessment.requireBlock);
  if (receipt.instrument?.rubric_version !== RUBRIC_AUDIT_RUBRIC_VERSION
    || !barEquals(receipt.instrument?.bar ?? ({} as RubricAuditBar), RUBRIC_AUDIT_BAR_D7)) {
    blockers.push("D7.instrument_mismatch: receipt rubric version / bar differs from the frozen D7 instrument (RUBRIC_AUDIT_BAR_D7).");
  }
  if (normSlug(receipt.book_id) !== bookId) {
    blockers.push(`D7.book_mismatch: receipt book_id '${receipt.book_id}' does not match the book being promoted '${bookId}'.`);
  }
  // audit_id is a retained-audit path component — an unsafe id is a traversal /
  // injection vector and is refused here too (rt-401 round 2, finding A(b)).
  if (!isSafeAuditId(receipt.audit_id)) {
    blockers.push(`D7.audit_id_invalid: receipt audit_id '${String(receipt.audit_id)}' is not a plain slug (path-traversal / injection guard).`);
  }

  // Chain-of-custody: a receipt minted from nothing (or with a forged/garbage
  // custody block) can never ship. The custody shape is enforced UNCONDITIONALLY
  // (both retained modes); the retained artifacts, when present, are additionally
  // re-verified (custody hashes + blind-pair chains) by the caller and folded in.
  const custodyStatus: D7CustodyVerifyStatus = input.custodyVerification?.status ?? "retained-absent";
  const custody = Array.isArray(receipt.custody) ? receipt.custody : [];
  if (custody.length === 0) {
    blockers.push("D7.custody_empty: the receipt carries no chain-of-custody entries — a D7 receipt must bind the retained rater/adjudication artifacts for every audited chapter (a receipt cannot be minted from nothing).");
  } else {
    const custodyUnits = new Set(custody.map((entry) => entry.unit));
    const chapterUnits = new Set(receipt.chapters.map((chapter) => chapter.unit));
    const sameSet = custodyUnits.size === chapterUnits.size
      && [...chapterUnits].every((unit) => custodyUnits.has(unit));
    if (!sameSet) {
      blockers.push(
        `D7.custody_shape: custody covers {${[...custodyUnits].sort().join(", ")}} but the audited chapters are {${[...chapterUnits].sort().join(", ")}} — every audited chapter needs a custody entry.`);
    }
    for (const entry of custody) {
      const wellFormed = [entry.primaryDispatchSha256, entry.verificationDispatchSha256, entry.pairSealSha256, entry.adjudicationCanonicalSha256]
        .every((hash) => SHA256_RE.test(String(hash ?? "")));
      if (!wellFormed) {
        blockers.push(`D7.custody_shape: custody entry for '${entry.unit}' has a malformed artifact hash (every custody hash must be a lowercase SHA-256 digest).`);
      }
      // WP-E23: envelopeManifestSha256 is OPTIONAL (a pre-WP-E23 / hand-off unit
      // legitimately has none), but when CLAIMED it must be well-formed — a
      // malformed claim is fail-closed here just like the other four hashes.
      if (entry.envelopeManifestSha256 !== undefined && !SHA256_RE.test(entry.envelopeManifestSha256)) {
        blockers.push(`D7.custody_shape: custody entry for '${entry.unit}' has a malformed envelopeManifestSha256 (must be a lowercase SHA-256 digest).`);
      }
    }
  }
  // Defense-in-depth: retained custody/pair-chain/adjudication re-verification
  // (best-effort; no-op when the audit dir is absent). Any mismatch/error is a
  // fail-closed BLOCK.
  if (custodyStatus === "failed") {
    blockers.push(...(input.custodyVerification?.blockers ?? []));
  }
  // FINDING A (rt-401 round 2): REQUIRE mode mandates that the retained rubric-
  // audit evidence be PRESENT at gate time. A receipt whose audit_id has no
  // retained audit dir re-verifies "retained-absent" — with the dir gone, a
  // well-formed-but-fabricated custody block cannot be distinguished from a
  // genuine sealed run, so REQUIRE fails closed. Advisory/default mode preserves
  // the honest retained-absent path (mint-time chain + adjudication validation is
  // the load-bearing check there); the S-tier REQUIRE ship path retains the dir.
  if (custodyStatus === "retained-absent" && input.require) {
    blockers.push(`D7.retained_audit_required: REQUIRE mode mandates the retained rubric-audit evidence be present at gate time, but no retained audit dir was found for audit_id '${receipt.audit_id}'. Retain (or point the gate at) the sealed audit dir, or run in advisory mode.`);
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

  // WP-E23 + rt FINDING A: a route that is not FULLY proven is NEVER silent — it
  // rides visibly in `reason`. This covers the legacy "unproven" gap, the advisory
  // "unbound custody" case (leg 2), and the "probe-unbound" case (leg 3, no
  // campaign probe sha supplied). A hard-invalid route already added its blocker.
  const routeProofNote = routeAssessment.note;

  if (blockers.length > 0) {
    const halt = verdict !== "PASS" ? buildHaltRecord(receipt, bookId) : null;
    return {
      decision: "block",
      blockers,
      verdict,
      halt,
      custodyVerified: custodyStatus,
      routeProof,
      reason: `D7 ship gate BLOCKED: ${blockers.join(" ")}${routeProofNote}`,
    };
  }
  return {
    decision: "pass",
    blockers: [],
    verdict,
    halt: null,
    custodyVerified: custodyStatus,
    routeProof,
    reason: `D7 ship gate PASS: verdict PASS bound to the shipped bytes (book CDS ${receipt.book_cds.toFixed(2)}, min ${receipt.summary.min.toFixed(2)}; custody ${custodyStatus}).${routeProofNote}`,
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
  /** Git repo root — resolves the retained audit dir for custody re-verification. */
  repositoryRoot: string;
  /** Canonical chapters dir override (test seam); defaults to CHAPTERS_DIR. */
  chaptersDir?: string;
  /** rt FINDING A leg 3: the campaign ultra-acceptance probe sha the route must
   *  bind against (optional — omitted keeps the "probe-unbound" note path). */
  expectedUltraProbeSha256?: string;
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

  // Current content + custody re-verification are only needed when a receipt is
  // present (a missing receipt is decided by the require flag; a corrupt one
  // blocks regardless).
  let currentContent: D7CurrentContent | null = null;
  let custodyVerification: D7CustodyVerification | undefined;
  if (receipt !== null) {
    try {
      currentContent = deriveCurrentD7Content({ bookId, chaptersDir: args.chaptersDir });
    } catch {
      currentContent = null;
    }
    custodyVerification = verifyRetainedD7Custody({ repositoryRoot: args.repositoryRoot, receipt });
  }

  return evaluateD7ShipGate({
    bookId,
    candidatePackageBytes: args.candidatePackageBytes,
    shippedPackageBytes,
    receipt,
    receiptCorrupt,
    currentContent,
    custodyVerification,
    expectedUltraProbeSha256: args.expectedUltraProbeSha256,
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
  /** Git repo root — resolves the retained audit dir for custody re-verification. */
  repositoryRoot: string;
  chaptersDir?: string;
  /** rt FINDING A leg 3: the campaign ultra-acceptance probe sha the route must
   *  bind against (optional). */
  expectedUltraProbeSha256?: string;
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
  let custodyVerification: D7CustodyVerification | undefined;
  if (receipt !== null) {
    try {
      currentContent = deriveCurrentD7Content({ bookId, chaptersDir: args.chaptersDir });
    } catch {
      currentContent = null;
    }
    custodyVerification = verifyRetainedD7Custody({ repositoryRoot: args.repositoryRoot, receipt });
  }
  return evaluateD7ShipGate({
    bookId,
    candidatePackageBytes: "",
    shippedPackageBytes: null,
    receipt,
    receiptCorrupt,
    currentContent,
    custodyVerification,
    expectedUltraProbeSha256: args.expectedUltraProbeSha256,
    require: args.require,
  });
}
