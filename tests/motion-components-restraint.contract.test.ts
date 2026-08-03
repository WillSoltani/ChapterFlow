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
    .filter((relativePath) => !relativePath.includes(".test."))
    // The style-drift self-test briefly creates untracked __drift_* fixtures in
    // components/ while the Node test runner is executing this contract in
    // parallel. They are scanner inputs, not application sources, and may be
    // deleted between readdir and readFile; exclude that explicit fixture
    // namespace so the inventory remains deterministic.
    .filter((relativePath) => !path.basename(relativePath).startsWith("__drift_"));
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

test("the documented inventory covers every compiled Tailwind continuous loop", () => {
  const inventory = source("docs/RECALL_MOTION_INVENTORY.md");
  const tailwindContinuous = /\banimate-(?:pulse|spin|bounce)\b/g;
  const consumers = new Set(
    ["app", "components"]
      .flatMap(collectSourceFiles)
      .flatMap((relativePath) =>
        [...source(relativePath).matchAll(tailwindContinuous)].map(
          (match) => `\`${relativePath}\` — \`${match[0]}\``,
        ),
      ),
  );

  assert.ok(consumers.size > 0, "expected compiled Tailwind loop consumers");
  for (const consumer of consumers) {
    assert.ok(inventory.includes(consumer), `motion inventory missing ${consumer}`);
  }
  for (const requiredLiteral of [
    "`.animate-shimmer`",
    "`.bd-dot-pulse`",
    "`components/website/BookRequestForm.tsx`",
  ]) {
    assert.ok(inventory.includes(requiredLiteral), `motion inventory missing ${requiredLiteral}`);
  }
});

test("the one continuous Framer loop is reduced-motion-safe submitting feedback", () => {
  const requestForm = source("components/website/BookRequestForm.tsx");

  assert.match(requestForm, /usePrefersReducedMotion\(\)/);
  assert.match(requestForm, /formState === "submitting"[\s\S]*Submitting\.\.\./);
  // exactOptionalPropertyTypes (WS7-010 flag 4) forbids `animate={cond ? undefined : …}`
  // on framer's strict SVGMotionProps, so the reduced-motion guard is expressed as a
  // conditional prop spread instead — runtime-identical: when reduced, the `animate`
  // prop is absent (React drops it), so the continuous rotate loop never mounts.
  assert.match(
    requestForm,
    /\{\.\.\.\(reducedMotion\s*\?\s*\{\}\s*:\s*\{\s*animate:\s*\{\s*rotate:\s*360\s*\}\s*\}\)\}/,
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
  assert.match(chapterSteps, /role="list"[\s\S]*aria-label="Chapter learning steps"/);
  assert.match(chapterSteps, /aria-current=\{isCurrent \? "step" : undefined\}/);
  assert.match(chapterSteps, /data-current-marker/);

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
