"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { BookLock, CheckCircle2, CloudOff, FileQuestion } from "lucide-react";
import { PRICING, MONTHLY_PRICE_WITH_CURRENCY, TRIAL_CTA_LABEL, UPGRADE_RETURN_PATH } from "@/lib/pricing";
import { buildReauthReturnTo } from "../lib/reader-flow-core";
import type { useReaderAccess } from "../hooks/useReaderAccess";
import { ChapterBackgroundOrbs } from "./ChapterBackgroundOrbs";
import { ChapterSkeleton } from "./ChapterSkeleton";

type Props = {
  bookId: string;
  pathname: string;
  search: string;
  onboardingHydrated: boolean;
  progressHydrated: boolean;
  chapterHydrated: boolean;
  isLocked: boolean;
  access: ReturnType<typeof useReaderAccess>;
  children?: ReactNode;
};

function ReaderSkeleton() {
  return (
    <main className="relative min-h-screen overflow-x-hidden">
      <ChapterBackgroundOrbs />
      <ChapterSkeleton />
    </main>
  );
}

export function ReaderAccessState({
  bookId,
  pathname,
  search,
  onboardingHydrated,
  progressHydrated,
  chapterHydrated,
  isLocked,
  access,
  children,
}: Props) {
  const {
    entry,
    chapter,
    contentHydrated,
    contentStatus,
    effectiveOnboardingComplete,
    bookAccessStatus,
    bookAccessMessage,
    paywallHit,
    initialReaderReady,
    retryContent,
  } = access;

  if (
    onboardingHydrated &&
    effectiveOnboardingComplete &&
    bookAccessStatus === "ready" &&
    contentHydrated &&
    !chapter
  ) {
    const isAuthExpired = contentStatus === 401;
    const isBlocked = contentStatus === 402 || contentStatus === 403;
    const isNotFound = contentStatus === 404;
    const reauthReturnTo = encodeURIComponent(buildReauthReturnTo(pathname, search));
    const CardIcon = isAuthExpired
      ? BookLock
      : isBlocked
        ? BookLock
        : isNotFound
          ? FileQuestion
          : CloudOff;
    const cardHeading = isAuthExpired
      ? "Your session has expired"
      : isBlocked
        ? "You don't have access to this chapter"
        : isNotFound
          ? "We couldn't find this chapter"
          : "Couldn't load this chapter";
    const cardBody = isAuthExpired
      ? "You've been signed out. Sign in again to pick up right where you left off."
      : isBlocked
        ? "Your access to this chapter couldn't be confirmed. It may be locked, or your session may have expired — head back to the book to continue."
        : isNotFound
          ? "This chapter doesn't seem to exist anymore. It may have been moved or unpublished."
          : "We hit a problem loading this chapter's content. Check your connection and try again.";
    const showRetry = !isAuthExpired && !isBlocked && !isNotFound;
    return (
      <main className="relative min-h-screen overflow-x-hidden">
        <ChapterBackgroundOrbs />
        <section className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-4 py-10 sm:px-6">
          <div role="alert" className="w-full cr-glass-reading p-8 text-center">
            <CardIcon className="mx-auto h-10 w-10 text-(--cr-text-disabled)" />
            <h1 className="mt-4 text-3xl font-bold text-(--cr-text-heading)">{cardHeading}</h1>
            <p className="mt-2 text-(--cr-text-secondary)">{cardBody}</p>
            <div className="mt-5 flex flex-col items-center gap-3">
              {isAuthExpired && (
                <a
                  href={`/auth/login?returnTo=${reauthReturnTo}`}
                  className="inline-flex min-h-11 items-center rounded-xl bg-(--cr-accent) px-5 py-2.5 text-sm font-semibold text-(--cr-text-inverse) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-(--cr-bg-root) focus-visible:ring-[color-mix(in_srgb,var(--cr-accent)_60%,transparent)]"
                >
                  Sign in to continue
                </a>
              )}
              {showRetry && (
                <button
                  type="button"
                  onClick={retryContent}
                  className="inline-flex min-h-11 items-center rounded-xl bg-(--cr-accent) px-5 py-2.5 text-sm font-semibold text-(--cr-text-inverse) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-(--cr-bg-root) focus-visible:ring-[color-mix(in_srgb,var(--cr-accent)_60%,transparent)]"
                >
                  Try again
                </button>
              )}
              <Link
                href={`/book/library/${encodeURIComponent(bookId)}`}
                className="inline-flex min-h-11 items-center rounded-xl border border-(--cr-glass-border-teal) bg-(--cr-accent-muted) px-4 py-2 text-sm font-medium text-(--cr-accent)"
              >
                Back to book
              </Link>
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (bookAccessStatus === "blocked") {
    return (
      <main className="relative min-h-screen overflow-x-hidden">
        <ChapterBackgroundOrbs />
        <section className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-4 py-10 sm:px-6">
          <div className="w-full cr-glass-reading p-8 text-center">
            <BookLock className="mx-auto h-10 w-10 text-(--cr-text-disabled)" />
            {paywallHit ? (
              <>
                <h1 className="mt-4 text-3xl font-bold text-(--cr-text-heading)">
                  Unlimited books for {MONTHLY_PRICE_WITH_CURRENCY}/mo
                </h1>
                <p className="mt-1 text-sm text-(--cr-text-secondary)">
                  That&rsquo;s about ${(PRICING.monthlyAmount / 30).toFixed(2)} a day — and the
                  first {PRICING.trialDays} days are free. Cancel anytime.
                </p>
                <ul className="mx-auto mt-5 max-w-sm space-y-2 text-left">
                  {[
                    "Unlimited books — read every title in the library",
                    "Deeper depth mode on every chapter",
                    "Text-to-speech audio for hands-free reading",
                    "Priority requests for new titles",
                  ].map((benefit) => (
                    <li
                      key={benefit}
                      className="flex items-start gap-2 text-sm text-(--cr-text-secondary)"
                    >
                      <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-(--cr-accent)" />
                      <span>{benefit}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-6 flex flex-col items-center gap-3">
                  <Link
                    href={UPGRADE_RETURN_PATH}
                    className="inline-flex min-h-11 items-center rounded-xl bg-(--cr-accent) px-5 py-2.5 text-sm font-semibold text-(--cr-text-inverse) transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-(--cr-bg-root) focus-visible:ring-[color-mix(in_srgb,var(--cr-accent)_60%,transparent)]"
                  >
                    {TRIAL_CTA_LABEL}
                  </Link>
                  <Link
                    href={`/book/library/${encodeURIComponent(bookId)}`}
                    className="inline-flex rounded-xl border border-(--cr-glass-border-teal) bg-(--cr-accent-active) px-4 py-2 text-sm font-medium text-(--cr-accent)"
                  >
                    Back to book
                  </Link>
                </div>
              </>
            ) : (
              <>
                <h1 className="mt-4 text-3xl font-bold text-(--cr-text-heading)">
                  Book access paused
                </h1>
                <p className="mt-2 text-(--cr-text-secondary)">
                  {bookAccessMessage ||
                    "We couldn't unlock this book right now. Please head back and try again."}
                </p>
                <Link
                  href={`/book/library/${encodeURIComponent(bookId)}`}
                  className="mt-5 inline-flex rounded-xl border border-(--cr-glass-border-teal) bg-(--cr-accent-muted) px-4 py-2 text-sm font-medium text-(--cr-accent)"
                >
                  Back to book
                </Link>
              </>
            )}
          </div>
        </section>
      </main>
    );
  }

  if (
    !initialReaderReady &&
    (!entry ||
      !chapter ||
      !onboardingHydrated ||
      !progressHydrated ||
      !chapterHydrated ||
      !effectiveOnboardingComplete ||
      bookAccessStatus === "loading")
  ) {
    return <ReaderSkeleton />;
  }
  if (!chapter) return <ReaderSkeleton />;
  if (isLocked) {
    return (
      <main className="relative min-h-screen overflow-x-hidden">
        <ChapterBackgroundOrbs />
        <section className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-4 py-10 sm:px-6">
          <div className="w-full cr-glass-reading p-8 text-center">
            <BookLock className="mx-auto h-10 w-10 text-(--cr-text-disabled)" />
            <h1 className="mt-4 text-3xl font-bold text-(--cr-text-heading)">Chapter locked</h1>
            <p className="mt-2 text-(--cr-text-secondary)">
              Pass the current chapter quiz to unlock this chapter.
            </p>
            <Link
              href={`/book/library/${encodeURIComponent(bookId)}`}
              className="mt-5 inline-flex rounded-xl border border-(--cr-glass-border-teal) bg-(--cr-accent-muted) px-4 py-2 text-sm font-medium text-(--cr-accent)"
            >
              Back to chapters
            </Link>
          </div>
        </section>
      </main>
    );
  }
  return children;
}
