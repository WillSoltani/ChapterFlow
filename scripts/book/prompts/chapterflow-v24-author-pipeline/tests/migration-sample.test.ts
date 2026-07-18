/**
 * IMP-11 — one-attempt experiment samples through the REAL production writer:
 * the firstWriteOnly pin (and the UNCHANGED production budget), the bounded
 * infrastructure replay policy, safeguard-evidence preservation, snapshot
 * prompt-stack substitution, critics capture, and resume immutability.
 */

import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { mkdirSync } from "node:fs";

import { test } from "./harness.js";
import type { AutopilotDeps } from "../src/orchestrator/autopilot.js";
import type { SpawnCodexAgentOptions } from "../src/orchestrator/codexAgent.js";
import { authorWriteOneChapter, type AuthorIo } from "../src/orchestrator/authorRun.js";
import { pipelineRel, sha256Hex } from "../src/bakeoff/paths.js";
import type { ExperimentSpecV1, SampleScheduleEntryV1 } from "../src/bakeoff/migration/experimentTypes.js";
import { migrationRoots, MigrationGuardError } from "../src/bakeoff/migration/guards.js";
import { runOneSample, sampleRecordPath, experimentSampleIo } from "../src/bakeoff/migration/sampleRunner.js";
import { confirmatorySpec, mkSealedMinimal, mkSnapshotStackDir } from "./migration-helpers.js";
import { fakeAutopilotDeps, fixtureChapter, fixturePacket, tmpRoot, writerSpawn } from "./model-bakeoff-helpers.js";

const BOOK = "zz-mig-sample";

function sampleSpec(over?: Partial<ExperimentSpecV1>): ExperimentSpecV1 {
  return confirmatorySpec({
    experimentId: "exp-sample",
    books: [{ bookId: BOOK, chapters: [{ chapterNumber: 1, stratum: "example-heavy" }] }],
    ...over,
  });
}

function entryFixture(over?: Partial<SampleScheduleEntryV1>): SampleScheduleEntryV1 {
  return {
    blindSampleId: "aaaabbbbcccc",
    cellId: "56S-H",
    bookId: BOOK,
    chapterNumber: 1,
    stratum: "example-heavy",
    sampleIndex: 1,
    executionOrder: 0,
    expansion: false,
    ...over,
  };
}

function fixtureIo(over?: Partial<AuthorIo>): Partial<AuthorIo> {
  return {
    readBriefMd: () => "# BRIEF",
    readBrief: () => null,
    readPacket: () => fixturePacket(BOOK, 1),
    voiceCard: () => null,
    gateCandidate: async () => ({ code: 0, stdout: "Gate verdict: PASS — 0 blockers", stderr: "" }),
    rubricWithCandidate: async () => ({ code: 0, stdout: "ch01: PASS", stderr: "" }),
    ...(over ?? {}),
  };
}

function mkDeps(spawn: (o: SpawnCodexAgentOptions) => Promise<unknown>): { deps: AutopilotDeps; spawns: SpawnCodexAgentOptions[] } {
  const spawns: SpawnCodexAgentOptions[] = [];
  const deps = fakeAutopilotDeps({
    spawn: (async (o: SpawnCodexAgentOptions) => {
      spawns.push(o);
      return spawn(o);
    }) as AutopilotDeps["spawn"],
  }) as AutopilotDeps;
  return { deps, spawns };
}

const okWriter = (spawns: SpawnCodexAgentOptions[]): ((o: SpawnCodexAgentOptions) => Promise<unknown>) => {
  const inner = writerSpawn(spawns, (relPath) => {
    const n = Number(relPath.match(/ch(\d+)\./)?.[1] ?? 1);
    return JSON.stringify(fixtureChapter(BOOK, n), null, 2);
  }, (relPath) => resolve(relPath));
  return (o) => inner(o);
};

test("one-attempt pin: a deterministic (gate) failure consumes exactly ONE writer spawn, classifies content_invalid, and is never replayed", async () => {
  const spec = sampleSpec();
  const roots = migrationRoots(spec.experimentId, tmpRoot("cf-mig-sample1-"));
  const rec: SpawnCodexAgentOptions[] = [];
  const { deps, spawns } = mkDeps(okWriter(rec));
  const record = await runOneSample({
    entry: entryFixture(),
    spec,
    sealed: mkSealedMinimal(spec),
    roots,
    deps,
    ioOverrides: fixtureIo({ gateCandidate: async () => ({ code: 1, stdout: "BLOCK: [B1] templated", stderr: "" }) }),
    log: () => {},
  });
  const writers = spawns.filter((s) => s.task.includes("Write EXACTLY one file"));
  assert.equal(writers.length, 1, "firstWriteOnly: no gate retry, no lead degradation");
  assert.equal(record.outcome.firstWriteDeterministicPass, false);
  assert.equal(record.outcome.providerOutcome, "content_invalid", "a clean spawn whose output fails validation is a CONTENT failure");
  assert.equal(record.outcome.replayed, false, "content failures are never replayed");
  assert.ok(record.outcome.failureReason && record.outcome.failureReason.length > 0);
  assert.equal(record.artifact.contentSha256, null);
  assert.ok(existsSync(sampleRecordPath(roots, record.blindSampleId)), "record persisted");
});

test("the PRODUCTION budget is unchanged: the same failing gate without firstWriteOnly still burns the full retry budget", async () => {
  const roots = migrationRoots("exp-prod-pin", tmpRoot("cf-mig-prodpin-"));
  const rec: SpawnCodexAgentOptions[] = [];
  const { deps, spawns } = mkDeps(okWriter(rec));
  const io = { ...experimentSampleIo(roots, "prodpinsample"), ...fixtureIo({ gateCandidate: async () => ({ code: 1, stdout: "BLOCK: [B1] templated", stderr: "" }) }) };
  const r = await authorWriteOneChapter(BOOK, 1, deps, {
    io,
    totalChapters: 3,
    outputRelPath: pipelineRel(resolve(roots.runRoot, "samples", "prodpinsample", "chapters", `${BOOK}-ch01.chapter.json`)),
    model: "gpt-5.5",
    effort: "high",
  });
  assert.equal(r.ok, false);
  const writers = spawns.filter((s) => s.task.includes("Write EXACTLY one file"));
  assert.equal(writers.length, 2, "1 + AUTHOR_WRITE_GATE_RETRIES — the default budget is byte-identical");
});

test("success path: record carries content hash, deterministic critics, diversity features; resume is immutable (no new spawns)", async () => {
  const spec = sampleSpec();
  const roots = migrationRoots(spec.experimentId, tmpRoot("cf-mig-sample2-"));
  const rec: SpawnCodexAgentOptions[] = [];
  const { deps, spawns } = mkDeps(okWriter(rec));
  const opts = { entry: entryFixture(), spec, sealed: mkSealedMinimal(spec), roots, deps, ioOverrides: fixtureIo(), log: () => {} };
  const record = await runOneSample(opts);
  assert.equal(record.outcome.firstWriteDeterministicPass, true);
  assert.equal(record.outcome.providerOutcome, "content_completed");
  assert.match(record.artifact.contentSha256 ?? "", /^[0-9a-f]{16}$/, "chapterContentHash identity (16-hex)");
  assert.ok(record.artifact.chapterRelPath?.includes("samples/aaaabbbbcccc/chapters/"), "chapter lives under the sample tree");
  assert.ok(record.critics, "deterministic critics ran once");
  assert.equal(record.critics!.registerAdvisories, 0, "no plan → C37 returns nothing");
  assert.ok(record.critics!.diversity && Object.keys(record.critics!.diversity).length >= 13, "IMP-06 feature lexicon captured");
  assert.deepEqual(record.tokens, null, "codex CLI exposes no token usage — never estimated");
  assert.ok(record.unavailableFields.includes("tokens"));

  const before = spawns.length;
  const again = await runOneSample(opts);
  assert.equal(spawns.length, before, "resume reuses the persisted record — no re-roll");
  assert.deepEqual(again, record);
});

test("bounded infrastructure replay: a thrown spawn replays ONCE under the same sample identity; the original outcome and redacted tail are preserved", async () => {
  const spec = sampleSpec();
  const roots = migrationRoots(spec.experimentId, tmpRoot("cf-mig-sample3-"));
  const rec: SpawnCodexAgentOptions[] = [];
  let calls = 0;
  const inner = okWriter(rec);
  const { deps, spawns } = mkDeps(async (o) => {
    if (o.task.includes("Write EXACTLY one file") && ++calls === 1) {
      throw new Error("boom: transport died");
    }
    return inner(o);
  });
  const record = await runOneSample({
    entry: entryFixture(),
    spec,
    sealed: mkSealedMinimal(spec),
    roots,
    deps,
    ioOverrides: fixtureIo(),
    log: () => {},
  });
  assert.equal(record.outcome.replayed, true);
  assert.equal(record.outcome.originalProviderOutcome, "infrastructure_failure");
  assert.equal(record.outcome.providerOutcome, "content_completed");
  assert.equal(record.outcome.firstWriteDeterministicPass, true);
  assert.equal(spawns.filter((s) => s.task.includes("Write EXACTLY one file")).length, 2, "exactly one prespecified replay");
  assert.ok(existsSync(roots.evidenceRoot) && readdirSync(roots.evidenceRoot).length > 0, "the failed spawn's redacted tail is preserved (safeguard-marker calibration evidence)");
});

test("pre-spawn refusals classify policy_preflight_failure and are not replayable", async () => {
  const spec = sampleSpec();
  const roots = migrationRoots(spec.experimentId, tmpRoot("cf-mig-sample4-"));
  const rec: SpawnCodexAgentOptions[] = [];
  const { deps, spawns } = mkDeps(okWriter(rec));
  const record = await runOneSample({
    entry: entryFixture(),
    spec,
    sealed: mkSealedMinimal(spec),
    roots,
    deps,
    ioOverrides: fixtureIo({ readBriefMd: () => null }),
    log: () => {},
  });
  assert.equal(record.outcome.providerOutcome, "policy_preflight_failure");
  assert.equal(record.outcome.replayed, false);
  assert.equal(spawns.filter((s) => s.task.includes("Write EXACTLY one file")).length, 0);
});

test("snapshot prompt-stack: the frozen template (hash-verified at use) replaces the built card; a tampered template refuses to author", async () => {
  const tmp = tmpRoot("cf-mig-sample5-");
  const snap = mkSnapshotStackDir(tmp, [{ bookId: BOOK, n: 1 }]);
  const spec = sampleSpec({
    stacks: [{ id: "legacy-v24", source: "snapshot", snapshotDirRelPath: snap.relPath, combinedSha256: "ignored-here" }],
    cells: [{ cellId: "55-XH-L", model: "gpt-5.5", effort: "xhigh", stackId: "legacy-v24" }],
  });
  const sealed = mkSealedMinimal(spec);
  sealed.stacks = [{ id: "legacy-v24", source: "snapshot", cardTemplateSha256: snap.hashes, combinedSha256: "x" }];
  const roots = migrationRoots(spec.experimentId, join(tmp, "state"));
  const rec: SpawnCodexAgentOptions[] = [];
  const inner = okWriter(rec);
  const tasks: string[] = [];
  const { deps } = mkDeps(async (o) => {
    if (o.task.includes("Write EXACTLY one file")) tasks.push(o.task);
    return inner(o);
  });
  const entry = entryFixture({ cellId: "55-XH-L" });
  const record = await runOneSample({ entry, spec, sealed, roots, deps, ioOverrides: fixtureIo(), log: () => {} });
  assert.equal(record.outcome.firstWriteDeterministicPass, true);
  assert.ok(tasks[0].startsWith("LEGACY CARD"), "the snapshot template IS the card");
  assert.ok(!tasks[0].includes("<<BAKEOFF-OUTPUT-PATH>>"), "the output placeholder was substituted");
  assert.ok(tasks[0].includes(`${BOOK}-ch01.v21-native.chapter.json`), "…with the sample's candidate filename");

  // Tamper the template after sealing → a fresh sample refuses to author.
  const file = join(tmp, "legacy-cards", `${BOOK}.ch01.card.txt`);
  writeFileSync(file, readFileSync(file, "utf8") + "\nTAMPERED");
  await assert.rejects(
    () => runOneSample({ entry: entryFixture({ cellId: "55-XH-L", blindSampleId: "ddddeeeeffff" }), spec, sealed, roots, deps, ioOverrides: fixtureIo(), log: () => {} }),
    (err: Error) => err instanceof MigrationGuardError && /drifted stack/.test(err.message),
  );
});

test("the sample io refuses lead-override writes (structurally unreachable in a one-attempt design)", () => {
  const roots = migrationRoots("exp-io-guard", tmpRoot("cf-mig-ioguard-"));
  const io = experimentSampleIo(roots, "aaaabbbbcccc");
  assert.throws(() => io.writeLeadOverride!(BOOK, 1, {} as never), MigrationGuardError);
  // Chapter writes stay inside the sample tree.
  const abs = resolve(roots.runRoot, "samples", "aaaabbbbcccc", "chapters", `${BOOK}-ch01.v21-native.chapter.json`);
  mkdirSync(dirname(abs), { recursive: true });
  io.writeChapterFile!(BOOK, 1, JSON.stringify(fixtureChapter(BOOK, 1)));
  assert.ok(existsSync(abs));
  assert.equal(sha256Hex(readFileSync(abs, "utf8")).length, 64);
});
