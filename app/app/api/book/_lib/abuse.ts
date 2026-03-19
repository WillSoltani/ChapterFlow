import "server-only";

import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { getAuthCookieBase } from "@/app/auth/_lib/auth-cookie";
import type { AuthedUser } from "@/app/app/api/_lib/auth";
import { BookApiError } from "@/app/app/api/book/_lib/errors";
import { listRecentRiskEvents, recordRiskEvent } from "@/app/app/api/book/_lib/repo";
import type { BookRiskEventScope, BookRiskEventType } from "@/app/app/api/book/_lib/types";

export const BOOK_DEVICE_COOKIE = "cf_device";
const BOOK_DEVICE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

type RiskSignals = {
  deviceId: string;
  deviceHash: string;
  networkHash: string | null;
  networkUserAgentHash: string | null;
  userAgentHash: string | null;
};

type RiskAssessment = {
  level: "low" | "medium" | "high";
  reasonCodes: string[];
};

function sha(value: string): string {
  return createHash("sha256").update(value).digest("base64url");
}

function normalizeDeviceId(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return /^[a-z0-9-]{16,128}$/i.test(trimmed) ? trimmed : null;
}

function parseCookie(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  const prefix = `${name}=`;
  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim();
    if (!trimmed.startsWith(prefix)) continue;
    return decodeURIComponent(trimmed.slice(prefix.length));
  }
  return null;
}

function readIp(req: Request): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const cloudfrontViewer = req.headers.get("cloudfront-viewer-address")?.trim();
  if (cloudfrontViewer) {
    const host = cloudfrontViewer.split(":")[0]?.trim();
    if (host) return host;
  }
  return null;
}

function coarseNetworkPrefix(ip: string | null): string | null {
  if (!ip) return null;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) {
    const octets = ip.split(".");
    if (octets.length !== 4) return null;
    return `${octets[0]}.${octets[1]}.${octets[2]}.0/24`;
  }
  if (ip.includes(":")) {
    const segments = ip.split(":").filter(Boolean);
    if (segments.length < 4) return null;
    return `${segments.slice(0, 4).join(":")}::/64`;
  }
  return null;
}

function normalizeUserAgent(value: string | null): string | null {
  const trimmed = value?.trim().toLowerCase();
  if (!trimmed) return null;
  return trimmed.replace(/\s+/g, " ").slice(0, 240);
}

function buildSignals(req: Request, deviceId: string): RiskSignals {
  const deviceHash = sha(`device:${deviceId}`);
  const networkPrefix = coarseNetworkPrefix(readIp(req));
  const userAgent = normalizeUserAgent(req.headers.get("user-agent"));
  const networkHash = networkPrefix ? sha(`network:${networkPrefix}`) : null;
  const userAgentHash = userAgent ? sha(`ua:${userAgent}`) : null;
  const networkUserAgentHash =
    networkPrefix && userAgent ? sha(`network-ua:${networkPrefix}:${userAgent}`) : null;
  return {
    deviceId,
    deviceHash,
    networkHash,
    networkUserAgentHash,
    userAgentHash,
  };
}

function distinctUsersSince(
  events: Awaited<ReturnType<typeof listRecentRiskEvents>>,
  minTimestamp: number,
  eventTypes?: BookRiskEventType[]
): number {
  const allowed = eventTypes ? new Set(eventTypes) : null;
  return new Set(
    events
      .filter((event) => {
        const createdAt = Date.parse(event.createdAt);
        if (!Number.isFinite(createdAt) || createdAt < minTimestamp) return false;
        return allowed ? allowed.has(event.eventType) : true;
      })
      .map((event) => event.userId)
  ).size;
}

async function queryRiskWindow(
  tableName: string,
  scope: BookRiskEventScope,
  fingerprint: string | null
) {
  if (!fingerprint) return [];
  return listRecentRiskEvents(tableName, { scope, fingerprint, limit: 60 });
}

export function getOrCreateDeviceId(req: Request): { deviceId: string; issued: boolean } {
  const cookieHeader = req.headers.get("cookie");
  const existing = normalizeDeviceId(parseCookie(cookieHeader, BOOK_DEVICE_COOKIE));
  if (existing) {
    return { deviceId: existing, issued: false };
  }
  return { deviceId: crypto.randomUUID(), issued: true };
}

export function applyDeviceIdCookie(
  response: NextResponse,
  deviceId: string,
  force = false
): NextResponse {
  if (!force && response.cookies.get(BOOK_DEVICE_COOKIE)?.value === deviceId) {
    return response;
  }
  response.cookies.set(BOOK_DEVICE_COOKIE, deviceId, {
    ...getAuthCookieBase(),
    maxAge: BOOK_DEVICE_COOKIE_MAX_AGE,
  });
  return response;
}

export async function recordRiskSignals(
  tableName: string,
  req: Request,
  user: AuthedUser,
  eventType: BookRiskEventType,
  options?: { deviceId?: string }
): Promise<{ deviceId: string; issuedDeviceId: boolean }> {
  const existing = getOrCreateDeviceId(req);
  const deviceId = normalizeDeviceId(options?.deviceId) ?? existing.deviceId;
  const issued = options?.deviceId ? false : existing.issued;
  const signals = buildSignals(req, deviceId);
  const createdAt = new Date().toISOString();

  const writes: Promise<void>[] = [
    recordRiskEvent(tableName, {
      scope: "device",
      fingerprint: signals.deviceHash,
      eventType,
      userId: user.sub,
      createdAt,
      emailVerified: user.emailVerified === true,
      deviceId,
    }),
  ];

  if (signals.networkHash) {
    writes.push(
      recordRiskEvent(tableName, {
        scope: "network",
        fingerprint: signals.networkHash,
        eventType,
        userId: user.sub,
        createdAt,
        emailVerified: user.emailVerified === true,
        deviceId,
      })
    );
  }

  if (signals.networkUserAgentHash) {
    writes.push(
      recordRiskEvent(tableName, {
        scope: "network_ua",
        fingerprint: signals.networkUserAgentHash,
        eventType,
        userId: user.sub,
        createdAt,
        emailVerified: user.emailVerified === true,
        deviceId,
      })
    );
  }

  await Promise.all(writes);
  return { deviceId, issuedDeviceId: issued };
}

export async function assertFreeUnlockAllowed(
  tableName: string,
  req: Request,
  user: AuthedUser
): Promise<{ deviceId: string; issuedDeviceId: boolean; assessment: RiskAssessment }> {
  const { deviceId, issued } = getOrCreateDeviceId(req);
  const signals = buildSignals(req, deviceId);
  const now = Date.now();
  const [deviceEvents, networkEvents, networkUserAgentEvents] = await Promise.all([
    queryRiskWindow(tableName, "device", signals.deviceHash),
    queryRiskWindow(tableName, "network", signals.networkHash),
    queryRiskWindow(tableName, "network_ua", signals.networkUserAgentHash),
  ]);

  const deviceUsers30d = distinctUsersSince(
    deviceEvents,
    now - 30 * 24 * 60 * 60 * 1000,
    ["onboarding_completed", "free_unlock_granted"]
  );
  const deviceFreeUnlockUsers30d = distinctUsersSince(
    deviceEvents,
    now - 30 * 24 * 60 * 60 * 1000,
    ["free_unlock_granted"]
  );
  const networkUsers24h = distinctUsersSince(
    networkEvents,
    now - 24 * 60 * 60 * 1000,
    ["onboarding_completed", "free_unlock_granted"]
  );
  const networkUserAgentUsers24h = distinctUsersSince(
    networkUserAgentEvents,
    now - 24 * 60 * 60 * 1000,
    ["onboarding_completed", "free_unlock_granted"]
  );

  const reasonCodes: string[] = [];
  let level: RiskAssessment["level"] = "low";

  if (deviceFreeUnlockUsers30d >= 3) {
    level = "high";
    reasonCodes.push("device_free_unlock_velocity");
  } else if (networkUserAgentUsers24h >= 4) {
    level = "high";
    reasonCodes.push("network_user_agent_velocity");
  } else if (deviceUsers30d >= 3 && networkUsers24h >= 4) {
    level = "high";
    reasonCodes.push("stacked_shared_signals");
  } else if (deviceUsers30d >= 2) {
    level = "medium";
    reasonCodes.push("device_reuse");
  } else if (networkUsers24h >= 5 || networkUserAgentUsers24h >= 2) {
    level = "medium";
    reasonCodes.push("network_velocity");
  }

  if (level === "medium" && user.emailVerified !== true) {
    throw new BookApiError(
      403,
      "email_verification_required",
      "Please verify your email before claiming free access on this browser."
    );
  }

  if (level === "high") {
    throw new BookApiError(
      429,
      "free_access_review_required",
      "We detected unusual free-access activity from this browser. Please try again later or contact support if this is a shared device."
    );
  }

  return {
    deviceId,
    issuedDeviceId: issued,
    assessment: { level, reasonCodes },
  };
}
