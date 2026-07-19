import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import { join } from "node:path";

const root = process.cwd();

function exists(path: string): boolean {
  return existsSync(join(root, path));
}

function source(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

function filesNamed(directory: string, basename: string): string[] {
  return readdirSync(join(root, directory), { withFileTypes: true }).flatMap((entry) => {
    const relativePath = join(directory, entry.name);
    if (entry.isDirectory()) return filesNamed(relativePath, basename);
    return entry.name === basename ? [relativePath] : [];
  });
}

test("mounted book-row files and exports are named by role", () => {
  assert.equal(exists("components/progress/BookRow.tsx"), false);
  assert.equal(exists("components/workspace/BookRow.tsx"), false);
  assert.equal(exists("components/progress/ProgressBookRows.tsx"), true);
  assert.equal(exists("components/workspace/WorkspaceBookRow.tsx"), true);

  const progressRows = source("components/progress/ProgressBookRows.tsx");
  assert.match(progressRows, /export function ActiveBookRow/);
  assert.match(progressRows, /export function CompletedBookRow/);
  assert.doesNotMatch(progressRows, /export function BookRow/);

  const workspaceRow = source("components/workspace/WorkspaceBookRow.tsx");
  assert.match(workspaceRow, /interface WorkspaceBookRowProps/);
  assert.match(workspaceRow, /export function WorkspaceBookRow/);
  assert.doesNotMatch(workspaceRow, /export function BookRow/);

  assert.match(
    source("components/progress/YourBooks.tsx"),
    /from "\.\/ProgressBookRows"/,
  );
  assert.match(
    source("components/workspace/WorkspacePage.tsx"),
    /import \{ WorkspaceBookRow \} from "\.\/WorkspaceBookRow"/,
  );
});

test("mounted progress-ring adapters are named by role", () => {
  assert.deepEqual(
    [...filesNamed("app", "ProgressRing.tsx"), ...filesNamed("components", "ProgressRing.tsx")].sort(),
    ["components/ui/ProgressRing.tsx"],
  );

  const adapters = [
    {
      path: "components/library/LibraryProgressRing.tsx",
      exportName: "LibraryProgressRing",
    },
    {
      path: "app/book/badges/components/BadgesProgressRing.tsx",
      exportName: "BadgesProgressRing",
    },
    {
      path: "app/book/library/[bookId]/components/BookHeroProgressRing.tsx",
      exportName: "BookHeroProgressRing",
    },
  ];

  for (const adapter of adapters) {
    assert.equal(exists(adapter.path), true, adapter.path);
    assert.match(source(adapter.path), new RegExp(`export function ${adapter.exportName}`));
    assert.doesNotMatch(source(adapter.path), /export function ProgressRing/);
  }

  assert.match(
    source("components/library/ActiveReads.tsx"),
    /import \{ LibraryProgressRing \} from "\.\/LibraryProgressRing"/,
  );
  assert.match(
    source("components/library/HeroRecommendation.tsx"),
    /import \{ LibraryProgressRing \} from "\.\/LibraryProgressRing"/,
  );
  assert.match(
    source("app/book/badges/components/BadgePageHeader.tsx"),
    /import \{ BadgesProgressRing \} from "\.\/BadgesProgressRing"/,
  );
  assert.match(
    source("app/book/library/[bookId]/components/BookHero.tsx"),
    /import \{ BookHeroProgressRing \} from "\.\/BookHeroProgressRing"/,
  );
});
