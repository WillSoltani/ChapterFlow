import { NextResponse } from "next/server";

import { AuthError, requireUser } from "@/app/app/api/_lib/auth";
import { getQuotaStateForActor } from "@/app/app/api/_lib/quota";
import {
  guestSubFromSessionId,
  isGuestProjectId,
  readGuestSessionId,
} from "@/app/app/api/_lib/guest-session";
import type { RequestActor } from "@/app/app/api/_lib/actor";

export const runtime = "nodejs";

function jsonError(status: number, error: string, detail?: string) {
  return NextResponse.json(
    { error, detail: process.env.NODE_ENV !== "production" ? detail : undefined },
    { status }
  );
}

async function resolveQuotaActor(projectId: string): Promise<RequestActor> {
  if (isGuestProjectId(projectId)) {
    const guestSessionId = await readGuestSessionId();
    if (guestSessionId) {
      return {
        kind: "guest",
        sub: guestSubFromSessionId(guestSessionId),
        guestSessionId,
        quotaScope: "guest",
      };
    }
  }

  try {
    const user = await requireUser();
    return {
      kind: "user",
      sub: user.sub,
      email: user.email,
      quotaScope: "signed_in",
    };
  } catch (error: unknown) {
    if (!(error instanceof AuthError)) throw error;
    if (!isGuestProjectId(projectId)) throw error;
    const guestSessionId = await readGuestSessionId();
    if (!guestSessionId) throw error;
    return {
      kind: "guest",
      sub: guestSubFromSessionId(guestSessionId),
      guestSessionId,
      quotaScope: "guest",
    };
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const projectId = String(url.searchParams.get("projectId") ?? "").trim();
    const actor = await resolveQuotaActor(projectId);
    const quota = await getQuotaStateForActor(actor);
    return NextResponse.json(
      {
        quota,
        actor: actor.kind,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === "UNAUTHENTICATED" || message === "INVALID_TOKEN") {
      return jsonError(401, "unauthenticated");
    }
    console.error("GET /api/quota failed", error);
    return jsonError(500, "server_error", message);
  }
}
