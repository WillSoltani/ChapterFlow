import "server-only";
import { requireAdminUser } from "@/app/app/api/book/_lib/admin-auth";
import {
  bookOk,
  requireBodyObject,
  requireInteger,
  withBookApiErrors,
} from "@/app/app/api/book/_lib/http";
import { getBookTableName } from "@/app/app/api/book/_lib/env";
import {
  adminUpdateUserEntitlement,
  getUserEntitlement,
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
    await requireAdminUser();
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

    const tableName = await getBookTableName();
    const entitlement = await adminUpdateUserEntitlement(tableName, {
      userId,
      freeBookSlots,
      plan,
      proStatus,
    });
    return bookOk({ entitlement });
  });
}
