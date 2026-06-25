import "server-only";

import { requireAdminUser } from "@/app/app/api/book/_lib/admin-auth";
import { createNotification } from "@/app/app/api/book/_lib/notifications-repo";
import {
  bookOk,
  requireBodyObject,
  requireString,
  withBookApiErrors,
} from "@/app/app/api/book/_lib/http";
import { getBookAnalyticsTableName, getBookTableName } from "@/app/app/api/book/_lib/env";
import { BookApiError } from "@/app/app/api/book/_lib/errors";
import {
  deleteApprovedScenario,
  deleteScenarioModerationItem,
  getScenarioLookup,
  getUserScenarioSubmission,
  putApprovedScenario,
  putScenarioLookup,
  putUserScenarioSubmission,
} from "@/app/app/api/book/_lib/repo";
import {
  analyticsTrackFlowPointsTransaction,
  analyticsTrackScenario,
} from "@/app/app/api/book/_lib/analytics-repo";
import {
  awardFlowPoints,
  reverseFlowPointsAward,
} from "@/app/app/api/book/_lib/flow-points-repo";
import { decideScenarioReversal } from "@/app/app/api/book/_lib/scenario-reversal-core";
import { nowIso } from "@/app/app/api/book/_lib/keys";

export const runtime = "nodejs";

function parseStatus(value: unknown): "approved" | "rejected" {
  if (value === "approved" || value === "rejected") return value;
  throw new BookApiError(
    400,
    "invalid_input",
    "status must be approved or rejected."
  );
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ submissionId: string }> }
) {
  return withBookApiErrors(req, async () => {
    const admin = await requireAdminUser();
    const { submissionId } = await params;
    if (!submissionId) {
      throw new BookApiError(400, "invalid_input", "submissionId is required.");
    }

    let bodyRaw: unknown;
    try {
      bodyRaw = await req.json();
    } catch {
      bodyRaw = {};
    }
    const body = requireBodyObject(bodyRaw);
    const status = parseStatus(body.status);
    const reviewNotes =
      body.reviewNotes == null
        ? undefined
        : requireString(body.reviewNotes, "reviewNotes", {
            minLength: 1,
            maxLength: 1200,
          });

    const tableName = await getBookTableName();
    const lookup = await getScenarioLookup(tableName, submissionId);
    if (!lookup) {
      throw new BookApiError(404, "not_found", "Scenario submission not found.");
    }

    const existing = await getUserScenarioSubmission(
      tableName,
      lookup.userId,
      lookup.bookId,
      lookup.chapterNumber,
      submissionId
    );
    if (!existing) {
      throw new BookApiError(404, "not_found", "Scenario submission not found.");
    }
    const wasApprovedAlready = lookup.status === "approved";

    const now = nowIso();
    const updatedSubmission = {
      ...existing,
      status,
      reviewedAt: now,
      reviewedBy: admin.sub,
      reviewNotes,
      updatedAt: now,
    };

    await putUserScenarioSubmission(tableName, updatedSubmission);

    if (lookup.queuedAt) {
      await deleteScenarioModerationItem(tableName, submissionId, lookup.queuedAt);
    }

    if (status === "approved") {
      await putApprovedScenario(tableName, {
        submissionId,
        userId: existing.userId,
        bookId: existing.bookId,
        chapterNumber: existing.chapterNumber,
        chapterId: existing.chapterId,
        title: existing.title,
        scenario: existing.scenario,
        whatToDo: existing.whatToDo,
        whyItMatters: existing.whyItMatters,
        scope: existing.scope,
        approvedAt: now,
        createdAt: existing.createdAt,
        updatedAt: now,
      });
    } else if (lookup.approvedAt) {
      await deleteApprovedScenario(
        tableName,
        existing.bookId,
        existing.chapterNumber,
        lookup.approvedAt,
        submissionId
      );
    }

    await putScenarioLookup(tableName, {
      ...lookup,
      status,
      queuedAt: undefined,
      approvedAt: status === "approved" ? now : undefined,
      updatedAt: now,
    });

    if (status === "approved" && !wasApprovedAlready) {
      const awarded = await awardFlowPoints(tableName, {
        userId: existing.userId,
        amount: existing.pointsAwarded,
        sourceType: "scenario_approved",
        sourceId: submissionId,
        metadata: {
          scope: existing.scope,
          bookId: existing.bookId,
        },
        createdAt: now,
      });

      getBookAnalyticsTableName()
        .then((analyticsTable) => {
          if (!analyticsTable) return;
          return Promise.allSettled([
            analyticsTrackScenario(analyticsTable, {
              userId: existing.userId,
              bookId: existing.bookId,
              chapterNumber: existing.chapterNumber,
              stage: "approved",
              pointsAwarded: existing.pointsAwarded,
            }),
            awarded.awarded
              ? analyticsTrackFlowPointsTransaction(analyticsTable, {
                  userId: existing.userId,
                  deltaPoints: existing.pointsAwarded,
                  direction: "earn",
                  sourceType: "scenario_approved",
                  sourceId: submissionId,
                  metadata: {
                    scope: existing.scope,
                    bookId: existing.bookId,
                  },
                })
              : Promise.resolve(),
          ]);
        })
        .catch(() => {});
    }

    // H4 clawback: re-rejecting a previously-approved scenario reverses the IP
    // it earned. The award path fired exactly `existing.pointsAwarded` on the
    // approve, idempotent on submissionId; this deducts the same (clamped to the
    // current balance, idempotent on submissionId) so a mis-approval / flagged
    // abuse can't leave the user holding unearned points.
    const reversal = decideScenarioReversal({
      wasApprovedAlready,
      status,
      pointsAwarded: existing.pointsAwarded,
    });
    if (reversal.reverse) {
      const reversed = await reverseFlowPointsAward(tableName, {
        userId: existing.userId,
        amount: reversal.amount,
        sourceType: "scenario_reversal",
        sourceId: submissionId,
        metadata: {
          scope: existing.scope,
          bookId: existing.bookId,
          reversedSourceType: "scenario_approved",
          reviewedBy: admin.sub,
        },
        createdAt: now,
      });

      if (reversed.reversed && reversed.pointsDeducted > 0) {
        getBookAnalyticsTableName()
          .then((analyticsTable) => {
            if (!analyticsTable) return;
            return analyticsTrackFlowPointsTransaction(analyticsTable, {
              userId: existing.userId,
              deltaPoints: reversed.pointsDeducted,
              direction: "spend",
              sourceType: "scenario_reversal",
              sourceId: submissionId,
              metadata: {
                scope: existing.scope,
                bookId: existing.bookId,
              },
            });
          })
          .catch(() => {});
      }
    }

    // Notify user — fire-and-forget
    const notifType = status === "approved" ? "scenario_approved" as const : "scenario_rejected" as const;
    createNotification(tableName, {
      userId: existing.userId,
      type: notifType,
      title: status === "approved" ? "Scenario Approved!" : "Scenario Not Approved",
      body: status === "approved"
        ? `Your scenario "${existing.title}" was approved! +${existing.pointsAwarded} Insight Points.`
        : `Your scenario "${existing.title}" wasn't approved.${reviewNotes ? ` Reason: ${reviewNotes}` : ""}`,
      metadata: { submissionId },
      userEmail: existing.userEmail,
      userName: existing.userName,
    }).catch(() => {});

    return bookOk({
      submission: {
        submissionId,
        userId: existing.userId,
        bookId: existing.bookId,
        chapterNumber: existing.chapterNumber,
        status,
        reviewedAt: now,
        reviewNotes: reviewNotes ?? null,
      },
    });
  });
}
