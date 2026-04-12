import "server-only";

import { requireUser } from "@/app/app/api/_lib/auth";
import {
  bookOk,
  bookErr,
  requireBodyObject,
  withBookApiErrors,
} from "@/app/app/api/book/_lib/http";
import { getBookTableName } from "@/app/app/api/book/_lib/env";
import {
  getCommitment,
  updateCommitmentStatus,
} from "@/app/app/api/book/_lib/commitment-repo";
import { awardFlowPoints } from "@/app/app/api/book/_lib/flow-points-repo";
import { INSIGHT_POINTS_AMOUNTS } from "@/app/book/_lib/flow-points-economy";

export const runtime = "nodejs";

type Params = { params: Promise<{ commitmentId: string }> };

export async function PATCH(req: Request, ctx: Params) {
  return withBookApiErrors(req, async () => {
    const user = await requireUser();
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

      const updated = await updateCommitmentStatus(
        tableName,
        user.sub,
        commitmentId,
        "completed",
        reflection,
      );

      const ipResult = await awardFlowPoints(tableName, {
        userId: user.sub,
        amount: INSIGHT_POINTS_AMOUNTS.commitmentFollowThrough,
        sourceType: "commitment_follow_through",
        sourceId: commitmentId,
      });

      return bookOk({
        commitment: updated,
        ipAwarded: INSIGHT_POINTS_AMOUNTS.commitmentFollowThrough,
        balance: ipResult.state.points,
      });
    }

    if (action === "skip") {
      const updated = await updateCommitmentStatus(
        tableName,
        user.sub,
        commitmentId,
        "skipped",
      );
      return bookOk({ commitment: updated, ipAwarded: 0 });
    }

    return bookErr(req, 400, "invalid_action", "Action must be 'complete' or 'skip'");
  });
}
