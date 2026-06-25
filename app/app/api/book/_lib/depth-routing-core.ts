import { bookUserPk, depthModelSk } from "./keys";
import type {
  BookUserDepthModelItem,
  DepthFeatureVector,
  VariantKey,
} from "./types";

/**
 * DynamoDB primary key for a per-user, per-book depth model item.
 *
 * The app table key schema uses UPPERCASE `PK`/`SK` (see infra appTable in
 * chapterflow-backend-stack.ts). Using lowercase `pk`/`sk` causes DynamoDB to
 * reject Get/Put with a ValidationException (and the route then 500s). Kept in
 * a `server-only`/AWS-free core module so the casing can be unit-tested and the
 * regression guarded against recurring.
 */
export function depthModelKey(
  userId: string,
  bookId: string
): { PK: string; SK: string } {
  return { PK: bookUserPk(userId), SK: depthModelSk(bookId) };
}

export type DepthRecommendation = {
  depth: VariantKey;
  confidence: number;
  reason: string;
};

/**
 * Heuristic depth routing model (V1).
 *
 * Uses quiz scores, reading time ratio, and score trend to recommend
 * the next chapter's depth level. Confidence scales with data points.
 *
 * AWS-free + `server-only`-free so it can be unit-imported (the AWS-touching
 * `depth-routing.ts` cannot be loaded in node:test). `depth-routing.ts`
 * re-exports it for existing call sites.
 *
 * `dataPoints` is the number of scored chapters folded into the model — NOT a
 * chapter number. Passing a raw chapter number here lets a reader who jumps
 * straight to chapter 5 look like they have 5 data points (see updateDepthModel).
 */
export function computeDepthRecommendation(
  features: DepthFeatureVector,
  dataPoints: number
): DepthRecommendation {
  const { avgQuizScore, avgReadingTimeRatio, recentScoreTrend, reviewCardRecall } = features;

  // Not enough data — stay on default
  if (dataPoints < 2) {
    return {
      depth: "easy",
      confidence: 0.3,
      reason: "Not enough data yet — starting at easy.",
    };
  }

  const confidence = Math.min(1, 0.3 + dataPoints * 0.1);

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

/**
 * Number of scored chapters represented by a stored model item.
 *
 * Backward-compat: older items predate the explicit `dataPoints` counter and
 * stored only `lastUpdatedChapter` (a chapter number). For those rows fall back
 * to `lastUpdatedChapter` so existing models keep producing a recommendation —
 * it over-counts for readers who jumped ahead, but it never under-counts below
 * the real number of passes for a sequential reader, which is the common case.
 */
export function depthModelDataPoints(
  model: Pick<BookUserDepthModelItem, "dataPoints" | "lastUpdatedChapter">
): number {
  if (typeof model.dataPoints === "number" && Number.isFinite(model.dataPoints)) {
    return Math.max(0, Math.floor(model.dataPoints));
  }
  return Math.max(0, Math.floor(model.lastUpdatedChapter ?? 0));
}

const EMA_ALPHA = 0.4;

/**
 * Pure model-update step: folds one chapter's quiz/reading outcome into the
 * running feature vector via an exponential moving average and recomputes the
 * recommendation. AWS-free so it can be unit-tested; `updateDepthModel`
 * (depth-routing.ts) wraps it with the Get/Put.
 *
 * `dataPoints` is incremented by one per call so the recommendation gate
 * (`dataPoints >= 2`) reflects the actual number of scored chapters rather than
 * the chapter number — fixes the conflation where reading chapter 5 first
 * looked like 5 data points.
 */
export function computeNextDepthModel(args: {
  userId: string;
  bookId: string;
  chapterNumber: number;
  quizScore: number;
  readingTimeMinutes: number;
  expectedReadingTimeMinutes: number;
  reviewCardRecall?: number;
  existing: BookUserDepthModelItem | null;
  now: string;
}): BookUserDepthModelItem {
  const {
    userId,
    bookId,
    chapterNumber,
    quizScore,
    readingTimeMinutes,
    expectedReadingTimeMinutes,
    reviewCardRecall = 0,
    existing,
    now,
  } = args;

  const isFirstDataPoint = !existing;
  const prevFeatures = existing?.featureVector ?? {
    avgQuizScore: 0,
    avgReadingTimeRatio: 1,
    recentScoreTrend: 0,
    reviewCardRecall: 0,
  };
  const prevDataPoints = existing ? depthModelDataPoints(existing) : 0;
  const dataPoints = prevDataPoints + 1;

  const newAvgQuizScore = isFirstDataPoint
    ? quizScore
    : EMA_ALPHA * quizScore + (1 - EMA_ALPHA) * prevFeatures.avgQuizScore;

  const readingTimeRatio =
    expectedReadingTimeMinutes > 0
      ? readingTimeMinutes / expectedReadingTimeMinutes
      : 1;
  const newAvgReadingTimeRatio = isFirstDataPoint
    ? readingTimeRatio
    : EMA_ALPHA * readingTimeRatio + (1 - EMA_ALPHA) * prevFeatures.avgReadingTimeRatio;

  // Score trend: difference between current and previous running average.
  const newRecentScoreTrend = quizScore - prevFeatures.avgQuizScore;

  const features: DepthFeatureVector = {
    avgQuizScore: Math.round(newAvgQuizScore * 100) / 100,
    avgReadingTimeRatio: Math.round(newAvgReadingTimeRatio * 100) / 100,
    recentScoreTrend: Math.round(newRecentScoreTrend * 100) / 100,
    reviewCardRecall: Math.round(reviewCardRecall * 1000) / 1000,
  };

  const recommendation = computeDepthRecommendation(features, dataPoints);

  return {
    userId,
    bookId,
    recommendedDepth: recommendation.depth,
    confidence: recommendation.confidence,
    featureVector: features,
    dataPoints,
    lastUpdatedChapter: chapterNumber,
    updatedAt: now,
  };
}
