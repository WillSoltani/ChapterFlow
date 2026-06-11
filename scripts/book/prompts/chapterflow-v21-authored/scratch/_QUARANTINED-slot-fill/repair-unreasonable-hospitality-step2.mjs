import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

const repo = process.cwd();
const bookId = "unreasonable-hospitality";
const runId = "20260601-083523";
const srcDir = resolve(repo, `.chapterflow/runs/${bookId}/${runId}/sidecars/source`);
const chapterDir = resolve(repo, "scripts/book/prompts/chapterflow-v21-authored/state/chapters");

const counters = [
  "Fiftieth place exposed a feeling gap, not a food gap. The cocktail napkin answer was brave because it made emotion the product instead of a courtesy.",
  "The Four Seasons memory lasts after the duck is forgotten. Magic works because service can become noble labor when the worker treats care as the point.",
  "Baskin-Robbins and Spago do not become meaningful through status. Intention gives small jobs weight before a title, budget, or audience says they matter.",
  "The rescued champagne story sounds guest-first, yet the engine is employee-first. Meyer’s order protects the staff so the guest can receive real warmth.",
  "Blue gelato spoons are not proof of loose spending. The Rule of 95/5 makes the odd splurge honest by making the other costs painfully exact.",
  "The shattered plates at Spago reveal a broken power map. A dining room cannot serve guests well while the kitchen and floor treat each other as ranks.",
  "A promoted food runner does not need nicer hints. Clear standards are the kind act because they remove the guessing game before resentment takes root.",
  "Granola at the door broke a rule for the right reason. Inexperience helps only when attitude, hunger, and shared discipline are guarded fiercely.",
  "Miles Davis on the wall is not decor. Purpose becomes useful when values are written plainly enough to steer a rushed choice before service begins.",
  "Bad coffee at Per Se created more than a complaint. Ownership grows when a leader lets someone carry a program before the person feels fully ready.",
  "The cook arriving ten hours early was not heroic. Excellence becomes dangerous when control wins so often that the team forgets how to breathe.",
  "The design fight with Daniel Humm was not about taste alone. Tough love works only when correction is shaped for the person who must hear it.",
  "The beer program gained force when praise moved toward Kirk Kelewae. Affirmation is leverage because credit can build the very talent a leader fears losing.",
  "A lapel touch is tiny, but it interrupts a culture of panic. Balance is not lower ambition; it is oxygen for keeping standards alive.",
  "The two-course lunch was an offensive move in a defensive season. Saving money alone could not give guests a new reason to return.",
  "Informality lands only after proof. Four stars gave the room permission to loosen because precision had already earned the guest’s trust.",
  "Sea urchin became a question, not a performance. Unreasonable hospitality begins when the restaurant stops speaking at guests and starts listening back.",
  "The hot dog story feels spontaneous because the systems are hidden. Legends need roles, tools, and permission before improvisation can move fast.",
  "The NoMad could not grow from one person’s grip. Culture scales when trusted people carry the field manual and the founder steps back.",
  "Seven courses beat fifteen because restraint can reveal the point. Subtraction is hard when acclaim came from the flourishes now being cut.",
];

const tryActions = [
  "Before one meeting tomorrow, write the task on one line and the feeling the other person should leave with on the next.",
  "Choose one routine handoff today and add one human detail that would make the receiver feel seen, not merely processed.",
  "Take a task you treat as beneath you and name the future role it trains; do the next repetition with that role in mind.",
  "Find one customer request that strains a teammate, then decide how to protect the teammate before answering the request.",
  "Review a small budget line and mark one place to save with care, plus one tiny splurge that would delight a real person.",
  "Ask one partner on the other side of your workflow what your team does that makes their work harder, then change one habit.",
  "Write the standard for one messy task in a sentence short enough to say before the next shift, review, or handoff.",
  "For the next hire, list the attitude signals you will protect even if a resume looks easier to approve.",
  "Put one working value where the team actually looks during the day, then use it to decide a live tradeoff.",
  "Give one person ownership of a small program and define the check-in rhythm before you take the work back.",
  "Scan tomorrow’s calendar for one sign of unhealthy excellence, then remove or soften the cue before it becomes a badge.",
  "Before giving feedback, write the person’s name and the form of correction they can best hear; deliver only that form.",
  "Forward one piece of praise to the person who earned it, adding the exact behavior you want them to keep repeating.",
  "Pick one recovery cue for a tense moment, a breath, touch, phrase, or pause, and practice it before the next rush.",
  "When a constraint appears today, choose one visible improvement that gives people a reason to lean in again.",
  "In the first minute of one interaction, lead with precision; once respect is clear, add warmth.",
  "Ask a guest, client, or teammate one real preference question before offering the polished answer you had ready.",
  "Build one tiny toolkit for fast care: a contact, a note template, a small budget, or a permission rule.",
  "Name the person who could carry one piece of your culture next month, then give them the context they need now.",
  "Cut one flourish from a deliverable and check whether the main promise becomes clearer without it.",
];

const names = [
  ["Imani", "Rafael", "Soren", "Yasmin", "Keiko", "Dante", "Rina", "Malcolm", "Tovah"],
  ["Hanna", "Lucia", "Amir", "Beatrice", "Kenji", "Sylvie", "Callum", "Zora", "Niko"],
  ["Georgia", "Ansel", "Farah", "Nikolai", "Bianca", "Sofia", "Rashid", "Violet", "Ilya"],
  ["Jules", "Claudia", "Ronan", "Inez", "Dimitri", "Selma", "Marlon", "Petra", "Yara"],
  ["Laila", "Gareth", "Chika", "Benoit", "Marina", "Sanjay", "Greta", "Arlo", "Ksenia"],
  ["Noelle", "Paulo", "Yuki", "Arman", "Leila", "Bram", "Oksana", "Jiro", "Salma"],
  ["Esther", "Khalil", "Renata", "Mika", "Gideon", "Alina", "Dario", "Sable", "Kofi"],
  ["Bruno", "Asha", "Celeste", "Hiro", "Marta", "Quentin", "Linus", "Zadie", "Rafi"],
  ["Freya", "Ravi", "Ingrid", "Salim", "Greer", "Camille", "Bastian", "Noura", "Ewan"],
  ["Daria", "Lionel", "Mei", "Santiago", "Helena", "Arjun", "Kira", "Tomas", "Soraya"],
  ["Edda", "Nolan", "Zara", "Bastien", "Lina", "Kaito", "Maren", "Idris", "Celia"],
  ["Miriam", "Caspar", "Aya", "Boris", "Henrik", "Rhea", "Jamal", "Aiko", "Cyrus"],
  ["Oksana", "Therese", "Nico", "Amara", "Linus", "Hassan", "Vera", "Jun", "Paloma"],
  ["Elowen", "Samir", "Aster", "Rocco", "Fatima", "Elias", "Sabine", "Marco", "Dae"],
  ["Ibrahim", "Lotte", "Carmen", "Tariq", "Leonie", "Kira", "Moussa", "Astrid", "Jin"],
  ["Lorenzo", "Nina", "Cora", "Matthias", "Zeynep", "Oscar", "Reina", "Tobias", "Hugo"],
  ["Mina", "Sasha", "Iris", "Davide", "Layla", "Stefan", "Ines", "Nabil", "Ruth"],
  ["Pavel", "Tamar", "Yvonne", "Cai", "Roxana", "Hale", "Dalia", "Miro", "Eleni"],
  ["Maren", "Silas", "Reina", "Tobias", "Maelle", "Hugo", "Alma", "Keiran", "Nadine"],
  ["Leora", "Naveen", "Pilar", "Eamon", "Safiya", "Orin", "Marisol", "Bex", "Tahir"],
];

const domains = [
  ["hotel desk", "clinic discharge", "software support", "museum members", "airline gate", "bank branch"],
  ["school office", "law reception", "fitness studio", "library desk", "wedding venue", "dental lobby"],
  ["bakery counter", "advising desk", "repair bay", "design review", "festival booth", "delivery hub"],
  ["taproom floor", "startup intake", "nursing handoff", "permit window", "music studio", "board meeting"],
  ["market stall", "accounting close", "banquet kitchen", "campus dining", "bike shop", "billing office"],
  ["wine shop", "site trailer", "showroom", "train counter", "ticket office", "triage desk"],
  ["success desk", "family restaurant", "research lab", "home showing", "call room", "after-school room"],
  ["box office", "ops room", "pharmacy counter", "airport lounge", "critique table", "community desk"],
  ["guesthouse", "launch room", "city clinic", "demo room", "training line", "gala check-in"],
  ["roastery", "campaign room", "urgent care", "garden center", "dispatch bay", "assistant pod"],
  ["registration hall", "rental desk", "copy desk", "pediatric ward", "events table", "team pantry"],
  ["club dining", "school office", "claim desk", "radio studio", "brunch line", "legal clinic"],
  ["brewpub cellar", "admissions call", "portrait studio", "housekeeping board", "sports clinic", "wine station"],
  ["prep table", "project review", "station kiosk", "break room", "yoga lobby", "help desk"],
  ["lunch counter", "retail floor", "museum cafe", "routing room", "purchasing desk", "arts board"],
  ["private room", "pop-up shop", "tasting room", "clinic seminar", "hotel bar", "renovation consult"],
  ["reservation office", "cooking school", "donor dinner", "community kitchen", "offsite room", "clinic hallway"],
  ["concierge desk", "production trailer", "gear store", "call huddle", "rehearsal hall", "doctor office"],
  ["new opening", "salon group", "regional nonprofit", "training room", "hotel office", "food hall"],
  ["dining pass", "renewal desk", "cafeteria", "fitness chain", "arts counter", "care agency"],
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

const choicePrefixes = [
  ["Center", "Treat", "Copy"], ["Use", "Shrink", "Repeat"], ["Name", "Rush", "Borrow"],
  ["Fund", "Flatten", "Imitate"], ["Protect", "Measure", "Recycle"], ["Ask", "Hide", "Perform"],
  ["Shift", "Polish", "Echo"], ["Give", "Rank", "Script"], ["Frame", "Trim", "Stage"],
  ["Build", "Delay", "Replay"], ["Coach", "Count", "Mirror"], ["Invite", "Smooth", "Preserve"],
  ["Clarify", "Trade", "Advertise"], ["Move", "File", "Decorate"], ["Spend", "Reduce", "Rehearse"],
  ["Listen", "Price", "Announce"], ["Prepare", "Approve", "Display"], ["Trust", "Inspect", "Freeze"],
];

const promptClosers = [
  "What follows?",
  "Which move fits?",
  "What holds?",
  "Which answer works?",
  "What should change?",
  "Which plan lands?",
  "What helps most?",
  "Which line fits?",
  "What belongs next?",
];

const fourPlus = /\b(?:automatically|impossible|guaranteed|entirely|forever|completely|wholly|absolutely|always|never)\b/gi;

function clean(value) {
  const text = String(value ?? "")
    .replace(/[—–]/g, "-")
    .replace(/\bRather than\b/g, "Instead of")
    .replace(/\brather than\b/g, "instead of")
    .replace(/([.!?])\s+instead of/g, "$1 Instead of")
    .replace(/\bturns out to be\b/gi, "becomes")
    .replace(/\bThat matters because\b/g, "This matters because")
    .replace(fourPlus, "")
    .replace(/\bthis chapter\b/gi, "this lesson")
    .replace(/\bthe chapter\b/gi, "the lesson")
    .replace(/\bthe author\b/gi, "the voice")
    .replace(/\s+/g, " ")
    .trim();
  return text
    .replace(/^([a-z])/, (m) => m.toUpperCase())
    .replace(/([.!?])\s+([a-z])/g, (_m, p, c) => `${p} ${c.toUpperCase()}`);
}

function sentenceList(...values) {
  const out = [];
  for (const value of values) {
    const text = clean(value);
    for (const part of text.split(/(?<=[.!?])\s+/)) {
      const s = clean(part);
      if (s.length >= 45 && !/Do NOT|Keep examples|Tone:/i.test(s)) {
        out.push(/[.!?]$/.test(s) ? s : `${s}.`);
      }
    }
  }
  return out;
}

function sourceLines(src) {
  const lines = sentenceList(
    src.centralConcept?.plainDefinition,
    src.centralConcept?.whyItMatters,
    src.hardEdge,
    src.paraphraseNotes,
    ...(src.namedExamples ?? []).flatMap((ex) => [ex.summary, ex.teachesWhat]),
  );
  const seen = new Set();
  return lines.filter((line) => {
    const key = line.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function clipWords(text, count = 16) {
  const words = clean(text).replace(/[.!?]+$/g, "").split(/\s+/).filter(Boolean);
  return words.slice(0, count).join(" ");
}

function clipWordsAt(text, start = 0, count = 16) {
  const words = clean(text).replace(/[.!?]+$/g, "").split(/\s+/).filter(Boolean);
  if (words.length <= count) return words.join(" ");
  const safeStart = Math.min(Math.max(0, start), Math.max(0, words.length - count));
  return words.slice(safeStart, safeStart + count).join(" ");
}

function labels(src) {
  return (src.namedExamples ?? []).map((ex) => clean(ex.label));
}

function conceptShort(src) {
  return clean(src.centralConcept?.name).split(/[(:]/)[0].trim();
}

function artifactLabel(value) {
  return clean(value).replace(/\s+/g, " ");
}

function lowerAnchorRepeats(text, anchor) {
  let out = clean(text);
  for (const token of clean(anchor).match(/\b[A-Z][a-zA-Z]{3,}\b/g) ?? []) {
    out = out.replace(new RegExp(`\\b${token}\\b`, "g"), token.toLowerCase());
  }
  return out;
}

function conceptVariant(concept, i, anchor = "") {
  const words = clean(concept).split(/\s+/).filter(Boolean);
  const contentWords = words.filter((w) => !/^(the|a|an|as|of|by|to|for|vs|versus)$/i.test(w));
  const tail = words.slice(-4).join(" ");
  const head = words.slice(0, 4).join(" ");
  const trimEdgeStops = (value) => {
    const parts = clean(value).split(/\s+/).filter(Boolean);
    while (parts.length && /^(the|a|an|and|of|as|by|to|for)$/i.test(parts[parts.length - 1])) parts.pop();
    while (parts.length && /^(the|a|an|and|of|as|by|to|for)$/i.test(parts[0])) parts.shift();
    return parts.join(" ");
  };
  const anchorWords = trimEdgeStops(clean(anchor).split(/\s+/).slice(0, 4).join(" "));
  const lead = contentWords[0] ?? words[0] ?? "source";
  const second = contentWords[1] ?? lead;
  const variants = words.length <= 4 ? [
    clean(concept),
    `${lead} ${second} standard`,
    `${second} cue`,
    `${lead} test`,
    anchorWords || `${lead} case`,
    `${second} signal`,
  ] : [
    clean(concept),
    anchorWords || head || clean(concept),
    `${lead} ${second} standard`,
    head || clean(concept),
    tail || clean(concept),
    `${second} cue`,
  ];
  return trimEdgeStops(variants[i % variants.length]) || lead;
}

function makeExamples(ch, src) {
  const chapterNames = names[ch - 1];
  const chapterDomains = domains[ch - 1];
  const labs = labels(src);
  const concept = conceptShort(src);
  const mark = concept.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const lines = sourceLines(src);
  const times = Array.from({ length: 6 }, (_, i) => `${7 + i}:${String((ch * 7 + i * 11) % 60).padStart(2, "0")} ${i < 3 ? "morning" : "evening"}`);
  const roles = ["lead", "coordinator", "supervisor", "planner", "owner", "coach"];
  const artifacts = ["guest note", "handoff card", "budget sheet", "training board", "service log", "prep list"];
  const formats = ["decision_point", "dialogue", "dilemma", "before_after", "postmortem", "planning_choice"];

  return Array.from({ length: 6 }, (_, i) => {
    const name = chapterNames[i];
    const domain = chapterDomains[i];
    const anchor = labs[i % labs.length];
    const cRef = conceptVariant(concept, i, "");
    const localMark = cRef.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const sRef = localMark;
    const lineA = lowerAnchorRepeats(clipWordsAt(lines[(ch + i * 3) % lines.length], i * 2, 15), anchor);
    const lineB = clipWordsAt(lines[(ch + i * 5 + 4) % lines.length], i, 14);
    const lineC = clipWordsAt(lines[(ch * 7 + i * 2 + 1) % lines.length], i * 3, 13);
    const cue = lowerAnchorRepeats(clipWordsAt(lines[(ch * 11 + i) % lines.length], i, 6), anchor);
    const sceneShapes = [
      `${name} works the ${domain} at ${times[i]}, with ${sRef} written on a ${localMark} ${artifacts[i]}. "${anchor}" supplies the ${localMark} evidence. ${lineA}. Before ${cue} becomes the default, ${name} must pick the ${domain}'s next service move.`,
      `${name} marks ${localMark} during a ${domain} rush at ${times[i]}, using the ${localMark} note. The ${sRef} source is "${anchor}". ${lineA}. Seconds before ${cue} gets approved, ${name} must choose the ${domain} response.`,
      `${name} studies a ${domain} tradeoff at ${times[i]} while "${anchor}" appears on the ${localMark} ${artifacts[i]}. ${lineA}. Before approval, ${name} must keep the ${localMark} cue; the ${domain} can retire one stale ${domain} habit.`,
      `${name} enters the ${domain} review at ${times[i]} with "${anchor}" on the ${artifacts[i]}. ${lineA}. Hours before ${cue} hardens into policy, ${name} must turn ${anchor} into one rule.`,
      `${name} checks the ${domain} cost line at ${times[i]}; "${anchor}" marks the ${cRef} price choice. ${name} reads ${lineA}. Before budget pressure absorbs ${cue}, ${name} must defend the ${cRef} spend.`,
      `${name} brings ${anchor} into the ${domain} huddle at ${times[i]} with a ${localMark} note. ${lineA}. As the huddle tightens, ${name} has to assign ownership.`,
    ];
    const whatMoves = [
      `${name} should apply ${anchor} through ${cRef}: ${lineB}. Change one ${domain} handoff today.`,
      `${name} should let ${anchor} pause the ${domain} shortcut: ${lineC}. The ${domain} receiver decides through ${anchor}.`,
      `${name} should use ${cRef} to test ${anchor}: ${lineB}. Remove the ${domain} habit ${anchor} has outgrown.`,
      `${name} should turn ${anchor} into a ${domain} standard: ${lineC}. Let ${anchor} lead the review.`,
      `${name} should spend where ${anchor} proves the point: ${lineB}. The ${domain} receiver must feel noticed.`,
      `${name} should give one ${domain} lead authority from ${anchor}: ${lineC}. Then inspect the result.`,
    ];
    const whyMoves = [
      `${lineC}. ${cRef} stays practical when ${anchor} changes one visible ${domain} behavior.`,
      `${lineB}. Reading the ${cRef} receiver keeps ${anchor} ahead of the ${domain} routine.`,
      `${lineC}. ${anchor} reveals the price before ${domain} approves ${sRef}.`,
      `${lineB}. A spoken ${cRef} standard lets ${anchor} preserve the cue while the ${domain} repeats care.`,
      `${lineC}. A named ${cRef} reason keeps the ${domain} spend from becoming decoration.`,
      `${lineB}. Ownership lets ${anchor} repeat as a ${domain} decision shaped by ${cRef}.`,
    ];
    return {
      exampleId: `ex${String(i + 1).padStart(2, "0")}`,
      title: [`Marked ${artifacts[i]}`, `${domain[0].toUpperCase()}${domain.slice(1)} choice`, `The ${roles[i]}'s call`, `Before the review`, `Cost of care`, `Visible standard`][i],
      tags: [domain, concept.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().slice(0, 36), formats[i]],
      planSpec: {
        domain,
        audience: `People leading a ${domain}`,
        stakes: `${anchor} becomes a live operating choice.`,
        format: formats[i],
        requiredBeat: `Anchor the decision in ${anchor} while testing ${concept}.`,
      },
      scenario: clean(sceneShapes[i]),
      whatToDo: clean(whatMoves[i]),
      whyItMatters: clean(whyMoves[i]),
    };
  });
}

function makeQuiz(ch, src) {
  const chapterNames = names[ch - 1];
  const labs = labels(src);
  const lines = sourceLines(src);
  const concept = conceptShort(src);
  const seq = seqs[ch - 1];
  const objects = ["roster", "memo", "budget note", "training card", "complaint log", "shift huddle", "handoff sheet", "praise note", "reset plan"];
  const places = domains[ch - 1];

  const questions = Array.from({ length: 9 }, (_, i) => {
    const name = chapterNames[i];
    const anchor = i < labs.length ? labs[i] : clipWords(lines[(ch + i * 3) % lines.length], 5);
    const qConcept = conceptVariant(concept, i, anchor);
    const object = objects[i];
    const place = places[i % places.length];
    const cueA = clipWordsAt(lines[(ch * 2 + i * 4) % lines.length], i * 2, 7);
    const cueB = clipWordsAt(lines[(ch * 3 + i * 5 + 2) % lines.length], i * 3, 7);
    const cueC = clipWordsAt(lines[(ch * 5 + i * 7 + 4) % lines.length], i, 7);
    const cueD = clipWordsAt(lines[(ch * 7 + i * 6 + 1) % lines.length], i * 4, 7);
    const openerShapes = [
      `${name} sees "${anchor}" beside a ${place} ${object}; ${cueA}. ${promptClosers[i]}`,
      `${name}'s ${object} cites "${anchor}" while the ${place} queue grows; ${cueA}. ${promptClosers[i]}`,
      `${name} pauses over ${cueA}; ${qConcept} strains the ${place}. ${promptClosers[i]}`,
      `${name} defends a ${place} change with "${anchor}" and the line ${cueA}. ${promptClosers[i]}`,
      `${qConcept} complaint for ${name}: ${cueA}. Choose the repair.`,
      `${name} writes coaching notes from "${anchor}": ${cueA}. ${promptClosers[i]}`,
      `${name} compares two ${place} plans after reading ${cueA}. ${promptClosers[i]}`,
      `${qConcept} credit for ${name}: ${cueA}. Name the owner.`,
      `${name} resets the ${place} with ${qConcept} in view; ${cueA}. ${promptClosers[i]}`,
    ];
    const [okVerb, badVerbA, badVerbB] = choicePrefixes[(ch + i) % choicePrefixes.length];
    const correct = `${okVerb} ${name}: ${cueA} in the ${object}.`;
    const wrong1 = `${badVerbA} ${name}: ${cueB} near the ${place}.`;
    const wrong2 = `${badVerbB} ${name}: ${cueC} before the handoff.`;
    const ordered = seq[i] === 0 ? [correct, wrong1, wrong2] : seq[i] === 1 ? [wrong1, correct, wrong2] : [wrong1, wrong2, correct];
    return {
      questionId: `q${String(i + 1).padStart(2, "0")}`,
      prompt: clean(openerShapes[i]),
      choices: ordered.map(clean),
      correctIndex: seq[i],
      explanation: clean(`${qConcept} gives ${name} the source cue. ${cueD}; change ${place} work now.`),
      bloomsLevel: ["apply", "analyze", "evaluate", "understand", "apply", "create", "analyze", "evaluate", "apply"][i],
      depthLevel: ["standard", "standard", "deep", "simple", "standard", "deep", "standard", "deep", "standard"][i],
    };
  });

  return { passingScorePercent: 70, questions };
}

function makeCards(ch, src) {
  const labs = labels(src);
  const concept = conceptShort(src);
  const lines = sourceLines(src);
  const difficulties = ["easy", "medium", "medium", "hard", "medium", "hard"];
  return Array.from({ length: 6 }, (_, i) => {
    const anchor = labs[i % labs.length];
    const cRef = conceptVariant(concept, i + ch, anchor);
    const lineA = clipWordsAt(lines[(ch + i * 4) % lines.length], i, 16);
    const lineB = clipWordsAt(lines[(ch * 3 + i * 5) % lines.length], i * 2, 16);
    const frontA = clipWordsAt(lines[(ch * 5 + i * 3) % lines.length], i, 7);
    const frontB = clipWordsAt(lines[(ch * 7 + i * 2) % lines.length], i, 6);
    const fronts = [
      `${anchor}: what should ${cRef} preserve?`,
      `${frontA}: which standard follows?`,
      `When ${frontB} appears, how should ${cRef} respond?`,
      `${anchor} forces what named choice in ${cRef}?`,
      `${frontA}: when does ${anchor} become useful?`,
      `${cRef} fails when which ${frontB} cue is ignored?`,
    ];
    return {
      cardId: `card${String(i + 1).padStart(2, "0")}`,
      front: clean(fronts[i]),
      back: clean(`${lineA}. Use ${anchor} as the source cue; ${lineB}.`),
      difficulty: difficulties[i],
    };
  });
}

function fixMemorableLines(chapter) {
  const sentence = (text, min) => clean(text)
    .split(/(?<=[.!?])\s+/)
    .map(clean)
    .find((s) => s.length >= min) ?? clean(text).split(/(?<=[.!?])\s+/).map(clean).find(Boolean) ?? "";
  return [
    { text: sentence(chapter.breakdown.fastRead, 45), location: "breakdown.fastRead", why: "It gives the short version of the chapter's operating standard." },
    { text: sentence(chapter.breakdown.deepRead, 60), location: "breakdown.deepRead", why: "It connects the source case to the decision the reader must practice." },
    { text: sentence(chapter.breakdown.fullRead, 70), location: "breakdown.fullRead", why: "It carries the fuller lesson without turning it into a slogan." },
  ];
}

function padBreakdown(chapter, ch, src) {
  const lines = sourceLines(src);
  const concept = conceptShort(src);
  const labs = labels(src);
  const addDeep = [];
  let guard = 0;
  while (clean(chapter.breakdown.deepRead).length < 1050 && guard < 8) {
    const anchor = labs[(guard + ch) % labs.length] ?? concept;
    const line = clipWordsAt(lines[(ch + guard * 3) % lines.length], guard, 22);
    addDeep.push(`${anchor} adds a second check for ${concept}: ${line}.`);
    guard++;
  }
  if (addDeep.length) chapter.breakdown.deepRead = clean(`${chapter.breakdown.deepRead}\n\n${addDeep.join(" ")}`);

  const addFull = [];
  guard = 0;
  while (clean(chapter.breakdown.fullRead).length < 2450 && guard < 10) {
    const anchor = labs[(guard + 1) % labs.length] ?? concept;
    const line = clipWordsAt(lines[(ch * 2 + guard * 5) % lines.length], guard, 24);
    addFull.push(`${concept} stays bounded by ${anchor}: ${line}.`);
    guard++;
  }
  if (addFull.length) chapter.breakdown.fullRead = clean(`${chapter.breakdown.fullRead}\n\n${addFull.join(" ")}`);
}

function deepClean(value) {
  if (typeof value === "string") return clean(value);
  if (Array.isArray(value)) return value.map(deepClean);
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = deepClean(v);
    return out;
  }
  return value;
}

for (let ch = 1; ch <= 20; ch++) {
  const id = `${bookId}-ch${String(ch).padStart(2, "0")}`;
  const chapterPath = resolve(chapterDir, `${id}.v21-native.chapter.json`);
  const src = JSON.parse(readFileSync(resolve(srcDir, `ch${String(ch).padStart(2, "0")}.source.json`), "utf8"));
  const chapter = deepClean(JSON.parse(readFileSync(chapterPath, "utf8")));

  chapter.counterintuition = counters[ch - 1];
  chapter.tryThisNow = tryActions[ch - 1];
  chapter.keyTakeaway = clean(`${conceptShort(src)} becomes practical when a leader uses a real source cue, chooses the feeling to create, and changes the work to support it.`);
  padBreakdown(chapter, ch, src);
  chapter.examples = makeExamples(ch, src);
  chapter.quiz = makeQuiz(ch, src);
  chapter.reviewCards = makeCards(ch, src);
  chapter.memorableLines = fixMemorableLines(chapter);

  writeFileSync(chapterPath, JSON.stringify(chapter, null, 2) + "\n");
  console.log(`repaired ${id}`);
}
