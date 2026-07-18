/**
 * D7-lite shared core — helpers used by BOTH single-rater D7-lite drivers:
 *
 *   - scripts/screening/run-d7lite-drill.mts    (Stage 0b calibration drill)
 *   - scripts/screening/run-stage1-screening.mts (Stage 1 screening; via stage1Core.mts)
 *
 * Extracted from run-d7lite-drill.mts (refactor recorded in the Stage-1 driver
 * handoff) so the Stage-1 driver can reuse the calibration-only manifest minting
 * and the validated ultra-probe reuse gate WITHOUT duplicating either. The
 * behavior is byte-identical to the drill's original private copies:
 *
 *   - `calibrationOnlyManifest` keeps the drill's exact default `purpose` string
 *     (the manifest sha binds to it — a resumed drill must re-mint identical
 *     bytes against its retained custody);
 *   - `defaultProbeGate` keeps the drill's exact validated-reuse semantics
 *     (isValidUltraProbe — a stale/hand-planted sidecar is re-probed, never
 *     trusted; accepted:false/missing fails the gate) with only the log tag
 *     parametrized.
 *
 * MODEL-FREE at import/typecheck time; `defaultProbeGate` is the only export
 * that can spawn (one live probe, and only when its caller runs live).
 */

import { mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { D7JudgeError, type D7WorkerDispatchMetaV1 } from "../../src/bakeoff/d7Judge.js";
import { assertUltraProbeAccepted, isValidUltraProbe } from "../../src/bakeoff/d7WorkerDispatch.js";
import { runUltraAcceptanceProbe, type UltraAcceptanceProbeV1 } from "../../src/exec/ultraSession.js";
import { resolveD7RaterRoute } from "../../src/orchestrator/modelPolicy.js";
import {
  RUBRIC_AUDIT_BAR_D7,
  RUBRIC_AUDIT_RUBRIC_VERSION,
  RUBRIC_AUDIT_SCHEMA_BATCH,
  RUBRIC_CALIBRATION_REFERENCES,
  RUBRIC_OWNER_RUN_ID,
  type RubricAuditBatchManifestV1,
} from "../../src/bakeoff/migration/rubricAuditInstrument.js";
import type { D7IngestDispatchMetaV1 } from "../../src/bakeoff/migration/rubricAuditHarness.js";
import { hashCanonical } from "../../src/contracts/contractUtil.js";

/** The calibration comparison tolerance — the D7 instrument's OWN ±3.0
 *  (protocol §10.1-P3 uses "its own legacy tolerance"), reused from the
 *  ratified bar, never a second literal. */
export const D7LITE_TOLERANCE = RUBRIC_AUDIT_BAR_D7.calibrationTolerance;

/** The drill's original purpose string — the DEFAULT so a resumed Stage-0b
 *  drill re-mints byte-identical manifests against its retained custody. */
export const D7LITE_DRILL_MANIFEST_PURPOSE =
  "Stage-0b D7-lite calibration drill — single-rater primary session per sealed unit (protocol §10.1-P3)";

// ── Calibration-only audit manifest (the hidden-calibration machinery, reused) ──

/**
 * A calibration-ONLY batch manifest: the exact RubricAuditBatchManifestV1 shape
 * with an empty candidate-chapter list, so resolveAuditUnit takes its
 * CALIBRATION branch (owner-run-compat profile, sealed doc bytes verified
 * against the owner-audited sha at render AND ingest) — the same hidden-
 * calibration path every candidate batch uses, minus any candidate chapter.
 * buildRubricAuditBatch itself requires ≥1 candidate chapter (it builds
 * candidate audits); a calibration-only audit therefore mints its manifest here
 * from the SAME sealed-reference constants, with the same canonical
 * manifestSha256 stamp.
 */
export function calibrationOnlyManifest(
  auditId: string,
  unit: string,
  purpose: string = D7LITE_DRILL_MANIFEST_PURPOSE,
): RubricAuditBatchManifestV1 {
  const ref = RUBRIC_CALIBRATION_REFERENCES.find((r) => r.unit === unit);
  if (ref === undefined) {
    throw new Error(`unknown calibration unit '${unit}' — must be one of the sealed owner-adjudicated references`);
  }
  const core: Omit<RubricAuditBatchManifestV1, "manifestSha256"> = {
    schema: RUBRIC_AUDIT_SCHEMA_BATCH,
    auditId,
    purpose,
    rubricVersion: RUBRIC_AUDIT_RUBRIC_VERSION,
    bar: RUBRIC_AUDIT_BAR_D7,
    calibration: {
      unit: ref.unit,
      docRelPath: ref.docRelPath,
      docSha256: ref.docSha256,
      ownerRunId: RUBRIC_OWNER_RUN_ID,
      expectedChapterDiagnostic: ref.expectedChapterDiagnostic,
    },
    chapters: [],
  };
  return { ...core, manifestSha256: hashCanonical(core) };
}

// ── Probe gate (campaign sidecar reuse; fail-closed) ────────────────────────────

export type D7LiteProbeGateResult =
  | { ok: true; sidecarSha256: string; reused: boolean; sessionsSpent: 0 | 1 }
  | { ok: false; detail: string; sessionsSpent: 0 | 1 };

export function readUltraProbeSidecar(probeDir: string): UltraAcceptanceProbeV1 | null {
  try {
    return JSON.parse(readFileSync(resolve(probeDir, "ultra-acceptance-probe.json"), "utf8")) as UltraAcceptanceProbeV1;
  } catch {
    return null;
  }
}

/**
 * Consult the campaign ultra-acceptance probe BEFORE the first rating spawn.
 * The campaign's accepted sidecar (state/model-bakeoffs/_campaign/ultra-acceptance/)
 * is REUSED only when it is a VALID proof for THIS route (isValidUltraProbe:
 * schema/effort/model AND a recomputing self-hash — a hand-planted or
 * stale-model sidecar is treated as absent and re-probed, never trusted).
 * Otherwise ONE live probe runs (1 session against the caller's cap). A
 * missing/invalid/accepted:false result fails the gate — no rating session ever
 * spawns at an unproven ultra token.
 */
export async function defaultProbeGate(
  probeDir: string,
  log: (m: string) => void,
  tag = "[d7lite]",
): Promise<D7LiteProbeGateResult> {
  let probe = readUltraProbeSidecar(probeDir);
  let sessionsSpent: 0 | 1 = 0;
  if (probe !== null && probe.accepted && isValidUltraProbe(probe)) {
    log(`${tag}   ultra-acceptance: reusing valid accepted probe (${probe.probedAt}) at ${probeDir}`);
  } else {
    if (probe !== null && !isValidUltraProbe(probe)) {
      log(`${tag}   ultra-acceptance: existing sidecar is NOT a trustworthy proof for this route — treating it as absent and re-probing.`);
    }
    log(`${tag}   ultra-acceptance: running the probe once (installed CLI must accept model_reasoning_effort=ultra)…`);
    mkdirSync(probeDir, { recursive: true });
    probe = await runUltraAcceptanceProbe({ route: resolveD7RaterRoute(), probeDir });
    sessionsSpent = 1;
    log(`${tag}   ultra-acceptance: accepted=${probe.accepted} — ${probe.detail.slice(0, 200)}`);
  }
  try {
    assertUltraProbeAccepted(probe);
  } catch (err) {
    if (err instanceof D7JudgeError) return { ok: false, detail: err.message, sessionsSpent };
    throw err;
  }
  return { ok: true, sidecarSha256: probe.sidecarSha256, reused: sessionsSpent === 0, sessionsSpent };
}

// ── Dispatch-meta → ingest-meta mapping (shared verbatim) ───────────────────────

export function toIngestMeta(meta: D7WorkerDispatchMetaV1 | undefined): D7IngestDispatchMetaV1 | undefined {
  if (meta === undefined) return undefined;
  return {
    model: meta.model,
    effort: meta.effort,
    ...(meta.sessionKind !== undefined ? { sessionKind: meta.sessionKind } : {}),
    ...(meta.attemptIndex !== undefined && meta.attemptIndex !== null ? { attemptIndex: meta.attemptIndex } : {}),
  };
}
