import "server-only";

import { requireActiveBookUser } from "@/app/app/api/book/_lib/account-guard";
import {
  bookOk,
  requireBodyObject,
  requireString,
  withBookApiErrors,
} from "@/app/app/api/book/_lib/http";
import {
  getBookAnalyticsTableName,
  getBookContentBucket,
  getBookTableName,
} from "@/app/app/api/book/_lib/env";
import {
  applyStartDeviceCookie,
  ensureUserBookStarted,
} from "@/app/app/api/book/_lib/ensure-book-started";
import { BookApiError } from "@/app/app/api/book/_lib/errors";
import {
  getUserEngagement,
  listApprovedScenariosForChapter,
  listUserScenarioSubmissions,
  putApprovedScenario,
  putScenarioLookup,
  putScenarioModerationItem,
  putUserScenarioSubmission,
} from "@/app/app/api/book/_lib/repo";
import { awardFlowPoints } from "@/app/app/api/book/_lib/flow-points-repo";
import { validateScenario, type ScenarioValidationResult } from "@/app/app/api/book/_lib/ai-service";
import {
  coarseReason,
  getScenarioValidationModel,
  scenarioValidationUnavailable,
} from "@/app/app/api/book/_lib/ai-config";
import { putOpsMetric } from "@/app/app/api/book/_lib/cloudwatch-metrics";
import { getServerEnv } from "@/app/app/api/_lib/server-env";
import { createNotification } from "@/app/app/api/book/_lib/notifications-repo";
import { getPublishedBookManifest } from "@/app/app/api/book/_lib/content-service";
import { ddbDoc } from "@/app/app/api/_lib/aws";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { bookUserPk } from "@/app/app/api/book/_lib/keys";
import type {
  BookScenarioLookupItem,
  BookScenarioModerationItem,
  BookUserScenarioSubmissionItem,
  ScenarioScope,
  ScenarioSubmissionStatus,
} from "@/app/app/api/book/_lib/types";
import { analyticsTrackScenario, analyticsTrackFlowPointsTransaction } from "@/app/app/api/book/_lib/analytics-repo";
import { nowIso } from "@/app/app/api/book/_lib/keys";
import { INSIGHT_POINTS_AMOUNTS } from "@/app/book/_lib/flow-points-economy";

export const runtime = "nodejs";

const SCENARIO_APPROVAL_POINTS = INSIGHT_POINTS_AMOUNTS.scenarioApproved;

// Per-user/day cap on scenario submissions. Each accepted submission can fire a
// Haiku moderation call (validateScenario) and, on auto_approve, awards Insight
// Points — so an uncapped POST is both an LLM cost-abuse vector and a
// points-farming avenue (L41). Generous enough not to bother a real contributor.
const SCENARIO_SUBMIT_DAILY_LIMIT = 20;

function normalizeScenarioPerspective(value: string): string {
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (!cleaned) return cleaned;
  return cleaned
    .replace(/\bYou are\b/gi, "Maya is")
    .replace(/\bYou're\b/gi, "Maya is")
    .replace(/\bYou have\b/gi, "Maya has")
    .replace(/\bYou\b/gi, "Maya")
    .replace(/\bYour\b/g, "Maya's")
    .replace(/\byour\b/g, "Maya's")
    .replace(/\bMaya have\b/g, "Maya has")
    .replace(/\bMaya are\b/g, "Maya is");
}

function parseScope(value: unknown): ScenarioScope {
  if (value === "work" || value === "school" || value === "personal") return value;
  throw new BookApiError(
    400,
    "invalid_input",
    "scope must be one of: work, school, personal."
  );
}

export async function GET(
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

    const [tableName, contentBucket] = await Promise.all([
      getBookTableName(),
      getBookContentBucket(),
    ]);
    const chapterNumberInt = Math.floor(chapterNum);
    const started = await ensureUserBookStarted({
      req,
      user,
      tableName,
      contentBucket,
      bookId,
      interactionChapterNumber: chapterNumberInt,
    });
    const [approved, mine, engagement] = await Promise.all([
      listApprovedScenariosForChapter(tableName, bookId, chapterNumberInt, 300),
      listUserScenarioSubmissions(tableName, user.sub, {
        bookId,
        chapterNumber: chapterNumberInt,
        limit: 200,
      }),
      getUserEngagement(tableName, user.sub),
    ]);

    const response = bookOk({
      approvedScenarios: approved.map((item) => ({
        id: `community-${item.submissionId}`,
        title: item.title,
        scope: item.scope,
        scenario: item.scenario,
        whatToDo: item.whatToDo,
        whyItMatters: item.whyItMatters,
      })),
      mySubmissions: mine.map((item) => ({
        submissionId: item.submissionId,
        title: item.title,
        scenario: item.scenario,
        whatToDo: item.whatToDo,
        whyItMatters: item.whyItMatters,
        scope: item.scope,
        status: item.status,
        createdAt: item.createdAt,
        reviewedAt: item.reviewedAt,
        reviewNotes: item.reviewNotes,
      })),
      points: engagement?.points ?? 0,
    });
    return applyStartDeviceCookie(response, started);
  });
}

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

    let bodyRaw: unknown;
    try {
      bodyRaw = await req.json();
    } catch {
      throw new BookApiError(400, "invalid_json", "Request body must be valid JSON.");
    }
    const body = requireBodyObject(bodyRaw);
    const title = requireString(body.title, "title", { minLength: 6, maxLength: 160 });
    const scenario = normalizeScenarioPerspective(
      requireString(body.scenario, "scenario", { minLength: 40, maxLength: 2500 })
    );
    const whatToDo = requireString(body.whatToDo, "whatToDo", {
      minLength: 20,
      maxLength: 2500,
    });
    const whyItMatters = requireString(body.whyItMatters, "whyItMatters", {
      minLength: 20,
      maxLength: 2500,
    });
    const scope = parseScope(body.scope);
    const chapterId =
      typeof body.chapterId === "string" && body.chapterId.trim()
        ? body.chapterId.trim()
        : undefined;

    const [tableName, contentBucket] = await Promise.all([
      getBookTableName(),
      getBookContentBucket(),
    ]);
    const createdAt = nowIso();
    const submissionId = crypto.randomUUID();
    const chapterNumberInt = Math.floor(chapterNum);
    const started = await ensureUserBookStarted({
      req,
      user,
      tableName,
      contentBucket,
      bookId,
      interactionChapterNumber: chapterNumberInt,
    });

    // ── Per-user daily submission cap (L41) ──────────────────────────────────
    // Atomically reserve one submission against the daily cap BEFORE the Haiku
    // moderation call (validateScenario) below. The conditional increment
    // serializes concurrent requests — only the writer that brings the count to
    // the limit succeeds; the rest fail the condition and get 429 — and counts
    // the attempt the moment it is accepted, so a caller can't farm cheap LLM
    // calls or coax-for-auto_approve point grants past the cap. TTL'd so the
    // counter self-cleans a few days after the day it tracks.
    const submitDay = createdAt.slice(0, 10);
    const submitLimitTtl = Math.floor(Date.now() / 1000) + 3 * 86400;
    try {
      await ddbDoc.send(
        new UpdateCommand({
          TableName: tableName,
          Key: { PK: bookUserPk(user.sub), SK: `SCENARIO_SUBMIT_LIMIT#${submitDay}` },
          UpdateExpression:
            "SET #count = if_not_exists(#count, :zero) + :one, updatedAt = :now, entity = :entity, #ttl = :ttl",
          ConditionExpression: "attribute_not_exists(#count) OR #count < :limit",
          ExpressionAttributeNames: { "#count": "count", "#ttl": "ttl" },
          ExpressionAttributeValues: {
            ":zero": 0,
            ":one": 1,
            ":now": createdAt,
            ":entity": "SCENARIO_SUBMIT_LIMIT",
            ":ttl": submitLimitTtl,
            ":limit": SCENARIO_SUBMIT_DAILY_LIMIT,
          },
        }),
      );
    } catch (e) {
      if (e instanceof ConditionalCheckFailedException) {
        throw new BookApiError(
          429,
          "submission_limit",
          `Daily scenario submission limit reached (${SCENARIO_SUBMIT_DAILY_LIMIT}/day). Try again tomorrow.`
        );
      }
      throw e;
    }

    // ── AI Validation ───────────────────────────────────────────────────────
    const apiKey = await getServerEnv("ANTHROPIC_API_KEY");
    // Default to the queue-for-review fallback (records the configured model so
    // the audit trail is honest even when the key is absent and validation never runs).
    let aiResult: ScenarioValidationResult = scenarioValidationUnavailable(
      await getScenarioValidationModel()
    );

    if (apiKey) {
      let chapterTitle = `Chapter ${chapterNumberInt}`;
      let bookTitle = "";
      try {
        const { manifest } = await getPublishedBookManifest({ tableName, contentBucket, bookId });
        bookTitle = manifest.title;
        chapterTitle = manifest.chapters.find((c) => c.number === chapterNumberInt)?.title ?? chapterTitle;
      } catch {
        // Use fallback chapter title
      }
      aiResult = await validateScenario({
        title, scenario, whatToDo, whyItMatters,
        scope, chapterTitle, bookTitle, apiKey,
      });
    }

    const initialStatus: ScenarioSubmissionStatus =
      aiResult.decision === "auto_approve" ? "approved"
      : aiResult.decision === "auto_reject" ? "rejected"
      : "pending";

    // ── Build records ────────────────────────────────────────────────────────
    const submissionItem: BookUserScenarioSubmissionItem = {
      userId: user.sub,
      submissionId,
      bookId,
      chapterNumber: chapterNumberInt,
      chapterId,
      title,
      scenario,
      whatToDo,
      whyItMatters,
      scope,
      status: initialStatus,
      pointsAwarded: SCENARIO_APPROVAL_POINTS,
      createdAt,
      updatedAt: createdAt,
      userEmail: user.email,
      userName: user.name ?? user.givenName,
      aiValidation: {
        decision: aiResult.decision,
        reason: aiResult.reason,
        model: aiResult.model,
        validatedAt: createdAt,
      },
      ...(initialStatus === "rejected" ? { reviewedAt: createdAt, reviewNotes: aiResult.reason } : {}),
    };

    const lookupItem: BookScenarioLookupItem = {
      submissionId,
      userId: user.sub,
      bookId,
      chapterNumber: chapterNumberInt,
      createdAt,
      status: initialStatus,
      pointsAwarded: SCENARIO_APPROVAL_POINTS,
      ...(initialStatus === "pending" ? { queuedAt: createdAt } : {}),
      ...(initialStatus === "approved" ? { approvedAt: createdAt } : {}),
      updatedAt: createdAt,
    };

    // ── Write to DB (3 paths) ────────────────────────────────────────────────
    if (initialStatus === "approved") {
      // Auto-approved: write submission + approved scenario + lookup (skip moderation queue)
      await Promise.all([
        putUserScenarioSubmission(tableName, submissionItem),
        putApprovedScenario(tableName, {
          submissionId,
          userId: user.sub,
          bookId,
          chapterNumber: chapterNumberInt,
          chapterId,
          title,
          scenario,
          whatToDo,
          whyItMatters,
          scope,
          approvedAt: createdAt,
          createdAt,
          updatedAt: createdAt,
        }),
        putScenarioLookup(tableName, lookupItem),
      ]);

      // Award flow points
      const pointsResult = await awardFlowPoints(tableName, {
        userId: user.sub,
        amount: SCENARIO_APPROVAL_POINTS,
        sourceType: "scenario_approved",
        sourceId: submissionId,
        metadata: { scope, bookId },
      });

      // Notification — fire-and-forget
      createNotification(tableName, {
        userId: user.sub,
        type: "scenario_approved",
        title: "Scenario Approved!",
        body: `Your scenario "${title}" was approved! +${SCENARIO_APPROVAL_POINTS} Insight Points.`,
        metadata: { submissionId, ip: SCENARIO_APPROVAL_POINTS },
        userEmail: user.email,
        userName: user.name ?? user.givenName,
      }).catch(() => {});

      // Analytics — fire-and-forget
      getBookAnalyticsTableName().then((analyticsTable) => {
        if (!analyticsTable) return;
        Promise.all([
          analyticsTrackScenario(analyticsTable, {
            userId: user.sub, bookId, chapterNumber: chapterNumberInt,
            stage: "auto_approved", pointsAwarded: SCENARIO_APPROVAL_POINTS,
          }),
          pointsResult.awarded ? analyticsTrackFlowPointsTransaction(analyticsTable, {
            userId: user.sub, deltaPoints: SCENARIO_APPROVAL_POINTS,
            direction: "earn", sourceType: "scenario_approved", sourceId: submissionId,
            metadata: { scope, bookId },
          }) : Promise.resolve(),
        ]).catch(() => {});
      }).catch(() => {});

    } else if (initialStatus === "rejected") {
      // Auto-rejected: write submission + lookup (skip moderation queue + approved scenario)
      await Promise.all([
        putUserScenarioSubmission(tableName, submissionItem),
        putScenarioLookup(tableName, lookupItem),
      ]);

      // Notification — fire-and-forget
      createNotification(tableName, {
        userId: user.sub,
        type: "scenario_rejected",
        title: "Scenario Not Approved",
        body: `Your scenario "${title}" wasn't approved: ${aiResult.reason}`,
        metadata: { submissionId },
        userEmail: user.email,
        userName: user.name ?? user.givenName,
      }).catch(() => {});

      // Analytics — fire-and-forget
      getBookAnalyticsTableName().then((analyticsTable) => {
        if (!analyticsTable) return;
        analyticsTrackScenario(analyticsTable, {
          userId: user.sub, bookId, chapterNumber: chapterNumberInt,
          stage: "auto_rejected", pointsAwarded: 0,
        }).catch(() => {});
      }).catch(() => {});

    } else {
      // Queued for review: existing flow
      const moderationItem: BookScenarioModerationItem = {
        ...submissionItem,
        queuedAt: createdAt,
      };
      await Promise.all([
        putUserScenarioSubmission(tableName, submissionItem),
        putScenarioModerationItem(tableName, moderationItem),
        putScenarioLookup(tableName, lookupItem),
      ]);

      // Track manual-review backlog inflow (rate + coarse cause). Complements the
      // on-demand depth gauge in admin/metrics/moderation. Fire-and-forget.
      void putOpsMetric("ScenarioModerationQueued", 1, { reason: coarseReason(aiResult.reason) });

      // Analytics — fire-and-forget
      getBookAnalyticsTableName().then((analyticsTable) => {
        if (!analyticsTable) return;
        analyticsTrackScenario(analyticsTable, {
          userId: user.sub, bookId, chapterNumber: chapterNumberInt,
          stage: "submitted", pointsAwarded: 0,
        }).catch(() => {});
      }).catch(() => {});
    }

    const response = bookOk({
      submission: {
        submissionId,
        title,
        scenario,
        whatToDo,
        whyItMatters,
        scope,
        status: initialStatus,
        createdAt,
        ...(initialStatus === "rejected" ? { reviewNotes: aiResult.reason } : {}),
      },
      points: (await getUserEngagement(tableName, user.sub))?.points ?? 0,
    });
    return applyStartDeviceCookie(response, started);
  });
}
