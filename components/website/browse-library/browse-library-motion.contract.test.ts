import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const source = (relativePath: string) =>
  readFileSync(path.join(process.cwd(), relativePath), "utf8");

test("catalog scrolling uses the shared OS and in-app reduced-motion signal", () => {
  const shelf = source(
    "components/website/browse-library/BrowseLibraryShelfRow.tsx",
  );
  const state = source(
    "components/website/browse-library/useBrowseLibraryState.ts",
  );

  for (const file of [shelf, state]) {
    assert.match(file, /usePrefersReducedMotion/);
    assert.match(file, /reducedMotion\s*\?\s*"auto"\s*:\s*"smooth"/);
  }
  assert.doesNotMatch(state, /matchMedia/);
});
