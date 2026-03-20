/**
 * analytics-repo.ts
 *
 * Writes to the ChapterFlowAnalytics DynamoDB table.
 *
 * Table design (single-table):
 *
 *   PK                    SK                                Item type
 *   ─────────────────     ───────────────────────────────   ──────────────────────
 *   USER#<userId>         SNAPSHOT                          User analytics snapshot
 *   USER#<userId>         EVENT#<isoTs>#<eventType>         Individual event record
 *
 * GSI1 "eventDate-eventType-index":  PK=eventDate (YYYY-MM-DD), SK=eventType
 *   → Query all events of a type on a given date
 *
 * GSI2 "plan-updatedAt-index":       PK=plan (FREE|PRO), SK=updatedAt
 *   → Query all PRO/FREE users sorted by last activity (churn, DAU, retention)
 *
 * Snapshot fields captured:
 *   Identity:         userId, email, emailDomain, firstSeenAt, createdAt
 *   Subscription:     plan, proStatus, proSource, stripeCustomerId,
 *                     stripeSubscriptionId, subscriptionStartedAt, currentPeriodEnd
 *   Onboarding:       onboardingCompletedAt, onboardingGoal, dailyGoalMinutes
 *   Activity:         lastActiveAt, totalReadingMs, readingDays (Set of YYYY-MM-DD),
 *                     totalSessionCount, activeBookIds (Set)
 *   Quizzes:          totalQuizAttempts, totalQuizPasses, totalQuizScoreSum,
 *                     totalChaptersCompleted
 *   Books:            completedBookIds (Set), booksCompleted
 *   Gamification:     flowPoints, badgeIds (Set), badgeCount,
 *                     totalScenarioSubmissions, approvedScenarios
 *   Meta:             schemaVersion, updatedAt
 *
 * Derived at read time:
 *   totalReadingDays   = readingDays.size
 *   avgQuizScore       = totalQuizScoreSum / totalQuizAttempts
 *   quizPassRate       = totalQuizPasses / totalQuizAttempts * 100
 *   booksStarted       = activeBookIds.size
 */

import { PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddbDoc } from "@/app/app/api/_lib/aws";
import { nowIso } from "./keys";

const SCHEMA_V = "1";

// ─── Key helpers ────────────────────────────────────────────────────────────

function pk(userId: string): string {
  return `USER#${userId}`;
}

const SNAPSHOT_SK = "SNAPSHOT";

function eventSk(iso: string, eventType: string): string {
  return `EVENT#${iso}#${eventType}`;
}

// ─── Internal helpers ────────────────────────────────────────────────────────

/** Append-only event record. Never blocks the response — callers fire-and-forget. */
async function putEvent(
  table: string,
  userId: string,
  eventType: string,
  iso: string,
  plan: string,
  payload: Record<string, unknown>
): Promise<void> {
  const item: Record<string, unknown> = {
    PK: pk(userId),
    SK: eventSk(iso, eventType),
    eventType,
    // GSI1 partition key — enables date-range analytics
    eventDate: iso.slice(0, 10),
    userId,
    // GSI2 used on snapshots only; on events it's informational
    plan,
    occurredAt: iso,
  };

  // Merge payload, omitting undefined values
  for (const [key, value] of Object.entries(payload)) {
    if (value !== undefined) item[key] = value;
  }

  await ddbDoc.send(new PutCommand({ TableName: table, Item: item }));
}

// ─── Public analytics functions ──────────────────────────────────────────────

/**
 * Track a quiz attempt.
 * Atomically increments quiz counters and tracks the book in activeBookIds.
 */
export async function analyticsTrackQuizAttempt(
  table: string,
  args: {
    userId: string;
    bookId: string;
    chapterNumber: number;
    attemptNumber?: number;
    scorePercent: number;
    correctCount?: number;
    totalQuestions?: number;
    passed: boolean;
    cooldownSeconds?: number;
    unlockedNextChapter?: boolean;
  }
): Promise<void> {
  const now = nowIso();
  const passedDelta = args.passed ? 1 : 0;
  const chapterCompletedDelta = args.passed ? 1 : 0;

  await Promise.all([
    ddbDoc.send(
      new UpdateCommand({
        TableName: table,
        Key: { PK: pk(args.userId), SK: SNAPSHOT_SK },
        UpdateExpression:
          "SET #updatedAt = :now, #lastActiveAt = :now, #lastBookId = :bk, " +
          "#lastChapterNum = :ch, #sv = :sv, #userId = :uid, " +
          "#plan = if_not_exists(#plan, :defPlan), " +
          "#firstSeenAt = if_not_exists(#firstSeenAt, :now), " +
          "#createdAt = if_not_exists(#createdAt, :now) " +
          "ADD #totalQuizAttempts :one, #totalQuizPasses :pd, " +
          "#totalQuizScoreSum :sc, #totalChaptersCompleted :cd, " +
          "#activeBookIds :bkSet, #totalSessionCount :one",
        ExpressionAttributeNames: {
          "#updatedAt": "updatedAt",
          "#lastActiveAt": "lastActiveAt",
          "#lastBookId": "lastBookId",
          "#lastChapterNum": "lastChapterNumber",
          "#sv": "schemaVersion",
          "#userId": "userId",
          "#plan": "plan",
          "#firstSeenAt": "firstSeenAt",
          "#createdAt": "createdAt",
          "#totalQuizAttempts": "totalQuizAttempts",
          "#totalQuizPasses": "totalQuizPasses",
          "#totalQuizScoreSum": "totalQuizScoreSum",
          "#totalChaptersCompleted": "totalChaptersCompleted",
          "#activeBookIds": "activeBookIds",
          "#totalSessionCount": "totalSessionCount",
        },
        ExpressionAttributeValues: {
          ":now": now,
          ":bk": args.bookId,
          ":ch": args.chapterNumber,
          ":sv": SCHEMA_V,
          ":uid": args.userId,
          ":defPlan": "FREE",
          ":one": 1,
          ":pd": passedDelta,
          ":sc": args.scorePercent,
          ":cd": chapterCompletedDelta,
          ":bkSet": new Set([args.bookId]),
        },
      })
    ),
    putEvent(table, args.userId, "quiz_attempt", now, "FREE", {
      bookId: args.bookId,
      chapterNumber: args.chapterNumber,
      attemptNumber: args.attemptNumber,
      scorePercent: args.scorePercent,
      correctCount: args.correctCount,
      totalQuestions: args.totalQuestions,
      passed: args.passed,
      cooldownSeconds: args.cooldownSeconds,
      unlockedNextChapter: args.unlockedNextChapter,
      contextKey: `QUIZ#${args.bookId}#${String(args.chapterNumber).padStart(4, "0")}`,
    }),
  ]);
}

export async function analyticsTrackQuizInteraction(
  table: string,
  args: {
    userId: string;
    eventType:
      | "quiz_passed"
      | "quiz_failed"
      | "chapter_unlocked"
      | "quiz_explanation_opened"
      | "next_chapter_clicked";
    bookId: string;
    chapterNumber: number;
    attemptNumber?: number;
    scorePercent?: number;
    questionId?: string;
    contextKey?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  const now = nowIso();
  await putEvent(table, args.userId, args.eventType, now, "FREE", {
    bookId: args.bookId,
    chapterNumber: args.chapterNumber,
    attemptNumber: args.attemptNumber,
    scorePercent: args.scorePercent,
    questionId: args.questionId,
    contextKey:
      args.contextKey ??
      `QUIZ#${args.bookId}#${String(args.chapterNumber).padStart(4, "0")}`,
    ...(args.metadata ?? {}),
  });
}

/**
 * Track a reading session heartbeat.
 * Atomically accumulates reading time and records the day (for unique-day counting).
 */
export async function analyticsTrackReadingSession(
  table: string,
  args: {
    userId: string;
    bookId: string;
    deltaMs: number;
    dayKey: string; // YYYY-MM-DD
  }
): Promise<void> {
  const now = nowIso();

  await Promise.all([
    ddbDoc.send(
      new UpdateCommand({
        TableName: table,
        Key: { PK: pk(args.userId), SK: SNAPSHOT_SK },
        UpdateExpression:
          "SET #updatedAt = :now, #lastActiveAt = :now, #lastBookId = :bk, " +
          "#sv = :sv, #userId = :uid, " +
          "#plan = if_not_exists(#plan, :defPlan), " +
          "#firstSeenAt = if_not_exists(#firstSeenAt, :now), " +
          "#createdAt = if_not_exists(#createdAt, :now) " +
          "ADD #totalReadingMs :dms, #activeBookIds :bkSet, " +
          "#readingDays :daySet, #totalSessionCount :one",
        ExpressionAttributeNames: {
          "#updatedAt": "updatedAt",
          "#lastActiveAt": "lastActiveAt",
          "#lastBookId": "lastBookId",
          "#sv": "schemaVersion",
          "#userId": "userId",
          "#plan": "plan",
          "#firstSeenAt": "firstSeenAt",
          "#createdAt": "createdAt",
          "#totalReadingMs": "totalReadingMs",
          "#activeBookIds": "activeBookIds",
          "#readingDays": "readingDays",
          "#totalSessionCount": "totalSessionCount",
        },
        ExpressionAttributeValues: {
          ":now": now,
          ":bk": args.bookId,
          ":sv": SCHEMA_V,
          ":uid": args.userId,
          ":defPlan": "FREE",
          ":dms": args.deltaMs,
          ":bkSet": new Set([args.bookId]),
          ":daySet": new Set([args.dayKey]),
          ":one": 1,
        },
      })
    ),
    putEvent(table, args.userId, "reading_session", now, "FREE", {
      bookId: args.bookId,
      deltaMs: args.deltaMs,
      dayKey: args.dayKey,
    }),
  ]);
}

/**
 * Track a badge being earned.
 * Adds to badgeIds Set (deduplicated), increments counter, awards flow points.
 */
export async function analyticsTrackBadge(
  table: string,
  args: {
    userId: string;
    badgeId: string;
    tier?: string;
    earnedAt: string;
    pointsAwarded?: number;
  }
): Promise<void> {
  const now = nowIso();

  await Promise.all([
    ddbDoc.send(
      new UpdateCommand({
        TableName: table,
        Key: { PK: pk(args.userId), SK: SNAPSHOT_SK },
        UpdateExpression:
          "SET #updatedAt = :now, #lastActiveAt = :now, " +
          "#sv = :sv, #userId = :uid, " +
          "#plan = if_not_exists(#plan, :defPlan), " +
          "#firstSeenAt = if_not_exists(#firstSeenAt, :now), " +
          "#createdAt = if_not_exists(#createdAt, :now) " +
          "ADD #badgeIds :bSet, #badgeCount :one",
        ExpressionAttributeNames: {
          "#updatedAt": "updatedAt",
          "#lastActiveAt": "lastActiveAt",
          "#sv": "schemaVersion",
          "#userId": "userId",
          "#plan": "plan",
          "#firstSeenAt": "firstSeenAt",
          "#createdAt": "createdAt",
          "#badgeIds": "badgeIds",
          "#badgeCount": "badgeCount",
        },
        ExpressionAttributeValues: {
          ":now": now,
          ":sv": SCHEMA_V,
          ":uid": args.userId,
          ":defPlan": "FREE",
          ":bSet": new Set([args.badgeId]),
          ":one": 1,
        },
      })
    ),
    putEvent(table, args.userId, "badge_earned", now, "FREE", {
      badgeId: args.badgeId,
      tier: args.tier,
      earnedAt: args.earnedAt,
      pointsAwarded: args.pointsAwarded,
    }),
  ]);
}

/**
 * Track a subscription status change (called from billing webhook).
 * Always SETs plan/proStatus so the snapshot reflects current subscription state.
 * This is the authoritative plan update — all other functions use if_not_exists.
 */
export async function analyticsTrackSubscription(
  table: string,
  args: {
    userId: string;
    plan: "FREE" | "PRO";
    proStatus?: string;
    proSource?: string;
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    currentPeriodEnd?: string;
  }
): Promise<void> {
  const now = nowIso();

  const sets: string[] = [
    "#updatedAt = :now",
    "#sv = :sv",
    "#userId = :uid",
    "#plan = :plan",
    "#firstSeenAt = if_not_exists(#firstSeenAt, :now)",
    "#createdAt = if_not_exists(#createdAt, :now)",
  ];
  const names: Record<string, string> = {
    "#updatedAt": "updatedAt",
    "#sv": "schemaVersion",
    "#userId": "userId",
    "#plan": "plan",
    "#firstSeenAt": "firstSeenAt",
    "#createdAt": "createdAt",
  };
  const values: Record<string, unknown> = {
    ":now": now,
    ":sv": SCHEMA_V,
    ":uid": args.userId,
    ":plan": args.plan,
  };

  if (args.proStatus) {
    sets.push("#proStatus = :proStatus");
    names["#proStatus"] = "proStatus";
    values[":proStatus"] = args.proStatus;
  }
  if (args.proSource) {
    sets.push("#proSource = :proSource");
    names["#proSource"] = "proSource";
    values[":proSource"] = args.proSource;
  }
  if (args.stripeCustomerId) {
    sets.push("#stripeCustomerId = :scid");
    names["#stripeCustomerId"] = "stripeCustomerId";
    values[":scid"] = args.stripeCustomerId;
  }
  if (args.stripeSubscriptionId) {
    sets.push("#stripeSubId = :ssid");
    names["#stripeSubId"] = "stripeSubscriptionId";
    values[":ssid"] = args.stripeSubscriptionId;
  }
  if (args.currentPeriodEnd) {
    sets.push("#currentPeriodEnd = :cpe");
    names["#currentPeriodEnd"] = "currentPeriodEnd";
    values[":cpe"] = args.currentPeriodEnd;
  }
  // Mark when the user first went PRO (never overwrite once set)
  if (args.plan === "PRO") {
    sets.push("#subscriptionStartedAt = if_not_exists(#subscriptionStartedAt, :now)");
    names["#subscriptionStartedAt"] = "subscriptionStartedAt";
  }

  await Promise.all([
    ddbDoc.send(
      new UpdateCommand({
        TableName: table,
        Key: { PK: pk(args.userId), SK: SNAPSHOT_SK },
        UpdateExpression: `SET ${sets.join(", ")}`,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
      })
    ),
    putEvent(table, args.userId, "subscription_change", now, args.plan, {
      plan: args.plan,
      proStatus: args.proStatus,
      proSource: args.proSource,
      stripeCustomerId: args.stripeCustomerId,
      stripeSubscriptionId: args.stripeSubscriptionId,
      currentPeriodEnd: args.currentPeriodEnd,
    }),
  ]);
}

/**
 * Track onboarding completion and initial user profile.
 * Captures email, goal, daily goal, selected categories and books — never overwrites once set.
 */
export async function analyticsTrackOnboarding(
  table: string,
  args: {
    userId: string;
    email?: string;
    goal?: string;
    dailyGoalMinutes?: number;
    selectedCategories?: string[];
    selectedBookIds?: string[];
  }
): Promise<void> {
  const now = nowIso();

  const sets: string[] = [
    "#updatedAt = :now",
    "#sv = :sv",
    "#userId = :uid",
    "#plan = if_not_exists(#plan, :defPlan)",
    "#firstSeenAt = if_not_exists(#firstSeenAt, :now)",
    "#createdAt = if_not_exists(#createdAt, :now)",
    "#onboardingCompletedAt = if_not_exists(#onboardingCompletedAt, :now)",
  ];
  const names: Record<string, string> = {
    "#updatedAt": "updatedAt",
    "#sv": "schemaVersion",
    "#userId": "userId",
    "#plan": "plan",
    "#firstSeenAt": "firstSeenAt",
    "#createdAt": "createdAt",
    "#onboardingCompletedAt": "onboardingCompletedAt",
  };
  const values: Record<string, unknown> = {
    ":now": now,
    ":sv": SCHEMA_V,
    ":uid": args.userId,
    ":defPlan": "FREE",
  };

  if (args.email) {
    sets.push("#email = :email");
    names["#email"] = "email";
    values[":email"] = args.email;
    const domain = args.email.includes("@") ? args.email.split("@")[1] : undefined;
    if (domain) {
      sets.push("#emailDomain = :emailDomain");
      names["#emailDomain"] = "emailDomain";
      values[":emailDomain"] = domain;
    }
  }
  if (args.goal) {
    sets.push("#onboardingGoal = if_not_exists(#onboardingGoal, :goal)");
    names["#onboardingGoal"] = "onboardingGoal";
    values[":goal"] = args.goal;
  }
  if (args.dailyGoalMinutes !== undefined) {
    sets.push("#dailyGoalMinutes = :dgm");
    names["#dailyGoalMinutes"] = "dailyGoalMinutes";
    values[":dgm"] = args.dailyGoalMinutes;
  }
  if (args.selectedCategories && args.selectedCategories.length > 0) {
    sets.push("#selectedCategories = if_not_exists(#selectedCategories, :selCats)");
    names["#selectedCategories"] = "selectedCategories";
    values[":selCats"] = args.selectedCategories;
  }
  if (args.selectedBookIds && args.selectedBookIds.length > 0) {
    sets.push("#selectedBookIds = if_not_exists(#selectedBookIds, :selBooks)");
    names["#selectedBookIds"] = "selectedBookIds";
    values[":selBooks"] = args.selectedBookIds;
  }

  await Promise.all([
    ddbDoc.send(
      new UpdateCommand({
        TableName: table,
        Key: { PK: pk(args.userId), SK: SNAPSHOT_SK },
        UpdateExpression: `SET ${sets.join(", ")}`,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
      })
    ),
    putEvent(table, args.userId, "onboarding_completed", now, "FREE", {
      email: args.email,
      goal: args.goal,
      dailyGoalMinutes: args.dailyGoalMinutes,
      selectedCategories: args.selectedCategories,
      selectedBookIds: args.selectedBookIds,
    }),
  ]);
}

/**
 * Track a scenario submission or approval.
 */
export async function analyticsTrackScenario(
  table: string,
  args: {
    userId: string;
    bookId: string;
    chapterNumber: number;
    stage: "submitted" | "approved";
    pointsAwarded: number;
  }
): Promise<void> {
  const now = nowIso();
  const updateExpression =
    args.stage === "approved"
      ? "SET #updatedAt = :now, #lastActiveAt = :now, #sv = :sv, #userId = :uid, " +
        "#plan = if_not_exists(#plan, :defPlan), " +
        "#firstSeenAt = if_not_exists(#firstSeenAt, :now), " +
        "#createdAt = if_not_exists(#createdAt, :now) " +
        "ADD #approvedScenarios :one, #activeBookIds :bkSet"
      : "SET #updatedAt = :now, #lastActiveAt = :now, #sv = :sv, #userId = :uid, " +
        "#plan = if_not_exists(#plan, :defPlan), " +
        "#firstSeenAt = if_not_exists(#firstSeenAt, :now), " +
        "#createdAt = if_not_exists(#createdAt, :now) " +
        "ADD #totalScenarios :one, #activeBookIds :bkSet";
  const names: Record<string, string> = {
    "#updatedAt": "updatedAt",
    "#lastActiveAt": "lastActiveAt",
    "#sv": "schemaVersion",
    "#userId": "userId",
    "#plan": "plan",
    "#firstSeenAt": "firstSeenAt",
    "#createdAt": "createdAt",
    "#activeBookIds": "activeBookIds",
    ...(args.stage === "approved"
      ? { "#approvedScenarios": "approvedScenarios" }
      : { "#totalScenarios": "totalScenarioSubmissions" }),
  };
  const values: Record<string, unknown> = {
    ":now": now,
    ":sv": SCHEMA_V,
    ":uid": args.userId,
    ":defPlan": "FREE",
    ":one": 1,
    ":bkSet": new Set([args.bookId]),
  };

  await Promise.all([
    ddbDoc.send(
      new UpdateCommand({
        TableName: table,
        Key: { PK: pk(args.userId), SK: SNAPSHOT_SK },
        UpdateExpression: updateExpression,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
      })
    ),
    putEvent(table, args.userId, args.stage === "approved" ? "scenario_approved" : "scenario_submitted", now, "FREE", {
      bookId: args.bookId,
      chapterNumber: args.chapterNumber,
      pointsAwarded: args.pointsAwarded,
      stage: args.stage,
    }),
  ]);
}

/**
 * Track a book being completed (all chapters done).
 * Adds bookId to completedBookIds Set and increments booksCompleted.
 */
export async function analyticsTrackBookCompleted(
  table: string,
  args: {
    userId: string;
    bookId: string;
    totalChapterCount: number;
  }
): Promise<void> {
  const now = nowIso();

  await Promise.all([
    ddbDoc.send(
      new UpdateCommand({
        TableName: table,
        Key: { PK: pk(args.userId), SK: SNAPSHOT_SK },
        UpdateExpression:
          "SET #updatedAt = :now, #lastActiveAt = :now, #lastBookId = :bk, " +
          "#sv = :sv, #userId = :uid, " +
          "#plan = if_not_exists(#plan, :defPlan), " +
          "#firstSeenAt = if_not_exists(#firstSeenAt, :now), " +
          "#createdAt = if_not_exists(#createdAt, :now) " +
          "ADD #completedBookIds :bkSet, #booksCompleted :one, " +
          "#activeBookIds :bkSet",
        ExpressionAttributeNames: {
          "#updatedAt": "updatedAt",
          "#lastActiveAt": "lastActiveAt",
          "#lastBookId": "lastBookId",
          "#sv": "schemaVersion",
          "#userId": "userId",
          "#plan": "plan",
          "#firstSeenAt": "firstSeenAt",
          "#createdAt": "createdAt",
          "#completedBookIds": "completedBookIds",
          "#booksCompleted": "booksCompleted",
          "#activeBookIds": "activeBookIds",
        },
        ExpressionAttributeValues: {
          ":now": now,
          ":bk": args.bookId,
          ":sv": SCHEMA_V,
          ":uid": args.userId,
          ":defPlan": "FREE",
          ":bkSet": new Set([args.bookId]),
          ":one": 1,
        },
      })
    ),
    putEvent(table, args.userId, "book_completed", now, "FREE", {
      bookId: args.bookId,
      totalChapterCount: args.totalChapterCount,
    }),
  ]);
}

/**
 * Track a settings update (e.g. daily goal change).
 * Updates preference fields on the snapshot.
 */
export async function analyticsTrackSettingsUpdate(
  table: string,
  args: {
    userId: string;
    dailyGoalMinutes?: number;
    preferredReadingDepth?: string;
  }
): Promise<void> {
  const now = nowIso();
  const sets: string[] = [
    "#updatedAt = :now",
    "#sv = :sv",
    "#userId = :uid",
    "#plan = if_not_exists(#plan, :defPlan)",
    "#firstSeenAt = if_not_exists(#firstSeenAt, :now)",
    "#createdAt = if_not_exists(#createdAt, :now)",
  ];
  const names: Record<string, string> = {
    "#updatedAt": "updatedAt",
    "#sv": "schemaVersion",
    "#userId": "userId",
    "#plan": "plan",
    "#firstSeenAt": "firstSeenAt",
    "#createdAt": "createdAt",
  };
  const values: Record<string, unknown> = {
    ":now": now,
    ":sv": SCHEMA_V,
    ":uid": args.userId,
    ":defPlan": "FREE",
  };

  if (args.dailyGoalMinutes !== undefined) {
    sets.push("#dailyGoalMinutes = :dgm");
    names["#dailyGoalMinutes"] = "dailyGoalMinutes";
    values[":dgm"] = args.dailyGoalMinutes;
  }
  if (args.preferredReadingDepth) {
    sets.push("#preferredReadingDepth = :prd");
    names["#preferredReadingDepth"] = "preferredReadingDepth";
    values[":prd"] = args.preferredReadingDepth;
  }

  await ddbDoc.send(
    new UpdateCommand({
      TableName: table,
      Key: { PK: pk(args.userId), SK: SNAPSHOT_SK },
      UpdateExpression: `SET ${sets.join(", ")}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
    })
  );
}

export async function analyticsTrackFlowPointsTransaction(
  table: string,
  args: {
    userId: string;
    deltaPoints: number;
    direction: "earn" | "spend" | "adjustment";
    sourceType: string;
    sourceId: string;
    rewardId?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  const now = nowIso();
  const delta = Math.trunc(args.deltaPoints);
  if (delta === 0) return;

  await Promise.all([
    ddbDoc.send(
      new UpdateCommand({
        TableName: table,
        Key: { PK: pk(args.userId), SK: SNAPSHOT_SK },
        UpdateExpression:
          "SET #updatedAt = :now, #lastActiveAt = :now, #sv = :sv, #userId = :uid, " +
          "#plan = if_not_exists(#plan, :defPlan), " +
          "#firstSeenAt = if_not_exists(#firstSeenAt, :now), " +
          "#createdAt = if_not_exists(#createdAt, :now) " +
          "ADD #flowPoints :pts",
        ExpressionAttributeNames: {
          "#updatedAt": "updatedAt",
          "#lastActiveAt": "lastActiveAt",
          "#sv": "schemaVersion",
          "#userId": "userId",
          "#plan": "plan",
          "#firstSeenAt": "firstSeenAt",
          "#createdAt": "createdAt",
          "#flowPoints": "flowPoints",
        },
        ExpressionAttributeValues: {
          ":now": now,
          ":sv": SCHEMA_V,
          ":uid": args.userId,
          ":defPlan": "FREE",
          ":pts": delta,
        },
      })
    ),
    putEvent(table, args.userId, delta > 0 ? "flow_points_earned" : "flow_points_spent", now, "FREE", {
      deltaPoints: delta,
      direction: args.direction,
      sourceType: args.sourceType,
      sourceId: args.sourceId,
      rewardId: args.rewardId,
      ...(args.metadata ?? {}),
    }),
  ]);
}

export async function analyticsTrackReferral(
  table: string,
  args: {
    userId: string;
    eventType: "referral_claimed" | "referral_activated" | "referral_pro_rewarded";
    inviteCode: string;
    referredUserId?: string;
    pointsAwarded?: number;
  }
): Promise<void> {
  const now = nowIso();
  await putEvent(table, args.userId, args.eventType, now, "FREE", {
    inviteCode: args.inviteCode,
    referredUserId: args.referredUserId,
    pointsAwarded: args.pointsAwarded,
  });
}
