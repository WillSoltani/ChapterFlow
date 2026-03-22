import type { Metadata } from "next";
import { BrowseLibraryPage } from "@/components/website/BrowseLibraryPage";

export const metadata: Metadata = {
  title: "Library | ChapterFlow — Browse 95+ Non-Fiction Books",
  description:
    "Browse 95+ non-fiction books structured for real retention. Each title includes chapter summaries, real-world scenarios, and quizzes. Psychology, productivity, leadership, and more.",
};

export default function BooksPage() {
  return <BrowseLibraryPage />;
}
