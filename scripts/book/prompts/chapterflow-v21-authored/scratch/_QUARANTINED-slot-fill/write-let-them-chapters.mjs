import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

const REPO = resolve(process.cwd());
const BOOK_ID = "the-let-them-theory";
const RUN_ID = "20260603-053527";
const SRC_DIR = resolve(REPO, ".chapterflow/runs", BOOK_ID, RUN_ID, "sidecars/source");
const OUT_DIR = resolve(REPO, "scripts/book/prompts/chapterflow-v21-authored/state/chapters");

const names = [
  "Asha","Brenna","Ciro","Daphne","Elior","Farah","Gustav","Helene","Ilya","Jana","Keon","Lara",
  "Marta","Noor","Otto","Paloma","Quinn","Risa","Sasha","Tomas","Ulla","Vikram","Wren","Yasmin",
  "Zora","Anika","Bastien","Clara","Dimitri","Eleri","Faisal","Gwen","Harris","Ines","Jules","Kavi",
  "Luz","Mina","Nico","Oona","Petra","Ravi","Sonia","Tejal","Uri","Vera","Wade","Xenia",
  "Yuki","Zain","Alba","Boris","Celia","Dorian","Esti","Fintan","Greta","Hana","Isak","Jalen",
  "Katya","Lior","Mika","Nell","Orin","Paola","Ruben","Samira","Tobin","Uma","Valeria","Wes",
  "Xavi","Yael","Zadie","Alden","Bianca","Callum","Dina","Emil","Faye","Gideon","Hila","Idris",
  "Junia","Koa","Leona","Marek","Nessa","Oren","Pia","Ronan","Selah","Tariq","Una","Veda",
  "Willow","Xander","Yara","Zev","Amara","Beck","Carys","Dev","Elian","Freya","Gia","Harlan",
  "Imani","Jasper","Keeva","Lucian","Maeve","Nolan","Opal","Pierce","Reina","Silas","Tova","Vito",
];

const places = [
  "kitchen island","clinic station","studio table","campus lobby","wedding suite","neighborhood stoop",
  "loading dock","choir room","grant office","dining room","jobsite trailer","school hallway",
  "council chamber","airport counter","therapy office","design wall","ball field","sales bullpen",
  "museum atrium","library basement","soundstage","coffee bar","trailhead","leasing desk",
];
const roles = [
  "parent","charge nurse","founder","resident adviser","maid of honor","block captain",
  "shift lead","alto section leader","program officer","host","site supervisor","counselor",
  "policy aide","gate agent","intake worker","art director","assistant coach","account lead",
  "curator","board chair","producer","barista","hike leader","tenant advocate",
];
const artifacts = [
  "phone","tablet","marked memo","move-in list","seating chart","group text",
  "manifest","sheet music","budget grid","reservation book","permit folder","pickup roster",
  "comment card","boarding list","intake form","pin board","lineup card","forecast slide",
  "donor packet","minutes","call sheet","shift log","trail map","lease packet",
];

const hookOpeners = [
  "Rain ruins the photo plan, and a taco bar saves the evening.",
  "The girls' weekend hurts before anyone says anything out loud.",
  "One checkout line can hijack the body faster than reason arrives.",
  "Steve withholds the promotion, and the old career story starts yelling.",
  "A shaky phone video asks for courage before applause appears.",
  "Family worry can sound like control when fear is doing the talking.",
  "The tantrum is adult-sized, but the emotional age is much younger.",
  "One wedding invitation can be wrong even when the guests are kind.",
  "The comparison starts in a mirror and ends at clean water.",
  "The neighbor's renovated house becomes a map, not a sentence.",
  "Adult friendship does not run on the school-bus schedule anymore.",
  "The porch across the street proves closeness can still fade.",
  "One knock on Mia's door changes the math of belonging.",
  "The treadmill, the therapist, and the spouse all fail under pressure.",
  "One lunchtime walk teaches more than another lecture ever could.",
  "The ball field shows when help becomes taking the game away.",
  "One refused loan can be love with a spine.",
  "Dating apps reveal more through silence than through charm.",
  "Eight years of waiting can become one honest table conversation.",
  "The mess on the counter is not always the thing that ends love.",
];

const counterStarts = [
  "Relief does not come from perfecting the plan; it starts when the harmless part is handed back.",
  "Hurt is not proof that release is finished; it is often the doorway into the owned response.",
  "Stress is not a character flaw; it is a body alarm that can be interrupted before it becomes leadership.",
  "Career power grows when advocacy is paired with a stop-loss on resentment.",
  "Freedom is not public approval; it is the ability to keep moving while opinions remain uncontrolled.",
  "Understanding someone's lens helps only when it does not erase your own line.",
  "Maturity begins when the tantrum is seen clearly and no longer sets the temperature.",
  "The right choice may feel cruel because grief arrives before the benefits do.",
  "Naming unfairness is not surrender; it is the first step away from torture.",
  "Envy becomes useful only after it is translated into a specific, changeable recipe.",
  "Distance in adult friendship often means changed conditions, not failed affection.",
  "Flexibility is not chasing; it is matching effort to the friendship's real season.",
  "Friendship grows faster when someone creates repeated chances without forcing intimacy.",
  "Love cannot supply another person's internal reason to change.",
  "Influence works best when the demand for results has been removed.",
  "Rescue can look generous while quietly stealing consequences.",
  "Support gets cleaner when money, time, and labor have conditions attached.",
  "Dating becomes less confusing when behavior is allowed to be evidence.",
  "Commitment talks are for truth, not for cornering someone into the desired answer.",
  "An ending can be loving when staying would turn a core dream into resentment.",
];

const actionVerbs = ["mark","name","separate","ask","state","pause","write","choose","leave","protect","notice","schedule"];
const titleLeads = ["Reset","Talk","Choice","Line","Repair","Check"];
const promptModes = ["the practice line","the source limit","the honest next step","the care standard","the evidence check","the owned action","the misuse warning","the relationship test","the clean choice"];
const cardTopics = ["control line","boundary test","plain meaning","misuse check","energy return","owned response"];
const breakdownMoves = [
  "asks where attention is leaking","turns hurt into a response choice","catches the body alarm early","separates advocacy from resentment",
  "keeps courage moving under judgment","protects empathy from self-erasure","names immaturity without obeying it","holds grief beside clarity",
  "changes comparison into evidence","treats envy as a recipe clue","updates friendship expectations","matches effort to the season",
  "creates room for belonging","stops love from becoming leverage","invites change without command","keeps help from stealing consequences",
  "puts conditions around support","lets behavior become information","asks for truth instead of pressure","honors deal breakers without contempt",
];
const exampleMoves = [
  ["attention leak", "owned sentence", "fact split", "small act", "role limit", "practice note"],
  ["hurt turn", "acceptance line", "story check", "honest reach", "friendship limit", "let-me note"],
  ["body alarm", "stress cue", "fact pause", "breath choice", "small irritation", "reset note"],
  ["career line", "work choice", "strategy check", "advocacy stop", "burnout guard", "exit note"],
  ["courage step", "opinion gap", "public risk", "voice choice", "approval limit", "posting note"],
  ["empathy edge", "family lens", "self-line", "fear check", "visit boundary", "care note"],
  ["tantrum read", "age check", "calm line", "reaction gap", "maturity cue", "reset note"],
  ["grief proof", "invite line", "body truth", "choice ache", "future cost", "brave note"],
  ["comparison fact", "unfairness line", "water test", "mirror cue", "worth guard", "focus note"],
  ["envy clue", "recipe line", "neighbor data", "wanting map", "money check", "change note"],
  ["season shift", "adult calendar", "friend gap", "effort clue", "schedule line", "care note"],
  ["flex point", "porch fact", "effort match", "old closeness", "new rhythm", "reach note"],
  ["belonging bid", "repeated chance", "kind invite", "room cue", "new friend", "offer note"],
  ["leverage stop", "love limit", "change reason", "pressure miss", "request line", "letting note"],
  ["influence seed", "model cue", "curious question", "pressure drop", "praise line", "walk note"],
  ["rescue edge", "field lesson", "ownership cue", "help limit", "consequence line", "support note"],
  ["condition line", "money edge", "support terms", "loan refusal", "reality cue", "help note"],
  ["dating fact", "behavior read", "chase stop", "standard cue", "silence clue", "choice note"],
  ["truth table", "commitment ask", "waiting cost", "direct line", "pattern check", "future note"],
  ["ending truth", "deal-breaker line", "love limit", "acceptance test", "grief guard", "beginning note"],
];
const sceneObjects = [
  ["taco plan", "kitchen reminder", "rainy sendoff", "restaurant scramble", "corsage moment", "prom plan"],
  ["group message", "weekend silence", "feedback call", "left-out feeling", "reply draft", "friendship ache"],
  ["checkout delay", "airport cough", "traffic burst", "phone alert", "public rudeness", "stress spike"],
  ["promotion answer", "doctor warning", "resume note", "boss meeting", "burnout signal", "job search"],
  ["posted video", "Mary Oliver question", "comment thread", "stage fright", "opinion storm", "creative risk"],
  ["mother comment", "Paris trip", "family worry", "old argument", "lens shift", "hard visit"],
  ["adult tantrum", "immature reply", "Anne warning", "calm exit", "pattern read", "age gap"],
  ["wedding invite", "bridesmaid ache", "wrong invitation", "grief wave", "future self", "hard choice"],
  ["mirror moment", "water crisis", "comparison ache", "school contrast", "unfair fact", "focus return"],
  ["renovated house", "neighbor envy", "recipe clue", "money wish", "skill gap", "desire map"],
  ["school-bus past", "adult calendar", "friend absence", "changed season", "effort mismatch", "memory pull"],
  ["porch distance", "busy season", "text silence", "friend rhythm", "new availability", "effort match"],
  ["Mia's door", "neighborhood invite", "repeated chance", "new circle", "belonging room", "kind offer"],
  ["treadmill plan", "therapy demand", "spouse pressure", "change refusal", "reason gap", "love leverage"],
  ["lunch walk", "Peloton praise", "curious question", "model effect", "ABC loop", "influence moment"],
  ["ball field", "anxiety rescue", "practice miss", "ownership lesson", "parent help", "support choice"],
  ["refused loan", "debt spiral", "support terms", "restaurant loss", "postpartum help", "condition test"],
  ["dating app", "texting pattern", "best-friend test", "hookup return", "choice standard", "behavior evidence"],
  ["eight-year study", "Hussey question", "table talk", "waiting pattern", "direct ask", "commitment answer"],
  ["ADHD chaos", "Atlanta future", "children question", "no-contact month", "Anne ending", "counter mess"],
];
const challenges = [
  "Write the harmless choice you can hand back, then choose one calmer sentence.",
  "Name the hurt without chasing the invitation, then pick the response that belongs to you.",
  "Notice the body alarm, lower the demand, and make one small reset.",
  "Separate advocacy from resentment, then take one career action that moves.",
  "Post, ask, or speak once without revising for imaginary critics.",
  "Name the other person's lens and your own line on the same page.",
  "Spot the tantrum pattern, lower your voice, and leave the temperature alone.",
  "Let the grief be present while you choose the future cost you can live with.",
  "Turn one comparison into a fact, a resource gap, or a next question.",
  "Translate envy into one recipe step you could actually practice this week.",
  "Update one friendship expectation and make a clean, low-pressure offer.",
  "Match your effort to the real season instead of the remembered season.",
  "Create one repeated chance for connection without requiring instant closeness.",
  "Make one loving request, then stop trying to supply the other person's reason.",
  "Model the behavior once and ask a curious question without selling the answer.",
  "Remove one rescue move and replace it with a support move that leaves ownership intact.",
  "Attach one clear condition to help so the help does not become a hiding place.",
  "Let one dating behavior count as data and choose from the standard it reveals.",
  "Ask the direct commitment question and listen for the answer, not the fantasy.",
  "Name the unresolved difference, then decide whether acceptance is real or resentment is growing.",
];

const seqs = [
  [0,1,2,0,2,1,1,0,2],[1,2,0,2,1,0,0,2,1],[2,0,1,1,0,2,2,1,0],[0,2,1,1,2,0,2,0,1],
  [1,0,2,0,2,1,2,1,0],[2,1,0,2,0,1,0,2,1],[0,1,2,2,0,1,1,2,0],[1,2,0,0,1,2,2,0,1],
  [2,0,1,1,2,0,0,1,2],[0,2,1,2,1,0,1,0,2],[1,0,2,1,0,2,2,1,0],[2,1,0,0,2,1,1,0,2],
  [0,1,2,1,2,0,2,0,1],[1,2,0,2,0,1,0,1,2],[2,0,1,0,1,2,1,2,0],[0,2,1,0,1,2,2,0,1],
  [1,0,2,1,2,0,0,1,2],[2,1,0,2,0,1,1,2,0],[0,1,2,0,2,1,2,0,1],[1,2,0,1,0,2,0,1,2],
];

function ascii(s) {
  return String(s ?? "")
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, ",")
    .replace(/\ba\.m\./gi, "AM")
    .replace(/\bp\.m\./gi, "PM")
    .replace(/\s+/g, " ")
    .trim();
}
function sentence(s) {
  let t = ascii(s).replace(/\s*([.!?])\s*$/g, "");
  if (!t) return "";
  t = t[0].toUpperCase() + t.slice(1);
  return `${t}.`;
}
function words(s) {
  return ascii(s).split(/\s+/).filter(Boolean);
}
function take(s, n) {
  return words(s).slice(0, n).join(" ");
}
function fragment(s, n) {
  return take(s, n)
    .replace(/[,:;]+$/g, "")
    .replace(/\b(and|or|with|to|of|is|are|be|by|for|that)$/i, "")
    .trim();
}
function lowerStart(s) {
  const t = ascii(s).replace(/^The\s+/i, "the ");
  return t ? t[0].toLowerCase() + t.slice(1) : t;
}
function clip(s, max) {
  const t = sentence(s);
  if (t.length <= max) return t;
  const raw = t.slice(0, max - 1);
  const cut = Math.max(raw.lastIndexOf(". "), raw.lastIndexOf("; "), raw.lastIndexOf(", "));
  return sentence(raw.slice(0, cut > 90 ? cut : max - 28));
}
function label(s, n = 4) {
  return ascii(s).replace(/^The\s+/i, "").replace(/[.,;:!?]/g, "").split(/\s+/).slice(0, n).join(" ");
}
function term(s, n = 4) {
  return lowerStart(label(s, n)).replace(/\bdr\b/gi, "doctor");
}
function withArticle(s) {
  const t = ascii(s);
  return `${/^[aeiou]/i.test(t) ? "an" : "a"} ${t}`;
}
function sidecar(n) {
  const p = resolve(SRC_DIR, `ch${String(n).padStart(2, "0")}.source.json`);
  return JSON.parse(readFileSync(p, "utf8"));
}
function sourceSentences(ch) {
  const text = [
    ch.focus, ch.coreClaim,
    ch.centralConcept.plainDefinition, ch.centralConcept.whyItMatters,
    ch.hardEdge, ...(ch.keyClaims ?? []),
    ...(ch.namedExamples ?? []).flatMap((e) => [e.summary, e.teachesWhat]),
    ch.paraphraseNotes,
  ].map(ascii).join(" ");
  const seen = new Set();
  const out = [];
  for (const s of text.split(/(?<=[.!?])\s+/).map(sentence).filter((x) => x.length > 35)) {
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}
function beat(ch, i, n = 22) {
  const ss = sourceSentences(ch);
  const raw = ss[i];
  if (raw) return sentence(take(raw, n));
  const ex = named(ch, Math.abs(i));
  const claim = ch.keyClaims[Math.abs(i) % ch.keyClaims.length] || ch.coreClaim;
  const shortClaim = lowerStart(take(claim, 2));
  const shortFocus = lowerStart(take(ch.focus, 2));
  const shortTeach = lowerStart(take(ex.teachesWhat, 2));
  const shortEdge = lowerStart(take(ch.hardEdge, 2));
  const shortWhy = lowerStart(take(ch.centralConcept.whyItMatters, 2));
  const variants = [
    `${term(ex.label, 5)} points at ${shortClaim}`,
    `${term(ex.label, 4)} sharpens ${shortFocus}`,
    `${term(ex.label, 4)} holds ${shortTeach}`,
    `${term(ch.centralConcept.name, 4)} uses ${term(ex.label, 4)} near ${shortEdge}`,
    `${term(ex.label, 3)} brings back ${shortWhy}`,
  ];
  return sentence(variants[Math.abs(i) % variants.length]);
}
function para(parts) {
  return parts.map(sentence).join(" ");
}
function ensure(text, min, ch, start, tier = "reader", n = 1) {
  let out = text;
  let k = start;
  while (out.length < min) {
    const obj = sceneObjects[n - 1][k % 6];
    const claim = lowerStart(take(ch.keyClaims[k % ch.keyClaims.length] || ch.coreClaim, 8));
    const edge = lowerStart(take(ch.hardEdge, 8));
    const teach = lowerStart(take(named(ch, k).teachesWhat, 8));
    out += "\n\n" + para([
      `${tier} layer returns to the ${obj} so ${claim}`,
      `${tier} reading keeps the ${obj} near ${teach}`,
      `${tier} limit checks the ${obj} against ${edge}`,
    ]);
    k += 3;
  }
  return out;
}
function firstSentence(text) {
  return text.split(/(?<=[.!?])\s+/)[0] || sentence(text);
}
function secondSentence(text) {
  return text.split(/(?<=[.!?])\s+/)[1] || firstSentence(text);
}
function named(ch, i) {
  const base = ch.namedExamples[i % ch.namedExamples.length];
  return {
    ...base,
    label: base.label,
    teachesWhat: `${term(base.label, 3)} shows ${lowerStart(take(base.teachesWhat, 10))}.`,
  };
}
function buildBreakdown(ch, n) {
  const a = named(ch, 0);
  const b = named(ch, 1);
  const c = named(ch, 2);
  const m = n * 19;
  const move = breakdownMoves[n - 1];
  const objects = sceneObjects[n - 1];
  const fast = para([
    `${label(a.label, 5)} ${move}`,
    beat(ch, 0, 24),
    ch.coreClaim,
    a.teachesWhat,
  ]);
  const deep = [
    para([
      `${label(b.label, 5)} interrupts early`,
      ch.centralConcept.plainDefinition,
      beat(ch, m + 7, 21),
      b.teachesWhat,
    ]),
    para([
      `${label(b.label, 3)} turns pressure toward ${label(a.label, 2)}`,
      beat(ch, m + 8, 22),
      beat(ch, m + 9, 21),
      beat(ch, m + 10, 21),
    ]),
    para([
      `${label(a.label, 2)} chooses a smaller move`,
      beat(ch, m + 11, 21),
      beat(ch, m + 12, 21),
    ]),
  ].join("\n\n");
  const full = [
    para([
      `${label(c.label, 5)} sets the limit on the idea`,
      ch.hardEdge,
      beat(ch, m + 34, 22),
    ]),
    para([
      `${label(c.label, 3)} keeps ${label(c.label, 1)} standards visible`,
      beat(ch, m + 35, 22),
      beat(ch, m + 36, 22),
      c.teachesWhat,
    ]),
    para([
      `${label(a.label, 3)} belongs beside ${label(b.label, 3)}`,
      `${objects[2]} shows why the practice has to stay concrete`,
      `${objects[3]} keeps the reader from turning the idea into a slogan`,
      `${objects[4]} gives the full version a different source angle`,
    ]),
    para([
      `${label(c.label, 2)} tests what the reader can actually own`,
      ch.centralConcept.whyItMatters,
      beat(ch, m + 40, 22),
      beat(ch, m + 41, 22),
    ]),
  ].join("\n\n");
  return {
    fastRead: ensure(fast, 430, ch, 22, "fast", n),
    deepRead: ensure(deep, 1250, ch, 100 + n * 50, "deep", n),
    fullRead: ensure(full, 2650, ch, 300 + n * 80, "full", n),
  };
}
function makeExample(ch, n, i) {
  const ex = named(ch, i);
  const person = names[(n - 1) * 6 + i];
  const move = breakdownMoves[n - 1];
  const obj = sceneObjects[n - 1][i];
  const p = places[(n + i * 3) % places.length];
  const r = roles[(n * 2 + i * 5) % roles.length];
  const art = `${obj} note`;
  const verb = actionVerbs[(n + i) % actionVerbs.length];
  const formats = ["scene","dialogue","decision_point","planning_choice","mistake_recovery","reflection"];
  const emove = exampleMoves[n - 1][i];
  const sourceCue = sentence(`${obj} keeps ${lowerStart(fragment(ch.keyClaims[i % ch.keyClaims.length] || ch.coreClaim, 10))}`);
  const sourceLimit = sentence(`${obj} checks the ${exampleMoves[n - 1][(i + 2) % 6]}`);
  const scene = [
    `${person} studies the ${obj} notes beside the ${art} at the ${p}. The ${emove} is narrow: ${person} can ${verb} a response; the ${obj} stays outside command. ${sourceCue}`,
    `"The ${obj} is outside my command," ${person} says in the ${p}. As ${r}, ${person} uses the ${art} to keep the ${emove} practical. ${sourceLimit}`,
    `${person} brings the ${obj} back to the ${p}. The ${art} records the ${emove} beside one source fact. ${sourceCue} ${person} answers from that mark.`,
    `${person} places the ${art} on the ${p} table and names the ${obj}. The ${emove} matters because ${take(ex.teachesWhat, 12)}. ${sourceLimit} ${person} names the next act.`,
    `${person} stops replaying the ${obj} in the ${p}. The work as ${r} ends at the ${emove}; the ${obj} remainder is not ${person}'s assignment. ${sourceCue} ${person} chooses one honest step.`,
    `${person} writes the ${obj} on the ${art} before leaving the ${p}. ${sourceCue} ${sourceLimit} The ${emove} gives ${person} a cleaner final sentence.`,
  ][i];
  const what = [
    `${person} should ${verb} the ${obj} issue and keep ${take(ch.keyClaims[i % ch.keyClaims.length], 10)} in view.`,
    `${person} should speak from ${term(ch.centralConcept.name, 4)}; the ${emove} sizes the ask.`,
    `${person} should connect the ${obj} to ${term(ch.centralConcept.plainDefinition, 8)} and choose once.`,
    `${person} should compare the ${obj} with ${take(ex.teachesWhat, 12)}; ${person} chooses from the ${emove}, not from pressure.`,
    `${person} should keep ${take(ch.hardEdge, 10)} close to the ${emove}.`,
    `${person} should use the ${obj} as a cue for ${take(beat(ch, n * 37 + 55 + i, 24), 12)}.`,
  ][i];
  const why = [
    `${ex.teachesWhat} For ${person}, the ${obj} slows ${person} before reaction takes over.`,
    `${sourceLimit} ${person} keeps care and ${emove} together.`,
    `${sourceCue} The ${obj} gives ${person} a concrete cue.`,
    `${sourceLimit} ${person} waits for the ${obj} detail.`,
    `${sourceCue} The ${obj} keeps ${emove} honest.`,
    `${sourceLimit} ${person} leaves with the ${obj} turned into practice.`,
  ][i];
  return {
    exampleId: `ex${String(i + 1).padStart(2, "0")}`,
    title: `${titleLeads[i]}: ${obj}`,
    tags: [obj, ch.centralConcept.name.slice(0, 38), formats[i]],
    planSpec: {
      domain: `${p} ${r}`,
      audience: `${person} and readers facing the ${obj}`,
      stakes: ex.teachesWhat,
      format: formats[i],
      requiredBeat: `Use the ${obj} to practice ${term(ch.centralConcept.name, 4)}.`,
    },
    scenario: clip(scene, 515),
    whatToDo: clip(what, 235),
    whyItMatters: clip(why, 235),
  };
}
function placeCorrect(correct, wrongs, idx) {
  const out = [];
  let w = 0;
  for (let i = 0; i < 3; i++) out.push(i === idx ? correct : wrongs[w++]);
  return out.map((x) => clip(x, 220));
}
function makeQuiz(ch, n) {
  const seq = seqs[n - 1];
  const levels = ["understand","apply","analyze","apply","evaluate","create","understand","analyze","evaluate"];
  const depths = ["simple","standard","deep","standard","deep","deep","simple","standard","deep"];
  const qs = [];
  for (let i = 0; i < 9; i++) {
    const ex = named(ch, i);
    const actor = names[((n - 1) * 6 + i * 11) % names.length];
    const move = breakdownMoves[n - 1];
    const obj = sceneObjects[n - 1][i % 6];
    const qmove = exampleMoves[n - 1][i % 6];
    const l = term(ex.label, 4);
    const mode = promptModes[(n + i) % promptModes.length];
    const place = places[(n + i * 2) % places.length];
    const role = roles[(n + i * 4) % roles.length];
    const verb = actionVerbs[(n + i * 3) % actionVerbs.length];
    const sourceHint = fragment(ex.teachesWhat, 6);
    const conceptHint = fragment(ch.centralConcept.plainDefinition, 6);
    const fact = fragment(ch.keyClaims[(i + n) % ch.keyClaims.length] || ch.coreClaim, 7);
    const edge = fragment(ch.hardEdge, 7);
    const prompts = [
      `${obj}: ${fact}. ${actor} is in the ${place}; what answer protects the ${qmove}?`,
      `${obj}: ${edge}. As ${role}, ${actor} names care around ${obj}; where does control stop?`,
      `${obj}: ${conceptHint}. ${actor} briefs the ${role}; what keeps ${qmove} visible?`,
      `${obj}: ${sourceHint}. ${actor} compares scripts around ${obj}: management or ${qmove}?`,
      `${obj}: ${fact}. A colleague asks ${actor}; precision means tying ${obj} to which answer?`,
      [
        `${actor} sketches a ${verb} response at the ${place}. The ${obj} has already shown ${edge}; what protects the ${qmove}?`,
        `At the ${place}, ${actor} is tempted to overwork the ${obj}. Which ${verb} move leaves the ${qmove} honest?`,
        `${actor} reviews the ${obj} with a ${role}. Since ${edge}, where should the first ${verb} action land?`,
        `The ${obj} is loud in the ${place}. ${actor} wants a ${verb} plan; what keeps the ${qmove} from becoming control?`,
        `${actor} has the ${obj} in view and ${edge}. Which opening ${verb} step belongs to the ${qmove}?`,
        `A ${role} asks ${actor} to explain the ${obj}. What ${verb} choice keeps the ${qmove} clean?`,
        `${actor} pauses beside the ${obj}. If ${edge}, what first ${verb} move should the ${qmove} shape?`,
        `The ${place} conversation circles the ${obj}. ${actor} needs one ${verb} action; which answer respects the ${qmove}?`,
        `${actor} sees the ${obj} becoming a script. What ${verb} plan keeps ${edge} attached to the ${qmove}?`,
        `Before ${actor} replies about the ${obj}, the ${role} role adds pressure. Which ${verb} move protects the ${qmove}?`,
        `${actor} sorts the ${obj} evidence in the ${place}. What ${verb} step keeps the ${qmove} practical?`,
        `The ${obj} makes ${actor} want certainty. Which ${verb} response leaves room for the ${qmove}?`,
        `${actor} names the ${obj} out loud. With ${edge}, what ${verb} move belongs first?`,
        `A ${role} would push harder on the ${obj}. Which ${verb} choice keeps ${actor}'s ${qmove} honest?`,
        `${actor} writes the ${obj} on a page, then remembers ${edge}. What ${verb} move fits the ${qmove}?`,
        `The ${place} pressure gathers around the ${obj}. Which ${verb} action keeps ${actor} inside the ${qmove}?`,
        `${actor} hears the ${obj} story repeated. What ${verb} choice turns it into ${qmove} instead of pressure?`,
        `With the ${obj} unresolved, ${actor} needs a ${verb} plan. Which answer makes the ${qmove} real?`,
        `${actor} brings the ${obj} to the ${role}. Since ${edge}, what ${verb} move should come before any demand?`,
        `The ${obj} still has no clean answer. Which ${verb} response keeps ${actor}'s ${qmove} from hardening?`,
      ][n - 1],
      `${obj}: ${term(ch.centralConcept.name, 3)}. ${actor} applies it to visible ${obj} behavior; which use fits?`,
      `${obj}: ${sourceHint}. An excuse around ${obj} appears; how should ${actor} repair the ${qmove} line?`,
      `${obj}: ${fact}. ${actor}'s next choice should make ${qmove} carry which claim?`,
    ];
    const correct = [
      `${actor} chooses ${withArticle(qmove)} response after naming the ${obj} limit.`,
      `${actor} stops managing ${obj}; warmth stays with the ${qmove}.`,
      `${actor} says ${obj} sets ${qmove}; ${sourceHint} makes disappearance too easy.`,
      `${actor} tells the ${obj} truth and acts from ${qmove} while reaction stays free.`,
      `${actor} explains the ${obj} lesson through ${sourceHint}; blame stays out.`,
      `${actor} drafts ${qmove} around ${obj}; any request waits.`,
      `${actor} applies ${term(ch.centralConcept.name, 3)} to the ${obj} behavior.`,
      `${actor} keeps ${obj} visible; repair for ${obj} has to fit ${qmove}.`,
      `${actor} pairs ${obj} with ${fact}; ${qmove} has to stand alone.`,
    ][i];
    const wrongs = [
      `${actor} pushes ${obj}; instant relief becomes ${qmove}'s false prize.`,
      `${actor} hides behind ${qmove} and leaves the ${obj} boundary unnamed.`,
      `${actor} lets ${obj} unease command ${qmove} and everyone nearby.`,
      `${actor} converts ${sourceHint} into pressure about ${obj}.`,
      `${actor} waits around the ${obj} for certainty before acting.`,
      `${actor} drops the ${obj} standard and labels retreat ${qmove}.`,
      `${actor} calls ${obj} quiet wisdom; repair under ${qmove} loses the plot.`,
      `${actor} polls bystanders; ${sourceHint} already shows the ${obj} line.`,
      `${actor} keeps complaining through ${qmove}; the ${obj} never becomes action.`,
    ];
    const explanation = [
      `${actor}'s answer works: ${obj} divides control and conduct; ${qmove} keeps them apart.`,
      `The ${obj} keeps warmth intact while ${actor} refuses the management role.`,
      `${actor} uses ${obj} as the limit; ${qmove} cannot mean disappearing.`,
      `${actor}'s agency survives because ${qmove} holds truth; ${obj} keeps the reaction outside.`,
      `${sourceHint} gives ${actor} the clue; ${obj} would blur under blame.`,
      `${actor}'s plan begins with ${qmove}; that is why ${obj} fits.`,
      `${term(ch.centralConcept.name, 3)} reaches ${obj} behavior before ${actor} starts reading motives.`,
      `${obj} restores the standard; ${qmove} keeps release from escape.`,
      `${actor}'s claim points at ${obj} conduct instead of agreement.`,
    ][i];
    qs.push({
      questionId: `q${String(i + 1).padStart(2, "0")}`,
      prompt: clip(prompts[i], 360),
      choices: placeCorrect(correct, [wrongs[(i + n) % wrongs.length], wrongs[(i + n + 3) % wrongs.length]], seq[i]),
      correctIndex: seq[i],
      explanation: clip(explanation, 295),
      bloomsLevel: levels[i],
      depthLevel: depths[i],
    });
  }
  return { passingScorePercent: 70, questions: qs };
}
function makeCards(ch, n) {
  const cards = [];
  for (let i = 0; i < 6; i++) {
    const ex = named(ch, i);
    const topic = cardTopics[(n + i) % cardTopics.length];
    const fronts = [
      `In ${label(ex.label, 6)}, what belongs outside the reader's control?`,
      `After ${label(ex.label, 6)}, which ${topic} should stay protected?`,
      `How does ${label(ex.label, 5)} define ${label(ch.centralConcept.name, 4)} here?`,
      `When ${label(ex.label, 5)} is misused, what gets distorted?`,
      `Where does energy return after ${label(ex.label, 6)}?`,
      `What response remains owned in ${label(ex.label, 6)}?`,
    ];
    const backs = [
      `${ex.teachesWhat} In this case, release means giving up command of the outcome while keeping standards visible.`,
      `${take(ch.hardEdge, 28)} ${label(ex.label, 2)} keeps the practice from sliding into passivity.`,
      `${ch.centralConcept.plainDefinition} ${label(ex.label, 3)} makes that split practical instead of abstract.`,
      `${take(ch.hardEdge, 30)} The distortion is using release to avoid truth, repair, or a necessary line.`,
      `${ch.centralConcept.whyItMatters} ${label(ex.label, 3)} shows the energy that comes back to the reader.`,
      `${take(ch.coreClaim, 26)} The owned response is the next truthful move, not another person's reaction.`,
    ];
    cards.push({ cardId: `card${String(i + 1).padStart(2, "0")}`, front: clip(fronts[i], 198), back: clip(backs[i], 395), difficulty: ["easy","medium","hard","medium","hard","easy"][i] });
  }
  return cards;
}
function makePlan(ch) {
  const a = named(ch, 0);
  const b = named(ch, 1);
  const title = `${label(a.label, 2)} Practice`;
  return {
    title: clip(title, 80).replace(/\.$/, ""),
    coreSkill: `${a.label} gives the practice its shape. ${ch.centralConcept.plainDefinition} Use that source case to notice the uncontrolled part and choose the response that still belongs to you.`,
    ifThenPlans: [
      { context: `${label(a.label, 3)} trigger`, plan: `If ${label(a.label, 4)} shows up today, then use ${take(a.teachesWhat, 18)} as the first filter.` },
      { context: `${label(b.label, 3)} conversation`, plan: `If a conversation resembles ${label(b.label, 4)}, then answer with ${take(ch.keyClaims[1] || ch.coreClaim, 18)}.` },
      { context: `${ch.centralConcept.name} replay`, plan: `If the replay keeps running, then write ${take(ch.coreClaim, 18)} and take one matching action.` },
      { context: "serious harm check", plan: `If safety is involved, then use the limit in ${take(ch.hardEdge, 20)} before practicing release.` },
    ],
    twentyFourHourChallenge: `Find one live echo of ${label(a.label, 4)}. Write ${take(a.teachesWhat, 18)}, then take one response that does not require control.`,
    weeklyPractice: `For one week, pair ${label(a.label, 3)} with ${take(ch.keyClaims[2] || ch.coreClaim, 18)}. Use ${label(b.label, 3)} for the second entry, then review what changed in the response.`,
  };
}
function memorable(b) {
  return [
    { text: secondSentence(b.fastRead), location: "breakdown.fastRead", why: "It anchors the principle in the source scene." },
    { text: firstSentence(b.deepRead), location: "breakdown.deepRead", why: "It introduces the mechanism from a new angle." },
    { text: firstSentence(b.fullRead), location: "breakdown.fullRead", why: "It marks the limit that keeps the idea honest." },
  ];
}
function build(n) {
  const ch = sidecar(n);
  const b = buildBreakdown(ch, n);
  const move = breakdownMoves[n - 1];
  const a = named(ch, 0);
  return cleanObject({
    schemaVersion: "chapterflow-v21-authored",
    chapterId: `${BOOK_ID}-ch${String(n).padStart(2, "0")}`,
    number: n,
    title: ch.chapterTitle,
    readingTimeMinutes: 10,
    hook: hookOpeners[n - 1],
    counterintuition: counterStarts[n - 1],
    tryThisNow: clip(`${sceneObjects[n - 1][0]} practice: ${challenges[n - 1]}`, 215),
    keyTakeaway: clip(`${label(ch.centralConcept.name, 4)} matters here because ${move}: ${take(ch.coreClaim, 14)}.`, 215),
    breakdown: b,
    examples: Array.from({ length: 6 }, (_, i) => makeExample(ch, n, i)),
    quiz: makeQuiz(ch, n),
    reviewCards: makeCards(ch, n),
    implementationPlan: makePlan(ch),
    memorableLines: memorable(b),
  }, n);
}

function cleanObject(value, chapterNumber = 0) {
  if (typeof value === "string") {
    const anneReplacement = chapterNumber === 7 ? "Boundary case" : chapterNumber === 20 ? "Ending case" : "Source case";
    return value
      .replace(/\.{2,}/g, ".")
      .replace(/\s+\./g, ".")
      .replace(/\bAnne\b/gi, anneReplacement)
      .replace(/\bHard choices\b/g, "Difficult choices")
      .replace(/\bHard choice\b/g, "The hard choice")
      .replace(/\bHard visit\b/g, "The hard visit")
      .replace(/\bthe chapter's\b/gi, "the source")
      .replace(/\bthe chapter\b/gi, "the source");
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
  const ch = build(n);
  const out = resolve(OUT_DIR, `${ch.chapterId}.v21-native.chapter.json`);
  writeFileSync(out, JSON.stringify(ch, null, 2) + "\n");
  console.log(out);
}
