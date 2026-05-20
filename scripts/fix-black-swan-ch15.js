#!/usr/bin/env node
const fs = require('fs');
const path = 'book-packages/the-black-swan.v21.json';
const book = JSON.parse(fs.readFileSync(path, 'utf-8'));
const ch = book.chapters[14];

// =========================================================
// FIX 1 — Repair Q8 (prompt/correct mismatch). correctIndex → 0
// =========================================================
{
  const q = ch.quiz.questions[7];
  q.prompt = "A risk committee stops reading at the 99% VaR threshold. What question belongs just beyond that reported line?";
  q.choices = [
    "What losses occur beyond the threshold, and could any of them threaten the firm's survival?",
    "Anything beyond 99% can be ignored because the tail is statistically rare and reporting it would add noise to the committee's view.",
    "The VaR chart should be smoothed so executives can read it faster, since the committee's time is the binding constraint on risk review.",
  ];
  q.correctIndex = 0;
  if (q.correctAnswerIndex !== undefined) q.correctAnswerIndex = 0;
}

// =========================================================
// FIX 2 — Rewrite fastRead with Jonas scene
// =========================================================
ch.breakdown.fastRead =
"Jonas opens the loss histogram for a logistics insurer. The curve looks calm, twelve years of claims arranged in a clean bell shape. He almost signs the $220M renewal book. Then he sees the footnote: three port-closure events were excluded as \"sensitivity cases.\" Those three events caused 58% of historical losses. The model did not simplify risk. It moved the main risk outside the picture.\n\n" +
"The bell curve is useful only where extremes stay bounded — height, test scores, manufacturing tolerances. In domains where one case can dominate the total — wealth, losses, demand surges, ticket sales — the rare event is not an edge case. It is the thing that owns the outcome. The rule is simple: ask what the model has put outside the picture, and check whether that thing can own the loss.";

// =========================================================
// FIX 3 — DeepRead and FullRead rewrite
// ML1 must appear in deepRead verbatim.
// ML2 (unchanged) must appear in fullRead verbatim.
// ML3 (new in Fix 8) must appear in fullRead verbatim.
// =========================================================
ch.breakdown.deepRead =
"The fraud Taleb names is not computational; it is jurisdictional. The bell curve was built for bounded domains where no observation can take command of the total. Push it into Extremistan — wealth, market returns, book sales, disaster losses — and the same curve produces confident numbers built from outliers the model is not aware of.\n\n" +
"Look at how a logistics insurer can lose 58% of historical claims to three port-closure events the model treated as \"sensitivity cases.\" Look at how a wealth chart can show a normal curve around household net worth while twelve households hold more than the bottom 90%. Look at how a 99% VaR report can end exactly where the firm-killing loss begins. In each case the curve does not just produce a wrong number. It moves the most consequential risk outside the analyst's field of view. The useful move is to ask what the visible record cannot prove.\n\n" +
"Statistical elegance becomes operationally expensive when catastrophes start to look like exotic footnotes instead of the structural features they actually are. The first move is not to abandon distributions but to ask, before any model is trusted, what it has excluded and whether that exclusion is the thing most likely to hurt you.";

ch.breakdown.fullRead =
"Taleb's \"fraud\" language for the bell curve is both methodological and moral. The curve carries the prestige of rigor — symmetry, central limit theorem, neat parameters — while quietly speaking beyond its jurisdiction. The curve keeps its prestige even after the terrain has changed. In bounded domains, where adding one new observation barely shifts the total, the trade is tolerable. The mean is informative, the standard deviation is stable, and ordinary statistics behave decently.\n\n" +
"In Extremistan the same machinery becomes dangerous. A model that fits a Gaussian to twelve years of insurance claims is reasonable only if the claims being modeled are bounded. The moment three port-closure events account for the majority of historical losses, the bell curve is not describing the risk — it is hiding it. The curve's symmetry forces extremes into the thin tails where the model trains itself to treat them as noise. The numbers come out cleanly. The risk is real. The picture is wrong.\n\n" +
"This is where the institutional cost shows up. A 99% VaR report that ends at the 99th percentile is mathematically defensible and operationally catastrophic. The 1% beyond that line is where the firm-killing loss sits. When the committee stops reading at the threshold, the model has not just underestimated risk — it has organized attention so the question of survival never gets asked. A ticket platform sizing capacity for ordinary weekly traffic produces clean averages and a queue that collapses when a superstar onsale arrives. A startup valuation textbook puts the bell curve on the first page and trains every subsequent reader to apply it to a domain where one breakout dominates the cohort. The tail is not the margin when it can own the loss.\n\n" +
"The remedy is small and habitual. Before trusting a model that uses a normal distribution, ask three things: what events did the model exclude, whether those events could dominate the outcome being decided, and whether the action being taken would survive the excluded scenario. A model that fails any of these questions is not yet useful — it is producing comfort with the cost moved outside the picture.";

// =========================================================
// FIX 4 — Polish Ex1, Ex5, Ex6 scenarios (vividness)
// =========================================================
ch.examples[0].scenario =
"Jonas leads risk modeling for a mid-size logistics insurer. The pricing committee meets Thursday to approve the $220M renewal book. He opens the loss histogram — twelve years of claims, a smooth bell curve, the standard deviation neatly under control. He's about to send the approval memo when he scrolls to the methodology footnote: three port-closure events from 2017, 2019, and 2022 were excluded as \"sensitivity-only cases.\" Those three events account for 58% of historical losses. The curve is calm because the largest losses are not in it.";

ch.examples[4].scenario =
"Javier sits on the financial risk committee at a regional bank. The VaR report on the projector reads $42M at the 99% threshold, small enough to support the larger credit book the CRO wants to approve. Javier scrolls to the appendix. Where the 99.5% and 99.9% scenarios should be, the report ends. The bank's worst historic month, eighteen years earlier, was $310M — and it isn't on the chart. The committee is being asked to commit capital using a picture that stops exactly where survival becomes uncertain.";

ch.examples[5].scenario =
"Sofia forecasts ticket demand for a concert platform with three weeks until the next stadium tour announcement. The weekly visit average is steady — 21,000 per week across the past four months. She drafts a capacity plan for 30,000 peak visits, generous against the average. Then she opens the historical archive: last year's superstar onsale produced 900,000 visits in under an hour, with a 47-minute queue that collapsed twice. The \"ordinary\" weekly curve has been hiding the only event that actually breaks the platform.";

// =========================================================
// FIX 5 — Practical distractor rewrites
// =========================================================
// Q1 (correctIndex=1): replace d[0] and d[2]
ch.quiz.questions[0].choices[0] =
  "Add a surcharge to every policy to cover the excluded storm events, since spreading the cost keeps premiums competitive on the standard cases.";
ch.quiz.questions[0].choices[2] =
  "Extend the calibration window to 25 years so the rare storms become part of the sample and the bell curve absorbs them.";
// Q2 (correctIndex=2): replace d[0]
ch.quiz.questions[1].choices[0] =
  "Because the bell curve underestimates variance in Extremistan, and a wider curve would capture the extreme observations the analyst is worried about.";
// Q3 (correctIndex=0): replace d[1] and d[2]
ch.quiz.questions[2].choices[1] =
  "It encourages firms to hold less capital, since regulators rely on the same understated tail and the gap goes unnoticed.";
ch.quiz.questions[2].choices[2] =
  "It pushes competitors to adopt the same model, since holding more capital than peers without justification puts the firm at a strategic disadvantage.";
// Q5 (correctIndex=1): replace d[2]
ch.quiz.questions[4].choices[2] =
  "Because the analysts using the curve usually know better, and the choice to keep using it after a domain mismatch is identified is what makes the misuse intentional.";
// Q6 (correctIndex=2): replace d[0] and d[1]
ch.quiz.questions[5].choices[0] =
  "By teaching every new analyst that the bell curve is the default, so the next generation stops asking the jurisdiction question.";
ch.quiz.questions[5].choices[1] =
  "By giving the board a confidence interval to point at, which substitutes for the harder question of whether the domain fits the curve at all.";
// Q7 (correctIndex=1): replace d[0] and d[2]
ch.quiz.questions[6].choices[0] =
  "The student's instinct to use the first distribution they learned, since the bell curve is the most familiar shape from introductory statistics.";
ch.quiz.questions[6].choices[2] =
  "The convenience of having a single distribution for every problem, since switching curves per domain would complicate the analysis.";
// Q9 (correctIndex=2): replace d[0] and d[1]
ch.quiz.questions[8].choices[0] =
  "Use the weekly average and add a 20% buffer, since the historical traffic has been stable and the buffer should absorb most unexpected demand.";
ch.quiz.questions[8].choices[1] =
  "Plan capacity around weekday peaks rather than weekly averages, since weekday peaks are the highest sustained load the platform sees.";

// Sanity: verify no correctIndex overwrite
[[0,0],[0,2],[1,0],[2,1],[2,2],[4,2],[5,0],[5,1],[6,0],[6,2],[8,0],[8,1]].forEach(([qi,di]) => {
  if (ch.quiz.questions[qi].correctIndex === di) {
    throw new Error(`Fix5 wrote over correct answer at Ch15 Q${qi+1} d[${di}]`);
  }
});

// =========================================================
// FIX 6 — Review card replacement
// =========================================================
const cards = ch.reviewCards;
cards[0].front = "What does it mean for a domain to be 'tail-dominated'?";
cards[0].back  = "A small number of extreme observations account for most of the total. In a logistics insurer's claim record, three port-closure events caused 58% of losses. When you remove those three, the picture is unrecognizable. That asymmetry is the signature of tail dominance.";

cards[1].front = "A model marks certain events as 'sensitivity cases' and excludes them. What question should you ask?";
cards[1].back  = "What share of historical loss do those excluded events represent? If the answer is more than a few percent, the model has not handled them — it has hidden them. The 'sensitivity case' label is often where the main risk is being parked.";

cards[2].front = "What is the most dangerous thing about a 99% VaR report?";
cards[2].back  = "It draws the eye to the line and stops there. The 1% beyond the threshold is exactly where firm-killing losses sit. A risk committee that does not ask 'what's past the line' is being trained by the report to ignore the question that matters most.";

cards[3].front = "What single number reveals whether a wealth or income distribution is fat-tailed?";
cards[3].back  = "The share of the total held by the top 1% (or top 10) of observations. If the top 1% holds 30%+ of household net worth, the bell curve is the wrong shape. The right move is to report the top-tail contribution beside any mean or median before drawing policy conclusions.";

cards[4].front = "What is the operational move when you see a Gaussian model in a domain with extreme outcomes?";
cards[4].back  = "Ask three questions: what events the model excluded, whether those events can dominate the outcome being decided, and whether the action would survive the excluded scenario. If any answer is uncertain, the curve is producing comfort without information.";

// =========================================================
// FIX 7 — Tail Dominance Check framework
// =========================================================
ch.implementationPlan.coreSkill =
"You apply the Tail Dominance Check before trusting any model that reports a calm number. The check is five questions: (1) Domain — is this bounded like height, or scalable like wealth, losses, demand, fame, sales, or market shocks? (2) Tail — what extreme case is the model treating as negligible? (3) Dominance — could that extreme case dominate total loss, demand, or outcome? (4) Exclusion — did the model remove the worst cases as anomalies? (5) Action — what changes if the tail is central, not marginal? A model that fails any of these is producing comfort without information.";

ch.implementationPlan.twentyFourHourChallenge =
"Find one model, dashboard, or forecast in your workflow that reports a clean average. Apply the five Tail Dominance Check questions to it. Write down the answer to question 4 (what was excluded) and question 3 (whether the excluded case could dominate).";

// =========================================================
// FIX 8 — Replace memorable line #3
// =========================================================
ch.memorableLines[2].text = "The tail is not the margin when it can own the loss.";

// =========================================================
// SAVE
// =========================================================
fs.writeFileSync(path, JSON.stringify(book, null, 2) + '\n');
console.log('Saved.');
