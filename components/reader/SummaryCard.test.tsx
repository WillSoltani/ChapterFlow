import "../../tests/_lib/dom";

import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { cleanup, render } from "@testing-library/react";
import { SummaryCard } from "./SummaryCard";

afterEach(cleanup);

function card(overrides: Partial<React.ComponentProps<typeof SummaryCard>> = {}) {
  return (
    <SummaryCard
      blocks={[]}
      takeaways={[]}
      onSaveTakeaways={() => {}}
      bookmarkedTakeaways={new Set()}
      onToggleBookmarkTakeaway={() => {}}
      fontScaleClass=""
      {...overrides}
    />
  );
}

test("the no-retries note uses the depth name the reader sees", () => {
  const view = render(card({ learningMode: "challenge", modeLabel: "Deeper" }));
  assert.ok(view.getByText("Deeper: no retries on the quiz"));
  assert.equal(view.queryByText(/Challenge mode/), null);
});

test("without a depth name the note names no mode", () => {
  const view = render(card({ learningMode: "challenge" }));
  assert.ok(view.getByText("No retries on the quiz"));
  assert.equal(view.queryByText(/Challenge mode/), null);
});

test("other modes show no note", () => {
  const view = render(card({ learningMode: "standard", modeLabel: "Deeper" }));
  assert.equal(view.queryByText(/no retries/i), null);
});
