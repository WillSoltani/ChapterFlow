import "../../tests/_lib/dom";

import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { cleanup, render } from "@testing-library/react";
import { DailyQuests } from "./DailyQuests";
import type { DailyQuest } from "./progressTypes";

// next/link's idle-callback fallback reads `self`, which jsdom globals omit.
Object.defineProperty(globalThis, "self", { configurable: true, writable: true, value: globalThis });

afterEach(() => cleanup());

const MINUTES_QUEST: DailyQuest = {
  id: "q1",
  title: "Read for 10 minutes",
  icon: "book",
  current: 0,
  target: 10,
  type: "progress",
  completed: false,
  historyOff: true,
  href: "/book/library/atomic-habits/chapter/3",
};

test("PROG-26: with reading history off, the quest link and the Settings link are not nested", () => {
  const view = render(<DailyQuests quests={[MINUTES_QUEST]} />);
  assert.equal(view.container.querySelector("a a"), null, "no link inside another link");
  const settings = view.getByRole("link", { name: /turn it on in Settings/ });
  assert.equal(settings.getAttribute("href"), "/book/settings");
  const quest = view.getByRole("link", { name: /Read for 10 minutes/ });
  assert.equal(quest.getAttribute("href"), "/book/library/atomic-habits/chapter/3");
  assert.equal(quest.contains(settings), false);
});
