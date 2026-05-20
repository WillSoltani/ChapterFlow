#!/usr/bin/env node
// Ch18 QC pass: expand fullRead (3 postures + hospital case), operational quiz,
// Q8 explanation fix, tag refinement, ML3 replacement, expand framework to 5 steps.
const fs = require('fs');
const path = 'book-packages/the-black-swan.v21.json';
const book = JSON.parse(fs.readFileSync(path, 'utf-8'));
const ch = book.chapters[17];

// =========================================================
// FIX: Expand fullRead — add wrong/honest/phony distinction + hospital case
// Must contain new ML3 verbatim
// =========================================================
ch.breakdown.fullRead =
"The phony is not defined by being wrong. A real expert can be wrong and still be doing honest work. The difference is in what the speaker does with weak visibility. Three postures are worth distinguishing.\n\n" +
"A wrong expert makes a confident call, the call fails, and the expert says publicly that it failed, updates the method, and revises future claims around the lesson. The credential remains real because it is attached to a track record that includes misses. An honest expert with limits says, before the call, that the domain provides only partial visibility, names the conditions under which the recommendation would change, and quotes prior calibration with its actual error rate. The audience leaves with a smaller claim and a clearer one.\n\n" +
"The phony does neither. The phony converts weak visibility into a performance of certainty. Decimal precision and prestige do most of the work. In the risk-model case, the output names a loss to seven figures even though no holdout set has tested the model. The audience hears specificity and mistakes it for contact with reality. In the consultant case, a university affiliation stands near a claim that the evidence does not support. The credential may describe education or status, but it does not prove that the method works in this company, this market, or this deadline.\n\n" +
"In the hospital case, Matthew's AI vendor cites 94% accuracy on a benchmark and resists breaking out miss rates by patient subgroup. The 94% was earned on the data the model was trained on. The pediatric edge cases — the ones a triage failure would actually injure — are exactly the cases the benchmark does not measure. The rollout is being asked to ride on a number whose conditions of validity do not match the conditions of deployment.\n\n" +
"The right questions are operational. Ask whether the method has been tested out of sample. Ask where it fails and how often. Ask what would falsify the recommendation and who would track the miss. Ask whether the speaker would still make the claim if the audience could not see the credential. Real expertise names its limits. The phony performs past them.";

// =========================================================
// FIX: Q1 — operational rewrite per QC
// =========================================================
ch.quiz.questions[0].choices[1] =
  "Require track record, falsifiers, and prior miss count before the precise number is credited as evidence.";
ch.quiz.questions[0].explanation =
  "Counterfeit certainty disappears the moment specifics are required. The exposure is procedural: ask for the calibration record before letting the polished call shape any decision.";

// =========================================================
// FIX: Q4 — concretize correct
// =========================================================
ch.quiz.questions[3].choices[2] =
  "Treat the decimals as borrowed precision and demand the prior calibration record before crediting the claim with the specificity it implies.";
ch.quiz.questions[3].explanation =
  "Decimal precision in a murky domain is decoration unless the prior calibration record supports it. The action is to demand that record before the precision earns trust.";

// =========================================================
// FIX: Q9 — make response operational
// =========================================================
ch.quiz.questions[8].choices[1] =
  "Demand that the briefing name the unknowables, the falsifier, and what would change the recommendation before the confident number is taken as guidance.";
ch.quiz.questions[8].explanation =
  "A confident recommendation in an unknowable domain is a performance unless it is paired with the unknowables, the falsifier, and the conditions for revision. Demanding these separates expertise from theater.";

// =========================================================
// FIX: Q8 — explanation per QC (text already operational)
// =========================================================
ch.quiz.questions[7].explanation =
  "The 94% benchmark was earned on limited test data, not the hospital's messy live cases. Before rollout, the hospital needs subgroup miss rates, out-of-sample accuracy, and documented failure modes.";

// =========================================================
// FIX: Strip template ending from all explanations
// =========================================================
const tplEnding = / The tempting wrong answer either overreads the visible case or ignores the case's specific pressure\.\s*$/;
for (let qi = 0; qi < 9; qi++) {
  const q = ch.quiz.questions[qi];
  if (q.explanation) q.explanation = q.explanation.replace(tplEnding, '').trim();
}

// =========================================================
// FIX: Sharpen Q2, Q3, Q5, Q6, Q7 (minor — keep CI, refine correct text)
// =========================================================
// Q2 (CI=0): concretize what the phony sells
ch.quiz.questions[1].choices[0] =
  "Precision and authority beyond what the domain can support — a confident number where the visibility is too weak to back it.";
// Q3 (CI=2): name the credibility props specifically
ch.quiz.questions[2].choices[2] =
  "Prestige props — university logos, technical jargon, polished decimals — make weak visibility look like measurement to audiences.";
// Q5 (CI=1): keep current ("uncertainty is being hidden while authority is being performed") — already sharp
// Q6 (CI=0): keep ("By distinguishing real expertise with limits from counterfeit certainty") — appropriate
// Q7 (CI=0): make refusal more operational
ch.quiz.questions[6].choices[0] =
  "Withhold credit from a model whose original domain fit has expired, regardless of who continues to sell it under the old credential.";

// Sanity: no correctIndex overwrites
[[0,1],[1,0],[2,2],[3,2],[6,0],[8,1]].forEach(([qi,di]) => {
  if (ch.quiz.questions[qi].correctIndex !== di) {
    throw new Error(`Ch18 Q${qi+1} correctIndex changed from ${di} to ${ch.quiz.questions[qi].correctIndex}`);
  }
});

// =========================================================
// FIX: Refine generic example tags
// =========================================================
ch.examples[2].tags = ["consumer_health_case", "health", "phony"]; // Sofia nutrition influencer
ch.examples[3].tags = ["retail_case", "retail", "phony"];           // Giulia retailer demand model
// Ex1 (Pablo media), Ex2 (Javier consulting), Ex5 (Andrew startup), Ex6 (Matthew hospital) keep current tags

// =========================================================
// FIX: Expand framework to 5 steps (add Failure modes) per QC table
// =========================================================
ch.implementationPlan.coreSkill =
"You apply the Borrowed Precision Audit before deferring to a fluent expert's precise claim. The check is five questions: (1) Precision — what exact number or confidence claim is being made? (2) Track record — has this method worked out of sample? (3) Failure modes — where does it fail, and how often? (4) Authority signal — is trust coming from evidence or from prestige? (5) Action — would we still trust the claim if the credential, logo, or style disappeared? A claim that fails the audit is theater dressed in decimals.";

ch.implementationPlan.twentyFourHourChallenge =
"Find one vendor demo, pundit prediction, or expert recommendation in your workflow that arrives with precise numbers. Apply the five Borrowed Precision Audit questions. Write down the answers to question 3 (the failure modes) and question 5 (whether the claim survives without the credential) and decide whether the claim still earns the trust it is asking for.";

// =========================================================
// FIX: ML3 — more direct, verbatim in fullRead
// =========================================================
ch.memorableLines[2].text = "Real expertise names its limits.";
ch.memorableLines[2].location = "breakdown.fullRead";

// =========================================================
// Verify verbatim
// =========================================================
const prose = ch.breakdown.fastRead + '\n' + ch.breakdown.deepRead + '\n' + ch.breakdown.fullRead;
ch.memorableLines.forEach((ml, i) => {
  if (!prose.includes(ml.text)) throw new Error(`ML${i+1} not verbatim: ${ml.text}`);
});

fs.writeFileSync(path, JSON.stringify(book, null, 2) + '\n');
console.log('Ch18 QC pass applied.');
