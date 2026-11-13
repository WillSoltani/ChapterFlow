// Which main card Home shows (HOME-06). Pure so the order is testable.

export type UserState =
  | "new_user"
  | "active_reader"
  | "quiz_pending"
  | "between_books"
  | "returning"
  | "free_limit_reached";

type ShelfStatus = "not_started" | "in_progress" | "completed";

export interface WorkspaceStateInput {
  currentBook: { currentLoopStep: "summary" | "scenarios" | "quiz" | "unlock" | null } | null;
  userBooks: ReadonlyArray<{ progressPercent: number; status: ShelfStatus }>;
  user: { isPro: boolean; streakCount: number };
}

/** Home's shelf lists only books the reader started (D3); browsed books leave it. */
export function homeShelfBooks<T extends { status: ShelfStatus }>(books: readonly T[]): T[] {
  return books.filter((b) => b.status !== "not_started");
}

/**
 * "New user" for shelf/hero purposes: no engaged books, or every engaged book is
 * still untouched. The only state in which HeroSessionCard surfaces the
 * onboarding starter shelf, so the mapper and the state machine share it.
 */
export function isNewUserShelf(userBooks: WorkspaceStateInput["userBooks"]): boolean {
  return (
    userBooks.length === 0 ||
    userBooks.every((b) => b.progressPercent === 0 && b.status === "not_started")
  );
}

export function deriveUserState(
  data: WorkspaceStateInput,
  allowance: { remainingFreeStarts: number } | null,
): UserState {
  const { currentBook, userBooks, user } = data;

  if (isNewUserShelf(userBooks)) return "new_user";

  if (!currentBook) {
    // Unknown allowance never shows the limit card.
    if (!user.isPro && allowance?.remainingFreeStarts === 0) return "free_limit_reached";
    return "between_books";
  }

  if (user.streakCount === 0 && userBooks.some((b) => b.progressPercent > 0)) {
    return "returning";
  }

  if (currentBook.currentLoopStep === "quiz") return "quiz_pending";

  return "active_reader";
}
