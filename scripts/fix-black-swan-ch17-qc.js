#!/usr/bin/env node
// Ch17 QC pass: concretize breakdown, remove meta-commentary, retag examples,
// sharpen quiz answers, fix Q8 explanation, replace ML2/ML3.
const fs = require('fs');
const path = 'book-packages/the-black-swan.v21.json';
const book = JSON.parse(fs.readFileSync(path, 'utf-8'));
const ch = book.chapters[16];

// =========================================================
// FIX A — fastRead: close with new ML3 text verbatim
// =========================================================
ch.breakdown.fastRead =
"Matteo is a strategist selling a churn model built for cable subscribers. A professional services firm wants the same model for their consulting clients. Matteo could relabel the inputs and quote the same accuracy. Then he reads what the model was calibrated on: 8 years of monthly billing data, 4 million subscribers, contractual flat-rate pricing, near-zero switching cost. The new domain has none of those. A method earns its authority inside one domain and loses it the moment it crosses into another that does not honor its assumptions. A rigorous tool in the wrong place is still the wrong tool. The wrongness arrives wearing the costume of the right one.";

// =========================================================
// FIX 1+2 — deepRead and fullRead: concrete examples, no meta-commentary
// Must contain ML2 ("Precision is not permission.") verbatim in deepRead
// =========================================================
ch.breakdown.deepRead =
"The point this chapter is pressing is jurisdiction. A method can be respectable in one setting and deeply misleading in another, and technical appearance often protects the mismatch. Look at how the failures actually arrive.\n\n" +
"Marit's protest-risk model was trained on stable cities; applied to a city whose transit had just collapsed and whose unemployment had doubled, the calibration period belongs to a different country. The output looks scientific while the terrain has changed underneath it. Pavel's insurance wellness score was calibrated on office employees whose step counts gave the metric meaning; applied to a factory workforce, the score now penalizes people working twelve-hour shifts on their feet. The number is computed correctly and reports the wrong thing. Luca's sales dashboard wears a university benchmark badge and produces win probabilities to one decimal, but the benchmark was earned in a different industry's contract cycle.\n\n" +
"The shared shape is small and consistent: a method that was honest in one domain crosses into another that does not satisfy its assumptions, and the formality survives the crossing while the validity does not. Precision is not permission. A neat instrument in the wrong setting can become worse than a visibly crude one, because polish protects it from suspicion. The first move is not to abandon formal tools but to ask whether the tool's origin domain actually matches the domain in front of you — and to refuse the import if it does not.";

ch.breakdown.fullRead =
"Locke's madmen sit at the center of a specific institutional failure: a formal tool, valid where it was built, is carried into a new domain that does not satisfy its assumptions, and the formality survives the crossing while the validity does not. The result is not numerical weakness alone — it is institutional overconfidence and conceptual confusion. The method gets to wear a badge it did not earn.\n\n" +
"Examples make the structure visible. Mateusz's AI triage model scores 94% on clean help-desk prompts and 61% on the malformed refund requests it will actually see in production. The benchmark was earned in the easy domain; rollout proceeds anyway because the headline number is impressive. Marco's psychology paper fits a neat curve to burnout scores collected from one software company during a high-attrition quarter — the curve is a clean fit to a self-selected, mid-crisis sample, and is now being cited as a general finding about employee burnout. The mathematics is correct. The generalization is not.\n\n" +
"The pattern is jurisdictional. A method's assumptions defined the domain in which the method was honest. When the assumptions break in a new domain, the precision is no longer earned, but the appearance of rigor is. Dashboards still have confidence intervals. Models still produce decimals. Reports still cite calibration. The trappings travel; the licensure does not. The damage compounds because the second tool — the dashboard, the score, the benchmark — looks more rigorous than the practitioner's intuition, and the practitioner backs down.\n\n" +
"The remedy is small and habitual. Before trusting a formal tool in a new context, list its assumptions, mark which hold and which do not, and require validation on the new domain's own data. A method that fails any of these is producing comfort without measurement. The tidy curve in the wrong place is producing comfort the domain has not earned, and the wrongness arrives wearing the costume of the right one.";

// =========================================================
// FIX 3 — Retag examples to domain-specific (healthcare/policy/sales/insurance/AI)
// =========================================================
ch.examples[0].tags = ["public_policy_case", "policy", "Locke's madmen"];
ch.examples[1].tags = ["healthcare_case", "research", "Locke's madmen"];
ch.examples[2].tags = ["sales_case", "sales", "Locke's madmen"];
ch.examples[3].tags = ["sales_case", "business", "Locke's madmen"];
ch.examples[4].tags = ["insurance_case", "insurance", "Locke's madmen"];
ch.examples[5].tags = ["ai_case", "ai", "Locke's madmen"];

// =========================================================
// FIX 5 — Q1: include enforcement-bias dimension (sharper correct)
// =========================================================
ch.quiz.questions[0].choices[0] =
  "Test whether the enforcement data measures crime incidence or policing behavior, since past arrest patterns can encode patrol decisions that the model then projects forward as future crime.";
ch.quiz.questions[0].explanation =
  "Hotspot tools trained on past arrests inherit the patrol pattern that produced those arrests. Before the bell curve earns trust, the team must check whether the data measures crime or policing.";

// =========================================================
// FIX 4 — Make Q4 and Q7 correct answers concrete actions
// =========================================================
ch.quiz.questions[3].choices[1] =
  "Validate the model on data from the new, unstable domain before any allocation is sized against its outputs.";
ch.quiz.questions[3].explanation =
  "Internal coherence in a stable domain says nothing about a domain that changes its own rules. The action is validation on the new domain's own data, not deference to the model's prior calibration.";

ch.quiz.questions[6].choices[0] =
  "Require domain-fit evidence before letting confidence intervals and polished curves influence the allocation.";
ch.quiz.questions[6].explanation =
  "Visual rigor is being mistaken for epistemic rigor. The chapter pushes back by requiring evidence that the method fits this domain, not by trusting the dashboard's appearance.";

// =========================================================
// FIX 6 — Q8: fix prompt context (CTO/support, not hospital) and explanation
// =========================================================
{
  const q8 = ch.quiz.questions[7];
  q8.prompt =
    "An AI vendor's benchmark table shows 94% accuracy on clean help-desk prompts. The support team will use the model on malformed refund requests. What should the CTO demand before rollout?";
  q8.choices[1] =
    "Require out-of-sample validation on the support team's actual refund-request inputs before approving any production rollout.";
  q8.explanation =
    "The benchmark was earned on clean help-desk prompts, not malformed refund requests. Before rollout, the model must be tested on the messy inputs it will actually face.";
}

// =========================================================
// FIX explanations: strip template ending from Q2, Q3, Q5, Q6, Q9
// =========================================================
const tplEnding = / The tempting wrong answer either overreads the visible case or ignores the case's specific pressure\.\s*$/;
[1, 2, 4, 5, 8].forEach(qi => {
  const q = ch.quiz.questions[qi];
  if (q.explanation) q.explanation = q.explanation.replace(tplEnding, '').trim();
});
// Also clean Q1, Q4, Q7, Q8 just in case (already overwritten above but safe)
[0, 3, 6, 7].forEach(qi => {
  const q = ch.quiz.questions[qi];
  if (q.explanation) q.explanation = q.explanation.replace(tplEnding, '').trim();
});

// =========================================================
// FIX 7 — ML2: "Precision is not permission." (location moves to deepRead)
// FIX 8 — ML3: capitalize and sharpen
// =========================================================
ch.memorableLines[1].text = "Precision is not permission.";
ch.memorableLines[1].location = "breakdown.deepRead";
ch.memorableLines[2].text = "A rigorous tool in the wrong place is still the wrong tool.";
ch.memorableLines[2].location = "breakdown.fastRead";

// =========================================================
// Verify verbatim
// =========================================================
const prose = ch.breakdown.fastRead + '\n' + ch.breakdown.deepRead + '\n' + ch.breakdown.fullRead;
ch.memorableLines.forEach((ml, i) => {
  if (!prose.includes(ml.text)) throw new Error(`ML${i+1} not verbatim: ${ml.text}`);
});

// Check no meta-commentary remains in fullRead
const metaPatterns = [
  /this case is therefore the backstage machinery/i,
  /Frozen sources support a narrow paraphrase/i,
  /The lesson prepares this case/i,
  /it also prepares the next critique/i,
  /belongs in the middle of this lesson/i,
];
metaPatterns.forEach((re, i) => {
  if (re.test(ch.breakdown.fullRead) || re.test(ch.breakdown.deepRead)) {
    throw new Error('Meta-commentary still present (pattern ' + i + ')');
  }
});

fs.writeFileSync(path, JSON.stringify(book, null, 2) + '\n');
console.log('Ch17 QC pass applied.');
