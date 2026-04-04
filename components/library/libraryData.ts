// ── Extended library data for the psychology-driven redesign ──

import { getBookCoverPath } from "@/lib/book-covers";
import {
  BOOK_PACKAGES,
  getBookPackagePresentation,
} from "@/app/book/data/bookPackages";

export type Category =
  | "Psychology"
  | "Productivity"
  | "Strategy"
  | "Leadership"
  | "Communication"
  | "Philosophy";

export type Difficulty = "easy" | "medium" | "hard";
export type BadgeType = "trending" | "staff-pick" | "new" | "most-completed";

export interface UserProgress {
  currentChapter: number;
  percentComplete: number;
  lastReadAt: Date;
  xpEarned: number;
  isCompleted: boolean;
  completedAt?: Date;
}

export interface LibraryBook {
  id: string;
  title: string;
  author: string;
  authorCredentials?: string;
  coverImage?: string;
  coverGradient: string;
  hook: string;
  description: string;
  whatYoullLearn: string[];
  bestFor: string[];
  category: Category;
  difficulty: Difficulty;
  totalChapters: number;
  estimatedReadingTimeMinutes: number;
  readerCount: number;
  completionRate: number;
  isPro: boolean;
  badges: BadgeType[];
  staffPickReason?: string;
  similarBookId?: string;
  userProgress?: UserProgress;
}

export interface UserStats {
  firstName: string;
  level: number;
  xp: number;
  xpToNextLevel: number;
  booksCompleted: number;
  currentStreak: number;
  streakIsActiveToday: boolean;
  nextBadge: { name: string; booksAway: number };
  isPro: boolean;
  freeBooksUsed: number;
  freeBooksLimit: number;
}

export interface WeeklyChallenge {
  description: string;
  category?: Category;
  reward: { xp: number; badge?: string };
  progress: { current: number; target: number };
}

// ── Mock user stats ──
export const MOCK_USER_STATS: UserStats = {
  firstName: "Will",
  level: 4,
  xp: 1250,
  xpToNextLevel: 2000,
  booksCompleted: 3,
  currentStreak: 5,
  streakIsActiveToday: true,
  nextBadge: { name: "Avid Reader", booksAway: 2 },
  isPro: true,
  freeBooksUsed: 1,
  freeBooksLimit: 2,
};

// ── Mock weekly challenge ──
export const MOCK_WEEKLY_CHALLENGE: WeeklyChallenge = {
  description: "Start a book in Psychology",
  category: "Psychology",
  reward: { xp: 100, badge: "Explorer" },
  progress: { current: 1, target: 2 },
};

// ── All books ──
export const MOCK_BOOKS: LibraryBook[] = [
  {
    id: "friends-and-influence",
    title: "How to Win Friends and Influence People",
    author: "Dale Carnegie",
    authorCredentials: "Pioneer of self-improvement, legendary speaker & trainer",
    coverImage: getBookCoverPath("friends-and-influence"),
    coverGradient: "linear-gradient(135deg, #d97706 0%, #92400e 100%)",
    hook: "The timeless art of genuine connection",
    description:
      "The original masterclass in human relations. Timeless principles for making friends, winning people over, and leading with warmth.",
    whatYoullLearn: [
      "6 ways to make people genuinely like you",
      "How to win arguments by avoiding them entirely",
      "Leadership techniques that inspire willing cooperation",
    ],
    bestFor: ["leaders", "salespeople", "introverts"],
    category: "Communication",
    difficulty: "easy",
    totalChapters: 37,
    estimatedReadingTimeMinutes: 588,
    readerCount: 4210,
    completionRate: 89,
    isPro: true,
    badges: ["most-completed"],
    similarBookId: "the-48-laws-of-power",
    userProgress: {
      currentChapter: 12,
      percentComplete: 100,
      lastReadAt: new Date("2026-02-28"),
      xpEarned: 320,
      isCompleted: true,
      completedAt: new Date("2026-02-28"),
    },
  },
  {
    id: "laws-of-human-nature",
    title: "The Laws of Human Nature",
    author: "Robert Greene",
    authorCredentials: "Bestselling author on strategy, power, and human nature",
    coverImage: getBookCoverPath("laws-of-human-nature"),
    coverGradient: "linear-gradient(135deg, #1e3a5f 0%, #0d1b2a 100%)",
    hook: "Decode the hidden forces that drive every human interaction",
    description:
      "Greene's most ambitious work maps 18 laws governing human behavior, drawing on historical figures, psychological research, and biographical case studies to teach emotional mastery, character assessment, and social intelligence.",
    whatYoullLearn: [
      "How to master your emotional reactions under pressure",
      "Reading people's true character beneath their social masks",
      "Detecting envy, aggression, and narcissism before they cause damage",
    ],
    bestFor: ["psychology enthusiasts", "leaders", "self-improvement seekers"],
    category: "Psychology",
    difficulty: "hard",
    totalChapters: 18,
    estimatedReadingTimeMinutes: 306,
    readerCount: 1850,
    completionRate: 62,
    isPro: true,
    badges: ["new"],
    similarBookId: "the-48-laws-of-power",
  },
  {
    id: "the-48-laws-of-power",
    title: "The 48 Laws of Power",
    author: "Robert Greene",
    authorCredentials: "Bestselling author on strategy, power, and human nature",
    coverImage: getBookCoverPath("the-48-laws-of-power"),
    coverGradient: "linear-gradient(135deg, #b91c1c 0%, #450a0a 100%)",
    hook: "Navigate power dynamics with strategic awareness",
    description:
      "Drawing on 3,000 years of history, master the laws that govern power, influence, and social dynamics in any environment.",
    whatYoullLearn: [
      "How to read social dynamics and power structures",
      "Strategic principles from Machiavelli to Sun Tzu",
      "Defensive awareness: how to protect yourself from manipulation",
    ],
    bestFor: ["ambitious professionals", "strategists", "history buffs"],
    category: "Strategy",
    difficulty: "hard",
    totalChapters: 48,
    estimatedReadingTimeMinutes: 288,
    readerCount: 2980,
    completionRate: 68,
    isPro: true,
    badges: ["trending"],
    similarBookId: "friends-and-influence",
  },
  {
    id: "the-charisma-myth",
    title: "The Charisma Myth",
    author: "Olivia Fox Cabane",
    authorCredentials: "Executive coach, keynote speaker on charisma and leadership",
    coverImage: getBookCoverPath("the-charisma-myth"),
    coverGradient: "linear-gradient(135deg, #7c3aed 0%, #2e1065 100%)",
    hook: "Charisma is not a gift. It is a set of behaviors you can learn.",
    description:
      "A science-backed guide to developing the three core behaviors of charisma: presence, power, and warmth. From first impressions to crisis leadership, learn the specific techniques that make people magnetic.",
    whatYoullLearn: [
      "The three pillars of charisma and how to develop each one",
      "How to overcome internal obstacles that block your natural presence",
      "Specific techniques for charismatic speaking, body language, and first impressions",
    ],
    bestFor: ["professionals", "leaders", "introverts", "public speakers"],
    category: "Communication",
    difficulty: "medium",
    totalChapters: 13,
    estimatedReadingTimeMinutes: 221,
    readerCount: 1420,
    completionRate: 74,
    isPro: true,
    badges: ["new"],
    similarBookId: "friends-and-influence",
  },
  {
    id: "never-split-the-difference",
    title: "Never Split the Difference",
    author: "Chris Voss with Tahl Raz",
    authorCredentials: "Former FBI hostage negotiator and negotiation instructor",
    coverImage: getBookCoverPath("never-split-the-difference"),
    coverGradient: "linear-gradient(135deg, #111827 0%, #7f1d1d 100%)",
    hook: "Negotiate with tactical empathy instead of compromise reflexes",
    description:
      "A high-stakes negotiation playbook on tactical empathy, calibrated questions, bargaining, and the hidden constraints that shape real decisions.",
    whatYoullLearn: [
      "How to use mirroring, labels, and calibrated questions under pressure",
      "Why splitting the difference often rewards the wrong frame",
      "How to spot the hidden motives, deadlines, and constraints behind a position",
    ],
    bestFor: ["professionals", "founders", "managers", "students"],
    category: "Communication",
    difficulty: "medium",
    totalChapters: 10,
    estimatedReadingTimeMinutes: 70,
    readerCount: 1680,
    completionRate: 78,
    isPro: true,
    badges: ["staff-pick"],
    staffPickReason: "Sharp, reusable negotiation mechanics without generic self-help padding.",
    similarBookId: "friends-and-influence",
  },
];

// Sync hardcoded values with authoritative book package data
for (const book of MOCK_BOOKS) {
  const pkg = BOOK_PACKAGES.find((p) => p.book.bookId === book.id);
  if (pkg) {
    const pres = getBookPackagePresentation(book.id);
    book.totalChapters = pkg.chapters.length;
    book.estimatedReadingTimeMinutes = pkg.chapters.reduce(
      (sum, ch) => sum + Math.max(ch.readingTimeMinutes, 1),
      0,
    );
    book.difficulty = pres.difficulty.toLowerCase() as Difficulty;
  }
}

// ── Curated section config (NO duplication across sections) ──
export interface CuratedSectionConfig {
  narrativeTitle: string;
  narrativeSubtitle: string;
  bookIds: string[];
}

export const CURATED_SECTIONS: CuratedSectionConfig[] = [
  {
    narrativeTitle: "Master influence and power.",
    narrativeSubtitle:
      "Timeless wisdom on human connection and strategic awareness.",
    bookIds: [
      "friends-and-influence",
      "never-split-the-difference",
      "the-48-laws-of-power",
      "laws-of-human-nature",
      "the-charisma-myth",
    ],
  },
  {
    narrativeTitle: "Build better systems.",
    narrativeSubtitle:
      "Practical frameworks for habits, productivity, and personal growth.",
    bookIds: [],
  },
];

// ── Helpers ──

export function getBookById(id: string): LibraryBook | undefined {
  return MOCK_BOOKS.find((b) => b.id === id);
}

export function getBooksById(ids: string[]): LibraryBook[] {
  const map = new Map(MOCK_BOOKS.map((b) => [b.id, b]));
  return ids.map((id) => map.get(id)).filter((b): b is LibraryBook => !!b);
}

export function getInProgressBooks(): LibraryBook[] {
  return MOCK_BOOKS.filter(
    (b) => b.userProgress && !b.userProgress.isCompleted && b.userProgress.percentComplete > 0
  );
}

export function getCompletedBooks(): LibraryBook[] {
  return MOCK_BOOKS.filter((b) => b.userProgress?.isCompleted);
}

export function getNotStartedBooks(): LibraryBook[] {
  return MOCK_BOOKS.filter((b) => !b.userProgress);
}

export function formatReadingTime(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function getProgressMicrocopy(percent: number, chaptersLeft: number): string {
  if (percent === 100) return "Completed!";
  if (percent >= 75) return `Almost done! Just ${chaptersLeft} chapter${chaptersLeft === 1 ? "" : "s"} left`;
  if (percent >= 50) return "More than halfway there — keep going!";
  if (percent >= 25) return "Building momentum — you're into the good stuff";
  return "Just getting started — the best insights are ahead";
}

export function getProgressColor(percent: number): string {
  if (percent >= 75) return "var(--accent-gold)";
  if (percent >= 50) return "var(--accent-green)";
  return "var(--accent-teal)";
}

export function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
}

/** Days since date */
export function daysSince(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
}

/** Returns urgency color based on days since last read */
export function getLastReadUrgencyColor(date: Date): string {
  const days = daysSince(date);
  if (days >= 6) return "var(--accent-red)";
  if (days >= 3) return "var(--accent-flame)";
  return "var(--text-muted)";
}

/** Returns urgency copy for stale reads */
export function getLastReadCopy(date: Date): string {
  const days = daysSince(date);
  const base = timeAgo(date);
  if (days >= 6) return `Last read: ${base} — don't lose your progress!`;
  return `Last read: ${base}`;
}

/** Estimated minutes per chapter */
export function getPerChapterMinutes(book: LibraryBook): number {
  return Math.round(book.estimatedReadingTimeMinutes / book.totalChapters);
}

/** Free-plan progress bar color */
export function getFreePlanColor(used: number, limit: number): string {
  if (used >= limit) return "var(--accent-red)";
  if (used >= limit / 2) return "var(--accent-flame)";
  return "var(--accent-teal)";
}

export type SortOption =
  | "popular"
  | "shortest"
  | "completion"
  | "beginner"
  | "recent"
  | "alphabetical";

export const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "popular", label: "Most popular" },
  { value: "shortest", label: "Shortest first" },
  { value: "completion", label: "Highest completion rate" },
  { value: "beginner", label: "Best for beginners" },
  { value: "recent", label: "Recently added" },
  { value: "alphabetical", label: "Alphabetical" },
];
