/**
 * ACCT-27: the message the export dialog shows when a download fails.
 * `status` is null when no response arrived (offline, network error).
 */
const FALLBACK = "Export failed. Please try again.";

export function exportErrorMessage(status: number | null, body: unknown): string {
  if (status === null) {
    return "Couldn't reach ChapterFlow. Check your connection and try again.";
  }
  if (status === 429) {
    return "You've reached today's export limit. Each download counts toward it; try again tomorrow.";
  }
  if (body && typeof body === "object") {
    const error = (body as { error?: unknown }).error;
    if (error && typeof error === "object") {
      const message = (error as { message?: unknown }).message;
      if (typeof message === "string" && message.trim()) return message.trim();
    }
  }
  return FALLBACK;
}
