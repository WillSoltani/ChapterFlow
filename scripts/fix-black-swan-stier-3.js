#!/usr/bin/env node
// S-tier pass 3: complete remaining breakdown expansions + begin explanation expansion (Ch2-6)
const fs = require('fs');
const path = 'book-packages/the-black-swan.v21.json';
const book = JSON.parse(fs.readFileSync(path, 'utf-8'));

// =========================================================
// Ch12 fullRead expansion (317 → 350+)
// =========================================================
{
  const ch = book.chapters[11];
  const current = ch.breakdown.fullRead;
  if (!current.includes('Camille')) {
    ch.breakdown.fullRead = current.trim() + "\n\nCamille's case sharpens the same point inside academia. A famous economist praises a research method she has not yet tested in her own lab. The method may be good or bad, but the famous endorsement is being treated as a substitute for the test. The discipline is to recognize that endorsement and validation are different things, and that endorsement without exposure is not a substitute for the validation the work still needs.";
  }
}

// =========================================================
// Ch16 fullRead expansion (265 → 350+)
// =========================================================
{
  const ch = book.chapters[15];
  const current = ch.breakdown.fullRead;
  if (!current.includes('Astrid')) {
    ch.breakdown.fullRead = current.trim() + "\n\nAstrid's retailer dashboard repeats the failure at scale. A smooth colored curve ranks store performance with apparent rigor; the underlying record is shipping anomalies, promotion overlaps, and seasonal effects the curve has flattened into a single line. The dashboard looks polished enough that the retail VP is ready to act on it. The discipline that the chapter proposes — show the raw cases beside the curve, list the exclusions, run the ranking out of sample — would change the decision the dashboard is currently making, which is the test of whether the beauty was earning trust or borrowing it.";
  }
}

// =========================================================
// Begin explanation expansions — Ch2 (5 thin)
// =========================================================
{
  const ch = book.chapters[1];
  // Q1 (CI=0) — backward reading
  ch.quiz.questions[0].explanation =
"The visible winner produces a story that reads as if the route had been clear all along. The mistake is treating that story as evidence rather than as hindsight construction performed on a single survivor.";
  // Q2 (CI=1) — fictional writer
  ch.quiz.questions[1].explanation =
"Taleb uses Yevgenia precisely because no one had heard of her — the absence of real-world prestige strips away the credentialing that would otherwise dress the survivor's story as causal explanation.";
  // Q3 (CI=0) — hidden losers
  ch.quiz.questions[2].explanation =
"The dataset is silently truncated to the cases that produced visibility. Without the cemetery of near-misses, the survivor's traits look causal because there is nothing comparable for the reader to weigh against them.";
  // Q4 (CI=0) — Maja
  ch.quiz.questions[3].explanation =
"One realized outlier cannot become a recipe by itself. Maja's correction is to put the famous breakout alongside comparable startups that tried similar moves and failed, so the rule gets tested against the population, not the survivor.";
  // Q6 (CI=0) — celebrity profile
  ch.quiz.questions[5].explanation =
"Every odd detail of the survivor's early life gets reinterpreted as foreshadowing — the story is laundering surprise into destiny. The same details existed in thousands who did not become famous, but their stories never get written.";
}

// =========================================================
// Ch4 (8 thin) — turkey
// =========================================================
{
  const ch = book.chapters[3];
  // Q1 (CI=0)
  ch.quiz.questions[0].explanation =
"The turkey promotes repeated support into a guarantee about permanent safety. The error is mistaking evidence-about-the-current-regime for evidence-about-the-system, which lets a longer record produce a more confident wrong inference.";
  // Q2 (CI=2) — turkey unsettling
  ch.quiz.questions[1].explanation =
"The evidence the turkey collects is real, and the inference still fails. The chapter is attacking the leap from accurate observation to assured continuation — the same leap institutions make after a calm stretch.";
  // Q3 (CI=0)
  ch.quiz.questions[2].explanation =
"Sample size can grow faster than structural knowledge. More days of confirmation do not test the assumption that the regime continues; they test what happens inside the regime, which is a much narrower question.";
  // Q4 (CI=0)
  ch.quiz.questions[3].explanation =
"Stable periods often tempt actors to remove margins they still need. Adding leverage after long calm is the canonical turkey move at the institutional scale — confidence rises while the buffer that would absorb the surprise shrinks.";
  // Q5 (CI=1)
  ch.quiz.questions[4].explanation =
"The chapter is not banning ordinary inference. It is refusing the specific move of promoting past support into assured continuation, which is what makes the calm record dangerous after a long quiet stretch.";
  // Q7 (CI=0)
  ch.quiz.questions[6].explanation =
"Recent support describes the past interval, not every future condition. 'Nothing bad has happened for years' is true about the years that already happened — it is silent about the conditions those years did not contain.";
  // Q8 (CI=0)
  ch.quiz.questions[7].explanation =
"Organizations turn reassurance into leverage and reduced slack. Capital buffers fall after calm quarters; safety margins get cut after uneventful inspection cycles. The first regime change finds a less-protected institution than the calm record would suggest.";
  // Q9 (CI=1)
  ch.quiz.questions[8].explanation =
"The discipline is to use the sample to describe the past without certifying the regime that produced it. The record can guide local decisions; it cannot license a decision sized for conditions the sample did not include.";
}

// =========================================================
// Ch5 (8 thin) — confirmation bias
// =========================================================
{
  const ch = book.chapters[4];
  // Q1 (CI=2)
  ch.quiz.questions[0].explanation =
"The chapter is criticizing protected belief, not evidence itself. The mockery targets the habit of collecting friendly support and treating its accumulation as if it had pressured the claim.";
  // Q2 (CI=1)
  ch.quiz.questions[1].explanation =
"A belief earns trust when contradiction gets access to it. Disconfirming evidence is the thing that actually tests the claim — confirming evidence just adds weight to one side of an already-tilted scale.";
  // Q3 (CI=0)
  ch.quiz.questions[2].explanation =
"Selection upstream changes the meaning of support downstream. If the search itself filtered out disconfirming cases, the volume of confirming evidence measures the filter, not the claim's robustness.";
  // Q4 (CI=1)
  ch.quiz.questions[3].explanation =
"A flattering dashboard can become a confirmation device when only favorable metrics are visible. The dashboard's apparent rigor is borrowed from the metrics it shows; the missing metrics are doing the actual epistemic work.";
  // Q5 (CI=0)
  ch.quiz.questions[4].explanation =
"The stronger question is whether contradiction got real access to the claim. 'How much support?' counts confirming evidence; 'What would count against it?' tests whether the search invited the falsifier.";
  // Q6 (CI=2)
  ch.quiz.questions[5].explanation =
"Evidence-rich style can conceal a protected prior. A fact-heavy process feels disciplined because the volume is real, but the volume measures collection effort, not whether the disconfirming case was ever invited in.";
  // Q7 (CI=0)
  ch.quiz.questions[6].explanation =
"Inside institutions, incentives can make support politically cheaper than disproof. Bringing in disconfirming evidence may cost more reputationally than collecting more supporting evidence, so confirmation accumulates structurally.";
  // Q8 (CI=2)
  ch.quiz.questions[7].explanation =
"A claim only gets stronger when unfriendly conditions get a turn. Testing with users likely to say no — instead of enthusiastic early adopters — exposes the case to the pressure that would actually falsify a product hypothesis.";
}

// =========================================================
// Ch6 (9 thin) — narrative fallacy
// =========================================================
{
  const ch = book.chapters[5];
  ch.quiz.questions[0].explanation =
"The narrative fallacy is the habit of compressing messy reality into a tidy explanatory story. The compression makes the explanation feel complete, but the cleanness comes from omission rather than analysis.";
  ch.quiz.questions[1].explanation =
"Stories are persuasive after the fact because they select details, assign causes, and remove the mess that made the event uncertain in real time. The audience hears a tidy explanation and reads it as a discovered structure.";
  ch.quiz.questions[2].explanation =
"Omission lets the explanation feel cleaner and more complete than reality was. The story's elegance depends on what was cut, not just on what was kept — and the cut details often contained the alternative cause.";
  ch.quiz.questions[3].explanation =
"The correction is to ask what uncertainty and omitted factors were cut to produce the elegant cause. A postmortem that names one cause is almost certainly suppressing two or three others that the team had not yet ruled out.";
  ch.quiz.questions[4].explanation =
"Hindsight lets causes be arranged as if they had been obvious all along. The chapter shows how the same arrangement looks intuitive in retrospect and was actually contested in real time — until the outcome resolved which thread mattered.";
  ch.quiz.questions[5].explanation =
"Emotional relief can be mistaken for genuine understanding. The story feels right because it resolves the discomfort of an uncertain event, not because it has identified the actual mechanism that produced the outcome.";
  ch.quiz.questions[6].explanation =
"The stronger question after a perfectly shaped explanation is 'What had to be cut away to make it look that clean?' If the answer is 'nothing important,' the story may be sound. If the answer is 'several plausible causes,' the elegance is decoration.";
  ch.quiz.questions[7].explanation =
"Polished explanations train forecast overconfidence by making past events feel inevitable. Once the team treats yesterday's story as the obvious cause, tomorrow's forecast inherits the same false-clarity instinct.";
  ch.quiz.questions[8].explanation =
"A family story turning one career into a noble arc is narrative compression at the household scale. The arc hides the luck, the contingent decisions, and the omitted factors that the real career actually depended on.";
}

let mlMissing = 0;
book.chapters.forEach((ch, ci) => {
  const prose = (ch.breakdown.fastRead||'')+'\n'+(ch.breakdown.deepRead||'')+'\n'+(ch.breakdown.fullRead||'');
  ch.memorableLines.forEach((ml, i) => {
    const t = typeof ml === 'string' ? ml : ml.text;
    if (!prose.includes(t)) { mlMissing++; console.log('  Ch'+(ci+1)+' ML'+(i+1)+' missing: '+t); }
  });
});
console.log('ML verbatim missing:', mlMissing);

fs.writeFileSync(path, JSON.stringify(book, null, 2) + '\n');
console.log('S-tier pass 3 applied (Ch12/Ch16 fullRead + Ch2/4/5/6 explanations).');
