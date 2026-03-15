#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const BOOK_PACKAGES_DIR = path.resolve(process.cwd(), "book-packages");
const FILE_PATTERN = /\.json$/i;
const BULLET_TARGETS = {
  easy: 6,
  medium: 10,
  hard: 14,
};

const LEAD_PHRASE_PATTERNS = [
  /^(this|the)\s+chapter\s+(argues|states|explains|shows|emphasizes|presents|frames|suggests|describes|highlights|reveals|explores|demonstrates|focuses on)\s+(that\s+)?/i,
  /^(this|the)\s+chapter\s+is\s+about\s+/i,
  /^a\s+(key|central|major|core|main|critical)\s+idea\s+is\s+(that\s+)?/i,
  /^a\s+(key|central|major|core|main|critical)\s+point\s+is\s+(that\s+)?/i,
  /^an?\s+(important|useful|critical)\s+point\s+is\s+(that\s+)?/i,
  /^it\s+argues\s+(that\s+)?/i,
  /^it\s+shows\s+(that\s+)?/i,
  /^readers\s+are\s+encouraged\s+to\s+/i,
  /^(practice|apply it|try this next)\s*:\s*/i,
];

const DETAIL_WHY_LINES = [
  "Ignoring this usually leads to reactive decisions that feel urgent in the moment but costly later.",
  "When this is missing, people often confuse activity with progress and repeat the same mistake.",
  "Without this perspective, short-term pressure can quietly override better long-term judgment.",
  "This matters because small decisions compound, so unclear thinking can create a long chain of avoidable friction.",
];

const DETAIL_EXAMPLE_LINES = [
  "A common real-life pattern is knowing the right move in theory but defaulting to habit when emotions rise.",
  "In work or school, this often appears when someone rushes a choice, then has to spend extra time repairing it.",
  "In personal situations, the same pattern can turn a manageable issue into a bigger conflict through overreaction.",
  "Most people notice the cost only afterward, which is why deliberate practice is more useful than pure intention.",
];

const DETAIL_ACTION_LINES = [
  "A practical next step is to {practice}, then review what changed before repeating the approach.",
  "One useful way to apply this is to {practice}, and adjust the next attempt based on the result.",
  "You can make this concrete by taking one step first: {practice}, then writing one short note about what worked and what did not.",
  "To turn this into a habit, start with this move: {practice}, and keep the process simple enough to repeat on low-energy days.",
];

const FALLBACK_BULLETS = [
  "Clear priorities make decisions more consistent when pressure is high.",
  "Small repeated actions matter more than occasional bursts of effort.",
  "Context and timing influence whether a strategy succeeds or fails.",
  "Emotional self-control improves judgment during uncertainty.",
  "Feedback and reflection turn experience into better future choices.",
  "Sustainable progress depends on systems, not mood alone.",
  "Tradeoffs become easier to handle when goals are explicit.",
  "Strong outcomes usually come from disciplined execution over time.",
  "Patterns are easier to change when they are named clearly.",
  "Practical habits help ideas survive real-world pressure.",
];

function cleanText(value) {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim();
}

function stripTrailingPunctuation(value) {
  return cleanText(value).replace(/[.!?]+$/g, "");
}

function sentenceCase(value) {
  const text = cleanText(value);
  if (!text) return "";
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
}

function ensureSentence(value) {
  const text = sentenceCase(value);
  if (!text) return "";
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

function lowerFirst(value) {
  const text = cleanText(value);
  if (!text) return "";
  return `${text.charAt(0).toLowerCase()}${text.slice(1)}`;
}

function normalizeKey(value) {
  return cleanText(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function normalizePractice(phrase) {
  let text = stripTrailingPunctuation(phrase);
  if (!text) {
    return "test one small change in a real situation";
  }

  text = text.replace(/^(practice|try this next|apply it)\s*:\s*/i, "");
  text = text.replace(/^to\s+/i, "");

  const normalized = lowerFirst(text);
  return normalized || "test one small change in a real situation";
}

function removeLeadScaffolding(value) {
  let text = cleanText(value);
  for (const pattern of LEAD_PHRASE_PATTERNS) {
    text = text.replace(pattern, "");
  }
  text = text.replace(/^\s*that\s+/i, "");
  text = text.replace(/\b(in|from|of)\s+this\s+chapter\b/gi, "in the reading");
  text = text.replace(/\bthis\s+chapter\b/gi, "the reading");
  text = text.replace(/\bthe\s+chapter\b/gi, "the reading");
  return cleanText(text);
}

function rewriteBullet(value) {
  let text = removeLeadScaffolding(value);
  if (!text) return "";
  text = text.replace(/^It encourages readers to\s+/i, "Readers benefit from ");
  text = text.replace(/^It warns that\s+/i, "");
  text = text.replace(/^It suggests that\s+/i, "");
  text = text.replace(/^It means that\s+/i, "");
  text = text.replace(
    /^How\s+(.+?)\s+(influences?)\s+/i,
    (_, subject, verb) => `${sentenceCase(subject)} ${verb} `
  );
  text = text.replace(
    /^How\s+(.+?)\s+(can\s+shape)\s+/i,
    (_, subject, phrase) => `${sentenceCase(subject)} ${phrase} `
  );
  text = text.replace(/^the reading\s+(argues|states|explains|shows|emphasizes|presents|frames|suggests|describes)\s+(that\s+)?/i, "");
  text = text.replace(/^it\s+(argues|states|explains|shows|emphasizes|presents|frames|suggests|describes)\s+(that\s+)?/i, "");
  text = text.replace(/^therefore\s+/i, "");
  text = text.replace(/^so\s+/i, "");
  text = text.replace(/\bchanges influences\b/gi, "changes influence");
  text = text.replace(/\bpeople fails\b/gi, "people fail");
  text = text.replace(/\bresults depends\b/gi, "results depend");
  text = cleanText(text);
  if (!text) return "";
  if (text.length < 24) {
    text = `${text} in everyday decisions`;
  }
  return ensureSentence(text);
}

function collectCandidateBulletTexts(variant) {
  const candidates = [];
  const push = (value) => {
    const text = cleanText(value);
    if (!text) return;
    candidates.push(text);
  };

  for (const bullet of variant.summaryBullets ?? []) push(bullet);
  for (const block of variant.summaryBlocks ?? []) {
    if (block && block.type === "bullet") push(block.text);
  }
  for (const takeaway of variant.takeaways ?? []) {
    push(`${cleanText(takeaway)} can guide choices under pressure`);
  }
  for (const takeaway of variant.keyTakeaways ?? []) {
    push(`${cleanText(takeaway)} can guide choices under pressure`);
  }
  for (const practice of variant.practice ?? []) {
    push(`Progress improves when you ${normalizePractice(practice)}`);
  }

  return candidates;
}

function buildBulletsForVariant(chapterTitle, variantKey, variant) {
  const target = BULLET_TARGETS[variantKey] ?? 8;
  const candidates = collectCandidateBulletTexts(variant);
  const selected = [];
  const used = new Set();

  for (const candidate of candidates) {
    const rewritten = rewriteBullet(candidate);
    if (!rewritten) continue;
    const key = normalizeKey(rewritten);
    if (!key || used.has(key)) continue;
    if (/\b(this chapter|in this chapter)\b/i.test(rewritten)) continue;
    used.add(key);
    selected.push(rewritten);
    if (selected.length >= target) break;
  }

  let fallbackIndex = 0;
  while (selected.length < target) {
    const template = FALLBACK_BULLETS[fallbackIndex % FALLBACK_BULLETS.length];
    const raw =
      fallbackIndex % 2 === 0
        ? template
        : `${chapterTitle} reinforces that ${lowerFirst(template)}`;
    const bullet = ensureSentence(raw);
    fallbackIndex += 1;
    const key = normalizeKey(bullet);
    if (!key || used.has(key)) continue;
    used.add(key);
    selected.push(bullet);
  }

  return selected;
}

function buildSummaryParagraphs(chapterTitle, bullets, practiceItems) {
  const practiceA = normalizePractice(practiceItems[0] || "test one idea in a real decision");
  const practiceB = normalizePractice(
    practiceItems[1] || "review the outcome and adjust the next attempt"
  );
  const ideaA = ensureSentence(
    stripTrailingPunctuation(
      bullets[0] || "Clear principles improve decisions when stakes are high"
    )
  );
  const ideaB = ensureSentence(
    stripTrailingPunctuation(
      bullets[1] || "Consistent execution creates stronger long-term outcomes than short bursts of effort"
    )
  );

  const paragraphOne = ensureSentence(
    `${chapterTitle} explains the main pattern behind the chapter in a direct and practical way`
  )
    .concat(
      ` ${ensureSentence(
        `One core idea is this: ${stripTrailingPunctuation(ideaA)}`
      )}`
    )
    .concat(
      ` ${ensureSentence(
        `Another key idea is this: ${stripTrailingPunctuation(ideaB)}`
      )}`
    );

  const paragraphTwo = ensureSentence(
    "In practice, these ideas matter most during ordinary choices at work, school, and personal life"
  )
    .concat(
      ` ${ensureSentence(
        `A useful starting move is to ${practiceA}, then ${practiceB}`
      )}`
    )
    .concat(
      ` ${ensureSentence(
        "Repeated use builds better judgment over time because small decisions start aligning with long-term goals"
      )}`
    );

  return [paragraphOne, paragraphTwo];
}

function buildDetail(chapterTitle, bullet, practiceItems, index) {
  const idea = stripTrailingPunctuation(bullet);
  const practice = normalizePractice(practiceItems[index % Math.max(practiceItems.length, 1)]);
  const why = DETAIL_WHY_LINES[index % DETAIL_WHY_LINES.length];
  const example = DETAIL_EXAMPLE_LINES[index % DETAIL_EXAMPLE_LINES.length];
  const actionTemplate = DETAIL_ACTION_LINES[index % DETAIL_ACTION_LINES.length];
  const action = actionTemplate.replace("{practice}", practice);

  const sentenceOne = ensureSentence(
    `In plain terms, ${idea}`
  );
  const sentenceTwo = ensureSentence(why);
  const sentenceThree = ensureSentence(example.replace("{chapterTitle}", chapterTitle));
  const sentenceFour = ensureSentence(action);

  return `${sentenceOne} ${sentenceTwo} ${sentenceThree} ${sentenceFour}`;
}


function rewriteVariant(chapterTitle, variantKey, variant) {
  const bullets = buildBulletsForVariant(chapterTitle, variantKey, variant);
  const practiceItems = Array.isArray(variant.practice) ? variant.practice : [];
  const [paragraphOne, paragraphTwo] = buildSummaryParagraphs(
    chapterTitle,
    bullets,
    practiceItems
  );

  variant.summaryBullets = bullets;
  variant.summaryBlocks = [
    { type: "paragraph", text: paragraphOne },
    { type: "paragraph", text: paragraphTwo },
    ...bullets.map((bullet, index) => ({
      type: "bullet",
      text: bullet,
      detail: buildDetail(chapterTitle, bullet, practiceItems, index),
    })),
  ];
}

function rewriteChapter(chapter) {
  if (!chapter || typeof chapter !== "object") return;
  if (!chapter.contentVariants || typeof chapter.contentVariants !== "object") return;

  for (const [variantKey, variant] of Object.entries(chapter.contentVariants)) {
    if (!variant || typeof variant !== "object") continue;
    rewriteVariant(chapter.title || "The chapter", variantKey, variant);
  }
}

function rewriteBookPackage(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const data = JSON.parse(raw);

  if (!Array.isArray(data.chapters)) return { changed: false, chapterCount: 0 };

  for (const chapter of data.chapters) {
    rewriteChapter(chapter);
  }

  const next = `${JSON.stringify(data, null, 2)}\n`;
  if (next === raw) {
    return { changed: false, chapterCount: data.chapters.length };
  }

  fs.writeFileSync(filePath, next, "utf8");
  return { changed: true, chapterCount: data.chapters.length };
}

function main() {
  const files = fs
    .readdirSync(BOOK_PACKAGES_DIR)
    .filter((fileName) => FILE_PATTERN.test(fileName))
    .sort();

  let changedFiles = 0;
  let chapterCount = 0;

  for (const fileName of files) {
    const filePath = path.join(BOOK_PACKAGES_DIR, fileName);
    const result = rewriteBookPackage(filePath);
    chapterCount += result.chapterCount;
    if (result.changed) changedFiles += 1;
  }

  console.log(
    JSON.stringify(
      {
        filesScanned: files.length,
        filesChanged: changedFiles,
        chaptersProcessed: chapterCount,
      },
      null,
      2
    )
  );
}

main();
