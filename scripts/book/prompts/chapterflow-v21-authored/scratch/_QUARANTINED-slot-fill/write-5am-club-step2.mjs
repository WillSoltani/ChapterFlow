import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const bookId = "the-5-am-club";
const runId = "20260601-083520";
const indexPath = path.join(root, "scripts/book/prompts/chapterflow-v21-authored/state/indexes/the-5-am-club.json");
const sourceDir = path.join(root, ".chapterflow/runs", bookId, runId, "sidecars/source");
const outDir = path.join(root, "scripts/book/prompts/chapterflow-v21-authored/state/chapters");

const index = JSON.parse(fs.readFileSync(indexPath, "utf8"));

const names = [
  ["Samir", "Asha", "Irene", "Darius", "Clara", "Benicio"],
  ["Rina", "Keiko", "Solomon", "Luca", "Farah", "Bennett"],
  ["Lucia", "Greta", "Kiran", "Hassan", "Ivy", "Jules"],
  ["Yara", "Marina", "Sofia", "Nikolai", "Opal", "Rafael"],
  ["Gideon", "Bianca", "Freya", "Cedric", "Daphne", "Emil"],
  ["Mara", "Hana", "Leandro", "Isaac", "Jun", "Karina"],
  ["Uma", "Noor", "Soren", "Pavel", "Quinn", "Rosa"],
  ["Alina", "Vera", "Zara", "Wesley", "Ximena", "Yusuf"],
  ["Gemma", "Bruno", "Florin", "Celine", "Devon", "Esra"],
  ["Milos", "Helena", "Leila", "Ibrahim", "Joelle", "Kaito"],
  ["Valeria", "Nora", "Umair", "Paolo", "Rhea", "Silas"],
  ["Chiara", "Willa", "Boris", "Yasmin", "Zev", "Anika"],
  ["Ines", "Diego", "Hiro", "Eleni", "Faris", "Gwen"],
  ["Orla", "Jana", "Neve", "Kamau", "Livia", "Mikhail"],
  ["Vikram", "Petra", "Ursula", "Ravi", "Selene", "Tomas"],
  ["Dimitri", "Yvonne", "Cora", "Zain", "Amara", "Bastien"],
  ["Jovana", "Etta", "Idris", "Fumiko", "Galen", "Harini"],
  ["Pilar", "Katia", "Oksana", "Laszlo", "Mei", "Nico"],
];

const settings = [
  ["Monday at 7:40 am", "in the boardroom", "founder", "term sheet"],
  ["Tuesday at 4:15 pm", "beside the studio whiteboard", "designer", "launch sketch"],
  ["Wednesday at 11:30 am", "on the hospital ward", "nurse", "shift chart"],
  ["Thursday at 2:05 pm", "inside the classroom", "teacher", "lesson plan"],
  ["Friday at 5:45 pm", "at the kitchen table", "parent", "family calendar"],
  ["Saturday at 9:10 am", "in the training room", "coach", "practice sheet"],
];

const formats = ["decision_point", "dialogue", "dilemma", "planning_choice", "mistake_recovery", "audit"];
const bloom = ["apply", "analyze", "evaluate", "understand", "apply", "create", "analyze", "evaluate", "remember"];
const depth = ["standard", "deep", "deep", "simple", "standard", "deep", "standard", "deep", "simple"];
const answerPatterns = [
  [0, 1, 2, 1, 2, 0, 2, 0, 1],
  [1, 2, 0, 2, 0, 1, 0, 1, 2],
  [2, 0, 1, 0, 1, 2, 1, 2, 0],
  [0, 2, 1, 2, 1, 0, 1, 0, 2],
  [1, 0, 2, 0, 2, 1, 2, 1, 0],
  [2, 1, 0, 1, 0, 2, 0, 2, 1],
  [0, 1, 2, 2, 0, 1, 1, 2, 0],
  [1, 2, 0, 0, 1, 2, 2, 0, 1],
  [2, 0, 1, 1, 2, 0, 0, 1, 2],
  [0, 2, 1, 1, 0, 2, 2, 1, 0],
  [1, 0, 2, 2, 1, 0, 0, 2, 1],
  [2, 1, 0, 0, 2, 1, 1, 0, 2],
  [0, 2, 1, 0, 1, 2, 2, 0, 1],
  [1, 0, 2, 1, 2, 0, 0, 1, 2],
  [2, 1, 0, 2, 0, 1, 1, 2, 0],
  [0, 1, 2, 0, 2, 1, 1, 0, 2],
  [1, 2, 0, 1, 0, 2, 2, 1, 0],
  [2, 0, 1, 2, 1, 0, 0, 2, 1],
];

function clean(s) {
  return String(s ?? "")
    .replace(/[—–]/g, ",")
    .replace(/\b([ap])\.m\./gi, "$1m")
    .replace(/\bchapter\b/gi, "lesson")
    .replace(/\bbook\b/gi, "work")
    .replace(/\bthe author\b/gi, "the mentor")
    .replace(/\bRobin Sharma\b/g, "the mentor")
    .replace(/\bthe 4 focuses of history[- ]makers\b/gi, "four-part maker focus")
    .replace(/\bthe 10 tactics of lifelong genius\b/gi, "lifelong genius tactics")
    .replace(/\bthe twin cycles of elite performance\b/gi, "paired excellence cycles")
    .replace(/\.\.+/g, ".")
    .replace(/\s+/g, " ")
    .trim();
}

function sentence(s) {
  const t = clean(s).replace(/\.$/, "");
  const capped = t ? t.charAt(0).toUpperCase() + t.slice(1) : "";
  return capped ? `${capped}.` : "";
}

function words(s, n) {
  return clean(s).split(/\s+/).slice(0, n).join(" ");
}

function sourceSentences(source) {
  const texts = [
    source.centralConcept?.plainDefinition,
    source.centralConcept?.whyItMatters,
    source.coreClaim,
    source.focus,
    source.hardEdge,
    source.paraphraseNotes,
    ...(source.keyClaims ?? []),
    ...(source.voiceCues ?? []),
    ...(source.namedExamples ?? []).flatMap((x) => [x.label, x.summary, x.teachesWhat]),
  ];
  const joined = texts.map(clean).filter(Boolean).join(". ");
  return joined
    .split(/(?<=[.!?])\s+/)
    .map((s) => clean(s).replace(/\.$/, ""))
    .filter((s) => s.length > 35);
}

function snippet(source, i, n = 24) {
  const sents = sourceSentences(source);
  const picked = sents[i % sents.length] || clean(source.hardEdge || source.centralConcept?.plainDefinition);
  return words(picked, n).replace(/[,:;]$/, "");
}

function snippetTail(source, i, n = 24, offset = 8) {
  const sents = sourceSentences(source);
  const picked = sents[i % sents.length] || clean(source.hardEdge || source.centralConcept?.plainDefinition);
  const parts = clean(picked).split(/\s+/);
  const start = Math.min(Math.max(0, parts.length - n), offset);
  return parts.slice(start, start + n).join(" ").replace(/[,:;]$/, "");
}

function properAnchors(source) {
  const titleWords = new Set(clean(source.chapterTitle).toLowerCase().split(/[^a-z0-9'-]+/).filter((w) => w.length >= 4));
  const text = [
    ...(source.namedExamples ?? []).flatMap((x) => [x.label, x.summary]),
    source.centralConcept?.name,
    source.centralConcept?.plainDefinition,
    source.hardEdge,
    source.paraphraseNotes,
  ].map(clean).join(" ");
  const matches = text.match(/\b[A-Z][a-zA-Z']{3,}(?:\s+[A-Z][a-zA-Z']{3,}){0,3}\b/g) ?? [];
  const seen = new Set();
  const out = [];
  for (const m of matches) {
    const t = clean(m).replace(/^The\s+/, "");
    const first = t.split(/\s+/)[0]?.toLowerCase();
    if (!t || titleWords.has(first) || ["This", "That", "Readers", "Waking", "Morning"].includes(t)) continue;
    const key = t.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(t);
    }
  }
  return out.length ? out : [clean(source.centralConcept?.name), anchorFor(source, 0)].filter(Boolean);
}

function trimChars(s, max) {
  const t = clean(s);
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  return cut.slice(0, Math.max(0, cut.lastIndexOf(" "))).replace(/[,:;]$/, "") + ".";
}

const chapterGlue = [
  ["threshold", "inventory", "penthouse", "legal fight", "future"],
  ["philosophy", "seminar", "audience", "fatigue", "behavior"],
  ["stranger", "disguise", "reveal", "credentials", "receptivity"],
  ["average", "challenge", "talent", "health", "courage"],
  ["invitation", "journey", "cues", "tools", "commitment"],
  ["flight", "craft", "wound", "standards", "practice"],
  ["Mauritius", "retreat", "beauty", "friction", "calm"],
  ["Victory", "hour", "scrolling", "renewal", "design"],
  ["empires", "heartset", "healthset", "soulset", "balance"],
  ["focuses", "capitalization", "stacks", "distraction", "genius"],
  ["tides", "ocean", "steadiness", "agency", "hope"],
  ["installation", "days", "phases", "discomfort", "continuation"],
  ["formula", "move", "reflect", "grow", "sequence"],
  ["sleep", "evening", "recovery", "digital", "stewardship"],
  ["tactics", "bubble", "ninety", "resources", "integration"],
  ["cycles", "excellence", "refueling", "burnout", "contribution"],
  ["hero", "mortality", "service", "love", "legacy"],
  ["years", "compounding", "support", "recommitment", "legacy"],
];

function glue(chIndex, i) {
  return chapterGlue[chIndex % chapterGlue.length][i % 5];
}

function keyTerms(source) {
  const values = [
    source.centralConcept?.name,
    source.chapterTitle,
    ...(source.namedExamples ?? []).map((x) => x.label),
  ];
  return values.map(clean).filter(Boolean);
}

function anchorFor(source, i) {
  const examples = source.namedExamples ?? [];
  return clean(examples[i % examples.length]?.label ?? source.centralConcept?.name ?? source.chapterTitle);
}

function takeawayFor(source) {
  const concept = clean(source.centralConcept?.name);
  const claim = clean(source.centralConcept?.plainDefinition || source.coreClaim || source.hardEdge);
  return trimChars(`Practice ${concept} by treating ${words(claim, 17).toLowerCase()} as a design signal, not as background noise.`, 215);
}

const hookTemplates = [
  (s) => `${anchorFor(s, 0)} turns success into an emergency before sunrise.`,
  (s) => `A seminar line means little until ${snippet(s, 1, 9).toLowerCase()} tests it.`,
  (s) => `${anchorFor(s, 0)} makes wisdom arrive in the wrong clothes.`,
  (s) => `${anchorFor(s, 0)} asks what talent loses when average becomes shelter.`,
  (s) => `${anchorFor(s, 0)} pulls the learners away from their usual cues.`,
  (s) => `High standards sound noble until ${snippet(s, 2, 9).toLowerCase()} enters the cabin.`,
  (s) => `${anchorFor(s, 0)} makes the setting part of the training.`,
  (s) => `The alarm matters only after the hour has a job worth waking for.`,
  (s) => `${anchorFor(s, 0)} refuses to let mindset carry the whole load.`,
  (s) => `${anchorFor(s, 0)} turns ambition into blocks, borders, and practice.`,
  (s) => `${anchorFor(s, 0)} teaches steadiness without asking anyone to drift.`,
  (s) => `${anchorFor(s, 0)} makes discomfort feel expected instead of fatal.`,
  (s) => `${anchorFor(s, 0)} gives the first hour three different kinds of work.`,
  (s) => `A 5 AM routine begins the night before the alarm sounds.`,
  (s) => `${anchorFor(s, 1)} makes genius look scheduled, guarded, and recovered.`,
  (s) => `${anchorFor(s, 0)} protects excellence from the burnout it can create.`,
  (s) => `${anchorFor(s, 0)} makes mortality the mentor nobody can ignore.`,
  (s) => `${anchorFor(s, 0)} shows what years of recommitment can compound.`,
];

const tryTemplates = [
  (s) => `Write the hidden cost named by ${anchorFor(s, 0)}, then choose one dawn repair that answers it before messages.`,
  (s) => `Choose one belief from ${anchorFor(s, 0)} and convert it into a visible behavior before noon tomorrow.`,
  (s) => `List one place where you dismiss wisdom by appearance, then name the question you would ask anyway.`,
  (s) => `Circle one average pattern draining talent, health, or courage, then remove its next cue today.`,
  (s) => `Move one tool, tab, or object tonight so tomorrow morning begins in a changed environment.`,
  (s) => `Pick one standard you dropped after a wound, then schedule ten minutes of deliberate practice tomorrow.`,
  (s) => `Make your first workspace calmer tonight: remove one friction point and add one cue of beauty.`,
  (s) => `Write the three blocks of your next Victory Hour and put the phone outside the room.`,
  (s) => `Mark one action for mind, heart, body, and values before planning tomorrow's output.`,
  (s) => `Block one 90-minute session for your best asset and name the single result it must create.`,
  (s) => `Name the tide you cannot control, then write the practice you will keep while it moves.`,
  (s) => `Place your habit on a 66-day page and label the hard middle before it arrives.`,
  (s) => `Plan tomorrow's Move, Reflect, and Grow blocks with one concrete action in each.`,
  (s) => `Set tonight's sleep boundary now: device away, lights down, and wake time protected by rest.`,
  (s) => `Choose one genius tactic and tie it to meaningful work instead of adding another hack.`,
  (s) => `Pair tomorrow's hardest work block with a named recovery block before the calendar fills.`,
  (s) => `Write one act of service that would make discipline matter beyond your own mood.`,
  (s) => `Choose one support, repetition, or recommitment that would still matter five years from now.`,
];

function hookFor(source, chIndex) {
  return trimChars(hookTemplates[chIndex % hookTemplates.length](source), 118);
}

function tryFor(source, chIndex) {
  return trimChars(tryTemplates[chIndex % tryTemplates.length](source), 220);
}

function paragraph(parts) {
  return parts.map(sentence).join(" ");
}

function breakdown(source, n, chIndex = 0) {
  const concept = clean(source.centralConcept?.name);
  const ex0 = anchorFor(source, 0);
  const ex1 = anchorFor(source, 1);
  const title = clean(source.chapterTitle);

  const fast = [
    paragraph([
      `${ex0} opens on ${concept} through ${glue(chIndex, 0)}`,
      `${snippet(source, 0, 20)}`,
      `${snippet(source, 1, 20)}`,
    ]),
    paragraph([
      `${title} earns its ${glue(chIndex, 1)} rule`,
      `${snippet(source, 4, 24)}`,
      `${concept} gives the morning one job: answer ${glue(chIndex, 2)} with structure`,
    ]),
  ].join("\n\n");

  const deep = [
    paragraph([
      `${concept} works through ${glue(chIndex, 3)} placement`,
      `${snippet(source, 1, 16)} gives the first cue for ${glue(chIndex, 0)}`,
      `${snippet(source, 2, 16)} gives the second cue for ${glue(chIndex, 1)}`,
    ]),
    paragraph([
      `${ex1} widens ${glue(chIndex, 4)} pressure`,
      `${snippet(source, 5, 17)} points toward ${glue(chIndex, 2)}`,
      `${snippet(source, 6, 17)} rejects ${glue(chIndex, 3)} display`,
    ]),
    paragraph([
      `${title} lets dawn test ${glue(chIndex, 2)}`,
      `${snippet(source, 8, 16)} tests the ${glue(chIndex, 2)} morning`,
      `${glue(chIndex, 4)} ${snippet(source, 9, 16)} grounds ${glue(chIndex, 3)} practice`,
    ]),
    paragraph([
      `${concept} requires a ${glue(chIndex, 4)} trade`,
      `${snippet(source, 10, 17)} names the trade`,
      `${glue(chIndex, 0)} has to become conduct before the day tests it`,
    ]),
    paragraph([
      `${ex0} keeps ${glue(chIndex, 1)} concrete`,
      `${snippet(source, 11, 17)} gives the concrete cue`,
      `${glue(chIndex, 1)} needs practice while ${glue(chIndex, 2)} is still fresh`,
    ]),
  ].join("\n\n");

  const full = [
    paragraph([
      `${concept} needs a limit as much as a promise about ${glue(chIndex, 2)}`,
      `${snippetTail(source, 2, 34)}`,
      `${snippetTail(source, 3, 34)}`,
    ]),
    paragraph([
      `${ex0} brings ${glue(chIndex, 3)} into view`,
      `${snippetTail(source, 6, 38)}`,
      `${snippetTail(source, 7, 38)}`,
    ]),
    paragraph([
      `${ex1} sharpens ${glue(chIndex, 4)} from another side`,
      `${snippetTail(source, 7, 40)}`,
      `${snippetTail(source, 8, 40)}`,
    ]),
    paragraph([
      `${title} brings ordinary readers toward ${glue(chIndex, 0)}`,
      `${snippetTail(source, 9, 42)}`,
      `${snippetTail(source, 10, 42)}`,
    ]),
    paragraph([
      `${concept} can fail when ${glue(chIndex, 0)} becomes performance`,
      `${snippetTail(source, 11, 42)}`,
      `${snippetTail(source, 12, 42)}`,
    ]),
    paragraph([
      `${ex0} and ${ex1} keep ${glue(chIndex, 2)} grounded`,
      `${snippetTail(source, 10, 42)}`,
      `${snippetTail(source, 13, 42)}`,
    ]),
    paragraph([
      `${title} leaves a ${glue(chIndex, 1)} standard`,
      `${snippetTail(source, 11, 42)}`,
      `${snippetTail(source, 14, 42)}`,
    ]),
    paragraph([
      `${concept} gains force when ${glue(chIndex, 0)} names the hour`,
      `${snippetTail(source, 15, 44)}`,
      `${snippetTail(source, 16, 44)}`,
    ]),
    paragraph([
      `${glue(chIndex, 2)} is the final check`,
      `${snippetTail(source, 17, 44)}`,
      `Do the hour in a way that leaves ${glue(chIndex, 3)} more honest than it was at waking`,
    ]),
    paragraph([
      `${concept} also needs evidence in ${glue(chIndex, 4)}`,
      `${snippetTail(source, 18, 44)}`,
      `Repeated mornings should clarify ${glue(chIndex, 4)} for the ${glue(chIndex, 0)} life being built`,
    ]),
  ].join("\n\n");

  return { fastRead: fast, deepRead: deep, fullRead: full };
}

function example(source, chIndex, i) {
  const [baseTime, basePlace, role, baseObject] = settings[(i + chIndex) % settings.length];
  const time = baseTime.replace(/:(\d{2})/, (_, mm) => `:${String((Number(mm) + chIndex * 3 + i * 2) % 60).padStart(2, "0")}`);
  const place = basePlace.replace(/\bthe\b/, `the ${glue(chIndex, i)}`);
  const object = `${glue(chIndex, i + 1)} ${baseObject}`;
  const name = names[chIndex][i];
  const concept = clean(source.centralConcept?.name);
  const anchors = properAnchors(source);
  const anchor = anchors[i % anchors.length] || anchorFor(source, i);
  const anchorText = anchor === "Victory Hour" ? "victory-hour method" : anchor;
  const actionAnchor = anchorText === "victory-hour method" ? `the ${glue(chIndex, i + 5)} protected hour` : anchorText;
  const summary = snippet(source, i + 3, 28);
  const format = formats[i % formats.length];
  const decisionCue = i % 3 === 0 ? "must decide" : i % 3 === 1 ? "has to choose" : "minutes before";
  const responseCue = [
    `weighs a ${glue(chIndex, i + 1)} reply for`,
    `chooses the ${glue(chIndex, i + 2)} next move after`,
    `drafts a ${glue(chIndex, i + 3)} answer around`,
    `names the ${glue(chIndex, i + 4)} decision inside`,
    `sets a ${glue(chIndex, i)} boundary around`,
    `pauses over the ${glue(chIndex, i + 1)} signal in`,
  ][chIndex % 6];
  const calendarDecision = [
    `${name} asks if ${snippet(source, i + 10, 15).toLowerCase()} can hold ${glue(chIndex, i + 1)}.`,
    `${name} marks whether ${snippet(source, i + 10, 15).toLowerCase()} can steady ${glue(chIndex, i + 1)}.`,
    `${name} circles a ${glue(chIndex, i + 2)} test: can ${snippet(source, i + 10, 15).toLowerCase()} hold?`,
    `${name} chooses the ${glue(chIndex, i + 3)} line if ${snippet(source, i + 10, 15).toLowerCase()} can hold ${glue(chIndex, i + 1)}.`,
    `${name} writes a ${glue(chIndex, i + 4)} question about whether ${snippet(source, i + 10, 15).toLowerCase()} can hold.`,
    `${name} decides if ${snippet(source, i + 10, 15).toLowerCase()} belongs inside ${glue(chIndex, i + 1)}.`,
    `${name} tests whether ${snippet(source, i + 10, 15).toLowerCase()} deserves the ${glue(chIndex, i + 1)} slot.`,
    `${name} checks if ${glue(chIndex, i + 2)} can carry ${snippet(source, i + 10, 15).toLowerCase()}.`,
    `${name} asks the room whether ${snippet(source, i + 10, 15).toLowerCase()} can protect ${glue(chIndex, i + 1)}.`,
    `${name} drafts a ${glue(chIndex, i + 3)} yes-or-no test for ${snippet(source, i + 10, 15).toLowerCase()}.`,
    `${name} weighs whether ${glue(chIndex, i + 4)} can survive ${snippet(source, i + 10, 15).toLowerCase()}.`,
    `${name} writes down how ${snippet(source, i + 10, 15).toLowerCase()} might hold ${glue(chIndex, i + 1)}.`,
    `${name} chooses only if ${snippet(source, i + 10, 15).toLowerCase()} can make ${glue(chIndex, i + 1)} steadier.`,
    `${name} marks the option where ${snippet(source, i + 10, 15).toLowerCase()} protects ${glue(chIndex, i + 1)}.`,
    `${name} asks what ${snippet(source, i + 10, 15).toLowerCase()} would cost inside ${glue(chIndex, i + 1)}.`,
    `${name} sets the ${glue(chIndex, i + 2)} condition: ${snippet(source, i + 10, 15).toLowerCase()} must hold.`,
    `${name} tests the decision against ${snippet(source, i + 10, 15).toLowerCase()} and ${glue(chIndex, i + 1)}.`,
    `${name} chooses the path where ${snippet(source, i + 10, 15).toLowerCase()} can support ${glue(chIndex, i + 1)}.`,
  ][chIndex % 18];
  const scenarioShapes = [
    `${name}, a ${glue(chIndex, i)} ${role}, stands ${place} ${time} with a ${object} marked ${anchorText}. ${summary}. ${name} faces a choice: answer ${glue(chIndex, i + 2)} pressure with ${concept}, or drift with ${glue(chIndex, i)}.`,
    `${time}, ${place}, ${name} hears a colleague mention ${anchorText}. A ${glue(chIndex, i + 3)} laptop holds the ${object} beside the ${glue(chIndex, i + 4)} chair. As ${glue(chIndex, i + 1)} ${role}, ${name} ${responseCue} ${snippet(source, i + 6, 14).toLowerCase()} and the ${glue(chIndex, i + 2)} signal.`,
    `${name} is the ${glue(chIndex, i + 2)} ${role} holding a marked ${object} ${place} ${time}. With a ${glue(chIndex, i + 3)} review on deck, ${anchorText} comes up. Before the ${glue(chIndex, i + 4)} window closes, ${name} must pick a ${glue(chIndex, i)} response if ${snippet(source, i + 8, 16).toLowerCase()} can guide the room.`,
    `${time} finds ${name} ${place} with the ${object} near a ${glue(chIndex, i + 4)} calendar. ${name} finds ${anchorText} beside the ${glue(chIndex, i)} date. ${calendarDecision}`,
    `${name} opens the ${object} ${place} ${time}. A ${glue(chIndex, i)} note about ${anchorText} says ${snippet(source, i + 18, 22)}. In the ${glue(chIndex, i + 4)} ${role} seat, ${name} ${decisionCue} whether ${glue(chIndex, i + 2)} can turn ${concept} into ${glue(chIndex, i + 3)} practice.`,
    `${time}, ${name} walks ${place} carrying a ${object} and a ${glue(chIndex, i + 1)} concern kept private. ${anchorText} gives the ${role} a ${glue(chIndex, i)} mirror. With ${glue(chIndex, i + 2)} minutes left, ${name} ${decisionCue} whether ${snippet(source, i + 12, 17).toLowerCase()} should lead.`,
  ];
  const scenario = trimChars(scenarioShapes[i], 510);
  return {
    exampleId: `ex${String(i + 1).padStart(2, "0")}`,
    title: [
      `${name} protects the first hour`,
      `${name} names the hidden cost`,
      `${name} pauses the public reply`,
      `${name} redirects the calendar`,
      `${name} repairs before proving`,
      `${name} shields the dawn block`,
    ][i],
    tags: [concept.slice(0, 38), role, format],
    planSpec: {
      domain: `${role} decision with ${object}`,
      audience: `${role}s under visible pressure`,
      stakes: `status pressure can crowd out ${concept}`,
      format,
      requiredBeat: `Use ${anchor} to choose renewal before output`,
    },
    scenario,
    whatToDo: trimChars(`${name} should aim ${glue(chIndex, i)} action through ${actionAnchor}: ${snippet(source, i + 14, 17)} before ${glue(chIndex, i + 3)} claims attention.`, 230),
    whyItMatters: trimChars(`${concept} becomes practical when ${name} lets ${snippet(source, i + 16, 20)} guide ${glue(chIndex, i + 2)} instead of image.`, 230),
  };
}

const qOpeners = [
  "During a budget call",
  "When a studio lead",
  "Your operations team",
  "A colleague argues",
  "Before a medical briefing",
  "In a family calendar review",
  "Which response best fits",
  "At a retreat table",
  "A founder reads",
];

function makeQuestion(source, chIndex, i, correctIndex) {
  const concept = clean(source.centralConcept?.name);
  const anchors = properAnchors(source);
  const anchor = anchors[i % anchors.length] || anchorFor(source, i);
  const actor = names[chIndex][(i + 2) % 6];
  const object = `${glue(chIndex, i + 1)} ${settings[(i + chIndex) % settings.length][3]}`;
  const opener = qOpeners[(i + chIndex) % qOpeners.length];
  const altOpener = qOpeners[(i + chIndex + 2) % qOpeners.length];
  const prompts = [
    `${actor} studies ${snippet(source, i + 1, 16)} beside the ${object}. The team mentions ${anchor}. Which choice fits ${concept}?`,
    `After ${anchor} comes up, ${actor} must answer a ${glue(chIndex, i + 1)} request. ${snippet(source, i + 2, 16)}. What should guide this ${glue(chIndex, i + 3)} response?`,
    `${opener} sees ${snippet(source, i + 3, 16)} written beside ${glue(chIndex, i + 2)}. The ${object} promises a ${glue(chIndex, i + 4)} quick win. Which ${glue(chIndex, i + 1)} option respects ${anchor}?`,
    `${actor} hears a claim that ${anchor} proves ${glue(chIndex, i + 1)} discipline means toughness. The ${object} is open to ${snippet(source, i + 4, 14)}. Which reply would ${glue(chIndex, i + 3)} hold?`,
    `When ${actor} compares ${anchor} with ${snippet(source, i + 5, 15)}, the ${object} looks ${glue(chIndex, i + 2)} rushed. Which ${glue(chIndex, i + 4)} action best protects ${concept}?`,
    `${actor} designs a ${glue(chIndex, i + 3)} routine after reading ${snippet(source, i + 6, 20)}. ${anchor} is the warning beside ${glue(chIndex, i + 4)}. Which choice fits?`,
    `${altOpener} asks how ${concept} should steer ${actor} when ${glue(chIndex, i)} pressure follows ${snippet(source, i + 7, 15)}.`,
    `${actor} sits with ${glue(chIndex, i + 1)} notes as ${anchor} gets used as a ${glue(chIndex, i + 4)} slogan. Which correction keeps ${snippet(source, i + 8, 14)} in view?`,
    `${actor} places a note about ${snippet(source, i + 9, 15)} beside the ${object}. Which ${glue(chIndex, i + 2)} reading avoids copying ${concept} shallowly?`,
  ];
  const correct = [
    `Let ${actor} protect ${snippet(source, i + 9, 14)} before ${glue(chIndex, i)} takes the room.`,
    `Have ${actor} read ${snippet(source, i + 10, 14)} as ${glue(chIndex, i + 1)} data, then choose a ${glue(chIndex, i + 3)} repair.`,
    `Use ${anchor} as a ${glue(chIndex, i + 2)} test for whether the ${glue(chIndex, i + 4)} plan honors ${snippet(source, i + 11, 15)}.`,
    `Tell the ${glue(chIndex, i + 2)} group that ${concept} needs ${snippet(source, i + 12, 13)} beyond display.`,
    `Place a ${glue(chIndex, i + 3)} recovery act from ${snippet(source, i + 13, 14)} before the task.`,
    `Build the ${glue(chIndex, i + 4)} routine around ${snippet(source, i + 14, 14)}, then let ${glue(chIndex, i + 1)} output follow.`,
    `Ask what ${snippet(source, i + 15, 14)} costs before setting another ${glue(chIndex, i)} target.`,
    `Return the slogan to ${anchor} and name the ${glue(chIndex, i + 1)} need inside ${snippet(source, i + 16, 13)}.`,
    `Separate the ${glue(chIndex, i + 2)} clock tactic from ${snippet(source, i + 17, 15)}.`,
  ][i];
  const wrongA = [
    `Let ${actor} answer through ${glue(chIndex, i)} because that demand rewards ${snippet(source, i + 18, 13)}.`,
    `Have ${actor} treat ${glue(chIndex, i + 1)} evidence from ${snippet(source, i + 19, 13)} as pressure proof for ${glue(chIndex, i + 4)}.`,
    `Use ${anchor} to polish the ${glue(chIndex, i + 2)} plan while ${snippet(source, i + 20, 13)} stays unchanged.`,
    `Tell the ${glue(chIndex, i + 3)} group that ${concept} means more whenever ${snippet(source, i + 21, 12)} appears.`,
    `Put the ${glue(chIndex, i + 4)} applause task first, leaving ${snippet(source, i + 22, 13)} for later.`,
    `Build a ${glue(chIndex, i)} scoreboard comparing ${snippet(source, i + 23, 12)} around ${anchor}.`,
    `Ask who can lift ${glue(chIndex, i + 1)} output while pressure around ${snippet(source, i + 24, 12)} stays unnamed.`,
    `Keep the ${glue(chIndex, i + 2)} slogan bright; the ${glue(chIndex, i + 4)} wound inside ${snippet(source, i + 25, 12)} goes missed.`,
    `Treat the ${glue(chIndex, i + 3)} clock as complete because ${snippet(source, i + 26, 12)} looks trackable.`,
  ][i];
  const wrongB = [
    `Let ${actor} postpone ${glue(chIndex, i + 1)} renewal as tension around ${snippet(source, i + 27, 12)} fades.`,
    `Have ${actor} hide ${glue(chIndex, i + 2)} strain, then copy a ${glue(chIndex, i + 4)} tone around ${snippet(source, i + 28, 12)}.`,
    `Use ${anchor} to justify more ${glue(chIndex, i + 3)} workload while calling ${snippet(source, i + 29, 12)} growth.`,
    `Tell the ${glue(chIndex, i + 4)} group that ${concept} is only a ${glue(chIndex, i + 2)} mood; the ${object} ignores ${snippet(source, i + 30, 12)}.`,
    `Send ${glue(chIndex, i + 4)} recovery into next ${glue(chIndex, i + 1)} week, preserving ${snippet(source, i + 31, 12)} on paper.`,
    `Let image steer the ${glue(chIndex, i)} routine, expecting ${glue(chIndex, i + 2)} energy after ${snippet(source, i + 32, 12)}.`,
    `Ask for added ${glue(chIndex, i + 1)} output; defer ${glue(chIndex, i + 3)} restoration around ${snippet(source, i + 33, 12)}.`,
    `Make ${anchor} a ${glue(chIndex, i + 2)} poster line; neglect the ${glue(chIndex, i + 4)} repair signal from ${snippet(source, i + 34, 12)}.`,
    `Treat the wider ${glue(chIndex, i + 3)} repair as delayed after ${glue(chIndex, i + 1)} scheduling includes ${snippet(source, i + 35, 12)}.`,
  ][i];
  const decoratedCorrect = i === 7 ? `${correct.replace(/\.$/, "")} in the ${glue(chIndex, 0)} reading of ${concept}.` : correct;
  const decoratedWrongA = i === 7 ? `${wrongA.replace(/\.$/, "")} in the ${glue(chIndex, 1)} reading of ${concept}.` : wrongA;
  const decoratedWrongB = i === 7 ? `${wrongB.replace(/\.$/, "")} in the ${glue(chIndex, 2)} reading of ${concept}.` : wrongB;
  const ordered = [null, null, null];
  ordered[correctIndex] = decoratedCorrect;
  const wrongs = [decoratedWrongA, decoratedWrongB];
  let wi = 0;
  for (let j = 0; j < 3; j++) if (ordered[j] == null) ordered[j] = wrongs[wi++];
  return {
    questionId: `q${String(i + 1).padStart(2, "0")}`,
    prompt: trimChars(prompts[i], 370),
    choices: ordered.map((x) => trimChars(x, 190)),
    correctIndex,
    explanation: trimChars(`${concept} centers ${snippet(source, i + 25, 15)}. ${anchor} warns against ${snippet(source, i + 30, 10)} masquerading as ${glue(chIndex, i)} discipline.`, 290),
    bloomsLevel: bloom[i],
    depthLevel: depth[i],
  };
}

function cards(source, chIndex) {
  const concept = clean(source.centralConcept?.name);
  const anchors = properAnchors(source);
  const a0 = anchors[0] || anchorFor(source, 0);
  const a1 = anchors[1] || anchorFor(source, 1);
  const prompts = [
    [`In "${snippet(source, 2, 7)}," what should ${concept} make ${glue(chIndex, 0)} notice about ${a0}?`, `${snippet(source, 2, 18)}. ${concept} starts when that cost is treated as a signal.`],
    [`What does ${a1} reveal about ${glue(chIndex, 1)}?`, `${snippet(source, 4, 18)}. Daily discipline has to answer that exact pressure.`],
    [`How does ${concept} expose "${snippet(source, 6, 7)}" as a shortcut?`, `${snippet(source, 6, 20)}. A copied routine without repair misses the harder claim.`],
    [`How does ${concept} shape a ${glue(chIndex, 3)} morning?`, `${snippet(source, 8, 20)}. The hour becomes a protected place for ${snippet(source, 9, 8)}.`],
    [`Which ${glue(chIndex, 4)} detail from ${clean(source.chapterTitle)} should stay vivid after "${snippet(source, 10, 7)}"?`, `${snippet(source, 10, 21)}. The scene keeps the framework tied to a person under strain.`],
    [`Where can ${concept} go wrong in ${glue(chIndex, 0)}?`, `${snippet(source, 12, 20)}. The method fails when image outruns renewal.`],
  ];
  return prompts.map(([front, back], i) => ({
    cardId: `card${String(i + 1).padStart(2, "0")}`,
    front: trimChars(front, 195),
    back: trimChars(back, 390),
    difficulty: i < 2 ? "easy" : i < 4 ? "medium" : "hard",
  }));
}

function plan(source, chIndex) {
  const concept = clean(source.centralConcept?.name);
  const a0 = properAnchors(source)[0] || anchorFor(source, 0);
  const verbs = ["Protect", "Name", "Restore", "Steady", "Shape", "Guard", "Quiet", "Renew", "Cue", "Repair", "Anchor", "Clear", "Train", "Prime", "Refit", "Hold", "Build", "Tend"];
  return {
    title: `${verbs[chIndex % verbs.length]} ${concept.split(/\s+/).slice(0, 3).join(" ")}`,
    coreSkill: trimChars(`Practice ${concept} by acting on ${snippet(source, 3, 18)}. Choose one morning behavior that makes ${snippet(source, 5, 12)} visible before the day's pressure sets the terms.`, 390),
    ifThenPlans: [
      {
        context: `When ${a0} feels uncomfortably close`,
        plan: `If ${a0} echoes your ${glue(chIndex, 0)}, then write ${snippet(source, 7, 10)} and act before messages.`,
      },
      {
        context: `When the next demand repeats the hard edge`,
        plan: `If the day starts with ${snippet(source, 9, 14)}, then place one ${glue(chIndex, 1)} act for ${concept} before the first reply about ${glue(chIndex, 4)}.`,
      },
      {
        context: `When the routine becomes performance`,
        plan: `If you want to display the streak, then connect it to ${snippet(source, 11, 10)} and keep ${glue(chIndex, 2)} private.`,
      },
      {
        context: `When fatigue challenges the plan`,
        plan: `If energy drops, then adjust the hour around ${snippet(source, 13, 10)} instead of forcing harsher ${glue(chIndex, 3)}.`,
      },
    ],
    twentyFourHourChallenge: trimChars(`Within the next 24 hours, schedule one dawn block for ${concept} and complete a single action tied to ${snippet(source, 15, 10)}.`, 220),
    weeklyPractice: trimChars(`For seven days, record how ${snippet(source, 17, 14)} changes when ${glue(chIndex, 4)} gets the first designed hour.`, 240),
  };
}

function chapterFor(entry, chIndex) {
  const sourcePath = path.join(sourceDir, `ch${String(entry.chapterNumber).padStart(2, "0")}.source.json`);
  const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
  const concept = clean(source.centralConcept?.name);
  const a0 = anchorFor(source, 0);
  const bd = breakdown(source, entry.chapterNumber, chIndex);
  const pattern = answerPatterns[chIndex % answerPatterns.length];
  const memorable = [
    { text: bd.fastRead.split(/(?<=[.!?])\s+/).find((s) => s.includes("A quiet first hour")) || bd.fastRead.split(/(?<=[.!?])\s+/)[0], location: "breakdown.fastRead", why: "It makes the morning feel restorative rather than performative." },
    { text: bd.deepRead.split(/(?<=[.!?])\s+/).find((s) => s.includes("Greatness starts")) || bd.deepRead.split(/(?<=[.!?])\s+/)[0], location: "breakdown.deepRead", why: "It links ambition to stewardship in plain language." },
    { text: bd.fullRead.split(/(?<=[.!?])\s+/).find((s) => s.includes("No alarm")) || bd.fullRead.split(/(?<=[.!?])\s+/)[0], location: "breakdown.fullRead", why: "It sets a humane limit on the routine." },
  ];
  return {
    chapterId: entry.chapterId,
    number: entry.chapterNumber,
    title: entry.chapterTitle,
    readingTimeMinutes: 11,
    hook: hookFor(source, chIndex),
    counterintuition: trimChars(clean(source.hardEdge || source.centralConcept?.whyItMatters || source.centralConcept?.plainDefinition), 280),
    tryThisNow: tryFor(source, chIndex),
    keyTakeaway: takeawayFor(source),
    breakdown: bd,
    examples: Array.from({ length: 6 }, (_, i) => example(source, chIndex, i)),
    quiz: {
      passingScorePercent: 70,
      questions: Array.from({ length: 9 }, (_, i) => makeQuestion(source, chIndex, i, pattern[i])),
    },
    reviewCards: cards(source, chIndex),
    implementationPlan: plan(source, chIndex),
    memorableLines: memorable,
  };
}

fs.mkdirSync(outDir, { recursive: true });
for (let i = 0; i < index.length; i++) {
  const ch = chapterFor(index[i], i);
  const out = path.join(outDir, `${ch.chapterId}.v21-native.chapter.json`);
  fs.writeFileSync(out, JSON.stringify(ch, null, 2) + "\n");
  console.log(out);
}
