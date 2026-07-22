import "server-only";
import { requireActiveBookUser } from "@/app/app/api/book/_lib/account-guard";
import { withBookApiErrors, bookOk } from "@/app/app/api/book/_lib/http";
import { getBookContentBucket, getBookTableName } from "@/app/app/api/book/_lib/env";
import { BookApiError, isBookApiError } from "@/app/app/api/book/_lib/errors";
import { getCatalogBook, getBookVersion } from "@/app/app/api/book/_lib/repo";
import { readJsonFromS3 } from "@/app/app/api/book/_lib/storage";
import { buildConceptGraphKey, buildContentPrefix } from "@/app/app/api/book/_lib/keys";
import type { ConceptGraph } from "@/app/app/api/book/_lib/types";
import { CONCEPT_GRAPH_CACHE_CONTROL } from "@/app/app/api/book/_lib/cache-control-core";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ bookId: string }> }
) {
  return withBookApiErrors(req, async () => {
    // Mirror sibling content routes (e.g. chapters/[chapterNumber]) so the
    // concept graph follows the same route-level JWT-verify + active-account
    // (soft-delete) gating instead of relying solely on middleware's
    // lightweight cookie-presence check.
    await requireActiveBookUser();
    const { bookId } = await params;
    if (!bookId) {
      throw new BookApiError(400, "invalid_book_id", "bookId is required.");
    }

    const tableName = await getBookTableName();
    const contentBucket = await getBookContentBucket();

    const catalog = await getCatalogBook(tableName, bookId);
    if (!catalog?.currentPublishedVersion) {
      throw new BookApiError(404, "book_not_found", "Book not found or not published.");
    }

    const version = await getBookVersion(tableName, bookId, catalog.currentPublishedVersion);
    if (!version) {
      throw new BookApiError(404, "book_not_found", "Published version not found.");
    }

    const contentPrefix = buildContentPrefix(bookId, version.version);
    const key = buildConceptGraphKey(contentPrefix);

    try {
      const graph = await readJsonFromS3<ConceptGraph>(contentBucket, key);
      const response = bookOk({ conceptGraph: graph });
      response.headers.set("Cache-Control", CONCEPT_GRAPH_CACHE_CONTROL);
      return response;
    } catch (error: unknown) {
      // Only a genuinely-absent (or empty) concept-graph object is reported as
      // "no graph". Any other failure (transient S3 throttling, network, or a
      // malformed object) is rethrown so it surfaces as a real error instead of
      // being masked as an empty graph the client renders with no signal.
      if (
        isBookApiError(error) &&
        (error.code === "content_not_found" || error.code === "empty_content")
      ) {
        const response = bookOk({ conceptGraph: null as unknown as ConceptGraph });
        response.headers.set("Cache-Control", CONCEPT_GRAPH_CACHE_CONTROL);
        return response;
      }
      throw error;
    }
  });
}
