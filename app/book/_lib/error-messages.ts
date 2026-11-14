import { BookClientError } from "@/app/book/_lib/book-api";

/**
 * Centralized error code -> user-facing message map.
 * Shared by QueryBoundary and the dashboard error/retry surfaces so that
 * fetch failures render a consistent, friendly message instead of a raw
 * Error string (or a silent zeroed-out fallback).
 */
export const ERROR_MESSAGES: Record<string, string> = {
  unauthenticated: "Your session has expired. Please sign in again.",
  invalid_token: "Your session has expired. Please sign in again.",
  book_not_started: "Open this book from your library to get started.",
  chapter_locked: "Complete the previous chapter to unlock this one.",
  attempt_cooldown: "Quiz retake is temporarily locked. Try again in a moment.",
  attempt_rate_limited:
    "Too many quiz attempts. Take a break and try again later.",
  paywall_book_limit:
    "You’ve reached your free book limit. Upgrade to Pro to unlock unlimited books.",
  email_verification_required: "Please verify your email address to continue.",
  free_access_review_required:
    "Your access is under review. Please contact support if this persists.",
  server_error: "Something went wrong. Please try again.",
  dashboard_unavailable: "We couldn't load your dashboard right now. Please try again.",
  throttled: "ChapterFlow is busy right now. Please try again in a moment.",
  verifier_unavailable: "We couldn't check your sign-in just now. Please try again.",
  quiz_state_conflict: "This quiz changed while you were answering. Refresh and try again.",
  quiz_session_stale: "This quiz is out of date. Refresh and try again.",
  progress_write_contended: "We couldn't save your progress just now. Please try again.",
  streak_write_contended: "We couldn't update your streak just now. Please try again.",
  quiz_write_contended: "We couldn't save your quiz result just now. Please try again.",
  insufficient_points: "You don't have enough Insight Points for this yet.",
  insufficient_balance: "You don't have enough Insight Points for this yet.",
  reward_already_claimed: "You've already claimed this reward.",
  already_pro: "You already have Pro. Manage your plan in Settings.",
  already_owned: "You already own this item.",
  question_limit: "You've used today's questions. You can ask more tomorrow.",
  pro_required: "This is part of Pro. Upgrade to use it.",
  invalid_answers: "Some answers didn't match this quiz. Refresh and try again.",
  reset_incomplete: "Your progress didn't fully reset. Please try again.",
  settings_write_conflict: "Your settings changed somewhere else at the same time. Please try again.",
  rate_limited: "You've reached today's limit for this. Try again tomorrow.",
  invalid_json: "We couldn't read that request. Please try again.",
  invalid_cursor: "We couldn't load more items. Refresh and try again.",
  chapter_state_conflict: "This chapter was updated somewhere else. Reload to see the latest version.",
  profile_write_conflict: "Your profile changed somewhere else at the same time. Please try again.",
};

/** Resolve a thrown error into a user-facing message. */
export function getBookErrorMessage(error: unknown): string {
  if (error instanceof BookClientError && error.code) {
    return ERROR_MESSAGES[error.code] ?? error.message;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return ERROR_MESSAGES.server_error ?? "Something went wrong. Please try again.";
}
