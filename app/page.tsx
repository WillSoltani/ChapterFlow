import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BookOpenText,
  CheckCircle2,
  Clock3,
  LayoutGrid,
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

const METHOD_CARDS = [
  {
    eyebrow: "Understand",
    title: "Read the main point fast",
    description:
      "Each chapter opens with a structured breakdown so you can get the core idea clearly before moving on.",
  },
  {
    eyebrow: "Apply",
    title: "See how it works in real life",
    description:
      "Scenarios turn abstract ideas into practical decisions across everyday contexts, not just theory.",
  },
  {
    eyebrow: "Retain",
    title: "Check that it actually stuck",
    description:
      "Scenario-based quizzes, saved progress, badges, and Flow Points help momentum feel visible without overwhelming the reading experience.",
  },
] as const;

const PRINCIPLE_CARDS = [
  {
    title: "Structured enough to be useful",
    description:
      "The app does not throw a wall of text at you. It organizes each chapter into a sequence you can follow in minutes.",
  },
  {
    title: "Practical enough to remember",
    description:
      "Quizzes use active recall and application so the main point is easier to retrieve later, not just recognize in the moment.",
  },
  {
    title: "Motivating without getting noisy",
    description:
      "Progress, badges, and rewards stay in the background as reinforcement. The product still feels like learning first.",
  },
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
  const selected = FEATURED_BOOK_IDS.map((bookId) => getBookById(bookId)).filter(
    (book): book is BookCatalogItem => Boolean(book)
  );

  if (selected.length >= 3) return selected;

  const seen = new Set(selected.map((book) => book.id));
  for (const book of BOOKS_CATALOG) {
    if (seen.has(book.id)) continue;
    selected.push(book);
    if (selected.length === 3) break;
  }
  return selected;
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
  const className =
    variant === "primary"
      ? "border-(--cf-accent) bg-(--cf-accent) text-white shadow-[0_18px_38px_var(--cf-accent-shadow)] hover:bg-(--cf-accent-strong) hover:border-(--cf-accent-strong)"
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
        className,
      ].join(" ")}
    >
      {children}
    </Link>
  );
}

function LandingNav() {
  return (
    <header className="sticky top-0 z-30 border-b border-(--cf-divider) bg-[color:rgba(247,244,238,0.82)] backdrop-blur-xl dark:bg-[color:rgba(18,17,15,0.82)]">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
        <Link
          href="/"
          className="inline-flex shrink-0 rounded-[18px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--cf-accent-border)"
          aria-label="Go to ChapterFlow home"
        >
          <ChapterFlowMark compact />
        </Link>

        <nav className="hidden items-center gap-6 lg:flex">
          <a
            href="#method"
            className="text-sm font-medium text-(--cf-text-2) transition hover:text-(--cf-text-1)"
          >
            How it works
          </a>
          <a
            href="#product"
            className="text-sm font-medium text-(--cf-text-2) transition hover:text-(--cf-text-1)"
          >
            Product
          </a>
          <a
            href="#principles"
            className="text-sm font-medium text-(--cf-text-2) transition hover:text-(--cf-text-1)"
          >
            Why it feels different
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

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="max-w-2xl">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--cf-accent)">
        {eyebrow}
      </p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-(--cf-text-1) sm:text-4xl">
        {title}
      </h2>
      <p className="mt-4 text-base leading-7 text-(--cf-text-2) sm:text-lg">
        {description}
      </p>
    </div>
  );
}

function HeroPreview({ books }: { books: BookCatalogItem[] }) {
  const [primary, secondary, tertiary] = books;

  return (
    <div
      aria-hidden="true"
      className="relative mx-auto max-w-[42rem] px-2 lg:px-0"
    >
      <div className="pointer-events-none absolute -left-10 top-10 h-44 w-44 rounded-full bg-(--cf-accent-soft) blur-3xl" />
      <div className="pointer-events-none absolute -right-8 bottom-4 h-40 w-40 rounded-full bg-(--cf-warning-soft) blur-3xl" />

      <div className="relative rounded-[36px] border border-(--cf-border) bg-[linear-gradient(180deg,var(--cf-surface),var(--cf-surface-muted))] p-4 shadow-[var(--cf-shadow-lg)] sm:p-5">
        <div className="flex items-center justify-between rounded-[24px] border border-(--cf-divider) bg-(--cf-page-bg) px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-(--cf-accent-border) bg-(--cf-accent-soft)">
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

        <div className="mt-4 grid gap-4 xl:grid-cols-[212px_minmax(0,1fr)]">
          <div className="rounded-[28px] border border-(--cf-border) bg-(--cf-surface) p-4 shadow-[var(--cf-shadow-sm)]">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-(--cf-text-3)">
                Library
              </p>
              <span className="rounded-full bg-(--cf-surface-muted) px-2.5 py-1 text-[11px] font-semibold text-(--cf-text-2)">
                95 books live
              </span>
            </div>
            <div className="mt-4 space-y-3">
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
                    className="h-16 w-12 rounded-xl border border-(--cf-border) bg-(--cf-surface)"
                    sizes="48px"
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

          <div className="space-y-4">
            {primary ? (
              <div className="rounded-[28px] border border-(--cf-border) bg-(--cf-surface) p-5 shadow-[var(--cf-shadow-sm)]">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <BookCover
                      bookId={primary.id}
                      title={primary.title}
                      icon={primary.icon}
                      coverImage={primary.coverImage}
                      className="h-20 w-14 rounded-2xl border border-(--cf-border) bg-(--cf-page-bg)"
                      sizes="56px"
                      interactive={false}
                    />
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-(--cf-text-3)">
                        Now reading
                      </p>
                      <p className="mt-1 text-lg font-semibold text-(--cf-text-1)">
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

                <div className="mt-5 space-y-3">
                  <div className="rounded-2xl border border-(--cf-divider) bg-(--cf-page-bg) p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-(--cf-text-3)">
                      Summary
                    </p>
                    <p className="mt-2 text-sm leading-6 text-(--cf-text-2)">
                      Each chapter starts with a cleaner breakdown of the main idea, so you can understand the point before you decide how deep to go.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {["Main idea", "Real-life scenarios", "Quiz review"].map((label) => (
                      <span
                        key={label}
                        className="rounded-full border border-(--cf-accent-border) bg-(--cf-accent-soft) px-3 py-1 text-xs font-medium text-(--cf-accent)"
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-[24px] border border-(--cf-border) bg-(--cf-surface) p-4 shadow-[var(--cf-shadow-sm)]">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-(--cf-text-3)">
                  Scenario
                </p>
                <p className="mt-2 text-sm font-semibold text-(--cf-text-1)">
                  Work context
                </p>
                <p className="mt-2 text-sm leading-6 text-(--cf-text-2)">
                  The chapter idea is translated into a real decision, so the lesson feels usable instead of abstract.
                </p>
              </div>
              <div className="rounded-[24px] border border-(--cf-border) bg-(--cf-surface) p-4 shadow-[var(--cf-shadow-sm)]">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-(--cf-text-3)">
                  Quiz
                </p>
                <div className="mt-2 flex items-center justify-between">
                  <p className="text-sm font-semibold text-(--cf-text-1)">Pass to unlock the next chapter</p>
                  <span className="rounded-full border border-(--cf-success-border) bg-(--cf-success-soft) px-2.5 py-1 text-xs font-semibold text-(--cf-success-text)">
                    8/10 correct
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-(--cf-text-2)">
                  Scenario-based questions check whether you understood the chapter well enough to use it later.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="pointer-events-none absolute -left-6 top-16 hidden w-48 rounded-[24px] border border-(--cf-border) bg-(--cf-surface) p-4 shadow-[var(--cf-shadow-md)] xl:block">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-(--cf-text-3)">
            Today
          </p>
          <div className="mt-3 space-y-2.5">
            {[
              "Read one chapter summary",
              "Finish one scenario set",
              "Pass the chapter quiz",
            ].map((item) => (
              <div key={item} className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-(--cf-success-text)" />
                <p className="text-sm leading-5 text-(--cf-text-2)">{item}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="pointer-events-none absolute -bottom-6 right-2 hidden w-56 rounded-[24px] border border-(--cf-border) bg-(--cf-surface) p-4 shadow-[var(--cf-shadow-md)] xl:block">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-(--cf-text-3)">
                Momentum
              </p>
              <p className="mt-1 text-lg font-semibold text-(--cf-text-1)">7-day streak</p>
            </div>
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-(--cf-warning-border) bg-(--cf-warning-soft)">
              <Trophy className="h-4 w-4 text-(--cf-warning-text)" />
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-2xl border border-(--cf-divider) bg-(--cf-page-bg) p-3">
              <p className="text-xs text-(--cf-text-3)">Badges</p>
              <p className="mt-1 text-base font-semibold text-(--cf-text-1)">3 earned</p>
            </div>
            <div className="rounded-2xl border border-(--cf-divider) bg-(--cf-page-bg) p-3">
              <p className="text-xs text-(--cf-text-3)">Flow Points</p>
              <p className="mt-1 text-base font-semibold text-(--cf-text-1)">420</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LearningMethodSection() {
  return (
    <section id="method" className="py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHeading
          eyebrow="How it works"
          title="Every chapter is built to move from understanding to application"
          description="ChapterFlow is not a summary dump. The product is organized around a simple loop that helps ideas make sense, feel useful, and stay retrievable later."
        />

        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {METHOD_CARDS.map((card, index) => (
            <article
              key={card.title}
              className="rounded-[28px] border border-(--cf-border) bg-(--cf-surface) p-6 shadow-[var(--cf-shadow-sm)] transition duration-200 motion-safe:hover:-translate-y-1 motion-safe:hover:shadow-[var(--cf-shadow-md)]"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="rounded-full border border-(--cf-accent-border) bg-(--cf-accent-soft) px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-(--cf-accent)">
                  {card.eyebrow}
                </span>
                <span className="text-3xl font-semibold tracking-tight text-(--cf-text-soft)">
                  0{index + 1}
                </span>
              </div>
              <h3 className="mt-5 text-xl font-semibold tracking-tight text-(--cf-text-1)">
                {card.title}
              </h3>
              <p className="mt-3 text-sm leading-7 text-(--cf-text-2) sm:text-base">
                {card.description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProductGallery({ books }: { books: BookCatalogItem[] }) {
  const [primary, secondary, tertiary] = books;

  return (
    <section id="product" className="py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHeading
          eyebrow="Inside the product"
          title="The landing page now matches the actual experience"
          description="The strongest proof is the interface itself. ChapterFlow is a calmer, more editorial product than a generic productivity app, and the homepage should feel that way immediately."
        />

        <div className="mt-10 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <article className="rounded-[32px] border border-(--cf-border) bg-(--cf-surface) p-5 shadow-[var(--cf-shadow-md)] sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-(--cf-accent)">
                  Library
                </p>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight text-(--cf-text-1)">
                  Browse a real reading catalog, not a blank dashboard
                </h3>
              </div>
              <span className="rounded-full border border-(--cf-border) bg-(--cf-page-bg) px-3 py-1 text-xs font-semibold text-(--cf-text-2)">
                95 books across dozens of topics
              </span>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {[primary, secondary, tertiary].filter(Boolean).map((book) => (
                <div
                  key={book.id}
                  className="rounded-[24px] border border-(--cf-divider) bg-(--cf-page-bg) p-3"
                >
                  <BookCover
                    bookId={book.id}
                    title={book.title}
                    icon={book.icon}
                    coverImage={book.coverImage}
                    className="h-52 rounded-2xl border border-(--cf-border) bg-(--cf-surface)"
                    imageClassName="object-cover bg-white"
                    sizes="(max-width: 768px) 45vw, 18vw"
                    interactive={false}
                  />
                  <p className="mt-3 truncate text-sm font-semibold text-(--cf-text-1)">
                    {book.title}
                  </p>
                  <p className="mt-1 text-xs text-(--cf-text-3)">{book.author}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full border border-(--cf-border) bg-(--cf-surface) px-2.5 py-1 text-[11px] font-medium text-(--cf-text-2)">
                      {book.category}
                    </span>
                    <span className="rounded-full border border-(--cf-accent-border) bg-(--cf-accent-soft) px-2.5 py-1 text-[11px] font-medium text-(--cf-accent)">
                      ~{Math.round(book.estimatedMinutes / 60)}h
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </article>

          <div className="grid gap-4">
            <article className="rounded-[32px] border border-(--cf-border) bg-(--cf-surface) p-5 shadow-[var(--cf-shadow-md)] sm:p-6">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-(--cf-accent-border) bg-(--cf-accent-soft)">
                  <BookOpenText className="h-5 w-5 text-(--cf-accent)" />
                </span>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-(--cf-text-3)">
                    Chapter screen
                  </p>
                  <h3 className="mt-1 text-xl font-semibold tracking-tight text-(--cf-text-1)">
                    Summary, scenarios, then quiz
                  </h3>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                <div className="rounded-2xl border border-(--cf-divider) bg-(--cf-page-bg) p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-(--cf-text-3)">
                    Summary
                  </p>
                  <p className="mt-2 text-sm leading-6 text-(--cf-text-2)">
                    Clear chapter breakdowns, key takeaways, and a cleaner path into the main idea.
                  </p>
                </div>
                <div className="rounded-2xl border border-(--cf-divider) bg-(--cf-page-bg) p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-(--cf-text-3)">
                    Practical scenario
                  </p>
                  <p className="mt-2 text-sm leading-6 text-(--cf-text-2)">
                    The app reframes the chapter into real situations so the lesson is easier to connect to everyday choices.
                  </p>
                </div>
                <div className="rounded-2xl border border-(--cf-divider) bg-(--cf-page-bg) p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-(--cf-text-3)">
                      Quiz result
                    </p>
                    <span className="rounded-full border border-(--cf-success-border) bg-(--cf-success-soft) px-2.5 py-1 text-[11px] font-semibold text-(--cf-success-text)">
                      Pass to unlock next
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-(--cf-text-2)">
                    Review what you missed, then move on with a stronger grasp of the chapter.
                  </p>
                </div>
              </div>
            </article>

            <article className="rounded-[32px] border border-(--cf-border) bg-(--cf-surface) p-5 shadow-[var(--cf-shadow-md)] sm:p-6">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-(--cf-warning-border) bg-(--cf-warning-soft)">
                  <Trophy className="h-5 w-5 text-(--cf-warning-text)" />
                </span>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-(--cf-text-3)">
                    Progress and rewards
                  </p>
                  <h3 className="mt-1 text-xl font-semibold tracking-tight text-(--cf-text-1)">
                    Momentum stays visible
                  </h3>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {[
                  { label: "Current streak", value: "7 days" },
                  { label: "Quiz average", value: "88%" },
                  { label: "Badges earned", value: "3 badges" },
                  { label: "Flow Points", value: "420 points" },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-(--cf-divider) bg-(--cf-page-bg) p-4"
                  >
                    <p className="text-xs uppercase tracking-[0.16em] text-(--cf-text-3)">
                      {item.label}
                    </p>
                    <p className="mt-2 text-lg font-semibold text-(--cf-text-1)">
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </div>
      </div>
    </section>
  );
}

function PrinciplesSection() {
  return (
    <section id="principles" className="py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHeading
          eyebrow="Why it feels different"
          title="A calmer product story, a clearer visual system, and a sharper reason to try it"
          description="The redesign uses the same warm editorial palette as the app itself, keeps accent color focused on decisions that matter, and lets the product method do the persuasion."
        />

        <div className="mt-10 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="grid gap-4">
            {PRINCIPLE_CARDS.map((card) => (
              <article
                key={card.title}
                className="rounded-[28px] border border-(--cf-border) bg-(--cf-surface) p-6 shadow-[var(--cf-shadow-sm)]"
              >
                <h3 className="text-xl font-semibold tracking-tight text-(--cf-text-1)">
                  {card.title}
                </h3>
                <p className="mt-3 text-sm leading-7 text-(--cf-text-2) sm:text-base">
                  {card.description}
                </p>
              </article>
            ))}
          </div>

          <article className="rounded-[32px] border border-(--cf-border) bg-[linear-gradient(180deg,var(--cf-surface),var(--cf-surface-muted))] p-6 shadow-[var(--cf-shadow-md)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-(--cf-accent)">
              What the page now says clearly
            </p>
            <div className="mt-6 space-y-4">
              {[
                {
                  icon: <LayoutGrid className="h-4 w-4 text-(--cf-accent)" />,
                  title: "This is a reading product",
                  body: "The page now leads with books, chapter flow, and real product surfaces instead of abstract startup framing.",
                },
                {
                  icon: <Target className="h-4 w-4 text-(--cf-accent)" />,
                  title: "The outcome is practical understanding",
                  body: "The copy focuses on understanding, application, quizzes, and momentum rather than vague productivity language.",
                },
                {
                  icon: <Sparkles className="h-4 w-4 text-(--cf-accent)" />,
                  title: "Rewards support the habit, not the headline",
                  body: "Badges and Flow Points appear as tasteful reinforcement, not as the main promise of the product.",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-[24px] border border-(--cf-divider) bg-(--cf-page-bg) p-4"
                >
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-(--cf-accent-border) bg-(--cf-accent-soft)">
                      {item.icon}
                    </span>
                    <p className="text-sm font-semibold text-(--cf-text-1)">{item.title}</p>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-(--cf-text-2)">{item.body}</p>
                </div>
              ))}
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}

function FinalCallToAction() {
  return (
    <section className="pb-24 pt-20 sm:pb-28 sm:pt-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="relative overflow-hidden rounded-[40px] border border-(--cf-accent-border) bg-[linear-gradient(135deg,var(--cf-accent-soft),var(--cf-surface),var(--cf-warning-soft))] px-6 py-10 shadow-[var(--cf-shadow-lg)] sm:px-10 sm:py-14">
          <div className="pointer-events-none absolute -right-16 top-0 h-52 w-52 rounded-full bg-(--cf-accent-muted) blur-3xl" />
          <div className="pointer-events-none absolute -left-8 bottom-0 h-40 w-40 rounded-full bg-(--cf-warning-soft) blur-3xl" />

          <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--cf-accent)">
                Start with one chapter
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-(--cf-text-1) sm:text-4xl">
                Try the reading flow that makes books easier to understand and easier to keep using.
              </h2>
              <p className="mt-4 text-base leading-7 text-(--cf-text-2)">
                Start free, pick a book, and see how ChapterFlow turns summaries, scenarios, quizzes, and progress into one calmer learning loop.
              </p>
              <div className="mt-5 flex flex-wrap gap-4 text-sm text-(--cf-text-2)">
                <span className="inline-flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-(--cf-success-text)" />
                  No credit card needed to start
                </span>
                <span className="inline-flex items-center gap-2">
                  <Clock3 className="h-4 w-4 text-(--cf-accent)" />
                  Built for short, repeatable sessions
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <SiteLinkButton href={START_FREE_HREF}>
                Start free
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
            Guided reading for people who want depth, momentum, and real retention.
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <a href="#method" className="transition hover:text-(--cf-text-1)">
            How it works
          </a>
          <a href="#product" className="transition hover:text-(--cf-text-1)">
            Product
          </a>
          <Link href={SIGN_IN_HREF} className="transition hover:text-(--cf-text-1)">
            Sign in
          </Link>
        </div>
      </div>
    </footer>
  );
}

export default function Home() {
  const featuredBooks = getFeaturedBooks();
  const totalBooks = BOOKS_CATALOG.length;
  const totalTopics = new Set(
    BOOKS_CATALOG.flatMap((book) => book.categories.map((category) => category.toLowerCase()))
  ).size;

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,var(--cf-page-bg),var(--cf-page-bg-alt)_48%,var(--cf-page-bg))] text-(--cf-text-1)">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,var(--cf-accent-soft),transparent_28%),radial-gradient(circle_at_85%_18%,var(--cf-warning-soft),transparent_22%),linear-gradient(180deg,var(--cf-page-bg),var(--cf-page-bg-alt)_48%,var(--cf-page-bg))]" />

      <LandingNav />

      <main>
        <section className="relative overflow-hidden pb-18 pt-14 sm:pb-24 sm:pt-18">
          <div className="mx-auto grid max-w-7xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:gap-16">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-(--cf-accent-border) bg-(--cf-accent-soft) px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-(--cf-accent)">
                <Sparkles className="h-3.5 w-3.5" />
                Practical guided reading
              </p>

              <h1 className="mt-6 max-w-3xl text-5xl font-semibold tracking-tight text-(--cf-text-1) sm:text-6xl lg:text-7xl">
                Understand books well enough to use them.
              </h1>

              <p className="mt-6 max-w-2xl text-lg leading-8 text-(--cf-text-2) sm:text-xl">
                ChapterFlow turns each chapter into a calmer learning loop: read the main point, see it in practical situations, take a quiz, and keep your progress moving.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <SiteLinkButton href={START_FREE_HREF}>
                  Start free
                  <ArrowRight className="h-4 w-4" />
                </SiteLinkButton>
                <SiteLinkButton href="#method" variant="secondary">
                  See how it works
                </SiteLinkButton>
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                <div className="rounded-[22px] border border-(--cf-border) bg-(--cf-surface) px-4 py-4 shadow-[var(--cf-shadow-sm)]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-(--cf-text-3)">
                    Library
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-(--cf-text-1)">
                    {totalBooks}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-(--cf-text-2)">
                    live books across {totalTopics}+ topic clusters
                  </p>
                </div>
                <div className="rounded-[22px] border border-(--cf-border) bg-(--cf-surface) px-4 py-4 shadow-[var(--cf-shadow-sm)]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-(--cf-text-3)">
                    Chapter flow
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-(--cf-text-1)">
                    Summary → Quiz
                  </p>
                  <p className="mt-1 text-sm leading-6 text-(--cf-text-2)">
                    scenarios sit in the middle so the lesson feels usable
                  </p>
                </div>
                <div className="rounded-[22px] border border-(--cf-border) bg-(--cf-surface) px-4 py-4 shadow-[var(--cf-shadow-sm)]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-(--cf-text-3)">
                    Momentum
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-(--cf-text-1)">
                    Progress that stays visible
                  </p>
                  <p className="mt-1 text-sm leading-6 text-(--cf-text-2)">
                    badges and Flow Points support the habit without taking over
                  </p>
                </div>
              </div>
            </div>

            <HeroPreview books={featuredBooks} />
          </div>
        </section>

        <LearningMethodSection />
        <ProductGallery books={featuredBooks} />
        <PrinciplesSection />
        <FinalCallToAction />
      </main>

      <Footer />
    </div>
  );
}
