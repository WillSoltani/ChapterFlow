#!/usr/bin/env tsx
/**
 * Generate the SLIM per-book chapter metadata committed at
 * app/book/data/book-chapter-meta.json.
 *
 * Background: bookChapters.ts used to eagerly build a full BookChapter bundle for
 * ALL ~105 books from the statically-imported book packages (~37.6 MB). That
 * corpus landed in BOTH the client bundle and — via SSR of the reader — the
 * OpenNext ServerFn, pushing it past Lambda's 250 MiB limit and breaking deploys.
 *
 * Only analytics / profile / badges / library-state need per-chapter data, and
 * only the LIGHTWEIGHT fields (id, order, code, title, minutes). The reader's full
 * content comes from the API. So we precompute just those slim fields here (a few
 * hundred KB) and bookChapters reads this file instead of the full corpus.
 *
 * Generates from BOOK_PACKAGES (the wired catalog set) via the SAME buildBundle
 * transform the reader uses, so the chapter ids/codes are byte-identical to the
 * former in-bundle data. Importing the corpus here is fine — this is a build-time
 * script, not shipped in any runtime bundle.
 *
 * Re-run whenever a book package changes:
 *   npx tsx scripts/book/generate-chapter-meta.ts
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import { BOOK_PACKAGES } from "@/app/book/data/bookPackages";
import { buildBundle } from "@/app/book/data/bookChapters";

type ChapterMeta = {
  bookId: string;
  id: string;
  order: number;
  code: string;
  title: string;
  minutes: number;
};
type BookMeta = { chapters: ChapterMeta[] };

const out: Record<string, BookMeta> = {};
for (const pkg of BOOK_PACKAGES) {
  const bundle = buildBundle(pkg);
  out[pkg.book.bookId] = {
    chapters: bundle.chapters.map((c) => ({
      bookId: c.bookId,
      id: c.id,
      order: c.order,
      code: c.code,
      title: c.title,
      minutes: c.minutes,
    })),
  };
}

const dest = path.join(process.cwd(), "app/book/data/book-chapter-meta.json");
writeFileSync(dest, JSON.stringify(out) + "\n");
const chapters = Object.values(out).reduce((n, b) => n + b.chapters.length, 0);
console.log(`Wrote ${dest}: ${Object.keys(out).length} books, ${chapters} chapters.`);
