import "server-only";

import { requireAdminUser } from "@/app/app/api/book/_lib/admin-auth";
import { bookOk, bookErr, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import { getBookTableName } from "@/app/app/api/book/_lib/env";
import {
  deleteSegment,
  getSegment,
  putSegment,
} from "@/app/app/api/book/_lib/admin-segments-repo";
import type { SegmentFilter } from "@/app/app/api/book/_lib/segment-engine";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ segmentId: string }> };

export async function GET(req: Request, { params }: Ctx) {
  return withBookApiErrors(req, async () => {
    await requireAdminUser();
    const tableName = await getBookTableName();
    const { segmentId } = await params;
    const segment = await getSegment(tableName, segmentId);
    if (!segment) return bookErr(req, 404, "not_found", "Segment not found");
    return bookOk({ segment });
  });
}

export async function PATCH(req: Request, { params }: Ctx) {
  return withBookApiErrors(req, async () => {
    await requireAdminUser();
    const tableName = await getBookTableName();
    const { segmentId } = await params;
    const existing = await getSegment(tableName, segmentId);
    if (!existing) return bookErr(req, 404, "not_found", "Segment not found");

    const body = (await req.json().catch(() => ({}))) as {
      name?: string;
      description?: string;
      filters?: SegmentFilter[];
      lastRunCount?: number;
    };

    const updated = {
      ...existing,
      ...(body.name ? { name: body.name.trim() } : {}),
      ...(body.description !== undefined ? { description: body.description?.trim() } : {}),
      ...(body.filters ? { filters: body.filters } : {}),
      ...(body.lastRunCount !== undefined
        ? { lastRunCount: body.lastRunCount, lastRunAt: new Date().toISOString() }
        : {}),
      updatedAt: new Date().toISOString(),
    };
    await putSegment(tableName, updated);
    return bookOk({ segment: updated });
  });
}

export async function DELETE(req: Request, { params }: Ctx) {
  return withBookApiErrors(req, async () => {
    await requireAdminUser();
    const tableName = await getBookTableName();
    const { segmentId } = await params;
    await deleteSegment(tableName, segmentId);
    return bookOk({ deleted: true });
  });
}
