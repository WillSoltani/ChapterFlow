import "../../tests/_lib/dom";

import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { cleanup, render } from "@testing-library/react";
import { Toast, type ToastPresentation } from "./Toast";

afterEach(cleanup);

const presentations: ToastPresentation[] = ["default", "saved", "celebration"];

for (const presentation of presentations) {
  test(`${presentation} toast keeps one live region mounted and announces the message`, () => {
    const view = render(<Toast open={false} message="Saved" presentation={presentation} />);
    const region = view.getByRole("status");
    assert.equal(region.textContent, "");
    assert.equal(region.getAttribute("aria-live"), "polite");

    view.rerender(<Toast open message="Saved" detail="Nice work" presentation={presentation} />);
    // Same element before and after, so assistive tech sees the text change.
    assert.equal(view.getByRole("status"), region);
    assert.match(region.textContent ?? "", /Saved/);
    assert.equal(view.getAllByRole("status").length, 1);

    // The visual toast is hidden from the accessibility tree; only the live region reads.
    const visual = view.container.querySelector("[aria-hidden='true']");
    assert.ok(visual);
    assert.match(visual.textContent ?? "", /Saved/);

    view.rerender(<Toast open={false} message="Saved" presentation={presentation} />);
    assert.equal(view.getByRole("status"), region);
    assert.equal(region.textContent, "");
  });
}

test("on phones the toast sits above the bottom tab bar", () => {
  for (const presentation of ["default", "saved"] as const) {
    const view = render(<Toast open message="Saved" presentation={presentation} />);
    const visual = view.container.querySelector("[aria-hidden='true']");
    assert.ok(visual);
    const positioned = visual.closest(".fixed");
    assert.ok(positioned);
    assert.match(positioned.className, /bottom-\[calc\(5\.5rem\+env\(safe-area-inset-bottom\)\)\]/);
    assert.match(positioned.className, /md:bottom-/);
    cleanup();
  }
});

test("the celebration toast uses the app's tokens", () => {
  const view = render(<Toast open message="Level up" detail="+50" presentation="celebration" />);
  const visual = view.container.querySelector("[aria-hidden='true']") as HTMLElement | null;
  assert.ok(visual);
  const markup = `${visual.className} ${visual.getAttribute("style") ?? ""}`;
  assert.doesNotMatch(markup, /bg-glass|border-emphasis|accent-amber|shadow-modal|text-heading/);
});
