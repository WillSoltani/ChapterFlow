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
import { readFileSync } from "fs";
import { resolve } from "path";

import { test } from "./harness.js";
import { PIPELINE_DIR } from "./helpers.js";

const doc = (rel: string) => readFileSync(resolve(PIPELINE_DIR, rel), "utf8");
const FINAL_GATE = readFileSync(resolve(PIPELINE_DIR, "src/critics/finalGate.ts"), "utf8");

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

test("handoff's catalog-id guidance matches the registry (C11–C21 support, C22/C23 narrative, next C24+)", () => {
  const s = doc("PIPELINE-HANDOFF.md");
  assert.match(s, /use C24\+/, "the next-free-id guidance must clear BOTH owners' ranges");
  assert.doesNotMatch(s, /must\s+use C18\+/, "the old 'use C18+' guidance reproduced the collision it warned about");
});

test("handoff does not re-document fixed gaps as open (the next developer reads this first)", () => {
  const s = doc("PIPELINE-HANDOFF.md");
  assert.doesNotMatch(
    s,
    /promote.{0,20}doesn'?t currently run the AS5/i,
    "promote HAS run AS5–AS12 since Phase 1a (src/critics/intraBook.ts)",
  );
  assert.doesNotMatch(s, /there is \*\*no tsconfig\*\*/, "Phase 0 added the tsconfig + typecheck baseline");
  assert.match(s, /tsc -p \. --noEmit/, "the handoff must tell the next developer how to typecheck");
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

test("WS-5: the writer card forbids defending a deterministic register ban (B4) as a false positive", () => {
  const cli = readFileSync(resolve(PIPELINE_DIR, "src/cli.ts"), "utf8");
  assert.match(cli, /DETERMINISTIC register ban[\s\S]{0,160}can NEVER be defended as a false positive/, "the writer card must carve out B-class lexical bans from the defensible-FP allowance");
  const orch = doc("agent-prompts/WRITE-ORCHESTRATE-CODEX-SESSION.md");
  assert.match(orch, /NEVER an FP/, "the write-orchestrate prompt must say a deterministic register ban is never an FP");
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
