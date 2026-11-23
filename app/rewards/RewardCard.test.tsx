import "../../tests/_lib/dom";

import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { RewardCard } from "./RewardsPageClient";

afterEach(() => cleanup());

const REWARD = {
  rewardId: "pro_pass_7d",
  name: "7-Day Pro Pass",
  description: "One week of Pro.",
  costPoints: 2400,
  status: "available",
  pointsRemaining: 0,
} as unknown as Parameters<typeof RewardCard>[0]["reward"];

test("PROG-23: Redeem asks to confirm before spending points", () => {
  let redeemed = 0;
  const view = render(<RewardCard reward={REWARD} redeeming={false} onRedeem={() => { redeemed += 1; }} />);
  fireEvent.click(view.getByRole("button", { name: "Redeem" }));
  assert.equal(redeemed, 0);
  assert.ok(view.getByText("Spend 2,400 IP on 7-Day Pro Pass?"));
  fireEvent.click(view.getByRole("button", { name: "Cancel" }));
  assert.equal(redeemed, 0);
  fireEvent.click(view.getByRole("button", { name: "Redeem" }));
  fireEvent.click(view.getByRole("button", { name: "Confirm" }));
  assert.equal(redeemed, 1);
});

test("PROG-23: the confirmation takes focus, and Cancel or Escape hands it back to Redeem", () => {
  let redeemed = 0;
  const view = render(<RewardCard reward={REWARD} redeeming={false} onRedeem={() => { redeemed += 1; }} />);
  fireEvent.click(view.getByRole("button", { name: "Redeem" }));
  const confirm = view.getByRole("button", { name: "Confirm" });
  assert.equal(document.activeElement, confirm, "Confirm is focused when the question opens");
  assert.match(
    document.getElementById(confirm.getAttribute("aria-describedby") ?? "")?.textContent ?? "",
    /Spend 2,400 IP on 7-Day Pro Pass\?/,
    "Confirm is described by the question"
  );

  fireEvent.click(view.getByRole("button", { name: "Cancel" }));
  assert.equal(document.activeElement, view.getByRole("button", { name: "Redeem" }));

  fireEvent.click(view.getByRole("button", { name: "Redeem" }));
  fireEvent.keyDown(view.getByRole("button", { name: "Confirm" }), { key: "Escape" });
  assert.equal(view.queryByRole("button", { name: "Confirm" }), null, "Escape cancels");
  assert.equal(document.activeElement, view.getByRole("button", { name: "Redeem" }));
  assert.equal(redeemed, 0);
});

test("PROG-23: Confirm is disabled while a redeem is in flight", () => {
  let redeemed = 0;
  const view = render(<RewardCard reward={REWARD} redeeming={false} onRedeem={() => { redeemed += 1; }} />);
  fireEvent.click(view.getByRole("button", { name: "Redeem" }));
  view.rerender(<RewardCard reward={REWARD} redeeming onRedeem={() => { redeemed += 1; }} />);
  const confirm = view.getByRole("button", { name: "Confirm" }) as HTMLButtonElement;
  assert.equal(confirm.disabled, true);
  fireEvent.click(confirm);
  assert.equal(redeemed, 0);
});
