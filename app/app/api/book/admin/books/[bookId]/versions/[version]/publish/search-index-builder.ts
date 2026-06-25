import "server-only";

import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getBookContentBucket, getBookTableName } from "@/app/app/api/book/_lib/env";
import { listPublishedCatalogItems } from "@/app/app/api/book/_lib/repo";
import { getPublishedBookManifest } from "@/app/app/api/book/_lib/content-service";
import { BookApiError } from "@/app/app/api/book/_lib/errors";
import type { SearchDocument } from "@/app/book/types/search";
import {
  decideSearchIndexWrite,
  type SearchIndexRebuildFailure,
} from "./search-index-core";

const s3 = new S3Client({});

export type RebuildSearchIndexResult = {
  documentCount: number;
  booksConsidered: number;
};

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Rebuild the global search index from the published catalog + S3 chapter
 * content and write it to `book-content/library/search-index.json`.
 *
 * Read failures (per-book manifest or per-chapter content) are TRACKED, not
 * swallowed. If ANY read failed we refuse to overwrite the authoritative index
 * with a partial result and throw a `BookApiError` so the caller can surface the
 * failure — see {@link decideSearchIndexWrite} for the policy and rationale.
 */
export async function rebuildSearchIndex(): Promise<RebuildSearchIndexResult> {
  const [bucket, tableName] = await Promise.all([
    getBookContentBucket(),
    getBookTableName(),
  ]);
  const documents: SearchDocument[] = [];
  const failures: SearchIndexRebuildFailure[] = [];

  // Source-of-truth catalog: DynamoDB. Filter to PUBLISHED entries with a
  // currentPublishedVersion set. The previous implementation read a stale
  // catalog.json snapshot AND hardcoded v000001 in chapter paths — both of
  // which broke for any book that's been republished (Tiny Habits at v4,
  // HWF at v2 after the v21 cutover).
  const catalogItems = await listPublishedCatalogItems(tableName);
  const catalog = catalogItems
    .filter((item) => item.status === "PUBLISHED" && !!item.currentPublishedVersion)
    .map((item) => ({
      id: item.bookId,
      title: item.title,
      author: item.author,
      categories: item.categories,
      tags: item.tags,
      version: item.currentPublishedVersion as number,
    }));

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

    // Resolve the published manifest for this book (gives us the real
    // chapter list + chapter content keys for the currently-published
    // version, not a hardcoded v000001).
    let manifestPayload: Awaited<ReturnType<typeof getPublishedBookManifest>>;
    try {
      manifestPayload = await getPublishedBookManifest({
        tableName,
        contentBucket: bucket,
        bookId: book.id,
      });
    } catch (err) {
      // A manifest read failure means this book is entirely missing from the
      // index. Record it so we don't silently overwrite the live index with a
      // version that's missing whole books.
      failures.push({
        scope: "manifest",
        bookId: book.id,
        message: errorMessage(err),
      });
      continue;
    }
    const manifestChapters = manifestPayload.manifest.chapters ?? [];

    for (const manifestChapter of manifestChapters) {
      const ch = manifestChapter.number;
      const chKey = manifestChapter.chapterKey;
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
      } catch (err) {
        // Chapter doesn't exist or isn't readable. Record it so a transient S3
        // blip on one chapter can't quietly ship an index missing that chapter.
        failures.push({
          scope: "chapter",
          bookId: book.id,
          chapterNumber: ch,
          message: errorMessage(err),
        });
        continue;
      }
    }
  }

  // Refuse to overwrite the authoritative index with a partial result. A stale
  // but COMPLETE index is preferable to a fresh but INCOMPLETE one for a global
  // search surface, and the caller surfaces this failure rather than swallowing
  // it. The PutObject below only runs on a fully-successful rebuild.
  const decision = decideSearchIndexWrite({
    booksConsidered: catalog.length,
    documentCount: documents.length,
    failures,
  });
  if (!decision.write) {
    throw new BookApiError(502, decision.code, decision.message, decision.details);
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

  return { documentCount: documents.length, booksConsidered: catalog.length };
}
