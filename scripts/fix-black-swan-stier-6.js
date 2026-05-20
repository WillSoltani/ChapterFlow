#!/usr/bin/env node
// S-tier pass 6: Ch17-19 explanations + sweep "The warning" in quiz choices
const fs = require('fs');
const path = 'book-packages/the-black-swan.v21.json';
const book = JSON.parse(fs.readFileSync(path, 'utf-8'));

// =========================================================
// Ch17 (5 thin) — Locke's madmen
// =========================================================
{
  const ch = book.chapters[16];
  ch.quiz.questions[1].explanation =
"A good tool in the wrong domain misleads badly because the formality of the curve persists even when the assumptions break. Location alone can make the curve's claims dishonest — the math is correct and the use is not.";
  ch.quiz.questions[2].explanation =
"Technical polish hides domain misfit by making the chart look rigorous regardless of whether the rigor matches the terrain. The dashboard has confidence intervals and decimal places, and the underlying assumptions may already have failed.";
  ch.quiz.questions[4].explanation =
"The chapter critiques unlicensed use, not measurement itself. Mathematics is fine; the dishonesty enters when a tool's coherence inside its origin domain gets used as license to apply it in a domain that does not satisfy its assumptions.";
  ch.quiz.questions[5].explanation =
"A wrong-domain tool cosmetically falsifies the world by making it look more bounded and orderly than it is. The dashboard imports smoothness assumptions into a domain that is actually rough, and the smoothness becomes the user's mental model.";
  ch.quiz.questions[8].explanation =
"Using one citation formula across departments with different citation norms imposes a single distributional assumption on multiple incompatible domains. The fix is to scope the formula to one department's norms and let other departments use the statistics that fit their actual citation patterns.";
}

// =========================================================
// Ch18 (5 thin) — Phony
// =========================================================
{
  const ch = book.chapters[17];
  ch.quiz.questions[1].explanation =
"The phony sells precision and authority beyond what the domain can support. The product is a confident number where the visibility is too weak to back it — and the audience pays for the certainty, not the evidence.";
  ch.quiz.questions[2].explanation =
"Prestige props — university logos, technical jargon, polished decimals — make weak visibility look like measurement. Status and style do the work of evidence, and the audience reads them as evidence because they are designed to be read that way.";
  ch.quiz.questions[4].explanation =
"The phony is more than merely mistaken because uncertainty is being hidden while authority is being performed. Ordinary error can still be honest about its limits; the phony's error is structural — the limits are exactly what gets concealed.";
  ch.quiz.questions[5].explanation =
"The chapter distinguishes real expertise with limits from counterfeit certainty. The target is bluff, not knowledge — and the distinction preserves the value of competence while attacking the performance of confidence without exposure.";
  ch.quiz.questions[6].explanation =
"A strategist selling a model after its original domain fit has expired is the phony using a prop after its license is gone. The credential continues to confer authority on a method the world has already moved past.";
}

// =========================================================
// Ch19 (6 thin) — Half and Half
// =========================================================
{
  const ch = book.chapters[18];
  ch.quiz.questions[1].explanation =
"Catastrophic downside must be capped before uncertainty is allowed to offer gains. The barbell's logic is asymmetric: the floor must be protected absolutely while the ceiling stays open for favorable surprise to reach.";
  ch.quiz.questions[2].explanation =
"Survival keeps you in the game long enough for learning, luck, and unexpected upside to matter. Predictive brilliance loses to robustness because the brilliant forecaster who gets wiped out by one bad surprise is no longer making forecasts.";
  ch.quiz.questions[4].explanation =
"Optionality preserves responsiveness to the future instead of locking the plan to one forecast. The actor stays able to react when the world reveals something new — the position has not been pre-committed to a single scenario.";
  ch.quiz.questions[5].explanation =
"The ending is not a control fantasy because it accepts opacity and focuses on arrangement instead of mastery. The chapter is not promising that no shocks will arrive — it is teaching how to be standing when they do.";
  ch.quiz.questions[6].explanation =
"The family is shaping exposure instead of denying uncertainty. Buffers and survivable commitments are the structural answer to a future that cannot be predicted — they let one shock arrive without unraveling the household plan.";
  ch.quiz.questions[7].explanation =
"The barbell holds the steady supplier as the base and adds small optional contracts elsewhere as the exposure. The middle position — moderate diversification that could touch the base — is what the structure refuses, because its loss is harder to cap than it looks.";
}

// =========================================================
// Sweep "The warning" placeholder text in quiz choices (book-wide)
// =========================================================
let choicesFixed = 0;
const warningChoices = /\bThe warning\b/;
book.chapters.forEach(ch => ch.quiz.questions.forEach(q => {
  q.choices.forEach((c, i) => {
    if (warningChoices.test(c)) {
      q.choices[i] = c.replace(/\bThe warning\b/g, 'The chapter');
      choicesFixed++;
    }
  });
}));
console.log('Choices with "The warning" placeholder fixed:', choicesFixed);

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
console.log('S-tier pass 6 applied (Ch17-19 explanations + choice cleanup).');
