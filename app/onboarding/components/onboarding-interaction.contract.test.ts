import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { moveRadioSelectionByArrow } from "./TappableCard";

function source(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

function navigationTargets(count: number) {
  const events: string[] = [];
  const targets = Array.from({ length: count }, (_, index) => ({
    focus: () => events.push(`focus:${index}`),
    click: () => events.push(`select:${index}`),
  }));
  return { events, targets };
}

function matchCount(sourceText: string, pattern: RegExp): number {
  return sourceText.match(pattern)?.length ?? 0;
}

test("radio arrow navigation wraps, moves focus, and selects", () => {
  const cases: Array<{
    current: number;
    key: string;
    expected: number;
  }> = [
    { current: 0, key: "ArrowRight", expected: 1 },
    { current: 0, key: "ArrowDown", expected: 1 },
    { current: 0, key: "ArrowLeft", expected: 2 },
    { current: 0, key: "ArrowUp", expected: 2 },
    { current: 2, key: "ArrowRight", expected: 0 },
    { current: 2, key: "ArrowDown", expected: 0 },
  ];

  for (const { current, key, expected } of cases) {
    const { events, targets } = navigationTargets(3);
    assert.equal(moveRadioSelectionByArrow(targets, current, key), true);
    assert.deepEqual(events, [`focus:${expected}`, `select:${expected}`]);
  }

  const { events, targets } = navigationTargets(3);
  assert.equal(moveRadioSelectionByArrow(targets, 1, "Enter"), false);
  assert.deepEqual(events, []);

  assert.equal(moveRadioSelectionByArrow([], 0, "ArrowRight"), false);
  assert.equal(moveRadioSelectionByArrow(targets, -1, "ArrowRight"), false);
  assert.equal(moveRadioSelectionByArrow(targets, 3, "ArrowLeft"), false);
});

test("TappableCard exposes one-tab-stop and radio position contracts", () => {
  const tappableCard = source("app/onboarding/components/TappableCard.tsx");
  const motivation = source("app/onboarding/components/StepMotivation.tsx");
  const pace = source("app/onboarding/components/StepPace.tsx");

  assert.match(tappableCard, /tabStop: boolean/);
  assert.match(tappableCard, /positionInSet: number/);
  assert.match(tappableCard, /setSize: number/);
  assert.match(tappableCard, /aria-posinset=\{positionInSet\}/);
  assert.match(tappableCard, /aria-setsize=\{setSize\}/);
  assert.match(tappableCard, /tabIndex=\{disabled \? -1 : tabStop \? 0 : -1\}/);
  assert.match(tappableCard, /closest\('\[role="radiogroup"\]'\)/);
  assert.match(
    tappableCard,
    /\[role="radio"\]:not\(\[aria-disabled="true"\]\)/,
  );

  assert.equal(matchCount(motivation, /positionInSet=\{index \+ 1\}/g), 1);
  assert.equal(matchCount(motivation, /setSize=\{options\.length\}/g), 1);
  assert.equal(
    matchCount(
      motivation,
      /tabStop=\{isSelected \|\| \(!hasMotivation && index === 0\)\}/g,
    ),
    1,
  );

  assert.equal(matchCount(pace, /positionInSet=\{index \+ 1\}/g), 2);
  assert.equal(
    matchCount(pace, /setSize=\{(?:dailyGoal|chapterOrder)Options\.length\}/g),
    2,
  );
  assert.equal(
    matchCount(
      pace,
      /tabStop=\{isSelected \|\| \(!has(?:DailyGoal|ChapterOrder) && index === 0\)\}/g,
    ),
    2,
  );

  assert.match(tappableCard, /useReducedMotion\(\)/);
  assert.doesNotMatch(tappableCard, /\n\s+outline:/);
});

test("motivation waits for explicit Continue and flow focuses the next heading", () => {
  const motivation = source("app/onboarding/components/StepMotivation.tsx");
  const flow = source("app/onboarding/components/OnboardingFlow.tsx");

  assert.doesNotMatch(motivation, /advanceTimer|setTimeout/);
  assert.match(motivation, /<Button[\s\S]*disabled=\{!motivation\}/);
  assert.match(motivation, /onClick=\{onNext\}[\s\S]*Continue/);

  assert.match(flow, /pendingFocusStepRef/);
  assert.match(flow, /const handleNext = useCallback/);
  assert.match(flow, /querySelector<HTMLElement>\([\s\S]*h1, h2/);
  assert.match(flow, /heading\.focus\(\{ preventScroll: true \}\)/);
  assert.match(flow, /onAnimationComplete=\{handleStepAnimationComplete\}/);
  assert.match(flow, /<StepMotivation onNext=\{handleNext\}/);
});
