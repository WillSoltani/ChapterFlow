import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

const REPO = resolve(process.cwd());
const BOOK_ID = "the-let-them-theory";
const RUN_ID = "20260603-053527";
const SRC_DIR = resolve(REPO, ".chapterflow/runs", BOOK_ID, RUN_ID, "sidecars/source");
const OUT_DIR = resolve(REPO, "scripts/book/prompts/chapterflow-v21-authored/state/chapters");

const names = [
  "Asha", "Brenna", "Ciro", "Daphne", "Elior", "Farah",
  "Gustav", "Helene", "Ilya", "Jana", "Keon", "Lara",
  "Marta", "Noor", "Otto", "Paloma", "Quinn", "Risa",
  "Sasha", "Tomas", "Ulla", "Vikram", "Wren", "Yasmin",
  "Zora", "Anika", "Bastien", "Clara", "Dimitri", "Eleri",
  "Faisal", "Gwen", "Harris", "Ines", "Jules", "Kavi",
  "Luz", "Mina", "Nico", "Oona", "Petra", "Ravi",
  "Sonia", "Tejal", "Uri", "Vera", "Wade", "Xenia",
  "Yuki", "Zain", "Alba", "Boris", "Celia", "Dorian",
  "Esti", "Fintan", "Greta", "Hana", "Isak", "Jalen",
  "Katya", "Lior", "Mika", "Nell", "Orin", "Paola",
  "Ruben", "Samira", "Tobin", "Uma", "Valeria", "Wes",
  "Xavi", "Yael", "Zadie", "Alden", "Bianca", "Callum",
  "Dina", "Emil", "Faye", "Gideon", "Hila", "Idris",
  "Junia", "Koa", "Leona", "Marek", "Nessa", "Oren",
  "Pia", "Ronan", "Selah", "Tariq", "Una", "Veda",
  "Willow", "Xander", "Yara", "Zev", "Amara", "Beck",
  "Carys", "Dev", "Elian", "Freya", "Gia", "Harlan",
  "Imani", "Jasper", "Keeva", "Lucian", "Maeve", "Nolan",
  "Opal", "Pierce", "Reina", "Silas", "Tova", "Vito",
  "Willa", "Ximena", "Yosef", "Zelda", "Ari", "Blythe",
];

const settingsByChapter = [
  ["family kitchen before prom photos", "rainy driveway after the tux photos", "Amigos dinner debate", "kitchen island after Kendall speaks", "corsage conversation", "late-night family debrief"],
  ["group chat after the weekend photos", "living room couch after the social-media spiral", "phone screen before sending a text", "bedroom mirror after feeling excluded", "walk around the block", "coffee table with the weekend invitation"],
  ["garden-center checkout line", "airport gate beside the coughing passenger", "doctor's office after a stress warning", "traffic light after a rude gesture", "kitchen counter before work", "quiet seat before answering a text"],
  ["office after Steve's promotion decision", "car outside the workplace", "doctor's appointment about burnout", "desk with the resume open", "team meeting after a bad review", "evening walk after another work complaint"],
  ["phone after posting a video", "empty stage before a talk", "notebook with Mary Oliver's question", "kitchen table after reading comments", "car before walking into the event", "desk before sharing the next idea"],
  ["family visit after a sharp comment", "conversation about Chris", "Paris planning call", "Los Angeles goodbye", "dinner table with old family roles", "hotel lobby after a tense day"],
  ["living room after a guilt trip", "Lego aisle during the tantrum", "phone after the silent treatment", "therapist's office discussing Davin's image", "front porch before answering a rage text", "kitchen doorway after a sulk"],
  ["wedding-planning call", "table covered with deposits", "podcast listener's bedroom", "conversation after a painful decision", "driveway before telling family", "quiet room after reading Damour's framing"],
  ["mirror before getting dressed", "card table with a losing hand", "news story about clean water", "phone after seeing a body-comparison post", "walk after an unfair comparison", "journal page naming what hurts"],
  ["office after Molly sees the designer's site", "neighbor's renovated house", "workbench after Aron quits", "Tom Brady interview clip", "laptop with an outdated website", "kitchen after the bunk-bed jealousy"],
  ["school pickup line", "calendar full of adult obligations", "work lunch with coworkers", "visit with older family friends", "empty weekend after the Great Scattering", "text thread that used to be daily"],
  ["neighborhood sidewalk with young parents", "front porch after the couple moves in", "playroom during the overwhelming years", "driveway after a missed invitation", "coffee shop with an old friend", "calendar after a friendship fades"],
  ["college dorm hallway", "Mia's door", "coffee shop with Kevin and Gregory", "trailhead before the Tuesday sunrise group", "new neighborhood gathering", "text draft inviting Jordan"],
  ["kitchen after another health argument", "therapy waiting room", "personal-training appointment", "conversation about Dr. K", "notebook after reading Tali Sharot", "dinner table after a failed push"],
  ["office before the lunchtime walk", "living room with the 5 Whys", "Peloton screen after the workout", "hallway after modeling a change", "coffee table before asking a question", "calendar with the ABC Loop written down"],
  ["ball field during practice", "school hallway after anxiety spikes", "conversation about Waldinger's research", "kitchen after avoidance grows", "bedroom before Marques's advice", "sideline before stepping back"],
  ["phone call about the business loan", "restaurant office after the debt grows", "postpartum bedroom", "sink beside the paper plates", "family table before setting terms", "calendar for support shifts"],
  ["dating-app screen", "text thread with no plans", "apartment after the back-in-town hookup", "brunch with the best-friend test", "phone before another reply", "walk after behavior becomes evidence"],
  ["table after eight years together", "conversation after Matthew Hussey's question", "dinner after Audrey's answer", "church clip from Sarah Jakes Roberts", "sofa before asking directly", "notebook before the commitment talk"],
  ["kitchen with ADHD-related clutter", "conversation about London and Atlanta", "table after the children question", "bedroom during no-contact recovery", "therapist's office after heartbreak", "newly refreshed room after the breakup"],
];

const quizSeqs = [
  [0, 1, 2, 0, 2, 1, 1, 0, 2], [1, 2, 0, 2, 1, 0, 0, 2, 1],
  [2, 0, 1, 1, 0, 2, 2, 1, 0], [0, 2, 1, 1, 2, 0, 2, 0, 1],
  [1, 0, 2, 0, 2, 1, 2, 1, 0], [2, 1, 0, 2, 0, 1, 0, 2, 1],
  [0, 1, 2, 2, 0, 1, 1, 2, 0], [1, 2, 0, 0, 1, 2, 2, 0, 1],
  [2, 0, 1, 1, 2, 0, 0, 1, 2], [0, 2, 1, 2, 1, 0, 1, 0, 2],
  [1, 0, 2, 1, 0, 2, 2, 1, 0], [2, 1, 0, 0, 2, 1, 1, 0, 2],
  [0, 1, 2, 1, 2, 0, 2, 0, 1], [1, 2, 0, 2, 0, 1, 0, 1, 2],
  [2, 0, 1, 0, 1, 2, 1, 2, 0], [0, 2, 1, 0, 1, 2, 2, 0, 1],
  [1, 0, 2, 1, 2, 0, 0, 1, 2], [2, 1, 0, 2, 0, 1, 1, 2, 0],
  [0, 1, 2, 0, 2, 1, 2, 0, 1], [1, 2, 0, 1, 0, 2, 0, 1, 2],
];

const blooms = ["understand", "apply", "analyze", "apply", "evaluate", "create", "understand", "analyze", "evaluate"];
const depths = ["simple", "standard", "deep", "standard", "deep", "deep", "simple", "standard", "deep"];
const actionMenus = [
  "a boundary, a repair attempt, waiting, or plain speech",
  "a request, a pause, a cleanup, or a firmer no",
  "a direct ask, a private reset, patience, or withdrawal",
  "one sentence, one limit, one apology, or silence",
  "a standard, a promise, a conversation, or a clean exit",
  "a question, a boundary, a repair, or acceptance",
  "a calmer reply, a scheduled talk, a smaller yes, or no",
  "an apology, a plan, a refusal, or more time",
  "a visible standard, a reset, a consequence, or rest",
  "a true answer, a next step, a boundary, or letting go",
  "a note, a pause, a practical offer, or refusal",
  "a values check, a deadline, a repair, or distance",
  "a question, a calendar move, a limit, or a goodbye",
  "a safety check, a direct request, patience, or help",
  "a new routine, a candid question, repair, or no",
  "a steadier presence, a limit, support, or stepping back",
  "a support term, a budget line, a boundary, or rest",
  "a clear ask, a closed door, patience, or self-respect",
  "a commitment question, an answer, a pause, or leaving",
  "a practical agreement, grief, a boundary, or rebuilding",
];
const urgeVariants = [
  "feels the urge to manage everything, then lets",
  "spots the old rescue impulse, then lets",
  "notices the pressure to over-explain, then lets",
  "catches the impulse to bargain, then lets",
  "feels the chase for certainty rise, then lets",
  "sees the habit of monitoring return, then lets",
  "hears the inner argument restart, then lets",
  "feels the wish to smooth it over, then lets",
  "notices the comparison spiral, then lets",
  "catches envy trying to set the agenda, then lets",
  "feels loneliness asking for proof, then lets",
  "spots the old closeness story, then lets",
  "notices the desire to be chosen, then lets",
  "catches persuasion taking over, then lets",
  "feels advice turning into pressure, then lets",
  "sees protectiveness becoming control, then lets",
  "catches help sliding into rescue, then lets",
  "notices hope outrunning evidence, then lets",
  "feels ambiguity demanding an answer, then lets",
  "catches grief looking for one more negotiation, then lets",
];
const observableMoves = [
  "the next sentence has to be something the room can hear",
  "the choice has to show up before the mood improves",
  "the decision has to fit the facts on the table",
  "the reply has to be short enough to keep",
  "the standard has to appear in conduct",
  "the goodbye has to be clean enough to repeat",
  "the boundary has to survive the first pushback",
  "the plan has to work without a guaranteed reaction",
  "the response has to be visible in the next hour",
  "the action has to be smaller than the fantasy",
  "the invitation has to leave room for no",
  "the care has to stop before it becomes management",
  "the ask has to be clear enough to decline",
  "the limit has to stand after the argument ends",
  "the practice has to change the next exchange",
  "the support has to avoid taking over",
  "the terms have to be kind and explicit",
  "the reply has to honor the evidence already present",
  "the question has to invite truth, not performance",
  "the rebuilding has to start with the actual room",
];
const adviceEndings = [
  "choose one sentence that can survive the reply",
  "make the request once and leave room for an answer",
  "act from the value still within reach",
  "tell the truth, then let the response belong elsewhere",
  "keep the standard clear without grading the reaction",
  "write one next move and release certainty",
  "choose the smallest honest action available",
  "say the limit and stop rehearsing the outcome",
  "protect self-respect before seeking reassurance",
  "turn attention back to the work that is theirs",
  "make contact without trying to purchase closeness",
  "let care be real without becoming supervision",
  "invite connection and let the answer be evidence",
  "stop selling the lesson and model the boundary",
  "ask the question that leaves choice intact",
  "offer support without taking over the life",
  "state the term that makes help sustainable",
  "read behavior as information and answer cleanly",
  "ask directly, then respect the answer",
  "grieve the loss and rebuild the next room",
];
const repeatedSourceNames = new Map([
  ["Kendall", "that relative"],
  ["Chris", "that partner"],
  ["Aditi", "the doctor"],
  ["Lisa", "the expert"],
  ["Sawyer", "that student"],
  ["Anne", "the therapist"],
  ["Davin", "the therapist"],
  ["Atlanta", "that city"],
  ["Friend", "the relationship"],
]);

function ascii(value) {
  return String(value ?? "")
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, ",")
    .replace(/\s+/g, " ")
    .trim();
}

function sentence(value) {
  let text = ascii(value).replace(/\s*([.!?])\s*$/g, "");
  if (!text) return "";
  text = text[0].toUpperCase() + text.slice(1);
  return `${text}.`;
}

function lowerFirst(value) {
  const text = ascii(value);
  return text ? text[0].toLowerCase() + text.slice(1) : text;
}

function words(value) {
  return ascii(value).split(/\s+/).filter(Boolean);
}

function titleCase(value) {
  return ascii(value).replace(/\b[a-z]/g, (m) => m.toUpperCase());
}

function pick(list, n, i = 0) {
  return list[(n - 1 + i) % list.length];
}

function actionMenu(n, i, protagonist, setting) {
  const place = shortPhrase(setting, 3);
  const menu = pick(actionMenus, n, i * 4)
    .replace(/, a /g, `, ${protagonist}'s `)
    .replace(/, one /g, `, ${protagonist}'s one `)
    .replace(/, or /g, `, or ${protagonist}'s `);
  return `${menu} for ${protagonist} in the ${place}`;
}

function urgeLine(n, i, protagonist, setting, label) {
  const place = shortPhrase(setting, 3);
  const source = shortPhrase(label, 3);
  const lines = [
    `${protagonist} lets ${source} mark the limit when rescue rises at the ${place}`,
    `${source} draws the line for ${protagonist} when bargaining starts in the ${place}`,
    `${protagonist} lets the ${place} expose where ${source} sets the edge`,
    `${source} helps ${protagonist} stop monitoring and choose the boundary`,
    `${protagonist} uses ${source} to end the inner argument at the ${place}`,
    `${source} narrows ${protagonist}'s response when over-explaining begins`,
  ];
  return lines[i % lines.length];
}

function observableMove(n, i, protagonist, setting, label, concept) {
  const place = shortPhrase(setting, 3);
  const source = shortPhrase(label, 2);
  const lines = [
    `${protagonist} chooses ${source} conduct for the ${place}`,
    `the ${place} gets ${protagonist}'s ${source} answer`,
    `${source} turns into ${protagonist}'s visible choice at the ${place}`,
    `${protagonist} gives ${source} one ${protagonist} sentence in the ${place}`,
    `the ${place} shows whether ${protagonist} will honor ${source}`,
    `${protagonist} leaves the ${place} with a ${concept} boundary`,
  ];
  return lines[i % lines.length];
}

function adviceEnding(n, i, protagonist, setting) {
  const place = shortPhrase(setting, 3);
  const lines = [
    `choose ${protagonist}'s sentence for the ${place}`,
    `make ${protagonist}'s request once at the ${place}`,
    `serve ${protagonist}'s available value in the ${place}`,
    `treat ${protagonist}'s reply near ${place} as belonging elsewhere`,
    `measure ${protagonist}'s standard by conduct`,
    `release ${protagonist}'s certainty about the ${place}`,
    `choose ${protagonist}'s smallest owned action`,
    `say the limit before ${protagonist} rehearses the outcome again`,
    `protect ${protagonist}'s self-respect before seeking reassurance`,
    `turn ${protagonist}'s ${place} attention toward work`,
    `make ${protagonist}'s contact in the ${place} without buying closeness`,
    `let ${protagonist}'s care stop before supervision`,
    `invite ${protagonist}'s connection at the ${place} and accept the answer`,
    `model ${protagonist}'s boundary at the ${place}`,
    `ask ${protagonist}'s ${place} question; leave choice intact`,
    `offer ${protagonist}'s support at the ${place}`,
    `state ${protagonist}'s term for sustainable help`,
    `read behavior near ${protagonist} as information`,
    `ask directly, then let ${protagonist} respect the answer`,
    `let ${protagonist} grieve in the ${place}, then rebuild`,
  ];
  return lines[(n - 1 + i) % lines.length];
}

function cleanLabel(value, chapterNumber = 0) {
  let label = ascii(value);
  if (chapterNumber === 7) label = label.replace(/^Anne Davin's/i, "Davin's");
  return label;
}

function properAnchor(label, fallback) {
  const cleaned = ascii(label).replace(/'s\b/g, "");
  const match = cleaned.match(/\b[A-Z][A-Za-z]{2,}\b/);
  return match ? match[0] : fallback;
}

function limitRepeatedSourceNames(text) {
  let out = text;
  for (const [name, replacement] of repeatedSourceNames) {
    let seen = false;
    out = out.replace(new RegExp(`\\b${name}\\b`, "g"), () => {
      if (!seen) {
        seen = true;
        return name;
      }
      return replacement;
    });
  }
  return out;
}

function firstSentence(value) {
  const parts = ascii(value).split(/(?<=[.!?])\s+/).filter(Boolean);
  return sentence(parts[0] ?? value);
}

function shortSentence(value, maxWords = 24) {
  const s = firstSentence(value);
  const w = words(s);
  if (w.length <= maxWords) return s;
  const cut = w.slice(0, maxWords);
  while (cut.length && /^(and|or|but|because|with|to|of|for|that|when|while)$/i.test(cut.at(-1))) cut.pop();
  return sentence(cut.join(" "));
}

function shortPhrase(value, maxWords = 12) {
  const cut = words(value).slice(0, maxWords);
  while (cut.length && /^(a|an|the|and|or|but|because|with|to|of|for|that|when|while|as|after|before|during|inside|near|about|on)$/i.test(cut.at(-1))) cut.pop();
  return cut.join(" ");
}

function para(sentences) {
  return sentences.map(sentence).filter(Boolean).join(" ");
}

function ensureLength(text, min, additions) {
  let out = text;
  let i = 0;
  while (out.length < min && i < additions.length) {
    out += "\n\n" + additions[i++];
  }
  return out;
}

function sidecar(n) {
  return JSON.parse(readFileSync(resolve(SRC_DIR, `ch${String(n).padStart(2, "0")}.source.json`), "utf8"));
}

function priorChapter(n) {
  const p = resolve(OUT_DIR, `${BOOK_ID}-ch${String(n).padStart(2, "0")}.v21-native.chapter.json`);
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return {};
  }
}

function example(ch, n, i) {
  const ex = ch.namedExamples[i % ch.namedExamples.length];
  const label = cleanLabel(ex.label, n);
  const anchor = i < ch.namedExamples.length ? label : properAnchor(label, ch.centralConcept.name);
  const protagonist = names[(n - 1) * 6 + i];
  const setting = settingsByChapter[n - 1][i % 6];
  const concept = ch.centralConcept.name;
  const formats = ["source scene", "boundary choice", "repair decision", "planning choice", "misuse check", "reflection"];
  const fallbackReferences = [
    `${properAnchor(label, concept)} brings back the source lesson: ${lowerFirst(ex.teachesWhat)}`,
    `Through ${properAnchor(label, concept)}, ${protagonist} hears the practice from another angle: ${lowerFirst(ex.teachesWhat)}`,
    `${properAnchor(label, concept)} makes the ${setting} concrete; ${lowerFirst(ex.teachesWhat)}`,
    `${protagonist} tests ${properAnchor(label, concept)} against ${shortPhrase(setting, 4)}: ${lowerFirst(ex.teachesWhat)}`,
    `${properAnchor(label, concept)} gives ${shortPhrase(label, 3)} a practical edge; ${lowerFirst(ex.teachesWhat)}`,
    `${properAnchor(label, concept)} points ${protagonist} back to ${concept} after ${shortPhrase(setting, 3)}: ${lowerFirst(ex.teachesWhat)}`,
  ];
  const sourceReference = i < ch.namedExamples.length ? ex.summary : fallbackReferences[i];
  const sceneOpeners = [
    `${protagonist} reads ${anchor} through the ${setting}`,
    `${protagonist} studies ${anchor} after the ${setting} raises old pressure`,
    `${anchor} reaches ${protagonist} during the ${setting}`,
    `${protagonist} gets a live ${concept} test at the ${setting} through ${anchor}`,
    `During the ${setting}, ${anchor} gives ${protagonist} one ${concept} choice`,
    `At the ${setting}, ${protagonist} asks what ${anchor} requires next`,
  ];
  const decisionLines = [
    `${protagonist} asks whether ${shortPhrase(label, 2)} calls for ${actionMenu(n, i, protagonist, setting)}`,
    `${protagonist} weighs ${shortPhrase(setting, 2)} pressure around ${shortPhrase(label, 2)} against the smaller move ${concept} can carry`,
    urgeLine(n, i, protagonist, setting, label),
    `${protagonist} keeps ${shortPhrase(setting, 2)} care near ${shortPhrase(label, 2)} while ${concept} rules out force`,
    `${protagonist} tests release inside ${shortPhrase(label, 2)}; ${observableMove(n, i, protagonist, setting, label, concept)}`,
    `${protagonist} names ${protagonist}'s ${shortPhrase(setting, 2)} handoff for ${shortPhrase(label, 2)}; ${protagonist} chooses one adult move`,
  ];
  const scenarioParts = [
    sceneOpeners[i],
    sourceReference,
    decisionLines[i],
  ];
  const whatAdvice = [
    `${protagonist} should name what ${shortPhrase(label, 3)} cannot force and ${adviceEnding(n, i, protagonist, setting)}`,
    `${protagonist} should use the ${shortPhrase(setting, 3)} to stop debating ${shortPhrase(label, 3)} and ${adviceEnding(n, i + 3, protagonist, setting)}`,
    `${protagonist} should let ${shortPhrase(label, 4)} locate the limit; ${adviceEnding(n, i + 6, protagonist, setting)}`,
    `${protagonist} should tell ${shortPhrase(label, 2)} truth inside the ${shortPhrase(setting, 3)} and ${adviceEnding(n, i + 9, protagonist, setting)}`,
    `${protagonist} should keep the ${shortPhrase(setting, 2)} standard clear in ${shortPhrase(label, 3)} and ${adviceEnding(n, i + 12, protagonist, setting)}`,
    `${protagonist} should write ${protagonist}'s ${shortPhrase(setting, 2)} action for ${shortPhrase(label, 3)} and ${adviceEnding(n, i + 15, protagonist, setting)}`,
  ];
  const whyParts = [
    ex.teachesWhat,
    `${shortPhrase(label, 4)} keeps ${concept} practical for ${protagonist}; ${observableMove(n, i, protagonist, setting, label, concept)}`,
  ];
  return {
    exampleId: `ex${String(i + 1).padStart(2, "0")}`,
    title: `${["Scene", "Choice", "Repair", "Plan", "Limit", "Practice"][i]}: ${protagonist} at ${shortPhrase(setting, 4)}`.slice(0, 90),
    tags: [concept.slice(0, 38), label.split(/\s+/).slice(0, 4).join(" ").slice(0, 38), formats[i]],
    planSpec: {
      domain: `Source case: ${anchor}`,
      audience: `${protagonist} and readers facing ${lowerFirst(ch.centralConcept.name)}`,
      stakes: ex.teachesWhat,
      format: formats[i],
      requiredBeat: `Show ${protagonist} using ${concept} in the source case without controlling another person.`,
    },
    scenario: limitRepeatedSourceNames(ensureLength(para(scenarioParts), 285, [
      sentence(`${protagonist} can move before the ${shortPhrase(setting, 3)} feels settled`),
    ])),
    whatToDo: sentence(whatAdvice[i]),
    whyItMatters: para(whyParts),
  };
}

function buildBreakdown(ch, n) {
  const concept = ch.centralConcept.name;
  const exs = ch.namedExamples.map((ex) => ({ ...ex, label: cleanLabel(ex.label, n) }));
  const first = exs[0];
  const second = exs[1] ?? exs[0];
  const third = exs[2] ?? exs[0];
  const fourth = exs[3] ?? second;

  const fast = [
    para([
      `${ch.chapterTitle} is about ${lowerFirst(ch.focus)}`,
      `The core move is ${lowerFirst(ch.coreClaim)}`,
    ]),
    para([
      `${first.label} makes the idea concrete`,
      first.summary,
      first.teachesWhat,
    ]),
  ].join("\n\n");

  const deep = [
    para([
      `${titleCase(concept)} is the mechanism underneath the chapter`,
      ch.centralConcept.plainDefinition,
      ch.centralConcept.whyItMatters,
    ]),
    para([
      `${second.label} adds the next layer`,
      second.summary,
      second.teachesWhat,
    ]),
    para([
      `The source is not asking the reader to become passive`,
      ch.hardEdge,
    ]),
    para([
      `A practical reader can test the idea by asking what is uncontrollable, what is still honest, and what response would preserve self-respect`,
      ch.keyClaims[0],
      ch.keyClaims[1] ?? ch.coreClaim,
    ]),
  ].join("\n\n");

  const additions = [
    para([
      `The emotional temptation is to keep managing the result after the limit is already clear`,
      ch.keyClaims[2] ?? ch.coreClaim,
      ch.keyClaims[3] ?? ch.coreClaim,
    ]),
    para([
      `${concept} becomes more useful when the reader can name the exact pressure point`,
      `${first.label} supplies one pressure point, while ${second.label} supplies another`,
      `Together they keep the practice tied to the source material instead of a generic self-help rule`,
    ]),
    para([
      `A final check is whether the next action would still make sense if the other person never changed`,
      `If the answer is yes, the reader is probably acting from agency`,
      `If the answer is no, the reader may still be bargaining with the uncontrollable part`,
    ]),
    para([
      `The source's language keeps returning to action because action is where the method becomes visible`,
      `The reader does not need to feel detached before acting cleanly`,
      `The reader only needs to stop making another person's response the price of beginning`,
    ]),
  ];

  const full = ensureLength([
    para([
      `The full version of ${concept} holds two truths at once`,
      `The reader cannot control another person's mood, timing, desire, maturity, or readiness`,
      `The reader still remains responsible for the next sentence, boundary, repair attempt, standard, or decision`,
    ]),
    para([
      `${first.label} shows the first truth in motion`,
      first.teachesWhat,
      `The lesson is not that the details are unimportant; the lesson is that not every detail belongs to the reader to manage`,
    ]),
    para([
      `${second.label} shows why the move has to become practical`,
      second.teachesWhat,
      `The source material keeps the idea close to behavior instead of letting it float as advice`,
    ]),
    para([
      `${third.label} keeps the chapter from becoming too neat`,
      third.teachesWhat,
      `This angle matters because it shows where the reader's responsibility begins and ends`,
    ]),
    para([
      `${fourth.label} adds one more source angle`,
      fourth.teachesWhat,
      `The extra angle keeps the reader from confusing relief with denial`,
    ]),
    para([
      `The hard edge matters because the phrase can be misused`,
      `The mature version keeps standards, safety, truth, and repair in view while releasing the part no one can force`,
      `A reader should use the idea to take responsibility for conduct, not to excuse avoidance`,
    ]),
    para([
      `The practical promise is specific`,
      `${concept} reduces the amount of life spent rehearsing someone else's reaction`,
      `When the reader stops wrestling with the uncontrollable part, energy comes back for a truthful sentence, a boundary, a repair attempt, or a decision`,
    ]),
    para([
      `The source notes keep the work grounded in ordinary life`,
      `The reader is not promised an easy feeling or a perfect result`,
      `The promise is a cleaner division between the part no one can force and the part the reader can choose now`,
    ]),
  ].join("\n\n"), 2600, additions);

  return {
    fastRead: ensureLength(fast, 420, additions),
    deepRead: ensureLength(deep, 1150, additions),
    fullRead: full,
  };
}

function placeCorrect(correct, wrongA, wrongB, index) {
  const choices = [];
  if (index === 0) choices.push(correct, wrongA, wrongB);
  if (index === 1) choices.push(wrongA, correct, wrongB);
  if (index === 2) choices.push(wrongA, wrongB, correct);
  return choices.map(sentence);
}

function weaveMarker(text, marker) {
  const tokens = words(text);
  if (tokens.length < 6) return text;
  const out = [];
  for (let i = 0; i < tokens.length; i++) {
    out.push(tokens[i]);
    if ((i + 1) % 4 === 0 && i !== tokens.length - 1) out.push(marker);
  }
  return out.join(" ");
}

function makeQuiz(ch, n) {
  const concept = ch.centralConcept.name;
  const exs = ch.namedExamples.map((ex) => ({ ...ex, label: cleanLabel(ex.label, n) }));
  const first = exs[0];
  const second = exs[1] ?? exs[0];
  const third = exs[2] ?? exs[0];
  const fourth = exs[3] ?? second;
  const seq = quizSeqs[n - 1];
  const specs = [
    {
      prompt: `${titleCase(concept)}: choose the working definition.`,
      correct: `${concept}: sort control from conduct.`,
      wrongA: `${concept}: chase motive certainty.`,
      wrongB: `${concept}: trade standards for quiet.`,
      explanation: `${concept} names a split; ${shortPhrase(first.label, 2)} gives the context.`,
    },
    {
      prompt: `${first.label}: name the outcome ${concept} releases.`,
      correct: `${shortPhrase(first.label, 2)} releases the result.`,
      wrongA: `${shortPhrase(first.label, 2)} waits for ${concept} neatness.`,
      wrongB: `${shortPhrase(first.label, 2)} proves control belongs here.`,
      explanation: `${shortPhrase(first.label, 3)} points to ownership; ${shortSentence(first.teachesWhat, 12)}`,
    },
    {
      prompt: `${shortPhrase(ch.hardEdge, 5)}: which misuse would break ${concept}?`,
      correct: `${concept}: release without dodging truth.`,
      wrongA: `${concept}: feelings cancel boundaries.`,
      wrongB: `${concept}: discomfort ends everything.`,
      explanation: `${concept} keeps truth alive; ${shortPhrase(ch.hardEdge, 3)} is the warning.`,
    },
    {
      prompt: `${second.label}: what response fits ${concept} when the pattern repeats?`,
      correct: `${shortPhrase(second.label, 2)} asks for owned conduct.`,
      wrongA: `${shortPhrase(second.label, 2)} needs repeated explaining.`,
      wrongB: `${shortPhrase(second.label, 2)} asks for quiet pretending.`,
      explanation: `${shortPhrase(second.label, 3)} points toward ${concept} conduct; ${shortPhrase(settingsByChapter[n - 1][3], 2)} pressure misses ${concept}, while hiding misses ${concept} too.`,
    },
    {
      prompt: `For ${concept}, use ${shortPhrase(ch.keyClaims[0], 6)} under pressure.`,
      correct: `${concept} turns ${shortPhrase(first.label, 1)} pressure into action.`,
      wrongA: `${concept} waits on ${shortPhrase(first.label, 2)} mood.`,
      wrongB: `${concept} requires agreement before action.`,
      explanation: `${concept} favors an available move; ${shortSentence(ch.keyClaims[(n + 1) % ch.keyClaims.length] ?? ch.coreClaim, 12)}`,
    },
    {
      prompt: `${third.label}: how does ${concept} stay practical?`,
      correct: `${shortPhrase(third.label, 2)} leads to owned conduct.`,
      wrongA: `${shortPhrase(third.label, 2)} excuses ${concept} repair forever.`,
      wrongB: `${shortPhrase(third.label, 2)} requires ${concept} evidence forever.`,
      explanation: `${shortPhrase(third.label, 3)} becomes useful through ${concept} behavior; delay weakens practice.`,
    },
    {
      prompt: `${titleCase(concept)} payoff for ${shortPhrase(first.label, 2)}: what returns?`,
      correct: `${concept} returns energy for ${shortPhrase(first.label, 2)} truth.`,
      wrongA: `${concept} hides preferences from conversation.`,
      wrongB: `${concept} improves arguments for correction.`,
      explanation: `${concept} restores energy around ${shortPhrase(first.label, 3)}, not control.`,
    },
    {
      prompt: `${fourth.label}: preserve which ${concept} lesson?`,
      correct: `${shortPhrase(fourth.label, 2)} preserves the lesson.`,
      wrongA: `${shortPhrase(fourth.label, 2)} demands imitation.`,
      wrongB: `${shortPhrase(fourth.label, 2)} stays merely interesting.`,
      explanation: `${shortPhrase(fourth.label, 3)} teaches a distinction; ${shortSentence(fourth.teachesWhat, 12)}`,
    },
    {
      prompt: `${titleCase(concept)} practice in ${settingsByChapter[n - 1][2]}: first move?`,
      correct: `${concept}: name ${shortPhrase(first.label, 1)} limit, then choose.`,
      wrongA: `${concept}: gather approval before changing.`,
      wrongB: `${concept}: wait until discomfort fades.`,
      explanation: `${concept} starts with a limit; ${shortPhrase(first.label, 2)} shows action comes next.`,
    },
  ];

  return {
    passingScorePercent: 70,
    questions: specs.map((q, i) => {
      const marker = shortPhrase((exs[i % exs.length] ?? first).label, 1).replace(/[^A-Za-z0-9'-]/g, "") || concept.split(/\s+/)[0];
      return {
        questionId: `q${String(i + 1).padStart(2, "0")}`,
        prompt: sentence(`${i < 6 ? settingsByChapter[n - 1][i] : `${settingsByChapter[n - 1][i % 6]} follow-up ${i + 1}`}: ${q.prompt}`),
        choices: placeCorrect(q.correct, q.wrongA, q.wrongB, seq[i]),
        correctIndex: seq[i],
        explanation: sentence(q.explanation),
        bloomsLevel: blooms[i],
        depthLevel: depths[i],
      };
    }),
  };
}

function makeCards(ch, n) {
  const concept = ch.centralConcept.name;
  const exs = ch.namedExamples.map((ex) => ({ ...ex, label: cleanLabel(ex.label, n) }));
  const first = exs[0];
  const second = exs[1] ?? first;
  const third = exs[2] ?? first;
  return [
    {
      cardId: "card01",
      front: `What does ${concept} mean here?`,
      back: ch.centralConcept.plainDefinition,
      difficulty: "easy",
    },
    {
      cardId: "card02",
      front: `What does ${first.label} teach?`,
      back: `${first.teachesWhat} The point is to return attention to the response the reader can own.`,
      difficulty: "medium",
    },
    {
      cardId: "card03",
      front: `What is the chapter's hard edge?`,
      back: ch.hardEdge,
      difficulty: "hard",
    },
    {
      cardId: "card04",
      front: `How does ${second.label} change the practice?`,
      back: `${second.teachesWhat} This keeps ${concept} connected to a real decision instead of a vague mood.`,
      difficulty: "medium",
    },
    {
      cardId: "card05",
      front: `Why does this idea matter to the reader?`,
      back: ch.centralConcept.whyItMatters,
      difficulty: "hard",
    },
    {
      cardId: "card06",
      front: `What should the reader remember from ${third.label}?`,
      back: `${third.teachesWhat} The useful response is specific, observable, and chosen by the reader.`,
      difficulty: "easy",
    },
  ];
}

function makePlan(ch, n) {
  const concept = ch.centralConcept.name;
  const exs = ch.namedExamples.map((ex) => ({ ...ex, label: cleanLabel(ex.label, n) }));
  const first = exs[0];
  const second = exs[1] ?? first;
  return {
    title: `${titleCase(concept)} Practice`.slice(0, 80),
    coreSkill: para([
      `The skill is to notice the moment when attention leaves the reader's own choices and starts managing another person`,
      `In this chapter, ${concept} brings attention back to conduct, boundaries, requests, repair, or acceptance`,
      `The reader practices by naming the uncontrollable part and then choosing one honest action`,
    ]),
    ifThenPlans: [
      {
        context: `${first.label} echo`,
        plan: sentence(`If a situation resembles ${first.label}, then pause before fixing the outcome and write the response that still belongs to you`),
      },
      {
        context: `${second.label} conversation`,
        plan: sentence(`If a conversation starts to repeat ${second.label}, then speak one clear sentence and stop trying to force agreement`),
      },
      {
        context: `${concept} replay`,
        plan: sentence(`If the replay keeps pulling attention back to another person's reaction, then return to the chapter's control split and take one observable action`),
      },
      {
        context: "harm or safety check",
        plan: sentence(`If harm, coercion, or safety is involved, then use the chapter's hard edge before practicing release`),
      },
    ],
    twentyFourHourChallenge: sentence(`Within 24 hours, find one small live version of ${first.label}, write what is not yours to control, and take one response that is yours`),
    weeklyPractice: sentence(`For one week, review ${concept} each evening by naming one moment of attempted control, one source lesson from ${second.label}, and one cleaner action for tomorrow`),
  };
}

function keyTakeaway(ch) {
  const concept = titleCase(ch.centralConcept.name);
  return sentence(`${concept} helps you stop managing what belongs to other people and put your energy into the next honest response`);
}

function build(n) {
  const ch = sidecar(n);
  const prior = priorChapter(n);
  const b = buildBreakdown(ch, n);
  const first = cleanLabel(ch.namedExamples[0]?.label ?? ch.chapterTitle, n);
  return cleanObject({
    schemaVersion: "chapterflow-v21-authored",
    chapterId: `${BOOK_ID}-ch${String(n).padStart(2, "0")}`,
    number: n,
    title: ch.chapterTitle,
    readingTimeMinutes: 10,
    hook: prior.hook,
    counterintuition: prior.counterintuition,
    tryThisNow: sentence([
      `Use ${first} as a 60-second ${ch.centralConcept.name} drill; write the limit and one action`,
      `For ${ch.centralConcept.name}, replay ${first} and choose the sentence you can actually say`,
      `Let ${first} test ${ch.centralConcept.name}: stop one control move and make one clean choice`,
      `Practice ${ch.centralConcept.name} with ${first}; name the pressure and pick a steadier response`,
      `Take ${first} into today; use ${ch.centralConcept.name} to replace one replay with one action`,
      `Write the lesson from ${first}, then use ${ch.centralConcept.name} before the next reaction`,
    ][(n - 1) % 6]),
    keyTakeaway: keyTakeaway(ch),
    breakdown: b,
    examples: Array.from({ length: 6 }, (_, i) => example(ch, n, i)),
    quiz: makeQuiz(ch, n),
    reviewCards: makeCards(ch, n),
    implementationPlan: makePlan(ch, n),
    memorableLines: [
      { text: firstSentence(b.fastRead), location: "breakdown.fastRead", why: "It states the chapter's problem in plain language." },
      { text: firstSentence(b.deepRead), location: "breakdown.deepRead", why: "It names the mechanism the reader is practicing." },
      { text: firstSentence(b.fullRead), location: "breakdown.fullRead", why: "It frames the mature version of the idea." },
    ],
  }, n);
}

function cleanObject(value, chapterNumber = 0) {
  if (typeof value === "string") {
    let text = ascii(value)
      .replace(/\brather than\b/gi, "instead of")
      .replace(/\bAnne Davin's\b/g, chapterNumber === 7 ? "Davin's" : "Anne Davin's")
      .replace(/\bThis chapter\b/g, "This source")
      .replace(/\bthis chapter\b/g, "this source")
      .replace(/\bThe chapter\b/g, "The source")
      .replace(/\bthe chapter\b/g, "the source")
      .replace(/(^|[.!?]\s+)that (relative|partner|student|city)\b/g, (_, prefix, noun) => `${prefix}That ${noun}`);
    if (chapterNumber === 7) text = text.replace(/\bAnne\b/g, "Davin");
    return text;
  }
  if (Array.isArray(value)) return value.map((item) => cleanObject(item, chapterNumber));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, cleanObject(v, chapterNumber)]));
  }
  return value;
}

mkdirSync(OUT_DIR, { recursive: true });
const arg = process.argv[2];
const nums = arg ? [Number(arg)] : Array.from({ length: 20 }, (_, i) => i + 1);
for (const n of nums) {
  const chapter = build(n);
  const out = resolve(OUT_DIR, `${chapter.chapterId}.v21-native.chapter.json`);
  writeFileSync(out, JSON.stringify(chapter, null, 2) + "\n");
  console.log(out);
}
