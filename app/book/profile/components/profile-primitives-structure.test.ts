import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

const root = process.cwd();
const publicComponents = [
  "FadeIn",
  "AnimatedNumber",
  "SectionCard",
  "StatCard",
  "IdentityHeroBanner",
  "StickyMiniHeader",
  "MomentumCard",
  "MomentumEmptyState",
  "ActiveBookCard",
  "AchievementBadgeCard",
  "TimelineRow",
  "NotePreviewCard",
  "PinnedTakeawayCard",
  "HeatmapCalendar",
  "Sparkline",
  "ActiveDaysRing",
  "UpgradeCard",
  "ProStatusCard",
  "CompletionByModeChart",
  "QuizBarChart",
  "ProBadge",
  "UpNextPreview",
  "ThisWeekStrip",
  "CategoryMap",
  "StaggeredBadgeGrid",
  "StaggeredBadgeItem",
  "NewBadgeDot",
  "ProfileSkeleton",
  "SectionNav",
] as const;

test("profile primitives have one public implementation per file and no compatibility monolith", () => {
  const dir = resolve(root, "app/book/profile/components");
  assert.equal(existsSync(resolve(dir, "ProfilePrimitives.tsx")), false);
  for (const name of publicComponents) {
    const path = resolve(dir, `${name}.tsx`);
    assert.equal(existsSync(path), true, `${name}.tsx must exist`);
    assert.match(readFileSync(path, "utf8"), new RegExp(`export function ${name}\\b`));
  }

  const caller = readFileSync(resolve(root, "app/book/profile/BookProfileClient.tsx"), "utf8");
  const toastTest = readFileSync(resolve(root, "components/ui/Toast.consolidation.test.ts"), "utf8");
  assert.doesNotMatch(caller, /ProfilePrimitives/);
  assert.doesNotMatch(toastTest, /ProfilePrimitives/);
});
