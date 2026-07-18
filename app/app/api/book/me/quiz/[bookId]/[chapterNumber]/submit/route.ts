import "server-only";

import { requireActiveBookUser } from "@/app/app/api/book/_lib/account-guard";
import { getBookContentBucket, getBookTableName } from "@/app/app/api/book/_lib/env";
import {
  applyStartDeviceCookie,
  ensureUserBookStarted,
} from "@/app/app/api/book/_lib/ensure-book-started";
import { BookApiError } from "@/app/app/api/book/_lib/errors";
import { bookOk, requireBodyObject, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import {
  completeLearningLoop,
  parseResponses,
} from "@/app/app/api/book/_lib/quiz-submit-service";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ bookId: string; chapterNumber: string }> }
) {
  return withBookApiErrors(req, async () => {
    const user = await requireActiveBookUser();
    const { bookId, chapterNumber } = await params;
    const chapterNum = Number(chapterNumber);
    if (!bookId || !Number.isFinite(chapterNum) || chapterNum < 1) {
      throw new BookApiError(400, "invalid_chapter", "Invalid chapter number.");
    }
    const chapterNumberInt = Math.floor(chapterNum);

    let bodyRaw: unknown;
    try {
      bodyRaw = await req.json();
    } catch {
      throw new BookApiError(400, "invalid_json", "Request body must be valid JSON.");
    }
    const body = requireBodyObject(bodyRaw);
    // Parse + validate responses BEFORE ensureUserBookStarted so a malformed
    // request 400s without provisioning book-started state (order preserved).
    const responses = parseResponses(body);
    const requestedAttemptNumber =
      typeof body.attemptNumber === "number" && Number.isFinite(body.attemptNumber)
        ? Math.max(1, Math.floor(body.attemptNumber))
        : 1;
    const timeSpentSeconds =
      typeof body.timeSpentSeconds === "number" && Number.isFinite(body.timeSpentSeconds)
        ? Math.max(0, Math.min(60 * 60, Math.floor(body.timeSpentSeconds)))
        : undefined;

    const tableName = await getBookTableName();
    const contentBucket = await getBookContentBucket();
    const started = await ensureUserBookStarted({
      req,
      user,
      tableName,
      contentBucket,
      bookId,
      interactionChapterNumber: chapterNumberInt,
    });

    const payload = await completeLearningLoop({
      user,
      bookId,
      chapterNumber: chapterNumberInt,
      responses,
      requestedAttemptNumber,
      timeSpentSeconds,
      toneInput: body.tone,
      timezoneInput: body.timezone,
      tableName,
      contentBucket,
    });

    return applyStartDeviceCookie(bookOk(payload), started);
  });
}
