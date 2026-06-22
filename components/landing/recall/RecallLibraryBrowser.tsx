"use client";

/**
 * RecallLibraryBrowser — the full-screen "browse the whole library" overlay.
 *
 * Opened from the library section's "Browse all books" button. Reuses the app's
 * accessible Dialog (focus trap, Escape, scroll-lock, portal, focus restore),
 * skinned to the RECALL canvas via `rl-browse-panel`. Shows ALL real books from
 * the static client catalog (no AWS): a search box (title/author), canonical
 * category chips, and a responsive cover grid. Click a cover → an in-overlay
 * detail view (synopsis + start CTA). An empty search surfaces a prefilled
 * "request this book" dialog, nested above this overlay via the Dialog stack.
 *
 * Token-only color, ONE periwinkle accent, covers as the focal grid. Covers are
 * committed local rasters via getBookCoverPath; the handful without a file fall
 * back to a typographic plate (never the catalog emoji — RECALL restraint).
 */

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Search, X, ArrowLeft, ArrowRight, ArrowUpRight } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import {
  BOOKS_CATALOG_METADATA,
  type BookCatalogMetadata,
} from "@/app/book/data/booksCatalog";
import { useBookCoverSource } from "@/lib/use-book-cover-source";
import { canonicalizeCategory } from "@/lib/category-taxonomy";
import { CATALOG_BOOK_COUNT_DISPLAY } from "@/lib/catalog-stats";
import { AUTH_LOGIN_BOOK_URL } from "@/app/_lib/chapterflow-brand";
import { filterBooks, deriveCategories } from "./book-filter";
import { RecallBookRequestDialog } from "./RecallBookRequestDialog";

const ALL = "All";

type RecallLibraryBrowserProps = {
  open: boolean;
  onClose: () => void;
};

export function RecallLibraryBrowser({ open, onClose }: RecallLibraryBrowserProps) {
  const titleId = useId();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>(ALL);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestPrefill, setRequestPrefill] = useState("");

  const categories = useMemo(
    () => [ALL, ...deriveCategories(BOOKS_CATALOG_METADATA)],
    [],
  );
  const filtered = useMemo(
    () => filterBooks(BOOKS_CATALOG_METADATA, query, category === ALL ? null : category),
    [query, category],
  );

  const selected = selectedId
    ? BOOKS_CATALOG_METADATA.find((b) => b.id === selectedId) ?? null
    : null;

  const searchRef = useRef<HTMLInputElement>(null);

  // Reset transient state whenever the overlay closes, so the next open is a
  // fresh grid (the instance stays mounted between opens for the exit animation,
  // so without this the old search/category/detail view would persist).
  useEffect(() => {
    if (!open) {
      setQuery("");
      setCategory(ALL);
      setSelectedId(null);
      setRequestOpen(false);
      setRequestPrefill("");
    }
  }, [open]);

  // Return to the grid from the detail view, keeping focus in the overlay (the
  // detail's Back button is about to unmount, which would otherwise drop focus
  // to <body> — WCAG 2.4.3).
  const backToGrid = useCallback(() => {
    setSelectedId(null);
    requestAnimationFrame(() => searchRef.current?.focus());
  }, []);

  // In the detail view, Escape should go BACK to the grid, not close the whole
  // library. Intercept in the capture phase so it beats the Dialog's
  // document-level (bubble) Escape→onClose. Skip while the nested request dialog
  // is open (it owns Escape then).
  useEffect(() => {
    if (!selectedId || requestOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        e.preventDefault();
        backToGrid();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [selectedId, requestOpen, backToGrid]);

  function openRequest(prefill: string) {
    setRequestPrefill(prefill);
    setRequestOpen(true);
  }

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        labelledBy={titleId}
        size="fullscreen"
        // landing-dark re-declares the recall design token scope on the panel
        // itself: Dialog portals to <body>, outside the page's .landing-dark
        // wrapper, so without this the tokens wouldn't resolve in the overlay.
        className="rl-browse-panel landing-dark"
      >
        {/* ── Sticky header: title + close, then search + category chips ── */}
        <header className="rl-browse-header">
          <div className="mx-auto flex w-full max-w-[78rem] flex-col gap-5 px-6 py-5 sm:px-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p
                  className="font-(family-name:--font-mono) text-[11px] uppercase tracking-[0.3em]"
                  style={{ color: "var(--cf-recall-ink-faint)" }}
                >
                  The library
                </p>
                <h2
                  id={titleId}
                  className="mt-1.5 font-(family-name:--font-display) text-[1.5rem] font-bold leading-tight tracking-[-0.02em] sm:text-[1.875rem]"
                  style={{ color: "var(--cf-recall-ink)" }}
                >
                  {CATALOG_BOOK_COUNT_DISPLAY} books, all real
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close library"
                className="-mr-1 grid h-12 w-12 shrink-0 place-items-center rounded-full transition-colors duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                style={{
                  color: "var(--cf-recall-ink-soft)",
                  border: "1px solid var(--cf-recall-border-strong)",
                  // @ts-expect-error -- CSS custom property for the focus ring color
                  "--tw-ring-color": "var(--cf-recall-accent-line)",
                }}
              >
                <X size={20} strokeWidth={2} aria-hidden />
              </button>
            </div>

            {/* search */}
            <div className="relative">
              <Search
                size={17}
                strokeWidth={2}
                aria-hidden
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2"
                style={{ color: "var(--cf-recall-ink-faint)" }}
              />
              <label htmlFor={`${titleId}-search`} className="sr-only">
                Search the library by title or author
              </label>
              <input
                id={`${titleId}-search`}
                ref={searchRef}
                type="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelectedId(null);
                }}
                placeholder="Search by title or author…"
                autoComplete="off"
                className="rl-input"
                // Inline so it reliably beats .rl-input's padding shorthand
                // (the search icon sits in this left gutter).
                style={{ paddingLeft: "2.75rem" }}
              />
            </div>

            {/* category chips */}
            <div
              className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
              role="group"
              aria-label="Filter by category"
            >
              {categories.map((cat) => {
                const active = cat === category;
                return (
                  <button
                    key={cat}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      setCategory(cat);
                      setSelectedId(null);
                    }}
                    className={`rl-filter-chip ${active ? "rl-filter-chip-active" : ""}`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>
        </header>

        {/* live count for screen readers */}
        <p aria-live="polite" className="sr-only">
          {filtered.length} books shown
        </p>

        {/* ── Body: detail view, grid, or empty state ── */}
        <div className="mx-auto w-full max-w-[78rem] px-6 pb-16 pt-6 sm:px-8">
          {selected ? (
            <BookDetail book={selected} onBack={backToGrid} />
          ) : filtered.length === 0 ? (
            <EmptyState query={query} onRequest={() => openRequest(query.trim())} />
          ) : (
            <ul className="rl-browse-grid">
              {filtered.map((book) => (
                <li key={book.id}>
                  <BookCard book={book} onSelect={() => setSelectedId(book.id)} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </Dialog>

      {/* Nested request dialog (prefilled from the empty state). */}
      <RecallBookRequestDialog
        open={requestOpen}
        onClose={() => setRequestOpen(false)}
        initialTitle={requestPrefill}
      />
    </>
  );
}

/* ── A single grid card: cover + title + author, the whole card a button. ───── */
function BookCard({
  book,
  onSelect,
}: {
  book: BookCatalogMetadata;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={`${book.title} by ${book.author} — view details`}
      className="rl-book-card group block w-full text-left focus-visible:outline-none"
    >
      <div className="rl-book-cover relative aspect-[2/3] w-full overflow-hidden rounded-[10px]">
        <BrowseCover book={book} />
      </div>
      <p
        className="mt-3 line-clamp-2 text-[0.875rem] font-semibold leading-snug"
        style={{ color: "var(--cf-recall-ink)" }}
      >
        {book.title}
      </p>
      <p
        className="mt-0.5 line-clamp-1 text-[0.8125rem]"
        style={{ color: "var(--cf-recall-ink-faint)" }}
      >
        {book.author}
      </p>
    </button>
  );
}

/* ── Cover image with a typographic fallback for the few ids without a file. ──
   Uses the shared resolver (lib/use-book-cover-source) so it walks the full
   AVIF-first → WebP → … candidate chain (smaller transfer, recovers covers that
   exist only as AVIF/under an alias) and only shows the text plate once EVERY
   candidate is exhausted. ── */
function BrowseCover({ book }: { book: BookCatalogMetadata }) {
  const { src, exhausted, onError, loader } = useBookCoverSource(
    book.id,
    book.coverImage,
  );
  if (exhausted || !src) {
    return (
      <div className="rl-cover-fallback">
        <span
          className="font-(family-name:--font-display) text-[0.9375rem] font-bold leading-tight"
          style={{ color: "var(--cf-recall-ink)" }}
        >
          {book.title}
        </span>
        <span className="mt-1.5 text-[0.75rem]" style={{ color: "var(--cf-recall-ink-faint)" }}>
          {book.author}
        </span>
      </div>
    );
  }
  return (
    <Image
      src={src}
      loader={loader}
      alt={`${book.title} by ${book.author}`}
      fill
      sizes="(max-width: 640px) 44vw, (max-width: 1024px) 22vw, 14vw"
      className="object-cover"
      draggable={false}
      onError={onError}
    />
  );
}

/* ── In-overlay detail view for the focused book. ───────────────────────────── */
function BookDetail({
  book,
  onBack,
}: {
  book: BookCatalogMetadata;
  onBack: () => void;
}) {
  // Move focus to the Back control when the detail view opens, so a keyboard /
  // screen-reader user lands inside the new view instead of losing focus to
  // <body> when the grid (and the activating card) unmounts (WCAG 2.4.3).
  const backRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    backRef.current?.focus();
  }, []);

  const meta = [
    canonicalizeCategory(book.category),
    `${book.chapterCount} chapters`,
    `${book.estimatedMinutes} min`,
    book.difficulty,
  ].filter(Boolean);

  return (
    <div className="cf-fade-up">
      <button
        ref={backRef}
        type="button"
        onClick={onBack}
        className="-ml-2 inline-flex min-h-[44px] items-center gap-1.5 rounded px-2 text-[0.875rem] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        style={{
          color: "var(--cf-recall-ink-soft)",
          // @ts-expect-error -- CSS custom property for the focus ring color
          "--tw-ring-color": "var(--cf-recall-accent-line)",
        }}
      >
        <ArrowLeft size={16} strokeWidth={2} aria-hidden />
        Back to all books
      </button>

      <div className="mt-7 grid grid-cols-1 gap-8 sm:grid-cols-[minmax(0,200px)_1fr] sm:gap-10">
        <div
          className="rl-book-cover relative mx-auto aspect-[2/3] w-[42vw] max-w-[170px] overflow-hidden rounded-[12px] sm:mx-0 sm:w-full sm:max-w-none"
          style={{ border: "1px solid var(--cf-recall-frame)" }}
        >
          <BrowseCover book={book} />
        </div>

        <div>
          <h3
            className="font-(family-name:--font-display) text-[1.75rem] font-bold leading-tight tracking-[-0.02em] sm:text-[2.25rem]"
            style={{ color: "var(--cf-recall-ink)" }}
          >
            {book.title}
          </h3>
          <p className="mt-2 text-[1rem]" style={{ color: "var(--cf-recall-ink-soft)" }}>
            {book.author}
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            {meta.map((m) => (
              <span
                key={m}
                className="rounded-full px-3 py-1 font-(family-name:--font-mono) text-[10px] uppercase tracking-[0.16em]"
                style={{
                  color: "var(--cf-recall-ink-faint)",
                  border: "1px solid var(--cf-recall-border-strong)",
                }}
              >
                {m}
              </span>
            ))}
          </div>

          {book.synopsis ? (
            <p
              className="mt-6 max-w-[52ch] text-[0.9375rem] leading-relaxed sm:text-[1rem]"
              style={{ color: "var(--cf-recall-ink-soft)" }}
            >
              {book.synopsis}
            </p>
          ) : null}

          <a
            href={AUTH_LOGIN_BOOK_URL}
            className="rl-cta-accent mt-8 inline-flex items-center justify-center gap-2 rounded-full px-7 py-3.5 text-[0.9375rem] font-semibold transition-[transform,filter] duration-150 ease-out hover:brightness-105 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          >
            Start reading free
            <ArrowRight size={17} strokeWidth={2.25} aria-hidden />
          </a>
        </div>
      </div>
    </div>
  );
}

/* ── Empty search: offer to request the missing book (prefilled). ───────────── */
function EmptyState({ query, onRequest }: { query: string; onRequest: () => void }) {
  const q = query.trim();
  return (
    <div className="mx-auto max-w-[40rem] py-16 text-center sm:py-24">
      <p
        className="font-(family-name:--font-display) text-[1.375rem] font-bold tracking-[-0.02em] sm:text-[1.625rem]"
        style={{ color: "var(--cf-recall-ink)" }}
      >
        {q ? <>No match for “{q}”.</> : <>Nothing here yet.</>}
      </p>
      <p
        className="mx-auto mt-3 max-w-[34ch] text-[0.9375rem] leading-relaxed"
        style={{ color: "var(--cf-recall-ink-soft)" }}
      >
        We add new titles all the time. Tell us what you’re after and we’ll email
        you if it joins the library.
      </p>
      <button
        type="button"
        onClick={onRequest}
        className="rl-cta-accent mt-7 inline-flex items-center justify-center gap-2 rounded-full px-7 py-3.5 text-[0.9375rem] font-semibold transition-[transform,filter] duration-150 ease-out hover:brightness-105 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
      >
        {q ? <>Request “{q}”</> : <>Request a book</>}
        <ArrowUpRight size={17} strokeWidth={2.25} aria-hidden />
      </button>
    </div>
  );
}
