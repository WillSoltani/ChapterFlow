#!/usr/bin/env node
const fs = require('fs');
const path = 'book-packages/the-black-swan.v21.json';
const book = JSON.parse(fs.readFileSync(path, 'utf-8'));

// =========================================================
// FIX 1 — Strip question-mark variant of original artifact
// =========================================================
function stripQMArtifact(c) {
  return c.replace(/[.!?]\s+in a way that misses the source of error\.?\s*$/i, '?').trim();
}
book.chapters.forEach((ch) => ch.quiz.questions.forEach((q) => {
  q.choices = q.choices.map(stripQMArtifact);
}));

// =========================================================
// FIX 2 — Replace ever-class strawman Ch6 Q5 d[1]
// =========================================================
{
  const q = book.chapters[5].quiz.questions[4];
  // Currently choices: [d0, d1=strawman, correct]; correctIndex=2
  q.choices[1] = 'It compresses the timeline so unrelated facts appear causally linked.';
}

// =========================================================
// FIX 3 + post-Fix1 expansion — Set distractor text directly
// Targets: [chIdx, qIdx, choiceIdx, newText]
// Sanity-check correctIndex before writing.
// =========================================================
const fix3 = [
  // Ch1 Q4 (correctIndex=2)
  [0, 3, 0, "Use the cleanest trend line and remove backup plans because the recent stretch has read as a disciplined record."],
  [0, 3, 1, "Search for one more fact that supports the favored answer so the decision feels evidentially grounded before commitment."],
  // Ch1 Q7 (correctIndex=0)
  [0, 6, 1, "Pessimism is usually more accurate than confidence, since the cautious view tends to age better than the optimistic one in retrospect."],
  [0, 6, 2, "People should avoid any decision with unclear evidence, since acting on partial signals produces the worst recoverable mistakes."],
  // Ch2 Q7 (correctIndex=1)
  [1, 6, 0, "Copy the release pattern because the hit proved it works, and the team has a ninety-day window before buzz dissipates."],
  [1, 6, 2, "Ignore the hit because rare success has no information value, and chasing one breakout outcome produces overfitted strategy."],
  // Ch2 Q9 (correctIndex=2)
  [1, 8, 0, "A longer profile of the alumnus with more vivid details, so prospective applicants connect to the outcome the program produced."],
  [1, 8, 1, "A quote from the alumnus about gratitude and effort, which reads as authentic in marketing materials applicants will read."],
  // Ch3 Q3 (correctIndex=2)
  [2, 2, 0, "The team should have tried fewer pilots, since the time spent on misses could have been concentrated on better-qualified leads."],
  [2, 2, 1, "Ignored pilots are emotionally discouraging, and the morale cost of repeated rejection compounds across a sales quarter."],
  // Ch3 Q4 (correctIndex=1)
  [2, 3, 0, "The failures prove the product is bad, and the cost per failed test is depleting runway faster than progress justifies."],
  [2, 3, 2, "The defense order should be assumed because the upside is large, and the engineer has direct buyer conversations indicating intent."],
  // Ch3 Q6 (correctIndex=2)
  [2, 5, 0, "The number of losing cases is embarrassing, and reputational signal from a public docket affects future referrals more than the case math."],
  [2, 5, 1, "The analyst should pick the case with the most dramatic story, because dramatic cases drive the press coverage that funds case acquisition."],
  // Ch3 Q7 (correctIndex=0)
  [2, 6, 1, "Ask whether the income arrives on the same day each month, because cash-flow predictability matters more than total annual earnings."],
  [2, 6, 2, "Ask whether friends approve of the work rhythm, since the freelancer's relationships depend on others accepting the choice."],
  // Ch4 Q2 (correctIndex=2)
  [3, 1, 0, "Because the evidence is fake, so the entire setup deserves dismissal rather than careful reanalysis."],
  [3, 1, 1, "Because the turkey predicts too little, and the model needs more daily-feeding observations before it can stabilize."],
  // Ch5 Q5 (correctIndex=0) — post-Fix1 expansion
  [4, 4, 1, "How quickly can we announce it before competing teams publish their own findings on the topic?"],
  [4, 4, 2, "How many people agree with it among the reviewers already familiar with the framing?"],
  // Ch5 Q7 (correctIndex=0)
  [4, 6, 1, "It rewards challenge more than support, since critics gain status faster than supporters in research environments."],
  [4, 6, 2, "It removes the incentives, so the institution can no longer reward the people most aware of the bias."],
  // Ch6 Q5 (correctIndex=2) — d[0] expansion; d[1] already replaced by Fix 2
  [5, 4, 0, "It makes writers forget the ending, because retelling in light of the ending erases narrative tension that informed the original choice."],
  // Ch6 Q7 (correctIndex=0) — post-Fix1 expansion
  [5, 6, 1, "How can we make it even smoother for the audience that already accepts the framing?"],
  [5, 6, 2, "Who told the story first, and does priority shape the version we now hear?"],
  // Ch7 Q3 (correctIndex=2)
  [6, 2, 0, "Because they eliminate uncertainty, so the team can plan as if the visible outcome path is now the standard one."],
  [6, 2, 1, "Because they prove success is common, since one visible case makes the outcome feel reachable for cases that follow."],
  // Ch7 Q8 (correctIndex=0)
  [6, 7, 1, "Treat the vividness as evidence, because mental weight in this couple's planning is operating as a probability signal."],
  [6, 7, 2, "Buy more tickets to test the theory, so the small per-ticket cost feels operationally testable against the lived prediction."],
  // Ch9 Q3 (correctIndex=1) — post-Fix1 expansion
  [8, 2, 0, "Is the model elegant, and does the elegance suggest fitness for the domain it covers?"],
  [8, 2, 2, "Is the math difficult enough that the rigor implies confidence in the model's reach?"],
  // Ch13 Q5 (correctIndex=0)
  [12, 4, 1, "It guarantees success because the structure removes the catastrophic outcome from the possibility space."],
  [12, 4, 2, "It removes the need to choose, so the actor can wait for evidence rather than commit prematurely under uncertainty."],
  // Ch14 Q1 (correctIndex=0)
  [13, 0, 1, "A domain with no uncertainty where the late-fee history is well-documented and outcomes follow a predictable distribution."],
  [13, 0, 2, "A domain where one case can dominate the total, because extreme late-return cases skew the aggregate enough to set the rule."],
  // Ch14 Q5 (correctIndex=0)
  [13, 4, 1, "Because height has no variation, so any sample produces a stable mean regardless of which individuals are included."],
  [13, 4, 2, "Because wealth is easy to average, since income tax data provides clean reporting on the distribution."],
  // Ch14 Q6 (correctIndex=1)
  [13, 5, 0, "When every observation is the same size, because uniform observations should produce a stable average with no fragility."],
  [13, 5, 2, "When the domain is bounded, so even bounded domains can produce averages that fail to summarize the cases inside them."],
  // Ch16 Q5 (correctIndex=2)
  [15, 4, 0, "Because it ignores randomness, by treating the aesthetic of the pattern as evidence the underlying data is non-random."],
  [15, 4, 1, "Because it denies psychology, and the chapter argues that aesthetic pull is decorative rather than cognitive."],
  // Ch18 Q5 (correctIndex=1)
  [17, 4, 0, "Because no expert can know anything, so any precise forecast about complex systems should be treated as theatrical regardless of the speaker."],
  [17, 4, 2, "Because every wrong claim is fraud, and the appearance of confidence in unpredictable domains reduces to a disclosure failure."],
  // Ch19 Q3 (correctIndex=0)
  [18, 2, 1, "Because prediction is illegal, since accurate forecasting in opaque domains creates the false certainty regulators have moved to constrain."],
  [18, 2, 2, "Because all planning is useless, so the only rational response is to abandon multi-step plans and respond to what arrives."],
];

fix3.forEach(([ci, qi, di, text]) => {
  const q = book.chapters[ci].quiz.questions[qi];
  if (di === q.correctIndex) {
    throw new Error(`Refused to overwrite correct answer at Ch${ci+1} Q${qi+1} d[${di}]`);
  }
  q.choices[di] = text;
});

// =========================================================
// FIX 4 — Diversify A/An openers
// Map of [chIdx, qIdx] → new prompt (preserves scenario content)
// =========================================================
const fix4 = {
  // Ch2 (6→3) convert Q1, Q2, Q3
  '1,0': 'When a musician goes viral, fans say the rise was obvious. What mistake appears?',
  '1,1': 'The visible winner can make a path look obvious only after the outcome is known. Why use a fictional writer here?',
  '1,2': 'Visible winners can make a path look obvious only after the outcome is known. What hidden population keeps getting lost?',
  // Ch3 (9→3) convert Q1-Q6
  '2,0': 'When a research director has ninety failed compound screens but one viable molecule could pay for the program, which judgment is strongest?',
  '2,1': 'The filmmaker has five rejected cuts and enough cash for two more submissions. What should she check before quitting?',
  '2,2': 'Suppose a sales team closes one giant contract after thirty ignored pilots. What does the low hit rate fail to show?',
  '2,3': 'When an engineer\'s sensor startup has frequent field failures but each test is cheap and one defense order would change the company, which move fits?',
  '2,4': 'The rights agent pitches obscure novels abroad and loses most attempts. What makes the strategy potentially rational?',
  '2,5': 'In a legal finance practice, an analyst sees many losing cases in a docket. Which fact separates optionality from denial?',
  // Ch6 (9→3) convert Q1, Q2, Q3, Q5, Q6, Q7
  '5,0': 'Tidy explanations can remove the mess that made an event uncertain while it was happening. What is the narrative fallacy?',
  '5,1': 'When a tidy explanation removes the mess that made an event uncertain while it was happening, why are stories so persuasive after events happen?',
  '5,2': 'The tidy explanation can remove the mess that made an event uncertain while it was happening. What role does omission play here?',
  '5,4': 'Suppose a tidy explanation removes the mess that made an event uncertain while it was happening. How does hindsight strengthen narrative fallacy?',
  '5,5': 'Once a tidy explanation removes the mess that made an event uncertain while it was happening, why is narrative pleasure epistemically risky?',
  '5,6': 'Even a tidy explanation can remove the mess that made an event uncertain while it was happening. What stronger question should follow a perfectly shaped explanation?',
  // Ch7 (9→3) convert Q1-Q6
  '6,0': 'Vivid rare outcomes can feel nearer than their probability warrants. What is the antechamber of hope?',
  '6,1': 'When a vivid rare outcome feels nearer than its probability warrants, what is the core distortion in this case?',
  '6,2': 'The vivid rare outcome can feel nearer than its probability warrants. Why do visible winners matter so much here?',
  '6,3': 'When a founder keeps picturing viral breakout while ignoring the many similar failures, what is happening?',
  '6,4': 'Suppose a vivid rare outcome feels nearer than its probability warrants. What stronger distinction does the chapter want?',
  '6,5': 'Often a vivid rare outcome can feel nearer than its probability warrants. How can hope imitate progress?',
  // Ch8 (9→3) convert Q1-Q6
  '7,0': 'When a survivor story is being used as proof while the failed cases are absent, what is the missing evidence problem?',
  '7,1': 'Survivor stories cannot teach the odds until the missing cases return to view. Why can one visible winner be misleading?',
  '7,2': 'The survivor story cannot teach the odds until the missing cases return to view. What is the core inferential problem here?',
  '7,3': 'Suppose a founder copies one unicorn story without studying similar failures. What is happening?',
  '7,4': 'Even a survivor story cannot teach the odds until the missing cases return to view. Why do survivor stories persuade so easily?',
  '7,5': 'Often a survivor story cannot teach the odds until the missing cases return to view. What stronger correction does the chapter want before copying a winner?',
  // Ch9 (9→3) convert Q1-Q6
  '8,0': 'When a clean game-like model is applied to a messy market with changing rules, what error is taking shape?',
  '8,1': 'Bounded models can feel rigorous while the real domain changes its own rules. Why do bounded games create false comfort when overtransferred?',
  '8,2': 'The bounded model can feel rigorous while the real domain changes its own rules. What question matters most after this lesson?',
  '8,3': 'Suppose a risk model behaves cleanly under stable assumptions, so a team treats market danger as contained. What is happening?',
  '8,4': 'Even a bounded model can feel rigorous while the real domain changes its own rules. Why can a beautiful model still fail badly?',
  '8,5': 'Often a bounded model can feel rigorous while the real domain changes its own rules. What makes precision dangerous in this lesson?',
  // Ch10 (9→3) convert Q1-Q6
  '9,0': 'When a forecast arrives with a date, a number, and little visibility behind it, what makes that confidence scandalous?',
  '9,1': 'Crisp forecasts can sound more authoritative than the evidence behind them deserves. Why does prediction theater persist?',
  '9,2': 'The crisp forecast can sound more authoritative than the evidence behind it deserves. What outranks calibration in many prediction settings?',
  '9,3': 'Suppose a board prefers the executive with the crisp forecast over the one who marks uncertainty carefully. What does that show?',
  '9,4': 'Even a crisp forecast can sound more authoritative than the evidence behind it deserves. Why is overprecision more damaging than simple error?',
  '9,5': 'Once a crisp forecast sounds more authoritative than the evidence behind it deserves, how can prestige be borrowed in forecasting culture?',
  // Ch11 (4→3) convert Q1
  '10,0': 'When a field team wants a confident migration story before any buoy data exists, what would bird-poop style searching ask them to do first?',
  // Ch12 (5→3) convert Q1, Q4
  '11,0': 'When a pension board hears a polished recommendation from someone insulated from losses, what should change before the vote?',
  '11,3': 'Suppose an institution rewards fluent experts who never absorb the fallout of bad advice. Which idea fits best?',
  // Ch13 (5→3) convert Q1, Q4
  '12,0': 'When a bookstore owner does not know how many readers will attend an event, which move fits uncertainty better than prediction?',
  '12,3': 'Suppose a startup preserves runway and runs several experiments instead of making one giant bet. What idea fits best?',
  // Ch14 (5→3) convert Q1, Q4
  '13,0': 'When a library late-fee policy is built from both ordinary delays and extreme nonreturns, what distinction should the director make first?',
  '13,3': 'Suppose a single bestseller dominates annual publishing revenue. Which domain logic fits best?',
  // Ch15 (9→3) convert Q1-Q6
  '14,0': 'When a reinsurance model excludes storms so large they could dominate losses, what is the bell-curve error in that setup?',
  '14,1': 'Familiar curves can become dangerous when they are used outside their jurisdiction. Why does the bell curve fail in Extremistan?',
  '14,2': 'The familiar curve can become dangerous when it is used outside its jurisdiction. What danger does the wrong curve create besides numerical error?',
  '14,3': 'Suppose a risk memo downplays catastrophe because the model treats extremes as marginal. What fits best?',
  '14,4': 'Even a familiar curve can become dangerous when it is used outside its jurisdiction. Why does the chapter call the misuse fraudulent?',
  '14,5': 'Once a familiar curve becomes dangerous outside its jurisdiction, how can a wrong distribution train institutions badly?',
  // Ch16 (9→3) convert Q1-Q6
  '15,0': 'When a museum attendance chart looks smooth until event dates are overlaid, what should the director test before trusting the pattern?',
  '15,1': 'Beautiful patterns can make noise feel more trustworthy than they are. What does the mind do to noise here?',
  '15,2': 'The beautiful pattern can make noise feel more trustworthy than it is. Why can weak models survive after poor fit?',
  '15,3': 'Suppose a team trusts the cleaner chart even though the underlying record is messy. What fits best?',
  '15,4': 'Even a beautiful pattern can make noise feel more trustworthy than it is. Why is this lesson more than a generic bias list?',
  '15,5': 'Often a beautiful pattern can make noise feel more trustworthy than it is. How can taste become infrastructure for error?',
  // Ch17 (9→3) convert Q1-Q6
  '16,0': 'When a hotspot tool treats past enforcement data as a clean map of future crime, what should be tested before the bell curve earns trust?',
  '16,1': 'Formal tools earn trust only after their domain license has been tested. Why can a neat curve become dangerous here?',
  '16,2': 'The formal tool earns trust only after its domain license has been tested. What can technical polish hide in this lesson?',
  '16,3': 'Suppose a model looks rigorous but assumes stability in a domain that changes its own rules. What fits best?',
  '16,4': 'Even a formal tool earns trust only after its domain license has been tested. Why is this case not anti-math?',
  '16,5': 'Often a formal tool earns trust only after its domain license has been tested. How can a tool cosmetically falsify a domain?',
  // Ch18 (5→3) convert Q1, Q4
  '17,0': 'When a market guest speaks with polished certainty but never says what would prove the call wrong, what exposes the phony signal?',
  '17,3': 'Suppose a speaker uses technical language and decimals to sound certain in a murky domain. What fits best?',
  // Ch19 (5→3) convert Q1, Q4
  '18,0': 'When a manager wants venture upside without risking rent and payroll income, what does the half-and-half structure protect first?',
  '18,3': 'Suppose a founder caps burn and keeps multiple paths alive instead of making one giant bet. What fits best?',
};

Object.entries(fix4).forEach(([key, newPrompt]) => {
  const [ci, qi] = key.split(',').map(Number);
  book.chapters[ci].quiz.questions[qi].prompt = newPrompt;
});

// =========================================================
// SAVE
// =========================================================
fs.writeFileSync(path, JSON.stringify(book, null, 2) + '\n');
console.log('Saved.');
