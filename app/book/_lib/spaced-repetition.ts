"use client";

// ─── Spaced Repetition System ────────────────────────────────────────────────
// Quiz mistakes and chapter review cards enter a review queue at expanding intervals:
// Day 1 → Day 3 → Day 7 → Day 14 → Day 30 → Mastered

const STORAGE_KEY = "book-accelerator:spaced-rep:v1";
const DAILY_REVIEW_COUNT_KEY = "book-accelerator:daily-review-count:v1";
const INTERVALS = [1, 3, 7, 14, 30];

export type ReviewItem = {
  id: string;
  type: "quiz" | "flashcard";
  userId: string;
  chapterId: string;
  bookId: string;
  bookTitle: string;
  chapterTitle: string;
  questionId: string;
  // Quiz-specific fields (present when type === "quiz")
  questionText?: string;
  choices?: { choiceId: string; text: string }[];
  correctChoiceId?: string;
  explanation?: string;
  // Flashcard-specific fields (present when type === "flashcard")
  front?: string;
  back?: string;
  difficulty?: "easy" | "medium" | "hard";
  // Scheduling
  intervalDays: number;
  nextReviewDate: string; // ISO date string YYYY-MM-DD
  consecutiveCorrect: number;
  totalReviews: number;
  mastered: boolean;
  createdAt: string;
};

function toDateString(date: Date): string {
  return date.toISOString().split("T")[0];
}

/** Local date string (YYYY-MM-DD) for daily count tracking — resets at local midnight */
function toLocalDateString(): string {
  return new Date().toLocaleDateString("en-CA");
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function loadItems(): ReviewItem[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Normalize legacy items missing the type field
    return parsed.map((item: ReviewItem) => ({ ...item, type: item.type ?? "quiz" }));
  } catch {
    return [];
  }
}

function saveItems(items: ReviewItem[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    console.warn("Failed to save review items — localStorage may be full");
  }
}

/** Get all pending review items (due today or earlier, not mastered).
 *  Quiz items are prioritized over flashcards for the same due date. */
export function getPendingReviews(): ReviewItem[] {
  const today = toDateString(new Date());
  return loadItems()
    .filter((item) => !item.mastered && item.nextReviewDate <= today)
    .sort((a, b) => {
      // Quiz items first (higher priority — wrong answers need more attention)
      if (a.type !== b.type) return a.type === "quiz" ? -1 : 1;
      return a.nextReviewDate.localeCompare(b.nextReviewDate);
    })
    .slice(0, 10); // Cap at 10 per session
}

/** Get count of pending reviews */
export function getPendingReviewCount(): number {
  const today = toDateString(new Date());
  return loadItems().filter((item) => !item.mastered && item.nextReviewDate <= today).length;
}

/** Create a new review item from an incorrectly answered quiz question */
export function createReviewItem(params: {
  chapterId: string;
  bookId: string;
  bookTitle: string;
  chapterTitle: string;
  questionId: string;
  questionText: string;
  choices: { choiceId: string; text: string }[];
  correctChoiceId: string;
  explanation: string;
}): void {
  const items = loadItems();

  // Check if this question already has an active review item
  const existing = items.find(
    (item) => item.questionId === params.questionId && !item.mastered
  );

  if (existing) {
    // Reset existing item — they got it wrong again
    existing.consecutiveCorrect = 0;
    existing.intervalDays = 1;
    existing.nextReviewDate = toDateString(addDays(new Date(), 1));
    saveItems(items);
    return;
  }

  // Don't recreate if already mastered
  const mastered = items.find(
    (item) => item.questionId === params.questionId && item.mastered
  );
  if (mastered) return;

  // Create new item
  const newItem: ReviewItem = {
    id: `review-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: "quiz",
    userId: "local",
    chapterId: params.chapterId,
    bookId: params.bookId,
    bookTitle: params.bookTitle,
    chapterTitle: params.chapterTitle,
    questionId: params.questionId,
    questionText: params.questionText,
    choices: params.choices,
    correctChoiceId: params.correctChoiceId,
    explanation: params.explanation,
    intervalDays: 1,
    nextReviewDate: toDateString(addDays(new Date(), 1)),
    consecutiveCorrect: 0,
    totalReviews: 0,
    mastered: false,
    createdAt: new Date().toISOString(),
  };

  items.push(newItem);
  saveItems(items);
}

/** Create a flashcard review item from a chapter review card */
export function createFlashcardReviewItem(params: {
  chapterId: string;
  bookId: string;
  bookTitle: string;
  chapterTitle: string;
  cardId: string;
  front: string;
  back: string;
  difficulty: "easy" | "medium" | "hard";
}): void {
  const items = loadItems();

  // Skip if this card already exists (active or mastered)
  const existing = items.find((item) => item.questionId === params.cardId);
  if (existing) return;

  // Easy cards start at a longer interval since they are simpler concepts
  const initialInterval = params.difficulty === "easy" ? 3 : 1;

  const newItem: ReviewItem = {
    id: `review-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: "flashcard",
    userId: "local",
    chapterId: params.chapterId,
    bookId: params.bookId,
    bookTitle: params.bookTitle,
    chapterTitle: params.chapterTitle,
    questionId: params.cardId,
    front: params.front,
    back: params.back,
    difficulty: params.difficulty,
    intervalDays: initialInterval,
    nextReviewDate: toDateString(addDays(new Date(), initialInterval)),
    consecutiveCorrect: 0,
    totalReviews: 0,
    mastered: false,
    createdAt: new Date().toISOString(),
  };

  items.push(newItem);
  saveItems(items);
}

/** Process a review answer */
export function processReviewAnswer(
  itemId: string,
  isCorrect: boolean
): ReviewItem | null {
  const items = loadItems();
  const item = items.find((i) => i.id === itemId);
  if (!item) return null;

  item.totalReviews++;

  if (isCorrect) {
    item.consecutiveCorrect++;
    if (item.consecutiveCorrect >= INTERVALS.length) {
      item.mastered = true;
    } else {
      const nextInterval = INTERVALS[item.consecutiveCorrect];
      item.intervalDays = nextInterval;
      item.nextReviewDate = toDateString(addDays(new Date(), nextInterval));
    }
  } else {
    item.consecutiveCorrect = 0;
    item.intervalDays = 1;
    item.nextReviewDate = toDateString(addDays(new Date(), 1));
  }

  saveItems(items);
  incrementDailyReviewCount();
  return item;
}

// ─── Daily Review Count ─────────────────────────────────────────────────────

/** Get number of reviews completed today */
export function getDailyReviewCount(): number {
  try {
    const raw = window.localStorage.getItem(DAILY_REVIEW_COUNT_KEY);
    if (!raw) return 0;
    const parsed = JSON.parse(raw);
    if (parsed.date === toLocalDateString()) return parsed.count ?? 0;
    return 0;
  } catch {
    return 0;
  }
}

/** Increment today's review count and return the new value */
export function incrementDailyReviewCount(): number {
  const today = toLocalDateString();
  let count = 0;
  try {
    const raw = window.localStorage.getItem(DAILY_REVIEW_COUNT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.date === today) count = parsed.count ?? 0;
    }
  } catch {
    // start fresh
  }
  count += 1;
  try {
    window.localStorage.setItem(DAILY_REVIEW_COUNT_KEY, JSON.stringify({ date: today, count }));
  } catch {
    console.warn("Failed to save daily review count — localStorage may be full");
  }
  return count;
}

// ─── KnowledgeReview Helpers ────────────────────────────────────────────────

/** Count of review items that are overdue (due before today, not mastered) */
export function getOverdueReviewCount(): number {
  const today = toDateString(new Date());
  return loadItems().filter((item) => !item.mastered && item.nextReviewDate < today).length;
}

/** Count of non-mastered items due in the next 7 days (excluding today and overdue) */
export function getUpcomingThisWeekCount(): number {
  const today = toDateString(new Date());
  const weekFromNow = toDateString(addDays(new Date(), 7));
  return loadItems().filter(
    (item) => !item.mastered && item.nextReviewDate > today && item.nextReviewDate <= weekFromNow
  ).length;
}

/** Total review items ever created (active + mastered) */
export function getTotalReviewItems(): number {
  return loadItems().length;
}

/** Build a 7-day forecast of upcoming reviews */
export function buildReviewForecast(): Array<{ date: string; count: number }> {
  const items = loadItems().filter((item) => !item.mastered);
  const forecast: Array<{ date: string; count: number }> = [];
  for (let offset = 0; offset < 7; offset++) {
    const date = toDateString(addDays(new Date(), offset));
    const count = items.filter((item) => item.nextReviewDate === date).length;
    forecast.push({ date, count });
  }
  return forecast;
}

/** Check if user has seen the spaced repetition explanation */
export function hasSeenSRExplanation(): boolean {
  return window.localStorage.getItem("book-accelerator:sr-explanation-seen") === "true";
}

/** Mark the spaced repetition explanation as seen */
export function markSRExplanationSeen(): void {
  window.localStorage.setItem("book-accelerator:sr-explanation-seen", "true");
}

/** Estimate review session time in minutes */
export function estimateReviewTime(count: number): number {
  return Math.max(1, Math.round((count * 40) / 60));
}
