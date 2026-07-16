// JSON-free book-package transform core (server-safe).
//
// Extracted from bookPackages.ts so SERVER code can normalize a raw v21/v13
// package WITHOUT importing bookPackages.ts, which statically imports ~37 MB
// of book JSON and would otherwise blow the OpenNext ServerFn Lambda past the
// 250 MiB unzipped limit. Depends only on the (JSON-free) v21 adapter.
// bookPackages.ts re-exports everything here, so client call sites are
// unchanged; server code imports from here (and book-package-source.ts).

import { isV21RawPackage, normalizeV21Package } from "@/app/book/lib/v21-adapter";

export type VariantFamily = "EMH" | "PBC";
export type VariantKey =
  | "easy"
  | "medium"
  | "hard"
  | "precise"
  | "balanced"
  | "challenging";

export type PackageSummaryBlock =
  | {
      type: "paragraph";
      text: string;
    }
  | {
      type: "bullet";
      text: string;
      detail?: string;
    };

export type PackageVariantContent = {
  chapterBreakdown?: string;
  importantSummary?: string;
  summaryBullets?: string[];
  summaryBlocks?: PackageSummaryBlock[];
  keyTakeaways?: string[];
  takeaways?: string[];
  practice?: string[];
  oneMinuteRecap?: string[];
  activationPrompt?: string;
  selfCheckPrompt?: string;
  selfCheckPrompts?: string[];
  reflectionPrompts?: string[];
  closingPrompt?: string;
  predictionPrompt?: string;
};

export type PackageQuizQuestion = {
  questionId: string;
  prompt?: string;
  stem?: string;
  choices?: string[];
  options?: string[];
  correctIndex?: number;
  correctAnswerIndex?: number;
  explanation?: string | Record<string, string>;
};

export type PackageQuiz = {
  chapterId?: string;
  chapterNumber?: number;
  chapterTitle?: string;
  passingScorePercent: number;
  questions: PackageQuizQuestion[];
  retryQuestions?: PackageQuizQuestion[];
};

export type PackageExample = {
  exampleId: string;
  title: string;
  scenario: string;
  whatToDo: string[];
  whyItMatters: string;
  contexts?: string[];
  reflectionPrompt?: string;
};

export type PackageImplementationPlan = {
  coreSkill: string;
  ifThenPlans: Array<{ context: string; plan: string }>;
  twentyFourHourChallenge: string;
  weeklyPractice: string;
};

export type PackageReviewCard = {
  cardId: string;
  front: string;
  back: string;
  difficulty: "easy" | "medium" | "hard";
};

export type PackageChapter = {
  chapterId: string;
  number: number;
  title: string;
  readingTimeMinutes: number;
  contentVariants: Partial<Record<VariantKey, PackageVariantContent>>;
  examples: PackageExample[];
  quiz: PackageQuiz;
  implementationPlan?: PackageImplementationPlan;
  reviewCards?: PackageReviewCard[];
  keyTakeawayCard?: string;
};

export type PackageBook = {
  bookId: string;
  title: string;
  author: string;
  categories: string[];
  tags?: string[];
  edition?:
    | string
    | {
        name: string;
        publishedYear?: number | null;
        publisher?: string;
        publishedDate?: string;
        imprintFamily?: string[];
        isbn10?: string;
        isbn13?: string;
        format?: string;
        language?: string;
        translator?: string;
        translationYear?: number | null;
        openLibraryEdition?: string;
        sourceText?: string;
        sourceProvenance?: string;
      };
  variantFamily: VariantFamily;
  chapterRange?: string;
};

export type BookPackage = {
  schemaVersion: string;
  packageId: string;
  createdAt: string;
  contentOwner: string;
  book: PackageBook;
  chapters: PackageChapter[];
  /**
   * D10 authoring marker. Pre-v25 v21 books author their read layers
   * SERIALLY — `fastRead` is ~15% of the prose, `deepRead`/`fullRead` add
   * complementary slices — so the reader composes them cumulatively
   * (Standard = fast+deep, Challenge = all three) to recover the hidden prose.
   *
   * Books authored under D8 / Chapter-Format-v25 (F-1 layer independence) make
   * each layer a self-contained superset; blind concatenation would DUPLICATE
   * their content. Such books set `layerIndependent: true` so the reader keeps
   * single-layer-per-mode rendering. Absent/false ⇒ serial-layer ⇒ compose.
   */
  layerIndependent?: boolean;
};

export type BookPackagePresentation = {
  icon: string;
  coverImage?: string;
  difficulty: "Easy" | "Medium" | "Hard";
  synopsis: string;
  pages?: number;
};

/* ── NSTD tone-aware JSON normalization ────────────────────────────── */

export type ToneObject = { gentle?: string; direct?: string; competitive?: string };
export type ToneKey = "gentle" | "direct" | "competitive";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

export function getRawChapters(raw: unknown): unknown[] {
  const record = asRecord(raw);
  return Array.isArray(record?.chapters) ? record.chapters : [];
}

export function resolveTone(value: unknown, tone: ToneKey = "direct"): string {
  if (typeof value === "string") return value;
  const record = asRecord(value);
  if (record) {
    if (typeof record[tone] === "string") return record[tone] as string;
    for (const k of ["direct", "gentle", "competitive"] as const) {
      if (typeof record[k] === "string") return record[k] as string;
    }
  }
  return "";
}

export function isV12BookPackage(bookPackage: Pick<BookPackage, "schemaVersion"> | undefined): boolean {
  return bookPackage?.schemaVersion === "1.1.0";
}

/**
 * Books on the v21-authored schema render the same way as strict-v12 books in
 * the reader: exact prose, three breakdown tiers, no fabricated content. The
 * only difference is the additional v21 surfaces (hook, reflections,
 * memorable lines) which are attached separately on the BookChapter object.
 */
export function isStrictReaderSchema(
  bookPackage: Pick<BookPackage, "schemaVersion"> | undefined,
): boolean {
  return (
    bookPackage?.schemaVersion === "1.1.0" ||
    bookPackage?.schemaVersion === "chapterflow-v21-authored"
  );
}

function normalizeNstdVariant(v: Record<string, unknown> | null | undefined, tone: ToneKey = "direct"): PackageVariantContent {
  const summaryBlocks: PackageSummaryBlock[] = [];

  // chapterBreakdown → paragraphs (tone-object format, e.g. 48 Laws)
  const chapterBreakdown = resolveTone(v?.chapterBreakdown, tone);
  if (chapterBreakdown) {
    for (const p of chapterBreakdown.split(/\n\n+/).filter((s: string) => s.trim())) {
      summaryBlocks.push({ type: "paragraph", text: p.trim() });
    }
  }

  // keyTakeaways → bullets + string list
  const keyTakeaways: string[] = [];
  if (Array.isArray(v?.keyTakeaways)) {
    for (const kt of v.keyTakeaways) {
      const point = typeof kt === "string" ? kt : resolveTone(kt?.point, tone);
      if (!point) continue;
      keyTakeaways.push(point);
      const detail = kt?.moreDetails ? resolveTone(kt.moreDetails, tone) : undefined;
      summaryBlocks.push({ type: "bullet", text: point, detail });
    }
  }

  // oneMinuteRecap → explicit recap items + legacy practice list
  const oneMinuteRecap: string[] = [];
  const practice: string[] = [];
  if (v?.oneMinuteRecap) {
    const recapRecord = asRecord(v.oneMinuteRecap);
    if (recapRecord?.retrieve) {
      const retrieve = resolveTone(recapRecord.retrieve, tone);
      const connect = resolveTone(recapRecord.connect, tone);
      const preview = resolveTone(recapRecord.preview, tone);
      if (retrieve) {
        oneMinuteRecap.push(retrieve);
        practice.push(retrieve);
      }
      if (connect) {
        oneMinuteRecap.push(connect);
        practice.push(connect);
      }
      if (preview) {
        oneMinuteRecap.push(preview);
        practice.push(preview);
      }
    } else {
      const recap = resolveTone(v.oneMinuteRecap, tone);
      if (recap) {
        oneMinuteRecap.push(recap);
        practice.push(recap);
      }
    }
  }
  const activationPrompt = v?.activationPrompt ? resolveTone(v.activationPrompt, tone) : undefined;
  const selfCheckPrompt = v?.selfCheckPrompt ? resolveTone(v.selfCheckPrompt, tone) : undefined;
  const selfCheckPrompts = Array.isArray(v?.selfCheckPrompts)
    ? v.selfCheckPrompts
        .map((p: unknown) => resolveTone(p, tone))
        .filter(Boolean)
    : undefined;
  const reflectionPrompts = Array.isArray(v?.reflectionPrompts)
    ? v.reflectionPrompts
        .map((p: unknown) => resolveTone(p, tone))
        .filter(Boolean)
    : undefined;
  const closingPrompt = v?.closingPrompt ? resolveTone(v.closingPrompt, tone) : undefined;
  const predictionPrompt = v?.predictionPrompt ? resolveTone(v.predictionPrompt, tone) : undefined;

  if (selfCheckPrompt) practice.push(selfCheckPrompt);
  if (Array.isArray(selfCheckPrompts)) {
    for (const prompt of selfCheckPrompts) practice.push(prompt);
  }
  if (predictionPrompt) practice.push(predictionPrompt);

  return {
    chapterBreakdown: chapterBreakdown || undefined,
    importantSummary: undefined,
    summaryBullets: undefined,
    summaryBlocks,
    keyTakeaways: keyTakeaways.length > 0 ? keyTakeaways : undefined,
    practice: practice.length > 0 ? practice : undefined,
    oneMinuteRecap: oneMinuteRecap.length > 0 ? oneMinuteRecap : undefined,
    activationPrompt,
    selfCheckPrompt,
    selfCheckPrompts: selfCheckPrompts && selfCheckPrompts.length > 0 ? selfCheckPrompts : undefined,
    reflectionPrompts: reflectionPrompts && reflectionPrompts.length > 0 ? reflectionPrompts : undefined,
    closingPrompt,
    predictionPrompt,
  };
}

function titleCase(value: string): string {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/**
 * Normalizes ANY raw book package (v13 modern.json or v21 .v21.json) into the
 * reader's `BookPackage` shape. Detects the v21 schema and routes through the
 * v21 adapter; otherwise falls back to the legacy v13 normalizer.
 * v21 books are tone-invariant (single canonical voice) — the `tone` argument
 * is ignored for them.
 */
export function normalizeAnyPackage(raw: unknown, tone: ToneKey = "direct"): BookPackage {
  if (isV21RawPackage(raw)) {
    return normalizeV21Package(raw);
  }
  return normalizeNstdPackage((raw ?? {}) as Record<string, unknown>, tone);
}

function normalizeNstdPackage(raw: Record<string, unknown>, tone: ToneKey = "direct"): BookPackage {
  const chapters: PackageChapter[] = getRawChapters(raw).map((chapter) => {
    const ch = asRecord(chapter) ?? {};
    const contentVariants: Partial<Record<VariantKey, PackageVariantContent>> = {};
    for (const key of ["easy", "medium", "hard"] as const) {
      const variants = asRecord(ch.contentVariants);
      const v = asRecord(variants?.[key]);
      if (v) contentVariants[key] = normalizeNstdVariant(v, tone);
    }
    return {
      chapterId: ch.chapterId as string,
      number: ch.number as number,
      title: ch.title as string,
      readingTimeMinutes: ch.readingTimeMinutes as number,
      contentVariants,
      examples: (Array.isArray(ch.examples) ? ch.examples : []).map((example, index) => {
        const ex = asRecord(example) ?? {};
        const fallbackCategory =
          typeof ex.category === "string" && ex.category.trim() ? ex.category.trim() : "example";
        const fallbackFormat =
          typeof ex.format === "string" && ex.format.trim() ? ex.format.trim() : fallbackCategory;
        const exampleId =
          typeof ex.exampleId === "string" && ex.exampleId.trim()
            ? ex.exampleId
            : `${fallbackFormat}-${index + 1}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
        const title =
          typeof ex.title === "string" && ex.title.trim()
            ? ex.title
            : `${titleCase(fallbackFormat)} ${index + 1}`;
        return {
          exampleId,
          title,
          scenario: resolveTone(ex.scenario, tone),
          whatToDo: Array.isArray(ex.whatToDo)
            ? ex.whatToDo
              .map((step: unknown) => resolveTone(step, tone))
              .filter(Boolean)
            : [resolveTone(ex.whatToDo, tone)].filter(Boolean),
          whyItMatters: resolveTone(ex.whyItMatters, tone),
          contexts: Array.isArray(ex.contexts)
            ? ex.contexts.filter((context): context is string => typeof context === "string")
            : typeof ex.category === "string"
              ? [ex.category]
              : [],
          reflectionPrompt: ex.reflectionPrompt ? resolveTone(ex.reflectionPrompt, tone) : undefined,
        };
      }),
      quiz: {
        passingScorePercent: (asRecord(ch.quiz)?.passingScorePercent as number | undefined) ?? 80,
        questions: (Array.isArray(asRecord(ch.quiz)?.questions) ? (asRecord(ch.quiz)?.questions as unknown[]) : []).map((question) => {
          const q = asRecord(question) ?? {};
          return {
            questionId: q.questionId as string,
            prompt: (q.prompt ?? q.stem) as string | undefined,
            choices: (q.choices ?? q.options) as string[] | undefined,
            correctIndex: (q.correctIndex ?? q.correctAnswerIndex) as number | undefined,
            explanation: resolveTone(q.explanation, tone),
          };
        }),
        retryQuestions: (Array.isArray(asRecord(ch.quiz)?.retryQuestions)
          ? (asRecord(ch.quiz)?.retryQuestions as unknown[])
          : []).map((question) => {
          const q = asRecord(question) ?? {};
          return {
            questionId: q.questionId as string,
            prompt: (q.prompt ?? q.stem) as string | undefined,
            choices: (q.choices ?? q.options) as string[] | undefined,
            correctIndex: (q.correctIndex ?? q.correctAnswerIndex) as number | undefined,
            explanation: resolveTone(q.explanation, tone),
          };
        }),
      },
      implementationPlan: ch.implementationPlan
        ? {
            coreSkill: resolveTone(
              asRecord(ch.implementationPlan)?.coreSkill ??
                asRecord(ch.implementationPlan)?.concreteAction,
              tone
            ),
            ifThenPlans: (
              Array.isArray(asRecord(ch.implementationPlan)?.ifThenPlans)
                ? (asRecord(ch.implementationPlan)?.ifThenPlans as unknown[])
                : asRecord(ch.implementationPlan)?.ifThenPlan
                  ? [{ context: "If-Then Plan", plan: asRecord(ch.implementationPlan)?.ifThenPlan }]
                  : []
            ).map((item, index) => {
              const planItem = asRecord(item) ?? {};
              return {
                context:
                  typeof planItem.context === "string" && planItem.context.trim()
                    ? planItem.context
                    : `Plan ${index + 1}`,
                plan: resolveTone(planItem.plan ?? planItem, tone),
              };
            }),
            twentyFourHourChallenge: resolveTone(
              asRecord(ch.implementationPlan)?.twentyFourHourChallenge ??
                asRecord(ch.implementationPlan)?.checkpoint,
              tone
            ),
            weeklyPractice: resolveTone(
              asRecord(ch.implementationPlan)?.weeklyPractice ??
                asRecord(ch.implementationPlan)?.friction,
              tone
            ),
          }
        : undefined,
      reviewCards: Array.isArray(ch.reviewCards)
        ? ch.reviewCards.map((card, index: number) => {
            const reviewCard = asRecord(card) ?? {};
            return {
              cardId: (reviewCard.cardId as string | undefined) ?? `rc-${index + 1}`,
              front: resolveTone(reviewCard.front, tone),
              back: resolveTone(reviewCard.back, tone),
              difficulty: (reviewCard.difficulty as "easy" | "medium" | "hard" | undefined) ?? "easy",
            };
          })
        : undefined,
      keyTakeawayCard: ch.keyTakeawayCard ? resolveTone(ch.keyTakeawayCard, tone) : undefined,
    } satisfies PackageChapter;
  });
  return {
    schemaVersion: raw.schemaVersion as string,
    packageId: raw.packageId as string,
    createdAt: raw.createdAt as string,
    contentOwner: raw.contentOwner as string,
    book: raw.book as PackageBook,
    chapters,
  };
}
