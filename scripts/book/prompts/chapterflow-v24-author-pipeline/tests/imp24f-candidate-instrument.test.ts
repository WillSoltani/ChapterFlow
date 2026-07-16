/** V25 recovery — historical vs active-candidate instrument identity.
 *
 * Failure classes pinned here (from the 2026-07-15 recovery):
 *  1. A retained seal of a CLOSED generation being validated against current
 *     checkout bytes (it can never match again after an authorized successor).
 *  2. Historical replay stamping current-checkout prompt hashes onto retained
 *     V3 evidence (certification binding mismatch).
 *  3. A successor qualifying itself with predecessor results — the candidate
 *     manifest must pin `mayQualifySuccessor: false` and a fresh identity.
 */

import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";

import { hashCanonical } from "../src/contracts/contractUtil.js";
import { PIPELINE_DIR } from "../src/bakeoff/paths.js";
import {
  materializeForwardProductionInstrumentSeal,
  verifyHistoricalForwardProductionInstrumentSeal,
  verifyRetainedForwardProductionInstrumentSeal,
} from "../src/orchestrator/forwardProductionInstrumentSeal.js";
import { campaignInstrumentChecksEnabled } from "../src/lib/campaignInstrumentChecks.js";
import {
  IMP24_CERTIFICATION_ARTIFACT_PATHS,
  loadRetainedImp24RolePromptSourceHashes,
} from "../src/bakeoff/migration/imp24InstrumentCertification.js";
import {
  IMP24F_CANDIDATE_ARTIFACT_PATHS,
  IMP24F_CANDIDATE_INSTRUMENT_GENERATION,
  IMP24F_CANDIDATE_INSTRUMENT_MANIFEST_SCHEMA,
  validateImp24fCandidateInstrumentManifest,
  verifyHistoricalImp24InstrumentIdentity,
  verifyImp24fCandidateInstrument,
  type Imp24fCandidateInstrumentManifestV1,
} from "../src/bakeoff/migration/imp24fCandidateInstrument.js";
import { test } from "./harness.js";

const REPOSITORY_ROOT = resolve(PIPELINE_DIR, "../../../..");
const SHA = "a".repeat(64);

function fixtureInstrumentTree(root: string): string {
  const pipelineRel = "scripts/book/prompts/chapterflow-v24-author-pipeline";
  for (const relativePath of [
    `${pipelineRel}/src/index.ts`,
    `${pipelineRel}/config/example.json`,
    `${pipelineRel}/state/migration-experiments/contracts/schemas/example.schema.json`,
    `${pipelineRel}/package.json`,
    `${pipelineRel}/package-lock.json`,
    ".agents/skills/chapterflow-book-evaluator/references/rubric-v2.md",
    ".agents/skills/chapterflow-book-evaluator/references/book-rater-prompt.md",
    ".agents/skills/chapterflow-book-evaluator/references/scoring-protocol.md",
    ".agents/skills/chapterflow-book-evaluator/references/book-evaluation.schema.json",
    ".agents/skills/chapterflow-book-evaluator/references/adjudication-protocol.md",
    ".agents/skills/chapterflow-book-evaluator/references/adjudicated-book.schema.json",
  ]) {
    const path = resolve(root, relativePath);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${relativePath}\n`);
  }
  return resolve(root, `${pipelineRel}/src/index.ts`);
}

test("historical seal verification proves retained integrity WITHOUT comparing to current bytes", () => {
  const root = mkdtempSync(resolve(tmpdir(), "imp24f-historical-seal-"));
  const outputPath = resolve(root, "retained", "forward-production-instrument-seal.json");
  try {
    const mutableSource = fixtureInstrumentTree(root);
    const minted = materializeForwardProductionInstrumentSeal({ repositoryRoot: root, outputPath, write: true });

    // An authorized successor changes instrument bytes…
    writeFileSync(mutableSource, "export const successor = true;\n");

    // …so the current-bytes drift comparison (a CLOSED campaign instrument,
    // ledger L-16) refuses the retained seal ONLY under the campaign opt-in. By
    // default verifyRetained is retained-integrity only and never reads the
    // checkout, so it still proves the (as-minted) retained seal whole.
    if (campaignInstrumentChecksEnabled()) {
      assert.throws(() => verifyRetainedForwardProductionInstrumentSeal({ repositoryRoot: root, outputPath }),
        /bytes drifted/);
    } else {
      const retained = verifyRetainedForwardProductionInstrumentSeal({ repositoryRoot: root, outputPath });
      assert.equal(retained.verified, true);
      assert.equal(retained.sealSha256, minted.sealSha256);
    }

    // …while HISTORICAL verification still proves the retained artifact whole.
    const historical = verifyHistoricalForwardProductionInstrumentSeal({
      outputPath,
      expectedSealSha256: minted.sealSha256,
    });
    assert.equal(historical.verified, true);
    assert.equal(historical.comparedToCurrentBytes, false);
    assert.equal(historical.sealSha256, minted.sealSha256);
    assert.equal(historical.modelCalls, 0);
    assert.equal(historical.apiCalls, 0);

    // A wrong recorded-binding pin fails closed.
    assert.throws(() => verifyHistoricalForwardProductionInstrumentSeal({
      outputPath,
      expectedSealSha256: "b".repeat(64),
    }), /recorded binding/);

    // Byte tampering breaks the self-hash.
    const tampered = JSON.parse(readFileSync(outputPath, "utf8")) as { files: Array<{ bytesSha256: string }> };
    tampered.files[0].bytesSha256 = "0".repeat(64);
    writeFileSync(outputPath, `${JSON.stringify(tampered)}\n`);
    assert.throws(() => verifyHistoricalForwardProductionInstrumentSeal({ outputPath }), /self hash mismatch/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

function plausibleManifest(): Imp24fCandidateInstrumentManifestV1 {
  const core = {
    schema: IMP24F_CANDIDATE_INSTRUMENT_MANIFEST_SCHEMA,
    protocolId: "s16-forward-role-qualification-v3-envelope",
    instrumentGeneration: IMP24F_CANDIDATE_INSTRUMENT_GENERATION,
    candidate: {
      sealSha256: SHA,
      certificationSha256: SHA,
      promptBundleSha256: SHA,
      schemaBundleSha256: SHA,
      thresholdsSha256: SHA,
      corpusBundleSha256: `sha256:${SHA}`,
      productionQualificationParitySha256: SHA,
      scorerSha256: SHA,
    },
    sharedFrozenInputs: {
      corpusBundlePath: IMP24_CERTIFICATION_ARTIFACT_PATHS.corpusBundle,
      thresholdsPath: IMP24_CERTIFICATION_ARTIFACT_PATHS.thresholds,
    },
    predecessor: {
      experimentId: "s16-forward-role-qualification-v3-envelope-final",
      certificationSha256: "b".repeat(64),
      sealSha256: "c".repeat(64),
      disposition: "ROLE_SET_NOT_READY",
      superseded: true,
      mayQualifySuccessor: false,
    },
    standingBlocker: "BLOCKED_NEEDS_INDEPENDENT_GOLD",
    liveEvidence: { modelCalls: 0, apiCalls: 0, holdoutCalls: 0, pilotCalls: 0 },
  };
  return { ...core, manifestSha256: hashCanonical(core) } as Imp24fCandidateInstrumentManifestV1;
}

test("candidate manifest fails closed on qualification leakage, blocker erasure, live evidence, and tampering", () => {
  assert.deepEqual(validateImp24fCandidateInstrumentManifest(plausibleManifest()), []);

  const leak = plausibleManifest() as unknown as Record<string, Record<string, unknown>>;
  leak.predecessor.mayQualifySuccessor = true;
  assert.ok(validateImp24fCandidateInstrumentManifest(leak).some((issue) => issue.includes("mayQualifySuccessor")),
    "historical results must never qualify a successor");

  const unsuperseded = plausibleManifest() as unknown as Record<string, Record<string, unknown>>;
  unsuperseded.predecessor.superseded = false;
  assert.ok(validateImp24fCandidateInstrumentManifest(unsuperseded).some((issue) => issue.includes("superseded")));

  const blockerless = plausibleManifest() as unknown as Record<string, unknown>;
  blockerless.standingBlocker = "READY";
  assert.ok(validateImp24fCandidateInstrumentManifest(blockerless)
    .some((issue) => issue.includes("independent-reader-gold")),
  "the BLOCKED_NEEDS_INDEPENDENT_GOLD gate must remain explicit");

  const livened = plausibleManifest() as unknown as Record<string, Record<string, unknown>>;
  livened.liveEvidence.holdoutCalls = 1;
  assert.ok(validateImp24fCandidateInstrumentManifest(livened).some((issue) => issue.includes("zero live evidence")));

  const tamper = plausibleManifest() as unknown as Record<string, Record<string, unknown>>;
  tamper.candidate.sealSha256 = "d".repeat(64);
  assert.ok(validateImp24fCandidateInstrumentManifest(tamper).some((issue) => issue.includes("self-hash")));
});

test("retained prompt-source hashes reproduce the retained certification and reject a mismatched binding", () => {
  const binding = JSON.parse(readFileSync(
    resolve(REPOSITORY_ROOT, IMP24_CERTIFICATION_ARTIFACT_PATHS.certificationBinding), "utf8",
  )) as { promptBundleSha256: string };
  const hashes = loadRetainedImp24RolePromptSourceHashes({
    repositoryRoot: REPOSITORY_ROOT,
    certification: binding,
  });
  assert.equal(hashCanonical(hashes), binding.promptBundleSha256,
    "retained sidecars must reproduce the retained aggregate prompt bundle hash");
  assert.throws(() => loadRetainedImp24RolePromptSourceHashes({
    repositoryRoot: REPOSITORY_ROOT,
    certification: { promptBundleSha256: "0".repeat(64) },
  }), /do not reproduce/);
});

test("committed candidate generation binds current bytes with a fresh identity over the closed predecessor", () => {
  assert.ok(existsSync(resolve(REPOSITORY_ROOT, IMP24F_CANDIDATE_ARTIFACT_PATHS.manifest)),
    "the imp24f candidate manifest must be committed (minted after the last instrument byte change)");
  const verified = verifyImp24fCandidateInstrument({ repositoryRoot: REPOSITORY_ROOT });
  assert.equal(verified.verified, true);
  assert.equal(verified.comparedToCurrentBytes, true);
  assert.equal(verified.modelCalls, 0);
  assert.equal(verified.apiCalls, 0);

  const predecessor = verifyHistoricalImp24InstrumentIdentity({ repositoryRoot: REPOSITORY_ROOT });
  assert.equal(predecessor.disposition, "ROLE_SET_NOT_READY");
  assert.equal(predecessor.mayQualifySuccessor, false);
  assert.notEqual(verified.candidateCertificationSha256, predecessor.certificationSha256,
    "the candidate certification must be a fresh identity");
  assert.equal(verified.predecessorCertificationSha256, predecessor.certificationSha256);

  const manifest = JSON.parse(readFileSync(
    resolve(REPOSITORY_ROOT, IMP24F_CANDIDATE_ARTIFACT_PATHS.manifest), "utf8",
  )) as Imp24fCandidateInstrumentManifestV1;
  assert.equal(manifest.standingBlocker, "BLOCKED_NEEDS_INDEPENDENT_GOLD");
  assert.deepEqual(manifest.liveEvidence, { modelCalls: 0, apiCalls: 0, holdoutCalls: 0, pilotCalls: 0 });
});
