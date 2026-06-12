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

test("STEP-2 carries the plain-language direction (R2.7) and fanout pins it", () => {
  const s = doc("agent-prompts/STEP-2-WRITE-CHAPTERS.md");
  assert.match(s, /R2\.7 — Plain language beats abstraction/);
  assert.match(s, /Concrete within two sentences/);
  const cli = readFileSync(resolve(PIPELINE_DIR, "src/cli.ts"), "utf8");
  assert.match(cli, /PLAIN LANGUAGE \(R2\.7/, "fanout must pin the plain-language rule into every authoring prompt");
});
