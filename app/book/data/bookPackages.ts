import thePowerOfHabitPackageJson from "@/book-packages/the-power-of-habit.modern.json";
import makeTimePackageJson from "@/book-packages/make-time.modern.json";
import crucialConversationsPackageJson from "@/book-packages/crucial-conversations.modern.json";
import whatEveryBodyIsSayingPackageJson from "@/book-packages/what-every-body-is-saying.modern.json";
import thePrincePackageJson from "@/book-packages/the-prince.modern.json";
import tinyHabitsPackageJson from "@/book-packages/tiny-habits.modern.json";
import essentialismPackageJson from "@/book-packages/essentialism.modern.json";
import deepWorkPackageJson from "@/book-packages/deep-work.modern.json";
import predictablyIrrationalPackageJson from "@/book-packages/predictably-irrational.modern.json";
import thinkingFastAndSlowPackageJson from "@/book-packages/thinking-fast-and-slow.modern.json";
import thePsychologyOfMoneyPackageJson from "@/book-packages/the-psychology-of-money.modern.json";
import theLawsOfHumanNaturePackageJson from "@/book-packages/the-laws-of-human-nature.modern.json";
import theAlmanackOfNavalRavikantPackageJson from "@/book-packages/the-almanack-of-naval-ravikant.modern.json";
import theHardThingAboutHardThingsPackageJson from "@/book-packages/the-hard-thing-about-hard-things.modern.json";
import influencePackageJson from "@/book-packages/influence.modern.json";
import leadersEatLastPackageJson from "@/book-packages/leaders-eat-last.modern.json";
import theOneThingPackageJson from "@/book-packages/the-one-thing.modern.json";
import theCharismaMythPackageJson from "@/book-packages/the-charisma-myth.modern.json";
import theLikeSwitchPackageJson from "@/book-packages/the-like-switch.modern.json";
import goodToGreatPackageJson from "@/book-packages/good-to-great.modern.json";
import howToTalkToAnyonePackageJson from "@/book-packages/how-to-talk-to-anyone.modern.json";
import talkLikeTedPackageJson from "@/book-packages/talk-like-ted.modern.json";
import neverSplitTheDifferencePackageJson from "@/book-packages/never-split-the-difference.modern.json";
import pitchAnythingPackageJson from "@/book-packages/pitch-anything.modern.json";
import preSuasionPackageJson from "@/book-packages/pre-suasion.modern.json";
import superThinkingPackageJson from "@/book-packages/super-thinking.modern.json";
import youCantHurtMePackageJson from "@/book-packages/you-can't-hurt-me.modern.json";
import indistractablePackageJson from "@/book-packages/indistractable.modern.json";
import extremeOwnershipPackageJson from "@/book-packages/extreme-ownership.modern.json";
import theArtOfWarPackageJson from "@/book-packages/the-art-of-war.modern.json";
import atomicHabitsPackageJson from "@/book-packages/atomic-habits.modern.json";
import theGreatMentalModelsVol1PackageJson from "@/book-packages/the-great-mental-models-vol-1.modern.json";
import theLeanStartupPackageJson from "@/book-packages/the-lean-startup.modern.json";
import { getBookCoverPath } from "@/lib/book-covers";

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
        isbn13?: string;
        format?: string;
        translator?: string;
        translationYear?: number | null;
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

function getRawChapters(raw: unknown): unknown[] {
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
  const predictionPrompt = v?.predictionPrompt ? resolveTone(v.predictionPrompt, tone) : undefined;

  if (selfCheckPrompt) practice.push(selfCheckPrompt);
  if (Array.isArray(selfCheckPrompts)) {
    for (const prompt of selfCheckPrompts) practice.push(prompt);
  }
  if (predictionPrompt) practice.push(predictionPrompt);

  return {
    chapterBreakdown: chapterBreakdown || undefined,
    importantSummary: chapterBreakdown ? chapterBreakdown.split(/\n\n+/)[0]?.trim() : undefined,
    summaryBullets: keyTakeaways.length > 0 ? keyTakeaways : undefined,
    summaryBlocks,
    keyTakeaways: keyTakeaways.length > 0 ? keyTakeaways : undefined,
    practice: practice.length > 0 ? practice : undefined,
    oneMinuteRecap: oneMinuteRecap.length > 0 ? oneMinuteRecap : undefined,
    activationPrompt,
    selfCheckPrompt,
    selfCheckPrompts: selfCheckPrompts && selfCheckPrompts.length > 0 ? selfCheckPrompts : undefined,
    predictionPrompt,
  };
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
      examples: (Array.isArray(ch.examples) ? ch.examples : []).map((example) => {
        const ex = asRecord(example) ?? {};
        return {
          exampleId: ex.exampleId as string,
          title: ex.title as string,
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
            coreSkill: resolveTone(asRecord(ch.implementationPlan)?.coreSkill, tone),
            ifThenPlans: (Array.isArray(asRecord(ch.implementationPlan)?.ifThenPlans)
              ? (asRecord(ch.implementationPlan)?.ifThenPlans as unknown[])
              : []).map((item) => {
              const planItem = asRecord(item) ?? {};
              return {
                context: typeof planItem.context === "string" ? planItem.context : "",
                plan: resolveTone(planItem.plan, tone),
              };
            }),
            twentyFourHourChallenge: resolveTone(
              asRecord(ch.implementationPlan)?.twentyFourHourChallenge,
              tone
            ),
            weeklyPractice: resolveTone(asRecord(ch.implementationPlan)?.weeklyPractice, tone),
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

export const THE_POWER_OF_HABIT_PACKAGE =
  normalizeNstdPackage(thePowerOfHabitPackageJson, "direct");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const THE_POWER_OF_HABIT_RAW_CHAPTERS = getRawChapters(thePowerOfHabitPackageJson);

export function getThePowerOfHabitPackageForTone(tone: ToneKey): BookPackage {
  return normalizeNstdPackage(thePowerOfHabitPackageJson, tone);
}

export const MAKE_TIME_PACKAGE = normalizeNstdPackage(makeTimePackageJson, "direct");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const MAKE_TIME_RAW_CHAPTERS = getRawChapters(makeTimePackageJson);

export function getMakeTimePackageForTone(tone: ToneKey): BookPackage {
  return normalizeNstdPackage(makeTimePackageJson, tone);
}

export const CRUCIAL_CONVERSATIONS_PACKAGE =
  normalizeNstdPackage(crucialConversationsPackageJson, "direct");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const CRUCIAL_CONVERSATIONS_RAW_CHAPTERS = getRawChapters(crucialConversationsPackageJson);

export function getCrucialConversationsPackageForTone(tone: ToneKey): BookPackage {
  return normalizeNstdPackage(crucialConversationsPackageJson, tone);
}

export const WHAT_EVERY_BODY_IS_SAYING_PACKAGE =
  normalizeNstdPackage(whatEveryBodyIsSayingPackageJson, "direct");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const WHAT_EVERY_BODY_IS_SAYING_RAW_CHAPTERS = getRawChapters(whatEveryBodyIsSayingPackageJson);

export function getWhatEveryBodyIsSayingPackageForTone(tone: ToneKey): BookPackage {
  return normalizeNstdPackage(whatEveryBodyIsSayingPackageJson, tone);
}

export const THE_PRINCE_PACKAGE = normalizeNstdPackage(thePrincePackageJson, "direct");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const THE_PRINCE_RAW_CHAPTERS = getRawChapters(thePrincePackageJson);

export function getThePrincePackageForTone(tone: ToneKey): BookPackage {
  return normalizeNstdPackage(thePrincePackageJson, tone);
}

export const TINY_HABITS_PACKAGE = normalizeNstdPackage(tinyHabitsPackageJson, "direct");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const TINY_HABITS_RAW_CHAPTERS = getRawChapters(tinyHabitsPackageJson);

export function getTinyHabitsPackageForTone(tone: ToneKey): BookPackage {
  return normalizeNstdPackage(tinyHabitsPackageJson, tone);
}

export const ESSENTIALISM_PACKAGE = normalizeNstdPackage(essentialismPackageJson, "direct");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const ESSENTIALISM_RAW_CHAPTERS = getRawChapters(essentialismPackageJson);

export function getEssentialismPackageForTone(tone: ToneKey): BookPackage {
  return normalizeNstdPackage(essentialismPackageJson, tone);
}

export const DEEP_WORK_PACKAGE = normalizeNstdPackage(deepWorkPackageJson, "direct");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const DEEP_WORK_RAW_CHAPTERS = getRawChapters(deepWorkPackageJson);

export function getDeepWorkPackageForTone(tone: ToneKey): BookPackage {
  return normalizeNstdPackage(deepWorkPackageJson, tone);
}

export const PREDICTABLY_IRRATIONAL_PACKAGE = normalizeNstdPackage(
  predictablyIrrationalPackageJson,
  "direct"
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const PREDICTABLY_IRRATIONAL_RAW_CHAPTERS = getRawChapters(predictablyIrrationalPackageJson);

export function getPredictablyIrrationalPackageForTone(tone: ToneKey): BookPackage {
  return normalizeNstdPackage(predictablyIrrationalPackageJson, tone);
}

export const THINKING_FAST_AND_SLOW_PACKAGE = normalizeNstdPackage(
  thinkingFastAndSlowPackageJson,
  "direct"
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const THINKING_FAST_AND_SLOW_RAW_CHAPTERS = getRawChapters(thinkingFastAndSlowPackageJson);

export function getThinkingFastAndSlowPackageForTone(tone: ToneKey): BookPackage {
  return normalizeNstdPackage(thinkingFastAndSlowPackageJson, tone);
}

export const THE_PSYCHOLOGY_OF_MONEY_PACKAGE = normalizeNstdPackage(
  thePsychologyOfMoneyPackageJson,
  "direct"
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const THE_PSYCHOLOGY_OF_MONEY_RAW_CHAPTERS = getRawChapters(thePsychologyOfMoneyPackageJson);

export function getThePsychologyOfMoneyPackageForTone(tone: ToneKey): BookPackage {
  return normalizeNstdPackage(thePsychologyOfMoneyPackageJson, tone);
}

export const THE_LAWS_OF_HUMAN_NATURE_PACKAGE = normalizeNstdPackage(
  theLawsOfHumanNaturePackageJson,
  "direct"
);

export const THE_LAWS_OF_HUMAN_NATURE_RAW_CHAPTERS =
  getRawChapters(theLawsOfHumanNaturePackageJson);

export function getTheLawsOfHumanNaturePackageForTone(tone: ToneKey): BookPackage {
  return normalizeNstdPackage(theLawsOfHumanNaturePackageJson, tone);
}

export const THE_ALMANACK_OF_NAVAL_RAVIKANT_PACKAGE = normalizeNstdPackage(
  theAlmanackOfNavalRavikantPackageJson,
  "direct"
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const THE_ALMANACK_OF_NAVAL_RAVIKANT_RAW_CHAPTERS =
  getRawChapters(theAlmanackOfNavalRavikantPackageJson);

export function getTheAlmanackOfNavalRavikantPackageForTone(tone: ToneKey): BookPackage {
  return normalizeNstdPackage(theAlmanackOfNavalRavikantPackageJson, tone);
}

export const THE_HARD_THING_ABOUT_HARD_THINGS_PACKAGE = normalizeNstdPackage(
  theHardThingAboutHardThingsPackageJson,
  "direct"
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const THE_HARD_THING_ABOUT_HARD_THINGS_RAW_CHAPTERS =
  getRawChapters(theHardThingAboutHardThingsPackageJson);

export function getTheHardThingAboutHardThingsPackageForTone(tone: ToneKey): BookPackage {
  return normalizeNstdPackage(theHardThingAboutHardThingsPackageJson, tone);
}

export const INFLUENCE_PACKAGE = normalizeNstdPackage(influencePackageJson, "direct");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const INFLUENCE_RAW_CHAPTERS = getRawChapters(influencePackageJson);

export function getInfluencePackageForTone(tone: ToneKey): BookPackage {
  return normalizeNstdPackage(influencePackageJson, tone);
}

export const LEADERS_EAT_LAST_PACKAGE = normalizeNstdPackage(
  leadersEatLastPackageJson,
  "direct"
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const LEADERS_EAT_LAST_RAW_CHAPTERS = getRawChapters(leadersEatLastPackageJson);

export function getLeadersEatLastPackageForTone(tone: ToneKey): BookPackage {
  return normalizeNstdPackage(leadersEatLastPackageJson, tone);
}

export const THE_ONE_THING_PACKAGE = normalizeNstdPackage(theOneThingPackageJson, "direct");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const THE_ONE_THING_RAW_CHAPTERS = getRawChapters(theOneThingPackageJson);

export function getTheOneThingPackageForTone(tone: ToneKey): BookPackage {
  return normalizeNstdPackage(theOneThingPackageJson, tone);
}

export const THE_CHARISMA_MYTH_PACKAGE = normalizeNstdPackage(
  theCharismaMythPackageJson,
  "direct"
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const THE_CHARISMA_MYTH_RAW_CHAPTERS = getRawChapters(theCharismaMythPackageJson);

export function getTheCharismaMythPackageForTone(tone: ToneKey): BookPackage {
  return normalizeNstdPackage(theCharismaMythPackageJson, tone);
}

export const THE_LIKE_SWITCH_PACKAGE = normalizeNstdPackage(theLikeSwitchPackageJson, "direct");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const THE_LIKE_SWITCH_RAW_CHAPTERS = getRawChapters(theLikeSwitchPackageJson);

export function getTheLikeSwitchPackageForTone(tone: ToneKey): BookPackage {
  return normalizeNstdPackage(theLikeSwitchPackageJson, tone);
}

export const GOOD_TO_GREAT_PACKAGE = normalizeNstdPackage(goodToGreatPackageJson, "direct");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const GOOD_TO_GREAT_RAW_CHAPTERS = getRawChapters(goodToGreatPackageJson);

export function getGoodToGreatPackageForTone(tone: ToneKey): BookPackage {
  return normalizeNstdPackage(goodToGreatPackageJson, tone);
}

export const HOW_TO_TALK_TO_ANYONE_PACKAGE = normalizeNstdPackage(
  howToTalkToAnyonePackageJson,
  "direct"
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const HOW_TO_TALK_TO_ANYONE_RAW_CHAPTERS = getRawChapters(howToTalkToAnyonePackageJson);

export function getHowToTalkToAnyonePackageForTone(tone: ToneKey): BookPackage {
  return normalizeNstdPackage(howToTalkToAnyonePackageJson, tone);
}

export const TALK_LIKE_TED_PACKAGE = normalizeNstdPackage(talkLikeTedPackageJson, "direct");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const TALK_LIKE_TED_RAW_CHAPTERS = getRawChapters(talkLikeTedPackageJson);

export function getTalkLikeTedPackageForTone(tone: ToneKey): BookPackage {
  return normalizeNstdPackage(talkLikeTedPackageJson, tone);
}

export const NEVER_SPLIT_THE_DIFFERENCE_PACKAGE = normalizeNstdPackage(
  neverSplitTheDifferencePackageJson,
  "direct"
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const NEVER_SPLIT_THE_DIFFERENCE_RAW_CHAPTERS = getRawChapters(
  neverSplitTheDifferencePackageJson
);

export function getNeverSplitTheDifferencePackageForTone(tone: ToneKey): BookPackage {
  return normalizeNstdPackage(neverSplitTheDifferencePackageJson, tone);
}

export const PITCH_ANYTHING_PACKAGE = normalizeNstdPackage(pitchAnythingPackageJson, "direct");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const PITCH_ANYTHING_RAW_CHAPTERS = getRawChapters(pitchAnythingPackageJson);

export function getPitchAnythingPackageForTone(tone: ToneKey): BookPackage {
  return normalizeNstdPackage(pitchAnythingPackageJson, tone);
}

export const PRE_SUASION_PACKAGE = normalizeNstdPackage(preSuasionPackageJson, "direct");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const PRE_SUASION_RAW_CHAPTERS = getRawChapters(preSuasionPackageJson);

export function getPreSuasionPackageForTone(tone: ToneKey): BookPackage {
  return normalizeNstdPackage(preSuasionPackageJson, tone);
}

export const SUPER_THINKING_PACKAGE = normalizeNstdPackage(superThinkingPackageJson, "direct");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const SUPER_THINKING_RAW_CHAPTERS = getRawChapters(superThinkingPackageJson);

export function getSuperThinkingPackageForTone(tone: ToneKey): BookPackage {
  return normalizeNstdPackage(superThinkingPackageJson, tone);
}

export const YOU_CANT_HURT_ME_PACKAGE = normalizeNstdPackage(youCantHurtMePackageJson, "direct");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const YOU_CANT_HURT_ME_RAW_CHAPTERS = getRawChapters(youCantHurtMePackageJson);

export function getYouCantHurtMePackageForTone(tone: ToneKey): BookPackage {
  return normalizeNstdPackage(youCantHurtMePackageJson, tone);
}

export const INDISTRACTABLE_PACKAGE = normalizeNstdPackage(indistractablePackageJson, "direct");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const INDISTRACTABLE_RAW_CHAPTERS = getRawChapters(indistractablePackageJson);

export function getIndistractablePackageForTone(tone: ToneKey): BookPackage {
  return normalizeNstdPackage(indistractablePackageJson, tone);
}

export const EXTREME_OWNERSHIP_PACKAGE = normalizeNstdPackage(
  extremeOwnershipPackageJson,
  "direct"
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const EXTREME_OWNERSHIP_RAW_CHAPTERS = getRawChapters(extremeOwnershipPackageJson);

export function getExtremeOwnershipPackageForTone(tone: ToneKey): BookPackage {
  return normalizeNstdPackage(extremeOwnershipPackageJson, tone);
}

export const THE_ART_OF_WAR_PACKAGE = normalizeNstdPackage(theArtOfWarPackageJson, "direct");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const THE_ART_OF_WAR_RAW_CHAPTERS = getRawChapters(theArtOfWarPackageJson);

export function getTheArtOfWarPackageForTone(tone: ToneKey): BookPackage {
  return normalizeNstdPackage(theArtOfWarPackageJson, tone);
}

export const ATOMIC_HABITS_PACKAGE = normalizeNstdPackage(atomicHabitsPackageJson, "direct");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const ATOMIC_HABITS_RAW_CHAPTERS = getRawChapters(atomicHabitsPackageJson);

export function getAtomicHabitsPackageForTone(tone: ToneKey): BookPackage {
  return normalizeNstdPackage(atomicHabitsPackageJson, tone);
}

export const THE_GREAT_MENTAL_MODELS_VOL_1_PACKAGE = normalizeNstdPackage(
  theGreatMentalModelsVol1PackageJson,
  "direct"
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const THE_GREAT_MENTAL_MODELS_VOL_1_RAW_CHAPTERS = getRawChapters(
  theGreatMentalModelsVol1PackageJson
);

export function getTheGreatMentalModelsVol1PackageForTone(tone: ToneKey): BookPackage {
  return normalizeNstdPackage(theGreatMentalModelsVol1PackageJson, tone);
}

export const THE_LEAN_STARTUP_PACKAGE = normalizeNstdPackage(theLeanStartupPackageJson, "direct");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const THE_LEAN_STARTUP_RAW_CHAPTERS = getRawChapters(theLeanStartupPackageJson);

export function getTheLeanStartupPackageForTone(tone: ToneKey): BookPackage {
  return normalizeNstdPackage(theLeanStartupPackageJson, tone);
}

export const BOOK_PACKAGES: BookPackage[] = [
  THE_POWER_OF_HABIT_PACKAGE,
  MAKE_TIME_PACKAGE,
  ESSENTIALISM_PACKAGE,
  CRUCIAL_CONVERSATIONS_PACKAGE,
  WHAT_EVERY_BODY_IS_SAYING_PACKAGE,
  THE_PRINCE_PACKAGE,
  TINY_HABITS_PACKAGE,
  DEEP_WORK_PACKAGE,
  PREDICTABLY_IRRATIONAL_PACKAGE,
  THINKING_FAST_AND_SLOW_PACKAGE,
  THE_PSYCHOLOGY_OF_MONEY_PACKAGE,
  THE_LAWS_OF_HUMAN_NATURE_PACKAGE,
  THE_ALMANACK_OF_NAVAL_RAVIKANT_PACKAGE,
  THE_HARD_THING_ABOUT_HARD_THINGS_PACKAGE,
  INFLUENCE_PACKAGE,
  LEADERS_EAT_LAST_PACKAGE,
  THE_ONE_THING_PACKAGE,
  THE_CHARISMA_MYTH_PACKAGE,
  THE_LIKE_SWITCH_PACKAGE,
  GOOD_TO_GREAT_PACKAGE,
  HOW_TO_TALK_TO_ANYONE_PACKAGE,
  TALK_LIKE_TED_PACKAGE,
  NEVER_SPLIT_THE_DIFFERENCE_PACKAGE,
  PITCH_ANYTHING_PACKAGE,
  PRE_SUASION_PACKAGE,
  SUPER_THINKING_PACKAGE,
  YOU_CANT_HURT_ME_PACKAGE,
  INDISTRACTABLE_PACKAGE,
  EXTREME_OWNERSHIP_PACKAGE,
  THE_ART_OF_WAR_PACKAGE,
  ATOMIC_HABITS_PACKAGE,
  THE_GREAT_MENTAL_MODELS_VOL_1_PACKAGE,
  THE_LEAN_STARTUP_PACKAGE,
];

const BOOK_PACKAGE_TONE_GETTERS: Partial<Record<string, (tone: ToneKey) => BookPackage>> = {
  "the-power-of-habit": getThePowerOfHabitPackageForTone,
  "make-time": getMakeTimePackageForTone,
  "essentialism": getEssentialismPackageForTone,
  "crucial-conversations": getCrucialConversationsPackageForTone,
  "what-every-body-is-saying": getWhatEveryBodyIsSayingPackageForTone,
  "the-prince": getThePrincePackageForTone,
  "tiny-habits": getTinyHabitsPackageForTone,
  "deep-work": getDeepWorkPackageForTone,
  "predictably-irrational": getPredictablyIrrationalPackageForTone,
  "thinking-fast-and-slow": getThinkingFastAndSlowPackageForTone,
  "the-psychology-of-money": getThePsychologyOfMoneyPackageForTone,
  "the-laws-of-human-nature": getTheLawsOfHumanNaturePackageForTone,
  "the-almanack-of-naval-ravikant": getTheAlmanackOfNavalRavikantPackageForTone,
  "the-hard-thing-about-hard-things": getTheHardThingAboutHardThingsPackageForTone,
  influence: getInfluencePackageForTone,
  "leaders-eat-last": getLeadersEatLastPackageForTone,
  "the-one-thing": getTheOneThingPackageForTone,
  "the-charisma-myth": getTheCharismaMythPackageForTone,
  "the-like-switch": getTheLikeSwitchPackageForTone,
  "good-to-great": getGoodToGreatPackageForTone,
  "how-to-talk-to-anyone": getHowToTalkToAnyonePackageForTone,
  "talk-like-ted": getTalkLikeTedPackageForTone,
  "never-split-the-difference": getNeverSplitTheDifferencePackageForTone,
  "pitch-anything": getPitchAnythingPackageForTone,
  "pre-suasion": getPreSuasionPackageForTone,
  "super-thinking": getSuperThinkingPackageForTone,
  "you-can't-hurt-me": getYouCantHurtMePackageForTone,
  indistractable: getIndistractablePackageForTone,
  "extreme-ownership": getExtremeOwnershipPackageForTone,
  "the-art-of-war": getTheArtOfWarPackageForTone,
  "atomic-habits": getAtomicHabitsPackageForTone,
  "the-great-mental-models-vol-1": getTheGreatMentalModelsVol1PackageForTone,
  "the-lean-startup": getTheLeanStartupPackageForTone,
};

export const BOOK_PACKAGE_PRESENTATION: Record<string, BookPackagePresentation> = {
  "the-power-of-habit": {
    icon: "🧭",
    coverImage: getBookCoverPath("the-power-of-habit"),
    difficulty: "Medium",
    synopsis:
      "A modern reading of cues, cravings, willpower, organizational routines, social movements, and the question of responsibility inside automatic behavior.",
    pages: 371,
  },
  "make-time": {
    icon: "⏳",
    coverImage: getBookCoverPath("make-time"),
    difficulty: "Medium",
    synopsis:
      "A practical guide to reclaiming attention day by day through a clear Highlight, better focus defenses, stronger energy, and a lightweight reflection loop.",
    pages: 304,
  },
  "crucial-conversations": {
    icon: "💬",
    coverImage: getBookCoverPath("crucial-conversations"),
    difficulty: "Medium",
    synopsis:
      "A practical guide to high-stakes dialogue: spotting crucial conversations early, avoiding silence and force, restoring safety, and turning hard talks into real action.",
    pages: 336,
  },
  "what-every-body-is-saying": {
    icon: "👁️",
    coverImage: getBookCoverPath("what-every-body-is-saying"),
    difficulty: "Medium",
    synopsis:
      "A practical guide to reading nonverbal behavior with more discipline: noticing comfort, discomfort, confidence, stress, and withdrawal without turning one cue into false certainty.",
  },
  "the-prince": {
    icon: "👑",
    coverImage: getBookCoverPath("the-prince"),
    difficulty: "Hard",
    synopsis:
      "A modern reading of political founding, power, arms, fortune, reputation, and statecraft across Machiavelli's twenty-six chapters.",
    pages: 176,
  },
  "tiny-habits": {
    icon: "🌱",
    coverImage: getBookCoverPath("tiny-habits"),
    difficulty: "Medium",
    synopsis:
      "A modern reading of BJ Fogg's behavior design method: matching motivation, making habits tiny, anchoring prompts, using celebration, untangling bad loops, and growing change through shared support.",
  },
  essentialism: {
    icon: "🎯",
    coverImage: getBookCoverPath("essentialism"),
    difficulty: "Medium",
    synopsis:
      "A modern reading of Greg McKeown's framework for choosing the vital few, cutting the trivial many, and building a life around less but better.",
    pages: 288,
  },
  "deep-work": {
    icon: "🧠",
    coverImage: getBookCoverPath("deep-work"),
    difficulty: "Medium",
    synopsis:
      "A modern reading of focus, distraction, scheduling, boredom training, tool selection, and shallow-work control for people trying to build a deeper working life.",
    pages: 304,
  },
  "predictably-irrational": {
    icon: "🧪",
    coverImage: getBookCoverPath("predictably-irrational"),
    difficulty: "Medium",
    synopsis:
      "A modern reading of Dan Ariely's thirteen chapters on relativity, anchoring, zero price, norms, expectations, dishonesty, and practical design fixes for predictable decision errors.",
  },
  "thinking-fast-and-slow": {
    icon: "🧠",
    coverImage: getBookCoverPath("thinking-fast-and-slow"),
    difficulty: "Hard",
    synopsis:
      "A modern reading of Kahneman's thirty-eight chapters on System 1 and System 2, heuristics, bias, prospect theory, overconfidence, and the limits of judgment under uncertainty.",
    pages: 499,
  },
  "the-psychology-of-money": {
    icon: "💸",
    coverImage: getBookCoverPath("the-psychology-of-money"),
    difficulty: "Medium",
    synopsis:
      "A modern reading of Morgan Housel's twenty-two chapters on luck, risk, enoughness, compounding, saving, freedom, pessimism, and the historical forces shaping consumer expectations.",
    pages: 256,
  },
  "the-laws-of-human-nature": {
    icon: "🧠",
    coverImage: getBookCoverPath("the-laws-of-human-nature"),
    difficulty: "Hard",
    synopsis:
      "A modern reading of Robert Greene's nineteen chapters on irrationality, narcissism, role-playing, envy, conformity, aggression, historical mood, and mortality across everyday human behavior.",
    pages: 624,
  },
  "the-almanack-of-naval-ravikant": {
    icon: "🧭",
    coverImage: getBookCoverPath("the-almanack-of-naval-ravikant"),
    difficulty: "Medium",
    synopsis:
      "A modern reading of Naval Ravikant's six-part guide to wealth, judgment, happiness, self-governance, philosophy, and the reading life behind those ideas.",
  },
  "the-hard-thing-about-hard-things": {
    icon: "🏢",
    coverImage: getBookCoverPath("the-hard-thing-about-hard-things"),
    difficulty: "Hard",
    synopsis:
      "A modern reading of Ben Horowitz's ten chapters on CEO struggle, layoffs, executive hiring, wartime leadership, culture, and building through crisis.",
  },
  influence: {
    icon: "🧠",
    coverImage: getBookCoverPath("influence"),
    difficulty: "Medium",
    synopsis:
      "A modern reading of Robert Cialdini's nine chapters on automatic judgment, reciprocity, liking, social proof, authority, scarcity, commitment, unity, and the cue stacks that shape consent.",
  },
  "leaders-eat-last": {
    icon: "🛡️",
    coverImage: getBookCoverPath("leaders-eat-last"),
    difficulty: "Medium",
    synopsis:
      "A modern reading of Simon Sinek's twenty-seven chapters on trust, leadership, cortisol, culture, sacrifice, and building circles of safety inside groups.",
  },
  "the-one-thing": {
    icon: "🎯",
    coverImage: getBookCoverPath("the-one-thing"),
    difficulty: "Medium",
    synopsis:
      "A modern reading of Gary Keller and Jay Papasan's eighteen chapters on leverage, priority, sequencing, and giving your most important work first claim on time and attention.",
    pages: 240,
  },
  "the-charisma-myth": {
    icon: "✨",
    coverImage: getBookCoverPath("the-charisma-myth"),
    difficulty: "Medium",
    synopsis:
      "A modern reading of Olivia Fox Cabane's thirteen chapters on presence, power, warmth, first impressions, conversation, body language, digital charisma, and carrying signal under pressure.",
    pages: 272,
  },
  "the-like-switch": {
    icon: "🕵️",
    coverImage: getBookCoverPath("the-like-switch"),
    difficulty: "Medium",
    synopsis:
      "A modern reading of Jack Schafer and Marvin Karlins's eight chapters on first impressions, rapport, attraction, conversation, closeness, maintenance, and the promise and peril of trust.",
    pages: 270,
  },
  "good-to-great": {
    icon: "📈",
    coverImage: getBookCoverPath("good-to-great"),
    difficulty: "Hard",
    synopsis:
      "A modern reading of Jim Collins's nine chapters on disciplined leadership, strategic clarity, cumulative momentum, and the difference between a breakthrough and an enduring institution.",
    pages: 320,
  },
  indistractable: {
    icon: "🎯",
    coverImage: getBookCoverPath("indistractable"),
    difficulty: "Medium",
    synopsis:
      "A modern reading of Nir Eyal's thirty chapters on internal triggers, timeboxing, external triggers, pacts, workplace culture, parenting, and relational attention.",
    pages: 290,
  },
  "how-to-talk-to-anyone": {
    icon: "🗣️",
    coverImage: getBookCoverPath("how-to-talk-to-anyone"),
    difficulty: "Medium",
    synopsis:
      "A modern reading of Leil Lowndes's nine-part guide to first impressions, conversation flow, rapport, social tact, and practical relationship-building under real-world pressure.",
    pages: 368,
  },
  "talk-like-ted": {
    icon: "🎤",
    coverImage: getBookCoverPath("talk-like-ted"),
    difficulty: "Medium",
    synopsis:
      "A modern reading of Carmine Gallo's nine public-speaking chapters on passion, story, delivery, novelty, memorable moments, warmth, compression, vividness, and rehearsal under real audience pressure.",
    pages: 288,
  },
  "never-split-the-difference": {
    icon: "🤝",
    coverImage: getBookCoverPath("never-split-the-difference"),
    difficulty: "Medium",
    synopsis:
      "A modern reading of Chris Voss's ten chapters on tactical empathy, calibrated questions, mirroring, labeling, bargaining, and reading the hidden leverage inside high-stakes negotiation.",
    pages: 288,
  },
  "pitch-anything": {
    icon: "🎤",
    coverImage: getBookCoverPath("pitch-anything"),
    difficulty: "Medium",
    synopsis:
      "A modern reading of Oren Klaff's eleven chapters on frame control, attention, story, intrigue, prizing, hookpoints, and turning high-stakes pitches into repeatable room command.",
    pages: 240,
  },
  "pre-suasion": {
    icon: "🎯",
    coverImage: getBookCoverPath("pre-suasion"),
    difficulty: "Medium",
    synopsis:
      "A modern reading of Robert Cialdini's fourteen chapters on frontloaded attention, association, unity, ethical screening, and the aftereffects that determine whether influence actually lasts.",
    pages: 432,
  },
  "super-thinking": {
    icon: "🧠",
    coverImage: getBookCoverPath("super-thinking"),
    difficulty: "Medium",
    synopsis:
      "A modern reading of mental models for clearer judgment: reducing avoidable error, tracing unintended consequences, protecting future time, reading systems, and updating decisions with sharper feedback.",
  },
  "you-can't-hurt-me": {
    icon: "🏃",
    coverImage: getBookCoverPath("you-can't-hurt-me"),
    difficulty: "Hard",
    synopsis:
      "A modern reading of David Goggins's eleven chapters on abuse, accountability, suffering, discipline, failure, recovery, and widening strength beyond old verdicts.",
  },
  "extreme-ownership": {
    icon: "🪖",
    coverImage: getBookCoverPath("extreme-ownership"),
    difficulty: "Hard",
    synopsis:
      "A modern reading of Jocko Willink and Leif Babin's thirteen chapters on ownership, trust, planning, decentralized command, disciplined execution, and leadership under pressure.",
    pages: 298,
  },
  "the-art-of-war": {
    icon: "⚔️",
    coverImage: getBookCoverPath("the-art-of-war"),
    difficulty: "Hard",
    synopsis:
      "A modern reading of Sun Tzu's thirteen chapters on strategy, deception, terrain, intelligence, and the conditions that produce victory before battle begins.",
    pages: 68,
  },
  "atomic-habits": {
    icon: "⚛️",
    coverImage: getBookCoverPath("atomic-habits"),
    difficulty: "Medium",
    synopsis:
      "A modern reading of James Clear's twenty chapters on tiny gains, identity change, environment design, repetition, and the conditions that make habits stick long enough to compound.",
    pages: 320,
  },
  "the-great-mental-models-vol-1": {
    icon: "🧩",
    coverImage: getBookCoverPath("the-great-mental-models-vol-1"),
    difficulty: "Medium",
    synopsis:
      "A modern reading of core mental models: abstraction and reality, circles of competence, first principles, second-order effects, probabilistic thinking, inversion, and the disciplined limits of judgment.",
    pages: 304,
  },
  "the-lean-startup": {
    icon: "🚀",
    coverImage: getBookCoverPath("the-lean-startup"),
    difficulty: "Medium",
    synopsis:
      "A modern reading of validated learning, MVPs, innovation accounting, pivots, growth engines, adaptive organizations, and anti-waste management under uncertainty.",
    pages: 336,
  },
};

export function getBookPackageById(bookId: string): BookPackage | undefined {
  return BOOK_PACKAGES.find((pkg) => pkg.book.bookId === bookId);
}

export function getBookPackageByIdForTone(
  bookId: string,
  tone: ToneKey = "direct"
): BookPackage | undefined {
  const getter = BOOK_PACKAGE_TONE_GETTERS[bookId];
  return getter ? getter(tone) : getBookPackageById(bookId);
}

function formatSynopsisTopics(topics: string[]): string {
  if (topics.length === 0) return "practical thinking and real world decision making";
  if (topics.length === 1) return topics[0];
  if (topics.length === 2) return `${topics[0]} and ${topics[1]}`;
  return `${topics.slice(0, -1).join(", ")}, and ${topics[topics.length - 1]}`;
}

function hashText(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function inferPresentationIcon(bookPackage: BookPackage): string {
  const categories = Array.isArray(bookPackage.book.categories)
    ? bookPackage.book.categories.filter(Boolean)
    : [];
  const tags = Array.isArray(bookPackage.book.tags)
    ? bookPackage.book.tags.filter(Boolean)
    : [];
  const source = [bookPackage.book.title, ...categories, ...tags]
    .join(" ")
    .toLowerCase();
  const normalized = source.replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  const tokenSet = new Set(normalized.split(" ").filter(Boolean));
  const hasAny = (...terms: string[]): boolean => {
    return terms.some((term) => {
      const cleanTerm = term.toLowerCase().trim();
      if (!cleanTerm) return false;
      if (cleanTerm.includes(" ")) return normalized.includes(cleanTerm);
      return tokenSet.has(cleanTerm);
    });
  };

  if (hasAny("black swan", "swan")) return "🦢";
  if (hasAny("checklist")) return "✅";
  if (hasAny("forecast", "superforecasting")) return "🔮";
  if (hasAny("mental model", "mental models")) return "🧩";
  if (hasAny("denial of death", "death")) return "🕯️";
  if (hasAny("gift of fear", "fear")) return "🚨";
  if (hasAny("ultralearning")) return "📚";
  if (hasAny("innovators dilemma", "innovation")) return "💡";
  if (hasAny("noise")) return "📉";
  if (hasAny("peak")) return "🏔️";
  if (hasAny("war")) return "⚔️";
  if (hasAny("money", "wealth", "finance")) return "💰";

  const strategyPool = ["♟️", "🧠", "🧭", "🎯", "⚖️"];
  const productivityPool = ["⏱️", "📌", "🗂️", "✅", "🎯"];
  const learningPool = ["📘", "🧠", "📚", "🧪", "🛠️"];
  const communicationPool = ["💬", "🗣️", "🤝", "🎤", "📣"];
  const philosophyPool = ["🏛️", "🕯️", "📜", "🧭", "⚖️"];
  const businessPool = ["📈", "🏢", "💼", "📊", "🚀"];
  const psychologyPool = ["🧠", "🫀", "🧭", "🧩", "👁️"];
  const generalPool = ["📘", "📗", "📙", "📕", "📓"];

  let pool = generalPool;
  if (source.includes("strategy")) pool = strategyPool;
  else if (source.includes("productivity")) pool = productivityPool;
  else if (source.includes("learning") || source.includes("skill")) pool = learningPool;
  else if (source.includes("communication") || source.includes("negotiation")) pool = communicationPool;
  else if (source.includes("philosophy") || source.includes("meaning")) pool = philosophyPool;
  else if (source.includes("business") || source.includes("startup")) pool = businessPool;
  else if (source.includes("psychology") || source.includes("behavior")) pool = psychologyPool;

  return pool[hashText(bookPackage.book.bookId) % pool.length];
}

function inferPresentationDifficulty(categories: string[]): BookPackagePresentation["difficulty"] {
  const source = categories.join(" ").toLowerCase();
  if (
    source.includes("strategy") ||
    source.includes("philosophy") ||
    source.includes("decision making")
  ) {
    return "Hard";
  }
  if (
    source.includes("productivity") ||
    source.includes("learning") ||
    source.includes("communication")
  ) {
    return "Medium";
  }
  return "Medium";
}

function inferFallbackPresentation(bookId: string): BookPackagePresentation {
  const bookPackage = getBookPackageById(bookId);
  if (!bookPackage) {
    return {
      icon: "📘",
      coverImage: getBookCoverPath(bookId),
      difficulty: "Medium",
      synopsis:
        "A focused, chapter-based learning experience with examples, quizzes, and measurable progress.",
    };
  }

  const categories = Array.isArray(bookPackage.book.categories)
    ? bookPackage.book.categories.filter(Boolean)
    : [];
  const tags = Array.isArray(bookPackage.book.tags)
    ? bookPackage.book.tags.filter(Boolean)
    : [];
  const topics = [...new Set([...tags, ...categories].map((item) => item.toLowerCase()))].slice(0, 5);
  const totalMinutes = bookPackage.chapters.reduce(
    (sum, chapter) => sum + Math.max(chapter.readingTimeMinutes, 1),
    0
  );

  return {
    icon: inferPresentationIcon(bookPackage),
    coverImage: getBookCoverPath(bookId),
    difficulty: inferPresentationDifficulty(categories),
    synopsis: `A modern reading of ${formatSynopsisTopics(topics)} with concise summaries, scenarios, quizzes, and gated chapter progression.`,
    pages: Math.max(160, Math.round(totalMinutes * 3.2)),
  };
}

export function getBookPackagePresentation(bookId: string): BookPackagePresentation {
  return BOOK_PACKAGE_PRESENTATION[bookId] ?? inferFallbackPresentation(bookId);
}
