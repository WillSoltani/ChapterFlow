/**
 * Docs-vs-code drift guard (Phase 4).
 *
 * The prompt docs are load-bearing: Codex agents and human operators follow
 * them literally, and they have already drifted twice into re-creating fixed
 * bugs (teaching the chapter-only "Ship gate:" line; teaching example/quiz
 * counts the gate blocks). These tests pin the doc claims to the code they
 * describe, so the next divergence fails CI instead of shipping a trap.
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

import { skip, test } from "./harness.js";
import { PIPELINE_DIR } from "./helpers.js";

const doc = (rel: string) => readFileSync(resolve(PIPELINE_DIR, rel), "utf8");
const docExists = (rel: string) => existsSync(resolve(PIPELINE_DIR, rel));
const FINAL_GATE = readFileSync(resolve(PIPELINE_DIR, "src/critics/finalGate.ts"), "utf8");

/** Register a docs-vs-code test that pins claims made by an UNTRACKED prompt/report
 *  doc (no doc text is committed — fixture policy). When the doc is absent on this
 *  checkout (bare worktree / post-purge canonical) the audit has no artifact to bind,
 *  so it skips-with-reason instead of ENOENT-failing — matching the gold-corpus
 *  skip idiom. Present ⇒ the FULL assertion runs; absence never weakens it. */
function testDocContract(name: string, docRel: string, fn: () => void | Promise<void>): void {
  if (docExists(docRel)) test(name, fn);
  else skip(name, `${docRel} not present on this checkout (untracked doc — fixture policy); nothing to audit`);
}

/** The A16 floors as the CODE defines them (source-scanned, so a floor change
 *  here forces the docs test to be reconsidered). */
function codeFloors(): { quiz: number; cards: number; examples: number } {
  const quiz = FINAL_GATE.match(/quizCount < (\d+)/);
  const cards = FINAL_GATE.match(/cardCount < (\d+)/);
  const examples = FINAL_GATE.match(/exampleCount < (\d+)/);
  assert.ok(quiz && cards && examples, "could not source-scan the A16 floors from finalGate.ts");
  return { quiz: Number(quiz![1]), cards: Number(cards![1]), examples: Number(examples![1]) };
}

test("STEP-2 teaches the gate's ACTUAL count floors (A16)", () => {
  const floors = codeFloors();
  const s = doc("agent-prompts/STEP-2-WRITE-CHAPTERS.md");
  assert.match(s, new RegExp(`GATE FLOOR ${floors.examples}\\)`), `STEP-2 must state the examples floor (${floors.examples})`);
  assert.match(s, new RegExp(`GATE FLOOR ${floors.quiz}\\)`), `STEP-2 must state the quiz floor (${floors.quiz})`);
  assert.match(s, new RegExp(`GATE FLOOR ${floors.cards}`), `STEP-2 must state the cards floor (${floors.cards})`);
  assert.doesNotMatch(s, /3-9 per chapter/, "the old 3-9 examples range is below the gate floor — an agent following it gets blocked");
  assert.doesNotMatch(s, /6-12 questions/, "the old 6-12 quiz range is below the gate floor");
});

test("no authoring/finalize doc teaches the chapter-only 'Ship gate:' line as success", () => {
  for (const rel of ["agent-prompts/STEP-2-WRITE-CHAPTERS.md", "agent-prompts/STEP-3-FINALIZE.md"]) {
    const s = doc(rel);
    assert.match(s, /Gate verdict: PASS/, `${rel} must teach the authoritative 'Gate verdict:' line`);
    assert.doesNotMatch(
      s,
      /gate-chapter[^\n]*\|\s*head\b/,
      `${rel} pipes gate-chapter through 'head', which discards the authoritative verdict line (the trap the code fixed)`,
    );
    assert.doesNotMatch(
      s,
      /`Ship gate: PASS` → chapter is ready/,
      `${rel} teaches the chapter-only headline as the success criterion`,
    );
  }
});

test("QC-PLAYBOOK's GREEN requires the semantic layer, not gate tallies alone", () => {
  const s = doc("agent-prompts/QC-PLAYBOOK.md");
  assert.match(s, /qc-status <bookId>[\s\S]*?PASS/, "GREEN must require all-PASS attestations");
  assert.match(s, /qc-run/, "the playbook must point at the harness review fleet");
});

test("QC-SESSION teaches the TOOLED hidden-key protocol and attest-all coverage", () => {
  const s = doc("agent-prompts/QC-SESSION-PROMPT.md");
  assert.match(s, /quiz-blind/, "hidden-key must reference the quiz-blind command");
  assert.match(s, /quiz-verify/, "hidden-key must reference the quiz-verify command");
  assert.match(s, /EVERY chapter/, "coverage must state that promote needs every chapter attested");
});

test("prompt docs teach v21.1 no-api Codex QC mode, not gate-only GREEN", () => {
  const qc = doc("agent-prompts/QC-SESSION-PROMPT.md");
  const playbook = doc("agent-prompts/PLAYBOOK-GENERATE-A-BOOK.md");
  for (const s of [qc, playbook]) {
    assert.match(s, /CHAPTERFLOW_NO_API_CODEX_QC=1/, "docs must name the no-api mode switch");
    assert.match(s, /qc-open-round/, "docs must teach round creation");
    assert.match(s, /key-pack/, "docs must teach blind manual key packs");
    assert.match(s, /key-derive/, "docs must teach keyA/keyB derivation");
    assert.match(s, /sweep-attest/, "docs must teach sweep attestation");
    assert.match(s, /major-(status|disposition)/, "docs must teach major disposition");
  }
  assert.match(qc, /gate-only GREEN is never enough|Gate tallies alone can NEVER produce GREEN|Never report GREEN \/ "ready to promote" from gate output alone/i);
});

test("PLAYBOOK names R6 and no doc pins the dead v21-redesign branch", () => {
  const s = doc("agent-prompts/PLAYBOOK-GENERATE-A-BOOK.md");
  assert.match(s, /R1–R6/, "the playbook must include R6 — the rule against THE systemic defect");
  assert.doesNotMatch(s, /`v21-redesign` branch/, "the pipeline merged to main; the branch pin is stale");
});

testDocContract("handoff's catalog-id guidance matches the registry (C11–C21 support, C22/C23 narrative, next C24+)", "PIPELINE-HANDOFF.md", () => {
  const s = doc("PIPELINE-HANDOFF.md");
  assert.match(s, /use C24\+/, "the next-free-id guidance must clear BOTH owners' ranges");
  assert.doesNotMatch(s, /must\s+use C18\+/, "the old 'use C18+' guidance reproduced the collision it warned about");
});

testDocContract("handoff does not re-document fixed gaps as open (the next developer reads this first)", "PIPELINE-HANDOFF.md", () => {
  const s = doc("PIPELINE-HANDOFF.md");
  assert.doesNotMatch(
    s,
    /promote.{0,20}doesn'?t currently run the AS5/i,
    "promote HAS run AS5–AS12 since Phase 1a (src/critics/intraBook.ts)",
  );
  assert.doesNotMatch(s, /there is \*\*no tsconfig\*\*/, "Phase 0 added the tsconfig + typecheck baseline");
  assert.match(s, /npm run pipeline:typecheck/, "the handoff must tell the next developer how to typecheck");
});

test("WS-4: the research prompt requires the sidecar-vs-reality source-verify step before handoff", () => {
  const research = doc("agent-prompts/RESEARCH-CODEX-SESSION.md");
  assert.match(research, /source-verify <bookId>/, "research must run source-verify before the write handoff");
  assert.match(research, /A clean `check-source` is\s*\*\*not\*\* proof the source is true|not\b[\s\S]{0,40}proof the source is true/i, "research must state check-source does not prove reality");
  assert.match(research, /Provenance, not plausibility/, "research must demand provenance over plausibility");
  // The machine check must be REQUIRED before handoff — a self-attested "all VERIFIED" is the
  // exact rubber-stamp bypass that shipped digital-minimalism's invented sources.
  assert.match(research, /source-verify-check/, "research must require the source-verify-check machine gate, not just a self-attested VERIFIED");
});

test("WS-4: the publish runbook documents CHAPTERFLOW_REQUIRE_SOURCE_VERIFY=1 as the new-book default", () => {
  const publish = doc("agent-prompts/PUBLISH-AFTER-QC-CODEX-SESSION.md");
  assert.match(publish, /CHAPTERFLOW_REQUIRE_SOURCE_VERIFY=1/, "the publish prompt must tell operators to require source-verify for new books");
});

test("the repair prompt encodes the load-bearing repair discipline (edit-only bucket, CLASS DEFECT, no certifying)", () => {
  const repair = doc("agent-prompts/REPAIR-CODEX-SESSION.md");
  assert.match(repair, /\[re-QC only\]/, "must name the [re-QC only] bucket");
  assert.match(repair, /Do NOT edit these/i, "must forbid editing [re-QC only] chapters — that invalidates their carried attestations");
  assert.match(repair, /CLASS DEFECT/, "must address CLASS DEFECT findings");
  assert.match(repair, /fix the class, not the quotes|class-level|whole class/i, "CLASS DEFECT must be a class-level fix, not quote-patching");
  assert.match(repair, /qc-submit/, "must reference the certifying commands it forbids");
  assert.match(repair, /Do \*\*NOT\*\* run|never run .*certif/i, "the writer-repair session must not run certifying commands");
});

test("the runbook documents the strict-production env AND the session-id footgun (so a strict run can't self-block)", () => {
  const runbook = doc("agent-prompts/RUN-A-BOOK.md");
  assert.match(runbook, /CHAPTERFLOW_REQUIRE_SOURCE_VERIFY=1/, "runbook must list the source-verify flag");
  assert.match(runbook, /CHAPTERFLOW_ENFORCE_SESSION_INDEPENDENCE=1/, "runbook must list the session-independence flag");
  // The footgun: a single exported CHAPTERFLOW_SESSION_ID makes author==reviewer and blocks
  // every chapter under ENFORCE_SESSION_INDEPENDENCE=1 — this warning must not silently vanish.
  assert.match(runbook, /do NOT also `export CHAPTERFLOW_SESSION_ID`/i, "runbook must warn against a single exported session id under strict mode");
});

test("the failure-class registry documents the anti-overfit promotion ladder and AGREES with the code", async () => {
  const reg = doc("docs/pipeline/FAILURE-CLASS-REGISTRY.md");
  // The hard-blocker gate (the anti-overfit valve) must be present and intact.
  assert.match(reg, /clean corpus/i, "registry must keep the clean-corpus-zero criterion");
  assert.match(reg, /gold corpus/i, "registry must keep the gold-corpus-zero criterion");
  assert.match(reg, /2 true positive/i, "registry must keep the >=2-true-positives criterion");
  // The ladder must name the REAL mechanisms it maps to (not aspirational ones).
  assert.match(reg, /ENFORCED_MAJOR/, "registry must reference the hard-blocker set");
  assert.match(reg, /WRITE_BARRIER_ACTIONABLE_PREFIXES/, "registry must reference the rung-3 mechanism");
  // Code-tie forcing function: every hard-blocker class in ENFORCED_MAJOR must be DOCUMENTED in
  // this ledger (with its rung-4 evidence). Promoting a class — or reverting one — must co-update
  // BOTH the code and this registry together, or this fails.
  const { ENFORCED_MAJOR } = await import("../src/critics/finalGate.js");
  assert.ok(ENFORCED_MAJOR.size > 0, "ENFORCED_MAJOR has promoted classes — keep the registry in sync (or this is stale)");
  for (const id of ENFORCED_MAJOR) {
    const cls = id.split(".")[0]; // e.g. "EW1", "SEAM1"
    assert.match(reg, new RegExp(`\\b${cls}\\b`), `registry must document the enforced hard-blocker class ${cls}`);
  }
  // The gold-corpus regression must stay discoverable + executable (registry AND runbook).
  const regressionCmd = /tests\/run\.ts corpus calibration enforced repetition label pronoun/;
  assert.match(reg, regressionCmd, "registry must document the runnable gold-corpus regression command");
  assert.match(doc("agent-prompts/RUN-A-BOOK.md"), regressionCmd, "runbook must point maintainers at the gold-corpus regression");
});

test("the production definition-of-done enumerates the real per-phase stack and the runtime checklist", () => {
  const dod = doc("docs/pipeline/PRODUCTION-DEFINITION-OF-DONE.md");
  for (const c of ["check-source", "source-v2-gate", "source-verify-check", "author-check", "gate-chapter", "fanout --barrier", "manual-keyjudge", "publish-after-qc"]) {
    assert.ok(dod.includes(c), `DoD must list the ${c} check`);
  }
  // It must point at the runtime checklist that ENFORCES the publish half (not just prose).
  assert.match(dod, /noApiPreflightChecks/, "DoD must reference the runtime preflight checklist");
});

test("every failure-class entry names an EXISTING catch-test (the fault-injection / false-negative inventory)", () => {
  const reg = doc("docs/pipeline/FAILURE-CLASS-REGISTRY.md");
  const fcEntries = [...reg.matchAll(/^\*\*FC-\d{4}-\d{2}-\d{2}-\d{3} —/gm)];
  const caughtBy = [...reg.matchAll(/^- Caught by:\s*(.+)$/gm)];
  assert.ok(fcEntries.length >= 6, `expected the seeded FC entries, found ${fcEntries.length}`);
  // Every failure class must carry exactly one Caught-by line — no class without a catch-test.
  assert.equal(caughtBy.length, fcEntries.length, "every FC entry must have exactly one 'Caught by:' line");
  // Every named *.test.ts must actually exist — deleting/renaming a catch-test fails CI here.
  const named = caughtBy.flatMap((m) => [...m[1].matchAll(/([\w-]+\.test\.ts)/g)].map((x) => x[1]));
  assert.ok(named.length >= fcEntries.length, "each Caught-by line must name at least one test file");
  for (const f of new Set(named)) {
    assert.ok(existsSync(resolve(PIPELINE_DIR, "tests", f)), `registry names catch-test ${f}, but tests/${f} does not exist`);
  }
});

test("QC-ORCHESTRATE turns reviewer independence into recorded evidence (per-subagent CHAPTERFLOW_SESSION_ID)", () => {
  const qc = doc("agent-prompts/QC-ORCHESTRATE-CODEX-SESSION.md");
  assert.match(qc, /export CHAPTERFLOW_SESSION_ID/, "each reviewer subagent must stamp its own session id");
  assert.match(qc, /reviewerSessionId/, "the prompt must name the captured per-submission field");
  assert.match(qc, /keyA≠keyB/, "the prompt must state the keyA≠keyB session requirement");
  const runbook = doc("agent-prompts/RUN-A-BOOK.md");
  assert.match(runbook, /reviewer SUBAGENT stamps its OWN id/, "RUN-A-BOOK must mention per-subagent session ids under enforcement");
});

test("WS-5: the writer card forbids defending a deterministic register ban (B4) as a false positive", () => {
  const cli = readFileSync(resolve(PIPELINE_DIR, "src/cli.ts"), "utf8");
  assert.match(cli, /DETERMINISTIC register ban[\s\S]{0,160}can NEVER be defended as a false positive/, "the writer card must carve out B-class lexical bans from the defensible-FP allowance");
  const orch = doc("agent-prompts/WRITE-ORCHESTRATE-CODEX-SESSION.md");
  assert.match(orch, /NEVER an FP/, "the write-orchestrate prompt must say a deterministic register ban is never an FP");
});

test("the fanout writer card pins its critical guidance (anti prompt-drift contract)", () => {
  // The owner's prompt-compiler goal — reduce prompt drift — without the compiler. The card is
  // per-chapter COMPUTED (names/exemplar-ownership/shape/mechanism vary by chapter), so static
  // section files would lose that conditionality; these source-text contracts pin the invariant
  // guidance instead, so a future edit that drops a load-bearing instruction fails CI.
  const cli = readFileSync(resolve(PIPELINE_DIR, "src/cli.ts"), "utf8");
  // Answer TRUTH overrides target placement — the F3 balance must never bend a key.
  assert.match(cli, /Score each question for TRUTH first[\s\S]{0,200}NEVER change which choice is true/, "card must keep answer-truth-over-placement");
  // The quiz key is derived from the source testableFacts the blind judge uses (not prose).
  assert.match(cli, /quiz_key_correctness[\s\S]{0,280}testableFacts/, "card must keep key-from-source guidance");
  // Distractor sameness / no telegraphing labels (the BP31 family).
  assert.match(cli, /SAME KIND of answer/, "card must keep distractor-sameness (no-label) guidance");
  // Source fidelity is a factual_accuracy CORRUPTION veto, and ungrounded claims are cut, not invented.
  assert.match(cli, /factual_accuracy[\s\S]{0,40}CORRUPTION/i, "card must mark factual_accuracy a corruption veto");
  assert.match(cli, /can't ground a claim, cut it[\s\S]{0,6}never invent/, "card must forbid inventing ungrounded claims");
  // The real target is the publishable bar — self-score before finishing.
  assert.match(cli, /THE REAL TARGET IS THE PUBLISHABLE BAR/, "card must keep the publishable-bar self-score");
});

test("WS-5: the confirm read is dispatched with an ADVERSARIAL (refute-the-PASS) stance", () => {
  const pkt = readFileSync(resolve(PIPELINE_DIR, "src/qc/orchestrator/reviewPacket.ts"), "utf8");
  assert.match(pkt, /ADVERSARIAL STANCE/, "the confirm section must instruct an adversarial stance");
  assert.match(pkt, /try to REFUTE/i, "the confirm reviewer must be told to try to refute PUBLISHABLE");
  assert.match(pkt, /self-preference|low-perplexity|blind spot/i, "the packet must name the single-family self-preference bias it counters");
  const roles = JSON.parse(doc("roles/ROLE-DEFINITIONS.json"));
  const confirm = roles.roles.find((r: { roleId: string }) => r.roleId === "confirm");
  assert.match(confirm.modelHint, /ADVERSARIAL|refute/i, "the confirm role hint must carry the adversarial stance (role diversity from the bar)");
});

test("STEP-2 carries the plain-language direction (R2.7) and fanout pins it", () => {
  const s = doc("agent-prompts/STEP-2-WRITE-CHAPTERS.md");
  assert.match(s, /R2\.7 — Plain language beats abstraction/);
  assert.match(s, /Concrete within two sentences/);
  const cli = readFileSync(resolve(PIPELINE_DIR, "src/cli.ts"), "utf8");
  assert.match(cli, /PLAIN LANGUAGE \(R2\.7/, "fanout must pin the plain-language rule into every authoring prompt");
});

test("STEP-2 teaches no-api major debt before completion", () => {
  const s = doc("agent-prompts/STEP-2-WRITE-CHAPTERS.md");
  assert.match(s, /major-status <bookId>/, "writers must run major-status before claiming completion");
  assert.match(s, /do not waive majors; only QC\/operator may write `major-disposition`/, "writers must not write major dispositions");
  assert.match(s, /Unresolved majors are QC debt/, "STEP-2 must name unresolved majors as QC debt");
});

test("STEP-2 aligns the writer to the real QC arbiters (publishable bar + blind key-judge)", () => {
  const s = doc("agent-prompts/STEP-2-WRITE-CHAPTERS.md");
  // The writer must self-score against the bar QC actually grades on — not stop at gate-clean.
  assert.match(s, /publishable-rubric/, "STEP-2 must point the writer at the publishable-bar rubric command");
  assert.match(s, /PUBLISHABLE BAR/, "STEP-2 must name the publishable bar as the real target");
  // Quiz keys must be derived the way the blind keyA/keyB judge re-derives them (from testableFacts).
  assert.match(s, /testableFacts/, "STEP-2 must teach quiz-key derivation from testableFacts");
  assert.match(s, /blind/i, "STEP-2 must explain the blind key-judge");
});

test("STEP-2 scenario length guidance stays consistent", () => {
  const s = doc("agent-prompts/STEP-2-WRITE-CHAPTERS.md");
  assert.doesNotMatch(s, /80[–-]140 words per scenario/, "old scenario word target conflicts with the schema char floor");
  assert.match(s, /280[–-]520 chars/, "scenario guidance must include the schema char target");
  assert.match(s, /55[–-]95 words/, "scenario guidance must include the word-count equivalent");
});

test("QC-SESSION points no-api Codex sessions at qc-auto and current major statuses", () => {
  const s = doc("agent-prompts/QC-SESSION-PROMPT.md");
  assert.match(s, /QC-AUTO-CODEX-SESSION\.md/, "manual QC prompt must reference the preferred no-api Codex autopilot prompt");
  assert.match(s, /qc-auto/, "manual QC prompt must reference qc-auto");
  assert.match(s, /`open`, `waived_false_positive`, or\s+`waived_accepted_debt`/, "QC docs must teach current major disposition statuses");
  assert.match(s, /Legacy `resolved\|waived` statuses may be read from old\s+waiver files but must not be newly written/, "legacy major statuses must remain read-only");
});

test("AGENTS names the Publish-after-QC role", () => {
  const s = doc("AGENTS.md");
  assert.match(s, /## Publish-after-QC role/);
  assert.match(s, /must not edit chapter files/);
  assert.match(s, /clean token-bearing task cards before commit/);
});

testDocContract("V23 report's risk-routed 'narrow QC shadow review before formal QC' claim is backed by an actual doGate wire, not a dead recommendation field", "V23-COMPILER-PIPELINE-REPORT.md", () => {
  const report = doc("V23-COMPILER-PIPELINE-REPORT.md");
  assert.match(report, /risk scoring[\s\S]{0,80}narrow shadow review/i, "the report must keep the risk-routing claim");
  const autopilot = readFileSync(resolve(PIPELINE_DIR, "src/orchestrator/autopilot.ts"), "utf8");
  assert.match(autopilot, /async function runQcShadowReview\(/, "doGate must call an actual QC-shadow review function, not just carry chapterRisk's recommendedAction as an unused field");
  assert.match(autopilot, /deps\.bookRisk\(bookId\)\.chapters\.filter\(\(c\) => c\.lane === "high"\)/, "the shadow review must be routed by the risk-score HIGH lane, matching chapterRisk.ts's laneFromScore threshold");
  assert.match(autopilot, /runQcShadowReview\(bookId, highRisk, deps\)/, "doGate must actually invoke the shadow review for high-risk chapters");
  // Never a substitute for formal QC — the shadow review must run BEFORE the gate returns
  // control to the qc phase, and its own comment must say it never gates progression.
  assert.match(autopilot, /never gates progression/, "the shadow review must be documented as advisory-only — it must never block or replace formal QC");
});
