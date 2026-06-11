import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const chapterDir = path.join(
  root,
  "scripts/book/prompts/chapterflow-v21-authored/state/chapters",
);
const sourceDir = path.join(
  root,
  ".chapterflow/runs/unreasonable-hospitality/20260601-083523/sidecars/source",
);

const frames = {
  1: {
    short: "hospitality economy",
    takeaway:
      "Service completes the transaction; hospitality designs the feeling people carry away. The durable edge comes from treating that feeling as part of the product.",
    counter:
      "The surprising move after a public disappointment is not to polish the same strength harder. It is to compete on the human experience everyone else leaves vague.",
    tryNow:
      "Before one exchange today, name both the task to finish and the feeling the other person should leave with.",
    desiredFeeling: "seen rather than processed",
    readerMove: "define the emotion the work should create, then adjust the service steps around it",
    wrongHabit: "assume competent execution is enough because the product is strong",
  },
  2: {
    short: "making magic",
    takeaway:
      "Magic is not extravagance; it is the caring effort that turns an ordinary exchange into proof that someone matters.",
    counter:
      "A meal, a call, or a handoff becomes memorable less because it is fancy than because someone notices the human need inside it.",
    tryNow:
      "Pick one routine interaction and add a small sign that you prepared for the person, not just the transaction.",
    desiredFeeling: "worth extra care",
    readerMove: "look for the personal context behind the request and respond to that context",
    wrongHabit: "reserve warmth for special occasions while routine moments stay mechanical",
  },
  3: {
    short: "intention",
    takeaway:
      "Intention gives hospitality direction: decide what you want people to feel before you decide what you will do.",
    counter:
      "A generous act can miss if it starts with the giver's cleverness instead of the receiver's experience.",
    tryNow:
      "Write the intended feeling for one meeting in six words or fewer, then cut any action that does not serve it.",
    desiredFeeling: "understood in a specific way",
    readerMove: "start with the emotional outcome and let the tactic follow",
    wrongHabit: "copy a charming gesture without asking what it is meant to accomplish",
  },
  4: {
    short: "enlightened hospitality",
    takeaway:
      "Enlightened hospitality makes care operational: put people first, assume generously, and keep steady pressure on standards without losing grace.",
    counter:
      "Warmth is not the opposite of discipline. The best teams use discipline to make warmth reliable.",
    tryNow:
      "When a mistake appears today, pause long enough to make the charitable assumption before choosing the correction.",
    desiredFeeling: "respected even while the standard rises",
    readerMove: "protect the relationship while correcting the work",
    wrongHabit: "treat speed, blame, or clever slogans as substitutes for patient leadership",
  },
  5: {
    short: "the 95/5 rule",
    takeaway:
      "Ninety-five percent of the work should be disciplined and profitable so the remaining five percent can be joyfully unreasonable.",
    counter:
      "The magical five percent only works when the ordinary ninety-five percent is controlled, measured, and boring in the best way.",
    tryNow:
      "Find one small rule your team can hold tighter so a meaningful exception becomes easier to afford.",
    desiredFeeling: "surprised without sensing chaos behind the scenes",
    readerMove: "tighten the base operation before spending freedom on a guest-facing exception",
    wrongHabit: "use creativity to avoid operational discipline",
  },
  6: {
    short: "true partnership",
    takeaway:
      "A restaurant, or any organization, works best when the people making the product and the people delivering it share ownership of the guest's experience.",
    counter:
      "The wall between craft and service feels efficient until it prevents the team from solving the whole problem together.",
    tryNow:
      "Invite one back-of-house voice and one front-line voice into the same decision before the day ends.",
    desiredFeeling: "served by one unified team",
    readerMove: "bring makers and servers into the same conversation about the customer",
    wrongHabit: "let each department optimize its own side of the wall",
  },
  7: {
    short: "setting expectations",
    takeaway:
      "Clear expectations make excellence repeatable because people can only rise to a standard they can see.",
    counter:
      "A high bar is not pressure by itself; it becomes useful when leaders translate it into daily, observable behavior.",
    tryNow:
      "Turn one vague standard into a sentence a new teammate could act on during the next shift.",
    desiredFeeling: "confident about what excellence looks like",
    readerMove: "make the standard visible before judging whether people met it",
    wrongHabit: "expect people to infer the bar from mood, reputation, or tradition",
  },
  8: {
    short: "inexperience as a superpower",
    takeaway:
      "Inexperience can become an advantage when it lets a team question stale rules and hire for the attitude the culture needs.",
    counter:
      "Experience is useful, but it can also defend habits that no longer serve the guest.",
    tryNow:
      "Ask one new person which rule seems strange, then listen before explaining why it exists.",
    desiredFeeling: "welcomed by a team that is awake, not automatic",
    readerMove: "use fresh eyes to challenge rules that only protect habit",
    wrongHabit: "confuse tenure with judgment and curiosity with naivete",
  },
  9: {
    short: "purpose on purpose",
    takeaway:
      "Purpose gets practical when values move from posters into decisions, language, and the daily rhythm of the team.",
    counter:
      "A noble mission does not live in a statement. It lives in what the team repeats when the room is busy.",
    tryNow:
      "Choose one value and ask where it should show up in today's work before anyone gets tired.",
    desiredFeeling: "part of work that matters",
    readerMove: "translate values into a behavior the team can practice today",
    wrongHabit: "treat purpose as branding while daily choices stay unchanged",
  },
  10: {
    short: "ownership program",
    takeaway:
      "Ownership grows when leaders hand real domains to people, give them room to learn, and let their expertise shape the whole experience.",
    counter:
      "Delegation is not dumping work. It is giving someone a meaningful corner of the culture to improve.",
    tryNow:
      "Give one teammate a specific domain to study, improve, and teach back to the group.",
    desiredFeeling: "helped by people who are proud of their craft",
    readerMove: "assign ownership with authority, education, and a public way to share learning",
    wrongHabit: "keep decisions centralized and then wonder why people act like helpers",
  },
  11: {
    short: "sustainable excellence",
    takeaway:
      "Excellence needs both ambition and a nervous system: trust people, hold the line, and create habits that keep pressure from becoming panic.",
    counter:
      "Pushing harder is not the same as getting better. A team can chase greatness and still need rituals that let it breathe.",
    tryNow:
      "Identify one recurring stress point and add a calming routine before the next rush.",
    desiredFeeling: "protected by calm competence",
    readerMove: "pair high standards with practices that regulate the team under pressure",
    wrongHabit: "measure commitment by exhaustion",
  },
  12: {
    short: "tough-love language",
    takeaway:
      "Correction lands when it is personal enough to be heard and caring enough to keep the relationship intact.",
    counter:
      "Direct feedback is not automatically brave; it becomes useful only when the receiver can actually take it in.",
    tryNow:
      "Before giving feedback, ask what language will help this person hear the standard without shutting down.",
    desiredFeeling: "challenged by someone who is on their side",
    readerMove: "adapt the feedback to the person while keeping the standard clear",
    wrongHabit: "use the same blunt script on everyone and call it honesty",
  },
  13: {
    short: "leveraging affirmation",
    takeaway:
      "Praise is a leadership tool when it is specific, shared quickly, and used to show people which behaviors matter.",
    counter:
      "Affirmation is not softness. It is one of the fastest ways to make the desired standard visible.",
    tryNow:
      "Pass along one piece of specific praise today and name the behavior it should reinforce.",
    desiredFeeling: "noticed for the right contribution",
    readerMove: "turn recognition into evidence of what the culture values",
    wrongHabit: "save praise for formal reviews or let it stop with the manager",
  },
  14: {
    short: "restoring balance",
    takeaway:
      "Slowing down can be the fastest way back to excellence when the pause restores attention, breath, and judgment.",
    counter:
      "Urgency can look impressive while quietly eroding the very care the team is trying to deliver.",
    tryNow:
      "Build one deliberate reset into a pressured moment instead of waiting until everyone is depleted.",
    desiredFeeling: "met by a team that has its balance",
    readerMove: "protect small recovery rituals so speed does not swallow judgment",
    wrongHabit: "treat every pause as weakness or wasted time",
  },
  15: {
    short: "hospitality as offense",
    takeaway:
      "Hospitality is strongest when it creates the experience proactively instead of merely recovering after something goes wrong.",
    counter:
      "Defense fixes misses; offense designs moments people did not know to ask for.",
    tryNow:
      "Choose one part of the experience where you can delight first rather than apologize later.",
    desiredFeeling: "pleasantly surprised before any problem appears",
    readerMove: "invest in proactive moments that express the standard before recovery is needed",
    wrongHabit: "wait for complaints before spending creative energy",
  },
  16: {
    short: "earning informality",
    takeaway:
      "Informality works only after competence has earned trust; ease is powerful when it rests on real mastery.",
    counter:
      "Casualness without excellence feels careless, but excellence without ease can feel cold.",
    tryNow:
      "Pick one moment where the team can be warmer without becoming looser about the standard.",
    desiredFeeling: "relaxed because the team is clearly capable",
    readerMove: "earn trust through precision, then use that trust to become more human",
    wrongHabit: "mistake looseness for hospitality or formality for excellence",
  },
  17: {
    short: "hospitality as dialogue",
    takeaway:
      "Unreasonable hospitality listens first; the best gesture emerges from dialogue with the person in front of you.",
    counter:
      "A spectacular idea can still be self-centered if it ignores what the guest actually wants.",
    tryNow:
      "Before planning a gesture, ask one better question about the person's real preference or constraint.",
    desiredFeeling: "known rather than performed at",
    readerMove: "treat hospitality as a conversation before designing the response",
    wrongHabit: "deliver a prewritten wow moment without checking whether it fits",
  },
  18: {
    short: "systemized improvisation",
    takeaway:
      "Improvisation becomes reliable when the team builds systems that help people notice, decide, and act quickly.",
    counter:
      "Spontaneity is easier to repeat when the organization prepares for it on purpose.",
    tryNow:
      "Create one simple channel for front-line observations to become same-day action.",
    desiredFeeling: "delighted by care that feels spontaneous",
    readerMove: "build tools that turn real-time noticing into practical action",
    wrongHabit: "hope for magical instincts without giving the team a mechanism",
  },
  19: {
    short: "scaling culture",
    takeaway:
      "Culture scales when leaders seed the principles, trust local judgment, and repair quickly when the transplant misfires.",
    counter:
      "Copying the old playbook is easier than growing the culture, but a copy can become lifeless without local ownership.",
    tryNow:
      "Ask which principle must travel unchanged and which practice should be adapted to the new room.",
    desiredFeeling: "served by a culture that is consistent without being cloned",
    readerMove: "teach the values, empower local leaders, and correct missteps openly",
    wrongHabit: "export rituals without giving the new team authority",
  },
  20: {
    short: "subtraction as refinement",
    takeaway:
      "Refinement often means removing the impressive parts that distract from the clearest expression of care.",
    counter:
      "More courses, words, and flourishes can make excellence harder to feel rather than easier.",
    tryNow:
      "Choose one overworked part of an experience and ask what would become stronger if it were simpler.",
    desiredFeeling: "clear about what the experience is really for",
    readerMove: "cut what no longer serves the mission, even if it once signaled ambition",
    wrongHabit: "add complexity to prove seriousness",
  },
};

const workplaces = [
  {
    domain: "hotel front desk",
    person: "Imani",
    task: "move a tired guest through check-in",
    pressure: "the line is growing and the property-management screen keeps timing out",
    audience: "front-desk leads",
    format: "decision_point",
  },
  {
    domain: "clinic discharge",
    person: "Rafael",
    task: "send a patient home with instructions",
    pressure: "the nurse is behind and the patient's daughter looks frightened",
    audience: "clinic managers",
    format: "dialogue",
  },
  {
    domain: "software support",
    person: "Soren",
    task: "answer a customer whose integration failed twice",
    pressure: "the ticket queue rewards speed but the customer has lost trust",
    audience: "support leaders",
    format: "dilemma",
  },
  {
    domain: "museum membership",
    person: "Yasmin",
    task: "welcome a donor who has been misnamed in the database",
    pressure: "the gala team wants the fix handled quietly and fast",
    audience: "membership directors",
    format: "before_after",
  },
  {
    domain: "airline gate",
    person: "Keiko",
    task: "board delayed passengers after a weather hold",
    pressure: "everyone wants the aircraft turned quickly",
    audience: "station supervisors",
    format: "postmortem",
  },
  {
    domain: "bank branch",
    person: "Dante",
    task: "help a small-business owner after a loan document mistake",
    pressure: "the compliance checklist is complete but the owner is embarrassed",
    audience: "branch managers",
    format: "planning_choice",
  },
];

const people = [
  "Alina", "Mateo", "Priya", "Theo", "Naomi", "Elias",
  "Mara", "Jules", "Leila", "Omar", "Celia", "Kenji",
  "Nadia", "Rowan", "Isha", "Luca", "Talia", "Bennett",
  "Mina", "Jonas", "Asha", "Caleb", "Rhea", "Nico",
  "Selene", "Arman", "Tessa", "Vikram", "Maya", "Dorian",
  "Elena", "Micah", "Zara", "Hugo", "Anika", "Felix",
  "Sofia", "Milan", "Kira", "Adrian", "Noor", "Graham",
  "Paloma", "Ezra", "Lina", "Malik", "Iris", "Tomas",
  "Amara", "Silas", "Nina", "Ravi", "Clara", "Owen",
  "Mei", "Callum", "Sana", "Victor", "Lena", "Idris",
  "Freya", "Marco", "Hana", "Declan", "Amina", "Cole",
  "Dalia", "Ronan", "Mira", "Julian", "Samira", "Evan",
  "Vera", "Nolan", "Layla", "Quentin", "Aya", "Simon",
  "Bianca", "Rafi", "Helena", "Miles", "Ines", "Oscar",
  "Kaia", "Emil", "Farah", "Peter", "Lucia", "Arlo",
  "Tina", "Santiago", "Nora", "Harris", "Yara", "Finn",
  "Elise", "Cyrus", "Pia", "Maxim", "Soraya", "Reed",
  "June", "Kian", "Rosa", "Tariq", "Mabel", "Eamon",
  "Gia", "Solomon", "Livia", "Ashwin", "Carmen", "Wes",
  "Mavis", "Dylan", "Anya", "Ruben", "Esther", "Kai",
  "Briar", "Corin", "Devika", "Ione", "Niall", "Petra",
  "Salma", "Torin", "Uma", "Vaughn", "Willa", "Xander",
  "Yael", "Zev", "Bruna", "Caspar", "Dima", "Eira",
  "Faris", "Greta", "Hollis", "Isolde", "Jalen", "Keira",
];

const bannedExampleNames = new Set([
  "Priya", "Omar", "Maya", "Marcus", "Elena", "Lena", "Victor", "Theo", "Jonah", "Mateo",
  "Tessa", "Owen", "Mira", "Malik", "Nadia", "Felix", "Caleb", "Talia", "Elise", "Naomi",
]);

const availablePeople = people.filter((name) => !bannedExampleNames.has(name));

const domains = [
  "boutique hotel desk", "oncology discharge bay", "billing support pod", "museum donor lounge", "regional airport gate", "neighborhood bank branch",
  "university advising office", "catering prep room", "luxury retail floor", "community pharmacy", "city permitting counter", "subscription renewal team",
  "train station help desk", "dental reception area", "product onboarding call", "performing-arts box office", "equipment rental shop", "family restaurant host stand",
  "student housing office", "telehealth intake queue", "warranty repair center", "library circulation desk", "conference registration table", "credit-union lobby",
  "senior living dining room", "urgent-care check-in", "developer success channel", "gallery opening desk", "ferry terminal booth", "insurance claims line",
];

const tasks = [
  "welcome a guest arriving after a cancelled train",
  "send home a parent who is scared about follow-up care",
  "recover confidence after a second failed setup call",
  "correct a misspelled name before a public event",
  "board passengers after a rolling weather delay",
  "repair a document error for a nervous owner",
  "guide a first-generation student through a confusing form",
  "turn a late dietary request into a calm service plan",
  "help a shopper whose gift choice suddenly matters more",
  "explain a prescription change without making the patient feel rushed",
  "move an applicant through a rule-heavy process",
  "win back a customer who feels trapped by renewal terms",
  "help a traveler who missed the last connection",
  "prepare a child for a procedure they dread",
  "teach a new admin user without embarrassing them",
  "seat a patron after the ticket scanner rejects the code",
  "replace a tool needed for tomorrow's job",
  "welcome a regular whose usual table is gone",
  "resolve a room assignment that separates friends",
  "calm a patient before a video visit begins",
  "explain a denied repair without sounding defensive",
  "help a patron who has lost a borrowed item",
  "register speakers while the schedule changes",
  "walk a retiree through a fraud hold",
  "serve dinner after the kitchen missed a preference",
  "check in a patient who has already retold the story twice",
  "answer a developer who is angry about unclear docs",
  "welcome an artist whose work was hung in the wrong order",
  "help a commuter when the ferry schedule collapses",
  "settle a claim after a confusing voicemail chain",
];

const pressures = [
  "The queue is visible, and every delay makes the team want to shorten the conversation",
  "A colleague is signaling for speed, but the person across the desk needs steadiness",
  "The dashboard says the case is closed, yet the relationship plainly is not",
  "The fix is small, but the embarrassment in the room is large",
  "Everyone wants the line moving, and nobody wants another announcement",
  "The checklist is satisfied, but the customer's confidence has thinned",
  "The rule can be explained in ten seconds, or it can be made humane in two minutes",
  "The kitchen can absorb the change, but only if someone owns the handoff",
  "The sale would be easy; the meaning of the gift takes more attention",
  "The next appointment is waiting, and the patient is pretending to understand",
  "The policy is accurate, but the tone could make the process feel hostile",
  "The renewal script protects revenue while the caller hears only indifference",
  "The timetable gives facts, not reassurance",
  "The clinical routine is familiar to staff and frightening to the family",
  "The product team wants adoption numbers; the user needs dignity",
  "The lobby is watching, and the rejected ticket has made the patron flush",
  "The replacement is inexpensive, but the job depending on it is not",
  "The staff can explain the table change or make the regular feel remembered anyway",
  "The rooming software is right, but the social reality is wrong",
  "The appointment can start on time only if anxiety is addressed quickly",
];

const exampleTemplates = [
  (p, d, t, pr, sourceLabel, frame) => `${p}'s ${d} case begins with ${t}. ${pr}. ${sourceLabel} helps ${p} aim for ${frame.desiredFeeling}, not just a clean finish.`,
  (p, d, t, pr, sourceLabel, frame) => `${sourceLabel} gives ${p} a test inside the ${d}: ${t}. ${pr}. The local answer has to carry ${frame.short} without copying the restaurant scene.`,
  (p, d, t, pr, sourceLabel, frame) => `${p} spots a gap in the ${d}. The process can handle ${t}, yet ${pr}. The repair is to make ${frame.desiredFeeling} a design requirement.`,
  (p, d, t, pr, sourceLabel, frame) => `${p} reviews a rough ${d} exchange: ${t}. ${pr}. The named case helps ${p} ask where completion stopped short of care.`,
  (p, d, t, pr, sourceLabel, frame) => `${p}'s script for the ${d} covers ${t}. ${pr}. To honor ${frame.short}, the script needs one place for judgment.`,
  (p, d, t, pr, sourceLabel, frame) => `${p} brings a ${d} moment to huddle: ${t}. ${pr}. The team turns ${sourceLabel} into one visible behavior.`,
  (p, d, t, pr, sourceLabel, frame) => `${p} sees the ${d} process handle ${t}. ${pr}. That is where ${frame.short} has to appear before the customer names the miss.`,
  (p, d, t, pr, sourceLabel, frame) => `${sourceLabel} remains useful because ${p}'s ${d} pressure is concrete: ${t}. ${pr}. The response needs a repeatable owner.`,
  (p, d, t, pr, sourceLabel, frame) => `${p} owns a small decision in the ${d}: ${t}. ${pr}. The choice is to make ${frame.desiredFeeling} visible in one behavior.`,
  (p, d, t, pr, sourceLabel, frame) => `${p} coaches the ${d} team around ${t}. ${pr}. Instead of praising speed, ${p} asks what the receiver experienced.`,
  (p, d, t, pr, sourceLabel, frame) => `${p} notices ${frame.wrongHabit} creeping into the ${d}. The live job is ${t}. ${pr}. A more human choice would serve the moment better.`,
  (p, d, t, pr, sourceLabel, frame) => `${sourceLabel} echoes inside ${p}'s ${d} decision. The customer needs ${t}. ${pr}. Feeling and task have to be named together.`,
  (p, d, t, pr, sourceLabel, frame) => `${p} avoids theater in the ${d}. The real problem is ${t}. ${pr}. One owned adjustment will do more than a dramatic flourish.`,
  (p, d, t, pr, sourceLabel, frame) => `${p} weighs two ${d} options for ${t}. ${pr}. The better option protects the receiver's dignity and fits ${frame.short}.`,
  (p, d, t, pr, sourceLabel, frame) => `${p} writes a ${d} shift note after ${t}. ${pr}. The note ties the felt result to a concrete operating step.`,
  (p, d, t, pr, sourceLabel, frame) => `${p} sees procedure take over in the ${d} during ${t}. ${pr}. ${sourceLabel} points toward judgment, not indulgence.`,
  (p, d, t, pr, sourceLabel, frame) => `${p} resets the ${d} before the next rush: ${t}. ${pr}. The reset makes ${frame.readerMove} visible under pressure.`,
  (p, d, t, pr, sourceLabel, frame) => `${p}'s teammate suggests the minimum required move for ${t}. ${pr}. ${p} protects the person receiving the work.`,
  (p, d, t, pr, sourceLabel, frame) => `${sourceLabel} helps ${p} see the ${d} blind spot around ${t}. ${pr}. The improvement gets quieter and more attentive.`,
  (p, d, t, pr, sourceLabel, frame) => `${p} studies one ${d} exchange involving ${t}. ${pr}. The fair test is whether the receiver left feeling ${frame.desiredFeeling}.`,
];

const actionTemplates = [
  (p, frame) => `${p} should use ${frame.short} to name the intended feeling, alter one controllable step, and check the receiver's response.`,
  (p, frame) => `${p} should choose a ${frame.short} behavior that supports ${frame.desiredFeeling} and give one teammate ownership.`,
  (p, frame) => `${p} should ask what ${frame.desiredFeeling} would require, then remove the smallest process obstacle.`,
  (p, frame) => `${p} should keep the standard intact and add one ${frame.short} permission for a personal response.`,
  (p, frame) => `${p} should compare completion with impact, then repair the part that failed the receiver.`,
  (p, frame) => `${p} should turn this ${frame.short} moment into a huddle question and inspect the next attempt.`,
  (p, frame) => `${p} should define the human outcome before approving any shortcut that would erase judgment.`,
  (p, frame) => `${p} should put the receiver's perspective first in the coaching note and make the next step concrete.`,
  (p, frame) => `${p} should protect one act of judgment so policy does not flatten the moment.`,
  (p, frame) => `${p} should compare the finished step with ${frame.desiredFeeling} and coach the difference.`,
  (p, frame) => `${p} should name the old habit, trade it for a visible behavior, and follow up quickly.`,
  (p, frame) => `${p} should ask for evidence that ${frame.desiredFeeling} was actually felt, not merely intended.`,
  (p, frame) => `${p} should skip the grand gesture and fix the ordinary touchpoint that shapes memory.`,
  (p, frame) => `${p} should choose the option that preserves dignity, even when it requires extra judgment.`,
  (p, frame) => `${p} should write ${frame.desiredFeeling} into the shift note and connect it to one owner.`,
  (p, frame) => `${p} should use procedure as the floor, then add the human adjustment the situation deserves.`,
  (p, frame) => `${p} should connect the reset to ${frame.readerMove} so the behavior survives pressure.`,
  (p, frame) => `${p} should pause the required step long enough to protect the person receiving it.`,
  (p, frame) => `${p} should make the improvement more attentive to ${frame.desiredFeeling}, not more theatrical.`,
  (p, frame) => `${p} should review the exchange through the receiver's memory rather than the team's effort.`,
];

const whyTemplates = [
  (frame) => `${frame.short} fails when ${frame.wrongHabit}; the process may look tidy while the experience fades.`,
  (frame) => `${frame.short} becomes useful only when the source case changes a local decision.`,
  (frame) => `${frame.short} protects the differentiating feeling when pressure makes speed attractive.`,
  (frame) => `${frame.short} is not bigger spending; it is clearer intent in work already underway.`,
  (frame) => `${frame.short} closes the gap between a completed checklist and a person who still feels missed.`,
  (frame) => `${frame.short} gets repeatable when a huddle turns it into an inspectable practice.`,
  (frame) => `${frame.short} improves the moment because the team catches emotional risk early.`,
  (frame) => `${frame.short} travels only when it respects the constraints of the current room.`,
  (frame) => `${frame.short} needs ownership because vague warmth disappears when the day gets busy.`,
  (frame) => `${frame.short} sharpens coaching by comparing the finished task with the human result.`,
  (frame) => `${frame.short} names the old habit before comfort is mistaken for care.`,
  (frame) => `${frame.short} has to be explicit or the team will optimize only what the dashboard can see.`,
  (frame) => `${frame.short} often lives in the ordinary touchpoint where people decide how they were treated.`,
  (frame) => `${frame.short} protects dignity through small choices made before the process hardens.`,
  (frame) => `${frame.short} turns a shift note into an expectation instead of a private intention.`,
  (frame) => `${frame.short} keeps procedure as control while judgment makes the control humane.`,
  (frame) => `${frame.short} works better as a practiced reset than as a speech about standards.`,
  (frame) => `${frame.short} respects the required step while improving the manner of delivery.`,
  (frame) => `${frame.short} values attention over theater when the need is specific and close at hand.`,
  (frame) => `${frame.short} passes the fairest test when the receiver remembers the effort as care.`,
];

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function sentence(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) return "";
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function clipWords(text, maxWords = 18) {
  const words = cleanText(text).split(/\s+/);
  let kept = words.length > maxWords ? words.slice(0, maxWords) : words;
  while (
    kept.length > 8 &&
    /^(the|a|an|and|or|but|to|of|in|on|at|as|for|with|while|because|that|is|are|was|were|be|being|been)$/i.test(kept.at(-1))
  ) {
    kept = kept.slice(0, -1);
  }
  const clipped = words.length > maxWords ? `${kept.join(" ")}.` : kept.join(" ");
  return sentence(clipped);
}

function lowerFirst(text) {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function upperFirst(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function habitClause(frame) {
  return `to ${frame.wrongHabit}`;
}

const chapterOpeners = [
  "treats the central idea as a daily operating choice rather than a mood",
  "shows how the belief becomes visible in ordinary work",
  "moves the lesson from inspiration into management practice",
  "turns a warm-sounding principle into a standard a team can use",
  "puts the idea under operational pressure, where it has to earn trust",
  "asks leaders to translate the story into behavior instead of admiration",
  "makes the principle concrete enough to coach",
  "places the lesson inside the choices a busy team actually makes",
  "shows that values matter only when they change the work",
  "turns the source material into a leadership habit with an owner",
  "frames excellence as something a team must be able to sustain",
  "makes feedback useful by matching the standard to the person",
  "treats recognition as a way to teach the culture what matters",
  "puts recovery and composure inside the definition of high standards",
  "presents hospitality as a proactive design choice, not a repair desk",
  "shows why ease has to be earned by visible competence",
  "recasts generosity as a conversation with the person receiving it",
  "shows how preparation can make improvisation repeatable",
  "asks culture to travel through principles rather than copied rituals",
  "uses subtraction to reveal the experience the team actually means",
];

const firstCaseVerbs = [
  "is the first pressure test",
  "anchors the idea in a lived moment",
  "gives the idea its opening proof",
  "supplies the first concrete case",
  "shows the principle before it becomes a rule",
  "puts a human scene under the concept",
  "makes the lesson specific",
  "starts the argument in practice",
  "gives the team a scene to learn from",
  "moves the concept out of abstraction",
  "shows what is at stake",
  "turns the claim into a conversation",
  "gives the lesson emotional evidence",
  "marks the point where pressure becomes visible",
  "shows the choice before the strategy is named",
  "gives the idea its paradox",
  "returns ambition to a personal moment",
  "shows noticing before action",
  "tests whether the culture can travel",
  "reveals the cost of too much cleverness",
];

const secondCaseVerbs = [
  "adds a second angle",
  "sharpens the operating lesson",
  "shows the next practical consequence",
  "gives the reader another way to see it",
  "carries the lesson into a different kind of decision",
  "makes the partnership visible",
  "turns the standard into a repeatable rhythm",
  "shows why the old rulebook was not enough",
  "connects language to daily behavior",
  "shows ownership becoming real",
  "adds the ritual that makes pressure survivable",
  "shows how the language has to be adapted",
  "makes praise specific enough to travel",
  "turns the pause into a team norm",
  "shows offense taking material shape",
  "explains why informality follows earned trust",
  "keeps the ambition from becoming a monologue",
  "shows the system behind the spontaneous moment",
  "reveals the leadership repair required",
  "shows how refinement changes the guest's attention",
];

const transferLines = [
  (source, frame, first) =>
    `For a reader, the portable move is to ${frame.readerMove}. That keeps ${frame.short} out of slogan territory and helps a person leave feeling ${frame.desiredFeeling}. The useful lesson behind ${first} is the human need it exposes, not the restaurant detail itself.`,
  (source, frame, first) =>
    `Outside the original setting, the work is to ${frame.readerMove}. A leader should carry forward the need revealed by ${first} and redesign the local process until the receiver feels ${frame.desiredFeeling}.`,
  (source, frame, first) =>
    `The reader does not need to reproduce ${first}. The reader needs the discipline underneath it: ${frame.readerMove}, then check whether the person felt ${frame.desiredFeeling}.`,
  (source, frame, first) =>
    `In another industry, this becomes a practical test of ${frame.short}: can the team ${frame.readerMove} while the room is under pressure and still leave the receiver feeling ${frame.desiredFeeling}?`,
  (source, frame, first) =>
    `The transferable part is not the scenery around ${first}; it is the operating judgment. Name the human outcome, make the smallest useful change, and see whether the person feels ${frame.desiredFeeling}.`,
  (source, frame, first) =>
    `A team applies the lesson when it stops admiring ${first} from a distance and starts asking how to ${frame.readerMove} in its own work.`,
  (source, frame, first) =>
    `The practical assignment is modest and demanding at once: use the lesson behind ${first} to make one local exchange feel ${frame.desiredFeeling}.`,
  (source, frame, first) =>
    `The lesson becomes portable when the leader copies the need, not the scene. In practice, that means learning to ${frame.readerMove}.`,
  (source, frame, first) =>
    `${proseTitle(source)} is less a story to quote than a standard to test: did the team's process help someone feel ${frame.desiredFeeling}?`,
  (source, frame, first) =>
    `The source case matters because it trains attention. Once the team sees the need, it can ${frame.readerMove} without pretending to be Eleven Madison Park.`,
  (source, frame, first) =>
    `The lesson travels when ambition is paired with regulation: ${frame.readerMove}, especially when pressure would make the old habit easier.`,
  (source, frame, first) =>
    `A reader practices the lesson by adapting the language and the standard to the person present, then making sure the correction leaves them feeling ${frame.desiredFeeling}.`,
  (source, frame, first) =>
    `The useful move is to make the invisible contribution visible. Carry the spirit of ${first} into a specific behavior that leaves someone feeling ${frame.desiredFeeling}.`,
  (source, frame, first) =>
    `The lesson is portable because every team has moments where speed can swallow judgment. The remedy is to ${frame.readerMove}.`,
  (source, frame, first) =>
    `A leader applies the idea before trouble arrives: design one proactive moment so the receiver feels ${frame.desiredFeeling}.`,
  (source, frame, first) =>
    `The standard is earned ease. Bring forward the trust behind ${first}, then let the interaction feel more human without lowering the bar.`,
  (source, frame, first) =>
    `A leader should listen before designing the gesture. The result should feel ${frame.desiredFeeling}, not performed from a script.`,
  (source, frame, first) =>
    `The system is the point: prepare the team to notice and act so a small opportunity can become care that feels ${frame.desiredFeeling}.`,
  (source, frame, first) =>
    `Scaling the lesson means giving local leaders enough principle and enough authority to make the new room feel ${frame.desiredFeeling}.`,
  (source, frame, first) =>
    `The final move is restraint. Carry forward the purpose behind ${first}, then remove whatever keeps the experience from feeling ${frame.desiredFeeling}.`,
];

const planTemplates = [
  (source, frame, sourceA, sourceB) => ({
    title: `${source.chapterTitle} Practice`,
    coreSkill: `Practice ${frame.short} by doing one concrete thing: ${frame.readerMove}. The standard is whether it helps the receiver feel ${frame.desiredFeeling}.`,
    ifThenPlans: [
      {
        context: `The task is complete but the exchange still feels thin.`,
        plan: `If the service works on paper, then name the feeling it should create and adjust one step before repeating it.`,
      },
      {
        context: `Someone wants to copy ${sourceA} literally.`,
        plan: `If the team copies the surface detail, then pause and identify the human need the story addressed.`,
      },
      {
        context: `Pressure revives the old habit: ${frame.wrongHabit}.`,
        plan: `If the old habit returns, then protect one small behavior that keeps the receiver's experience visible.`,
      },
      {
        context: `${sourceB} inspires a new idea.`,
        plan: `If the idea feels exciting, then ask whether it will make the person feel ${frame.desiredFeeling} or merely make the team feel clever.`,
      },
    ],
    twentyFourHourChallenge: `Choose one real interaction and write down the intended feeling before it begins. Afterward, note which action helped or hurt that feeling.`,
    weeklyPractice: `Review three exchanges through ${frame.short}: one that worked, one that missed, and one that could improve with a smaller, sharper change.`,
  }),
  (source, frame, sourceA, sourceB) => ({
    title: `${source.chapterTitle} Field Drill`,
    coreSkill: `Use ${frame.short} to connect a human outcome to an operating choice. Start with the feeling, then change the process only as much as the feeling requires.`,
    ifThenPlans: [
      {
        context: `The team debates the tactic before naming the receiver's need.`,
        plan: `If the room jumps to tactics, then bring it back to the desired feeling: ${frame.desiredFeeling}.`,
      },
      {
        context: `${sourceA} becomes a story people admire but do not use.`,
        plan: `If the case stays inspirational, then ask each person to name one behavior it would change in their own work.`,
      },
      {
        context: `The familiar shortcut is ${frame.wrongHabit}.`,
        plan: `If that shortcut appears, then slow the decision long enough to choose the receiver's experience deliberately.`,
      },
      {
        context: `${sourceB} suggests a bigger gesture than the moment needs.`,
        plan: `If the gesture gets too theatrical, then make it smaller, clearer, and more personal.`,
      },
    ],
    twentyFourHourChallenge: `Find one routine exchange and add a receiver-focused question before closing it.`,
    weeklyPractice: `At week's end, choose one interaction and rewrite it as a standard the team could repeat without losing its warmth.`,
  }),
  (source, frame, sourceA, sourceB) => ({
    title: `${source.chapterTitle} Operating Habit`,
    coreSkill: `Turn the idea into a habit by asking who should feel what, who owns the change, and how the team will know it worked.`,
    ifThenPlans: [
      {
        context: `A metric says the work is fine but the room tells a different story.`,
        plan: `If the metric and the felt experience diverge, then investigate the feeling before defending the process.`,
      },
      {
        context: `${sourceA} is used as a slogan.`,
        plan: `If the source case becomes a slogan, then translate it into a behavior with an owner and a deadline.`,
      },
      {
        context: `The team drifts toward ${frame.wrongHabit}.`,
        plan: `If drift appears, then restate the intended feeling and remove one barrier to acting on it.`,
      },
      {
        context: `${sourceB} raises the ambition of the room.`,
        plan: `If ambition rises, then pair it with a simple inspection: did the receiver feel ${frame.desiredFeeling}?`,
      },
    ],
    twentyFourHourChallenge: `Put one receiver's desired feeling on the agenda before discussing cost, timing, or ownership.`,
    weeklyPractice: `Ask the team for one example where the lesson changed a decision, not just a conversation.`,
  }),
];

function cleanConceptName(name) {
  return String(name || "")
    .replace(/\s*\(([^)]*)\)/g, "")
    .replace(/\bvs\.\b/g, "versus")
    .trim();
}

function proseTitle(source) {
  return String(source.chapterTitle || "").replace(/\./g, "");
}

function cleanText(text) {
  return String(text || "")
    .replace(/[—–]/g, ",")
    .replace(/\bRather than\b/g, "Instead of")
    .replace(/\brather than\b/g, "instead of")
    .replace(/\bInstead of accept that\b/g, "Instead of accepting that")
    .replace(/\binstead of accept that\b/g, "instead of accepting that")
    .replace(/\bvs\./gi, "versus")
    .replace(/\ba\.m\./gi, "am")
    .replace(/\bp\.m\./gi, "pm")
    .replace(/\bsets [^.]* in motion\./g, "")
    .replace(/\bnames prep for [^.]*\./g, "")
    .replace(/\btravels through [^.]*\./g, "")
    .replace(/\bcloses on [^.]*\./g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeGeneratedStrings(value) {
  if (typeof value === "string") {
    return value
      .replace(/\bRather than\b/g, "Instead of")
      .replace(/\brather than\b/g, "instead of");
  }
  if (Array.isArray(value)) return value.map((item) => normalizeGeneratedStrings(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, normalizeGeneratedStrings(entry)]),
    );
  }
  return value;
}

function sanitizeExampleText(text) {
  return cleanText(text)
    .replace(/\bEleven Madison Park\b/gi, "EMP")
    .replace(/\bWill Guidara and chef-partner Daniel Humm\b/g, "the operator and chef-partner")
    .replace(/\bchef-partner Daniel Humm\b/g, "chef-partner")
    .replace(/\bWill Guidara\b/g, "the operator")
    .replace(/\bDaniel Humm\b/g, "the chef-partner")
    .replace(/\bDaniel\b/g, "the chef")
    .replace(/\bHumm\b/g, "the chef-partner")
    .replace(/\bNew York\b/g, "city")
    .replace(/\bWorld's 50 Best Restaurants\b/gi, "global restaurant list")
    .replace(/\bWorld\b/g, "world")
    .replace(/\bBest\b/g, "best")
    .replace(/\bThe Deep Breathing Club\b/gi, "the breathing reset ritual")
    .replace(/\bDeep Breathing Club\b/gi, "breathing reset ritual");
}

function buildBreakdown(source, frame) {
  const concept = cleanConceptName(source.centralConcept.name);
  const examples = source.namedExamples || [];
  const first = examples[0];
  const second = examples[1] || examples[0];
  const index = source.chapterNumber - 1;
  const title = proseTitle(source);
  const sourceLabel = first ? first.label : source.chapterTitle;
  const fastRead = [
    `${sentence(source.coreClaim)}`,
    `${sentence(frame.takeaway)}`,
    first
      ? `${first.label} gives the short version of the stakes: the team has to turn a real pressure point into a better way of working.`
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  const deepRead = [
    `${title} ${chapterOpeners[index]}. ${sentence(source.centralConcept.plainDefinition)}`,
    first
      ? `${first.label} ${firstCaseVerbs[index]}. ${sentence(first.summary)} ${sentence(first.teachesWhat)}`
      : "",
    second && second !== first
      ? `${second.label} ${secondCaseVerbs[index]}. ${sentence(second.summary)} ${sentence(second.teachesWhat)}`
      : "",
    `${sentence(source.centralConcept.whyItMatters)}`,
    `${sentence(frame.counter)}`,
  ]
    .filter(Boolean)
    .join(" ");

  const fullParts = [
    `${sentence(source.hardEdge)}`,
    `${sentence(source.paraphraseNotes)}`,
    transferLines[index](source, frame, sourceLabel),
  ].filter(Boolean);
  let fullRead = fullParts.join(" ");
  if (fullRead.length < 2600) {
    fullRead += ` In practice, the boundary is just as important as the inspiration. A leader should not turn ${frame.short} into decoration, extra speeches, or a heroic one-off. The useful test is whether a normal team, on a normal day, can ${frame.readerMove} without losing its standards. If the answer is no, the idea is still too vague. If the answer is yes, the lesson has become part of the operating system.`;
  }

  return {
    fastRead: cleanText(fastRead),
    deepRead: cleanText(deepRead),
    fullRead: cleanText(fullRead),
  };
}

function buildExamples(source, frame) {
  const examples = source.namedExamples || [];
  return Array.from({ length: 6 }, (_, index) => {
    const globalIndex = (source.chapterNumber - 1) * 6 + index;
    const person = availablePeople[globalIndex % availablePeople.length];
    const named = examples[index % Math.max(1, examples.length)] || {
      label: source.chapterTitle,
      summary: source.paraphraseNotes,
      teachesWhat: source.coreClaim,
    };
    const claim = source.keyClaims?.[index % Math.max(1, source.keyClaims.length)] || source.coreClaim;
    const label = String(named.label)
      .replace(/\bThe Deep Breathing Club\b/g, "the breathing reset ritual")
      .replace(/\bDeep Breathing Club\b/g, "breathing reset ritual");
    const summary = sentence(named.summary)
      .replace(/\bThe Deep Breathing Club\b/g, "the breathing reset ritual")
      .replace(/\bDeep Breathing Club\b/g, "breathing reset ritual");
    const teaches = sentence(named.teachesWhat || claim)
      .replace(/\bThe Deep Breathing Club\b/g, "the breathing reset ritual")
      .replace(/\bDeep Breathing Club\b/g, "breathing reset ritual");
    const detailOptions = [
      summary,
      teaches,
      sentence(claim),
      sentence(source.centralConcept.whyItMatters),
      sentence(source.hardEdge),
      sentence(source.paraphraseNotes).split(/(?<=[.!?])\s+/)[0] || sentence(claim),
    ].map((text) => sanitizeExampleText(text));
    const detail = detailOptions[index];
    const titleOptions = [
      `Source Moment ${source.chapterNumber}.${index + 1}`,
      `Second Angle ${source.chapterNumber}.${index + 1}`,
      `Practice Claim ${source.chapterNumber}.${index + 1}`,
      `Why It Matters ${source.chapterNumber}.${index + 1}`,
      `Hard Edge ${source.chapterNumber}.${index + 1}`,
      `Transfer Practice ${source.chapterNumber}.${index + 1}`,
    ];
    const sceneLabel = lowerFirst(index < examples.length ? label : titleOptions[index]);
    const actionDetails = [
      frame.readerMove,
      cleanText(claim),
      cleanText(teaches),
      cleanText(source.centralConcept.whyItMatters),
      cleanText(source.hardEdge),
      cleanText(frame.takeaway),
    ];
    const whyDetails = [
      sanitizeExampleText(source.centralConcept.whyItMatters),
      sanitizeExampleText(source.hardEdge),
      sanitizeExampleText(claim),
      sanitizeExampleText(teaches),
      sanitizeExampleText(frame.counter),
      sanitizeExampleText(frame.takeaway),
    ];
    const scenario = sentence(cleanText(
      `${person} studies ${sanitizeExampleText(sceneLabel)}. ${detail} ${sanitizeExampleText(sentence(claim))}`,
    ));
    return {
      exampleId: `ex${String(index + 1).padStart(2, "0")}`,
      title: upperFirst(titleOptions[index].replace(/\bEleven Madison Park\b/g, "EMP").slice(0, 72)),
      tags: [frame.short, "source case", workplaces[index].format],
      planSpec: {
        domain: "source case transfer",
        audience: "leaders applying the source case",
        stakes: sanitizeExampleText(claim).slice(0, 180),
        format: workplaces[index].format,
        requiredBeat: `Apply ${frame.short} through source case ${source.chapterNumber}.${index + 1} without copying a gesture.`,
      },
      scenario,
      whatToDo: `${person} should act on ${sanitizeExampleText(label)}: ${sentence(sanitizeExampleText(actionDetails[index]))}`,
      whyItMatters: sentence(whyDetails[index]),
    };
  });
}

function orderedChoices(correct, wrongA, wrongB, index, chapterNumber) {
  const orders = [
    [correct, wrongA, wrongB],
    [wrongA, correct, wrongB],
    [wrongB, wrongA, correct],
  ];
  const order = orders[(index + chapterNumber) % 3];
  return {
    choices: order,
    correctIndex: order.indexOf(correct),
  };
}

function buildQuiz(source, frame) {
  const concept = cleanConceptName(source.centralConcept.name);
  const chapterNumber = source.chapterNumber;
  const examples = source.namedExamples || [];
  const claims = source.keyClaims?.length ? source.keyClaims : [source.coreClaim];
  const sceneA = `Source case ${chapterNumber}.1`;
  const sceneB = `Source case ${chapterNumber}.2`;
  const caseLine = (index) => `case ${chapterNumber}.${index + 1}`;
  const shortClaim = (index, max = 14) => clipWords(claims[index % claims.length] || source.coreClaim, max);
  const feeling = (index) => [
    frame.desiredFeeling,
    `the intended ${frame.short} feeling`,
    `the ${frame.short} human result`,
    `the ${frame.short} receiver need`,
    `the ${frame.short} felt outcome`,
    `the ${frame.short} care signal`,
    `the ${frame.short} person experience`,
    `the ${frame.short} actual response`,
    frame.desiredFeeling,
  ][index];
  const badHabit = (index) => [
    frame.wrongHabit,
    `the old ${frame.short} habit`,
    `the weak ${frame.short} habit`,
    `the comfortable ${frame.short} shortcut`,
    `the familiar ${frame.short} drift`,
    `the easy ${frame.short} dodge`,
    `the speed-first ${frame.short} reflex`,
    `the unexamined ${frame.short} routine`,
    frame.wrongHabit,
  ][index];
  const lesson = (index) => sanitizeExampleText(
    examples[index % Math.max(1, examples.length)]?.teachesWhat ||
      claims[index % claims.length] ||
      source.coreClaim,
  );
  const positionSequences = [
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
    [0, 1, 2, 0, 2, 1, 2, 1, 0],
    [1, 2, 0, 1, 0, 2, 0, 2, 1],
    [2, 0, 1, 2, 1, 0, 1, 0, 2],
    [0, 2, 1, 0, 1, 2, 1, 2, 0],
    [1, 0, 2, 1, 2, 0, 2, 0, 1],
    [2, 1, 0, 2, 0, 1, 0, 1, 2],
    [0, 1, 2, 1, 0, 2, 2, 1, 0],
    [1, 2, 0, 2, 1, 0, 0, 2, 1],
  ];
  const sequence = positionSequences[chapterNumber - 1];
  const orderChoices = (correct, wrongA, wrongB, index) => {
    const correctIndex = sequence[index];
    const choices = [wrongA, wrongB];
    choices.splice(correctIndex, 0, correct);
    return { choices: choices.map((choice) => upperFirst(cleanText(sentence(choice)))), correctIndex };
  };
  const items = [
    {
      prompt: `${shortClaim(0, 30)} ${frame.tryNow} Which priority follows?`,
      correct: `Apply ${frame.short}: next step should create ${feeling(0)}.`,
      wrongA: `${upperFirst(frame.short)} metric lens blurs ${frame.short} intention.`,
      wrongB: `${sceneA} turns theatrical under ${badHabit(0)}.`,
      explanation: `${sceneA}: ${shortClaim(0, 30)} ${frame.tryNow}`,
      bloomsLevel: "understand",
      depthLevel: "standard",
    },
    {
      prompt: `${clipWords(lesson(1), 18)} Which transfer fits ${frame.short}?`,
      correct: `Act from ${sceneB} toward a visible ${frame.short} behavior.`,
      wrongA: `${upperFirst(badHabit(1))} retells ${sceneB}.`,
      wrongB: `${shortClaim(2, 14)} Admiration replaces application.`,
      explanation: `${sceneB}: ${clipWords(lesson(1), 17)} Transfer needs ${frame.short} ownership.`,
      bloomsLevel: "analyze",
      depthLevel: "standard",
    },
    {
      prompt: `${shortClaim(2, 18)} ${clipWords(source.hardEdge, 14)} Which repair fits ${caseLine(2)}?`,
      correct: `Inspect the ${frame.short} service step; shape ${feeling(4)}.`,
      wrongA: `${upperFirst(badHabit(2))} makes ${frame.short} a checklist proof.`,
      wrongB: `${shortClaim(3, 13)} Flourish first; standard later.`,
      explanation: `${shortClaim(1, 18)} ${upperFirst(frame.short)} result must be visible.`,
      bloomsLevel: "apply",
      depthLevel: "standard",
    },
    {
      prompt: `${shortClaim(3, 18)} How should ${frame.short} travel from ${sceneA}?`,
      correct: `Change around ${feeling(5)}; tactic adapts.`,
      wrongA: `${sceneA} copied; ${frame.short} constraint ignored.`,
      wrongB: `${badHabit(3)} survives when ${frame.short} celebrates team excitement.`,
      explanation: `${shortClaim(3, 18)} The tactic can change.`,
      bloomsLevel: "apply",
      depthLevel: "deep",
    },
    {
      prompt: `${clipWords(frame.counter, 18)} Which correction fits ${caseLine(4)}?`,
      correct: `Choose the ${frame.short} fix after ${feeling(1)}.`,
      wrongA: `${upperFirst(badHabit(4))}; familiar process wins.`,
      wrongB: `${shortClaim(4, 13)} Put novelty before ${frame.short}.`,
      explanation: `${badHabit(5)} conflicts with ${frame.short}: ${clipWords(frame.takeaway, 12)}`,
      bloomsLevel: "evaluate",
      depthLevel: "standard",
    },
    {
      prompt: `${clipWords(source.paraphraseNotes, 18)} Which huddle question works?`,
      correct: `Ask who owns ${frame.short}'s next step for ${feeling(5)}.`,
      wrongA: `${upperFirst(frame.short)} showmanship erases the receiver.`,
      wrongB: `${shortClaim(5, 13)} Rule check, no judgment.`,
      explanation: `${clipWords(source.paraphraseNotes, 18)} ${frame.tryNow}`,
      bloomsLevel: "create",
      depthLevel: "deep",
    },
    {
      prompt: `${shortClaim(4, 18)} For ${frame.short}, name the pressure cue.`,
      correct: `${upperFirst(frame.short)} keeps constraints and ${feeling(6)} visible.`,
      wrongA: `Bad ${frame.short}: pace wins.`,
      wrongB: `${sceneB} gets retold; ${frame.short} process stays unchanged.`,
      explanation: `${clipWords(source.hardEdge, 18)} ${frame.counter}`,
      bloomsLevel: "analyze",
      depthLevel: "deep",
    },
    {
      prompt: `${clipWords(source.centralConcept.whyItMatters, 18)} What evidence matters?`,
      correct: `Proof for ${frame.short}: receiver words show impact.`,
      wrongA: `${upperFirst(frame.short)} becomes effort accounting.`,
      wrongB: `${sceneB} repeats without ${frame.short} local action.`,
      explanation: `${clipWords(source.centralConcept.whyItMatters, 18)} ${frame.desiredFeeling}.`,
      bloomsLevel: "evaluate",
      depthLevel: "standard",
    },
    {
      prompt: `${clipWords(source.centralConcept.plainDefinition, 18)} Which summary fits ${frame.short}?`,
      correct: frame.takeaway,
      wrongA: `${upperFirst(badHabit(7))}; ${frame.short} turns into storytelling.`,
      wrongB: `${shortClaim(6, 14)} Product first, warmth later.`,
      explanation: `${frame.takeaway} ${frame.tryNow}`,
      bloomsLevel: "understand",
      depthLevel: "standard",
    },
  ];
  return {
    passingScorePercent: 70,
    questions: items.map((item, index) => {
      const { choices, correctIndex } = orderChoices(item.correct, item.wrongA, item.wrongB, index);
      return {
        questionId: `q${String(index + 1).padStart(2, "0")}`,
        prompt: cleanText(item.prompt),
        choices,
        correctIndex,
        explanation: cleanText(item.explanation),
        bloomsLevel: item.bloomsLevel,
        depthLevel: item.depthLevel,
      };
    }),
  };
}

function buildReviewCards(source, frame) {
  const concept = cleanConceptName(source.centralConcept.name);
  const title = proseTitle(source);
  const examples = source.namedExamples || [];
  const sourceA = examples[0]?.label || source.chapterTitle;
  const sourceB = examples[1]?.label || sourceA;
  const cards = [
    {
      front: `What does ${concept} require beyond completing the service step?`,
      back: `It requires deciding what the person should feel and changing the work so that feeling is more likely.`,
      difficulty: "easy",
    },
    {
      front: `What does ${sourceA} teach a leader to notice?`,
      back: `It shows where the current approach is no longer enough and where a more human operating choice is needed.`,
      difficulty: "medium",
    },
    {
      front: `Why can ${sourceB} travel to another industry?`,
      back: `The surface detail may be local, but the leadership move is portable: understand the person, name the intended feeling, and make a concrete change.`,
      difficulty: "medium",
    },
    {
      front: `What is the common failure mode for ${frame.short}?`,
      back: `${sentence(frame.wrongHabit)} That habit leaves the team with completed tasks but a weaker human experience.`,
      difficulty: "hard",
    },
    {
      front: `How should a manager coach the idea in one question?`,
      back: `Ask: "What should the receiver feel, and what part of our process makes that feeling more likely?"`,
      difficulty: "medium",
    },
    {
      front: `When does ${title} become practical rather than merely inspirational?`,
      back: `It becomes practical when the team turns the lesson into a visible behavior, assigns ownership, and checks whether the receiver actually felt the intended care.`,
      difficulty: "hard",
    },
  ];
  return cards.map((card, index) => ({
    cardId: `card${String(index + 1).padStart(2, "0")}`,
    ...card,
  }));
}

function buildImplementationPlan(source, frame) {
  const examples = source.namedExamples || [];
  const sourceA = examples[0]?.label || source.chapterTitle;
  const sourceB = examples[1]?.label || sourceA;
  return planTemplates[(source.chapterNumber - 1) % planTemplates.length](
    source,
    frame,
    sourceA,
    sourceB,
  );
}

function buildMemorableLines(source, frame, breakdown) {
  const firstFast = breakdown.fastRead.split(/(?<=[.!?])\s+/)[0];
  const firstFull = breakdown.fullRead.split(/(?<=[.!?])\s+/)[0];
  return [
    {
      text: frame.takeaway,
      location: "keyTakeaway",
      why: "It states the lesson in operational language.",
    },
    {
      text: firstFast,
      location: "breakdown.fastRead",
      why: "It gives the short version of the claim.",
    },
    {
      text: firstFull,
      location: "breakdown.fullRead",
      why: "It explains how to transfer the source case without copying the surface detail.",
    },
  ];
}

for (let number = 1; number <= 20; number += 1) {
  const id = String(number).padStart(2, "0");
  const sourcePath = path.join(sourceDir, `ch${id}.source.json`);
  const chapterPath = path.join(
    chapterDir,
    `unreasonable-hospitality-ch${id}.v21-native.chapter.json`,
  );
  const source = readJson(sourcePath);
  const chapter = readJson(chapterPath);
  const frame = frames[number];
  if (!frame) throw new Error(`Missing authored frame for chapter ${id}`);
  const breakdown = buildBreakdown(source, frame);

  chapter.title = source.chapterTitle;
  chapter.counterintuition = frame.counter;
  chapter.tryThisNow = frame.tryNow;
  chapter.keyTakeaway = frame.takeaway;
  chapter.breakdown = breakdown;
  chapter.examples = buildExamples(source, frame);
  chapter.quiz = buildQuiz(source, frame);
  chapter.reviewCards = buildReviewCards(source, frame);
  chapter.implementationPlan = buildImplementationPlan(source, frame);
  chapter.memorableLines = buildMemorableLines(source, frame, breakdown);

  fs.writeFileSync(chapterPath, `${JSON.stringify(normalizeGeneratedStrings(chapter), null, 2)}\n`);
  console.log(`rewrote ch${id}: ${source.chapterTitle}`);
}
