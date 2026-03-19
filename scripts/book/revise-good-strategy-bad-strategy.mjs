import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const packagePath = resolve(
  process.cwd(),
  "book-packages/good-strategy-bad-strategy.modern.json"
);
const reportPath = resolve(
  process.cwd(),
  "notes/good-strategy-bad-strategy-revision-report.md"
);

const SIMPLE_INDEXES = [0, 1, 2, 4, 5, 7, 9];

const AUDIT_SUMMARY = [
  "The existing Good Strategy Bad Strategy package was structurally present but editorially weak. Most chapters reused the same summary shape, the same emotional filler in bullet details, nearly the same scenarios, and quiz prompts that tested wording rather than judgment.",
  "The book had a second fidelity problem. The current titles gestured toward Rumelt's ideas, but the actual lesson flow often drifted into generic self management language about pressure, confidence, and behavior instead of strategy, diagnosis, leverage, coherence, and constraint.",
  "Depth personalization was also thin. Simple, Standard, and Deeper mostly differed by count rather than by meaning, while motivation personalization relied on generic suffixes that were not authored for Rumelt's voice or subject matter.",
  "The revision therefore replaces the book almost completely while preserving the package shape. Every chapter now has two authored summary paragraphs per depth, a real seven ten fifteen bullet ladder, six realistic scenarios, and a scenario based quiz designed around applied judgment."
];

const MAIN_PROBLEMS = [
  "Summary paragraphs were repetitive, vague, and not specific enough to explain Rumelt's core logic.",
  "Bullet details repeated the same generic psychology filler across many chapters, which made the experience feel templated and untrustworthy.",
  "Scenarios reused the same patterns and titles across the book, so transfer felt fake instead of chapter specific.",
  "Quiz prompts referenced the chapter title directly and often used answer choices that were copied slogans instead of plausible decisions.",
  "Depth modes did not change interpretive depth enough, and the current motivation layer did not feel authored for the book."
];

const PERSONALIZATION_STRATEGY = [
  "Depth is authored directly in the package. Simple gives quick clarity with seven bullets, Standard gives the strongest full default with ten bullets, and Deeper adds five real extensions on tradeoffs, hidden logic, and second order implications.",
  "Motivation style stays as a guidance layer rather than nine duplicated packages. For this book, Gentle emphasizes calm honesty, Direct emphasizes disciplined choice, and Competitive emphasizes leverage, edge, and the cost of strategic drift.",
  "The core meaning does not move across modes. What changes is compression, interpretive depth, coaching tone, and how strongly the content pushes the reader toward honest diagnosis and coherent action."
];

const SCHEMA_NOTE =
  "No package schema change was required. The revision stays within the existing JSON shape, and the reader can deliver meaningful motivation differences through a book specific guidance layer instead of nine duplicated content trees.";

const b = (text, detail) => ({ type: "bullet", text, detail });

const ex = (exampleId, title, contexts, scenario, whatToDo, whyItMatters) => ({
  exampleId,
  title,
  contexts,
  scenario,
  whatToDo,
  whyItMatters,
});

const q = (prompt, choices, correctAnswerIndex, explanation) => ({
  prompt,
  choices,
  correctAnswerIndex,
  explanation,
});

const CHAPTERS_PART_ONE = [];
const CHAPTERS_PART_TWO = [];
const CHAPTERS_PART_THREE = [];

const CHAPTERS = [
  ...CHAPTERS_PART_ONE,
  ...CHAPTERS_PART_TWO,
  ...CHAPTERS_PART_THREE,
];

function clean(value) {
  return String(value).replace(/\s+/g, " ").trim();
}

function sentence(value) {
  const text = clean(value);
  if (!text) return "";
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

function renderBullet(block) {
  return `${block.text} ${block.detail}`.trim();
}

function makeVariant(paragraphs, bullets, takeaways, practice) {
  return {
    importantSummary: paragraphs.map((paragraph) => sentence(paragraph)).join(" "),
    summaryBullets: bullets.map((item) => item.text),
    keyTakeaways: takeaways,
    practice,
    summaryBlocks: [
      ...paragraphs.map((text) => ({ type: "paragraph", text })),
      ...bullets,
    ],
  };
}

function buildQuestionId(chapterId, index) {
  return `${chapterId}-q${String(index + 1).padStart(2, "0")}`;
}

function countsByScope(examples) {
  return examples.reduce(
    (acc, example) => {
      const scope = example.contexts?.[0] || "personal";
      acc[scope] = (acc[scope] || 0) + 1;
      return acc;
    },
    { school: 0, work: 0, personal: 0 }
  );
}

function renderReport(bookPackage) {
  const chapters = [...bookPackage.chapters].sort((left, right) => left.number - right.number);
  const lines = [];

  lines.push("# 1. Book audit summary for Good Strategy Bad Strategy — Richard Rumelt", "");
  AUDIT_SUMMARY.forEach((paragraph) => lines.push(sentence(paragraph), ""));

  lines.push("# 2. Main content problems found", "");
  MAIN_PROBLEMS.forEach((paragraph, index) => lines.push(`${index + 1}. ${sentence(paragraph)}`));
  lines.push("");

  lines.push("# 3. Personalization strategy for Good Strategy Bad Strategy — Richard Rumelt", "");
  PERSONALIZATION_STRATEGY.forEach((paragraph) => lines.push(sentence(paragraph), ""));

  lines.push("# 4. Any minimal schema adjustments needed", "", sentence(SCHEMA_NOTE), "");
  lines.push("# 5. Chapter by chapter revised content", "");

  chapters.forEach((chapter) => {
    const simple = chapter.contentVariants.easy;
    const standard = chapter.contentVariants.medium;
    const deeper = chapter.contentVariants.hard;
    const simpleBullets = simple.summaryBlocks.filter((block) => block.type === "bullet");
    const standardBullets = standard.summaryBlocks.filter((block) => block.type === "bullet");
    const deeperBullets = deeper.summaryBlocks.filter((block) => block.type === "bullet");

    lines.push(`## ${chapter.number}. ${chapter.title}`, "");
    lines.push("### Summary", "");
    lines.push("#### Simple", "");
    simple.summaryBlocks
      .filter((block) => block.type === "paragraph")
      .forEach((block, index) => lines.push(`${index + 1}. ${sentence(block.text)}`));
    lines.push("");
    lines.push("#### Standard", "");
    standard.summaryBlocks
      .filter((block) => block.type === "paragraph")
      .forEach((block, index) => lines.push(`${index + 1}. ${sentence(block.text)}`));
    lines.push("");
    lines.push("#### Deeper", "");
    deeper.summaryBlocks
      .filter((block) => block.type === "paragraph")
      .forEach((block, index) => lines.push(`${index + 1}. ${sentence(block.text)}`));
    lines.push("");

    lines.push("### Bullet points", "");
    lines.push("#### Simple", "");
    simpleBullets.forEach((block, index) => lines.push(`${index + 1}. ${sentence(renderBullet(block))}`));
    lines.push("");
    lines.push("#### Standard", "");
    standardBullets.forEach((block, index) => lines.push(`${index + 1}. ${sentence(renderBullet(block))}`));
    lines.push("");
    lines.push("#### Deeper", "");
    deeperBullets.forEach((block, index) => lines.push(`${index + 1}. ${sentence(renderBullet(block))}`));
    lines.push("");

    lines.push("### Scenarios", "");
    chapter.examples.forEach((example, index) => {
      const scope = (example.contexts?.[0] || "personal").toUpperCase();
      lines.push(`${index + 1}. ${example.title} (${scope})`);
      lines.push(`Scenario: ${sentence(example.scenario)}`);
      lines.push(`What to do: ${example.whatToDo.map((step) => sentence(step)).join(" ")}`);
      lines.push(`Why it matters: ${sentence(example.whyItMatters)}`);
      lines.push("");
    });

    lines.push("### Quiz", "");
    chapter.quiz.questions.forEach((question, index) => {
      const correctIndex = question.correctAnswerIndex ?? question.correctIndex ?? 0;
      lines.push(`${index + 1}. ${sentence(question.prompt)}`);
      question.choices.forEach((choice, choiceIndex) => {
        lines.push(`${String.fromCharCode(65 + choiceIndex)}. ${sentence(choice)}`);
      });
      lines.push(`Correct answer: ${String.fromCharCode(65 + correctIndex)}`);
      lines.push(`Explanation: ${sentence(question.explanation || "")}`);
      lines.push("");
    });
  });

  lines.push("# 6. Final quality control summary", "");
  lines.push("1. Every chapter now has exactly two summary paragraphs in each depth variant.");
  lines.push("2. Every chapter now has seven Simple bullets, ten Standard bullets, and fifteen Deeper bullets with real progression.");
  lines.push("3. Every chapter now has exactly six scenarios with two school, two work, and two personal cases.");
  lines.push("4. Every chapter now has a scenario based ten question quiz that tests judgment rather than chapter title recall.");
  lines.push("5. No package schema expansion was needed, and motivation can be delivered through a book specific reader layer.");
  lines.push("6. The book now reads like a guided lesson on Rumelt's strategic logic instead of a generic productivity package.");
  lines.push("");

  return lines.join("\n");
}

function assertNoDashContent(bookPackage) {
  const violations = [];

  for (const chapter of bookPackage.chapters) {
    for (const variant of Object.values(chapter.contentVariants)) {
      for (const block of variant.summaryBlocks || []) {
        if (/[–—-]/.test(block.text)) violations.push(`chapter ${chapter.number} block text`);
        if (block.type === "bullet" && block.detail && /[–—-]/.test(block.detail)) {
          violations.push(`chapter ${chapter.number} block detail`);
        }
      }
      for (const value of variant.keyTakeaways || []) {
        if (/[–—-]/.test(value)) violations.push(`chapter ${chapter.number} key takeaway`);
      }
      for (const value of variant.practice || []) {
        if (/[–—-]/.test(value)) violations.push(`chapter ${chapter.number} practice`);
      }
      if (variant.importantSummary && /[–—-]/.test(variant.importantSummary)) {
        violations.push(`chapter ${chapter.number} important summary`);
      }
    }

    for (const example of chapter.examples) {
      if (/[–—-]/.test(example.title)) violations.push(`chapter ${chapter.number} example title`);
      if (/[–—-]/.test(example.scenario)) violations.push(`chapter ${chapter.number} example scenario`);
      if (/[–—-]/.test(example.whyItMatters)) violations.push(`chapter ${chapter.number} example why`);
      for (const step of example.whatToDo) {
        if (/[–—-]/.test(step)) violations.push(`chapter ${chapter.number} example step`);
      }
    }

    for (const question of chapter.quiz.questions) {
      if (/[–—-]/.test(question.prompt)) violations.push(`chapter ${chapter.number} quiz prompt`);
      if (question.explanation && /[–—-]/.test(question.explanation)) {
        violations.push(`chapter ${chapter.number} quiz explanation`);
      }
      if (/\bthis chapter\b|\bthe chapter\b|\bthe reading\b/i.test(question.prompt)) {
        violations.push(`chapter ${chapter.number} forbidden quiz prompt phrase`);
      }
      for (const choice of question.choices) {
        if (/[–—-]/.test(choice)) violations.push(`chapter ${chapter.number} quiz choice`);
      }
    }
  }

  if (violations.length) {
    throw new Error(`Content rule violation: ${violations[0]}`);
  }
}

function assertStructure(pkg) {
  if (CHAPTERS.length !== 18) {
    throw new Error(`Expected 18 authored chapters, found ${CHAPTERS.length}`);
  }

  for (const chapter of pkg.chapters) {
    const simpleBlocks = chapter.contentVariants.easy.summaryBlocks;
    const standardBlocks = chapter.contentVariants.medium.summaryBlocks;
    const deeperBlocks = chapter.contentVariants.hard.summaryBlocks;
    const simpleBullets = simpleBlocks.filter((block) => block.type === "bullet");
    const standardBullets = standardBlocks.filter((block) => block.type === "bullet");
    const deeperBullets = deeperBlocks.filter((block) => block.type === "bullet");
    const simpleParagraphs = simpleBlocks.filter((block) => block.type === "paragraph");
    const standardParagraphs = standardBlocks.filter((block) => block.type === "paragraph");
    const deeperParagraphs = deeperBlocks.filter((block) => block.type === "paragraph");

    if (simpleParagraphs.length !== 2 || standardParagraphs.length !== 2 || deeperParagraphs.length !== 2) {
      throw new Error(`Chapter ${chapter.number} must have exactly two summary paragraphs per depth`);
    }
    if (simpleBullets.length !== 7) throw new Error(`Chapter ${chapter.number} simple bullet count ${simpleBullets.length}`);
    if (standardBullets.length !== 10) throw new Error(`Chapter ${chapter.number} standard bullet count ${standardBullets.length}`);
    if (deeperBullets.length !== 15) throw new Error(`Chapter ${chapter.number} deeper bullet count ${deeperBullets.length}`);
    if (chapter.quiz.questions.length !== 10) throw new Error(`Chapter ${chapter.number} quiz count ${chapter.quiz.questions.length}`);
    if (chapter.examples.length !== 6) throw new Error(`Chapter ${chapter.number} example count ${chapter.examples.length}`);
    const scopes = countsByScope(chapter.examples);
    if (scopes.school !== 2 || scopes.work !== 2 || scopes.personal !== 2) {
      throw new Error(`Chapter ${chapter.number} must have two school, two work, and two personal scenarios`);
    }
    for (const question of chapter.quiz.questions) {
      if (!Array.isArray(question.choices) || question.choices.length !== 4) {
        throw new Error(`Chapter ${chapter.number} quiz choice count invalid`);
      }
    }
  }
}

const pkg = JSON.parse(readFileSync(packagePath, "utf8"));
const authoredById = new Map(CHAPTERS.map((chapter) => [chapter.chapterId, chapter]));

pkg.createdAt = new Date().toISOString();

pkg.chapters = pkg.chapters.map((chapter) => {
  const authored = authoredById.get(chapter.chapterId);
  if (!authored) {
    throw new Error(`Missing authored chapter for ${chapter.chapterId}`);
  }

  const standardBullets = authored.standardBullets;
  const deeperBullets = [...standardBullets, ...authored.deeperBullets];
  const simpleBullets = SIMPLE_INDEXES.map((index) => standardBullets[index]);

  const sharedTakeaways =
    authored.takeaways ??
    [standardBullets[0].text, standardBullets[3].text, standardBullets[9].text];

  return {
    ...chapter,
    title: authored.title,
    contentVariants: {
      easy: makeVariant(authored.simpleSummary, simpleBullets, sharedTakeaways, authored.practice),
      medium: makeVariant(authored.standardSummary, standardBullets, sharedTakeaways, authored.practice),
      hard: makeVariant(authored.deeperSummary, deeperBullets, sharedTakeaways, authored.practice),
    },
    examples: authored.examples,
    quiz: {
      passingScorePercent: 80,
      questions: authored.quiz.map((question, index) => ({
        questionId: buildQuestionId(chapter.chapterId, index),
        ...question,
      })),
    },
  };
});

assertStructure(pkg);
assertNoDashContent(pkg);

writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + "\n");
mkdirSync(dirname(reportPath), { recursive: true });
writeFileSync(reportPath, renderReport(pkg));

console.log(`Updated ${packagePath}`);
console.log(`Wrote ${reportPath}`);
