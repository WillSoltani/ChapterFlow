/**
 * IMP-03 (F-004..F-007, F-013) — the compiler-owned source-use plan.
 *
 * Pins, per the master-plan test list: orthogonal origin/form/claim-strength
 * derivations (sourced explanation, sourced case, constructed application,
 * generic scenario, analogy, direct explanation), the conservative claim-
 * strength ceiling (causal is never minted; mechanism strings never grant
 * causal), the no-scene degrade for under-evidenced cases, contract-validator
 * rejection of every forbidden combination, determinism + packet-hash binding
 * + staleness, writer/repair relabel containment (reserved plan-control keys
 * fail the attempt and never touch canonical bytes), plan-block card rendering
 * (compact), the SP15/SP16 gate checks, legacy (no-plan) byte-compatibility,
 * and mid-attempt lineage freshness at commit.
 */

import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { test } from "./harness.js";
import {
  CLAIM_STRENGTH_ORDER,
  COMPILER_MAX_CLAIM_STRENGTH,
  claimStrengthRank,
  compileSourceUsePlan,
  embeddedPlanMutationFindings,
  renderSourceUsePlanLines,
  sourceUsePlanStale,
} from "../src/compiler/sourceUsePlanCompiler.js";
import { sourceUsePlanHash, validateSourceUsePlan, type SourceUsePlanUnitV1, type SourceUsePlanV1 } from "../src/contracts/sourceUsePlan.js";
import { sourcePacketHash } from "../src/compiler/sourcePacket.js";
import { checkSourcePacketGate } from "../src/compiler/sourcePacketGate.js";
import { sourcePacketPath, sourceUsePlanPath, writeJsonFile } from "../src/artifacts/artifactStore.js";
import { authorWriteOneChapter, buildAuthorCard, resolveAuthorIo, type AuthorIo } from "../src/orchestrator/authorRun.js";
import { buildRepairCard, doRepairOneChapter } from "../src/orchestrator/authorRepair.js";
import type { AutopilotDeps } from "../src/orchestrator/autopilot.js";
import { chapterFileName } from "../src/lib/chapterPaths.js";
import { CHAPTER_BRIEF_SCHEMA_VERSION, type ChapterBriefV1, type SourcePacketV1 } from "../src/artifacts/artifactTypes.js";
import type { ChapterV21 } from "../src/types.js";

const TMP = mkdtempSync(join(tmpdir(), "source-use-plan-"));

// ── fixtures ──────────────────────────────────────────────────────────────────

function mkFact(id: string, over: Partial<SourcePacketV1["facts"][number]> = {}): SourcePacketV1["facts"][number] {
  return {
    id,
    claim: `Claim for ${id}: focused practice on a named weakness improves skill.`,
    mechanism: `Mechanism for ${id}: feedback tightens the error signal.`,
    commonError: "More unfocused hours suffice.",
    whyWrong: "Volume without feedback plateaus.",
    allowedClaimTypes: [],
    groundedNumbers: [],
    groundedEntities: [],
    groundedPlaces: [],
    verificationRefs: [],
    ...over,
  };
}

function anchorFor(id: string, kind: "concept" | "testable_fact" | "named_example"): SourcePacketV1["allowedAnchors"][number] {
  return { id, kind, label: id, text: `text for ${id}`, supportsClaimTypes: [] };
}

function mkPacket(over: Partial<SourcePacketV1> = {}): SourcePacketV1 {
  const facts = [
    mkFact("ch01.fact.1"),
    mkFact("ch01.fact.2", { mechanism: "" }),                              // no mechanism → descriptive
    mkFact("ch01.fact.3", { replicationStatus: "contested" }),             // contested → descriptive DESPITE its mechanism
  ];
  const namedCases: SourcePacketV1["namedCases"] = [
    { id: "ch01.ex.violin", label: "Ericsson violin study", summary: "Berlin conservatory practice diaries.", realWorld: true, hardSpecifics: ["Berlin conservatory", "practice diaries"], allowedUses: [], forbiddenUses: [], doNotRestamp: ["Berlin conservatory"] },
    { id: "ch01.ex.thin", label: "Thin case", summary: "Documented with a single checkable token.", realWorld: true, hardSpecifics: ["one token"], allowedUses: [], forbiddenUses: [], doNotRestamp: [] },
    { id: "ch01.ex.device", label: "The Hedgehog Parable", summary: "The source book's own fable.", realWorld: false, hardSpecifics: ["fox vs hedgehog", "one big thing"], allowedUses: [], forbiddenUses: [], doNotRestamp: [] },
  ];
  return {
    schemaVersion: "source-packet-v1",
    bookId: "zz-plan",
    chapterId: "zz-plan-ch01",
    chapterNumber: 1,
    chapterTitle: "Deliberate Practice",
    sourceSidecarPath: null,
    sourceHash: null,
    facts,
    namedCases,
    frameworks: [],
    allowedAnchors: [
      anchorFor("ch01.concept.core", "concept"),
      ...facts.map((f) => anchorFor(f.id, "testable_fact")),
      ...namedCases.map((c) => anchorFor(c.id, "named_example")),
    ],
    allowedNumbers: [],
    allowedEntities: [],
    allowedPlaces: [],
    forbiddenClaims: [],
    forbiddenLeakage: [],
    sourceQuality: { status: "adequate", risks: [] },
    ...over,
  };
}

function unitById(plan: SourceUsePlanV1, unitId: string): SourceUsePlanUnitV1 {
  const unit = plan.units.find((u) => u.unitId === unitId);
  assert.ok(unit, `plan carries ${unitId}`);
  return unit!;
}

// ── orthogonal derivations ────────────────────────────────────────────────────

test("facts derive source-bound EXPLANATION units: mechanism→mechanistic, none→descriptive, contested→descriptive (never inferred upward)", () => {
  const { plan, findings } = compileSourceUsePlan(mkPacket());
  assert.deepEqual(
    findings,
    ["case ch01.ex.thin: only 1 documented hardSpecific(s) — no scene license; explanation-only unit minted"],
    "the fixture's deliberate thin case yields exactly its degrade finding — nothing else",
  );
  assert.deepEqual(validateSourceUsePlan(plan), [], "plan passes its frozen contract");

  const f1 = unitById(plan, "unit.fact.ch01.fact.1");
  assert.deepEqual(
    [f1.origin, f1.form, f1.claimStrength, f1.detailSufficiency, f1.framingRequired, f1.anchorIds],
    ["source_bound", "explanation", "mechanistic", "concept_only", false, ["ch01.fact.1"]],
    "a researcher-attested mechanism grants MECHANISTIC (not causal) explanation license",
  );
  assert.equal(unitById(plan, "unit.fact.ch01.fact.2").claimStrength, "descriptive", "no mechanism → descriptive");
  assert.equal(unitById(plan, "unit.fact.ch01.fact.3").claimStrength, "descriptive", "contested replication caps at descriptive even WITH a mechanism string");
});

test("cases: >=2 documented specifics → PARTIAL scene license; a fictional source device requires framing; 'full' sufficiency is never minted", () => {
  const { plan } = compileSourceUsePlan(mkPacket());
  const violin = unitById(plan, "unit.case.ch01.ex.violin");
  assert.deepEqual(
    [violin.origin, violin.form, violin.claimStrength, violin.detailSufficiency, violin.caseId, violin.framingRequired],
    ["source_bound", "case", "descriptive", "partial", "ch01.ex.violin", false],
    "a documented real case scenes under PARTIAL sufficiency at DESCRIPTIVE strength (the F-C causal-overreach fix)",
  );
  assert.ok(violin.forbiddenDetailTypes.includes("invented_dialogue") && violin.forbiddenDetailTypes.includes("asserted_causation"), "case prohibitions carried categorically");
  const device = unitById(plan, "unit.case.ch01.ex.device");
  assert.equal(device.framingRequired, true, "the book's own fictional device must be framed as a device, never history");
  assert.ok(plan.units.every((u) => u.detailSufficiency !== "full"), "'full' scene sufficiency is never minted by the v1 compiler");
});

test("red-team: a sourced case with ONE hard specific gets NO scene license — it degrades to explanation-only (concept_only)", () => {
  const { plan, findings } = compileSourceUsePlan(mkPacket({
    namedCases: [{ id: "ch01.ex.thin", label: "Thin case", summary: "One token.", realWorld: true, hardSpecifics: ["one token"], allowedUses: [], forbiddenUses: [], doNotRestamp: [] }],
  }));
  const thin = unitById(plan, "unit.case.ch01.ex.thin");
  assert.equal(thin.form, "explanation", "no case-form unit exists for the under-evidenced case");
  assert.equal(thin.detailSufficiency, "concept_only");
  assert.ok(plan.units.every((u) => !(u.form === "case" && u.caseId === "ch01.ex.thin")), "a full scene can never be assigned to a one-specific case");
  assert.ok(findings.some((f) => f.includes("no scene license")), "the degrade is a loud compile finding");
});

test("chapter invented-material licenses: constructed application (framed), generic scenario (role labels), analogy (framed) — all descriptive, none causal-capable", () => {
  const { plan } = compileSourceUsePlan(mkPacket());
  const constructed = unitById(plan, "unit.ch01.constructed-application");
  assert.deepEqual([constructed.origin, constructed.form, constructed.framingRequired, constructed.claimStrength], ["constructed", "application", true, "descriptive"]);
  assert.ok(constructed.forbiddenDetailTypes.includes("real_person"), "constructed content can never borrow a real person into an invented event");
  const generic = unitById(plan, "unit.ch01.generic-scenario");
  assert.deepEqual([generic.origin, generic.form, generic.framingRequired], ["generic", "operational_scenario", false]);
  assert.ok(generic.allowedDetailTypes.includes("role_label") && generic.forbiddenDetailTypes.includes("named_person"), "generic scenarios use role labels, never names");
  const analogy = unitById(plan, "unit.ch01.analogy");
  assert.deepEqual([analogy.origin, analogy.form, analogy.framingRequired], ["constructed", "analogy", true]);
  // Compiler-wide ceiling: the strongest supported relation, never beyond.
  for (const u of plan.units) {
    assert.ok(claimStrengthRank(u.claimStrength) <= claimStrengthRank(COMPILER_MAX_CLAIM_STRENGTH), `${u.unitId} stays at/below the ${COMPILER_MAX_CLAIM_STRENGTH} ceiling`);
  }
  assert.ok(plan.units.every((u) => u.claimStrength !== "causal"), "causal is NEVER minted (no sidecar field attests it)");
  assert.equal(CLAIM_STRENGTH_ORDER[CLAIM_STRENGTH_ORDER.length - 1], "causal", "the ladder tops at causal");
});

test("determinism + hash binding: identical packet → identical hash; the plan pins the exact packet bytes; any packet change → stale", () => {
  const packet = mkPacket();
  const a = compileSourceUsePlan(packet).plan;
  const b = compileSourceUsePlan(mkPacket()).plan;
  assert.equal(sourceUsePlanHash(a), sourceUsePlanHash(b), "deterministic: same packet → same plan hash");
  assert.equal(a.sourcePacketSha256, sourcePacketHash(packet), "the plan is hash-bound to the packet it was compiled from");
  assert.equal(sourceUsePlanStale(a, packet), null, "fresh against its own packet");
  const mutated = mkPacket();
  mutated.facts[0].claim = "A silently edited claim.";
  assert.match(sourceUsePlanStale(a, mutated) ?? "", /live packet hashes/, "any packet mutation stales the plan");
  assert.match(sourceUsePlanStale(a, mkPacket({ chapterNumber: 2, chapterId: "zz-plan-ch02" })) ?? "", /identity/, "identity mismatch is stale too");
});

test("anchor resolution: catalog ids anchor themselves; a missing id falls back to the concept anchor WITH a finding; an empty catalog omits the unit (nothing licensed by omission)", () => {
  const fallback = compileSourceUsePlan(mkPacket({
    namedCases: [{ id: "ch01.case.minted", label: "Fallback case", summary: "Not in the anchor catalog.", realWorld: true, hardSpecifics: ["a", "b"], allowedUses: [], forbiddenUses: [], doNotRestamp: [] }],
  }));
  assert.deepEqual(unitById(fallback.plan, "unit.case.ch01.case.minted").anchorIds, ["ch01.concept.core"], "falls back to the concept anchor");
  assert.ok(fallback.findings.some((f) => f.includes("not in the anchor catalog")), "fallback is a loud finding");

  const empty = compileSourceUsePlan(mkPacket({ allowedAnchors: [] }));
  assert.ok(empty.plan.units.every((u) => u.origin !== "source_bound"), "with no catalog, NO source-bound unit is minted — absence never grants");
  assert.ok(empty.findings.some((f) => f.includes("unit omitted")), "omissions are loud findings");
  assert.deepEqual(validateSourceUsePlan(empty.plan), [], "the degraded plan still passes the contract (invented licenses remain)");
});

// ── forbidden combinations (frozen-contract validator) ────────────────────────

test("contract validator rejects every forbidden combination before authoring", () => {
  const base = compileSourceUsePlan(mkPacket()).plan;
  const withUnit = (unit: SourceUsePlanUnitV1): SourceUsePlanV1 => ({ ...base, units: [unit] });
  const violin = unitById(base, "unit.case.ch01.ex.violin");

  assert.ok(validateSourceUsePlan(withUnit({ ...violin, anchorIds: [] })).some((e) => e.includes("at least one anchor")), "sourced-without-evidence rejected");
  const constructed = unitById(base, "unit.ch01.constructed-application");
  assert.ok(validateSourceUsePlan(withUnit({ ...constructed, framingRequired: false })).some((e) => e.includes("framingRequired")), "constructed-without-framing rejected");
  assert.ok(validateSourceUsePlan(withUnit({ ...violin, detailSufficiency: "concept_only" })).some((e) => e.includes("concept_only")), "concept-only sourced scene rejected");
  assert.ok(validateSourceUsePlan(withUnit({ ...constructed, claimStrength: "causal" })).some((e) => e.includes("causal")), "constructed/generic causal claim strength rejected (claim cannot exceed source support)");
  const { caseId: _dropped, ...caseless } = violin;
  assert.ok(validateSourceUsePlan(withUnit(caseless as SourceUsePlanUnitV1)).some((e) => e.includes("caseId")), "a sourced case without case binding rejected");
});

// ── relabel containment ───────────────────────────────────────────────────────

test("embeddedPlanMutationFindings: reserved plan-control keys are found at ANY depth; clean chapters scan clean; content STRINGS are never flagged", () => {
  assert.deepEqual(embeddedPlanMutationFindings({ chapterId: "zz-ch01", title: "clean", quiz: { questions: [{ prompt: "What is claim strength in negotiation?" }] } }), [], "keys only — prose discussing the words is fine");
  assert.deepEqual(embeddedPlanMutationFindings({ sourceUsePlan: { units: [] } }), ["sourceUsePlan"], "top-level relabel found");
  const nested = embeddedPlanMutationFindings({ examples: [{ title: "x" }, { title: "y", claimStrength: "causal" }] });
  assert.deepEqual(nested, ["examples[1].claimStrength"], "a smuggled upgrade INSIDE an example is found with its path");
});

// ── card rendering ────────────────────────────────────────────────────────────

test("plan card block: compact, grouped, hash-stamped; carries the scene license, the no-scene line, and the device framing", () => {
  const packet = mkPacket();
  const { plan } = compileSourceUsePlan(packet);
  const lines = renderSourceUsePlanLines(plan);
  const block = lines.join("\n");
  assert.ok(block.startsWith("SOURCE-USE PLAN (compiler-owned; plan "), "header names the owner and stamps the hash");
  assert.ok(block.includes(sourceUsePlanHash(plan).slice(0, 16)), "the plan hash rides the block");
  assert.ok(block.includes("ch01.ex.violin") && block.includes("PARTIAL detail"), "the scene license is rendered per case");
  assert.ok(block.includes("ch01.ex.thin: NO scene license"), "the explanation degrade is rendered as an explicit no-scene line");
  assert.ok(block.includes("present it as the book's device"), "device framing rendered");
  assert.ok(block.includes("Direct conceptual explanation is a first-class form"), "direct explanation is affirmatively licensed, never penalized");
  assert.ok(block.length <= 2800, `plan block stays compact (<= 2,800 chars), got ${block.length}`);
  assert.ok(lines.length <= 16, `grouped rendering (no per-fact line explosion), got ${lines.length} lines`);
});

test("author card: WITH a plan the SOURCE-USE PLAN block renders; WITHOUT one the card is byte-free of it (legacy path)", () => {
  const packet = mkPacket();
  const { plan } = compileSourceUsePlan(packet);
  const base = { bookId: "zz-plan", chapterNumber: 1, briefMd: "# brief\n", packet, voice: null };
  const withPlan = buildAuthorCard({ ...base, plan });
  assert.ok(withPlan.includes("SOURCE-USE PLAN (compiler-owned"), "plan block present");
  assert.ok(withPlan.includes("cannot relabel origin, form, claim strength"), "immutability instruction present");
  assert.ok(withPlan.length <= 25000, `a plan-bearing card stays under the AUTHOR_CARD_MAX_CHARS ceiling, got ${withPlan.length}`);
  const without = buildAuthorCard(base);
  assert.ok(!without.includes("SOURCE-USE PLAN"), "no plan → no block (legacy books render as before)");
});

// ── SP15/SP16 gate wiring ─────────────────────────────────────────────────────

function mkGatePacket(): SourcePacketV1 {
  // validateSourcePacket demands >= 6 pedagogically complete facts.
  const facts = [1, 2, 3, 4, 5, 6].map((i) => mkFact(`ch01.fact.${i}`));
  return mkPacket({
    facts,
    allowedAnchors: [
      anchorFor("ch01.concept.core", "concept"),
      ...facts.map((f) => anchorFor(f.id, "testable_fact")),
      anchorFor("ch01.ex.violin", "named_example"),
      anchorFor("ch01.ex.thin", "named_example"),
      anchorFor("ch01.ex.device", "named_example"),
    ],
    namedCases: [
      { id: "ch01.ex.violin", label: "Ericsson violin study", summary: "Berlin conservatory practice diaries.", realWorld: true, hardSpecifics: ["Berlin conservatory", "practice diaries"], allowedUses: [], forbiddenUses: [], doNotRestamp: [] },
    ],
  });
}

function gateFixture(book: string): { roots: { stateRoot: string }; packet: SourcePacketV1 } {
  const stateRoot = join(TMP, `gate-${book}`);
  writeJsonFile(join(stateRoot, "indexes", `${book}.json`), [
    { chapterId: `${book}-ch01`, chapterNumber: 1, chapterTitle: "Deliberate Practice" },
  ]);
  const packet = { ...mkGatePacket(), bookId: book, chapterId: `${book}-ch01` };
  const roots = { stateRoot };
  writeJsonFile(sourcePacketPath(book, 1, roots), packet);
  return { roots, packet };
}

test("gate: a fresh plan passes; a MISSING plan is advisory-only (legacy books keep passing)", () => {
  const { roots, packet } = gateFixture("zz-gate-fresh");
  writeJsonFile(sourceUsePlanPath("zz-gate-fresh", 1, roots), compileSourceUsePlan(packet).plan);
  const fresh = checkSourcePacketGate("zz-gate-fresh", roots);
  assert.equal(fresh.passed, true, `fresh plan gate passes: ${JSON.stringify(fresh.findings.filter((f) => f.severity === "blocker"))}`);
  assert.ok(!fresh.findings.some((f) => f.checkId.startsWith("SP15") || f.checkId.startsWith("SP16")), "no plan findings on a fresh plan");

  const legacy = gateFixture("zz-gate-legacy");
  const report = checkSourcePacketGate("zz-gate-legacy", legacy.roots);
  assert.equal(report.passed, true, "a plan-less legacy book still PASSES");
  const missing = report.findings.find((f) => f.checkId === "SP15.plan_missing");
  assert.equal(missing?.severity, "advisory", "absence is an advisory, never a blocker");
});

test("gate: an INVALID plan blocks (SP15); a STALE plan blocks (SP16) — present-but-wrong always fails closed", () => {
  const invalid = gateFixture("zz-gate-invalid");
  const badPlan = { ...compileSourceUsePlan(invalid.packet).plan, schema: "wrong-tag" };
  writeJsonFile(sourceUsePlanPath("zz-gate-invalid", 1, invalid.roots), badPlan);
  const invalidReport = checkSourcePacketGate("zz-gate-invalid", invalid.roots);
  assert.equal(invalidReport.passed, false);
  assert.ok(invalidReport.findings.some((f) => f.checkId === "SP15.plan_invalid" && f.severity === "blocker"), "SP15 blocker on contract violation");

  const stale = gateFixture("zz-gate-stale");
  writeJsonFile(sourceUsePlanPath("zz-gate-stale", 1, stale.roots), compileSourceUsePlan(stale.packet).plan);
  const drifted = { ...stale.packet, facts: stale.packet.facts.map((f, i) => (i === 0 ? { ...f, claim: "Recompiled claim." } : f)) };
  writeJsonFile(sourcePacketPath("zz-gate-stale", 1, stale.roots), drifted);
  const staleReport = checkSourcePacketGate("zz-gate-stale", stale.roots);
  assert.equal(staleReport.passed, false);
  assert.ok(staleReport.findings.some((f) => f.checkId === "SP16.plan_stale" && f.severity === "blocker"), "SP16 blocker on packet drift");
});

// ── write-path enforcement ────────────────────────────────────────────────────

function mkWriteBrief(): ChapterBriefV1 {
  return {
    schemaVersion: CHAPTER_BRIEF_SCHEMA_VERSION,
    chapterId: "zz-plan-ch01",
    chapterNumber: 1,
    title: "Deliberate Practice",
    coreMove: "One move.",
    thesis: "One thesis.",
    readerPromise: "One promise.",
    ownedCases: [],
    notYours: [],
    cast: [],
    answerIndexPattern: [0, 1, 2, 0, 1, 2, 0, 1, 2],
    avoid: [],
    lengthBudget: { renderedChars: 16000, tolerance: 0.2 },
    flavor: [],
    openerType: "question",
    challengeFrame: "before-your-next-X",
    practiceShape: "single-imperative",
  };
}

type WriteRig = {
  deps: AutopilotDeps;
  io: Partial<AuthorIo>;
  spawns: Array<{ sessionId: string; task: string; cwd?: string }>;
  writes: string[];
  packetReads: number;
};

function mkWriteRig(opts: {
  plan?: SourceUsePlanV1 | null;
  planThrows?: boolean;
  packet?: SourcePacketV1;
  packetAfterFirstRead?: SourcePacketV1;
  draft?: unknown;
}): WriteRig {
  const packet = opts.packet ?? mkPacket();
  const spawns: WriteRig["spawns"] = [];
  const writes: string[] = [];
  const rig: WriteRig = { spawns, writes, packetReads: 0 } as WriteRig;
  let sid = 0;
  const draft = opts.draft ?? { chapterId: "zz-plan-ch01", number: 1, title: "Draft chapter" };
  rig.deps = {
    runVerb: async () => ({ code: 0, stdout: "", stderr: "" }),
    spawn: (async (o: { sessionId: string; cwd?: string; task: string }) => {
      spawns.push({ sessionId: o.sessionId, task: o.task, cwd: o.cwd });
      if (o.cwd) writeFileSync(join(o.cwd, chapterFileName("zz-plan-ch01")), JSON.stringify(draft, null, 2) + "\n");
      return { ok: true, exitCode: 0, finalMessage: "done", stdout: "", stderr: "", durationMs: 1, sessionId: o.sessionId };
    }) as unknown as AutopilotDeps["spawn"],
    mkSessionId: (label: string) => `${label}#${++sid}`,
    expectedChapterNumbers: () => [1],
    logSession: () => {},
    log: () => {},
  } as unknown as AutopilotDeps;
  const files = new Map<number, string>();
  rig.io = {
    chapterExists: (_b, n) => files.has(n),
    readChapterFile: (_b, n) => files.get(n) ?? null,
    writeChapterFile: (_b, n, bytes) => { writes.push(bytes); files.set(n, bytes); },
    removeChapterFile: (_b, n) => { files.delete(n); },
    readBriefMd: () => "# brief\n",
    readBrief: () => mkWriteBrief(),
    readPacket: () => {
      rig.packetReads++;
      return rig.packetReads > 1 && opts.packetAfterFirstRead ? opts.packetAfterFirstRead : packet;
    },
    readSourcePlan: () => {
      if (opts.planThrows) throw new Error("plan file is corrupt JSON");
      return opts.plan ?? null;
    },
    loadChapters: () => [],
    nameBankOk: () => true,
    voiceCard: () => null,
    authorSessionOf: () => undefined,
    recordProvenance: () => {},
    readLeadOverride: () => null,
    writeLeadOverride: () => {},
    attemptsRoot: () => join(TMP, "attempts"),
    gateCandidate: async () => ({ code: 0, stdout: "Gate verdict: PASS — 0 blockers", stderr: "" }),
    rubricWithCandidate: async () => ({ code: 0, stdout: "", stderr: "" }),
  };
  return rig;
}

test("write path: a STALE plan refuses BEFORE any spawn; an invalid plan refuses; a corrupt plan file refuses (never fail-open to legacy)", async () => {
  const packet = mkPacket();
  const plan = compileSourceUsePlan(packet).plan;
  const drifted = mkPacket();
  drifted.facts[0].claim = "Drifted.";

  const stale = mkWriteRig({ plan, packet: drifted });
  const r1 = await authorWriteOneChapter("zz-plan", 1, stale.deps, { io: stale.io, totalChapters: 2 });
  assert.ok(!r1.ok && /STALE/.test(r1.ok ? "" : r1.reason), "stale plan fails closed");
  assert.equal(stale.spawns.length, 0, "no writer spawn under a stale plan");

  const invalid = mkWriteRig({ plan: { ...plan, schema: "wrong" } as unknown as SourceUsePlanV1, packet });
  const r2 = await authorWriteOneChapter("zz-plan", 1, invalid.deps, { io: invalid.io, totalChapters: 2 });
  assert.ok(!r2.ok && /frozen contract/.test(r2.ok ? "" : r2.reason), "contract-invalid plan fails closed");

  const corrupt = mkWriteRig({ planThrows: true, packet });
  const r3 = await authorWriteOneChapter("zz-plan", 1, corrupt.deps, { io: corrupt.io, totalChapters: 2 });
  assert.ok(!r3.ok && /unreadable/.test(r3.ok ? "" : r3.reason), "a present-but-corrupt plan is NEVER treated as no-plan");
  assert.equal(corrupt.spawns.length, 0);
});

test("write path: NO plan → legacy behavior (writes succeed, card has no plan block, attempt identity carries no sourcePlanHash)", async () => {
  const rig = mkWriteRig({ plan: null });
  const r = await authorWriteOneChapter("zz-plan", 1, rig.deps, { io: rig.io, totalChapters: 2 });
  assert.ok(r.ok, `legacy write succeeds: ${r.ok ? "" : r.reason}`);
  assert.equal(rig.writes.length, 1, "committed");
  assert.ok(!rig.spawns[0].task.includes("SOURCE-USE PLAN"), "no plan block on the legacy card");
  const attemptDirs = readdirSync(join(TMP, "attempts", "zz-plan", "ch01"));
  const identities = attemptDirs
    .map((d) => { try { return JSON.parse(readFileSync(join(TMP, "attempts", "zz-plan", "ch01", d, "attempt.json"), "utf8")); } catch { return null; } })
    .filter(Boolean) as Array<Record<string, unknown>>;
  assert.ok(identities.length > 0, "attempt identity persisted");
  assert.ok(identities.every((a) => !("sourcePlanHash" in a)), "no sourcePlanHash key on legacy attempts");
});

test("write path: a FRESH plan rides the card (block + hash) and the attempt identity binds sourcePlanHash + input hashes", async () => {
  const packet = mkPacket({ bookId: "zz-plan-fresh", chapterId: "zz-plan-fresh-ch01" });
  const plan = compileSourceUsePlan(packet).plan;
  const rig = mkWriteRig({ plan, packet, draft: { chapterId: "zz-plan-fresh-ch01", number: 1, title: "Draft" } });
  const deps = rig.deps as unknown as { spawn: unknown };
  // Redirect the fake writer at the fresh book's candidate name.
  deps.spawn = (async (o: { sessionId: string; cwd?: string; task: string }) => {
    rig.spawns.push({ sessionId: o.sessionId, task: o.task, cwd: o.cwd });
    if (o.cwd) writeFileSync(join(o.cwd, chapterFileName("zz-plan-fresh-ch01")), JSON.stringify({ chapterId: "zz-plan-fresh-ch01", number: 1, title: "Draft" }, null, 2) + "\n");
    return { ok: true, exitCode: 0, finalMessage: "done", stdout: "", stderr: "", durationMs: 1, sessionId: o.sessionId };
  });
  const r = await authorWriteOneChapter("zz-plan-fresh", 1, rig.deps, { io: rig.io, totalChapters: 2 });
  assert.ok(r.ok, `plan-bearing write succeeds: ${r.ok ? "" : r.reason}`);
  assert.ok(rig.spawns[0].task.includes("SOURCE-USE PLAN (compiler-owned"), "plan block rides the card");
  assert.ok(rig.spawns[0].task.includes(sourceUsePlanHash(plan).slice(0, 16)), "plan hash rides the card");
  const chDir = join(TMP, "attempts", "zz-plan-fresh", "ch01");
  const identities = readdirSync(chDir)
    .map((d) => { try { return JSON.parse(readFileSync(join(chDir, d, "attempt.json"), "utf8")); } catch { return null; } })
    .filter(Boolean) as Array<Record<string, unknown>>;
  const bound = identities.find((a) => a.sourcePlanHash === sourceUsePlanHash(plan));
  assert.ok(bound, "attempt identity carries the exact plan hash");
  const inputHashes = bound!.inputHashes as Record<string, string>;
  assert.equal(inputHashes.sourcePacket, sourcePacketHash(packet), "input hashes bind the packet");
  assert.equal(inputHashes.sourceUsePlan, sourceUsePlanHash(plan), "input hashes bind the plan");
  assert.ok(inputHashes.writerProjection?.length === 64, "input hashes bind the projection");
});

test("write path: a candidate embedding plan-control fields FAILS the attempt, never touches canonical, and the retry card routes the writer upstream", async () => {
  const packet = mkPacket();
  const plan = compileSourceUsePlan(packet).plan;
  const rig = mkWriteRig({
    plan, packet,
    draft: { chapterId: "zz-plan-ch01", number: 1, title: "Relabel attempt", sourceUsePlan: { units: [] }, examples: [{ title: "x", claimStrength: "causal" }] },
  });
  const r = await authorWriteOneChapter("zz-plan", 1, rig.deps, { io: rig.io, totalChapters: 2 });
  assert.ok(!r.ok, "relabel attempts fail");
  if (!r.ok) assert.match(r.reason, /control field/, "the halt names the containment");
  assert.deepEqual(rig.writes, [], "zero canonical writes — the relabel died in its workspace");
  assert.equal(rig.spawns.length, 2, "the bounded retry ran (1 + AUTHOR_WRITE_GATE_RETRIES)");
  assert.ok(rig.spawns[1].task.includes("PREVIOUS ATTEMPT EMBEDDED PLAN CONTROL FIELDS"), "the retry card explains the containment");
  assert.ok(rig.spawns[1].task.includes("do not relabel"), "and routes a disputed license upstream instead");
});

test("write path: a packet recompiled MID-ATTEMPT is caught at commit (freshness re-check) — the candidate is rejected, canonical untouched", async () => {
  const packet = mkPacket();
  const plan = compileSourceUsePlan(packet).plan;
  const drifted = mkPacket();
  drifted.facts[0].claim = "Recompiled mid-attempt.";
  const rig = mkWriteRig({ plan, packet, packetAfterFirstRead: drifted });
  const r = await authorWriteOneChapter("zz-plan", 1, rig.deps, { io: rig.io, totalChapters: 2 });
  assert.ok(!r.ok, "mid-attempt drift rejects the commit");
  if (!r.ok) assert.match(r.reason, /STALE mid-attempt/);
  assert.deepEqual(rig.writes, [], "no canonical write under stale lineage");
  assert.ok(rig.packetReads >= 2, "the packet was re-read at commit time");
});

// ── repair-path enforcement ───────────────────────────────────────────────────

function mkRepairChapter(): ChapterV21 {
  return {
    schemaVersion: "chapterflow-v21-authored",
    chapterId: "zz-plan-ch01",
    number: 1,
    title: "Deliberate Practice",
    quiz: {
      passingScorePercent: 70,
      questions: [
        { questionId: "q01", prompt: "Q1?", choices: ["Right move.", "Wrong move.", "Other move."], correctIndex: 0, explanation: "Because the mechanism says so at length." },
        { questionId: "q02", prompt: "Q2?", choices: ["A.", "B is right.", "C."], correctIndex: 1, explanation: "Because the deep read grounds it mechanically." },
      ],
    },
  } as unknown as ChapterV21;
}

function mkRepairIo(opts: {
  original: ChapterV21;
  plan: SourceUsePlanV1 | null;
  packet: SourcePacketV1 | null;
}): { io: AuthorIo; writes: string[] } {
  const writes: string[] = [];
  const files = new Map<number, string>([[1, JSON.stringify(opts.original, null, 2) + "\n"]]);
  const io = resolveAuthorIo({
    chapterExists: (_b, n) => files.has(n),
    readChapterFile: (_b, n) => files.get(n) ?? null,
    writeChapterFile: (_b, n, bytes) => { writes.push(bytes); files.set(n, bytes); },
    removeChapterFile: (_b, n) => { files.delete(n); },
    readBriefMd: () => "# brief\n",
    readBrief: () => null,
    readPacket: () => opts.packet,
    readSourcePlan: () => opts.plan,
    loadChapters: () => [JSON.parse(files.get(1)!)],
    nameBankOk: () => true,
    voiceCard: () => null,
    authorSessionOf: () => undefined,
    recordProvenance: () => {},
    readLeadOverride: () => null,
    writeLeadOverride: () => {},
    attemptsRoot: () => join(TMP, "attempts-repair"),
    gateCandidate: async () => ({ code: 0, stdout: "Gate verdict: PASS — 0 blockers", stderr: "" }),
    rubricWithCandidate: async () => ({ code: 0, stdout: "ch01: PASS", stderr: "" }),
  });
  return { io, writes };
}

function mkRepairDeps(repaired: unknown, spawns: Array<{ cwd?: string }>): AutopilotDeps {
  return {
    runVerb: async () => ({ code: 0, stdout: "", stderr: "" }),
    spawn: (async (o: { sessionId: string; cwd?: string }) => {
      spawns.push({ cwd: o.cwd });
      if (o.cwd) writeFileSync(join(o.cwd, chapterFileName("zz-plan-ch01")), JSON.stringify(repaired, null, 2) + "\n");
      return { ok: true, exitCode: 0, finalMessage: "done", stdout: "", stderr: "", durationMs: 1, sessionId: o.sessionId };
    }) as unknown as AutopilotDeps["spawn"],
    mkSessionId: (label: string) => label,
    expectedChapterNumbers: () => [1],
    logSession: () => {},
    log: () => {},
  } as unknown as AutopilotDeps;
}

test("repair card: the plan block + enveloped reviewer criteria/advisories render; the plan is instruction, the findings are data", () => {
  const packet = mkPacket();
  const { plan } = compileSourceUsePlan(packet);
  const card = buildRepairCard({
    bookId: "zz-plan",
    chapter: mkRepairChapter(),
    complaints: ["quiz Q2: the key echoes the prose"],
    scopes: ["quiz"],
    relPath: "zz-plan-ch01.v21-native.chapter.json",
    plan,
  });
  assert.ok(card.includes("SOURCE-USE PLAN (compiler-owned"), "plan block renders on the repair card");
  assert.ok(card.includes('<chapterflow_untrusted_artifact type="reviewer-finding"'), "criteria are data-enveloped");
  assert.ok(card.includes("- quiz Q2: the key echoes the prose"), "criteria bullets byte-preserved inside the envelope");
});

test("repair path: a repaired scope smuggling a plan-control key is rejected AFTER splice, before any commit", async () => {
  const original = mkRepairChapter();
  const packet = mkPacket();
  const { plan } = compileSourceUsePlan(packet);
  const repaired = JSON.parse(JSON.stringify(original)) as Record<string, unknown>;
  (repaired.quiz as { questions: Array<Record<string, unknown>> }).questions[1].claimStrength = "causal";
  (repaired.quiz as { questions: Array<Record<string, unknown>> }).questions[1].prompt = "Q2 edited?";
  const spawns: Array<{ cwd?: string }> = [];
  const { io, writes } = mkRepairIo({ original, plan, packet });
  const r = await doRepairOneChapter("zz-plan", 1, mkRepairDeps(repaired, spawns), {
    io, scopes: ["quiz"], complaints: ["quiz Q2: the key echoes the prose"],
  });
  assert.ok(!r.ok, "smuggled relabel rejected");
  assert.match(r.reason ?? "", /control field/);
  assert.deepEqual(writes, [], "canonical bytes untouched");
  assert.equal(spawns.length, 1, "the repair spawn ran once (rejection is post-splice, pre-commit)");
});

test("repair path: a STALE plan refuses before any spawn; a clean scoped repair under a FRESH plan still commits", async () => {
  const original = mkRepairChapter();
  const packet = mkPacket();
  const { plan } = compileSourceUsePlan(packet);
  const driftedPacket = mkPacket();
  driftedPacket.facts[0].claim = "Drifted.";

  const staleSpawns: Array<{ cwd?: string }> = [];
  const stale = mkRepairIo({ original, plan, packet: driftedPacket });
  const r1 = await doRepairOneChapter("zz-plan", 1, mkRepairDeps(original, staleSpawns), {
    io: stale.io, scopes: ["quiz"], complaints: ["quiz Q2: x"],
  });
  assert.ok(!r1.ok && /STALE/.test(r1.reason ?? ""), "stale plan refuses the repair");
  assert.equal(staleSpawns.length, 0, "no spawn under a stale plan");

  const repaired = JSON.parse(JSON.stringify(original)) as ChapterV21;
  repaired.quiz.questions[1].prompt = "Q2, sharpened without any relabel?";
  const freshSpawns: Array<{ cwd?: string }> = [];
  const fresh = mkRepairIo({ original, plan, packet });
  const r2 = await doRepairOneChapter("zz-plan", 1, mkRepairDeps(repaired, freshSpawns), {
    io: fresh.io, scopes: ["quiz"], complaints: ["quiz Q2: x"],
  });
  assert.ok(r2.ok, `clean scoped repair commits: ${r2.reason ?? ""}`);
  assert.equal(fresh.writes.length, 1, "one canonical commit");
});
