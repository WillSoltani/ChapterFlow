"use client";

import { SectionReveal } from "@/components/ui/SectionReveal";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { BookCover } from "@/components/ui/BookCover";
import { BOOKS_CATALOG } from "@/app/book/data/booksCatalog";
import { getBookCoverPath } from "@/lib/book-covers";
import { CATALOG_BOOK_COUNT_DISPLAY } from "@/lib/catalog-stats";

/**
 * The toolkit, as an editorial spec-sheet — NOT a glass bento (that pattern is the
 * cliché the owner flagged). Dense hairline rows: a mono line-number + label, a
 * one-line claim, and the REAL inline micro-visual. Flat on --cf-surface, no
 * backdrop-blur, so this band is texturally distinct from the glassy hero/engine.
 * The prove-to-unlock quiz is NOT here — it lives inside the signature now.
 */

/* ---- row visuals (de-glassed, compact for the right rail) ------------------ */

function DepthVisual() {
  const modes = [
    { label: "Lite", sub: "the gist" },
    { label: "Standard", sub: "the argument", active: true },
    { label: "Deeper", sub: "the full picture" },
  ];
  return (
    <div className="flex w-full flex-col gap-1.5">
      {modes.map((m) => (
        <div
          key={m.label}
          className="flex items-center justify-between rounded-lg border px-3 py-2"
          style={{
            background: m.active ? "color-mix(in srgb, var(--accent-cyan) 11%, transparent)" : "transparent",
            borderColor: m.active ? "var(--accent-cyan)" : "var(--border-default)",
          }}
        >
          <span className="text-[13px] font-semibold" style={{ color: m.active ? "var(--accent-cyan)" : "var(--text-secondary)" }}>
            {m.label}
          </span>
          <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>{m.sub}</span>
        </div>
      ))}
    </div>
  );
}

function ScheduleVisual() {
  const stops = ["Day 1", "Day 4", "Week 2", "Month 1"];
  return (
    <div className="flex w-full items-center">
      {stops.map((s, i) => (
        <div key={s} className="flex items-center" style={{ flex: i === stops.length - 1 ? "0 0 auto" : "1 1 0" }}>
          <div className="flex flex-col items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{
                background: "var(--accent-cyan)",
                boxShadow: "0 0 8px color-mix(in srgb, var(--accent-cyan) 50%, transparent)",
              }}
            />
            <span className="cf-folio whitespace-nowrap" style={{ color: "var(--text-tertiary)" }}>{s}</span>
          </div>
          {i < stops.length - 1 && (
            <span className="mx-1 mb-4 h-px flex-1" style={{ background: "var(--accent-cyan)", opacity: 0.4 }} />
          )}
        </div>
      ))}
    </div>
  );
}

function StreakVisual() {
  const days = [true, true, true, true, true, false, false];
  return (
    <div className="flex w-full flex-col gap-2.5">
      <div className="flex items-end gap-2">
        <span className="text-[32px] font-bold leading-none" style={{ fontFamily: "var(--font-display)", color: "var(--text-heading)" }}>12</span>
        <span className="pb-1 text-[12px]" style={{ color: "var(--text-secondary)" }}>day streak</span>
      </div>
      <div className="flex gap-1.5">
        {days.map((on, i) => (
          <span
            key={i}
            className="h-2.5 flex-1 rounded-full"
            style={{
              background: on ? "var(--accent-cyan)" : "var(--border-default)",
              boxShadow: on ? "0 0 8px color-mix(in srgb, var(--accent-cyan) 50%, transparent)" : "none",
            }}
          />
        ))}
      </div>
    </div>
  );
}

function LibraryVisual() {
  const books = BOOKS_CATALOG.slice(0, 5);
  return (
    <div className="flex w-full items-end justify-end gap-2.5">
      {books.map((b, i) => (
        <div
          key={b.id}
          className="w-[58px] shrink-0 overflow-hidden rounded-md"
          style={{ boxShadow: "var(--shadow-book)", transform: `translateY(${i % 2 === 0 ? 0 : 6}px)` }}
        >
          <BookCover
            bookId={b.id}
            title={b.title}
            icon={b.icon}
            coverImage={getBookCoverPath(b.id)}
            className="aspect-[3/4] w-full"
            sizes="58px"
            interactive={false}
          />
        </div>
      ))}
    </div>
  );
}

function AudioVisual() {
  const bars = [10, 18, 28, 16, 34, 22, 40, 26, 14, 30, 20, 36, 12, 24, 32, 18, 26, 14];
  return (
    <div className="flex w-full items-center justify-end gap-1">
      {bars.map((h, i) => (
        <span
          key={i}
          className="w-[5px] rounded-full"
          style={{ height: h, background: i < 8 ? "var(--accent-cyan)" : "var(--border-medium)", opacity: i < 8 ? 0.9 : 1 }}
        />
      ))}
    </div>
  );
}

/* ---- rows ------------------------------------------------------------------ */

type Row = { n: string; label: string; title: string; desc: string; visual: React.ReactNode };
const ROWS: Row[] = [
  {
    n: "01",
    label: "Depth",
    title: "Read at the depth you have time for.",
    desc: "The same chapter as the gist, the argument, or the full picture — switch any time without losing your place.",
    visual: <DepthVisual />,
  },
  {
    n: "02",
    label: "Spaced review",
    title: "Ideas come back right before you'd forget.",
    desc: "FSRS schedules each idea on a widening interval — Day 1, Day 4, Week 2, Month 1 — so review costs minutes, not hours.",
    visual: <ScheduleVisual />,
  },
  {
    n: "03",
    label: "Streak",
    title: "A daily habit, not a binge.",
    desc: "A few minutes a day beats a forgotten weekend marathon. The streak rewards consistency, the thing retention actually needs.",
    visual: <StreakVisual />,
  },
  {
    n: "04",
    label: "Library",
    title: `${CATALOG_BOOK_COUNT_DISPLAY} books, every one structured the same way.`,
    desc: "Bestselling non-fiction, broken into the same guided loop — so the method is identical no matter what you pick up.",
    visual: <LibraryVisual />,
  },
  {
    n: "05",
    label: "Narration",
    title: "Prefer to listen? Every chapter is narrated.",
    desc: "Commute, walk, cook — the loop comes with you. Audio and reading stay in sync across your devices.",
    visual: <AudioVisual />,
  },
];

export function Ledger() {
  return (
    <section id="features" className="relative">
      <div className="mx-auto max-w-[1180px] px-5 pt-(--section-pad-sm) pb-(--section-pad-lg) md:px-8 md:pt-(--section-pad-md)">
        <SectionReveal>
          <div className="max-w-2xl">
            <SectionLabel>IN SERVICE OF MEMORY</SectionLabel>
            <h2
              className="mt-4 font-bold leading-[1.05] text-balance"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(2rem, 4vw, 3.1rem)",
                letterSpacing: "-0.03em",
                color: "var(--text-heading)",
              }}
            >
              Everything else is in service of remembering it.
            </h2>
            <p className="mt-4 max-w-xl text-[16px] leading-[1.6]" style={{ color: "var(--text-secondary)" }}>
              No highlight graveyard, no features for their own sake. Five things,
              each earning its place in the loop.
            </p>
          </div>
        </SectionReveal>

        {/* the spec-sheet */}
        <SectionReveal delay={0.08}>
          <div
            className="mt-12 overflow-hidden rounded-2xl border"
            style={{ borderColor: "var(--border-subtle)", background: "var(--cf-surface)" }}
          >
            {ROWS.map((row, i) => (
              <div
                key={row.n}
                className="cf-ledger-row grid items-center gap-6 px-6 py-7 md:grid-cols-[7.5rem_1fr_15rem] md:px-9 md:py-8"
                style={{ borderTop: i === 0 ? "none" : "1px solid var(--border-subtle)" }}
              >
                {/* line number + label */}
                <div className="flex items-baseline gap-3 md:flex-col md:items-start md:gap-1.5">
                  <span className="cf-folio" style={{ color: "var(--accent-cyan)" }}>{row.n}</span>
                  <span
                    className="text-[11px] font-semibold uppercase"
                    style={{ letterSpacing: "0.14em", color: "var(--text-tertiary)" }}
                  >
                    {row.label}
                  </span>
                </div>

                {/* claim */}
                <div>
                  <h3
                    className="text-[18px] font-bold leading-snug md:text-[20px]"
                    style={{ fontFamily: "var(--font-display)", color: "var(--text-heading)", letterSpacing: "-0.01em" }}
                  >
                    {row.title}
                  </h3>
                  <p className="mt-1.5 max-w-[52ch] text-[13.5px] leading-[1.55]" style={{ color: "var(--text-secondary)" }}>
                    {row.desc}
                  </p>
                </div>

                {/* the real visual */}
                <div className="flex items-center md:justify-end">{row.visual}</div>
              </div>
            ))}
          </div>
        </SectionReveal>
      </div>
    </section>
  );
}
