import "server-only";

export type StarterPrescription = {
  bookId: string;
  bookTitle: string;
  bookAuthor: string;
  chapterNumber: 1;
  reason: string;
  reasonDetail: string;
  generatedAt: string;
};

type Motivation = "career" | "academic" | "personal" | "curiosity";

const MOTIVATION_BOOK_AFFINITY: Record<Motivation, Record<string, number>> = {
  career: {
    "crucial-conversations": 5,
    "thinking-fast-and-slow": 3,
    "the-almanack-of-naval-ravikant": 4,
  },
  academic: {
    "thinking-fast-and-slow": 5,
    "crucial-conversations": 2,
    "the-almanack-of-naval-ravikant": 3,
  },
  personal: {
    "the-almanack-of-naval-ravikant": 5,
    "crucial-conversations": 4,
    "thinking-fast-and-slow": 2,
  },
  curiosity: {
    "thinking-fast-and-slow": 4,
    "the-almanack-of-naval-ravikant": 4,
    "crucial-conversations": 3,
  },
};

const INTEREST_BOOK_SCORES: Record<string, Record<string, number>> = {
  communication: { "crucial-conversations": 3 },
  relationships: { "crucial-conversations": 2 },
  productivity: { "crucial-conversations": 1, "the-almanack-of-naval-ravikant": 1 },
  leadership: { "crucial-conversations": 2, "the-almanack-of-naval-ravikant": 2 },
  strategy: { "thinking-fast-and-slow": 2, "the-almanack-of-naval-ravikant": 1 },
  negotiation: { "crucial-conversations": 3 },
  psychology: { "thinking-fast-and-slow": 3 },
  science: { "thinking-fast-and-slow": 2 },
  "decision-making": { "thinking-fast-and-slow": 3 },
  education: { "thinking-fast-and-slow": 2 },
  philosophy: { "the-almanack-of-naval-ravikant": 3 },
  finance: { "the-almanack-of-naval-ravikant": 2 },
  "self-awareness": { "the-almanack-of-naval-ravikant": 2 },
  "self-improvement": { "thinking-fast-and-slow": 1, "the-almanack-of-naval-ravikant": 1 },
  habits: { "the-almanack-of-naval-ravikant": 1 },
  "health-wellness": { "the-almanack-of-naval-ravikant": 1 },
  history: { "thinking-fast-and-slow": 1 },
  creativity: { "the-almanack-of-naval-ravikant": 1, "thinking-fast-and-slow": 1 },
};

const BOOK_META: Record<string, { title: string; author: string; difficulty: string }> = {
  "crucial-conversations": {
    title: "Crucial Conversations",
    author: "Joseph Grenny, Kerry Patterson, Ron McMillan, Al Switzler",
    difficulty: "Medium",
  },
  "thinking-fast-and-slow": {
    title: "Thinking, Fast and Slow",
    author: "Daniel Kahneman",
    difficulty: "Hard",
  },
  "the-almanack-of-naval-ravikant": {
    title: "The Almanack of Naval Ravikant",
    author: "Eric Jorgenson",
    difficulty: "Medium",
  },
};

const MOTIVATION_LABELS: Record<Motivation, string> = {
  career: "career growth",
  academic: "academic development",
  personal: "personal growth",
  curiosity: "intellectual curiosity",
};

function buildReason(
  motivation: Motivation,
  matchedInterests: string[],
  bookTitle: string,
): { reason: string; reasonDetail: string } {
  const motLabel = MOTIVATION_LABELS[motivation];

  if (matchedInterests.length > 0) {
    const interestList =
      matchedInterests.length === 1
        ? matchedInterests[0]
        : `${matchedInterests.slice(0, -1).join(", ")} and ${matchedInterests[matchedInterests.length - 1]}`;
    return {
      reason: `Picked for your interest in ${interestList}`,
      reasonDetail: `${bookTitle} aligns with your focus on ${motLabel} and your interest in ${interestList}. Chapter 1 sets the foundation for everything that follows.`,
    };
  }

  return {
    reason: `A strong starting point for ${motLabel}`,
    reasonDetail: `${bookTitle} is a highly-rated starting point for readers focused on ${motLabel}. Chapter 1 sets the foundation for everything that follows.`,
  };
}

export function generateStarterPrescription(
  motivation: string,
  interests: string[],
  starterShelf?: string[],
): StarterPrescription {
  const mot = (
    ["career", "academic", "personal", "curiosity"].includes(motivation)
      ? motivation
      : "curiosity"
  ) as Motivation;

  const allBookIds = Object.keys(BOOK_META);
  // If the user selected books during onboarding, only consider those that we have scoring data for
  const candidateIds =
    starterShelf && starterShelf.length > 0
      ? allBookIds.filter((id) => starterShelf.includes(id))
      : allBookIds;
  // Fall back to full set if none of the shelf books have scoring data
  const bookIds = candidateIds.length > 0 ? candidateIds : allBookIds;
  const scores: Record<string, number> = {};

  for (const bookId of bookIds) {
    let score = MOTIVATION_BOOK_AFFINITY[mot][bookId] ?? 0;

    for (const interest of interests) {
      const interestScores = INTEREST_BOOK_SCORES[interest];
      if (interestScores?.[bookId]) {
        score += interestScores[bookId];
      }
    }

    const meta = BOOK_META[bookId];
    if (meta.difficulty === "Medium") score += 0.5;

    scores[bookId] = score;
  }

  const sorted = bookIds.sort((a, b) => (scores[b] ?? 0) - (scores[a] ?? 0));
  const bestBookId = sorted[0];
  const meta = BOOK_META[bestBookId];

  const matchedInterests = interests.filter(
    (i) => INTEREST_BOOK_SCORES[i]?.[bestBookId],
  );

  const { reason, reasonDetail } = buildReason(mot, matchedInterests, meta.title);

  return {
    bookId: bestBookId,
    bookTitle: meta.title,
    bookAuthor: meta.author,
    chapterNumber: 1,
    reason,
    reasonDetail,
    generatedAt: new Date().toISOString(),
  };
}
