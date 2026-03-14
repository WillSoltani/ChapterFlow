import "server-only";

import { NextResponse } from "next/server";

import { requireAdminUser } from "@/app/app/api/_lib/admin";
import {
  getGlobalQuotaConfig,
  setGlobalQuotaConfig,
} from "@/app/app/api/_lib/quota";

export const runtime = "nodejs";

function jsonError(status: number, error: string, detail?: string) {
  return NextResponse.json(
    { error, detail: process.env.NODE_ENV !== "production" ? detail : undefined },
    { status }
  );
}

function asNonNegativeInt(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  if (value < 0) return undefined;
  return Math.floor(value);
}

export async function GET() {
  try {
    await requireAdminUser();
    const defaults = await getGlobalQuotaConfig();
    return NextResponse.json({ ok: true, defaults }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === "UNAUTHENTICATED" || message === "INVALID_TOKEN") {
      return jsonError(401, "unauthenticated");
    }
    if (message === "FORBIDDEN") {
      return jsonError(403, "forbidden");
    }
    console.error("GET /app/api/admin/quotas failed", error);
    return jsonError(500, "server_error", message);
  }
}

export async function PATCH(req: Request) {
  try {
    await requireAdminUser();

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonError(400, "bad_request", "invalid json");
    }

    const rec = (typeof body === "object" && body !== null ? body : {}) as Record<
      string,
      unknown
    >;
    const signedInLimit = asNonNegativeInt(rec.signedInLimit);
    const guestLimit = asNonNegativeInt(rec.guestLimit);
    if (signedInLimit == null && guestLimit == null) {
      return jsonError(400, "bad_request", "signedInLimit or guestLimit is required");
    }

    const defaults = await setGlobalQuotaConfig({
      signedInLimit,
      guestLimit,
    });

    return NextResponse.json({ ok: true, defaults }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === "UNAUTHENTICATED" || message === "INVALID_TOKEN") {
      return jsonError(401, "unauthenticated");
    }
    if (message === "FORBIDDEN") {
      return jsonError(403, "forbidden");
    }
    console.error("PATCH /app/api/admin/quotas failed", error);
    return jsonError(500, "server_error", message);
  }
}

