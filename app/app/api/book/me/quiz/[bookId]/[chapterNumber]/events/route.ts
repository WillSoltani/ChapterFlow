import "server-only";

import { requireUser } from "@/app/app/api/_lib/auth";
import { getBookAnalyticsTableName } from "@/app/app/api/book/_lib/env";
import { BookApiError } from "@/app/app/api/book/_lib/errors";
import { bookOk, requireBodyObject, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import { analyticsTrackQuizInteraction } from "@/app/app/api/book/_lib/analytics-repo";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ bookId: string; chapterNumber: string }> }
) {
  return withBookApiErrors(req, async () => {
    const user = await requireUser();
    const { bookId, chapterNumber } = await params;
    const chapterNum = Number(chapterNumber);
    if (!bookId || !Number.isFinite(chapterNum) || chapterNum < 1) {
      throw new BookApiError(400, "invalid_chapter", "Invalid chapter number.");
    }

    let bodyRaw: unknown;
    try {
      bodyRaw = await req.json();
    } catch {
      bodyRaw = {};
    }
    const body = requireBodyObject(bodyRaw);
    const eventType =
      body.eventType === "quiz_explanation_opened"
        ? "quiz_explanation_opened"
        : body.eventType === "next_chapter_clicked"
          ? "next_chapter_clicked"
          : null;
    if (!eventType) {
      throw new BookApiError(400, "invalid_event", "Unsupported quiz event.");
    }
    const questionId =
      typeof body.questionId === "string" && body.questionId.trim()
        ? body.questionId.trim().slice(0, 256)
        : undefined;
    if (eventType === "quiz_explanation_opened" && !questionId) {
      throw new BookApiError(
        400,
        "invalid_event",
        "questionId is required when opening an explanation."
      );
    }

    const analyticsTable = await getBookAnalyticsTableName();
    if (analyticsTable) {
      await analyticsTrackQuizInteraction(analyticsTable, {
        userId: user.sub,
        eventType,
        bookId,
        chapterNumber: Math.floor(chapterNum),
        questionId,
        contextKey: questionId
          ? `QUESTION#${bookId}#${String(Math.floor(chapterNum)).padStart(4, "0")}#${questionId}`
          : undefined,
      }).catch(() => null);
    }

    return bookOk({ ok: true });
  });
}
