import "../../../../tests/_lib/dom";

import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { cleanup, fireEvent, render, waitFor, within } from "@testing-library/react";
import { ProFeatureCard } from "./ProFeatureCard";

afterEach(() => {
  cleanup();
  document.body.style.overflow = "";
  document.body.style.paddingRight = "";
});

test("ACCT-09: the decorative card border lets taps through to Learn more", () => {
  const view = render(<ProFeatureCard icon="*" title="Text-to-speech" description="Listen." />);
  const learnMore = view.getByRole("button", { name: /Learn more/ });
  const card = learnMore.parentElement as HTMLElement;
  // Every absolutely positioned layer drawn over the card must ignore the
  // pointer, or it sits on top of the button and swallows the tap.
  const overlays = Array.from(card.children).filter((el) => /(^|\s)absolute(\s|$)/.test(el.className));
  assert.ok(overlays.length > 0, "the card has its decorative border layer");
  for (const el of overlays) {
    assert.match(el.className, /(^|\s)pointer-events-none(\s|$)/, "the overlay ignores the pointer");
    assert.equal(el.getAttribute("aria-hidden"), "true");
  }
});

test("ACCT-12: the Pro feature dialog says Upgrade to Pro, with the trial for new subscribers", async () => {
  let upgrades = 0;
  const view = render(
    <ProFeatureCard icon="*" title="Text-to-speech" description="Listen." onUpgrade={() => (upgrades += 1)} />,
  );
  fireEvent.click(view.getByRole("button", { name: /Learn more/ }));
  const dialog = await waitFor(() => view.getByRole("dialog"));
  assert.match(dialog.textContent ?? "", /New subscribers get 14 days free\./);
  assert.doesNotMatch(dialog.textContent ?? "", /Start 14-day free trial/);
  fireEvent.click(within(dialog).getByRole("button", { name: "Upgrade to Pro" }));
  assert.equal(upgrades, 1);
});
