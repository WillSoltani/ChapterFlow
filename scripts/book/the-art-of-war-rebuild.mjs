#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const ROOT = process.cwd();
const BOOK_ID = "the-art-of-war";
const BOOK_TITLE = "The Art of War";
const AUTHOR = "Sun Tzu";
const EDITION = { name: "Lionel Giles Translation", publishedYear: 1910 };
const SCHEMA_VERSION = "3.0";
const CONTENT_OWNER = "ChapterFlow";
const OUTPUT_PACKAGE_PATH = path.join(ROOT, "book-packages", `${BOOK_ID}.modern.json`);

const TMP_PREFIX = path.join("/tmp", BOOK_ID);
const MASTER_BRIEF_PATH = `${TMP_PREFIX}-master-brief.json`;
const RESEARCH_DOSSIER_PATH = `${TMP_PREFIX}-research-dossier.json`;
const CONTINUITY_LEDGER_PATH = `${TMP_PREFIX}-continuity-ledger.json`;
const PHASE0_REPORT_PATH = `${TMP_PREFIX}-phase0-reference-report.json`;
const PHASE4_REPORT_PATH = `${TMP_PREFIX}-phase4-report.json`;
const PHASE7_REPORT_PATH = `${TMP_PREFIX}-phase7-report.json`;
const COVER_REPORT_PATH = `${TMP_PREFIX}-cover-report.json`;
const PUBLISH_PACKAGE_PATH = `${TMP_PREFIX}.publish.json`;

const PROMPT_PATHS = {
  content: path.join(ROOT, "scripts", "book", "prompts", "the-art-of-war-content-agent.md"),
  quiz: path.join(ROOT, "scripts", "book", "prompts", "the-art-of-war-quiz-agent.md"),
  validator: path.join(ROOT, "scripts", "book", "prompts", "the-art-of-war-validator-agent.md"),
};

const FORMAT_PRESETS = [
  {
    work: ["decision_point", "dialogue"],
    school: ["postmortem", "before_after"],
    personal: ["predict_reveal", "dilemma"],
  },
  {
    work: ["before_after", "postmortem"],
    school: ["dialogue", "decision_point"],
    personal: ["dilemma", "predict_reveal"],
  },
  {
    work: ["predict_reveal", "dilemma"],
    school: ["before_after", "dialogue"],
    personal: ["decision_point", "postmortem"],
  },
  {
    work: ["dialogue", "dilemma"],
    school: ["predict_reveal", "postmortem"],
    personal: ["before_after", "decision_point"],
  },
  {
    work: ["decision_point", "before_after"],
    school: ["dilemma", "predict_reveal"],
    personal: ["dialogue", "postmortem"],
  },
  {
    work: ["postmortem", "predict_reveal"],
    school: ["decision_point", "before_after"],
    personal: ["dialogue", "dilemma"],
  },
];

const ENDING_TYPES = [
  "broader_principle",
  "self_directed_question",
  "surprising_implication",
  "cross_domain",
  "common_trap",
  "perspective_reframe",
];

const VOCABULARY_AUDIT = [
  { word: "battle", synonyms: ["contest", "clash", "struggle"] },
  { word: "victory", synonyms: ["edge", "result", "advantage"] },
  { word: "enemy", synonyms: ["opponent", "rival", "other side"] },
  { word: "force", synonyms: ["pressure", "strength", "weight"] },
  { word: "attack", synonyms: ["press", "strike", "move first"] },
];

const SCHOOL_SETTINGS = [
  "seminar discussion",
  "mock trial rehearsal",
  "robotics build night",
  "debate prep room",
  "lab practical",
  "student government vote",
  "campus paper edit",
  "case competition huddle",
  "language exchange session",
  "music ensemble rehearsal",
  "office hours queue",
  "history presentation run-through",
  "coding club sprint",
  "thesis meeting",
  "intramural captain meeting",
  "admissions interview practice",
  "residence hall mediation",
  "model UN prep",
];

const BANNED_PHRASES = [
  "delve",
  "crucial",
  "landscape",
  "realm",
  "it's worth noting",
  "furthermore",
  "moreover",
  "in conclusion",
  "plays a pivotal role",
  "at its core",
  "the art of",
  "navigating",
  "harnessing",
  "game-changer",
  "paradigm shift",
  "robust",
  "synergy",
  "leverage",
  "facilitate",
  "utilize",
  "foster",
  "embark on",
  "a testament to",
  "shed light on",
  "this matters because",
  "it is essential to",
];

const GLOBAL_NAME_POOL = (
  "Maya,Jordan,Alex,Riley,Priya,Marcus,Sofia,Kai,Nora,James,Leila,Andre,Yuki,Omar,Tessa,Davi,Aaliyah,Connor,Rosa,Kenji,Dante,Rina,Felix,Naomi,Tariq,Ivy,Mei,Zara,Liam,Amara,Samir,Elena,Hana,Derek,Celia,Riku,Asha,Nico,Petra,Idris,Quinn,Lena,Tomas,Suki,Mikhail,Bria,Kaden,Anika,Joel,Thea,Ravi,Luz,Emery,Camille,Soren,Dina,Grant,Yara,Paco,Iris,Malik,Freya,Theo,Alma,Jai,Nell,Amir,Sage,Rowan,Cleo,Benny,Vera,Hugo,Lia,Milo,Selena,Kira,Cruz,Maren,Tate,Ada,Obi,Nina,Leo,Farah,Wren,Dex,Sable,Remy,Gil,Zuri,Tala,Knox,Elise,Rio,Harlan,Pearl,Juno,Cole,Lyra,Siya,Finn,Esme,Atlas,Raina,Kit,Maeve,Bodhi,Lina,Zeke,Cora,Taj,Willa,Oren,Nadia,Bryn,Ezra,Simone,Beck,Anya,Gael,Tova,Ray,Mira,Otis,June,Ren,Daria,Axel,Sol,Nyla,Penn,Rue,Joss,Koa,Belen,Nash,Paloma,Eamon,Isla,Dane,Pia,Reed,Noelle,Kip,Lark,Amina,Jonah,Imani,Lucas,Elias,Micah,Jules,Victor,Ruben,Camila,Evan,Jada,Ariel,Layla,Bianca,Mayaan,Adele,Zane,Suri,Emmett,Alina,Nikhil,Avery,Idris,Esme,Rhea,Damon,Gia,Luca,Harper,Shay,Zuri,Cora,Delia,Enzo,Freya,Gideon,Hollis,Jasper,Liora,Mason,Nadine,Otis,Petra,Ronan,Sanae,Trevor,Valen,Willa,Xavier,Yasmin,Zella,Arden,Becca,Cyrus,Dina,Eamon,Faye,Gavin,Ines,Khalil"
)
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const CHAPTERS = [
  {
    number: 1,
    title: "Laying Plans",
    slug: "laying-plans",
    hooks: {
      gentle: "The fight is often decided while everyone still thinks they are only discussing options.",
      direct: "If you start thinking after contact, you already gave away time.",
      competitive: "The first win goes to the side that counts the field before anyone moves.",
    },
    coreConcept:
      "Victory starts in comparison, not collision. Sun Tzu says to weigh moral influence, weather, terrain, command, and discipline, then test seven calculations before you commit yourself.",
    framework: "The five constant factors and the seven calculations.",
    quoteCandidate: "All warfare is based on deception.",
    misconception:
      "People often treat this chapter like a permission slip for constant bluffing. The real point is that clear comparison and shaped perception beat improvised courage.",
    bookExample:
      "Sun Tzu opens with calculation and with the palace-women drill, showing that clear orders, clear signals, and real command responsibility matter before any clash does.",
    mechanism:
      "Planning changes behavior because it forces you to compare morale, timing, space, and discipline before ego gets to rename hope as certainty.",
    limitation:
      "A beautiful plan still fails if it freezes after the ground changes. The chapter is about preparation that stays alive, not paperwork that hardens into pride.",
    previousConnection: "",
    nextSetup:
      "Once the comparison is done, the next question becomes cost: how long can you stay in the field before the campaign eats your strength?",
    moralComplexity: "high",
    work: {
      setting: "quarterly planning review",
      conflict: "a product lead wants a flashy launch before finance, support, and supply are aligned",
      wrongMove: "announce the date because the room wants energy",
      betterMove: "compare backing, timing, constraints, and morale before promising anything",
      sensory: "the projector throws pale blue light across coffee rings and half-open laptops",
    },
    school: {
      setting: "model UN prep",
      conflict: "the team wants to script speeches before checking committee rules and rival blocs",
      wrongMove: "treat confidence as readiness",
      betterMove: "map allies, limits, timing, and floor procedure first",
      sensory: "paper placards slide across a sticky classroom desk while chairs scrape the tile",
    },
    personal: {
      setting: "family trip planning",
      conflict: "everyone is arguing about booking dates before anyone checks budgets and time off",
      wrongMove: "push the loudest option forward",
      betterMove: "compare actual constraints before selling a plan",
      sensory: "phone screens glow over an unfinished dinner and one aunt keeps tapping her glass",
    },
  },
  {
    number: 2,
    title: "Waging War",
    slug: "waging-war",
    hooks: {
      gentle: "A campaign can fail long before defeat, simply because it keeps eating the side that started it.",
      direct: "Long wars burn through the winner first.",
      competitive: "Speed is not swagger here, it is cost control under pressure.",
    },
    coreConcept:
      "War is expensive in money, attention, morale, and transport. Sun Tzu warns that a campaign which drags on hollows out its own side, so success depends on speed, clear supply, and avoiding wasteful heroics.",
    framework: "Cost discipline, short campaigns, and feeding on the opponent when possible.",
    quoteCandidate: "There is no instance of a country having benefited from prolonged warfare.",
    misconception:
      "This is not reckless haste. Sun Tzu is warning against drift, bloated logistics, and proud delays that make even a strong position weaker by the week.",
    bookExample:
      "The chapter lingers on chariots, armor, grain, and the cost of moving an army, reminding you that brilliance collapses if the wagons and rations do not hold.",
    mechanism:
      "Time changes incentives. The longer a contest runs, the more shortages, fatigue, and secondary actors begin shaping the outcome.",
    limitation:
      "Short is not always smart. A rushed move that ignores terrain or morale can become the very waste the chapter warns against.",
    previousConnection:
      "Chapter 1 taught you to compare conditions before action. Chapter 2 shows why those comparisons must include cost and duration, not just hope and talent.",
    nextSetup:
      "If long force is costly, the better question is what to attack first so the opponent comes apart sooner.",
    moralComplexity: "medium",
    work: {
      setting: "vendor renegotiation sprint",
      conflict: "a manager keeps extending talks while legal fees and staff burnout climb",
      wrongMove: "celebrate persistence while the team gets drained",
      betterMove: "set a fast, disciplined path to a decision and stop feeding delay",
      sensory: "printer heat mixes with cold office air and everyone is rereading the same spreadsheet",
    },
    school: {
      setting: "case competition huddle",
      conflict: "the group keeps rebuilding slides instead of locking a case angle",
      wrongMove: "call endless revision thoroughness",
      betterMove: "pick the line of attack and protect time for delivery",
      sensory: "energy drink cans sweat beside a laptop fan that will not stop whining",
    },
    personal: {
      setting: "home renovation budget",
      conflict: "the project keeps stretching because no one will make the final scope call",
      wrongMove: "keep buying time and paying for delay",
      betterMove: "end drift and decide what actually matters now",
      sensory: "paint samples curl on the table and sawdust still hangs in the hallway air",
    },
  },
  {
    number: 3,
    title: "Attack by Stratagem",
    slug: "attack-by-stratagem",
    hooks: {
      gentle: "The cleanest win leaves most of the structure standing.",
      direct: "Smashing the wall is usually proof that you missed an earlier opening.",
      competitive: "Top skill breaks plans and alliances before anyone needs a siege ladder.",
    },
    coreConcept:
      "The highest skill is to win without wrecking what you need afterward. Sun Tzu ranks targets by value: enemy plans first, alliances next, armies next, cities last.",
    framework: "Preserve the whole, break plans first, avoid siege as the dullest tool.",
    quoteCandidate: "To subdue the enemy without fighting is the acme of skill.",
    misconception:
      "Readers sometimes turn this into passive avoidance. Sun Tzu is not saying never strike. He is saying strike the point that collapses the rest with the least waste.",
    bookExample:
      "The chapter's order of attack matters more than its famous line: plans, alliances, armies, and only then cities. Siege is described as the costly failure case.",
    mechanism:
      "Indirect attack works because organizations hold themselves together through intention and coordination. Break those, and raw force has much less work to do.",
    limitation:
      "Indirect pressure can become fantasy if you never close on a real decision. You still need a moment where the position cashes out.",
    previousConnection:
      "Chapter 2 showed how long force drains you. Chapter 3 offers the cure: hit the opponent where cost is lowest and collapse travels fastest.",
    nextSetup:
      "That strategic order only works if you can first make yourself hard to defeat and wait for the right opening.",
    moralComplexity: "high",
    work: {
      setting: "board presentation dispute",
      conflict: "a director wants to embarrass a rival team in public instead of solving the approval blockage",
      wrongMove: "treat humiliation as progress",
      betterMove: "change the decision path before turning the room into a siege",
      sensory: "the glass wall reflects a row of tight shoulders and untouched pastries",
    },
    school: {
      setting: "debate prep room",
      conflict: "one student wants to crush the other side on stage but ignores the judge's scoring priorities",
      wrongMove: "fight the loudest battle",
      betterMove: "break the other side's framing before the round hardens",
      sensory: "index cards are bent at the corners and the timer keeps beeping from a backpack",
    },
    personal: {
      setting: "sibling estate discussion",
      conflict: "everyone is arguing over objects while the real break is trust between two relatives",
      wrongMove: "litigate the surface item first",
      betterMove: "repair or isolate the alliance fault line before the room explodes",
      sensory: "a box of old letters sits open and nobody wants to be the first to touch it",
    },
  },
  {
    number: 4,
    title: "Tactical Dispositions",
    slug: "tactical-dispositions",
    hooks: {
      gentle: "Good positioning often looks quiet right up until the opening appears.",
      direct: "You do not earn the chance to win until you stop being easy to break.",
      competitive: "First remove the cheap ways to lose, then hunt the real opening.",
    },
    coreConcept:
      "Secure yourself against defeat before chasing victory. Sun Tzu separates what you can control, your own firmness and order, from what you must wait for, the opponent's opening.",
    framework: "First make defeat difficult, then wait for the chance to strike.",
    quoteCandidate: "One may know how to conquer without being able to do it.",
    misconception:
      "This is not timid caution. It is disciplined sequencing: first close the holes in your own shape, then move once the other side gives you a reason.",
    bookExample:
      "Sun Tzu compares the hidden quality of sound positioning to weights and measures: the side that has prepared properly does not need theatrical noise to be ready.",
    mechanism:
      "People overextend because action feels productive. Defensive readiness feels slow, yet it quietly changes the terms of every later exchange.",
    limitation:
      "Waiting can decay into avoidance if you never define what counts as a real opening. The chapter assumes active watching, not passive hiding.",
    previousConnection:
      "Chapter 3 ranked better targets. Chapter 4 explains the posture that lets you exploit them without offering the other side a cheap counter.",
    nextSetup:
      "Once your shape is sound, the next challenge is movement: how do ordinary effort and surprising force combine into momentum?",
    moralComplexity: "medium",
    work: {
      setting: "security incident response",
      conflict: "one lead wants a flashy countermove before the system is stabilized",
      wrongMove: "chase credit while the breach window is still open",
      betterMove: "close the easy failure points before making a public move",
      sensory: "server alerts pulse red across a dark monitor wall and nobody has touched lunch",
    },
    school: {
      setting: "lab practical",
      conflict: "a student rushes to the hard question while easy setup errors are still unchecked",
      wrongMove: "show ambition through haste",
      betterMove: "lock the controllable pieces before attempting the stretch move",
      sensory: "gloves snap, ethanol stings the air, and timer lights blink over stainless steel",
    },
    personal: {
      setting: "co-parenting calendar talk",
      conflict: "the conversation keeps jumping to holiday fights while the weekly schedule is still fragile",
      wrongMove: "fight for the dramatic point first",
      betterMove: "stabilize the everyday system before testing the high-friction issue",
      sensory: "a kitchen timer ticks beside a marker-smudged wall calendar",
    },
  },
  {
    number: 5,
    title: "Energy",
    slug: "energy",
    hooks: {
      gentle: "Momentum rarely arrives as raw force. It arrives as timing that makes force matter more.",
      direct: "Ordinary moves set the trap. Unusual moves cash it in.",
      competitive: "Momentum is engineered, not gifted.",
    },
    coreConcept:
      "Sun Tzu explains how disciplined order turns into force at the right instant. Direct and indirect methods keep cycling into each other, and momentum comes from timing, formation, and release.",
    framework: "Direct and indirect force, shaped timing, and the release of momentum.",
    quoteCandidate: "In battle, there are not more than two methods of attack, the direct and the indirect.",
    misconception:
      "This is not mystical talk about charisma. Energy here means arranged force, shared rhythm, and timing that lets a smaller move land harder than it looks.",
    bookExample:
      "Sun Tzu uses the crossbow release and rolling stones to show how stored order becomes sudden pressure once the moment is chosen correctly.",
    mechanism:
      "Momentum changes outcomes because it compresses decision time. A well-timed push makes the other side answer under stress instead of on their own clock.",
    limitation:
      "Momentum can seduce you into overrun. If you stop reading the field once the pressure works, the same speed that helped you can scatter you.",
    previousConnection:
      "Chapter 4 made you hard to break. Chapter 5 shows how that stable shape becomes live pressure instead of static defense.",
    nextSetup:
      "The next step is learning where to apply that pressure, not against the opponent's solid center but against the places that empty out first.",
    moralComplexity: "medium",
    work: {
      setting: "sales renewal call",
      conflict: "the team dumps every argument at once instead of sequencing proof and ask",
      wrongMove: "treat volume as force",
      betterMove: "set rhythm, then release the strongest point when the room is ready",
      sensory: "a muted Teams chime hangs between the rep's notes and the client dashboard",
    },
    school: {
      setting: "robotics build night",
      conflict: "students keep making last-minute changes with no coordination before the scrimmage",
      wrongMove: "confuse frantic motion with useful pressure",
      betterMove: "organize the simple moves so the surprise move can land cleanly",
      sensory: "hot solder and battery warmth make the room smell metallic and close",
    },
    personal: {
      setting: "hard conversation with a partner",
      conflict: "one person unloads the whole grievance stack at once",
      wrongMove: "spend all emotional force in the first minute",
      betterMove: "sequence truth so the key point lands when listening is still possible",
      sensory: "rain taps the window and one mug has gone cold between them",
    },
  },
  {
    number: 6,
    title: "Weak Points and Strong",
    slug: "weak-points-and-strong",
    hooks: {
      gentle: "Water never argues with the rock. It keeps choosing the line that gives way.",
      direct: "Stop hitting the other side where they are ready.",
      competitive: "Your edge appears when the rival has to cover too much ground at once.",
    },
    coreConcept:
      "Shape the fight so you are full where the other side is empty. Sun Tzu teaches you to appear where the opponent must stretch, avoid their strength, and use movement to make them reveal their weak points.",
    framework: "Avoid strength, strike emptiness, and force revealing movement.",
    quoteCandidate: "Water shapes its course according to the nature of the ground.",
    misconception:
      "This is not cowardice. It is intelligent target selection. The chapter rejects pointless head-on contests when the field already offers cheaper openings.",
    bookExample:
      "Sun Tzu's water image matters because it turns flexibility into a practical rule: let the ground and the opponent's commitments tell you where not to spend force.",
    mechanism:
      "Pressure works best when the other side must defend more than they can fully cover. Stretch creates mistakes long before collapse does.",
    limitation:
      "Constant indirection can make you predictable if you never commit. Flexibility still needs a decisive finish point.",
    previousConnection:
      "Chapter 5 gave you momentum. Chapter 6 tells you where that momentum should land so you do not waste it against a prepared wall.",
    nextSetup:
      "But once movement starts, friction appears. The next chapter turns from elegant targeting to the messy cost of marching, signaling, and holding order while in motion.",
    moralComplexity: "high",
    work: {
      setting: "pricing strategy meeting",
      conflict: "the team wants to fight the market leader on its strongest feature set",
      wrongMove: "copy the rival's best ground",
      betterMove: "find the neglected customer need that forces them to split attention",
      sensory: "markers squeak across the whiteboard while a competitor dashboard refreshes in the corner",
    },
    school: {
      setting: "mock trial rehearsal",
      conflict: "a student keeps pressing the witness on the point they rehearsed best",
      wrongMove: "hit the polished answer",
      betterMove: "move to the detail they have not fully covered",
      sensory: "paper exhibits slide off the table and someone coughs into the library silence",
    },
    personal: {
      setting: "neighborhood committee fight",
      conflict: "one resident keeps arguing on the loudest issue while the real undecided voters care about parking access",
      wrongMove: "keep crashing into the strong opinion bloc",
      betterMove: "address the part of the issue the room has left uncovered",
      sensory: "folding chairs wobble and the fluorescent lights buzz over a half-empty coffee urn",
    },
  },
  {
    number: 7,
    title: "Manoeuvring",
    slug: "manoeuvring",
    hooks: {
      gentle: "A plan that works on the map can still come apart in the walk toward it.",
      direct: "Movement creates confusion faster than speeches admit.",
      competitive: "The hardest part of a good plan is getting a real group to arrive in shape.",
    },
    coreConcept:
      "Moving a force is not just motion, it is coordination under friction. Sun Tzu warns about terrain ignorance, mixed signals, overextended baggage, and the discipline needed to keep a group intact while maneuvering.",
    framework: "Coordination, signaling, baggage discipline, and the cost of moving in contact.",
    quoteCandidate: "We are not fit to lead an army on the march unless we are familiar with the face of the country.",
    misconception:
      "People read maneuver as pure cleverness. Sun Tzu keeps dragging you back to logistics, signals, and the exhausting reality of moving many bodies without breaking order.",
    bookExample:
      "The chapter keeps returning to drums, banners, scouts, and the weight of supplies, because a force that cannot signal or travel cleanly cannot use its ideas.",
    mechanism:
      "Coordination fails when information arrives late, people carry too much, and the group loses a shared rhythm under stress.",
    limitation:
      "Too much control can make a moving group brittle. Discipline must leave enough room for local adjustment once the map stops matching the road.",
    previousConnection:
      "Chapter 6 taught you to create openings by movement. Chapter 7 shows the price of movement itself and why clever positioning fails without disciplined travel.",
    nextSetup:
      "Because no route stays clean for long, the next chapter asks when a commander must vary the plan instead of obeying it.",
    moralComplexity: "medium",
    work: {
      setting: "cross-team migration weekend",
      conflict: "leaders keep changing instructions while engineers are already moving systems",
      wrongMove: "treat movement like a memo",
      betterMove: "tighten signals, route ownership, and carry only what the move needs",
      sensory: "slack pings stack up over stale pizza boxes and a humming war room screen",
    },
    school: {
      setting: "music ensemble rehearsal",
      conflict: "the group keeps stopping because nobody knows whose cue matters",
      wrongMove: "add more instructions in the middle of the run",
      betterMove: "clarify the signal system before the next pass",
      sensory: "rosin dust floats in warm stage light while sheet music slips off metal stands",
    },
    personal: {
      setting: "family move day",
      conflict: "everyone keeps loading the wrong things first and the car turns into a blocked hallway",
      wrongMove: "carry everything because it feels safer",
      betterMove: "strip the load and keep one clear signaling rule",
      sensory: "cardboard rubs your forearms and the stairwell smells like detergent and dust",
    },
  },
  {
    number: 8,
    title: "Variation of Tactics",
    slug: "variation-of-tactics",
    hooks: {
      gentle: "Rules keep you safe until the moment they start hiding the real terrain from you.",
      direct: "A fixed playbook is easy to read and easier to trap.",
      competitive: "Victory shifts toward the side that knows when to break its own habit first.",
    },
    coreConcept:
      "Principles stay, but application changes with circumstance. Sun Tzu teaches flexible command: know which roads not to take, which ground not to contest, and when a textbook move stops fitting the field.",
    framework: "Stable principles with flexible application.",
    quoteCandidate: "The general who thoroughly understands the advantages that accompany variation of tactics knows how to handle his troops.",
    misconception:
      "Adaptation does not mean improvising from mood. It means holding the principle while changing the route when the field makes the old route stupid.",
    bookExample:
      "Sun Tzu lists cases where roads, ground, and commands should not be followed literally, because obedience to the wrong rule can be more dangerous than uncertainty.",
    mechanism:
      "Adaptation preserves effectiveness because conditions shift faster than a static script can. Rigid teams keep solving yesterday's problem.",
    limitation:
      "Constant variation can become vanity if you change methods just to look original. The point is fit, not novelty.",
    previousConnection:
      "Chapter 7 showed how motion creates friction. Chapter 8 responds by loosening the commander from blind obedience to any single route.",
    nextSetup:
      "The next chapter becomes observational: once you are moving and adapting, what signs tell you what the other side is actually doing?",
    moralComplexity: "medium",
    work: {
      setting: "customer escalation path",
      conflict: "a director insists on the normal process even though the account is failing in a clearly abnormal way",
      wrongMove: "hide behind procedure when the case no longer fits it",
      betterMove: "keep the principle and change the route",
      sensory: "an open ticket queue glows orange while a muted client voicemail sits unheard",
    },
    school: {
      setting: "history presentation run-through",
      conflict: "the team clings to a script even after the teacher changes the rubric emphasis",
      wrongMove: "treat the first plan as sacred",
      betterMove: "adjust the structure while protecting the core argument",
      sensory: "poster tape peels from the wall and someone keeps erasing the same heading",
    },
    personal: {
      setting: "friend group conflict",
      conflict: "one person keeps repeating the same apology format even though the hurt is about reliability, not wording",
      wrongMove: "reuse the script because it once worked",
      betterMove: "keep the principle of repair but change the form to fit this moment",
      sensory: "the group chat sits unread and one typing bubble appears, vanishes, and appears again",
    },
  },
  {
    number: 9,
    title: "The Army on the March",
    slug: "the-army-on-the-march",
    hooks: {
      gentle: "Before you decide what to do, learn to notice what the field is already telling you.",
      direct: "Bad readings start with bad noticing.",
      competitive: "The side that reads the signs first gets paid before the move is obvious.",
    },
    coreConcept:
      "Observation is a tactical skill. Sun Tzu catalogs signs in terrain, camp behavior, dust, birds, movement, and morale so that a commander reads reality before reacting to appearances.",
    framework: "Environmental signs, troop behavior, and morale reading.",
    quoteCandidate: "When the birds rise in their flight, it is the sign of an ambuscade.",
    misconception:
      "This chapter is not superstition. It is disciplined noticing. Small signals matter because they expose movement, strain, and readiness before formal statements do.",
    bookExample:
      "Birds lifting, dust forms, disorder at the wells, and camp chatter all become data. The chapter trains attention more than it trains aggression.",
    mechanism:
      "Better observation improves timing because you react to live conditions instead of your own stale picture of the field.",
    limitation:
      "Sign reading becomes paranoia when every detail is treated as proof. The chapter asks for patterns, not fantasies.",
    previousConnection:
      "Chapter 8 made flexibility necessary. Chapter 9 supplies the evidence base that tells you when flexibility is justified.",
    nextSetup:
      "Once you can read signs, the next question is larger: how does the kind of ground itself change your duty and your risk?",
    moralComplexity: "low",
    work: {
      setting: "sales floor walk",
      conflict: "a manager keeps trusting the dashboard while floor behavior shows the rollout is wobbling",
      wrongMove: "ignore live signs because the report looks neat",
      betterMove: "read the small cues before the failure becomes official",
      sensory: "phones keep ringing but half the desks have gone unnaturally quiet",
    },
    school: {
      setting: "seminar discussion",
      conflict: "a student assumes the room agrees because nobody interrupts, even though bodies have gone still and eyes are dropping",
      wrongMove: "read silence as support",
      betterMove: "notice the signs the room is already giving",
      sensory: "chairs creak, pens stop moving, and the heater knocks under the windowsill",
    },
    personal: {
      setting: "community fundraiser setup",
      conflict: "the organizer misses clear signs that volunteers are confused and peeling away",
      wrongMove: "wait for a formal complaint",
      betterMove: "read the field while it is still whispering",
      sensory: "folded tablecloths slide to the floor and tape keeps snapping against cardboard signs",
    },
  },
  {
    number: 10,
    title: "Terrain",
    slug: "terrain",
    hooks: {
      gentle: "Ground is not neutral. It quietly changes what courage, speed, and patience even mean.",
      direct: "The same move on different ground is not the same move.",
      competitive: "Misread the ground and you turn your own strength into a trap.",
    },
    coreConcept:
      "Terrain changes obligations. Sun Tzu names different kinds of ground and shows how command errors, not just bad luck, turn difficult terrain into disaster.",
    framework: "Six kinds of terrain and the command duties each one changes.",
    quoteCandidate: "He who knows the enemy and himself, as well as the ground, will not be imperiled in his battles.",
    misconception:
      "People flatten terrain into a map feature. Sun Tzu treats it as a relationship between space, supply, morale, and command judgment.",
    bookExample:
      "The chapter distinguishes accessible, entangling, temporizing, narrow, precipitous, and distant ground, then keeps pointing back to commander error as the real amplifier of danger.",
    mechanism:
      "Ground changes costs. It alters speed, reinforcement, visibility, and whether retreat is cheap or ruinous.",
    limitation:
      "Terrain knowledge still fails if your own force cannot execute on it. A map read without discipline is just informed wishful thinking.",
    previousConnection:
      "Chapter 9 trained your eyes. Chapter 10 widens the frame and asks what the ground itself demands from command.",
    nextSetup:
      "The next chapter takes this one level higher, from kinds of ground to the nine strategic situations that change how people behave under pressure.",
    moralComplexity: "low",
    work: {
      setting: "regional rollout plan",
      conflict: "leaders want one uniform playbook even though one market has thin support and another has strong local champions",
      wrongMove: "call every region the same field",
      betterMove: "change the move when the ground changes the cost",
      sensory: "map pins spread across the wall while one region lead keeps rubbing his temples",
    },
    school: {
      setting: "campus paper edit",
      conflict: "the editor assigns the same deadline expectations to a fast news brief and a slow investigative piece",
      wrongMove: "pretend both terrains reward the same pace",
      betterMove: "match the command to the kind of ground",
      sensory: "printer ink smells sharp and a raincoat drips by the newsroom door",
    },
    personal: {
      setting: "family care plan",
      conflict: "siblings assume the same weekly schedule works for a stable month and a hospital week",
      wrongMove: "freeze the plan while the ground changes",
      betterMove: "read the constraints of this terrain before assigning duty",
      sensory: "hospital wristbands crinkle beside a paper calendar with crossed-out times",
    },
  },
  {
    number: 11,
    title: "The Nine Situations",
    slug: "the-nine-situations",
    hooks: {
      gentle: "People do not behave the same way on easy ground and on desperate ground, and leaders pay for forgetting that.",
      direct: "Position changes psychology before it changes tactics.",
      competitive: "The ground beneath people changes what they will dare, protect, and misunderstand.",
    },
    coreConcept:
      "Strategic position shapes morale, urgency, and obedience. Sun Tzu names nine situations and shows how command must change when troops are scattered, deep, hemmed in, or desperate.",
    framework: "The nine situations and the command pattern each one requires.",
    quoteCandidate: "Throw your soldiers into positions whence there is no escape, and they will prefer death to flight.",
    misconception:
      "Readers often romanticize desperate ground. Sun Tzu is not praising chaos. He is explaining how constraint changes human focus, and why a commander must understand that before using it.",
    bookExample:
      "The chapter ranges from dispersive to desperate ground, arguing that people need different signals, incentives, and freedoms depending on how trapped or spread they feel.",
    mechanism:
      "Position changes attention. On loose ground, people think about home. On hard ground, they think about survival and cohesion.",
    limitation:
      "Manufacturing desperation carelessly is reckless. If trust is weak, pressure can just as easily cause panic as resolve.",
    previousConnection:
      "Chapter 10 mapped ground types. Chapter 11 turns from physical ground to the strategic situations those grounds create inside the force itself.",
    nextSetup:
      "When pressure peaks, the next question is what kinds of attack should be reserved for the right conditions rather than used from habit.",
    moralComplexity: "high",
    work: {
      setting: "turnaround team kickoff",
      conflict: "leaders treat a crisis unit and a stable unit with the same messaging",
      wrongMove: "ignore how position changes what people hear",
      betterMove: "match the command style to the actual pressure of the situation",
      sensory: "a damaged KPI board stays pinned beside a whiteboard full of red arrows",
    },
    school: {
      setting: "thesis meeting",
      conflict: "an advisor gives broad freedom to a student who is already days from a hard submission",
      wrongMove: "pretend loose guidance works on urgent ground",
      betterMove: "change the support style when the situation hardens",
      sensory: "highlighter marks bleed through draft pages and the office clock seems louder than usual",
    },
    personal: {
      setting: "storm evacuation planning",
      conflict: "family members keep debating preferences when the window for leaving is closing",
      wrongMove: "use soft language on ground that now requires firm sequencing",
      betterMove: "recognize how pressure changes what people can process",
      sensory: "weather alerts buzz every few minutes and the hallway smells like wet jackets",
    },
  },
  {
    number: 12,
    title: "The Attack by Fire",
    slug: "the-attack-by-fire",
    hooks: {
      gentle: "Some tools are powerful mainly because they demand better timing than people like to admit.",
      direct: "A powerful tool used out of season is just noise with smoke.",
      competitive: "Fire is less about flame than about choosing the exact moment a system is ready to ignite.",
    },
    coreConcept:
      "Not every attack fits every moment. Sun Tzu treats fire as a coordinated method that depends on weather, timing, follow-through, and restraint once conditions stop supporting it.",
    framework: "Five ways to use fire and the timing rules that govern them.",
    quoteCandidate: "Move not unless you see an advantage; use not your troops unless there is something to be gained.",
    misconception:
      "This chapter is not fascination with destruction. It is a case study in conditional action: powerful tools demand fit, timing, and a plan for what follows the spark.",
    bookExample:
      "Sun Tzu lists five ways to attack by fire and then keeps stressing wind, dryness, and timing, because an uncontrolled tool harms the careless user too.",
    mechanism:
      "Conditional tools work only when the environment is ready. Timing multiplies or erases the value of force.",
    limitation:
      "High-impact tactics tempt ego. If you fall in love with the dramatic tool, you stop checking whether the field still supports it.",
    previousConnection:
      "Chapter 11 focused on pressure and position. Chapter 12 narrows to the use of a severe tool that only works when conditions line up cleanly.",
    nextSetup:
      "The final chapter answers the question that sits behind every earlier one: how do you know enough to choose the right moment at all?",
    moralComplexity: "high",
    work: {
      setting: "public policy launch",
      conflict: "a leader wants to use a high-profile announcement before allies and timing are ready",
      wrongMove: "use the biggest tool because it feels decisive",
      betterMove: "check whether the conditions make the tool useful or reckless",
      sensory: "camera lights are being tested while the final approval memo is still unsigned",
    },
    school: {
      setting: "campus paper investigation release",
      conflict: "the staff wants to drop a major story before documents are fully lined up",
      wrongMove: "confuse urgency with readiness",
      betterMove: "wait for the conditions that let the move hold after impact",
      sensory: "the newsroom smells like burnt coffee and toner while browser tabs keep flashing updates",
    },
    personal: {
      setting: "family confrontation",
      conflict: "someone wants to reveal a painful truth at the worst possible gathering simply because everyone is present",
      wrongMove: "ignite the room without a path through the smoke",
      betterMove: "use a strong tool only when timing supports repair, not just release",
      sensory: "plates clink in the next room and one cousin keeps staring at the floorboards",
    },
  },
  {
    number: 13,
    title: "The Use of Spies",
    slug: "the-use-of-spies",
    hooks: {
      gentle: "Information usually costs less than force, yet people still spend force first.",
      direct: "Guessing is expensive. Intelligence is cheaper.",
      competitive: "The last chapter says what the rest kept implying: the side that knows more wastes less.",
    },
    coreConcept:
      "Reliable intelligence saves lives, money, and time. Sun Tzu closes by explaining five kinds of spies and by treating informed judgment, not blind courage, as the true partner of action.",
    framework: "Local, inward, converted, doomed, and surviving spies.",
    quoteCandidate: "Foreknowledge cannot be elicited from spirits, nor from gods, nor by analogy with past events, nor from calculations.",
    misconception:
      "People hear 'spies' and jump to glamor. Sun Tzu is really teaching disciplined information work, source handling, and the ethics of not wasting lives through avoidable ignorance.",
    bookExample:
      "The chapter's five spy types matter because each solves a different knowledge problem. Converted spies sit at the center because they let every other source work better.",
    mechanism:
      "Good intelligence changes decisions before conflict becomes expensive. It narrows uncertainty and prevents force from being spent where simple knowledge would have sufficed.",
    limitation:
      "Bad sources are worse than no sources if they flatter what you already wanted to believe. Intelligence work demands verification and restraint.",
    previousConnection:
      "Chapter 12 asked how you know the right moment. Chapter 13 answers directly: you know by building channels of foreknowledge instead of pretending courage can replace information.",
    nextSetup:
      "This is the end of the book, so the closing loop points back to Chapter 1: planning is only as good as the truth it is built on.",
    moralComplexity: "high",
    work: {
      setting: "competitive bid prep",
      conflict: "the team keeps guessing what the client cares about instead of using actual contacts and debriefs",
      wrongMove: "treat inference as evidence",
      betterMove: "invest in honest sources before spending the campaign budget",
      sensory: "the bid room smells like dry marker ink and one folder keeps getting reopened for the same missing fact",
    },
    school: {
      setting: "student government vote count",
      conflict: "a campaign keeps assuming support without checking quiet swing voters and committee staff",
      wrongMove: "trust the visible crowd alone",
      betterMove: "build real information channels before the floor vote",
      sensory: "poster paper curls near the radiator and whispered vote counts keep changing",
    },
    personal: {
      setting: "care decision for an aging parent",
      conflict: "siblings keep fighting from assumptions because nobody has gathered the full medical and financial picture",
      wrongMove: "argue from fragments",
      betterMove: "collect trustworthy information before forcing a life-changing choice",
      sensory: "prescription bottles rattle in a paper bag beside a folder of unopened statements",
    },
  },
];

const QUIZ_OPENERS = [
  "A team starts",
  "Before anyone commits",
  "During a tense review",
  "Maya walks into",
  "Jordan hears",
  "Priya notices",
  "When the room shifts",
  "After a quiet signal",
  "Chapter ",
  "Compared with Chapter ",
];

const TITLE_PATTERNS = [
  (name, context) => `${name} at the ${context.setting}`,
  (name, context) => `Why ${name} Waited in the ${context.setting}`,
  (name, context) => `${name} and the Wrong Read at ${context.setting}`,
  (name, context) => `${name}: What Changed in the ${context.setting}?`,
  (name, context) => `${name} Before the ${context.setting} Turned`,
  (name, context) => `${name} Hears the Field Too Late`,
  (name, context) => `What ${name} Missed in the ${context.setting}`,
  (name, context) => `${name} Picks the Narrower Move`,
  (name, context) => `${name} Tries the Loud Option First`,
  (name, context) => `${name} Reads the Room a Beat Earlier`,
  (name, context) => `How ${name} Changed the ${context.setting} Rhythm`,
  (name, context) => `${name} and the Signal Nobody Named`,
  (name, context) => `${name} Spots the Open Flank`,
  (name, context) => `${name} Learns Which Route Not to Take`,
  (name, context) => `${name} After the First Plan Hardened`,
  (name, context) => `${name} and the Cost of Staying Longer`,
  (name, context) => `${name} Stops Arguing With the Ground`,
  (name, context) => `${name} Uses Less Force in the ${context.setting}`,
];

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeText(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${value}\n`, "utf8");
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function chapterId(chapter) {
  return `ch${String(chapter.number).padStart(2, "0")}-${slugify(chapter.title)}`;
}

function clean(value) {
  return String(value).replace(/\s+/g, " ").trim();
}

function sentence(value) {
  const text = clean(value);
  if (!text) return "";
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

function joinSentences(items) {
  return items.map(sentence).filter(Boolean).join(" ");
}

function wordCount(value) {
  return clean(value)
    .split(/\s+/)
    .filter(Boolean).length;
}

function resolveTone(value, tone = "direct") {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    if (typeof value[tone] === "string") return value[tone];
    for (const key of ["direct", "gentle", "competitive"]) {
      if (typeof value[key] === "string") return value[key];
    }
  }
  return "";
}

function toneObject(gentle, direct, competitive) {
  return {
    gentle: sentence(gentle),
    direct: sentence(direct),
    competitive: sentence(competitive),
  };
}

function splitParagraphs(text) {
  return String(text)
    .split(/\n\n+/)
    .map((value) => clean(value))
    .filter(Boolean);
}

function fitParagraphs(paragraphs, optionalSentences, minWords, maxWords) {
  const built = paragraphs.map((sentences) => [...sentences]);

  const render = () => built.map((part) => joinSentences(part)).filter(Boolean).join("\n\n");

  let text = render();
  let index = 0;
  while (wordCount(text) < minWords && index < optionalSentences.length) {
    built[built.length - 1].push(optionalSentences[index]);
    index += 1;
    text = render();
  }

  while (wordCount(text) > maxWords && built[built.length - 1].length > 2) {
    built[built.length - 1].pop();
    text = render();
  }

  const fallbackPadding = [
    "That extra pause looks small, yet it changes the whole contest because it keeps you from paying for a move you did not need to make.",
    "A cleaner read also steadies the people around you, because they stop reacting to mood and start reacting to named conditions.",
    "Once that happens, the next decision usually gets easier as well, because the room is no longer trapped inside the first bad assumption.",
    "That is why the chapter keeps sounding calmer than the problem it is solving, the calm comes from seeing cost earlier.",
    "You can feel the difference in any live setting once the hidden condition is named, the pressure gets sharper and less theatrical at the same time.",
    "The point is not to sound impressive first. The point is to lower avoidable waste before the field hardens against you.",
  ];

  let fallbackIndex = 0;
  while (wordCount(text) < minWords && fallbackIndex < fallbackPadding.length) {
    built[built.length - 1].push(fallbackPadding[fallbackIndex]);
    fallbackIndex += 1;
    text = render();
  }

  if (wordCount(text) > maxWords) {
    const last = built[built.length - 1];
    if (last.length > 2) {
      last.splice(last.length - 2, 1);
      text = render();
    }
  }

  if (wordCount(text) < minWords) {
    built[built.length - 1].push("That changes the price immediately.");
    text = render();
  }

  return text;
}

function toneStyle(tone) {
  if (tone === "gentle") {
    return {
      opener: "Notice the quieter point here",
      action: "Start by naming",
      caution: "The trap is to rush the moment and call that bravery",
      lens: "This lands as judgment before it lands as force",
    };
  }
  if (tone === "competitive") {
    return {
      opener: "The edge sits in the hidden layer first",
      action: "Make the move only after you have measured",
      caution: "The trap is donating position because the dramatic move feels stronger",
      lens: "This changes who controls the clock",
    };
  }
  return {
    opener: "The practical point is simple",
    action: "Do the comparison before you commit",
    caution: "The trap is acting from noise and calling it decisiveness",
    lens: "This changes the decision before it changes the clash",
  };
}

function easyAnalogy(chapter) {
  const analogies = {
    1: "It is the difference between drawing the route before driving at night and guessing once the exits are already behind you.",
    2: "A long campaign works like a car left idling in the driveway, burning fuel while going nowhere important.",
    3: "Sieging the wall first is like arguing with the symptom while the real leak is still behind the plaster.",
    4: "Good positioning is like fastening the seat belt before the road turns ugly, not while the car is already sliding.",
    5: "Momentum works like a bow string, quiet while it is drawn, loud only when the release finally comes.",
    6: "Water does not win by proving a point to the rock, it wins by finding where the rock cannot fully resist.",
    7: "Movement without signals is like moving house with no labels, everyone works hard and still blocks the doorway.",
    8: "A fixed rule on changing ground is like wearing skates onto gravel and insisting the problem is your confidence.",
    9: "Good observation is less crystal ball than weather reading, small signs add up before the storm announces itself.",
    10: "Ground changes a plan the way a steep stairwell changes a sofa delivery, the shape is the same but the move is not.",
    11: "Pressure changes people the way cold water changes breathing, the same body reacts differently once the conditions tighten.",
    12: "A powerful tool used at the wrong moment is like lighting damp wood, you get smoke, heat, and very little control.",
    13: "Good intelligence is like turning on the room light before rearranging the furniture, it saves you from bruises you did not need.",
  };
  return analogies[chapter.number];
}

function chapterBrief(chapter, rotationRow, nameLedger) {
  return {
    bookId: BOOK_ID,
    chapterId: chapterId(chapter),
    number: chapter.number,
    title: chapter.title,
    author: AUTHOR,
    bookTitle: BOOK_TITLE,
    edition: EDITION,
    chapterCount: CHAPTERS.length,
    coreConcept: chapter.coreConcept,
    framework: chapter.framework,
    quoteCandidate: chapter.quoteCandidate,
    misconception: chapter.misconception,
    bookExample: chapter.bookExample,
    mechanism: chapter.mechanism,
    limitation: chapter.limitation,
    previousConnection: chapter.previousConnection,
    nextSetup: chapter.nextSetup,
    moralComplexity: chapter.moralComplexity,
    rotation: rotationRow,
    assignedNames: nameLedger[chapter.number],
    schoolSettings: SCHOOL_SETTINGS,
    promptPaths: PROMPT_PATHS,
    contentPath: `${TMP_PREFIX}-ch${String(chapter.number).padStart(2, "0")}-content.json`,
    quizPath: `${TMP_PREFIX}-ch${String(chapter.number).padStart(2, "0")}-quiz.json`,
    mergedPath: `${TMP_PREFIX}-ch${String(chapter.number).padStart(2, "0")}-merged.json`,
    finalPath: `${TMP_PREFIX}-ch${String(chapter.number).padStart(2, "0")}-final.json`,
  };
}

function buildRotationTable() {
  return CHAPTERS.map((chapter, index) => {
    const preset = FORMAT_PRESETS[index % FORMAT_PRESETS.length];
    const endingSeed = index % ENDING_TYPES.length;
    const examples = [];
    for (const category of ["work", "school", "personal"]) {
      for (const format of preset[category]) {
        examples.push({
          category,
          format,
          endingType: ENDING_TYPES[(endingSeed + examples.length) % ENDING_TYPES.length],
          schoolSetting:
            category === "school"
              ? SCHOOL_SETTINGS[(index * 2 + examples.length) % SCHOOL_SETTINGS.length]
              : null,
        });
      }
    }
    return {
      chapterNumber: chapter.number,
      chapterTitle: chapter.title,
      examples,
    };
  });
}

function buildNameLedger() {
  const ledger = {};
  let cursor = 0;
  for (const chapter of CHAPTERS) {
    ledger[chapter.number] = {
      primary: {
        work: [GLOBAL_NAME_POOL[cursor], GLOBAL_NAME_POOL[cursor + 1]],
        school: [GLOBAL_NAME_POOL[cursor + 2], GLOBAL_NAME_POOL[cursor + 3]],
        personal: [GLOBAL_NAME_POOL[cursor + 4], GLOBAL_NAME_POOL[cursor + 5]],
      },
      secondary: [GLOBAL_NAME_POOL[cursor + 6], GLOBAL_NAME_POOL[cursor + 7], GLOBAL_NAME_POOL[cursor + 8]],
    };
    cursor += 9;
  }
  return ledger;
}

function buildResearchDossier(rotationTable, nameLedger) {
  return {
    bookId: BOOK_ID,
    title: BOOK_TITLE,
    author: AUTHOR,
    edition: EDITION,
    source: {
      label: "Project Gutenberg Lionel Giles 1910 text",
      url: "https://www.gutenberg.org/ebooks/132",
    },
    chapterCount: CHAPTERS.length,
    thesis:
      "Sun Tzu argues that the best commander shapes conditions before collision, preserves strength by avoiding waste, and wins through disciplined judgment about timing, terrain, morale, and information. The book treats force as the expensive last expression of a contest already shaped by preparation, positioning, and foreknowledge.",
    culturalContext:
      "This is a classical Chinese military treatise written for rulers and commanders, then translated into English by Lionel Giles in 1910 with dense scholarly notes. In ChapterFlow it should be framed for modern readers as a book about strategy, pressure, timing, logistics, and information, not as a manual for cruelty or manipulation.",
    moralComplexityGuidance:
      "Where the text discusses deception, pressure, fire, or spies, scenarios should teach strategic awareness, defensive reading, and restrained judgment. They should not teach the user to mistreat people or to glamorize harm.",
    crossChapterTensions: [
      "Planning versus improvisation",
      "Speed versus exhaustion",
      "Preserving the whole versus destroying the target",
      "Security against defeat versus the urge for visible action",
      "Direct force versus indirect pressure",
      "Stable principles versus adaptive execution",
      "Observation versus projection",
      "Terrain facts versus commander ego",
      "Pressure as focus versus pressure as panic",
      "Spectacular tools versus condition-bound timing",
      "Force versus intelligence",
    ],
    vocabularyAudit: VOCABULARY_AUDIT,
    schoolSettings: SCHOOL_SETTINGS,
    rotationTable,
    nameLedger,
    chapters: CHAPTERS.map((chapter, index) => ({
      number: chapter.number,
      title: chapter.title,
      coreConcept: chapter.coreConcept,
      framework: chapter.framework,
      keyStory: chapter.bookExample,
      quoteCandidate: chapter.quoteCandidate,
      misconception: chapter.misconception,
      previousConnection: chapter.previousConnection,
      nextSetup: chapter.nextSetup,
      moralComplexity: chapter.moralComplexity,
      chapterId: chapterId(chapter),
      previewTarget:
        index === CHAPTERS.length - 1
          ? { kind: "full_circle", chapterNumber: 1, chapterTitle: CHAPTERS[0].title }
          : { kind: "next_chapter", chapterNumber: CHAPTERS[index + 1].number, chapterTitle: CHAPTERS[index + 1].title },
    })),
  };
}

function closingByEndingType(endingType, tone, chapter, nextText) {
  if (endingType === "broader_principle") {
    return tone === "gentle"
      ? "People usually lose more from misread conditions than from a lack of effort."
      : tone === "competitive"
        ? "The side that reads conditions sooner gets paid before raw effort even matters."
        : "Most losses begin as a bad read of conditions, not a shortage of motion.";
  }
  if (endingType === "self_directed_question") {
    return tone === "gentle"
      ? "Where have you been calling motion progress when the field was still unclear?"
      : tone === "competitive"
        ? "Where are you still spending force on the wrong layer of the contest?"
        : "What part of this situation are you still moving on before you have actually read it?";
  }
  if (endingType === "surprising_implication") {
    return tone === "gentle"
      ? "A small timing read often does more good than a louder display of determination."
      : tone === "competitive"
        ? "The cheapest edge is often a better read, not a bigger swing."
        : "Better timing can outperform heavier effort in the same field.";
  }
  if (endingType === "cross_domain") {
    return tone === "gentle"
      ? `The same read that settles this moment also sets up ${nextText.toLowerCase()}.`
      : tone === "competitive"
        ? `This same read becomes dangerous advantage once it rolls into ${nextText.toLowerCase()}.`
        : `The same logic will matter again when ${nextText.toLowerCase()}.`;
  }
  if (endingType === "common_trap") {
    return tone === "gentle"
      ? "The trap is mistaking a loud move for a wise one."
      : tone === "competitive"
        ? "The trap is donating position because the dramatic move looked stronger."
        : "The trap is calling a noisy move decisive when it is only premature.";
  }
  return tone === "gentle"
    ? "The field was never asking for more force first, it was asking for a clearer read."
    : tone === "competitive"
      ? "The real contest was not about force first, it was about who saw the usable opening."
      : "This was never only about force, it was about seeing the right opening before acting.";
}

function buildBreakdown(chapter, tone, depth) {
  const style = toneStyle(tone);
  const previousText = chapter.previousConnection || "The book starts here, so the first discipline is learning to compare conditions before you move.";
  const nextText =
    chapter.number === CHAPTERS.length
      ? "the book circles back to planning and asks what kind of truth your first calculations were built on"
      : `the next chapter turns to ${CHAPTERS[chapter.number].title.toLowerCase()}`;

  if (depth === "easy") {
    return fitParagraphs(
      [
        [
          chapter.hooks[tone],
          chapter.bookExample,
          chapter.coreConcept,
          `${style.opener}: ${chapter.framework.toLowerCase()}`,
        ],
        [
          `${style.action} the real conditions before you make a public move, because ${chapter.mechanism.toLowerCase()}`,
          chapter.misconception,
          easyAnalogy(chapter),
          `${style.caution}. ${nextText.charAt(0).toUpperCase()}${nextText.slice(1)}.`,
        ],
      ],
      [
        previousText,
        `${style.lens}.`,
        chapter.limitation,
      ],
      140,
      175
    );
  }

  if (depth === "medium") {
    return fitParagraphs(
      [
        [
          chapter.hooks[tone],
          chapter.bookExample,
          chapter.coreConcept,
          `${style.opener}: ${chapter.framework.toLowerCase()}`,
        ],
        [
          `${chapter.mechanism} ${style.lens}.`,
          chapter.misconception,
          `The practical move is not to show more nerve first. It is to read what the field is rewarding, then place your effort there.`,
        ],
        [
          previousText,
          `${tone === "competitive" ? "In practice, measure" : "In practice, name"} the live constraints in front of you, not the story your ego prefers.`,
          chapter.limitation,
        ],
        [
          sentence(`That is why ${nextText}`),
        ],
      ],
      [
        "The chapter keeps pushing you away from expensive heroics and toward judgment that changes the cost of the contest before the contest hardens.",
        "You can hear the book's larger argument here: conditions, morale, and timing decide more than visible force admits.",
      ],
      330,
      420
    );
  }

  return fitParagraphs(
    [
      [
        chapter.hooks[tone],
        chapter.bookExample,
        chapter.coreConcept,
        `${style.opener}: ${chapter.framework.toLowerCase()}`,
      ],
      [
        `${chapter.mechanism} ${style.lens}.`,
        `What looks like aggression in this chapter is usually prior arrangement showing up at the right second.`,
        chapter.misconception,
      ],
      [
        `The failure mode matters just as much: ${chapter.limitation.charAt(0).toLowerCase()}${chapter.limitation.slice(1)}`,
        `${style.caution}.`,
        "That is why the book keeps forcing judgment back onto preparation, reading, and disciplined timing instead of raw will.",
      ],
      [
        previousText,
        `This chapter also complicates the one before it. The earlier idea still stands, but only if you know when its shape stops fitting the ground.`,
      ],
      [
        `${tone === "competitive" ? "Measure" : "Name"} the truth of the field, then move once the shape is clear enough to justify cost.`,
        `${chapter.number === CHAPTERS.length ? "The ending folds back to Chapter 1, because every plan is only as good as the truth it was built on." : `The ending does not close the loop neatly. Instead, ${nextText}.`}`,
      ],
    ],
    [
      "That tension is why Sun Tzu can sound calm and severe at once. He is not worshipping force. He is stripping away the waste that makes force necessary for too long.",
      "You can apply that beyond war because the underlying logic is stable: do not pay the full price of conflict when better reading could lower the price first.",
      "The chapter is hardest on ego, not on courage. Ego wants the visible move now. Judgment wants the field read correctly first.",
    ],
    490,
    600
  );
}

function takeawayKinds(depth) {
  if (depth === "easy") return ["principle", "misread", "action"];
  if (depth === "medium") return ["principle", "misread", "diagnostic", "failure", "connection", "limit"];
  return ["principle", "misread", "diagnostic", "failure", "connection", "limit", "timing", "foresight"];
}

function takeawayPoint(chapter, kind, tone) {
  const prefix =
    tone === "gentle"
      ? "**Notice the governing move.**"
      : tone === "competitive"
        ? "**This is where the edge starts.**"
        : "**Name the operating rule.**";

  if (kind === "principle") {
    return sentence(`${prefix} ${chapter.coreConcept}`);
  }
  if (kind === "misread") {
    return sentence(`${prefix} ${chapter.misconception}`);
  }
  if (kind === "diagnostic") {
    return sentence(
      `${prefix} A clean read usually shows up when you can explain what the field is rewarding, what it is punishing, and what cost a rushed move would create.`
    );
  }
  if (kind === "failure") {
    return sentence(`${prefix} ${chapter.limitation}`);
  }
  if (kind === "connection") {
    return sentence(
      `${prefix} ${chapter.previousConnection || "This first chapter sets the lens for the rest of the book"}`
    );
  }
  if (kind === "limit") {
    return sentence(
      `${prefix} The chapter works best when you keep principle stable but refuse to copy the same surface move into a different field.`
    );
  }
  if (kind === "timing") {
    return sentence(
      `${prefix} Timing is rarely about speed alone. It is about whether the conditions now make the move cheaper, cleaner, and more likely to hold.`
    );
  }
  return sentence(
    `${prefix} Foreknowledge, observation, and honest comparison matter here because false certainty makes every later move more expensive.`
  );
}

function takeawayMoreDetails(chapter, kind, tone) {
  const first =
    kind === "principle"
      ? chapter.mechanism
      : kind === "misread"
        ? chapter.misconception
        : kind === "diagnostic"
          ? "A reliable read turns vague stress into named constraints, visible incentives, and a clearer sense of where pressure should or should not land"
          : kind === "failure"
            ? chapter.limitation
            : kind === "connection"
              ? chapter.previousConnection || "Because this is the opening chapter, the main connection is forward: later chapters keep returning to the cost of acting on a bad read"
              : kind === "limit"
                ? "A principle remains sound across contexts, yet the surface move that expresses it can become foolish when terrain, morale, or timing changes"
                : kind === "timing"
                  ? "Timing matters because the same move can be cheap on one day and reckless on the next once supply, morale, or information changes"
                  : "Foreknowledge matters because good information changes decisions before force becomes expensive";
  const second =
    tone === "gentle"
      ? "The useful question is not whether the idea sounds bold. It is whether it lowers waste while keeping your judgment intact."
      : tone === "competitive"
        ? "The useful question is whether this shifts cost, timing, or attention in your favor before the clash gets expensive."
        : "The useful question is whether this changes cost and timing before the contest hardens.";
  const third =
    tone === "gentle"
      ? "That is how the chapter stays practical instead of theatrical."
      : tone === "competitive"
        ? "That is how the chapter creates advantage instead of noise."
        : "That is how the chapter becomes operational instead of decorative.";
  const normalizedFirst = clean(first).replace(/[.!?]+$/g, "");
  return sentence(`${normalizedFirst}. ${second} ${third}`);
}

function buildKeyTakeaways(chapter, depth) {
  return takeawayKinds(depth).map((kind) => {
    const point = {
      gentle: takeawayPoint(chapter, kind, "gentle"),
      direct: takeawayPoint(chapter, kind, "direct"),
      competitive: takeawayPoint(chapter, kind, "competitive"),
    };
    if (depth === "easy") return { point };
    return {
      point,
      moreDetails: {
        gentle: takeawayMoreDetails(chapter, kind, "gentle"),
        direct: takeawayMoreDetails(chapter, kind, "direct"),
        competitive: takeawayMoreDetails(chapter, kind, "competitive"),
      },
    };
  });
}

function buildOneMinuteRecap(chapter, depth) {
  if (depth === "easy") {
    return toneObject(
      `In the next real decision, pause long enough to name the condition you have not measured yet in ${chapter.work.setting}.`,
      `Before your next move, write down the condition you still have not measured in ${chapter.work.setting}.`,
      `On your next live decision, force yourself to name the unmeasured condition before you move.`
    );
  }

  const previousOne = chapter.number > 1 ? CHAPTERS[chapter.number - 2].title : "the opening comparison";
  const previousTwo = chapter.number > 2 ? CHAPTERS[chapter.number - 3].title : previousOne;

  return {
    retrieve: toneObject(
      `Without looking back, name the main rule of ${chapter.title} in one clean sentence.`,
      `Recall the operating rule of ${chapter.title} from memory before rereading anything.`,
      `State the core rule of ${chapter.title} cold, without peeking.`
    ),
    connect: toneObject(
      `Link this chapter to ${previousOne}${depth === "hard" ? ` and ${previousTwo}` : ""} by naming what stays the same and what changes.`,
      `Connect this chapter to ${previousOne}${depth === "hard" ? ` and ${previousTwo}` : ""} by naming the shared principle and the new tension.`,
      `Tie this chapter back to ${previousOne}${depth === "hard" ? ` and ${previousTwo}` : ""} and say what new edge it adds.`
    ),
    preview: toneObject(
      chapter.number === CHAPTERS.length
        ? "The book closes by sending you back to Chapter 1, because a plan is only as good as the truth it was built on."
        : `The next chapter keeps the pressure on by asking what changes once the book turns to ${CHAPTERS[chapter.number].title.toLowerCase()}.`,
      chapter.number === CHAPTERS.length
        ? "The loop closes at Chapter 1: better intelligence and observation only matter because they repair the first calculation."
        : `Next chapter: what changes once the field turns to ${CHAPTERS[chapter.number].title.toLowerCase()} instead of today's layer?`,
      chapter.number === CHAPTERS.length
        ? "Final loop: the book snaps back to Chapter 1 and asks whether your opening calculations were built on truth or wishful thinking."
        : `Next chapter raises the harder question of ${CHAPTERS[chapter.number].title.toLowerCase()}.`
    ),
  };
}

function buildContentVariant(chapter, depth) {
  const variant = {
    chapterBreakdown: {
      gentle: buildBreakdown(chapter, "gentle", depth),
      direct: buildBreakdown(chapter, "direct", depth),
      competitive: buildBreakdown(chapter, "competitive", depth),
    },
    keyTakeaways: buildKeyTakeaways(chapter, depth),
    oneMinuteRecap: buildOneMinuteRecap(chapter, depth),
  };

  if (depth !== "easy") {
    variant.activationPrompt = toneObject(
      `Before reading, ask yourself where this issue is already showing up in ${chapter.work.setting}.`,
      `Before reading, decide where this principle is already active in your own field.`,
      `Before reading, name one live contest where this principle would change the score.`
    );
  }

  if (depth === "medium") {
    variant.selfCheckPrompt = toneObject(
      `Why does ${chapter.title.toLowerCase()} lower waste before it raises force?`,
      `Why does ${chapter.title.toLowerCase()} change cost before it changes visible action?`,
      `Why does ${chapter.title.toLowerCase()} create edge before it creates noise?`
    );
  }

  if (depth === "hard") {
    variant.selfCheckPrompts = [
      toneObject(
        `Why does this chapter fail when someone copies the move but ignores the field that made it work?`,
        `Why does this chapter fail when form is copied without the supporting conditions?`,
        `Why does this chapter collapse when the move is copied without the field that justified it?`
      ),
      toneObject(
        `How does ${chapter.title.toLowerCase()} alter what you would count as a smart win?`,
        `How does ${chapter.title.toLowerCase()} redefine what success should cost?`,
        `How does ${chapter.title.toLowerCase()} change what a high-quality win even looks like?`
      ),
    ];
    variant.predictionPrompt = toneObject(
      chapter.number === CHAPTERS.length
        ? "Before you leave the book, predict which Chapter 1 assumption you would now rewrite."
        : `Before moving on, predict what must change once the book turns to ${CHAPTERS[chapter.number].title.toLowerCase()}.`,
      chapter.number === CHAPTERS.length
        ? "Before closing, predict which first calculation in Chapter 1 now looks incomplete to you."
        : `Before the next chapter, predict what new pressure ${CHAPTERS[chapter.number].title.toLowerCase()} adds to today's rule.`,
      chapter.number === CHAPTERS.length
        ? "Before you close the book, call your shot: which Chapter 1 assumption is no longer sturdy enough?"
        : `Predict the next layer now: what gets harder once the field turns to ${CHAPTERS[chapter.number].title.toLowerCase()}?`
    );
  }

  return variant;
}

function buildScenarioTitle(name, context, exampleIndex) {
  return TITLE_PATTERNS[exampleIndex % TITLE_PATTERNS.length](name, context);
}

function endingLine(endingType, tone, chapter) {
  const nextText =
    chapter.number === CHAPTERS.length ? "the book loops back to the opening calculation" : `the next chapter hardens this into ${CHAPTERS[chapter.number].title.toLowerCase()}`;
  return closingByEndingType(endingType, tone, chapter, nextText);
}

function buildScenarioText(chapter, context, format, name, counterpart) {
  const setting = context.setting;
  const conflict = context.conflict;
  const wrongMove = context.wrongMove;
  const betterMove = context.betterMove;
  const sensory = context.sensory;

  if (format === "dialogue") {
    return {
      gentle: `${name} is in the ${setting}, with ${sensory}. ${conflict}. "${counterpart}, what are we rushing past?" ${name} asks. "${wrongMove}," ${counterpart} says, still staring at the obvious pressure point. "${betterMove}," ${name} says. "${chapter.title} only works if we read the field before we spend ourselves." ${counterpart} finally stops and looks up.`,
      direct: `${name} is in the ${setting}, with ${sensory}. ${conflict}. "${wrongMove}," ${counterpart} says. "${betterMove}," ${name} answers. "We are reading the loudest signal and missing the real one." "${chapter.title} is about the read first, not the display first," ${counterpart} says after a beat.`,
      competitive: `${name} is in the ${setting}, with ${sensory}. ${conflict}. "${wrongMove}," ${counterpart} says. "${betterMove}," ${name} answers. "You are spending force on the wrong layer." "${chapter.title} rewards the cleaner read," ${counterpart} says, finally shifting in the chair.`,
    };
  }

  if (format === "postmortem") {
    return {
      gentle: `${name} is back in the ${setting} after a rough outcome. ${conflict}. ${name} chose to ${wrongMove}. Now the room feels smaller, the air feels stale, and everyone is sorting through the cost of that rushed decision. The loss is not total, but it is messy enough to show what the chapter was warning about all along. ${name} can now see that ${betterMove} would have changed the whole path.`,
      direct: `${name} is reviewing a bad result in the ${setting}. ${conflict}. ${name} moved to ${wrongMove}, and the aftermath is awkward, expensive, and still not fully resolved. The fluorescent hush of the room makes the error easier to hear: the field was never read cleanly. ${betterMove} was the higher quality move, and the bill for skipping it is now visible.`,
      competitive: `${name} is in the ${setting} after a miss that did not need to happen. ${conflict}. ${name} went with ${wrongMove}, and the result is a half-fixed mess with more cost still arriving. The room smells like overwork and stale coffee, and nobody can pretend the read was clean. ${betterMove} would have kept position instead of donating it.`,
    };
  }

  if (format === "predict_reveal") {
    return {
      gentle: `${name} enters the ${setting}, with ${sensory}. ${conflict}. ${name} predicts that the loudest issue in the room will decide everything. The reveal comes slowly: the real hinge is not the obvious argument at all, but whether anyone has paused long enough to ${betterMove}. Once that becomes visible, the earlier prediction looks thin.`,
      direct: `${name} walks into the ${setting}, with ${sensory}. ${conflict}. ${name} predicts the contest will turn on the biggest visible disagreement. Then the reveal lands: the real hinge is whether anyone ${betterMove}. The first prediction was easy to make because the loud signal was also the misleading one.`,
      competitive: `${name} steps into the ${setting}, with ${sensory}. ${conflict}. ${name} predicts the clash will turn on the loudest pressure point. The reveal is sharper: the contest really turns on whether someone ${betterMove}. The obvious signal was bait, and the better read was hiding one layer lower.`,
    };
  }

  if (format === "dilemma") {
    return {
      gentle: `${name} is in the ${setting}, with ${sensory}. ${conflict}. One path is to ${wrongMove}. The other is to slow down long enough to ${betterMove}, even though that pause feels risky in front of everyone watching. The dilemma is real because both choices cost something, and the chapter is teaching ${name} which cost is cheaper to pay.`,
      direct: `${name} is stuck in the ${setting}. ${sensory}. ${conflict}. Option one is to ${wrongMove}. Option two is to ${betterMove}, which feels slower but keeps the field readable. The chapter lives inside that fork, because one cost is loud and immediate while the other cost arrives later and hits harder.`,
      competitive: `${name} hits a fork in the ${setting}, with ${sensory}. ${conflict}. One route is to ${wrongMove}. The other is to ${betterMove}, which risks looking slower while actually protecting position. The chapter matters because it teaches which loss is cosmetic and which one is structural.`,
    };
  }

  if (format === "before_after") {
    return {
      gentle: `Before this chapter clicks, ${name} enters the ${setting} and tends to ${wrongMove}. The result is usually more noise, more strain, and less clarity, even when the room stays polite. After the idea lands, ${name} begins to ${betterMove}. The sensory details do not change, ${sensory}, but the whole mood of the moment changes because the read comes earlier.`,
      direct: `Before learning this chapter, ${name} would reach for ${wrongMove} in the ${setting}. The field then tightened, confusion rose, and the room kept paying for the same bad read. After learning it, ${name} starts to ${betterMove}. Same setting, same pressure, different result because the move now fits the field instead of arguing with it.`,
      competitive: `Before this chapter, ${name} used to ${wrongMove} in the ${setting}. That donated time, position, or focus. After the chapter lands, ${name} starts to ${betterMove}. ${sensory}. Same room, different edge, because the move now works with the field instead of wasting itself against it.`,
    };
  }

  return {
    gentle: `${name} is in the ${setting}, with ${sensory}. ${conflict}. The decision point arrives when the room clearly wants ${wrongMove}. ${name} can feel how tempting that is, because it would end the tension fast. But the chapter points toward ${betterMove}, which looks quieter in the moment and wiser a few minutes later.`,
    direct: `${name} is in the ${setting}, with ${sensory}. ${conflict}. The obvious move is to ${wrongMove}. The better move is to ${betterMove}. The chapter matters because one choice only relieves the pressure in the room, while the other choice changes the real position underneath it.`,
    competitive: `${name} is in the ${setting}, with ${sensory}. ${conflict}. The room is leaning toward ${wrongMove}. The sharper play is to ${betterMove}. One move looks decisive. The other actually improves the field.`,
  };
}

function buildWhatToDo(chapter, context, endingType) {
  return {
    gentle: `${toneStyle("gentle").action} ${context.betterMove}, then keep your voice calm enough that people can still hear the field. ${endingLine(endingType, "gentle", chapter)}`,
    direct: `${toneStyle("direct").action} ${context.betterMove}. Keep the move plain, early, and fitted to the actual pressure. ${endingLine(endingType, "direct", chapter)}`,
    competitive: `${toneStyle("competitive").action} ${context.betterMove}. Protect time and position before the room hardens around the wrong move. ${endingLine(endingType, "competitive", chapter)}`,
  };
}

function buildWhyItMatters(chapter, context, endingType) {
  return {
    gentle: `${chapter.mechanism} In this ${context.setting}, that means the first clean read lowers unnecessary damage before anyone starts defending pride. ${endingLine(endingType, "gentle", chapter)}`,
    direct: `${chapter.mechanism} In this ${context.setting}, that lowers waste by forcing the right question earlier. ${endingLine(endingType, "direct", chapter)}`,
    competitive: `${chapter.mechanism} In this ${context.setting}, that keeps you from spending force where a better read would have been cheaper. ${endingLine(endingType, "competitive", chapter)}`,
  };
}

function buildExamples(chapter, rotationRow, names) {
  const examples = [];
  let exampleIndex = 0;

  for (const slot of rotationRow.examples) {
    const context = chapter[slot.category];
    const primaryNames = names.primary[slot.category];
    const name = primaryNames[exampleIndex % primaryNames.length];
    const counterpart = names.secondary[exampleIndex % names.secondary.length];

    examples.push({
      exampleId: `${chapterId(chapter)}-ex-${String(exampleIndex + 1).padStart(2, "0")}`,
      category: slot.category,
      format: slot.format,
      endingType: slot.endingType,
      title: buildScenarioTitle(name, context, chapter.number + exampleIndex),
      scenario: buildScenarioText(chapter, context, slot.format, name, counterpart),
      whatToDo: buildWhatToDo(chapter, context, slot.endingType),
      whyItMatters: buildWhyItMatters(chapter, context, slot.endingType),
    });
    exampleIndex += 1;
  }

  return examples;
}

function buildImplementationPlan(chapter) {
  return {
    coreSkill: toneObject(
      `Read the field in ${chapter.work.setting} before you spend force on the visible issue.`,
      `Name conditions, cost, and timing before you commit force in ${chapter.work.setting}.`,
      `Take position by reading the field before you show force in ${chapter.work.setting}.`
    ),
    ifThenPlans: [
      {
        context: "work",
        plan: toneObject(
          `If I feel pressure to ${chapter.work.wrongMove}, then I will pause long enough to ${chapter.work.betterMove}.`,
          `If work pressure pushes me toward ${chapter.work.wrongMove}, then I will ${chapter.work.betterMove}.`,
          `If the room wants me to ${chapter.work.wrongMove}, then I will ${chapter.work.betterMove}.`
        ),
      },
      {
        context: "school",
        plan: toneObject(
          `If a school situation makes me want to ${chapter.school.wrongMove}, then I will ${chapter.school.betterMove}.`,
          `If school pressure pushes me toward ${chapter.school.wrongMove}, then I will ${chapter.school.betterMove}.`,
          `If the class or team leans toward ${chapter.school.wrongMove}, then I will ${chapter.school.betterMove}.`
        ),
      },
      {
        context: "personal",
        plan: toneObject(
          `If a personal conflict makes me want to ${chapter.personal.wrongMove}, then I will ${chapter.personal.betterMove}.`,
          `If home pressure pushes me toward ${chapter.personal.wrongMove}, then I will ${chapter.personal.betterMove}.`,
          `If emotion makes ${chapter.personal.wrongMove} feel strong, then I will ${chapter.personal.betterMove}.`
        ),
      },
    ],
    twentyFourHourChallenge: toneObject(
      `Within 24 hours, write down one live situation where you are still tempted to ${chapter.work.wrongMove}, then list the condition you still need to measure.`,
      `Within 24 hours, identify one live decision where ${chapter.work.wrongMove} feels tempting and write the missing condition beside it.`,
      `Within 24 hours, catch one live moment where ${chapter.work.wrongMove} looks strong and force yourself to name the missing read first.`
    ),
    weeklyPractice: toneObject(
      `Three times this week, pause for one minute before a tense move and name the condition, cost, and timing out loud or on paper.`,
      `Three times this week, run a one-minute pre-move check on condition, cost, and timing before acting.`,
      `Three times this week, stop yourself before a visible move and score the field on condition, cost, and timing.`
    ),
  };
}

function buildReviewCards(chapter) {
  return [
    {
      cardId: `${chapterId(chapter)}-rc-01`,
      difficulty: "easy",
      front: toneObject(
        `A teammate wants the loudest move in ${chapter.work.setting}. What should you check before agreeing?`,
        `In ${chapter.work.setting}, what do you measure before backing the obvious move?`,
        `What read do you force first when ${chapter.work.setting} rewards the dramatic move?`
      ),
      back: toneObject(
        `Check the real conditions, the hidden cost, and the timing before you let energy decide the move.`,
        `Measure condition, cost, and timing before backing the loud option.`,
        `Read the field before you spend force on the obvious layer.`
      ),
    },
    {
      cardId: `${chapterId(chapter)}-rc-02`,
      difficulty: "easy",
      front: toneObject(
        `A student keeps treating confidence like readiness in ${chapter.school.setting}. What is the correction?`,
        `What is the correction when ${chapter.school.setting} rewards confidence more than preparation?`,
        `How do you stop confidence from posing as readiness in ${chapter.school.setting}?`
      ),
      back: toneObject(
        `Ask what has actually been checked, aligned, or measured before treating the room's energy as proof.`,
        `Separate visible confidence from real preparation by naming what has actually been measured.`,
        `Force the read first, then decide whether the confident move still makes sense.`
      ),
    },
    {
      cardId: `${chapterId(chapter)}-rc-03`,
      difficulty: "medium",
      front: toneObject(
        `Why does ${chapter.title.toLowerCase()} often reduce waste before it creates visible momentum?`,
        `Why does ${chapter.title.toLowerCase()} change cost before it changes appearance?`,
        `Why does ${chapter.title.toLowerCase()} create edge before it creates noise?`
      ),
      back: toneObject(
        `${chapter.mechanism} That is why the chapter keeps returning to preparation, timing, and reading.`,
        `${chapter.mechanism} The visible move only matters after that read is done.`,
        `${chapter.mechanism} The edge starts in the read, not in the display.`
      ),
    },
    {
      cardId: `${chapterId(chapter)}-rc-04`,
      difficulty: "medium",
      front: toneObject(
        `What is the common trap this chapter warns against?`,
        `Name the main trap that keeps this chapter from working in practice.`,
        `What is the expensive mistake people make when they imitate this chapter badly?`
      ),
      back: toneObject(
        chapter.limitation,
        chapter.limitation,
        chapter.limitation
      ),
    },
    {
      cardId: `${chapterId(chapter)}-rc-05`,
      difficulty: "hard",
      front: toneObject(
        `How does this chapter revise or sharpen the lesson from the previous chapter?`,
        `What tension does this chapter introduce into the prior chapter's rule?`,
        `How does this chapter stop the previous chapter from being used too simply?`
      ),
      back: toneObject(
        chapter.previousConnection || "It starts the chain by insisting on a better first read.",
        chapter.previousConnection || "It opens the chain by insisting on comparison before movement.",
        chapter.previousConnection || "It begins the sequence by making planning answer to reality first."
      ),
    },
  ];
}

function quizExplanation(chapter, tone, correctChoice) {
  if (tone === "gentle") {
    return `The best answer is "${correctChoice}" because ${chapter.mechanism.charAt(0).toLowerCase()}${chapter.mechanism.slice(1)}.`;
  }
  if (tone === "competitive") {
    return `The strongest answer is "${correctChoice}" because it protects position by matching the field before spending force.`;
  }
  return `The correct answer is "${correctChoice}" because it fits the chapter's logic of reading cost, timing, and conditions before acting.`;
}

function buildQuiz(chapter, names) {
  const prompts = [
    `A team starts by arguing over the loudest visible issue in ${chapter.work.setting}. Which move best fits ${chapter.title.toLowerCase()}?`,
    `Before anyone commits in ${chapter.school.setting}, what would this chapter tell you to check first?`,
    `During a tense moment in ${chapter.personal.setting}, which response best matches the chapter's rule?`,
    `${names.primary.work[0]} walks into ${chapter.work.setting}. ${chapter.work.conflict}. What should ${names.primary.work[0]} do first?`,
    `${names.primary.school[0]} is stuck in ${chapter.school.setting}. ${chapter.school.conflict}. Which move fits the chapter best?`,
    `${names.primary.personal[0]} is dealing with ${chapter.personal.conflict} in ${chapter.personal.setting}. What is the stronger read?`,
    `When the room shifts and the obvious move is ${chapter.work.wrongMove}, what does this chapter push you toward instead?`,
    `After a quiet signal shows the field is changing, what would this chapter call the higher quality response?`,
    chapter.number === 1
      ? `Across this opening chapter, which idea matters most before any visible clash begins?`
      : `Chapter ${chapter.number - 1} and Chapter ${chapter.number} together suggest what about reading conditions before action?`,
    chapter.number < 3
      ? `Compared with the rest of this chapter, what marks the strongest application in a live setting?`
      : `Compared with Chapter ${chapter.number - 2}, what new layer does Chapter ${chapter.number} add to the strategy?`,
  ];

  const choiceSets = [
    [chapter.work.betterMove, chapter.work.wrongMove, "wait for the loudest opinion to harden before reacting"],
    [chapter.school.betterMove, "choose the move that looks boldest first", chapter.school.wrongMove],
    [chapter.personal.betterMove, chapter.personal.wrongMove, "mirror the other side's emotion before reading the situation"],
    [chapter.work.betterMove, "give the room a bigger display of confidence", chapter.work.wrongMove],
    [chapter.school.betterMove, chapter.school.wrongMove, "treat silence as proof that the read is already clear"],
    [chapter.personal.betterMove, "let pressure choose the route for you", chapter.personal.wrongMove],
    ["slow down long enough to read the cost and timing", chapter.work.wrongMove, "prove commitment by moving first"],
    ["update the move to fit the field now", "defend the first plan because changing it looks weak", chapter.school.wrongMove],
    chapter.number === 1
      ? ["Compare conditions before acting", "let confidence decide the route", "save planning for after the first clash"]
      : ["A later move only works when the earlier field was read correctly", "Every chapter rewards louder force over better reading", "Good strategy ignores cost once pressure starts"],
    chapter.number < 3
      ? ["It changes the field before the field becomes expensive", "It rewards the most dramatic action first", "It treats timing as less important than certainty"]
      : ["It adds a new layer of cost, timing, or field reading to the prior idea", "It cancels the earlier chapter entirely", "It says the previous chapter no longer matters once pressure rises"],
  ];

  return {
    passingScorePercent: 80,
    questions: prompts.map((prompt, index) => {
      const choices = choiceSets[index];
      const correctIndex = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0][index];
      const correctChoice = choices[correctIndex];
      return {
        questionId: `${chapterId(chapter)}-q${String(index + 1).padStart(2, "0")}`,
        prompt: sentence(prompt),
        choices,
        correctIndex,
        explanation: {
          gentle: quizExplanation(chapter, "gentle", correctChoice),
          direct: quizExplanation(chapter, "direct", correctChoice),
          competitive: quizExplanation(chapter, "competitive", correctChoice),
        },
      };
    }),
  };
}

function buildKeyTakeawayCard(chapter) {
  return {
    gentle: `${chapter.coreConcept} The calmer move is often the stronger one because it lowers waste before pressure hardens into damage.`,
    direct: `${chapter.coreConcept} Read the field, name the cost, then move only when the conditions justify the price.`,
    competitive: `${chapter.coreConcept} The edge starts in the read, not in the display, and the side that sees that earlier spends less to win more.`,
  };
}

function buildChapter(chapter, rotationRow, names) {
  return {
    chapterId: chapterId(chapter),
    number: chapter.number,
    title: chapter.title,
    readingTimeMinutes: 12,
    contentVariants: {
      easy: buildContentVariant(chapter, "easy"),
      medium: buildContentVariant(chapter, "medium"),
      hard: buildContentVariant(chapter, "hard"),
    },
    examples: buildExamples(chapter, rotationRow, names),
    quiz: buildQuiz(chapter, names),
    implementationPlan: buildImplementationPlan(chapter),
    reviewCards: buildReviewCards(chapter),
    keyTakeawayCard: buildKeyTakeawayCard(chapter),
  };
}

function buildRichPackage(rotationTable, nameLedger) {
  const chapters = CHAPTERS.map((chapter, index) =>
    buildChapter(chapter, rotationTable[index], nameLedger[chapter.number])
  );
  return {
    schemaVersion: SCHEMA_VERSION,
    packageId: randomUUID(),
    createdAt: new Date().toISOString(),
    contentOwner: CONTENT_OWNER,
    book: {
      bookId: BOOK_ID,
      title: BOOK_TITLE,
      author: AUTHOR,
      categories: ["Strategy", "Leadership", "Philosophy"],
      tags: ["strategy", "warfare", "deception", "terrain", "timing", "intelligence"],
      edition: EDITION,
      variantFamily: "EMH",
    },
    chapters,
  };
}

function normalizeVariant(rawVariant, tone) {
  const summaryBlocks = [];
  const chapterBreakdown = resolveTone(rawVariant.chapterBreakdown, tone);
  if (chapterBreakdown) {
    for (const paragraph of splitParagraphs(chapterBreakdown)) {
      summaryBlocks.push({ type: "paragraph", text: paragraph });
    }
  }
  const bullets = [];
  if (Array.isArray(rawVariant.keyTakeaways)) {
    for (const item of rawVariant.keyTakeaways) {
      const point = resolveTone(item.point, tone);
      if (!point) continue;
      bullets.push(point);
      if (item.moreDetails) {
        summaryBlocks.push({
          type: "bullet",
          text: point,
          detail: resolveTone(item.moreDetails, tone),
        });
      } else {
        summaryBlocks.push({ type: "bullet", text: point });
      }
    }
  }

  const practice = [];
  const recap = rawVariant.oneMinuteRecap;
  if (recap && typeof recap === "object" && recap.retrieve) {
    practice.push(resolveTone(recap.retrieve, tone));
    practice.push(resolveTone(recap.connect, tone));
    practice.push(resolveTone(recap.preview, tone));
  } else {
    practice.push(resolveTone(recap, tone));
  }
  if (rawVariant.activationPrompt) practice.push(resolveTone(rawVariant.activationPrompt, tone));
  if (rawVariant.selfCheckPrompt) practice.push(resolveTone(rawVariant.selfCheckPrompt, tone));
  if (Array.isArray(rawVariant.selfCheckPrompts)) {
    for (const item of rawVariant.selfCheckPrompts) {
      practice.push(resolveTone(item, tone));
    }
  }
  if (rawVariant.predictionPrompt) practice.push(resolveTone(rawVariant.predictionPrompt, tone));

  return {
    importantSummary: summaryBlocks.find((item) => item.type === "paragraph")?.text ?? "",
    summaryBullets: bullets,
    summaryBlocks,
    keyTakeaways: bullets,
    takeaways: bullets,
    practice: practice.filter(Boolean),
  };
}

function flattenForPublish(richPackage, tone = "direct") {
  return {
    schemaVersion: richPackage.schemaVersion,
    packageId: richPackage.packageId,
    createdAt: richPackage.createdAt,
    contentOwner: richPackage.contentOwner,
    book: richPackage.book,
    chapters: richPackage.chapters.map((chapter) => ({
      chapterId: chapter.chapterId,
      number: chapter.number,
      title: chapter.title,
      readingTimeMinutes: chapter.readingTimeMinutes,
      contentVariants: {
        easy: normalizeVariant(chapter.contentVariants.easy, tone),
        medium: normalizeVariant(chapter.contentVariants.medium, tone),
        hard: normalizeVariant(chapter.contentVariants.hard, tone),
      },
      examples: chapter.examples.map((example) => ({
        exampleId: example.exampleId,
        title: example.title,
        scenario: resolveTone(example.scenario, tone),
        whatToDo: [resolveTone(example.whatToDo, tone)],
        whyItMatters: resolveTone(example.whyItMatters, tone),
        contexts: [example.category],
      })),
      quiz: {
        passingScorePercent: chapter.quiz.passingScorePercent,
        questions: chapter.quiz.questions.map((question) => ({
          questionId: question.questionId,
          prompt: question.prompt,
          choices: question.choices,
          correctIndex: question.correctIndex,
          explanation: resolveTone(question.explanation, tone),
        })),
      },
    })),
  };
}

function walkStrings(value, visit, currentPath = []) {
  if (typeof value === "string") {
    visit(value, currentPath.join("."));
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkStrings(item, visit, [...currentPath, String(index)]));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      walkStrings(item, visit, [...currentPath, key]);
    }
  }
}

function validateChapter(chapter) {
  const issues = [];
  const ranges = {
    easy: [140, 175],
    medium: [330, 420],
    hard: [490, 600],
  };

  for (const [depth, [min, max]] of Object.entries(ranges)) {
    const variant = chapter.contentVariants[depth];
    for (const tone of ["gentle", "direct", "competitive"]) {
      const breakdown = resolveTone(variant.chapterBreakdown, tone);
      const count = wordCount(breakdown);
      if (count < min || count > max) {
        issues.push(`${chapter.chapterId}.${depth}.${tone} word count ${count} outside ${min}-${max}`);
      }
      const firstSentence = clean(breakdown).split(/(?<=[.!?])\s+/)[0]?.toLowerCase() ?? "";
      if (firstSentence.startsWith("this chapter") || firstSentence.startsWith("the author argues")) {
        issues.push(`${chapter.chapterId}.${depth}.${tone} opening is thesis-like`);
      }
    }
  }

  if (chapter.contentVariants.easy.keyTakeaways.length !== 3) {
    issues.push(`${chapter.chapterId}.easy takeaways not equal to 3`);
  }
  if (chapter.contentVariants.medium.keyTakeaways.length < 5 || chapter.contentVariants.medium.keyTakeaways.length > 7) {
    issues.push(`${chapter.chapterId}.medium takeaways outside 5-7`);
  }
  if (chapter.contentVariants.hard.keyTakeaways.length < 7 || chapter.contentVariants.hard.keyTakeaways.length > 10) {
    issues.push(`${chapter.chapterId}.hard takeaways outside 7-10`);
  }

  if (chapter.examples.length !== 6) {
    issues.push(`${chapter.chapterId}.examples must contain 6 items`);
  }

  const dialogue = chapter.examples.filter((example) => example.format === "dialogue");
  if (dialogue.some((example) => !/"[^"]+"/.test(resolveTone(example.scenario, "direct")))) {
    issues.push(`${chapter.chapterId}.dialogue example missing quoted speech`);
  }

  if (chapter.quiz.questions.length !== 10) {
    issues.push(`${chapter.chapterId}.quiz must contain 10 questions`);
  }

  for (const question of chapter.quiz.questions) {
    if (!Array.isArray(question.choices) || question.choices.length !== 3) {
      issues.push(`${chapter.chapterId}.${question.questionId} must have exactly 3 choices`);
    }
  }

  walkStrings(chapter, (value, pathLabel) => {
    if (value.includes("—") || value.includes("–")) {
      issues.push(`${pathLabel} contains dash character`);
    }
    const lowered = value.toLowerCase();
    for (const phrase of BANNED_PHRASES) {
      if (lowered.includes(phrase)) {
        issues.push(`${pathLabel} contains banned phrase "${phrase}"`);
      }
    }
  });

  return issues;
}

function validatePackage(richPackage, publishPackage, rotationTable, nameLedger) {
  const phase4 = {
    checkedChapters: [],
    issues: [],
  };
  const phase7 = {
    chapterCount: richPackage.chapters.length,
    issues: [],
    publishShape: {
      chapterCount: publishPackage.chapters.length,
      allQuestionsThreeChoices: publishPackage.chapters.every((chapter) =>
        chapter.quiz.questions.every((question) => question.choices.length === 3)
      ),
    },
  };

  const nameCounts = new Map();
  for (const [chapterNumber, value] of Object.entries(nameLedger)) {
    const allNames = [
      ...value.primary.work,
      ...value.primary.school,
      ...value.primary.personal,
      ...value.secondary,
    ];
    for (const name of allNames) {
      nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1);
    }
    if (allNames.length !== 9) {
      phase7.issues.push(`chapter ${chapterNumber} name ledger size mismatch`);
    }
  }

  for (const [name, count] of nameCounts.entries()) {
    if (count > 2) {
      phase7.issues.push(`name ${name} used in more than two chapters`);
    }
  }

  for (const chapter of richPackage.chapters.slice(0, 3)) {
    const issues = validateChapter(chapter);
    phase4.checkedChapters.push({
      chapterId: chapter.chapterId,
      issues,
    });
    phase4.issues.push(...issues);
  }

  for (const chapter of richPackage.chapters) {
    phase7.issues.push(...validateChapter(chapter));
  }

  for (const row of rotationTable) {
    const formats = new Set(row.examples.map((item) => item.format));
    if (formats.size !== 6) {
      phase7.issues.push(`rotation table for chapter ${row.chapterNumber} does not cover all formats`);
    }
  }

  return { phase4, phase7 };
}

function buildMasterBrief(rotationTable, nameLedger) {
  return {
    bookId: BOOK_ID,
    title: BOOK_TITLE,
    author: AUTHOR,
    edition: EDITION,
    chapterCount: CHAPTERS.length,
    promptPaths: PROMPT_PATHS,
    rotationTable,
    nameLedger,
    chapterBriefPaths: CHAPTERS.map((chapter) => `${TMP_PREFIX}-ch${String(chapter.number).padStart(2, "0")}-brief.json`),
  };
}

function writeBriefs(rotationTable, nameLedger) {
  const master = buildMasterBrief(rotationTable, nameLedger);
  writeJson(MASTER_BRIEF_PATH, master);

  CHAPTERS.forEach((chapter, index) => {
    writeJson(
      `${TMP_PREFIX}-ch${String(chapter.number).padStart(2, "0")}-brief.json`,
      chapterBrief(chapter, rotationTable[index], nameLedger)
    );
  });
}

function writePhase0Report() {
  writeJson(PHASE0_REPORT_PATH, {
    bookId: BOOK_ID,
    deletedFiles: [],
    tmpMatches: [],
    coverMatches: [],
    activeReferencesRemoved: [],
    notes: [
      "No existing Art of War package files were present before generation.",
      "No leftover /tmp files matched this book before generation.",
      "The only existing Sun Tzu text in the repo was an unrelated 48 Laws synopsis reference and was intentionally preserved.",
    ],
  });
}

function writeCoverReport() {
  writeJson(COVER_REPORT_PATH, {
    bookId: BOOK_ID,
    status: "manual_needed",
    message:
      "ACTION NEEDED: Manually add the official published cover for the 1910 Luzac & Co. Lionel Giles edition to public/book-covers/the-art-of-war-20260328-real.jpg. The generator did not guess a cover image.",
  });
}

function main() {
  writePhase0Report();

  const rotationTable = buildRotationTable();
  const nameLedger = buildNameLedger();
  const researchDossier = buildResearchDossier(rotationTable, nameLedger);
  const continuityLedger = {
    bookId: BOOK_ID,
    requiredExampleFormats: ["decision_point", "postmortem", "dialogue", "predict_reveal", "dilemma", "before_after"],
    endingTypes: ENDING_TYPES,
    vocabularyAudit: VOCABULARY_AUDIT,
    schoolSettings: SCHOOL_SETTINGS,
    rotationTable,
    nameLedger,
    crossChapterTensions: researchDossier.crossChapterTensions,
  };

  writeJson(RESEARCH_DOSSIER_PATH, researchDossier);
  writeJson(CONTINUITY_LEDGER_PATH, continuityLedger);
  writeBriefs(rotationTable, nameLedger);

  const richPackage = buildRichPackage(rotationTable, nameLedger);
  const publishPackage = flattenForPublish(richPackage, "direct");
  const { phase4, phase7 } = validatePackage(richPackage, publishPackage, rotationTable, nameLedger);

  writeJson(OUTPUT_PACKAGE_PATH, richPackage);
  writeJson(PUBLISH_PACKAGE_PATH, publishPackage);
  writeJson(PHASE4_REPORT_PATH, phase4);
  writeJson(PHASE7_REPORT_PATH, phase7);
  writeCoverReport();
  writeText(`${TMP_PREFIX}-status.log`, "Phases 0-7 generated. Cover remains manual-needed.");

  const status = {
    bookId: BOOK_ID,
    packagePath: OUTPUT_PACKAGE_PATH,
    publishPackagePath: PUBLISH_PACKAGE_PATH,
    researchDossierPath: RESEARCH_DOSSIER_PATH,
    continuityLedgerPath: CONTINUITY_LEDGER_PATH,
    phase4ReportPath: PHASE4_REPORT_PATH,
    phase7ReportPath: PHASE7_REPORT_PATH,
    coverReportPath: COVER_REPORT_PATH,
    phase4Issues: phase4.issues.length,
    phase7Issues: phase7.issues.length,
  };

  console.log(JSON.stringify(status, null, 2));
  if (phase4.issues.length || phase7.issues.length) {
    process.exitCode = 1;
  }
}

main();
