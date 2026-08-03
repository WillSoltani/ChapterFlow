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
      className="cr-try-this-now rounded-2xl border border-(--cr-glass-border-teal) bg-(--cr-accent-muted) px-5 py-4"
    >
      <p className="text-cf-caption font-bold uppercase tracking-[0.16em] text-(--cr-accent)">
        Try this now
      </p>
      <p className="mt-2 text-base italic leading-relaxed text-(--cr-text-primary)">
        {trimmed}
      </p>
    </aside>
  );
}
