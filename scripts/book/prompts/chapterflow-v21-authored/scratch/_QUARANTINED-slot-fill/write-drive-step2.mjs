import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

const ROOT = process.cwd();
const RUN = resolve(ROOT, ".chapterflow/runs/drive/20260601-083118");
const OUT = resolve(ROOT, "state/chapters");

const names = [
  ["Rowan", "Imani", "Soren", "Beatrice", "Keisha", "Galen"],
  ["Claudia", "Niko", "Yara", "Hassan", "Marta", "Ellis"],
  ["Farah", "Luis", "Anwen", "Gideon", "Rina", "Sol"],
  ["Harper", "Quentin", "Bianca", "Darius", "Iris", "Rafael"],
  ["Jun", "Calla", "Ronan", "Yvette", "Briar", "Keaton"],
  ["Silas", "Ari", "Daphne", "Hugo", "Cleo", "Ruth"],
  ["Ilya", "Seren", "Bruno", "Cassia", "Leif", "Noor"],
  ["Greta", "Jules", "Samir", "Blythe", "Kiran", "Opal"],
  ["Cora", "Desmond", "Inez", "Ravi", "Selah", "Bram"],
  ["Lin", "Gareth", "Uma", "Cedric", "Anika", "Rhea"],
  ["Orla", "Bennett", "Zara", "Micah", "Liora", "Hale"],
];

const sequences = [
  [0, 1, 2, 0, 2, 1, 1, 2, 0],
  [1, 0, 2, 2, 1, 0, 2, 0, 1],
  [2, 1, 0, 1, 0, 2, 0, 2, 1],
  [0, 2, 1, 2, 0, 1, 1, 0, 2],
  [1, 2, 0, 0, 2, 1, 2, 1, 0],
  [2, 0, 1, 1, 2, 0, 0, 1, 2],
  [0, 1, 2, 1, 2, 0, 2, 0, 1],
  [1, 0, 2, 0, 1, 2, 1, 2, 0],
  [2, 1, 0, 2, 0, 1, 0, 1, 2],
  [0, 2, 1, 0, 1, 2, 2, 1, 0],
  [1, 2, 0, 1, 0, 2, 0, 2, 1],
];

const chapters = [
  {
    n: 1,
    title: "The Rise and Fall of Motivation 2.0",
    hook: "Wikipedia beat Encarta because curiosity can organize work that control cannot see.",
    counter: "External rewards still matter, but they are a weak map for work that needs judgment, originality, and social meaning.",
    tryNow: "Name one task on your desk as routine or heuristic, then ask whether the current incentive fits that task.",
    takeaway: "Use rewards and rules where the path is clear; for creative work, design for curiosity, contribution, and self-direction.",
    fast: "In a late-1990s office, the safe bet would have been Microsoft Encarta. Paid experts, a famous company, and a conventional plan looked stronger than volunteers building Wikipedia in public. That reversal gives Motivation operating systems their bite: a system built for compliance can miss effort powered by interest and contribution. The rule is to diagnose the work before choosing the motivational tool. Routine tasks may tolerate external steering; knowledge work often needs room for internal commitment.",
    deepLead: "The failure starts when a workplace treats every human action as a response to a prize or a threat.",
    fullLead: "The limit is important: Drive is not asking leaders to toss pay, deadlines, or structure into the sea.",
    settings: ["product wiki review", "factory training room", "pricing ethics seminar", "open-source release standup", "university lab debrief", "customer support redesign"],
  },
  {
    n: 2,
    title: "Seven Reasons Carrots and Sticks Often Do Not Work",
    hook: "Tom Sawyer's fence turns payment into a warning: a prize can make play feel like labor.",
    counter: "A reward can raise effort while quietly narrowing attention, reducing candor, and draining the original appetite for the task.",
    tryNow: "Pick one reward you use or chase; write whether it invites curiosity or merely purchases compliance.",
    takeaway: "Conditional rewards are risky when the work needs insight, persistence, or ethics, because control can crowd out the motive you wanted.",
    fast: "Tom Sawyer's fence begins as a chore and becomes desirable only because other boys are allowed to treat painting as play. The Sawyer Effect names the darker reversal: add a controlling prize and an interesting activity can become a transaction. Edward Deci's Soma puzzles, Karl Duncker's candle problem, and day-care fines all show a similar fracture. The rule is not that every reward fails. The rule is to beware of if-then control when creativity, care, or moral judgment is the point.",
    deepLead: "The mechanism is crowding out: attention shifts from the work itself to the bargain attached to it.",
    fullLead: "The warning has a narrow target, and that narrowness makes it more useful.",
    settings: ["museum education desk", "design sprint room", "preschool pickup counter", "sales compensation review", "community volunteer table", "software bug bounty meeting"],
  },
  {
    n: 3,
    title: "The Special Circumstances When Rewards Do Work",
    hook: "A dull checklist can use a bonus; a blank-page problem usually needs a different fuel.",
    counter: "Pink does not abolish rewards. He asks for a stricter match between the incentive and the kind of work in front of you.",
    tryNow: "Mark one task as algorithmic or heuristic, then decide whether a reward would support it or distort it.",
    takeaway: "Rewards work best after fair pay is settled, the task is routine, and people receive rationale, respect, and some choice.",
    fast: "Algorithmic routine tasks are the exception that keeps the argument honest. If the path is clear, the work is not inherently absorbing, and baseline compensation is fair, a reward can help people finish without crowding out much curiosity. Narrow reward fit means using incentives with humility. Baseline compensation comes first, and now-that rewards should feel like appreciation rather than a lever. The rule is to diagnose the task, explain the reason, admit the dullness, and preserve autonomy wherever possible.",
    deepLead: "The useful question is not whether a reward exists, but whether it behaves like support or control.",
    fullLead: "The reward exception protects Pink's argument from becoming a slogan.",
    settings: ["warehouse closing checklist", "hospital records cleanup", "tax office backlog", "library shelving project", "field-service maintenance route", "subscription data migration"],
  },
  {
    n: 4,
    title: "Type I and Type X",
    hook: "Type I is not a personality trophy; it is behavior a climate can either feed or starve.",
    counter: "The difference between Type I and Type X is a tendency shaped by context, not a permanent ranking of better and worse people.",
    tryNow: "Choose one recurring task and note whether it is fueled mostly by interest, progress, purpose, status, or approval.",
    takeaway: "Shift behavior toward Type I by supporting autonomy, competence, and relatedness instead of relying on external pressure alone.",
    fast: "Edward Deci and Richard Ryan's Self-Determination Theory gives Type I behavior its foundation. People are more likely to thrive when autonomy, competence, and relatedness are supported. Type X behavior is not villainy; it is a pattern trained by environments that make pay, approval, and comparison the main signals. Meyer Friedman, Ray Rosenman, and Douglas McGregor supply useful contrasts, but Pink's point is practical. Change the climate and behavior can move toward internal drive.",
    deepLead: "The mechanism is basic need support, not motivational flattery.",
    fullLead: "The useful guardrail is humility about labels.",
    settings: ["performance review circle", "graduate advising session", "startup hiring panel", "music conservatory practice wing", "regional sales reset", "family business retreat"],
  },
  {
    n: 5,
    title: "Autonomy",
    hook: "Autonomy gets practical when someone can alter the task, time, technique, or team.",
    counter: "Autonomy is not isolation or an absence of standards; it is accountable self-direction inside real commitments.",
    tryNow: "Pick one project and add a small choice over task, time, technique, or team before the next work block.",
    takeaway: "Engagement rises when clear goals remain in place while people gain real choice over how work is shaped and pursued.",
    fast: "Jeff Gunther's Meddius offers a concrete doorway into autonomy. Control can produce compliance, but autonomy supports engagement because people have a say in task, time, technique, or team. Best Buy's ROWE experiment challenged the habit of equating presence with value. Atlassian FedEx Days and Google 20 percent time show task choice in a bounded form. The rule is to keep expectations visible while moving decision rights closer to the person doing the work.",
    deepLead: "The mechanism is ownership: people invest more attention when some part of the work is genuinely theirs to shape.",
    fullLead: "Autonomy has to be distinguished from everyone drifting in separate directions.",
    settings: ["clinic scheduling board", "engineering roadmap review", "remote service team", "school faculty planning day", "agency creative brief", "manufacturing improvement huddle"],
  },
  {
    n: 6,
    title: "Mastery",
    hook: "Mastery feels alive because the line keeps moving just beyond your reach.",
    counter: "Flow matters, but mastery also includes strain, correction, and the repeated sight of your own limits.",
    tryNow: "Choose one skill and write the next stretch target that is hard enough to focus you without making panic useful.",
    takeaway: "Mastery grows when challenge, feedback, and a growth mindset turn effort into progress without pretending perfection arrives.",
    fast: "Mihaly Csikszentmihalyi's flow research gives mastery its most recognizable feeling: challenge and ability meet closely enough that attention locks in. Carol Dweck's growth mindset explains why struggle can become information instead of humiliation. Deliberate practice adds the less glamorous part: correction, repetition, and discomfort. Mastery as an asymptote means the target can keep receding without making the pursuit empty. The rule is to seek the next stretch, not an easy win or an impossible leap.",
    deepLead: "The mechanism is calibrated difficulty joined to usable feedback.",
    fullLead: "The seductive misread is to treat mastery as a permanent state of absorption.",
    settings: ["piano lesson studio", "coding dojo review", "surgical simulation lab", "language tutoring call", "basketball film session", "public-speaking rehearsal"],
  },
  {
    n: 7,
    title: "Purpose",
    hook: "Purpose gives autonomy and mastery a direction larger than private achievement.",
    counter: "Purpose cannot be a wall slogan or a substitute for fair pay; it has to shape choices people can notice.",
    tryNow: "Rewrite one current goal so it names who benefits besides you and what decision would prove that benefit matters.",
    takeaway: "Purpose motivates when profit is paired with contribution, daily choices, and goals that connect work to something beyond status.",
    fast: "TOMS Shoes, the Mayo Clinic, and research by Tim Kasser and Richard Ryan make purpose more concrete than inspiration. A purpose motive connects effort to service, contribution, or meaning beyond the self. Profit does not disappear, but it stops being the only organizing aim. The rule is to look for proof in decisions, language, and daily behavior. If a mission never changes tradeoffs, it is decoration, not motivation.",
    deepLead: "The mechanism is direction: people can persist longer when effort belongs to a cause they recognize.",
    fullLead: "Purpose becomes suspicious when it is used as packaging for the same old control system.",
    settings: ["nonprofit board meeting", "hospital shift huddle", "shoe company launch review", "career coaching session", "benefits committee debate", "city service redesign"],
  },
  {
    n: 8,
    title: "Type I for Individuals",
    hook: "The personal toolkit turns motivation theory into small tests you can run on your own calendar.",
    counter: "These are not productivity tricks; each practice protects autonomy, mastery, or purpose in ordinary working life.",
    tryNow: "Set a phone alarm twice today and record whether the activity then feels absorbing, draining, useful, or empty.",
    takeaway: "Personal Type I practices help you notice flow, define purpose, practice deliberately, renew energy, and remove motivational drains.",
    fast: "Mihaly Csikszentmihalyi's flow test begins with noticing. Which activities make attention deepen, and which ones drain it? Stefan Sagmeister's sabbatical rhythm treats renewal as part of work rather than a prize after exhaustion. Brian Eno and Peter Schmidt's Oblique Strategies interrupt stale patterns with a prompt. One-sentence purpose examples force meaning into plain language. The rule is to protect internal drive with visible routines instead of waiting for ideal conditions.",
    deepLead: "The mechanism is self-observation followed by a small redesign.",
    fullLead: "The toolkit works only when it stays attached to the larger motivational nutrients.",
    settings: ["freelance planning desk", "design studio calendar audit", "writing group check-in", "graduate lab notebook", "home office reset", "creative agency lunch break"],
  },
  {
    n: 9,
    title: "Type I for Organizations",
    hook: "An organization changes motivation by changing the climate people work inside every day.",
    counter: "Perks alone do not create Type I behavior; decision rights, feedback, and purpose have to shift.",
    tryNow: "Ask one team where it lacks choice over task, time, technique, or team, and pick the smallest reversible experiment.",
    takeaway: "Organizations move toward engagement by redesigning autonomy, recognition, feedback, and purpose rather than decorating control.",
    fast: "An autonomy audit makes organizational motivation design visible. It asks where people have real choice over task, time, technique, and team. A FedEx Day creates a short, bounded burst of self-directed work. Whose purpose is it anyway tests whether a mission belongs to employees or only executives. Peer bonus practices can make appreciation immediate and informational. The rule is to alter the work environment, not just demand a better attitude.",
    deepLead: "The mechanism is climate: policies and rituals teach people what kind of motive is welcome.",
    fullLead: "The risk is cosmetic adoption, where Type I language sits on top of Type X habits.",
    settings: ["quarterly operations review", "product hack day kickoff", "peer recognition circle", "regional nonprofit retreat", "hybrid-work policy meeting", "customer success metrics workshop"],
  },
  {
    n: 10,
    title: "The Zen of Compensation",
    hook: "The best pay system often does its work by becoming less distracting.",
    counter: "Intrinsic motivation is not an excuse to underpay people; unfair money keeps everyone staring at money.",
    tryNow: "Look at one role and ask whether pay feels fair internally, fair externally, and simple enough to stop obsessing over.",
    takeaway: "Take money off the table by making pay fair, sufficient, and low-drama so autonomy, mastery, and purpose can breathe.",
    fast: "George Akerlof's gift-exchange idea points to a simple truth: pay carries social meaning. Red Gate Software and equity checks show why compensation has to feel fair before deeper motivation can take hold. Taking money off the table means reducing insecurity, resentment, and comparison, not pretending money is irrelevant. The rule is to pay enough, check internal and external fairness, and avoid incentive designs that turn complex work into bounty hunting.",
    deepLead: "The mechanism is attention: unfair pay colonizes the mind before autonomy or purpose can do much work.",
    fullLead: "This principle runs opposite to a lazy reading of Type I motivation.",
    settings: ["salary calibration meeting", "startup offer negotiation", "department equity review", "bonus redesign workshop", "employee retention interview", "board compensation committee"],
  },
  {
    n: 11,
    title: "Type I for Parents and Educators",
    hook: "Children learn motivation from the way adults handle choice, praise, homework, and chores.",
    counter: "Autonomy-supportive learning is not permissiveness; it keeps standards while reducing needless control.",
    tryNow: "Take one assignment, chore, or lesson and add either a real choice, a reason for effort, or feedback on strategy.",
    takeaway: "Parents and educators protect motivation by pairing expectations with choice, useful feedback, effort praise, and meaningful work.",
    fast: "The homework test asks whether an assignment supports autonomy, mastery, and purpose or merely fills time. A FedEx Day for kids lets children pursue a self-chosen project and show what they discovered. Carol Dweck's praise research warns against making fixed intelligence the prize. Autonomy-supportive learning keeps challenge and feedback while giving children reasons and agency. The rule is to make learning meaningful without turning every contribution into a transaction.",
    deepLead: "The mechanism is interpretation: children read adult systems as lessons about why effort matters.",
    fullLead: "The guardrail is standards with agency, not adult withdrawal.",
    settings: ["middle-school homework review", "kitchen allowance conversation", "science fair planning table", "parent-teacher conference", "after-school project showcase", "classroom feedback conference"],
  },
];

function sidecar(n) {
  const ch = String(n).padStart(2, "0");
  return JSON.parse(readFileSync(resolve(RUN, `sidecars/source/ch${ch}.source.json`), "utf8"));
}

function words(s) {
  return s.replace(/\s+/g, " ").trim();
}

function sentence(s) {
  const t = words(s);
  return /[.!?]$/.test(t) ? t : `${t}.`;
}

function limitWords(s, max = 22) {
  const parts = words(s).split(/\s+/);
  if (parts.length <= max) return words(s);
  return `${parts.slice(0, max).join(" ")}.`;
}

function summarizeExample(ex) {
  return `${ex.label}: ${ex.summary}`;
}

function buildBreakdown(d, s) {
  const named = s.namedExamples;
  const claims = s.keyClaims;
  const deep = [
    `${d.deepLead} ${s.centralConcept.name} means ${s.centralConcept.plainDefinition}`,
    `${named[0].label}: ${named[0].teachesWhat}`,
    `${named[1]?.label ?? named[0].label}: ${(named[1] ?? named[0]).teachesWhat}`,
    `${s.centralConcept.whyItMatters}`,
    `${s.focus} ${s.coreClaim}`,
  ].map(sentence).join(" ");

  const fullParts = [
    `${d.fullLead} ${s.hardEdge}`,
    `${summarizeExample(named[0])}`,
    named[1] ? `${summarizeExample(named[1])}` : `${s.centralConcept.whyItMatters}`,
    named[2] ? `${summarizeExample(named[2])}` : `${claims[3] ?? s.centralConcept.whyItMatters}`,
    `${claims.join(" ")}`,
    `${s.paraphraseNotes}`,
  ].map(sentence).join("\n\n");

  return {
    fastRead: words(d.fast),
    deepRead: words(deep),
    fullRead: fullParts,
  };
}

function buildExamples(d, s) {
  const anchors = s.namedExamples;
  const claims = s.keyClaims;
  return d.settings.map((setting, i) => {
    const anchor = anchors[i % anchors.length];
    const person = names[d.n - 1][i];
    const formats = ["decision_point", "dialogue", "audit", "planning_choice", "postmortem", "reflection"];
    const claim = claims[i % claims.length];
    const openers = [
      `${person}, 8:40 a.m. at the ${setting}: ${anchor.label}. ${anchor.summary}`,
      `${person} at noon in the ${setting}: ${anchor.label} is on the table. ${anchor.summary}`,
      `${person} marks the ${setting} memo with ${anchor.label}. ${anchor.summary}`,
      `${s.centralConcept.name} is on ${person}'s agenda for the ${setting}. ${anchor.summary}`,
      `${person} holds up ${anchor.label} during the ${setting}. ${anchor.summary}`,
      `${person}'s postmortem from the ${setting} begins with ${anchor.label}. ${anchor.summary}`,
    ];
    return {
      exampleId: `drive-ch${String(d.n).padStart(2, "0")}-ex${String(i + 1).padStart(2, "0")}`,
      title: [
        "A Misread Incentive",
        "The Calendar Test",
        "When Metrics Crowd Out Meaning",
        "A Better Design Choice",
        "The Control Signal",
        "After the Reward Debate",
      ][i],
      tags: [[ "work design", "motivation" ], [ "team choice", "practice" ], [ "ethics", "judgment" ], [ "autonomy", "decision" ], [ "management", "feedback" ], [ "reflection", "repair" ]][i],
      planSpec: {
        domain: setting,
        audience: `${person} and readers facing ${setting}`,
        stakes: `Use ${anchor.label} to apply ${s.centralConcept.name} without flattening the source lesson.`,
        format: formats[i],
        requiredBeat: `Apply ${s.centralConcept.name} through ${anchor.label} in a ${setting} situation.`,
      },
      scenario: words(`${openers[i]}`),
      whatToDo: words([
        `${anchor.teachesWhat} ${claim}`,
        `${claim} ${anchor.teachesWhat}`,
        `${anchor.teachesWhat} ${s.centralConcept.whyItMatters}`,
        `${claim} ${(anchors[(i + 1) % anchors.length] ?? anchor).teachesWhat}`,
        `${anchor.teachesWhat} ${s.hardEdge}`,
        `${claim} ${s.centralConcept.plainDefinition}`,
      ][i]),
      whyItMatters: words([
        `${s.centralConcept.whyItMatters}`,
        `${s.hardEdge}`,
        `${anchor.label} matters here because ${anchor.teachesWhat}`,
        `${s.centralConcept.plainDefinition}`,
        `${claim}`,
        `${s.paraphraseNotes.split(".")[0]}.`,
      ][i]),
    };
  });
}

function buildQuiz(d, s) {
  const seq = sequences[d.n - 1];
  const anchors = s.namedExamples;
  const qLabel = (a) => limitWords(a.label, 4).replace(/[.!?]$/, "");
  const conceptTag = limitWords(s.centralConcept.name, 3).replace(/[.!?]$/, "");
  const conceptHint = `${conceptTag} (${limitWords(s.centralConcept.plainDefinition, 4).replace(/[.!?]$/, "")})`;
  const cleanChoice = (text) =>
    text
      .replace(/^The easy mistake is to\s+/i, "Avoid: ")
      .replace(/^The tempting misread is to\s+/i, "Avoid: ")
      .replace(/^The common misread is that\s+/i, "Avoid: ")
      .replace(/^The obvious misread turns\s+/i, "Avoid turning ")
      .replace(/task, time, technique, and team/gi, "four autonomy levers")
      .replace(/task, time, technique, or team/gi, "four autonomy levers")
      .replace(/task, time, technique, and team/gi, "four autonomy levers");
  const claims = s.keyClaims;
  const pick = (arr, i) => arr[i % arr.length];
  const corrects = [
    claims[0],
    s.centralConcept.plainDefinition,
    s.hardEdge,
    `${anchors[0].teachesWhat} ${claims[1] ?? claims[0]}`,
    `${(anchors[1] ?? anchors[0]).teachesWhat} ${claims[2] ?? claims[0]}`,
    `${(anchors[2] ?? anchors[0]).teachesWhat} ${claims[3] ?? claims[0]}`,
    s.centralConcept.whyItMatters,
    s.coreClaim,
    s.focus,
  ].map((s) => sentence(limitWords(cleanChoice(s), 22)));
  const promptTails = [
    `${qLabel(anchors[0])}: preserve the source lesson for ${conceptTag}; choose the fit.`,
    `${conceptTag}: plan with ${qLabel(anchors[0])} in view; what follows?`,
    `${qLabel(anchors[1] ?? anchors[0])}: hold the boundary around ${conceptTag}; which answer fits?`,
    `${qLabel(anchors[0])}: reread the case through ${conceptTag}; pick the policy.`,
    `${conceptTag}: test the claim against ${qLabel(anchors[0])}; what overreaches?`,
    `${qLabel(anchors[2] ?? anchors[0])}: shape the debate around ${conceptTag}; what belongs?`,
    `${conceptTag}: pilot from ${qLabel(anchors[0])}; which experiment survives?`,
    `${qLabel(anchors[1] ?? anchors[0])}: read the evidence through ${conceptTag}; which interpretation fits?`,
    `${qLabel(anchors[0])}: move next under ${conceptTag}; what action starts?`,
  ];
  const wrongA = [
    `${qLabel(anchors[0])}: Reverse ${claims[0]}`,
    `${conceptTag}: Treat ${qLabel(anchors[0])} as decorative; ${conceptTag} keeps old rules intact`,
    `${qLabel(anchors[1] ?? anchors[0])}: Stretch past this limit: ${cleanChoice(s.hardEdge)}`,
    `${qLabel(anchors[0])}: Skip ${claims[1] ?? claims[0]}`,
    `${conceptTag}: Exaggerate against the guardrail: ${cleanChoice(s.hardEdge)}`,
    `${qLabel(anchors[2] ?? anchors[0])}: Flatten ${s.centralConcept.whyItMatters}`,
    `${conceptTag}: Pilot before checking ${claims[4] ?? claims[0]}`,
    `${qLabel(anchors[1] ?? anchors[0])}: Blame the person and discard ${conceptTag}`,
    `${qLabel(anchors[0])}: Preserve the condition challenged by ${claims[2] ?? claims[0]}`,
  ];
  const wrongB = [
    `${conceptTag}: Prefer supervision over ${claims[0]}`,
    `${qLabel(anchors[0])}: Praise vaguely, avoid ${conceptTag}, and skip the changed condition`,
    `${qLabel(anchors[1] ?? anchors[0])}: Force one tool onto ${claims[2] ?? claims[0]}`,
    `${conceptTag}: Reward motion while postponing ${claims[3] ?? claims[0]}`,
    `${qLabel(anchors[1] ?? anchors[0])}: Status-label reading; it forgets ${claims[0]}`,
    `${conceptTag}: Remove social meaning from ${(anchors[2] ?? anchors[0]).teachesWhat}`,
    `${qLabel(anchors[0])}: Measure compliance and miss ${s.centralConcept.whyItMatters}`,
    `${conceptTag}: Tighten monitoring before reading ${claims[1] ?? claims[0]}`,
    `${qLabel(anchors[0])}: Case retold; the condition remains ${claims[2] ?? claims[0]}`,
  ];
  const blooms = ["understand", "apply", "analyze", "apply", "evaluate", "understand", "create", "analyze", "apply"];
  const depths = ["standard", "standard", "deep", "deep", "standard", "simple", "deep", "standard", "standard"];
  const qdefs = corrects.map((correct, i) => ({
    prompt: promptTails[i],
    correct,
    wrong: [wrongA[i], wrongB[i]].map(sentence),
    blooms: blooms[i],
    depth: depths[i],
  }));
  return {
    passingScorePercent: 70,
    questions: qdefs.map((q, i) => {
      const correctIndex = seq[i];
      const choices = [];
      const wrongs = [...q.wrong];
      for (let slot = 0; slot < 3; slot++) choices.push(slot === correctIndex ? q.correct : wrongs.shift());
      const explainTails = [
        `${qLabel(pick(anchors, i))}: ${limitWords(pick(anchors, i).summary, 14)}`,
        `${conceptHint}: choose the answer that keeps ${qLabel(anchors[0])} intact.`,
        `${qLabel(pick(anchors, i))}: ${limitWords(cleanChoice(s.hardEdge), 14)}`,
        `${qLabel(pick(anchors, i))}: ${limitWords(pick(anchors, i).teachesWhat, 14)}`,
        `${conceptTag}: ${limitWords(s.centralConcept.whyItMatters, 14)}`,
        `${qLabel(pick(anchors, i))}: ${limitWords(pick(anchors, i).summary, 14)}`,
        `${conceptTag}: ${limitWords(claims[4] ?? claims[0], 14)}`,
        `${qLabel(pick(anchors, i))}: ${limitWords(claims[5] ?? claims[0], 14)}`,
        `${qLabel(pick(anchors, i))}: ${limitWords(anchors[0].summary, 14)}`,
      ];
      return {
        questionId: `drive-ch${String(d.n).padStart(2, "0")}-q${String(i + 1).padStart(2, "0")}`,
        prompt: q.prompt,
        choices,
        correctIndex,
        explanation: words(explainTails[i]),
        bloomsLevel: q.blooms,
        depthLevel: q.depth,
      };
    }),
  };
}

function buildCards(d, s) {
  const anchors = s.namedExamples;
  const cards = [
    [s.centralConcept.name, s.centralConcept.plainDefinition, "easy"],
    [anchors[0].label, `${anchors[0].summary} ${anchors[0].teachesWhat}`, "medium"],
    [s.keyClaims[0], s.keyClaims[1] ?? s.centralConcept.whyItMatters, "medium"],
    [anchors[1]?.label ?? anchors[0].label, `${(anchors[1] ?? anchors[0]).summary} ${(anchors[1] ?? anchors[0]).teachesWhat}`, "hard"],
    [s.hardEdge, s.centralConcept.whyItMatters, "hard"],
  ];
  return cards.map(([front, back, difficulty], i) => ({
    cardId: `drive-ch${String(d.n).padStart(2, "0")}-card${String(i + 1).padStart(2, "0")}`,
    front: sentence(`${front}`),
    back: sentence(`${back}`),
    difficulty,
  }));
}

function buildPlan(d, s) {
  const anchors = s.namedExamples;
  const verbs = [
    "Sort the work before choosing the motivator",
    "Inspect the hidden cost of control",
    "Use incentives only where they fit",
    "Move behavior toward internal fuel",
    "Expand accountable choice",
    "Practice at the edge of ability",
    "Make contribution visible",
    "Run a personal motivation audit",
    "Redesign the local climate",
    "Settle pay so work can breathe",
    "Support agency in learning",
  ];
  return {
    title: verbs[d.n - 1],
    coreSkill: words(`${s.centralConcept.name} becomes practical when the reader can identify the task, the current motivational signal, and the next condition to change. Use ${anchors[0].label} as the source check. The limit is clear: ${s.hardEdge}`),
    ifThenPlans: [
      {
        context: `${anchors[0].label} shows up in a current decision`,
        plan: `If ${anchors[0].label} fits the situation, then use this source lesson: ${anchors[0].teachesWhat}`,
      },
      {
        context: `${s.centralConcept.name} feels abstract`,
        plan: `If the concept sounds broad, then translate it through this source claim: ${s.keyClaims[0]}`,
      },
      {
        context: "A quick fix would be easy to announce",
        plan: `If speed is pushing the decision, then test it against this claim: ${s.keyClaims[2] ?? s.keyClaims[0]}`,
      },
    ],
    twentyFourHourChallenge: words(`Within one day, apply ${anchors[0].label} to a real decision. Write the task type, the motive being trained, and one condition you can change without pretending ${s.hardEdge.toLowerCase()}`),
    weeklyPractice: words(`For seven days, track ${s.centralConcept.name} through three source anchors: ${anchors.map((a) => a.label).join(", ")}. Each day, connect one current decision to one of those anchors.`),
  };
}

function buildMemorable(breakdown) {
  const fastSentence = breakdown.fastRead.split(/(?<=[.!?])\s+/)[0];
  const deepSentence = breakdown.deepRead.split(/(?<=[.!?])\s+/)[0];
  const fullSentence = breakdown.fullRead.split(/(?<=[.!?])\s+/)[0];
  return [
    { text: fastSentence, location: "breakdown.fastRead", why: "It opens the lesson through a concrete source scene." },
    { text: deepSentence, location: "breakdown.deepRead", why: "It names the mechanism before adding detail." },
    { text: fullSentence, location: "breakdown.fullRead", why: "It frames the limit that protects the lesson from overreach." },
  ];
}

mkdirSync(OUT, { recursive: true });
for (const d of chapters) {
  const s = sidecar(d.n);
  const breakdown = buildBreakdown(d, s);
  const chapter = {
    schemaVersion: "chapterflow-v21-authored",
    chapterId: `drive-ch${String(d.n).padStart(2, "0")}`,
    number: d.n,
    title: d.title,
    readingTimeMinutes: 8,
    hook: d.hook,
    counterintuition: d.counter,
    tryThisNow: d.tryNow,
    keyTakeaway: d.takeaway,
    breakdown,
    examples: buildExamples(d, s),
    quiz: buildQuiz(d, s),
    reviewCards: buildCards(d, s),
    implementationPlan: buildPlan(d, s),
    memorableLines: buildMemorable(breakdown),
  };
  const path = resolve(OUT, `${chapter.chapterId}.v21-native.chapter.json`);
  writeFileSync(path, JSON.stringify(chapter, null, 2) + "\n", "utf8");
  console.log(path);
}
