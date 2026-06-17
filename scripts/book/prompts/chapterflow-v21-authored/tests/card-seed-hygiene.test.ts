/**
 * Card-seed hygiene. The authoring card prints each dealt form's `.example` string
 * VERBATIM, and blind parallel writers copy it — so no example may itself MODEL a
 * pattern a book-wide gate bans. The slip this guards: schedule-event's example
 * carried "...tomorrow at 9:30...", and a copied "9:30" stamps book-wide → BP29
 * timing_anchor_stamping (a barrier-actionable major), the same root cause as the
 * de-seeded quiz/venue seeds. Lock it: no pedagogy-palette example may contain a
 * literal HH:MM clock-stamp.
 */

import assert from "node:assert/strict";
import { readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { test } from "./harness.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PALETTES = resolve(__dirname, "../config/pedagogy-palettes.json");

function collectExamples(node: unknown, out: string[]): void {
  if (Array.isArray(node)) {
    for (const x of node) collectExamples(x, out);
    return;
  }
  if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (k === "example" && typeof v === "string") out.push(v);
      else collectExamples(v, out);
    }
  }
}

test("no pedagogy-palette example seeds a literal HH:MM clock-stamp (BP29) — the card prints .example verbatim", () => {
  const raw = JSON.parse(readFileSync(PALETTES, "utf8"));
  const examples: string[] = [];
  collectExamples(raw, examples);
  assert.ok(examples.length > 5, `expected to find example strings, found ${examples.length}`);
  const offenders = examples.filter((e) => /\b\d{1,2}:\d{2}\b/.test(e));
  assert.deepEqual(
    offenders,
    [],
    `a card-printed example must not seed a HH:MM clock (a copied clock stamps book-wide → BP29): ${offenders.join(" | ")}`,
  );
});
