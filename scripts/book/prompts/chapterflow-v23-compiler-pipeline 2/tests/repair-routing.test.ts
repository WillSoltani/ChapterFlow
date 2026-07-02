/**
 * P10 (F3) — class-routed QC repair.
 *
 * Covers: the routing table resolves each family/class to the right lever; a salt bump re-deals
 * ONLY the salted slot family for ONLY the bumped chapter (siblings + other slots byte-identical);
 * routeAndExecuteRepairs honors the per-chapter redeal cap, writes the decision ledger, and (in
 * surgical-only mode) bypasses redeal entirely; and the surgical-edit → artifact sync round trip
 * proves byte-equality (and HALTS on a genuine mismatch).
 */

import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";

import { test } from "./harness.js";
import { compileCreditFixture, creditChapterSpec, writeCreditFixture } from "./fixtures/creditBookFixture.js";
import { routeFinding, loadFindingRoutingConfig, validateFindingRoutingConfig } from "../src/qc/findingRouting.js";
import {
  bumpSlotSalt,
  routeAndExecuteRepairs,
  syncChapterEditsToArtifacts,
  type RoutableRepairFinding,
} from "../src/orchestrator/repairRouting.js";
import { compileChapterBlueprint, readSlotSalts } from "../src/compiler/chapterBlueprint.js";
import { assembleSections } from "../src/sections/assembleSections.js";
import { dealSectionTasks } from "../src/sections/sectionTasks.js";
import { loadBookChapters } from "../src/qc/manualKeyJudge.js";
import { compileSourcePacketFromSidecar } from "../src/compiler/sourcePacket.js";
import { blueprintPath, readJsonFile, repairRoutingLedgerPath, sectionPath, slotSaltsPath, sourcePacketPath, writeJsonFile, type CompilerStoreRoots } from "../src/artifacts/artifactStore.js";
import { canonicalChapterIndexPath } from "../src/lib/chapterSet.js";
import { CHAPTERS_DIR, chapterFileName } from "../src/lib/chapterPaths.js";
import type { ChapterSpec } from "../src/generateChapter.js";
import type { SourceSidecarV2 } from "../src/source/sidecarSchema.js";
import type { AutopilotDeps } from "../src/orchestrator/autopilot.js";

// ── 1. Routing table resolution ────────────────────────────────────────────────
test("P10 routing: the shipped config resolves each finding class to the right lever", () => {
  assert.doesNotThrow(() => loadFindingRoutingConfig(), "shipped config must validate");
  const cfg = loadFindingRoutingConfig();
  const r = (f: Parameters<typeof routeFinding>[0]) => routeFinding(f, cfg);
  assert.equal(r({ family: "scene_skeleton", unitId: "ex03" }), "redeal:example-slot");
  assert.equal(r({ family: "repeated_unit", unitId: "ex02" }), "redeal:example-slot");
  assert.equal(r({ family: "repeated_unit", unitId: "q05" }), "redeal:quiz-slot");
  assert.equal(r({ family: "repeated_unit", unitId: "rc02" }), "redeal:card-slot");
  assert.equal(r({ family: "repeated_unit", unitId: "ifThenPlans[1]" }), "surgical", "an action-pack repeated_unit has no redeal salt → surgical");
  assert.equal(r({ family: "location_stamping", unitId: "ex01" }), "redeal:venue");
  assert.equal(r({ family: "persona_drift", unitId: "ex04" }), "redeal:names");
  assert.equal(r({ repairClass: "factual_accuracy", unitId: "q01" }), "surgical", "bar-axis / alignment findings stay surgical");
  assert.equal(r({ repairClass: "templated_source", unitId: "fact.2" }), "escalate:research");
  assert.equal(r({ family: "book_wide_duplicate", unitId: "fact.3" }), "escalate:research", "SP14-class source finding escalates");
  assert.equal(r({}), "surgical", "an unclassified finding defaults to surgical");
});

test("P10 routing: the config validator rejects an unknown lever", () => {
  assert.throws(() => validateFindingRoutingConfig({
    schemaVersion: "finding-routing-v1", default: "surgical",
    families: { scene_skeleton: { lever: "redeal:nope" } }, escalate: { lever: "escalate:research", match: [] }, unitPatterns: {},
  }), /must be one of/);
});

// ── 2. Salt bump isolates the re-deal to one slot family + one chapter ───────────
const ISO_BOOK = "zz-fixture-repair-routing-isolate";

function isoSidecar(n: number, title: string): SourceSidecarV2 {
  const facts = Array.from({ length: 9 }, (_, i) => ({
    id: `ch${n}.fact.${i + 1}`,
    claim: `Test claim ${i + 1} for ${title}.`,
    becauseMechanism: `Because mechanism ${i + 1} explains ${title} concretely.`,
    commonError: `Common error ${i + 1}.`,
    errorIsWhy: `Why that error is wrong ${i + 1}.`,
  }));
  return {
    schemaVersion: "source-v2", chapterNumber: n, chapterTitle: title,
    centralConcept: { id: `ch${n}.concept`, name: title, plainDefinition: `${title} definition.`, whyItMatters: `${title} matters to the reader.` },
    keyClaims: facts.map((f) => f.claim),
    namedExamples: [
      { id: `ch${n}.case.a`, label: "Case A", summary: "Case A summary with enough detail to be a grounded source case.", teachesWhat: "Teaches A.", hardSpecifics: ["specific A1", "specific A2"], realWorld: true },
      { id: `ch${n}.case.b`, label: "Case B", summary: "Case B summary with enough detail to be a grounded source case.", teachesWhat: "Teaches B.", hardSpecifics: ["specific B1", "specific B2"], realWorld: true },
    ],
    hardEdge: "Do not overclaim the mechanism.", paraphraseNotes: "Keep claims bounded to the tested facts.",
    testableFacts: facts, frameworks: [{ name: "Test framework", members: ["a", "b"] }],
  };
}
function isoSpec(n: number): ChapterSpec { return { chapterId: `${ISO_BOOK}-ch${String(n).padStart(2, "0")}`, chapterNumber: n, chapterTitle: `Chapter ${n}` }; }

test("P10 redeal: bumping ONE chapter's slot salt changes ONLY that slot family, and no sibling chapter", () => {
  const stateRoot = resolve(tmpdir(), `cf-v23-rr-isolate-${process.pid}-${Date.now()}`);
  const roots: CompilerStoreRoots = { stateRoot };
  try {
    mkdirSync(resolve(stateRoot, "indexes"), { recursive: true });
    writeJsonFile(canonicalChapterIndexPath(ISO_BOOK, stateRoot), [isoSpec(1), isoSpec(2)]);
    const packets = [1, 2].map((n) => compileSourcePacketFromSidecar({ bookId: ISO_BOOK, chapter: isoSpec(n), sidecar: isoSidecar(n, `Chapter ${n}`), sidecarPath: `/tmp/ch${n}.source.json`, sourceHash: `h${n}` }));
    [1, 2].forEach((n) => writeJsonFile(sourcePacketPath(ISO_BOOK, n, roots), packets[n - 1]));
    const compile = (n: number) => compileChapterBlueprint({ bookId: ISO_BOOK, chapter: isoSpec(n), packet: packets[n - 1], packetPath: sourcePacketPath(ISO_BOOK, n, roots), roots });

    const ch1Before = compile(1);
    const ch2Before = compile(2);

    // Bump ONLY ch1's exampleFrames (a scene_skeleton redeal) and re-read via the sidecar.
    const newSalt = bumpSlotSalt(ISO_BOOK, 1, "exampleFrames", roots);
    assert.equal(newSalt, 1, "first bump goes 0 → 1");
    assert.equal(readSlotSalts(ISO_BOOK, roots).chapters["1"]?.exampleFrames, 1, "salt is persisted");

    const ch1After = compile(1);
    const ch2After = compile(2);

    // ch1: example scene frames/beats changed…
    assert.notDeepEqual(ch1After.sections.examples.map((e) => [e.sceneFrame, e.requiredBeat]), ch1Before.sections.examples.map((e) => [e.sceneFrame, e.requiredBeat]), "exampleFrames bump must change ch1 scene frames");
    // …but venues, names, and quiz/card shapes on ch1 did NOT.
    assert.deepEqual(ch1After.sections.examples.map((e) => e.venue), ch1Before.sections.examples.map((e) => e.venue), "venues unchanged");
    assert.deepEqual(ch1After.reservedVariety.allowedNames, ch1Before.reservedVariety.allowedNames, "names unchanged");
    assert.deepEqual(ch1After.sections.quiz.map((q) => [q.promptShape, q.correctIndex]), ch1Before.sections.quiz.map((q) => [q.promptShape, q.correctIndex]), "quiz shapes + keys unchanged");
    // ch2 (a different chapter) is byte-identical — the bump is chapter-scoped.
    assert.equal(JSON.stringify(ch2After), JSON.stringify(ch2Before), "sibling chapter ch2 must be byte-identical");
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

// ── 3. Cap honored + ledger written ─────────────────────────────────────────────
let sid = 0;
function stubDeps(events: string[]): AutopilotDeps {
  return {
    runVerb: async (args: string[]) => { events.push(`verb:${args[0]}`); return { code: 0, stdout: "", stderr: "" }; },
    spawn: (async (o: { sessionId: string }) => { events.push(`spawn:${o.sessionId}`); return { ok: true, exitCode: 0 }; }) as unknown as AutopilotDeps["spawn"],
    mkSessionId: (label: string) => `${label}#${++sid}`,
    log: () => {},
    logSession: () => {},
  } as unknown as AutopilotDeps;
}

test("P10 executor: redeal cap is honored (>2 per chapter fall back to surgical) and every decision is ledgered", async () => {
  const BOOK = "zz-fixture-repair-routing-cap";
  const stateRoot = resolve(tmpdir(), `cf-v23-rr-cap-${process.pid}-${Date.now()}`);
  const roots: CompilerStoreRoots = { stateRoot };
  try {
    writeCreditFixture(BOOK, roots, compileCreditFixture(BOOK, roots));
    dealSectionTasks(BOOK, roots); // write the section task cards the regen writer reads
    // Three DISTINCT redeal levers on ch1 (example-slot, quiz-slot, venue) → 3 redeal ops; cap = 2.
    const findings: RoutableRepairFinding[] = [
      { findingId: "F-scene", family: "scene_skeleton", unitId: "ex01", chapterNumber: 1 },
      { findingId: "F-quiz", family: "repeated_unit", unitId: "q03", chapterNumber: 1 },
      { findingId: "F-venue", family: "location_stamping", unitId: "ex02", chapterNumber: 1 },
      { findingId: "F-bar", repairClass: "factual_accuracy", unitId: "q01", chapterNumber: 1 },
    ];
    const events: string[] = [];
    const result = await routeAndExecuteRepairs(BOOK, "r-cap", findings, stubDeps(events), { mode: "enforce", roots, now: () => "2026-07-02T00:00:00.000Z" });

    assert.equal(result.halt, null, "no escalation → no halt");
    assert.deepEqual(result.redealedChapters, [1], "ch1 was re-dealt");
    // Cap = 2 → exactly two redeals ran; the third redeal-classed finding + the bar finding are surgical.
    const salts = readSlotSalts(BOOK, roots).chapters["1"] ?? {};
    const bumped = (["exampleFrames", "venues", "quizShapes", "names"] as const).filter((k) => (salts[k] ?? 0) > 0);
    assert.equal(bumped.length, 2, `exactly 2 salt families bumped, got ${bumped.join(",")}`);
    const surgicalIds = result.surgicalFindings.map((f) => f.findingId).sort();
    assert.deepEqual(surgicalIds, ["F-bar", "F-venue"], "the capped venue redeal + the bar finding go surgical");

    // Ledger: one line per (finding, decision).
    const lines = readFileSync(repairRoutingLedgerPath(BOOK, roots), "utf8").trim().split("\n").map((l) => JSON.parse(l));
    const byOutcome = lines.reduce((m: Record<string, number>, l) => ((m[l.outcome] = (m[l.outcome] ?? 0) + 1), m), {});
    assert.equal(byOutcome["redealed"], 2, "2 redealed ledger entries");
    assert.equal(byOutcome["cap-fallback-surgical"], 1, "1 cap-fallback ledger entry");
    assert.equal(byOutcome["surgical"], 1, "1 surgical ledger entry");
    assert.ok(lines.every((l) => l.roundId === "r-cap" && l.bookId === BOOK), "ledger stamps book + round");
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("P10 executor: surgical-only mode bypasses redeal entirely", async () => {
  const BOOK = "zz-fixture-repair-routing-surgical-only";
  const stateRoot = resolve(tmpdir(), `cf-v23-rr-surg-${process.pid}-${Date.now()}`);
  const roots: CompilerStoreRoots = { stateRoot };
  try {
    writeCreditFixture(BOOK, roots, compileCreditFixture(BOOK, roots));
    const findings: RoutableRepairFinding[] = [
      { findingId: "F-scene", family: "scene_skeleton", unitId: "ex01", chapterNumber: 1 },
      { findingId: "F-persona", family: "persona_drift", unitId: "ex02", chapterNumber: 1 },
    ];
    const events: string[] = [];
    const result = await routeAndExecuteRepairs(BOOK, "r-surg", findings, stubDeps(events), { mode: "surgical-only", roots });

    assert.equal(result.halt, null);
    assert.deepEqual(result.redealedChapters, [], "no redeals in surgical-only");
    assert.equal(result.surgicalFindings.length, 2, "every finding is surgical");
    assert.ok(!existsSync(slotSaltsPath(BOOK, roots)), "no salt file written in surgical-only");
    assert.ok(!events.some((e) => e.startsWith("verb:compile-blueprints")), "no blueprint recompile spawned");
    const lines = readFileSync(repairRoutingLedgerPath(BOOK, roots), "utf8").trim().split("\n").map((l) => JSON.parse(l));
    assert.ok(lines.every((l) => l.outcome === "surgical"), "ledger records surgical-only decisions");
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("P10 executor: a templated-source finding escalates to a re-research halt (no redeal spent)", async () => {
  const BOOK = "zz-fixture-repair-routing-escalate";
  const stateRoot = resolve(tmpdir(), `cf-v23-rr-esc-${process.pid}-${Date.now()}`);
  const roots: CompilerStoreRoots = { stateRoot };
  try {
    writeCreditFixture(BOOK, roots, compileCreditFixture(BOOK, roots));
    const findings: RoutableRepairFinding[] = [
      { findingId: "F-tmpl", repairClass: "templated_source", unitId: "fact.2", chapterNumber: 1 },
      { findingId: "F-scene", family: "scene_skeleton", unitId: "ex01", chapterNumber: 1 },
    ];
    const events: string[] = [];
    const result = await routeAndExecuteRepairs(BOOK, "r-esc", findings, stubDeps(events), { mode: "enforce", roots });
    assert.ok(result.halt && result.halt.status === "halt", "templated source halts");
    assert.match(result.halt!.status === "halt" ? result.halt!.reason : "", /RE-RESEARCH|templated-source/i);
    assert.deepEqual(result.redealedChapters, [], "no redeal spent on a doomed-source book");
    assert.ok(!existsSync(slotSaltsPath(BOOK, roots)), "no salt bumped before escalation");
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

// ── 4. Surgical-edit → artifact sync round trip ─────────────────────────────────
const SYNC_BOOK = "zz-fixture-repair-routing-sync";

function withAssembledFixture(roots: CompilerStoreRoots, fn: () => void): void {
  const chapterFile = resolve(CHAPTERS_DIR, chapterFileName(`${SYNC_BOOK}-ch01`));
  try {
    writeCreditFixture(SYNC_BOOK, roots, compileCreditFixture(SYNC_BOOK, roots));
    const asm = assembleSections(SYNC_BOOK, roots);
    assert.deepEqual(asm.findings, [], `fixture must assemble cleanly: ${asm.findings.join("; ")}`);
    assert.ok(existsSync(chapterFile), "assembled chapter written");
    fn();
  } finally {
    rmSync(chapterFile, { force: true });
    rmSync(roots.stateRoot!, { recursive: true, force: true });
  }
}

test("P10 artifact sync: a surgical field edit is written back into the section artifacts and round-trips byte-equal", () => {
  const stateRoot = resolve(tmpdir(), `cf-v23-rr-sync-${process.pid}-${Date.now()}`);
  const roots: CompilerStoreRoots = { stateRoot };
  withAssembledFixture(roots, () => {
    const chapter = loadBookChapters(SYNC_BOOK).find((c) => c.number === 1)!;
    // Edit a reader-facing field the ARTIFACTS own (the keyTakeaway lives in the summary pack).
    chapter.keyTakeaway = "Change what the reporting system can see before the snapshot, rather than trusting that careful intentions will be read correctly.";
    const reload = (b: string, n: number) => loadBookChapters(b).find((c) => c.number === n) ?? null;
    const res = syncChapterEditsToArtifacts(SYNC_BOOK, 1, chapter, roots, (b, r) => assembleSections(b, r), reload);
    assert.ok(res.ok, `round trip should hold: ${res.ok ? "" : (res.halt.status === "halt" ? res.halt.reason : "")}`);
    // The edit is now IN the summary artifact (no drift).
    const summary = readJsonFile<{ keyTakeaway: string }>(sectionPath(SYNC_BOOK, 1, "summary-pack", roots));
    assert.equal(summary.keyTakeaway, chapter.keyTakeaway, "summary artifact carries the edited takeaway");
    // And the re-assembled chapter matches the edit.
    assert.equal(reload(SYNC_BOOK, 1)!.keyTakeaway, chapter.keyTakeaway);
  });
});

test("P10 artifact sync: an edit the artifacts do NOT own is caught by the round-trip and HALTS (no drift shipped)", () => {
  const stateRoot = resolve(tmpdir(), `cf-v23-rr-sync-drift-${process.pid}-${Date.now()}`);
  const roots: CompilerStoreRoots = { stateRoot };
  withAssembledFixture(roots, () => {
    const chapter = loadBookChapters(SYNC_BOOK).find((c) => c.number === 1)!;
    // `title` comes from the blueprint plan, not any section artifact — syncing can't propagate it,
    // so the re-assembly reproduces the ORIGINAL title → a round-trip mismatch the guard must catch.
    chapter.title = "A Title The Section Artifacts Cannot Reproduce";
    const reload = (b: string, n: number) => loadBookChapters(b).find((c) => c.number === n) ?? null;
    const res = syncChapterEditsToArtifacts(SYNC_BOOK, 1, chapter, roots, (b, r) => assembleSections(b, r), reload);
    assert.ok(!res.ok, "a field the artifacts don't own must not silently round-trip");
    assert.match(res.ok ? "" : (res.halt.status === "halt" ? res.halt.reason : ""), /round-trip MISMATCH/);
  });
});

// ── R2 (reviewer): sibling chapters are byte-stable across a redeal's book-wide re-assembly ──────
test("P10 redeal: a book-wide re-assembly that rewrites a DRIFTED sibling chapter is restored (only the re-dealt chapter keeps the new build)", async () => {
  const BOOK = "zz-fixture-repair-routing-sibling";
  const stateRoot = resolve(tmpdir(), `cf-v23-rr-sib-${process.pid}-${Date.now()}`);
  const roots: CompilerStoreRoots = { stateRoot };
  try {
    writeCreditFixture(BOOK, roots, compileCreditFixture(BOOK, roots));
    dealSectionTasks(BOOK, roots);
    // Two "QC-repaired" chapter files on disk. ch2's artifacts are (by construction of the stub
    // below) STALE relative to these bytes — the pre-P10 drift scenario.
    const chaptersDir = resolve(stateRoot, "chapters");
    mkdirSync(chaptersDir, { recursive: true });
    const ch1Path = resolve(chaptersDir, `${BOOK}-ch01.v21-native.chapter.json`);
    const ch2Path = resolve(chaptersDir, `${BOOK}-ch02.v21-native.chapter.json`);
    const repairedCh1 = JSON.stringify({ marker: "ch1 QC-REPAIRED bytes" });
    const repairedCh2 = JSON.stringify({ marker: "ch2 QC-REPAIRED bytes (must survive the redeal)" });
    writeFileSync(ch1Path, repairedCh1, "utf8");
    writeFileSync(ch2Path, repairedCh2, "utf8");

    // Stubbed verbs: assemble-sections rewrites BOTH chapters from (stale) artifacts.
    const clobber = (p: string, n: number) => writeFileSync(p, JSON.stringify({ marker: `ch${n} REASSEMBLED-FROM-STALE-ARTIFACTS` }), "utf8");
    const deps = {
      runVerb: async (args: string[]) => {
        if (args[0] === "assemble-sections") { clobber(ch1Path, 1); clobber(ch2Path, 2); }
        return { code: 0, stdout: "", stderr: "" };
      },
      spawn: (async () => ({ ok: true, exitCode: 0 })) as unknown as AutopilotDeps["spawn"],
      mkSessionId: (label: string) => `${label}#sib`,
      log: (m: string) => logs.push(m),
      logSession: () => {},
    } as unknown as AutopilotDeps;
    const logs: string[] = [];

    const findings: RoutableRepairFinding[] = [{ findingId: "F-sib", family: "scene_skeleton", unitId: "ex01", chapterNumber: 1 }];
    const result = await routeAndExecuteRepairs(BOOK, "r-sib", findings, deps, { mode: "enforce", roots, now: () => "2026-07-02T00:00:00.000Z" });

    assert.equal(result.halt, null, "the redeal itself succeeds");
    assert.deepEqual(result.redealedChapters, [1]);
    assert.equal(readFileSync(ch2Path, "utf8"), repairedCh2, "the DRIFTED sibling's QC-repaired bytes are RESTORED — a redeal never rewrites siblings");
    assert.match(readFileSync(ch1Path, "utf8"), /REASSEMBLED/, "the re-dealt chapter keeps the new assembled build");
    assert.ok(logs.some((m) => /PRE-EXISTING ARTIFACT DRIFT/.test(m)), "the restoration is logged loudly for the operator");
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});
