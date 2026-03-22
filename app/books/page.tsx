import type { Metadata } from "next";
import { BrowseLibraryPage } from "@/components/website/BrowseLibraryPage";

export const metadata: Metadata = {
  title: "Library | ChapterFlow",
  description:
    "Browse 95+ books structured for real understanding. Each with chapter summaries, real world scenarios, and retention quizzes.",
};

export default function BooksPage() {
  return <BrowseLibraryPage />;
}
