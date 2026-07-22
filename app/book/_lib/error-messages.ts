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
