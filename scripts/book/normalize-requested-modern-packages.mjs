#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const OUTPUT_DIR = path.resolve(process.cwd(), "book-packages");
const TARGET_CREATED_AT = "2026-03-17T00:00:00Z";

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function topicFromTitle(title) {
  return clean(title).replace(/[.!?]+$/g, "");
}

function buildQuizPrompts(chapterTitle) {
  const topic = topicFromTitle(chapterTitle);
  return [
    `Which option best captures the main principle in \"${topic}\"?`,
    `Which option best explains a supporting idea behind \"${topic}\"?`,
    `Which option best explains why \"${topic}\" matters in practice?`,
    `Which option identifies a common mistake to avoid when applying \"${topic}\"?`,
    `Which option points to a reliable signal for \"${topic}\" in real situations?`,
    `Which option shows a useful response when applying \"${topic}\"?`,
    `Which option connects \"${topic}\" to incentives and downstream effects?`,
    `Which option shows why routines matter when applying \"${topic}\" under pressure?`,
    `Which option best explains why \"${topic}\" matters early in a career?`,
    `Which option describes the hardest part of applying \"${topic}\" well?`,
  ];
}

function buildRetryPrompts(chapterTitle) {
  const topic = topicFromTitle(chapterTitle);
  return [
    `Which option reflects a deeper interpretation of \"${topic}\"?`,
    `Which option best connects \"${topic}\" to long term tradeoffs?`,
    `Which option best captures the ethical edge of \"${topic}\"?`,
    `Which option best states the long game behind \"${topic}\"?`,
    `Which option best applies \"${topic}\" to a real decision?`,
  ];
}

function normalizePrompt(prompt) {
  return clean(prompt)
    .replace(/\b(this chapter|the chapter|this reading|the reading)\b/gi, "the concept")
    .replace(/\s+([?!.,;:])/g, "$1");
}

function normalizeScenarioPerspective(text, name) {
  let output = clean(text);
  if (!output) return output;
  output = output.replace(new RegExp(`\\b${name}'s\\b`, "g"), "their");

  output = output
    .replace(/\bYou are\b/g, `${name} is`)
    .replace(/\bYou're\b/g, `${name} is`)
    .replace(/\bYou were\b/g, `${name} was`)
    .replace(/\bYou have\b/g, `${name} has`)
    .replace(/\bYou do\b/g, `${name} does`)
    .replace(/\bYou keep\b/g, `${name} keeps`)
    .replace(/\bYou feel\b/g, `${name} feels`)
    .replace(/\bYou need\b/g, `${name} needs`)
    .replace(/\bYou want\b/g, `${name} wants`)
    .replace(/\bYou know\b/g, `${name} knows`)
    .replace(/\bYou can\b/g, `${name} can`)
    .replace(/\bYou may\b/g, `${name} may`)
    .replace(/\bYou\b/g, name)
    .replace(/\bYour\b/g, "their")
    .replace(/\byour\b/g, "their")
    .replace(/\byou\b/g, name);

  output = output
    .replace(new RegExp(`\\b${name} keep\\b`, "g"), `${name} keeps`)
    .replace(new RegExp(`\\b${name} need\\b`, "g"), `${name} needs`)
    .replace(new RegExp(`\\b${name} want\\b`, "g"), `${name} wants`)
    .replace(new RegExp(`\\b${name} know\\b`, "g"), `${name} knows`)
    .replace(new RegExp(`\\b${name} have\\b`, "g"), `${name} has`)
    .replace(new RegExp(`\\b${name} are\\b`, "g"), `${name} is`)
    .replace(new RegExp(`\\b${name} do\\b`, "g"), `${name} does`)
    .replace(new RegExp(`\\b${name} try\\b`, "g"), `${name} tries`)
    .replace(new RegExp(`\\b${name} say\\b`, "g"), `${name} says`)
    .replace(new RegExp(`\\b${name} feel\\b`, "g"), `${name} feels`)
    .replace(new RegExp(`\\b${name}'s's\\b`, "g"), `${name}'s`)
    .replace(/\s+([?!.,;:])/g, "$1");

  return clean(output);
}

function extractScenarioName(scenario) {
  const text = clean(scenario);
  const match = text.match(/^([A-Z][a-z]+)\b/);
  return match ? match[1] : null;
}

function processChapter(chapter) {
  const title = chapter?.title;
  if (!title || !chapter.quiz || !Array.isArray(chapter.quiz.questions)) return false;

  let changed = false;
  const prompts = buildQuizPrompts(title);
  chapter.quiz.questions = chapter.quiz.questions.map((question, index) => {
    const nextPrompt = prompts[index] ? clean(prompts[index]) : normalizePrompt(question.prompt);
    if (nextPrompt !== question.prompt) {
      changed = true;
      return {
        ...question,
        prompt: nextPrompt,
      };
    }
    return question;
  });

  if (Array.isArray(chapter.quiz.retryQuestions)) {
    const retryPrompts = buildRetryPrompts(title);
    chapter.quiz.retryQuestions = chapter.quiz.retryQuestions.map((question, index) => {
      const nextPrompt = retryPrompts[index]
        ? clean(retryPrompts[index])
        : normalizePrompt(question.prompt);
      if (nextPrompt !== question.prompt) {
        changed = true;
        return {
          ...question,
          prompt: nextPrompt,
        };
      }
      return question;
    });
  }

  if (Array.isArray(chapter.examples)) {
    chapter.examples = chapter.examples.map((example) => {
      const name = extractScenarioName(example.scenario || "");
      if (!name) return example;
      const nextScenario = normalizeScenarioPerspective(example.scenario, name);
      if (nextScenario !== example.scenario) {
        changed = true;
        return {
          ...example,
          scenario: nextScenario,
        };
      }
      return example;
    });
  }

  return changed;
}

function main() {
  const files = fs
    .readdirSync(OUTPUT_DIR)
    .filter((name) => name.endsWith(".json"))
    .map((name) => path.join(OUTPUT_DIR, name));

  let scanned = 0;
  let touchedBooks = 0;
  let touchedChapters = 0;

  for (const filePath of files) {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);

    if (parsed.createdAt !== TARGET_CREATED_AT) continue;
    scanned += 1;

    let fileChanged = false;
    for (const chapter of parsed.chapters ?? []) {
      if (processChapter(chapter)) {
        fileChanged = true;
        touchedChapters += 1;
      }
    }

    if (fileChanged) {
      fs.writeFileSync(filePath, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
      touchedBooks += 1;
    }
  }

  console.log(
    JSON.stringify(
      {
        targetCreatedAt: TARGET_CREATED_AT,
        scannedBooks: scanned,
        touchedBooks,
        touchedChapters,
      },
      null,
      2,
    ),
  );
}

main();
