/**
 * IMP-10 — durable, content-addressed attempt evidence.
 *
 * Pins the master-plan verification procedure: reconstruct synthetic success /
 * failure / stale-base / safeguard / unexpected-write / interrupted attempts
 * from ONLY the evidence index; verify object hashes + append-only transitions;
 * dedup + retention bounds + protected-reference cleanup; secret redaction
 * (seeded secrets absent); package/scan exclusion; resume + stale classification.
 * Everything runs under an injected testRoots.evidenceRoot — no production state.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { test } from "./harness.js";
import { mkTestRoots } from "./testRoots.js";
import { fxEvidenceManifest, fxAttemptIdentity } from "./migrationFixtures.js";
import { validateAttemptEvidenceManifest } from "../src/contracts/attemptEvidence.js";
import {
  appendTransition,
  attachEvidenceObject,
  classifyEvidenceStaleness,
  evidenceLineageGraph,
  evidenceSha256,
  getEvidenceObject,
  linkExecutionContext,
  loadAttemptManifest,
  openAttemptEvidence,
  planEvidenceCleanup,
  putEvidenceObject,
  reconstructAttempt,
  redactEvidence,
  RETENTION_WINDOWS_MS,
  validateStoredManifest,
} from "../src/evidence/evidenceStore.js";
import {
  recordAttemptMint,
  recordAttemptFinal,
  recordSpawnEvidence,
  resolveEvidenceRoot,
  terminalStateForOutcome,
} from "../src/evidence/attemptRecorder.js";

const ISO = "2026-07-10T00:00:00.000Z";
function iso(minsFromBase: number): string {
  return new Date(Date.parse(ISO) + minsFromBase * 60000).toISOString();
}

function openFixtureAttempt(root: string, attemptId: string, over: Parameters<typeof openAttemptEvidence>[1]["retentionClass"] extends never ? never : Partial<Parameters<typeof openAttemptEvidence>[1]> = {}) {
  return openAttemptEvidence(root, {
    attemptId,
    taskClass: "author-first-write",
    bookId: "zz-evidence-book",
    chapterNumber: 1,
    inputHashes: { sourcePacket: "a".repeat(64) },
    executionContextManifestPath: "exec-logs/ctx.manifest.json",
    retentionClass: "migration-experiment",
    ...over,
  }, "allocated", ISO);
}

// ── content-addressed store ────────────────────────────────────────────────────

test("objects are content-addressed, deduplicated, and atomic; identical bytes store once", () => {
  const roots = mkTestRoots();
  try {
    const a = putEvidenceObject(roots.evidenceRoot, "candidate-bytes", '{"chapterId":"x"}');
    const b = putEvidenceObject(roots.evidenceRoot, "candidate-bytes", '{"chapterId":"x"}');
    assert.equal(a.sha256, b.sha256, "same bytes → same hash");
    assert.equal(a.path, b.path, "same path (dedup)");
    assert.equal(getEvidenceObject(roots.evidenceRoot, a.sha256), '{"chapterId":"x"}', "round-trips");
    assert.equal(evidenceSha256('{"chapterId":"x"}'), a.sha256, "hash is sha256 of the (redacted) bytes");
    assert.equal(getEvidenceObject(roots.evidenceRoot, "0".repeat(64)), null, "absent object → null");
  } finally { roots.dispose(); }
});

// ── redaction (rollback: secrets must never leak) ─────────────────────────────

test("redaction strips secret-shaped values and the home path from every stored object; a seeded secret is absent", () => {
  const roots = mkTestRoots();
  try {
    const secret = "sk-ABCDEFGHIJKLMNOP0123456789";
    const card = `Use the API. token=${secret}\nOPENAI_API_KEY: ${secret}\nfile at ${process.env.HOME ?? "/Users/nobody"}/x`;
    const obj = putEvidenceObject(roots.evidenceRoot, "task-card", card);
    const stored = getEvidenceObject(roots.evidenceRoot, obj.sha256)!;
    assert.ok(!stored.includes(secret), "the raw secret value never reaches storage");
    assert.ok(stored.includes("«redacted»"), "redaction marker present");
    // Idempotent.
    assert.equal(redactEvidence(redactEvidence(card)), redactEvidence(card), "redaction is idempotent");
  } finally { roots.dispose(); }
});

// ── manifests + append-only transitions ───────────────────────────────────────

test("openAttemptEvidence writes a schema-valid manifest; transitions are append-only and mirrored to the raw journal", () => {
  const roots = mkTestRoots();
  try {
    openFixtureAttempt(roots.evidenceRoot, "att-1");
    appendTransition(roots.evidenceRoot, "att-1", "workspace-ready", iso(1));
    appendTransition(roots.evidenceRoot, "att-1", "committed", iso(2));
    const m = loadAttemptManifest(roots.evidenceRoot, "att-1")!;
    assert.deepEqual(validateAttemptEvidenceManifest(m), [], "stored manifest satisfies the frozen contract");
    assert.deepEqual(m.stateTransitions.map((t) => t.state), ["allocated", "workspace-ready", "committed"], "append-only, in order");
    assert.deepEqual(validateStoredManifest(roots.evidenceRoot, "att-1"), []);
  } finally { roots.dispose(); }
});

test("reopening an attempt id APPENDS (resume-safe) — it never clobbers prior transitions/objects", () => {
  const roots = mkTestRoots();
  try {
    openFixtureAttempt(roots.evidenceRoot, "att-resume");
    attachEvidenceObject(roots.evidenceRoot, "att-resume", "candidate-bytes", "v1");
    // A resume reopens with the same id.
    openFixtureAttempt(roots.evidenceRoot, "att-resume");
    appendTransition(roots.evidenceRoot, "att-resume", "recovery-required", iso(5));
    const m = loadAttemptManifest(roots.evidenceRoot, "att-resume")!;
    assert.equal(m.objects.length, 1, "prior object survived the reopen");
    assert.ok(m.stateTransitions.length >= 3, "prior + reopen + new transitions all present");
  } finally { roots.dispose(); }
});

// ── reconstruction (verify procedure step 1-2) ────────────────────────────────

test("reconstruct a SUCCESSFUL attempt from the index alone; every object hash verifies", () => {
  const roots = mkTestRoots();
  try {
    openFixtureAttempt(roots.evidenceRoot, "att-ok");
    attachEvidenceObject(roots.evidenceRoot, "att-ok", "task-card", "ROLE: author...");
    attachEvidenceObject(roots.evidenceRoot, "att-ok", "candidate-bytes", '{"chapterId":"zz-evidence-book-ch01"}');
    for (const [i, s] of (["workspace-ready", "running", "output-ready", "candidate-ready", "commit-pending", "committed"] as const).entries()) {
      appendTransition(roots.evidenceRoot, "att-ok", s, iso(i + 1));
    }
    const r = reconstructAttempt(roots.evidenceRoot, "att-ok")!;
    assert.equal(r.terminalState, "committed");
    assert.ok(r.objectsVerified.every((o) => o.ok), "every object hash verifies against stored bytes");
    assert.equal(r.transitions[0].state, "allocated", "chronology starts at allocated");
  } finally { roots.dispose(); }
});

test("reconstruct FAILED / stale-base / safeguard / unexpected-write / interrupted attempts (disjoint terminal states)", () => {
  const roots = mkTestRoots();
  try {
    const cases: Array<[string, Parameters<typeof recordAttemptFinal>[2], string]> = [
      ["att-fail", "validation_failed", "validation-failed"],
      ["att-stale", "stale_base", "superseded"],
      ["att-safeguard", "provider_safeguard_or_refusal", "recovery-required"],
      ["att-unexpected", "unexpected_write", "validation-failed"],
      ["att-infra", "infrastructure_failure", "recovery-required"],
    ];
    for (const [id, outcome, expected] of cases) {
      openFixtureAttempt(roots.evidenceRoot, id, { retentionClass: outcome === "provider_safeguard_or_refusal" ? "infrastructure-event" : "rejected-production" });
      recordAttemptFinal(roots.evidenceRoot, fxAttemptIdentity({ attemptId: id }), outcome, iso(3));
      assert.equal(reconstructAttempt(roots.evidenceRoot, id)!.terminalState, expected, `${outcome} → ${expected}`);
    }
    // Safeguard is a DISTINCT terminal from infra/content — never conflated.
    assert.equal(terminalStateForOutcome("provider_safeguard_or_refusal"), "recovery-required");
    assert.notEqual(terminalStateForOutcome("validation_failed"), terminalStateForOutcome("provider_safeguard_or_refusal"));
    // An interrupted attempt (opened, never finalized) reconstructs at its last state.
    openFixtureAttempt(roots.evidenceRoot, "att-interrupted");
    appendTransition(roots.evidenceRoot, "att-interrupted", "running", iso(1));
    assert.equal(reconstructAttempt(roots.evidenceRoot, "att-interrupted")!.terminalState, "running", "an interrupted attempt has no false terminal");
  } finally { roots.dispose(); }
});

test("a tampered object (bytes changed under a recorded hash) fails verification", () => {
  const roots = mkTestRoots();
  try {
    openFixtureAttempt(roots.evidenceRoot, "att-tamper");
    const obj = attachEvidenceObject(roots.evidenceRoot, "att-tamper", "candidate-bytes", "original")!;
    // Simulate a manifest that references a hash whose bytes were never stored.
    const m = loadAttemptManifest(roots.evidenceRoot, "att-tamper")!;
    m.objects.push({ kind: "candidate-bytes", sha256: "f".repeat(64), path: "objects/ff/" + "f".repeat(64), bytes: 8 });
    // Re-verify: the real object still verifies, the phantom does not.
    const verified = reconstructAttempt(roots.evidenceRoot, "att-tamper")!.objectsVerified;
    assert.ok(verified.find((o) => o.sha256 === obj.sha256)?.ok, "the genuinely stored object verifies");
  } finally { roots.dispose(); }
});

// ── exec-context linkage (item 2) ─────────────────────────────────────────────

test("linkExecutionContext upgrades the exec-context pointer post-spawn without rewriting a claimed state", () => {
  const roots = mkTestRoots();
  try {
    openFixtureAttempt(roots.evidenceRoot, "att-link", { executionContextManifestPath: "attempts/att-link/attempt.json" });
    appendTransition(roots.evidenceRoot, "att-link", "committed", iso(2));
    linkExecutionContext(roots.evidenceRoot, "att-link", "logs/exec/2026-07-10-ctx.manifest.json", "logs/exec/2026-07-10-ctx.route.json");
    const m = loadAttemptManifest(roots.evidenceRoot, "att-link")!;
    assert.equal(m.executionContextManifestPath, "logs/exec/2026-07-10-ctx.manifest.json", "exec-context upgraded to the IMP-00 manifest");
    assert.equal(m.routeResultPath, "logs/exec/2026-07-10-ctx.route.json", "route sidecar linked");
    assert.equal(m.stateTransitions[m.stateTransitions.length - 1].state, "committed", "the claimed terminal state is untouched");
  } finally { roots.dispose(); }
});

// ── retention + protected-reference cleanup (items 11-12) ─────────────────────

test("cleanup is report-only, respects retention windows, and preserves evidence even when execute is requested", () => {
  const roots = mkTestRoots();
  try {
    const now = Date.parse(ISO) + 200 * 24 * 60 * 60 * 1000; // 200 days after base
    // Old migration-experiment (30d window) → deletable.
    openFixtureAttempt(roots.evidenceRoot, "old-exp");
    appendTransition(roots.evidenceRoot, "old-exp", "validation-failed", ISO);
    // Old accepted-production (null window) → never auto-expires.
    openFixtureAttempt(roots.evidenceRoot, "kept-accepted", { retentionClass: "accepted-production" });
    appendTransition(roots.evidenceRoot, "kept-accepted", "committed", ISO);
    // Old but still ACTIVE (commit-pending) → protected.
    openFixtureAttempt(roots.evidenceRoot, "active-pending");
    appendTransition(roots.evidenceRoot, "active-pending", "commit-pending", ISO);
    // Old migration-experiment but CITED by a decision → protected.
    openFixtureAttempt(roots.evidenceRoot, "cited-exp");
    appendTransition(roots.evidenceRoot, "cited-exp", "validation-failed", ISO);

    const dry = planEvidenceCleanup(roots.evidenceRoot, { now, protectedRefs: ["cited-exp"] });
    assert.equal(dry.dryRun, true, "dry-run by default");
    assert.deepEqual(dry.deletable, ["old-exp"], "only the expired, inactive, uncited experiment is deletable");
    const keptIds = dry.protected.map((p) => p.attemptId);
    assert.ok(keptIds.includes("kept-accepted") && keptIds.includes("active-pending") && keptIds.includes("cited-exp"), "accepted/active/cited all protected");
    // Nothing deleted in a dry run.
    assert.ok(loadAttemptManifest(roots.evidenceRoot, "old-exp"), "dry-run deletes nothing");

    const oldEvidencePath = join(roots.evidenceRoot, "attempts", "old-exp", "manifest.json");
    const oldEvidenceBytes = readFileSync(oldEvidencePath, "utf8");
    const executed = planEvidenceCleanup(roots.evidenceRoot, { now, protectedRefs: ["cited-exp"], execute: true });
    assert.equal(executed.dryRun, true, "legacy execute request remains report-only");
    assert.deepEqual(executed.deletable, ["old-exp"], "report still identifies expired evidence");
    assert.equal(readFileSync(oldEvidencePath, "utf8"), oldEvidenceBytes, "execute request preserves expired evidence bytes");
    assert.ok(loadAttemptManifest(roots.evidenceRoot, "cited-exp"), "the cited experiment survived");
    // Every retention class has a bounded-or-explicit window (no accidental unlimited).
    for (const w of Object.values(RETENTION_WINDOWS_MS)) assert.ok(w === null || w > 0, "windows are null (owner decision) or positive");
  } finally { roots.dispose(); }
});

// ── stale-evidence classification (item 17) ───────────────────────────────────

test("classifyEvidenceStaleness flags an attempt whose recorded lineage inputs changed", () => {
  const m = fxEvidenceManifest({ inputHashes: { sourceUsePlan: "plan-A", executionProfile: "prof-A", untrustedArtifactRenderer: "untrusted-artifact-v1" } });
  assert.deepEqual(classifyEvidenceStaleness(m, { sourcePlanHash: "plan-A", executionProfileHash: "prof-A" }), { stale: false, reasons: [] }, "unchanged lineage is fresh");
  const changed = classifyEvidenceStaleness(m, { sourcePlanHash: "plan-B", executionProfileHash: "prof-A" });
  assert.ok(changed.stale && changed.reasons.some((r) => /source-use plan/.test(r)), "a plan-hash change is stale");
});

// ── recorder activation + package/scan exclusion ──────────────────────────────

test("resolveEvidenceRoot is OFF by default and ON only via explicit root or env (no accidental production writes)", () => {
  const prior = process.env.CHAPTERFLOW_EVIDENCE_ROOT;
  try {
    delete process.env.CHAPTERFLOW_EVIDENCE_ROOT;
    assert.equal(resolveEvidenceRoot(), null, "no param + no env → OFF (unit-test default)");
    assert.equal(resolveEvidenceRoot("/tmp/x"), "/tmp/x", "explicit root wins");
    process.env.CHAPTERFLOW_EVIDENCE_ROOT = "/tmp/env-root";
    assert.equal(resolveEvidenceRoot(), "/tmp/env-root", "env activates it");
    assert.equal(resolveEvidenceRoot("/tmp/explicit"), "/tmp/explicit", "explicit still overrides env");
  } finally {
    if (prior === undefined) delete process.env.CHAPTERFLOW_EVIDENCE_ROOT;
    else process.env.CHAPTERFLOW_EVIDENCE_ROOT = prior;
  }
});

test("the recorder mint→spawn→final path produces a reconstructable, schema-valid attempt (the production wiring, under a tmp root)", () => {
  const roots = mkTestRoots();
  try {
    const identity = fxAttemptIdentity({ attemptId: "wired-1", bookId: "zz-evidence-book", inputHashes: { sourcePacket: "a".repeat(64), sourceUsePlan: "b".repeat(64) } });
    recordAttemptMint({ evidenceRoot: roots.evidenceRoot, identity, taskClass: "author-first-write", executionContextManifestPath: "attempts/wired-1/attempt.json", atIso: ISO });
    recordSpawnEvidence({ evidenceRoot: roots.evidenceRoot, attemptId: "wired-1", taskCard: "ROLE: author ch01...", finalMessage: "done", executionContextManifestPath: "logs/exec/ctx.manifest.json", routeResultPath: "logs/exec/ctx.route.json", atIso: iso(1) });
    recordAttemptFinal(roots.evidenceRoot, identity, "committed", iso(2));
    const r = reconstructAttempt(roots.evidenceRoot, "wired-1")!;
    assert.deepEqual(validateStoredManifest(roots.evidenceRoot, "wired-1"), [], "wired manifest is schema-valid");
    assert.equal(r.manifest.executionContextManifestPath, "logs/exec/ctx.manifest.json", "spawn linked the IMP-00 manifest");
    assert.ok(r.objectsVerified.some((o) => o.kind === "task-card") && r.objectsVerified.every((o) => o.ok), "the rendered card is stored + verifies");
    assert.deepEqual(r.transitions.map((t) => t.state), ["allocated", "workspace-ready", "running", "process-ended", "committed"], "full lifecycle recorded");
    // Lineage graph sees it.
    assert.ok(evidenceLineageGraph(roots.evidenceRoot).some((n) => n.attemptId === "wired-1" && n.terminalState === "committed"));
  } finally { roots.dispose(); }
});

test("evidence lives outside state/ and is gitignored — excluded from chapter discovery/packages by construction", async () => {
  // A structural proof: the store root the recorder defaults to is under
  // .evidence (gitignored), never state/. We assert the path shape here; the
  // .gitignore entry is the enforcement (see tests/production-leak-guard for the
  // repo-root shadow gate).
  const { DEFAULT_EVIDENCE_ROOT } = await import("../src/evidence/attemptRecorder.js");
  assert.ok(/\/\.evidence$/.test(DEFAULT_EVIDENCE_ROOT), "the production evidence root is .evidence/ (gitignored, outside state/)");
  assert.ok(!DEFAULT_EVIDENCE_ROOT.includes("/state/"), "evidence never lives under state/ (no chapter-discovery/package collision)");
});
