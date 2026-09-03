/**
 * Durable, model-free materialization of the frozen IMP-22 pilot and gold inputs.
 *
 * The historical package is used only for gold book/chapter identities.  All
 * author-facing packets, plans, sidecars, anchors, and briefs are rebuilt by
 * forwardInputFreeze and written below the two new experiment roots.  No prior
 * chapter prose, canonical chapter path, provider, or publish capability is in
 * this dependency surface.
 */

import { existsSync, readFileSync } from "node:fs";
import { basename, resolve } from "node:path";

import { PIPELINE_DIR } from "../bakeoff/paths.js";
import { canonicalJson } from "../lib/canonicalJson.js";
import { writeFileAtomic } from "../lib/atomicWrite.js";
import {
  assertForwardInputFreezeFresh,
  freezeForwardInputs,
  inventoryGoldBookInput,
  inventoryPilotBookInput,
  materializeForwardBookInput,
  verifyFrozenInputFiles,
  type ForwardBookInputV1,
  type ForwardInputFreezeV1,
  type FrozenForwardInputFileV1,
  type MaterializedForwardBookInputV1,
} from "./forwardInputFreeze.js";

export const IMP22_FORWARD_INPUT_MATERIALIZATION_SCHEMA =
  "imp22-forward-input-materialization-v1" as const;
export const IMP22_FORWARD_INPUT_FROZEN_AT = "2026-07-12T12:00:00.000Z" as const;

/**
 * RE-DERIVED for the 1C + wave-1 MERGE. Two packet-compiler changes land together here, and each
 * one on its own moves exactly the hashes below:
 *
 *   R-116 (package 1C, the dealing redesign) — properNounTokens() gained a sentence-initial filter:
 *     a capitalized run that starts a sentence has its opening word stripped (that word is
 *     capitalized by grammar), and a run that is ONLY its opener is dropped unless the same token
 *     also occurs mid-sentence. That changes facts[].groundedEntities.
 *   R-055 (wave-1 source-ingestion) — every compiled source packet gains `chapterContext`
 *     (the chapter's focus, coreClaim, hardEdge and keyClaims, which the packet used to discard).
 *
 * Only the GOLD numbers move, and only the three a packet-compiler change can move. The GOLD input
 * is inventoried by COMPILING its sidecars (inventoryGoldBookInput → compileSourcePacketFromSidecar),
 * so the packet compiler is part of this identity by design — which is the pin doing its job. The
 * two PILOT hashes are unchanged and left byte-identical below: those books are inventoried from
 * source packets already on disk, not recompiled, which is itself the check that this re-derivation
 * is scoped to the compiler change and nothing else.
 *
 *   gold                          8ce0d86f… (1C) / 0a132dcf… (main) → 192076ed…
 *   goldStratumAssignmentSha256   f603c786… (1C) / 6b14de02… (main) → f24ae007…
 *   freezeSha256                  3f6fc52b… (1C) / 63483336… (main) → c4afc6f1…
 *
 * The chapter → stratum ASSIGNMENT ITSELF is byte-identical across all of this — verified by
 * printing it: 1:example-heavy 2:abstract-conceptual 3:example-heavy 4:research-heavy
 * 5:causal-quiz-sensitive 6:causal-quiz-sensitive 7:abstract-conceptual 8:example-heavy
 * 9:research-heavy 10:abstract-conceptual 11:research-heavy 12:research-heavy
 * 13:causal-quiz-sensitive. Only the packet digests recorded alongside it moved, so no experiment
 * stratum changed hands. That invariance is not left to reasoning: every stratum score is derived
 * from counts over `packet.facts` plus conceptual tokens read off the SIDECAR, and
 * tests/research-rules.test.ts proves `deriveForwardChapterFeatures` returns identical features for
 * the same packet with and without `chapterContext`.
 *
 * Pre-1C, pre-wave-1 values (both branches' shared ancestor):
 *   freezeSha256                 ceb196d757f3d9604f2957cbd3e4167a66f1cad083ed475c21be274bfe97160d
 *   gold                         27c51117c58024aaecbbc3a7472cc45aba50c01c9f3b19bbc7320e5d5b68cf9a
 *   goldStratumAssignmentSha256  2931f5eeeca232c081dfa31308d1288e1845cf2ae3eaa84aebef34050f688e73
 *
 * A future drift in any of these again means either an intended compiler change (re-derive with the
 * same kind of note) or a real regression.
 */
export const IMP22_FORWARD_INPUT_EXPECTED_HASHES = Object.freeze({
  freezeSha256: "c4afc6f13948e2a90e0fc24cb4c0310e55ab2e322df332f31b6f9a70a6e4e570",
  pilot: Object.freeze({
    "radical-candor": "a34ebc918ba5cceb23a5635217c884fab989ad76c290e8eacf0f62da1fde549e",
    "start-with-why": "1bdb9d78ff78f3d402e2efb137d94dbe797ad36e50a988b84c608cc46450ec4e",
  }),
  gold: "192076ed3e5154985b90f9f7cdc24250f7707f6b61c37cdfd4c5e640d6d60104",
  goldStratumAssignmentSha256: "f24ae007d18dda7db4e3ab9cbd76ebe6be6437376c27f20c3add7945f4ed62e5",
} as const);

const REPO_ROOT = resolve(PIPELINE_DIR, "../../../..");
const CONTRACT_ROOT = resolve(PIPELINE_DIR, "state/migration-experiments/contracts");
const DEFAULT_STATE_ROOT = resolve(PIPELINE_DIR, "state/migration-experiments");
const PILOT_EXPERIMENT_ID = "s16-forward-sol-pilot-v1";
const GOLD_EXPERIMENT_ID = "s16-forward-sol-gold-book-v1";

type SourceInputLocation = {
  bookId: string;
  sourceArchiveId: string;
  packetDir?: string;
  sidecarDir: string;
  packagePath?: string;
};

const PILOT_LOCATIONS: readonly SourceInputLocation[] = Object.freeze([
  {
    bookId: "radical-candor",
    sourceArchiveId: "20260709T191414229Z-5258177d-971e-472b-b1ca-476d903c8a03",
    packetDir: resolve(PIPELINE_DIR, "state/books/radical-candor/runs/v23-current/source-packets"),
    sidecarDir: resolve(
      DEFAULT_STATE_ROOT,
      PILOT_EXPERIMENT_ID,
      "inputs/radical-candor/source-archive/radical-candor",
    ),
  },
  {
    bookId: "start-with-why",
    sourceArchiveId: "20260704T125509997Z-823c4c45-75d0-4e18-8d33-ba66548d6e21",
    packetDir: resolve(PIPELINE_DIR, "state/books/start-with-why/runs/v23-current/source-packets"),
    sidecarDir: resolve(
      DEFAULT_STATE_ROOT,
      PILOT_EXPERIMENT_ID,
      "inputs/start-with-why/source-archive/start-with-why",
    ),
  },
]);

const GOLD_LOCATION: SourceInputLocation = Object.freeze({
  bookId: "the-gifts-of-imperfection",
  sourceArchiveId: "20260614-194740",
  packagePath: resolve(REPO_ROOT, "book-packages/the-gifts-of-imperfection.v21.json"),
  sidecarDir: resolve(
    DEFAULT_STATE_ROOT,
    GOLD_EXPERIMENT_ID,
    "inputs/the-gifts-of-imperfection/source-archive/the-gifts-of-imperfection",
  ),
});

export class Imp22ForwardInputMaterializationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Imp22ForwardInputMaterializationError";
  }
}

function requireCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Imp22ForwardInputMaterializationError(message);
}

function stableJson(value: unknown): string {
  return `${canonicalJson(value)}\n`;
}

function writeStableJson(path: string, value: unknown): void {
  writeFileAtomic(path, stableJson(value));
}

function readJson(path: string): unknown {
  requireCondition(existsSync(path), `required frozen corpus is missing: ${path}`);
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Imp22ForwardInputMaterializationError(
      `required frozen corpus is not JSON (${basename(path)}): ${(error as Error).message}`,
    );
  }
}

function qualificationBookIds(): string[] {
  const ids = new Set<string>();
  for (const role of ["reader", "source", "quiz"] as const) {
    const corpus = readJson(resolve(CONTRACT_ROOT, `${role}-corpus.imp22-v2.json`)) as {
      partitions?: { calibration?: { cases?: unknown[] }; holdout?: { cases?: unknown[] } };
    };
    const cases = [
      ...(corpus.partitions?.calibration?.cases ?? []),
      ...(corpus.partitions?.holdout?.cases ?? []),
    ];
    for (const item of cases) {
      const value = item as { baseBookId?: unknown; bookId?: unknown };
      const id = typeof value.baseBookId === "string"
        ? value.baseBookId
        : typeof value.bookId === "string"
          ? value.bookId
          : null;
      requireCondition(id !== null && id.length > 0, `${role} corpus case has no explicit source book identity`);
      ids.add(id);
    }
  }
  return [...ids].sort((a, b) => a.localeCompare(b));
}

function inventoryPilotInputs(): ForwardBookInputV1[] {
  return PILOT_LOCATIONS.map((location) => {
    requireCondition(typeof location.packetDir === "string", `${location.bookId}: packet directory is missing`);
    return inventoryPilotBookInput({
      bookId: location.bookId,
      packetDir: location.packetDir,
      sidecarDir: location.sidecarDir,
      sourceArchiveId: location.sourceArchiveId,
    });
  });
}

function sourcePathFor(file: FrozenForwardInputFileV1): string {
  const parts = file.relativePath.split("/");
  const bookId = parts[0];
  const sourceArchiveId = file.root === "package-archive" ? null : parts[1];
  const fileName = file.root === "package-archive" ? parts[1] : parts[2];
  requireCondition(!!bookId && !!fileName, `malformed frozen source coordinate: ${file.root}/${file.relativePath}`);
  const location = [...PILOT_LOCATIONS, GOLD_LOCATION].find((candidate) => candidate.bookId === bookId);
  requireCondition(!!location, `no authoritative source root for ${file.root}/${file.relativePath}`);
  if (file.root === "packet-archive") {
    requireCondition(sourceArchiveId === location.sourceArchiveId, `${bookId}: packet archive identity drift`);
    requireCondition(typeof location.packetDir === "string", `${bookId}: no packet archive root`);
    return resolve(location.packetDir, fileName);
  }
  if (file.root === "source-archive") {
    requireCondition(sourceArchiveId === location.sourceArchiveId, `${bookId}: source archive identity drift`);
    return resolve(location.sidecarDir, fileName);
  }
  requireCondition(typeof location.packagePath === "string", `${bookId}: no package archive root`);
  requireCondition(fileName === basename(location.packagePath), `${bookId}: package archive filename drift`);
  return location.packagePath;
}

function portableMaterialization(
  root: string,
  materialized: MaterializedForwardBookInputV1,
): object {
  return {
    bookId: materialized.bookId,
    stateRootRelPath: resolve(materialized.stateRoot).slice(resolve(root).length + 1),
    inputSha256: materialized.inputSha256,
    bookBriefSha256: materialized.bookBriefSha256,
    chapterBriefSha256: materialized.chapterBriefSha256,
    files: materialized.files,
  };
}

export type Imp22ForwardInputMaterializationV1 = {
  schema: typeof IMP22_FORWARD_INPUT_MATERIALIZATION_SCHEMA;
  frozenAtIso: typeof IMP22_FORWARD_INPUT_FROZEN_AT;
  inputFreezeSha256: string;
  qualificationBookIds: string[];
  pilotExperimentId: typeof PILOT_EXPERIMENT_ID;
  goldExperimentId: typeof GOLD_EXPERIMENT_ID;
  pilot: object[];
  gold: object;
  priorChapterProseUsed: false;
  capabilities: { publish: false; promote: false; deploy: false; upload: false };
};

export type MaterializeImp22ForwardInputsResult = {
  freeze: ForwardInputFreezeV1;
  materialization: Imp22ForwardInputMaterializationV1;
  pilotRoot: string;
  goldRoot: string;
};

/**
 * Rebuild the exact frozen input set and persist it under caller-selected state.
 * The default is the real pipeline experiment root; tests pass a temporary root.
 */
export function materializeImp22ForwardInputs(
  stateRoot = DEFAULT_STATE_ROOT,
): MaterializeImp22ForwardInputsResult {
  const root = resolve(stateRoot);
  const pilotRoot = resolve(root, PILOT_EXPERIMENT_ID);
  const goldRoot = resolve(root, GOLD_EXPERIMENT_ID);
  const pilotBooks = inventoryPilotInputs();
  const gold = inventoryGoldBookInput({
    bookId: GOLD_LOCATION.bookId,
    packagePath: GOLD_LOCATION.packagePath!,
    sidecarDir: GOLD_LOCATION.sidecarDir,
    sourceArchiveId: GOLD_LOCATION.sourceArchiveId,
  });
  requireCondition(gold.eligibleForImp22 && gold.book !== null, `gold input is ineligible: ${gold.ineligibilityReasons.join("; ")}`);

  const qualificationIds = qualificationBookIds();
  const freeze = freezeForwardInputs({
    frozenAtIso: IMP22_FORWARD_INPUT_FROZEN_AT,
    qualificationBookIds: qualificationIds,
    pilotBooks,
    gold,
  });
  assertForwardInputFreezeFresh(freeze);
  verifyFrozenInputFiles(freeze.sourceFiles, sourcePathFor);

  requireCondition(
    freeze.freezeSha256 === IMP22_FORWARD_INPUT_EXPECTED_HASHES.freezeSha256,
    `IMP-22 input freeze hash drift (${freeze.freezeSha256} != ${IMP22_FORWARD_INPUT_EXPECTED_HASHES.freezeSha256})`,
  );
  requireCondition(
    freeze.goldStratumAssignmentSha256 === IMP22_FORWARD_INPUT_EXPECTED_HASHES.goldStratumAssignmentSha256,
    "IMP-22 gold stratum assignment drift",
  );
  requireCondition(freeze.goldInputHash === IMP22_FORWARD_INPUT_EXPECTED_HASHES.gold, "IMP-22 gold input hash drift");
  for (const [bookId, expected] of Object.entries(IMP22_FORWARD_INPUT_EXPECTED_HASHES.pilot)) {
    requireCondition(freeze.pilotInputHashes[bookId] === expected, `IMP-22 pilot input hash drift for ${bookId}`);
  }

  const pilotMaterialized = pilotBooks
    .map((book) => materializeForwardBookInput({
      book,
      experimentStateRoot: resolve(pilotRoot, "inputs", book.bookId),
      frozenAtIso: IMP22_FORWARD_INPUT_FROZEN_AT,
    }))
    .sort((a, b) => a.bookId.localeCompare(b.bookId));
  const goldMaterialized = materializeForwardBookInput({
    book: gold.book,
    experimentStateRoot: resolve(goldRoot, "inputs", gold.book.bookId),
    frozenAtIso: IMP22_FORWARD_INPUT_FROZEN_AT,
  });

  const materialization: Imp22ForwardInputMaterializationV1 = {
    schema: IMP22_FORWARD_INPUT_MATERIALIZATION_SCHEMA,
    frozenAtIso: IMP22_FORWARD_INPUT_FROZEN_AT,
    inputFreezeSha256: freeze.freezeSha256,
    qualificationBookIds: qualificationIds,
    pilotExperimentId: PILOT_EXPERIMENT_ID,
    goldExperimentId: GOLD_EXPERIMENT_ID,
    pilot: pilotMaterialized.map((item) => portableMaterialization(root, item)),
    gold: portableMaterialization(root, goldMaterialized),
    priorChapterProseUsed: false,
    capabilities: { publish: false, promote: false, deploy: false, upload: false },
  };

  // Both phases receive the same byte-identical denominator freeze.  This
  // prevents the gold phase from quietly changing selection after pilot output.
  writeStableJson(resolve(pilotRoot, "input-freeze.json"), freeze);
  writeStableJson(resolve(goldRoot, "input-freeze.json"), freeze);
  writeStableJson(resolve(pilotRoot, "input-materialization.json"), materialization);
  writeStableJson(resolve(goldRoot, "input-materialization.json"), materialization);
  return { freeze, materialization, pilotRoot, goldRoot };
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  const result = materializeImp22ForwardInputs();
  process.stdout.write(`${stableJson({
    inputFreezeSha256: result.freeze.freezeSha256,
    pilotRoot: result.pilotRoot,
    goldRoot: result.goldRoot,
    pilotChapterCount: result.freeze.pilot.flatMap((book) => book.chapters).length,
    goldChapterCount: result.freeze.goldChapterCount,
  })}`);
}
