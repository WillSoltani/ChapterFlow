"use client";

import { SectionReveal } from "@/components/ui/SectionReveal";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { BookCover } from "@/components/ui/BookCover";
import { BOOKS_CATALOG } from "@/app/book/data/booksCatalog";
import { getBookCoverPath } from "@/lib/book-covers";
import { CATALOG_BOOK_COUNT_DISPLAY } from "@/lib/catalog-stats";

/**
 * §04 Library — the catalog index.
 *
 * The catalog as the index page of the manual, NOT a count-up stats bar. Every
 * title is "structured the same way" — that sameness IS the point — so the
 * library reads as a calibrated index: a hairline-ruled grid of REAL covers,
 * each stamped with a tabular mono call-number (CF-001 … CF-NNN) and an
 * uppercased mono category tag, with the catalog size stated ONCE as a derived
 * datum (CATALOG_BOOK_COUNT_DISPLAY) — never animated, never hardcoded.
 *
 * Flat on --cf-surface with one panel hairline + grain (depth from rules, not
 * glass). Hover is border/opacity only — no scale that shifts layout — and the
 * covers are dimension-pinned (aspect-[3/4] + sizes) so CLS stays 0.
 */

// A deterministic editorial slice of the live catalog (the first N, in catalog
// order) — the index is a representative sample, the size is the datum below it.
// 12 covers seat cleanly across 2/3/4/6 columns at every breakpoint.
const INDEX_BOOKS = BOOKS_CATALOG.slice(0, 12);

// Tabular call-number, zero-padded to the catalog's magnitude (CF-001…).
function callNumber(index: number): string {
  return `CF-${String(index + 1).padStart(3, "0")}`;
}

export function CatalogIndex() {
  return (
    <section id="library" className="relative">
      <div className="mx-auto max-w-[1180px] px-5 pt-(--section-pad-sm) pb-(--section-pad-lg) md:px-8 md:pt-(--section-pad-md)">
        <SectionReveal>
          <div className="max-w-2xl">
            <SectionLabel>§04 · LIBRARY</SectionLabel>
            <h2
              className="mt-4 font-bold leading-[1.05] text-balance"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(2rem, 4vw, 3.1rem)",
                letterSpacing: "-0.03em",
                color: "var(--text-heading)",
              }}
            >
              One index. Every book, structured the same way.
            </h2>
            <p className="mt-4 max-w-xl text-[16px] leading-[1.6]" style={{ color: "var(--text-secondary)" }}>
              Pick any title and the loop is identical — the same method you just
              operated above, on every book. Learn it once; it carries across the
              whole shelf.
            </p>
          </div>
        </SectionReveal>

        {/* the index panel */}
        <SectionReveal delay={0.08}>
          <div
            className="cf-catalog-panel relative mt-12 overflow-hidden rounded-2xl border"
            style={{ borderColor: "var(--border-subtle)", background: "var(--cf-surface)" }}
          >
            {/* running head: the size stated ONCE as a datum (not a count-up) */}
            <div
              className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 px-6 py-5 md:px-9"
              style={{ borderBottom: "1px solid var(--border-subtle)" }}
            >
              <span
                className="cf-folio"
                style={{ color: "var(--cf-axis-tint)" }}
              >
                Catalog index · CF-001 onward
              </span>
              <span className="cf-folio tabular-nums" style={{ color: "var(--text-tertiary)" }}>
                <span style={{ color: "var(--text-heading)" }}>{CATALOG_BOOK_COUNT_DISPLAY}</span> titles in print
              </span>
            </div>

            {/* the grid — real covers, tabular call-numbers, mono category tags */}
            <ul
              className="grid grid-cols-2 gap-px sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6"
              style={{ background: "var(--border-subtle)" }}
            >
              {INDEX_BOOKS.map((book, i) => (
                <li
                  key={book.id}
                  className="cf-catalog-cell group flex flex-col gap-3 p-4 md:p-5"
                  style={{ background: "var(--cf-surface)" }}
                >
                  <div
                    className="relative aspect-[3/4] w-full overflow-hidden rounded-md border transition-colors duration-200 ease-out"
                    style={{ borderColor: "var(--border-subtle)" }}
                  >
                    <BookCover
                      bookId={book.id}
                      title={book.title}
                      icon={book.icon}
                      coverImage={getBookCoverPath(book.id)}
                      fill
                      sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, (max-width: 1280px) 22vw, 180px"
                      interactive={false}
                    />
                  </div>

                  <div className="flex items-baseline justify-between gap-2">
                    <span className="cf-folio tabular-nums" style={{ color: "var(--accent-cyan)" }}>
                      {callNumber(i)}
                    </span>
                    <span
                      className="cf-folio truncate text-right"
                      style={{ color: "var(--cf-axis-tint)" }}
                    >
                      {book.category}
                    </span>
                  </div>

                  <p
                    className="line-clamp-2 text-[13.5px] font-semibold leading-snug"
                    style={{ fontFamily: "var(--font-display)", color: "var(--text-heading)", letterSpacing: "-0.01em" }}
                  >
                    {book.title}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </SectionReveal>
      </div>
    </section>
  );
}
