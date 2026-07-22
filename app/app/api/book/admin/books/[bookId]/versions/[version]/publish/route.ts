import "server-only";
import { requireAdminUser } from "@/app/app/api/book/_lib/admin-auth";
import { withBookApiErrors, bookOk } from "@/app/app/api/book/_lib/http";
import { getBookTableName } from "@/app/app/api/book/_lib/env";
import { getBookVersion, publishBookVersion } from "@/app/app/api/book/_lib/repo";
import { BookApiError } from "@/app/app/api/book/_lib/errors";
import { logger } from "@/lib/logging/logger";
import { rebuildSearchIndex } from "./search-index-builder";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  {
    params,
  }: {
    params: Promise<{ bookId: string; version: string }>;
  }
) {
  return withBookApiErrors(req, async () => {
    const admin = await requireAdminUser();
    const { bookId, version } = await params;
    const parsedVersion = Number(version);
    if (!bookId || !Number.isFinite(parsedVersion) || parsedVersion < 1) {
      throw new BookApiError(400, "invalid_version", "Invalid book version.");
    }

    const tableName = await getBookTableName();
    const versionItem = await getBookVersion(tableName, bookId, Math.floor(parsedVersion));
    if (!versionItem) {
      throw new BookApiError(404, "version_not_found", "Book version not found.");
    }

    await publishBookVersion(tableName, bookId, versionItem.version, admin.sub);

    // Rebuild the global search index. This is non-blocking for the publish
    // itself (the version is already PUBLISHED above), but a failed/partial
    // rebuild must be VISIBLE rather than swallowed: rebuildSearchIndex now
    // refuses to overwrite the authoritative index with an incomplete result
    // and throws, so we report that status in the response instead of only
    // console.error-ing it.
    let searchIndex: {
      rebuilt: boolean;
      documentCount: number;
      code?: string;
      message?: string;
      details?: unknown;
    } = { rebuilt: false, documentCount: 0 };
    try {
      const indexResult = await rebuildSearchIndex();
      searchIndex = { rebuilt: true, documentCount: indexResult.documentCount };
    } catch (err) {
      logger.error("publish_search_index_rebuild_failed", { err });
      if (err instanceof BookApiError) {
        searchIndex = {
          rebuilt: false,
          documentCount: 0,
          code: err.code,
          message: err.message,
          details: err.details,
        };
      } else {
        searchIndex = {
          rebuilt: false,
          documentCount: 0,
          code: "search_index_rebuild_failed",
          message: err instanceof Error ? err.message : String(err),
        };
      }
    }

    return bookOk({
      bookId,
      version: versionItem.version,
      state: "PUBLISHED",
      // Back-compat field (0 when the rebuild failed/was refused).
      searchIndexDocuments: searchIndex.documentCount,
      searchIndex,
    });
  });
}
