import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const root = process.cwd();
const source = (relativePath: string) =>
  readFileSync(path.join(root, relativePath), "utf8");

function collectSourceFiles(relativeDirectory: string): string[] {
  return readdirSync(path.join(root, relativeDirectory), { withFileTypes: true })
    .flatMap((entry) => {
      const relativePath = path.posix.join(relativeDirectory, entry.name);
      return entry.isDirectory() ? collectSourceFiles(relativePath) : [relativePath];
    })
    .filter((relativePath) => /\.(?:css|ts|tsx)$/.test(relativePath))
    .filter((relativePath) => !relativePath.includes(".test."));
}

test("non-global sources have exactly one stateful continuous declaration", () => {
  const continuousMotion =
    /animation(?:-iteration-count)?\s*:[^;\n}]*\binfinite\b|repeat\s*:\s*Infinity\b|animate-\[[^\]\n]*\binfinite\b/gi;
  const declarations = ["app", "components"]
    .flatMap(collectSourceFiles)
    .filter((relativePath) => relativePath !== "app/globals.css")
    .flatMap((relativePath) =>
      [...source(relativePath).matchAll(continuousMotion)].map(
        (match) => `${relativePath}:${match[0].replace(/\s+/g, " ")}`,
      ),
    );

  assert.deepEqual(declarations, [
    "components/website/BookRequestForm.tsx:repeat: Infinity",
  ]);
});

test("the one continuous Framer loop is reduced-motion-safe submitting feedback", () => {
  const requestForm = source("components/website/BookRequestForm.tsx");

  assert.match(requestForm, /usePrefersReducedMotion\(\)/);
  assert.match(requestForm, /formState === "submitting"[\s\S]*Submitting\.\.\./);
  assert.match(
    requestForm,
    /animate=\{reducedMotion\s*\?\s*undefined\s*:\s*\{\s*rotate:\s*360\s*\}\}/,
  );
  assert.match(requestForm, /aria-hidden="true"/);
});

test("loading skeleton uses one canonical stateful shimmer", () => {
  const skeleton = source("app/book/profile/components/ProfileSkeletonShimmer.tsx");

  assert.match(skeleton, /animate-shimmer/);
  assert.doesNotMatch(skeleton, /animate-pulse|@keyframes|animation\s*:/);
});

test("achievement and marketing components no longer opt into global ambient loops", () => {
  const expectations: ReadonlyArray<readonly [string, RegExp]> = [
    ["components/progress/StreakDisplay.tsx", /flame-pulse/],
    ["components/library/BookCard.tsx", /badge-glow/],
    ["app/book/badges/components/BadgeCard.tsx", /badge-icon-pulse|badge-shimmer|secret-badge-icon/],
    ["app/book/badges/components/BadgeDetailModal.tsx", /badge-shimmer|secret-badge-icon/],
    ["app/book/library/[bookId]/components/ChapterCard.tsx", /bd-chapter-shimmer/],
    ["app/book/settings/components/controls/CardSelector.tsx", /animate-pulse/],
    ["app/book/settings/components/PersonalizationMeter.tsx", /animate-pulse|animate-\[[^\]]*shimmer/],
    ["app/book/settings/components/ProBadge.tsx", /proShimmer/],
  ];

  for (const [relativePath, prohibited] of expectations) {
    assert.doesNotMatch(source(relativePath), prohibited, relativePath);
  }

  assert.equal(
    existsSync(path.join(root, "components/ui/FlameIcon.module.css")),
    false,
    "dead FlameIcon CSS module should be deleted",
  );
});

test("remaining state pulses have an equivalent non-motion cue", () => {
  const chapterSteps = source("app/book/library/[bookId]/components/StepIndicators.tsx");
  assert.match(chapterSteps, /isCurrent[\s\S]*bd-dot-pulse/);
  assert.match(chapterSteps, /\? `\$\{label\}: in progress`/);

  const tour = source(
    "app/book/library/[bookId]/chapter/[chapterId]/components/SessionModeOverlay.tsx",
  );
  assert.match(tour, /isActive[\s\S]*prefersReducedMotion \? "" : "animate-pulse"/);

  const audio = source(
    "app/book/library/[bookId]/chapter/[chapterId]/components/AudioPlayer.tsx",
  );
  assert.match(audio, /playing \? <Volume2[^>]*animate-pulse/);
  assert.match(audio, /playing \? "Now Playing"/);
});
