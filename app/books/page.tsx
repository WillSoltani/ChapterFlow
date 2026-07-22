import type { Metadata } from "next";
import { headers } from "next/headers";
import { BrowseLibraryPage } from "@/components/website/BrowseLibraryPage";
import { BOOKS_CATALOG } from "@/app/book/data/booksCatalog";
import {
  CATALOG_BOOK_COUNT,
  CATALOG_BOOK_COUNT_DISPLAY,
} from "@/lib/catalog-stats";
import { getChapterFlowSiteUrl } from "@/app/_lib/chapterflow-brand";

export const metadata: Metadata = {
  title: `Library | ChapterFlow — ${CATALOG_BOOK_COUNT_DISPLAY} Non-Fiction Books`,
  description: `Browse ${CATALOG_BOOK_COUNT_DISPLAY} non-fiction books structured for real retention. Each title includes chapter summaries, real-world scenarios, and quizzes. Psychology, productivity, leadership, and more.`,
};

// Previously `export const revalidate = 3600` (ISR). WS8-001 reads the
// per-request CSP nonce via headers() below, which opts this route into dynamic
// rendering — an ISR revalidate window would be a no-op, so it is dropped to
// avoid implying a caching behavior that no longer applies. The catalog is
// small and rendered from an in-bundle constant, so per-request rendering is
// cheap.

export default async function BooksPage() {
  // Per-request nonce from middleware.ts (WS8-001). JSON-LD is a non-executable
  // data block (not gated by script-src), so this is belt-and-suspenders for
  // consistency with the enforcing policy.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const siteUrl = getChapterFlowSiteUrl();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "ChapterFlow Book Library",
    description: `${CATALOG_BOOK_COUNT_DISPLAY} non-fiction books structured for real retention`,
    url: `${siteUrl}/books`,
    numberOfItems: CATALOG_BOOK_COUNT,
    // Point at the public, indexable browse page (deep-linked by title) rather
    // than the login-gated /book/library/{id} reader route.
    itemListElement: BOOKS_CATALOG.slice(0, 20).map((book, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: book.title,
      url: `${siteUrl}/books?q=${encodeURIComponent(book.title)}`,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <BrowseLibraryPage />
    </>
  );
}
