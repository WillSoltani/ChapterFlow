import "server-only";

import { requireAdminUser } from "@/app/app/api/book/_lib/admin-auth";
import { bookOk, bookErr, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import { getBookAnalyticsTableName, getBookTableName } from "@/app/app/api/book/_lib/env";
import { BookApiError } from "@/app/app/api/book/_lib/errors";
import {
  getSegment,
  writeAuditEntry,
} from "@/app/app/api/book/_lib/admin-segments-repo";
import { createNotification } from "@/app/app/api/book/_lib/notifications-repo";
import { buildSegmentUsers } from "@/app/app/api/book/_lib/admin-metrics";
import { runSegment } from "@/app/app/api/book/_lib/segment-engine";
import type { BookUserNotificationItem } from "@/app/app/api/book/_lib/types";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ segmentId: string }> };

export async function POST(req: Request, { params }: Ctx) {
  return withBookApiErrors(req, async () => {
    const admin = await requireAdminUser();
    const tableName = await getBookTableName();
    const analyticsTable = await getBookAnalyticsTableName();
    if (!analyticsTable) {
      return bookErr(req, 503, "analytics_unavailable", "Analytics table not configured.");
    }

    const { segmentId } = await params;
    const segment = await getSegment(tableName, segmentId);
    if (!segment) return bookErr(req, 404, "not_found", "Segment not found");

    const body = (await req.json().catch(() => ({}))) as {
      title?: string;
      message?: string;
      type?: BookUserNotificationItem["type"];
    };

    if (!body.title || typeof body.title !== "string") {
      throw new BookApiError(400, "invalid_title", "title is required");
    }
    if (!body.message || typeof body.message !== "string") {
      throw new BookApiError(400, "invalid_message", "message is required");
    }

    // Execute segment filter to get target users
    const users = await buildSegmentUsers(tableName, analyticsTable);
    const matches = runSegment(users, segment.filters);

    // Hard cap — protect against accidental massive sends
    if (matches.length > 5000) {
      throw new BookApiError(
        400,
        "segment_too_large",
        `Segment matches ${matches.length} users — cap is 5000. Refine your filters.`,
      );
    }

    // Fire-and-forget notifications
    let sent = 0;
    let failed = 0;
    for (const user of matches) {
      try {
        await createNotification(tableName, {
          userId: user.userId,
          type: body.type ?? "weekly_digest",
          title: body.title,
          body: body.message,
          metadata: { source: "admin_segment", segmentId },
          userEmail: user.email ?? undefined,
        });
        sent += 1;
      } catch (err) {
        console.warn("[admin-segment-notify] failed for", user.userId, err);
        failed += 1;
      }
    }

    // Audit trail
    await writeAuditEntry(tableName, {
      adminUserId: admin.sub,
      action: "bulk_notify",
      segmentId,
      affectedUserCount: sent,
      params: {
        title: body.title,
        messagePreview: body.message.slice(0, 120),
        failed,
      },
    }).catch(() => {});

    return bookOk({
      targetedCount: matches.length,
      sent,
      failed,
    });
  });
}
