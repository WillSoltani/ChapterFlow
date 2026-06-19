import type { Metadata } from "next";
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

// Revalidate every hour — catalog changes only on book publish events
export const revalidate = 3600;

export default function BooksPage() {
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <BrowseLibraryPage />
    </>
  );
}
