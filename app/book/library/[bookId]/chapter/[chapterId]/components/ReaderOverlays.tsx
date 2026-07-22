"use client";

import dynamic from "next/dynamic";
import { CheckCircle2, CloudOff, X } from "lucide-react";
import type { BookChapter, ReadingDepth } from "@/app/book/data/bookChapters";
import { buildShareCardUrl, buildShareText, performShare } from "@/app/book/_lib/share-card-url";
import { Dialog } from "@/components/ui/Dialog";
import type { useChapterQuiz } from "../hooks/useChapterQuiz";
import type { useReaderAccess } from "../hooks/useReaderAccess";
import type { useReaderExamples } from "../hooks/useReaderExamples";
import type { useReaderPhaseFlow } from "../hooks/useReaderPhaseFlow";
import type { useReaderProgress } from "../hooks/useReaderProgress";
import { PhaseInterstitial } from "./PhaseInterstitial";
import { SessionModeOverlay } from "./SessionModeOverlay";

const LazyChapterCompleteModal = dynamic(
  () => import("./ChapterCompleteModal").then((module) => module.ChapterCompleteModal),
  {
    loading: () => (
      <span className="sr-only" role="status">
        Loading chapter completion…
      </span>
    ),
  },
);
const LazyConfetti = dynamic(
  () => import("@/components/ui/Confetti").then((module) => module.Confetti),
  { loading: () => null },
);
const LazyAskBookDrawer = dynamic(
  () => import("@/app/book/components/AskBookDrawer").then((module) => module.AskBookDrawer),
  {
    loading: () => (
      <span className="sr-only" role="status">
        Loading Ask Raymond…
      </span>
    ),
  },
);
const LazyNotesDrawer = dynamic(
  () => import("./NotesDrawer").then((module) => module.NotesDrawer),
  {
    loading: () => (
      <span className="sr-only" role="status">
        Loading chapter notes…
      </span>
    ),
  },
);
const LazyPracticePhase = dynamic(
  () => import("./PracticePhase").then((module) => module.PracticePhase),
  {
    loading: () => (
      <span className="sr-only" role="status">
        Loading practice plan…
      </span>
    ),
  },
);

type ChapterLink = { id: string; order: number; title: string };

type Props = {
  bookId: string;
  chapterId: string;
  chapter: BookChapter;
  activeDepth: ReadingDepth;
  nextChapter?: ChapterLink;
  notesOpen: boolean;
  onNotesOpenChange: (open: boolean) => void;
  sessionMode: boolean;
  onSessionTourDone: () => void;
  showCompleteModal: boolean;
  onCompleteOpenChange: (open: boolean) => void;
  showShortcuts: boolean;
  onShortcutsOpenChange: (open: boolean) => void;
  toast: string | null;
  onToastChange: (toast: string | null) => void;
  onChapterCompleteNext: () => void;
  onChapterCompleteLibrary: () => void;
  access: ReturnType<typeof useReaderAccess>;
  progress: ReturnType<typeof useReaderProgress>;
  phaseFlow: ReturnType<typeof useReaderPhaseFlow>;
  chapterQuiz: ReturnType<typeof useChapterQuiz>;
  examples: ReturnType<typeof useReaderExamples>;
};

export function ReaderOverlays({
  bookId,
  chapterId,
  chapter,
  activeDepth,
  nextChapter,
  notesOpen,
  onNotesOpenChange,
  sessionMode,
  onSessionTourDone,
  showCompleteModal,
  onCompleteOpenChange,
  showShortcuts,
  onShortcutsOpenChange,
  toast,
  onToastChange,
  onChapterCompleteNext,
  onChapterCompleteLibrary,
  access,
  progress,
  phaseFlow,
  chapterQuiz,
  examples,
}: Props) {
  const { entry } = access;
  const { chapterProgress, readerInteractionsReady } = progress;
  const { state, setNotes, appendNote, syncFailed } = chapterProgress;
  const { interstitial, handleInterstitialComplete } = phaseFlow;
  const { quiz, justPassedThisSession } = chapterQuiz;
  const {
    viewerIdentity,
    chapterApplicationState,
    commitmentAvailable,
    handleCommitment,
    committedToChapter,
  } = examples;
  const activeTakeaways = chapter.takeawaysByDepth[activeDepth] ?? chapter.takeaways;
  const activePredictionPrompt =
    chapter.predictionPromptByDepth[activeDepth] ?? chapter.predictionPrompt;

  return (
    <>
      {notesOpen && (
        <LazyNotesDrawer
          open={notesOpen}
          onClose={() => onNotesOpenChange(false)}
          notes={state.notes}
          onNotesChange={setNotes}
          onAddNote={() => {
            appendNote(
              `\u2022 ${new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })} \u2014 `,
            );
          }}
          onExport={() => {
            if (!state.notes.trim()) {
              onToastChange("No notes to export.");
              return;
            }
            const content = `# Notes: ${chapter.title}\n\n${state.notes}`;
            const blob = new Blob([content], { type: "text/markdown" });
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = `notes-${chapterId}.md`;
            anchor.click();
            URL.revokeObjectURL(url);
            onToastChange("Notes exported.");
          }}
          onPinTakeaway={() => {
            appendNote(`Pinned takeaway: ${activeTakeaways[0] ?? ""}`);
            onToastChange("Takeaway pinned.");
          }}
        />
      )}

      {sessionMode && <SessionModeOverlay onDone={onSessionTourDone} />}

      {justPassedThisSession && (
        <LazyConfetti
          trigger={justPassedThisSession}
          origin="center"
          colors={["--cr-accent", "--cr-success", "--cr-warning"]}
        />
      )}

      {showCompleteModal && (
        <LazyChapterCompleteModal
          open={showCompleteModal}
          onClose={() => onCompleteOpenChange(false)}
          chapterTitle={chapter.title}
          chapterNumber={chapter.order}
          quizScore={quiz.session?.result?.scorePercent ?? 0}
          loopPipeline={quiz.lastLoopPipeline}
          applicationState={chapterApplicationState}
          commitmentAvailable={commitmentAvailable}
          hasNextChapter={Boolean(nextChapter)}
          onNext={onChapterCompleteNext}
          onLibrary={onChapterCompleteLibrary}
          onShare={async () => {
            const isBookComplete = !nextChapter;
            const params = isBookComplete
              ? {
                  type: "book" as const,
                  bookTitle: entry.title ?? bookId,
                  author: entry.author,
                  userName: viewerIdentity.displayName,
                }
              : {
                  type: "chapter" as const,
                  bookTitle: entry.title ?? bookId,
                  author: entry.author,
                  chapter: String(chapter.order),
                  takeaway: chapter.keyTakeawayCard ?? "",
                  userName: viewerIdentity.displayName,
                };
            return performShare({
              title: isBookComplete
                ? `Finished ${entry.title ?? bookId}`
                : `Chapter ${chapter.order} Complete`,
              text: buildShareText(params),
              url: buildShareCardUrl(params),
            });
          }}
        >
          <LazyPracticePhase
            keyTakeawayCard={chapter.keyTakeawayCard}
            implementationPlan={chapter.implementationPlan}
            reviewCards={chapter.reviewCards}
            predictionPrompt={activePredictionPrompt}
            fontScaleClass=""
            onContinueToNextChapter={onChapterCompleteNext}
            nextChapterLabel={
              nextChapter ? `Continue to Chapter ${nextChapter.order} \u2192` : "Finish Book \u2192"
            }
            bookmarkedTakeaways={state.bookmarkedTakeaways
              .filter((index) => index >= 0 && index < activeTakeaways.length)
              .map((index) => activeTakeaways[index]!)}
            chapterId={chapterId}
            bookId={bookId}
            chapterNumber={chapter.order}
            onBookmarkStep={(text) => {
              appendNote(`\u2022 Step: ${text}`);
              onToastChange("Step saved to notes.");
            }}
            onCommit={handleCommitment}
            hasActiveCommitment={committedToChapter}
            failureRecovery={chapter.experiencePlan?.failureRecovery}
            transferPrompt={chapter.experiencePlan?.transferPrompt}
            hideContinueCta
          />
        </LazyChapterCompleteModal>
      )}

      {showShortcuts && (
        <Dialog
          open={showShortcuts}
          onClose={() => onShortcutsOpenChange(false)}
          size="sm"
          ariaLabel="Keyboard shortcuts"
        >
          <div className="p-6">
            <h3 className="text-cf-body-lg font-semibold mb-4 text-(--cr-text-heading)">
              Keyboard Shortcuts
            </h3>
            <div className="space-y-3 text-cf-label text-(--cr-text-secondary)">
              {(
                [
                  ["1 \u2013 4", "Select quiz answer"],
                  ["Enter", "Submit answer"],
                  ["F", "Toggle focus mode"],
                  ["N", "Open notes"],
                  ["Esc", "Close drawers / overlays"],
                  ["?", "Show this overlay"],
                ] as const
              ).map(([key, description]) => (
                <div key={key} className="flex items-center justify-between">
                  <span>{description}</span>
                  <kbd className="px-2 py-0.5 rounded text-cf-label-sm font-mono bg-(--cr-bg-surface-3) border border-(--cr-glass-border) text-(--cr-text-heading)">
                    {key}
                  </kbd>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => onShortcutsOpenChange(false)}
              className="mt-5 w-full py-2 rounded-full text-cf-label bg-(--cr-bg-surface-3) text-(--cr-text-secondary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--cr-accent)_55%,transparent)]"
            >
              Close
            </button>
          </div>
        </Dialog>
      )}

      {interstitial && (
        <PhaseInterstitial
          from={interstitial.from}
          to={interstitial.to}
          onComplete={handleInterstitialComplete}
        />
      )}

      <div role="status" aria-live="polite" aria-atomic="true">
        {syncFailed && !toast && (
          <div className="pointer-events-none fixed bottom-[calc(env(safe-area-inset-bottom)+5rem)] left-1/2 z-40 -translate-x-1/2 inline-flex items-center gap-1.5 rounded-xl border border-(--cr-warning)/30 bg-(--cr-warning)/10 px-3 py-2 text-xs text-(--cr-warning)">
            <CloudOff className="h-3.5 w-3.5" />
            Changes saved locally only
          </div>
        )}
        {toast && (
          <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+1.5rem)] left-1/2 z-50 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-start gap-2 rounded-xl border border-(--cr-glass-border) bg-(--cr-bg-surface-2) px-3 py-2 text-sm text-(--cr-text-primary) shadow-[0_14px_28px_rgba(0,0,0,0.22)]">
            <span>{toast}</span>
            <button
              type="button"
              onClick={() => onToastChange(null)}
              aria-label="Dismiss notification"
              className="-mr-1 -mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-(--cr-text-secondary) hover:text-(--cr-text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--cr-accent)_60%,transparent)]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {state.focusMode && (
        <div className="pointer-events-none fixed bottom-[calc(env(safe-area-inset-bottom)+1.5rem)] left-6 hidden rounded-xl border border-(--cr-success)/30 bg-(--cr-success-bg) px-3 py-1.5 text-xs text-(--cr-success) md:inline-flex md:items-center md:gap-1.5">
          <CheckCircle2 className="h-4 w-4" />
          Focus mode enabled
        </div>
      )}
      {readerInteractionsReady && (
        <LazyAskBookDrawer
          bookId={bookId}
          bookTitle={entry.title ?? bookId}
          chapterNumber={chapter.order}
        />
      )}
    </>
  );
}
