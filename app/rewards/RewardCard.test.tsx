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
