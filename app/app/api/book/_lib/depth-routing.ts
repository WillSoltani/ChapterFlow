import type {
  BookUserDepthModelItem,
  DepthFeatureVector,
  VariantKey,
} from "./types";
import { nowIso } from "./keys";
import { depthModelKey } from "./depth-routing-core";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { ddbDoc } from "@/app/app/api/_lib/aws";

type DepthRecommendation = {
  depth: VariantKey;
  confidence: number;
  reason: string;
};

/**
 * Heuristic depth routing model (V1).
 *
 * Uses quiz scores, reading time ratio, and score trend to recommend
 * the next chapter's depth level. Confidence scales with data points.
 */
export function computeDepthRecommendation(
  features: DepthFeatureVector,
  chaptersCompleted: number
): DepthRecommendation {
  const { avgQuizScore, avgReadingTimeRatio, recentScoreTrend, reviewCardRecall } = features;

  // Not enough data — stay on default
  if (chaptersCompleted < 2) {
    return {
      depth: "easy",
      confidence: 0.3,
      reason: "Not enough data yet — starting at easy.",
    };
  }

  const confidence = Math.min(1, 0.3 + chaptersCompleted * 0.1);

  // Strong signals for easy: struggling
  if (avgQuizScore < 60 || (avgQuizScore < 70 && avgReadingTimeRatio > 2.0)) {
    return {
      depth: "easy",
      confidence,
      reason: "Quiz scores suggest building confidence at easy depth first.",
    };
  }

  // Strong signals for hard: crushing it
  if (
    avgQuizScore > 85 &&
    avgReadingTimeRatio < 1.2 &&
    recentScoreTrend >= 0 &&
    reviewCardRecall > 0.8
  ) {
    return {
      depth: "hard",
      confidence,
      reason: "High scores and fast reads — ready for deeper content.",
    };
  }

  // Mid-range signals for hard: high scores but slower reads
  if (avgQuizScore > 90 && recentScoreTrend > 0) {
    return {
      depth: "hard",
      confidence: confidence * 0.8,
      reason: "Consistently high scores suggest you're ready for harder material.",
    };
  }

  // Default: medium
  if (avgQuizScore >= 60) {
    return {
      depth: "medium",
      confidence,
      reason: "Solid performance — standard depth is a good fit.",
    };
  }

  return {
    depth: "easy",
    confidence: confidence * 0.6,
    reason: "Defaulting to easy to build a strong foundation.",
  };
}

export async function getDepthModel(
  tableName: string,
  userId: string,
  bookId: string
): Promise<BookUserDepthModelItem | null> {
  const result = await ddbDoc.send(
    new GetCommand({
      TableName: tableName,
      // Table key schema is uppercase PK/SK (infra appTable); lowercase keys
      // raise a DynamoDB ValidationException. See depthModelKey().
      Key: depthModelKey(userId, bookId),
    })
  );
  return (result.Item as BookUserDepthModelItem) ?? null;
}

export async function updateDepthModel(
  tableName: string,
  userId: string,
  bookId: string,
  chapterNumber: number,
  quizScore: number,
  readingTimeMinutes: number,
  expectedReadingTimeMinutes: number,
  reviewCardRecall: number = 0
): Promise<BookUserDepthModelItem> {
  const existing = await getDepthModel(tableName, userId, bookId);

  const prevFeatures = existing?.featureVector ?? {
    avgQuizScore: 0,
    avgReadingTimeRatio: 1,
    recentScoreTrend: 0,
    reviewCardRecall: 0,
  };
  const prevChapter = existing?.lastUpdatedChapter ?? 0;
  const dataPoints = Math.max(1, chapterNumber);

  // Exponential moving average for quiz scores
  const alpha = 0.4;
  const newAvgQuizScore =
    prevChapter === 0
      ? quizScore
      : alpha * quizScore + (1 - alpha) * prevFeatures.avgQuizScore;

  const readingTimeRatio =
    expectedReadingTimeMinutes > 0
      ? readingTimeMinutes / expectedReadingTimeMinutes
      : 1;
  const newAvgReadingTimeRatio =
    prevChapter === 0
      ? readingTimeRatio
      : alpha * readingTimeRatio + (1 - alpha) * prevFeatures.avgReadingTimeRatio;

  // Score trend: difference between current and previous average
  const newRecentScoreTrend = quizScore - prevFeatures.avgQuizScore;

  const features: DepthFeatureVector = {
    avgQuizScore: Math.round(newAvgQuizScore * 100) / 100,
    avgReadingTimeRatio: Math.round(newAvgReadingTimeRatio * 100) / 100,
    recentScoreTrend: Math.round(newRecentScoreTrend * 100) / 100,
    reviewCardRecall: Math.round(reviewCardRecall * 1000) / 1000,
  };

  const recommendation = computeDepthRecommendation(features, dataPoints);

  const item: BookUserDepthModelItem = {
    userId,
    bookId,
    recommendedDepth: recommendation.depth,
    confidence: recommendation.confidence,
    featureVector: features,
    lastUpdatedChapter: chapterNumber,
    updatedAt: nowIso(),
  };

  await ddbDoc.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        // Uppercase PK/SK to match the table key schema (infra appTable);
        // lowercase keys are rejected with a DynamoDB ValidationException.
        ...depthModelKey(userId, bookId),
        ...item,
      },
    })
  );

  return item;
}
