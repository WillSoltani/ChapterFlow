import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildStarterPrescription,
  coerceMotivation,
  INTEREST_SIGNALS,
  type PrescriptionCatalogBook,
} from "./starter-prescription-core";
import { INTEREST_SIGNALS as ONBOARDING_INTEREST_SIGNALS } from "@/app/onboarding/data/books";

/* ── Fixture: a small slice of catalog-shaped books, including the three the
 * legacy hardcoded BOOK_META map knew about AND books outside it (the case that
 * triggered defect H17). ── */
const CATALOG: PrescriptionCatalogBook[] = [
  {
    id: "crucial-conversations",
    title: "Crucial Conversations",
    author: "Joseph Grenny et al.",
    category: "Communication",
    categories: ["Communication"],
    difficulty: "Medium",
    tags: ["communication", "negotiation", "conflict-resolution"],
  },
  {
    id: "thinking-fast-and-slow",
    title: "Thinking, Fast and Slow",
    author: "Daniel Kahneman",
    category: "Psychology",
    categories: ["Psychology", "Decision Making"],
    difficulty: "Hard",
    tags: ["psychology", "decision-making", "bias"],
  },
  {
    id: "the-almanack-of-naval-ravikant",
    title: "The Almanack of Naval Ravikant",
    author: "Eric Jorgenson",
    category: "Philosophy",
    categories: ["Philosophy"],
    difficulty: "Medium",
    tags: ["philosophy", "investing"],
  },
  {
    id: "atomic-habits",
    title: "Atomic Habits",
    author: "James Clear",
    category: "Productivity",
    categories: ["Productivity", "Self Improvement"],
    difficulty: "Medium",
    tags: ["habits", "habit-formation", "focus"],
  },
  {
    id: "deep-work",
    title: "Deep Work",
    author: "Cal Newport",
    category: "Productivity",
    categories: ["Productivity"],
    difficulty: "Medium",
    tags: ["focus", "attention", "productivity"],
  },
];

const NOW = new Date("2026-06-24T00:00:00.000Z");

/* ── REGRESSION (H17): a shelf of books outside the legacy 3-entry BOOK_META map
 * must recommend one of the books the user ACTUALLY selected — never fall back to
 * crucial-conversations / thinking-fast-and-slow / the-almanack-of-naval-ravikant.
 *
 * Before the fix, candidateIds = shelf ∩ {3 hardcoded} = [] → fell back to the
 * 3 hardcoded books, so bookId would be one of those three. ── */
test("H17: shelf of non-legacy books recommends from the shelf, not the 3 hardcoded titles", () => {
  const shelf = ["atomic-habits", "deep-work"];
  const result = buildStarterPrescription({
    motivation: "personal",
    interests: ["habits", "productivity"],
    starterShelf: shelf,
    catalog: CATALOG,
    now: NOW,
  });

  assert.ok(result, "expected a prescription");
  assert.ok(
    shelf.includes(result!.bookId),
    `recommended ${result!.bookId} which is NOT on the user's shelf [${shelf.join(", ")}]`,
  );
  const LEGACY_HARDCODED = [
    "crucial-conversations",
    "thinking-fast-and-slow",
    "the-almanack-of-naval-ravikant",
  ];
  assert.ok(
    !LEGACY_HARDCODED.includes(result!.bookId),
    `regression: fell back to a hardcoded legacy book (${result!.bookId})`,
  );
  // Title/author come from the real catalog entry, not a stale hardcoded map.
  assert.equal(result!.bookTitle, result!.bookId === "atomic-habits" ? "Atomic Habits" : "Deep Work");
});

test("interest match ranks the right shelf book (habits → atomic-habits over deep-work)", () => {
  const result = buildStarterPrescription({
    motivation: "personal",
    interests: ["habits"],
    starterShelf: ["deep-work", "atomic-habits"],
    catalog: CATALOG,
    now: NOW,
  });
  assert.equal(result!.bookId, "atomic-habits");
  assert.match(result!.reason, /interest in habits/);
});

test("single-book shelf always recommends that exact book", () => {
  const result = buildStarterPrescription({
    motivation: "career",
    interests: ["communication"],
    starterShelf: ["deep-work"],
    catalog: CATALOG,
    now: NOW,
  });
  assert.equal(result!.bookId, "deep-work");
});

test("empty shelf falls back to the full catalog (not 3 hardcoded books)", () => {
  const result = buildStarterPrescription({
    motivation: "academic",
    interests: ["psychology", "decision-making"],
    starterShelf: [],
    catalog: CATALOG,
    now: NOW,
  });
  // academic + psychology/decision-making best fits thinking-fast-and-slow here,
  // but the point is the candidate pool is the WHOLE catalog, so any catalog id
  // is reachable.
  assert.ok(CATALOG.some((b) => b.id === result!.bookId));
  assert.equal(result!.bookId, "thinking-fast-and-slow");
});

test("shelf ids absent from the catalog are ignored, then fall back to full catalog", () => {
  const result = buildStarterPrescription({
    motivation: "curiosity",
    interests: ["psychology"],
    starterShelf: ["a-book-that-does-not-exist", "another-ghost"],
    catalog: CATALOG,
    now: NOW,
  });
  assert.ok(result, "expected a prescription even when shelf ids are all unknown");
  assert.ok(CATALOG.some((b) => b.id === result!.bookId));
});

test("tie-break keeps shelf order (first selected wins on equal score)", () => {
  // Two books with no interest/motivation signal at all → equal score.
  const flatCatalog: PrescriptionCatalogBook[] = [
    { id: "alpha", title: "Alpha", author: "A", category: "Memoir", categories: ["Memoir"], difficulty: "Hard", tags: [] },
    { id: "beta", title: "Beta", author: "B", category: "Memoir", categories: ["Memoir"], difficulty: "Hard", tags: [] },
  ];
  const result = buildStarterPrescription({
    motivation: "curiosity",
    interests: [],
    starterShelf: ["beta", "alpha"],
    catalog: flatCatalog,
    now: NOW,
  });
  assert.equal(result!.bookId, "beta");
});

test("invalid motivation coerces to curiosity", () => {
  assert.equal(coerceMotivation("nonsense"), "curiosity");
  assert.equal(coerceMotivation("career"), "career");
});

test("empty catalog returns null (defensive)", () => {
  const result = buildStarterPrescription({
    motivation: "career",
    interests: [],
    starterShelf: ["atomic-habits"],
    catalog: [],
    now: NOW,
  });
  assert.equal(result, null);
});

test("generatedAt uses the injected clock", () => {
  const result = buildStarterPrescription({
    motivation: "career",
    interests: [],
    starterShelf: ["deep-work"],
    catalog: CATALOG,
    now: NOW,
  });
  assert.equal(result!.generatedAt, NOW.toISOString());
});

/* ── The core's interest taxonomy must stay in sync with the onboarding deck's
 * (app/onboarding/data/books.ts). They build/score the same shelf from the same
 * signals; drift would silently mis-rank prescriptions. ── */
test("INTEREST_SIGNALS stays in sync with the onboarding taxonomy", () => {
  assert.deepEqual(INTEREST_SIGNALS, ONBOARDING_INTEREST_SIGNALS);
});
