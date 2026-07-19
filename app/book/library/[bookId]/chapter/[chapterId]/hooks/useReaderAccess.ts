"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BookClientError, fetchBookJson } from "@/app/book/_lib/book-api";
import type { LibraryBookDetail } from "@/app/book/_lib/library-data";
import { getChapterById, type BookChapter } from "@/app/book/data/bookChapters";
import type { ContentTone } from "@/app/book/settings/types/settings";
import {
  adaptApiChapterToBookChapter,
  isReconstructedChapterEmpty,
  type InitialChapterReaderSeed,
} from "../lib/chapterFromApi";
import {
  classifyStartAccessFailure,
  getOrCreateBookStartRequest,
  isInitialReaderSeedForRoute,
  mapInitialReaderProgressToManifest,
  shouldRenderInitialReaderContent,
} from "../lib/chapterContentHydration";
import { useChapterContent } from "./useChapterContent";

type OnboardingAccess = {
  setupComplete: boolean;
};

export function useReaderAccess({
  bookId,
  chapterId,
  chapterOrder,
  initialBook,
  initialSeed,
  contentTone,
  onboarding,
  onboardingHydrated,
}: {
  bookId: string;
  chapterId: string;
  chapterOrder?: number;
  initialBook?: LibraryBookDetail;
  initialSeed?: InitialChapterReaderSeed;
  contentTone: ContentTone;
  onboarding: OnboardingAccess;
  onboardingHydrated: boolean;
}) {
  const router = useRouter();
  const [contentRefetchKey, setContentRefetchKey] = useState(0);
  const entry = useMemo(
    () => ({ title: initialBook?.title ?? bookId, author: initialBook?.author ?? "" }),
    [initialBook, bookId],
  );
  const chapters = useMemo(
    () =>
      (initialBook?.chapters ?? []).map((item) => ({
        id: item.chapterId,
        order: item.number,
        title: item.title,
      })),
    [initialBook],
  );
  const chapterNumber = useMemo(
    () => initialBook?.chapters.find((item) => item.chapterId === chapterId)?.number,
    [initialBook, chapterId],
  );
  const bookMeta = useMemo(
    () => ({
      bookId,
      title: initialBook?.title,
      author: initialBook?.author,
      categories: initialBook?.categories,
      tags: initialBook?.tags,
    }),
    [bookId, initialBook],
  );
  const attestedInitial = useMemo(() => {
    if (
      !initialSeed ||
      !chapterNumber ||
      (chapterOrder !== undefined && chapterOrder !== chapterNumber) ||
      !isInitialReaderSeedForRoute(initialSeed, { bookId, chapterId, chapterNumber })
    ) {
      return null;
    }
    const progressFloor = mapInitialReaderProgressToManifest(
      initialSeed.content.progress,
      (initialBook?.chapters ?? []).map((item) => ({
        id: item.chapterId,
        number: item.number,
      })),
      { bookId, chapterId, chapterNumber },
    );
    if (!progressFloor) return null;
    const reconstructed = adaptApiChapterToBookChapter(initialSeed.content.chapter, bookMeta);
    if (isReconstructedChapterEmpty(reconstructed)) return null;
    return { seed: initialSeed, progressFloor };
  }, [bookId, bookMeta, chapterId, chapterNumber, chapterOrder, initialBook, initialSeed]);
  const hasAttestedSeed = attestedInitial !== null;
  const effectiveOnboardingComplete = hasAttestedSeed || onboarding.setupComplete;
  const [bookAccessStatus, setBookAccessStatus] = useState<"loading" | "ready" | "blocked">(
    () => (hasAttestedSeed ? "ready" : "loading"),
  );
  const [bookAccessMessage, setBookAccessMessage] = useState<string | null>(null);
  const [paywallHit, setPaywallHit] = useState(false);
  const startRequestRef = useRef<{ bookId: string; request: Promise<unknown> } | null>(null);
  const localFallback = useCallback(
    () => getChapterById(bookId, chapterId, contentTone),
    [bookId, chapterId, contentTone],
  );
  const {
    chapter: baseChapter,
    hydrated: contentHydrated,
    source: contentSource,
    error: contentError,
    status: contentStatus,
  } = useChapterContent({
    bookId,
    chapterNumber,
    book: bookMeta,
    localFallback,
    refetchKey: contentRefetchKey,
    initialChapter: attestedInitial?.seed.content,
  });
  const servingOfflineCopy =
    contentSource === "local" && contentError !== null && contentStatus === null;
  const chapter: BookChapter | undefined = useMemo(
    () => (baseChapter ? { ...baseChapter, id: chapterId } : undefined),
    [baseChapter, chapterId],
  );
  const initialReaderReady = shouldRenderInitialReaderContent({
    hasAttestedSeed,
    contentHydrated,
    hasChapter: Boolean(chapter),
  });

  useEffect(() => {
    if (!onboardingHydrated || hasAttestedSeed) return;
    if (!onboarding.setupComplete) router.replace("/book");
  }, [hasAttestedSeed, onboarding.setupComplete, onboardingHydrated, router]);

  useEffect(() => {
    if (!entry || !onboardingHydrated || !effectiveOnboardingComplete) return;
    let cancelled = false;
    const startRequest = getOrCreateBookStartRequest({
      current: startRequestRef.current,
      bookId,
      create: () =>
        fetchBookJson(`/app/api/book/me/books/${encodeURIComponent(bookId)}/start`, {
          method: "POST",
        }),
    });
    startRequestRef.current = startRequest.entry;
    if (startRequest.created) {
      if (!hasAttestedSeed) setBookAccessStatus("loading");
      setBookAccessMessage(null);
      setPaywallHit(false);
    }
    startRequest.entry.request
      .then(() => {
        if (!cancelled) setBookAccessStatus("ready");
      })
      .catch((error) => {
        if (cancelled) return;
        const failure = classifyStartAccessFailure({
          status: error instanceof BookClientError ? error.status : null,
          code: error instanceof BookClientError ? error.code : undefined,
        });
        if (failure !== "transient") setBookAccessStatus("blocked");
        if (failure === "account_deleted") {
          setBookAccessMessage("This account has been deleted and is no longer accessible.");
          window.location.assign("/auth/login?reason=deleted");
          return;
        }
        if (failure === "reauth") {
          setBookAccessMessage("Your session has expired. Sign in again to continue.");
          const returnTo = `${window.location.pathname}${window.location.search}`;
          window.location.assign(`/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
          return;
        }
        if (failure === "paywall") {
          setBookAccessMessage(
            "You\u2019ve reached your free book limit. Upgrade to Pro to unlock unlimited books.",
          );
          setPaywallHit(true);
          return;
        }
        if (failure === "email_verification") {
          setBookAccessMessage("Please verify your email address to continue.");
          return;
        }
        if (failure === "review") {
          setBookAccessMessage(
            "Your access is under review. Please contact support if this persists.",
          );
          return;
        }
        if (failure === "blocked") {
          setBookAccessMessage(
            "Your access to this book could not be confirmed. Please head back and try again.",
          );
          return;
        }
        setBookAccessStatus("ready");
      });
    return () => {
      cancelled = true;
    };
  }, [bookId, effectiveOnboardingComplete, entry, hasAttestedSeed, onboardingHydrated]);

  return {
    entry,
    chapters,
    chapterNumber,
    baseChapter,
    chapter,
    contentHydrated,
    contentStatus,
    servingOfflineCopy,
    initialProgressFloor: attestedInitial?.progressFloor,
    hasAttestedSeed,
    effectiveOnboardingComplete,
    bookAccessStatus,
    bookAccessMessage,
    paywallHit,
    initialReaderReady,
    retryContent: () => setContentRefetchKey((key) => key + 1),
  };
}
