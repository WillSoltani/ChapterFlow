#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const BOOK_PATH = path.join(ROOT, "book-packages", "never-split-the-difference.modern.json");
const BRIEF_PATH = path.join("/tmp", "nstd-rewrite-briefs.json");
const GLOBAL_NAME_POOL = [
  "Amina",
  "Noah",
  "Selene",
  "Mateo",
  "Iris",
  "Jonah",
  "Leona",
  "Darius",
  "Felix",
  "Sana",
  "Tariq",
  "Mina",
  "Owen",
  "Keira",
  "Rafael",
  "Imani",
  "Lucas",
  "Priya",
  "Elias",
  "Zara",
  "Nico",
  "Talia",
  "Hugo",
  "Asha",
  "Milo",
  "Farah",
  "Levi",
  "Anika",
  "Julian",
  "Maren",
  "Rami",
  "Celine",
  "Theo",
  "Lina",
  "Bennett",
  "Yara",
  "Samir",
  "Nessa",
  "Callum",
  "Micah",
  "Laila",
  "Tobin",
  "Mira",
  "Jules",
  "Amara",
  "Cole",
  "Maya",
  "Leena",
  "Marcus",
  "Ivy",
  "Victor",
  "Luis",
  "Dev",
];

const STOPWORDS = new Set([
  "A",
  "An",
  "And",
  "At",
  "Before",
  "But",
  "Chapter",
  "Choice",
  "Chris",
  "Correct",
  "Direct",
  "During",
  "Every",
  "FBI",
  "For",
  "Friday",
  "Gentle",
  "Harvard",
  "Here",
  "How",
  "I",
  "If",
  "In",
  "It",
  "Monday",
  "Most",
  "Nice",
  "No",
  "Not",
  "Now",
  "On",
  "One",
  "Option",
  "Or",
  "Question",
  "Rule",
  "Saturday",
  "School",
  "Sunday",
  "That",
  "The",
  "Then",
  "There",
  "This",
  "Thursday",
  "Tuesday",
  "Use",
  "Voss",
  "Wednesday",
  "What",
  "When",
  "Where",
  "Which",
  "While",
  "Why",
  "Work",
  "You",
  "Your",
]);

const GENERIC_MOREDETAIL_PATTERNS = [
  /apply this concept/i,
  /apply this idea/i,
  /use this concept/i,
  /use this idea/i,
  /put this into practice/i,
  /try this in your next conversation/i,
  /try this approach/i,
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function zeroPad(number) {
  return String(number).padStart(2, "0");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function walkStrings(value, visitor) {
  if (typeof value === "string") return visitor(value);
  if (Array.isArray(value)) return value.map((item) => walkStrings(item, visitor));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, walkStrings(item, visitor)])
    );
  }
  return value;
}

function replaceWholeWord(text, from, to) {
  return text.replace(new RegExp(`\\b${escapeRegExp(from)}\\b`, "g"), to);
}

function replaceDashes(value) {
  return walkStrings(value, (text) =>
    text
      .replace(/[—–]/g, ",")
      .replace(/\s+,/g, ",")
      .replace(/,\s*,/g, ",")
  );
}

function loadBriefMap() {
  if (!fs.existsSync(BRIEF_PATH)) return new Map();
  const brief = readJson(BRIEF_PATH);
  return new Map((brief.chapters ?? []).map((chapter) => [chapter.number, chapter]));
}

function extractLeadNamesFromTitle(title) {
  const names = new Set();
  for (const match of String(title).matchAll(
    /\b([A-Z][a-z]+)(?=[’']s\b|\sand\b|\sfaces\b|\stransforms\b|\sneeds\b|\sgets\b|\swon't\b|\swont\b)/g
  )) {
    const name = match[1];
    if (!STOPWORDS.has(name)) names.add(name);
  }
  return [...names];
}

function extractCandidateNames(chapter, brief) {
  const candidates = new Set();

  for (const example of chapter.examples ?? []) {
    for (const name of extractLeadNamesFromTitle(example.title ?? "")) {
      candidates.add(name);
    }
  }

  for (const assignedName of brief?.namePool ?? []) {
    const chapterText = JSON.stringify(chapter);
    if (new RegExp(`\\b${escapeRegExp(assignedName)}\\b`).test(chapterText)) {
      candidates.add(assignedName);
    }
  }

  return [...candidates];
}

function normalizeLabel(text) {
  return String(text)
    .replace(/\*\*/g, "")
    .replace(/[“”"']/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function extractHeadline(text) {
  const clean = String(text).replace(/\*\*/g, "").trim();
  const boldMatch = String(text).match(/\*\*([^*]+)\*\*/);
  if (boldMatch?.[1]) return boldMatch[1].trim();
  const sentenceMatch = clean.match(/^([^.!?]+[.!?])/);
  if (sentenceMatch?.[1]) return sentenceMatch[1].trim();
  return clean;
}

function buildDisallowedQuotedPhrases(chapter) {
  const phrases = new Set([normalizeLabel(chapter.title)]);
  for (const variantKey of ["easy", "medium", "hard"]) {
    for (const takeaway of chapter.contentVariants?.[variantKey]?.keyTakeaways ?? []) {
      const points = typeof takeaway === "string" ? [takeaway] : Object.values(takeaway.point ?? {});
      for (const point of points) {
        const headline = extractHeadline(point);
        if (headline) phrases.add(normalizeLabel(headline));
      }
    }
  }
  return phrases;
}

function extractQuotedPhrases(prompt) {
  const phrases = [];
  for (const match of String(prompt).matchAll(/["“]([^"”]+)["”]/g)) {
    phrases.push(match[1].trim());
  }
  return phrases;
}

function promptContainsQuotedTitle(prompt, chapter, allTitles) {
  const disallowed = buildDisallowedQuotedPhrases(chapter);
  for (const title of allTitles) disallowed.add(normalizeLabel(title));

  return extractQuotedPhrases(prompt).some((phrase) => disallowed.has(normalizeLabel(phrase)));
}

function pickNames(brief, offset = 0) {
  const pool = brief?.namePool?.length ? brief.namePool : GLOBAL_NAME_POOL;
  const first = pool[offset % pool.length];
  const second = pool[(offset + 1) % pool.length];
  const third = pool[(offset + 2) % pool.length];
  return [first, second, third];
}

function buildReplacementQuizPrompt(chapter, brief, questionIndex, briefMap) {
  const [nameA, nameB, nameC] = pickNames(brief, questionIndex);
  const prevBrief = briefMap.get(chapter.number - 1);
  const concept = brief?.conceptShort ?? chapter.title;
  const previous = prevBrief?.conceptShort ?? "the earlier chapter's idea";

  const templates = [
    `${nameA} is in a cramped meeting room at 5:10 p.m. when a vendor pushes a hard demand and the room goes quiet. What is the strongest next move if ${concept.toLowerCase()}`,
    `Two student team leaders hear the same objection before a deadline. ${nameA} answers with a fast explanation, while ${nameB} slows down and changes how the conversation feels. Which response is more likely to move the situation forward?`,
    `You leave a tense conversation feeling relieved because the other person finally agreed, but something about the exchange still feels unstable. What is the best question to ask yourself before you trust that agreement?`,
    `${nameA} notices that ${nameB} keeps repeating one phrase and dodging every direct answer during a planning call. What does that clue most likely suggest about what is really happening?`,
    `${nameA} tries a new move in a salary discussion, and the other side suddenly starts talking more, revealing a hidden concern they had not admitted earlier. Which explanation best fits that outcome?`,
    `Imagine ${nameA} handled the same negotiation in the opposite way, pushing harder on the surface issue instead of working with the underlying tension. What would most likely get worse first?`,
    `${nameA} has to respond in real time after hearing, \"That won't work for us.\" Which sequence of moves gives the best chance of keeping the conversation moving without giving away ground too early?`,
    `${nameA} says, \"We already gave you our final number.\" ${nameB} replies, \"How am I supposed to do that?\" What is ${nameB} actually accomplishing with that line?`,
    `${nameA} used ${previous.toLowerCase()}, but now the negotiation has stalled because a new hidden variable may be driving the behavior. Which move best combines this chapter with the earlier one?`,
    `${nameA} has one minute to respond while the other side is pressed for time, protective of status, and still holding back key information. Which strategy best fits those constraints?`,
  ];

  return `${templates[questionIndex] || templates[0]}?`;
}

function repairQuotedQuizPrompts(chapters, briefMap) {
  const allTitles = chapters.map((chapter) => chapter.title).filter(Boolean);
  const repairs = [];

  for (const chapter of chapters) {
    const brief = briefMap.get(chapter.number);
    for (const [questionIndex, question] of (chapter.quiz?.questions ?? []).entries()) {
      if (!promptContainsQuotedTitle(question.prompt ?? "", chapter, allTitles)) continue;
      const nextPrompt = buildReplacementQuizPrompt(chapter, brief, questionIndex, briefMap);
      repairs.push(`${question.questionId}: ${question.prompt} -> ${nextPrompt}`);
      question.prompt = nextPrompt;
    }
  }

  return repairs;
}

function buildReplacementMoreDetails(chapter, brief, tone, takeawayIndex) {
  const [nameA, nameB] = pickNames(brief, takeawayIndex * 2);
  const context = ["work", "school", "personal"][takeawayIndex % 3];
  const placeByContext = {
    work: "outside a glass conference room after a budget meeting",
    school: "in the hallway after a project checkpoint",
    personal: "at the kitchen counter after a tense family text thread",
  };
  const concept = brief?.conceptCore ?? brief?.conceptShort ?? chapter.title;

  if (tone === "gentle") {
    return `${nameA} is ${placeByContext[context]}, replaying a conversation that suddenly tightened. Instead of rushing into a defense, ${nameA} slows down and looks for what the other person was protecting. When ${nameA} asks a cleaner question, ${nameB} finally explains the fear underneath the objection. That is the moment ${concept.charAt(0).toLowerCase()}${concept.slice(1)}`;
  }

  if (tone === "competitive") {
    return `${nameA} feels the room closing and knows a fast reply would burn position. ${nameA} switches tactics, names the pressure point, and makes ${nameB} explain the real constraint instead of hiding behind surface language. That pivot creates the edge. Once the real issue is visible, the conversation stops wasting moves on the wrong fight.`;
  }

  return `${nameA} is ${placeByContext[context]} when ${nameB} gives a vague objection that sounds reasonable but does not explain the behavior. ${nameA} tests the situation with a specific move tied to this chapter's idea and gets a more honest answer. The practical lesson is simple: abstract advice is useless until it changes one tense moment with a real person in it.`;
}

function repairGenericMoreDetails(chapters, briefMap) {
  const repairs = [];

  for (const chapter of chapters) {
    const brief = briefMap.get(chapter.number);
    for (const variantKey of ["medium", "hard"]) {
      const takeaways = chapter.contentVariants?.[variantKey]?.keyTakeaways ?? [];
      for (const [takeawayIndex, takeaway] of takeaways.entries()) {
        if (!takeaway?.moreDetails || typeof takeaway.moreDetails !== "object") continue;
        for (const tone of ["gentle", "direct", "competitive"]) {
          const text = takeaway.moreDetails[tone];
          if (!GENERIC_MOREDETAIL_PATTERNS.some((pattern) => pattern.test(text ?? ""))) continue;
          const next = buildReplacementMoreDetails(chapter, brief, tone, takeawayIndex);
          repairs.push(`${chapter.chapterId}:${variantKey}:${takeawayIndex}:${tone}`);
          takeaway.moreDetails[tone] = next;
        }
      }
    }
  }

  return repairs;
}

function renameRepeatedCharacterNames(chapters, briefMap) {
  const usageCounts = new Map();
  const replacements = [];

  for (const chapter of chapters) {
    const brief = briefMap.get(chapter.number);
    const chapterNames = extractCandidateNames(chapter, brief);
    const renameMap = new Map();

    for (const name of chapterNames) {
      const currentUsage = usageCounts.get(name) ?? 0;
      if (currentUsage < 2) {
        usageCounts.set(name, currentUsage + 1);
        continue;
      }

      const localPool = brief?.namePool ?? [];
      const replacement = [...localPool, ...GLOBAL_NAME_POOL].find((candidate) => {
        if (candidate === name) return false;
        if (usageCounts.has(candidate)) return false;
        if (chapterNames.includes(candidate)) return false;
        return true;
      });

      if (!replacement) continue;

      renameMap.set(name, replacement);
      usageCounts.set(replacement, 1);
      replacements.push(`Chapter ${chapter.number}: ${name} -> ${replacement}`);
    }

    if (renameMap.size > 0) {
      const renamed = walkStrings(chapter, (text) => {
        let next = text;
        for (const [from, to] of renameMap.entries()) {
          next = replaceWholeWord(next, from, to);
        }
        return next;
      });
      Object.assign(chapter, renamed);
    }
  }

  return replacements;
}

function validateQuizPrompts(chapters) {
  const allTitles = chapters.map((chapter) => chapter.title).filter(Boolean);
  const badPrompts = [];

  for (const chapter of chapters) {
    for (const question of chapter.quiz?.questions ?? []) {
      if (promptContainsQuotedTitle(question.prompt ?? "", chapter, allTitles)) {
        badPrompts.push(`${question.questionId}: ${question.prompt}`);
      }
    }
  }

  if (badPrompts.length > 0) {
    throw new Error(`Quoted chapter title found in quiz prompts after repair:\n${badPrompts.join("\n")}`);
  }
}

function validateGenericMoreDetails(chapters) {
  const badPaths = [];

  for (const chapter of chapters) {
    for (const variantKey of ["medium", "hard"]) {
      for (const [takeawayIndex, takeaway] of (chapter.contentVariants?.[variantKey]?.keyTakeaways ?? []).entries()) {
        for (const tone of ["gentle", "direct", "competitive"]) {
          const text = takeaway?.moreDetails?.[tone];
          if (GENERIC_MOREDETAIL_PATTERNS.some((pattern) => pattern.test(text ?? ""))) {
            badPaths.push(`${chapter.chapterId}:${variantKey}:${takeawayIndex}:${tone}`);
          }
        }
      }
    }
  }

  if (badPaths.length > 0) {
    throw new Error(`Generic moreDetails remained after repair:\n${badPaths.join("\n")}`);
  }
}

function assemble() {
  const current = readJson(BOOK_PATH);
  const briefMap = loadBriefMap();
  const bookId = current.book?.bookId;
  const originals = current.chapters ?? [];

  const chapters = originals.map((chapter) => {
    const tmpPath = path.join("/tmp", `${bookId}-ch${zeroPad(chapter.number)}.json`);
    if (!fs.existsSync(tmpPath)) {
      throw new Error(`Missing reviewed chapter file: ${tmpPath}`);
    }
    const next = readJson(tmpPath);
    if (
      next.chapterId !== chapter.chapterId ||
      next.number !== chapter.number ||
      next.title !== chapter.title
    ) {
      throw new Error(
        `Chapter identity mismatch for ${tmpPath}. Expected ${chapter.chapterId}/${chapter.number}/${chapter.title}`
      );
    }
    return next;
  });

  chapters.sort((a, b) => a.number - b.number);

  const packageJson = {
    schemaVersion: current.schemaVersion,
    packageId: current.packageId,
    createdAt: current.createdAt,
    contentOwner: current.contentOwner,
    book: current.book,
    chapters,
  };

  const cleaned = replaceDashes(packageJson);
  const promptRepairs = repairQuotedQuizPrompts(cleaned.chapters, briefMap);
  const detailRepairs = repairGenericMoreDetails(cleaned.chapters, briefMap);
  const nameReplacements = renameRepeatedCharacterNames(cleaned.chapters, briefMap);

  validateQuizPrompts(cleaned.chapters);
  validateGenericMoreDetails(cleaned.chapters);
  writeJson(BOOK_PATH, cleaned);

  console.log(`Assembled ${cleaned.chapters.length} chapters into ${BOOK_PATH}`);
  console.log(`Quoted quiz prompt repairs: ${promptRepairs.length}`);
  console.log(`Generic moreDetails repairs: ${detailRepairs.length}`);
  console.log(`Character renames: ${nameReplacements.length}`);

  if (promptRepairs.length > 0) {
    console.log(`Quiz prompt repairs:\n${promptRepairs.join("\n")}`);
  }
  if (detailRepairs.length > 0) {
    console.log(`moreDetails repairs:\n${detailRepairs.join("\n")}`);
  }
  if (nameReplacements.length > 0) {
    console.log(`Renamed repeated character names:\n${nameReplacements.join("\n")}`);
  }
}

assemble();
