"use client";

import { motion } from "framer-motion";
import { DUR, EASE } from "@/lib/motion";
import type { BookChapter, ReadingDepth } from "@/app/book/data/bookChapters";
import { trackReaderFunnel } from "@/app/book/_lib/reader-analytics";
import { V21_SCHEMA_VERSION } from "@/app/book/lib/v21-adapter";
import type { useChapterQuiz } from "../hooks/useChapterQuiz";
import type { useReaderExamples } from "../hooks/useReaderExamples";
import type { useReaderPhaseFlow } from "../hooks/useReaderPhaseFlow";
import type { useReaderProgress } from "../hooks/useReaderProgress";
import type { useReaderSettings } from "../hooks/useReaderSettings";
import { getPhaseThresholds } from "../hooks/usePhaseCompletion";
import { CommitmentPrompt } from "./CommitmentPrompt";
import { ContinueButton } from "./ContinueButton";
import { ExamplesList } from "./ExamplesList";
import { MemorableLines } from "./MemorableLines";
import { PatternSelector } from "./PatternSelector";
import { QuizPanel } from "./QuizPanel";
import { SummaryCard } from "./SummaryCard";
import { TryThisNow } from "./TryThisNow";

type Props = {
  bookId: string;
  chapterId: string;
  chapter: BookChapter;
  activeDepth: ReadingDepth;
  prefersReducedMotion: boolean | null;
  settings: ReturnType<typeof useReaderSettings>;
  progress: ReturnType<typeof useReaderProgress>;
  phaseFlow: ReturnType<typeof useReaderPhaseFlow>;
  chapterQuiz: ReturnType<typeof useChapterQuiz>;
  examples: ReturnType<typeof useReaderExamples>;
  onToast: (message: string) => void;
  onSubmitQuiz: () => Promise<void>;
  onRetryQuiz: () => void;
  onContinueToPractice: () => void;
};

function formatNoteWithTakeaways(takeaways: string[]): string {
  return [
    `Takeaways (${new Date().toLocaleDateString()}):`,
    ...takeaways.map((takeaway) => `- ${takeaway}`),
  ].join("\n");
}

export function ReaderPhaseContent({
  bookId,
  chapterId,
  chapter,
  activeDepth,
  prefersReducedMotion,
  settings,
  progress,
  phaseFlow,
  chapterQuiz,
  examples,
  onToast,
  onSubmitQuiz,
  onRetryQuiz,
  onContinueToPractice,
}: Props) {
  const { bookPrefs, learningMode } = settings;
  const { chapterProgress } = progress;
  const {
    state,
    setExampleFilter,
    appendNote,
    markRecapSeen,
    toggleBookmarkedTakeaway,
  } = chapterProgress;
  const { phaseCompletion, setActiveTab } = phaseFlow;
  const { quiz } = chapterQuiz;
  const {
    filteredExamples,
    userSubmissions,
    engagementPoints,
    scenariosFetchFailed,
    retryScenarios,
    recordScenarioInteraction,
    handleSubmitScenario,
    commitmentsLoading,
    committedToChapter,
    activeChapterCommitment,
    handleCommitment,
    patternSelectorEnabled,
    readerPatterns,
    selectedPatternId,
    pinnedExampleId,
    planFromPattern,
    handlePatternPick,
  } = examples;
  const isV21Chapter = chapter.schemaVersion === V21_SCHEMA_VERSION;
  const summaryBlocks = chapter.summaryByDepth[activeDepth] ?? chapter.summaryByDepth.standard;
  const activeTakeaways = chapter.takeawaysByDepth[activeDepth] ?? chapter.takeaways;
  const activeRecap = chapter.recapByDepth[activeDepth] ?? [];
  const activeActivationPrompt =
    chapter.activationPromptByDepth[activeDepth] ?? chapter.activationPrompt;
  const activeSelfCheckPrompts =
    chapter.selfCheckPromptsByDepth[activeDepth] ?? chapter.selfCheckPrompts;
  const activeReflectionPrompts =
    chapter.reflectionPromptsByDepth[activeDepth] ?? chapter.reflectionPrompts;
  const activeClosingPrompt = chapter.closingPromptByDepth[activeDepth] ?? chapter.closingPrompt;
  const textScaleClass = "";

  return (
    <>
      {state.activeTab === "summary" && (
        <motion.div
          key={`summary-${activeDepth}`}
          initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DUR.fast, ease: EASE.standard }}
          className="space-y-4"
        >
          <SummaryCard
            blocks={summaryBlocks}
            takeaways={activeTakeaways}
            recap={activeRecap}
            onSaveTakeaways={() => {
              const hasBookmarks = state.bookmarkedTakeaways.length > 0;
              const selected = hasBookmarks
                ? activeTakeaways.filter((_, index) => state.bookmarkedTakeaways.includes(index))
                : activeTakeaways;
              appendNote(formatNoteWithTakeaways(selected));
              onToast(
                hasBookmarks
                  ? "Bookmarked takeaways saved to notes."
                  : "Takeaways saved to notes.",
              );
            }}
            bookmarkedTakeaways={new Set(state.bookmarkedTakeaways)}
            onToggleBookmarkTakeaway={(index) => {
              const removing = state.bookmarkedTakeaways.includes(index);
              toggleBookmarkedTakeaway(index, activeTakeaways[index] ?? "");
              onToast(removing ? "Bookmark removed." : "Takeaway bookmarked.");
            }}
            fontScaleClass={textScaleClass}
            learningMode={learningMode}
            activationPrompt={activeActivationPrompt}
            selfCheckPrompts={activeSelfCheckPrompts}
            reflectionPrompts={activeReflectionPrompts}
            closingPrompt={activeClosingPrompt}
            onRecapVisible={markRecapSeen}
          />
          {isV21Chapter ? <TryThisNow text={chapter.tryThisNow} /> : null}
          {isV21Chapter && chapter.memorableLines && chapter.memorableLines.length > 0 ? (
            <MemorableLines lines={chapter.memorableLines} />
          ) : null}
          <ContinueButton
            ready={phaseCompletion.currentPhaseReady}
            onClick={() => setActiveTab("examples")}
            readyText="Continue to Examples"
            scrollPercent={phaseCompletion.scrollPercent}
            timeOnPhase={phaseCompletion.timeOnPhase}
            {...getPhaseThresholds(learningMode, "summary")}
          />
        </motion.div>
      )}

      {state.activeTab === "examples" && (
        <motion.div
          key={`examples-${activeDepth}`}
          initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DUR.fast, ease: EASE.standard }}
        >
          {patternSelectorEnabled && readerPatterns.length > 0 && (
            <div className="mb-6">
              <PatternSelector
                patterns={readerPatterns}
                selectedId={selectedPatternId}
                onSelect={handlePatternPick}
                fontScaleClass={textScaleClass}
              />
            </div>
          )}
          <ExamplesList
            examples={filteredExamples}
            filter={state.exampleFilter}
            onFilterChange={setExampleFilter}
            submissionPoints={engagementPoints}
            mySubmissions={userSubmissions}
            onSubmitScenario={handleSubmitScenario}
            fontScaleClass={textScaleClass}
            readingDepth={activeDepth}
            onScenarioInteraction={recordScenarioInteraction}
            onExpand={(revealedCount) =>
              trackReaderFunnel("example_expanded", {
                bookId,
                chapterNumber: chapter.order,
                revealedCount,
              })
            }
            pinnedExampleId={pinnedExampleId}
            chapterId={chapterId}
            bookId={bookId}
            chapterNumber={chapter.order}
            chapterTitle={chapter.title}
            fetchFailed={scenariosFetchFailed}
            onRetryFetch={retryScenarios}
          />
          {!commitmentsLoading &&
            chapter.implementationPlan?.ifThenPlans &&
            chapter.implementationPlan.ifThenPlans.length > 0 && (
              <div className="mt-6">
                <CommitmentPrompt
                  ifThenPlans={chapter.implementationPlan.ifThenPlans}
                  bookId={bookId}
                  chapterNumber={chapter.order}
                  fontScaleClass={textScaleClass}
                  onCommit={handleCommitment}
                  hasActiveCommitment={committedToChapter}
                  activeFollowUpDays={activeChapterCommitment?.followUpDays}
                  defaultSelectedPlan={planFromPattern ?? undefined}
                />
              </div>
            )}
          <ContinueButton
            ready={phaseCompletion.currentPhaseReady}
            onClick={() => setActiveTab("quiz")}
            readyText="Start the Quiz"
            scrollPercent={phaseCompletion.scrollPercent}
            timeOnPhase={phaseCompletion.timeOnPhase}
            {...getPhaseThresholds(learningMode, "examples")}
          />
        </motion.div>
      )}

      {state.activeTab === "quiz" && (
        <motion.div
          key={`quiz-${activeDepth}`}
          initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DUR.fast, ease: EASE.standard }}
        >
          <QuizPanel
            session={quiz.session}
            answers={quiz.answers}
            explanationOpen={quiz.explanationOpen}
            loading={quiz.loading}
            submitting={quiz.submitting}
            error={quiz.error}
            cooldownSeconds={quiz.cooldownSeconds}
            onAnswer={quiz.answerQuestion}
            onCheckAnswer={quiz.checkAnswer}
            onSubmit={onSubmitQuiz}
            onReviewSummary={() => setActiveTab("summary")}
            onRetry={onRetryQuiz}
            onContinueToPractice={onContinueToPractice}
            onToggleExplanation={quiz.toggleExplanation}
            learningMode={learningMode}
            questionFlow={bookPrefs.learning.questionPresentationStyle}
            shuffleQuestions={chapter.isStrictV12 ? false : bookPrefs.learning.shuffleQuestionOrder}
            retryIncorrectOnly={bookPrefs.learning.retryIncorrectOnly}
          />
          {quiz.session?.provisional && (
            <p
              className="text-cf-label-sm mt-2 flex items-center gap-1.5 text-(--cr-text-disabled)"
              role="status"
            >
              <span>{"\u23F3"}</span>
              Results saved locally — they&apos;ll sync and award points when you&apos;re back
              online.
            </p>
          )}
        </motion.div>
      )}
    </>
  );
}
