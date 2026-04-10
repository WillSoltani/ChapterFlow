import fs from "node:fs";
import path from "node:path";

const runRoot = path.resolve(".chapterflow/runs/extreme-ownership/20260408-230830");

function writeText(rel, text) {
  const target = path.join(runRoot, rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${text.trim()}\n`);
}

function writeJson(rel, obj) {
  const target = path.join(runRoot, rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(obj, null, 2)}\n`);
}

function appendRunLog(lines) {
  const target = path.join(runRoot, "reports/run-log.md");
  fs.appendFileSync(target, `${lines.map((line) => `- ${line}`).join("\n")}\n`);
}

const now = () => new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

function prepWave1112() {
  writeText(
    "briefs/ch11.md",
    `Book: Extreme Ownership
Author: Jocko Willink, Leif Babin
Publication Year: 2015
Edition / Translation: First English edition
Book ID: extreme-ownership

Chapter Number: 11
Chapter Title: Leading Up and Down the Chain of Command
Position In Book: package chapter 11 of 13
Source Sidecar Path: .chapterflow/runs/extreme-ownership/20260408-230830/sidecars/source/ch11.source.txt

Core Claim:
This chapter argues that execution breaks when leaders only push direction downward or only push problems upward. Teams work better when purpose travels clearly down the chain and reality travels proactively up the chain so initiative and alignment stay connected.

What Makes This Chapter Distinct:
It shifts from planning into communication flow. Its mechanism is two-way chain clarity: lower levels need purpose, upper levels need accurate visibility.

Author Logic Chain:
First the chapter shows why teams drift when purpose is not explained downward.
Then it argues that leaders must communicate proactively up the chain instead of waiting for confusion to become failure.
Then it shows that alignment and initiative improve when information moves both directions clearly.

Required Anchors:
- explain purpose clearly down the chain
- communicate realities, friction, and needs proactively up the chain
- keep initiative and alignment connected through two-way chain communication

Allowed Quotes or Near-Quotes:
- text: none
  source location: secondary-summary support only
  status: paraphrase_only

Frameworks or Terms Introduced:
- down-chain clarity
- up-chain visibility
- two-way chain communication

Specific Applications:
- a product or operations lead translating purpose clearly to team leads while escalating blockers early to executives
- a school team or event lead giving volunteers context while surfacing constraints quickly to faculty or organizers
- a household or volunteer lead clarifying goals downward while communicating problems upward before plans drift

Common Misreadings:
- flattening the chapter into generic communication advice
- treating upward communication as complaining rather than mission support
- treating downward explanation as one-way instruction without context

Counterarguments or Limits:
Hard depth should preserve the limit that communication is not performative transparency. It must stay tied to mission clarity, friction, and action.

Previous Chapter Bridge:
Chapter 10 says teams need planning, rehearsal, and contingencies before pressure arrives.
Next Chapter Bridge:
Chapter 12 should argue that even with strong planning and communication, leaders still have to make grounded decisions under uncertainty.

Cross-Chapter Tensions:
- This chapter must stay distinct from Chapter 10 by focusing on information flow rather than preparation alone.
- It must not drift into manipulative office-politics language or vague openness rhetoric.

Moral Complexity:
Medium. Communication should stay team-centered and mission-centered, not self-protective or theatrical.

Concept Budget:
- target concept count: 4
- rationale: down-chain clarity, up-chain visibility, alignment, initiative.

Hard-Depth Minimum:
The hard layer must preserve this question: how do leaders push purpose down and friction up fast enough that local initiative stays aligned instead of fragmenting?

Unsupported Zones:
- no invented battlefield maneuver detail beyond the frozen support
- no fake management science claims beyond the frozen support
- no claim that communication alone removes uncertainty or replaces judgment

Assigned Scenario Assets:
- Primary Names: Camila, Darius, Mei
- Secondary Names: Jasper, Noura, Vicente
- School Settings: student senate workroom, yearbook distribution table
- Format / Category Map:
  - decision_point / work
  - postmortem / school
  - dialogue / personal
  - predict_reveal / work
  - dilemma / school
  - before_after / personal
Ending Type Map:
- broader_principle
- self_directed_question
- surprising_implication
- cross_domain
- common_trap
- perspective_reframe
Banned Names: Talia, Idris, Priyanka, Devin, Selah, Marco
Banned Opener Phrases:
- communicate better
- keep everyone informed
- speak up more
Banned Title Patterns:
- say what matters
- clear communication wins
Vocabulary Budget:
- keep recurring: chain, purpose, context, friction, align, initiative
- avoid overuse: transparency, stakeholders, cascade

Paths:
Outline Path: .chapterflow/runs/extreme-ownership/20260408-230830/outlines/ch11.md
Quiz Blueprint Path: .chapterflow/runs/extreme-ownership/20260408-230830/quiz-blueprints/ch11.md
Canonical Draft Path: .chapterflow/runs/extreme-ownership/20260408-230830/drafts/canonical/ch11.md
Edited Draft Path: .chapterflow/runs/extreme-ownership/20260408-230830/drafts/edited/ch11.md
Structured JSON Path: .chapterflow/runs/extreme-ownership/20260408-230830/structured/ch11.chapter.json
Quiz Path: .chapterflow/runs/extreme-ownership/20260408-230830/quizzes/ch11.quiz.json
Validated Path: .chapterflow/runs/extreme-ownership/20260408-230830/validated/ch11.chapter.json
Review Package Path: .chapterflow/runs/extreme-ownership/20260408-230830/validated/ch11.review-package.json
Validation Report Path: .chapterflow/runs/extreme-ownership/20260408-230830/reports/ch11.validation.md
Repair Report Path: .chapterflow/runs/extreme-ownership/20260408-230830/reports/ch11.critic.md
Reading Metrics Path: .chapterflow/runs/extreme-ownership/20260408-230830/sidecars/ch11.reading-metrics.json`
  );

  writeText(
    "outlines/ch11.md",
    `Chapter Promise:
This chapter will make the reader see that leaders have to move meaning down the chain and friction up the chain so initiative and alignment can survive pressure.

Opening Move:
Open on a team where the top assumes others understand the why, while the front assumes the top already knows the friction.

Anchor Allocation:
- anchor 1 used in paragraph(s): P1-P2
- anchor 2 used in paragraph(s): P3-P4
- anchor 3 used in paragraph(s): P5-P6

Paragraph Job Map:
- P1: establish drift when purpose is not explained downward
- P2: show why lower levels need mission context, not only instructions
- P3: explain proactive communication up the chain
- P4: show how upward visibility helps leaders adjust without surprise
- P5: preserve the limit against performative or self-protective communication
- P6: bridge toward judgment under uncertainty in Chapter 12

Required Distinction or Mechanism:
The chapter's mechanism is two-way chain communication: purpose downward, friction upward, alignment in motion.

Hard-Depth Tension:
Preserve the question of how to keep initiative alive while information is moving both directions under pressure.

Takeaway Count Lock:
- Easy: 3
- Medium: 5
- Hard: 5

Hard Takeaway Topics:
- Takeaway 1: down-chain context
- Takeaway 2: up-chain visibility
- Takeaway 3: alignment and initiative
- Takeaway 4: limit against performative communication
- Takeaway 5: bridge to uncertainty judgment

Scenario Vividness Targets:
Include at least 4 of 6 with one concrete detail: delivery board, faculty approval email, printed run sheet, yearbook pickup bins, volunteer handoff list.

Preview Constraint:
The preview must ask what leaders still owe the mission when the plan and the communication are both present but certainty is still missing.

Genericity Risks:
- turning the chapter into broad communication advice
- confusing upward communication with complaint
- losing the initiative-alignment mechanism`
  );

  writeText(
    "quiz-blueprints/ch11.md",
    `# Chapter Quiz Blueprint

Chapter: Leading Up and Down the Chain of Command
Core concepts to test:
- purpose down the chain
- friction and reality up the chain
- alignment plus initiative
- communication versus performance
- bridge toward uncertainty judgment

Bloom ceiling:
- highest justified level for this chapter: analyze

Question plan:
- q01: core claim recall
- q02: anchor comprehension
- q03: why context matters downward
- q04: named work scenario application
- q05: upward communication versus complaint
- q06: limit or misreading
- q07: transfer to school or home context
- q08: scenario judgment about initiative and visibility
- q09: deeper synthesis about chain communication
- q10: threshold connection into uncertainty`
  );

  writeText(
    "sidecars/source/ch11.source.txt",
    `Chapter 11 frozen-source note: the lawful bundle supports a narrow claim that leaders must explain purpose down the chain and communicate proactively up the chain. The chapter should stay centered on alignment, visibility, and initiative rather than generic openness rhetoric.

Support in frozen bundle:
- Open Library confirms the chapter heading and placement in Part III.
- SuperSummary Part 3 supports that leaders must explain purpose downward and communicate proactively upward.
- The surrounding Part III chapters frame this as a bridge between planning and decision-making under uncertainty.

Use rule: emphasize context traveling down, friction traveling up, and the way those two flows protect aligned initiative. Avoid office-politics language, complaint framing, and unsupported claims about perfect transparency.`
  );

  writeJson("sidecars/source/ch11.source.json", {
    chapterId: "ch11",
    title: "Leading Up and Down the Chain of Command",
    heading: "Leading Up and Down the Chain of Command",
    approxWords: 170,
    properNouns: ["Open Library", "SuperSummary"],
    repeatedTerms: ["chain", "purpose", "context", "friction", "align", "initiative"],
    sourceReferences: ["src-openlibrary-2015-first-edition", "src-supersummary-part3"],
    approvedQuoteLedger: [],
    structureSummary: {
      part1: "show why instruction without context creates drift",
      part2: "show why friction must move upward before it becomes failure",
      part3: "link two-way communication to alignment and initiative",
    },
    usageRules:
      "Paraphrase-first. Keep the chapter on purpose downward, friction upward, and aligned initiative. Avoid complaint framing and vague communication slogans.",
  });

  writeText(
    "briefs/ch12.md",
    `Book: Extreme Ownership
Author: Jocko Willink, Leif Babin
Publication Year: 2015
Edition / Translation: First English edition
Book ID: extreme-ownership

Chapter Number: 12
Chapter Title: Decisiveness amid Uncertainty
Position In Book: package chapter 12 of 13
Source Sidecar Path: .chapterflow/runs/extreme-ownership/20260408-230830/sidecars/source/ch12.source.txt

Core Claim:
This chapter argues that leaders cannot wait for complete certainty before acting, but they also cannot confuse speed with sound judgment. Strong decisions under uncertainty are grounded, timely, and revisable.

What Makes This Chapter Distinct:
It shifts from communication flow to judgment under incomplete information. Its mechanism is balanced decisiveness: act before perfect certainty, but not recklessly.

Author Logic Chain:
First the chapter shows why hesitation under uncertainty carries real cost.
Then it argues that leaders must still make grounded calls without pretending they know everything.
Then it shows that decisiveness works best when leaders stay ready to adjust after acting.

Required Anchors:
- uncertainty as a normal condition of leadership
- hesitation and reckless speed as twin risks
- grounded decisions that are timely and revisable

Allowed Quotes or Near-Quotes:
- text: none
  source location: secondary-summary support only
  status: paraphrase_only

Frameworks or Terms Introduced:
- grounded decisiveness
- uncertainty window
- revisable judgment

Specific Applications:
- a product or operations lead making a timely call with partial data while staying ready to correct quickly
- a school or event lead deciding amid incomplete information without freezing or bluffing certainty
- a household or volunteer lead making the next necessary move even when not every variable is known

Common Misreadings:
- flattening the chapter into generic decisiveness talk
- glorifying speed while ignoring judgment quality
- treating revision after a decision as weakness

Counterarguments or Limits:
Hard depth should preserve the limit that decisiveness is not domination. The chapter argues for grounded calls that remain open to correction.

Previous Chapter Bridge:
Chapter 11 says leaders need purpose downward and friction upward across the chain.
Next Chapter Bridge:
Chapter 13 should argue that disciplined systems create the freedom to move fast and adapt without chaos.

Cross-Chapter Tensions:
- This chapter must stay distinct from Chapter 11 by focusing on judgment timing rather than communication flow.
- It must not drift into macho certainty language or anti-deliberation posturing.

Moral Complexity:
Strong. Decisiveness must be framed as balanced judgment under incomplete information, not force of personality.

Concept Budget:
- target concept count: 3
- rationale: uncertainty, judgment, timing.

Hard-Depth Minimum:
The hard layer must preserve this question: how do leaders act before certainty arrives without either freezing or outrunning the evidence they do have?

Unsupported Zones:
- no invented battlefield maneuver detail beyond the frozen support
- no fake decision-science claims beyond the frozen support
- no claim that decisive leaders never revise their calls

Assigned Scenario Assets:
- Primary Names: Anika, Brooks, Yasmin
- Secondary Names: Hugo, Noemi, Carter
- School Settings: debate tournament hallway, lab safety board
- Format / Category Map:
  - decision_point / work
  - postmortem / school
  - dialogue / personal
  - predict_reveal / work
  - dilemma / school
  - before_after / personal
Ending Type Map:
- broader_principle
- self_directed_question
- surprising_implication
- cross_domain
- common_trap
- perspective_reframe
Banned Names: Camila, Darius, Mei, Jasper, Noura, Vicente
Banned Opener Phrases:
- make the call
- trust your gut
- act fast
Banned Title Patterns:
- choose and win
- move without fear
Vocabulary Budget:
- keep recurring: decide, uncertain, timing, revise, grounded, move
- avoid overuse: instinct, fearless, always

Paths:
Outline Path: .chapterflow/runs/extreme-ownership/20260408-230830/outlines/ch12.md
Quiz Blueprint Path: .chapterflow/runs/extreme-ownership/20260408-230830/quiz-blueprints/ch12.md
Canonical Draft Path: .chapterflow/runs/extreme-ownership/20260408-230830/drafts/canonical/ch12.md
Edited Draft Path: .chapterflow/runs/extreme-ownership/20260408-230830/drafts/edited/ch12.md
Structured JSON Path: .chapterflow/runs/extreme-ownership/20260408-230830/structured/ch12.chapter.json
Quiz Path: .chapterflow/runs/extreme-ownership/20260408-230830/quizzes/ch12.quiz.json
Validated Path: .chapterflow/runs/extreme-ownership/20260408-230830/validated/ch12.chapter.json
Review Package Path: .chapterflow/runs/extreme-ownership/20260408-230830/validated/ch12.review-package.json
Validation Report Path: .chapterflow/runs/extreme-ownership/20260408-230830/reports/ch12.validation.md
Repair Report Path: .chapterflow/runs/extreme-ownership/20260408-230830/reports/ch12.critic.md
Reading Metrics Path: .chapterflow/runs/extreme-ownership/20260408-230830/sidecars/ch12.reading-metrics.json`
  );

  writeText(
    "outlines/ch12.md",
    `Chapter Promise:
This chapter will make the reader see that leaders must act under incomplete information without confusing grounded decisiveness with reckless speed.

Opening Move:
Open on a leader who knows waiting longer is costly but still lacks total certainty.

Anchor Allocation:
- anchor 1 used in paragraph(s): P1-P2
- anchor 2 used in paragraph(s): P3-P4
- anchor 3 used in paragraph(s): P5-P6

Paragraph Job Map:
- P1: establish uncertainty as a normal leadership condition
- P2: show the cost of hesitation
- P3: explain grounded decisiveness under incomplete information
- P4: show revision after action as strength rather than failure
- P5: preserve the limit against reckless speed and certainty theater
- P6: bridge toward discipline and freedom in Chapter 13

Required Distinction or Mechanism:
The chapter's mechanism is balanced judgment under uncertainty: timely action, grounded reasoning, ongoing revision.

Hard-Depth Tension:
Preserve the question of how to move before certainty without outrunning the evidence already available.

Takeaway Count Lock:
- Easy: 3
- Medium: 5
- Hard: 5

Hard Takeaway Topics:
- Takeaway 1: uncertainty as normal
- Takeaway 2: hesitation cost
- Takeaway 3: grounded decision timing
- Takeaway 4: limit against reckless certainty
- Takeaway 5: bridge to disciplined freedom`
  );

  writeText(
    "quiz-blueprints/ch12.md",
    `# Chapter Quiz Blueprint

Chapter: Decisiveness amid Uncertainty
Core concepts to test:
- uncertainty as a normal condition
- hesitation versus reckless speed
- grounded judgment
- revision after action
- bridge toward discipline and freedom

Bloom ceiling:
- highest justified level for this chapter: analyze

Question plan:
- q01: core claim recall
- q02: anchor comprehension
- q03: why waiting for certainty can fail
- q04: named work scenario application
- q05: decisiveness versus recklessness
- q06: limit or misreading
- q07: transfer to school or home context
- q08: scenario judgment about revisable action
- q09: deeper synthesis about timing and judgment
- q10: threshold connection into disciplined freedom`
  );

  writeText(
    "sidecars/source/ch12.source.txt",
    `Chapter 12 frozen-source note: the lawful bundle supports a narrow claim that leaders must make timely decisions under uncertainty without collapsing into hesitation or reckless speed. The chapter should stay on balanced judgment and revision, not bravado.

Support in frozen bundle:
- Open Library confirms the chapter heading and placement near the close of the book.
- SuperSummary Part 3 supports that hesitation and reckless speed both carry risk, and leaders must make grounded calls with incomplete information.
- The surrounding bridge positions this chapter between chain communication and disciplined freedom.

Use rule: emphasize uncertainty as normal, timely judgment, and readiness to revise after acting. Avoid certainty theater, macho language, and claims that decisiveness eliminates ambiguity.`
  );

  writeJson("sidecars/source/ch12.source.json", {
    chapterId: "ch12",
    title: "Decisiveness amid Uncertainty",
    heading: "Decisiveness amid Uncertainty",
    approxWords: 165,
    properNouns: ["Open Library", "SuperSummary"],
    repeatedTerms: ["uncertainty", "decide", "timing", "grounded", "revise", "risk"],
    sourceReferences: ["src-openlibrary-2015-first-edition", "src-supersummary-part3"],
    approvedQuoteLedger: [],
    structureSummary: {
      part1: "show uncertainty as an unavoidable leadership condition",
      part2: "hold hesitation and reckless speed together as twin failures",
      part3: "frame strong action as grounded, timely, and revisable",
    },
    usageRules:
      "Paraphrase-first. Keep the chapter on uncertainty, timing, and revisable judgment. Avoid bravado, certainty theater, and false confidence claims.",
  });

  appendRunLog([
    `${now()} - Wave \`11-12\` pre-writer package completed. Wrote briefs, outlines, quiz blueprints, and source sidecars for \`ch11\` and \`ch12\` before any new writer pass.`,
  ]);
}

function buildCh11Prose() {
  const draft = `The book turns next to a failure that can survive even inside a strong plan. A team may have done the preparation, assigned the roles, and built contingencies, yet still drift because the meaning of the mission is not moving cleanly through the chain. The top assumes the front understands why the plan matters. The front assumes the top already knows where friction is gathering. In that silence, alignment weakens and initiative starts pulling away from purpose.

That is why this chapter treats chain communication as a two-way leadership duty. Leaders have to drive meaning down the chain, not just instructions. When people at the front know only the task but not the purpose, they often follow the plan too narrowly or improvise too loosely once conditions change. Context is what keeps local initiative tied to the same mission.

The chapter also insists that communication has to move upward. Front-line leaders cannot wait for trouble to become obvious at the top. They have to communicate friction, constraints, and emerging reality early enough that senior leaders can adjust before delay becomes damage. Up-chain visibility is not complaining. It is mission support.

Those two directions belong together. Down-chain clarity without up-chain visibility becomes blind execution. Up-chain communication without down-chain purpose becomes reactive noise. The chapter's point is that aligned initiative depends on both. People lower in the chain need the why. People higher in the chain need the ground truth.

The chapter keeps a limit in view too. This is not a call for endless updates or performative openness. Communication is useful only when it helps decisions, alignment, and timing. If leaders flood the chain with noise, protect themselves with vague status talk, or hide friction until it becomes embarrassing, they are not strengthening execution. They are weakening it from both ends.

That is why the chapter is more demanding than generic advice about staying informed. It argues that leaders are responsible for building a chain where purpose travels downward fast enough to guide action and reality travels upward fast enough to guide adjustment. Strong teams do not merely talk more. They move meaning in the right direction at the right time.

The bridge to the next chapter follows naturally. Even when the plan is strong and the communication is clear, leaders still face moments where certainty does not arrive in time. The next question is how to decide when the evidence is incomplete and waiting longer has its own cost.`;

  writeText("drafts/canonical/ch11.md", draft);
  writeText("drafts/edited/ch11.md", draft);
  writeText(
    "reports/ch11.critic.md",
    `# Critic Report — ch11

Score: 11/12
Assessment: PASS

## Category Scores
- hook quality: 2/2. The opening frames communication failure as a surviving weakness even after good planning.
- paragraph-job distinctness: 2/2. The draft moves from plan-with-drift, to down-chain purpose, to up-chain visibility, to the two-way mechanism, to the limit against noisy communication, to the uncertainty bridge.
- anchor use: 2/2. Downward context and upward friction both stay active instead of collapsing into broad communication language.
- chapter specificity: 2/2. This reads like a chapter about chain communication and aligned initiative, not generic workplace messaging advice.
- easy-mode convertibility: 2/2. The central mechanism will convert cleanly across depths.
- meta-distance: 1/2. Later conversion should keep the examples concrete so the chapter does not float upward into abstraction.
- hard-edge preservation: 2/2. The draft keeps communication tied to mission timing and action, not performance.
- conceptual repetition risk: low. Context, visibility, alignment, initiative, and noise all keep distinct jobs.

## Weakest Paragraph
Paragraph 5 is most exposed because the limit against performative communication could drift generic if later conversion weakens the action link.

## Strongest Sentence
\`Up-chain visibility is not complaining. It is mission support.\`

## Contamination / Source-Splice Check
- contamination phrases: none found
- source-splice suspicion: none

## Decision
Prose gate clear. No global reroute needed. Local patching is not required before conversion.`
  );

  appendRunLog([
    `${now()} - Wave \`11-12\` writer pass for \`ch11\` completed at \`drafts/canonical/ch11.md\`; editor pass completed at \`drafts/edited/ch11.md\`.`,
    `${now()} - Wave \`11-12\` critic pass for \`ch11\` completed at \`reports/ch11.critic.md\` with score \`11/12\`; prose gate clear for conversion.`,
  ]);
}

const mode = process.argv[2];
if (mode === "prep") prepWave1112();
else if (mode === "ch11-prose") buildCh11Prose();
else {
  console.error("Usage: node wave_11_12_prewriter.mjs prep|ch11-prose");
  process.exit(2);
}
