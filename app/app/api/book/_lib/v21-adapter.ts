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
  V21ChapterExtras,
  V21ExperiencePlan,
  V21ReaderPattern,
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
        // Leave correctIndex undefined when the authored key is missing — do NOT
        // fabricate 0. Defaulting to 0 silently grades every reader against choice
        // A and defeats the "quiz_question_missing_answer_key" guards in
        // quiz-session.ts/content-service.ts/quiz-service.ts, which fire only when
        // this is not a number. JSON.stringify drops the undefined key on S3 write.
        correctIndex: typeof r.correctIndex === "number" ? r.correctIndex : undefined,
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

function adaptMemorableLines(raw: unknown): V21ChapterExtras["memorableLines"] {
  if (!Array.isArray(raw)) return undefined;
  const lines = raw
    .map((ml) => {
      const rec = isRecord(ml) ? ml : {};
      const text = asString(rec.text);
      if (!text) return null;
      const location = asString(rec.location);
      const why = asString(rec.why);
      return {
        text,
        ...(location ? { location } : {}),
        ...(why ? { why } : {}),
      };
    })
    .filter((line): line is { text: string; location?: string; why?: string } => line !== null);
  return lines.length > 0 ? lines : undefined;
}

/**
 * Collect the v21-only chapter fields (hook / counterintuition / tryThisNow /
 * keyTakeaway / structured memorableLines) so they survive ingestion and reach
 * the reader. Returns undefined when none are present (e.g. native v13).
 */
function adaptV21Extras(ch: Record<string, unknown>): V21ChapterExtras | undefined {
  const hook = asString(ch.hook);
  const counterintuition = asString(ch.counterintuition);
  const tryThisNow = asString(ch.tryThisNow);
  const keyTakeaway = asString(ch.keyTakeaway);
  const memorableLines = adaptMemorableLines(ch.memorableLines);
  const experiencePlan = adaptExperiencePlan(ch.experiencePlan);

  const extras: V21ChapterExtras = {};
  if (hook) extras.hook = hook;
  if (counterintuition) extras.counterintuition = counterintuition;
  if (tryThisNow) extras.tryThisNow = tryThisNow;
  if (keyTakeaway) extras.keyTakeaway = keyTakeaway;
  if (memorableLines) extras.memorableLines = memorableLines;
  if (experiencePlan) extras.experiencePlan = experiencePlan;

  return Object.keys(extras).length > 0 ? extras : undefined;
}

/** Behavior-change layer. `asString` returns "" and `asStringArray` keeps empty
 *  strings, so each field is trimmed and a sub-object is surfaced ONLY when
 *  complete — never `{ normalizingLine: "" }`. Mirrors the client extractor. */
function adaptExperiencePlan(raw: unknown): V21ExperiencePlan | undefined {
  if (!isRecord(raw)) return undefined;
  const result: V21ExperiencePlan = {};

  const fr = isRecord(raw.failureRecovery) ? raw.failureRecovery : undefined;
  if (fr) {
    const normalizingLine = asString(fr.normalizingLine).trim();
    const cueQuestion = asString(fr.cueQuestion).trim();
    const repairLine = asString(fr.repairLine).trim();
    const options = asStringArray(fr.options).map((s) => s.trim()).filter(Boolean);
    if (normalizingLine && cueQuestion && repairLine && options.length > 0) {
      result.failureRecovery = { normalizingLine, cueQuestion, options, repairLine };
    }
  }

  const tp = isRecord(raw.transferPrompt) ? raw.transferPrompt : undefined;
  if (tp) {
    const prompt = asString(tp.prompt).trim();
    const contexts = asStringArray(tp.contexts).map((s) => s.trim()).filter(Boolean);
    if (prompt && contexts.length > 0) {
      result.transferPrompt = { prompt, contexts };
    }
  }

  const bl = isRecord(raw.behaviorLoop) ? raw.behaviorLoop : undefined;
  if (bl) {
    const rawPatterns = Array.isArray(bl.readerPatterns) ? bl.readerPatterns : [];
    const patterns: V21ReaderPattern[] = [];
    for (const rp of rawPatterns) {
      if (!isRecord(rp)) continue;
      const id = asString(rp.id).trim();
      const label = asString(rp.label).trim();
      if (!id || !label) continue; // surface only complete patterns
      const pattern: V21ReaderPattern = { id, label };
      if (typeof rp.mapsToPlanIndex === "number" && Number.isInteger(rp.mapsToPlanIndex)) {
        pattern.mapsToPlanIndex = rp.mapsToPlanIndex;
      }
      if (typeof rp.mapsToExampleIndex === "number" && Number.isInteger(rp.mapsToExampleIndex)) {
        pattern.mapsToExampleIndex = rp.mapsToExampleIndex;
      }
      patterns.push(pattern);
    }
    if (patterns.length > 0) {
      result.behaviorLoop = { readerPatterns: patterns };
    }
  }

  return result.failureRecovery || result.transferPrompt || result.behaviorLoop
    ? result
    : undefined;
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
    v21Extras: adaptV21Extras(ch),
  };
}

const KEBAB_CASE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function adaptBook(raw: unknown): BookPackageBook {
  const b = isRecord(raw) ? raw : {};
  const bookIdRaw = asString(b.bookId);
  // Normalize bookId defensively. v13 packages occasionally shipped with
  // mixed-case bookIds ("Getting-Things-Done") that would create duplicate
  // DDB catalog rows separate from the existing lowercase entry. Lower-case
  // the bookId so downstream ingest writes to the canonical row regardless
  // of which casing the operator/agent ran the pipeline with.
  const bookId = KEBAB_CASE.test(bookIdRaw) ? bookIdRaw : bookIdRaw.toLowerCase();
  return {
    bookId,
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
 * existing validator and ingestion pipeline expect. Performs its OWN structural
 * coercion (incl. the v21-only extras like experiencePlan/behaviorLoop) as it
 * goes — validateBookPackage returns this output directly and does NOT re-run the
 * v13 parser on it. That is deliberate: re-validating through parseV21Extras would
 * strip experiencePlan (it carries only hook/counterintuition/tryThisNow/
 * keyTakeaway/memorableLines). Do not add a re-validation pass here without first
 * teaching parseV21Extras to passthrough experiencePlan, or the behavior-loop
 * layer would silently vanish.
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
