#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = process.cwd();
const DATA_PATH = path.join(
  ROOT,
  "scripts",
  "book",
  "data",
  "friends-and-influence-37-approved.json"
);

const data = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));

const BOOK_ID = data.bookId;
const MASTER_BRIEF_PATH = path.join("/tmp", `${BOOK_ID}-master-brief.json`);
const CONTINUITY_LEDGER_PATH = path.join("/tmp", `${BOOK_ID}-continuity-ledger.json`);
const REFERENCE_REPORT_PATH = path.join("/tmp", `${BOOK_ID}-phase0-reference-report.json`);
const CONTENT_PROMPT_PATH = path.join(
  ROOT,
  "scripts",
  "book",
  "prompts",
  "friends-and-influence-37-content-agent.md"
);
const QUIZ_PROMPT_PATH = path.join(
  ROOT,
  "scripts",
  "book",
  "prompts",
  "friends-and-influence-37-quiz-agent.md"
);
const VALIDATOR_PROMPT_PATH = path.join(
  ROOT,
  "scripts",
  "book",
  "prompts",
  "friends-and-influence-37-validator-agent.md"
);

const REQUIRED_EXAMPLE_FORMATS = [
  "decision_point",
  "postmortem",
  "dialogue",
  "predict_reveal",
  "dilemma",
  "before_after",
];

const REQUIRED_ENDING_TYPES = [
  "broader principle",
  "self-directed question",
  "surprising implication",
  "cross-domain connection",
  "common trap warning",
  "perspective reframe",
];

const BANNED_PHRASES = [
  "delve",
  "crucial",
  "landscape",
  "realm",
  "It's worth noting",
  "In today's world",
  "It's important to remember",
  "This highlights the importance of",
  "Furthermore",
  "Moreover",
  "In conclusion",
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
  "This matters because",
  "This is significant because",
  "it is essential to",
];

const HOOK_BAD_PREFIXES = [
  "this chapter",
  "the author argues",
  "in this chapter",
  "chapter ",
];

const QUIZ_BANNED_PROMPT_PATTERNS = [
  /realistic situation for/i,
  /best applies/i,
  /best puts/i,
  /best reflects/i,
  /real-world decision tied to/i,
];

const IMPERFECT_OUTCOME_PATTERNS = [
  /\bstill\b/i,
  /\bdid not\b/i,
  /\bdidn't\b/i,
  /\bnot tidy\b/i,
  /\bawkward\b/i,
  /\bmessy\b/i,
  /\bpartial\b/i,
  /\blingered\b/i,
  /\bunresolved\b/i,
];

const RUNTIME_FACING_PATHS = new Set([
  "app/book/data/bookPackages.ts",
  "components/library/libraryData.ts",
  "components/website/BrowseLibraryPage.tsx",
]);

function zeroPad(value) {
  return String(value).padStart(2, "0");
}

function slugify(value) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function unique(values) {
  return [...new Set(values)];
}

function resolveToneText(value, tone = "direct") {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    if (typeof value[tone] === "string") return value[tone];
    for (const key of ["direct", "gentle", "competitive"]) {
      if (typeof value[key] === "string") return value[key];
    }
  }
  return "";
}

function splitParagraphs(value) {
  return resolveToneText(value)
    .split(/\n\n+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getFirstSentence(text) {
  return String(text).trim().split(/(?<=[.!?])\s+/)[0] ?? "";
}

function getLastSentence(text) {
  const parts = String(text).trim().split(/(?<=[.!?])\s+/).filter(Boolean);
  return parts[parts.length - 1] ?? "";
}

function normalizeSentence(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function walkStrings(value, visitor, currentPath = []) {
  if (typeof value === "string") {
    visitor(value, currentPath.join("."));
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkStrings(item, visitor, [...currentPath, String(index)]));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      walkStrings(item, visitor, [...currentPath, key]);
    }
  }
}

function buildAssignedNamePools() {
  const namesPerChapter = 8;
  let cursor = 0;
  const pools = new Map();

  for (const chapter of data.chapters) {
    const names = [];
    for (let count = 0; count < namesPerChapter; count += 1) {
      names.push(data.globalNamePool[cursor % data.globalNamePool.length]);
      cursor += 1;
    }
    pools.set(chapter.number, names);
  }

  return pools;
}

function buildContinuityLedger() {
  const namePools = buildAssignedNamePools();
  const chapterList = data.chapters.map((chapter) => ({
    number: chapter.number,
    title: chapter.title,
    principle: chapter.principle,
  }));

  return {
    bookId: BOOK_ID,
    title: data.title,
    author: data.author,
    locked37ChapterScope: true,
    nameReuseLimit: 2,
    requiredExampleFormats: REQUIRED_EXAMPLE_FORMATS,
    requiredEndingTypes: REQUIRED_ENDING_TYPES,
    bannedPhrases: BANNED_PHRASES,
    chapterCount: data.chapters.length,
    generationOrder: chapterList,
    previewRules: {
      firstChapter: "Preview must tease Chapter 2 without wrapping up the lesson neatly.",
      middleChapters:
        "Medium and hard previews must open a loop toward the next numbered chapter and mention at least one prior chapter from Chapter 2 onward.",
      lastChapter:
        "Medium and hard previews must make a full-circle reflection back to Chapter 1 instead of teasing a non-existent next chapter.",
    },
    exampleRules: {
      categories: {
        work: 2,
        school: 2,
        personal: 2,
      },
      formats: REQUIRED_EXAMPLE_FORMATS,
      atLeastOneDialogue: true,
      atLeastOneImperfectOutcome: true,
    },
    chapters: data.chapters.map((chapter, index) => ({
      number: chapter.number,
      title: chapter.title,
      partLabel: chapter.partLabel,
      partTitle: chapter.partTitle,
      previewTarget:
        index === data.chapters.length - 1
          ? {
              kind: "full_circle",
              targetChapterNumber: 1,
              targetChapterTitle: data.chapters[0].title,
            }
          : {
              kind: "next_chapter",
              targetChapterNumber: data.chapters[index + 1].number,
              targetChapterTitle: data.chapters[index + 1].title,
            },
      callbackTargets:
        index === 0
          ? []
          : unique(
              [
                data.chapters[index - 1].number,
                index > 1 ? data.chapters[index - 2].number : null,
              ].filter(Boolean)
            ),
      assignedNamePool: namePools.get(chapter.number),
    })),
    promptPaths: {
      content: CONTENT_PROMPT_PATH,
      quiz: QUIZ_PROMPT_PATH,
      validator: VALIDATOR_PROMPT_PATH,
    },
  };
}

function buildChapterBriefs() {
  const continuity = buildContinuityLedger();

  return data.chapters.map((chapter, index) => {
    const nn = zeroPad(chapter.number);
    const chapterId = `ch${nn}-${slugify(chapter.title)}`;
    const previousChapter = index > 0 ? data.chapters[index - 1] : null;
    const nextChapter = index < data.chapters.length - 1 ? data.chapters[index + 1] : null;

    return {
      bookId: BOOK_ID,
      chapterId,
      number: chapter.number,
      title: chapter.title,
      author: data.author,
      bookTitle: data.title,
      editionLabel: data.editionLabel,
      partLabel: chapter.partLabel,
      partTitle: chapter.partTitle,
      chapterCount: data.chapters.length,
      coreConcept: chapter.coreConcept,
      sourceAnecdotes: chapter.keyStory
        .split(";")
        .map((item) => item.trim())
        .filter(Boolean),
      keyStory: chapter.keyStory,
      principle: chapter.principle,
      quoteCandidate: chapter.quoteCandidate,
      misconceptionNote: chapter.misconception,
      previousChapter: previousChapter
        ? {
            number: previousChapter.number,
            title: previousChapter.title,
            principle: previousChapter.principle,
          }
        : null,
      nextChapter: nextChapter
        ? {
            number: nextChapter.number,
            title: nextChapter.title,
            principle: nextChapter.principle,
          }
        : null,
      previewTarget:
        nextChapter == null
          ? {
              kind: "full_circle",
              targetChapterNumber: 1,
              targetChapterTitle: data.chapters[0].title,
            }
          : {
              kind: "next_chapter",
              targetChapterNumber: nextChapter.number,
              targetChapterTitle: nextChapter.title,
            },
      positionNote:
        index === 0
          ? "First chapter. No backward references. Preview must open curiosity about Chapter 2."
          : index === data.chapters.length - 1
            ? "Last chapter. Medium and hard previews must close the loop back to Chapter 1."
            : `Reference at least one earlier chapter. Preview must tease Chapter ${nextChapter.number}: ${nextChapter.title}.`,
      assignedNamePool: continuity.chapters[index].assignedNamePool,
      requiredExampleFormats: REQUIRED_EXAMPLE_FORMATS,
      requiredEndingTypes: REQUIRED_ENDING_TYPES,
      contentPath: path.join("/tmp", `${BOOK_ID}-ch${nn}-content.json`),
      quizPath: path.join("/tmp", `${BOOK_ID}-ch${nn}-quiz.json`),
      mergedPath: path.join("/tmp", `${BOOK_ID}-ch${nn}-merged.json`),
      finalPath: path.join("/tmp", `${BOOK_ID}-ch${nn}-final.json`),
      promptPaths: {
        content: CONTENT_PROMPT_PATH,
        quiz: QUIZ_PROMPT_PATH,
        validator: VALIDATOR_PROMPT_PATH,
      },
      allChapters: data.chapters.map((item) => ({
        number: item.number,
        title: item.title,
        principle: item.principle,
      })),
    };
  });
}

function writeBriefs() {
  const chapterBriefs = buildChapterBriefs();
  const continuity = buildContinuityLedger();

  const masterBrief = {
    bookId: BOOK_ID,
    title: data.title,
    author: data.author,
    editionLabel: data.editionLabel,
    editionKey: data.editionKey,
    variantFamily: data.variantFamily,
    chapterCount: data.chapters.length,
    chapterOrder: chapterBriefs.map((brief) => ({
      number: brief.number,
      chapterId: brief.chapterId,
      title: brief.title,
      principle: brief.principle,
      contentPath: brief.contentPath,
      quizPath: brief.quizPath,
      finalPath: brief.finalPath,
    })),
    requiredExampleFormats: REQUIRED_EXAMPLE_FORMATS,
    requiredEndingTypes: REQUIRED_ENDING_TYPES,
    promptPaths: {
      content: CONTENT_PROMPT_PATH,
      quiz: QUIZ_PROMPT_PATH,
      validator: VALIDATOR_PROMPT_PATH,
    },
    chapterBriefPaths: chapterBriefs.map((brief) =>
      path.join("/tmp", `${BOOK_ID}-ch${zeroPad(brief.number)}-brief.json`)
    ),
  };

  writeJson(MASTER_BRIEF_PATH, masterBrief);
  writeJson(CONTINUITY_LEDGER_PATH, continuity);

  for (const brief of chapterBriefs) {
    writeJson(path.join("/tmp", `${BOOK_ID}-ch${zeroPad(brief.number)}-brief.json`), brief);
  }

  console.log(
    JSON.stringify(
      {
        masterBriefPath: MASTER_BRIEF_PATH,
        continuityLedgerPath: CONTINUITY_LEDGER_PATH,
        chapterBriefCount: chapterBriefs.length,
      },
      null,
      2
    )
  );
}

function scanReferences() {
  const rgOutput = execFileSync(
    "rg",
    [
      "-n",
      "friends-and-influence-student-edition|How to Win Friends and Influence People|friendsAndInfluencePackageJson|FRIENDS_AND_INFLUENCE_PACKAGE",
      "app",
      "components",
      "scripts",
      "docs",
      "public",
      "book-packages",
    ],
    { cwd: ROOT, encoding: "utf8" }
  );

  const matches = rgOutput
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [file, lineNumber, ...rest] = line.split(":");
      return {
        file,
        line: Number(lineNumber),
        text: rest.join(":").trim(),
        runtimeFacing: RUNTIME_FACING_PATHS.has(file),
      };
    });

  const report = {
    bookId: BOOK_ID,
    generatedAt: new Date().toISOString(),
    referenceCount: matches.length,
    runtimeFacingCount: matches.filter((entry) => entry.runtimeFacing).length,
    matches,
  };

  writeJson(REFERENCE_REPORT_PATH, report);
  console.log(JSON.stringify(report, null, 2));
}

function ensureToneObject(value, pathLabel, issues) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    issues.push(`${pathLabel} must be a tone object`);
    return;
  }
  for (const tone of ["gentle", "direct", "competitive"]) {
    if (typeof value[tone] !== "string" || value[tone].trim().length === 0) {
      issues.push(`${pathLabel}.${tone} must be a non-empty string`);
    }
  }
}

function validateTakeawayArray(items, expectedMin, expectedMax, pathLabel, requireMoreDetails, issues) {
  if (!Array.isArray(items)) {
    issues.push(`${pathLabel} must be an array`);
    return;
  }

  if (items.length < expectedMin || items.length > expectedMax) {
    issues.push(`${pathLabel} length must be ${expectedMin}-${expectedMax}, found ${items.length}`);
  }

  for (const [index, item] of items.entries()) {
    ensureToneObject(item?.point, `${pathLabel}[${index}].point`, issues);
    if (requireMoreDetails) {
      ensureToneObject(item?.moreDetails, `${pathLabel}[${index}].moreDetails`, issues);
      for (const tone of ["gentle", "direct", "competitive"]) {
        const text = item?.moreDetails?.[tone] ?? "";
        if (!/[A-Z][a-z]+/.test(text)) {
          issues.push(`${pathLabel}[${index}].moreDetails.${tone} must include a named character`);
        }
        if (String(text).split(/[.!?]/).filter(Boolean).length < 2) {
          issues.push(`${pathLabel}[${index}].moreDetails.${tone} must contain at least 2 sentences`);
        }
      }
    } else if (item && Object.hasOwn(item, "moreDetails")) {
      issues.push(`${pathLabel}[${index}] must not include moreDetails`);
    }
  }
}

function validateExamples(examples, chapterNumber, issues) {
  const pathLabel = `Chapter ${chapterNumber}.examples`;
  if (!Array.isArray(examples) || examples.length !== 6) {
    issues.push(`${pathLabel} must contain exactly 6 examples`);
    return;
  }

  const categories = { work: 0, school: 0, personal: 0 };
  const formats = [];
  let hasDialogue = false;
  let hasImperfectOutcome = false;
  const whatToDoClosers = [];
  const whyItMattersClosers = [];

  for (const [index, example] of examples.entries()) {
    if (!example?.title || !/[A-Z][a-z]+/.test(example.title)) {
      issues.push(`${pathLabel}[${index}].title must include a character name`);
    }

    if (!example?.category || !(example.category in categories)) {
      issues.push(`${pathLabel}[${index}].category must be work, school, or personal`);
    } else {
      categories[example.category] += 1;
    }

    if (!REQUIRED_EXAMPLE_FORMATS.includes(example?.format)) {
      issues.push(`${pathLabel}[${index}].format must be one of the required formats`);
    } else {
      formats.push(example.format);
    }

    ensureToneObject(example?.scenario, `${pathLabel}[${index}].scenario`, issues);
    ensureToneObject(example?.whatToDo, `${pathLabel}[${index}].whatToDo`, issues);
    ensureToneObject(example?.whyItMatters, `${pathLabel}[${index}].whyItMatters`, issues);

    if (example?.format === "dialogue") {
      hasDialogue = true;
    }

    const scenarioDirect = resolveToneText(example?.scenario, "direct");
    const sensoryHits = [
      "smell",
      "sound",
      "sun",
      "glass",
      "rain",
      "click",
      "quiet",
      "cold",
      "warm",
      "jaw",
      "stared",
      "voice",
      "floor",
      "window",
    ];
    const sensoryCount = sensoryHits.filter((token) =>
      scenarioDirect.toLowerCase().includes(token)
    ).length;

    if (scenarioDirect.split(/\s+/).length < 40) {
      issues.push(`${pathLabel}[${index}].scenario.direct is too thin`);
    }

    if (sensoryCount < 1) {
      issues.push(`${pathLabel}[${index}].scenario.direct should include at least one sensory detail`);
    }

    const whatToDoCloser = normalizeSentence(getLastSentence(resolveToneText(example?.whatToDo)));
    const whyItMattersCloser = normalizeSentence(
      getLastSentence(resolveToneText(example?.whyItMatters))
    );
    if (whatToDoCloser) whatToDoClosers.push(whatToDoCloser);
    if (whyItMattersCloser) whyItMattersClosers.push(whyItMattersCloser);

    const mergedText = [
      resolveToneText(example?.scenario),
      resolveToneText(example?.whatToDo),
      resolveToneText(example?.whyItMatters),
    ].join(" ");
    if (IMPERFECT_OUTCOME_PATTERNS.some((pattern) => pattern.test(mergedText))) {
      hasImperfectOutcome = true;
    }
  }

  for (const [category, count] of Object.entries(categories)) {
    if (count !== 2) {
      issues.push(`${pathLabel} must contain exactly 2 ${category} examples`);
    }
  }

  if (unique(formats).length !== REQUIRED_EXAMPLE_FORMATS.length) {
    issues.push(`${pathLabel} must use each required format exactly once`);
  }

  if (!hasDialogue) {
    issues.push(`${pathLabel} must include at least one dialogue example`);
  }

  if (!hasImperfectOutcome) {
    issues.push(`${pathLabel} must include at least one imperfect outcome`);
  }

  if (unique(whatToDoClosers).length !== whatToDoClosers.length) {
    issues.push(`${pathLabel} has repeated whatToDo closing sentences`);
  }

  if (unique(whyItMattersClosers).length !== whyItMattersClosers.length) {
    issues.push(`${pathLabel} has repeated whyItMatters closing sentences`);
  }
}

function validateChapterStructure(chapter, issues) {
  if (!chapter || typeof chapter !== "object") {
    issues.push("Chapter payload must be an object");
    return;
  }

  if (typeof chapter.chapterId !== "string" || chapter.chapterId.length === 0) {
    issues.push("chapterId is required");
  }
  if (typeof chapter.number !== "number") {
    issues.push("number is required");
  }
  if (typeof chapter.title !== "string" || chapter.title.length === 0) {
    issues.push("title is required");
  }
  if (typeof chapter.readingTimeMinutes !== "number") {
    issues.push("readingTimeMinutes is required");
  }

  const easy = chapter?.contentVariants?.easy;
  const medium = chapter?.contentVariants?.medium;
  const hard = chapter?.contentVariants?.hard;

  ensureToneObject(easy?.chapterBreakdown, "easy.chapterBreakdown", issues);
  validateTakeawayArray(easy?.keyTakeaways, 3, 3, "easy.keyTakeaways", false, issues);
  ensureToneObject(easy?.oneMinuteRecap, "easy.oneMinuteRecap", issues);

  ensureToneObject(medium?.chapterBreakdown, "medium.chapterBreakdown", issues);
  validateTakeawayArray(medium?.keyTakeaways, 5, 7, "medium.keyTakeaways", true, issues);
  ensureToneObject(medium?.activationPrompt, "medium.activationPrompt", issues);
  ensureToneObject(medium?.selfCheckPrompt, "medium.selfCheckPrompt", issues);
  ensureToneObject(medium?.oneMinuteRecap?.retrieve, "medium.oneMinuteRecap.retrieve", issues);
  ensureToneObject(medium?.oneMinuteRecap?.connect, "medium.oneMinuteRecap.connect", issues);
  ensureToneObject(medium?.oneMinuteRecap?.preview, "medium.oneMinuteRecap.preview", issues);

  ensureToneObject(hard?.chapterBreakdown, "hard.chapterBreakdown", issues);
  validateTakeawayArray(hard?.keyTakeaways, 7, 10, "hard.keyTakeaways", true, issues);
  ensureToneObject(hard?.activationPrompt, "hard.activationPrompt", issues);
  if (!Array.isArray(hard?.selfCheckPrompts) || hard.selfCheckPrompts.length !== 2) {
    issues.push("hard.selfCheckPrompts must contain exactly 2 items");
  } else {
    hard.selfCheckPrompts.forEach((item, index) => {
      ensureToneObject(item, `hard.selfCheckPrompts[${index}]`, issues);
    });
  }
  ensureToneObject(hard?.predictionPrompt, "hard.predictionPrompt", issues);
  ensureToneObject(hard?.oneMinuteRecap?.retrieve, "hard.oneMinuteRecap.retrieve", issues);
  ensureToneObject(hard?.oneMinuteRecap?.connect, "hard.oneMinuteRecap.connect", issues);
  ensureToneObject(hard?.oneMinuteRecap?.preview, "hard.oneMinuteRecap.preview", issues);

  validateExamples(chapter.examples, chapter.number, issues);

  if (chapter.quiz !== null) {
    issues.push("quiz must be null during Phase 3");
  }

  ensureToneObject(chapter?.implementationPlan?.coreSkill, "implementationPlan.coreSkill", issues);
  if (!Array.isArray(chapter?.implementationPlan?.ifThenPlans) || chapter.implementationPlan.ifThenPlans.length !== 3) {
    issues.push("implementationPlan.ifThenPlans must contain exactly 3 items");
  }
  ensureToneObject(
    chapter?.implementationPlan?.twentyFourHourChallenge,
    "implementationPlan.twentyFourHourChallenge",
    issues
  );
  ensureToneObject(
    chapter?.implementationPlan?.weeklyPractice,
    "implementationPlan.weeklyPractice",
    issues
  );

  if (!Array.isArray(chapter.reviewCards) || chapter.reviewCards.length !== 5) {
    issues.push("reviewCards must contain exactly 5 items");
  }
  ensureToneObject(chapter.keyTakeawayCard, "keyTakeawayCard", issues);
}

function validateHookOpeners(chapter, issues) {
  for (const variantKey of ["easy", "medium", "hard"]) {
    const breakdown = chapter?.contentVariants?.[variantKey]?.chapterBreakdown;
    for (const tone of ["gentle", "direct", "competitive"]) {
      const firstSentence = getFirstSentence(breakdown?.[tone] ?? "");
      const normalized = normalizeSentence(firstSentence);
      if (HOOK_BAD_PREFIXES.some((prefix) => normalized.startsWith(prefix))) {
        issues.push(
          `Chapter ${chapter.number}.${variantKey}.chapterBreakdown.${tone} starts like a thesis`
        );
      }
    }
  }
}

function validateLanguage(chapter, issues) {
  walkStrings(chapter, (text, textPath) => {
    if (text.includes("—") || text.includes("–")) {
      issues.push(`Chapter ${chapter.number}.${textPath} contains an em/en dash`);
    }

    for (const phrase of BANNED_PHRASES) {
      const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (new RegExp(`\\b${escaped}\\b`, "i").test(text)) {
        issues.push(`Chapter ${chapter.number}.${textPath} contains banned phrase "${phrase}"`);
      }
    }
  });
}

function validatePreviewContinuity(chapter, issues) {
  const mediumPreview = resolveToneText(chapter?.contentVariants?.medium?.oneMinuteRecap?.preview);
  const hardPreview = resolveToneText(chapter?.contentVariants?.hard?.oneMinuteRecap?.preview);
  if (chapter.number === data.chapters.length) {
    if (!/chapter 1|beginning|first chapter|full circle/i.test(`${mediumPreview} ${hardPreview}`)) {
      issues.push(`Chapter ${chapter.number} preview should close the loop back to Chapter 1`);
    }
  } else if (
    !/next|chapter|but|what happens|most of the time|changes everything/i.test(
      `${mediumPreview} ${hardPreview}`
    )
  ) {
    issues.push(`Chapter ${chapter.number} previews do not appear to open a loop`);
  }
}

function validateLeadNameCounts(chapters, issues) {
  const counts = new Map();
  for (const chapter of chapters) {
    for (const example of chapter.examples ?? []) {
      const match = String(example.title).match(/\b([A-Z][a-z]+)\b/);
      if (!match) continue;
      const name = match[1];
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }

  for (const [name, count] of counts.entries()) {
    if (count > 2) {
      issues.push(`Example lead name "${name}" appears ${count} times across the book`);
    }
  }
}

function getRequestedQuizPaths(args) {
  if (args.length > 0) {
    return args;
  }

  return data.chapters.map((chapter) =>
    path.join("/tmp", `${BOOK_ID}-ch${zeroPad(chapter.number)}-quiz.json`)
  );
}

function getLikelyNameTokens(text) {
  const blacklist = new Set([
    "A",
    "An",
    "The",
    "What",
    "Why",
    "Which",
    "How",
    "When",
    "If",
    "Two",
    "Three",
    "Four",
    "Correct",
    "Nice",
    "Imagine",
  ]);

  return (String(text).match(/\b[A-Z][a-z]{2,}\b/g) ?? []).filter((token) => !blacklist.has(token));
}

function validateQuizPrompt(prompt, chapterNumber, pathLabel, issues) {
  if (typeof prompt !== "string" || prompt.trim().length === 0) {
    issues.push(`${pathLabel}.prompt must be a non-empty string`);
    return;
  }

  const currentTitle = data.chapters.find((chapter) => chapter.number === chapterNumber)?.title ?? "";
  const promptLower = prompt.toLowerCase();

  if (currentTitle && promptLower.includes(currentTitle.toLowerCase())) {
    issues.push(`${pathLabel}.prompt must not contain the chapter title`);
  }

  for (const title of data.chapters.map((chapter) => chapter.title)) {
    if (promptLower.includes(title.toLowerCase())) {
      issues.push(`${pathLabel}.prompt must not reference chapter titles`);
      break;
    }
  }

  for (const pattern of QUIZ_BANNED_PROMPT_PATTERNS) {
    if (pattern.test(prompt)) {
      issues.push(`${pathLabel}.prompt contains a banned phrase`);
    }
  }
}

function validateQuiz(quiz, chapterNumber, issues) {
  const pathLabel = `Chapter ${chapterNumber}.quiz`;
  if (!quiz || typeof quiz !== "object") {
    issues.push(`${pathLabel} must be an object`);
    return;
  }

  if (quiz.passingScorePercent !== 80) {
    issues.push(`${pathLabel}.passingScorePercent must be 80`);
  }

  if (!Array.isArray(quiz.questions) || quiz.questions.length !== 10) {
    issues.push(`${pathLabel}.questions must contain exactly 10 items`);
    return;
  }

  const correctCounts = [0, 0, 0];
  const promptStarts = [];
  const normalizedPrompts = [];
  let hasCrossChapter = chapterNumber === 1;

  for (const [index, question] of quiz.questions.entries()) {
    const questionLabel = `${pathLabel}.questions[${index}]`;
    const expectedId = `ch${zeroPad(chapterNumber)}-q${zeroPad(index + 1)}`;

    if (question?.questionId !== expectedId) {
      issues.push(`${questionLabel}.questionId must be ${expectedId}`);
    }

    validateQuizPrompt(question?.prompt, chapterNumber, questionLabel, issues);

    const normalizedPrompt = normalizeSentence(question?.prompt ?? "");
    normalizedPrompts.push(normalizedPrompt);
    promptStarts.push(normalizedPrompt.split(/\s+/).slice(0, 3).join(" "));

    if (!Array.isArray(question?.choices) || question.choices.length !== 3) {
      issues.push(`${questionLabel}.choices must contain exactly 3 items`);
    } else {
      const expectedPrefixes = ["A) ", "B) ", "C) "];
      question.choices.forEach((choice, choiceIndex) => {
        if (typeof choice !== "string" || !choice.startsWith(expectedPrefixes[choiceIndex])) {
          issues.push(`${questionLabel}.choices[${choiceIndex}] must start with ${expectedPrefixes[choiceIndex]}`);
        }
      });
    }

    if (![0, 1, 2].includes(question?.correctIndex)) {
      issues.push(`${questionLabel}.correctIndex must be 0, 1, or 2`);
    } else {
      correctCounts[question.correctIndex] += 1;
    }

    ensureToneObject(question?.explanation, `${questionLabel}.explanation`, issues);

    if (index <= 2) {
      if (question?.depthLevel !== "simple") {
        issues.push(`${questionLabel}.depthLevel must be simple`);
      }
      if (!["remember", "understand"].includes(question?.bloomsLevel)) {
        issues.push(`${questionLabel}.bloomsLevel must be remember or understand`);
      }
    } else if (index <= 7) {
      if (question?.depthLevel !== "standard") {
        issues.push(`${questionLabel}.depthLevel must be standard`);
      }
      if (!["apply", "analyze"].includes(question?.bloomsLevel)) {
        issues.push(`${questionLabel}.bloomsLevel must be apply or analyze`);
      }
      if (index <= 5) {
        const sentenceCount = String(question?.prompt ?? "")
          .split(/(?<=[.!?])\s+/)
          .filter(Boolean).length;
        if (sentenceCount < 2 || sentenceCount > 4) {
          issues.push(`${questionLabel}.prompt must contain a 2-4 sentence scenario`);
        }
        if (getLikelyNameTokens(question?.prompt).length === 0) {
          issues.push(`${questionLabel}.prompt must include a named character`);
        }
      }
    } else {
      if (question?.depthLevel !== "deeper") {
        issues.push(`${questionLabel}.depthLevel must be deeper`);
      }
      if (!["evaluate", "create"].includes(question?.bloomsLevel)) {
        issues.push(`${questionLabel}.bloomsLevel must be evaluate or create`);
      }
      if (/previous chapter|earlier chapter|chapter \d+/i.test(question?.prompt ?? "")) {
        hasCrossChapter = true;
      }
    }
  }

  if (unique(promptStarts).length !== promptStarts.length) {
    issues.push(`${pathLabel} has repeated prompt starts`);
  }

  if (unique(normalizedPrompts).length !== normalizedPrompts.length) {
    issues.push(`${pathLabel} contains duplicate prompts`);
  }

  correctCounts.forEach((count, correctIndex) => {
    if (count < 3 || count > 4) {
      issues.push(`${pathLabel}.correctIndex distribution is unbalanced at index ${correctIndex}`);
    }
  });

  if (!hasCrossChapter) {
    issues.push(`${pathLabel} must include a cross-chapter question in q09 or q10`);
  }
}

function validateQuizFiles(paths) {
  const requestedPaths = getRequestedQuizPaths(paths);
  const issues = [];

  for (const filePath of requestedPaths) {
    if (!fs.existsSync(filePath)) {
      issues.push(`Missing quiz file: ${filePath}`);
      continue;
    }

    let quiz;
    try {
      quiz = readJson(filePath);
    } catch (error) {
      issues.push(`Invalid JSON in ${filePath}: ${error.message}`);
      continue;
    }

    const match = filePath.match(/-ch(\d+)-quiz\.json$/);
    const chapterNumber = match ? Number(match[1]) : null;
    if (!chapterNumber) {
      issues.push(`Could not determine chapter number from ${filePath}`);
      continue;
    }

    validateQuiz(quiz, chapterNumber, issues);
  }

  const result = {
    checkedFiles: requestedPaths.length,
    existingFiles: requestedPaths.filter((filePath) => fs.existsSync(filePath)).length,
    issueCount: issues.length,
    issues,
  };

  console.log(JSON.stringify(result, null, 2));
  if (issues.length > 0) {
    process.exitCode = 1;
  }
}

function getRequestedContentPaths(args) {
  if (args.length > 0) {
    return args;
  }

  return data.chapters.map((chapter) =>
    path.join("/tmp", `${BOOK_ID}-ch${zeroPad(chapter.number)}-content.json`)
  );
}

function validateContent(paths) {
  const requestedPaths = getRequestedContentPaths(paths);
  const issues = [];
  const chapters = [];

  for (const filePath of requestedPaths) {
    if (!fs.existsSync(filePath)) {
      issues.push(`Missing content file: ${filePath}`);
      continue;
    }

    let chapter;
    try {
      chapter = readJson(filePath);
    } catch (error) {
      issues.push(`Invalid JSON in ${filePath}: ${error.message}`);
      continue;
    }

    chapters.push(chapter);
    validateChapterStructure(chapter, issues);
    validateHookOpeners(chapter, issues);
    validateLanguage(chapter, issues);
    validatePreviewContinuity(chapter, issues);
  }

  validateLeadNameCounts(chapters, issues);

  const result = {
    checkedFiles: requestedPaths.length,
    existingFiles: chapters.length,
    issueCount: issues.length,
    issues,
  };

  console.log(JSON.stringify(result, null, 2));
  if (issues.length > 0) {
    process.exitCode = 1;
  }
}

function status() {
  const counts = {
    briefs: 0,
    content: 0,
    quiz: 0,
    merged: 0,
    final: 0,
  };

  for (const chapter of data.chapters) {
    const nn = zeroPad(chapter.number);
    if (fs.existsSync(path.join("/tmp", `${BOOK_ID}-ch${nn}-brief.json`))) counts.briefs += 1;
    if (fs.existsSync(path.join("/tmp", `${BOOK_ID}-ch${nn}-content.json`))) counts.content += 1;
    if (fs.existsSync(path.join("/tmp", `${BOOK_ID}-ch${nn}-quiz.json`))) counts.quiz += 1;
    if (fs.existsSync(path.join("/tmp", `${BOOK_ID}-ch${nn}-merged.json`))) counts.merged += 1;
    if (fs.existsSync(path.join("/tmp", `${BOOK_ID}-ch${nn}-final.json`))) counts.final += 1;
  }

  console.log(
    JSON.stringify(
      {
        masterBriefExists: fs.existsSync(MASTER_BRIEF_PATH),
        continuityLedgerExists: fs.existsSync(CONTINUITY_LEDGER_PATH),
        referenceReportExists: fs.existsSync(REFERENCE_REPORT_PATH),
        counts,
      },
      null,
      2
    )
  );
}

const command = process.argv[2] ?? "status";

if (command === "write-briefs") {
  writeBriefs();
} else if (command === "scan-references") {
  scanReferences();
} else if (command === "validate-content") {
  validateContent(process.argv.slice(3));
} else if (command === "validate-quiz") {
  validateQuizFiles(process.argv.slice(3));
} else if (command === "status") {
  status();
} else {
  console.error(
    "Usage: node scripts/book/friends-and-influence-37-rebuild.mjs [write-briefs|scan-references|validate-content|validate-quiz|status]"
  );
  process.exitCode = 1;
}
