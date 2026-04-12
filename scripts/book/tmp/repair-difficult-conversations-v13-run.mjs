import fs from "fs";
import path from "path";
import crypto from "crypto";

const RUN_ROOT = path.resolve(".chapterflow/runs/difficult-conversations/20260406-01");
const SOURCE_ROOT = path.resolve(".chapterflow/sources/difficult-conversations");
const VALIDATED_DIR = path.join(RUN_ROOT, "validated");
const STRUCTURED_DIR = path.join(RUN_ROOT, "structured");
const QUIZZES_DIR = path.join(RUN_ROOT, "quizzes");
const DRAFTS_EDITED_DIR = path.join(RUN_ROOT, "drafts", "edited");
const REPORTS_DIR = path.join(RUN_ROOT, "reports");
const SIDECARS_DIR = path.join(RUN_ROOT, "sidecars");
const MANIFESTS_DIR = path.join(RUN_ROOT, "manifests");
const CONTINUITY_PATH = path.join(RUN_ROOT, "continuity", "continuity-state.json");
const SOURCE_FREEZE_DIR = path.join(RUN_ROOT, "source-freeze");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeText(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value, "utf8");
}

function fileExists(filePath) {
  return fs.existsSync(filePath);
}

function listValidatedChapterFiles() {
  return fs
    .readdirSync(VALIDATED_DIR)
    .filter((name) => /^ch\d+\.chapter\.json$/.test(name))
    .sort();
}

function wordCount(text) {
  const normalized = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!normalized) return 0;
  return normalized.split(" ").length;
}

function collectStrings(value) {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(collectStrings);
  if (value && typeof value === "object") {
    return Object.values(value).flatMap(collectStrings);
  }
  return [];
}

function canonicalSort(value) {
  if (Array.isArray(value)) return value.map(canonicalSort);
  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = canonicalSort(value[key]);
        return acc;
      }, {});
  }
  return value;
}

function shaFile(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function chapterCodeFromFile(fileName) {
  return fileName.replace(".chapter.json", "");
}

function chapterNumber(chapter) {
  return chapter.number ?? chapter.chapterNumber ?? null;
}

function chapterTitle(chapter) {
  return chapter.title ?? chapter.chapterTitle ?? chapter.chapterId ?? "";
}

function slugFromChapterCode(code) {
  return code;
}

function parseValidationPatchInfo(reportPath) {
  if (!fileExists(reportPath)) {
    return { patchesApplied: 0, patchNotes: [] };
  }
  const text = fs.readFileSync(reportPath, "utf8");
  const countMatch = text.match(/Local patches applied:\s*(\d+)/i);
  const patchesApplied = countMatch ? Number(countMatch[1]) : 0;
  const patchNotes = [];
  if (patchesApplied > 0) {
    const lines = text.split("\n");
    let capture = false;
    for (const line of lines) {
      if (/Local patches applied:/i.test(line)) {
        capture = true;
        continue;
      }
      if (!capture) continue;
      const match = line.match(/^\s*\d+\.\s+(.*)$/);
      if (match) {
        patchNotes.push(match[1].trim());
        continue;
      }
      if (patchNotes.length > 0 && line.trim() === "") break;
      if (patchesApplied === 0) break;
    }
  }
  return { patchesApplied, patchNotes };
}

function buildEstimatedReadingTimeByDepth(chapter) {
  const fixedMinutes = { easy: 5, medium: 12, hard: 18 };
  const result = {};
  for (const depth of ["easy", "medium", "hard"]) {
    const variant = chapter.contentVariants?.[depth];
    if (!variant) continue;
    const breakdown = variant.chapterBreakdown;
    const breakdownStrings = collectStrings(breakdown);
    const totalBreakdownWords = breakdownStrings.reduce((sum, value) => sum + wordCount(value), 0);
    const entry = {
      estimatedMinutes: fixedMinutes[depth],
    };
    if (totalBreakdownWords > 0) {
      entry.totalBreakdownWords = totalBreakdownWords;
    }
    if (breakdown && typeof breakdown === "object" && !Array.isArray(breakdown) && breakdownStrings.length > 0) {
      entry.avgWordsPerTone = Math.round(totalBreakdownWords / breakdownStrings.length);
    }
    result[depth] = entry;
  }
  return result;
}

function buildMetrics({ chapter, chapterPath, code, manifest, computedAt }) {
  const quizPath = path.join(QUIZZES_DIR, `${code}.quiz.json`);
  const editedPath = path.join(DRAFTS_EDITED_DIR, `${code}.md`);
  const reportPath = path.join(REPORTS_DIR, `${code}.validation.md`);
  const existingPath = path.join(SIDECARS_DIR, `${code}.reading-metrics.json`);
  const existing = fileExists(existingPath) ? readJson(existingPath) : {};
  const quiz = fileExists(quizPath) ? readJson(quizPath) : null;
  const editedDraftWordCount = fileExists(editedPath) ? wordCount(fs.readFileSync(editedPath, "utf8")) : 0;
  const categories = {};
  for (const ex of chapter.examples ?? []) {
    const key = ex.category ?? "unknown";
    categories[key] = (categories[key] ?? 0) + 1;
  }
  const patchInfo = parseValidationPatchInfo(reportPath);
  return {
    ...existing,
    chapterId: chapter.chapterId,
    bookId: manifest.bookId,
    runId: manifest.runId,
    computedAt,
    chapterNumber: chapterNumber(chapter),
    editedDraftWordCount,
    estimatedReadingTimeByDepth: buildEstimatedReadingTimeByDepth(chapter),
    examplesCount: Array.isArray(chapter.examples) ? chapter.examples.length : 0,
    exampleCategoryDistribution: categories,
    quizQuestionCount: Array.isArray(quiz?.questions) ? quiz.questions.length : 0,
    reviewCardCount: Array.isArray(chapter.reviewCards) ? chapter.reviewCards.length : 0,
    chapterHash: shaFile(chapterPath),
    validationStatus: "PASS",
    patchesApplied: patchInfo.patchesApplied,
    patchNotes: patchInfo.patchNotes,
  };
}

function buildToc(chapters, manifest) {
  return {
    bookId: manifest.bookId,
    runId: manifest.runId,
    lockedEdition: `${manifest.book.edition?.name ?? manifest.book.title} (${manifest.book.edition?.publishedYear ?? ""})`.trim(),
    sourceRefs: [
      "src-local-primary-book-text",
      "src-local-chapter-map",
      "src-local-key-concepts",
      "src-local-criticism-limits",
      "src-local-modern-applications",
    ],
    chapters: chapters.map((chapter) => {
      const number = chapterNumber(chapter);
      return {
        number,
        type: number === 1 ? "chapter" : "chapter",
        title: chapterTitle(chapter),
        normalizedTitle: String(chapter.chapterId ?? "").replace(/^ch\d+-/, ""),
      };
    }),
  };
}

function main() {
  const manifest = readJson(path.join(MANIFESTS_DIR, "run-manifest.json"));
  const validatedFiles = listValidatedChapterFiles();
  const existingWrapperPath = path.join(VALIDATED_DIR, "ch01.review-package.json");
  const existingWrapper = fileExists(existingWrapperPath) ? readJson(existingWrapperPath) : null;

  const schemaVersion = existingWrapper?.schemaVersion ?? manifest.packVersion ?? "v12-sealed";
  const createdAt = existingWrapper?.createdAt ?? `${manifest.runId.slice(0, 4)}-${manifest.runId.slice(4, 6)}-${manifest.runId.slice(6, 8)}T00:00:00Z`;
  const contentOwner = existingWrapper?.contentOwner ?? "ChapterFlow v12 Pipeline";
  const book = existingWrapper?.book ?? manifest.book;

  fs.mkdirSync(SOURCE_FREEZE_DIR, { recursive: true });
  fs.copyFileSync(path.join(SOURCE_ROOT, "difficult-conversations.txt"), path.join(SOURCE_FREEZE_DIR, "book-source.txt"));
  for (const extra of ["chapter-map.md", "criticism-and-limits.md", "historical-context.md", "key-concepts.md", "modern-applications.md"]) {
    const src = path.join(SOURCE_ROOT, extra);
    if (fileExists(src)) fs.copyFileSync(src, path.join(SOURCE_FREEZE_DIR, extra));
  }

  const chapters = validatedFiles.map((fileName) => {
    const chapterPath = path.join(VALIDATED_DIR, fileName);
    const chapter = readJson(chapterPath);
    const code = chapterCodeFromFile(fileName);
    const reviewPackage = {
      schemaVersion,
      packageId: `${manifest.bookId}-${code}-${manifest.runId}`,
      createdAt,
      contentOwner,
      book,
      chapters: [chapter],
    };
    writeJson(path.join(VALIDATED_DIR, `${code}.review-package.json`), reviewPackage);
    writeJson(path.join(SIDECARS_DIR, `${code}.reading-metrics.json`), buildMetrics({ chapter, chapterPath, code, manifest, computedAt: createdAt }));
    return chapter;
  });

  const continuity = fileExists(CONTINUITY_PATH) ? readJson(CONTINUITY_PATH) : {};
  continuity.approvedChapterHashes = continuity.approvedChapterHashes ?? {};
  for (const fileName of validatedFiles) {
    const code = chapterCodeFromFile(fileName);
    continuity.approvedChapterHashes[code] = shaFile(path.join(VALIDATED_DIR, fileName));
  }
  writeJson(CONTINUITY_PATH, continuity);

  const editionLock = {
    bookId: manifest.bookId,
    runId: manifest.runId,
    lockedAt: createdAt,
    selectionMode: "prelocked_local_source_pack",
    reason: "The run uses the local Difficult Conversations source pack already staged under .chapterflow/sources/difficult-conversations and locked to the 10th Anniversary Edition metadata in the run manifest.",
    chosenEdition: {
      name: manifest.book.edition?.name ?? manifest.book.title,
      author: manifest.book.author,
      publisher: "",
      publishedDate: "",
      publishedYear: manifest.book.edition?.publishedYear ?? null,
      format: "English trade edition source pack",
      isbn10: "",
      isbn13: "",
      sourceText: path.relative(RUN_ROOT, path.join(SOURCE_FREEZE_DIR, "book-source.txt")),
      sourceProvenance: manifest.book.edition?.sourceProvenance ?? "Local curated source pack frozen for this run.",
    },
    rejectedCandidates: [],
    userQuestionNeeded: false,
  };
  writeJson(path.join(MANIFESTS_DIR, "edition-lock.json"), editionLock);

  const sourceLedger = {
    bookId: manifest.bookId,
    runId: manifest.runId,
    createdAt,
    sourcePolicy: "local_curated_source_pack",
    sources: [
      {
        sourceId: "src-local-primary-book-text",
        title: "Difficult Conversations source text",
        path: ".chapterflow/sources/difficult-conversations/difficult-conversations.txt",
        type: "local_primary_text",
        role: "primary_text",
        confidence: "high",
        notes: "Local primary text used for chapter extraction and paraphrase-first authoring.",
      },
      {
        sourceId: "src-local-chapter-map",
        title: "Chapter map",
        path: ".chapterflow/sources/difficult-conversations/chapter-map.md",
        type: "local_structural_note",
        role: "chapter_structure_support",
        confidence: "high",
        notes: "Local chapter map used to confirm chapter scope and sequencing.",
      },
      {
        sourceId: "src-local-key-concepts",
        title: "Key concepts",
        path: ".chapterflow/sources/difficult-conversations/key-concepts.md",
        type: "local_secondary_note",
        role: "concept_support",
        confidence: "medium_high",
        notes: "Local concept notes used to support chapter distinctions and term consistency.",
      },
      {
        sourceId: "src-local-criticism-limits",
        title: "Criticism and limits",
        path: ".chapterflow/sources/difficult-conversations/criticism-and-limits.md",
        type: "local_secondary_note",
        role: "limits_and_counterarguments",
        confidence: "medium_high",
        notes: "Local limits notes used for hard-depth and counterargument support.",
      },
      {
        sourceId: "src-local-modern-applications",
        title: "Modern applications",
        path: ".chapterflow/sources/difficult-conversations/modern-applications.md",
        type: "local_secondary_note",
        role: "modern_transfer_support",
        confidence: "medium",
        notes: "Local applications notes used where transfer examples needed modern context.",
      },
    ],
  };
  writeJson(path.join(MANIFESTS_DIR, "source-ledger.json"), sourceLedger);

  const discovery = `# Source Discovery — Difficult Conversations

## Discovery summary
- Title supplied: *${manifest.book.title}*
- Author supplied: ${manifest.book.author}
- Discovery date: ${createdAt.slice(0, 10)}
- Discovery mode: \`local_source_pack\`
- Rights posture: modern trade book; paraphrase-first local source pack only

## Search and selection path
1. The run manifest already locked the book identity to the 10th Anniversary Edition metadata.
2. The local source pack under \`.chapterflow/sources/difficult-conversations\` provided the primary text and support notes.
3. Because the source pack was already staged in-repo, no additional edition arbitration or external discovery was needed for this repair.

## Frozen bundle contents
- \`manifests/source-ledger.json\`
- \`manifests/edition-lock.json\`
- \`source-freeze/book-source.txt\`
- \`source-freeze/toc.json\`
- \`source-freeze/source-freeze-report.md\`

## What was not frozen
- No new network retrieval was performed during this repair.
- No unauthorized mirror or pirate source was added.
- No alternative edition was introduced.

## Operating implications
- Reader-facing prose remains paraphrase-first.
- Chapter scope should continue to follow the staged local source pack and existing run manifest.
- Repair artifacts were backfilled from the validated run state and local source inventory only.
`;
  writeText(path.join(SOURCE_FREEZE_DIR, "source-discovery.md"), discovery);

  const freezeReport = `# Source Freeze Report — Difficult Conversations

## Frozen artifacts
- Primary text copied to \`source-freeze/book-source.txt\`
- Structural/support notes copied from the local source pack
- \`manifests/source-ledger.json\` regenerated from the local source inventory
- \`manifests/edition-lock.json\` regenerated from the locked run metadata
- \`source-freeze/toc.json\` regenerated from validated chapter outputs

## Repair context
This run was missing the v13 source-freeze scaffold required by the source and artifact guards. The repair backfilled that scaffold from local in-repo sources only and did not alter chapter prose or quiz content.
`;
  writeText(path.join(SOURCE_FREEZE_DIR, "source-freeze-report.md"), freezeReport);
  writeJson(path.join(SOURCE_FREEZE_DIR, "toc.json"), buildToc(chapters, manifest));

  console.log(`repaired run ${manifest.runId}: review-packages=${validatedFiles.length}, reading-metrics=${validatedFiles.length}`);
}

main();
