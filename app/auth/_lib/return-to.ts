import "server-only";

import {
  getChapterFlowAppUrl,
  getChapterFlowAuthUrl,
  getChapterFlowSiteUrl,
  usesDedicatedChapterFlowHosts,
} from "@/app/_lib/chapterflow-brand";

function normalizeUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

function normalizeOrigin(value: string): string {
  return new URL(value).origin;
}

function allowedOrigins(): Set<string> {
  const origins = new Set<string>();

  const configured = [
    process.env.APP_BASE_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.NEXT_PUBLIC_CHAPTERFLOW_SITE_URL,
    process.env.CHAPTERFLOW_SITE_BASE_URL,
    process.env.NEXT_PUBLIC_CHAPTERFLOW_APP_URL,
    process.env.CHAPTERFLOW_APP_BASE_URL,
    process.env.NEXT_PUBLIC_CHAPTERFLOW_AUTH_URL,
    process.env.CHAPTERFLOW_AUTH_BASE_URL,
  ];

  for (const value of configured) {
    if (!value) continue;
    try {
      origins.add(normalizeOrigin(value));
    } catch {
      continue;
    }
  }

  if (usesDedicatedChapterFlowHosts()) {
    origins.add(normalizeOrigin(getChapterFlowSiteUrl()));
    origins.add(normalizeOrigin(getChapterFlowAppUrl()));
    origins.add(normalizeOrigin(getChapterFlowAuthUrl()));
  }
  return origins;
}

export function sanitizeReturnTo(
  value: string | null | undefined,
  fallback: string
): string {
  const raw = String(value ?? "").trim();
  if (!raw) return fallback;

  if (raw.startsWith("/")) {
    return raw;
  }

  try {
    const target = new URL(raw);
    if (!allowedOrigins().has(target.origin)) {
      return fallback;
    }
    return normalizeUrl(target.toString());
  } catch {
    return fallback;
  }
}
