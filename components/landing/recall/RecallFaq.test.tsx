import "../../../tests/_lib/dom";

import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { RecallFaq } from "./RecallFaq";
import { RECALL_FAQ } from "./recall-faq-data";

afterEach(cleanup);

test("RecallFaq keeps exactly one answer expanded", () => {
  const view = render(<RecallFaq />);
  const first = view.getByRole("button", { name: RECALL_FAQ[0].q });
  const second = view.getByRole("button", { name: RECALL_FAQ[1].q });

  assert.equal(first.getAttribute("aria-expanded"), "false");
  assert.equal(second.getAttribute("aria-expanded"), "false");

  fireEvent.click(first);
  assert.equal(first.getAttribute("aria-expanded"), "true");
  assert.equal(
    document.getElementById(first.getAttribute("aria-controls")!)?.hasAttribute("inert"),
    false,
  );

  fireEvent.click(second);
  assert.equal(first.getAttribute("aria-expanded"), "false");
  assert.equal(second.getAttribute("aria-expanded"), "true");

  fireEvent.click(second);
  assert.equal(second.getAttribute("aria-expanded"), "false");
});
