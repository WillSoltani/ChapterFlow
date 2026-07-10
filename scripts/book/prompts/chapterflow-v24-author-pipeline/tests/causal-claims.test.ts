/**
 * IMP-08 — causal-claim representation + source/causal verifier packets
 * (instructions 6-7; findings F-023 and the Polgár/youth-sport class).
 *
 * Pins:
 *  - extraction covers EVERY reader-facing surface — narrative tiers, examples,
 *    quiz explanations, REVIEW CARDS and MEMORABLE LINES (the red-team case:
 *    overreach hiding ONLY in a card/line) and practice;
 *  - claim-strength boundaries: descriptive/correlational/mechanistic plans
 *    make causal spans OVERREACH; a causal-licensed plan makes them licensed,
 *    with the licensing unit ids named;
 *  - no plan = represent, judge nothing (the C37 absence rule);
 *  - the verifier packets carry no identity/answer-key material and the
 *    manifest matrix keeps direct-reader and source-verifier verdict-disjoint
 *    (they can only disagree THROUGH the conductor).
 */

import assert from "node:assert/strict";

import { test } from "./harness.js";
import { fxChapter } from "./migrationFixtures.js";
import type { ChapterV21 } from "../src/types.js";
import type { SourceUsePlanV1 } from "../src/contracts/sourceUsePlan.js";
import {
  buildCausalVerifierTask,
  buildSourceVerifierTask,
  extractCausalClaims,
  renderCausalVerifierPacket,
  renderSourceVerifierPacket,
} from "../src/review/causalClaims.js";
import { REVIEWER_ROLE_MANIFESTS } from "../src/review/reviewerWorkspace.js";
import { checkSourceRegister } from "../src/critics/sourceRegister.js";

function planWith(claimStrength: string): SourceUsePlanV1 {
  return {
    schema: "source-use-plan-v1",
    bookId: "zz-causal",
    chapterNumber: 1,
    sourceVersion: "v2",
    compiledAtIso: "2026-07-10T00:00:00.000Z",
    units: [{
      unitId: "u1",
      origin: "source_bound",
      form: "case",
      claimStrength: claimStrength as never,
      anchorIds: ["a1"],
      allowedDetailTypes: [],
      forbiddenDetailTypes: [],
      detailSufficiency: "concept_only",
      framingRequired: false,
    }],
  } as unknown as SourceUsePlanV1;
}

function causalChapter(): ChapterV21 {
  return fxChapter({
    hook: "Practice matters.",
    counterintuition: "More hours is not the lever.",
    breakdown: { fastRead: "A plain descriptive line.", deepRead: "Early specialization correlates with burnout in the sample.", fullRead: "The study followed two cohorts." },
    keyTakeaway: "Deliberate practice causes mastery in every field.",
    tryThisNow: "Practice one skill.",
    examples: [{ title: "Polgár", scenario: "The sisters trained daily.", whatToDo: "Train.", whyItMatters: "Their schedule guarantees results if you copy it." }],
    quiz: { questions: [{ questionId: "q1", prompt: "What did the study show?", choices: ["a", "b", "c"], correctIndex: 0, explanation: "Training results in mastery, the chapter argues." }] },
    reviewCards: [{ front: "What is the lever?", back: "Structured practice inevitably compounds." }],
    memorableLines: [{ text: "Hours cause mastery.", why: "sticky" }],
  } as Partial<ChapterV21>) as ChapterV21;
}

test("extraction covers cards and memorable lines (the overreach-hides-in-a-card red-team case) and every narrative surface", () => {
  const ch = causalChapter();
  const ex = extractCausalClaims(ch, null);
  const surfaces = new Set(ex.claims.map((c) => c.surface));
  assert.ok(surfaces.has("keyTakeaway"), "causal span in the takeaway found");
  assert.ok(surfaces.has("examples[0].whyItMatters"), "guarantees-language in an example found");
  assert.ok(surfaces.has("quiz[0].explanation"), "results-in language in a quiz explanation found");
  assert.ok(surfaces.has("reviewCards[0].back"), "inevitably-language in a CARD found");
  assert.ok(surfaces.has("memorableLines[0]"), "cause-language in a MEMORABLE LINE found");
  for (const c of ex.claims) {
    assert.ok(c.excerpt.length > 0 && c.excerpt.length <= 240, "bounded excerpt");
    assert.ok(c.span.length > 0, "the lexicon span is recorded");
  }
});

test("claim-strength boundaries: descriptive/correlational/mechanistic license NOTHING causal; a causal plan licenses with named units", () => {
  const ch = causalChapter();
  for (const strength of ["descriptive", "correlational", "mechanistic"]) {
    const ex = extractCausalClaims(ch, planWith(strength));
    assert.ok(ex.planKnown);
    assert.equal(ex.strongestPermitted, strength);
    assert.equal(ex.licensingUnitIds.length, 0, `${strength} plan has no causal-rank unit`);
    assert.ok(ex.overreaches.length > 0 && ex.overreaches.length === ex.claims.length, `${strength}: every causal span is an overreach`);
  }
  const licensed = extractCausalClaims(ch, planWith("causal"));
  assert.equal(licensed.strongestPermitted, "causal");
  assert.deepEqual(licensed.licensingUnitIds, ["u1"], "the licensing unit is NAMED (unit-linked representation)");
  assert.equal(licensed.overreaches.length, 0, "a causal license clears the aggregate check");
});

test("no plan: claims are represented but nothing is judged (absence grants nothing and blocks nothing)", () => {
  const ch = causalChapter();
  const ex = extractCausalClaims(ch, null);
  assert.equal(ex.planKnown, false);
  assert.equal(ex.strongestPermitted, null);
  assert.ok(ex.claims.length > 0, "representation still extracted");
  assert.equal(ex.overreaches.length, 0, "no judgment without a plan");
});

test("a clean chapter extracts zero causal claims (descriptive prose does not trip the lexicon)", () => {
  const clean = fxChapter({
    hook: "A plain observation about forms.",
    keyTakeaway: "Shorter forms tend to help.",
    breakdown: { fastRead: "Forms.", deepRead: "The team observed higher completion.", fullRead: "The report describes the change." },
  } as Partial<ChapterV21>) as ChapterV21;
  const ex = extractCausalClaims(clean, planWith("descriptive"));
  assert.equal(ex.claims.length, 0);
  assert.equal(ex.overreaches.length, 0);
});

test("the extraction shares C37's lexicon: every overreach the critic flags is representable (one owner, no drift)", () => {
  const ch = causalChapter();
  const critic = checkSourceRegister(ch, planWith("correlational"));
  const overreachFindings = critic.filter((f) => String(f.checkId).includes("claim_strength_overreach"));
  const ex = extractCausalClaims(ch, planWith("correlational"));
  assert.ok(overreachFindings.length > 0, "C37 fires on the fixture");
  assert.ok(ex.overreaches.length >= overreachFindings.length, "the representation covers at least the critic's surfaces (it adds cards/lines)");
});

test("verifier packets: no identity, no answer key, no prior verdicts; tasks are schema-bound", () => {
  const ch = causalChapter();
  const ex = extractCausalClaims(ch, planWith("correlational"));
  const causalPacket = renderCausalVerifierPacket(ch, ex);
  assert.ok(causalPacket.includes("Strongest permitted claim strength: correlational"));
  assert.ok(causalPacket.includes("[reviewCards[0].back]"), "card claims ride the packet");
  assert.ok(!causalPacket.includes("ANSWER KEY"), "no key material");
  const sourcePacket = renderSourceVerifierPacket({
    title: ch.title,
    phase1Doc: "# Doc\nprose only\n",
    planRender: "unit u1: correlational, source_bound",
    evidenceLines: ["a1: the study followed two cohorts"],
  });
  assert.ok(sourcePacket.includes("the ONLY citable facts"));
  for (const leak of ["gpt-5", "claude", "session", "verdict", "composite"]) {
    assert.ok(!sourcePacket.toLowerCase().includes(leak), `source packet leaks "${leak}"`);
    assert.ok(!causalPacket.toLowerCase().includes(leak), `causal packet leaks "${leak}"`);
  }
  assert.ok(buildCausalVerifierTask("packet.txt").includes("causal-verdicts-v1"));
  assert.ok(buildSourceVerifierTask("packet.txt").includes("source-verdicts-v1"));
});

test("direct reader and source verifier are verdict-disjoint BY MANIFEST — disagreement can only combine at the conductor", () => {
  // Neither role's artifact kinds include any verdict/review kind — there is
  // no artifact kind for "another reviewer's output" AT ALL, so the roles
  // cannot see each other's conclusions no matter what a caller passes
  // (an unknown kind fails the manifest check; a known kind carries content
  // the build screens). Independence is structural, not behavioral.
  const kinds = new Set([...REVIEWER_ROLE_MANIFESTS["direct-reader"], ...REVIEWER_ROLE_MANIFESTS["source-verifier"]]);
  for (const k of kinds) {
    assert.ok(["phase1-doc", "source-evidence", "source-plan"].includes(k), `no verdict-bearing artifact kind exists (${k})`);
  }
  assert.ok(!REVIEWER_ROLE_MANIFESTS["source-verifier"].includes("phase2-doc"), "the source verifier never sees the key either");
});
