import "server-only";

import { requireAdminUser } from "@/app/app/api/book/_lib/admin-auth";
import {
  bookOk,
  requireBodyObject,
  requireString,
  withBookApiErrors,
} from "@/app/app/api/book/_lib/http";
import { getBookTableName } from "@/app/app/api/book/_lib/env";
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
