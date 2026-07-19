/** Shared search contracts (WS3-001). */
export type SearchDocument = {
  id: string;
  type: "book" | "chapter" | "takeaway" | "example";
  bookId: string;
  bookTitle: string;
  author: string;
  chapterId?: string;
  chapterNumber?: number;
  chapterTitle?: string;
  text: string;
  tags: string[];
  categories: string[];
};

export type SearchResult = SearchDocument & { score: number };

export type GroupedResults = {
  books: SearchResult[];
  chapters: SearchResult[];
  takeaways: SearchResult[];
  examples: SearchResult[];
};
