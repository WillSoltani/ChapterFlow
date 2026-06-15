import "server-only";
import { requireAdminUser } from "@/app/app/api/book/_lib/admin-auth";
import {
  bookOk,
  requireBodyObject,
  requireInteger,
  requireString,
  withBookApiErrors,
} from "@/app/app/api/book/_lib/http";
import { getBookTableName } from "@/app/app/api/book/_lib/env";
import {
  adminUpdateUserEntitlement,
  getUserEntitlement,
  writeAdminAudit,
} from "@/app/app/api/book/_lib/repo";
import { BookApiError } from "@/app/app/api/book/_lib/errors";

export const runtime = "nodejs";

function parsePlan(value: unknown): "FREE" | "PRO" | undefined {
  if (value === "FREE" || value === "PRO") return value;
  return undefined;
}

function parseProStatus(
  value: unknown
): "inactive" | "active" | "past_due" | "canceled" | undefined {
  if (
    value === "inactive" ||
    value === "active" ||
    value === "past_due" ||
    value === "canceled"
  ) {
    return value;
  }
  return undefined;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  return withBookApiErrors(req, async () => {
    await requireAdminUser();
    const { userId } = await params;
    if (!userId) throw new BookApiError(400, "invalid_user_id", "userId is required.");
    const tableName = await getBookTableName();
    const entitlement = await getUserEntitlement(tableName, userId);
    return bookOk({
      entitlement: entitlement ?? {
        userId,
        plan: "FREE",
        proStatus: "inactive",
        freeBookSlots: 2,
        unlockedBookIds: [],
      },
    });
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  return withBookApiErrors(req, async () => {
    const admin = await requireAdminUser();
    const { userId } = await params;
    if (!userId) throw new BookApiError(400, "invalid_user_id", "userId is required.");

    let bodyRaw: unknown;
    try {
      bodyRaw = await req.json();
    } catch {
      throw new BookApiError(400, "invalid_json", "Request body must be valid JSON.");
    }
    const body = requireBodyObject(bodyRaw);
    const freeBookSlots =
      body.freeBookSlots === undefined
        ? undefined
        : requireInteger(body.freeBookSlots, "freeBookSlots", { min: 0, max: 1000 });
    const plan = parsePlan(body.plan);
    const proStatus = parseProStatus(body.proStatus);
    if (body.plan !== undefined && !plan) {
      throw new BookApiError(400, "invalid_input", "plan must be FREE or PRO.");
    }
    if (body.proStatus !== undefined && !proStatus) {
      throw new BookApiError(
        400,
        "invalid_input",
        "proStatus must be inactive, active, past_due, or canceled."
      );
    }
    if (freeBookSlots === undefined && !plan && !proStatus) {
      throw new BookApiError(400, "invalid_input", "No entitlement fields to update.");
    }

    // A money-equivalent comp (PRO grant / proStatus / freeBookSlots) must carry
    // a justification, mirroring insight-points/adjust's 10-char minimum.
    const reason = requireString(body.reason, "reason", {
      minLength: 10,
      maxLength: 1000,
    });

    const tableName = await getBookTableName();
    // Snapshot the before-state so the audit row records what actually changed.
    const before = await getUserEntitlement(tableName, userId).catch(() => null);
    const entitlement = await adminUpdateUserEntitlement(tableName, {
      userId,
      freeBookSlots,
      plan,
      proStatus,
    });

    // Record an immutable audit trail of the override (who, target, before/after
    // plan/proStatus/freeBookSlots, reason). Without this a comped PRO grant is
    // invisible in the audit log and untraceable in billing reconciliation.
    await writeAdminAudit(tableName, {
      adminUserId: admin.sub,
      action: "entitlement_override",
      targetUserId: userId,
      params: {
        reason,
        adminEmail: admin.email,
        before: {
          plan: before?.plan ?? null,
          proStatus: before?.proStatus ?? null,
          proSource: before?.proSource ?? null,
          freeBookSlots: before?.freeBookSlots ?? null,
        },
        after: {
          plan: entitlement.plan,
          proStatus: entitlement.proStatus ?? null,
          // adminUpdateUserEntitlement stamps proSource="admin" on a manual PRO
          // grant and clears it on FREE; a slots/status-only change leaves it
          // unchanged. Derive it here to record the actual written value (the
          // return type's proSource union does not surface "admin").
          proSource:
            plan === "PRO"
              ? "admin"
              : plan === "FREE"
                ? null
                : (before?.proSource ?? null),
          freeBookSlots: entitlement.freeBookSlots,
        },
        requested: {
          plan: plan ?? null,
          proStatus: proStatus ?? null,
          freeBookSlots: freeBookSlots ?? null,
        },
      },
    });

    return bookOk({ entitlement });
  });
}
