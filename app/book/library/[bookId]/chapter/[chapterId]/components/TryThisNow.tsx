"use client";

type TryThisNowProps = {
  text?: string | undefined;
};

/**
 * Renders a v21 chapter's `tryThisNow` directive as a mid-chapter callout.
 *
 * It is NOT a prompt or journaling input. The reader is expected to do the
 * specific 30–90 second action it names; the act itself produces the insight.
 * No textarea, no save button, no "your answer".
 *
 * Returns null if no text is provided so consumers can render unconditionally.
 */
export function TryThisNow({ text }: TryThisNowProps) {
  const trimmed = text?.trim();
  if (!trimmed) return null;

  return (
    <aside
      role="note"
      aria-label="Try this now"
      className="cr-try-this-now cr-reading-content border-l-2 border-(--cr-accent) pl-5"
    >
      <p className="font-(family-name:--font-body) text-cf-caption font-medium uppercase tracking-[0.16em] text-(--cr-text-secondary)">
        Try this now
      </p>
      <p className="mt-2 italic text-(--cr-text-heading)">{trimmed}</p>
    </aside>
  );
}
