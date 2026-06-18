import "server-only";

import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { requireActiveBookUser } from "@/app/app/api/book/_lib/account-guard";
import {
  bookOk,
  bookErr,
  requireBodyObject,
  withBookApiErrors,
} from "@/app/app/api/book/_lib/http";
import { getBookTableName, getBookAnalyticsTableName } from "@/app/app/api/book/_lib/env";
import {
  getCommitment,
  updateCommitmentStatus,
} from "@/app/app/api/book/_lib/commitment-repo";
import { analyticsTrackCommitment } from "@/app/app/api/book/_lib/analytics-repo";
import { awardFlowPoints } from "@/app/app/api/book/_lib/flow-points-repo";
import { INSIGHT_POINTS_AMOUNTS } from "@/app/book/_lib/flow-points-economy";

export const runtime = "nodejs";

type Params = { params: Promise<{ commitmentId: string }> };

export async function PATCH(req: Request, ctx: Params) {
  return withBookApiErrors(req, async () => {
    const user = await requireActiveBookUser();
    const tableName = await getBookTableName();
    const { commitmentId } = await ctx.params;
    const body = requireBodyObject(await req.json());

    const action = typeof body.action === "string" ? body.action : "";

    const existing = await getCommitment(tableName, user.sub, commitmentId);
    if (!existing) return bookErr(req, 404, "not_found", "Commitment not found");
    if (existing.status !== "active") {
      return bookErr(req, 400, "not_active", "Commitment is not active");
    }

    if (action === "complete") {
      const reflection = typeof body.followThroughReflection === "string"
        ? body.followThroughReflection.trim()
        : "";

      if (reflection.length < 10 || reflection.length > 1000) {
        return bookErr(req, 400, "invalid_reflection", "Reflection must be 10-1000 characters");
      }

      const ipAmount = INSIGHT_POINTS_AMOUNTS.commitmentFollowThrough;

      let updated;
      try {
        updated = await updateCommitmentStatus(
          tableName,
          user.sub,
          commitmentId,
          "completed",
          reflection,
          ipAmount,
        );
      } catch (err) {
        if (err instanceof ConditionalCheckFailedException) {
          return bookErr(req, 409, "already_updated", "Commitment was already updated");
        }
        throw err;
      }

      const ipResult = await awardFlowPoints(tableName, {
        userId: user.sub,
        amount: ipAmount,
        sourceType: "commitment_follow_through",
        sourceId: commitmentId,
      });

      // Always-on commitment-funnel event (not gated on beacon opt-in). Fire-and-forget.
      getBookAnalyticsTableName()
        .then((analyticsTable) => {
          if (!analyticsTable) return;
          return analyticsTrackCommitment(analyticsTable, user.sub, "followup_completed", {
            commitmentId,
            bookId: existing.bookId,
            chapterNumber: existing.chapterNumber,
            followUpDays: existing.followUpDays,
          });
        })
        .catch(() => {});

      return bookOk({
        commitment: updated,
        ipAwarded: ipAmount,
        balance: ipResult.state.points,
      });
    }

    if (action === "skip") {
      try {
        const updated = await updateCommitmentStatus(
          tableName,
          user.sub,
          commitmentId,
          "skipped",
        );

        // Always-on commitment-funnel event (not gated on beacon opt-in). Fire-and-forget.
        getBookAnalyticsTableName()
          .then((analyticsTable) => {
            if (!analyticsTable) return;
            return analyticsTrackCommitment(analyticsTable, user.sub, "followup_skipped", {
              commitmentId,
              bookId: existing.bookId,
              chapterNumber: existing.chapterNumber,
              followUpDays: existing.followUpDays,
            });
          })
          .catch(() => {});

        return bookOk({ commitment: updated, ipAwarded: 0 });
      } catch (err) {
        if (err instanceof ConditionalCheckFailedException) {
          return bookErr(req, 409, "already_updated", "Commitment was already updated");
        }
        throw err;
      }
    }

    return bookErr(req, 400, "invalid_action", "Action must be 'complete' or 'skip'");
  });
}
