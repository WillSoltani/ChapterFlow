import "../../../../../../../tests/_lib/dom";

import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { act, cleanup, renderHook } from "@testing-library/react";
import type { ReadingDepth } from "@/app/book/data/bookChapters";
import type { ContentTone } from "@/app/book/settings/types/settings";
import { invalidateBookCache } from "@/lib/client/book-api-cache";
import { SETTINGS_KEY } from "@/lib/client/book-read-keys";
import type { PreferencesSaveStatusLike } from "../lib/reader-quiz-flow-core";
import { useQuizDepthHold } from "./useQuizDepthHold";

afterEach(cleanup);

type Props = {
  activeDepth: ReadingDepth;
  activeTone: ContentTone;
  saveStatus: PreferencesSaveStatusLike;
};

function setup(initial: Props) {
  let failures = 0;
  const view = renderHook(
    (props: Props) => useQuizDepthHold({ ...props, onSaveFailed: () => (failures += 1) }),
    { initialProps: initial },
  );
  return { view, failures: () => failures };
}

// What useBookPreferences does when a settings save succeeds.
const saveLands = () => act(() => invalidateBookCache(SETTINGS_KEY));

test("the quiz keeps its depth and tone until the change's save lands", () => {
  const { view } = setup({ activeDepth: "simple", activeTone: "gentle", saveStatus: "saved" });
  let applied = 0;
  act(() => view.result.current.changeOnQuiz(() => (applied += 1)));
  assert.equal(applied, 1);
  view.rerender({ activeDepth: "deeper", activeTone: "competitive", saveStatus: "saved" });
  assert.equal(view.result.current.quizDepth, "simple");
  assert.equal(view.result.current.quizTone, "gentle");
  // "saving" and "saved" batched into one render: the status never changes.
  view.rerender({ activeDepth: "deeper", activeTone: "competitive", saveStatus: "saved" });
  assert.equal(view.result.current.quizDepth, "simple");
  saveLands();
  assert.equal(view.result.current.quizDepth, "deeper");
  assert.equal(view.result.current.quizTone, "competitive");
});

test("a save in flight at confirm time delays the change; a failed save reports once", () => {
  const { view, failures } = setup({
    activeDepth: "standard",
    activeTone: "gentle",
    saveStatus: "saving",
  });
  let applied = 0;
  act(() => view.result.current.changeOnQuiz(() => (applied += 1)));
  assert.equal(applied, 0);
  saveLands(); // the earlier save: not this change's
  view.rerender({ activeDepth: "standard", activeTone: "gentle", saveStatus: "saved" });
  assert.equal(applied, 1);
  assert.equal(view.result.current.quizDepth, "standard");
  view.rerender({ activeDepth: "simple", activeTone: "gentle", saveStatus: "saving" });
  view.rerender({ activeDepth: "simple", activeTone: "gentle", saveStatus: "error" });
  assert.equal(failures(), 1);
  assert.equal(view.result.current.quizDepth, "standard");
  view.rerender({ activeDepth: "simple", activeTone: "gentle", saveStatus: "saving" });
  saveLands();
  assert.equal(failures(), 1);
  assert.equal(view.result.current.quizDepth, "simple");
});

test("without a change the quiz follows the reader's depth and tone", () => {
  const { view } = setup({ activeDepth: "simple", activeTone: "gentle", saveStatus: "idle" });
  view.rerender({ activeDepth: "deeper", activeTone: "competitive", saveStatus: "saving" });
  saveLands();
  assert.equal(view.result.current.quizDepth, "deeper");
  assert.equal(view.result.current.quizTone, "competitive");
});
