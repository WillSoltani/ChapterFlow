import "server-only";

import { requireActiveBookUser } from "@/app/app/api/book/_lib/account-guard";
import { bookOk, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import { getBookTableName } from "@/app/app/api/book/_lib/env";
import { BookApiError } from "@/app/app/api/book/_lib/errors";
import { getDepthModel, computeDepthRecommendation } from "@/app/app/api/book/_lib/depth-routing";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ bookId: string }> }
) {
  return withBookApiErrors(req, async () => {
    const user = await requireActiveBookUser();
    const { bookId } = await params;

    if (!bookId) {
      throw new BookApiError(400, "invalid_book_id", "bookId is required.");
    }

    const tableName = await getBookTableName();
    const model = await getDepthModel(tableName, user.sub, bookId);

    if (!model) {
      const fallback = computeDepthRecommendation(
        { avgQuizScore: 0, avgReadingTimeRatio: 1, recentScoreTrend: 0, reviewCardRecall: 0 },
        0
      );
      return bookOk({
        recommendedDepth: fallback.depth,
        confidence: fallback.confidence,
        reason: fallback.reason,
        hasData: false,
      });
    }

    const recommendation = computeDepthRecommendation(
      model.featureVector,
      model.lastUpdatedChapter
    );

    return bookOk({
      recommendedDepth: recommendation.depth,
      confidence: recommendation.confidence,
      reason: recommendation.reason,
      featureVector: model.featureVector,
      lastUpdatedChapter: model.lastUpdatedChapter,
      hasData: true,
    });
  });
}
