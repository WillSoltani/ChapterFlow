#!/usr/bin/env tsx
/**
 * Precompute the book catalog metadata (title, author, category, chapter
 * counts, synopsis, etc.) into a single static JSON file so client components
 * can import the catalog without pulling in ~97.5MB of chapter content.
 *
 * Run this whenever book packages are added, removed, or updated:
 *   npx tsx scripts/book/generate-catalog-metadata.ts
 *
 * The output is committed to the repo so the build doesn't depend on this
 * script running at build time.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  BOOK_PACKAGES,
  getBookPackagePresentation,
} from "@/app/book/data/bookPackages";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../..");
const OUTPUT_FILE = path.join(
  ROOT,
  "app/book/data/booksCatalog.metadata.json",
);

type CatalogMetadata = {
  id: string;
  title: string;
  author: string;
  categories: string[];
  category: string;
  tags: string[];
  chapterCount: number;
  estimatedMinutes: number;
  icon: string;
  coverImage?: string;
  difficulty: "Easy" | "Medium" | "Hard";
  synopsis: string;
};

function totalReadingMinutes(
  chapters: Array<{ readingTimeMinutes: number }>,
): number {
  return chapters.reduce(
    (sum, chapter) => sum + Math.max(chapter.readingTimeMinutes, 1),
    0,
  );
}

function main() {
  const metadata: CatalogMetadata[] = BOOK_PACKAGES.map((pkg) => {
    const presentation = getBookPackagePresentation(pkg.book.bookId);
    return {
      id: pkg.book.bookId,
      title: pkg.book.title,
      author: pkg.book.author,
      categories: pkg.book.categories,
      category: pkg.book.categories[0] ?? "General",
      tags: pkg.book.tags ?? [],
      chapterCount: pkg.chapters.length,
      estimatedMinutes: totalReadingMinutes(pkg.chapters),
      icon: presentation.icon,
      coverImage: presentation.coverImage,
      difficulty: presentation.difficulty,
      synopsis: presentation.synopsis,
    };
  });

  // Sort by title for stable output
  metadata.sort((a, b) => a.title.localeCompare(b.title));

  const json = JSON.stringify(metadata, null, 2);
  fs.writeFileSync(OUTPUT_FILE, json + "\n", "utf8");

  const sizeKb = (fs.statSync(OUTPUT_FILE).size / 1024).toFixed(1);
  console.log(
    `Wrote ${metadata.length} books to ${path.relative(ROOT, OUTPUT_FILE)} (${sizeKb}KB)`,
  );
}

main();
