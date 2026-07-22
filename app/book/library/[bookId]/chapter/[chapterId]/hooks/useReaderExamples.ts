"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BookClientError, fetchBookJson } from "@/app/book/_lib/book-api";
import { INSIGHT_POINTS_AMOUNTS } from "@/app/book/_lib/flow-points-economy";
import { trackReaderFunnel } from "@/app/book/_lib/reader-analytics";
import { deriveChapterApplicationState } from "@/app/app/api/book/_lib/commitment-application-core";
import { useBookViewer } from "@/app/book/hooks/useBookViewer";
import { useCommitments } from "@/app/book/hooks/useCommitments";
import type { BookChapter, ChapterExample } from "@/app/book/data/bookChapters";
import type { V21ReaderPattern } from "@/app/book/lib/v21-adapter";
import type { ExampleFilter } from "./useChapterState";
import type {
  ScenarioSubmissionDraft,
  UserScenarioSubmission,
} from "../components/ExamplesList";

const SCENARIO_SUBMISSION_POINTS = INSIGHT_POINTS_AMOUNTS.scenarioApproved;

export function useReaderExamples({
  bookId,
  chapterOrder,
  chapterNumber,
  chapter,
  enabled,
  exampleFilter,
  setExampleFilter,
  onToast,
}: {
  bookId: string;
  chapterOrder?: number;
  chapterNumber?: number;
  chapter?: BookChapter;
  enabled: boolean;
  exampleFilter: ExampleFilter;
  setExampleFilter: (filter: ExampleFilter) => void;
  onToast: (message: string) => void;
}) {
  const { identity: viewerIdentity } = useBookViewer();
  const [approvedUserExamples, setApprovedUserExamples] = useState<ChapterExample[]>([]);
  const [userSubmissions, setUserSubmissions] = useState<UserScenarioSubmission[]>([]);
  const [scenariosFetchFailed, setScenariosFetchFailed] = useState(false);
  const [scenariosRefetchKey, setScenariosRefetchKey] = useState(0);
  const [engagementPoints, setEngagementPoints] = useState(0);
  const [scenarioInteractions, setScenarioInteractions] = useState(0);
  const [committedToChapter, setCommittedToChapter] = useState(false);
  const [selectedPatternId, setSelectedPatternId] = useState<string | null>(null);
  const [pinnedExampleId, setPinnedExampleId] = useState<string | null>(null);
  const [planFromPattern, setPlanFromPattern] = useState<string | null>(null);

  useEffect(() => {
    if (!chapterOrder) return;
    let mounted = true;
    fetchBookJson<{
      approvedScenarios: ChapterExample[];
      mySubmissions: UserScenarioSubmission[];
      points: number;
    }>(
      `/app/api/book/me/books/${encodeURIComponent(bookId)}/chapters/${chapterOrder}/scenarios`,
    )
      .then((payload) => {
        if (!mounted) return;
        setApprovedUserExamples(payload.approvedScenarios ?? []);
        setUserSubmissions(payload.mySubmissions ?? []);
        setEngagementPoints(Number.isFinite(payload.points) ? payload.points : 0);
        setScenariosFetchFailed(false);
      })
      .catch(() => {
        if (!mounted) return;
        setApprovedUserExamples([]);
        setUserSubmissions([]);
        setScenariosFetchFailed(true);
      });
    return () => {
      mounted = false;
    };
  }, [bookId, chapterOrder, scenariosRefetchKey]);

  const commitmentsEnabled = enabled && Boolean(chapterNumber) && Boolean(viewerIdentity?.sub);
  const {
    commitments,
    activeCommitments,
    loading: commitmentsLoading,
    refresh: refreshCommitments,
  } = useCommitments(commitmentsEnabled);
  const activeChapterCommitment = chapter
    ? activeCommitments.find(
        (commitment) =>
          commitment.bookId === bookId &&
          commitment.chapterNumber === chapter.order &&
          commitment.status === "active",
      )
    : undefined;
  const chapterApplicationState = chapter
    ? deriveChapterApplicationState(commitments, bookId, chapter.order)
    : "none";
  const commitmentAvailable = Boolean(chapter?.implementationPlan?.ifThenPlans?.length);

  useEffect(() => {
    if (!chapter) return;
    const hasActive = activeCommitments.some(
      (commitment) =>
        commitment.bookId === bookId &&
        commitment.chapterNumber === chapter.order &&
        commitment.status === "active",
    );
    setCommittedToChapter(hasActive);
  }, [bookId, chapter, activeCommitments]);

  const handleCommitment = useCallback(
    async (params: {
      bookId: string;
      chapterNumber: number;
      ifThenPlan: string;
      followUpDays: 3 | 7;
    }) => {
      if (!enabled) return;
      try {
        await fetchBookJson("/app/api/book/me/commitments", {
          method: "POST",
          body: JSON.stringify(params),
        });
        setCommittedToChapter(true);
        void refreshCommitments();
      } catch (error) {
        if (error instanceof BookClientError && error.status === 409) {
          setCommittedToChapter(true);
          void refreshCommitments();
          return;
        }
        throw error;
      }
    },
    [enabled, refreshCommitments],
  );

  const readerPatterns = chapter?.experiencePlan?.behaviorLoop?.readerPatterns ?? [];
  const patternSelectorEnabled =
    process.env.NEXT_PUBLIC_BOOK_ENABLE_PATTERN_SELECTOR === "1" ||
    process.env.NEXT_PUBLIC_BOOK_ENABLE_PATTERN_SELECTOR === "true";
  const handlePatternPick = useCallback(
    (pattern: V21ReaderPattern) => {
      if (!enabled) return;
      setSelectedPatternId(pattern.id);
      const authored = chapter?.examplesDetailed ?? [];
      const exampleIndex = pattern.mapsToExampleIndex;
      if (
        exampleIndex !== undefined &&
        exampleIndex >= 0 &&
        exampleIndex < authored.length
      ) {
        setPinnedExampleId(authored[exampleIndex].id);
        if (exampleFilter !== "all") setExampleFilter("all");
      } else {
        if (exampleIndex !== undefined) {
          console.warn(
            `[PatternSelector] mapsToExampleIndex ${exampleIndex} out of range; showing the default example`,
          );
        }
        setPinnedExampleId(null);
      }
      const plans = chapter?.implementationPlan?.ifThenPlans ?? [];
      const planIndex = pattern.mapsToPlanIndex;
      if (planIndex !== undefined && planIndex >= 0 && planIndex < plans.length) {
        setPlanFromPattern(plans[planIndex].plan);
      } else {
        if (planIndex !== undefined) {
          console.warn(
            `[PatternSelector] mapsToPlanIndex ${planIndex} out of range; leaving plans unselected`,
          );
        }
        setPlanFromPattern(null);
      }
      trackReaderFunnel("pattern_picked", {
        bookId,
        chapterNumber: chapter?.order,
        patternId: pattern.id,
      });
    },
    [bookId, chapter, enabled, exampleFilter, setExampleFilter],
  );

  const handleSubmitScenario = useCallback(
    async (draft: ScenarioSubmissionDraft) => {
      if (!enabled || !chapter) throw new Error("Reader state is still loading.");
      const payload = await fetchBookJson<{
        submission: UserScenarioSubmission;
        points: number;
      }>(
        `/app/api/book/me/books/${encodeURIComponent(bookId)}/chapters/${chapter.order}/scenarios`,
        { method: "POST", body: JSON.stringify(draft) },
      );
      setUserSubmissions((previous) => [payload.submission, ...previous]);
      if (payload.submission.status === "rejected") {
        throw new Error(payload.submission.reviewNotes ?? "Did not meet quality criteria.");
      }
      if (payload.submission.status === "approved") {
        setEngagementPoints((previous) => Math.max(previous, payload.points));
        onToast(`Scenario approved! +${SCENARIO_SUBMISSION_POINTS} Insight Points earned.`);
      } else {
        onToast(
          `Scenario submitted for review. Approved submissions earn +${SCENARIO_SUBMISSION_POINTS} Insight Points.`,
        );
      }
    },
    [bookId, chapter, enabled, onToast],
  );

  const filteredExamples = useMemo(
    () =>
      [...(chapter?.examplesDetailed ?? []), ...approvedUserExamples].filter(
        (example) => exampleFilter === "all" || example.scope === exampleFilter,
      ),
    [approvedUserExamples, chapter, exampleFilter],
  );

  return {
    viewerIdentity,
    filteredExamples,
    userSubmissions,
    engagementPoints,
    scenariosFetchFailed,
    retryScenarios: () => setScenariosRefetchKey((key) => key + 1),
    scenarioInteractions,
    recordScenarioInteraction: () => setScenarioInteractions((count) => count + 1),
    handleSubmitScenario,
    commitmentsLoading,
    committedToChapter,
    activeChapterCommitment,
    chapterApplicationState,
    commitmentAvailable,
    handleCommitment,
    patternSelectorEnabled,
    readerPatterns,
    selectedPatternId,
    pinnedExampleId,
    planFromPattern,
    handlePatternPick,
  };
}
