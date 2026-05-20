#!/usr/bin/env node
// S-tier finalization pass 1: Ch16 QC + breakdown expansions for thin chapters
const fs = require('fs');
const path = 'book-packages/the-black-swan.v21.json';
const book = JSON.parse(fs.readFileSync(path, 'utf-8'));

// =========================================================
// Ch16 — QC-specific fixes
// =========================================================
{
  const ch = book.chapters[15];

  // Ex1 (Ingrid) polish — add sensory/context detail
  ch.examples[0].scenario =
"Ingrid manages quality reporting for a 110-person manufacturing team. The smoothed defect chart on the operations VP's screen shows a graceful downward curve and is being used to justify reducing inspection staff by two people. Ingrid pulls the raw monthly counts: three defect clusters tied to one supplier lot and two weeks of missing night-shift entries that the smoothing absorbed silently. The staffing request is on the agenda for the Friday operations review. She can accept the clean curve, reject charting altogether, or put the unsmoothed lot-and-shift data beside the curve before headcount is touched.";

  // Ex3 (Frida) polish
  ch.examples[2].scenario =
"Frida writes a market note showing a graceful rotation from small-cap stocks into software. The chart uses six selected weeks and removes two reversal weeks as holiday noise. A client manages $2M and wants to shift the allocation before the quarter closes Friday. The raw weekly price file still contains the removed weeks in a hidden tab the note does not reference. Frida can publish the recommendation, drop the note, or rerun the pattern with the holiday weeks included and on a fresh out-of-sample period before sending anything to the client.";

  // Ex6 (Nina) polish
  ch.examples[5].scenario =
"Nina designs a charity impact infographic for a donor campaign launching next Tuesday. A polished trend line shows steady improvement in food deliveries — left to right, month after month. The raw month-level data tells a different story: volunteer cancellations push deliveries from 800 in one month to 3,400 in the next, with no underlying trend. A raw monthly table is attached but hidden after slide 19 of the deck. Nina can publish the smooth line, abandon the campaign, or put the raw monthly variation on the same slide so the donor sees the real volatility behind the polished story.";

  // Ch16 Q1 explanation
  ch.quiz.questions[0].explanation =
"A smooth attendance curve can hide event-driven spikes. Overlaying event dates tests whether the smooth line is a real trend or event-driven variation the smoothing absorbed.";

  // Ch16 Q8 explanation
  ch.quiz.questions[7].explanation =
"Removing uncertainty bands makes the estimate look more definite than the evidence allows. The decision then gets made against a visual that has been quietly stripped of its honest range.";

  // Expand other thin Ch16 explanations
  ch.quiz.questions[1].explanation =
"The mind smooths noise into pattern and pattern into story. Once a trajectory has been read, the missing variance vanishes from view and the inference outruns the data.";
  ch.quiz.questions[2].explanation =
"An elegant chart is easier to admire, teach, and defend than the messy record it summarizes. The model gets institutional traction even when its fit has expired.";
  ch.quiz.questions[3].explanation =
"The cases producing the pattern and the cases the claim applies to may not be the same set. Pulling the underlying record back onto the table is the test that closes the gap.";
  ch.quiz.questions[4].explanation =
"The bias is aesthetic as well as analytic — beautiful form earns trust before analysis begins, which is a different failure mode than ordinary cognitive bias.";
  ch.quiz.questions[5].explanation =
"Aesthetic preference acts as a credibility subsidy: false order gets the benefit of the doubt before any test is run, so weak models survive longer than their evidence warrants.";
  ch.quiz.questions[6].explanation =
"A few noisy score swings get organized into a story of destiny. The chapter pushes back by treating that organization as a hindsight construction, not a real pattern in the data.";
  ch.quiz.questions[8].explanation =
"Putting the raw monthly counts beside the polished trend line lets the reader see the variation the design has smoothed away — and decide whether the trend or the noise is the real signal.";

  // FullRead expansion — add 'ugly but truer' paragraph (~80 more words)
  ch.breakdown.fullRead =
"The chapter is about the social force of clean form. A trader can stare at random-walk prices until a Fibonacci-like shape appears, and once the line is drawn, the chart starts to feel as if it discovered something. The feeling is not evidence. It is a warning that presentation has begun to do persuasive work before the rule has been tested. The same error appears in a growth ladder built from seven companies. The analyst selects firms that fit the curve, aligns their revenue years after the fact, removes two messy comparables, and then presents the result as if it revealed a law of scaling. The chart may be useful as design. It is not yet useful as inference.\n\n" +
"The discipline is concrete. Ask which cases created the visual pattern. Ask which cases the claim applies to. If those sets differ, the beauty belongs to the chart-maker, not to the world. Then run the rule on fresh data, show the excluded cases, and keep the raw variation visible. A beautiful pattern should slow the decision down until the evidence catches up with the image.\n\n" +
"Before trusting a beautiful chart, ask what would make it uglier but truer. Add back the months that broke the trend. Restore the uncertainty bands the designer removed for the keynote. Plot the cases that were excluded for not fitting. If the chart still tells the same story when those details are in view, the pattern may be real. If the story collapses, the design was the claim — and the design has been doing work the data could not support.";
}

// =========================================================
// Ch10 — expand thin deepRead (180 → ~250)
// =========================================================
{
  const ch = book.chapters[9];
  ch.breakdown.deepRead =
"The pressure builds at the moment a forecaster's confidence outruns the evidence underneath it. The number, the date, the directional claim all create the appearance of foresight, even though the underlying domain often cannot support the precision being claimed.\n\n" +
"Look at how it actually arrives. Pavel is asked on a finance show to say when a market correction will begin; his producer wants a date because dates feel responsible on air. Mateusz's board prefers the executive with the precise 18-month revenue forecast over the one who marks the range honestly — the precise number reads as competence, even after the precise forecaster has been off by 40% three times. Janek's school enrollment model predicts 1,247 students next fall from three years of post-pandemic data the model has no reason to extrapolate.\n\n" +
"In each case the failure is not numerical. The forecast is being asked to do work the evidence does not authorize: substitute for contact with the domain, settle a planning disagreement, signal competence to a board. Calibration loses status to fluency. Institutions, media, and organizations therefore keep selecting for people who can compress ambiguity into sentences that sound clean and final. The right discipline is to size the next commitment around the calibration record, not the new claim's confidence.";
}

// =========================================================
// Ch11 — expand thin deepRead (176 → ~240)
// =========================================================
{
  const ch = book.chapters[10];
  ch.breakdown.deepRead =
"Under opacity, the useful information often arrives in small pieces — anomalies, complaints, surprises, real user reactions, results from one cheap test — long before any comprehensive forecast can describe the territory.\n\n" +
"Daniel's payroll tool for independent clinics is the cleanest case. Investors want a five-year market story; what would actually inform the decision is what four clinics complain about when they use the product for a week. Andrew is being pressured to commit to a causal model of algae blooms before his lab has run the next field season. Ben's support team forecasts that churn will fall after a redesign, but the actual signal is sitting in the complaint queue — visible to anyone who reads it. Mathieu's coffee distributor claims a new farm can replace 40% of the house espresso, but two shipments under realistic kitchen conditions would tell him more than the distributor's claim ever can.\n\n" +
"The discipline is small probes before big stories. Use the search record to identify practitioners who found real traces before confident forecasters knew where to look. The useful move is to ask what the visible record cannot prove and to design the search that would actually produce that evidence.";
}

// =========================================================
// Ch12 — expand thin deepRead and fullRead
// =========================================================
{
  const ch = book.chapters[11];
  ch.breakdown.deepRead =
"Authority becomes load-bearing in proportion to how much the speaker pays if they are wrong. The chapter pushes back on a culture that has stopped enforcing that ratio.\n\n" +
"Ryan's flood-risk panel hears a $48M levee recommendation from a commentator who is not a resident, not an insurer, and not a contractor. The advice is fluent and unconstrained. Jack's investment committee gets a private-credit recommendation from a consultant whose firm faces no loss if the credit cycle turns. Hugo's town council is offered a variable-rate municipal bond structure that lowers first-year payments by $380K but exposes the town to the next rate move — and the banker selling the structure is paid on the sale, not the eventual cost.\n\n" +
"The shared shape is small. Confident speech in a credentialed voice produces deference even when the speaker has no exposure to the failure case. The discipline is to require the exposure to be named. If the answer is 'none structural,' the recommendation is fluency without accountability — useful as input, dangerous as authority.";
  ch.breakdown.fullRead =
"Epistemocracy is the boring practical doctrine that authority should follow tested contact with the world. The chapter is not anti-expert. It is anti-fluency-without-accountability. The distinction matters because institutions keep treating the two as the same.\n\n" +
"Look at how the gap shows up. Ryan's panel hears a polished levee recommendation from a commentator with no skin in the outcome. Jack's investment committee hears a private-credit pitch from a consultant whose firm collects fees regardless of credit-cycle outcomes. Luke's logistics company keeps promoting strategy leads who propose bold warehouse redesigns and move to new roles before the redesign's results land. In each case the credential is real. What is missing is exposure to the failure case.\n\n" +
"The damage compounds because the unaccountable expert tends to be the most confident one. The careful expert who names limits loses to the one who picks a point. Decisions get made against the point. The careful expert's range goes unheard. The institution then keeps selecting for confident voices because confident voices win the room, and the failure case arrives somewhere downstream of the decision the confident voice influenced.\n\n" +
"The discipline is operational. Before granting a confident recommendation the weight it is asking for, name the speaker's exposure. Co-investment, fee-at-risk, on-call status, track record under prior recommendations — any of these convert prestige into earned authority. If none is present, the recommendation is one input among several, not a verdict. Exposure compresses bluff because the speaker must live with the error after the applause ends.";
}

// =========================================================
// Ch13 — expand thin deepRead and fullRead
// =========================================================
{
  const ch = book.chapters[12];
  ch.breakdown.deepRead =
"When prediction is weak, the position has to survive being wrong before it can seek upside. Robustness comes first; optionality is what the robust position preserves.\n\n" +
"Adrian's billing migration shows it cleanly. The vendor wants a $250K weekend cutover that delivers clean architecture but cannot be undone if anything breaks. Adrian's $40K parallel-run for the same eight weeks costs more in absolute terms and is uglier on the architecture diagram, but it keeps a rollback path alive. Juliette is offered an $800K convertible note that requires consuming her four-person studio in service of one big bet. Manon's medical-device startup wants a $150K minimum check before clinical data exists. Ingrid's sensor startup is offered a $480K tooling package that lowers unit cost — if demand exceeds a threshold the team has not yet seen.\n\n" +
"The shared pattern is asymmetry. The forecast is uncertain, so the structure has to absorb the uncertainty. Cap the first loss. Preserve the choice that lets the second move happen. Define the upside trigger that justifies more exposure. The position becomes a setup that can learn before it commits.";
  ch.breakdown.fullRead =
"When prediction cannot be relied on, the choice is between two postures. One arranges for the forecast to be right and falls apart when it is not. The other arranges to survive being wrong and stays in the game long enough for learning, upside, or a better forecast to arrive. The chapter teaches the second.\n\n" +
"Adrian's billing migration is the model case. A vendor recommends a $250K weekend cutover that produces clean architecture but no rollback path. The first technical surprise turns the project into a recovery operation. Adrian proposes a $40K parallel-run for eight weeks — uglier, slower, more expensive in nominal terms. What it buys is the ability to keep the old system running while the new one proves itself. The forecast about the cutover working can be wrong, and the project still survives.\n\n" +
"The same structure shows up elsewhere. Juliette's $800K convertible-note offer would consume her four-person studio for one client; the right counter is a smaller engagement that does not lock her in. Manon's medical-device opportunity wants a $150K minimum check before clinical data exists; a smaller initial commitment with a documented upside trigger preserves the option to scale once the data arrives. Ingrid's $480K tooling package only pays off above a demand threshold the team has not seen; the robust play is to wait for the demand signal before sizing the bet to it.\n\n" +
"The operational discipline is small. Cap the initial commitment at the level where being wrong leaves the project alive. Write the exit condition before the commitment is signed. Define the upside trigger that justifies the second, larger commitment. The setup becomes one that can learn, survive, or benefit when uncertainty shows up — instead of one that depends on the future arriving exactly as forecast.";
}

// =========================================================
// Ch18 — expand thin deepRead (162 → ~250)
// =========================================================
{
  const ch = book.chapters[17];
  ch.breakdown.deepRead =
"The phony is exposed at the moment specifics are required. A real expert produces a track record, a falsifier, and a calibration history. The phony pauses.\n\n" +
"Start with Pablo's market guest. The recession-odds figure is 37.4%, but the guest will not share holdout records, prior misses, or the conditions under which the call would be wrong. The decimal does the work of evidence; the evidence itself never arrives. Javier's transformation strategist arrives with a university logo, a proprietary maturity model, and an $18M ROI forecast for a company the strategist has never operated inside. Sofia's nutrition influencer cites two lab studies and sells a $499 protocol. Giulia's retail demand model was honest before same-day delivery changed customer behavior; the model still gets sold because the credential and the elegance survived the domain shift.\n\n" +
"In each case the structure is identical: weak visibility, dressed as measurement, defended by prestige. The first demand is procedural. Show the holdout cases. Show the misses. Show whether the method survives the domain now being priced. Strip the costume for a moment and ask what remains. Real expertise can name its limits and tests. The phony needs the costume because the evidence alone is too thin.";
}

// =========================================================
// Verify ML still verbatim across affected chapters
// =========================================================
[9, 10, 11, 12, 15, 17].forEach(ci => {
  const ch = book.chapters[ci];
  const prose = (ch.breakdown.fastRead||'')+'\n'+(ch.breakdown.deepRead||'')+'\n'+(ch.breakdown.fullRead||'');
  ch.memorableLines.forEach((ml, i) => {
    const t = typeof ml === 'string' ? ml : ml.text;
    if (!prose.includes(t)) console.log('  MISSING Ch'+(ci+1)+' ML'+(i+1)+': '+t);
  });
});

fs.writeFileSync(path, JSON.stringify(book, null, 2) + '\n');
console.log('S-tier pass 1 applied (Ch16 QC + 6 breakdown expansions).');
