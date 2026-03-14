import "server-only";
import { requireAdminUser } from "@/app/app/api/book/_lib/admin-auth";
import { withBookApiErrors, bookOk } from "@/app/app/api/book/_lib/http";
import { getBookTableName } from "@/app/app/api/book/_lib/env";
import { getIngestionJob } from "@/app/app/api/book/_lib/repo";
import { BookApiError } from "@/app/app/api/book/_lib/errors";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  return withBookApiErrors(req, async () => {
    await requireAdminUser();
    const { jobId } = await params;
    if (!jobId) {
      throw new BookApiError(400, "invalid_job_id", "jobId is required.");
    }
    const tableName = await getBookTableName();
    const job = await getIngestionJob(tableName, jobId);
    if (!job) {
      throw new BookApiError(404, "job_not_found", "Ingestion job not found.");
    }
    return bookOk({ job });
  });
}
