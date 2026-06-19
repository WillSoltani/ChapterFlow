#!/usr/bin/env tsx
/**
 * DI-3 — prod category canonicalization report (DRY-RUN ANALYSIS ONLY).
 *
 * The live (DynamoDB) catalog historically accumulated ~52 distinct, free-text
 * category strings, splitting single topics across near-duplicate filter pills
 * (e.g. "Self Improvement" vs "Self-Help"). This script previews how the
 * controlled taxonomy in lib/category-taxonomy.ts collapses that sprawl, so the
 * owner can review the mapping BEFORE any prod data changes.
 *
 *   npx tsx scripts/book/canonicalize-categories-report.ts
 *     -> prints the before/after tally using the audit's documented prod
 *        distribution (runnable now, no creds).
 *
 *   npx tsx scripts/book/canonicalize-categories-report.ts --from <snapshot.json>
 *     -> same report computed from a real catalog snapshot. Accepts either
 *        { books: [{ bookId, categories: [] }, ...] } or a bare array of those
 *        items (the shape of GET /app/api/book/books / a DynamoDB export).
 *        Also lists each book whose categories[] would change.
 *
 * THIS SCRIPT NEVER WRITES. Applying the canonicalization to live data is a
 * separate, deferred deploy step (pending prod creds) that MUST be sequenced
 * AFTER the PROD-DUP / 7A catalog reconcile (D7), so the final launch set is
 * normalized, not the orphan-padded superset.
 *
 * IMPORTANT — how the backfill actually works. The publish gate
 * (enforceCanonicalCategories in ingestion.ts) canonicalizes categories only when
 * ingestion ALLOCATES A NEW VERSION. For a book already published in prod,
 * ingestion's packageId idempotency returns the existing version BEFORE
 * upsertBookMetaAndCatalog, so simply re-running the seed over the same package
 * files is a SILENT NO-OP — it logs "Published ..." but never rewrites the catalog
 * categories. `--force` does NOT change this (it only bypasses the seed's own
 * already-published skip, not the packageId idempotency). To backfill EXISTING
 * books, either: (a) bump each package's packageId before re-seeding so a fresh
 * version flows through the gate; or (b) run a one-off pass over the published
 * catalog items mapping each item's categories through canonicalizeCategories and
 * re-writing it (upsertBookMetaAndCatalog). Preview the exact change set with this
 * report first. See docs/audit-fixes/DI-3.md.
 */
import { readFileSync } from "node:fs";

import {
  canonicalizeCategory,
  CATEGORY_ALIASES,
} from "@/lib/category-taxonomy";

// The 52 distinct category occurrences observed on the prod catalog (audit
// snapshot, .visual-audit/shots-prod/DATA-INTEGRITY.txt). Used when no
// --from snapshot is supplied so the report is runnable without prod access.
const PROD_DISTRIBUTION: Record<string, number> = {
  Business: 22, Strategy: 9, Management: 9, Leadership: 13, Productivity: 64,
  "Self Improvement": 58, Psychology: 31, Relationships: 7,
  "Personal Development": 2, "Decision Making": 9, "Behavioral Economics": 4,
  Innovation: 3, "Mental Toughness": 3, "Self Discipline": 1, Resilience: 2,
  Memoir: 2, Sports: 2, "Self-Help": 20, Communication: 13, Negotiation: 2,
  Philosophy: 5, "Self Development": 1, Focus: 1, Entrepreneurship: 4, Career: 2,
  Messaging: 1, Learning: 3, "Personal Finance": 2, "Decision-Making": 1,
  "Business Communication": 1, "Public Speaking": 1, Conflict: 1, Execution: 1,
  "Self Management": 1, "Personal Safety": 1, "Violence Prevention": 1,
  "Threat Assessment": 1, Boundaries: 1, "Interpersonal Relations": 1,
  "Body Language": 1, Society: 1, "Human Behavior": 1, Reporting: 1,
  Investing: 1, Classics: 1, "Political Philosophy": 1, "Moral Psychology": 1,
  Politics: 1, Religion: 1, Creativity: 1, Writing: 1, Risk: 1,
};

type SnapshotItem = { bookId?: string; categories?: unknown };

function parseArgs(argv: string[]): { from?: string } {
  const out: { from?: string } = {};
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === "--from" && argv[i + 1]) {
      out.from = argv[i + 1];
      i += 1;
    }
  }
  return out;
}

function distributionFromSnapshot(path: string): {
  distribution: Record<string, number>;
  changedBooks: string[];
} {
  const raw = JSON.parse(readFileSync(path, "utf8")) as
    | { books?: SnapshotItem[] }
    | SnapshotItem[];
  const items = Array.isArray(raw) ? raw : raw.books ?? [];
  const distribution: Record<string, number> = {};
  const changedBooks: string[] = [];
  for (const item of items) {
    const categories = Array.isArray(item.categories)
      ? (item.categories.filter((c) => typeof c === "string") as string[])
      : [];
    for (const category of categories) {
      distribution[category] = (distribution[category] ?? 0) + 1;
    }
    const before = categories.join(", ");
    const after = dedupe(categories.map(canonicalizeCategory).filter(Boolean)).join(", ");
    if (before !== after) {
      changedBooks.push(`  ${item.bookId ?? "(unknown)"}: [${before}] -> [${after}]`);
    }
  }
  return { distribution, changedBooks };
}

function dedupe(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv);

  let distribution = PROD_DISTRIBUTION;
  let changedBooks: string[] = [];
  if (args.from) {
    const result = distributionFromSnapshot(args.from);
    distribution = result.distribution;
    changedBooks = result.changedBooks;
    console.log(`Source: ${args.from}`);
  } else {
    console.log("Source: audit prod distribution (no --from snapshot supplied)");
  }

  const beforeKeys = Object.keys(distribution).sort();
  const after: Record<string, number> = {};
  const groups = new Map<string, string[]>();
  for (const key of beforeKeys) {
    const canonical = canonicalizeCategory(key) || "(blank)";
    after[canonical] = (after[canonical] ?? 0) + distribution[key];
    const members = groups.get(canonical) ?? [];
    if (key !== canonical) members.push(key);
    groups.set(canonical, members);
  }

  console.log(`\nBEFORE: ${beforeKeys.length} distinct category strings.`);
  console.log(`AFTER:  ${Object.keys(after).length} canonical categories.\n`);

  console.log("Canonical category (total occurrences)  <- merged variants:");
  for (const [canonical, count] of Object.entries(after).sort((a, b) => b[1] - a[1])) {
    const merged = groups.get(canonical)?.filter(Boolean) ?? [];
    const suffix = merged.length ? `   <- ${merged.join(", ")}` : "";
    console.log(`  ${String(count).padStart(4)}  ${canonical}${suffix}`);
  }

  console.log(`\nAlias rows defined: ${Object.keys(CATEGORY_ALIASES).length}`);

  if (args.from) {
    console.log(`\nBooks whose categories[] would change: ${changedBooks.length}`);
    for (const line of changedBooks) console.log(line);
  }

  console.log(
    "\nDRY-RUN ONLY — no data written. Applying to EXISTING prod books needs more " +
      "than a seed re-run (packageId idempotency skips the rewrite): bump packageId " +
      "before re-seeding, or run a one-off canonicalizeCategories upsert over " +
      "published catalog items — AFTER the PROD-DUP / 7A reconcile."
  );
}

main();
