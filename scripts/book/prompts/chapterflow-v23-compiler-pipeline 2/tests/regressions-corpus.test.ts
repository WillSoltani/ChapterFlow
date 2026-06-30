/**
 * Self-validation for the labeled regression corpus (tests/fixtures/regressions.ts).
 * Guarantees: (1) every seeded TRUE-POSITIVE span is VERBATIM in its source book
 * (so a typo can't silently break a Phase-1 gate's calibration), and (2) the
 * taxonomy contract holds — EI/testimonial spans are not mislabeled under f2.
 * Live packages absent on a machine (CI) are skip()ped, never failed.
 */
import assert from "node:assert/strict";

import { test, skip } from "./harness.js";
import {
  REGRESSIONS,
  EI_REGRESSION,
  FACTUAL_MISATTRIBUTION_CANDIDATES,
  bookText,
  type BadSpan,
  type SourceBook,
} from "./fixtures/regressions.js";

function allSpans(): BadSpan[] {
  return [
    ...EI_REGRESSION,
    ...FACTUAL_MISATTRIBUTION_CANDIDATES,
    ...Object.values(REGRESSIONS).flat(),
  ];
}

const byBook = new Map<SourceBook, BadSpan[]>();
for (const s of allSpans()) {
  const list = byBook.get(s.book) ?? [];
  list.push(s);
  byBook.set(s.book, list);
}

for (const [book, spans] of byBook) {
  const text = bookText(book);
  if (text === null) {
    skip(`regressions: ${book} spans verbatim (${spans.length})`, `${book} package not present on this machine`);
    continue;
  }
  test(`regressions: every ${book} span is verbatim (${spans.length})`, () => {
    const missing = spans
      .filter((s) => !text.includes(s.span))
      .map((s) => `  ${s.source}: "${s.span.slice(0, 70)}…"`);
    assert.equal(missing.length, 0, `non-verbatim ${book} spans:\n${missing.join("\n")}`);
  });
}

test("regressions: taxonomy — f2 is contested-science, not testimonial (EI lives in EI_REGRESSION)", () => {
  const f2 = REGRESSIONS.f2.map((s) => s.span).join(" ");
  assert.ok(
    !/['’]s\s+(?:[\w'’-]+\s+){0,2}report\b/i.test(f2),
    "f2 must hold contested-science spans; testimonial 'X's report' spans belong in EI_REGRESSION",
  );
  assert.ok(REGRESSIONS.f2.length >= 1, "f2 should be seeded");
  assert.ok(EI_REGRESSION.length >= 1, "EI_REGRESSION should guard the shipped EI gate");
});

test("regressions: no seeded span is empty or whitespace", () => {
  for (const s of allSpans()) assert.ok(s.span.trim().length > 10, `degenerate span at ${s.source}`);
});
