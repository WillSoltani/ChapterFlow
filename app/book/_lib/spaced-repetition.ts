"use client";

// ─── Spaced Repetition System ────────────────────────────────────────────────
// Incorrectly answered quiz questions enter a review queue at expanding intervals:
// Day 1 → Day 3 → Day 7 → Day 14 → Day 30 → Mastered

const STORAGE_KEY = "book-accelerator:spaced-rep:v1";
const INTERVALS = [1, 3, 7, 14, 30];

export type ReviewItem = {
  id: string;
  userId: string;
  chapterId: string;
  bookId: string;
  bookTitle: string;
  chapterTitle: string;
  questionId: string;
  questionText: string;
  choices: { choiceId: string; text: string }[];
  correctChoiceId: string;
  explanation: string;
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
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveItems(items: ReviewItem[]): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

/** Get all pending review items (due today or earlier, not mastered) */
export function getPendingReviews(): ReviewItem[] {
  const today = toDateString(new Date());
  return loadItems()
    .filter((item) => !item.mastered && item.nextReviewDate <= today)
    .sort((a, b) => a.nextReviewDate.localeCompare(b.nextReviewDate))
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
  return item;
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
