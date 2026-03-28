import lawsOfPowerPackageJson from "@/book-packages/the-48-laws-of-power.modern.json";
import friendsAndInfluencePackageJson from "@/book-packages/friends-and-influence.modern.json";
import atomicHabitsPackageJson from "@/book-packages/atomic-habits.modern.json";
import lawsOfHumanNaturePackageJson from "@/book-packages/laws-of-human-nature.modern.json";
import artOfWarPackageJson from "@/book-packages/the-art-of-war.modern.json";
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
  importantSummary?: string;
  summaryBullets?: string[];
  summaryBlocks?: PackageSummaryBlock[];
  keyTakeaways?: string[];
  takeaways?: string[];
  practice?: string[];
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

export type PackageChapter = {
  chapterId: string;
  number: number;
  title: string;
  readingTimeMinutes: number;
  contentVariants: Partial<Record<VariantKey, PackageVariantContent>>;
  examples: PackageExample[];
  quiz: PackageQuiz;
};

export type PackageBook = {
  bookId: string;
  title: string;
  author: string;
  categories: string[];
  tags?: string[];
  edition?: string | { name: string; publishedYear?: number };
  variantFamily: VariantFamily;
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
  coverImage: string;
  difficulty: "Easy" | "Medium" | "Hard";
  synopsis: string;
  pages?: number;
};

/* ── NSTD tone-aware JSON normalization ────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ToneObject = { gentle?: string; direct?: string; competitive?: string };
export type ToneKey = "gentle" | "direct" | "competitive";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function resolveTone(value: any, tone: ToneKey = "direct"): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    if (typeof value[tone] === "string") return value[tone];
    for (const k of ["direct", "gentle", "competitive"] as const) {
      if (typeof value[k] === "string") return value[k];
    }
  }
  return "";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeNstdVariant(v: any, tone: ToneKey = "direct"): PackageVariantContent {
  const summaryBlocks: PackageSummaryBlock[] = [];

  // chapterBreakdown → paragraphs (tone-object format, e.g. 48 Laws)
  const breakdown = resolveTone(v?.chapterBreakdown, tone);
  if (breakdown) {
    for (const p of breakdown.split(/\n\n+/).filter((s: string) => s.trim())) {
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

  // oneMinuteRecap → practice
  const practice: string[] = [];
  if (v?.oneMinuteRecap) {
    if (typeof v.oneMinuteRecap === "object" && v.oneMinuteRecap.retrieve) {
      const retrieve = resolveTone(v.oneMinuteRecap.retrieve, tone);
      const connect = resolveTone(v.oneMinuteRecap.connect, tone);
      const preview = resolveTone(v.oneMinuteRecap.preview, tone);
      if (retrieve) practice.push(retrieve);
      if (connect) practice.push(connect);
      if (preview) practice.push(preview);
    } else {
      const recap = resolveTone(v.oneMinuteRecap, tone);
      if (recap) practice.push(recap);
    }
  }
  if (v?.selfCheckPrompt) practice.push(resolveTone(v.selfCheckPrompt, tone));
  if (Array.isArray(v?.selfCheckPrompts)) {
    for (const p of v.selfCheckPrompts) practice.push(resolveTone(p, tone));
  }
  if (v?.predictionPrompt) practice.push(resolveTone(v.predictionPrompt, tone));

  return {
    importantSummary: breakdown ? breakdown.split(/\n\n+/)[0]?.trim() : undefined,
    summaryBullets: keyTakeaways.length > 0 ? keyTakeaways : undefined,
    summaryBlocks,
    keyTakeaways: keyTakeaways.length > 0 ? keyTakeaways : undefined,
    practice: practice.length > 0 ? practice : undefined,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeNstdPackage(raw: any, tone: ToneKey = "direct"): BookPackage {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chapters: PackageChapter[] = (raw.chapters ?? []).map((ch: any) => {
    const contentVariants: Partial<Record<VariantKey, PackageVariantContent>> = {};
    for (const key of ["easy", "medium", "hard"] as const) {
      const v = ch.contentVariants?.[key];
      if (v) contentVariants[key] = normalizeNstdVariant(v, tone);
    }
    return {
      chapterId: ch.chapterId,
      number: ch.number,
      title: ch.title,
      readingTimeMinutes: ch.readingTimeMinutes,
      contentVariants,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      examples: (ch.examples ?? []).map((ex: any) => ({
        exampleId: ex.exampleId,
        title: ex.title,
        scenario: resolveTone(ex.scenario, tone),
        whatToDo: Array.isArray(ex.whatToDo)
          ? ex.whatToDo
          : [resolveTone(ex.whatToDo, tone)],
        whyItMatters: resolveTone(ex.whyItMatters, tone),
        contexts: ex.contexts ?? (ex.category ? [ex.category] : []),
      })),
      quiz: {
        passingScorePercent: ch.quiz?.passingScorePercent ?? 80,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        questions: (ch.quiz?.questions ?? []).map((q: any) => ({
          questionId: q.questionId,
          prompt: q.prompt,
          choices: q.choices,
          correctIndex: q.correctIndex,
          explanation: resolveTone(q.explanation, tone),
        })),
      },
    } satisfies PackageChapter;
  });
  return {
    schemaVersion: raw.schemaVersion,
    packageId: raw.packageId,
    createdAt: raw.createdAt,
    contentOwner: raw.contentOwner,
    book: raw.book,
    chapters,
  };
}

export const LAWS_OF_POWER_PACKAGE =
  normalizeNstdPackage(lawsOfPowerPackageJson, "direct");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const LAWS_OF_POWER_RAW_CHAPTERS: any[] = (lawsOfPowerPackageJson as any).chapters ?? [];

export function getLawsOfPowerPackageForTone(tone: ToneKey): BookPackage {
  return normalizeNstdPackage(lawsOfPowerPackageJson, tone);
}
export const FRIENDS_AND_INFLUENCE_PACKAGE =
  normalizeNstdPackage(friendsAndInfluencePackageJson, "direct");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const FRIENDS_AND_INFLUENCE_RAW_CHAPTERS: any[] = (friendsAndInfluencePackageJson as any).chapters ?? [];

export function getFriendsAndInfluencePackageForTone(tone: ToneKey): BookPackage {
  return normalizeNstdPackage(friendsAndInfluencePackageJson, tone);
}

export const ATOMIC_HABITS_PACKAGE =
  normalizeNstdPackage(atomicHabitsPackageJson, "direct");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const ATOMIC_HABITS_RAW_CHAPTERS: any[] = (atomicHabitsPackageJson as any).chapters ?? [];

export function getAtomicHabitsPackageForTone(tone: ToneKey): BookPackage {
  return normalizeNstdPackage(atomicHabitsPackageJson, tone);
}

export const LAWS_OF_HUMAN_NATURE_PACKAGE =
  normalizeNstdPackage(lawsOfHumanNaturePackageJson, "direct");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const LAWS_OF_HUMAN_NATURE_RAW_CHAPTERS: any[] = (lawsOfHumanNaturePackageJson as any).chapters ?? [];

export function getLawsOfHumanNaturePackageForTone(tone: ToneKey): BookPackage {
  return normalizeNstdPackage(lawsOfHumanNaturePackageJson, tone);
}

export const ART_OF_WAR_PACKAGE = normalizeNstdPackage(artOfWarPackageJson, "direct");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const ART_OF_WAR_RAW_CHAPTERS: any[] = (artOfWarPackageJson as any).chapters ?? [];

export function getArtOfWarPackageForTone(tone: ToneKey): BookPackage {
  return normalizeNstdPackage(artOfWarPackageJson, tone);
}

export const BOOK_PACKAGES: BookPackage[] = [
  LAWS_OF_POWER_PACKAGE,
  FRIENDS_AND_INFLUENCE_PACKAGE,
  ATOMIC_HABITS_PACKAGE,
  LAWS_OF_HUMAN_NATURE_PACKAGE,
  ART_OF_WAR_PACKAGE,
];

export const BOOK_PACKAGE_PRESENTATION: Record<string, BookPackagePresentation> = {
  "friends-and-influence": {
    icon: "🤝",
    coverImage: getBookCoverPath("friends-and-influence"),
    difficulty: "Medium",
    synopsis:
      "A classic communication guide focused on first impressions, attentive listening, better questions, respectful disagreement, and the habits that make relationships stronger over time.",
    pages: 304,
  },
  "the-48-laws-of-power": {
    icon: "♜",
    coverImage: getBookCoverPath("the-48-laws-of-power"),
    difficulty: "Hard",
    synopsis:
      "A modern reading of power, timing, reputation, influence, and strategic awareness for students and early career builders.",
    pages: 480,
  },
  "atomic-habits": {
    icon: "🔁",
    coverImage: getBookCoverPath("atomic-habits"),
    difficulty: "Medium",
    synopsis:
      "A modern reading of habits, identity, and behavior design: how tiny changes compound into remarkable results.",
    pages: 320,
  },
  "laws-of-human-nature": {
    icon: "🧠",
    coverImage: getBookCoverPath("laws-of-human-nature"),
    difficulty: "Hard",
    synopsis:
      "A deep exploration of emotional mastery, empathy, character assessment, group dynamics, and the hidden forces that drive human behavior.",
    pages: 624,
  },
  "the-art-of-war": {
    icon: "⚔️",
    coverImage: getBookCoverPath("the-art-of-war"),
    difficulty: "Hard",
    synopsis:
      "A focused reading of timing, deception, terrain, morale, and intelligence through the 13 chapters of the Lionel Giles 1910 translation.",
    pages: 208,
  },
};

export function getBookPackageById(bookId: string): BookPackage | undefined {
  return BOOK_PACKAGES.find((pkg) => pkg.book.bookId === bookId);
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
