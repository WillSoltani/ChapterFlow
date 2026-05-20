#!/usr/bin/env node
// Book-wide quality pass: Ch1-13, Ch14 (framework only), Ch16-19.
// Ch15 left untouched (already at standard).
//
// Per chapter: fastRead opens with named example character + embeds all 3 MLs verbatim;
// 5 review cards rewritten for concrete retrieval; coreSkill names a framework;
// 24hrChallenge references it; memorable line locations all set to breakdown.fastRead.

const fs = require('fs');
const path = 'book-packages/the-black-swan.v21.json';
const book = JSON.parse(fs.readFileSync(path, 'utf-8'));

// Per-chapter patch: each entry contains fastRead (must embed all 3 ML texts verbatim),
// 5 review cards, coreSkill, twentyFourHourChallenge, ML texts.
function applyChapter(ci, p) {
  const ch = book.chapters[ci];
  ch.breakdown.fastRead = p.fastRead;
  for (let i = 0; i < 5; i++) {
    ch.reviewCards[i].front = p.cards[i].front;
    ch.reviewCards[i].back  = p.cards[i].back;
  }
  ch.implementationPlan.coreSkill = p.coreSkill;
  ch.implementationPlan.twentyFourHourChallenge = p.challenge;
  for (let i = 0; i < 3; i++) {
    ch.memorableLines[i].text = p.ml[i];
    ch.memorableLines[i].location = 'breakdown.fastRead';
  }
  // Verbatim check
  p.ml.forEach((m, i) => {
    if (!ch.breakdown.fastRead.includes(m)) {
      throw new Error(`Ch${ci+1} ML${i+1} not verbatim in fastRead: ${m}`);
    }
  });
}

// =========================================================
// Ch1 — The Apprenticeship of an Empirical Skeptic
// =========================================================
applyChapter(0, {
  fastRead:
"Sarah runs facilities for a regional hospital. The continuity log shows twelve clean monthly generator checks, and the board wants to read that as proof the ICU is safe. Then she notices what is not in the log: nobody has ever moved the ICU onto generator power during a real load. Calm can be true and still be narrow. A record describes the conditions it met, not the ones it has yet to face. The discipline is small and specific: Use the record, mark its boundary, and keep room for the test that has not happened yet.",
  cards: [
    { front: "What does it mean for a record of calm to be 'untested'?",
      back: "The events that would falsify the calm have not yet happened in the recorded window. Sarah's 18 spotless generator months covered 18 months in which the ICU was never moved onto generator power under real load. The record describes what happened under those conditions, not what the system can survive." },
    { front: "When a continuity file shows a long quiet stretch, what question should you ask?",
      back: "What stress would the record have to contain to prove the system can survive it? If that stress hasn't appeared in the window, the calm is a description of conditions, not evidence of capacity. Ask before signing off." },
    { front: "What is the most dangerous thing about a record of recent peace?",
      back: "It gets used as a proxy for tested capacity. The longer the calm runs, the more confidently committees treat it as proof. A budget cut, a leverage increase, or a removed safeguard then rides on a record that has not met the conditions it would need to meet." },
    { front: "What is the operational move when a record looks too clean to question?",
      back: "Write three lines on the decision: what the evidence shows, what it does not show, and what an untested rupture would cost. The third line resizes the bet. If the cost is large, the calm is not yet enough to act on." },
    { front: "How should a reviewer act before approving a plan built on recent peace?",
      back: "Require the plan to state what was tested, what remains untested, and how loss is capped if the untested case appears. If any of the three is missing, the plan is treating description as proof." },
  ],
  coreSkill:
"You apply the Calm-History Check before letting a quiet record certify the future. The check is four questions: (1) Stress horizon — what stressor would the record have to contain to falsify the calm? (2) Boundary — where does the sample's continuity actually end? (3) Untested rupture — what would break the system that the sample has not seen? (4) Action — what proof would change the next commitment? A record that fails any of these is describing the past, not certifying the future.",
  challenge:
"Find one continuity log, uptime dashboard, or 'no incidents' report being used to justify a decision. Apply the four Calm-History Check questions. Write down the answer to question 3 (what would break the system that the sample has not seen) and decide whether the current plan survives it.",
  ml: [
    "Calm can be true and still be narrow.",
    "A record describes the conditions it met, not the ones it has yet to face.",
    "Use the record, mark its boundary, and keep room for the test that has not happened yet.",
  ],
});

// =========================================================
// Ch2 — Yevgenia's Black Swan (survivorship)
// =========================================================
applyChapter(1, {
  fastRead:
"Aria runs recruiting at a software company that admires one famous founder who dropped out of college. A hiring memo lands on her desk recommending the same heuristic for every senior role. She pulls the data: dozens of dropouts founded companies; almost all of them failed quietly. The applause edits the older uncertainty out of the story. Once a winner appears, observers start reading backward from the outcome — every odd detail of the survivor's early life becomes proof the success was coming. Before turning the visible winner into a hiring rule, study the winner, but keep one eye on the graveyard.",
  cards: [
    { front: "What does it mean for a sample to be 'survivor-biased'?",
      back: "The dataset contains only the cases that made it through the filter that produced visibility. Aria's hiring memo cites one famous dropout founder but the dataset of all dropouts who tried is hidden. The survivor's traits look causal because the comparison group is invisible." },
    { front: "When someone cites a famous case as a model, what should you ask?",
      back: "How many comparable attempts ended differently? If the famous founder is one of 200 attempts and 198 failed, the trait being credited may have no predictive value. The denominator is the question." },
    { front: "What is the most dangerous thing about backward reading of a success story?",
      back: "Every odd detail in the survivor's history gets reinterpreted as evidence the outcome was coming. The story becomes a template even though the same details existed in countless people who did not succeed. The pattern is constructed in hindsight, not extracted from the data." },
    { front: "What is the operational move when a single visible winner is being used as proof?",
      back: "Treat the winner as one data point. Add comparable attempts that did not produce visibility. If the rule the winner is being used to defend still holds when those cases are included, it may be real. If not, the rule is survivorship dressed as inference." },
    { front: "What single number distinguishes a real pattern from a survivor's halo?",
      back: "The survival rate — the share of all comparable attempts that produced the visible outcome. If one famous founder represents one of many attempted dropouts, the trait being credited has near-zero predictive value. Cite the rate, not the survivor." },
  ],
  coreSkill:
"You apply the Survivor Sample Audit before drawing a rule from a visible winner. The check is four questions: (1) Visible winners — who is in the dataset? (2) Missing losers — who would have been here if they had not failed? (3) Hidden population — what does the full denominator look like? (4) Rule extraction — does the claim survive when the missing cases are added back? A claim that fails the audit is being drawn from the survivor, not the population.",
  challenge:
"Find one place where a single success story is being used to justify a decision (hiring, investment, strategy). Apply the four Survivor Sample Audit questions. Write down the answer to question 3 (the full denominator) and decide whether the rule still holds.",
  ml: [
    "The applause edits the older uncertainty out of the story.",
    "Once a winner appears, observers start reading backward from the outcome",
    "study the winner, but keep one eye on the graveyard",
  ],
});

// =========================================================
// Ch3 — The Speculator and the Prostitute
// =========================================================
applyChapter(2, {
  fastRead:
"Ivy has nineteen magazine rejections in her folder and one editor offering $900 for a reported essay. A streaming studio is rumored to be optioning the same essay topic. Her friend, who took a $68K salary job, says the rejection rate proves Ivy should stop. Frequency alone is thin evidence when one payoff can dominate the record. In scalable domains, the misses you can survive are the price of the win you cannot predict. The hit rate misleads when the upside is rare and large. The difference is not dignity — it is the shape of the payoff.",
  cards: [
    { front: "What does it mean for an income domain to be 'scalable'?",
      back: "One successful event can produce a payoff many times larger than the cost of the misses. Ivy's nineteen rejections cost her nothing structural; one streaming option could pay for two years. Scalable domains are judged by the shape of the payoff, not by the hit rate." },
    { front: "When a freelancer or speculator shows a high miss rate, what should you ask?",
      back: "Are the misses survivable, and can one win dominate the record? If yes, the miss rate is the wrong frame. The strategy is being judged by linear metrics from a domain where payoffs are not linear." },
    { front: "What is the most dangerous thing about applying a linear ruler to a scalable domain?",
      back: "It makes survivable exploration look like failure. A research director with 90 failed compounds and one viable molecule reads as a 1% hit rate. But the molecule pays for the program. Linear metrics tell the team to quit at the moment the strategy is working." },
    { front: "What is the operational move when a strategy has many misses and one possible big win?",
      back: "Cap the cost of each attempt so the misses stay survivable. Define the upside trigger that justifies continued exposure. If the per-attempt loss is contained and one win can dominate, the math of the slate is doing the work the hit rate cannot." },
    { front: "What single test reveals whether a domain is bounded or scalable?",
      back: "Can one outcome produce a payoff many multiples of the typical attempt? If yes, the domain is scalable and portfolio economics governs. If no (salary, billable hours), the domain is bounded and the average matters." },
  ],
  coreSkill:
"You apply the Income Scalability Check before judging a strategy by its hit rate. The check is four questions: (1) Bounded — does the income cap with hours or skill? (2) Scalable — can one event produce a multiplier? (3) Variance horizon — what does a bad year vs a great year look like in this domain? (4) Position — how does the actor cap downside without giving up the upside? A strategy that fails the check is being judged by the wrong ruler.",
  challenge:
"Find one bursty earner, slate, or portfolio in your network that someone is criticizing for its miss rate. Apply the four Income Scalability Check questions. Write down the answer to question 4 (how the downside is capped) and decide whether the strategy is rational at scale.",
  ml: [
    "Frequency alone is thin evidence when one payoff can dominate the record.",
    "In scalable domains, the misses you can survive are the price of the win you cannot predict.",
    "The difference is not dignity — it is the shape of the payoff.",
  ],
});

// =========================================================
// Ch4 — Thousand and One Days (Turkey)
// =========================================================
applyChapter(3, {
  fastRead:
"Olivier chairs the investment subcommittee of a state pension board. Three calm quarters of low realized volatility have made the case for adding leverage feel safe. The committee is about to vote. Repetition can raise confidence even when the hidden structure has not become safer at all. Olivier reads the proposal again and sees the assumption no one has named: the calm describes the window, not the system. Three quarters is the sample; the decision is being sized for the next ten. The longer the quiet has run, the more expensive the assumption that it will continue.",
  cards: [
    { front: "What does the turkey example teach about repeated supporting evidence?",
      back: "Each confirming day raises the turkey's confidence even though the structure producing food is the same structure that will end the relationship. Repetition feels like proof and is actually evidence about one regime — the regime in which the turkey is being fed." },
    { front: "When a long calm stretch is being used to justify a bolder move, what should you ask?",
      back: "Does the bolder move depend on the regime continuing? If yes, the calm is not proof — it is a description of conditions the position now needs to keep holding. Name the regime assumption before the leverage gets approved." },
    { front: "What is the most dangerous thing about a calm stretch in a previously volatile domain?",
      back: "Institutions remove cushions during the calm. Capital buffers fall. Safety margins are cut. The committee is rewarded for confidence that turns out to be a description of the calm window, not a property of the system. The first regime change finds a less-protected institution." },
    { front: "What is the operational move before committing more capital after a calm period?",
      back: "Identify the early signal that would tell you the regime is changing. Set a tripwire that resizes the position before the loss arrives. If you cannot name the signal, you are betting on the calm continuing, not on the position itself." },
    { front: "What single number reveals whether a calm record actually tested the system?",
      back: "The variance of the stressor being assumed away. If realized volatility has been low because the stressor hasn't appeared (not because the system absorbed it), the record measures the absence of stress, not the system's response to it." },
  ],
  coreSkill:
"You apply the Regime-Change Audit before letting a calm record justify a bigger commitment. The check is four questions: (1) Sample window — what time span does the data cover? (2) Regime — what was true in that window that may not be true tomorrow? (3) Turkey check — does the system depend on the current pattern continuing for survival? (4) Action — what early signal would warn that the regime is changing? A position that fails the audit is sized for the regime, not for the world.",
  challenge:
"Find one decision in your workflow being justified by a calm recent stretch (uptime, volatility, costs, demand). Apply the four Regime-Change Audit questions. Write down the answer to question 4 (the early signal) and decide whether the position is sized for the regime or for the world.",
  ml: [
    "Repetition can raise confidence even when the hidden structure has not become safer at all.",
    "the calm describes the window, not the system",
    "The longer the quiet has run, the more expensive the assumption that it will continue.",
  ],
});

// =========================================================
// Ch5 — Confirmation Shmonfirmation!
// =========================================================
applyChapter(4, {
  fastRead:
"Mara is considering a $25K purchase of a battery stock. Her folder contains four bullish analyst notes, a competitor's earnings beat, and a Reddit thread of enthusiastic owners. The folder feels balanced because the volume is real. Then she notices the search went one direction only: zero short reports, zero negative supplier interviews, zero articles questioning the thesis. Students collect sources that defend the thesis they already drafted. The volume of support measures how much was gathered, not how much was tested. If the search itself is biased, the conclusion is being protected, not tested.",
  cards: [
    { front: "What does it mean for an evidence pipeline to be 'confirmation-biased'?",
      back: "Disconfirming evidence is filtered out before the claim is judged. Mara's folder of four bullish notes feels like research because the volume is real. The bias lives in what's missing — short reports, supplier complaints, falsifiers — not in the evidence that's present." },
    { front: "When a folder of supporting evidence is being used to justify a decision, what should you ask?",
      back: "What would count against this, and was that pressure invited? If the folder contains zero falsifiers, the claim has been protected rather than tested. The strength of the search is judged by its tolerance for the disconfirming case, not the volume of confirmation." },
    { front: "What is the most dangerous thing about an evidence collection that 'feels balanced'?",
      back: "It produces emotional confidence without epistemic confidence. The reader concludes the claim has been pressured because the folder is thick. But thickness measures how much support was gathered, not how much challenge survived. The folder can be heavy and still be one-sided." },
    { front: "What is the operational move when a team's research keeps confirming the existing thesis?",
      back: "Send a member to actively find the strongest disconfirming case. Treat the absence of falsifiers as a missing input, not a clean bill of health. The claim is tested when it survives the case that should kill it, not when no such case is on the table." },
    { front: "What single question converts confirmation into a real test?",
      back: "'What evidence, if found, would change my mind?' If the question can't be answered concretely, the claim is not falsifiable and the research is decoration. If it can be answered, the next task is to look for that evidence — not for more support." },
  ],
  coreSkill:
"You apply the Disconfirming Evidence Search before treating a folder of support as proof. The check is four questions: (1) Hypothesis — what claim is the team defending? (2) Confirming bias — what evidence has already been collected? (3) Falsifier — what would have to be true for the claim to be wrong? (4) Search — where would disconfirming evidence live, and has the team looked there? A folder that fails the check is collecting comfort, not running a test.",
  challenge:
"Find one investment, hire, launch, or thesis in your workflow that has heavy supporting evidence. Apply the four Disconfirming Evidence Search questions. Write down the answer to question 3 (the falsifier) and check whether the team has looked for it.",
  ml: [
    "The volume of support measures how much was gathered, not how much was tested.",
    "Students collect sources that defend the thesis they already drafted.",
    "If the search itself is biased, the conclusion is being protected, not tested.",
  ],
});

// =========================================================
// Ch6 — The Narrative Fallacy
// (Astrid documentary, Maja chemistry, Anke memo, Marit family, Marco postmortem, Luca podcast)
// =========================================================
applyChapter(5, {
  fastRead:
"Marco presents a postmortem for a product launch that missed revenue by 37%. The first slide names one elegant cause: pricing. The room nods. Then Marco scrolls past slide one and sees what the team cut: three messy threads — a launch-week outage, a competitor announcement, a misaligned ad spend — any of which could have produced the miss alone. Stories get sharper when the noise is removed. What makes the story persuasive is often what it leaves out. Narrative compression turns selected fragments into a cause that feels cleaner than the event was. Before treating the story as the cause, ask what had to be cut away to make it look that clean.",
  cards: [
    { front: "What does it mean for a narrative to be a 'compression' of reality?",
      back: "The story selects details that fit the explanation and drops the ones that don't. Marco's postmortem names pricing as the cause; the outage, the competitor announcement, and the ad-spend miss are excluded so the story can be clean. The cleanness comes from omission, not analysis." },
    { front: "When a postmortem offers one elegant cause for a failure, what should you ask?",
      back: "What other plausible causes existed at the same time, and what evidence rules them out? If the alternative causes haven't been ruled out by evidence, the elegant cause is one story among several — chosen for clarity, not for support." },
    { front: "What is the most dangerous thing about a story that reads as inevitable in hindsight?",
      back: "It convinces the next team that the same elegant cause will explain their failure too, training pattern-matching that ignores the messier alternatives. Hindsight makes the cause feel obvious. In real time, the cause was one of several." },
    { front: "What is the operational move when a polished explanation arrives for a messy event?",
      back: "Reconstruct the timeline before the story was written. List the candidate causes that were live at the time. Ask which were ruled out by evidence and which were dropped because the story was easier without them. If the second list is longer than the first, the story is compression, not analysis." },
    { front: "What single question keeps a story honest about omission?",
      back: "'What had to be cut away to make it look that clean?' If the answer is 'nothing important,' the story may be sound. If the answer is 'several plausible causes,' the explanation has been edited toward elegance and the elegance is doing work the evidence cannot." },
  ],
  coreSkill:
"You apply the Narrative Strip-Down before treating a clean explanation as a cause. The check is four questions: (1) Story — what is the explanation being offered? (2) Excluded facts — what details did the story leave out? (3) Inevitability test — does the story feel inevitable in hindsight when it was uncertain in real time? (4) Action — can the team plan as if the story were not the right cause? A story that fails the strip-down is shape, not evidence.",
  challenge:
"Find one postmortem, case study, or success/failure narrative in your workflow. Apply the four Narrative Strip-Down questions. Write down the answer to question 2 (the excluded facts) and decide whether the story still holds when those facts are added back.",
  ml: [
    "What makes the story persuasive is often what it leaves out.",
    "Narrative compression turns selected fragments into a cause that feels cleaner than the event was.",
    "ask what had to be cut away to make it look that clean",
  ],
});

// =========================================================
// Ch7 — Living in the Antechamber of Hope
// (Lea mobile app, Tomas scholarship, Diego currency, Pablo actor, Javier lottery, Sofia analyst)
// =========================================================
applyChapter(6, {
  fastRead:
"Lea leads a mobile app team with 18K waitlist signups. A board deck pictures a viral launch and proposes doubling the burn rate to handle the traffic. Lea pulls the public record of comparable launches in the same category last year: 312 apps tried, 9 went viral. The deck is sized for the 9; the cash flow is exposed to the 303. The mind keeps rehearsing the lucky branch while the field of failures fades from view. A vivid possibility is being handled as if it were much nearer than its probability warrants. Improbable upside can become emotionally vivid enough that people overinhabit the lucky branch and never count what surrounded it.",
  cards: [
    { front: "What does it mean to 'overinhabit' an improbable outcome?",
      back: "The mind treats a vivid rare possibility as if it were near and likely. Lea's team imagines viral launch in cinematic detail; the 303 apps that did not go viral arrive as a statistic with no narrative weight. Mental availability has overrun probability." },
    { front: "When a team is sizing capacity (or capital) around a single dramatic outcome, what should you ask?",
      back: "What is the actual frequency of that outcome in the comparable population, and what does the team's plan look like at the frequency, not at the imagined case? If the gap is large, the plan is being driven by emotional weight, not probability." },
    { front: "What is the most dangerous thing about a vivid possibility that stays emotionally available?",
      back: "It can be rehearsed often enough to feel like progress, even though no work has moved the actual odds. Repeated imagination feels like preparation. The team confuses planning intensity for likelihood, and commits to a position the population data would not support." },
    { front: "What is the operational move when a vivid jackpot is shaping ordinary planning?",
      back: "Compare the mental weight of the outcome to its actual base-rate frequency. Resize the position so the plan survives at the base rate, not the imagined case. The vivid branch can stay in view as upside, but it stops sizing the commitment." },
    { front: "What single number resets a fantasy to a probability?",
      back: "The base rate — the share of comparable attempts that produced the outcome in question. If 9 of 312 apps went viral, the base rate is roughly 3%. Multiply expected gains by 3% before sizing; the lucky branch shrinks to a useful number." },
  ],
  coreSkill:
"You apply the Denominator Rebuild before letting a vivid outcome shape the plan. The check is four questions: (1) Visible win — what success is being celebrated or feared? (2) Comparable attempts — how many similar attempts existed in the same population? (3) Failure count — how many of those attempts did not produce the visible outcome? (4) Frequency — what is the actual rate, and is the team treating it as more common than that? A plan that fails the rebuild is sized for the fantasy, not the population.",
  challenge:
"Find one decision in your workflow that is being sized around a dramatic rare outcome (viral launch, jackpot, breakout success, catastrophic loss). Apply the four Denominator Rebuild questions. Write down the answer to question 4 (the actual rate) and resize the commitment to match.",
  ml: [
    "The mind keeps rehearsing the lucky branch while the field of failures fades from view.",
    "A vivid possibility is being handled as if it were much nearer than its probability warrants.",
    "Improbable upside can become emotionally vivid enough that people overinhabit the lucky branch and never count what surrounded it.",
  ],
});

// =========================================================
// Ch8 — Casanova's Unfailing Luck (Silent Evidence)
// (Giulia unicorn, Chiara dropout, Paula fund memo, Isabel podcast, Catarina hiring, Anya rental)
// =========================================================
applyChapter(7, {
  fastRead:
"Giulia is a founder studying a unicorn that began with a marketplace for restaurants. Her pitch deck copies the unicorn's first three product decisions and presents them as the playbook. Then she searches the same vertical for the marketplaces that didn't make it: forty-seven shutdowns in the past five years, many of which made the same three product decisions. A survivor cannot teach the odds until the missing field is brought back into view. A vivid survivor acquires instructional authority it did not earn. Silent evidence is the graveyard around the success story, not a footnote to it.",
  cards: [
    { front: "What does it mean for evidence to be 'silent'?",
      back: "The failed cases that should sit beside the survivor never produced visibility, so they don't arrive in the dataset. Giulia's unicorn is loud; the 47 shutdowns in the same vertical are silent. The lesson the deck is teaching is built from the half of the data that survived." },
    { front: "When a single success story is being used as a playbook, what should you ask?",
      back: "How many comparable attempts followed the same playbook and failed? If the answer isn't known, the playbook is being inferred from a sample of one. The traits that look causal in the winner may have been just as common in the losers." },
    { front: "What is the most dangerous thing about a vivid survivor in the absence of comparison?",
      back: "The survivor arrives with story detail, founder interviews, and origin-myth narration. The failures arrive as silence. Attention overweights what it can see. The winner gets instructional authority that the data does not support — and the next founder runs the same playbook into a different outcome." },
    { front: "What is the operational move before drawing a rule from a visible winner?",
      back: "Reconstruct the missing comparison set. List comparable attempts that did not survive. If the same traits or moves appear in the losers too, the rule is post-hoc storytelling. If the traits cleanly separate winners from losers in the population, you may have a pattern worth testing." },
    { front: "What single number distinguishes a teachable winner from a survivor's halo?",
      back: "The base rate of the visible outcome among comparable attempts. If one famous marketplace founder is one of 200 attempts and 199 failed, the playbook has near-zero predictive value. Cite the rate, not the story." },
  ],
  coreSkill:
"You apply the Comparable Sample Test before drawing a rule from a survivor. The check is four questions: (1) Outlier — which case is the inference drawn from? (2) Selection mechanism — what pulled this case into view? (3) Comparable population — what cases share the relevant features but did not surface? (4) Inference adjustment — does the rule hold when those cases are included? A rule that fails the test is being drawn from the survivor, not the population.",
  challenge:
"Find one playbook or 'lessons from X' artifact in your workflow that is built around a single visible success. Apply the four Comparable Sample Test questions. Write down the answer to question 3 (the comparable population that did not surface) and decide whether the rule still holds.",
  ml: [
    "A survivor cannot teach the odds until the missing field is brought back into view.",
    "A vivid survivor acquires instructional authority it did not earn.",
    "Silent evidence is the graveyard around the success story, not a footnote to it.",
  ],
});

// =========================================================
// Ch9 — The Ludic Fallacy (clean models vs messy reality)
// (Nina market sim, Kasia classroom, Marta probability, Petra forecasting, Tomasz energy, Aleksy productivity)
// =========================================================
applyChapter(8, {
  fastRead:
"Nina leads a risk team using a clean market simulation with fixed liquidity assumptions. The model recommends a position size with three decimal places of precision. Then Nina notices what the simulation cannot represent: the day liquidity disappears, the day correlations all converge, the day the regulator changes the rule the model was calibrated against. The ludic fallacy is the error of treating the world like a neat game board. The model has internal coherence, but internal coherence does not guarantee external fit. The ludic fallacy mistakes game-like, bounded uncertainty for the open, adaptive, opaque uncertainty the actual market produces.",
  cards: [
    { front: "What does it mean for a model to commit the 'ludic fallacy'?",
      back: "The model is built on the assumptions of a closed game — fixed rules, countable moves, stable distributions — and is then applied to an open domain where those assumptions fail. Nina's market simulation behaves correctly inside its assumptions and misleads about the world outside them." },
    { front: "When a formal model produces precise outputs in a messy domain, what should you ask?",
      back: "What assumption does the model require to behave well, and does the actual domain meet that assumption? If the assumption is 'rules stay fixed' and the domain changes its own rules, the precision is computational, not predictive." },
    { front: "What is the most dangerous thing about a model whose internal math is correct?",
      back: "Internal correctness gets confused with external accuracy. The committee trusts the model because the math is rigorous. But rigor inside the assumptions tells you nothing about whether the assumptions match the world. A coherent model can be confidently wrong." },
    { front: "What is the operational move when a clean model is being used to size a real decision?",
      back: "List the model's assumptions out loud. Check each against the domain. If any required assumption fails in the actual domain, the model output is decoration. Size the position around what the domain actually allows, not around what the model's coherence implies." },
    { front: "What single test reveals a domain that breaks the model's assumptions?",
      back: "Out-of-sample regime change. If the domain has produced one event the model cannot represent (a liquidity crisis, a regulatory shift, a behavioral pivot), the model's calibration is local. Push it past that event and the precision becomes false confidence." },
  ],
  coreSkill:
"You apply the Model-Domain Fit Check before trusting a formal model in a real decision. The check is four questions: (1) Model — what formal tool is being applied? (2) Assumptions — what does the model require to behave well? (3) Domain — does the actual domain meet those assumptions? (4) Action — if no, what does the team do instead of trusting the model output? A model that fails the check is producing precision the domain has not earned.",
  challenge:
"Find one quantitative model, forecast, or score in your workflow that is being used to size a decision. Apply the four Model-Domain Fit Check questions. Write down the answer to question 3 (whether the domain meets the assumptions) and decide whether the model's output should still drive the call.",
  ml: [
    "The ludic fallacy is the error of treating the world like a neat game board.",
    "internal coherence does not guarantee external fit",
    "The ludic fallacy mistakes game-like, bounded uncertainty for the open, adaptive, opaque uncertainty the actual market produces.",
  ],
});

// =========================================================
// Ch10 — The Scandal of Prediction
// (Pavel TV, Mateusz board, Janek enrollment, David product, Michael political, Thomas warehouse)
// =========================================================
applyChapter(9, {
  fastRead:
"Mateusz sits on a board choosing between two executives. One candidate gives a precise 18-month revenue forecast with three decimal places. The other names the range of outcomes the market could produce and refuses to narrow it further than the evidence allows. The board leans toward the first; the precision sounds like competence. Then Mateusz checks the prior forecasts: the precise candidate has been wrong by 40% three times and never updated the method. Prediction culture routinely exaggerates what is knowable. Experts borrow prestige from formality, from tidy models, and from the audience's appetite for certainty. Forecasts win authority through formality, numbers, dates, and audience appetite for certainty even when the underlying domain cannot support that precision.",
  cards: [
    { front: "What does it mean for a forecast to be 'overprecise'?",
      back: "The numerical specificity of the claim exceeds what the evidence in the domain can support. Mateusz's executive offers an 18-month forecast to the decimal in a domain where 6-month forecasts have been wrong by 40%. The crispness is borrowed from form, not earned by track record." },
    { front: "When a forecast is delivered with high specificity, what should you ask?",
      back: "What was the speaker's track record at this horizon, and was their method updated after each miss? If the answer is unknown or the method was unchanged after a 40% miss, the specificity is performance, not information." },
    { front: "What is the most dangerous thing about a culture that rewards crisp forecasts?",
      back: "It selects for fluency over calibration. The careful forecaster who names a range loses to the confident one who picks a point. Decisions get made against the point; the range goes unstated. The institution trains its forecasters to be wrong with precision rather than honest with uncertainty." },
    { front: "What is the operational move when a precise forecast is shaping a major decision?",
      back: "Demand the prior forecasts at the same horizon and the method's update rule. Resize the decision to fit the calibration record, not the new claim's specificity. If the speaker cannot produce both, the forecast is theater and the decision should be sized around the range the evidence allows." },
    { front: "What single number cuts through forecast theater?",
      back: "Out-of-sample error rate at the relevant horizon. If a 12-month forecaster has averaged 30% absolute error on prior 12-month calls, the latest 12-month claim is at best ±30%. Pretending the new claim is more precise than that is the theater the chapter is naming." },
  ],
  coreSkill:
"You apply the Forecast Horizon Audit before letting a precise forecast drive a major decision. The check is four questions: (1) Range — how far into the future does the claim extend? (2) Evidence density — how dense is the historical evidence at that horizon? (3) Opacity — what makes the domain hard to predict at this range? (4) Stop rule — at what horizon should the forecast be replaced with a position that survives being wrong? A forecast that fails the audit is louder than the evidence and should be sized accordingly.",
  challenge:
"Find one forecast in your workflow that is shaping a real allocation (revenue, headcount, capacity, capital). Apply the four Forecast Horizon Audit questions. Write down the answer to question 4 (the horizon beyond which forecast should be replaced with robust position) and decide whether the current commitment respects it.",
  ml: [
    "Prediction culture routinely exaggerates what is knowable.",
    "Experts borrow prestige from formality, from tidy models, and from the audience's appetite for certainty.",
    "Forecasts win authority through formality, numbers, dates, and audience appetite for certainty even when the underlying domain cannot support that precision.",
  ],
});

// =========================================================
// Ch11 — How to Look for Bird Poop (practical search vs grand forecast)
// (Daniel payroll, Andrew biology, Matthew analyst, Ben support, Etienne UX, Mathieu coffee)
// =========================================================
applyChapter(10, {
  fastRead:
"Daniel is founding a payroll tool for independent clinics. Investors ask for a five-year market story before any actual clinic has used the product. Daniel could write the story — five years of CAGR, three competitive moats, a tidy serviceable market. Or he could spend the same week running the product past four clinics and listen to what they actually complain about. Under opacity, useful action comes from scouting, probes, traces, experiments, and contact with reality. The useful move is to ask what the visible record cannot prove. That is the point of the bird-poop image: small contact with reality teaches more than a confident story that has not met the world.",
  cards: [
    { front: "What does 'bird-poop search' mean in practice?",
      back: "Small empirical traces that reality actually leaves — complaints, anomalies, real user reactions, failed pilots — are more informative than a confident narrative built before the work has met the world. Daniel's four-clinic test is bird-poop search. The investor's five-year story is fake foresight." },
    { front: "When a team is being asked for confident foresight in an opaque domain, what should you ask?",
      back: "What small contact with reality could substitute for the confident story? If a $10K pilot or a one-week probe could produce real information, the team is being asked to invent narrative instead of running the search that would actually inform the decision." },
    { front: "What is the most dangerous thing about a polished forecast in a domain the team has not yet met?",
      back: "It substitutes for evidence. The forecast deck gets reviewed; the search gets postponed. The team commits to a direction the world has not yet validated, and the cost of being wrong is paid in months that could have been spent learning." },
    { front: "What is the operational move when the plan demands forecast confidence the evidence cannot supply?",
      back: "Replace the forecast with the smallest experiment that produces real information. Use the experiment's result to size the next commitment. Optionality preserves the ability to redirect when the search returns something the forecast did not expect." },
    { front: "What single check separates search from fake foresight?",
      back: "Does the proposed activity put the team in contact with reality, or does it just produce more confident language? Surveys, probes, pilots, and complaints are contact. Forecast decks, market sizing exercises, and TAM math are language — useful for fundraising, not for finding out." },
  ],
  coreSkill:
"You apply the Practical Search Inventory before letting a grand forecast substitute for contact with the world. The check is four questions: (1) Grand plan — what comprehensive prediction is the team relying on? (2) Real contact — what direct experiments have been run? (3) Cheap probes — what small tests can produce real information now? (4) Replacement — does the team switch from forecast to search? A plan that fails the inventory is being defended by language instead of evidence.",
  challenge:
"Find one decision in your workflow being sized around a forecast for an unknown domain (new market, new behavior, new technology fit). Apply the four Practical Search Inventory questions. Write down the answer to question 3 (the cheap probes) and run one this week.",
  ml: [
    "Under opacity, useful action comes from scouting, probes, traces, experiments, and contact with reality",
    "The useful move is to ask what the visible record cannot prove.",
    "That is the point of the bird-poop image",
  ],
});

// =========================================================
// Ch12 — Epistemocracy (skin in the game)
// (Ryan flood-risk, Jack private credit, Luke logistics, Camille graduate, Hugo bonds, Lukas software)
// =========================================================
applyChapter(11, {
  fastRead:
"Ryan staffs a policy panel reviewing flood-risk recommendations. The loudest commentator proposes a $48M levee upgrade based on a model he developed. Then Ryan asks the practical question: who absorbs the cost if the model is wrong? The commentator is not a resident, not an insurer, not a contractor. The advice is unconstrained. Authority deserves less deference when prestige outruns accountability and insulated commentators set the rule. Epistemocracy matters because authority should follow tested contact, not podium poise. Exposure compresses bluff because the speaker must live with the error after the applause ends.",
  cards: [
    { front: "What does it mean for an expert to have 'skin in the game'?",
      back: "The cost of being wrong arrives at the expert's door, not somewhere else. Ryan's panel commentator faces no consequence if the levee fails; the residents and the city absorb it. Skin in the game compresses the gap between confident speech and what the world actually tells the speaker." },
    { front: "When a credentialed expert makes a confident recommendation, what should you ask?",
      back: "What does the speaker pay if it fails? If the answer is 'nothing structural,' the credential is loaning prestige to a claim without a price. The advice may still be correct, but it has not yet been pressured by exposure." },
    { front: "What is the most dangerous thing about a culture that rewards fluent experts who never absorb fallout?",
      back: "It selects for confident speech over calibrated speech. The expert who makes a bold call and is wrong moves to the next engagement; the consequences stay with the institution that trusted them. The institution keeps hiring the same kind of expert, since the selection mechanism is fluency, not track record." },
    { front: "What is the operational move when an unaccountable expert is shaping a real decision?",
      back: "Require the expert to name what they pay if they are wrong. If they cannot or will not, downgrade the recommendation's authority. Either constrain the decision so the speaker carries part of the cost (co-investment, performance contract) or treat the advice as one input among several." },
    { front: "What single test separates real authority from podium prestige?",
      back: "Track record under exposure. An expert who has been wrong and stayed exposed long enough to update is showing calibration. An expert whose visibility depends on always being confident is being selected for confidence, not for accuracy." },
  ],
  coreSkill:
"You apply the Skin-in-the-Game Check before granting authority to a confident recommendation. The check is five questions: (1) Claim — what is being asserted or recommended? (2) Exposure — what does the speaker pay if it fails? (3) Feedback — how fast does reality correct them? (4) Constraint — are they on call, invested, or only commenting? (5) Decision — should we trust, test small, cap downside, or ignore? Authority that fails the check is fluency without accountability.",
  challenge:
"Find one recommendation in your workflow coming from a credentialed but unaccountable source (consultant, advisor, pundit, vendor demo). Apply the five Skin-in-the-Game Check questions. Write down the answer to question 2 (what they pay if wrong) and decide whether the recommendation should still carry the weight it has.",
  ml: [
    "Epistemocracy matters because authority should follow tested contact, not podium poise.",
    "Authority deserves less deference when prestige outruns accountability and insulated commentators set the rule",
    "Exposure compresses bluff because the speaker must live with the error after the applause ends.",
  ],
});

// =========================================================
// Ch13 — Appelles the Painter (robust optionality)
// (Juliette CRM, Chloe degree, Manon medical device, Adrian migration, Martin clinic, Ingrid sensor)
// =========================================================
applyChapter(12, {
  fastRead:
"Adrian leads a data migration for a billing system. The vendor recommends a full cutover in one weekend for $250K, which makes a clean architecture but cannot be undone if anything breaks. Adrian's counter-proposal is a parallel-run for the same eight weeks, costing $40K extra, that preserves the ability to fall back. When prediction is weak, stop arranging for the forecast to be right and start arranging for being wrong without ruin. That is a stronger posture than acting as though the future owes you clarity. Optionality also prepares the next distinction between domains where ordinary variation stays bounded and domains where one outcome can rewrite the whole picture.",
  cards: [
    { front: "What does it mean for a position to have 'optionality'?",
      back: "The actor preserves the ability to respond after the next data point arrives, instead of locking in a commitment that depends on the forecast being right. Adrian's parallel-run preserves the rollback path; the vendor's cutover does not. The optionality is the rollback path." },
    { front: "When a decision is being made under weak prediction, what should you ask?",
      back: "What does the position look like if the forecast is wrong? If the answer is 'we lose the project,' the position is fragile to the most likely surprise. The fix is to cap the first loss and preserve a choice for the second move." },
    { front: "What is the most dangerous thing about committing fully to a forecast you cannot verify?",
      back: "Surprise removes optionality at exactly the moment you most need it. The cutover that depended on the migration script breaks; there is no parallel system to fall back to. The full commitment converted forecast weakness into ruin." },
    { front: "What is the operational move when the team must act with weak predictive evidence?",
      back: "Cap the initial commitment at the level where being wrong still leaves the project alive. Define the upside trigger that justifies a second, larger commitment. Write the exit condition before the commitment is signed. The first action is small enough that the second can still happen." },
    { front: "What single test separates a robust position from a confident bet?",
      back: "Can the actor survive the most likely surprise and still take the next action? If yes, the position is robust. If no, the position is a bet dressed as a plan — and the bet depends on the forecast being right." },
  ],
  coreSkill:
"You apply the Robustness Check before committing on weak predictive evidence. The check is six questions: (1) Forecast weakness — what do we not know? (2) Ruin check — what could kill the project if we are wrong? (3) Cap — how do we limit the first loss? (4) Option — what choice do we preserve for later? (5) Upside — what favorable surprise can still help us? (6) Next test — what small contact comes before the big commitment? A position that fails the check is a bet, not a robust plan.",
  challenge:
"Find one commitment in your workflow being shaped by a forecast you cannot verify (vendor cutover, full inventory buy, exclusive contract). Apply the six Robustness Check questions. Write down the answer to question 3 (the cap on the first loss) and decide whether the commitment is structured to survive being wrong.",
  ml: [
    "When prediction is weak, stop arranging for the forecast to be right and start arranging for being wrong without ruin.",
    "That is a stronger posture than acting as though the future owes you clarity.",
    "Optionality also prepares the next distinction between domains where ordinary variation stays bounded and domains where one outcome can rewrite the whole picture.",
  ],
});

// =========================================================
// Ch14 — Mediocristan vs Extremistan (already polished — only update framework + 24hrCh)
// Keep existing fastRead, cards, deepRead, fullRead, ML (all good).
// =========================================================
{
  const ch = book.chapters[13];
  ch.implementationPlan.coreSkill =
"You apply the Domain Diagnosis before trusting any average, mean, or standard deviation. The check is four questions: (1) Mediocristan or Extremistan — can one case rewrite the total? (2) Top-1% contribution — what share of total does the largest case provide? (3) Average vs median gap — how far apart are they? (4) Action — separate the giant from the long tail before using either number. A dataset that fails the diagnosis is being summarized by a number the domain does not support.";
  ch.implementationPlan.twentyFourHourChallenge =
"Find one dashboard, report, or KPI in your workflow that uses an average. Apply the four Domain Diagnosis questions. Write down the answer to question 2 (the top-1% contribution) and decide whether the average is still the right summary.";
}

// =========================================================
// Ch16 — The Aesthetics of Randomness
// (Ingrid quality, Hanna tutor, Frida market, Astrid retail, Anya citations, Nina charity)
// Also: Q1, Q8, Q9 quiz alignment fixes (per plan table)
// =========================================================
applyChapter(15, {
  fastRead:
"Ingrid manages quality reporting for a manufacturing team. A smoothed defect chart shows a graceful downward curve, and the operations VP wants to use it in the all-hands. Then Ingrid pulls the raw monthly counts: months of swings the polish hid, two months that bucked the trend, and an underlying record that does not actually support the curve. Human beings keep turning chance into intention, signal, and story. The useful move is to ask what the visible record cannot prove. Beauty in a chart is information about the chart-maker, not about the world.",
  cards: [
    { front: "What does it mean for a chart to be 'beautifully smooth' in a misleading way?",
      back: "The chart shows the polished aggregate while hiding the underlying variation. Ingrid's defect curve looks graceful only after the monthly noise is smoothed away. The smoothness is design, not data — and the design is doing the persuading the raw record cannot." },
    { front: "When a chart hides the raw record, what should you ask before trusting it?",
      back: "What data was smoothed, averaged, or excluded? What does the unsmoothed monthly (or daily) version look like? If the polished line and the raw counts tell different stories, the polish is the claim and the raw record is the rebuttal." },
    { front: "What is the most dangerous thing about removing uncertainty bands from a visualization?",
      back: "The chart looks definite when the data was not. Decisions get made against the visual certainty even though the underlying number had wide error bars. Beauty is hiding the uncertainty the user needed in order to judge the claim." },
    { front: "What is the operational move when a visualization claims a pattern with elegance?",
      back: "Pull the raw record. Check what was excluded. Test the pattern on data that wasn't used to build the chart. If the pattern survives a fresh sample, it may be real. If it only lives in the polished version, it's design." },
    { front: "What single check separates real patterns from beautiful noise?",
      back: "Out-of-sample fit. A pattern that holds on data the chart-maker did not see is a pattern with information. A pattern that only fits the source data is decoration, no matter how elegant the chart looks." },
  ],
  coreSkill:
"You apply the Beautiful Pattern Check before trusting a smooth chart or elegant model. The check is five questions: (1) Raw record — what did the unsmoothed data look like? (2) Exclusions — what cases or periods were removed? (3) Alignment — was the timeline aligned after the outcome was known? (4) Fresh test — does the pattern survive new data? (5) Decision — what changes if the pattern is noise, not signal? A pattern that fails the check is design, not evidence.",
  challenge:
"Find one chart, dashboard, or visualization in your workflow that looks too clean. Apply the five Beautiful Pattern Check questions. Write down the answer to question 2 (the exclusions) and decide whether the pattern still holds when the excluded cases are added back.",
  ml: [
    "Human beings keep turning chance into intention, signal, and story.",
    "The useful move is to ask what the visible record cannot prove.",
    "Beauty in a chart is information about the chart-maker, not about the world.",
  ],
});

// Ch16 specific quiz alignment fixes
{
  // Q1 (CI=2): rewrite correct to actionable test
  book.chapters[15].quiz.questions[0].choices[2] =
    "Overlay event dates and inspect the raw monthly attendance counts before trusting the smooth trend line.";
  // Q8 (CI=2): rewrite correct to name what beauty is doing
  book.chapters[15].quiz.questions[7].choices[2] =
    "Beauty is hiding uncertainty the user needs in order to judge the claim.";
  // Q9 (CI=0): rewrite correct to give the operational move
  book.chapters[15].quiz.questions[8].choices[0] =
    "Put raw monthly counts beside the polished trend line so readers can see the variation the design has smoothed away.";
}

// =========================================================
// Ch17 — Locke's Madmen (method-jurisdiction)
// (Marit policy, Marco psych, Luca software, Matteo strategist, Pavel insurance, Mateusz AI)
// Also: Q1, Q8, Q9 alignment cleanup
// =========================================================
applyChapter(16, {
  fastRead:
"Matteo is a strategist selling a churn model built for cable subscribers. A professional services firm wants the same model for their consulting clients. Matteo could relabel the inputs and quote the same accuracy. Then he reads what the model was calibrated on: 8 years of monthly billing data, 4 million subscribers, contractual flat-rate pricing, near-zero switching cost. The new domain has none of those. A method earns its authority inside one domain and loses it the moment it crosses into another that does not honor its assumptions. The bell-curve critique now becomes a placement problem: a tool can be formal and rigorous and still be the wrong tool because the address is wrong.",
  cards: [
    { front: "What does it mean for a formal tool to be 'in the wrong place'?",
      back: "The tool was developed and validated in one domain whose features the new domain does not share. Matteo's churn model was built on cable subscribers with flat-rate billing and near-zero switching cost. Applied to professional services, the assumptions disappear and the model's precision becomes decoration." },
    { front: "When a tool is being imported from one domain into another, what should you ask?",
      back: "What features did the origin domain have that the new domain lacks? If the missing features are the ones the tool's assumptions depended on, the import is unlicensed use. The tool's confidence is borrowed from the origin domain, not earned in the new one." },
    { front: "What is the most dangerous thing about a polished tool used outside its jurisdiction?",
      back: "The polish substitutes for fit. The dashboard looks rigorous, the dashboard has confidence intervals, the dashboard is in the language the field expects — and the dashboard's outputs are still being produced by a model whose assumptions are not met. Polish is mistaken for licensure." },
    { front: "What is the operational move when a method is being applied across domains?",
      back: "List the method's assumptions out loud. Mark which ones hold in the new domain and which do not. If any required assumption fails, the method is producing comfort, not measurement. The next step is to find a method whose assumptions match — or to operate without one." },
    { front: "What single test separates licensed use from unlicensed use?",
      back: "Out-of-sample validation in the new domain. If the tool's outputs match observed outcomes in the new domain's data, the import is licensed. If validation is missing or fails, the precision is a credential being loaned across a border the math cannot cross.",
    },
  ],
  coreSkill:
"You apply the Method-Jurisdiction Test before importing a formal tool into a new domain. The check is five questions: (1) Method — what tool is being applied? (2) Origin domain — where was it developed and validated? (3) Current domain — what features does the new domain have? (4) Mismatch — does the new domain break any of the method's assumptions? (5) Action — what would the team do without the borrowed method? A method that fails the test is loaning prestige to a domain it cannot honestly serve.",
  challenge:
"Find one model, score, framework, or benchmark in your workflow that was developed elsewhere. Apply the five Method-Jurisdiction Test questions. Write down the answer to question 4 (the mismatch) and decide whether the tool should still drive the call.",
  ml: [
    "A method earns its authority inside one domain and loses it the moment it crosses into another that does not honor its assumptions.",
    "The bell-curve critique now becomes a placement problem",
    "a tool can be formal and rigorous and still be the wrong tool because the address is wrong",
  ],
});

// Ch17 specific alignment cleanup
{
  // Q1 (CI=0): rewrite correct to actionable test
  book.chapters[16].quiz.questions[0].choices[0] =
    "Test whether the model's training-data domain matches the domain where the bell-curve assumptions actually need to hold.";
  // Q8 (CI=1): rewrite correct to give the action
  book.chapters[16].quiz.questions[7].choices[1] =
    "Require out-of-sample validation on prompts shaped like the hospital's actual use case before approving any pilot.";
  // Q9 (CI=2): rewrite correct to operational move
  book.chapters[16].quiz.questions[8].choices[2] =
    "Use the formula only inside one department's norms and let other departments use the statistics that match their own citation patterns.";
}

// =========================================================
// Ch18 — The Uncertainty of the Phony
// (Pablo TV, Javier transformation, Sofia influencer, Giulia retailer, Andrew advisor, Matthew hospital)
// =========================================================
applyChapter(17, {
  fastRead:
"Matthew evaluates an AI triage vendor for a hospital. The demo sounds fluent: a 94% accuracy figure, a polished UI, a university logo on the deck. Then Matthew asks for the miss rate breakdown and the failure modes on malformed inputs. The vendor pauses. There is no out-of-sample test, no false-negative rate, no documented behavior under input drift. The 94% was measured against the data the model was trained on. Borrowed precision lets the phony sell fog as if it were measurement. Prestige costumes weak sight in numbers until the limits disappear from view. False expertise gathers earlier errors into one marketable performance.",
  cards: [
    { front: "What does it mean for a claim to carry 'borrowed precision'?",
      back: "The numerical specificity of the claim exceeds what the speaker's evidence supports, but the precision is real-sounding enough to confer authority. Matthew's vendor cites 94% accuracy from in-sample data. The decimal is real; the calibration is not." },
    { front: "When a fluent expert makes a precise claim in an opaque domain, what should you ask?",
      back: "What test would invalidate the claim, and has it been run? If the speaker cannot name a falsifier or has not run out-of-sample validation, the precision is a credential being performed, not a measurement being reported." },
    { front: "What is the most dangerous thing about prestige used to support an unfalsifiable claim?",
      back: "Audiences read prestige as evidence. The university logo, the polished deck, the technical vocabulary all signal expertise. The audience defers; the claim goes unchallenged. The phony's specificity gets implemented as if it were known." },
    { front: "What is the operational move when a vendor or pundit presents fluent numbers?",
      back: "Require the out-of-sample test, the miss rate, and the failure modes before any pilot or commitment. If the speaker resists or has nothing to show, the deference should drop to zero. Fluency without falsifiers is a performance to walk away from." },
    { front: "What single test separates real expertise from prestige theater?",
      back: "Track record under exposure to disconfirming cases. A real expert names the conditions under which their model fails and shows how often it has. A phony names accuracy and resists describing failure modes. The willingness to describe limits is the test.",
    },
  ],
  coreSkill:
"You apply the Borrowed Precision Audit before deferring to a fluent expert's precise claim. The check is four questions: (1) Precision — what numerical specificity is the claim being made with? (2) Track record — has this speaker's method been tested out of sample? (3) Authority signal — is the precision coming from prestige rather than evidence? (4) Action — would the claim survive without the credential dressing? A claim that fails the audit is theater dressed in decimals.",
  challenge:
"Find one vendor demo, pundit prediction, or expert recommendation in your workflow that arrives with precise numbers. Apply the four Borrowed Precision Audit questions. Write down the answer to question 2 (whether the method has been tested out of sample) and decide whether the claim still earns the trust it is asking for.",
  ml: [
    "Borrowed precision lets the phony sell fog as if it were measurement.",
    "Prestige costumes weak sight in numbers until the limits disappear from view.",
    "False expertise gathers earlier errors into one marketable performance.",
  ],
});

// Ch18 specific cleanup
{
  // Q8 (CI=2): rewrite correct to an actionable hospital requirement
  book.chapters[17].quiz.questions[7].choices[2] =
    "Require out-of-sample accuracy, documented miss rates, and tested failure modes on the hospital's own data before approving any pilot.";
}

// =========================================================
// Ch19 — Half and Half (barbell)
// (Isabel contract, Catarina fellowship, Anya investment, Nina household, Luke clinic, Camille procurement)
// =========================================================
applyChapter(18, {
  fastRead:
"Isabel runs a small studio that builds custom Shopify themes. A fast-growing client offers a six-month exclusive contract that would consume 100% of her capacity. The contract is large enough to fund the year, and one wrong client decision would put her out of business when the exclusivity ends. Isabel keeps the base — three steady accounts that cover overhead — and accepts a smaller engagement with the new client that does not lock her in. The barbell holds a safe base on one end and capped exposure to surprise on the other; the middle is the part that ruins you. The closing posture is pragmatic: limit downside, preserve optionality, stay open to favorable asymmetry, and stop needing false certainty. If history jumps, models overreach, experts bluff, and Black Swans remain real, how should a person live?",
  cards: [
    { front: "What does a 'barbell position' actually look like?",
      back: "A large safe base (low-volatility cash, steady contracts, baseline income) on one end and a small exposure to asymmetric upside (one risky bet with capped loss) on the other. Isabel's three steady accounts form the base; the smaller engagement with the new client is the capped exposure. The middle — moderate-risk positions whose downside could touch the base — is what the structure refuses." },
    { front: "When a single opportunity wants 100% of a position, what should you ask?",
      back: "What happens to the base if the opportunity fails? If the base disappears, the structure is not a barbell — it is a concentrated bet whose downside is the same as ruin. The fix is to size the exposure so the base survives the worst case." },
    { front: "What is the most dangerous thing about a 'middle' position that looks moderate?",
      back: "Moderate-risk positions feel safer than they are because the loss looks bounded in normal conditions. In the conditions that actually matter — the shock the model did not see — the middle position can move large enough to touch the base. The barbell refuses the middle because its downside is harder to cap than it looks." },
    { front: "What is the operational move when uncertainty cannot be predicted but can be planned for?",
      back: "Cap the downside on the exposure; protect the base; refuse middle-risk positions whose worst case could compromise survival. The forecasts can be wrong, the experts can bluff, and the position still works because survival is structured separately from upside." },
    { front: "What single test reveals whether a position is robust to Black Swan exposure?",
      back: "Does the safe base survive intact if the exposure goes to zero overnight? If yes, the structure is a barbell. If no, the position is leveraged into the upside in a way that survival depends on the upside arriving — which is the dependency the chapter is teaching against.",
    },
  ],
  coreSkill:
"You apply the Barbell Position Audit before approving a structure that combines safety and upside. The check is four questions: (1) Base — what is the safe, capped-loss position? (2) Exposure — what is the asymmetric upside position? (3) Middle — is the team holding moderate risk that could ruin the base? (4) Sizing — does the safe base remain intact even if the exposure goes to zero? A structure that fails the audit is not a barbell — it is a concentrated bet wearing one.",
  challenge:
"Find one allocation in your workflow that combines safety and upside (portfolio, career, supplier mix, contract structure). Apply the four Barbell Position Audit questions. Write down the answer to question 4 (whether the base survives if the exposure goes to zero) and resize if it does not.",
  ml: [
    "The barbell holds a safe base on one end and capped exposure to surprise on the other; the middle is the part that ruins you.",
    "If history jumps, models overreach, experts bluff, and Black Swans remain real, how should a person live?",
    "The closing posture is pragmatic: limit downside, preserve optionality, stay open to favorable asymmetry, and stop needing false certainty.",
  ],
});

// Ch19 specific cleanup
{
  // Q8 (CI=2): rewrite correct to a barbell description
  book.chapters[18].quiz.questions[7].choices[2] =
    "Build a barbell: one steady supplier holds the base while small optional contracts elsewhere preserve upside without risking the base.";
}

console.log('Ch1-13, Ch14 (framework), Ch16-19 applied.');
fs.writeFileSync(path, JSON.stringify(book, null, 2) + '\n');
