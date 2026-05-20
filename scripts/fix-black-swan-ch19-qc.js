#!/usr/bin/env node
// Ch19 QC pass: rewrite breakdown with concrete examples, fix Q1/Q4/Q9 prompt/answer
// mismatches, expand framework to 5 steps (add Optionality), replace ML2,
// refine generic tags.
const fs = require('fs');
const path = 'book-packages/the-black-swan.v21.json';
const book = JSON.parse(fs.readFileSync(path, 'utf-8'));
const ch = book.chapters[18];

// =========================================================
// FIX 1+2 — Rewrite deepRead (trim) and fullRead (strip meta "The warning" prose,
// add Anya/Camille/Nina concrete cases)
// Must contain ML1 + ML3 verbatim (location preserved) and new ML2.
// =========================================================
ch.breakdown.deepRead =
"The chapter keeps survival at the center because a person who can survive being wrong remains in the game long enough for learning, luck, and unexpected upside to matter. A person who needs the world to unfold neatly has built fragility into the plan from the start.\n\n" +
"Look at how the structure actually arrives. Isabel keeps three steady accounts that cover overhead and accepts a smaller engagement with the fast-growing client, refusing the six-month exclusive that would have made her income dependent on a single relationship. Anya keeps the $90K tuition reserve in cash and lets only the surplus reach the 6x startup note. Camille keeps the steady supplier under contract and adds a small optional second source rather than accepting the 7% discount for a two-year exclusive that would lock the line. In every case the structure does the same work: the base must survive what the exposure cannot.\n\n" +
"The posture earns resilience by refusing brittle elegance. Optionality is not indecision; it is preserved responsiveness. The future stays opaque, so the actor needs room to react rather than a fantasy of exact foresight. Do not guess harder. Shape your exposure better.";

ch.breakdown.fullRead =
"The ending gives weight to survival because survival is what keeps the rest of the lessons live. A person who avoids terminal damage can keep learning, adapting, and collecting the benefits of unexpected upside. A person who needs a neat world in order to remain whole has already surrendered too much to fragility. The practical wisdom here is architectural rather than prophetic: exposure must be shaped so that volatility becomes less terminal and sometimes favorable.\n\n" +
"This is why the structure matters more than the forecast. Isabel's small studio shows the move in compressed form. A fast-growing client offers a six-month exclusive that would replace her current revenue base. The contract is large; the exclusivity is what makes it dangerous. The exclusivity removes the steady accounts that would have kept her studio alive if the new client cancelled. Isabel keeps the base — three accounts that cover overhead — and accepts a smaller engagement with the new client that does not lock her in. The exposure is real; the base is intact.\n\n" +
"Anya runs the same structure in family finance. $90K is needed in 14 months for tuition; a startup note offers 6x upside but can go to zero. The honest move is not to choose between safety and upside but to separate them: tuition stays in cash, only the surplus reaches the note. Camille's procurement decision compresses it further. A 7% discount for a two-year exclusive looks attractive until the procurement asks what happens if the supplier fails or raises prices in year two. Keep the steady supplier under contract; add a small optional second source rather than letting one relationship own the line.\n\n" +
"The pattern is consistent: cap ruin, preserve optional paths, and remain reachable by favorable surprise. The middle — the moderate-risk commitment that feels safer than it is — is what the structure refuses, because a middle position's loss can touch the base. The closing posture is pragmatic: limit downside, preserve optionality, stay open to favorable asymmetry, and stop needing false certainty. Do not guess harder. Shape your exposure better.";

// =========================================================
// FIX 3 — Q1 rewrite: prompt asks what household structure protects first.
// Keep correctIndex=2 (no regression). Rewrite [2] to be the household-protection
// answer the QC asked for; rewrite [0] and [1] as plausible distractors.
// =========================================================
{
  const q = ch.quiz.questions[0];
  q.choices = [
    "Diversify across several venture opportunities so that gains from one offset losses from another, since spread is the structural answer to single-investment risk.",
    "Hold the majority of capital in the safest available instrument and the remainder in capped-loss positions whose maximum upside has no formal ceiling.",
    "Protect the core income stream — rent, payroll, household essentials — first, then use only the surplus that can be lost without disrupting those obligations.",
  ];
  // correctIndex stays 2 (the documented Ch19 Q1 expectation is not pinned, but we preserve no-regression policy)
  q.explanation = "The half-and-half structure starts with what must survive. The household's core income stream is the base; venture upside is sized against the surplus that is allowed to disappear without disrupting rent, payroll, or essentials.";
}

// =========================================================
// FIX 4 — Q4 rewrite: prompt about founder keeping paths alive.
// Keep correctIndex=0. Rewrite [0] to mention preserving core runway + small capped bets.
// =========================================================
{
  const q = ch.quiz.questions[3];
  q.choices = [
    "Preserve the runway that keeps the company alive for another nine months, then run several capped-cost experiments in parallel rather than committing the full burn to one bet.",
    "Staged venture investment — each tranche conditioned on the prior milestone — converts risk discipline into a capital efficiency strategy rather than a survival structure.",
    "Survivability-weighted portfolio management treats each bet as independent, since no individual experiment can end the enterprise when allocation is sized correctly.",
  ];
  q.explanation = "The founder's barbell starts with the runway that keeps the company alive. Multiple small bets are the exposure side; the runway is the base they sit on. Without preserving the base, 'multiple paths' is just diversified fragility.";
}

// =========================================================
// FIX 5 — Q9 rewrite: prompt about tuition + surplus.
// Keep correctIndex=1. Rewrite [1] to be the tuition-safe/surplus-only answer.
// =========================================================
{
  const q = ch.quiz.questions[8];
  q.choices = [
    "Diversify the surplus across assets that fail for different reasons, then keep the required tuition reserve outside the risky account to limit correlated drawdowns.",
    "Keep the required tuition money in cash or a guaranteed instrument and use only the surplus account for any asymmetric upside positions that could go to zero.",
    "Move the entire surplus to high-quality fixed income when the household's goal is preserving a buffer rather than seeking asymmetric upside in this allocation.",
  ];
  q.explanation = "The household's required tuition is the base. It must survive the worst case the surplus is being exposed to. The barbell structure says cash for the base, asymmetric upside for the surplus — and no middle position whose loss could touch the tuition.";
}

// =========================================================
// FIX — Strip Ch19 explanation template variants (some leftover after generic strip)
// =========================================================
const tplA = /\s*The tempting wrong answer either [^.]+\.\s*$/;
ch.quiz.questions.forEach(q => {
  if (q.explanation && tplA.test(q.explanation)) {
    q.explanation = q.explanation.replace(tplA, '').trim();
  }
});

// =========================================================
// FIX 6 — Refine generic example tags (career, finance, household, procurement)
// =========================================================
ch.examples[0].tags = ["small_business_case", "small_business", "half and half"];     // Isabel studio
ch.examples[1].tags = ["career_case", "career", "half and half"];                     // Catarina career
ch.examples[2].tags = ["household_finance_case", "household", "half and half"];       // Anya family investment
ch.examples[3].tags = ["household_case", "household", "half and half"];               // Nina family
ch.examples[4].tags = ["nonprofit_case", "nonprofit", "half and half"];               // Luke clinic
ch.examples[5].tags = ["procurement_case", "procurement", "half and half"];           // Camille procurement

// =========================================================
// FIX 7 — ML2 replacement: "Do not guess harder. Shape your exposure better."
// Move location to deepRead (where the new line appears)
// =========================================================
ch.memorableLines[1].text = "Do not guess harder. Shape your exposure better.";
ch.memorableLines[1].location = "breakdown.deepRead";

// =========================================================
// FIX 8 — Expand framework to 5 steps (add Optionality)
// =========================================================
ch.implementationPlan.coreSkill =
"You apply the Barbell Position Audit before approving any structure that combines safety and upside. The check is five questions: (1) Base — what must survive no matter what? (2) Exposure — what small bet has upside if surprise helps? (3) Middle — what moderate-looking commitment could secretly damage the base? (4) Sizing — does the base survive if the risky exposure goes to zero? (5) Optionality — what choices remain open after the first move? A structure that fails the audit is not a barbell — it is a concentrated bet wearing one.";

ch.implementationPlan.twentyFourHourChallenge =
"Find one allocation in your workflow that combines safety and upside (career, portfolio, supplier mix, household). Apply the five Barbell Position Audit questions. Write down the answer to question 4 (whether the base survives if the exposure goes to zero) and question 5 (the choices that stay open) and resize if either answer is uncertain.";

// =========================================================
// Verify ML verbatim
// =========================================================
const prose = ch.breakdown.fastRead + '\n' + ch.breakdown.deepRead + '\n' + ch.breakdown.fullRead;
ch.memorableLines.forEach((ml, i) => {
  if (!prose.includes(ml.text)) throw new Error(`Ch19 ML${i+1} not verbatim: ${ml.text}`);
});

// Verify no "The warning" meta-phrasing remains in breakdown
const warningRe = /\bThe warning (practical|final|answer|closes|ends|is not telling|is therefore|jurisdiction|fraud|scandal)\b/i;
if (warningRe.test(ch.breakdown.deepRead) || warningRe.test(ch.breakdown.fullRead)) {
  throw new Error('Meta "The warning" phrasing still present');
}

fs.writeFileSync(path, JSON.stringify(book, null, 2) + '\n');
console.log('Ch19 QC pass applied.');
