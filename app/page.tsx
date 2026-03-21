import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Layers,
  Minus,
  Orbit,
  Sparkles,
  Target,
  Trophy,
} from "lucide-react";
import {
  CHAPTERFLOW_NAME,
  getChapterFlowSiteUrl,
} from "@/app/_lib/chapterflow-brand";
import {
  BOOKS_CATALOG,
  getBookById,
  type BookCatalogItem,
} from "@/app/book/data/booksCatalog";
import { BookCover } from "@/app/book/components/BookCover";
import { ChapterFlowMark } from "@/app/book/components/ChapterFlowMark";
import { ThemeModeToggle } from "@/components/ThemeModeToggle";

const START_FREE_HREF = "/auth/login?returnTo=%2Fbook";
const SIGN_IN_HREF = "/auth/login?returnTo=%2Fbook";

const FEATURED_BOOK_IDS = [
  "atomic-habits",
  "deep-work",
  "thinking-fast-and-slow",
] as const;

const LIBRARY_PREVIEW_IDS = [
  "atomic-habits",
  "deep-work",
  "thinking-fast-and-slow",
  "the-power-of-habit",
  "mindset",
  "essentialism",
] as const;

export const metadata: Metadata = {
  title: `${CHAPTERFLOW_NAME} | Guided reading that turns ideas into action`,
  description:
    "Read chapter summaries, apply ideas through practical scenarios, reinforce them with quizzes, and keep your learning habit moving in one calm reading workspace.",
  metadataBase: new URL(getChapterFlowSiteUrl()),
  openGraph: {
    title: `${CHAPTERFLOW_NAME} | Guided reading that turns ideas into action`,
    description:
      "A practical reading app built around chapter summaries, real-world scenarios, quizzes, progress, badges, and rewards.",
    url: getChapterFlowSiteUrl(),
    siteName: CHAPTERFLOW_NAME,
    type: "website",
  },
};

function getFeaturedBooks(): BookCatalogItem[] {
  const selected = FEATURED_BOOK_IDS.map((id) => getBookById(id)).filter(
    (b): b is BookCatalogItem => Boolean(b)
  );
  if (selected.length >= 3) return selected;
  const seen = new Set(selected.map((b) => b.id));
  for (const book of BOOKS_CATALOG) {
    if (seen.has(book.id)) continue;
    selected.push(book);
    if (selected.length === 3) break;
  }
  return selected;
}

function getLibraryPreviewBooks(): BookCatalogItem[] {
  const selected = LIBRARY_PREVIEW_IDS.map((id) => getBookById(id)).filter(
    (b): b is BookCatalogItem => Boolean(b)
  );
  const seen = new Set(selected.map((b) => b.id));
  for (const book of BOOKS_CATALOG) {
    if (seen.has(book.id)) continue;
    selected.push(book);
    seen.add(book.id);
    if (selected.length >= 6) break;
  }
  return selected.slice(0, 6);
}

function SiteLinkButton({
  href,
  children,
  variant = "primary",
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost";
}) {
  const cls =
    variant === "primary"
      ? "border-(--cf-accent) bg-(--cf-accent) text-white shadow-[0_16px_32px_var(--cf-accent-shadow)] hover:bg-(--cf-accent-strong) hover:border-(--cf-accent-strong)"
      : variant === "secondary"
        ? "border-(--cf-border) bg-(--cf-surface) text-(--cf-text-1) hover:border-(--cf-border-strong) hover:bg-(--cf-surface-muted)"
        : "border-transparent bg-transparent text-(--cf-text-2) hover:bg-(--cf-surface-muted) hover:text-(--cf-text-1)";

  return (
    <Link
      href={href}
      className={[
        "inline-flex items-center justify-center gap-2 rounded-full border px-5 py-3 text-sm font-semibold transition duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--cf-accent-border)",
        "motion-safe:hover:-translate-y-0.5",
        cls,
      ].join(" ")}
    >
      {children}
    </Link>
  );
}

function LandingNav() {
  return (
    <header className="sticky top-0 z-30 border-b border-(--cf-divider) bg-[color:rgba(247,244,238,0.88)] backdrop-blur-xl dark:bg-[color:rgba(18,17,15,0.88)]">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
        <Link
          href="/"
          className="inline-flex shrink-0 rounded-[18px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--cf-accent-border)"
          aria-label="Go to ChapterFlow home"
        >
          <ChapterFlowMark compact />
        </Link>

        <nav className="hidden items-center gap-7 lg:flex" aria-label="Main navigation">
          <a
            href="#how-it-works"
            className="text-sm font-medium text-(--cf-text-2) transition hover:text-(--cf-text-1)"
          >
            How it works
          </a>
          <a
            href="#library"
            className="text-sm font-medium text-(--cf-text-2) transition hover:text-(--cf-text-1)"
          >
            Library
          </a>
          <a
            href="#pricing"
            className="text-sm font-medium text-(--cf-text-2) transition hover:text-(--cf-text-1)"
          >
            Pricing
          </a>
        </nav>

        <div className="flex items-center gap-2">
          <ThemeModeToggle className="h-10" />
          <Link
            href={SIGN_IN_HREF}
            className="hidden text-sm font-medium text-(--cf-text-2) transition hover:text-(--cf-text-1) sm:inline-flex"
          >
            Sign in
          </Link>
          <SiteLinkButton href={START_FREE_HREF}>
            Start free
            <ArrowRight className="h-4 w-4" />
          </SiteLinkButton>
        </div>
      </div>
    </header>
  );
}

function HeroPreview({ books }: { books: BookCatalogItem[] }) {
  const [primary, secondary, tertiary] = books;

  return (
    <div
      aria-hidden="true"
      className="relative mx-auto max-w-[44rem] px-2 lg:px-0"
    >
      {/* Soft ambient glows behind the card */}
      <div className="pointer-events-none absolute -left-8 top-12 h-48 w-48 rounded-full bg-(--cf-accent-soft) opacity-70 blur-3xl" />
      <div className="pointer-events-none absolute -right-6 bottom-8 h-40 w-40 rounded-full bg-(--cf-warning-soft) opacity-80 blur-3xl" />

      {/* Main card */}
      <div className="relative rounded-[36px] border border-(--cf-border) bg-[linear-gradient(180deg,var(--cf-surface),var(--cf-surface-muted))] p-4 shadow-[var(--cf-shadow-lg)] sm:p-5">
        {/* Session header */}
        <div className="flex items-center justify-between rounded-[22px] border border-(--cf-divider) bg-(--cf-page-bg) px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-(--cf-accent-border) bg-(--cf-accent-soft)">
              <Orbit className="h-5 w-5 text-(--cf-accent)" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-(--cf-text-3)">
                Reading Session
              </p>
              <p className="text-sm font-medium text-(--cf-text-1)">
                One chapter, one clear learning loop
              </p>
            </div>
          </div>
          <span className="rounded-full border border-(--cf-accent-border) bg-(--cf-accent-soft) px-3 py-1 text-xs font-semibold text-(--cf-accent)">
            Standard depth
          </span>
        </div>

        {/* Content grid */}
        <div className="mt-4 grid gap-4 xl:grid-cols-[200px_minmax(0,1fr)]">
          {/* Library sidebar */}
          <div className="rounded-[26px] border border-(--cf-border) bg-(--cf-surface) p-4 shadow-[var(--cf-shadow-sm)]">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-(--cf-text-3)">
                Library
              </p>
              <span className="rounded-full bg-(--cf-surface-muted) px-2.5 py-1 text-[11px] font-semibold text-(--cf-text-2)">
                95 books live
              </span>
            </div>
            <div className="mt-4 space-y-2.5">
              {[primary, secondary, tertiary].filter(Boolean).map((book) => (
                <div
                  key={book.id}
                  className="flex items-center gap-3 rounded-2xl border border-(--cf-divider) bg-(--cf-page-bg) p-2.5"
                >
                  <BookCover
                    bookId={book.id}
                    title={book.title}
                    icon={book.icon}
                    coverImage={book.coverImage}
                    className="h-14 w-10 shrink-0 rounded-xl border border-(--cf-border) bg-(--cf-surface)"
                    sizes="40px"
                    interactive={false}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-(--cf-text-1)">
                      {book.title}
                    </p>
                    <p className="mt-0.5 text-xs text-(--cf-text-3)">{book.category}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Main reading area */}
          <div className="space-y-3">
            {primary ? (
              <div className="rounded-[26px] border border-(--cf-border) bg-(--cf-surface) p-5 shadow-[var(--cf-shadow-sm)]">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <BookCover
                      bookId={primary.id}
                      title={primary.title}
                      icon={primary.icon}
                      coverImage={primary.coverImage}
                      className="h-[72px] w-12 shrink-0 rounded-2xl border border-(--cf-border) bg-(--cf-page-bg)"
                      sizes="48px"
                      interactive={false}
                    />
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-(--cf-text-3)">
                        Now reading
                      </p>
                      <p className="mt-1 text-base font-semibold text-(--cf-text-1)">
                        {primary.title}
                      </p>
                      <p className="text-sm text-(--cf-text-3)">Chapter 3 · main point first</p>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-(--cf-border) bg-(--cf-page-bg) px-3 py-2 text-right">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-(--cf-text-3)">
                      Progress
                    </p>
                    <p className="mt-1 text-lg font-semibold text-(--cf-accent)">72%</p>
                  </div>
                </div>

                {/* Chapter steps */}
                <div className="mt-4 space-y-2">
                  <div className="rounded-xl border border-(--cf-divider) bg-(--cf-page-bg) p-3.5">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-(--cf-text-3)">
                      Summary
                    </p>
                    <p className="mt-1.5 text-sm leading-6 text-(--cf-text-2)">
                      The chapter idea, broken down clearly before you decide how deep to go.
                    </p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="rounded-xl border border-(--cf-divider) bg-(--cf-page-bg) p-3.5">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-(--cf-text-3)">
                        Scenario
                      </p>
                      <p className="mt-1.5 text-sm leading-5 text-(--cf-text-2)">
                        The idea in a real-world decision you can actually use.
                      </p>
                    </div>
                    <div className="rounded-xl border border-(--cf-divider) bg-(--cf-page-bg) p-3.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-(--cf-text-3)">
                          Quiz
                        </p>
                        <span className="rounded-full border border-(--cf-success-border) bg-(--cf-success-soft) px-2 py-0.5 text-[11px] font-semibold text-(--cf-success-text)">
                          8/10 ✓
                        </span>
                      </div>
                      <p className="mt-1.5 text-sm leading-5 text-(--cf-text-2)">
                        Pass to unlock the next chapter.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* Floating Today panel — xl only */}
        <div className="pointer-events-none absolute -left-6 top-20 hidden w-44 rounded-[22px] border border-(--cf-border) bg-(--cf-surface) p-4 shadow-[var(--cf-shadow-md)] xl:block">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-(--cf-text-3)">
            Today
          </p>
          <div className="mt-3 space-y-2">
            {[
              "Read one chapter summary",
              "Finish a scenario set",
              "Pass the quiz",
            ].map((item) => (
              <div key={item} className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-(--cf-success-text)" />
                <p className="text-xs leading-5 text-(--cf-text-2)">{item}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Floating Momentum panel — xl only */}
        <div className="pointer-events-none absolute -bottom-5 right-2 hidden w-52 rounded-[22px] border border-(--cf-border) bg-(--cf-surface) p-4 shadow-[var(--cf-shadow-md)] xl:block">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-(--cf-text-3)">
                Momentum
              </p>
              <p className="mt-1 text-base font-semibold text-(--cf-text-1)">7-day streak</p>
            </div>
            <div className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-(--cf-warning-border) bg-(--cf-warning-soft)">
              <Trophy className="h-4 w-4 text-(--cf-warning-text)" />
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-(--cf-divider) bg-(--cf-page-bg) p-2.5">
              <p className="text-xs text-(--cf-text-3)">Badges</p>
              <p className="mt-1 text-sm font-semibold text-(--cf-text-1)">3 earned</p>
            </div>
            <div className="rounded-xl border border-(--cf-divider) bg-(--cf-page-bg) p-2.5">
              <p className="text-xs text-(--cf-text-3)">Flow Points</p>
              <p className="mt-1 text-sm font-semibold text-(--cf-text-1)">420</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HeroSection({ books }: { books: BookCatalogItem[] }) {
  return (
    <section
      className="relative overflow-hidden pb-20 pt-14 sm:pb-28 sm:pt-20"
      aria-labelledby="hero-heading"
    >
      <div className="mx-auto grid max-w-7xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
        {/* Left: copy */}
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-(--cf-accent-border) bg-(--cf-accent-soft) px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-(--cf-accent)">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            Guided reading
          </p>

          <h1
            id="hero-heading"
            className="mt-6 max-w-xl text-5xl font-semibold tracking-tight text-(--cf-text-1) sm:text-6xl lg:text-[4rem] lg:leading-[1.08]"
          >
            Understand books well enough to actually use them.
          </h1>

          <p className="mt-6 max-w-lg text-lg leading-8 text-(--cf-text-2)">
            ChapterFlow structures every chapter into a short learning loop: read the main
            point, see it in a real situation, then take a quick quiz to make sure it stuck.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <SiteLinkButton href={START_FREE_HREF}>
              Start reading free
              <ArrowRight className="h-4 w-4" />
            </SiteLinkButton>
            <SiteLinkButton href="#how-it-works" variant="secondary">
              See how it works
            </SiteLinkButton>
          </div>

          {/* Minimal trust line */}
          <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2">
            {["200+ books", "Free to start", "No credit card needed"].map((t) => (
              <span
                key={t}
                className="flex items-center gap-1.5 text-sm text-(--cf-text-3)"
              >
                <CheckCircle2 className="h-4 w-4 shrink-0 text-(--cf-success-text)" aria-hidden />
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* Right: product preview */}
        <HeroPreview books={books} />
      </div>
    </section>
  );
}

const HOW_IT_WORKS_STEPS = [
  {
    number: "01",
    icon: Layers,
    label: "Understand",
    title: "Read the main point at your depth",
    description:
      "Every chapter opens with a structured summary. Choose Simple for the core idea, Standard for the full breakdown, or Deeper for extended analysis — then move on with clarity.",
  },
  {
    number: "02",
    icon: Target,
    label: "Apply",
    title: "See the idea in a real situation",
    description:
      "Scenario examples translate abstract concepts into practical decisions. Work context, school context, or personal — so the lesson feels usable, not just understood in theory.",
  },
  {
    number: "03",
    icon: BookOpen,
    label: "Retain",
    title: "Prove it stuck before moving on",
    description:
      "Five scenario-based questions before the next chapter unlocks. Active recall — not passive re-reading — is what makes knowledge retrievable later.",
  },
] as const;

function HowItWorksSection() {
  return (
    <section
      id="how-it-works"
      className="border-t border-(--cf-divider) py-20 sm:py-28"
      aria-labelledby="how-it-works-heading"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {/* Section header */}
        <div className="max-w-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--cf-accent)">
            How it works
          </p>
          <h2
            id="how-it-works-heading"
            className="mt-3 text-3xl font-semibold tracking-tight text-(--cf-text-1) sm:text-4xl"
          >
            One chapter. Three steps. Real understanding.
          </h2>
          <p className="mt-4 text-base leading-7 text-(--cf-text-2) sm:text-lg">
            ChapterFlow is not a summary app. It is a structured reading loop designed to
            turn passive reading into something you can actually recall and apply.
          </p>
        </div>

        {/* Step cards */}
        <div className="mt-12 grid gap-4 sm:grid-cols-3">
          {HOW_IT_WORKS_STEPS.map((step) => {
            const Icon = step.icon;
            return (
              <article
                key={step.number}
                className="rounded-[28px] border border-(--cf-border) bg-(--cf-surface) p-6 shadow-[var(--cf-shadow-sm)] transition duration-200 motion-safe:hover:-translate-y-1 motion-safe:hover:shadow-[var(--cf-shadow-md)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-(--cf-accent-border) bg-(--cf-accent-soft)">
                    <Icon className="h-5 w-5 text-(--cf-accent)" aria-hidden />
                  </div>
                  <span className="text-2xl font-semibold tracking-tight text-(--cf-text-soft)">
                    {step.number}
                  </span>
                </div>
                <p className="mt-5 text-xs font-semibold uppercase tracking-[0.2em] text-(--cf-accent)">
                  {step.label}
                </p>
                <h3 className="mt-2 text-xl font-semibold tracking-tight text-(--cf-text-1)">
                  {step.title}
                </h3>
                <p className="mt-3 text-sm leading-7 text-(--cf-text-2)">
                  {step.description}
                </p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function BookShowcaseSection({ books }: { books: BookCatalogItem[] }) {
  const totalBooks = BOOKS_CATALOG.length;
  const totalTopics = new Set(
    BOOKS_CATALOG.flatMap((b) => b.categories.map((c) => c.toLowerCase()))
  ).size;

  return (
    <section
      id="library"
      className="border-t border-(--cf-divider) py-20 sm:py-28"
      aria-labelledby="library-heading"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-8">
          <div className="max-w-xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--cf-accent)">
              The library
            </p>
            <h2
              id="library-heading"
              className="mt-3 text-3xl font-semibold tracking-tight text-(--cf-text-1) sm:text-4xl"
            >
              {totalBooks}+ books, each structured the same way.
            </h2>
            <p className="mt-4 text-base leading-7 text-(--cf-text-2)">
              Pick any title and you get the same reliable chapter loop — summary, scenarios,
              quiz. Across {totalTopics}+ topic clusters from productivity to philosophy.
            </p>
          </div>

          <SiteLinkButton href={START_FREE_HREF}>
            Browse the library
            <ArrowRight className="h-4 w-4" />
          </SiteLinkButton>
        </div>

        {/* Book grid */}
        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {books.map((book) => (
            <div
              key={book.id}
              className="group rounded-[22px] border border-(--cf-border) bg-(--cf-surface) p-3 shadow-[var(--cf-shadow-sm)] transition duration-200 motion-safe:hover:-translate-y-1 motion-safe:hover:shadow-[var(--cf-shadow-md)]"
            >
              <BookCover
                bookId={book.id}
                title={book.title}
                icon={book.icon}
                coverImage={book.coverImage}
                className="h-40 w-full rounded-2xl border border-(--cf-border) bg-(--cf-page-bg) sm:h-44"
                imageClassName="object-cover bg-white"
                sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 14vw"
                interactive={false}
              />
              <p className="mt-3 truncate text-sm font-semibold text-(--cf-text-1)">
                {book.title}
              </p>
              <p className="mt-0.5 truncate text-xs text-(--cf-text-3)">{book.author}</p>
              <span className="mt-2 inline-block rounded-full border border-(--cf-border) bg-(--cf-surface-muted) px-2.5 py-1 text-[11px] font-medium text-(--cf-text-2)">
                {book.category}
              </span>
            </div>
          ))}
        </div>

        {/* Stats strip */}
        <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-3 rounded-[22px] border border-(--cf-border) bg-(--cf-surface) px-6 py-4 shadow-[var(--cf-shadow-sm)]">
          {[
            { label: "Books available", value: `${totalBooks}+` },
            { label: "Topic clusters", value: `${totalTopics}+` },
            { label: "Free to start", value: "2 books" },
            { label: "Depth modes", value: "3 levels" },
          ].map((stat) => (
            <div key={stat.label} className="min-w-[6rem]">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-(--cf-text-3)">
                {stat.label}
              </p>
              <p className="mt-1 text-xl font-semibold text-(--cf-text-1)">{stat.value}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const PLANS = [
  {
    name: "Free",
    price: "$0",
    period: "",
    description: "Try ChapterFlow with two complete books.",
    cta: "Start reading free",
    isPrimary: false,
    badge: null as string | null,
    features: [
      "Access to 200+ book library",
      "Finish up to 2 books",
      "Simple and Standard depth modes",
      "Chapter summaries and scenarios",
      "Chapter quizzes",
    ],
    missing: ["Deeper depth mode", "Unlimited books"],
  },
  {
    name: "Pro",
    price: "$7.99",
    period: "CAD / month",
    description: "Unlimited books and the deepest reading mode.",
    cta: "Try Pro free for 14 days",
    isPrimary: true,
    badge: "Most popular",
    features: [
      "Access to 200+ book library",
      "Unlimited books",
      "Simple and Standard depth modes",
      "Chapter summaries and scenarios",
      "Chapter quizzes",
      "Deeper depth mode",
      "Priority new title requests",
    ],
    missing: [] as string[],
  },
];

function PricingSection() {
  return (
    <section
      id="pricing"
      className="border-t border-(--cf-divider) py-20 sm:py-28"
      aria-labelledby="pricing-heading"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="max-w-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--cf-accent)">
            Pricing
          </p>
          <h2
            id="pricing-heading"
            className="mt-3 text-3xl font-semibold tracking-tight text-(--cf-text-1) sm:text-4xl"
          >
            Start free. Go deeper when you&apos;re ready.
          </h2>
          <p className="mt-4 text-base leading-7 text-(--cf-text-2)">
            No annual lock-in. No confusing tiers. Two plans, one purpose.
          </p>
        </div>

        <div className="mt-10 grid gap-4 pt-4 sm:grid-cols-2 sm:max-w-2xl">
          {PLANS.map((plan) => (
            <article
              key={plan.name}
              className={[
                "relative flex flex-col rounded-[28px] border p-7 shadow-[var(--cf-shadow-sm)]",
                plan.isPrimary
                  ? "border-(--cf-accent-border) bg-[linear-gradient(160deg,var(--cf-accent-soft),var(--cf-surface)_60%)]"
                  : "border-(--cf-border) bg-(--cf-surface)",
              ].join(" ")}
            >
              {plan.badge && (
                <div className="absolute -top-3.5 left-6">
                  <span className="rounded-full border border-(--cf-accent-border) bg-(--cf-accent) px-3.5 py-1 text-[11px] font-bold text-white shadow-[0_4px_12px_var(--cf-accent-shadow)]">
                    {plan.badge}
                  </span>
                </div>
              )}

              <div className="mb-6">
                <p
                  className={[
                    "text-xs font-bold uppercase tracking-widest",
                    plan.isPrimary ? "text-(--cf-accent)" : "text-(--cf-text-3)",
                  ].join(" ")}
                >
                  {plan.name}
                </p>
                <div className="mt-3 flex items-end gap-1.5">
                  <span className="text-4xl font-semibold tracking-tight text-(--cf-text-1)">
                    {plan.price}
                  </span>
                  {plan.period && (
                    <span className="mb-1 text-sm text-(--cf-text-3)">{plan.period}</span>
                  )}
                </div>
                <p className="mt-2 text-sm text-(--cf-text-2)">{plan.description}</p>
              </div>

              <ul className="mb-7 flex-1 space-y-3" aria-label={`${plan.name} plan features`}>
                {plan.features.map((feat) => (
                  <li key={feat} className="flex items-start gap-3">
                    <CheckCircle2
                      className="mt-0.5 h-4 w-4 shrink-0 text-(--cf-success-text)"
                      aria-hidden
                    />
                    <span className="text-sm text-(--cf-text-1)">{feat}</span>
                  </li>
                ))}
                {plan.missing.map((feat) => (
                  <li key={feat} className="flex items-start gap-3">
                    <Minus
                      className="mt-0.5 h-4 w-4 shrink-0 text-(--cf-text-soft)"
                      aria-hidden
                    />
                    <span className="text-sm text-(--cf-text-soft)">{feat}</span>
                  </li>
                ))}
              </ul>

              <Link
                href={START_FREE_HREF}
                className={[
                  "block rounded-2xl border px-5 py-3 text-center text-sm font-semibold transition duration-200",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--cf-accent-border)",
                  "motion-safe:hover:-translate-y-0.5",
                  plan.isPrimary
                    ? "border-(--cf-accent) bg-(--cf-accent) text-white shadow-[0_8px_24px_var(--cf-accent-shadow)] hover:bg-(--cf-accent-strong)"
                    : "border-(--cf-border) bg-(--cf-page-bg) text-(--cf-text-1) hover:border-(--cf-border-strong)",
                ].join(" ")}
              >
                {plan.cta}
              </Link>
            </article>
          ))}
        </div>

        <p className="mt-6 text-sm text-(--cf-text-3)">
          Pro trial requires no credit card. Cancel before 14 days and you will never be
          charged.
        </p>
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section
      className="border-t border-(--cf-divider) pb-24 pt-20 sm:pb-28 sm:pt-24"
      aria-labelledby="final-cta-heading"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="relative overflow-hidden rounded-[36px] border border-(--cf-accent-border) bg-[linear-gradient(135deg,var(--cf-accent-soft),var(--cf-surface)_55%,var(--cf-warning-soft))] px-8 py-12 shadow-[var(--cf-shadow-lg)] sm:px-12 sm:py-16">
          {/* Decorative glows */}
          <div className="pointer-events-none absolute -right-12 -top-6 h-56 w-56 rounded-full bg-(--cf-accent-muted) blur-3xl" aria-hidden />
          <div className="pointer-events-none absolute -bottom-8 -left-8 h-44 w-44 rounded-full bg-(--cf-warning-soft) blur-3xl" aria-hidden />

          <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--cf-accent)">
                Start with one chapter
              </p>
              <h2
                id="final-cta-heading"
                className="mt-3 text-3xl font-semibold tracking-tight text-(--cf-text-1) sm:text-4xl"
              >
                Try the reading flow that makes books easier to finish and easier to use.
              </h2>
              <p className="mt-4 text-base leading-7 text-(--cf-text-2)">
                Pick a book, read one chapter, take the quiz. It takes under 20 minutes and
                you will know immediately whether ChapterFlow changes how you read.
              </p>
              <div className="mt-5 flex flex-wrap gap-5 text-sm text-(--cf-text-2)">
                <span className="inline-flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-(--cf-success-text)" aria-hidden />
                  No credit card to start
                </span>
                <span className="inline-flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-(--cf-success-text)" aria-hidden />
                  2 complete books free
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <SiteLinkButton href={START_FREE_HREF}>
                Start reading free
                <ArrowRight className="h-4 w-4" />
              </SiteLinkButton>
              <SiteLinkButton href={SIGN_IN_HREF} variant="secondary">
                Sign in
              </SiteLinkButton>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-(--cf-divider) py-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 text-sm text-(--cf-text-3) sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="inline-flex shrink-0 rounded-[18px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--cf-accent-border)"
            aria-label="Go to ChapterFlow home"
          >
            <ChapterFlowMark compact />
          </Link>
          <span className="hidden sm:inline">
            Guided reading for depth, momentum, and real retention.
          </span>
        </div>
        <nav className="flex flex-wrap items-center gap-5" aria-label="Footer navigation">
          <a href="#how-it-works" className="transition hover:text-(--cf-text-1)">
            How it works
          </a>
          <a href="#library" className="transition hover:text-(--cf-text-1)">
            Library
          </a>
          <a href="#pricing" className="transition hover:text-(--cf-text-1)">
            Pricing
          </a>
          <Link href={SIGN_IN_HREF} className="transition hover:text-(--cf-text-1)">
            Sign in
          </Link>
        </nav>
      </div>
    </footer>
  );
}

export default function Home() {
  const featuredBooks = getFeaturedBooks();
  const libraryBooks = getLibraryPreviewBooks();

  return (
    <div className="min-h-screen text-(--cf-text-1)">
      {/* Fixed ambient background */}
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        aria-hidden
        style={{
          background: [
            "radial-gradient(circle at 15% 0%, var(--cf-accent-soft) 0%, transparent 30%)",
            "radial-gradient(circle at 85% 15%, var(--cf-warning-soft) 0%, transparent 25%)",
            "linear-gradient(180deg, var(--cf-page-bg) 0%, var(--cf-page-bg-alt) 50%, var(--cf-page-bg) 100%)",
          ].join(", "),
        }}
      />

      <LandingNav />

      <main>
        <HeroSection books={featuredBooks} />
        <HowItWorksSection />
        <BookShowcaseSection books={libraryBooks} />
        <PricingSection />
        <FinalCTA />
      </main>

      <Footer />
    </div>
  );
}
