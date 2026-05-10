import type {
  BookPackage,
  BookPackageBook,
  BookPackageChapter,
  BookPackageExample,
  BookPackageQuiz,
  ChapterVariantContent,
  ImplementationPlan,
  ReviewCard,
  ToneKeyed,
  VariantKey,
} from "./types";

/**
 * Server-side v21 → v13 adapter.
 *
 * The v21 schema (`chapterflow-v21-authored`) has a single canonical voice
 * (no tone matrix), three breakdown tiers (`fastRead`/`deepRead`/`fullRead`),
 * and v21-specific fields like `hook`, `counterintuition`, and
 * `memorableLines`. The catalog/ingestion/manifest pipeline downstream is
 * built against the v13 BookPackage shape, which carries tone-keyed strings
 * (`{ gentle, direct, competitive }`) and `easy`/`medium`/`hard` variants.
 *
 * Rather than teach every downstream stage about v21, this adapter converts
 * v21 raw input to the v13-shape BookPackage at validation time. The client
 * still bundles the original v21 JSON via `app/book/lib/v21-adapter.ts`,
 * which keeps v21-only fields (hook, memorable lines) accessible to the
 * reader. The catalog stores the adapted v13-shape.
 */

function toToneKeyed(value: string): ToneKeyed {
  return { gentle: value, direct: value, competitive: value };
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function adaptVariant(prose: string, takeaways: string[]): ChapterVariantContent {
  const tk = toToneKeyed(prose);
  const variant: ChapterVariantContent = {
    chapterBreakdown: tk,
    summaryBlocks: [
      ...prose.split(/\n\n+/).filter((p) => p.trim().length > 0).map((p) => ({
        type: "paragraph" as const,
        text: p.trim(),
      })),
      ...takeaways.map((t) => ({ type: "bullet" as const, text: t })),
    ],
  };
  if (takeaways.length > 0) {
    variant.takeaways = takeaways;
    variant.keyTakeaways = takeaways.map((point) => ({ point: toToneKeyed(point) }));
  }
  return variant;
}

function adaptExample(raw: unknown, idx: number): BookPackageExample {
  const ex = isRecord(raw) ? raw : {};
  const tags = asStringArray(ex.tags);
  const planSpec = isRecord(ex.planSpec) ? ex.planSpec : {};
  const scenarioStr = asString(ex.scenario);
  const whatToDoStr = asString(ex.whatToDo);
  const whyItMatters = asString(ex.whyItMatters);
  return {
    exampleId: asString(ex.exampleId) || `ex-${idx + 1}`,
    title: asString(ex.title) || `Example ${idx + 1}`,
    scenario: scenarioStr,
    whatToDo: whatToDoStr ? [whatToDoStr] : [],
    whyItMatters,
    contexts: tags.length > 0
      ? tags
      : (asString(planSpec.domain) ? [asString(planSpec.domain)] : []),
    format: asString(planSpec.format) || undefined,
  };
}

function adaptQuiz(raw: unknown): BookPackageQuiz {
  const q = isRecord(raw) ? raw : {};
  const passing = typeof q.passingScorePercent === "number" ? q.passingScorePercent : 70;
  const questionsRaw = Array.isArray(q.questions) ? q.questions : [];
  return {
    passingScorePercent: passing,
    questions: questionsRaw.map((rq, i) => {
      const r = isRecord(rq) ? rq : {};
      return {
        questionId: asString(r.questionId) || `q-${i + 1}`,
        prompt: asString(r.prompt),
        choices: asStringArray(r.choices),
        correctIndex: typeof r.correctIndex === "number" ? r.correctIndex : 0,
        explanation: asString(r.explanation),
        bloomsLevel: asString(r.bloomsLevel) || undefined,
        depthLevel: asString(r.depthLevel) || undefined,
      };
    }),
  };
}

function adaptReviewCards(raw: unknown): ReviewCard[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((rc, i) => {
    const r = isRecord(rc) ? rc : {};
    const difficultyRaw = asString(r.difficulty);
    const difficulty: "easy" | "medium" | "hard" =
      difficultyRaw === "medium" || difficultyRaw === "hard" ? difficultyRaw : "easy";
    return {
      cardId: asString(r.cardId) || `rc-${i + 1}`,
      front: toToneKeyed(asString(r.front)),
      back: toToneKeyed(asString(r.back)),
      difficulty,
    };
  });
}

function adaptImplementationPlan(raw: unknown): ImplementationPlan | undefined {
  if (!isRecord(raw)) return undefined;
  const ifThenRaw = Array.isArray(raw.ifThenPlans) ? raw.ifThenPlans : [];
  const coreSkill = asString(raw.coreSkill);
  if (!coreSkill && ifThenRaw.length === 0) return undefined;
  return {
    coreSkill: toToneKeyed(coreSkill),
    ifThenPlans: ifThenRaw.map((it, idx) => {
      const item = isRecord(it) ? it : {};
      return {
        context: asString(item.context) || `Plan ${idx + 1}`,
        plan: toToneKeyed(asString(item.plan)),
      };
    }),
    twentyFourHourChallenge: toToneKeyed(asString(raw.twentyFourHourChallenge)),
    weeklyPractice: toToneKeyed(asString(raw.weeklyPractice)),
  };
}

function adaptChapter(raw: unknown): BookPackageChapter {
  const ch = isRecord(raw) ? raw : {};
  const breakdown = isRecord(ch.breakdown) ? ch.breakdown : {};
  const fastRead = asString(breakdown.fastRead);
  const deepRead = asString(breakdown.deepRead);
  const fullRead = asString(breakdown.fullRead);

  const memorableLineTexts = (Array.isArray(ch.memorableLines) ? ch.memorableLines : [])
    .map((ml) => asString(isRecord(ml) ? ml.text : undefined))
    .filter((s) => s.length > 0);

  const contentVariants: Partial<Record<VariantKey, ChapterVariantContent>> = {};
  if (fastRead) contentVariants.easy = adaptVariant(fastRead, memorableLineTexts);
  if (deepRead) contentVariants.medium = adaptVariant(deepRead, memorableLineTexts);
  if (fullRead) contentVariants.hard = adaptVariant(fullRead, memorableLineTexts);

  const examples = Array.isArray(ch.examples) ? ch.examples : [];
  const keyTakeawayStr = asString(ch.keyTakeaway);

  return {
    chapterId: asString(ch.chapterId) || `ch-${ch.number ?? 0}`,
    number: typeof ch.number === "number" ? ch.number : 0,
    title: asString(ch.title),
    readingTimeMinutes: typeof ch.readingTimeMinutes === "number" ? ch.readingTimeMinutes : 8,
    contentVariants,
    examples: examples.map(adaptExample),
    quiz: adaptQuiz(ch.quiz),
    implementationPlan: adaptImplementationPlan(ch.implementationPlan),
    reviewCards: adaptReviewCards(ch.reviewCards).length > 0 ? adaptReviewCards(ch.reviewCards) : undefined,
    keyTakeawayCard: keyTakeawayStr ? toToneKeyed(keyTakeawayStr) : undefined,
  };
}

function adaptBook(raw: unknown): BookPackageBook {
  const b = isRecord(raw) ? raw : {};
  return {
    bookId: asString(b.bookId),
    title: asString(b.title),
    author: asString(b.author),
    categories: asStringArray(b.categories),
    tags: asStringArray(b.tags),
    variantFamily: "EMH",
  };
}

/** Detect a v21-authored package by schemaVersion. */
export function isV21Raw(raw: unknown): boolean {
  return isRecord(raw) && raw.schemaVersion === "chapterflow-v21-authored";
}

/**
 * Convert a v21-authored raw package to the v13-shape BookPackage that the
 * existing validator and ingestion pipeline expect. Performs minimal
 * structural validation as it goes; the caller (validate-book-package.ts)
 * runs the full v13 validator on the output for defense in depth.
 */
export function adaptV21ToV13(raw: unknown): BookPackage {
  const r = isRecord(raw) ? raw : {};
  const chapters = Array.isArray(r.chapters) ? r.chapters : [];
  return {
    schemaVersion: "chapterflow-v21-authored",
    packageId: asString(r.packageId) || `pkg-${Date.now()}`,
    createdAt: asString(r.createdAt) || new Date().toISOString(),
    contentOwner: asString(r.contentOwner) || "chapterflow",
    book: adaptBook(r.book),
    chapters: chapters.map(adaptChapter),
  };
}
