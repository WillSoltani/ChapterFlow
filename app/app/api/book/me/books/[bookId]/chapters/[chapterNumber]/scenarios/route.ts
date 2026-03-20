import "server-only";

import { requireUser } from "@/app/app/api/_lib/auth";
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
  putScenarioLookup,
  putScenarioModerationItem,
  putUserScenarioSubmission,
} from "@/app/app/api/book/_lib/repo";
import type {
  BookScenarioLookupItem,
  BookScenarioModerationItem,
  BookUserScenarioSubmissionItem,
  ScenarioScope,
} from "@/app/app/api/book/_lib/types";
import { analyticsTrackScenario } from "@/app/app/api/book/_lib/analytics-repo";
import { nowIso } from "@/app/app/api/book/_lib/keys";
import { FLOW_POINTS_AMOUNTS } from "@/app/book/_lib/flow-points-economy";

export const runtime = "nodejs";

const SCENARIO_APPROVAL_POINTS = FLOW_POINTS_AMOUNTS.scenarioApproved;

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
    const user = await requireUser();
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
      status: "pending",
      pointsAwarded: SCENARIO_APPROVAL_POINTS,
      createdAt,
      updatedAt: createdAt,
    };
    const moderationItem: BookScenarioModerationItem = {
      ...submissionItem,
      queuedAt: createdAt,
    };
    const lookupItem: BookScenarioLookupItem = {
      submissionId,
      userId: user.sub,
      bookId,
      chapterNumber: chapterNumberInt,
      createdAt,
      status: "pending",
      pointsAwarded: SCENARIO_APPROVAL_POINTS,
      queuedAt: createdAt,
      updatedAt: createdAt,
    };

    await Promise.all([
      putUserScenarioSubmission(tableName, submissionItem),
      putScenarioModerationItem(tableName, moderationItem),
      putScenarioLookup(tableName, lookupItem),
    ]);

    // Analytics — fire-and-forget
    getBookAnalyticsTableName().then((analyticsTable) => {
      if (!analyticsTable) return;
      analyticsTrackScenario(analyticsTable, {
        userId: user.sub,
        bookId,
        chapterNumber: chapterNumberInt,
        stage: "submitted",
        pointsAwarded: 0,
      }).catch(() => {});
    }).catch(() => {});

    const response = bookOk({
      submission: {
        submissionId,
        title,
        scenario,
        whatToDo,
        whyItMatters,
        scope,
        status: "pending",
        createdAt,
      },
      points: (await getUserEngagement(tableName, user.sub))?.points ?? 0,
    });
    return applyStartDeviceCookie(response, started);
  });
}
