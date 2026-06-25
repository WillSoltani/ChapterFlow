import "server-only";

import { requireAdminUser } from "@/app/app/api/book/_lib/admin-auth";
import {
  bookOk,
  requireBodyObject,
  requireString,
  withBookApiErrors,
} from "@/app/app/api/book/_lib/http";
import { BookApiError } from "@/app/app/api/book/_lib/errors";
import { getBookTableName } from "@/app/app/api/book/_lib/env";
import {
  getAccountStatus,
  getUserEntitlement,
  listAccountStatusChanges,
  setAccountStatus,
} from "@/app/app/api/book/_lib/repo";
import { getStripeClient } from "@/app/app/api/book/_lib/stripe-service";
import { captureStripeCancelFailure } from "@/app/app/api/book/_lib/ops-failure-repo";
import {
  applyAccountStatusTransition,
  type AccountTransitionAction,
} from "@/app/app/api/book/_lib/account-status-transition";
import type { AccountStatus } from "@/app/app/api/book/_lib/types";

export const runtime = "nodejs";

/**
 * GET  /app/api/book/admin/users/[userId]/account-status
 *   → { status, statusChangedAt, history }
 *
 * POST /app/api/book/admin/users/[userId]/account-status
 *   Body: { action: "reactivate" | "deactivate" | "delete", reason? }
 *
 * Admin-driven account-lifecycle transitions (the reversal/override tooling the
 * self-service routes never offered). These are pure status transitions — they
 * do NOT touch Stripe or purge data. Use the `/erase` endpoint for a full,
 * irreversible teardown. Every transition is recorded in the status audit log
 * with changedBy="admin:<adminUserId>".
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  return withBookApiErrors(req, async () => {
    await requireAdminUser();
    const { userId } = await params;
    if (!userId) throw new BookApiError(400, "invalid_user_id", "userId is required.");
    const tableName = await getBookTableName();
    const [current, history] = await Promise.all([
      getAccountStatus(tableName, userId),
      listAccountStatusChanges(tableName, userId, 50),
    ]);
    return bookOk({
      userId,
      status: current?.status ?? "active",
      statusChangedAt: current?.statusChangedAt ?? null,
      history,
    });
  });
}

const ACTION_TO_STATUS: Record<string, { status: AccountStatus; reason: string }> = {
  reactivate: { status: "active", reason: "admin_reactivated" },
  deactivate: { status: "deactivated", reason: "admin_deactivated" },
  delete: { status: "deleted", reason: "admin_deleted" },
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  return withBookApiErrors(req, async () => {
    const admin = await requireAdminUser();
    const { userId } = await params;
    if (!userId) throw new BookApiError(400, "invalid_user_id", "userId is required.");

    const body = requireBodyObject(await req.json().catch(() => ({})));
    const action = requireString(body.action, "action");
    const mapping = ACTION_TO_STATUS[action];
    if (!mapping) {
      throw new BookApiError(
        400,
        "invalid_action",
        'action must be "reactivate", "deactivate", or "delete".'
      );
    }

    const tableName = await getBookTableName();
    const reason =
      typeof body.reason === "string" && body.reason.trim()
        ? `${mapping.reason}: ${body.reason.trim().slice(0, 300)}`
        : mapping.reason;

    // Mirror the self-service routes' handling (read-first, no error swallowing,
    // best-effort cancel) so an admin-driven deactivate/delete doesn't leave a
    // paying subscription running. A transient entitlement-read failure fails
    // the whole transition (the admin retries) rather than silently skipping the
    // cancel; reactivate touches no billing. See account-status-transition.ts.
    await applyAccountStatusTransition(action as AccountTransitionAction, {
      getEntitlement: () => getUserEntitlement(tableName, userId),
      setStatus: () =>
        setAccountStatus(tableName, userId, mapping.status, {
          statusReason: reason,
          changedBy: `admin:${admin.sub}`,
        }),
      cancelImmediately: async (subscriptionId) => {
        const stripe = await getStripeClient();
        await stripe.subscriptions.cancel(subscriptionId);
      },
      cancelAtPeriodEnd: async (subscriptionId) => {
        const stripe = await getStripeClient();
        await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true });
      },
      captureCancelFailure: (input) =>
        captureStripeCancelFailure(tableName, {
          ...input,
          context: action === "delete" ? "admin_account_delete" : "admin_account_deactivate",
          userId,
        }),
    });

    const history = await listAccountStatusChanges(tableName, userId, 50).catch(() => []);
    return bookOk({ userId, status: mapping.status, history });
  });
}
