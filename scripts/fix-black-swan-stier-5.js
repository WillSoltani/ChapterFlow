#!/usr/bin/env node
// S-tier pass 5: explanation expansions Ch12-Ch15
const fs = require('fs');
const path = 'book-packages/the-black-swan.v21.json';
const book = JSON.parse(fs.readFileSync(path, 'utf-8'));

// =========================================================
// Ch12 (8 thin) — Epistemocracy / skin in the game
// =========================================================
{
  const ch = book.chapters[11];
  ch.quiz.questions[0].explanation =
"Prestige outruns evidence and accountability when the speaker faces no consequence for being wrong. The board's first move is to require the exposure to be named before letting the polished recommendation set the vote.";
  ch.quiz.questions[1].explanation =
"The murkier the domain, the narrower honest authority becomes. Confident speech in an opaque domain is making a claim the visibility cannot back, and the chapter argues that authority should contract to match the actual visibility.";
  ch.quiz.questions[2].explanation =
"Accountability raises the cost of bluffing because the speaker must live with the recommendation's failure. Exposure converts confident speech into a price, and the price filters some of the unaccountable confidence the system would otherwise reward.";
  ch.quiz.questions[3].explanation =
"Authority is detaching from consequence-bearing contact when fluent experts avoid the fallout of bad advice. The institution selects for confidence and rewards it before the recommendation has been tested by the consequence it would actually produce.";
  ch.quiz.questions[4].explanation =
"Knowledge stays valuable when it survives stronger filters. The chapter is not against expertise — it is against expertise that has not been pressured by exposure, and it preserves competence as a distinct category from confident performance.";
  // Q5 choice cleanup — replace "The warning" with concrete subject
  ch.quiz.questions[4].choices[1] =
"Because the chapter still values competence and real domain contact even while attacking expertise that runs without accountability.";
  ch.quiz.questions[5].explanation =
"Institutions reward what is visible and legible, which means they reward credentials and fluency more than the contact with the domain that would actually inform the recommendation. The drift is structural, not personal.";
  ch.quiz.questions[6].explanation =
"The chapter wants calibrated trust, not blind deference to prestige. The student's halo-based trust skips the only test that matters — whether the famous expert has been exposed to the failure case the advice would produce.";
  ch.quiz.questions[8].explanation =
"Under uncertainty, trust should lean toward speakers carrying real constraint and consequence. The city council's best test of expert advice is who pays if the waiver fails — that answer should size the deference more than the credential does.";
}

// =========================================================
// Ch13 (9 thin) — Robust optionality
// =========================================================
{
  const ch = book.chapters[12];
  ch.quiz.questions[0].explanation =
"When you can't predict attendance, build the position so it can survive a wrong forecast. The bookstore plans for a range, caps the loss on the bad case, and keeps the structure intact for the next event.";
  ch.quiz.questions[1].explanation =
"The setup must remain standing when the story breaks. Designing for survival comes before chasing upside — once the position can absorb being wrong, the uncertain opportunity can be approached without converting forecast weakness into ruin.";
  ch.quiz.questions[2].explanation =
"Asymmetry matters because upside should stay open while downside stays limited. The chapter is teaching a structural posture, not an investment style — the same shape applies in careers, projects, and household decisions.";
  ch.quiz.questions[3].explanation =
"Survivable experiments do the work that one fragile commitment cannot. The startup preserves runway, runs multiple capped-cost tests, and keeps the option to redirect when one of them returns a real signal.";
  ch.quiz.questions[4].explanation =
"Optionality preserves room to respond when the future breaks the script. A rigid plan cannot adapt; a position with preserved choices can resize, redirect, or wait for evidence the original plan did not anticipate.";
  ch.quiz.questions[5].explanation =
"The first commitment should be small enough that an immediate refund, exit, or pilot termination is operationally possible without ruining the rest of the position. The setup is what makes intelligence usable, not the speech.";
  ch.quiz.questions[6].explanation =
"Capping the initial commitment at the level where a wrong forecast still leaves the project alive is the structural definition of robustness. The exit condition is written before the commitment, not negotiated after the surprise.";
  ch.quiz.questions[7].explanation =
"The $40K tooling option protects the cash the inventory purchase would have locked up before the demand signal arrived. The optionality lets the startup direct the eventual spend toward whichever SKU the launch data favors.";
  ch.quiz.questions[8].explanation =
"The farmer's recommendation is to build the plan so surprise does not kill the project. Crop choice under weak demand signals means smaller initial commitment, preserved alternatives, and an explicit exit before the bad case becomes ruin.";
}

// =========================================================
// Ch14 (8 thin) — Mediocristan vs Extremistan
// =========================================================
{
  const ch = book.chapters[13];
  ch.quiz.questions[0].explanation =
"The library's dataset mixes a bounded domain (ordinary delays) with a tail-dominated one (non-returns). The first move is to separate them — the same calculation cannot serve both, and the average will lie if both go into one bucket.";
  ch.quiz.questions[1].explanation =
"In Extremistan, one observation can rewrite the total in a way bounded domains do not allow. Averages and standard deviations behave differently before they are even calculated, because the underlying distribution does not bound the largest case.";
  ch.quiz.questions[2].explanation =
"Wrong-world intuition creates later mathematical error. Tools that behave well in bounded domains can fail in outlier-dominated ones — the domain identification is the prerequisite, not an optional step before the math.";
  ch.quiz.questions[3].explanation =
"A single bestseller dominating annual publishing revenue is the signature of Extremistan. The right domain logic is to separate the tail-dominating case from the long tail before assigning numbers to either — the average is misleading until that separation happens.";
  ch.quiz.questions[4].explanation =
"Human height is bounded — no person is ten times taller than another. Wealth scales freely — one person can hold thousands of times what another does. The classroom average is honest because height stays bounded; the wealth average is not.";
  ch.quiz.questions[5].explanation =
"The mean becomes weak when concentration is high. When one observation carries disproportionate weight in the total, the average summarizes the dominant case more than the population — and the user reads it as the typical case.";
  ch.quiz.questions[6].explanation =
"A bounded model was carried into a concentrated domain. City sizes follow scaling laws that human heights do not, so the averaging method that worked for the classroom fails for the regional planning office — the diagnosis precedes the calculation.";
  ch.quiz.questions[7].explanation =
"Using the average without separating the superstar from the long tail lets one observation rewrite the figure. The analyst's job is to identify the case dominating the total and report it separately before any average summary is taken seriously.";
}

// =========================================================
// Ch15 (9 thin) — Bell curves
// =========================================================
{
  const ch = book.chapters[14];
  ch.quiz.questions[0].explanation =
"The bell curve was built for bounded domains. A reinsurance model that excludes storm magnitudes the curve cannot fit is hiding the catastrophe-scale losses, not modeling them — and the institution's pricing inherits that gap.";
  ch.quiz.questions[1].explanation =
"In Extremistan, outliers can dominate the totals, and the bell curve's symmetry forces those outliers into thin tails the model treats as noise. The numbers come out cleanly while the actual risk sits outside the model's field of view.";
  ch.quiz.questions[2].explanation =
"Beyond numerical error, the wrong curve produces false calm and structural under-preparation. The institution organizes attention away from cases most likely to hurt it, because the curve treats them as edge cases rather than central risks.";
  ch.quiz.questions[3].explanation =
"A Gaussian model that mutes tail power in a domain where catastrophe can dominate is exactly the misuse the chapter is attacking. The fix is to refuse the model in this domain, not to recalibrate the curve and hope the tails behave.";
  ch.quiz.questions[4].explanation =
"The misuse is fraudulent because the curve keeps its prestige while speaking beyond its jurisdiction. Jurisdiction failure is the core charge — the math is honest in its home domain and dishonest the moment it crosses into a domain that does not satisfy its assumptions.";
  ch.quiz.questions[5].explanation =
"By making catastrophe look rarer and smaller than the domain warrants, a wrong distribution trains institutions to under-provision against exactly the cases that would damage them. Reports and policies inherit the curve's false calm.";
  ch.quiz.questions[6].explanation =
"Universalizing a bounded-domain tool because the bell curve feels familiar is the move the chapter refuses. A local tool is being promoted into a worldview without the domain check that would license the promotion.";
  ch.quiz.questions[7].explanation =
"The 99% VaR threshold is mathematically defensible and operationally catastrophic. The 1% beyond the line is where the firm-killing loss sits — and the committee's reading habit organizes attention away from the only question that matters most.";
  ch.quiz.questions[8].explanation =
"A tame-world curve is trespassing in a wild kingdom. Weekly averages describe ordinary demand; superstar onsales produce 900,000 visits in an hour. The capacity plan that depends on the average will collapse under the tail it was not sized for.";
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
console.log('S-tier pass 5 applied (Ch12-15 explanations).');
