import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, rmdirSync, rmSync, readdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { test } from "./harness.js";
import { STATE_CHAPTERS, makeChapter, writeFixtureBook } from "./helpers.js";
import { keyPackDir } from "../src/qc/manualKeyJudge.js";
import { writeSweepPack } from "../src/qc/sweep.js";
import { orchestratorRoundDir } from "../src/qc/orchestrator/artifacts.js";
import { writeReviewPacket } from "../src/qc/orchestrator/reviewPacket.js";
import { validateSubmission } from "../src/qc/orchestrator/schemas.js";
import {
  SWEEP_FAMILY_SPECS,
  renderSweepFamilyRubric,
  SWEEP_SUBMISSION_SCHEMA_ID,
} from "../src/qc/sweepSpec.js";
import {
  buildVarietyScoutTask,
  scoutCrossChapterVariety,
  persistPreflightScoutRead,
  type AutopilotDeps,
  type VarietyScoutResult,
} from "../src/orchestrator/autopilot.js";
import { CANONICAL_STATE } from "../src/lib/chapterPaths.js";

// ── STEP 1 — the sweep pack is byte-identical after the sweepSpec extraction ────
// This golden hash was captured on `main` (pre-refactor) and asserted equal in the worktree
// (post-refactor): the pure extraction of the family ids / normalizer / severity rules into
// sweepSpec did NOT move a single byte of the rendered sweep pack. `createdAt` (the only
// nondeterministic field) is stripped before hashing.
//
// REBASED 2026-07-03 (S-tier campaign): makeChapter's practice-opener clauses now rotate
// by chapter number (helpers.ts — the fixed openers tripped CHB7's scaffold-family cap once
// the reader budgets started running at doAuthorReview entry). The hash moved through the
// FIXTURE INPUT, not the sweep-pack rendering (no sweep/keyPack code changed in the campaign
// — verified by diffing the pack fields against the fixture delta before rebasing).
const SWEEP_PACK_GOLDEN_SHA256 = "078d4c15052275151681e9eebbdcf87391a2a33a14a7f6ea8677b6503a409e51";
const PACK_BOOK = "zz-fixture-packsnap";
const PACK_ROUND = "r-packsnap";
const QC_PACK_BOOK_DIR = dirname(keyPackDir(PACK_BOOK, PACK_ROUND));
const QC_PACKS_DIR = dirname(QC_PACK_BOOK_DIR);
const QC_PREFLIGHT_DIR = resolve(CANONICAL_STATE, "qc-preflight");
const QC_PACKS_DIR_EXISTED = existsSync(QC_PACKS_DIR);
const QC_PREFLIGHT_DIR_EXISTED = existsSync(QC_PREFLIGHT_DIR);

function cleanupPack(): void {
  rmSync(resolve(STATE_CHAPTERS, `${PACK_BOOK}-ch01.v21-native.chapter.json`), { force: true });
  rmSync(resolve(STATE_CHAPTERS, `${PACK_BOOK}-ch02.v21-native.chapter.json`), { force: true });
  rmSync(QC_PACK_BOOK_DIR, { recursive: true, force: true });
  if (!QC_PACKS_DIR_EXISTED && existsSync(QC_PACKS_DIR) && readdirSync(QC_PACKS_DIR).length === 0) rmdirSync(QC_PACKS_DIR);
}

test("STEP 1: sweep-pack snapshot is byte-identical to the pre-extraction golden (pure extraction proof)", () => {
  try {
    cleanupPack();
    writeFixtureBook(STATE_CHAPTERS, [makeChapter(PACK_BOOK, 1), makeChapter(PACK_BOOK, 2)]);
    const pack = JSON.parse(readFileSync(writeSweepPack(PACK_BOOK, PACK_ROUND), "utf8"));
    delete pack.createdAt;
    const sha = createHash("sha256").update(JSON.stringify(pack, null, 2)).digest("hex");
    assert.equal(sha, SWEEP_PACK_GOLDEN_SHA256, "sweep pack bytes changed — the extraction was NOT behavior-neutral");
  } finally {
    cleanupPack();
  }
});

// ── STEP 2 — the scout and the formal sweep quote IDENTICAL family definitions ──
test("the sweepSpec family rubric contains every family definition verbatim", () => {
  const rubric = renderSweepFamilyRubric();
  for (const spec of SWEEP_FAMILY_SPECS) {
    assert.ok(rubric.includes(spec.definition), `rubric must quote the ${spec.id} definition verbatim`);
    assert.ok(rubric.includes(spec.id), `rubric names the family id ${spec.id}`);
  }
});

test("the rendered scout task quotes the sweepSpec family definitions verbatim (scout speaks the sweep's language)", () => {
  const task = buildVarietyScoutTask("zz-any-book");
  const rubric = renderSweepFamilyRubric();
  assert.ok(task.includes(rubric), "the scout task renders the shared sweepSpec rubric block verbatim");
  for (const spec of SWEEP_FAMILY_SPECS) {
    assert.ok(task.includes(spec.definition), `scout task quotes the ${spec.id} definition verbatim`);
  }
  assert.ok(task.includes(SWEEP_SUBMISSION_SCHEMA_ID), "the scout is asked for the sweep's own submission schema");
});

test("the formal QC sweep card (review packet) quotes the SAME sweepSpec family definitions — one spec, two callers", () => {
  const BOOK = "zz-fixture-reviewpacket";
  const ROUND = "r-reviewpacket";
  const chapters = [makeChapter(BOOK, 1), makeChapter(BOOK, 2)];
  const tokens = { sweep: "t-sweep", keyA: "t-a", keyB: "t-b", bar: "t-bar", confirm: "t-c", major: "t-m", attest: "t-at" } as any;
  const roundDir = orchestratorRoundDir(BOOK, ROUND);
  const parentDirs = [dirname(roundDir), dirname(dirname(roundDir))].map((path) => ({ path, existed: existsSync(path) }));
  try {
    writeFixtureBook(STATE_CHAPTERS, chapters);
    const packet = readFileSync(writeReviewPacket(BOOK, ROUND, chapters, tokens), "utf8");
    const rubric = renderSweepFamilyRubric();
    assert.ok(packet.includes(rubric), "the formal sweep card renders the SAME sweepSpec rubric the scout does");
  } finally {
    rmSync(resolve(STATE_CHAPTERS, `${BOOK}-ch01.v21-native.chapter.json`), { force: true });
    rmSync(resolve(STATE_CHAPTERS, `${BOOK}-ch02.v21-native.chapter.json`), { force: true });
    rmSync(roundDir, { recursive: true, force: true });
    for (const parent of parentDirs) {
      if (!parent.existed && existsSync(parent.path) && readdirSync(parent.path).length === 0) rmdirSync(parent.path);
    }
  }
});

// ── STEP 2/5 — the scout parses with the SAME validator the sweep uses ──────────
/** Minimal deps to drive scoutCrossChapterVariety in isolation: it only needs spawn +
 *  logSession (via spawnAndLog) + mkSessionId + log. */
function scoutDeps(stdout: string): AutopilotDeps {
  return {
    mkSessionId: (label: string) => `${label}#1`,
    log: () => {},
    logSession: () => {},
    spawn: (async (o: { sessionId: string }) => ({ ok: true, exitCode: 0, finalMessage: "done", stdout, stderr: "", durationMs: 1, sessionId: o.sessionId })) as unknown as AutopilotDeps["spawn"],
  } as unknown as AutopilotDeps;
}

const FAMILIES_JSON = '"scene_skeleton","persona_drift","repeated_unit","location_stamping"';

test("shared validator: a REVISE sweep submission with NO findings is rejected by BOTH the sweep validator AND the scout", async () => {
  const bad = { schemaVersion: SWEEP_SUBMISSION_SCHEMA_ID, bookId: "zz", roundId: "r-x", role: "sweep", reviewer: "x", verdict: "REVISE", checkedFamilies: JSON.parse(`[${FAMILIES_JSON}]`), findings: [] };
  // The sweep validator rejects it (REVISE needs ≥1 quote-backed finding).
  const direct = validateSubmission("zz", "r-x", "sweep", bad);
  assert.equal(direct.ok, false, "sweep validator rejects a REVISE with no findings");

  // The scout, fed the SAME shape, rejects it too (best-effort → empty result, advance to QC).
  const res = await scoutCrossChapterVariety("zz-no-book", scoutDeps(`\`\`\`json\n${JSON.stringify({ schemaVersion: SWEEP_SUBMISSION_SCHEMA_ID, verdict: "REVISE", checkedFamilies: JSON.parse(`[${FAMILIES_JSON}]`), findings: [] })}\n\`\`\``));
  assert.equal(res.submission, null, "scout drops a submission the sweep validator would reject");
  assert.equal(res.blockingFindings.length, 0);
});

test("shared validator: a finding missing its `family` is rejected the same way (scout drops it → advance)", async () => {
  const noFamily = { schemaVersion: SWEEP_SUBMISSION_SCHEMA_ID, verdict: "REVISE", checkedFamilies: JSON.parse(`[${FAMILIES_JSON}]`), findings: [{ chapters: [1, 2], unitId: "u", quote: "a distinctive twenty plus character span here", problem: "p", expectedFix: "f", severity: "blocker" }] };
  const direct = validateSubmission("zz", "r-x", "sweep", { ...noFamily, bookId: "zz", roundId: "r-x", role: "sweep", reviewer: "x" });
  assert.equal(direct.ok, false, "sweep validator requires each finding to classify into a family");
  const res = await scoutCrossChapterVariety("zz-no-book", scoutDeps(`\`\`\`json\n${JSON.stringify(noFamily)}\n\`\`\``));
  assert.equal(res.submission, null, "scout drops a family-less finding the sweep would reject");
});

test("scout blocking parity: a distinctive scene_skeleton REVISE is parsed AND its blocking finding drives a rewrite (same gate predicate as the sweep)", async () => {
  const flag = {
    schemaVersion: SWEEP_SUBMISSION_SCHEMA_ID, verdict: "REVISE", checkedFamilies: JSON.parse(`[${FAMILIES_JSON}]`),
    findings: [{ family: "scene_skeleton", chapters: [1, 2], unitId: "examples[0].scenario", quote: "loses her voice and a substitute takes the marker under deadline", problem: "ch1 & ch2 share a frame", expectedFix: "restage ch2", severity: "blocker", moveChapter: 2, instruction: "restage ch2 onto a distinct venue" }],
  };
  const res = await scoutCrossChapterVariety("zz-no-book", scoutDeps(`\`\`\`json\n${JSON.stringify(flag)}\n\`\`\``));
  assert.ok(res.submission, "a valid sweep submission parses");
  assert.equal(res.blockingFindings.length, 1, "a distinctive scene_skeleton blocker gates (sweepFindingBlocks)");
  assert.equal(res.rewrites.length, 1);
  assert.equal(res.rewrites[0].chapter, 2, "the rewrite targets moveChapter (2), never the KEPT chapter");
});

test("scout non-distinctiveness parity: a scene_skeleton REVISE on a SHORT common phrase does NOT gate (same demotion the sweep applies)", async () => {
  const weak = {
    schemaVersion: SWEEP_SUBMISSION_SCHEMA_ID, verdict: "REVISE", checkedFamilies: JSON.parse(`[${FAMILIES_JSON}]`),
    findings: [{ family: "scene_skeleton", chapters: [1, 2], unitId: "u", quote: "had already", problem: "shared tense", expectedFix: "vary", severity: "blocker", moveChapter: 2, instruction: "vary ch2" }],
  };
  const res = await scoutCrossChapterVariety("zz-no-book", scoutDeps(`\`\`\`json\n${JSON.stringify(weak)}\n\`\`\``));
  assert.ok(res.submission, "the submission itself is schema-valid");
  assert.equal(res.blockingFindings.length, 0, "a non-distinctive (<20-char) repetition quote is surfaced but never gates — the scout uses the sweep's own predicate");
});

// ── STEP 4 — persisted scout reads are NOT QC evidence ──────────────────────────
test("STEP 4: a persisted scout read is marked role 'preqc-scout' and is REJECTED by the sweep validator (can never be ingested as QC evidence)", () => {
  const BOOK = "zz-fixture-preflight-persist";
  const dir = resolve(QC_PREFLIGHT_DIR, BOOK);
  rmSync(dir, { recursive: true, force: true });
  try {
    const parsed = validateSubmission(BOOK, "r-persist", "sweep", {
      schemaVersion: SWEEP_SUBMISSION_SCHEMA_ID, bookId: BOOK, roundId: "r-persist", role: "sweep", reviewer: "preqc-scout",
      verdict: "PASS", checkedFamilies: JSON.parse(`[${FAMILIES_JSON}]`), findings: [],
    });
    assert.equal(parsed.ok, true, "sanity: the source submission is a valid sweep PASS");
    const res: VarietyScoutResult = { rewrites: [], blockingFindings: [], submission: parsed.ok ? (parsed.submission as any) : null, fingerprints: [] };
    persistPreflightScoutRead(BOOK, res, { log: () => {} } as unknown as AutopilotDeps);

    assert.ok(existsSync(dir), "the read is persisted under state/qc-preflight/<book>/");
    const files = readdirSync(dir).filter((f) => f.endsWith(".scout-read.json"));
    assert.equal(files.length, 1, "one scout-read file written");
    const raw = JSON.parse(readFileSync(resolve(dir, files[0]), "utf8"));
    assert.equal(raw.role, "preqc-scout", "the file is marked role preqc-scout, NOT sweep");
    // The decisive isolation: fed to the SAME sweep validator, this file FAILS — so no QC0/QC3/
    // finalize/attestation path can ever count a scout read as sweep evidence.
    const asEvidence = validateSubmission(BOOK, "r-persist", "sweep", raw);
    assert.equal(asEvidence.ok, false, "a persisted scout read is invalid as a qc-sweep-submission — never QC evidence");
  } finally {
    rmSync(dir, { recursive: true, force: true });
    if (!QC_PREFLIGHT_DIR_EXISTED && existsSync(QC_PREFLIGHT_DIR) && readdirSync(QC_PREFLIGHT_DIR).length === 0) rmdirSync(QC_PREFLIGHT_DIR);
  }
});
