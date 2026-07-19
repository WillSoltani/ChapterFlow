import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { join } from "node:path";

const root = process.cwd();

function exists(path: string): boolean {
  return existsSync(join(root, path));
}

function source(path: string): string {
  return readFileSync(join(root, path), "utf8");
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
