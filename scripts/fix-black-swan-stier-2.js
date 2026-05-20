#!/usr/bin/env node
// S-tier pass 2: complete breakdown expansions for remaining thin chapters
const fs = require('fs');
const path = 'book-packages/the-black-swan.v21.json';
const book = JSON.parse(fs.readFileSync(path, 'utf-8'));

// =========================================================
// Ch16 — deepRead expansion (was not touched in pass 1)
// =========================================================
{
  const ch = book.chapters[15];
  ch.breakdown.deepRead =
"Start with the trader. A price chart built from random walks is filtered until a clean Fibonacci-like arc appears. The image feels meaningful because the eye likes proportion and return. The test is not whether the curve looks impressive; it is whether the rule was named before seeing the chart and whether it finds the same pattern in fresh prices.\n\n" +
"Now take the analyst who publishes a growth ladder showing seven companies climbing in elegant steps. The curve works because the companies were chosen after the fact and the revenue years were aligned to make the rise look orderly. The chart is beautiful, but the cases producing the line are not the same cases the claim pretends to describe. Frida runs the same trap in market commentary — six selected weeks, two reversal weeks deleted as 'holiday noise,' a recommended $2M allocation shift built on the polished version. Nina's charity infographic does it again at the donor level: the smooth delivery trend hides month-to-month volunteer cancellations swinging between 800 and 3,400 meals.\n\n" +
"The move is to pull the raw record back onto the table. Keep the dropped companies, show the unaligned years, run the rule out of sample, and ask whether the pattern survives before the attractive image gets decision authority. The discipline is not anti-design; it is anti-design-as-evidence.";
}

// =========================================================
// Ch12 — further expansion (deepRead and fullRead still thin)
// =========================================================
{
  const ch = book.chapters[11];
  ch.breakdown.deepRead =
"Authority becomes load-bearing in proportion to how much the speaker pays if they are wrong. The chapter pushes back on a culture that has stopped enforcing that ratio. Confident speech in a credentialed voice produces deference even when the speaker has no exposure to the failure case.\n\n" +
"Ryan's flood-risk panel hears a $48M levee recommendation from a commentator who is not a resident, not an insurer, and not a contractor. The advice is fluent and unconstrained. Jack's investment committee receives a private-credit recommendation from a consultant whose firm collects its fee regardless of how the credit cycle turns. Hugo's town council is offered a variable-rate municipal bond structure that lowers first-year payments by $380K but exposes the town to the next rate move — and the banker selling the structure is paid on the sale, not on the eventual interest cost. Camille is asked to evaluate a graduate-research direction recommended by a famous economist whose method has not been tested in Camille's actual lab.\n\n" +
"The shared shape is small and persistent. The credential travels; the consequence stays elsewhere. The discipline is to require the exposure to be named. If the answer is 'none structural,' the recommendation is fluency without accountability — useful as one input, dangerous as authority. The careful expert who names limits and trade-offs loses to the confident one who picks a point, so the institution keeps selecting confidence. The first move is to invert the selection: ask what the speaker pays if they are wrong before granting the recommendation any weight.";
  ch.breakdown.fullRead =
"Epistemocracy is the boring practical doctrine that authority should follow tested contact with the world. The chapter is not anti-expert. It is anti-fluency-without-accountability. The distinction matters because institutions keep treating the two as the same, and the cost of that confusion shows up in flooded towns, underwritten credit lines, and architectural plans that no one is on call to defend.\n\n" +
"Look at how the gap shows up. Ryan's panel hears a polished levee recommendation from a commentator with no skin in the outcome. Jack's investment committee hears a private-credit pitch from a consultant whose firm collects fees regardless of credit-cycle outcomes. Luke's logistics company keeps promoting strategy leads who propose bold warehouse redesigns and move to new roles before the redesign's results land. Lukas reviews a software architecture plan for a one-weekend billing migration — fastest possible cutover, no rollback, and the architect is scheduled to rotate off the team before the production data tells anyone whether the plan worked. In each case the credential is real. What is missing is exposure to the failure case.\n\n" +
"The damage compounds because the unaccountable expert tends to be the most confident one. The careful expert who names limits loses to the one who picks a point. Decisions get made against the point. The careful expert's range goes unheard. The institution then keeps selecting for confident voices because confident voices win the room, and the failure case arrives somewhere downstream of the decision the confident voice influenced. The compounding is structural, not personal.\n\n" +
"The discipline is operational. Before granting a confident recommendation the weight it is asking for, name the speaker's exposure. Co-investment, fee-at-risk, on-call status, a track record under prior recommendations — any of these convert prestige into earned authority. If none is present, the recommendation is one input among several, not a verdict. Exposure compresses bluff because the speaker must live with the error after the applause ends.";
}

// =========================================================
// Ch13 — further expansion (deepRead and fullRead still thin)
// =========================================================
{
  const ch = book.chapters[12];
  ch.breakdown.deepRead =
"When prediction is weak, the position has to survive being wrong before it can seek upside. Robustness comes first; optionality is what the robust position preserves. The chapter teaches a second-order discipline: design the structure so the future does not need to arrive exactly as forecast.\n\n" +
"Adrian's billing migration shows it cleanly. The vendor wants a $250K weekend cutover that delivers clean architecture but cannot be undone if anything breaks. Adrian's $40K parallel-run for the same eight weeks costs more in absolute terms and is uglier on the architecture diagram, but it keeps a rollback path alive. Juliette is offered an $800K convertible note that requires consuming her four-person studio in service of one big bet — the note would be transformative if the bet works and ruinous if it does not. Manon's medical-device startup wants a $150K minimum check before clinical data exists. Chloe is choosing between a two-year design degree with a $32K loan and a paid apprenticeship; the loan converts a reversible career move into a multi-year commitment. Ingrid's sensor startup is offered a $480K tooling package that lowers unit cost — but only if demand exceeds a threshold the team has not yet seen.\n\n" +
"The shared pattern is asymmetry. The forecast is uncertain, so the structure has to absorb the uncertainty. Cap the first loss. Preserve the choice that lets the second move happen. Define the upside trigger that justifies more exposure. The position becomes a setup that can learn before it commits.";
  ch.breakdown.fullRead =
"When prediction cannot be relied on, the choice is between two postures. One arranges for the forecast to be right and falls apart when it is not. The other arranges to survive being wrong and stays in the game long enough for learning, upside, or a better forecast to arrive. The chapter teaches the second posture and treats the first as the structural failure that produces most preventable ruin.\n\n" +
"Adrian's billing migration is the model case. A vendor recommends a $250K weekend cutover that produces clean architecture but no rollback path. The first technical surprise turns the project into a recovery operation. Adrian proposes a $40K parallel-run for eight weeks — uglier, slower, more expensive in nominal terms. What it buys is the ability to keep the old system running while the new one proves itself. The forecast about the cutover working can be wrong, and the project still survives.\n\n" +
"The same structure shows up across the chapter. Juliette's $800K convertible-note offer would consume her four-person studio for one client; the right counter is a smaller engagement that does not lock her in and a written exit condition before the commitment is signed. Manon's medical-device opportunity wants a $150K minimum check before clinical data exists; a smaller initial commitment with a documented upside trigger preserves the option to scale once the data arrives. Chloe's career decision is the same shape at the household scale — the paid apprenticeship preserves the ability to redirect if the field is wrong, while the two-year loan converts a reversible move into a multi-year commitment that has to be right. Ingrid's $480K tooling package only pays off above a demand threshold the team has not seen; the robust play is to wait for the demand signal before sizing the bet to it. Martin's nonprofit clinic faces the same question with a $310K-per-year program: a single-attorney pilot tests the demand before the three-attorney version locks in payroll.\n\n" +
"The operational discipline is small. Cap the initial commitment at the level where being wrong leaves the project alive. Write the exit condition before the commitment is signed. Define the upside trigger that justifies the second, larger commitment. The setup becomes one that can learn, survive, or benefit when uncertainty shows up — instead of one that depends on the future arriving exactly as forecast.";
}

// =========================================================
// Ch1 — expand deepRead from 197 to 250+
// =========================================================
{
  const ch = book.chapters[0];
  // Current deepRead is 197 words. Append a paragraph with example anchors.
  const current = ch.breakdown.deepRead;
  if (!current.includes('Emily underwrites')) {
    ch.breakdown.deepRead = current.trim() + "\n\nLook at how the gap shows up across the chapter. Emily underwrites wind coverage for a 42-unit coastal condo building whose 27 quiet months have not included a hurricane season at the new sea-surface temperatures. Hannah's cloud team reports 99.98% uptime across 180 days that did not include a regional power event. Megan's 1978 municipal bridge passes three inspection cycles with no lane closures and no recent stress test. In each case the calm is real, and in each case the calm is silent about the conditions the system has not yet met. The discipline is to mark that boundary in the same memo that reports the calm.";
  }
}

// =========================================================
// Ch11 — expand deepRead from 198 to ~250
// =========================================================
{
  const ch = book.chapters[10];
  const current = ch.breakdown.deepRead;
  if (!current.includes('Etienne')) {
    ch.breakdown.deepRead = current.trim() + "\n\nEtienne's career move runs the same shape: a bootcamp brochure projects $92K post-graduation without his ever having watched a UX-research session run by a current practitioner. Matthew has been told a career-coach narrative around 'a single transformative analysis' — but no actual analyses have been attempted. In each case, a small probe — sit in on one session, run one analysis — would produce information no narrative can provide.";
  }
}

// =========================================================
// Ch17 — expand fullRead from 319 to 360+
// =========================================================
{
  const ch = book.chapters[16];
  const current = ch.breakdown.fullRead;
  if (!current.includes('Pavel reviews an insurance wellness score')) {
    ch.breakdown.fullRead = current.trim() + "\n\nThe pattern keeps repeating across domains. Pavel reviews an insurance wellness score calibrated on office employees and now applied to a factory workforce. The mathematics is unchanged; the meaning of 'missed step count' is not. Marit evaluates a protest-risk model trained on stable cities and now being applied to one whose transit system has just collapsed. In each case the formal tool would not pass a domain-fit check, but the polish suggests it already has.";
  }
}

// =========================================================
// Ch19 — expand deepRead from 192 to ~250
// =========================================================
{
  const ch = book.chapters[18];
  const current = ch.breakdown.deepRead;
  if (!current.includes("Nina's household")) {
    ch.breakdown.deepRead = current.trim() + "\n\nNina's household scenario closes the pattern. One income, two children, a $14K house repair estimate — and a friend offering entry into a rental-property syndicate. The structure that respects the household is not maximum allocation to the syndicate, nor refusal of any exposure. It is the barbell: the repair money stays liquid, only the surplus reaches the syndicate, and the middle position that could touch the repair fund is refused.";
  }
}

// =========================================================
// Verify ML still verbatim
// =========================================================
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
console.log('S-tier pass 2 applied.');
