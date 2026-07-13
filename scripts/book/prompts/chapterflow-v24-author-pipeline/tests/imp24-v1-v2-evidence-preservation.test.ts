import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { test } from "./harness.js";
import { PIPELINE_DIR } from "../src/bakeoff/paths.js";
import {
  IMP24_LEGACY_EVIDENCE_CLOSURE_SCHEMA,
  IMP24_LEGACY_EVIDENCE_IDENTITIES,
  IMP24_ROLE_QUALIFICATION_ID,
  assertImp24LegacyEvidencePreservation,
  materializeImp24LegacyEvidenceClosure,
} from "../src/bakeoff/migration/imp24Corpus.js";

const REPOSITORY_ROOT = resolve(PIPELINE_DIR, "../../../..");

test("IMP-24 preserves exact V1/V2 git-tree identities and records both as closed/non-resumable", () => {
  const closure = assertImp24LegacyEvidencePreservation(REPOSITORY_ROOT);
  assert.equal(closure.schema, IMP24_LEGACY_EVIDENCE_CLOSURE_SCHEMA);
  assert.equal(closure.status, "PRESERVED_CLOSED_NON_RESUMABLE");
  assert.equal(closure.successorExperimentId, IMP24_ROLE_QUALIFICATION_ID);
  assert.equal(closure.identities.length, 2);
  for (const identity of closure.identities) {
    const expected = identity.experimentId.endsWith("v1")
      ? IMP24_LEGACY_EVIDENCE_IDENTITIES.v1
      : IMP24_LEGACY_EVIDENCE_IDENTITIES.v2;
    assert.equal(identity.gitTreeId, expected.gitTreeId);
    assert.equal(identity.lsTreeSha256, expected.lsTreeSha256);
    assert.equal(identity.invalidationDecision, expected.invalidationDecision);
    assert.equal(identity.holdoutStarted, false);
    assert.equal(identity.resumable, false);
    assert.equal(identity.attestable, false);
    assert.equal(identity.reinterpretable, false);
  }
  assert.match(closure.closureSha256, /^sha256:[a-f0-9]{64}$/);
});
test("IMP-24 legacy closure materialization is deterministic and additive", () => {
  const output = resolve(mkdtempSync(resolve(tmpdir(), "imp24-legacy-closure-")), "legacy-v1-v2-evidence-closure.json");
  const first = materializeImp24LegacyEvidenceClosure(REPOSITORY_ROOT, output);
  const firstBytes = readFileSync(output, "utf8");
  const second = materializeImp24LegacyEvidenceClosure(REPOSITORY_ROOT, output);
  const secondBytes = readFileSync(output, "utf8");
  assert.deepEqual(second, first);
  assert.equal(secondBytes, firstBytes);
  assert.ok(firstBytes.endsWith("\n"));
  assert.ok(!firstBytes.includes("attestationWritten\": true"));
});
