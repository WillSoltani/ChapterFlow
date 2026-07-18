import assert from "node:assert/strict";
import { resolve } from "node:path";

import { test } from "./harness.js";
import { PIPELINE_DIR } from "../src/bakeoff/paths.js";
import {
  buildImp22SourceCorpus,
  type Imp22SourceCorpusCaseV2,
} from "../src/bakeoff/migration/sourceCorpusBuilder.js";
import {
  SPLIT_LANE_CORPUS_CONFIG_SCHEMA,
  type SplitLaneCorpusConfigV1,
} from "../src/bakeoff/migration/reviewLaneTypes.js";
import { sourcePacketHash } from "../src/compiler/sourcePacket.js";
import { sourceUsePlanHash, validateSourceUsePlan } from "../src/contracts/sourceUsePlan.js";
import { sha256Hex } from "../src/contracts/contractUtil.js";
import { semanticSourceHash } from "../src/source/sourceIntegrity.js";

const CONTRACTS = resolve(PIPELINE_DIR, "state", "migration-experiments", "contracts");
const BOOK_PACKAGES = resolve(PIPELINE_DIR, "../../../..", "book-packages");

function config(over: Partial<SplitLaneCorpusConfigV1> = {}): SplitLaneCorpusConfigV1 {
  return {
    schema: SPLIT_LANE_CORPUS_CONFIG_SCHEMA,
    role: "source",
    sourceRoots: { bookPackagesDir: BOOK_PACKAGES },
    mutationSpecPath: resolve(CONTRACTS, "imp22-source-corpus-spec.json"),
    cleanBaseScoreLedgerPath: resolve(CONTRACTS, "clean-base-score-ledger.v1.json"),
    excludedCandidateBookIds: ["start-with-why", "radical-candor", "the-gifts-of-imperfection"],
    minRenderBytes: 8000,
    ...over,
  };
}

function allCases(result: ReturnType<typeof buildImp22SourceCorpus>): Imp22SourceCorpusCaseV2[] {
  return [
    ...result.corpus.partitions.calibration.cases,
    ...result.corpus.partitions.holdout.cases,
  ];
}

test("IMP-22 source corpus: exact 10-case calibration and 40-case holdout cover five clean/defect families", () => {
  const result = buildImp22SourceCorpus(config());
  assert.equal(result.corpus.ownerApprovedForDevelopmentBakeoff, true);
  assert.equal(result.corpus.independentHumanRater, false);
  assert.equal(result.corpus.partitions.calibration.cases.length, 10);
  assert.equal(result.corpus.partitions.holdout.cases.length, 40);
  for (const partition of ["calibration", "holdout"] as const) {
    assert.deepEqual(
      result.corpus.partitions[partition].generatedComposition,
      result.corpus.partitions[partition].expectedComposition,
      `${partition} composition is exact, not a minimum`,
    );
  }
  assert.equal(new Set(allCases(result).map((c) => c.caseId)).size, 50, "no case silently duplicated");
  assert.equal(
    result.corpus.partitions.holdout.cases.filter((c) => c.expected.expectedCategory === "source_contradiction").length,
    2,
    "the attribution family includes two explicit source contradictions for the zero-miss threshold",
  );
});

test("IMP-22 source corpus: every pair changes only chapterUnit and binds recomputed packet/plan/sidecar hashes", () => {
  const result = buildImp22SourceCorpus(config());
  const pairs = new Map<string, Imp22SourceCorpusCaseV2[]>();
  for (const c of allCases(result)) {
    const list = pairs.get(c.provenance.pairKey) ?? [];
    list.push(c);
    pairs.set(c.provenance.pairKey, list);

    assert.equal(c.evidence.provenanceHashes.chapterContentSha256, sha256Hex(c.evidence.chapterUnit));
    assert.equal(c.evidence.provenanceHashes.sourcePacketSha256, sourcePacketHash(c.evidence.sourcePacket));
    assert.equal(c.evidence.provenanceHashes.sourceUsePlanSha256, sourceUsePlanHash(c.evidence.sourceUsePlan));
    assert.equal(c.evidence.provenanceHashes.sidecarSha256, semanticSourceHash(c.evidence.sidecar));
    assert.deepEqual(validateSourceUsePlan(c.evidence.sourceUsePlan), []);
    assert.ok(c.evidence.anchorIds.every((id) => c.evidence.sourceUsePlanUnit.anchorIds.includes(id)));
    assert.ok(c.evidence.goldChapterEvidenceSpans.every((span) => c.evidence.chapterUnit.includes(span)));
  }

  assert.equal(pairs.size, 25, "five base facts × five families");
  for (const [pairKey, cases] of pairs) {
    assert.equal(cases.length, 2, `${pairKey} has one clean and one defect`);
    const clean = cases.find((c) => c.pairSide === "clean");
    const defect = cases.find((c) => c.pairSide === "defect");
    assert.ok(clean && defect);
    assert.equal(clean.mutation.protectedProjectionSha256, defect.mutation.protectedProjectionSha256);
    assert.equal(clean.evidence.protectedProjectionSha256, defect.evidence.protectedProjectionSha256);
    assert.equal(clean.mutation.declaredMutationPaths.join(","), "chapterUnit");
    assert.notEqual(clean.evidence.chapterUnit, defect.evidence.chapterUnit);
    assert.equal(clean.expected.goldResult, "PASS");
    assert.equal(defect.expected.goldResult, "BLOCK");
  }
});

test("IMP-22 source corpus: output is byte-reproducible, portable, and candidate overlap fails closed", () => {
  const first = buildImp22SourceCorpus(config());
  const second = buildImp22SourceCorpus(config());
  assert.equal(first.corpusBytes, second.corpusBytes);
  assert.equal(first.corpus.substantiveCorpusSha256, second.corpus.substantiveCorpusSha256);
  assert.doesNotMatch(first.corpusBytes, /\/(?:Users|private\/tmp)\//);

  assert.throws(
    () => buildImp22SourceCorpus(config({
      excludedCandidateBookIds: ["digital-minimalism", "start-with-why", "radical-candor", "the-gifts-of-imperfection"],
    })),
    /overlaps reserved candidate book/,
  );
  assert.throws(
    () => buildImp22SourceCorpus(config({ mutationSpecPath: resolve(CONTRACTS, "missing-imp22-source-spec.json") })),
    /missing|does not exist|unreadable/i,
  );
  assert.throws(
    () => buildImp22SourceCorpus(config({ minRenderBytes: 1 })),
    /minRenderBytes does not match the frozen spec/,
  );
});
