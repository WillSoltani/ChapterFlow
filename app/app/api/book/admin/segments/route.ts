import "server-only";

import { requireAdminUser } from "@/app/app/api/book/_lib/admin-auth";
import { bookOk, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import { getBookTableName } from "@/app/app/api/book/_lib/env";
import { BookApiError } from "@/app/app/api/book/_lib/errors";
import { listSegments, putSegment } from "@/app/app/api/book/_lib/admin-segments-repo";
import type { SegmentDefinition, SegmentFilter } from "@/app/app/api/book/_lib/segment-engine";

export const runtime = "nodejs";

export async function GET(req: Request) {
  return withBookApiErrors(req, async () => {
    await requireAdminUser();
    const tableName = await getBookTableName();
    const segments = await listSegments(tableName);
    return bookOk({ segments });
  });
}

export async function POST(req: Request) {
  return withBookApiErrors(req, async () => {
    const admin = await requireAdminUser();
    const tableName = await getBookTableName();

    const body = (await req.json().catch(() => ({}))) as {
      name?: string;
      description?: string;
      filters?: SegmentFilter[];
    };

    if (!body.name || typeof body.name !== "string" || body.name.trim().length < 2) {
      throw new BookApiError(400, "invalid_name", "name must be at least 2 characters");
    }
    if (!Array.isArray(body.filters) || body.filters.length === 0) {
      throw new BookApiError(400, "invalid_filters", "at least one filter required");
    }

    const now = new Date().toISOString();
    const segmentId = `seg-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const segment: SegmentDefinition = {
      segmentId,
      name: body.name.trim(),
      description: body.description?.trim() || undefined,
      filters: body.filters,
      createdAt: now,
      updatedAt: now,
      createdBy: admin.sub,
    };
    await putSegment(tableName, segment);
    return bookOk({ segment });
  });
}
