#!/usr/bin/env node
// Book-wide finalization: apply Ch17/Ch18 QC patterns across all chapters.
// 1) Strip "tempting wrong answer" template ending from 125 explanations
// 2) Strip "belongs in the middle of this lesson" + similar meta-commentary
// 3) Fix 5 broken self-referential prompts (Ch5/8/9/10/11 Q8/Q9)
// 4) Fix prompt/answer mismatches (Ch4 Q6, Ch12 Q8)
// 5) Operationalize abstract correct answers
// 6) Refine generic Ex5/Ex6 "transfer" tags to chapter concept

const fs = require('fs');
const path = 'book-packages/the-black-swan.v21.json';
const book = JSON.parse(fs.readFileSync(path, 'utf-8'));

// =========================================================
// FIX 1 — Strip template ending from all explanations book-wide
// =========================================================
const tplEnding = / The tempting wrong answer either overreads the visible case or ignores the case's specific pressure\.\s*$/;
let stripped = 0;
book.chapters.forEach(ch => ch.quiz.questions.forEach(q => {
  if (q.explanation && tplEnding.test(q.explanation)) {
    q.explanation = q.explanation.replace(tplEnding, '').trim();
    stripped++;
  }
}));
console.log('Stripped template ending from', stripped, 'explanations.');

// =========================================================
// FIX 2 — Strip "belongs in the middle of this lesson" passages
// These appear as paragraph-level meta sentences at end of deepRead/fullRead
// Pattern: "[Chapter title or pronoun] belongs in the middle of this lesson: [restated takeaway]"
// =========================================================
const metaCommentRe = /\s*[A-Z][^.]*?belongs in the middle of this lesson:[^.]*\.\s*/gi;
let metaStripped = 0;
book.chapters.forEach((ch, ci) => {
  ['deepRead', 'fullRead'].forEach(k => {
    if (ch.breakdown[k]) {
      const before = ch.breakdown[k].length;
      ch.breakdown[k] = ch.breakdown[k].replace(metaCommentRe, ' ').replace(/\s{2,}/g, ' ').trim();
      if (ch.breakdown[k].length < before) metaStripped++;
    }
  });
});
console.log('Stripped meta-commentary from', metaStripped, 'breakdown sections.');

// Special: Ch10 has "The warning scandal" + Ch10 has secondary meta
// (already covered above for "belongs in the middle" — Ch10's "warning scandal" sentence may remain)
// Strip the warning scandal sentence:
const warningScandalRe = /The warning scandal is not (simply )?that people predict badly\.[^.]*?\. It is predictive failure delivered with ceremonial confidence\.\s*/;
if (book.chapters[9].breakdown.deepRead) {
  book.chapters[9].breakdown.deepRead = book.chapters[9].breakdown.deepRead.replace(warningScandalRe, '').trim();
}
if (book.chapters[9].breakdown.fullRead) {
  book.chapters[9].breakdown.fullRead = book.chapters[9].breakdown.fullRead.replace(warningScandalRe, '').trim();
}

// =========================================================
// FIX 3 — Fix 5 broken self-referential prompts (rewrite prompt + choices)
// Preserve correctIndex.
// =========================================================
// Ch5 Q9 (CI=1) — confirmation bias
{
  const q = book.chapters[4].quiz.questions[8];
  q.prompt = "After collecting only supporting evidence for a thesis, what is the simplest test that turns the folder into a real challenge?";
  q.choices = [
    "Show the folder to someone who already agrees with the thesis and confirm that their support strengthens the case before moving on.",
    "Name what evidence, if found, would change the conclusion — then go look for that evidence in the places it would actually live.",
    "Increase the volume of supporting evidence until the case feels overwhelming and the disconfirming case becomes uneconomic to find.",
  ];
  q.explanation = "Confirmation bias is broken by naming the falsifier and then searching for it. The folder becomes a test only when the disconfirming case has been invited in, not when the supporting case has been padded.";
}
// Ch8 Q8 (CI=0) — silent evidence
{
  const q = book.chapters[7].quiz.questions[7];
  q.prompt = "After a survivor story is being used as proof, what risk grows if no one reconstructs the missing failures before later modeling begins?";
  q.choices = [
    "Any subsequent model inherits the survivor-biased sample, so its precision rides on inputs that already excluded the cases that would falsify the claim.",
    "The model's machinery becomes inspectable but the conclusions look unchanged, since the audience is more swayed by visible structure than missing inputs.",
    "Future modeling becomes harder to justify economically because survivor-biased data still produces familiar results that decision-makers prefer.",
  ];
  q.explanation = "Survivor bias does not stop at the storytelling stage. Whatever model is built on the surviving sample inherits the missing cases as a silent gap, and the model's precision can mask the gap rather than expose it.";
}
// Ch9 Q8 (CI=1) — ludic fallacy
{
  const q = book.chapters[8].quiz.questions[7];
  q.prompt = "When a clean model is trusted past its assumptions, what borrowed authority is the next forecast inheriting?";
  q.choices = [
    "The forecaster's personal reputation, which travels with them regardless of whether the new model has been validated against the new domain.",
    "The original model's air of rigor, which now backs a prediction the new model has not actually demonstrated under the conditions in front of it.",
    "The institution's prior commitments, which create pressure to keep using the same model rather than admit a domain change is needed.",
  ];
  q.explanation = "Rigor does not transfer with the model. When the assumptions break in the new domain, the appearance of precision remains and quietly lends authority to a forecast the new domain has not actually licensed.";
}
// Ch10 Q8 (CI=1) — scandal of prediction
{
  const q = book.chapters[9].quiz.questions[7];
  q.prompt = "When a forecast is louder than the evidence supports, what should usually replace it in the workflow?";
  q.choices = [
    "A more frequent forecast cadence that updates the same number more often, so error gets caught faster than waiting for the original horizon.",
    "Direct search and contact with the domain — small probes, real complaints, observed signals — which produce the evidence the forecast was inventing.",
    "A second forecast from a different team that uses the same data so the two outputs can be averaged into a more defensible single number.",
  ];
  q.explanation = "An overconfident forecast in an opaque domain is producing language, not information. The replacement is search — probes, pilots, and contact with reality that actually generate the evidence the forecast was performing.";
}
// Ch11 Q8 (CI=2) — practical search
{
  const q = book.chapters[10].quiz.questions[7];
  q.prompt = "When an unverifiable forecast is being treated as a plan, what redirection most honestly serves the decision?";
  q.choices = [
    "Use the forecast as a starting point for negotiation, since some number is more useful in a meeting than no number at all when budgets must be set.",
    "Require the forecast author to defend it with additional research until the team is satisfied that the number has been pressured enough to act on.",
    "Treat the forecast as the wrong question and ask who bears the consequence if it is wrong, then resize the commitment around that exposure rather than around the number.",
  ];
  q.explanation = "An unverifiable forecast cannot earn the trust the plan is asking it to carry. The honest redirection is from prediction to exposure: name who pays if the forecast fails and let that answer size the commitment.";
}

// =========================================================
// FIX 4 — Repair prompt/answer mismatches
// =========================================================
// Ch4 Q6 (CI=2): prompt asks "what should the decision maker do next?" — current concept-only
{
  const q = book.chapters[3].quiz.questions[5];
  q.prompt = "After a long calm stretch in a previously volatile domain, what should the decision maker do before adding more exposure?";
  q.choices = [
    "Treat the longer record as stronger evidence the regime has stabilized, since the absence of stress over time should raise confidence in the system itself.",
    "Document the comfort the calm has produced inside the organization and use that institutional confidence to justify a proportionally larger commitment.",
    "Treat the calm record as evidence about the regime that just held, not about the regime that comes next, and size the next commitment around the unobserved stressor.",
  ];
  q.explanation = "Repetition of confirming days raises confidence about one regime. The action before adding exposure is to resize around the stressor the sample has not faced, not to credit the calm as proof.";
}
// Ch12 Q8 (CI=2): prompt asks "what should the trustee ask?" — current doesn't answer
{
  const q = book.chapters[11].quiz.questions[7];
  q.prompt = "A consultant recommends a risky pension move while keeping personal exposure elsewhere. What should the trustee ask before trusting the advice?";
  q.choices = [
    "Whether the consultant's firm carries professional indemnity insurance, since insurance presence indicates the firm has been vetted for advisory risk.",
    "Whether the consultant has worked with other pension boards on similar moves, since prior advisory engagements show recognition in the field.",
    "What the consultant pays if the move fails — co-investment, fee-at-risk, or any structural exposure — so the recommendation rests on someone other than the trustees alone.",
  ];
  q.explanation = "Advice that costs the speaker nothing if it fails carries authority without accountability. The trustee's first move is to name the speaker's exposure and resize the deference around that answer.";
}
// Ch14 Q9 (CI=2): sharpen abstract correct
{
  const q = book.chapters[13].quiz.questions[8];
  q.choices[2] = "Classify the forecast as one where a single event title or bestseller can rewrite annual totals, then separate the tail-dominating titles from the long tail before assigning numbers to either.";
  q.explanation = "Combining long-tail titles with event releases in one forecast averages two domains. The classification step is to identify the tail-dominating component and forecast it separately from the bounded tail.";
}

// =========================================================
// FIX 5 — Sharpen abstract correct answers (selective)
// =========================================================
// Ch10 Q3 (CI=1): "What outranks calibration in many prediction settings?"
book.chapters[9].quiz.questions[2].choices[1] =
  "Fluency and decisiveness — the speech style that reads as competent — are being rewarded above the speaker's actual track record at the relevant horizon.";
// Ch14 Q2 (CI=1): "What makes Extremistan different?"
book.chapters[13].quiz.questions[1].choices[1] =
  "One observation can rewrite the total in Extremistan in a way bounded domains do not allow, so averages and standard deviations behave differently before they are even calculated.";
// Ch14 Q4 (CI=2): "Which domain logic fits best?"
book.chapters[13].quiz.questions[3].choices[2] =
  "Classify the domain as one where a single outcome (the bestseller) can dominate the annual total, so the average is misleading until the tail-dominating case is separated from the rest.";
// Ch15 Q2 (CI=2): "Why does the bell curve fail in Extremistan?"
book.chapters[14].quiz.questions[1].choices[2] =
  "Because outliers can dominate the totals in Extremistan, and the bell curve's symmetry forces those outliers into thin tails the model treats as noise.";
// Ch15 Q3 (CI=0): "What danger does the wrong curve create besides numerical error?"
book.chapters[14].quiz.questions[2].choices[0] =
  "It produces false calm and structural under-preparation; the institution organizes attention away from the cases most likely to hurt it because the curve treats them as edge cases.";
// Ch16 Q2 (CI=0): "What does the mind do to noise here?"
book.chapters[15].quiz.questions[1].choices[0] =
  "The mind smooths noise into pattern and reads pattern as story, so a few noisy readings get organized into a trajectory the underlying data does not support.";
// Ch16 Q3 (CI=1): "Why can weak models survive after poor fit?"
book.chapters[15].quiz.questions[2].choices[1] =
  "Elegance and familiarity keep weak models attractive long after fit fails, because audiences trust the look of a polished chart more than the messy record behind it.";

// =========================================================
// FIX 6 — Refine generic Ex5/Ex6 "transfer" tags to chapter concept
// Pattern matches what Ch14 already does (postmortem/before_after/CHAPTER_CONCEPT)
// =========================================================
const chConcept = {
  10: 'bird poop',         // Ch11
  11: 'epistemocracy',     // Ch12
  12: 'Appelles the Painter', // Ch13
  14: 'bell curve',        // Ch15
  15: 'aesthetics of randomness', // Ch16
  17: 'phony',             // Ch18
  18: 'half and half',     // Ch19
};
Object.entries(chConcept).forEach(([ciStr, concept]) => {
  const ci = Number(ciStr);
  [4, 5].forEach(ei => {
    const ex = book.chapters[ci].examples[ei];
    if (ex && ex.tags && ex.tags[2] === 'transfer') {
      ex.tags[2] = concept;
    }
  });
});

// =========================================================
// Verify all MLs still verbatim
// =========================================================
let mlMissing = 0;
book.chapters.forEach((ch, ci) => {
  const prose = (ch.breakdown.fastRead||'')+'\n'+(ch.breakdown.deepRead||'')+'\n'+(ch.breakdown.fullRead||'');
  ch.memorableLines.forEach((ml, i) => {
    const t = typeof ml === 'string' ? ml : ml.text;
    if (!prose.includes(t)) {
      mlMissing++;
      console.log('  Ch'+(ci+1)+' ML'+(i+1)+' missing: '+t.substring(0,60));
    }
  });
});
console.log('ML verbatim missing:', mlMissing);

fs.writeFileSync(path, JSON.stringify(book, null, 2) + '\n');
console.log('Finalization pass applied.');
