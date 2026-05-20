#!/usr/bin/env node
// S-tier pass 4: explanation expansions Ch7-Ch11
const fs = require('fs');
const path = 'book-packages/the-black-swan.v21.json';
const book = JSON.parse(fs.readFileSync(path, 'utf-8'));

// =========================================================
// Ch7 (8 thin) — Antechamber of hope
// =========================================================
{
  const ch = book.chapters[6];
  ch.quiz.questions[0].explanation =
"The antechamber is the mental waiting room near an imagined rare reward. The mind keeps returning to the lucky branch, and the rehearsal starts to feel like preparation when nothing has actually moved the odds.";
  ch.quiz.questions[1].explanation =
"A vivid possibility is being handled as if it were much nearer than its probability warrants. The decision is being sized to the rehearsed image rather than to the base rate the comparable population would supply.";
  ch.quiz.questions[2].explanation =
"Visible winners dominate attention and crowd out the loser field. The deck pictures the viral launch with cinematic detail; the 303 apps in the same category that did not go viral arrive as a statistic with no narrative weight.";
  ch.quiz.questions[3].explanation =
"The corrective is to pull the public record of comparable attempts that did not become visible and place its count beside the hoped-for outcome before any commitment grows. Without that count, the rehearsal sizes the plan.";
  ch.quiz.questions[4].explanation =
"The stronger distinction is between how emotionally available the outcome feels and how likely the full population makes it. Vividness moves the first; only the denominator moves the second.";
  ch.quiz.questions[5].explanation =
"Hope imitates progress when repeated imagination feels like movement toward the outcome. The plan refines, the deck improves, the founder's confidence rises — and none of that has touched the actual probability of the rare event.";
  ch.quiz.questions[6].explanation =
"The vivid winner branch crowds out the missing failures around it. Each replay of the breakout strengthens the available case; each unmentioned launch that faded leaves no counter-evidence in the founder's reasoning.";
  ch.quiz.questions[8].explanation =
"A possibility can be real and still be badly overinhabited by the imagination. The vividness of the outcome is not evidence of its likelihood — it is evidence of how much the planner has been thinking about it.";
}

// =========================================================
// Ch8 (7 thin) — Silent Evidence
// =========================================================
{
  const ch = book.chapters[7];
  ch.quiz.questions[0].explanation =
"The missing evidence problem is that the failed cases never produced visibility, so they don't arrive in the dataset. Asking for the missing cases around the visible survivor is the operational move that resists the silent gap.";
  ch.quiz.questions[1].explanation =
"One visible winner is misleading when the hidden loser field would make the winner unrepresentative. The same traits that look causal in the survivor may have been just as common in the cases that failed.";
  ch.quiz.questions[2].explanation =
"The core inferential problem is drawing a rule from a single survivor before the missing comparison set is reconstructed. The winner arrives with story detail; the losers arrive as silence, and the silence does the wrong work.";
  ch.quiz.questions[3].explanation =
"Copying a unicorn story without studying similar failures is the canonical survivor-bias move. The founder treats the visible case as a map, when the actual map would require the failed marketplaces in the same vertical.";
  ch.quiz.questions[4].explanation =
"Survivor stories persuade because the winner arrives with narrative detail while the failures arrive as silence. Attention overweights what it can see, and the dataset's silent half does no persuading at all.";
  ch.quiz.questions[5].explanation =
"The stronger correction is to reconstruct the missing comparison set around the visible case. Without those comparable attempts, the rule the survivor is being used to defend has no test it can fail.";
  ch.quiz.questions[6].explanation =
"Silent evidence is more than a statistics issue because human attention overweights vivid winners and underweights absent failures. The bias is cognitive before it is statistical, which makes corrective discipline harder to install.";
}

// =========================================================
// Ch9 (8 thin) — Ludic fallacy
// =========================================================
{
  const ch = book.chapters[8];
  ch.quiz.questions[0].explanation =
"The error is treating messy reality as if it behaved like a bounded game. The model's rules and parameters were defined for a closed system; the actual domain changes its own rules and produces events the model cannot represent.";
  ch.quiz.questions[1].explanation =
"Bounded games create false comfort because fixed rules and countable moves make uncertainty look tamer than it is. The model behaves consistently inside its assumptions, which gets confused with the model being correct about the world.";
  ch.quiz.questions[2].explanation =
"The most important question after this lesson is whether the model belongs to the domain. Internal coherence tells you nothing about external fit — and the formal precision can persist long after the fit has expired.";
  ch.quiz.questions[3].explanation =
"False containment appears when a clean model is trusted beyond the messy domain it describes. The team treats market danger as bounded by the model's parameters, but the domain produces events outside those parameters.";
  ch.quiz.questions[4].explanation =
"A beautiful model can still fail badly because internal coherence does not guarantee external fit. The mathematics may be correct and the inputs precise, and the model's relationship to the actual domain may still be unlicensed.";
  ch.quiz.questions[5].explanation =
"Precision is dangerous in this lesson when it earns trust even though decisive uncertainty stays off-board. The decimal places imply contact with reality; the actual contact ended at the model's calibration boundary.";
  ch.quiz.questions[6].explanation =
"An adaptive domain is escaping a bounded frame. The scoring system works neatly until employees adapt around it — and the adaptation is exactly the kind of event the bounded model was designed to exclude.";
  ch.quiz.questions[8].explanation =
"A model must stay subordinate to the world it claims to describe. The manager's affection for the scoring system's neatness should not promote the model above the domain that has been quietly drifting away from its assumptions.";
}

// =========================================================
// Ch10 (8 thin) — Prediction
// =========================================================
{
  const ch = book.chapters[9];
  ch.quiz.questions[0].explanation =
"Forecasts are delivered with more confidence than their signal deserves. The number and the date create an appearance of foresight that the underlying domain often cannot support, and the audience treats the precision as evidence.";
  ch.quiz.questions[1].explanation =
"Prediction theater persists because institutions reward crisp speech more than calibrated limits. The hesitant forecaster loses status to the decisive one, and the institution keeps selecting voices that compress ambiguity into confident sentences.";
  ch.quiz.questions[3].explanation =
"The board's preference reveals the incentive system at work. Fluent confidence reads as competence in the room; calibrated uncertainty reads as weakness — and the selection bias then keeps producing the kind of forecaster that wins boardrooms.";
  ch.quiz.questions[4].explanation =
"False crispness changes decisions before reality corrects it. By the time the forecast is shown to be wrong, the capital has been allocated, the headcount has been hired, and the strategy has been built around the implied precision.";
  ch.quiz.questions[5].explanation =
"Prestige can be borrowed through polished formality and tidy models that imitate signal. The forecast inherits credibility from the form it arrives in, even when the underlying method has no calibration record to support the form.";
  ch.quiz.questions[6].explanation =
"In opaque, tail-heavy domains, the forecast horizon should narrow to the window where prior evidence is dense, and any longer-range claim should carry the test that would falsify it. Otherwise the forecast is producing confidence the domain has not granted.";
  ch.quiz.questions[8].explanation =
"Treating the forecast as louder than the evidence and reducing its authority is the right humility move. The plan should not depend on the forecast being precise; it should be sized for the range the evidence actually supports.";
}

// =========================================================
// Ch11 (8 thin) — Practical search
// =========================================================
{
  const ch = book.chapters[10];
  ch.quiz.questions[0].explanation =
"Practical search starts with traces rather than stories. Before turning the unknown migration into a confident narrative, the field team should look at what reality has already left behind — and design the cheap probe that would produce real information.";
  ch.quiz.questions[1].explanation =
"The bird-poop image shifts attention to traces that reality actually leaves. The grand story is constructed; the trace is given. In opaque domains, the given is more informative than the constructed because the trace cannot be invented backward from the conclusion.";
  ch.quiz.questions[2].explanation =
"Search is stronger than fake foresight because it creates feedback while opaque conditions are still being explored. The forecast tries to specify what will happen; the search lets the domain tell you what is actually happening.";
  ch.quiz.questions[3].explanation =
"Small exploratory contact with reality teaches more than a confident story that has not met the world. The founder's market bet becomes informed by what four real customers complain about, not by what the deck claims they will want.";
  ch.quiz.questions[4].explanation =
"Optionality preserves room to respond when a real opening appears. The team that has not committed everything to one bet can still redirect when the search returns evidence the original plan did not anticipate.";
  ch.quiz.questions[5].explanation =
"The chapter resists cynicism by demanding honest humility about what cannot be seen. Pragmatism is not the rejection of inquiry — it is the refusal to fake the answers inquiry hasn't yet produced.";
  ch.quiz.questions[6].explanation =
"Letting traces challenge the map before the forecast sets the plan is the search discipline in practice. Complaints, anomalies, and unexpected results carry information the cleaner deck cannot, because they were not invented to fit a story.";
  ch.quiz.questions[8].explanation =
"Running a small honest search before making the forecast carry more authority than it has earned is the planner's safest move. The probe converts a contested claim into observed evidence, which can then size the larger commitment honestly.";
}

let mlMissing = 0;
book.chapters.forEach((ch, ci) => {
  const prose = (ch.breakdown.fastRead||'')+'\n'+(ch.breakdown.deepRead||'')+'\n'+(ch.breakdown.fullRead||'');
  ch.memorableLines.forEach((ml, i) => {
    const t = typeof ml === 'string' ? ml : ml.text;
    if (!prose.includes(t)) mlMissing++;
  });
});
console.log('ML verbatim missing:', mlMissing);

fs.writeFileSync(path, JSON.stringify(book, null, 2) + '\n');
console.log('S-tier pass 4 applied (Ch7-11 explanations).');
