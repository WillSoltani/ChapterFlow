import "server-only";

import { BOOKS_CATALOG_METADATA } from "@/app/book/data/booksCatalog";
import {
  buildStarterPrescription,
  type PrescriptionCatalogBook,
  type StarterPrescription,
} from "./starter-prescription-core";

export type { StarterPrescription } from "./starter-prescription-core";

/**
 * The real published catalog, projected to the minimal shape the scorer needs.
 *
 * `BOOKS_CATALOG_METADATA` is the same committed metadata the onboarding swipe
 * deck is built from (app/onboarding/data/books.ts), so the prescription can
 * recommend ANY book the user could have shelved — not the three titles the
 * legacy hardcoded BOOK_META map knew about (defect H17). The metadata module is
 * client-safe (static JSON + lib/book-covers, no server-only import), so a
 * server-only module may import it.
 */
const CATALOG: PrescriptionCatalogBook[] = BOOKS_CATALOG_METADATA.map((entry) => ({
  id: entry.id,
  title: entry.title,
  author: entry.author,
  category: entry.category,
  categories: entry.categories,
  difficulty: entry.difficulty,
  tags: entry.tags,
}));

/**
 * Build a chapter-1 starter prescription from the user's onboarding choices.
 *
 * Recommends a book from the user's `starterShelf` (the books they swiped to
 * keep), scored by their motivation + interests against the real catalog
 * metadata. Falls back to the full catalog only when the shelf is empty or none
 * of its ids resolve in the catalog. There is always a book to recommend (the
 * catalog is non-empty), so the non-null assertion is safe.
 */
export function generateStarterPrescription(
  motivation: string,
  interests: string[],
  starterShelf?: string[],
): StarterPrescription {
  return buildStarterPrescription({
    motivation,
    interests,
    starterShelf,
    catalog: CATALOG,
  })!;
}
