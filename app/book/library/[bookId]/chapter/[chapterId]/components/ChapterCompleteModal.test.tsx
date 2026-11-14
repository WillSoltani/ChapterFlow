import "../../../../../../../tests/_lib/dom";

import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { cleanup, render } from "@testing-library/react";
import { ChapterCompleteModal } from "./ChapterCompleteModal";

afterEach(() => cleanup());

test("READER-13: Open Next Chapter comes before the optional practice section", () => {
  const view = render(
    <ChapterCompleteModal
      open
      onClose={() => {}}
      chapterTitle="Two"
      chapterNumber={2}
      quizScore={80}
      loopPipeline={null}
      hasNextChapter
      onNext={() => {}}
      onLibrary={() => {}}
    >
      <p>Practice section</p>
    </ChapterCompleteModal>,
  );
  const next = view.getByRole("button", { name: /Open Next Chapter/ });
  const practice = view.getByText("Practice section");
  assert.ok(
    next.compareDocumentPosition(practice) & Node.DOCUMENT_POSITION_FOLLOWING,
    "practice renders after the Open Next Chapter button",
  );
});
