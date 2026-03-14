import "server-only";
import { requireAdminUser } from "@/app/app/api/book/_lib/admin-auth";
import { withBookApiErrors, bookOk } from "@/app/app/api/book/_lib/http";
import { getBookTableName } from "@/app/app/api/book/_lib/env";
import { getBookVersion, publishBookVersion } from "@/app/app/api/book/_lib/repo";
import { BookApiError } from "@/app/app/api/book/_lib/errors";

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

    return bookOk({
      ok: true,
      bookId,
      version: versionItem.version,
      state: "PUBLISHED",
    });
  });
}
