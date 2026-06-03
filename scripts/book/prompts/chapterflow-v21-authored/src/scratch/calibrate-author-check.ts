/**
 * Calibration harness for authoringContract.ts (Phase 1).
 *
 * Two-sided, like the AS13 protocol:
 *   (1) FALSE-POSITIVE side: the clean corpus (daring-greatly, start-with-why)
 *       must produce ZERO findings.
 *   (2) TRUE-POSITIVE side: golden-BAD fixtures built from the QC reports'
 *       VERBATIM corrupt examples must each fire the expected check. (The live
 *       corrupt chapters were repaired, so the documented quotes are the
 *       ground truth — the red-team's "pin the golden bads before repair erases
 *       them" mandate.)
 *
 * Run: npx tsx src/scratch/calibrate-author-check.ts
 */
import { readFileSync, readdirSync } from "node:fs";
import { checkAuthoringContract, ACFinding } from "../critics/authoringContract.js";
import type { ChapterV21 } from "../types.js";

let failures = 0;
const ok = (c: boolean, msg: string) => { console.log(`  ${c ? "✓" : "✗ FAIL"} ${msg}`); if (!c) failures++; };

// ── (1) clean corpus must be silent ──────────────────────────────────────────
console.log("FALSE-POSITIVE side — clean corpus must produce 0 findings:");
for (const book of ["daring-greatly", "start-with-why"]) {
  const files = readdirSync("state/chapters").filter((f) => f.startsWith(book + "-ch") && f.endsWith(".chapter.json"));
  let total = 0;
  const byCheck: Record<string, number> = {};
  for (const f of files) {
    const ch = JSON.parse(readFileSync("state/chapters/" + f, "utf8")) as ChapterV21;
    for (const x of checkAuthoringContract(ch)) { total++; byCheck[x.checkId] = (byCheck[x.checkId] ?? 0) + 1; }
  }
  ok(total === 0, `${book}: ${total} findings ${total ? JSON.stringify(byCheck) : ""}`);
}

// ── (2) golden-bad fixtures — minimal chapters carrying one documented defect ─
// A baseline CLEAN chapter we mutate one field at a time (so only the target
// check should fire). Built to pass everything by default.
function baseChapter(): ChapterV21 {
  return {
    chapterId: "fixture-ch01", number: 1, title: "Productive Vulnerability", readingTimeMinutes: 8,
    hook: "Trust is built in the smallest moments, not the grand gestures.",
    keyTakeaway: "Name the fear before the conversation and it loses its grip on the room.",
    breakdown: {
      fastRead: "After a missed deadline, a manager names the worry out loud and the team relaxes. The rule: say the hard thing first.",
      deepRead: "When a leader admits uncertainty, the room reorganizes around the real problem instead of around protecting status. A second team tries it and the meeting shortens by half.",
      fullRead: "The mechanism is exposure: a named fear can be examined, an unnamed one only spreads. A third group learns the limit — naming a fear you can't act on just performs vulnerability without the work.",
    },
    examples: [{ exampleId: "ex1", title: "The Reliability Repair", tags: ["work"],
      planSpec: { domain: "work", audience: "leads", stakes: "trust", format: "scene", requiredBeat: "decision" },
      scenario: "Aisha stays after the Thursday standup, the sprint board still showing two missed commitments. She has to decide whether to call out the slippage now or smooth it over.",
      whatToDo: "Aisha names the missed commitment plainly and asks what got in the way before assigning the next task.",
      whyItMatters: "Naming the gap turns a vague worry into a solvable problem the team can own together." }],
    quiz: { passingScorePercent: 70, questions: [{
      questionId: "q1", prompt: "Your peer keeps deflecting blame after a missed launch. What is the move?",
      choices: ["Separate what they control from what they merely did, and act on your own response.", "Keep score privately so no social weight lands on the team.", "Escalate to their manager before the next standup."],
      correctIndex: 0, explanation: "Conduct is theirs to own; control is yours. Acting on your own response keeps you from policing theirs, which is the only lever you actually hold.",
      bloomsLevel: "apply", depthLevel: "standard" }] },
    reviewCards: [{ cardId: "c1", front: "Why does naming a fear shrink it?", back: "A named fear can be examined and acted on; an unnamed one only spreads through the room.", difficulty: "medium" }],
    implementationPlan: { title: "Name the Scarcity Cue", coreSkill: "Spot the moment trust is at risk and say the hard thing first.",
      ifThenPlans: [{ context: "When a deadline slips and the room goes quiet", plan: "If the silence stretches, then name the miss plainly and ask what got in the way." }],
      twentyFourHourChallenge: "Say the hardest true thing in your next one-on-one.", weeklyPractice: "Open each retro by naming one risk before solutions." },
    memorableLines: [{ text: "Say the hard thing first.", location: "breakdown.fastRead", why: "compact, portable" }],
  };
}
function fires(ch: ChapterV21, checkId: string, sidecar?: any): boolean {
  return checkAuthoringContract(ch, sidecar ? { sidecar } : undefined).some((f: ACFinding) => f.checkId === checkId);
}

console.log("\nTRUE-POSITIVE side — golden-bad fixtures must fire the target check:");

// AC5 echo-template explanation (dare-to-lead 72/72) — restate key, no reasoning.
{ const ch = baseChapter(); const q = ch.quiz.questions[0];
  q.explanation = "The correct choice is to separate what they control from what they merely did and act on your own response. Your peer keeps deflecting blame after a missed launch.";
  ok(fires(ch, "AC5.echo_explanation"), "AC5 fires on echo-template explanation (restate key+prompt, no new content)"); }

// AC1 concept-as-actor — concept label as object of a cognition verb. Needs the
// sidecar's centralConcept (title is not used as a concept source anymore).
{ const ch = baseChapter();
  ch.examples[0].scenario = "Cleo studies productive vulnerability at her desk, then points toward the team.";
  ok(fires(ch, "AC1.concept_as_actor", { centralConcept: { name: "productive vulnerability" } }), "AC1 fires on 'studies <concept>' (with sidecar concept)");
  // AC1 must NOT fire when a person points to a real concrete object that merely
  // shares a word with the concept (the the-tipping-point false-positive).
  const ch2 = baseChapter(); ch2.examples[0].scenario = "Renee points to the unsticky cigarette on the counter and asks the room what changed.";
  ok(!fires(ch2, "AC1.concept_as_actor", { centralConcept: { name: "the stickiness factor" } }), "AC1 does NOT fire on 'points to the cigarette' (real object, not the abstraction)"); }

// AC6 card front not a question (drive 55/55 bare-label fronts).
{ const ch = baseChapter(); ch.reviewCards[0].front = "Motivation operating systems.";
  ok(fires(ch, "AC6.card_front_not_question"), "AC6 fires on bare-label card front 'Motivation operating systems.'"); }

// AC7 "X means The X is" seam (drive ×11).
{ const ch = baseChapter();
  ch.breakdown.deepRead = "Motivation operating system means The motivation operating system is the inner driver of behavior. " + ch.breakdown.deepRead;
  ok(fires(ch, "AC7.means_seam"), "AC7 fires on '<X> means The <X> is…' tautology seam"); }

// AC7 scaffold/editor-language leak.
{ const ch = baseChapter(); ch.implementationPlan.weeklyPractice = "Each week, revisit the hard edge and use TOMS as the source check.";
  ok(fires(ch, "AC7.scaffold_leak"), "AC7 fires on editor-facing 'revisit the hard edge' / 'as the source check'"); }

// AC8 templated loop (dare-to-lead fullRead ratio 0.78) — same clause, only the
// actor label rotates (the documented form).
{ const ch = baseChapter();
  ch.breakdown.fullRead = Array.from({ length: 14 }, (_, k) => `${["Aisha","Brent","Cleo","Dara","Evan","Faye","Gus","Hana","Ivan","Jo","Kit","Lena","Max","Nia"][k]} keeps the trust signal tied to the definition near the limit each time.`).join(" ");
  ok(fires(ch, "AC8.templated_loop"), "AC8 fires on a fullRead clause-loop (frame repeated, only label rotates)"); }

// AC4 whatToDo = abstract proposition, not action (drive).
{ const ch = baseChapter(); ch.examples[0].whatToDo = "It would be managed through mission badges, and campaign optics would outrank contribution.";
  ok(fires(ch, "AC4.whatToDo_proposition"), "AC4 fires on whatToDo that opens as an abstract proposition"); }

// AC2 source-paste — a 14+ word verbatim run shared with the sidecar.
{ const ch = baseChapter();
  const sidecar = { paraphraseNotes: "Vulnerability is the birthplace of courage and connection in every team that learns to dare greatly together." };
  ch.examples[0].whyItMatters = "It holds because vulnerability is the birthplace of courage and connection in every team that learns to dare greatly together.";
  ok(checkAuthoringContract(ch, { sidecar }).some((f) => f.checkId === "AC2.source_paste"), "AC2 fires on a 14+ word run pasted verbatim from the sidecar");
  const ch2 = baseChapter(); // paraphrased, not pasted → no long shared run
  ok(!checkAuthoringContract(ch2, { sidecar }).some((f) => f.checkId === "AC2.source_paste"), "AC2 does NOT fire on a paraphrase (no long verbatim run)"); }

// AC9 plan-context — a source-entity name used as context (not a terse topic).
{ const sidecar = { namedExamples: [{ label: "Brent Ladd at Purdue University" }] };
  const ch = baseChapter(); ch.implementationPlan.ifThenPlans[0].context = "Brent Ladd at Purdue University";
  ok(checkAuthoringContract(ch, { sidecar }).some((f) => f.checkId === "AC9.plan_context_source_entity"), "AC9 fires on a source-entity name used as context");
  const ch2 = baseChapter(); ch2.implementationPlan.ifThenPlans[0].context = "Youth selection";
  ok(!checkAuthoringContract(ch2, { sidecar }).some((f) => f.checkId.startsWith("AC9")), "AC9 does NOT fire on a terse topic label ('Youth selection')"); }

// AC11 framework-completeness — BRAVING named but a member missing (config: dare-to-lead).
{ const ch = baseChapter(); ch.chapterId = "dare-to-lead-ch07";
  ch.breakdown.deepRead = "BRAVING names the parts of trust: Boundaries, Reliability, Vault, Integrity, Nonjudgment, and Generosity each carry weight. " + ch.breakdown.deepRead; // Accountability missing
  ok(checkAuthoringContract(ch).some((f) => f.checkId === "AC11.framework_incomplete"), "AC11 fires when BRAVING is named but Accountability is missing");
  const ch2 = baseChapter(); ch2.chapterId = "dare-to-lead-ch07";
  ch2.breakdown.deepRead = "BRAVING: Boundaries, Reliability, Accountability, Vault, Integrity, Nonjudgment, Generosity. " + ch2.breakdown.deepRead;
  ok(!checkAuthoringContract(ch2).some((f) => f.checkId.startsWith("AC11")), "AC11 does NOT fire on a complete BRAVING enumeration"); }

// Negative control: the unmutated base chapter must be clean.
{ const ch = baseChapter(); const n = checkAuthoringContract(ch).length;
  ok(n === 0, `base (clean) fixture produces 0 findings ${n ? JSON.stringify(checkAuthoringContract(ch).map(f=>f.checkId)) : ""}`); }

console.log(`\n${failures === 0 ? "ALL CALIBRATION ASSERTIONS PASSED" : failures + " CALIBRATION FAILURE(S)"}`);
process.exit(failures === 0 ? 0 : 1);
