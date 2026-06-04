// Boundary adapter: maps the production chapter-content API response
// (`GET /api/book/books/[bookId]/chapters/[chapterNumber]`) into the reader's
// `BookChapter` UI shape that the ~35 reader subcomponents consume — WITHOUT
// changing any of them.
//
// The server stores the v13-shape payload (tone-keyed strings, easy/medium/hard
// variants) plus the v21 extras carried through ingestion. We reconstruct a
// raw-v21 chapter object from that response and run it through the exact same
// `normalizeV21Package` → `buildBundle` pipeline the local path uses
// (`buildBookChapterFromRawV21`), so the resulting `BookChapter` is identical by
// construction to the locally-bundled one. Quiz content is owned separately by
// `useQuizSession`, so the reconstructed chapter carries no quiz.

import {
  buildBookChapterFromRawV21,
  type BookChapter,
} from "@/app/book/data/bookChapters";

type ApiToneKeyed = {
  gentle?: string;
  direct?: string;
  competitive?: string;
};

type ApiSummaryBlock = {
  type?: string;
  text?: string;
  detail?: string;
};

type ApiVariant = {
  chapterBreakdown?: ApiToneKeyed;
  summaryBlocks?: ApiSummaryBlock[];
  takeaways?: string[];
};

type ApiVariantKey = "easy" | "medium" | "hard" | "precise" | "balanced" | "challenging";

export type ApiChapter = {
  chapterId: string;
  number: number;
  title: string;
  readingTimeMinutes: number;
  activeVariant?: string;
  availableVariants?: string[];
  content?: ApiVariant;
  contentVariants?: Partial<Record<ApiVariantKey, ApiVariant>>;
  examples?: Array<{
    exampleId?: string;
    title?: string;
    scenario?: string;
    whatToDo?: string[];
    whyItMatters?: string;
    contexts?: string[];
    format?: string;
  }>;
  implementationPlan?: {
    coreSkill?: ApiToneKeyed;
    ifThenPlans?: Array<{ context?: string; plan?: ApiToneKeyed }>;
    twentyFourHourChallenge?: ApiToneKeyed;
    weeklyPractice?: ApiToneKeyed;
  };
  reviewCards?: Array<{
    cardId?: string;
    front?: ApiToneKeyed;
    back?: ApiToneKeyed;
    difficulty?: string;
  }>;
  keyTakeawayCard?: ApiToneKeyed;
  v21Extras?: {
    hook?: string;
    counterintuition?: string;
    tryThisNow?: string;
    keyTakeaway?: string;
    memorableLines?: Array<{ text: string; location?: string; why?: string }>;
  };
};

export type ApiChapterResponse = {
  chapter: ApiChapter;
  progress?: {
    currentChapterNumber: number;
    unlockedThroughChapterNumber: number;
    completedChapters: number[];
  };
};

// v21 has a single canonical voice, so the server tone-keyed values are the same
// string across gentle/direct/competitive — pick the first non-empty.
function flattenTone(value: ApiToneKeyed | undefined): string {
  if (!value) return "";
  return value.direct || value.gentle || value.competitive || "";
}

// Reconstruct the breakdown prose for a tier from a variant: prefer the
// canonical `chapterBreakdown` prose, else rejoin the paragraph summary blocks.
function variantProse(variant: ApiVariant | undefined): string | undefined {
  if (!variant) return undefined;
  const fromBreakdown = flattenTone(variant.chapterBreakdown);
  if (fromBreakdown) return fromBreakdown;
  const paragraphs = (variant.summaryBlocks ?? [])
    .filter((block) => block.type === "paragraph" && typeof block.text === "string")
    .map((block) => block.text as string);
  return paragraphs.length > 0 ? paragraphs.join("\n\n") : undefined;
}

export function adaptApiChapterToBookChapter(
  api: ApiChapter,
  book: {
    bookId: string;
    title?: string;
    author?: string;
    categories?: string[];
    tags?: string[];
  },
): BookChapter {
  const cv = api.contentVariants ?? {};

  // Reconstruct the raw-v21 chapter shape `normalizeV21Package` expects.
  const rawChapter: Record<string, unknown> = {
    chapterId: api.chapterId,
    number: api.number,
    title: api.title,
    readingTimeMinutes: api.readingTimeMinutes,
    breakdown: {
      fastRead: variantProse(cv.easy ?? cv.precise),
      deepRead: variantProse(cv.medium ?? cv.balanced),
      fullRead: variantProse(cv.hard ?? cv.challenging),
    },
    hook: api.v21Extras?.hook,
    counterintuition: api.v21Extras?.counterintuition,
    tryThisNow: api.v21Extras?.tryThisNow,
    keyTakeaway: api.v21Extras?.keyTakeaway || flattenTone(api.keyTakeawayCard),
    memorableLines: api.v21Extras?.memorableLines,
    examples: (api.examples ?? []).map((ex) => ({
      exampleId: ex.exampleId,
      title: ex.title,
      scenario: ex.scenario,
      // raw v21 carries `whatToDo` as a single string; the API returns string[].
      whatToDo: Array.isArray(ex.whatToDo) ? ex.whatToDo.join(" ") : ex.whatToDo,
      whyItMatters: ex.whyItMatters,
      tags: ex.contexts,
    })),
    reviewCards: (api.reviewCards ?? []).map((card) => ({
      cardId: card.cardId,
      front: flattenTone(card.front),
      back: flattenTone(card.back),
      difficulty: card.difficulty,
    })),
    implementationPlan: api.implementationPlan
      ? {
          coreSkill: flattenTone(api.implementationPlan.coreSkill),
          ifThenPlans: (api.implementationPlan.ifThenPlans ?? []).map((it) => ({
            context: it.context,
            plan: flattenTone(it.plan),
          })),
          twentyFourHourChallenge: flattenTone(api.implementationPlan.twentyFourHourChallenge),
          weeklyPractice: flattenTone(api.implementationPlan.weeklyPractice),
        }
      : undefined,
    // Quiz is fetched separately by useQuizSession; leave empty here.
    quiz: { questions: [], passingScorePercent: 80 },
  };

  return buildBookChapterFromRawV21(rawChapter, book);
}
