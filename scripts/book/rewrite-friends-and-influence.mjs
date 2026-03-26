#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SOURCE_PATH = path.join(
  ROOT,
  "book-packages",
  "friends-and-influence-student-edition.student.json"
);
const TARGET_PATH = path.join(
  ROOT,
  "book-packages",
  "friends-and-influence-student-edition.modern.json"
);
const TMP_DIR = path.join("/tmp", "friends-and-influence-rewrite");
const BRIEF_DIR = path.join(TMP_DIR, "chapter-briefs");
const SOURCE_DIR = path.join(TMP_DIR, "source-chapters");
const BRIEF_PATH = path.join(TMP_DIR, "brief.json");
const MASTER_LIST_PATH = path.join(TMP_DIR, "master-chapter-list.txt");

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
  "Nadia",
  "Hana",
  "Cole",
  "Jonah",
  "Mira",
  "Ari",
  "Sofia",
  "Ruben",
  "Elena",
  "Dante",
  "Keisha",
  "Malik",
  "Rina",
  "Tessa",
  "Omar",
  "Nora",
  "Camila",
  "Evan",
  "Jada",
  "Miles",
  "Ariel",
  "Soren",
  "Layla",
  "Quinn",
  "Bianca",
  "Rory",
  "Mayaan",
  "Adele",
  "Zane",
  "Pia",
  "Kieran",
  "Suri",
  "Emmett",
  "Alina",
  "Reid",
  "Tara",
  "Nikhil",
  "Avery",
  "Marta",
  "Idris",
  "Esme",
  "Leo",
  "Naomi",
  "Rhea",
  "Damon",
  "Gia",
  "Owen",
  "Luca",
  "Mina",
  "Harper",
  "Shay",
  "Anya",
  "Zuri",
  "Cora",
  "Davin",
  "Alec",
  "Rosa",
  "Tobin",
  "Iman",
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
  "Correct",
  "Direct",
  "During",
  "Every",
  "First",
  "For",
  "Friday",
  "Gentle",
  "Here",
  "How",
  "I",
  "If",
  "In",
  "It",
  "Monday",
  "Most",
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
  /apply this principle/i,
  /use this concept/i,
  /use this idea/i,
  /put this into practice/i,
  /try this in your next conversation/i,
  /try this approach/i,
  /this technique is useful/i,
  /important principle to keep in mind/i,
];

const CONCEPTS = [
  {
    number: 1,
    chapterId: "ch01-do-not-begin-with-blame",
    title: "Do Not Begin With Blame",
    concept:
      "Open difficult conversations without blame so the other person stays less defensive and the real issue can be discussed.",
  },
  {
    number: 2,
    chapterId: "ch02-appreciation-changes-energy",
    title: "Appreciation Changes Energy",
    concept:
      "Show sincere appreciation to improve goodwill and make people relax around you instead of feeling taken for granted.",
  },
  {
    number: 3,
    chapterId: "ch03-speak-to-what-others-want",
    title: "Speak to What Others Want",
    concept:
      "Frame requests around what the other person wants so they feel motivated to act rather than pressured by your agenda.",
  },
  {
    number: 4,
    chapterId: "ch04-curiosity-before-performance",
    title: "Curiosity Before Performance",
    concept:
      "Lead with real curiosity about the other person so rapport comes from attention, not performative charm.",
  },
  {
    number: 5,
    chapterId: "ch05-warmth-sets-the-tone",
    title: "Warmth Sets the Tone",
    concept:
      "Use warmth in your presence and opening tone to create ease before trying to persuade, correct, or lead.",
  },
  {
    number: 6,
    chapterId: "ch06-names-build-recognition",
    title: "Names Build Recognition",
    concept:
      "Remember and use people's names because being recognized personally makes them feel seen rather than generic.",
  },
  {
    number: 7,
    chapterId: "ch07-listen-before-you-steer",
    title: "Listen Before You Steer",
    concept:
      "Listen long enough to uncover what actually matters to someone before trying to guide the conversation or outcome.",
  },
  {
    number: 8,
    chapterId: "ch08-speak-to-their-interests",
    title: "Speak to Their Interests",
    concept:
      "Keep attention by talking about topics and angles that genuinely interest the other person, not just what interests you.",
  },
  {
    number: 9,
    chapterId: "ch09-sincere-importance-builds-trust",
    title: "Sincere Importance Builds Trust",
    concept:
      "Make others feel sincerely important through small signs of respect so trust grows instead of pride or shame getting triggered.",
  },
  {
    number: 10,
    chapterId: "ch10-avoid-useless-arguments",
    title: "Avoid Useless Arguments",
    concept:
      "Drop arguments once the exchange turns ego-driven, because winning the point can cost the relationship.",
  },
  {
    number: 11,
    chapterId: "ch11-do-not-open-with-you-are-wrong",
    title: "Do Not Open With You Are Wrong",
    concept:
      "Correct people without opening with \"you're wrong,\" since direct contradiction creates resistance before understanding.",
  },
  {
    number: 12,
    chapterId: "ch12-admit-your-mistakes-quickly",
    title: "Admit Your Mistakes Quickly",
    concept:
      "Admit your mistakes quickly because fast accountability restores credibility and lowers tension better than self-protection.",
  },
  {
    number: 13,
    chapterId: "ch13-begin-in-a-friendly-way",
    title: "Begin in a Friendly Way",
    concept:
      "Start tense conversations in a friendly way so the tone lowers tension before substance is discussed.",
  },
  {
    number: 14,
    chapterId: "ch14-create-early-agreement",
    title: "Create Early Agreement",
    concept:
      "Find a small point of agreement early to create momentum and make later disagreement easier to handle.",
  },
  {
    number: 15,
    chapterId: "ch15-let-others-talk-fully",
    title: "Let Others Talk Fully",
    concept:
      "Let people talk past their first answer so hidden concerns and better information can surface.",
  },
  {
    number: 16,
    chapterId: "ch16-let-ideas-feel-shared",
    title: "Let Ideas Feel Shared",
    concept:
      "Present ideas so others can feel some ownership of them, which increases commitment and follow-through.",
  },
  {
    number: 17,
    chapterId: "ch17-see-the-other-point-of-view",
    title: "See the Other Point of View",
    concept:
      "Show the other person's point of view accurately to reduce status threat and make them more open to your position.",
  },
  {
    number: 18,
    chapterId: "ch18-respect-desires-without-surrender",
    title: "Respect Desires Without Surrender",
    concept:
      "Acknowledge what the other person wants and what they are protecting without giving up your own boundaries.",
  },
  {
    number: 19,
    chapterId: "ch19-appeal-to-better-motives",
    title: "Appeal to Better Motives",
    concept:
      "Appeal to better motives by giving people an honorable reason to act, rather than relying on cheap manipulation.",
  },
  {
    number: 20,
    chapterId: "ch20-make-ideas-vivid",
    title: "Make Ideas Vivid",
    concept:
      "Use vivid images and concrete examples so your message sticks in memory instead of fading as flat explanation.",
  },
  {
    number: 21,
    chapterId: "ch21-challenge-with-purpose",
    title: "Challenge With Purpose",
    concept:
      "Challenge people in a way that creates energy and effort, not pressure that feels meaningless or purely critical.",
  },
  {
    number: 22,
    chapterId: "ch22-start-correction-with-praise",
    title: "Start Correction With Praise",
    concept:
      "Begin correction with genuine praise so critique protects pride and lands without immediate defensiveness.",
  },
  {
    number: 23,
    chapterId: "ch23-point-out-problems-indirectly",
    title: "Point Out Problems Indirectly",
    concept:
      "Point out problems indirectly when direct public correction would embarrass someone and make change harder.",
  },
  {
    number: 24,
    chapterId: "ch24-share-your-own-mistakes-first",
    title: "Share Your Own Mistakes First",
    concept:
      "Share your own mistakes first to normalize humility and make honest feedback easier for others to hear.",
  },
  {
    number: 25,
    chapterId: "ch25-ask-instead-of-order",
    title: "Ask Instead of Order",
    concept:
      "Ask questions instead of giving orders so people keep agency and become more willing to cooperate.",
  },
  {
    number: 26,
    chapterId: "ch26-let-people-save-face",
    title: "Let People Save Face",
    concept:
      "Protect face during mistakes or conflict, because humiliation can do more damage than the original problem.",
  },
  {
    number: 27,
    chapterId: "ch27-praise-real-progress",
    title: "Praise Real Progress",
    concept:
      "Notice and praise real improvement early so progress gets reinforced instead of ignored.",
  },
  {
    number: 28,
    chapterId: "ch28-give-a-reputation-to-live-up-to",
    title: "Give a Reputation to Live Up To",
    concept:
      "Give someone a positive reputation to live up to so identity pulls behavior upward.",
  },
  {
    number: 29,
    chapterId: "ch29-make-change-feel-possible",
    title: "Make Change Feel Possible",
    concept:
      "Make improvement feel achievable by reducing fear and heaviness around change.",
  },
  {
    number: 30,
    chapterId: "ch30-make-cooperation-satisfying",
    title: "Make Cooperation Satisfying",
    concept:
      "Frame cooperation so the desired action feels satisfying and attractive, not like bare duty.",
  },
  {
    number: 31,
    chapterId: "ch31-letters-carry-tone-and-intent",
    title: "Letters Carry Tone and Intent",
    concept:
      "Treat written messages as carriers of tone and intent, because careless wording creates misunderstanding.",
  },
  {
    number: 32,
    chapterId: "ch32-write-with-respect-and-clarity",
    title: "Write With Respect and Clarity",
    concept:
      "Write with explicit respect and clear intent so your meaning survives the limits of text.",
  },
  {
    number: 33,
    chapterId: "ch33-use-praise-in-writing",
    title: "Use Praise in Writing",
    concept:
      "Use specific praise in writing to reinforce the exact behavior or contribution you want repeated.",
  },
  {
    number: 34,
    chapterId: "ch34-reduce-friction-in-hard-messages",
    title: "Reduce Friction in Hard Messages",
    concept:
      "Deliver hard messages with wording that lowers friction and resistance while staying direct.",
  },
  {
    number: 35,
    chapterId: "ch35-home-life-requires-patience",
    title: "Home Life Requires Patience",
    concept:
      "Practice patience at home because small resentments grow when everyday family life is taken for granted.",
  },
  {
    number: 36,
    chapterId: "ch36-respect-daily-kindness",
    title: "Respect Daily Kindness",
    concept:
      "Acknowledge daily acts of kindness consistently so care is felt in ordinary routines, not just big moments.",
  },
  {
    number: 37,
    chapterId: "ch37-protect-dignity-in-close-relationships",
    title: "Protect Dignity in Close Relationships",
    concept:
      "Protect dignity in close relationships by responding without contempt when trust is under strain.",
  },
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function writeText(filePath, value) {
  fs.writeFileSync(filePath, value.endsWith("\n") ? value : `${value}\n`);
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function zeroPad(number) {
  return String(number).padStart(2, "0");
}

function cleanText(value) {
  return String(value ?? "")
    .replace(/[—–]/g, ",")
    .replace(/\s+/g, " ")
    .trim();
}

function uniq(values) {
  return [...new Set(values)];
}

function collectSourceNotes(chapter) {
  const notes = [
    ...(chapter.contentVariants?.medium?.summaryBullets ?? []),
    ...(chapter.contentVariants?.medium?.takeaways ?? []),
    ...(chapter.contentVariants?.easy?.summaryBullets ?? []),
    ...(chapter.contentVariants?.medium?.practice ?? []),
  ]
    .map((item) => cleanText(item))
    .filter(Boolean);

  return uniq(notes).slice(0, 5);
}

function sectionLabel(number) {
  if (number <= 9) return "Relationships";
  if (number <= 21) return "Influence Without Resistance";
  if (number <= 30) return "Leadership Without Humiliation";
  if (number <= 34) return "Writing and Tone";
  return "Close Relationships";
}

function sectionSentence(number) {
  if (number <= 9) {
    return "The deeper lesson is that people become more open when they feel seen instead of managed.";
  }
  if (number <= 21) {
    return "The deeper lesson is that influence works better when ego threat drops and the other person can keep dignity.";
  }
  if (number <= 30) {
    return "The deeper lesson is that leadership means correcting behavior without humiliating the person who has to change.";
  }
  if (number <= 34) {
    return "The deeper lesson is that written words have to carry tone on their own because the reader cannot hear your voice.";
  }
  return "The deeper lesson is that private relationships are shaped by repeated small moments of respect or disrespect.";
}

function buildNamePool(index) {
  const start = (index * 3) % GLOBAL_NAME_POOL.length;
  const pool = [];
  for (let offset = 0; offset < 9; offset += 1) {
    pool.push(GLOBAL_NAME_POOL[(start + offset) % GLOBAL_NAME_POOL.length]);
  }
  return uniq(pool);
}

function buildPositionNote(index, chapters) {
  if (index === 0) {
    return "First chapter. No back-references needed. Preview teases Chapter 2.";
  }
  if (index === chapters.length - 1) {
    return "Last chapter. Standard and Deeper preview must be a full circle reflection connecting back to Chapter 1.";
  }
  const nextChapter = chapters[index + 1];
  return `Standard and Deeper breakdowns reference at least one earlier chapter. Preview teases Chapter ${nextChapter.number}: ${nextChapter.title}.`;
}

function buildMasterChapterListText(chapters) {
  return chapters
    .map((chapter) => `${chapter.number}. ${chapter.title}: ${chapter.conceptShort}`)
    .join("\n");
}

function buildChapterBriefs(packageJson) {
  const conceptMap = new Map(CONCEPTS.map((entry) => [entry.number, entry]));
  const totalChapters = packageJson.chapters.length;

  const base = packageJson.chapters.map((chapter, index) => {
    const conceptEntry = conceptMap.get(chapter.number);
    if (!conceptEntry) {
      throw new Error(`Missing concept entry for chapter ${chapter.number}`);
    }

    if (
      conceptEntry.chapterId !== chapter.chapterId ||
      conceptEntry.title !== chapter.title
    ) {
      throw new Error(
        `Concept map mismatch for chapter ${chapter.number}: ${conceptEntry.chapterId}/${conceptEntry.title}`
      );
    }

    const nn = zeroPad(chapter.number);
    return {
      chapterId: chapter.chapterId,
      number: chapter.number,
      title: chapter.title,
      conceptShort: conceptEntry.concept,
      conceptCore: `${conceptEntry.concept} ${sectionSentence(chapter.number)}`,
      section: sectionLabel(chapter.number),
      sourceNotes: collectSourceNotes(chapter),
      sourcePath: path.join(
        SOURCE_DIR,
        `${packageJson.book.bookId}-ch${nn}-source.json`
      ),
      briefPath: path.join(BRIEF_DIR, `${packageJson.book.bookId}-ch${nn}-brief.json`),
      contentPath: path.join("/tmp", `${packageJson.book.bookId}-ch${nn}-content.json`),
      quizPath: path.join("/tmp", `${packageJson.book.bookId}-ch${nn}-quiz.json`),
      mergedPath: path.join("/tmp", `${packageJson.book.bookId}-ch${nn}-merged.json`),
      finalPath: path.join("/tmp", `${packageJson.book.bookId}-ch${nn}-final.json`),
      namePool: buildNamePool(index),
      totalChapters,
    };
  });

  const chapterList = base.map((chapter) => ({
    number: chapter.number,
    title: chapter.title,
    conceptShort: chapter.conceptShort,
  }));
  const masterChapterListText = buildMasterChapterListText(base);

  return base.map((chapter, index) => ({
    ...chapter,
    allChapters: chapterList,
    masterChapterListText,
    previousChapter: index > 0 ? chapterList[index - 1] : null,
    nextChapter: index < chapterList.length - 1 ? chapterList[index + 1] : null,
    positionNote: buildPositionNote(index, chapterList),
  }));
}

function prepare() {
  const packageJson = readJson(SOURCE_PATH);
  ensureDir(TMP_DIR);
  ensureDir(BRIEF_DIR);
  ensureDir(SOURCE_DIR);

  const chapters = buildChapterBriefs(packageJson);

  for (const chapter of packageJson.chapters) {
    const brief = chapters.find((item) => item.number === chapter.number);
    writeJson(brief.sourcePath, chapter);
  }

  for (const brief of chapters) {
    writeJson(brief.briefPath, {
      bookId: packageJson.book.bookId,
      bookTitle: packageJson.book.title,
      author: packageJson.book.author,
      number: brief.number,
      chapterId: brief.chapterId,
      title: brief.title,
      section: brief.section,
      conceptShort: brief.conceptShort,
      conceptCore: brief.conceptCore,
      sourceNotes: brief.sourceNotes,
      sourcePath: brief.sourcePath,
      contentPath: brief.contentPath,
      quizPath: brief.quizPath,
      mergedPath: brief.mergedPath,
      finalPath: brief.finalPath,
      totalChapters: brief.totalChapters,
      previousChapter: brief.previousChapter,
      nextChapter: brief.nextChapter,
      positionNote: brief.positionNote,
      namePool: brief.namePool,
      allChapters: brief.allChapters,
      masterChapterListText: brief.masterChapterListText,
    });
  }

  writeJson(BRIEF_PATH, {
    sourcePath: SOURCE_PATH,
    outputPath: TARGET_PATH,
    tmpDir: TMP_DIR,
    book: packageJson.book,
    schemaVersion: packageJson.schemaVersion,
    packageId: packageJson.packageId,
    createdAt: packageJson.createdAt,
    contentOwner: packageJson.contentOwner,
    totalChapters: chapters.length,
    masterChapterListText: chapters[0]?.masterChapterListText ?? "",
    chapters: chapters.map((chapter) => ({
      number: chapter.number,
      chapterId: chapter.chapterId,
      title: chapter.title,
      conceptShort: chapter.conceptShort,
      briefPath: chapter.briefPath,
      sourcePath: chapter.sourcePath,
      contentPath: chapter.contentPath,
      quizPath: chapter.quizPath,
      mergedPath: chapter.mergedPath,
      finalPath: chapter.finalPath,
    })),
  });

  fs.writeFileSync(
    MASTER_LIST_PATH,
    `${chapters[0]?.masterChapterListText ?? ""}\n`
  );

  console.log(`Prepared rewrite workspace in ${TMP_DIR}`);
  console.log(`Chapters: ${chapters.length}`);
  console.log(`Brief file: ${BRIEF_PATH}`);
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

function tryParseJson(text) {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

function stripTrailingCommas(text) {
  let next = text;
  while (true) {
    const candidate = next.replace(/,\s*([}\]])/g, "$1");
    if (candidate === next) return next;
    next = candidate;
  }
}

function buildMissingClosers(text) {
  let inString = false;
  let escaped = false;
  const stack = [];

  for (const ch of text) {
    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        continue;
      }
      if (ch === "\"") {
        inString = false;
      }
      continue;
    }

    if (ch === "\"") {
      inString = true;
      continue;
    }

    if (ch === "{" || ch === "[") {
      stack.push(ch);
      continue;
    }

    if (ch === "}" || ch === "]") {
      stack.pop();
    }
  }

  return stack
    .reverse()
    .map((ch) => (ch === "{" ? "}" : "]"))
    .join("");
}

function repairJsonText(text) {
  let candidate = stripTrailingCommas(text);
  if (tryParseJson(candidate)) return candidate;

  const missingClosers = buildMissingClosers(candidate);
  if (missingClosers) {
    const withClosers = `${candidate}${missingClosers}`;
    if (tryParseJson(withClosers)) return withClosers;
  }

  return null;
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

  const chapterText = JSON.stringify(chapter);
  for (const assignedName of brief?.namePool ?? []) {
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
      const points =
        typeof takeaway === "string" ? [takeaway] : Object.values(takeaway.point ?? {});
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

function assertIdentity(next, chapter, filePath) {
  if (
    next.chapterId !== chapter.chapterId ||
    next.number !== chapter.number ||
    next.title !== chapter.title
  ) {
    throw new Error(
      `Chapter identity mismatch for ${filePath}. Expected ${chapter.chapterId}/${chapter.number}/${chapter.title}`
    );
  }
}

function mergeAll() {
  const packageJson = readJson(SOURCE_PATH);
  const briefs = buildChapterBriefs(packageJson);

  for (const chapter of packageJson.chapters) {
    const brief = briefs.find((item) => item.number === chapter.number);
    if (!fs.existsSync(brief.contentPath)) {
      throw new Error(`Missing content file: ${brief.contentPath}`);
    }
    if (!fs.existsSync(brief.quizPath)) {
      throw new Error(`Missing quiz file: ${brief.quizPath}`);
    }

    const content = readJson(brief.contentPath);
    const quiz = readJson(brief.quizPath);
    assertIdentity(content, chapter, brief.contentPath);

    const merged = {
      ...content,
      quiz,
    };
    writeJson(brief.mergedPath, merged);
  }

  console.log(`Merged content and quiz files for ${briefs.length} chapters`);
}

function repairStage(stage = "all") {
  const packageJson = readJson(SOURCE_PATH);
  const briefs = buildChapterBriefs(packageJson);
  const stageMap = {
    content: (brief) => brief.contentPath,
    quiz: (brief) => brief.quizPath,
    merged: (brief) => brief.mergedPath,
    final: (brief) => brief.finalPath,
  };

  const selectedStages =
    stage === "all" ? Object.keys(stageMap) : stage.split(",").map((item) => item.trim());
  const repaired = [];
  const unresolved = [];

  for (const brief of briefs) {
    for (const key of selectedStages) {
      const getPath = stageMap[key];
      if (!getPath) {
        throw new Error(`Unknown stage: ${key}`);
      }
      const filePath = getPath(brief);
      if (!fs.existsSync(filePath)) continue;

      const text = readText(filePath);
      if (tryParseJson(text)) continue;

      const next = repairJsonText(text);
      if (!next) {
        unresolved.push(filePath);
        continue;
      }

      writeText(filePath, next);
      repaired.push(filePath);
    }
  }

  console.log(`Repaired files: ${repaired.length}`);
  if (repaired.length > 0) {
    console.log(repaired.join("\n"));
  }
  console.log(`Unresolved files: ${unresolved.length}`);
  if (unresolved.length > 0) {
    console.log(unresolved.join("\n"));
  }
}

function assertParagraphCount(value, expected, pathLabel) {
  const count = String(value ?? "")
    .split(/\n\n+/)
    .filter((item) => item.trim()).length;
  if (count !== expected) {
    throw new Error(`${pathLabel} must have exactly ${expected} paragraphs`);
  }
}

function assertObject(value, pathLabel) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${pathLabel} must be an object`);
  }
}

function assertToneObject(value, pathLabel) {
  assertObject(value, pathLabel);
  for (const tone of ["gentle", "direct", "competitive"]) {
    if (typeof value[tone] !== "string" || !value[tone].trim()) {
      throw new Error(`${pathLabel}.${tone} must be a non-empty string`);
    }
  }
}

function assertTakeawayArray(items, min, max, pathLabel, requireMoreDetails) {
  if (!Array.isArray(items) || items.length < min || items.length > max) {
    throw new Error(`${pathLabel} must contain between ${min} and ${max} items`);
  }

  for (const [index, item] of items.entries()) {
    assertObject(item, `${pathLabel}[${index}]`);
    assertToneObject(item.point, `${pathLabel}[${index}].point`);
    if (requireMoreDetails) {
      assertToneObject(item.moreDetails, `${pathLabel}[${index}].moreDetails`);
      continue;
    }
    if ("moreDetails" in item) {
      throw new Error(`${pathLabel}[${index}] must not include moreDetails`);
    }
  }
}

function assertExamples(examples, chapterNumber) {
  if (!Array.isArray(examples) || examples.length !== 6) {
    throw new Error(`Chapter ${chapterNumber} must include exactly 6 examples`);
  }

  const formats = new Set();
  const categories = { work: 0, school: 0, personal: 0 };
  for (const example of examples) {
    assertToneObject(example.scenario, `Chapter ${chapterNumber} example ${example.exampleId}.scenario`);
    assertToneObject(example.whatToDo, `Chapter ${chapterNumber} example ${example.exampleId}.whatToDo`);
    assertToneObject(
      example.whyItMatters,
      `Chapter ${chapterNumber} example ${example.exampleId}.whyItMatters`
    );
    formats.add(example.format);
    if (example.category && categories[example.category] != null) {
      categories[example.category] += 1;
    }
  }

  if (formats.size !== 6) {
    throw new Error(`Chapter ${chapterNumber} examples must use 6 unique formats`);
  }
  if (categories.work !== 2 || categories.school !== 2 || categories.personal !== 2) {
    throw new Error(`Chapter ${chapterNumber} examples must be 2 work, 2 school, 2 personal`);
  }
}

function assertReviewCards(cards, chapterNumber) {
  if (!Array.isArray(cards) || cards.length !== 5) {
    throw new Error(`Chapter ${chapterNumber} must include exactly 5 review cards`);
  }

  const counts = { easy: 0, medium: 0, hard: 0 };
  for (const card of cards) {
    assertToneObject(card.front, `Chapter ${chapterNumber} review card ${card.cardId}.front`);
    assertToneObject(card.back, `Chapter ${chapterNumber} review card ${card.cardId}.back`);
    if (!counts.hasOwnProperty(card.difficulty)) {
      throw new Error(`Chapter ${chapterNumber} review card ${card.cardId} has invalid difficulty`);
    }
    counts[card.difficulty] += 1;
  }

  if (counts.easy !== 2 || counts.medium !== 2 || counts.hard !== 1) {
    throw new Error(`Chapter ${chapterNumber} review cards must be 2 easy, 2 medium, 1 hard`);
  }
}

function assertQuiz(quiz, chapterNumber) {
  assertObject(quiz, `Chapter ${chapterNumber}.quiz`);
  if (!Array.isArray(quiz.questions) || quiz.questions.length !== 10) {
    throw new Error(`Chapter ${chapterNumber} must include exactly 10 quiz questions`);
  }
  for (const [index, question] of quiz.questions.entries()) {
    if (!Array.isArray(question.choices) || question.choices.length !== 3) {
      throw new Error(
        `Chapter ${chapterNumber} quiz question ${index + 1} must have exactly 3 choices`
      );
    }
    assertToneObject(
      question.explanation,
      `Chapter ${chapterNumber} quiz question ${index + 1}.explanation`
    );
  }
}

function assertImplementationPlan(plan, chapterNumber) {
  assertObject(plan, `Chapter ${chapterNumber}.implementationPlan`);
  assertToneObject(plan.coreSkill, `Chapter ${chapterNumber}.implementationPlan.coreSkill`);
  if (!Array.isArray(plan.ifThenPlans) || plan.ifThenPlans.length !== 3) {
    throw new Error(`Chapter ${chapterNumber} must include 3 ifThenPlans`);
  }
  for (const [index, item] of plan.ifThenPlans.entries()) {
    assertToneObject(
      item.plan,
      `Chapter ${chapterNumber}.implementationPlan.ifThenPlans[${index}].plan`
    );
  }
  assertToneObject(
    plan.twentyFourHourChallenge,
    `Chapter ${chapterNumber}.implementationPlan.twentyFourHourChallenge`
  );
  assertToneObject(
    plan.weeklyPractice,
    `Chapter ${chapterNumber}.implementationPlan.weeklyPractice`
  );
}

function assertVariantStructure(chapter) {
  const easy = chapter.contentVariants?.easy;
  const medium = chapter.contentVariants?.medium;
  const hard = chapter.contentVariants?.hard;

  assertObject(easy, `Chapter ${chapter.number}.contentVariants.easy`);
  assertObject(medium, `Chapter ${chapter.number}.contentVariants.medium`);
  assertObject(hard, `Chapter ${chapter.number}.contentVariants.hard`);

  assertToneObject(easy.chapterBreakdown, `Chapter ${chapter.number}.easy.chapterBreakdown`);
  assertTakeawayArray(
    easy.keyTakeaways,
    3,
    3,
    `Chapter ${chapter.number}.easy.keyTakeaways`,
    false
  );
  assertToneObject(easy.oneMinuteRecap, `Chapter ${chapter.number}.easy.oneMinuteRecap`);
  for (const tone of ["gentle", "direct", "competitive"]) {
    assertParagraphCount(
      easy.chapterBreakdown[tone],
      2,
      `Chapter ${chapter.number}.easy.chapterBreakdown.${tone}`
    );
  }

  assertToneObject(medium.chapterBreakdown, `Chapter ${chapter.number}.medium.chapterBreakdown`);
  assertTakeawayArray(
    medium.keyTakeaways,
    5,
    7,
    `Chapter ${chapter.number}.medium.keyTakeaways`,
    true
  );
  assertToneObject(medium.activationPrompt, `Chapter ${chapter.number}.medium.activationPrompt`);
  assertToneObject(medium.selfCheckPrompt, `Chapter ${chapter.number}.medium.selfCheckPrompt`);
  assertObject(medium.oneMinuteRecap, `Chapter ${chapter.number}.medium.oneMinuteRecap`);
  assertToneObject(
    medium.oneMinuteRecap.retrieve,
    `Chapter ${chapter.number}.medium.oneMinuteRecap.retrieve`
  );
  assertToneObject(
    medium.oneMinuteRecap.connect,
    `Chapter ${chapter.number}.medium.oneMinuteRecap.connect`
  );
  assertToneObject(
    medium.oneMinuteRecap.preview,
    `Chapter ${chapter.number}.medium.oneMinuteRecap.preview`
  );

  assertToneObject(hard.chapterBreakdown, `Chapter ${chapter.number}.hard.chapterBreakdown`);
  assertTakeawayArray(
    hard.keyTakeaways,
    7,
    10,
    `Chapter ${chapter.number}.hard.keyTakeaways`,
    true
  );
  assertToneObject(hard.activationPrompt, `Chapter ${chapter.number}.hard.activationPrompt`);
  if (!Array.isArray(hard.selfCheckPrompts) || hard.selfCheckPrompts.length !== 2) {
    throw new Error(`Chapter ${chapter.number}.hard.selfCheckPrompts must contain exactly 2 items`);
  }
  for (const [index, prompt] of hard.selfCheckPrompts.entries()) {
    assertToneObject(prompt, `Chapter ${chapter.number}.hard.selfCheckPrompts[${index}]`);
  }
  assertToneObject(hard.predictionPrompt, `Chapter ${chapter.number}.hard.predictionPrompt`);
  assertObject(hard.oneMinuteRecap, `Chapter ${chapter.number}.hard.oneMinuteRecap`);
  assertToneObject(
    hard.oneMinuteRecap.retrieve,
    `Chapter ${chapter.number}.hard.oneMinuteRecap.retrieve`
  );
  assertToneObject(
    hard.oneMinuteRecap.connect,
    `Chapter ${chapter.number}.hard.oneMinuteRecap.connect`
  );
  assertToneObject(
    hard.oneMinuteRecap.preview,
    `Chapter ${chapter.number}.hard.oneMinuteRecap.preview`
  );
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
    throw new Error(`Quoted chapter title found in quiz prompts:\n${badPrompts.join("\n")}`);
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
    throw new Error(`Generic moreDetails remained:\n${badPaths.join("\n")}`);
  }
}

function assemble() {
  const current = readJson(SOURCE_PATH);
  const briefs = buildChapterBriefs(current);
  const briefMap = new Map(briefs.map((brief) => [brief.number, brief]));

  const chapters = current.chapters.map((chapter) => {
    const brief = briefMap.get(chapter.number);
    if (!fs.existsSync(brief.finalPath)) {
      throw new Error(`Missing final chapter file: ${brief.finalPath}`);
    }
    const next = readJson(brief.finalPath);
    assertIdentity(next, chapter, brief.finalPath);
    assertVariantStructure(next);
    assertExamples(next.examples, next.number);
    assertQuiz(next.quiz, next.number);
    assertImplementationPlan(next.implementationPlan, next.number);
    assertReviewCards(next.reviewCards, next.number);
    assertToneObject(next.keyTakeawayCard, `Chapter ${next.number}.keyTakeawayCard`);
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
  const nameReplacements = renameRepeatedCharacterNames(cleaned.chapters, briefMap);
  validateQuizPrompts(cleaned.chapters);
  validateGenericMoreDetails(cleaned.chapters);

  writeJson(TARGET_PATH, cleaned);

  console.log(`Assembled ${cleaned.chapters.length} chapters into ${TARGET_PATH}`);
  console.log(`Character renames: ${nameReplacements.length}`);
  if (nameReplacements.length > 0) {
    console.log(nameReplacements.join("\n"));
  }
}

function status() {
  const packageJson = readJson(SOURCE_PATH);
  const briefs = buildChapterBriefs(packageJson);
  const counts = {
    content: 0,
    quiz: 0,
    merged: 0,
    final: 0,
  };

  for (const brief of briefs) {
    if (fs.existsSync(brief.contentPath)) counts.content += 1;
    if (fs.existsSync(brief.quizPath)) counts.quiz += 1;
    if (fs.existsSync(brief.mergedPath)) counts.merged += 1;
    if (fs.existsSync(brief.finalPath)) counts.final += 1;
  }

  console.log(JSON.stringify({ tmpDir: TMP_DIR, targetPath: TARGET_PATH, counts }, null, 2));
}

const command = process.argv[2] ?? "status";

if (command === "prepare") {
  prepare();
} else if (command === "merge") {
  mergeAll();
} else if (command === "assemble") {
  assemble();
} else if (command === "repair") {
  repairStage(process.argv[3] ?? "all");
} else if (command === "status") {
  status();
} else {
  console.error(
    "Usage: node scripts/book/rewrite-friends-and-influence.mjs [prepare|merge|assemble|repair|status]"
  );
  process.exitCode = 1;
}
