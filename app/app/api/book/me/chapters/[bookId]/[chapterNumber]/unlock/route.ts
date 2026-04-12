import "server-only";

import { requireUser } from "@/app/app/api/_lib/auth";
import { getBookTableName } from "@/app/app/api/book/_lib/env";
import { BookApiError } from "@/app/app/api/book/_lib/errors";
import {
  bookOk,
  withBookApiErrors,
} from "@/app/app/api/book/_lib/http";
import { getUserQuizState } from "@/app/app/api/book/_lib/repo";
import { awardFlowPoints } from "@/app/app/api/book/_lib/flow-points-repo";
import { bookUserPk, loopSk } from "@/app/app/api/book/_lib/keys";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { ddbDoc } from "@/app/app/api/_lib/aws";
import { LOOP_COMPLETE_IP } from "@/app/book/_lib/flow-points-economy";
import type { LearningMode } from "@/app/book/settings/types/settings";

export const runtime = "nodejs";

// §1.1 — Awards the loop-complete portion of Insight Points when the user
// finishes the final Unlock phase of a chapter. The quiz-pass portion is
// awarded at quiz submit; this endpoint awards the remainder.
//
// Idempotent: awardFlowPoints deduplicates via sourceType+sourceId grant key.
// Double calls return { awarded: false, alreadyClaimed: true, amount: 0 }.

export async function POST(
  req: Request,
  { params }: { params: Promise<{ bookId: string; chapterNumber: string }> }
) {
  return withBookApiErrors(req, async () => {
    const user = await requireUser();
    const { bookId, chapterNumber: chapterNumberStr } = await params;
    const chapterNumber = parseInt(chapterNumberStr, 10);
    if (!Number.isFinite(chapterNumber) || chapterNumber < 1) {
      throw new BookApiError(400, "invalid_chapter", "Invalid chapter number.");
    }

    const tableName = await getBookTableName();

    // The quiz must have been passed for this chapter.
    const quizState = await getUserQuizState(
      tableName,
      user.sub,
      bookId,
      chapterNumber
    );
    if (!quizState?.passed) {
      throw new BookApiError(
        400,
        "not_eligible",
        "Quiz has not been passed for this chapter."
      );
    }

    // Read the LOOP record to get learning mode and attempt info.
    const loopRes = await ddbDoc.send(
      new GetCommand({
        TableName: tableName,
        Key: {
          PK: bookUserPk(user.sub),
          SK: loopSk(bookId, chapterNumber),
        },
      })
    );
    const loopRecord = loopRes.Item;
    if (!loopRecord) {
      throw new BookApiError(
        400,
        "no_loop_record",
        "No loop completion record found for this chapter."
      );
    }

    const learningMode =
      (loopRecord.learningMode as LearningMode) ?? "standard";
    const isFirstAttempt = loopRecord.isFirstAttempt === true;

    // Compute amount — may have been stored on the LOOP record if available,
    // otherwise derive from constants.
    const amount =
      typeof loopRecord.loopCompleteIPAmount === "number"
        ? loopRecord.loopCompleteIPAmount
        : isFirstAttempt
          ? LOOP_COMPLETE_IP[learningMode].firstAttempt
          : LOOP_COMPLETE_IP[learningMode].retry;

    const result = await awardFlowPoints(tableName, {
      userId: user.sub,
      amount,
      sourceType: "loop_complete",
      sourceId: `${bookId}:${chapterNumber}`,
      metadata: {
        bookId,
        chapterNumber,
        learningMode,
        isFirstAttempt,
      },
    });

    return bookOk({
      awarded: result.awarded,
      amount: result.awarded ? amount : 0,
      alreadyClaimed: !result.awarded && result.reason === "duplicate",
      balance: result.state.points,
    });
  });
}
