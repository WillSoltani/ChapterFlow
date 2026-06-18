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
  listCommitments,
  updateCommitmentStatus,
} from "@/app/app/api/book/_lib/commitment-repo";
import { analyticsTrackCommitment } from "@/app/app/api/book/_lib/analytics-repo";
import { awardFlowPoints } from "@/app/app/api/book/_lib/flow-points-repo";
import { INSIGHT_POINTS_AMOUNTS } from "@/app/book/_lib/flow-points-economy";
import type { CommitmentOutcome } from "@/app/app/api/book/_lib/types";

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

      // Optional structured self-report ("did it help?"). Reject any other value so
      // a malformed client can't write garbage; absent is allowed (back-compat with
      // clients that only send the reflection).
      let outcome: CommitmentOutcome | undefined;
      if (body.outcome !== undefined && body.outcome !== null) {
        if (body.outcome === "helped" || body.outcome === "partly" || body.outcome === "didnt") {
          outcome = body.outcome;
        } else {
          return bookErr(req, 400, "invalid_outcome", "outcome must be 'helped', 'partly', or 'didnt'");
        }
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
          outcome,
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
            helped: outcome,
          });
        })
        .catch(() => {});

      // Two-axis completion (feedback #4): fire an `application_complete` funnel event
      // the FIRST time this chapter becomes "applied". Dedupe against any OTHER prior
      // follow-through for the same (bookId, chapterNumber) — exclude the just-completed
      // commitment, which now also has followThroughSubmittedAt set — so a re-applied
      // chapter isn't double-counted. Read-only, fire-and-forget; gates nothing.
      getBookAnalyticsTableName()
        .then(async (analyticsTable) => {
          if (!analyticsTable) return;
          const all = await listCommitments(tableName, user.sub);
          const alreadyApplied = all.some(
            (c) =>
              c.commitmentId !== commitmentId &&
              c.bookId === existing.bookId &&
              c.chapterNumber === existing.chapterNumber &&
              c.followThroughSubmittedAt != null,
          );
          if (alreadyApplied) return;
          return analyticsTrackCommitment(analyticsTable, user.sub, "application_complete", {
            commitmentId,
            bookId: existing.bookId,
            chapterNumber: existing.chapterNumber,
            followUpDays: existing.followUpDays,
            helped: outcome,
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
