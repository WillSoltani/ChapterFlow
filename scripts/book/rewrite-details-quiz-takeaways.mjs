#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const BOOK_PACKAGES_DIR = path.resolve(process.cwd(), "book-packages");
const FILE_PATTERN = /\.json$/i;

const DETAIL_OPENERS = [
  "This idea matters because people often react to pressure before they have time to think clearly.",
  "The pattern is important because emotions can quietly reshape judgment in a tense moment.",
  "This matters because social context can change behavior even when intentions are good.",
  "The idea is useful because subtle shifts in certainty can influence decisions very quickly.",
];

const DETAIL_MECHANICS = [
  "It usually begins when someone feels exposed, compared, or uncertain about control, and the response becomes more defensive than reflective.",
  "The mechanism is simple: once pressure rises, attention narrows and people protect position instead of exploring better options.",
  "In many cases, the reaction is driven by fear of loss, so communication gets tighter and decisions become rigid.",
  "Once tension appears, people often prioritize short term relief over long term clarity, which can distort the next step.",
];

const DETAIL_RECOGNITION = [
  "You can recognize it in real life when tone changes quickly, collaboration drops, or decisions harden after a triggering event.",
  "A common signal is a sudden shift from open discussion to protective language, blame, or withdrawal.",
  "Another signal is when reasonable feedback is treated as a threat, even when the underlying concern is valid.",
  "In day to day situations, it shows up when people rush to control the outcome instead of clarifying the problem first.",
];

const QUESTION_TEMPLATES = [
  "Which option best reflects this concept in practice: {concept}?",
  "Which option most accurately explains this idea: {concept}?",
  "Which option shows why this principle matters: {concept}?",
  "Which option best applies this principle to real decisions: {concept}?",
];

function cleanText(value) {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim();
}

function ensureSentence(value) {
  const text = cleanText(value);
  if (!text) return "";
  const normalized = text.charAt(0).toUpperCase() + text.slice(1);
  return /[.!?]$/.test(normalized) ? normalized : `${normalized}.`;
}

function stripTrailingPunctuation(value) {
  return cleanText(value).replace(/[.!?]+$/g, "");
}

function withoutDash(value) {
  return cleanText(value).replace(/[—–-]/g, " ");
}

function normalizePractice(phrase) {
  let text = stripTrailingPunctuation(phrase);
  text = text.replace(/^(try this next|practice|apply it)\s*:\s*/i, "");
  text = text.replace(/^to\s+/i, "");
  text = withoutDash(text);
  if (!text) return "pause and clarify the next decision";
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function startsWithVerb(text) {
  return /^(introduces|shows|suggests|explains|argues|presents|frames|highlights|focuses|describes)\b/i.test(
    text
  );
}

function toGerund(word) {
  const lower = cleanText(word).toLowerCase();
  if (!lower) return "";
  if (lower === "be") return "being";
  if (lower.endsWith("ing")) return lower;
  if (lower.endsWith("ie")) return `${lower.slice(0, -2)}ying`;
  if (lower.endsWith("e") && !/(ee|oe|ye)$/.test(lower)) return `${lower.slice(0, -1)}ing`;
  return `${lower}ing`;
}

function normalizeLeadFragments(text) {
  let next = cleanText(text);
  next = next.replace(/^Also\s+/i, "It also ");
  next = next.replace(/^Further\s+/i, "It further ");
  next = next.replace(/^Therefore\s+/i, "It therefore ");
  next = next.replace(/^Means\s+/i, "This means ");
  next = next.replace(/^Is why\s+/i, "This is why ");
  next = next.replace(/^Insight is\s+/i, "This insight is ");
  next = next.replace(/^Can be read as\s+/i, "It can be read as ");
  next = next.replace(/^Keeps returning to\s+/i, "It keeps returning to ");
  next = next.replace(/^Treats\s+/i, "It treats ");
  next = next.replace(/^Ultimately frames\s+/i, "It ultimately frames ");
  next = next.replace(/^Good judgment as\s+/i, "Good judgment is ");
  next = next.replace(/^Resilience as\s+/i, "Resilience works as ");
  next = next.replace(/^Readers benefit from\s+([A-Za-z]+)\b/i, (_, verb) => {
    return `Readers benefit from ${toGerund(verb)}`;
  });
  return cleanText(next);
}

function refineBulletText(value) {
  let text = normalizeLeadFragments(cleanText(value));
  text = text.replace(/^The reading\s+/i, "");
  text = text.replace(/^How\s+(.+?)\s+(influences?)\s+/i, (_, subject, verb) => {
    const s = cleanText(subject);
    return `${s.charAt(0).toUpperCase()}${s.slice(1)} ${verb} `;
  });
  text = text.replace(/^How\s+(.+?)\s+(can\s+shape)\s+/i, (_, subject, phrase) => {
    const s = cleanText(subject);
    return `${s.charAt(0).toUpperCase()}${s.slice(1)} ${phrase} `;
  });
  text = text.replace(/^It encourages readers to\s+/i, "Readers can ");
  text = text.replace(/^It warns that\s+/i, "");
  text = text.replace(/^It suggests that\s+/i, "");
  text = text.replace(/^It means that\s+/i, "");
  text = text.replace(/\bthis chapter\b/gi, "this concept");
  text = text.replace(/\bthis reading\b/gi, "this concept");
  text = cleanText(text);
  if (startsWithVerb(text)) {
    text = `This concept ${text}`;
  }
  return ensureSentence(text);
}

function buildDetail(practiceItems, idx) {
  const opener = DETAIL_OPENERS[idx % DETAIL_OPENERS.length];
  const mechanics = DETAIL_MECHANICS[idx % DETAIL_MECHANICS.length];
  const recognition = DETAIL_RECOGNITION[idx % DETAIL_RECOGNITION.length];
  const practice = normalizePractice(practiceItems[idx % Math.max(1, practiceItems.length)]);
  const closing = `A helpful response is to ${practice}, which creates space for steadier judgment and better outcomes.`;

  return [opener, mechanics, recognition, closing]
    .map((sentence) => ensureSentence(withoutDash(sentence)))
    .join(" ");
}

function normalizeConcept(text) {
  let concept = stripTrailingPunctuation(text);
  concept = concept.replace(/^\[.*?\]\s*/g, "");
  concept = concept.replace(/\b(this chapter|this reading|the chapter)\b/gi, "");
  concept = concept.replace(/^the reading\s+/i, "");
  concept = concept.replace(/^that\s+/i, "");
  concept = concept.replace(/^the idea that\s+/i, "");
  concept = concept.replace(/^the claim that\s+/i, "");
  concept = concept.replace(/^according to the (reading|concept),?\s*/i, "");
  concept = withoutDash(concept);
  concept = cleanText(concept);

  if (startsWithVerb(concept)) {
    concept = concept.replace(
      /^(introduces|shows|suggests|explains|argues|presents|frames|highlights|focuses|describes)\s+/i,
      ""
    );
  }
  const words = concept.split(/\s+/).filter(Boolean);
  if (words.length > 18) concept = words.slice(0, 18).join(" ");
  concept = concept.replace(/^the concept\s+/i, "");
  if (!concept) concept = "the central principle";
  return concept.charAt(0).toLowerCase() + concept.slice(1);
}

function buildPrompt(question) {
  const correctChoice = Array.isArray(question.choices)
    ? question.choices[Number(question.correctIndex) || 0] ?? question.choices[0]
    : "";
  const concept = normalizeConcept(correctChoice || question.prompt || "the central principle");
  const templateIndex = Math.abs(String(question.questionId || question.prompt || "").length) % QUESTION_TEMPLATES.length;
  const template = QUESTION_TEMPLATES[templateIndex];
  const prompt = template.replace("{concept}", concept);

  return ensureSentence(
    cleanText(withoutDash(prompt))
      .replace(/\b(this chapter|this reading|the chapter)\b/gi, "the concept")
      .replace(/\s+/g, " ")
  );
}

function buildTakeaway(variant) {
  const bulletA = refineBulletText(
    (Array.isArray(variant.summaryBullets) && variant.summaryBullets[0]) ||
      (Array.isArray(variant.summaryBlocks)
        ? variant.summaryBlocks.find((block) => block?.type === "bullet")?.text
        : "") ||
      "Clear thinking under pressure improves outcomes"
  );
  const practice = normalizePractice(
    (Array.isArray(variant.practice) && variant.practice[0]) || ""
  );

  const sentenceOne = ensureSentence(withoutDash(stripTrailingPunctuation(bulletA)));
  const sentenceTwo = ensureSentence(
    withoutDash(
      "This perspective helps people make clearer decisions and avoid unnecessary conflict when stakes are high"
    )
  );
  return `${sentenceOne} ${sentenceTwo}`;
}

function rewriteVariant(variant) {
  if (!variant || typeof variant !== "object") return;

  if (Array.isArray(variant.summaryBullets)) {
    variant.summaryBullets = variant.summaryBullets.map((item) => refineBulletText(item));
  }

  const practiceItems = Array.isArray(variant.practice) ? variant.practice : [];
  if (Array.isArray(variant.summaryBlocks)) {
    let bulletIdx = 0;
    variant.summaryBlocks = variant.summaryBlocks.map((block) => {
      if (!block || typeof block !== "object") return block;
      if (block.type === "paragraph") return block;
      const text = refineBulletText(block.text || "");
      const detail = buildDetail(practiceItems, bulletIdx);
      bulletIdx += 1;
      return {
        ...block,
        text,
        detail,
      };
    });

    const blockBullets = variant.summaryBlocks
      .filter((block) => block && block.type === "bullet" && typeof block.text === "string")
      .map((block) => block.text);
    if (Array.isArray(variant.summaryBullets) && blockBullets.length > 0) {
      variant.summaryBullets = blockBullets;
    }
  }

  const takeaway = buildTakeaway(variant);
  if (Array.isArray(variant.takeaways)) {
    variant.takeaways = [takeaway];
  }
  if (Array.isArray(variant.keyTakeaways)) {
    variant.keyTakeaways = [takeaway];
  }
}

function rewriteChapter(chapter) {
  if (!chapter || typeof chapter !== "object") return;

  for (const variant of Object.values(chapter.contentVariants || {})) {
    rewriteVariant(variant);
  }

  const quiz = chapter.quiz;
  if (quiz && typeof quiz === "object") {
    const rewriteQuestions = (questions) => {
      if (!Array.isArray(questions)) return;
      for (const question of questions) {
        if (!question || typeof question !== "object") continue;
        question.prompt = buildPrompt(question);
      }
    };

    rewriteQuestions(quiz.questions);
    rewriteQuestions(quiz.retryQuestions);
  }
}

function rewritePackageFile(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed.chapters)) return { changed: false, chapters: 0 };

  for (const chapter of parsed.chapters) {
    rewriteChapter(chapter);
  }

  const next = `${JSON.stringify(parsed, null, 2)}\n`;
  if (next === raw) return { changed: false, chapters: parsed.chapters.length };
  fs.writeFileSync(filePath, next, "utf8");
  return { changed: true, chapters: parsed.chapters.length };
}

function main() {
  const files = fs
    .readdirSync(BOOK_PACKAGES_DIR)
    .filter((name) => FILE_PATTERN.test(name))
    .sort();

  let changedFiles = 0;
  let chaptersProcessed = 0;
  for (const fileName of files) {
    const result = rewritePackageFile(path.join(BOOK_PACKAGES_DIR, fileName));
    chaptersProcessed += result.chapters;
    if (result.changed) changedFiles += 1;
  }

  console.log(
    JSON.stringify(
      {
        filesScanned: files.length,
        filesChanged: changedFiles,
        chaptersProcessed,
      },
      null,
      2
    )
  );
}

main();
