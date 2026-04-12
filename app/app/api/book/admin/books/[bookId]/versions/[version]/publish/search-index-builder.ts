import "server-only";

import { S3Client, PutObjectCommand, ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3";
import { getBookContentBucket } from "@/app/app/api/book/_lib/env";

const s3 = new S3Client({});

export type SearchDocument = {
  id: string;
  type: "book" | "chapter" | "takeaway" | "example";
  bookId: string;
  bookTitle: string;
  author: string;
  chapterNumber?: number;
  chapterTitle?: string;
  text: string;
  tags: string[];
  categories: string[];
};

export async function rebuildSearchIndex(): Promise<{ documentCount: number }> {
  const bucket = await getBookContentBucket();
  const documents: SearchDocument[] = [];

  // List all book directories under book-content/books/
  const listResult = await s3.send(
    new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: "book-content/library/catalog.json",
      MaxKeys: 1,
    }),
  );

  if (!listResult.Contents?.length) {
    return { documentCount: 0 };
  }

  // Load the catalog
  const catalogObj = await s3.send(
    new GetObjectCommand({ Bucket: bucket, Key: "book-content/library/catalog.json" }),
  );
  const catalogText = await catalogObj.Body?.transformToString("utf-8");
  if (!catalogText) return { documentCount: 0 };

  const catalog = JSON.parse(catalogText) as Array<{
    id: string;
    title: string;
    author: string;
    categories?: string[];
    tags?: string[];
    chapterCount?: number;
  }>;

  for (const book of catalog) {
    // Add book-level document
    documents.push({
      id: `book:${book.id}`,
      type: "book",
      bookId: book.id,
      bookTitle: book.title,
      author: book.author,
      text: `${book.title} by ${book.author}`,
      tags: book.tags ?? [],
      categories: book.categories ?? [],
    });

    // Try to load chapter manifests
    const chapterCount = book.chapterCount ?? 20;
    for (let ch = 1; ch <= chapterCount; ch++) {
      const chKey = `book-content/books/${book.id}/v000001/chapters/${String(ch).padStart(4, "0")}.json`;
      try {
        const chObj = await s3.send(
          new GetObjectCommand({ Bucket: bucket, Key: chKey }),
        );
        const chText = await chObj.Body?.transformToString("utf-8");
        if (!chText) continue;

        const chapter = JSON.parse(chText) as {
          title?: string;
          number?: number;
          contentVariants?: Record<string, {
            keyTakeaways?: Array<{ point?: { direct?: string } }>;
          }>;
          examples?: Array<{ title?: string; scenario?: { direct?: string } }>;
        };

        const chapterTitle = chapter.title ?? `Chapter ${ch}`;

        // Add chapter document
        documents.push({
          id: `chapter:${book.id}:${ch}`,
          type: "chapter",
          bookId: book.id,
          bookTitle: book.title,
          author: book.author,
          chapterNumber: ch,
          chapterTitle,
          text: `${chapterTitle} ${book.title}`,
          tags: book.tags ?? [],
          categories: book.categories ?? [],
        });

        // Extract takeaways from the first available variant
        const variants = chapter.contentVariants ?? {};
        const firstVariant = Object.values(variants)[0];
        if (firstVariant?.keyTakeaways) {
          for (const takeaway of firstVariant.keyTakeaways) {
            const point = takeaway.point?.direct;
            if (!point) continue;
            documents.push({
              id: `takeaway:${book.id}:${ch}:${documents.length}`,
              type: "takeaway",
              bookId: book.id,
              bookTitle: book.title,
              author: book.author,
              chapterNumber: ch,
              chapterTitle,
              text: point,
              tags: book.tags ?? [],
              categories: book.categories ?? [],
            });
          }
        }

        // Extract examples
        if (chapter.examples) {
          for (const example of chapter.examples) {
            const scenario = example.scenario?.direct ?? example.title ?? "";
            if (!scenario) continue;
            documents.push({
              id: `example:${book.id}:${ch}:${documents.length}`,
              type: "example",
              bookId: book.id,
              bookTitle: book.title,
              author: book.author,
              chapterNumber: ch,
              chapterTitle,
              text: `${example.title ?? ""} ${scenario}`.trim(),
              tags: book.tags ?? [],
              categories: book.categories ?? [],
            });
          }
        }
      } catch {
        // Chapter doesn't exist or isn't readable — skip
        break;
      }
    }
  }

  // Write the search index to S3
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: "book-content/library/search-index.json",
      Body: JSON.stringify(documents),
      ContentType: "application/json",
      CacheControl: "public, max-age=3600",
    }),
  );

  return { documentCount: documents.length };
}
