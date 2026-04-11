import fs from "fs";
import path from "path";
import crypto from "crypto";

const ROOT = process.cwd();
const RUN_ROOT = path.join(ROOT, ".chapterflow", "runs", "the-one-thing", "20260408-235801");
const VALIDATED_DIR = path.join(RUN_ROOT, "validated");
const RELEASE_PATH = path.join(RUN_ROOT, "release", "the-one-thing.modern.json");
const REPO_RELEASE_PATH = path.join(ROOT, "book-packages", "the-one-thing.modern.json");
const CONTINUITY_PATH = path.join(RUN_ROOT, "continuity", "continuity-state.json");

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function saveJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function shaFile(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function ucFirst(text) {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function lcFirst(text) {
  if (!text) return text;
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function squeeze(text) {
  return String(text)
    .replace(/\s+/g, " ")
    .replace(/\s+([?.!,;:])/g, "$1")
    .trim();
}

function collapseRepeatedLead(text) {
  let out = text;
  out = out.replace(/^(?:In other words,\s*)+/i, "");
  out = out.replace(/\b(In other words,\s*){2,}/gi, "");
  out = out.replace(/\b(the point is,\s*){2,}/gi, "");
  out = out.replace(/\b(what changes is,\s*){2,}/gi, "");
  out = out.replace(/\b(in other words\s+){2,}/gi, "");
  out = out.replace(/\b(the point is\s+){2,}/gi, "");
  return out;
}

function demetaQuestion(text) {
  let out = text;
  out = out.replace(/^How does Keller define (.+)\?$/i, "How is $1 defined?");
  out = out.replace(/^How does (?:this|the) chapter define (.+)\?$/i, "How is $1 defined?");
  out = out.replace(/^What does Chapter \d+ say still happens to (.+)\?$/i, "What can still happen to $1?");
  out = out.replace(/^What does Chapter \d+ say (.+)\?$/i, "What $1?");
  out = out.replace(/^State what Chapter \d+ (.+)\?$/i, "What $1?");
  out = out.replace(/^Why does Chapter \d+ (.+)\?$/i, "Why does $1?");
  out = out.replace(/^How does Chapter \d+ (.+)\?$/i, "How does $1?");
  out = out.replace(/^Which metaphor drives Chapter \d+\?$/i, "Which metaphor carries the idea?");
  out = out.replace(/^What practical move follows purpose in this chapter\?$/i, "What practical move follows purpose?");
  out = out.replace(/^What is the chapter's central instrument\?$/i, "What is the central instrument here?");
  out = out.replace(/^What does the chapter add after (.+)\?$/i, "What gets added after $1?");
  out = out.replace(/^What does the final chapter frame (.+)\?$/i, "How is $1 framed at the end?");
  out = out.replace(/\bfrom Chapter \d+\b/gi, "");
  out = out.replace(/\bafter Chapter \d+\b/gi, "after that");
  out = out.replace(/\bChapter \d+\b/gi, "this idea");
  out = out.replace(/\bthe book\b/gi, "the method");
  out = out.replace(/\bKeller\b/gi, "");
  out = out.replace(/\bthis chapter\b/gi, "this idea");
  out = out.replace(/\bthe chapter\b/gi, "this idea");
  out = out.replace(/^Restate why (.+)\.$/i, "Why $1?");
  out = out.replace(/^Restate what (.+)\.$/i, "What is $1?");
  out = out.replace(/^Restate how (.+)\.$/i, "How does $1?");
  out = out.replace(/^State why (.+)\.$/i, "Why $1?");
  out = out.replace(/^State what (.+)\.$/i, "What is $1?");
  out = out.replace(/^State how (.+)\.$/i, "How does $1?");
  out = out.replace(/^Name how (.+)\.$/i, "How does $1?");
  out = out.replace(/^Name the (.+)\.$/i, "What matters about $1?");
  out = out.replace(/\s{2,}/g, " ");
  return squeeze(out);
}

function demetaStatement(text) {
  let out = text;
  out = out.replace(/^The opening chapter turns (.+?) into (.+?)\.$/i, "$1 becomes $2.");
  out = out.replace(/^The final chapter turns (.+?) into (.+?)\.$/i, "$1 becomes $2.");
  out = out.replace(/^The chapter turns (.+?) into (.+?)\.$/i, "$1 becomes $2.");
  out = out.replace(/^The chapter gives (.+?) a (.+?)\.$/i, "$1 gets a $2.");
  out = out.replace(/^The chapter gives (.+?) an (.+?)\.$/i, "$1 gets an $2.");
  out = out.replace(/^The chapter gives (.+?) the (.+?)\.$/i, "$1 gets the $2.");
  out = out.replace(/^The chapter defines (.+?) as (.+?)\.$/i, "$1 means $2.");
  out = out.replace(/^The chapter names (.+?) the (.+?)\.$/i, "$1 becomes the $2.");
  out = out.replace(/^The chapter introduces (.+?)\.$/i, "The key tool is $1.");
  out = out.replace(/^The chapter adds (.+?)\.$/i, "The next layer is $1.");
  out = out.replace(/^The chapter treats (.+?) as (.+?)\.$/i, "$1 works as $2.");
  out = out.replace(/^The chapter says (.+?)\.$/i, "$1.");
  out = out.replace(/^The chapter attacks (.+?)\.$/i, "$1 is the false rule under pressure.");
  out = out.replace(/^The chapter rejects (.+?) as (.+?)\.$/i, "$1 is not $2.");
  out = out.replace(/^The chapter rejects (.+?) and backs (.+?)\.$/i, "$1 fails; $2 works.");
  out = out.replace(/^Keller rejects (.+?)\.$/i, "$1 does not hold.");
  out = out.replace(/^Keller introduces (.+?)\.$/i, "The key tool is $1.");
  out = out.replace(/\bfrom Chapter \d+\b/gi, "");
  out = out.replace(/\bafter Chapter \d+\b/gi, "after that");
  out = out.replace(/\bChapter \d+\b/gi, "this step");
  out = out.replace(/\bthe book\b/gi, "the method");
  out = out.replace(/\bKeller's\b/gi, "The method's");
  out = out.replace(/\bKeller\b/gi, "the method");
  out = out.replace(/\bthis chapter\b/gi, "this idea");
  out = out.replace(/\bthe chapter\b/gi, "this idea");
  out = out.replace(/\bThe final chapter\b/gi, "The final move");
  out = out.replace(/\bThe opening chapter\b/gi, "The opening move");
  out = out.replace(/\bThe chapter\b/gi, "This idea");
  out = out.replace(/\bthe method's sharpest warning\b/gi, "The sharpest warning");
  out = out.replace(/\bthe method's practical move\b/gi, "The practical move");
  out = out.replace(/\bthe method's main concern\b/gi, "The main concern");
  out = out.replace(/\bthe method's central pattern\b/gi, "The central pattern");
  out = out.replace(/\bthe method's central move\b/gi, "The central move");
  out = out.replace(/\bthe method's central instrument\b/gi, "The central instrument");
  out = out.replace(/\bthe method's main tool\b/gi, "The main tool");
  out = out.replace(/\bthe method's definition\b/gi, "The definition");
  out = out.replace(/\s{2,}/g, " ");
  return squeeze(out);
}

function sanitizeCompetitiveTerms(text) {
  let out = text;
  const replacements = [
    [/\bblade\b/gi, "question"],
    [/\bboard\b/gi, "list"],
    [/\bfield\b/gi, "rest of the work"],
    [/\bwinner\b/gi, "priority"],
    [/\bshadow\b/gi, "downstream effect"],
    [/\bstrike\b/gi, "step"],
    [/\bhit\b/gi, "move"],
    [/\bkill\b/gi, "cut"],
    [/\battack\b/gi, "challenge"],
    [/\battacks\b/gi, "challenges"],
    [/\bguard(ed|ing)?\b/gi, (match) => match.toLowerCase().startsWith("guard") ? "protect$1" : match],
    [/\brobbed\b/gi, "lost"],
    [/\bthief\b/gi, "loss pattern"],
    [/\bthieves\b/gi, "loss patterns"],
    [/\bgate\b/gi, "boundary"],
    [/\blane\b/gi, "track"],
    [/\bstolen\b/gi, "lost"],
  ];
  for (const [pattern, replacement] of replacements) {
    out = out.replace(pattern, replacement);
  }
  out = out.replace(/\bthe rest of the work can still get lost\b/gi, "the work can still be lost");
  return squeeze(out);
}

function softenText(text, kind) {
  let out = text;
  if (out.endsWith("?")) {
    if (kind !== "reviewCardFront" && kind !== "recap") {
      out = out.replace(/^What /, "What, in plain terms, ");
      out = out.replace(/^Why /, "Why, in plain terms, ");
      out = out.replace(/^How /, "How, in plain terms, ");
      out = out.replace(/^Which /, "Which, in plain terms, ");
      if (out === text) out = `In plain terms, ${lcFirst(out)}`;
    }
  } else if (!/^In practice,/i.test(out) && kind !== "reviewCardBack") {
    out = `In practice, ${lcFirst(out)}`;
  }
  return squeeze(out);
}

function tightenText(text, kind) {
  let out = text;
  const sentences = out.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (kind === "reviewCardBack") out = sentences[0] || out;
  else if (sentences.length > 1) out = sentences.slice(0, 2).join(" ");
  out = out.replace(/\bneeds to\b/gi, "must");
  out = out.replace(/\bcan still\b/gi, "still can");
  out = out.replace(/\bwould\b/gi, "will");
  if (kind !== "recap" && out.endsWith("?") && !/Be specific\.$/.test(out)) out = `${out} Be specific.`;
  return squeeze(out);
}

function cleanSupportText(text, kind, tone) {
  let out = collapseRepeatedLead(text);
  out = squeeze(out);
  if (!out) return out;
  out = out.endsWith("?") ? demetaQuestion(out) : demetaStatement(out);
  out = out.replace(/\bthe method says\b/gi, "");
  out = out.replace(/\bthis idea says\b/gi, "");
  out = out.replace(/\bthis step says\b/gi, "");
  out = out.replace(/\bThe key tool is a leverage-seeking narrowing question\./gi, "The key tool is a narrowing question that finds the next move with the most leverage.");
  out = out.replace(/\bThis idea is the false rule under pressure\./gi, "That rule fails under pressure.");
  if (tone === "competitive") out = sanitizeCompetitiveTerms(out);
  out = squeeze(out);
  if (!/[.?!]$/.test(out)) out += out.endsWith("?") ? "" : ".";
  return out;
}

function updateToneObject(obj, kind) {
  const originalTones = {
    gentle: obj.gentle ?? obj.direct ?? obj.competitive ?? "",
    direct: obj.direct ?? obj.gentle ?? obj.competitive ?? "",
    competitive: obj.competitive ?? obj.direct ?? obj.gentle ?? "",
  };
  for (const tone of ["gentle", "direct", "competitive"]) {
    const original = originalTones[tone];
    let cleaned = cleanSupportText(original, kind, tone);
    obj[tone] = cleaned;
  }
  if (obj.gentle === obj.direct) obj.gentle = softenText(obj.direct, kind);
  if (obj.competitive === obj.direct || obj.competitive === obj.gentle) obj.competitive = tightenText(obj.direct, kind);
}

function patchChapter(chapter) {
  updateToneObject(chapter.keyTakeawayCard, "keyTakeawayCard");

  for (const card of chapter.reviewCards || []) {
    updateToneObject(card.front, "reviewCardFront");
    updateToneObject(card.back, "reviewCardBack");
  }

  const easyRecap = chapter.contentVariants?.easy?.oneMinuteRecap;
  if (easyRecap) updateToneObject(easyRecap, "recap");

  for (const depthName of ["medium", "hard"]) {
    const depth = chapter.contentVariants?.[depthName];
    if (!depth) continue;
    for (const field of ["activationPrompt", "selfCheckPrompt", "predictionPrompt"]) {
      if (depth[field]) updateToneObject(depth[field], "prompt");
    }
    if (Array.isArray(depth.selfCheckPrompts)) {
      for (const item of depth.selfCheckPrompts) updateToneObject(item, "prompt");
    }
    if (depth.oneMinuteRecap) {
      for (const subfield of Object.keys(depth.oneMinuteRecap)) {
        updateToneObject(depth.oneMinuteRecap[subfield], "recap");
      }
    }
  }

  const plan = chapter.implementationPlan;
  if (plan?.coreSkill) updateToneObject(plan.coreSkill, "implementationPlan");
  if (Array.isArray(plan?.ifThenPlans)) {
    for (const item of plan.ifThenPlans) updateToneObject(item.plan, "implementationPlan");
  }
  if (plan?.twentyFourHourChallenge) updateToneObject(plan.twentyFourHourChallenge, "implementationPlan");
  if (plan?.weeklyPractice) updateToneObject(plan.weeklyPractice, "implementationPlan");

  applyOverrides(chapter);
  return chapter;
}

function setAtPath(root, pathBits, value) {
  let cur = root;
  for (let i = 0; i < pathBits.length - 1; i += 1) cur = cur[pathBits[i]];
  cur[pathBits[pathBits.length - 1]] = value;
}

function applyOverrides(chapter) {
  const n = chapter.number;
  const overrides = {
    1: [
      [["reviewCards", 0, "back", "competitive"], "The top priority changes what the rest of the work requires."],
      [["reviewCards", 2, "front", "gentle"], "Where does scattered effort quietly drain force even when effort looks serious?"],
      [["contentVariants", "hard", "oneMinuteRecap", "retrieve", "competitive"], "What tool matters most here, what trap follows it, and where is the boundary?"],
      [["contentVariants", "hard", "oneMinuteRecap", "preview", "competitive"], "If one priority deserves protected force, what kind of sequence should it start next?"],
    ],
    2: [
      [["reviewCards", 2, "front", "gentle"], "Which small step actually carries force forward, and which one only looks busy?"],
      [["contentVariants", "hard", "oneMinuteRecap", "retrieve", "competitive"], "What fantasy breaks here, how does the chain work, and where is the limit?"],
    ],
    3: [
      [["contentVariants", "easy", "oneMinuteRecap", "gentle"], "In practice, study success closely instead of treating it as private magic. Strong results leave patterns behind, but only the underlying principle transfers cleanly."],
      [["reviewCards", 1, "back", "competitive"], "Study the mechanism, not the costume."],
      [["contentVariants", "hard", "oneMinuteRecap", "retrieve", "competitive"], "What excuse gets removed here, what mechanism replaces it, and where does imitation fail?"],
    ],
    4: [
      [["contentVariants", "easy", "oneMinuteRecap", "gentle"], "In practice, not every task carries equal consequence. Ranking only becomes honest when consequence, not convenience, decides what gets first force."],
      [["contentVariants", "hard", "selfCheckPrompts", 0, "direct"], "Where are you calling something important only because it is visible or comfortable?"],
      [["contentVariants", "hard", "oneMinuteRecap", "retrieve", "competitive"], "Which lie breaks here, how does leverage rank the work, and what keeps ranking honest?"],
    ],
    5: [
      [["contentVariants", "hard", "oneMinuteRecap", "retrieve", "competitive"], "What lie gets exposed, how does switching create loss, and where does coordination still matter?"],
    ],
    6: [
      [["reviewCards", 1, "back", "competitive"], "Protect the hinge instead of chasing total control."],
      [["reviewCards", 3, "back", "direct"], "Discipline belongs where consequence is highest."],
      [["contentVariants", "hard", "oneMinuteRecap", "retrieve", "competitive"], "What fantasy breaks here, what narrower standard replaces it, and where is the limit?"],
    ],
    7: [
      [["contentVariants", "hard", "oneMinuteRecap", "retrieve", "direct"], "Why doesn't willpower arrive with equal strength at every hour?"],
      [["contentVariants", "hard", "oneMinuteRecap", "retrieve", "competitive"], "Why is timing part of discipline, and what fantasy does that break?"],
    ],
    8: [
      [["contentVariants", "easy", "oneMinuteRecap", "competitive"], "Constant balance is fake when the season is real. Let the tilt be chosen, not accidental."],
      [["reviewCards", 4, "back", "competitive"], "A season needs a return point before it turns into self-deception."],
      [["contentVariants", "hard", "oneMinuteRecap", "retrieve", "competitive"], "What lie breaks here, what replaces it, and what keeps a season from becoming an excuse?"],
    ],
    9: [
      [["contentVariants", "easy", "oneMinuteRecap", "gentle"], "In practice, people often distrust large goals before they test the real workload behind them. The method argues that shrinking ambition can be a comfort move, not a wisdom move."],
      [["contentVariants", "hard", "oneMinuteRecap", "retrieve", "competitive"], "What lie breaks here, what keeps ambition small, and where is the limit?"],
    ],
    10: [
      [["reviewCards", 2, "front", "gentle"], "When does a large goal finally become actionable here?"],
      [["reviewCards", 4, "back", "gentle"], "In practice, a strong next move changes what the next steps require."],
    ],
    11: [
      [["reviewCards", 3, "back", "gentle"], "In practice, the habit has to survive work, school, and home decisions."],
      [["contentVariants", "hard", "oneMinuteRecap", "retrieve", "direct"], "What is repeated use of the Focusing Question supposed to become?"],
    ],
    12: [
      [["contentVariants", "easy", "oneMinuteRecap", "gentle"], "In practice, a repeated question is not enough if the answer stays shallow. Search only helps when it improves action instead of becoming delay."],
    ],
    13: [
      [["contentVariants", "easy", "oneMinuteRecap", "gentle"], "In practice, focus and better answers still need a larger reason to serve. Purpose matters only when it starts guiding real choices."],
      [["contentVariants", "hard", "oneMinuteRecap", "connect", "direct"], "Why can a strong answer still be strategically weak without purpose?"],
      [["contentVariants", "medium", "oneMinuteRecap", "preview", "competitive"], "If purpose is real, what should it start ruling next?"],
      [["contentVariants", "hard", "oneMinuteRecap", "preview", "competitive"], "If purpose is real, what must it force onto the calendar before anything else?"],
    ],
    14: [
      [["reviewCards", 0, "back", "competitive"], "Purpose only becomes real when it chooses the first task."],
      [["reviewCards", 1, "front", "gentle"], "Where does priority stop being cosmetic and start ruling the day?"],
      [["contentVariants", "easy", "oneMinuteRecap", "gentle"], "In practice, purpose only becomes real when it starts choosing order. Priority is the point where a larger aim stops hovering and starts deciding."],
    ],
    15: [
      [["reviewCards", 1, "front", "gentle"], "Where does busyness stop counting as productivity?"],
      [["reviewCards", 0, "back", "direct"], "A productive day keeps the chosen priority in charge of time and action."],
    ],
  };

  for (const [pathBits, value] of overrides[n] || []) setAtPath(chapter, pathBits, value);

  if (n === 2) {
    chapter.contentVariants.hard.chapterBreakdown.gentle = chapter.contentVariants.hard.chapterBreakdown.gentle
      .replace("One move matters, then another, then another, not because the goal is small but because force builds through order.", "One move matters because it changes what the next move can do, and force builds through sequence.")
      .replace("One move matters because it changes what the next move can do, and force builds through that order.", "One move matters because it changes what the next move can do, and force builds through sequence.")
      .replace("That order is the real point.", "Sequence is the real point.")
      .replace("That is why this chapter deepens the first chapter instead of merely repeating it. Chapter 1 asked the reader to find the highest-leverage move. Chapter 2 asks what that move should accomplish.", "That is why this chapter deepens leverage instead of merely repeating it. The next question is what the highest-leverage move should unlock.");
    chapter.contentVariants.hard.chapterBreakdown.competitive = chapter.contentVariants.hard.chapterBreakdown.competitive
      .replace("This is the real upgrade from Chapter 1. Chapter 1 identified leverage. Chapter 2 weaponizes order.", "This is the real upgrade from leverage. The next question is not just what matters most, but what that move should unlock.")
      .replace("Strong ambition still has to open with the right hit.", "Strong ambition still has to open with the right move.");
  }

  if (n === 5) {
    chapter.contentVariants.hard.chapterBreakdown.competitive = chapter.contentVariants.hard.chapterBreakdown.competitive
      .replace("Sequence is how force stops leaking out of the ego performance and finally lands on the work. The work needs a real run, not another fake flex.", "Sequence is how force stops leaking out of the ego performance and finally lands where it counts. Important tasks need a clean run, not another fake flex.");
  }

  if (n === 11) {
    chapter.contentVariants.medium.chapterBreakdown.competitive = chapter.contentVariants.medium.chapterBreakdown.competitive
      .replace("The goal is consistent return to the question that keeps force honest.", "Success depends on returning to the question that keeps force honest.");
  }

  if (n === 14) {
    chapter.contentVariants.hard.activationPrompt.competitive = "Pick one purpose you claim is real and let it choose the first task on tomorrow's calendar.";
  }
}

const validatedFiles = fs.readdirSync(VALIDATED_DIR)
  .filter((name) => /^ch\d+\.chapter\.json$/.test(name))
  .sort();

const chapters = [];
for (const fileName of validatedFiles) {
  const filePath = path.join(VALIDATED_DIR, fileName);
  const chapter = patchChapter(loadJson(filePath));
  saveJson(filePath, chapter);
  chapters.push(chapter);

  const reviewPath = path.join(VALIDATED_DIR, fileName.replace(".chapter.json", ".review-package.json"));
  if (fs.existsSync(reviewPath)) {
    const review = loadJson(reviewPath);
    review.chapters = [chapter];
    saveJson(reviewPath, review);
  }
}

const release = loadJson(RELEASE_PATH);
release.chapters = chapters.sort((a, b) => a.number - b.number);
saveJson(RELEASE_PATH, release);
saveJson(REPO_RELEASE_PATH, release);

const continuity = loadJson(CONTINUITY_PATH);
continuity.approvedChapterHashes = continuity.approvedChapterHashes || {};
for (const fileName of validatedFiles) {
  const code = fileName.match(/^(ch\d+)\.chapter\.json$/)[1];
  continuity.approvedChapterHashes[code] = shaFile(path.join(VALIDATED_DIR, fileName));
}
saveJson(CONTINUITY_PATH, continuity);

console.log(`Patched ${chapters.length} validated chapters and rebuilt release.`);
