#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const BOOK_PATH = path.join(ROOT, "book-packages", "never-split-the-difference.modern.json");
const NAME_POOL = [
  "Amina",
  "Noah",
  "Selene",
  "Mateo",
  "Iris",
  "Jonah",
  "Leona",
  "Darius",
  "Nadia",
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
  "You",
  "Your",
]);

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
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, walkStrings(item, visitor)]));
  }
  return value;
}

function replaceDashes(value) {
  return walkStrings(value, (text) =>
    text
      .replace(/[—–]/g, ",")
      .replace(/\s+,/g, ",")
      .replace(/,\s*,/g, ",")
  );
}

function findLeadNames(chapter) {
  const names = new Set();
  for (const example of chapter.examples ?? []) {
    const title = String(example.title ?? "");
    for (const match of title.matchAll(/\b([A-Z][a-z]+)(?=[’']s\b|\sand\b|\sfaces\b|\stransforms\b|\sneeds\b|\sgets\b|\swon't\b|\swont\b)/g)) {
      const name = match[1];
      if (!STOPWORDS.has(name)) names.add(name);
    }
  }
  return [...names];
}

function replaceWholeWord(text, from, to) {
  return text.replace(new RegExp(`\\b${escapeRegExp(from)}\\b`, "g"), to);
}

function renameChapterLeadNames(chapters) {
  const replacements = [];
  const usedNames = new Set();

  for (const chapter of chapters) {
    const chapterLeadNames = findLeadNames(chapter);
    const renameMap = new Map();

    for (const name of chapterLeadNames) {
      if (!usedNames.has(name)) {
        usedNames.add(name);
        continue;
      }

      const replacement = NAME_POOL.find((candidate) => !usedNames.has(candidate) && !chapterLeadNames.includes(candidate));
      if (!replacement) continue;
      usedNames.add(replacement);
      renameMap.set(name, replacement);
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
  const chapterTitles = chapters.map((chapter) => chapter.title).filter(Boolean);
  const badPrompts = [];

  for (const chapter of chapters) {
    for (const question of chapter.quiz?.questions ?? []) {
      const prompt = String(question.prompt ?? "");
      for (const title of chapterTitles) {
        const quotedTitlePatterns = [
          `"${title}"`,
          `'${title}'`,
          `“${title}”`,
          `‘${title}’`,
        ];
        if (quotedTitlePatterns.some((pattern) => prompt.includes(pattern))) {
          badPrompts.push(`${question.questionId}: ${prompt}`);
          break;
        }
      }
    }
  }

  if (badPrompts.length > 0) {
    throw new Error(`Quoted chapter title found in quiz prompts:\n${badPrompts.join("\n")}`);
  }
}

function assemble() {
  const current = readJson(BOOK_PATH);
  const bookId = current.book?.bookId;
  const originals = current.chapters ?? [];

  const chapters = originals.map((chapter) => {
    const tmpPath = path.join("/tmp", `${bookId}-ch${zeroPad(chapter.number)}.json`);
    if (!fs.existsSync(tmpPath)) {
      throw new Error(`Missing reviewed chapter file: ${tmpPath}`);
    }
    const next = readJson(tmpPath);
    if (next.chapterId !== chapter.chapterId || next.number !== chapter.number || next.title !== chapter.title) {
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
  const nameReplacements = renameChapterLeadNames(cleaned.chapters);
  validateQuizPrompts(cleaned.chapters);
  writeJson(BOOK_PATH, cleaned);

  console.log(`Assembled ${cleaned.chapters.length} chapters into ${BOOK_PATH}`);
  if (nameReplacements.length > 0) {
    console.log(`Renamed repeated lead names:\n${nameReplacements.join("\n")}`);
  }
}

assemble();
