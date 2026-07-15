/**
 * reader-gold-dev-pool-v1 — deterministic KEY-FREE reader documents for the
 * frozen 24-chapter selection (Phase 2b of the owner-ratified plan).
 *
 * Renders each selected v21 package chapter into the reader-facing document
 * the adjudicators (and later the readiness reader lane) judge: every unit a
 * reader experiences — hook, counterintuition, fast/deep/full read, examples,
 * quiz prompts + lettered choices, review cards, implementation plan,
 * try-this-now, key takeaway, memorable lines — with the quiz key surface
 * (correctIndex, explanation) STRIPPED. Rendering is pure and deterministic;
 * the docs manifest pins the frozen selection it was built from, so a doc set
 * can never drift from the prose-blind selection. Create-once like the pool.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { hashCanonical, sha256Hex } from "../../contracts/contractUtil.js";
import { canonicalPretty } from "./corpusBuilderCore.js";
import { writeFileAtomic } from "../../lib/atomicWrite.js";
import {
  READER_GOLD_DEV_POOL_ID,
  READER_GOLD_DEV_POOL_MANIFEST_REL_PATH,
  validateReaderGoldDevPoolSelectionManifest,
  type ReaderGoldDevPoolSelectionManifestV1,
} from "./readerGoldDevPool.js";

const PIPELINE_REL = "scripts/book/prompts/chapterflow-v24-author-pipeline";

export const READER_GOLD_DEV_DOCS_SCHEMA = "reader-gold-dev-docs-manifest-v1" as const;
export const READER_GOLD_DEV_DOCS_MANIFEST_REL_PATH =
  `${PIPELINE_REL}/state/migration-experiments/${READER_GOLD_DEV_POOL_ID}/reader-docs-manifest.json` as const;
export const READER_GOLD_DEV_DOCS_DIR_REL_PATH =
  `${PIPELINE_REL}/state/migration-experiments/${READER_GOLD_DEV_POOL_ID}/reader-docs` as const;

/** Quiz-key surfaces that must NEVER appear in a reader document. */
const KEY_LEAK_MARKERS = ["correctIndex", "passingScorePercent"] as const;

export class ReaderGoldDevDocsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReaderGoldDevDocsError";
  }
}

function requireCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new ReaderGoldDevDocsError(message);
}

type V21Chapter = {
  number: number;
  title: string;
  hook: string;
  counterintuition: string;
  tryThisNow: string;
  keyTakeaway: string;
  breakdown: { fastRead: string; deepRead: string; fullRead: string };
  examples: Array<{ title: string; scenario: string; whatToDo: string; whyItMatters: string }>;
  quiz: { questions: Array<{ prompt: string; choices: string[]; correctIndex: number; explanation: string }> };
  reviewCards: Array<{ front: string; back: string }>;
  implementationPlan: {
    coreSkill: string;
    ifThenPlans: Array<{ context: string; plan: string }>;
    twentyFourHourChallenge: string;
    weeklyPractice: string;
  };
  memorableLines: Array<{ text: string }>;
};

const CHOICE_LETTERS = "abcdefghij";

export function renderKeyFreeReaderDocument(args: {
  bookId: string;
  chapter: V21Chapter;
}): string {
  const { bookId, chapter } = args;
  const lines: string[] = [
    `# ${chapter.title}`,
    "",
    `> Reader document — ${bookId} chapter ${chapter.number}. Key-free rendering for reader-experience judgment.`,
    "",
    "## Hook",
    chapter.hook,
    "",
    "## Counterintuition",
    chapter.counterintuition,
    "",
    "## Fast read",
    chapter.breakdown.fastRead,
    "",
    "## Deep read",
    chapter.breakdown.deepRead,
    "",
    "## Full read",
    chapter.breakdown.fullRead,
    "",
    "## Examples",
  ];
  chapter.examples.forEach((example, index) => {
    lines.push(
      `### Example ${index + 1}: ${example.title}`,
      `Scenario: ${example.scenario}`,
      `What to do: ${example.whatToDo}`,
      `Why it matters: ${example.whyItMatters}`,
      "",
    );
  });
  lines.push("## Quiz (answer key withheld)");
  chapter.quiz.questions.forEach((question, index) => {
    lines.push(`### Question ${index + 1}`, question.prompt);
    question.choices.forEach((choice, choiceIndex) => {
      lines.push(`${CHOICE_LETTERS[choiceIndex]}) ${choice}`);
    });
    lines.push("");
  });
  lines.push("## Review cards");
  chapter.reviewCards.forEach((card, index) => {
    lines.push(`### Card ${index + 1}`, `Front: ${card.front}`, `Back: ${card.back}`, "");
  });
  lines.push(
    "## Implementation plan",
    `Core skill: ${chapter.implementationPlan.coreSkill}`,
    ...chapter.implementationPlan.ifThenPlans.map((plan) => `If-then (${plan.context}): ${plan.plan}`),
    `24-hour challenge: ${chapter.implementationPlan.twentyFourHourChallenge}`,
    `Weekly practice: ${chapter.implementationPlan.weeklyPractice}`,
    "",
    "## Try this now",
    chapter.tryThisNow,
    "",
    "## Key takeaway",
    chapter.keyTakeaway,
    "",
    "## Memorable lines",
    ...chapter.memorableLines.map((line) => `- ${line.text}`),
    "",
  );
  const document = lines.join("\n");
  for (const marker of KEY_LEAK_MARKERS) {
    requireCondition(!document.includes(marker), `key-free reader document leaks "${marker}"`);
  }
  // Serialization-leak guard: interpolating a non-string package field renders
  // "[object Object]" — a mechanical corruption that invalidated the first doc
  // mint (caught by Adjudicator B, 2026-07-15). Fail closed at build time.
  requireCondition(!document.includes("[object Object]"),
    "reader document contains a raw serialization leak ([object Object])");
  for (const question of chapter.quiz.questions) {
    requireCondition(question.explanation.length === 0 || !document.includes(question.explanation),
      "key-free reader document leaks a quiz key explanation");
  }
  return document;
}

export type ReaderGoldDevDocEntryV1 = {
  bookId: string;
  chapterNumber: number;
  chapterTitle: string;
  relPath: string;
  readerDocumentSha256: string;
  bytes: number;
};

export type ReaderGoldDevDocsManifestV1 = {
  schema: typeof READER_GOLD_DEV_DOCS_SCHEMA;
  poolId: typeof READER_GOLD_DEV_POOL_ID;
  selectionSha256: string;
  docs: ReaderGoldDevDocEntryV1[];
  manifestSha256: string;
};

export function buildReaderGoldDevDocs(args: {
  repositoryRoot: string;
}): { manifest: ReaderGoldDevDocsManifestV1; documents: Map<string, string> } {
  const repositoryRoot = resolve(args.repositoryRoot);
  const selectionPath = resolve(repositoryRoot, READER_GOLD_DEV_POOL_MANIFEST_REL_PATH);
  requireCondition(existsSync(selectionPath),
    "the frozen selection manifest must exist before reader documents are built (selection first, prose second)");
  const selection = JSON.parse(readFileSync(selectionPath, "utf8")) as ReaderGoldDevPoolSelectionManifestV1;
  const selectionIssues = validateReaderGoldDevPoolSelectionManifest(selection);
  requireCondition(selectionIssues.length === 0, `retained selection manifest is invalid: ${selectionIssues.join("; ")}`);

  const documents = new Map<string, string>();
  const docs: ReaderGoldDevDocEntryV1[] = [];
  for (const book of selection.books) {
    const packageBytes = readFileSync(resolve(repositoryRoot, book.packagePath));
    requireCondition(sha256Hex(packageBytes) === book.packageBytesSha256,
      `package bytes drifted since the frozen selection: ${book.packagePath}`);
    const parsed = JSON.parse(packageBytes.toString("utf8")) as { chapters: V21Chapter[] };
    for (const selected of book.selectedChapters) {
      const chapter = parsed.chapters.find((entry) => entry.number === selected.chapterNumber);
      requireCondition(chapter !== undefined,
        `selected chapter ${book.bookId} ch${selected.chapterNumber} is missing from the package`);
      const document = renderKeyFreeReaderDocument({ bookId: book.bookId, chapter });
      const chapterTag = String(selected.chapterNumber).padStart(2, "0");
      const relPath = `${READER_GOLD_DEV_DOCS_DIR_REL_PATH}/${book.bookId}-ch${chapterTag}.md`;
      documents.set(relPath, document);
      docs.push({
        bookId: book.bookId,
        chapterNumber: selected.chapterNumber,
        chapterTitle: chapter.title,
        relPath,
        readerDocumentSha256: sha256Hex(Buffer.from(document, "utf8")),
        bytes: Buffer.byteLength(document, "utf8"),
      });
    }
  }
  requireCondition(docs.length === selection.totalSelected, "doc count differs from the frozen selection");
  const core: Omit<ReaderGoldDevDocsManifestV1, "manifestSha256"> = {
    schema: READER_GOLD_DEV_DOCS_SCHEMA,
    poolId: READER_GOLD_DEV_POOL_ID,
    selectionSha256: selection.selectionSha256,
    docs,
  };
  return { manifest: { ...core, manifestSha256: hashCanonical(core) }, documents };
}

export type ReaderGoldDevDocsMaterializationV1 = {
  schema: "reader-gold-dev-docs-materialization-v1";
  poolId: typeof READER_GOLD_DEV_POOL_ID;
  manifestPath: string;
  manifestSha256: string;
  docCount: number;
  written: boolean;
  modelCalls: 0;
  apiCalls: 0;
};

export function materializeReaderGoldDevDocs(args: {
  repositoryRoot: string;
  write?: boolean;
}): ReaderGoldDevDocsMaterializationV1 {
  const repositoryRoot = resolve(args.repositoryRoot);
  const built = buildReaderGoldDevDocs({ repositoryRoot });
  const manifestPath = resolve(repositoryRoot, READER_GOLD_DEV_DOCS_MANIFEST_REL_PATH);
  const manifestBytes = canonicalPretty(built.manifest);
  if (existsSync(manifestPath)) {
    requireCondition(readFileSync(manifestPath, "utf8") === manifestBytes,
      "retained reader-docs manifest differs from the deterministic rebuild");
    for (const doc of built.manifest.docs) {
      const retained = readFileSync(resolve(repositoryRoot, doc.relPath), "utf8");
      requireCondition(retained === built.documents.get(doc.relPath),
        `retained reader document differs from the deterministic rebuild: ${doc.relPath}`);
    }
  } else if (args.write === true) {
    for (const doc of built.manifest.docs) {
      writeFileAtomic(resolve(repositoryRoot, doc.relPath), built.documents.get(doc.relPath) ?? "");
    }
    writeFileAtomic(manifestPath, manifestBytes);
    requireCondition(readFileSync(manifestPath, "utf8") === manifestBytes, "reader-docs manifest read-back drift");
  }
  return {
    schema: "reader-gold-dev-docs-materialization-v1",
    poolId: READER_GOLD_DEV_POOL_ID,
    manifestPath,
    manifestSha256: built.manifest.manifestSha256,
    docCount: built.manifest.docs.length,
    written: args.write === true || existsSync(manifestPath),
    modelCalls: 0,
    apiCalls: 0,
  };
}
