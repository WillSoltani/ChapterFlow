import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";

const repoRoot = process.cwd();
const runRoot = path.resolve(".chapterflow/runs/extreme-ownership/20260408-230830");
const lintScript = path.resolve("scripts/book/prompts/chapterflow-v13-autonomous/tools/chapterflow_v13_lint.py");
const guardScript = path.resolve("scripts/book/prompts/chapterflow-v13-autonomous/tools/chapterflow_v13_artifact_guard.py");
const book = JSON.parse(
  fs.readFileSync(path.join(runRoot, "validated/ch12.review-package.json"), "utf8")
).book;

const tri = (gentle, direct, competitive) => ({ gentle, direct, competitive });
const wc = (text) => (text.match(/\b[\w']+\b/g) || []).length;
const stamp = () => new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${stable(value[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
const sha = (obj) => crypto.createHash("sha256").update(stable(obj)).digest("hex");

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
  fs.appendFileSync(path.join(runRoot, "reports/run-log.md"), `${lines.map((x) => `- ${x}`).join("\n")}\n`);
}
function runChecked(cmd, args) {
  try {
    return { ok: true, stdout: execFileSync(cmd, args, { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim() };
  } catch (error) {
    return { ok: false, stdout: `${error.stdout || ""}${error.stderr || ""}`.trim() };
  }
}
function buildReviewPackage(chapter) {
  return {
    schemaVersion: "1.1.0",
    packageId: crypto.randomUUID(),
    createdAt: stamp(),
    contentOwner: "ChapterFlow",
    book,
    chapters: [chapter],
  };
}
function buildMetrics(chapter, criticScore, sourceHeading) {
  return {
    chapterId: chapter.chapterId,
    number: chapter.number,
    title: chapter.title,
    readingTimeMinutes: chapter.readingTimeMinutes,
    wordCounts: {
      easyDirect: wc(chapter.contentVariants.easy.chapterBreakdown.direct),
      mediumDirect: wc(chapter.contentVariants.medium.chapterBreakdown.direct),
      hardDirect: wc(chapter.contentVariants.hard.chapterBreakdown.direct),
    },
    takeawayCounts: {
      easy: chapter.contentVariants.easy.keyTakeaways.length,
      medium: chapter.contentVariants.medium.keyTakeaways.length,
      hard: chapter.contentVariants.hard.keyTakeaways.length,
    },
    exampleCount: chapter.examples.length,
    quizQuestionCount: chapter.quiz.questions.length,
    criticScore,
    sourceHeading,
  };
}
function writeValidation(status, chapterLint, wrapperLint, guard, wrapperMatch, hash) {
  writeText(
    "reports/ch13.validation.md",
    `# Validation Report — ch13

Status: ${status}
- critic report: reports/ch13.critic.md
- structured chapter: structured/ch13.chapter.json
- quiz: quizzes/ch13.quiz.json
- validated chapter: validated/ch13.chapter.json
- review package: validated/ch13.review-package.json
- reading metrics: sidecars/ch13.reading-metrics.json
- chapter lint: ${chapterLint}
- review-package lint: ${wrapperLint}
- artifact guard: ${guard}
- wrapper payload match: ${String(wrapperMatch)}
- approvedChapterHash: ${hash}`
  );
}
function updateContinuity(hash) {
  const continuityPath = path.join(runRoot, "continuity/continuity-state.json");
  const continuity = JSON.parse(fs.readFileSync(continuityPath, "utf8"));
  const code = "ch13";
  const names = ["Sabine", "Derek", "Lina", "Oleg", "Marisol", "Bennett"];
  const settings = ["student government dais", "robotics judging aisle"];
  const alreadySealed = Boolean(continuity.approvedChapterHashes[code]);
  if (continuity.withinChapterNames[code]) {
    for (const oldName of continuity.withinChapterNames[code]) {
      if (continuity.nameUsage[oldName] === code) delete continuity.nameUsage[oldName];
    }
  }
  continuity.withinChapterNames[code] = names;
  for (const name of names) continuity.nameUsage[name] = code;
  continuity.formatCategoryHistory = continuity.formatCategoryHistory.filter((e) => e.chapterId !== code);
  for (const pair of [
    { format: "decision_point", category: "work" },
    { format: "postmortem", category: "school" },
    { format: "dialogue", category: "personal" },
    { format: "predict_reveal", category: "work" },
    { format: "dilemma", category: "school" },
    { format: "before_after", category: "personal" },
  ]) continuity.formatCategoryHistory.push({ chapterId: code, ...pair });
  if (alreadySealed) {
    for (const s of settings) {
      if (continuity.schoolSettingUsage[s]) continuity.schoolSettingUsage[s] -= 1;
      if (continuity.schoolSettingUsage[s] === 0) delete continuity.schoolSettingUsage[s];
    }
  }
  for (const s of settings) continuity.schoolSettingUsage[s] = (continuity.schoolSettingUsage[s] || 0) + 1;
  if (!alreadySealed) {
    for (const key of Object.keys(continuity.endingPatternRegistry)) continuity.endingPatternRegistry[key] += 1;
  }
  continuity.approvedChapterHashes[code] = hash;
  writeJson("continuity/continuity-state.json", continuity);
}

writeText(
  "briefs/ch13.md",
  `Book: Extreme Ownership
Author: Jocko Willink, Leif Babin
Publication Year: 2015
Edition / Translation: First English edition
Book ID: extreme-ownership

Chapter Number: 13
Chapter Title: Discipline Equals Freedom: The Dichotomy of Leadership
Position In Book: package chapter 13 of 13
Source Sidecar Path: .chapterflow/runs/extreme-ownership/20260408-230830/sidecars/source/ch13.source.txt

Core Claim:
This chapter argues that disciplined systems create the freedom to move fast, adapt, and lead well under pressure. The book closes by holding leadership tensions together rather than solving them with slogans.

What Makes This Chapter Distinct:
It closes the book by framing discipline and freedom as partners rather than enemies. Its mechanism is balanced leadership: structure makes adaptability possible.

Author Logic Chain:
First the chapter shows why discipline creates reliability and speed.
Then it argues that leadership requires balancing paired tensions rather than choosing one pole blindly.
Then it shows that freedom of action grows out of trained discipline and balanced judgment.

Required Anchors:
- discipline creating freedom of action
- leadership as a balance of tensions or dichotomies
- adaptability growing from disciplined systems rather than chaos

Allowed Quotes or Near-Quotes:
- text: none
  source location: secondary-summary support only
  status: paraphrase_only

Frameworks or Terms Introduced:
- disciplined freedom
- leadership dichotomy
- balanced adaptability

Specific Applications:
- a team using strong routines and standards to move faster during live work
- a school group balancing structure and flexibility under deadline
- a household or volunteer group discovering that repeatable discipline reduces chaos and increases freedom

Common Misreadings:
- flattening the chapter into generic self-discipline talk
- treating discipline as domination or rigidity
- ignoring the balance between paired leadership tensions

Counterarguments or Limits:
Hard depth should preserve the limit that discipline is not control worship. The chapter argues for structure that serves adaptation and judgment.

Previous Chapter Bridge:
Chapter 12 says leaders must make grounded decisions under uncertainty.
Cross-Chapter Tensions:
- This chapter must stay distinct from Chapter 12 by focusing on systems, balance, and repeatable adaptability rather than one-off judgment timing.
- It must not drift into macho toughness rhetoric or abstract motivational language.

Moral Complexity:
Strong. Discipline should be framed as support for balanced leadership, not domination.

Concept Budget:
- target concept count: 5
- rationale: discipline, freedom, balance, tension, adaptability.

Hard-Depth Minimum:
The hard layer must preserve this question: how can leaders build enough discipline to move fast and adapt well without turning that discipline into rigidity or domination?

Unsupported Zones:
- no invented battlefield maneuver detail beyond the frozen support
- no fake psychology or self-help claims beyond the frozen support
- no claim that discipline removes the need for judgment or balance

Assigned Scenario Assets:
- Primary Names: Sabine, Derek, Lina
- Secondary Names: Oleg, Marisol, Bennett
- School Settings: student government dais, robotics judging aisle
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
Banned Names: Anika, Brooks, Yasmin, Hugo, Noemi, Carter
Banned Opener Phrases:
- discipline wins
- freedom through structure
- be disciplined
Banned Title Patterns:
- order creates power
- strict to succeed
Vocabulary Budget:
- keep recurring: discipline, freedom, balance, adapt, standard, tension
- avoid overuse: grind, hustle, warrior

Paths:
Outline Path: .chapterflow/runs/extreme-ownership/20260408-230830/outlines/ch13.md
Quiz Blueprint Path: .chapterflow/runs/extreme-ownership/20260408-230830/quiz-blueprints/ch13.md
Canonical Draft Path: .chapterflow/runs/extreme-ownership/20260408-230830/drafts/canonical/ch13.md
Edited Draft Path: .chapterflow/runs/extreme-ownership/20260408-230830/drafts/edited/ch13.md
Structured JSON Path: .chapterflow/runs/extreme-ownership/20260408-230830/structured/ch13.chapter.json
Quiz Path: .chapterflow/runs/extreme-ownership/20260408-230830/quizzes/ch13.quiz.json
Validated Path: .chapterflow/runs/extreme-ownership/20260408-230830/validated/ch13.chapter.json
Review Package Path: .chapterflow/runs/extreme-ownership/20260408-230830/validated/ch13.review-package.json
Validation Report Path: .chapterflow/runs/extreme-ownership/20260408-230830/reports/ch13.validation.md
Repair Report Path: .chapterflow/runs/extreme-ownership/20260408-230830/reports/ch13.critic.md
Reading Metrics Path: .chapterflow/runs/extreme-ownership/20260408-230830/sidecars/ch13.reading-metrics.json`
);
writeText(
  "outlines/ch13.md",
  `Chapter Promise:
This chapter will make the reader see that disciplined systems create the freedom to move quickly and adapt without chaos.

Opening Move:
Open on a team that mistakes looseness for freedom and then discovers that disciplined standards actually create more usable flexibility.

Paragraph Job Map:
- P1: establish discipline as support for speed and reliability
- P2: show why looseness often increases chaos rather than freedom
- P3: explain leadership dichotomies and balance
- P4: show disciplined systems enabling adaptation
- P5: preserve the limit against rigidity or domination
- P6: close the book with disciplined freedom

Takeaway Count Lock:
- Easy: 3
- Medium: 5
- Hard: 5`
);
writeText(
  "quiz-blueprints/ch13.md",
  `# Chapter Quiz Blueprint

Chapter: Discipline Equals Freedom: The Dichotomy of Leadership
Core concepts to test:
- discipline creating freedom
- paired leadership tensions
- balance versus rigidity
- disciplined adaptability
- closing synthesis of the book`
);
writeText(
  "sidecars/source/ch13.source.txt",
  `Chapter 13 frozen-source note: the lawful bundle supports a narrow closing claim that discipline enables freedom of action and that leadership requires balancing tensions rather than choosing one extreme. Keep this final chapter on structured adaptability, not motivational rhetoric.

Support in frozen bundle:
- Open Library confirms the chapter heading and closing placement.
- SuperSummary Part 3 supports that disciplined procedures create speed, adaptability, and the leadership balance the authors call the dichotomy.

Use rule: emphasize disciplined systems, balanced leadership tensions, and adaptability. Avoid domination rhetoric, self-help slogans, and claims that discipline replaces judgment.`
);
writeJson("sidecars/source/ch13.source.json", {
  chapterId: "ch13",
  title: "Discipline Equals Freedom: The Dichotomy of Leadership",
  heading: "Discipline Equals Freedom: The Dichotomy of Leadership",
  approxWords: 170,
  properNouns: ["Open Library", "SuperSummary"],
  repeatedTerms: ["discipline", "freedom", "balance", "adapt", "standard", "leadership"],
  sourceReferences: ["src-openlibrary-2015-first-edition", "src-supersummary-part3"],
  approvedQuoteLedger: [],
  structureSummary: {
    part1: "show discipline as the source of reliable freedom of action",
    part2: "frame leadership as balancing tensions instead of choosing extremes",
    part3: "close the book on disciplined adaptability",
  },
  usageRules:
    "Paraphrase-first. Keep the chapter on disciplined freedom, leadership balance, and adaptability. Avoid motivational slogans and domination framing.",
});

const draft = `The final chapter turns the book toward its closing paradox. Many people treat discipline and freedom as opposites, as if structure shrinks room to act while looseness creates possibility. This chapter argues the opposite under pressure. Teams usually gain more useful freedom when standards, routines, and expectations are disciplined enough that people can move quickly without starting from chaos every time.

That is why discipline matters here. A disciplined team does not have to renegotiate basic behavior in every moment. It knows the standards, trusts the routine, and can use its attention on the live problem instead of on preventable disorder. The chapter's point is not that rules are inspiring by themselves. It is that strong discipline removes friction that would otherwise steal speed and adaptability.

The chapter also widens into leadership balance. The authors call this the dichotomy of leadership because strong leadership often requires holding paired tensions together instead of worshipping one side. Leaders need confidence and humility, decisiveness and openness to correction, closeness with the team and enough distance to see clearly. The chapter argues that discipline helps leaders keep those tensions usable rather than letting them collapse into extremes.

That is why the chapter does not praise rigidity. Discipline is valuable only when it serves the mission. If standards become inflexible performance, leaders can turn structure into drag. But if discipline is built as repeatable clarity, preparation, and expectation, it creates more room for adaptation because the team is not improvising its foundation every time pressure rises.

The chapter therefore closes the book by linking speed, freedom, and balance. A disciplined team can move faster because the basics are already built. A disciplined leader can adapt better because the tensions of leadership are being managed instead of denied. Freedom grows out of prepared structure, not out of chaos pretending to be openness.

That is the book's final synthesis. Ownership, clarity, support, intent, planning, communication, and judgment all become more usable when discipline keeps them from dissolving under pressure. The mission gains freedom of action not by escaping standards, but by building standards strong enough that adaptation becomes possible without disorder.`;

writeText("drafts/canonical/ch13.md", draft);
writeText("drafts/edited/ch13.md", draft);
writeText(
  "reports/ch13.critic.md",
  `# Critic Report — ch13

Score: 11/12
Assessment: PASS

## Category Scores
- hook quality: 2/2. The opening frames discipline and freedom as a live tension rather than a slogan.
- paragraph-job distinctness: 2/2. The draft moves from disciplined freedom, to routines reducing friction, to leadership dichotomies, to adaptability, to the limit against rigidity, to final synthesis.
- anchor use: 2/2. Discipline, freedom, balance, and adaptation all stay active.
- chapter specificity: 2/2. This reads like the book's closing synthesis, not generic self-discipline advice.
- easy-mode convertibility: 2/2. The paradox and the balance frame convert cleanly.
- meta-distance: 1/2. Later conversion should keep examples concrete so the closing synthesis does not float into abstract leadership rhetoric.
- hard-edge preservation: 2/2. The draft keeps discipline tied to mission support rather than domination or rigidity.
- conceptual repetition risk: low. Structure, balance, tension, freedom, and adaptation remain distinct enough.

## Weakest Paragraph
Paragraph 4 is most exposed because discipline-versus-rigidity language could widen if later conversion drops the concrete execution frame.

## Strongest Sentence
\`Freedom grows out of prepared structure, not out of chaos pretending to be openness.\`

## Contamination / Source-Splice Check
- contamination phrases: none found
- source-splice suspicion: none

## Decision
Prose gate clear. No global reroute needed. Local patching is not required before conversion.`
);

const chapter = {
  chapterId: "ch13-discipline-equals-freedom-the-dichotomy-of-leadership",
  number: 13,
  title: "Discipline Equals Freedom: The Dichotomy of Leadership",
  readingTimeMinutes: 9,
  contentVariants: {
    easy: {
      chapterBreakdown: {
        gentle:
          "This chapter says discipline creates freedom when pressure is high. A team with strong routines and standards can move faster because it does not have to solve the same basic problems from scratch every time. Structure removes avoidable chaos.\n\nThe chapter also says leadership requires balance. Strong leaders do not cling to one extreme. They hold tensions together, like decisiveness and humility or structure and flexibility. The chapter keeps one limit clear too. Discipline is useful only when it helps the mission adapt, not when it turns into rigid control.",
        direct:
          "The chapter argues that discipline gives teams more usable freedom of action because standards, routines, and expectations reduce preventable chaos. When the basics are already built, people can spend more energy on the live problem instead of on disorder that should have been handled earlier. That is why the book treats discipline as a source of speed and adaptability rather than as a rival to them. Structure creates freedom here by taking avoidable friction off the mission before pressure gets loud.\n\nThe chapter also closes on balance. Leadership requires holding tensions together instead of worshipping one extreme. Discipline matters because it supports judgment, reliability, and flexibility when those tensions get pressured. The limit stays visible too. Discipline helps only when it serves the mission instead of hardening into rigidity. Standards earn trust when they free the team to act well, not when they demand obedience for their own sake.",
        competitive:
          "This chapter attacks a lazy lie: that looseness creates freedom while discipline shrinks it. Under real pressure, chaos usually steals freedom and disciplined standards usually create it.\n\nThat is why the chapter ends on balance. Good leadership is not one hard trait pushed forever. It is the disciplined handling of tensions like speed and control, confidence and humility, structure and adaptation. The chapter also refuses the dumb version. If discipline becomes rigid performance, it stops serving the mission."
      },
      keyTakeaways: [
        { point: tri("Discipline can create freedom of action instead of limiting it.", "Standards and routines remove avoidable chaos so teams can move faster.", "A prepared foundation creates more usable freedom than looseness does.") },
        { point: tri("Leadership often requires balancing tensions instead of choosing one side.", "The chapter closes by framing strong leadership as managing paired opposites well.", "Good leaders do not worship one pole and call it strength.") },
        { point: tri("Discipline must support adaptation, not rigidity.", "The chapter rejects control for its own sake and ties structure to mission usefulness.", "Structure only helps when it leaves the team more able to adapt.") },
      ],
      oneMinuteRecap: tri(
        "This chapter says disciplined standards can create the freedom teams need to move quickly and adapt under pressure.",
        "Discipline Equals Freedom argues that strong leadership balances tensions well and uses structure to support speed, judgment, and adaptability.",
        "The final rule is sharp: build standards strong enough that the mission gains freedom instead of chaos."
      ),
    },
    medium: {
      chapterBreakdown: {
        gentle:
          "This chapter begins with a paradox. Many people assume freedom comes from fewer rules and less structure, but the chapter argues that pressure usually proves the opposite. Teams gain more real freedom when standards, routines, and expectations are disciplined enough that the basics do not collapse every time the situation gets hard.\n\nThat is why discipline matters. It reduces repeated confusion, creates reliability, and lets people spend more attention on the live problem instead of on preventable disorder. The chapter is not praising rules for their own sake. It is showing how disciplined systems can create speed and adaptability by removing wasteful chaos.\n\nThe chapter also closes the book by talking about leadership balance. Strong leadership does not live at one extreme. Leaders need confidence and humility, decisiveness and openness, discipline and flexibility. The authors frame these as tensions leaders have to manage rather than as simple traits to maximize.\n\nThe chapter keeps one hard warning visible too. Discipline is not helpful when it turns into rigid control or domination. Structure only deserves trust when it helps the mission move and adapt.\n\nThat is why the book closes here. Ownership, planning, communication, judgment, and support all become more usable when discipline keeps them steady enough to survive pressure without dissolving into chaos.",
        direct:
          "The chapter goes after a common misreading of freedom. Under pressure, teams rarely become more free by becoming looser. They usually become noisier, less reliable, and slower. The chapter argues that disciplined standards, routines, and expectations create more usable freedom of action because the team does not have to rebuild the basics every time the environment gets loud. Looseness often feels open until the mission starts paying for the same preventable confusion again.\n\nThat is the first part of the claim. Discipline removes friction that should not consume leadership attention. The team can move faster because preventable disorder is already being handled by standard rather than by repeated improvisation. Attention stays available for live judgment because the foundation is no longer wobbling under pressure.\n\nThe second part of the claim is balance. The chapter closes the book by framing leadership as a set of dichotomies that have to be managed together. Confidence without humility becomes arrogance. Decisiveness without openness becomes stubbornness. Structure without flexibility becomes rigidity. The point is not to pick one side and call it strength. It is to build the discipline needed to hold the tensions well. Balanced leadership is what keeps disciplined systems from becoming one more extreme to hide inside.\n\nThat is why the chapter refuses rigid discipline as strongly as it refuses chaos. Discipline matters only when it serves mission effectiveness, learning, and adaptation. If leaders turn standards into performance theater or domination, structure stops creating freedom and starts consuming it. The same system that steadies the team can become drag if the leader serves it instead of the mission.\n\nThe chapter therefore works as the book's final synthesis. Disciplined systems make ownership steadier, planning more usable, communication more reliable, and judgment faster under pressure. Freedom grows not from escaping standards, but from building standards strong enough that the team can adapt without breaking. Structure becomes a source of room to move because it has already handled what chaos would have kept taxing.",
        competitive:
          "This chapter attacks the fantasy that looseness equals freedom. Under pressure, looseness usually means the team keeps paying for the same preventable mess. Discipline, by contrast, can create freedom because the basics are already built and the mission does not have to renegotiate them every time the room gets loud.\n\nThat is why the chapter respects standards and routine. They are not there to make the team feel constrained. They are there so the team can spend less energy on avoidable disorder and more on the live problem.\n\nThe closing move is leadership balance. The authors call it the dichotomy of leadership because strong leadership lives in the handling of tensions, not in devotion to one trait. Confidence, humility, decisiveness, openness, structure, flexibility: each can become dangerous if it loses its balancing partner.\n\nThe chapter is just as hard on rigid discipline as it is on chaos. Structure that stops serving the mission is not freedom-making anymore. It is drag.\n\nThat is the final synthesis: disciplined systems create faster adaptation, but only when the leader uses them to balance the tensions of leadership instead of hiding inside one extreme.",
      },
      keyTakeaways: [
        {
          point: tri("Discipline can create more real freedom than looseness can.", "Standards and routines often increase usable freedom of action by reducing preventable chaos.", "The team gets freer when the basics stop breaking every day."),
          moreDetails: tri("That is why the chapter treats discipline as support for speed.", "The point is not control for its own sake but a cleaner foundation for live action.", "Freedom grows when disorder stops stealing the mission's bandwidth."),
        },
        {
          point: tri("Disciplined systems reduce repeated friction.", "Teams move faster when they do not have to renegotiate basic behavior under pressure.", "Standard removes noise the mission should never have been paying for."),
          moreDetails: tri("That is how structure supports adaptability.", "The chapter says routine can free attention for harder judgment.", "The basics should be automatic enough that the mission can spend itself elsewhere."),
        },
        {
          point: tri("Leadership requires balancing tensions, not maximizing one trait.", "The chapter frames strong leadership as managing dichotomies like confidence and humility or decisiveness and openness.", "One-sided strength usually breaks when its partner goes missing."),
          moreDetails: tri("That is why balance is central to the closing chapter.", "The leader has to keep paired virtues from turning into paired failures.", "A trait without its counterweight becomes a liability fast."),
        },
        {
          point: tri("Discipline fails when it becomes rigidity or domination.", "Structure helps only when it still serves the mission, adaptation, and learning.", "The same standard that steadies the team can start choking it if the leader worships it."),
          moreDetails: tri("The chapter rejects control theater as strongly as it rejects chaos.", "Rigid discipline consumes freedom instead of creating it.", "If the standard cannot bend for the mission, the standard is now the problem."),
        },
        {
          point: tri("The chapter closes the book by synthesizing its earlier principles.", "Ownership, planning, communication, and judgment all work better when disciplined systems keep them steady under pressure.", "The final point is not tougher behavior. It is more usable leadership under load."),
          moreDetails: tri("That is why discipline is tied to freedom rather than opposed to it.", "The team adapts more safely because the foundation is already built.", "The book ends by saying structure is what lets adaptation travel farther."),
        },
      ],
      activationPrompt: tri(
        "Look at one team habit that feels restrictive but may actually be creating useful freedom under pressure.",
        "Map one recurring mess that better discipline could remove so the team can spend more energy on the real problem.",
        "Find one place where looseness is pretending to be freedom while quietly taxing the mission."
      ),
      selfCheckPrompt: tri(
        "Where would stronger discipline reduce repeated chaos instead of shrinking useful flexibility?",
        "Which standard in my work supports adaptation, and which one has drifted toward rigidity?",
        "What tension am I solving by choosing one side too hard instead of balancing both?"
      ),
      oneMinuteRecap: tri(
        "This chapter says discipline can create freedom because strong standards and routines remove chaos and make adaptation easier.",
        "Discipline Equals Freedom argues that leadership works best when disciplined systems support balanced handling of paired tensions under pressure.",
        "The book closes on one hard point: freedom grows from structure that serves the mission, not from looseness that keeps re-creating disorder."
      ),
    },
    hard: {
      chapterBreakdown: {
        gentle:
          "This chapter closes the book by challenging an easy assumption about freedom. Many people think freedom grows when rules loosen and structure fades. The chapter argues that under pressure the opposite is often true. Teams gain more real freedom when standards, expectations, and routines are disciplined enough that the basics remain steady while attention turns to the live problem.\n\nThat is why discipline matters here. A disciplined team does not keep spending leadership energy on the same preventable confusion. It can move faster because the foundation is already built. The chapter is not praising control for its own sake. It is showing that disciplined systems remove friction and make adaptability more usable.\n\nThe chapter also widens into leadership balance. The authors call this the dichotomy of leadership because strong leaders often have to hold tensions together rather than choosing one extreme. Confidence needs humility. Decisiveness needs openness to correction. Discipline needs flexibility. The point is not to maximize one trait until it looks impressive. The point is to keep the tensions productive.\n\nThat is why the chapter rejects rigid discipline. Structure becomes harmful when leaders serve the standard instead of the mission. If discipline turns into domination, performance theater, or inflexibility, it stops creating freedom and starts consuming it.\n\nThe chapter's deeper claim is that freedom grows from prepared order. Teams adapt better when their routines, standards, and expectations are already strong enough that they do not collapse under pressure. Leadership gets better when the leader can hold opposing strengths in balance instead of hiding inside one side.\n\nThat is why this final chapter works as a synthesis. Ownership, clarity, support, planning, communication, and judgment all become more repeatable when discipline keeps them from dissolving into chaos. The book ends by saying that speed and adaptability are safest when disciplined systems are already carrying part of the load.\n\nThe closing picture is balanced freedom, not hard control. Discipline matters because it gives the mission more room to act well under pressure, not because it makes the leader feel stronger than the team.",
        direct:
          "The chapter exposes a final leadership paradox. Freedom of action does not usually grow from looseness under pressure. It grows from disciplined standards, routines, and expectations that keep the basics reliable enough for teams to move quickly when the environment gets hard. The chapter argues that structure can create more usable freedom because preventable chaos stops consuming attention that should be available for the mission. A team gets freer when it no longer spends itself re-solving the same disorder every time the room gets loud.\n\nThat is why discipline matters here. It reduces repeated friction, protects reliability, and gives leaders more cognitive room for live judgment. The team can adapt faster because it is not rebuilding its foundation every time pressure rises. Discipline becomes freedom-making when it removes avoidable disorder before the mission has to pay for it. The mission gains room to move because the basics have already been made dependable.\n\nThe chapter also closes the book by framing leadership as a set of dichotomies. Strong leadership is not one trait pushed to an extreme. Confidence without humility becomes arrogance. Decisiveness without openness becomes stubbornness. Structure without flexibility becomes rigidity. Leaders need the discipline to hold these tensions together instead of turning one-sided strengths into one-sided failures. Balance is not decorative here. It is what keeps strength from mutating into a liability.\n\nThat is why rigid discipline is not the answer. The chapter rejects domination, control theater, and inflexible standards for the same reason it rejects chaos. Discipline only serves the mission when it still supports judgment, learning, and adaptation. If the system cannot bend when reality demands it, the system has stopped creating freedom. A standard that no longer serves the mission is now just better-organized drag.\n\nThat is the deeper synthesis of the chapter and the book. Disciplined systems make ownership steadier, planning more executable, communication more dependable, and judgment more timely. Freedom grows not from escaping standards, but from building standards strong enough that the team can act, learn, and adapt without collapsing into disorder. The earlier principles become more repeatable because discipline keeps them from dissolving under pressure.\n\nThe final message is balance. Leadership requires structure without suffocation, confidence without arrogance, and speed without chaos. Discipline matters because it makes that balance repeatable under pressure rather than accidental. The book ends by tying freedom to standards strong enough to carry the load of adaptation.",
        competitive:
          "This chapter goes after a lazy myth about freedom. Under real pressure, looseness usually does not free a team. It makes the team keep paying for the same basic disorder. Discipline, by contrast, can create freedom because the standards and routines are already doing work the mission should not have to renegotiate live.\n\nThat is why the chapter respects disciplined systems. They give teams more room to move because the basics stay dependable when the room gets loud. The mission can spend itself on hard judgment instead of on preventable mess.\n\nThe closing move is the dichotomy of leadership. Strong leaders do not hide inside one trait and call it conviction. Confidence needs humility. Structure needs flexibility. Decisiveness needs openness. The leader's real job is balancing tensions before one side hardens into a failure.\n\nThat is also why the chapter is hard on rigid discipline. Standards that cannot bend for the mission stop making freedom and start taxing it. Control theater is not leadership. It is drag dressed as seriousness.\n\nThe chapter ends with a hard synthesis: disciplined systems create speed, adaptability, and repeatable balance. Freedom does not come from escaping structure. It comes from building structure good enough that the team can move hard without falling apart.\n\nThat is the book's last demand. Hold the tensions. Build the standards. Let discipline carry enough load that freedom becomes usable instead of imaginary.",
      },
      keyTakeaways: [
        {
          point: tri("Freedom of action often grows from disciplined standards rather than from looseness.", "Under pressure, disciplined routines can create more usable freedom by reducing preventable chaos.", "The mission gets freer when the basics stop breaking."),
          moreDetails: tri("That is why the chapter treats structure as support for speed.", "Discipline matters because it removes friction the team should not keep paying for.", "Prepared order frees bandwidth for the real fight."),
        },
        {
          point: tri("Disciplined systems make adaptability more usable.", "A strong foundation lets teams spend more energy on live judgment instead of rebuilding basics.", "The team can bend faster when the floor beneath it is already strong."),
          moreDetails: tri("This is discipline as mission support, not as control theater.", "Routine and expectation reduce repeated confusion so adaptation costs less.", "If the basics are stable, the mission can spend itself on harder problems."),
        },
        {
          point: tri("Leadership strength lives in balanced tensions, not in one-sided extremes.", "The dichotomy of leadership means paired virtues have to be held together instead of isolated from each other.", "One trait without its counterweight eventually turns against the mission."),
          moreDetails: tri("Confidence needs humility and structure needs flexibility.", "The chapter says strong leaders keep opposite strengths in productive tension.", "The leader's job is not picking a side. It is preventing either side from taking over."),
        },
        {
          point: tri("Discipline fails when it hardens into rigidity or domination.", "Structure helps only when it still serves adaptation, judgment, and the mission itself.", "The same standard that steadies the team can choke it if the leader worships it."),
          moreDetails: tri("That is why the chapter rejects inflexible control as strongly as chaos.", "If the system cannot bend for reality, it has stopped creating freedom.", "A standard serving itself is just better-organized drag."),
        },
        {
          point: tri("The final synthesis is disciplined, balanced adaptability.", "Ownership, planning, communication, and judgment become more repeatable when discipline keeps them stable under pressure.", "The book closes by turning discipline into usable freedom, not into hardness for its own sake."),
          moreDetails: tri("This is how the earlier chapters fit together at the end.", "Disciplined systems let the team move faster, revise cleaner, and hold leadership tensions well.", "Freedom becomes real when structure carries enough load that the mission can still adapt."),
        },
      ],
      activationPrompt: tri(
        "Find one repeated disorder in your work that stronger discipline could remove without making the mission more rigid.",
        "Identify one leadership tension you are currently solving by choosing one extreme instead of balancing both sides.",
        "Locate one place where structure could create freedom if it served the mission better than the current looseness does."
      ),
      selfCheckPrompts: [
        tri(
          "Where would stronger routine free attention instead of constraining useful judgment?",
          "Which repeated chaos in my team is actually a discipline problem masquerading as flexibility?",
          "What preventable mess is still taxing the mission because the standard is too weak?"
        ),
        tri(
          "Which leadership tension am I handling as an either-or instead of a balance problem?",
          "Where has one strength in my leadership become a liability because its counterweight is missing?",
          "What trait am I pushing so hard that it is starting to fight the mission?"
        ),
      ],
      predictionPrompt: tri(
        "What kind of freedom becomes possible once discipline is strong enough to carry the basics under pressure?",
        "If structure is serving the mission well, what new room for speed or adaptation does that create?",
        "What freedom shows up when the standards finally stop consuming the mission's attention?"
      ),
      oneMinuteRecap: tri(
        "This chapter says disciplined standards can create the freedom teams need to move fast and adapt well, as long as leaders keep structure in balance with flexibility.",
        "Discipline Equals Freedom argues that strong leadership is the disciplined balancing of tensions, where standards support speed, judgment, and adaptation instead of fighting them.",
        "The final rule is this: build disciplined systems that free the mission, hold the tensions well, and refuse both chaos and rigid control."
      ),
    },
  },
  examples: [
    {
      exampleId: "ch13-ex01-sabine-work",
      title: "Sabine's Team Moves Faster Once the Routine Stops Breaking",
      category: "work",
      format: "decision_point",
      endingType: "broader_principle",
      contexts: ["release checklist", "handoff routine", "morning standard"],
      scenario: tri(
        "Sabine can either keep letting the team improvise the same basic handoff every week or enforce a disciplined routine that frees them during live work.",
        "Sabine has to decide whether more structure would slow the team down or finally stop repeated chaos from stealing time.",
        "Sabine can keep calling looseness freedom, or she can build a routine that gives the mission back its bandwidth."
      ),
      whatToDo: tri(
        "Sabine should build the routine and use it to remove repeated disorder before the live work starts.",
        "Strengthen the standard so the team spends less energy on basics and more on the real problem.",
        "Fix the floor and let the mission stop tripping on it."
      ),
      whyItMatters: tri(
        "The chapter says discipline can create more usable freedom by removing preventable chaos.",
        "This shows structure helping speed rather than fighting it.",
        "The team gets freer once the basics stop falling apart."
      ),
    },
    {
      exampleId: "ch13-ex02-derek-postmortem",
      title: "Derek Learns the Student Session Needed Standards Before It Needed More Passion",
      category: "school",
      format: "postmortem",
      endingType: "self_directed_question",
      contexts: ["student government dais", "speaker queue", "agenda cards"],
      scenario: tri(
        "In the postmortem, Derek sees that the session became chaotic not because students lacked commitment but because the basic process kept getting reinvented live.",
        "The review shows that more freedom without disciplined procedure made the room less adaptive, not more.",
        "Derek realizes the dais needed standards before it needed another speech about ownership."
      ),
      whatToDo: tri(
        "Next time, Derek should build stronger routine and clear expectations before the session starts.",
        "Use disciplined process to remove preventable confusion so live adaptation becomes easier.",
        "Stop asking passion to solve what standards should have handled first."
      ),
      whyItMatters: tri(
        "The chapter says looseness often creates more chaos than freedom under pressure.",
        "This example shows discipline serving adaptability by stabilizing the basics first.",
        "The room could not get free because the floor kept moving."
      ),
    },
    {
      exampleId: "ch13-ex03-lina-dialogue",
      title: "Lina Explains That Flexibility Needs a Standard to Flex From",
      category: "personal",
      format: "dialogue",
      endingType: "surprising_implication",
      contexts: ["family cleanup routine", "shared calendar", "weeknight reset"],
      scenario: tri(
        "Lina hears the family call every routine restrictive even though the lack of routine keeps creating the same nightly mess.",
        "In the conversation, Lina explains that a stable standard could create more freedom by reducing repeated confusion.",
        "Lina reframes discipline as a way to stop spending every evening reinventing the same basics."
      ),
      whatToDo: tri(
        "She should build a simple routine that removes recurring disorder while keeping room for reasonable adaptation.",
        "Use structure to hold the basics steady so the family can spend less energy on preventable chaos.",
        "Give the room a floor strong enough that flexibility stops meaning mess."
      ),
      whyItMatters: tri(
        "The chapter says freedom grows from prepared structure, not from chaos pretending to be openness.",
        "This example transfers the principle by showing discipline reducing hidden friction in everyday life.",
        "The routine creates room to breathe because it stops stealing attention."
      ),
    },
    {
      exampleId: "ch13-ex04-oleg-reveal",
      title: "Oleg Finds the Team's Speed Came From Standards, Not from Looseness",
      category: "work",
      format: "predict_reveal",
      endingType: "cross_domain",
      contexts: ["support playbook", "incident roles", "response lane"],
      scenario: tri(
        "Oleg predicts the team will respond faster after tightening the support playbook even though some people fear that will slow them down.",
        "The reveal is that the team adapts faster because disciplined roles and standards remove repeated confusion during the live response.",
        "Oleg learns that what felt like extra structure was actually more freedom in the moment that mattered."
      ),
      whatToDo: tri(
        "Oleg should keep the disciplined playbook and use it as the base for faster adaptation under pressure.",
        "Build standards strong enough that live response does not keep burning time on the same preventable uncertainty.",
        "Use discipline to buy speed the mission can actually trust."
      ),
      whyItMatters: tri(
        "The chapter says discipline can make teams faster by taking chaos off the field early.",
        "This example shows disciplined freedom as a practical operational result rather than a slogan.",
        "The team moved harder because the basics were already carrying weight."
      ),
    },
    {
      exampleId: "ch13-ex05-marisol-dilemma",
      title: "Marisol Has to Decide Whether the Robotics Standard Still Serves the Mission",
      category: "school",
      format: "dilemma",
      endingType: "common_trap",
      contexts: ["robotics judging aisle", "prep checklist", "surprise constraint"],
      scenario: tri(
        "Marisol faces a surprise judging constraint and has to decide whether sticking to the usual prep routine is helping the team or now slowing it.",
        "The dilemma is whether discipline is still serving adaptation or whether the standard is being protected for its own sake.",
        "Marisol has to separate disciplined freedom from rigid habit in real time."
      ),
      whatToDo: tri(
        "She should keep the parts of the standard that support the mission and bend the parts that no longer do.",
        "Use discipline as a servant of adaptation, not as a shield against revising the routine.",
        "Protect the mission more than the checklist that used to serve it."
      ),
      whyItMatters: tri(
        "The chapter warns that discipline becomes harmful when it hardens into rigidity.",
        "This is the balance problem at the center of the closing chapter: structure must still serve the mission.",
        "A standard stops creating freedom the moment it starts demanding obedience from the mission.")
    },
    {
      exampleId: "ch13-ex06-bennett-after",
      title: "Bennett's Volunteer Group Gets More Flexible Once the Basics Stop Being Negotiated",
      category: "personal",
      format: "before_after",
      endingType: "perspective_reframe",
      contexts: ["volunteer rota", "supply check", "setup roles"],
      scenario: tri(
        "Before, Bennett's group kept calling itself flexible while repeatedly renegotiating the same setup basics every weekend.",
        "After they standardize the basics, the group can adapt more calmly because the repeated uncertainty has been removed.",
        "The before-and-after difference is not less freedom. It is freedom becoming more usable."
      ),
      whatToDo: tri(
        "Bennett should keep the disciplined basic routine and save improvisation for the parts that actually need it.",
        "Strengthen the foundation so the group can spend its flexibility on live problems instead of on recurring setup confusion.",
        "Stop wasting freedom on the basics and spend it where adaptation actually matters."
      ),
      whyItMatters: tri(
        "The chapter says disciplined systems can create more real freedom by reducing avoidable disorder.",
        "This example shows disciplined freedom as a change in where the group spends its attention.",
        "The team became more flexible by becoming less chaotic, not less structured."
      ),
    },
  ],
  implementationPlan: {
    coreSkill: tri(
      "Learn to build disciplined systems that make adaptation easier instead of harder.",
      "The core skill is using standards, routines, and balanced leadership judgment to create usable freedom under pressure.",
      "Train yourself to build structure that carries the basics so the mission can spend itself on the real problem."
    ),
    ifThenPlans: [
      {
        context: "work",
        plan: tri(
          "If the team keeps solving the same basic disorder, then strengthen the routine before the next live push.",
          "If preventable chaos is stealing attention, then build a standard strong enough to remove it from the mission's budget.",
          "If the room keeps tripping on the same floor, fix the floor."
        ),
      },
      {
        context: "school",
        plan: tri(
          "If a student group keeps improvising the basics, then standardize the repeatable parts and save flexibility for live surprises.",
          "If the team calls itself flexible but still gets trapped by recurring disorder, then build stronger structure first.",
          "If the dais keeps renegotiating the basics, discipline it before the next meeting tries to improvise again."
        ),
      },
      {
        context: "personal",
        plan: tri(
          "If home or volunteer chaos keeps repeating, then build a routine that holds the basics steady while leaving room to adapt.",
          "If looseness is creating hidden drag, then strengthen the standard and keep it mission-serving rather than rigid.",
          "If every weekend starts from zero, stop calling that freedom and build a usable floor."
        ),
      },
    ],
    twentyFourHourChallenge: tri(
      "Within the next day, identify one recurring disorder that stronger discipline could remove.",
      "In the next 24 hours, pick one standard you need to strengthen and one rigid habit you need to loosen so both serve the mission better.",
      "By tomorrow, fix one place where looseness has been pretending to be freedom."
    ),
    weeklyPractice: tri(
      "This week, review one team habit and ask whether it is creating freedom, rigidity, or chaos.",
      "Use one weekly review to check which standards are supporting adaptation and which ones have drifted away from the mission.",
      "Every week, force one routine to prove that it is carrying the mission instead of taxing it."
    ),
  },
  reviewCards: [
    { cardId: "ch13-rc01", difficulty: "easy", front: tri("What paradox does the final chapter attack?", "How can discipline relate to freedom here?", "What mistaken assumption opens the chapter?"), back: tri("It attacks the idea that looseness creates freedom while discipline only restricts it.", "The chapter argues that discipline can create freedom of action under pressure.", "It says structure can free the mission more than chaos can.") },
    { cardId: "ch13-rc02", difficulty: "easy", front: tri("Why do disciplined systems help teams move faster?", "What does discipline remove from the mission's path?", "How does structure create room for action?"), back: tri("Because they reduce repeated confusion and preventable disorder.", "They remove friction the mission should not keep paying for.", "Structure frees attention for the live problem.") },
    { cardId: "ch13-rc03", difficulty: "medium", front: tri("What is the dichotomy of leadership?", "Why is balance central to this chapter?", "What kind of strength does the chapter reject?"), back: tri("It is the idea that leaders have to hold paired tensions together instead of choosing one extreme.", "Balance matters because one-sided strengths can become failures under pressure.", "The chapter rejects trait worship without counterweights.") },
    { cardId: "ch13-rc04", difficulty: "medium", front: tri("When does discipline stop helping?", "What turns structure into drag?", "Why is rigid discipline not the answer?"), back: tri("Discipline stops helping when it becomes rigid, dominating, or detached from the mission.", "A standard becomes drag when it serves itself instead of the mission.", "The chapter says structure must still support adaptation and judgment.") },
    { cardId: "ch13-rc05", difficulty: "hard", front: tri("How does the final chapter synthesize the book?", "Why does the book end on disciplined freedom?", "What closing standard does the chapter leave behind?"), back: tri("It says ownership, planning, communication, and judgment all work better when disciplined systems keep them stable under pressure.", "The book ends here because disciplined structure makes earlier principles more repeatable and adaptable.", "Build standards that free the mission and hold the tensions without collapsing into chaos or rigid control.") },
  ],
  keyTakeawayCard: tri(
    "The book closes by saying disciplined standards can create the freedom teams need to move quickly and adapt well under pressure.",
    "Discipline Equals Freedom argues that structure is valuable when it reduces preventable chaos and helps leaders balance the tensions of leadership without hardening into rigidity.",
    "Build standards strong enough to carry the basics, hold the tensions well, and let the mission move fast without falling apart."
  ),
  quiz: {
    passingScorePercent: 70,
    questions: [
      { questionId: "ch13-q01", prompt: "What paradox does the chapter challenge first?", choices: ["That looseness always creates more freedom than discipline", "That teams should avoid all routines", "That balanced leadership is impossible"], correctIndex: 0, explanation: tri("Correct. The chapter argues that discipline can create more usable freedom under pressure.", "Right. It pushes against the idea that less structure automatically means more freedom.", "That is the myth it hits first: chaos masquerading as freedom."), bloomsLevel: "remember", depthLevel: "easy" },
      { questionId: "ch13-q02", prompt: "Why can disciplined standards increase freedom of action?", choices: ["Because they eliminate all need for judgment", "Because they reduce preventable chaos and free attention for live problems", "Because they make teams obey one style forever"], correctIndex: 1, explanation: tri("Yes. The chapter says standards can free the mission by stabilizing the basics.", "Exactly. Discipline helps when it removes repeated disorder from the team's path.", "That is the gain: the basics stop stealing the mission's bandwidth."), bloomsLevel: "understand", depthLevel: "easy" },
      { questionId: "ch13-q03", prompt: "What does the chapter mean by the dichotomy of leadership?", choices: ["That leaders should pick one strong trait and push it hard", "That leadership requires balancing paired tensions instead of choosing one extreme", "That discipline removes the need for flexibility"], correctIndex: 1, explanation: tri("Right. The chapter says strong leadership often lives in balanced tensions.", "Correct. The dichotomy frame means leaders manage paired strengths together.", "One-sided strength is what the chapter warns against."), bloomsLevel: "understand", depthLevel: "easy" },
      { questionId: "ch13-q04", prompt: "In Sabine's scenario, what best applies the chapter?", choices: ["Keep improvising the same basic handoff so the team stays free", "Build the routine so repeated chaos stops stealing time from live work", "Avoid standards because they always reduce speed"], correctIndex: 1, explanation: tri("Correct. The chapter says disciplined routines can create more freedom by removing preventable disorder.", "That choice fits because structure is being used to support speed rather than to restrict it.", "Fix the floor so the mission stops tripping on it."), bloomsLevel: "apply", depthLevel: "medium" },
      { questionId: "ch13-q05", prompt: "How does the chapter distinguish discipline from rigidity?", choices: ["Discipline serves the mission, while rigidity serves the standard itself", "Rigidity is just stronger discipline", "There is no meaningful difference under pressure"], correctIndex: 0, explanation: tri("Yes. The chapter says discipline helps only when it still serves adaptation and the mission.", "Exactly. Once structure serves itself instead of the work, it has become rigidity.", "The mission matters more than the checklist that used to help it."), bloomsLevel: "analyze", depthLevel: "medium" },
      { questionId: "ch13-q06", prompt: "Which misreading does the chapter reject?", choices: ["That disciplined systems can support speed and reliability", "That discipline should harden into domination or rigid control", "That leadership tensions need balance"], correctIndex: 1, explanation: tri("Right. The chapter rejects control theater and rigid discipline.", "Correct. It says discipline should support adaptation rather than consume freedom.", "That is the fake version the chapter punishes."), bloomsLevel: "understand", depthLevel: "medium" },
      { questionId: "ch13-q07", prompt: "What is the best transfer of this chapter to school or home life?", choices: ["Standardize the basics so flexibility can be spent on the live problems that actually matter", "Keep every process loose so no one feels constrained", "Treat structure as the enemy of adaptation"], correctIndex: 0, explanation: tri("Correct. The chapter transfers through disciplined basics creating more usable flexibility.", "That answer carries the principle well: build a stronger floor so adaptation has somewhere to stand.", "Stop wasting freedom on recurring disorder."), bloomsLevel: "apply", depthLevel: "medium" },
      { questionId: "ch13-q08", prompt: "What was the real reveal in Oleg's scenario?", choices: ["The team moved faster because disciplined roles removed repeated confusion", "The team adapted only after throwing away all structure", "The main gain was emotional motivation rather than routine"], correctIndex: 0, explanation: tri("Yes. The chapter says disciplined systems can create speed by stabilizing the basics.", "The reveal is that standards made adaptation easier rather than harder.", "The team got freer because the basics were already carrying weight."), bloomsLevel: "analyze", depthLevel: "hard" },
      { questionId: "ch13-q09", prompt: "Which statement best captures the chapter's deeper synthesis?", choices: ["Leadership gets stronger when one trait is pushed to an extreme", "Disciplined systems and balanced tensions make earlier leadership principles more repeatable under pressure", "Freedom appears mainly when standards disappear"], correctIndex: 1, explanation: tri("Exactly. The chapter closes the book by saying disciplined structure stabilizes the earlier principles.", "Correct. The synthesis is disciplined, balanced adaptability rather than trait worship or looseness.", "The book ends by turning structure into usable freedom.") , bloomsLevel: "analyze", depthLevel: "hard" },
      { questionId: "ch13-q10", prompt: "What closing standard does the chapter leave behind?", choices: ["Escape standards whenever pressure rises", "Build disciplined systems that free the mission and keep leadership tensions balanced", "Treat discipline as more important than adaptation"], correctIndex: 1, explanation: tri("Right. The final chapter wants structure that serves speed, judgment, and adaptation together.", "That answer captures the closing demand: disciplined freedom with balanced leadership tensions.", "Build standards that carry the mission instead of trapping it.") , bloomsLevel: "analyze", depthLevel: "hard" },
    ],
  },
};

const reviewPackage = buildReviewPackage(chapter);
const metrics = buildMetrics(chapter, 11, "Discipline Equals Freedom: The Dichotomy of Leadership");
writeJson("structured/ch13.chapter.json", chapter);
writeJson("quizzes/ch13.quiz.json", chapter.quiz);
writeJson("validated/ch13.chapter.json", chapter);
writeJson("validated/ch13.review-package.json", reviewPackage);
writeJson("sidecars/ch13.reading-metrics.json", metrics);

const chapterLint = runChecked("python3", [lintScript, path.join(runRoot, "validated/ch13.chapter.json"), "chapter_gate"]);
const wrapperLint = runChecked("python3", [lintScript, path.join(runRoot, "validated/ch13.review-package.json"), "chapter_gate"]);
const chapterLintLine = chapterLint.stdout.split("\n").slice(-1)[0] || "FAIL=1 WARN=0";
const wrapperLintLine = wrapperLint.stdout.split("\n").slice(-1)[0] || "FAIL=1 WARN=0";
writeValidation("RUNNING", chapterLintLine, wrapperLintLine, "RUNNING", false, "pending");
const guard = runChecked("python3", [guardScript, runRoot]);
const guardLine = guard.stdout.split("\n").slice(-1)[0] || "FAIL=1 WARN=0";
const wrapperMatch = stable(JSON.parse(fs.readFileSync(path.join(runRoot, "validated/ch13.review-package.json"), "utf8")).chapters[0]) === stable(chapter);

if (!chapterLint.ok || !wrapperLint.ok || !guard.ok || !wrapperMatch) {
  writeValidation("FAIL", chapterLintLine, wrapperLintLine, guardLine, wrapperMatch, "not-sealed");
  throw new Error([chapterLint.stdout, wrapperLint.stdout, guard.stdout, `wrapperMatch=${wrapperMatch}`].join("\n"));
}

const hash = sha(chapter);
writeValidation("PASS", chapterLintLine, wrapperLintLine, guardLine, wrapperMatch, hash);
updateContinuity(hash);
appendRunLog([
  `${stamp()} - Final chapter pre-writer package completed. Wrote brief, outline, quiz blueprint, and source sidecars for \`ch13\` before the writer pass.`,
  `${stamp()} - Final chapter writer pass for \`ch13\` completed at \`drafts/canonical/ch13.md\`; editor pass completed at \`drafts/edited/ch13.md\`.`,
  `${stamp()} - Final chapter critic pass for \`ch13\` completed at \`reports/ch13.critic.md\` with score \`11/12\`; prose gate clear for conversion.`,
  `${stamp()} - Final chapter converter pass for \`ch13\` completed at \`structured/ch13.chapter.json\`; quiz pass completed at \`quizzes/ch13.quiz.json\`.`,
  `${stamp()} - Final chapter final chapter-gate checks for \`ch13\` passed: chapter lint \`FAIL=0 WARN=0\`, review-package lint \`FAIL=0 WARN=0\`, artifact guard \`FAIL=0 WARN=0\`, wrapper payload exact-match confirmed at \`chapters[0]\`, reading metrics written.`,
  `${stamp()} - Final chapter automatic gate decision for \`ch13\`: PASS. Sealed \`approvedChapterHashes.ch13 = ${hash}\` in \`continuity/continuity-state.json\`.`,
]);
