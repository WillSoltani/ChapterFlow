import type { Metadata } from "next";
import { BrowseLibraryPage } from "@/components/website/BrowseLibraryPage";
import { BOOKS_CATALOG } from "@/app/book/data/booksCatalog";
import { getChapterFlowSiteUrl } from "@/app/_lib/chapterflow-brand";

export const metadata: Metadata = {
  title: `Library | ChapterFlow — ${BOOKS_CATALOG.length}+ Non-Fiction Books`,
  description: `Browse ${BOOKS_CATALOG.length}+ non-fiction books structured for real retention. Each title includes chapter summaries, real-world scenarios, and quizzes. Psychology, productivity, leadership, and more.`,
};

// Revalidate every hour — catalog changes only on book publish events
export const revalidate = 3600;

export default function BooksPage() {
  const siteUrl = getChapterFlowSiteUrl();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "ChapterFlow Book Library",
    description: `${BOOKS_CATALOG.length}+ non-fiction books structured for real retention`,
    url: `${siteUrl}/books`,
    numberOfItems: BOOKS_CATALOG.length,
    itemListElement: BOOKS_CATALOG.slice(0, 20).map((book, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: book.title,
      url: `${siteUrl}/book/library/${book.id}`,
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
