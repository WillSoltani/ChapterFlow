"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReadingDepth } from "@/app/book/data/bookChapters";
import type { ContentTone } from "@/app/book/settings/types/settings";
import { subscribeBookCache } from "@/lib/client/book-api-cache";
import { SETTINGS_KEY } from "@/lib/client/book-read-keys";
import {
  advanceQuizDepthHold,
  startQuizDepthHold,
  type PreferencesSaveStatusLike,
  type QuizDepthHold,
} from "../lib/reader-quiz-flow-core";

/** READER-12: the depth and tone the quiz uses. A mode change made on the Quiz
 *  tab goes through `changeOnQuiz`, which keeps the quiz on what it shows until
 *  the preferences save carrying the change lands (then the quiz reloads with
 *  the new mode). The rules live in `advanceQuizDepthHold`. */
export function useQuizDepthHold({
  activeDepth,
  activeTone,
  saveStatus,
  onSaveFailed,
}: {
  activeDepth: ReadingDepth;
  activeTone: ContentTone;
  saveStatus: PreferencesSaveStatusLike;
  onSaveFailed: () => void;
}) {
  const [hold, setHold] = useState<QuizDepthHold>(null);
  const [heldTone, setHeldTone] = useState<ContentTone>(activeTone);
  const deferredApply = useRef<(() => void) | null>(null);
  const onSaveFailedRef = useRef(onSaveFailed);
  useEffect(() => {
    onSaveFailedRef.current = onSaveFailed;
  }, [onSaveFailed]);

  useEffect(() => {
    const step = advanceQuizDepthHold(hold, saveStatus);
    if (step.hold === hold) return;
    if (step.apply) {
      const apply = deferredApply.current;
      deferredApply.current = null;
      apply?.();
    }
    if (step.failed) onSaveFailedRef.current();
    setHold(step.hold);
  }, [hold, saveStatus]);

  // A successful preferences save invalidates the settings read. Listen only
  // while this change's save is awaited (a save in flight before the change
  // was applied is ignored by the "await-idle" phase).
  const awaitingSave = hold !== null && hold.phase !== "await-idle";
  useEffect(() => {
    if (!awaitingSave) return;
    return subscribeBookCache(SETTINGS_KEY, (event) => {
      if (event.type === "invalidate") {
        setHold((current) => advanceQuizDepthHold(current, "landed").hold);
      }
    });
  }, [awaitingSave]);

  const changeOnQuiz = useCallback(
    (apply: () => void) => {
      const start = startQuizDepthHold(hold, activeDepth, saveStatus);
      if (!hold) setHeldTone(activeTone);
      if (start.applyNow) {
        deferredApply.current = null;
        apply();
      } else {
        deferredApply.current = apply;
      }
      setHold(start.hold);
    },
    [hold, activeDepth, activeTone, saveStatus],
  );

  return {
    quizDepth: hold?.depth ?? activeDepth,
    quizTone: hold ? heldTone : activeTone,
    changeOnQuiz,
  };
}
