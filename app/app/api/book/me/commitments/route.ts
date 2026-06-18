import "server-only";

import { requireActiveBookUser } from "@/app/app/api/book/_lib/account-guard";
import {
  bookOk,
  bookErr,
  requireBodyObject,
  withBookApiErrors,
} from "@/app/app/api/book/_lib/http";
import { getBookTableName, getBookAnalyticsTableName } from "@/app/app/api/book/_lib/env";
import {
  createCommitment,
  listCommitments,
  hasActiveCommitmentForChapter,
} from "@/app/app/api/book/_lib/commitment-repo";
import { analyticsTrackCommitment } from "@/app/app/api/book/_lib/analytics-repo";
import type { BookUserCommitmentItem } from "@/app/app/api/book/_lib/types";

export const runtime = "nodejs";

export async function POST(req: Request) {
  return withBookApiErrors(req, async () => {
    const user = await requireActiveBookUser();
    const tableName = await getBookTableName();
    const body = requireBodyObject(await req.json());

    const bookId = typeof body.bookId === "string" ? body.bookId.trim() : "";
    const chapterNumber = typeof body.chapterNumber === "number" ? body.chapterNumber : 0;
    const ifThenPlan = typeof body.ifThenPlan === "string" ? body.ifThenPlan.trim() : "";
    const followUpDays = body.followUpDays === 7 ? 7 : 3;

    if (!bookId) return bookErr(req, 400, "missing_book_id", "bookId is required");
    if (chapterNumber < 1) return bookErr(req, 400, "invalid_chapter", "chapterNumber must be >= 1");
    if (ifThenPlan.length < 10 || ifThenPlan.length > 500) {
      return bookErr(req, 400, "invalid_plan", "ifThenPlan must be 10-500 characters");
    }

    const hasActive = await hasActiveCommitmentForChapter(tableName, user.sub, bookId, chapterNumber);
    if (hasActive) {
      return bookErr(req, 409, "commitment_exists", "An active commitment already exists for this chapter");
    }

    const now = new Date();
    const followUpDate = new Date(now.getTime() + followUpDays * 86400000);

    const item: BookUserCommitmentItem = {
      userId: user.sub,
      commitmentId: crypto.randomUUID(),
      bookId,
      chapterNumber,
      ifThenPlan,
      commitDate: now.toISOString(),
      followUpDate: followUpDate.toISOString(),
      followUpDays,
      status: "active",
      followThroughReflection: null,
      followThroughSubmittedAt: null,
      ipAwarded: 0,
      notificationSentAt: null,
      createdAt: "",
      updatedAt: "",
    };

    const created = await createCommitment(tableName, item);

    // Always-on commitment-funnel event (not gated on beacon opt-in). Fire-and-forget.
    getBookAnalyticsTableName()
      .then((analyticsTable) => {
        if (!analyticsTable) return;
        return analyticsTrackCommitment(analyticsTable, user.sub, "commitment_created", {
          commitmentId: created.commitmentId,
          bookId: created.bookId,
          chapterNumber: created.chapterNumber,
          followUpDays: created.followUpDays,
        });
      })
      .catch(() => {});

    return bookOk({ commitment: created, created: true });
  });
}

export async function GET(req: Request) {
  return withBookApiErrors(req, async () => {
    const user = await requireActiveBookUser();
    const tableName = await getBookTableName();

    const url = new URL(req.url);
    const statusFilter = url.searchParams.get("status") as BookUserCommitmentItem["status"] | null;

    const validStatuses = ["active", "completed", "skipped", "expired"];
    const filter = statusFilter && validStatuses.includes(statusFilter) ? statusFilter : undefined;

    const commitments = await listCommitments(tableName, user.sub, filter ?? undefined);
    return bookOk({ commitments });
  });
}
