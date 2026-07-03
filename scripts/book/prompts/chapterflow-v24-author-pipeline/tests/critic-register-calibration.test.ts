import assert from "node:assert/strict";

import { test } from "./harness.js";
import { checkSpecificScene, checkDecisionPoint } from "../src/critics/narrative.js";
import { checkQuizTestsApplication } from "../src/critics/pedagogy.js";
import { checkQuizStrawmanDistractors } from "../src/critics/quizQuality.js";

// ── C2 (checkSpecificScene): ancient/historical register is concrete ──────────
test("C2 recognizes ancient-register scenes (role/object/proper-place), not just modern offices", () => {
  const ancientRole = { scenario: "Eugenie's morning copywork breaks when a visitor laughs at the former slave teaching the room. Heat rises before the line is finished. She pauses for four breaths, sets the reed down, and restarts the lesson on what is up to us and what is not." } as any;
  assert.deepEqual(checkSpecificScene(ancientRole), [], "a scene with an ancient role (slave) + reed should not be flagged abstract");
  const properPlace = { scenario: "Anne stands outside Epictetus's room before the exercise begins, holding a wax tablet. Arrian will ask for examples of assent, and she has one narrow block of attention left to spend on the harder task of naming the impression before it earns her yes." } as any;
  assert.deepEqual(checkSpecificScene(properPlace), [], "proper-noun/possessive place + tablet should pass");
  // Still catches a genuinely abstract scene (no place/role/object anchor).
  const abstract = { scenario: "The idea of control matters because people who focus on what they cannot change tend to suffer more, while those who focus on their own judgments tend to stay steadier and calmer over the long run of a life." } as any;
  assert.ok(checkSpecificScene(abstract).some((f) => f.checkId === "narrative.specific_scene"), "a truly abstract scene still flags");
});

// ── C3 (checkDecisionPoint): only true-fork formats require a decision beat ────
test("C3 exempts non-decision formats; still fires on a fork-less decision_point", () => {
  const mistakeRecovery = { format: "mistake_recovery", scenario: "By dusk the order had not changed: the petition still failed. The useful evidence sat in the notebook beside three crossed-out complaints and one clean sentence about choice." } as any;
  assert.deepEqual(checkDecisionPoint(mistakeRecovery), [], "mistake_recovery is not a decision format — no decision beat required");
  const decisionNoFork = { format: "decision_point", scenario: "By dusk the order had not changed: the petition still failed. The useful evidence sat in the notebook beside three crossed-out complaints and one clean sentence about choice." } as any;
  assert.ok(checkDecisionPoint(decisionNoFork).some((f) => f.checkId === "narrative.decision_point"), "a decision_point with no fork still flags");
});

// ── D1 (checkQuizTestsApplication): scenario-anchored stem is application ──────
test("D1: scenario-anchored question stems are application; recall-about-text is the major", () => {
  const appStem = { prompt: "A log shows 4 rushed mornings in 6 days, all after she tried to predict every delay. What should she infer first?", choices: ["a", "b", "c"], correctIndex: 0 } as any;
  assert.deepEqual(checkQuizTestsApplication(appStem), [], "a 'what should she infer' stem is application, not a short-prompt hint");
  const recall = { prompt: "What does the chapter say about control?", choices: ["a", "b", "c"], correctIndex: 0 } as any;
  const r = checkQuizTestsApplication(recall);
  assert.ok(r.some((f) => f.severity === "major"), "recall-about-text is still a major");
  const shortVague = { prompt: "Pick the best option.", choices: ["a", "b", "c"], correctIndex: 0 } as any;
  assert.ok(checkQuizTestsApplication(shortVague).some((f) => f.severity === "minor"), "a genuinely vague short prompt still emits the minor hint");
});

// ── BP15: absolute inside a hypothetical misconception clause is not a tell ────
test("BP15 suppresses an absolute inside an 'as if' misconception clause; flags a bare absolute", () => {
  const named = { questions: [{ questionId: "q1", correctIndex: 0, choices: ["the grounded reading", "forgiveness requires acting as if the insult never happened"] }] } as any;
  assert.deepEqual(checkQuizStrawmanDistractors(named), [], "absolute inside 'acting as if … never' is part of the named misconception");
  const bare = { questions: [{ questionId: "q2", correctIndex: 0, choices: ["the grounded reading", "this approach never works"] }] } as any;
  assert.ok(checkQuizStrawmanDistractors(bare).some((f) => f.checkId === "BP15.quiz_strawman_distractor"), "a gratuitous absolute is still flagged");
});
