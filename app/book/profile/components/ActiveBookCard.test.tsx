import "../../../../tests/_lib/dom";

import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { ActiveBookCard } from "./ActiveBookCard";

afterEach(() => cleanup());

test("C13: the Profile Continue button names the chapter it opens", () => {
  let opened = 0;
  const view = render(
    <ActiveBookCard
      title="Deep Work"
      author="Cal Newport"
      bookId="deep-work"
      icon="D"
      progress={11}
      chapterLabel="CH.02 Why Fewer Focused Hours Beat a Longer Day"
      chapterNumber={2}
      eta="24 min"
      onContinue={() => {
        opened += 1;
      }}
    />,
  );
  const button = view.getByRole("button", { name: "Continue chapter 2" });
  fireEvent.click(button);
  assert.equal(opened, 1);
  assert.ok(view.getByText("CH.02 Why Fewer Focused Hours Beat a Longer Day"));
});
