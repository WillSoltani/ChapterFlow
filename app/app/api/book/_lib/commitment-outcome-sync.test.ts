import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Two-axis completion (feedback #4) — CommitmentOutcome drift guard.
 *
 * `CommitmentOutcome` ("helped" | "partly" | "didnt") is hard-coded in THREE places
 * that must stay in sync (recon found no single source they can share without a
 * client/server seam): the type, the PATCH validator, and the dashboard outcome
 * buttons. This reads each source and asserts the literal sets match, so adding a
 * fourth outcome (or renaming one) in just one place fails CI instead of silently
 * desyncing the funnel `helped` field. Run from repo root (npm run test).
 */

const CANONICAL = ["didnt", "helped", "partly"]; // sorted

function readRepo(rel: string): string {
  return readFileSync(path.join(process.cwd(), rel), "utf8");
}

function sortedUnique(values: string[]): string[] {
  return Array.from(new Set(values)).sort();
}

test("CommitmentOutcome type matches the canonical set", () => {
  const src = readRepo("app/app/api/book/_lib/types.ts");
  const match = src.match(/export type CommitmentOutcome\s*=\s*([^;]+);/);
  assert.ok(match, "CommitmentOutcome type declaration not found");
  const values = sortedUnique(
    [...match[1].matchAll(/"([a-z]+)"/g)].map((m) => m[1]),
  );
  assert.deepEqual(values, CANONICAL, "CommitmentOutcome type drifted");
});

test("PATCH validator matches the canonical set", () => {
  const src = readRepo(
    "app/app/api/book/me/commitments/[commitmentId]/route.ts",
  );
  const values = sortedUnique(
    [...src.matchAll(/body\.outcome === "([a-z]+)"/g)].map((m) => m[1]),
  );
  assert.deepEqual(values, CANONICAL, "PATCH outcome validator drifted");
});

test("dashboard outcome buttons match the canonical set", () => {
  const src = readRepo("components/workspace/WorkspacePage.tsx");
  const start = src.indexOf("Did it help?");
  assert.ok(start >= 0, "outcome buttons block not found");
  // The three { value: "..." } options live just below the "Did it help?" legend.
  const block = src.slice(start, start + 400);
  const values = sortedUnique(
    [...block.matchAll(/value:\s*"([a-z]+)"/g)].map((m) => m[1]),
  );
  assert.deepEqual(values, CANONICAL, "dashboard outcome buttons drifted");
});
