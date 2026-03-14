import "server-only";

import { NextResponse } from "next/server";

import { requireAdminUser } from "@/app/app/api/_lib/admin";
import {
  clearLimitOverride,
  getGlobalQuotaConfig,
  getUsageOverrideState,
  setLimitOverride,
} from "@/app/app/api/_lib/quota";

export const runtime = "nodejs";

type Scope = "signed_in" | "guest";

function jsonError(status: number, error: string, detail?: string) {
  return NextResponse.json(
    { error, detail: process.env.NODE_ENV !== "production" ? detail : undefined },
    { status }
  );
}

function normalizeScope(value: unknown): Scope | null {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "signed_in" || raw === "user") return "signed_in";
  if (raw === "guest") return "guest";
  return null;
}

function normalizeSubjectId(value: unknown): string | null {
  const id = String(value ?? "").trim();
  return id ? id : null;
}

function asNonNegativeInt(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  if (value < 0) return undefined;
  return Math.floor(value);
}

export async function GET(req: Request) {
  try {
    await requireAdminUser();
    const url = new URL(req.url);
    const scope = normalizeScope(url.searchParams.get("scope"));
    const subjectId = normalizeSubjectId(url.searchParams.get("subjectId"));
    if (!scope || !subjectId) {
      return jsonError(400, "bad_request", "scope and subjectId are required");
    }

    const [usage, defaults] = await Promise.all([
      getUsageOverrideState({ scope, subjectId }),
      getGlobalQuotaConfig(),
    ]);
    const baseLimit = scope === "guest" ? defaults.guestLimit : defaults.signedInLimit;
    const effectiveLimit = usage.limitOverride ?? baseLimit;
    const remaining = Math.max(0, effectiveLimit - usage.usedCount);

    return NextResponse.json(
      {
        ok: true,
        subject: { scope, subjectId },
        usage: {
          usedCount: usage.usedCount,
          limitOverride: usage.limitOverride,
          baseLimit,
          effectiveLimit,
          remaining,
        },
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === "UNAUTHENTICATED" || message === "INVALID_TOKEN") {
      return jsonError(401, "unauthenticated");
    }
    if (message === "FORBIDDEN") {
      return jsonError(403, "forbidden");
    }
    console.error("GET /app/api/admin/quotas/overrides failed", error);
    return jsonError(500, "server_error", message);
  }
}

export async function PUT(req: Request) {
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
    const scope = normalizeScope(rec.scope);
    const subjectId = normalizeSubjectId(rec.subjectId);
    const limit = asNonNegativeInt(rec.limit);
    if (!scope || !subjectId || limit == null) {
      return jsonError(400, "bad_request", "scope, subjectId, and limit are required");
    }

    await setLimitOverride({ scope, subjectId, limit });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === "UNAUTHENTICATED" || message === "INVALID_TOKEN") {
      return jsonError(401, "unauthenticated");
    }
    if (message === "FORBIDDEN") {
      return jsonError(403, "forbidden");
    }
    console.error("PUT /app/api/admin/quotas/overrides failed", error);
    return jsonError(500, "server_error", message);
  }
}

export async function DELETE(req: Request) {
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
    const scope = normalizeScope(rec.scope);
    const subjectId = normalizeSubjectId(rec.subjectId);
    if (!scope || !subjectId) {
      return jsonError(400, "bad_request", "scope and subjectId are required");
    }

    await clearLimitOverride({ scope, subjectId });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === "UNAUTHENTICATED" || message === "INVALID_TOKEN") {
      return jsonError(401, "unauthenticated");
    }
    if (message === "FORBIDDEN") {
      return jsonError(403, "forbidden");
    }
    console.error("DELETE /app/api/admin/quotas/overrides failed", error);
    return jsonError(500, "server_error", message);
  }
}

