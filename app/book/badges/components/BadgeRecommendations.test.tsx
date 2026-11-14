import "../../../../tests/_lib/dom";

import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { cleanup, render } from "@testing-library/react";
import { BadgeRecommendations } from "./BadgeRecommendations";
import type { BadgeWithProgress } from "../lib/badge-types";

// next/link's idle-callback fallback reads `self`, which jsdom globals omit.
Object.defineProperty(globalThis, "self", { configurable: true, writable: true, value: globalThis });

afterEach(() => cleanup());

const BADGE: BadgeWithProgress = {
  id: "rhythm-gold",
  name: "Rhythm Gold",
  description: "Hold a fourteen day streak.",
  narrative: "",
  category: "Consistency",
  tier: "gold",
  icon: "Flame",
  fpValue: 55,
  isSecret: false,
  criteria: { type: "streak", description: "days", target: 14 },
  relatedBadgeIds: [],
  evaluate: () => ({ current: 12, target: 14 }),
  isEarned: false,
  earnedDate: null,
  isDiscovered: true,
  current: 12,
  target: 14,
  percentage: 86,
};

test("C13: with a book in progress, Continue opens its resume chapter by number", () => {
  const view = render(
    <BadgeRecommendations
      recommendations={[BADGE]}
      onBadgeClick={() => {}}
      allEarned={false}
      continueTo={{ bookId: "atomic-habits", chapterNumber: 4 }}
    />,
  );
  const link = view.getByRole("link", { name: /Continue chapter 4/ });
  assert.equal(link.getAttribute("href"), "/book/library/atomic-habits/chapter/4");
});

test("without a book in progress the link keeps its old destination", () => {
  const view = render(
    <BadgeRecommendations recommendations={[BADGE]} onBadgeClick={() => {}} allEarned={false} />,
  );
  const link = view.getByRole("link", { name: /Continue reading/ });
  assert.equal(link.getAttribute("href"), "/dashboard");
});
