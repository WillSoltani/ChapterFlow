type PublicMastheadProps = {
  eyebrow: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  compact?: boolean;
  headingAs?: "h1" | "p";
};

/** Shared night-field introduction for non-home public routes. */
export function PublicMasthead({
  eyebrow,
  title,
  description,
  compact = false,
  headingAs = "h1",
}: PublicMastheadProps) {
  const Heading = headingAs;

  return (
    <header
      className={`relative z-10 mx-auto w-full max-w-[72rem] px-6 pt-32 sm:px-10 sm:pt-36 lg:px-16 ${
        compact ? "pb-10 sm:pb-12" : "pb-14 sm:pb-16"
      }`}
    >
      <p
        className="font-(family-name:--font-mono) text-cf-caption uppercase tracking-[0.28em]"
        style={{ color: "var(--cf-recall-ink-faint)" }}
      >
        {eyebrow}
      </p>
      <Heading
        className="mt-4 max-w-[18ch] font-(family-name:--font-display) text-[clamp(2.5rem,6vw,5rem)] font-bold leading-[0.98] tracking-[-0.045em] text-balance"
        style={{ color: "var(--cf-recall-ink)" }}
      >
        {title}
      </Heading>
      {description ? (
        <p
          className="mt-5 max-w-[58ch] text-cf-body-lg leading-[1.7]"
          style={{ color: "var(--cf-recall-ink-soft)" }}
        >
          {description}
        </p>
      ) : null}
    </header>
  );
}
