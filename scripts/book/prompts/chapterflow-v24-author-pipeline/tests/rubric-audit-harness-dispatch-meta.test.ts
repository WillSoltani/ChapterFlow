/** WP-E23 (P3, "a prompt string claiming Sol Ultra is not proof") — the
 * rubricAuditHarness.ts ingest ledger no longer writes a blanket model:null/
 * effort:null on a path where the caller genuinely observed a real codex-exec
 * dispatch: ingestRaterRecord/ingestAdjudicationRecord thread an optional
 * `dispatchMeta` (D7IngestDispatchMetaV1) into the WP-503 ledger entry. Proves:
 *  - a caller supplying dispatchMeta ledgers the REAL model/effort/family
 *    codex-exec — never a null standing in for a gap that is not actually
 *    there (whether the ingest itself accepts or rejects the record: the
 *    ledger append is unconditional, exactly like the pre-WP-E23 null-writing
 *    behavior it replaces) — proven via `readCallLedgerEntries` (the real
 *    on-disk ledger, model/effort ARE persisted fields today);
 *  - the exact sessionKind/attemptIndex are threaded into the `appendLedger`
 *    call args (proven via an injected capturing double — the ledger's OWN
 *    on-disk persistence of those two optional fields is WP-E41's concern,
 *    not this choke point's, and is not asserted through disk here);
 *  - a reingest keeps sessionKind "reingest" (never silently promoted to
 *    "session");
 *  - a caller that omits dispatchMeta (the external/CLI hand-off path) is
 *    UNCHANGED: family claude-side, model/effort null — proven so this slice
 *    never regresses the honest "genuinely unobservable" case.
 * Zero model/api calls (the ingest itself never invokes a model). */

import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { test } from "./harness.js";
import { mkTestRoots } from "./testRoots.js";
import { PIPELINE_DIR } from "../src/bakeoff/paths.js";
import { sha256Hex } from "../src/contracts/contractUtil.js";
import {
  RUBRIC_CALIBRATION_REFERENCES,
  materializeRubricAuditBatch,
  rubricAuditDirRelPath,
  type AuditChapter,
  type RubricAuditBatchManifestV1,
} from "../src/bakeoff/migration/rubricAuditInstrument.js";
import {
  ingestAdjudicationRecord,
  ingestRaterRecord,
} from "../src/bakeoff/migration/rubricAuditHarness.js";
import { judgeCandidateD7 } from "../src/bakeoff/d7Judge.js";
import { createD7CodexWorkerDispatch } from "../src/bakeoff/d7WorkerDispatch.js";
import type { UltraSessionRequestV1, UltraSessionResultV1, UltraSessionDepsV1 } from "../src/exec/ultraSession.js";
import { fullFixtureChapter, makeD7Repo, d7WorkerDouble } from "./model-bakeoff-d7-helpers.js";
import { appendCallLedgerEntry, readCallLedgerEntries, type RunCallLedgerEntryInput } from "../src/telemetry/runCallLedger.js";

const REPOSITORY_ROOT = resolve(PIPELINE_DIR, "../../../..");

function tinyAuditChapter(): AuditChapter {
  return {
    number: 1,
    title: "The Dispatch-Meta Fixture",
    hook: "A ledger line either tells the truth or it does not.",
    counterintuition: "A gap you cannot observe and a gap you chose not to look at read identically unless you say which.",
    tryThisNow: "Write down the one fact you actually observed before you write down the ten you assumed.",
    keyTakeaway: "Proof beats a claim; a claim beats a guess; a guess is never proof.",
    breakdown: {
      fastRead: "A ledger line is a receipt, not a caption.",
      deepRead: "Threading observed metadata through a call site is only honest if the fallback path stays honest too.",
      fullRead: "The dispatch layer already knows the real model/effort the moment a codex-exec session completes; the ingest layer only knows it if the dispatch layer hands it over. Both directions of that handoff need a test: the handoff working, and its absence staying honest.",
    },
    examples: [
      { title: "A dispatch that hands off its metadata", scenario: "The ingest ledger would otherwise write null.", whatToDo: "Thread dispatchMeta through.", whyItMatters: "A receipt should prove a route, not assert one." },
    ],
    quiz: { questions: [{ prompt: "What must a ledger line never do?", choices: ["Guess", "Record what was observed", "Stay silent"], correctIndex: 0, explanation: "A guessed value dressed up as data is worse than an honest null." }] },
    reviewCards: [{ front: "What beats a claim?", back: "Proof." }],
    implementationPlan: {
      coreSkill: "Thread only what you actually observed.",
      ifThenPlans: [{ context: "At a ledger call site", plan: "If the caller has real metadata, then use it; if not, then say null." }],
      twentyFourHourChallenge: "Find one place your own code writes a guessed value where a null belongs.",
      weeklyPractice: "Audit one ledger call site per week for a silent guess.",
    },
    memorableLines: [{ text: "A null you can trust beats a value you cannot." }],
  };
}

/** A temp repo with the frozen calibration source doc + a synthetic one-chapter
 *  package, materialized into a rubric-audit batch (mirrors rubric-audit-
 *  harness.test.ts's makeAuditRepo, minimized to this file's own need). */
function makeAuditRepo(prefix: string): { base: string; dispose: () => void; manifest: RubricAuditBatchManifestV1; unit: string } {
  const roots = mkTestRoots(prefix);
  const calibrationRel = RUBRIC_CALIBRATION_REFERENCES[0].docRelPath;
  const calibrationAbs = resolve(roots.base, calibrationRel);
  mkdirSync(dirname(calibrationAbs), { recursive: true });
  writeFileSync(calibrationAbs, readFileSync(resolve(REPOSITORY_ROOT, calibrationRel)));
  const packageRel = "book-packages/dispatch-meta-book.v21.json";
  const packageAbs = resolve(roots.base, packageRel);
  mkdirSync(dirname(packageAbs), { recursive: true });
  writeFileSync(packageAbs, JSON.stringify({ book: { slug: "dispatch-meta-book" }, chapters: [tinyAuditChapter()] }));
  const out = materializeRubricAuditBatch({
    repositoryRoot: roots.base,
    auditId: "dispatch-meta-audit-1",
    purpose: "WP-E23 dispatch-meta unit test",
    packagePath: packageRel,
    chapterNumbers: [1],
    calibrationUnit: "nudge-ch03",
    write: true,
  });
  const manifest = JSON.parse(readFileSync(out.manifestPath, "utf8")) as RubricAuditBatchManifestV1;
  return { base: roots.base, dispose: roots.dispose, manifest, unit: manifest.chapters[0].unit };
}

const pipelineDirFor = (base: string): string => resolve(base, "scripts/book/prompts/chapterflow-v24-author-pipeline");

/** Directly plant garbage-but-present primary/verification custody artifacts so
 *  `ingestAdjudicationRecord`'s existence preconditions (readCustodyText) are
 *  satisfied without needing a full domain-validated rater-record round trip —
 *  this file only exercises the LEDGER threading, never the rubric validators
 *  (those are rubric-audit-harness.test.ts's job). The adjudication record
 *  itself is expected to fail validation against this garbage (content_invalid),
 *  which is exactly the "ledgered even on rejection" path being proven. */
function plantGarbageRaterCustody(base: string, auditId: string, unit: string): void {
  const auditDir = resolve(base, rubricAuditDirRelPath(auditId));
  const write = (rel: string, body: unknown) => {
    const abs = resolve(auditDir, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, JSON.stringify(body));
  };
  write(`jobs/${unit}.inspection.json`, { placeholder: "inspection" });
  write(`jobs/${unit}.receipts/primary.dispatch.json`, { placeholder: "primary-dispatch" });
  write(`jobs/${unit}.receipts/verification.dispatch.json`, { placeholder: "verification-dispatch" });
  write(`jobs/${unit}.receipts/pair.seal.json`, { placeholder: "pair-seal" });
  write(`raw/primary/${unit}.json`, { placeholder: "primary-record" });
  write(`raw/verification/${unit}.json`, { placeholder: "verification-record" });
}

/** A capturing `appendCallLedgerEntry` double: proves the EXACT args threaded
 *  through, independent of the real ledger's own persistence of the optional
 *  sessionKind/attemptIndex fields (WP-E41's concern). */
function capturingLedger(): { calls: RunCallLedgerEntryInput[]; append: typeof appendCallLedgerEntry } {
  const calls: RunCallLedgerEntryInput[] = [];
  const append: typeof appendCallLedgerEntry = (args) => {
    calls.push(args);
    return appendCallLedgerEntry(args);
  };
  return { calls, append };
}

test("ingestRaterRecord + dispatchMeta: the on-disk ledger carries the REAL observed model/effort/family codex-exec — never null", () => {
  const repo = makeAuditRepo("dispatch-meta-primary");
  try {
    // Deliberately invalid record (validation is irrelevant to ledgering — the
    // ledger append is unconditional, mirroring the existing "a failed ingest
    // is still ledgered" proofs in rubric-audit-harness.test.ts).
    const recordText = JSON.stringify({ schema_version: "not-a-real-record" });
    assert.throws(() => ingestRaterRecord({
      repositoryRoot: repo.base,
      manifest: repo.manifest,
      unit: repo.unit,
      role: "primary",
      recordText,
      dispatchMeta: { model: "gpt-5.6-sol", effort: "ultra", sessionKind: "session", attemptIndex: 1 },
    }));

    const entries = readCallLedgerEntries(pipelineDirFor(repo.base), repo.unit, "dispatch-meta-audit-1");
    assert.equal(entries.length, 1, "the ingest attempt is ledgered even though the record was rejected");
    const [entry] = entries;
    assert.equal(entry.family, "codex-exec", "a caller that observed a real dispatch ledgers family codex-exec, never claude-side");
    assert.equal(entry.model, "gpt-5.6-sol");
    assert.equal(entry.effort, "ultra");
    assert.equal(entry.outcome, "content_invalid");
  } finally {
    repo.dispose();
  }
});

test("ingestRaterRecord + dispatchMeta: sessionKind/attemptIndex thread into the appendLedger call args (captured directly)", () => {
  const repo = makeAuditRepo("dispatch-meta-capture");
  const ledger = capturingLedger();
  try {
    const recordText = JSON.stringify({ schema_version: "not-a-real-record" });
    assert.throws(() => ingestRaterRecord({
      repositoryRoot: repo.base,
      manifest: repo.manifest,
      unit: repo.unit,
      role: "primary",
      recordText,
      dispatchMeta: { model: "gpt-5.6-sol", effort: "ultra", sessionKind: "session", attemptIndex: 3 },
      appendLedger: ledger.append,
    }));
    assert.equal(ledger.calls.length, 1);
    assert.equal(ledger.calls[0].sessionKind, "session");
    assert.equal(ledger.calls[0].attemptIndex, 3);
    assert.equal(ledger.calls[0].model, "gpt-5.6-sol");
    assert.equal(ledger.calls[0].effort, "ultra");
    assert.equal(ledger.calls[0].family, "codex-exec");
  } finally {
    repo.dispose();
  }
});

test("ingestRaterRecord + dispatchMeta sessionKind reingest: threads 'reingest', never silently promoted to 'session'", () => {
  const repo = makeAuditRepo("dispatch-meta-reingest");
  const ledger = capturingLedger();
  try {
    const recordText = JSON.stringify({ schema_version: "not-a-real-record" });
    assert.throws(() => ingestRaterRecord({
      repositoryRoot: repo.base,
      manifest: repo.manifest,
      unit: repo.unit,
      role: "verification",
      recordText,
      dispatchMeta: { model: "gpt-5.6-sol", effort: "ultra", sessionKind: "reingest", attemptIndex: 2 },
      appendLedger: ledger.append,
    }));
    assert.equal(ledger.calls.length, 1);
    assert.equal(ledger.calls[0].sessionKind, "reingest");
    assert.equal(ledger.calls[0].attemptIndex, 2);

    const entries = readCallLedgerEntries(pipelineDirFor(repo.base), repo.unit, "dispatch-meta-audit-1");
    assert.equal(entries.length, 1);
    assert.equal(entries[0].model, "gpt-5.6-sol");
    assert.equal(entries[0].effort, "ultra");
  } finally {
    repo.dispose();
  }
});

test("ingestAdjudicationRecord + dispatchMeta: same threading on the adjudicator role", () => {
  const repo = makeAuditRepo("dispatch-meta-adj");
  const ledger = capturingLedger();
  try {
    plantGarbageRaterCustody(repo.base, "dispatch-meta-audit-1", repo.unit);
    const recordText = JSON.stringify({ schema_version: "not-a-real-record" });
    assert.throws(() => ingestAdjudicationRecord({
      repositoryRoot: repo.base,
      manifest: repo.manifest,
      unit: repo.unit,
      recordText,
      dispatchMeta: { model: "gpt-5.6-sol", effort: "ultra", sessionKind: "session", attemptIndex: 1 },
      appendLedger: ledger.append,
    }));
    assert.equal(ledger.calls.length, 1, "the adjudication ingest attempt is ledgered even though the record was rejected");
    assert.equal(ledger.calls[0].role, "adjudicator");
    assert.equal(ledger.calls[0].family, "codex-exec");
    assert.equal(ledger.calls[0].model, "gpt-5.6-sol");
    assert.equal(ledger.calls[0].effort, "ultra");

    const entries = readCallLedgerEntries(pipelineDirFor(repo.base), repo.unit, "dispatch-meta-audit-1");
    assert.equal(entries.length, 1);
    assert.equal(entries[0].role, "adjudicator");
    assert.equal(entries[0].model, "gpt-5.6-sol");
  } finally {
    repo.dispose();
  }
});

test("ingestRaterRecord WITHOUT dispatchMeta: unchanged — family claude-side, model/effort stay the honest null (no regression on the hand-off path)", () => {
  const repo = makeAuditRepo("dispatch-meta-absent");
  try {
    const recordText = JSON.stringify({ schema_version: "not-a-real-record" });
    assert.throws(() => ingestRaterRecord({
      repositoryRoot: repo.base, manifest: repo.manifest, unit: repo.unit, role: "primary", recordText,
    }));
    const entries = readCallLedgerEntries(pipelineDirFor(repo.base), repo.unit, "dispatch-meta-audit-1");
    assert.equal(entries.length, 1);
    assert.equal(entries[0].family, "claude-side");
    assert.equal(entries[0].model, null);
    assert.equal(entries[0].effort, null);
    assert.equal(entries[0].sessionKind, undefined, "no dispatchMeta ⇒ sessionKind is never invented");
  } finally {
    repo.dispose();
  }
});

// ── rt FINDING A leg 1: the production-shaped flow (codex dispatch → judge → ingest) ──

const PROD_CALIBRATION_UNIT = "made-to-stick-ch04";

test("production-shaped flow (rt FINDING A leg 1): codex dispatch double → judge → ingest ACTUALLY writes the adjudicator envelope-manifest custody sidecar AND ledgers family codex-exec with the REAL model/effort (never the vestigial claude-side/null)", async () => {
  const repo = makeD7Repo("dispatch-meta-prod-flow", PROD_CALIBRATION_UNIT);
  try {
    const pipelineDir = pipelineDirFor(repo.base);
    // A runUltra double that answers every ultra request with a VALID rater record
    // (from the model-free d7WorkerDouble) written to the reply path — no process.
    // createD7CodexWorkerDispatch extracts + persists it and hands the judge back
    // the REAL observed metadata, which the judge threads into ingest.
    const base = d7WorkerDouble({ repositoryRoot: repo.base, calibrationUnit: PROD_CALIBRATION_UNIT, ratingForUnit: () => 4 });
    const runUltra = async (req: UltraSessionRequestV1, _deps?: UltraSessionDepsV1): Promise<UltraSessionResultV1> => {
      void _deps;
      const role = req.role as "primary" | "verification" | "adjudicator";
      // createD7CodexWorkerDispatch encodes (unit, role) into sessionTag = `${unit}-${role}`.
      const unit = req.sessionTag.slice(0, req.sessionTag.length - (role.length + 1));
      const kind = unit === PROD_CALIBRATION_UNIT ? "calibration" : "candidate";
      const record = await base({ auditId: req.runId, bookId: req.bookId, label: "A", unit, role, kind, task: "" });
      const replyPath = resolve(req.cwd, "reply.txt");
      writeFileSync(replyPath, record);
      return {
        ok: true, model: "gpt-5.6-sol", effort: "ultra", sessionId: `sess-${req.sessionTag}`,
        manifestPath: resolve(req.cwd, "manifest.json"),
        manifestSha256: sha256Hex(Buffer.from(`manifest-${req.sessionTag}`, "utf8")),
        replyPath, latencyMs: 4, outcome: "content_completed",
      };
    };
    const worker = createD7CodexWorkerDispatch({ runUltra, pipelineDir, clock: () => new Date("2026-07-17T00:00:00.000Z") });

    const auditId = "prod-flow-audit-1";
    const j = await judgeCandidateD7({
      bookId: "zz-d7-prodflow", label: "A", chapters: [fullFixtureChapter("zz-d7-prodflow", 1)],
      repositoryRoot: repo.base, auditId, calibrationUnit: PROD_CALIBRATION_UNIT, worker, forbidden: [], log: () => {},
    });
    assert.equal(j.terminalState, "judged", j.ineligibleReason ?? "expected a judged candidate");
    assert.equal(typeof j.d7Composite, "number");

    // The adjudicator's route-proof custody sidecar was ACTUALLY written for the
    // DECIDING (adjudicator) session of the candidate chapter — not left vestigial.
    const unit = "zz-d7-prodflow-ch01";
    const sidecarPath = resolve(repo.base, rubricAuditDirRelPath(auditId), `jobs/${unit}.receipts/adjudicator.envelope-manifest.json`);
    assert.ok(existsSync(sidecarPath), "the adjudicator envelope-manifest custody sidecar was written");
    const sidecar = JSON.parse(readFileSync(sidecarPath, "utf8")) as { envelope_manifest_sha256: string; model: string; effort: string };
    assert.match(sidecar.envelope_manifest_sha256, /^[0-9a-f]{64}$/, "the sidecar carries the ultra-session manifest sha (custody sha)");
    assert.equal(sidecar.model, "gpt-5.6-sol");
    assert.equal(sidecar.effort, "ultra");

    // The WP-503 ingest ledger for the unit records the REAL route on every role —
    // family codex-exec, real model/effort — never the vestigial claude-side/null.
    const ingestEntries = readCallLedgerEntries(pipelineDir, unit, auditId).filter((e) => e.stage === "d7-rubric-audit");
    assert.ok(ingestEntries.length >= 3, `expected ingest ledger entries for the unit's three roles (got ${ingestEntries.length})`);
    assert.ok(ingestEntries.every((e) => e.family === "codex-exec"), "every ingest entry is family codex-exec");
    assert.ok(ingestEntries.every((e) => e.model === "gpt-5.6-sol" && e.effort === "ultra"), "the ingest ledger carries the REAL model/effort, never null");
  } finally {
    repo.dispose();
  }
});
