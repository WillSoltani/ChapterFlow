import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = process.cwd();
const RUN_ROOT = path.join(
  ROOT,
  ".chapterflow/runs/the-elephant-in-the-brain/20260410-224024",
);
const VALIDATED_DIR = path.join(RUN_ROOT, "validated");
const RELEASE_PATH = path.join(
  RUN_ROOT,
  "release",
  "the-elephant-in-the-brain.modern.json",
);
const BOOK_PACKAGE_PATH = path.join(
  ROOT,
  "book-packages",
  "the-elephant-in-the-brain.modern.json",
);
const CONTINUITY_PATH = path.join(RUN_ROOT, "continuity", "continuity-state.json");

const CATEGORIES = [
  "Psychology",
  "Behavioral Economics",
  "Evolutionary Psychology",
  "Social Behavior",
  "Human Nature",
];

const TAGS = [
  "signaling",
  "hidden motives",
  "status",
  "self-deception",
  "coalition",
  "competition",
  "norms",
  "display",
  "social incentives",
  "audience effects",
];

const DIALOGUE_SCENARIOS = {
  ch01: {
    gentle:
      "Maya: \"I'll clear the chairs before the VP circles back.\"\nTheo: \"You always find extra energy when he is still nearby.\"\nMaya: \"The room is a mess. Someone has to fix it.\"\nTheo: \"True, but you started when you knew he could see you.\"\nMaya: \"I still wanted the list cleaned up.\"\nTheo: \"I know. I just think the witness mattered too.\"",
    direct:
      "Maya: \"I'll rewrite the action list before he asks for it.\"\nTheo: \"You grabbed the marker right after the VP paused at the door.\"\nMaya: \"Because that is when I saw how sloppy it looked.\"\nTheo: \"And when you knew fixing it would be visible.\"\nMaya: \"The cleanup still helped the team.\"\nTheo: \"Yes. It also improved how the team saw you helping it.\"",
    competitive:
      "Maya: \"Give me a minute. I'll stack these chairs and clean the board.\"\nTheo: \"Funny how the rescue starts once senior eyes are still in range.\"\nMaya: \"The job still needs doing.\"\nTheo: \"Of course. You just picked the highest-value moment to do it.\"\nMaya: \"Help is still help.\"\nTheo: \"And a well-timed help is also reputation work.\"",
  },
  ch02: {
    gentle:
      "Nora: \"I thought she got the promotion because she was the strongest engineer.\"\nCaleb: \"She is strong, but she had been building visible alliances across teams for months.\"\nNora: \"You think that mattered as much as the technical work?\"\nCaleb: \"Look at who spoke up for her before the decision.\"\nNora: \"So it was not just skill.\"\nCaleb: \"Skill counted. Coalition value counted too.\"",
    direct:
      "Nora: \"I read the promotion as a pure performance call.\"\nCaleb: \"Then you missed how much alliance work sat under it.\"\nNora: \"You mean the coffee chats and cross-team favors?\"\nCaleb: \"Yes. Those moves made her feel like a safer political bet.\"\nNora: \"So the literal job and the coalition game ran together.\"\nCaleb: \"That is the cleaner read.\"",
    competitive:
      "Nora: \"Best operator won. End of story.\"\nCaleb: \"Not even close to end of story. She had the broadest coalition in the room.\"\nNora: \"You are saying the title went to the alliance builder.\"\nCaleb: \"I am saying technical skill did not travel alone.\"\nNora: \"So the promotion was two games at once.\"\nCaleb: \"Exactly. Performance got judged inside politics.\"",
  },
  ch03: {
    gentle:
      "Marcus: \"I basically carried that launch.\"\nTalia: \"You carried a big piece of it, but the room is pulling the credit back to the team.\"\nMarcus: \"I was only saying what happened.\"\nTalia: \"You were also testing how much status the room would let you keep.\"\nMarcus: \"So I pushed too hard?\"\nTalia: \"Hard enough that the correction started immediately.\"",
    direct:
      "Marcus: \"The launch probably does not happen without me.\"\nTalia: \"That claim is why the replies suddenly got short and collective.\"\nMarcus: \"People know I did the heavy work.\"\nTalia: \"They also know open status grabs invite punishment.\"\nMarcus: \"So the problem was the display, not the contribution?\"\nTalia: \"The contribution was real. The overclaim triggered the norm response.\"",
    competitive:
      "Marcus: \"I dragged that release across the line.\"\nTalia: \"And the channel is about to drag you back into line.\"\nMarcus: \"For telling the truth?\"\nTalia: \"For telling it in a way that makes the room submit to your ranking.\"\nMarcus: \"So I should shrink the claim.\"\nTalia: \"Shrink the status demand, or the group will do it for you.\"",
  },
  ch04: {
    gentle:
      "Andre: \"He just called that ride a client pickup again.\"\nMaya: \"Everyone heard him, and nobody wanted to challenge it in front of the room.\"\nAndre: \"Do you think they believed the explanation?\"\nMaya: \"Not fully. It was just plausible enough to let them step around the fight.\"\nAndre: \"So the excuse worked because it gave cover.\"\nMaya: \"Exactly. Weak deniability can still be enough when enforcement is costly.\"",
    direct:
      "Andre: \"That was obviously a personal ride.\"\nMaya: \"Yes, but he framed it in language that made confrontation expensive.\"\nAndre: \"So everyone let the wording do the work.\"\nMaya: \"Right. The excuse did not have to be airtight; it only had to create doubt.\"\nAndre: \"And the room preferred that doubt to an open accusation.\"\nMaya: \"That is how deniability protects the act.\"",
    competitive:
      "Andre: \"He stole the ride and wrapped it in client language.\"\nMaya: \"And the room accepted the wrapper because calling him out would have cost more.\"\nAndre: \"So nobody needed to buy it completely.\"\nMaya: \"They only needed enough cover to stay out of enforcement.\"\nAndre: \"That is a cheap shield.\"\nMaya: \"Cheap shields work all the time when the audience wants one.\"",
  },
  ch05: {
    gentle:
      "Janelle: \"I pushed that pitch because it was best for the team.\"\nVictor: \"I believe you meant that.\"\nJanelle: \"Then why do you sound hesitant?\"\nVictor: \"Because the visible win mattered to you too, maybe more than you noticed.\"\nJanelle: \"You think I was performing?\"\nVictor: \"No. I think you were sincere and still drawn to what the spotlight would do for you.\"",
    direct:
      "Janelle: \"My reasons were straightforward. The idea was stronger.\"\nVictor: \"The reasons may be real. They still may not be the whole story.\"\nJanelle: \"What else do you think was active?\"\nVictor: \"The chance to be the face of the win.\"\nJanelle: \"I did not walk in telling myself that.\"\nVictor: \"That is exactly why self-deception belongs in the explanation.\"",
    competitive:
      "Janelle: \"I fought for the pitch because it had the best shot.\"\nVictor: \"And because being attached to the best shot has value of its own.\"\nJanelle: \"You make it sound calculated.\"\nVictor: \"Not calculated. Cleaned up.\"\nJanelle: \"So the ambition was real even if I did not narrate it.\"\nVictor: \"Yes. The motive can drive the move before the story catches up.\"",
  },
  ch06: {
    gentle:
      "Carla: \"I backed option B because it had the cleaner risk profile.\"\nDevin: \"Maybe. You sounded sure before you started listing reasons.\"\nCarla: \"I can still have reasons.\"\nDevin: \"Of course. I am asking whether the reasons arrived after the decision in your head.\"\nCarla: \"That is uncomfortable.\"\nDevin: \"That is why the chapter matters.\"",
    direct:
      "Carla: \"The decision was strategic.\"\nDevin: \"Then why did the explanation come so fast after the vote and so slow before it?\"\nCarla: \"You think I rationalized it.\"\nDevin: \"I think you may be describing the choice after the fact rather than accessing the real process.\"\nCarla: \"So the story can be neat and still incomplete.\"\nDevin: \"Exactly.\"",
    competitive:
      "Carla: \"Option B was the rational call.\"\nDevin: \"Maybe. It also sounded like the rational story you built after you chose it.\"\nCarla: \"That is a sharp accusation.\"\nDevin: \"It is a sharper audit than just admiring the explanation.\"\nCarla: \"So the reasons might be reconstruction, not access.\"\nDevin: \"That is the risk whenever the story arrives cleaner than the choice did.\"",
  },
  ch07: {
    gentle:
      "Riley: \"I said yes. I am on board.\"\nAdrian: \"You did, but your chair slid back the second the work landed on your team.\"\nRiley: \"I was just adjusting.\"\nAdrian: \"Maybe. Your shoulders tightened too.\"\nRiley: \"So you think I was resisting?\"\nAdrian: \"I think your body showed strain before your words admitted it.\"",
    direct:
      "Riley: \"There is no issue. I agreed.\"\nAdrian: \"Then explain why your posture changed as soon as the assignment became yours.\"\nRiley: \"People shift in chairs.\"\nAdrian: \"Not usually with that much retreat in one motion.\"\nRiley: \"So the signal came from the body first.\"\nAdrian: \"Yes. The literal words and the visible read split apart.\"",
    competitive:
      "Riley: \"You heard me say yes.\"\nAdrian: \"I did. I also watched your body say not happily.\"\nRiley: \"That feels unfair.\"\nAdrian: \"It is just a fuller read.\"\nRiley: \"So the room would trust the flinch over the sentence?\"\nAdrian: \"Often. Bodies leak stakes faster than polished language does.\"",
  },
  ch08: {
    gentle:
      "Emma: \"Heroically optimistic, Tyler.\"\nTyler: \"You are laughing, but are you saying the timeline is impossible?\"\nEmma: \"I am saying it without making the room freeze.\"\nTyler: \"The room already froze.\"\nEmma: \"That is why I tucked it inside the joke.\"\nTyler: \"So the laugh softened the hit, but the hit was still real.\"",
    direct:
      "Emma: \"That deadline is a comedy routine, Tyler.\"\nTyler: \"Is this a joke or a challenge?\"\nEmma: \"Both. The joke gets the criticism into the room.\"\nTyler: \"And gives you cover if it lands badly.\"\nEmma: \"Exactly. I can press without saying I am pressing.\"\nTyler: \"Then the laughter is part of the mechanism, not decoration.\"",
    competitive:
      "Emma: \"Sure, we can deliver that by Friday if physics takes the week off.\"\nTyler: \"You made everyone laugh, but you also undercut the plan.\"\nEmma: \"That was the point.\"\nTyler: \"Because the laugh lets you test the attack safely.\"\nEmma: \"And lets the room agree without calling it a fight.\"\nTyler: \"So the joke carries deniable aggression.\"",
  },
  ch09: {
    gentle:
      "Nina: \"The decision is already settled. Why are you still talking it through?\"\nMarcus: \"Because the room is finally alive.\"\nNina: \"So this is not just about the agenda anymore?\"\nMarcus: \"Not only. It is also about showing I can keep the conversation moving.\"\nNina: \"And people reward that?\"\nMarcus: \"Watch who they keep turning toward.\"",
    direct:
      "Nina: \"You could have ended this ten minutes ago.\"\nMarcus: \"I could have. I also would have lost the chance to display fluency.\"\nNina: \"So the extra talk is doing status work.\"\nMarcus: \"Partly. Conversation is not just information transfer here.\"\nNina: \"It is also performance.\"\nMarcus: \"Exactly.\"",
    competitive:
      "Nina: \"We solved it. Why are you still running the room?\"\nMarcus: \"Because once the room warms up, airtime becomes valuable.\"\nNina: \"So the talk is not only about content.\"\nMarcus: \"No. It is also about who looks quick, interesting, and easy to follow.\"\nNina: \"Conversation as display.\"\nMarcus: \"That is the live version.\"",
  },
  ch10: {
    gentle:
      "Clara: \"It is just a bag. It carries the same laptop as the old one.\"\nDean: \"Then why did everyone start talking about how polished you look?\"\nClara: \"People read more into things than they should.\"\nDean: \"Maybe, but you knew this one would say organized before you zipped it.\"\nClara: \"I wanted it to work and look right.\"\nDean: \"That is why consumption keeps sliding from function into display.\"",
    direct:
      "Clara: \"The old bag still worked fine.\"\nDean: \"But the new one sends a cleaner signal.\"\nClara: \"You make it sound manipulative.\"\nDean: \"Not manipulative. Socially legible.\"\nClara: \"So the purchase solves a practical need and a reputational one.\"\nDean: \"Exactly.\"",
    competitive:
      "Clara: \"I bought a bag, not a manifesto.\"\nDean: \"Maybe, but the room read one anyway.\"\nClara: \"You think I chose it for the read?\"\nDean: \"I think the read helped the choice feel worth making.\"\nClara: \"So utility was not alone.\"\nDean: \"Utility almost never shops alone in this chapter.\"",
  },
  ch11: {
    gentle:
      "Mira: \"The easier version looked fine. Why keep the hard one?\"\nJonah: \"Because the hard one makes people feel the labor.\"\nMira: \"You mean the craft proves seriousness?\"\nJonah: \"Partly. The difficulty changes the value read.\"\nMira: \"Even when the final effect is similar?\"\nJonah: \"Especially then. The effort becomes part of the art.\"",
    direct:
      "Mira: \"The audience would not know the shortcut version.\"\nJonah: \"They might not know the shortcut, but they read the difficulty.\"\nMira: \"So visible effort raises prestige.\"\nJonah: \"Yes. Costly art feels weightier because the burden is legible.\"\nMira: \"Then process is inside the signal.\"\nJonah: \"That is the mechanism.\"",
    competitive:
      "Mira: \"Why pay for the harder build if the room gets the same image?\"\nJonah: \"Because the room never gets the same image once the labor shows.\"\nMira: \"So the difficulty itself is selling value.\"\nJonah: \"Exactly. Hard-to-fake effort upgrades the work.\"\nMira: \"Even when function is unchanged.\"\nJonah: \"Especially when function is unchanged and prestige has to carry more weight.\"",
  },
  ch12: {
    gentle:
      "Harper: \"The drive only got loud once the names went on the board.\"\nMiles: \"Because the giving stopped being private.\"\nHarper: \"You think people were donating for the board?\"\nMiles: \"For the cause and for what the board said about them.\"\nHarper: \"That sounds a little harsh.\"\nMiles: \"It sounds mixed, which is closer.\"",
    direct:
      "Harper: \"The thermometer made the whole room jump.\"\nMiles: \"Visibility changed the incentives.\"\nHarper: \"So the donations were partly social performance?\"\nMiles: \"Partly. Public generosity lets people help and advertise generosity at the same time.\"\nHarper: \"Then the outcome and the display are fused.\"\nMiles: \"Exactly.\"",
    competitive:
      "Harper: \"Funny how the drive woke up when the leaderboard appeared.\"\nMiles: \"Not funny. Predictable.\"\nHarper: \"You mean the audience made the gift bigger?\"\nMiles: \"The audience made the giver more legible.\"\nHarper: \"So the money and the image both moved.\"\nMiles: \"That is why visible charity pulls so hard.\"",
  },
  ch13: {
    gentle:
      "Elena: \"The coursework barely matches this role. Why are you leaning so hard on the degree?\"\nMarcus: \"Because the degree tells me more than the syllabus.\"\nElena: \"Like what?\"\nMarcus: \"That she could survive deadlines, rules, and a long institutional grind.\"\nElena: \"So you are reading the person, not just the classes.\"\nMarcus: \"Exactly.\"",
    direct:
      "Elena: \"You keep circling back to the credential, not the actual classes.\"\nMarcus: \"Because the credential is signaling traits, not just lesson content.\"\nElena: \"Ability?\"\nMarcus: \"Ability, discipline, and fit.\"\nElena: \"So the school record is acting like a proxy.\"\nMarcus: \"That is why it matters here.\"",
    competitive:
      "Elena: \"If the coursework barely travels, why does the degree still carry so much weight?\"\nMarcus: \"Because the stamp reads like more than knowledge.\"\nElena: \"What does it read like?\"\nMarcus: \"Brains, conscientiousness, and someone who can stay inside a system.\"\nElena: \"So the hiring signal outruns the lesson.\"\nMarcus: \"All the time.\"",
  },
  ch14: {
    gentle:
      "Nora: \"The visit felt serious the moment I saw that clipboard fill with follow-up steps.\"\nLiam: \"Before you even heard much about the treatment?\"\nNora: \"Yes. It felt like people were actively carrying the problem.\"\nLiam: \"So the visible effort changed how cared-for you felt.\"\nNora: \"It did. The plan looked real because so much attention surrounded it.\"\nLiam: \"That is why treatment can signal care as well as address health.\"",
    direct:
      "Nora: \"I trusted the visit more once I saw the signatures, notes, and follow-up routine.\"\nLiam: \"Even before the health effect was clear?\"\nNora: \"Yes. The process made the concern visible.\"\nLiam: \"So the burden and ritual were doing reassurance work.\"\nNora: \"Exactly. The care looked organized and costly enough to believe.\"\nLiam: \"That is the chapter's mixed motive in one scene.\"",
    competitive:
      "Nora: \"The treatment felt heavier the second the clipboard started filling up.\"\nLiam: \"Because the medicine got better?\"\nNora: \"Because the care got harder to ignore.\"\nLiam: \"So the visible routine carried signal value.\"\nNora: \"Yes. The room looked like it was spending real effort on me.\"\nLiam: \"That is why medicine can heal and advertise concern at the same time.\"",
  },
  ch15: {
    gentle:
      "Iris: \"Once everyone stood, answered, and sat together, the room felt different.\"\nNolan: \"Different how?\"\nIris: \"More joined. Like belonging was happening in the body, not just the message.\"\nNolan: \"So the ritual did bonding work before the doctrine landed.\"\nIris: \"Yes, and it also made commitment visible.\"\nNolan: \"That is why the practice matters as much as the words.\"",
    direct:
      "Iris: \"The repeated responses changed the room before anyone argued about belief.\"\nNolan: \"Because the synchrony itself was binding people?\"\nIris: \"Exactly. Moving together made allegiance visible.\"\nNolan: \"So the ritual was doing loyalty work, not just expressing doctrine.\"\nIris: \"And the cost of staying in rhythm made commitment easier to read.\"\nNolan: \"That is the chapter's mechanism.\"",
    competitive:
      "Iris: \"By the third response, the room felt welded together.\"\nNolan: \"Before the content even had time to settle?\"\nIris: \"Yes. The synchrony carried the force first.\"\nNolan: \"So the ritual was bonding the group and marking who was really in.\"\nIris: \"That is why staying with it felt important.\"\nNolan: \"Practice made loyalty legible.\"",
  },
  ch16: {
    gentle:
      "Fiona: \"The conversation changed the second your laptop came out.\"\nDerek: \"Because of the sticker?\"\nFiona: \"Yes. People started reading your side before they asked what you thought.\"\nDerek: \"I still had policy reasons.\"\nFiona: \"I know. The sticker just made the allegiance public first.\"\nDerek: \"So the room saw the jersey before the argument.\"",
    direct:
      "Fiona: \"Your policy point landed after the room had already sorted you by the sticker.\"\nDerek: \"That fast?\"\nFiona: \"Yes. Visible side-taking got there before the analysis.\"\nDerek: \"I was trying to argue the issue, not the tribe.\"\nFiona: \"Both were in play once the symbol was visible.\"\nDerek: \"That is a cleaner explanation than pretending the room was neutral.\"",
    competitive:
      "Fiona: \"You opened the laptop and the room read the side instantly.\"\nDerek: \"Before I said a word.\"\nFiona: \"Exactly. The sticker front-loaded the allegiance signal.\"\nDerek: \"So my policy argument walked in behind my coalition marker.\"\nFiona: \"That is why the discussion heated up so fast.\"\nDerek: \"The jersey showed before the case did.\"",
  },
};

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  const text = `${JSON.stringify(value, null, 2)}\n`;
  fs.writeFileSync(filePath, text);
  return text;
}

function sha256(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function normalizeBookMeta(book) {
  book.author = "Kevin Simler; Robin Hanson";
  book.categories = [...CATEGORIES];
  book.tags = [...TAGS];
}

const continuity = readJson(CONTINUITY_PATH);
const chapterTexts = [];

for (let number = 1; number <= 16; number += 1) {
  const chapterKey = `ch${String(number).padStart(2, "0")}`;
  const chapterPath = path.join(VALIDATED_DIR, `${chapterKey}.chapter.json`);
  const wrapperPath = path.join(VALIDATED_DIR, `${chapterKey}.review-package.json`);

  const chapter = readJson(chapterPath);
  const dialogue = chapter.examples.find((example) => example.format === "dialogue");
  if (!dialogue) {
    throw new Error(`Missing dialogue example in ${chapterPath}`);
  }
  dialogue.scenario = DIALOGUE_SCENARIOS[chapterKey];

  const chapterText = writeJson(chapterPath, chapter);
  continuity.validatedChapterHashes[chapterKey] = sha256(chapterText);
  chapterTexts.push(chapter);

  const wrapper = readJson(wrapperPath);
  normalizeBookMeta(wrapper.book);
  wrapper.chapters = [chapter];
  writeJson(wrapperPath, wrapper);
}

const release = {
  schemaVersion: "1.1.0",
  packageId: "the-elephant-in-the-brain.modern",
  createdAt: "2026-04-10T00:00:00Z",
  contentOwner: "ChapterFlow",
  book: {
    bookId: "the-elephant-in-the-brain",
    title: "The Elephant in the Brain",
    author: "Kevin Simler; Robin Hanson",
    variantFamily: "EMH",
    categories: [...CATEGORIES],
    tags: [...TAGS],
    edition: {
      name: "The Elephant in the Brain: Hidden Motives in Everyday Life",
      publisher: "Oxford University Press",
      isbn13: "9780190495992",
    },
  },
  chapters: [...chapterTexts].sort((a, b) => a.number - b.number),
};

writeJson(RELEASE_PATH, release);
writeJson(BOOK_PACKAGE_PATH, release);
writeJson(CONTINUITY_PATH, continuity);
