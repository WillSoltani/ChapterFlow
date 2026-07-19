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
import type { V21ExperiencePlan } from "@/app/book/lib/v21-adapter";

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
    experiencePlan?: V21ExperiencePlan;
  };
};

export type ApiChapterProgress = {
  currentChapterNumber: number;
  unlockedThroughChapterNumber: number;
  completedChapters: number[];
};

export type ApiChapterResponse = {
  chapter: ApiChapter;
  progress?: ApiChapterProgress;
};

export interface InitialChapterReaderSeed {
  schemaVersion: 1;
  authorization: "active-entitled-started-unlocked";
  route: {
    bookId: string;
    chapterId: string;
    chapterNumber: number;
  };
  onboardingCompleted: true;
  content: ApiChapterResponse & { progress: ApiChapterProgress };
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
    experiencePlan: api.v21Extras?.experiencePlan,
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

const RECONSTRUCT_DEPTHS = ["simple", "standard", "deeper"] as const;

/**
 * Whether a reconstructed chapter has NO renderable Summary body in ANY reading
 * depth — the state a present-but-blank-prose variant produces.
 *
 * `variantProse` returns `undefined` for a variant whose `chapterBreakdown` AND
 * `summaryBlocks` are blank, and `buildBookChapterFromRawV21` builds a chapter
 * object regardless, so the reconstruction tolerates total emptiness. The
 * chapter route's `variant_missing` guard only rejects the zero-KEYS case, so a
 * payload with a PRESENT variant key whose prose is blank still returns HTTP
 * 200. Rendered, that chapter shows chrome (title, phase tabs) over a blank
 * Summary — no error, no fallback. Callers treat a `true` here like a failed
 * load (fall back to local content, else surface an explicit error) instead of
 * silently presenting a body-less chapter. (PAR-3)
 *
 * Keyed on `summaryByDepth` (the Summary phase body) across all depths, so it
 * only reports empty when even a depth-switch would surface nothing — never a
 * false positive on a chapter that renders content in some depth.
 */
export function isReconstructedChapterEmpty(chapter: BookChapter): boolean {
  return RECONSTRUCT_DEPTHS.every(
    (depth) =>
      !chapter.summaryByDepth[depth]?.some(
        (block) => typeof block.text === "string" && block.text.trim().length > 0,
      ),
  );
}
