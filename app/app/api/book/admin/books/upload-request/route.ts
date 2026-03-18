import "server-only";
import { requireBodyObject, requireString, withBookApiErrors, bookOk } from "@/app/app/api/book/_lib/http";
import { requireAdminUser } from "@/app/app/api/book/_lib/admin-auth";
import { getBookIngestBucket, getBookTableName } from "@/app/app/api/book/_lib/env";
import { createPresignedJsonUploadUrl } from "@/app/app/api/book/_lib/storage";
import { createOrUpdateIngestionJob } from "@/app/app/api/book/_lib/repo";

export const runtime = "nodejs";

export async function POST(req: Request) {
  return withBookApiErrors(req, async () => {
    const admin = await requireAdminUser();
    const tableName = await getBookTableName();
    const ingestBucket = await getBookIngestBucket();

    let bodyRaw: unknown = {};
    try {
      bodyRaw = await req.json();
    } catch {
      bodyRaw = {};
    }
    const body = requireBodyObject(bodyRaw);
    const rawBookId = body.bookId ? requireString(body.bookId, "bookId", { maxLength: 120 }) : "pending";
    // Strip any path-separator or shell-special characters so the bookId is safe as an S3 key segment.
    const bookId = rawBookId.replace(/[^a-zA-Z0-9_.-]/g, "-").replace(/^-+|-+$/g, "") || "pending";
    const jobId = crypto.randomUUID();
    const key = `book-ingest/books/${bookId}/${jobId}/book.json`;
    const uploadUrl = await createPresignedJsonUploadUrl(ingestBucket, key, 900);

    await createOrUpdateIngestionJob(tableName, {
      jobId,
      createdBy: admin.sub,
      ingestBucket,
      ingestKey: key,
      status: "PENDING",
      details: { stage: "upload_requested" },
      bookId: bookId !== "pending" ? bookId : undefined,
    });

    return bookOk({
      jobId,
      ingestBucket,
      ingestKey: key,
      uploadUrl,
      expiresInSeconds: 900,
    });
  });
}
