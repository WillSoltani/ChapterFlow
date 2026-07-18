/** IMP-24 production/qualification parity and frozen pre-live schedule. Model free. */

import assert from "node:assert/strict";
import { resolve } from "node:path";

import { test } from "./harness.js";
import { hashCanonical } from "../src/contracts/contractUtil.js";
import {
  buildImp24CorpusBundle,
  loadImp24FrozenV2Inputs,
} from "../src/bakeoff/migration/imp24Corpus.js";
import { prepareImp24QualificationCases } from "../src/bakeoff/migration/imp24InstrumentCertification.js";
import {
  IMP24_BASE_MAXIMUM_CALLS,
  IMP24_HARD_MAXIMUM_CALLS,
  IMP24_ROLE_CANDIDATE_ORDER_SHA256,
  IMP24_ROLE_QUALIFICATION_CALL_BUDGET_SHA256,
  buildFrozenRoleQualificationScheduleV3,
  projectPreparedQualificationCasesV3,
} from "../src/bakeoff/migration/roleQualificationRunnerV3.js";
import {
  buildImp24ProductionQualificationParity,
  serializeImp24ProductionQualificationParity,
  validateImp24ProductionQualificationParity,
  verifyImp24ProductionQualificationParity,
} from "../src/bakeoff/migration/imp24ProductionQualificationParity.js";

const REPOSITORY_ROOT = resolve(import.meta.dirname, "../../../../..");
const CONTRACTS_DIR = resolve(
  REPOSITORY_ROOT,
  "scripts/book/prompts/chapterflow-v24-author-pipeline/state/migration-experiments/contracts",
);

test("IMP-24 parity artifact is deterministic, self-hashed, source-bound, and tamper-evident", () => {
  const first = buildImp24ProductionQualificationParity({ repositoryRoot: REPOSITORY_ROOT });
  const second = buildImp24ProductionQualificationParity({ repositoryRoot: REPOSITORY_ROOT });
  assert.deepEqual(first, second);
  assert.deepEqual(validateImp24ProductionQualificationParity(first, { repositoryRoot: REPOSITORY_ROOT }), []);
  assert.equal(verifyImp24ProductionQualificationParity(first), first);
  assert.ok(serializeImp24ProductionQualificationParity(first).endsWith("\n"));
  assert.equal(first.modelCalls, 0);
  assert.equal(first.apiCalls, 0);
  assert.deepEqual(
    first.implementationSources.map((item) => item.relativePath),
    first.implementationSources.map((item) => item.relativePath).sort(),
  );
  for (const lane of ["reader", "source", "quiz"] as const) {
    assert.equal(first.lanes[lane].shared.freshness.symbol, "reviewProtocolFreshnessErrorsV2");
    assert.deepEqual(
      first.lanes[lane].shared.rawProtocol.map((item) => item.symbol),
      ["reviewProtocolFileAccessFailureV2", "reviewProtocolHasProhibitedConductorEchoV2"],
    );
  }

  const selfHashTamper = structuredClone(first);
  selfHashTamper.paritySha256 = "0".repeat(64);
  assert.ok(validateImp24ProductionQualificationParity(selfHashTamper).includes("paritySha256 self-hash mismatch"));

  const sourceTamper = structuredClone(first);
  sourceTamper.implementationSources[0].bytesSha256 = "1".repeat(64);
  assert.ok(validateImp24ProductionQualificationParity(sourceTamper, { repositoryRoot: REPOSITORY_ROOT })
    .some((issue) => issue.includes("self-hash mismatch") || issue.includes("differs from current proved repository")));
});

test("IMP-24 pre-live prepared projection deterministically expands to the exact frozen 464/928 schedule", () => {
  const corpusBundle = buildImp24CorpusBundle(loadImp24FrozenV2Inputs(CONTRACTS_DIR));
  const prepared = prepareImp24QualificationCases({ repositoryRoot: REPOSITORY_ROOT, corpusBundle });
  const projection = projectPreparedQualificationCasesV3(prepared.preparedCases);
  const schedule = buildFrozenRoleQualificationScheduleV3(prepared.preparedCases);
  assert.equal(schedule.length, IMP24_BASE_MAXIMUM_CALLS);
  assert.equal(IMP24_BASE_MAXIMUM_CALLS, 464);
  assert.equal(IMP24_HARD_MAXIMUM_CALLS, 928);
  assert.deepEqual(schedule, buildFrozenRoleQualificationScheduleV3(prepared.preparedCases));
  assert.equal(new Set(schedule.map((entry) => entry.scheduleId)).size, schedule.length);
  assert.equal(schedule.every((entry, ordinal) => entry.ordinal === ordinal), true);
  assert.match(IMP24_ROLE_CANDIDATE_ORDER_SHA256, /^[a-f0-9]{64}$/);
  assert.match(IMP24_ROLE_QUALIFICATION_CALL_BUDGET_SHA256, /^[a-f0-9]{64}$/);
  assert.match(hashCanonical(projection), /^[a-f0-9]{64}$/);
  assert.match(hashCanonical(schedule), /^[a-f0-9]{64}$/);
});
