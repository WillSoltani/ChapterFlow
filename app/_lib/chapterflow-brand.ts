const DEFAULT_CHAPTERFLOW_SITE_URL = "https://siliconx.ca";
const DEFAULT_CHAPTERFLOW_APP_URL = "https://chapterflow.siliconx.ca";
const DEFAULT_CHAPTERFLOW_AUTH_URL = "https://auth.siliconx.ca";
const DEFAULT_CHAPTERFLOW_DEV_URL = "http://localhost:3000";
const LOCAL_CHAPTERFLOW_HOSTS = new Set([
  "localhost:3000",
  "127.0.0.1:3000",
  "[::1]:3000",
  "::1:3000",
  "localhost:3001",
  "127.0.0.1:3001",
  "[::1]:3001",
  "::1:3001",
]);

export const CHAPTERFLOW_NAME = "ChapterFlow";
export const CHAPTERFLOW_TAGLINE =
  "Guided reading for people who want depth, momentum, and real retention.";

export function getChapterFlowDeploymentMode(): "embedded" | "standalone" {
  const mode = String(process.env.CHAPTERFLOW_DEPLOYMENT_MODE ?? "standalone")
    .trim()
    .toLowerCase();
  return mode === "embedded" ? "embedded" : "standalone";
}

export function usesDedicatedChapterFlowHosts(): boolean {
  return getChapterFlowDeploymentMode() === "standalone";
}

function normalizeUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

function safeUrl(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return normalizeUrl(trimmed);
  } catch {
    return null;
  }
}

export function getChapterFlowAppUrl(): string {
  const configured = safeUrl(process.env.NEXT_PUBLIC_CHAPTERFLOW_APP_URL);
  if (configured) return configured;
  return process.env.NODE_ENV === "production"
    ? DEFAULT_CHAPTERFLOW_APP_URL
    : DEFAULT_CHAPTERFLOW_DEV_URL;
}

export function getChapterFlowSiteUrl(): string {
  const configured = safeUrl(
    process.env.NEXT_PUBLIC_CHAPTERFLOW_SITE_URL ||
      process.env.CHAPTERFLOW_SITE_BASE_URL
  );
  if (configured) return configured;
  return process.env.NODE_ENV === "production"
    ? DEFAULT_CHAPTERFLOW_SITE_URL
    : DEFAULT_CHAPTERFLOW_DEV_URL;
}

export function getChapterFlowAuthUrl(): string {
  const configured = safeUrl(process.env.NEXT_PUBLIC_CHAPTERFLOW_AUTH_URL);
  if (configured) return configured;
  return process.env.NODE_ENV === "production"
    ? DEFAULT_CHAPTERFLOW_AUTH_URL
    : DEFAULT_CHAPTERFLOW_DEV_URL;
}

function hostFromUrl(value: string): string {
  return new URL(value).host.toLowerCase();
}

function normalizeHost(value: string | null | undefined): string {
  return String(value ?? "")
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .toLowerCase();
}

export function isLocalHost(host: string | null | undefined): boolean {
  const normalized = normalizeHost(host);
  return (
    normalized.startsWith("localhost") ||
    normalized.startsWith("127.0.0.1") ||
    normalized.startsWith("[::1]") ||
    normalized.startsWith("::1")
  );
}

export function isChapterFlowAppHost(host: string | null | undefined): boolean {
  const normalized = normalizeHost(host);
  if (!normalized) return false;
  if (LOCAL_CHAPTERFLOW_HOSTS.has(normalized)) return true;
  if (!usesDedicatedChapterFlowHosts()) return false;
  return normalized === hostFromUrl(getChapterFlowAppUrl());
}

export function isChapterFlowSiteHost(host: string | null | undefined): boolean {
  const normalized = normalizeHost(host);
  if (!normalized) return false;
  if (LOCAL_CHAPTERFLOW_HOSTS.has(normalized)) return true;
  if (!usesDedicatedChapterFlowHosts()) return false;
  return normalized === hostFromUrl(getChapterFlowSiteUrl());
}

export function isChapterFlowAuthHost(host: string | null | undefined): boolean {
  const normalized = normalizeHost(host);
  if (!normalized) return false;
  if (LOCAL_CHAPTERFLOW_HOSTS.has(normalized)) return false;
  if (!usesDedicatedChapterFlowHosts()) return false;
  return normalized === hostFromUrl(getChapterFlowAuthUrl());
}

export function buildChapterFlowSiteHref(path = "/"): string {
  return `${getChapterFlowSiteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

export function buildChapterFlowAppHref(path = "/"): string {
  return `${getChapterFlowAppUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

export function buildChapterFlowAuthHref(path = "/"): string {
  return `${getChapterFlowAuthUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

export function getChapterFlowLaunchHref(): string {
  return usesDedicatedChapterFlowHosts() ? buildChapterFlowSiteHref("/") : "/book";
}
