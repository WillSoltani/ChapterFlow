import "server-only";
import {
  requireBodyObject,
  requireString,
  withBookApiErrors,
  bookOk,
} from "@/app/app/api/book/_lib/http";
import { requireAdminUser } from "@/app/app/api/book/_lib/admin-auth";
import { getBookContentBucket, getBookIngestBucket, getBookTableName } from "@/app/app/api/book/_lib/env";
import { BookApiError } from "@/app/app/api/book/_lib/errors";
import { ingestBookPackageFromS3 } from "@/app/app/api/book/_lib/ingestion";
import { getIngestionJob, updateIngestionJob } from "@/app/app/api/book/_lib/repo";
import { writeJsonToS3 } from "@/app/app/api/book/_lib/storage";

export const runtime = "nodejs";

export async function POST(req: Request) {
  return withBookApiErrors(req, async () => {
    const admin = await requireAdminUser();
    const tableName = await getBookTableName();
    const ingestBucket = await getBookIngestBucket();
    const contentBucket = await getBookContentBucket();

    let bodyRaw: unknown;
    try {
      bodyRaw = await req.json();
    } catch {
      throw new BookApiError(400, "invalid_json", "Request body must be valid JSON.");
    }
    const body = requireBodyObject(bodyRaw);
    const jobId = requireString(body.jobId, "jobId", { maxLength: 200 });
    const publishNow = body.publishNow === true;

    const existingJob = await getIngestionJob(tableName, jobId);
    if (!existingJob) {
      throw new BookApiError(404, "job_not_found", "Ingestion job not found.");
    }

    const ingestKey = typeof existingJob.ingestKey === "string" ? existingJob.ingestKey : "";
    if (!ingestKey) {
      throw new BookApiError(400, "invalid_job", "Ingestion job missing ingest key.");
    }

    await updateIngestionJob(tableName, jobId, {
      status: "RUNNING",
      details: { stage: "running", publishNow },
      bookId: typeof existingJob.bookId === "string" ? existingJob.bookId : undefined,
    });

    try {
      const result = await ingestBookPackageFromS3({
        tableName,
        ingestBucket,
        contentBucket,
        ingestKey,
        createdBy: admin.sub,
        publishNow,
      });
      await updateIngestionJob(tableName, jobId, {
        status: "SUCCEEDED",
        details: {
          stage: "succeeded",
          bookId: result.bookId,
          version: result.version,
          manifestKey: result.manifestKey,
        },
        bookId: result.bookId,
      });
      return bookOk({
        ok: true,
        jobId,
        bookId: result.bookId,
        version: result.version,
        published: publishNow,
      });
    } catch (error: unknown) {
      const errorKey = `book-ingest-errors/${jobId}.json`;
      const detail = {
        ok: false,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        ingestKey,
      };
      await writeJsonToS3(contentBucket, errorKey, detail).catch(() => {});
      await updateIngestionJob(tableName, jobId, {
        status: "FAILED",
        details: detail,
        errorReportKey: errorKey,
      });
      throw error;
    }
  });
}
