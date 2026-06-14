import { copyFileSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

const ROOT = process.cwd();
const SOURCE_DIR = resolve(ROOT, ".chapterflow/runs/drive/20260601-083118/sidecars/source");
const ROOT_CHAPTERS = resolve(ROOT, "state/chapters");
const AUTHORED_CHAPTERS = resolve(ROOT, "scripts/book/prompts/chapterflow-v21-authored/state/chapters");

const banned = [
  "preserve the source lesson for",
  "choose the fit",
  "keeps old rules intact",
  "Prefer supervision over",
  "Force one tool onto",
  "Exaggerate against the guardrail",
  "Blame the person and discard",
  "Status-label reading",
  "Case retold",
  "Reward motion while postponing",
  "Remove social meaning from",
  "8:40 a.m.",
];

function timeFor(chapterNumber, exampleIndex) {
  const hour = 8 + ((chapterNumber + exampleIndex * 2) % 10);
  const minute = String((chapterNumber * 7 + exampleIndex * 11) % 60).padStart(2, "0");
  const suffix = hour < 12 ? "a.m." : "p.m.";
  const displayHour = hour <= 12 ? hour : hour - 12;
  return `${displayHour}:${minute} ${suffix}`;
}

const chapterDilemmas = {
  1: [
    "whether to pay editors per update or make the wiki easier for volunteers to improve",
    "whether factory-style supervision belongs in a class about creative troubleshooting",
    "whether the pricing case should be treated as pure payout math or as a fairness problem",
    "whether an open-source release needs tighter command or clearer contribution paths",
    "whether the lab should measure only compliance or protect curiosity in the redesign",
    "whether support agents need more scripts or more room to solve unusual problems",
  ],
  2: [
    "whether a prize will make the museum activity livelier or turn curiosity into a transaction",
    "whether the sprint team should chase a bonus or protect the loose attention needed for insight",
    "whether late-pickup fines will teach respect or convert a social norm into a fee",
    "whether a sales target will improve judgment or encourage people to game the number",
    "whether volunteers need a reward or a stronger sense that their help is freely chosen",
    "whether the bug bounty will focus careful work or narrow attention around the payout",
  ],
  3: [
    "whether a small bonus fits a dull checklist with a known path",
    "whether records cleanup needs a reward, a rationale, and some choice about method",
    "whether the backlog is routine enough for a completion incentive",
    "whether shelving can be sped up without pretending the task is inspiring",
    "whether maintenance work needs a clear standard more than a creativity prize",
    "whether migration work should get an after-the-fact thank-you or an if-then bargain",
  ],
  4: [
    "whether low energy reflects lazy people or a climate that trains external dependence",
    "whether advising should feed autonomy and competence or lean harder on approval",
    "whether a hiring panel is selecting for inner drive or just status hunger",
    "whether practice is being guided by growth or by fear of looking untalented",
    "whether the sales reset can change conditions instead of labeling personalities",
    "whether family employees have become Type X because the business rewards only compliance",
  ],
  5: [
    "whether schedule choice can coexist with firm patient-care standards",
    "whether roadmap work needs task choice without losing shared commitments",
    "whether a remote team should be judged by presence or results",
    "whether teachers need more technique autonomy inside common goals",
    "whether the brief should dictate every move or leave room for skilled judgment",
    "whether improvement work should be assigned from above or shaped by the people doing it",
  ],
  6: [
    "whether the student needs an easier piece or a harder stretch with better feedback",
    "whether the code review should shame mistakes or turn them into practice targets",
    "whether simulation training is hard enough to build skill without creating panic",
    "whether the lesson should avoid struggle or use it as information",
    "whether film review should chase perfection or identify the next reachable improvement",
    "whether rehearsal needs praise alone or specific correction at the edge of ability",
  ],
  7: [
    "whether the budget decision proves the mission or treats it as decoration",
    "whether the shift huddle connects work to patients or only to throughput",
    "whether the launch model builds contribution into operations or adds charity afterward",
    "whether the career plan names who benefits beyond the client",
    "whether benefit design serves people or only protects the spreadsheet",
    "whether the city redesign can make service visible in daily choices",
  ],
  8: [
    "whether the calendar shows real energy patterns or only remembered busyness",
    "whether the studio can protect renewal before exhaustion becomes normal",
    "whether the group needs a fresh constraint to escape stale habits",
    "whether the notebook records flow and frustration clearly enough to guide redesign",
    "whether the home office needs another productivity trick or fewer motivation drains",
    "whether lunch should disappear into errands or become a deliberate reset",
  ],
  9: [
    "whether disengagement is a character flaw or a signal from the work climate",
    "whether a hack day can create bounded freedom with visible delivery",
    "whether recognition should be hierarchical theater or useful peer information",
    "whether purpose belongs to the staff or only to the executive slide deck",
    "whether flexible policy needs clearer outcomes and trust",
    "whether metrics are teaching customer success to value visibility over judgment",
  ],
  10: [
    "whether unfair pay is making every other motivation conversation useless",
    "whether the offer should signal trust or rely on a fragile incentive bargain",
    "whether internal equity problems are draining attention from the work itself",
    "whether commissions are helping customers or pushing short-term extraction",
    "whether the exit interview is really about purpose or about unresolved compensation",
    "whether the board can simplify pay enough for deeper motives to breathe",
  ],
  11: [
    "whether homework supports learning or merely proves compliance",
    "whether allowance should buy every chore or leave room for family contribution",
    "whether the project can give students real choice with a visible finish",
    "whether praise should reward being smart or name effort and strategy",
    "whether the showcase can protect curiosity without dropping standards",
    "whether feedback can guide improvement instead of training grade-chasing",
  ],
};

const chapterActions = {
  1: "Classify the work as routine or heuristic, then replace one unnecessary control with a condition that supports voluntary contribution.",
  2: "Before adding a reward, write down the intrinsic motive it might crowd out and decide whether the task needs creativity, care, or moral judgment.",
  3: "Use a reward only after fair baseline pay is settled, the path is clear, and people still have some choice over how to finish.",
  4: "Change one environmental cue so the task supports autonomy, competence, or relatedness instead of relying only on approval or pressure.",
  5: "Pick one of the four Ts and give people a bounded choice while keeping the desired outcome visible.",
  6: "Set the next practice target just beyond current ability and pair it with fast, useful feedback.",
  7: "Name the contribution the work serves and change one decision so that purpose becomes visible in behavior.",
  8: "Run a small motivation audit: record energy during the day, then remove one drain or protect one source of flow.",
  9: "Audit the work climate for autonomy, mastery, and purpose, then test one small policy change with clear outcomes.",
  10: "Check internal and external fairness first, then simplify incentives that keep people preoccupied with money.",
  11: "Add one real choice, one reason for effort, or one strategy-focused feedback note to the learning task.",
};

function loadSource(n) {
  const ch = String(n).padStart(2, "0");
  return JSON.parse(readFileSync(resolve(SOURCE_DIR, `ch${ch}.source.json`), "utf8"));
}

function norm(text) {
  return String(text).replace(/\s+/g, " ").trim();
}

function sentence(text) {
  const clean = norm(text);
  return /[.!?]$/.test(clean) ? clean : `${clean}.`;
}

function avoidSoftBanned(text) {
  return String(text).replace(/\brather than\b/gi, "instead of");
}

function firstSentence(text) {
  return sentence(norm(text).split(/(?<=[.!?])\s+/)[0] ?? text);
}

function cleanHardEdge(text) {
  const sentences = norm(text).split(/(?<=[.!?])\s+/);
  const last = sentences[sentences.length - 1] ?? text;
  const cleaned = sentence(last
    .replace(/^The sharper point is that /i, "")
    .replace(/^The stricter reading requires /i, "")
    .replace(/^The stronger interpretation is /i, "")
    .replace(/^The harder truth is that /i, "")
    .replace(/^The precise claim is tougher: /i, "")
    .replace(/^The real principle runs the other way: /i, "")
    .replace(/^The real approach /i, "The real approach "));
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function trim(text, maxWords = 26) {
  const clean = norm(text);
  const words = clean.split(/\s+/);
  if (words.length <= maxWords) return sentence(clean);
  return firstSentence(clean);
}

function personFrom(example) {
  return example.planSpec.audience.split(" and readers")[0];
}

function withoutWhether(text) {
  return norm(text).replace(/^whether\s+/i, "");
}

function shortLabel(label) {
  const beforeIn = norm(label).split(/\s+in\s+/i)[0];
  const words = beforeIn.split(/\s+/);
  return words.length <= 5 ? beforeIn : words.slice(0, 5).join(" ");
}

function pickVariant(list, chapterNumber) {
  return list[(chapterNumber - 1) % list.length];
}

function misconceptionPool(s, chapter) {
  const anchors = s.namedExamples;
  const labels = anchors.map((anchor) => shortLabel(anchor.label));
  const domains = chapter.examples.map((example) => example.planSpec.domain);
  const n = chapter.number;
  const control = pickVariant([
    "attendance checks",
    "a public leaderboard",
    "manager signoffs",
    "status rankings",
    "screen-time logs",
    "daily scorecards",
    "mission badges",
    "productivity timers",
    "approval queues",
    "commission ladders",
    "grade tokens",
  ], n);
  const structure = pickVariant([
    "budgets and deadlines",
    "baseline pay rules",
    "routines and standards",
    "feedback and expectations",
    "team agreements",
    "practice schedules",
    "profit targets",
    "calendar limits",
    "operating rituals",
    "equity checks",
    "learning boundaries",
  ], n);
  const cosmetic = pickVariant([
    "a cheerful launch memo",
    "a fresh dashboard label",
    "a better slogan",
    "a personality workshop",
    "a freedom-themed slide",
    "a praise-heavy debrief",
    "a mission poster",
    "a clever prompt card",
    "a perk announcement",
    "a compensation FAQ",
    "a classroom pep talk",
  ], n);
  const blame = pickVariant([
    "uncommitted contributors",
    "unfocused designers",
    "slow processors",
    "status-hungry employees",
    "remote slackers",
    "fragile learners",
    "selfish staff",
    "undisciplined creatives",
    "low-morale teams",
    "money-minded workers",
    "unmotivated students",
  ], n);
  const prize = pickVariant([
    "per-edit bounty",
    "innovation bonus",
    "completion coupon",
    "approval prize",
    "attendance award",
    "practice trophy",
    "purpose contest",
    "focus raffle",
    "hack-day jackpot",
    "sales kicker",
    "homework token",
  ], n);
  const visibleTail = pickVariant([
    "edit counts would outrank public contribution.",
    "the bonus metric would outrank curiosity.",
    "file totals would outrank judgment.",
    "rank position would outrank relatedness.",
    "logged hours would outrank ownership.",
    "repetition totals would outrank correction.",
    "campaign optics would outrank contribution.",
    "timer data would outrank self-observation.",
    "attendance at rituals would outrank decision rights.",
    "commission math would outrank customer trust.",
    "completed worksheets would outrank learning agency.",
  ], n);
  const structureTail = pickVariant([
    "volunteer energy would supposedly organize everything by itself.",
    "playful framing would supposedly handle every constraint.",
    "the known path would supposedly make respect unnecessary.",
    "identity labels would supposedly replace climate design.",
    "choice would supposedly erase the need for accountability.",
    "flow would supposedly remove the need for strain.",
    "mission language would supposedly settle tradeoffs alone.",
    "personal audits would supposedly fix every system around them.",
    "a perk would supposedly transform the whole climate.",
    "goodwill would supposedly make equity checks optional.",
    "student choice would supposedly replace challenge.",
  ], n);
  const oneRuleTail = pickVariant([
    "encyclopedia work, factory motion, and pricing ethics alike.",
    "fence painting, puzzle solving, and pickup fines alike.",
    "checklists, backlog cleanup, and creative diagnosis alike.",
    "review meetings, advising, and family business roles alike.",
    "scheduling, roadmap work, and creative briefs alike.",
    "piano practice, code review, and surgical simulation alike.",
    "giving models, hospital work, and career goals alike.",
    "flow logs, sabbaticals, and studio prompts alike.",
    "audits, hack days, and recognition rituals alike.",
    "salary bands, offers, and sales plans alike.",
    "homework, chores, and science projects alike.",
  ], n);
  const resourceTail = pickVariant([
    "Encarta-style funding could be dismissed without analysis.",
    "adult supervision could vanish from the fence scene.",
    "baseline compensation could be skipped during routine work.",
    "research on basic needs could be ignored.",
    "outcome clarity could disappear from autonomy experiments.",
    "coaching structure could vanish from deliberate practice.",
    "profit discipline could be removed from purpose work.",
    "organizational constraints could be ignored by individuals.",
    "management systems could be left out of the audit.",
    "market pay data could be tossed aside.",
    "adult guidance could disappear from learning.",
  ], n);
  const ownershipTail = pickVariant([
    "the wiki feels open.",
    "painting feels playful.",
    "the checklist has a bonus.",
    "the worker claims Type I identity.",
    "the schedule is flexible.",
    "practice feels absorbing.",
    "the mission sounds noble.",
    "the calendar has flow blocks.",
    "the office has autonomy language.",
    "the offer feels generous.",
    "the assignment includes a choice.",
  ], n);
  const privateTail = pickVariant([
    "wiki architecture and contribution paths could stay untouched.",
    "reward design could stay outside the Sawyer Effect discussion.",
    "rationale and choice could stay outside the routine task.",
    "basic-need support could stay outside the review process.",
    "task, time, technique, and team could stay frozen.",
    "feedback loops could stay vague during practice.",
    "daily decisions could stay detached from mission.",
    "draining obligations could stay on the calendar.",
    "decision rights could stay with the hierarchy.",
    "pay fairness could stay unresolved.",
    "grades and approval could stay as the main signal.",
  ], n);
  const fairnessTail = pickVariant([
    "the volunteer table.",
    "the puzzle lab.",
    "the records backlog.",
    "the performance review.",
    "the remote service team.",
    "the rehearsal room.",
    "the hospital huddle.",
    "the creative calendar.",
    "the peer bonus circle.",
    "the salary meeting.",
    "the classroom conference.",
  ], n);
  const permanentTail = pickVariant([
    "week-one edit volume.",
    "the first burst of puzzle effort.",
    "a single completed batch.",
    "the next review score.",
    "one remote-work sprint.",
    "a short practice streak.",
    "the launch applause.",
    "one flow-test afternoon.",
    "the hack-day demo.",
    "the next sales month.",
    "one homework cycle.",
  ], n);
  const changedTail = pickVariant([
    "the wiki rules still keep contributors outside decisions.",
    "the reward bargain still controls the activity.",
    "the dull task still offers no rationale or choice.",
    "the review climate still trains approval seeking.",
    "the four autonomy levers still sit with managers.",
    "practice feedback still arrives late and vaguely.",
    "daily tradeoffs still ignore the stated mission.",
    "the calendar still protects every old drain.",
    "decision rights still remain locked upstairs.",
    "pay comparisons still dominate attention.",
    "grades still carry the whole motivational signal.",
  ], n);
  const rewardTail = pickVariant([
    "before contributors see why the wiki matters.",
    "before the activity can feel self-chosen.",
    "before workers understand the backlog's purpose.",
    "before employees get competence or relatedness support.",
    "before the team knows the outcome standard.",
    "before learners receive useful correction.",
    "before staff see who the mission serves.",
    "before the person has mapped real energy patterns.",
    "before the group has tested its climate.",
    "before fairness is checked internally or externally.",
    "before students understand the learning purpose.",
  ], n);
  const waitTail = pickVariant([
    "until the whole wiki platform is rebuilt.",
    "until every incentive policy is replaced.",
    "until the entire backlog system is redesigned.",
    "until the whole performance process is relaunched.",
    "until every schedule rule is renegotiated.",
    "until the full practice program is rewritten.",
    "until the organization changes its charter.",
    "until the person's employer redesigns the job.",
    "until every team ritual is replaced.",
    "until the board rewrites compensation strategy.",
    "until the school changes its grading model.",
  ], n);
  const cleanTargetTail = pickVariant([
    "policing would center the edit count.",
    "scoring would center the puzzle result.",
    "tracking would center the batch total.",
    "rankings would center the review number.",
    "monitoring would center the attendance log.",
    "coaching would center the drill count.",
    "reporting would center the donation tally.",
    "tracking would center the focus streak.",
    "review would center the demo count.",
    "attention would center the sales figure.",
    "grading would center the worksheet total.",
  ], n);
  const moraleTail = pickVariant([
    "as wiki morale talk instead of contribution design.",
    "as playful framing instead of incentive design.",
    "as backlog morale talk instead of task diagnosis.",
    "as identity talk instead of climate design.",
    "as freedom talk instead of autonomy design.",
    "as confidence talk instead of practice design.",
    "as mission talk instead of decision design.",
    "as self-help talk instead of calendar design.",
    "as culture talk instead of policy design.",
    "as generosity talk instead of pay design.",
    "as encouragement talk instead of learning design.",
  ], n);
  const optionalTail = pickVariant([
    "optional once contributors seem sincere.",
    "optional once painters seem excited.",
    "optional once processors seem compliant.",
    "optional once employees claim Type I motives.",
    "optional once remote workers like the flexibility.",
    "optional once practice feels absorbing.",
    "optional once the mission sounds noble.",
    "optional once the calendar feels personal.",
    "optional once teams enjoy the ritual.",
    "optional once pay sounds generous.",
    "optional once students receive choices.",
  ], n);
  const contextTail = pickVariant([
    "wiki conditions could be checked later.",
    "the reward frame could be checked later.",
    "task design could be checked later.",
    "need support could be checked later.",
    "autonomy design could be checked later.",
    "feedback quality could be checked later.",
    "mission tradeoffs could be checked later.",
    "calendar drains could be checked later.",
    "policy signals could be checked later.",
    "pay salience could be checked later.",
    "learning signals could be checked later.",
  ], n);
  return [
    `${labels[0]} would be managed through ${control} in the ${domains[0]}; ${visibleTail}`,
    `${s.centralConcept.name} would remove ${structure} from the ${domains[1]}; ${structureTail}`,
    `${labels[1] ?? labels[0]} would justify ${cosmetic} while the ${domains[2]} stays basically unchanged.`,
    `Trouble near ${labels[2] ?? labels[0]} would point first to ${blame}; redesigning conditions would only excuse weak effort.`,
    `${labels[0]} would improve fastest by attaching a ${prize} to the ${domains[3]} and narrowing attention there.`,
    `${s.centralConcept.name} would stay inside private attitude work; ${privateTail}`,
    `${labels[1] ?? labels[0]} would make fairness less important because interest could carry ${fairnessTail}`,
    `${s.centralConcept.name} would supply one rule for ${oneRuleTail}`,
    `${resourceTail}`,
    `${ownershipTail} That would supposedly let ${labels[0]} drop ordinary constraints.`,
    `After ${permanentTail.replace(/\.$/, "")}, leaders would freeze ${s.centralConcept.name} for the ${domains[0]}.`,
    `${cosmetic} would signal change while ${changedTail}`,
    `${domains[1]} work should begin with the ${prize} ${rewardTail}`,
    `${domains[2]} should wait ${waitTail}`,
    `${domains[3]} should use ${control} first, then ask later whether ${s.centralConcept.name} lost anything important.`,
    `${labels[2] ?? labels[0]} should be simplified into the ${prize}; ${cleanTargetTail}`,
    `${labels[1] ?? labels[0]} should turn ${s.centralConcept.name} into one universal rule for ${domains[4]}.`,
    `${domains[5]} should treat ${s.centralConcept.name} ${moraleTail}`,
    `${labels[2] ?? labels[0]} should make ${structure} ${optionalTail}`,
    `${domains[1]} should drop standards quickly so ${s.centralConcept.name} feels less controlling.`,
    `${blame} should explain the ${domains[4]} result; ${contextTail}`,
    `${labels[0]} should be paired with the ${prize}; ${cleanTargetTail}`,
  ].map(sentence);
}

function explanationFor(s, q, i, chapter, detail) {
  const anchors = s.namedExamples;
  const labels = anchors.map((anchor) => shortLabel(anchor.label));
  const concept = s.centralConcept.name;
  const domain = chapter.examples[i % chapter.examples.length].planSpec.domain;
  return [
    `${concept} is the diagnostic: ${firstSentence(s.centralConcept.plainDefinition)}`,
    `${labels[0]} fits because ${firstSentence(anchors[0].teachesWhat).replace(/\.$/, "")}.`,
    `${concept} stays usable with this boundary: ${detail}`,
    `${domain} needs this source condition: ${firstSentence(q.correct).replace(/\.$/, "")}.`,
    `${labels[1] ?? labels[0]} marks the limit: ${firstSentence(q.correct).replace(/\.$/, "")}.`,
    `${labels[2] ?? labels[0]} keeps external conditions visible: ${firstSentence(q.correct).replace(/\.$/, "")}.`,
    `${domain} should test this: ${firstSentence(q.correct)}`,
    `${domain} result: ${firstSentence(s.centralConcept.whyItMatters)}`,
    `${domain} first move: ${sentence(chapterActions[chapter.number])}`,
  ][i];
}

function choiceSet(correct, wrongs, correctIndex) {
  const uniqueWrongs = wrongs.filter((w) => norm(w) !== norm(correct)).slice(0, 2);
  const choices = [];
  for (let slot = 0; slot < 3; slot += 1) {
    const choice = slot === correctIndex ? sentence(correct) : uniqueWrongs.shift();
    choices.push(avoidSoftBanned(sentence(choice).replace(/:/g, ",")));
  }
  return choices;
}

function buildQuiz(chapter, s) {
  const anchors = s.namedExamples;
  const labels = anchors.map((anchor) => shortLabel(anchor.label));
  const claims = s.keyClaims;
  const wrongs = misconceptionPool(s, chapter);
  const domains = chapter.examples.map((e) => e.planSpec.domain);
  const blooms = chapter.quiz.questions.map((q) => q.bloomsLevel);
  const depths = chapter.quiz.questions.map((q) => q.depthLevel);
  const indexes = chapter.quiz.questions.map((q) => q.correctIndex);
  const boundary = cleanHardEdge(s.hardEdge);
  const experimentTail = pickVariant([
    "track contribution quality, follow-through, and edit judgment",
    "watch voluntary return, puzzle interest, and solution breadth",
    "compare completion, respect, and method choice",
    "observe initiative, competence signals, and relatedness",
    "check output clarity, ownership, and coordination",
    "watch correction uptake, stretch, and persistence",
    "compare tradeoffs, contribution, and mission fit",
    "record energy, focus, and avoidable drains",
    "check autonomy, feedback, and shared purpose",
    "observe attention, trust, and pay salience",
    "watch agency, strategy use, and learning quality",
  ], chapter.number);
  const qdefs = [
    {
      prompt: `${s.centralConcept.name}: ${domains[0]} reward diagnostic?`,
      correct: trim(s.centralConcept.plainDefinition, 31),
      wrong: [wrongs[0], wrongs[2]],
    },
    {
      prompt: `${labels[0]} challenges paid-control assumptions in ${domains[0]}. What conclusion follows?`,
      correct: trim(anchors[0].teachesWhat, 28),
      wrong: [wrongs[8], wrongs[9]],
    },
    {
      prompt: `${s.centralConcept.name} is overstated in ${domains[2]}. Which boundary protects the claim?`,
      correct: boundary,
      wrong: [wrongs[1], wrongs[7]],
    },
    {
      prompt: `${domains[3]} faces compliance pressure. How does ${labels[0]} redirect the policy?`,
      correct: trim(claims[0], 30),
      wrong: [wrongs[14], wrongs[15]],
    },
    {
      prompt: `${labels[1] ?? labels[0]} creates a limit for ${s.centralConcept.name}. Which distinction matters?`,
      correct: trim(claims[1] ?? s.coreClaim, 30),
      wrong: [wrongs[16], wrongs[17]],
    },
    {
      prompt: `${domains[5]} hears an outcomes objection to ${labels[2] ?? labels[0]}. What correction fits?`,
      correct: trim(claims[2] ?? s.hardEdge, 30),
      wrong: [wrongs[18], wrongs[19]],
    },
    {
      prompt: `${domains[0]} experiment for ${s.centralConcept.name}: what would produce evidence?`,
      correct: sentence(`Change one ${domains[0]} condition for ${s.centralConcept.name}, then ${experimentTail}`),
      wrong: [wrongs[10], wrongs[11]],
    },
    {
      prompt: `${domains[4]} ownership fades; ${s.centralConcept.name} must interpret the output rise.`,
      correct: trim(s.centralConcept.whyItMatters, 32),
      wrong: [wrongs[20], wrongs[21]],
    },
    {
      prompt: `${s.centralConcept.name} needs a first move in ${domains[5]}. What should happen tomorrow?`,
      correct: sentence(chapterActions[chapter.number]),
      wrong: [wrongs[12], wrongs[13]],
    },
  ];

  return {
    ...chapter.quiz,
    questions: chapter.quiz.questions.map((old, i) => ({
      ...old,
      prompt: avoidSoftBanned(sentence(qdefs[i].prompt).replace(/\.$/, "?")),
      choices: choiceSet(qdefs[i].correct, qdefs[i].wrong, indexes[i]),
      explanation: avoidSoftBanned(sentence(explanationFor(s, qdefs[i], i, chapter, i === 2 ? boundary : qdefs[i].correct))),
      bloomsLevel: blooms[i],
      depthLevel: depths[i],
    })),
  };
}

function reviewFronts(chapter, s) {
  const backs = chapter.reviewCards.map((card) => firstSentence(card.back).replace(/\.$/, ""));
  return [
    `How would you explain this motivation idea: ${backs[0]}?`,
    `What source example helps explain why ${backs[1]}?`,
    `When does this supporting claim matter: ${backs[2]}?`,
    `What does the source case show when ${backs[3]}?`,
    `What design mistake is avoided when ${backs[4]}?`,
  ].map(avoidSoftBanned);
}

function rebuildExamples(chapter, s) {
  const dilemmas = chapterDilemmas[chapter.number];
  return chapter.examples.map((example, i) => {
    const person = personFrom(example);
    const domain = example.planSpec.domain;
    const anchor = s.namedExamples[i % s.namedExamples.length];
    const time = timeFor(chapter.number, i);
    const cleanTime = time.replace(/\.$/, "");
    const scenarioForms = [
      `${person} weighs ${dilemmas[i]} during the ${domain} at ${cleanTime}. ${anchor.summary}`,
      `${person} must decide ${dilemmas[i]} before the ${domain}. ${firstSentence(anchor.teachesWhat)}`,
      `${person} compares ${withoutWhether(dilemmas[i])} inside the ${domain}. ${firstSentence(s.centralConcept.whyItMatters)}`,
      `${person} tests ${dilemmas[i]} during the ${domain} using ${anchor.label}. ${firstSentence(anchor.teachesWhat)}`,
      `${person} spots ${dilemmas[i]} while reviewing the ${domain} after ${cleanTime}. ${cleanHardEdge(s.hardEdge)}`,
      `${person} writes about ${dilemmas[i]} after the ${domain}. ${firstSentence(s.coreClaim)}`,
    ];
    return {
      ...example,
      scenario: avoidSoftBanned(norm(scenarioForms[i])),
      whatToDo: avoidSoftBanned(sentence(chapterActions[chapter.number])),
    };
  });
}

function validateChapter(chapter) {
  const regenerated = [
    ...chapter.quiz.questions.flatMap((q) => [q.prompt, q.explanation, ...q.choices]),
    ...chapter.reviewCards.map((c) => c.front),
    ...chapter.examples.flatMap((e) => [e.scenario, e.whatToDo]),
  ];
  const haystack = regenerated.join("\n");
  for (const phrase of banned) {
    if (haystack.includes(phrase)) throw new Error(`${chapter.chapterId} contains banned phrase: ${phrase}`);
  }
  for (const card of chapter.reviewCards) {
    if (!card.front.endsWith("?")) throw new Error(`${card.cardId} front is not a question`);
  }
  for (const q of chapter.quiz.questions) {
    const correct = q.choices[q.correctIndex];
    q.choices.forEach((choice, i) => {
      if (/^[A-Za-z][^.!?]{1,80}:\s/.test(choice)) {
        throw new Error(`${q.questionId} choice ${i} starts with a label prefix`);
      }
      if (i !== q.correctIndex && norm(choice).includes(norm(correct))) {
        throw new Error(`${q.questionId} embeds the correct choice in distractor ${i}`);
      }
    });
  }
}

for (let n = 1; n <= 11; n += 1) {
  const ch = String(n).padStart(2, "0");
  const path = resolve(ROOT_CHAPTERS, `drive-ch${ch}.v21-native.chapter.json`);
  const chapter = JSON.parse(readFileSync(path, "utf8"));
  const source = loadSource(n);
  chapter.quiz = buildQuiz(chapter, source);
  const fronts = reviewFronts(chapter, source);
  chapter.reviewCards = chapter.reviewCards.map((card, i) => ({ ...card, front: fronts[i] }));
  chapter.examples = rebuildExamples(chapter, source);
  validateChapter(chapter);
  writeFileSync(path, `${JSON.stringify(chapter, null, 2)}\n`, "utf8");
  copyFileSync(path, resolve(AUTHORED_CHAPTERS, `drive-ch${ch}.v21-native.chapter.json`));
  console.log(`repaired drive-ch${ch}`);
}
