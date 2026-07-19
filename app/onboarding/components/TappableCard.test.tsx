import "../../../tests/_lib/dom";

import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { cleanup, fireEvent, render } from "@testing-library/react";
import TappableCard from "./TappableCard";

afterEach(cleanup);

test("TappableCard supports pointer and keyboard selection", () => {
  let selections = 0;
  const view = render(
    <TappableCard selected={false} onSelect={() => {
      selections += 1;
    }}>
      Read more consistently
    </TappableCard>,
  );
  const card = view.getByRole("radio", { name: "Read more consistently" });

  assert.equal(card.getAttribute("aria-checked"), "false");
  fireEvent.click(card);
  fireEvent.keyDown(card, { key: "Enter" });
  fireEvent.keyDown(card, { key: " " });
  assert.equal(selections, 3);
});

test("TappableCard removes disabled choices from the tab order", () => {
  let selections = 0;
  const view = render(
    <TappableCard selected disabled onSelect={() => {
      selections += 1;
    }}>
      Disabled choice
    </TappableCard>,
  );
  const card = view.getByRole("radio", { name: "Disabled choice" });

  assert.equal(card.getAttribute("aria-checked"), "true");
  assert.equal(card.getAttribute("aria-disabled"), "true");
  assert.equal(card.getAttribute("tabindex"), "-1");
  fireEvent.click(card);
  fireEvent.keyDown(card, { key: "Enter" });
  assert.equal(selections, 0);
});
