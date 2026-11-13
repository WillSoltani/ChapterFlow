import "../../../../tests/_lib/dom";

import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { cleanup, fireEvent, render } from "@testing-library/react";
import type { ComponentProps } from "react";
import type { PricingTier } from "@/app/book/hooks/useBookEntitlements";
import { SubscriptionCard } from "./SubscriptionCard";

afterEach(() => {
  cleanup();
});

const TIERS: PricingTier[] = [
  { interval: "monthly", price: "$7.99", label: "Monthly", period: "month" },
  { interval: "annual", price: "$5.99", label: "Annual", annualTotal: "$71.88", period: "year" },
  { interval: "annual_upfront", price: "$59.99", label: "Annual upfront", period: "year" },
];

type Props = ComponentProps<typeof SubscriptionCard>;

function props(overrides: Partial<Props> = {}): Props {
  return {
    plan: "FREE",
    freeBookSlots: 2,
    price: "$7.99/month",
    onUpgrade: async () => null,
    onManage: async () => null,
    onRedeemKey: async () => null,
    ...overrides,
  };
}

function checked(view: ReturnType<typeof render>) {
  return view
    .getAllByRole("radio")
    .filter((r) => r.getAttribute("aria-checked") === "true")
    .map((r) => r.textContent ?? "");
}

test("ACCT-11: the plan picked on /pricing is selected once the tiers arrive", () => {
  const view = render(<SubscriptionCard {...props({ initialInterval: "monthly" })} />);
  view.rerender(<SubscriptionCard {...props({ initialInterval: "monthly", pricingTiers: TIERS })} />);
  const selected = checked(view);
  assert.equal(selected.length, 1);
  assert.match(selected[0]!, /^Monthly/);
});

test("ACCT-11: annual upfront from /pricing stays selected", () => {
  const view = render(<SubscriptionCard {...props({ initialInterval: "annual_upfront" })} />);
  view.rerender(
    <SubscriptionCard {...props({ initialInterval: "annual_upfront", pricingTiers: TIERS })} />,
  );
  assert.match(checked(view)[0]!, /^Annual upfront/);
});

test("ACCT-11: with no plan hint, or one not offered, Annual is the default once tiers arrive", () => {
  const view = render(<SubscriptionCard {...props()} />);
  view.rerender(<SubscriptionCard {...props({ pricingTiers: TIERS.slice(0, 2) })} />);
  assert.match(checked(view)[0]!, /^Annual/);
  cleanup();

  const hinted = render(<SubscriptionCard {...props({ initialInterval: "annual_upfront" })} />);
  hinted.rerender(
    <SubscriptionCard {...props({ initialInterval: "annual_upfront", pricingTiers: TIERS.slice(0, 2) })} />,
  );
  assert.match(checked(hinted)[0]!, /^Annual/);
});

test("ACCT-11: a choice the reader made is kept when the tiers change", () => {
  const view = render(
    <SubscriptionCard {...props({ initialInterval: "annual", pricingTiers: TIERS.slice(0, 2) })} />,
  );
  fireEvent.click(view.getAllByRole("radio")[0]!); // Monthly
  view.rerender(<SubscriptionCard {...props({ initialInterval: "annual", pricingTiers: TIERS })} />);
  assert.match(checked(view)[0]!, /^Monthly/);
});

test("ACCT-10: gift Pro shows when it ends and no Manage button", () => {
  const view = render(
    <SubscriptionCard
      {...props({ plan: "PRO", proSource: "gift_code", currentPeriodEnd: "2026-12-04T12:00:00.000Z" })}
    />,
  );
  assert.match(view.container.textContent ?? "", /Pro until/);
  assert.doesNotMatch(view.container.textContent ?? "", /Next renewal/);
  assert.equal(view.queryByRole("button", { name: /Manage subscription/ }), null);
});

test("ACCT-10: license Pro ends on the license expiry; admin Pro shows no billing line", () => {
  const license = render(
    <SubscriptionCard
      {...props({
        plan: "PRO",
        proSource: "license",
        licenseExpiresAt: "2027-03-01T12:00:00.000Z",
        currentPeriodEnd: "2026-12-04T12:00:00.000Z",
      })}
    />,
  );
  assert.match(license.container.textContent ?? "", /Pro until .*2027/);
  assert.equal(license.queryByRole("button", { name: /Manage subscription/ }), null);
  cleanup();

  const admin = render(<SubscriptionCard {...props({ plan: "PRO", proSource: "admin" })} />);
  assert.doesNotMatch(admin.container.textContent ?? "", /Monthly billing|renewal|until/);
  assert.equal(admin.queryByRole("button", { name: /Manage subscription/ }), null);
});

test("ACCT-10: a Stripe subscriber keeps the renewal date and Manage", () => {
  const view = render(
    <SubscriptionCard
      {...props({ plan: "PRO", proSource: "stripe", currentPeriodEnd: "2026-12-04T12:00:00.000Z" })}
    />,
  );
  assert.match(view.container.textContent ?? "", /Next renewal/);
  assert.ok(view.getByRole("button", { name: /Manage subscription/ }));
});
