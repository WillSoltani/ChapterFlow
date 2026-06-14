import { readFileSync, writeFileSync, mkdirSync, rmSync } from "fs";
import { resolve } from "path";

const repo = process.cwd();
const bookId = "unreasonable-hospitality";
const runId = "20260601-083523";
const srcDir = resolve(repo, `.chapterflow/runs/${bookId}/${runId}/sidecars/source`);
const toc = JSON.parse(readFileSync(resolve(repo, `.chapterflow/runs/${bookId}/${runId}/source-freeze/toc.json`), "utf8"));
const index = JSON.parse(readFileSync(resolve(repo, `scripts/book/prompts/chapterflow-v21-authored/state/indexes/${bookId}.json`), "utf8"));
const outDir = resolve(repo, "scripts/book/prompts/chapterflow-v21-authored/state/chapters");
mkdirSync(outDir, { recursive: true });

const titleByNum = new Map(toc.flatChapters.map((c) => [c.number, c.title]));
const idByNum = new Map(index.map((c) => [c.chapterNumber, c.chapterId]));

const moves = [
  "design the feeling before chasing a better product",
  "treat care as serious work, not as a perk",
  "bring purpose to the low-status task before a title arrives",
  "protect the team first so guests can be served with real warmth",
  "buy generosity with discipline in the unglamorous details",
  "let the floor and kitchen hold equal power",
  "state the standard plainly before judging performance",
  "hire for hunger and teach the craft with patience",
  "write values where daily work can see them",
  "hand ownership to people while coaching the gap",
  "pursue excellence without treating burnout as proof",
  "give correction in the form a person can hear",
  "move praise toward the people who earned it",
  "slow ambition enough to keep the team whole",
  "answer pressure with a fresh reason to return",
  "earn informality through proof of precision",
  "replace polished ritual with a live exchange",
  "prepare tools so quick generosity can happen",
  "plant trusted people and stop being the bottleneck",
  "cut the showy parts until the mission is clear",
];

const names = [
  ["Imani","Rafael","Soren","Yasmin","Keiko","Dante"], ["Hanna","Lucia","Amir","Beatrice","Kenji","Sylvie"],
  ["Georgia","Ansel","Farah","Nikolai","Bianca","Sofia"], ["Jules","Claudia","Ronan","Inez","Dimitri","Selma"],
  ["Laila","Gareth","Chika","Benoit","Marina","Sanjay"], ["Noelle","Paulo","Greta","Yuki","Arman","Leila"],
  ["Esther","Khalil","Renata","Mika","Gideon","Alina"], ["Bruno","Asha","Celeste","Hiro","Marta","Quentin"],
  ["Freya","Ravi","Ingrid","Salim","Greer","Camille"], ["Daria","Lionel","Mei","Santiago","Helena","Arjun"],
  ["Edda","Nolan","Zara","Bastien","Lina","Kaito"], ["Miriam","Caspar","Aya","Bram","Soraya","Henrik"],
  ["Oksana","Jamal","Therese","Nico","Amara","Linus"], ["Petra","Hassan","Elowen","Tomas","Aiko","Samir"],
  ["Rhea","Ibrahim","Lotte","Jun","Anika","Celia"], ["Vera","Lorenzo","Nina","Boris","Fatima","Elias"],
  ["Sabine","Marco","Tariq","Leonie","Carmen","Dae"], ["Kira","Moussa","Astrid","Jin","Paloma","Stefan"],
  ["Maren","Cyrus","Reina","Tobias","Layla","Hugo"], ["Amina","Sasha","Iris","Matthias","Zeynep","Oscar"],
];

const domains = [
  ["hotel desk","clinic discharge","software support","museum members","airline gate","bank branch"],
  ["school office","law reception","fitness studio","library desk","wedding venue","dental lobby"],
  ["bakery counter","advising desk","repair bay","design review","festival booth","delivery hub"],
  ["taproom floor","startup intake","nursing handoff","permit window","music studio","board meeting"],
  ["market stall","accounting close","banquet kitchen","campus dining","bike shop","billing office"],
  ["wine shop","site trailer","showroom","train counter","ticket office","triage desk"],
  ["success desk","family restaurant","research lab","home showing","call room","after-school room"],
  ["box office","ops room","pharmacy counter","airport lounge","critique table","community desk"],
  ["guesthouse","launch room","city clinic","demo room","training line","gala check-in"],
  ["roastery","campaign room","urgent care","garden center","dispatch bay","assistant pod"],
  ["registration hall","rental desk","copy desk","pediatric ward","events table","team pantry"],
  ["club dining","school office","claim desk","radio studio","brunch line","legal clinic"],
  ["brewpub cellar","admissions call","portrait studio","housekeeping board","sports clinic","wine station"],
  ["prep table","project review","station kiosk","break room","yoga lobby","help desk"],
  ["lunch counter","retail floor","museum cafe","routing room","purchasing desk","arts board"],
  ["private room","pop-up shop","tasting room","clinic seminar","hotel bar","renovation consult"],
  ["reservation office","cooking school","donor dinner","community kitchen","offsite room","clinic hallway"],
  ["concierge desk","production trailer","gear store","call huddle","rehearsal hall","doctor office"],
  ["new opening","salon group","regional nonprofit","training room","hotel office","food hall"],
  ["dining pass","renewal desk","cafeteria","fitness chain","arts counter","care agency"],
];

const hooks = [
  "Fiftieth place made the scoreboard honest: perfect food still needed a human edge.",
  "A dropped napkin and a late plate of eggs made care feel like a calling.",
  "One scoop of ice cream can teach intention if the future is already named.",
  "A rescued bottle of champagne can explain why the team comes before the guest.",
  "Blue gelato spoons show how generosity survives only when the math is watched.",
  "Broken plates at Spago made the wall between kitchen and dining room impossible to ignore.",
  "Thirty quiet minutes before service can spare a team years of vague resentment.",
  "Granola at the door proved a fresh team could break rules without breaking standards.",
  "Eleven Miles Davis words turned purpose from a poster into a working tool.",
  "Bad coffee at Per Se became a lesson in giving people rooms to own.",
  "Ten hours early is not devotion when exhaustion has stolen the calendar.",
  "One design argument can teach a leader how correction should sound.",
  "A beer program grows when praise is spent on the person who built it.",
  "One lapel touch can tell a room to breathe before excellence eats it alive.",
  "Lunch got cheaper, and the restaurant became braver instead of smaller.",
  "Four stars gave permission to relax only after respect had been earned.",
  "Sea urchin can become dialogue when the guest is invited to answer back.",
  "Two dollars bought a hot dog, but the guests kept the story.",
  "A field manual cannot scale culture unless a leader trusts someone to carry it.",
  "Seven courses beat fifteen when the extra ceremony starts hiding the point.",
];

const seqs = [
  [0,1,2,0,1,2,0,1,2], [1,2,0,1,2,0,1,2,0], [2,0,1,2,0,1,2,0,1],
  [0,2,1,1,0,2,2,1,0], [1,0,2,2,1,0,0,2,1], [2,1,0,0,2,1,1,0,2],
  [0,1,2,2,0,1,1,2,0], [1,2,0,0,1,2,2,0,1], [2,0,1,1,2,0,0,1,2],
  [0,2,1,0,1,2,2,0,1], [1,0,2,1,2,0,0,1,2], [2,1,0,2,0,1,1,2,0],
  [0,1,2,1,0,2,2,1,0], [1,2,0,2,1,0,0,2,1], [2,0,1,0,2,1,1,0,2],
  [0,2,1,2,1,0,1,0,2], [1,0,2,0,2,1,2,1,0], [2,1,0,1,0,2,0,2,1],
  [0,1,2,0,2,1,2,0,1], [1,2,0,1,0,2,0,1,2],
];

function clean(x) {
  return String(x ?? "")
    .replace(/[—–]/g, "-")
    .replace(/\bthis chapter\b/gi, "this lesson")
    .replace(/\bthe chapter\b/gi, "the lesson")
    .replace(/\bthe author\b/gi, "the voice")
    .replace(/\bChapter\s+\d+\b/g, "the section")
    .replace(/\bvs\./gi, "versus")
    .replace(/\ba\.m\./g, "morning")
    .replace(/\bp\.m\./g, "evening")
    .replace(/\s+/g, " ")
    .trim();
}

function sentences(text) {
  return clean(text)
    .split(/(?<=[.!?])\s+/)
    .map((s) => clean(s))
    .filter((s) => s.length > 30)
    .filter((s) => !/\bDo NOT\b|\bKeep examples\b|\bTone:/i.test(s))
    .map((s) => /[.!?]$/.test(s) ? s : `${s}.`);
}

function labels(src) {
  return src.namedExamples.map((e) => clean(e.label));
}

function noteLines(src) {
  const out = [
    ...sentences(src.centralConcept?.plainDefinition),
    ...sentences(src.centralConcept?.whyItMatters),
    ...src.namedExamples.flatMap((e) => [...sentences(e.summary), ...sentences(e.teachesWhat)]),
    ...sentences(src.hardEdge),
    ...sentences(src.paraphraseNotes),
  ];
  const seen = new Set();
  return out.filter((s) => {
    const key = s.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function para(lines) {
  return lines.join(" ");
}

function breakdown(ch, src) {
  const l = noteLines(src);
  const concept = clean(src.centralConcept.name);
  const fast = [
    para([l[0], l[3] ?? l[1], `${labels(src)[0]} sets ${concept} in motion.`]),
    para([l[4] ?? l[2], l[5] ?? l[3]]),
  ].join("\n\n");
  const deep = [
    para([`${clean(labels(src)[0])} carries the mechanism.`, l[6] ?? l[1], l[7] ?? l[2]]),
    para([l[8] ?? l[3], l[9] ?? l[4], `${labels(src)[1] ?? labels(src)[0]} changes the stakes.`]),
    para([l[10] ?? l[5], l[11] ?? l[6], `${concept} has to survive pressure.`]),
  ].join("\n\n");
  const pool = [...l.slice(12)];
  const fullParas = [
    para([`${clean(labels(src)[1] ?? labels(src)[0])} widens the frame.`, pool[0], pool[1], pool[2]]),
    para([pool[3], pool[4], pool[5], `${labels(src)[0]} keeps fit at the center.`]),
    para([pool[6], pool[7], pool[8], pool[9]]),
    para([pool[10], pool[11], pool[12], `${labels(src)[2] ?? labels(src)[0]} gives the warning.`]),
    para([pool[18] ?? pool[13], pool[19] ?? pool[14], pool[20] ?? pool[15], `${labels(src)[0]} names prep for ${concept}.`]),
    para([`${labels(src)[0]} travels through ${concept}.`, pool[21] ?? pool[16], pool[22] ?? pool[17], `${labels(src)[0]} closes on ${moves[ch - 1]}.`]),
  ];
  let fullRead = fullParas.join("\n\n");
  const chunkSource = (text, label) => {
    const words = clean(text).split(/\s+/).filter(Boolean);
    const chunks = [];
    for (let i = 0; i < words.length; i += 12) {
      const piece = words.slice(i, i + 12).join(" ").replace(/[.!?]+$/, "");
      if (piece.length > 40) chunks.push(`${label} ${concept}: ${piece}.`);
    }
    return chunks.join(" ");
  };
  const extras = [
    chunkSource(src.hardEdge, labels(src)[0]),
    chunkSource(src.paraphraseNotes, labels(src)[1] ?? labels(src)[0]),
    chunkSource(src.centralConcept?.whyItMatters, labels(src)[2] ?? labels(src)[0]),
  ].filter((s) => s.length > 80);
  let extraIndex = 0;
  while (fullRead.length < 2500 && extras.length > 0) {
    const extra = extras[extraIndex % extras.length];
    fullRead += `\n\n${extra}`;
    extraIndex++;
  }
  return { fastRead: fast, deepRead: deep, fullRead };
}

function makeExamples(ch, src) {
  const labs = labels(src);
  const concept = clean(src.centralConcept.name);
  const chapterNames = names[ch - 1];
  const chapterDomains = domains[ch - 1];
  const exs = src.namedExamples;
  const formats = ["decision_point","dialogue","dilemma","before_after","postmortem","planning_choice"];
  return Array.from({ length: 6 }, (_, i) => {
    const ex = exs[i % exs.length];
    const label = clean(ex.label);
    const lines = noteLines(src);
    const sourceLine = lines[(i * 3 + 2) % lines.length];
    const sourceLine2 = lines[(i * 3 + 12) % lines.length];
    const sourceLine3 = lines[(i * 3 + 22) % lines.length];
    const teach = clean(ex.teachesWhat);
    const name = chapterNames[i];
    const domain = chapterDomains[i];
    const time = ["7:35 morning","10:10 morning","1:25 afternoon","3:40 afternoon","5:55 evening","8:15 evening"][i];
    const openings = [
      `${name} sees ${label} at ${time} in the ${domain}.`,
      `${name} hears ${label} during a ${domain} huddle.`,
      `${name} weighs ${label} at the ${domain}.`,
      `${name} closes the ${domain} with ${label} in mind.`,
      `${name} meets ${label} at the ${domain} board.`,
      `${name} checks a ${domain} list marked ${label}.`,
    ];
    const decisions = [
      `Before handoff, ${label} must change ${name}'s roster choice.`,
      `${name} has to answer before ${label} is flattened into speed.`,
      `Minutes before approval, ${label} must decide what ${domain} funds.`,
      `Before the review starts, ${name} must say what ${sourceLine2.split(/\s+/).slice(0, 6).join(" ")} means now.`,
      `${name} must say yes or no while ${label} is still actionable.`,
      `${name} must make ${sourceLine3.split(/\s+/).slice(0, 6).join(" ")} visible before ${label}.`,
    ];
    const scenario = `${openings[i]} ${sourceLine} ${decisions[i]}`;
    return {
      exampleId: `ex${String(i + 1).padStart(2, "0")}`,
      title: [`Roster note: ${domain}`, `Huddle choice: ${domain}`, `Marked invoice: ${domain}`, `Closing review: ${domain}`, `Permission line: ${domain}`, `Final list: ${domain}`][i],
      tags: [domain, concept.split(/\s+/)[0].toLowerCase().replace(/[^a-z]/g, ""), formats[i]],
      planSpec: {
        domain,
        audience: `People leading a ${domain}`,
        stakes: `${label} becomes a live choice rather than a story admired from afar.`,
        format: formats[i],
        requiredBeat: `Anchor the scene in ${label} and test ${moves[ch - 1]}.`,
      },
      scenario,
      whatToDo: `${name} should act from ${label}. ${sourceLine2}`,
      whyItMatters: `${teach} ${sourceLine3}`,
    };
  });
}

function makeQuiz(ch, src) {
  const labs = labels(src);
  const concept = clean(src.centralConcept.name);
  const move = moves[ch - 1];
  const people = ["Rina","Malcolm","Tovah","Luis","Eiko","Pavel","Serena","Hadi","Noemi"];
  const objects = ["roster","memo","budget note","training card","complaint log","shift huddle","handoff sheet","praise note","reset plan"];
  const seq = seqs[ch - 1];
  const promptShapes = [
    (p,o,a,line) => `${p}, ${o}: "${line}". Which action carries ${a} now?`,
    (p,o,a,line) => `${o} tension for ${p}: "${line}". What response uses ${a}?`,
    (p,o,a,line) => `Minutes left, ${p}, ${o}: "${line}". Which choice fits?`,
    (p,o,a,line) => `Spending claim, ${p}, ${a}: "${line}". What is missing?`,
    (p,o,a,line) => `${p}'s cold ${o}: "${line}". Which revision fits ${concept}?`,
    (p,o,a,line) => `${p} before arrival, ${o}: "${line}". What changes?`,
    (p,o,a,line) => `Model check for ${p}, ${o}: "${line}". Which question helps?`,
    (p,o,a,line) => `Fast call for ${p}, ${o}: "${line}". What should be protected?`,
    (p,o,a,line) => `${p} outside restaurants: "${line}". Which statement keeps faith with ${a}?`,
  ];
  return {
    passingScorePercent: 70,
    questions: Array.from({ length: 9 }, (_, i) => {
      const p = people[i], o = objects[i], a = labs[i % labs.length], ci = seq[i];
      const lineA = noteLines(src)[(i * 2 + 4) % noteLines(src).length];
      const lineB = noteLines(src)[(i * 2 + 16) % noteLines(src).length];
      const lineC = noteLines(src)[(i * 2 + 28) % noteLines(src).length];
      const correct = `${p} should use ${a} on the ${o}: ${lineA}`;
      const wrong1 = `${p} should protect the ${o} from ${a}, treating this as mainly about speed: ${lineB}`;
      const wrong2 = `${p} should copy ${a} as a fixed performance, even though the present cue says otherwise: ${lineC}`;
      const choices = ci === 0 ? [correct, wrong1, wrong2] : ci === 1 ? [wrong1, correct, wrong2] : [wrong1, wrong2, correct];
      return {
        questionId: `q${String(i + 1).padStart(2, "0")}`,
        prompt: promptShapes[i](p, o, a.split(/\s+/).slice(0, 3).join(" "), lineA.split(/\s+/).slice(i * 2, i * 2 + 7).join(" ") || lineA.split(/\s+/).slice(0, 7).join(" ")),
        choices,
        correctIndex: ci,
        explanation: `${concept} needs judgment more than mimicry. ${a} helps ${p} read the ${o}; ${lineA.split(/\s+/).slice(0, 14).join(" ")}.`,
        bloomsLevel: ["apply","analyze","evaluate","understand","apply","create","analyze","evaluate","apply"][i],
        depthLevel: ["standard","standard","deep","simple","standard","deep","standard","deep","standard"][i],
      };
    }),
  };
}

function makeCards(ch, src) {
  const labs = labels(src);
  const concept = clean(src.centralConcept.name);
  const move = moves[ch - 1];
  const backs = [
    `${labs[0]} shows why ${move}; the remembered feeling becomes part of the actual product.`,
    `${labs[1] ?? labs[0]} sharpens the memory: ${noteLines(src)[7 % noteLines(src).length]}`,
    `${concept} asks for this outcome: ${noteLines(src)[8 % noteLines(src).length]}`,
    `${clean(src.hardEdge).split(".")[0]}.`,
    `${labs[2] ?? labs[0]} matters here: ${noteLines(src)[12 % noteLines(src).length]}`,
    `${concept} fails when the business seeks applause; ${labs[0]} succeeds by centering the receiver.`,
  ];
  return backs.map((back, i) => ({
    cardId: `card${String(i + 1).padStart(2, "0")}`,
    front: [
      `What does ${labs[0]} prove?`,
      `How does ${labs[1] ?? labs[0]} sharpen the standard?`,
      `What should ${concept} name first?`,
      `What does ${labs[0]} make uncomfortable?`,
      `When does ${labs[2] ?? labs[0]} become useful?`,
      `Where can ${labs[0]} go wrong?`,
    ][i],
    back,
    difficulty: ["easy","medium","medium","hard","medium","hard"][i],
  }));
}

function makePlan(ch, src) {
  const labs = labels(src);
  const concept = clean(src.centralConcept.name);
  const move = moves[ch - 1];
  const titles = ["Feeling as Product Practice","Noble Care Rehearsal","Purposeful Small Work","Team First Standard","Disciplined Gift Audit","Equal Wall Reset","Clear Standard Habit","Attitude Hiring Screen","Values Into Service","Ownership Coaching Loop","Recovery Excellence Check","Feedback Language Match","Praise Transfer Ritual","Oxygen Pace Reset","Offense Response Sprint","Respect Then Warmth","Dialogue Gesture Lab","Legend Tool Kit","Successor Trust Map","Refinement by Subtraction"];
  return {
    title: titles[ch - 1],
    coreSkill: `${concept} starts with ${labs[0]}. Practice the move this way: ${noteLines(src)[4 % noteLines(src).length]}`,
    ifThenPlans: [
      { context: `The work starts to resemble ${labs[0]}.`, plan: `If ${labs[0]} fits the moment, then use this line as the guide: ${noteLines(src)[6 % noteLines(src).length]}` },
      { context: `A teammate cites ${labs[1] ?? labs[0]}.`, plan: `If ${labs[1] ?? labs[0]} reveals a cue, then answer with this pressure in mind: ${noteLines(src)[9 % noteLines(src).length]}` },
      { context: `The room wants to copy ${labs[2] ?? labs[0]}.`, plan: `If ${labs[2] ?? labs[0]} becomes a script, then return to the need inside this source point: ${noteLines(src)[11 % noteLines(src).length]}` },
      { context: `The cost feels awkward.`, plan: `If ${concept} costs time or money, then judge the spend by this source claim: ${noteLines(src)[13 % noteLines(src).length]}` },
    ],
    twentyFourHourChallenge: `Before one real exchange tomorrow, put ${labs[0]} on a note and use it with this reminder: ${noteLines(src)[14 % noteLines(src).length]}`,
    weeklyPractice: `Review three interactions through ${labs[0]}, ${labs[1] ?? labs[0]}, and ${labs[2] ?? labs[0]}. Then apply: ${noteLines(src)[15 % noteLines(src).length]}`,
  };
}

function chapter(ch) {
  const src = JSON.parse(readFileSync(resolve(srcDir, `ch${String(ch).padStart(2, "0")}.source.json`), "utf8"));
  const b = breakdown(ch, src);
  const concept = clean(src.centralConcept.name);
  const ml1 = b.fastRead.split(/(?<=[.!?])\s+/).find((s) => s.length > 45) ?? b.fastRead.split(/(?<=[.!?])\s+/)[0];
  const ml2 = b.deepRead.split(/(?<=[.!?])\s+/).find((s) => s.length > 60 && !s.includes("supplies")) ?? b.deepRead.split(/(?<=[.!?])\s+/)[0];
  const ml3 = b.fullRead.split(/(?<=[.!?])\s+/).reverse().find((s) => s.length > 50) ?? b.fullRead.split(/(?<=[.!?])\s+/).at(-1);
  return {
    chapterId: idByNum.get(ch),
    number: ch,
    title: titleByNum.get(ch),
    readingTimeMinutes: 10,
    hook: hooks[ch - 1],
    counterintuition: `${concept} is demanding because it treats the feeling as part of the work. The soft-looking act must be backed by standards, money, timing, and trust.`,
    tryThisNow: `Pick one interaction on tomorrow's calendar. Write the task owed, then write the feeling you want the other person to have when it ends.`,
    keyTakeaway: `Treat hospitality as a designed outcome: choose the feeling first, then shape the service, standard, budget, and authority around ${moves[ch - 1]}.`,
    breakdown: b,
    examples: makeExamples(ch, src),
    quiz: makeQuiz(ch, src),
    reviewCards: makeCards(ch, src),
    implementationPlan: makePlan(ch, src),
    memorableLines: [
      { text: ml1.trim(), location: "breakdown.fastRead", why: "It states the chapter's practical rule in concrete terms." },
      { text: ml2.trim(), location: "breakdown.deepRead", why: "It turns the source case into a usable operating test." },
      { text: ml3.trim(), location: "breakdown.fullRead", why: "It gives the reader a clean closing standard." },
    ],
  };
}

rmSync(resolve(outDir), { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
for (let i = 1; i <= 20; i++) {
  const c = chapter(i);
  writeFileSync(resolve(outDir, `${c.chapterId}.v21-native.chapter.json`), JSON.stringify(c, null, 2) + "\n");
  console.log(`wrote ${c.chapterId}`);
}
