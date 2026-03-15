import { getSiteUrl } from "@/app/_lib/site-url";

const DEFAULT_CHAPTERFLOW_SITE_URL = "https://siliconx.ca";
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

function normalizeUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

function normalizeHost(value: string | null | undefined): string {
  return String(value ?? "")
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .toLowerCase();
}

function siteBaseUrl(): string {
  const siteUrl = getSiteUrl();
  return siteUrl || (process.env.NODE_ENV === "production"
    ? DEFAULT_CHAPTERFLOW_SITE_URL
    : DEFAULT_CHAPTERFLOW_DEV_URL);
}

export function getChapterFlowDeploymentMode(): "embedded" | "standalone" {
  return "standalone";
}

export function usesDedicatedChapterFlowHosts(): boolean {
  return false;
}

export function getChapterFlowSiteUrl(): string {
  return normalizeUrl(siteBaseUrl());
}

export function getChapterFlowAppUrl(): string {
  return normalizeUrl(siteBaseUrl());
}

export function getChapterFlowAuthUrl(): string {
  return normalizeUrl(siteBaseUrl());
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

export function isChapterFlowSiteHost(host: string | null | undefined): boolean {
  const normalized = normalizeHost(host);
  if (!normalized) return false;
  if (LOCAL_CHAPTERFLOW_HOSTS.has(normalized)) return true;
  return normalized === new URL(getChapterFlowSiteUrl()).host.toLowerCase();
}

export function isChapterFlowAppHost(): boolean {
  return false;
}

export function isChapterFlowAuthHost(): boolean {
  return false;
}

export function buildChapterFlowSiteHref(path = "/"): string {
  return `${getChapterFlowSiteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

export function buildChapterFlowAppHref(path = "/"): string {
  return `${getChapterFlowSiteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

export function buildChapterFlowAuthHref(path = "/"): string {
  return `${getChapterFlowSiteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

export function getChapterFlowLaunchHref(): string {
  return "/book";
}
