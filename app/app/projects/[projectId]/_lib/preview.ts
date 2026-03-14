import { extFromName } from "./format";

export type PreviewKind = "image";

export type PreviewHiddenReason =
  | "unsupported_type"
  | "missing_url"
  | "not_uploaded"
  | "deleted"
  | "viewer_missing"
  | "url_expired"
  | "processing"
  | "error_state";

export type PreviewCandidate = {
  fileId?: string;
  filename?: string | null;
  contentType?: string | null;
  formatLabel?: string | null;
  status?: string | null;
  previewUrl?: string | null;
  hasLocalSource?: boolean;
  isDeleted?: boolean;
};

export type PreviewEligibility =
  | { canPreview: true; kind: PreviewKind }
  | { canPreview: false; reason: PreviewHiddenReason };

const PREVIEWABLE_IMAGE_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "svg",
  "bmp",
  "ico",
]);

const PREVIEWABLE_IMAGE_LABELS = new Set([
  "PNG",
  "JPG",
  "WEBP",
  "GIF",
  "SVG",
  "BMP",
  "ICO",
]);

const PREVIEWABLE_IMAGE_CONTENT_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "image/bmp",
  "image/x-icon",
  "image/vnd.microsoft.icon",
];

const PREVIEW_HIDDEN_LOG_CACHE = new Set<string>();

function normalizeStatus(status?: string | null): string {
  return String(status ?? "").trim().toLowerCase();
}

function statusBlockedReason(status?: string | null): PreviewHiddenReason | null {
  const normalized = normalizeStatus(status);
  if (!normalized) return null;
  if (normalized.includes("deleted")) return "deleted";
  // Uploaded ready-queue files are currently marked "queued" in storage, and should
  // still be previewable. Only actively processing files are blocked.
  if (normalized === "processing") return "processing";
  if (normalized === "failed" || normalized === "error") return "error_state";
  return null;
}

export function previewLifecycleBlockedReason(args: {
  status?: string | null;
  isDeleted?: boolean;
}): PreviewHiddenReason | null {
  if (args.isDeleted) return "deleted";
  return statusBlockedReason(args.status);
}

export function parsePresignedUrlExpiryMs(url: string): number | null {
  try {
    const parsed = new URL(url);
    const amzDate = parsed.searchParams.get("X-Amz-Date") ?? parsed.searchParams.get("x-amz-date");
    const amzExpires = parsed.searchParams.get("X-Amz-Expires") ?? parsed.searchParams.get("x-amz-expires");
    if (!amzDate || !amzExpires) return null;

    const match = amzDate.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
    if (!match) return null;

    const [, y, mo, d, h, mi, s] = match;
    const issuedAt = Date.UTC(
      Number(y),
      Number(mo) - 1,
      Number(d),
      Number(h),
      Number(mi),
      Number(s)
    );

    const expiresSeconds = Number(amzExpires);
    if (!Number.isFinite(expiresSeconds) || expiresSeconds <= 0) return null;
    return issuedAt + expiresSeconds * 1000;
  } catch {
    return null;
  }
}

export function isPresignedUrlExpired(url: string, nowMs = Date.now()): boolean {
  const expiry = parsePresignedUrlExpiryMs(url);
  if (!expiry) return false;
  // Small guard window so users don't click right at expiry.
  return nowMs >= expiry - 5000;
}

export function supportsBrowserImagePreview(candidate: Pick<PreviewCandidate, "filename" | "contentType" | "formatLabel">): boolean {
  const label = String(candidate.formatLabel ?? "").trim().toUpperCase();
  if (label && PREVIEWABLE_IMAGE_LABELS.has(label)) return true;

  const ext = extFromName(String(candidate.filename ?? ""));
  if (ext && PREVIEWABLE_IMAGE_EXTENSIONS.has(ext)) return true;

  const ct = String(candidate.contentType ?? "").trim().toLowerCase();
  if (!ct) return false;
  return PREVIEWABLE_IMAGE_CONTENT_TYPES.some((v) => ct === v || ct.startsWith(`${v};`));
}

export function canPreview(candidate: PreviewCandidate): PreviewEligibility {
  const lifecycleBlocked = previewLifecycleBlockedReason({
    status: candidate.status,
    isDeleted: candidate.isDeleted,
  });
  if (lifecycleBlocked) return { canPreview: false, reason: lifecycleBlocked };

  if (!supportsBrowserImagePreview(candidate)) {
    return { canPreview: false, reason: "unsupported_type" };
  }

  // Current viewer stack supports image preview only.
  const viewerSupportsType = true;
  if (!viewerSupportsType) return { canPreview: false, reason: "viewer_missing" };

  if (candidate.hasLocalSource) return { canPreview: true, kind: "image" };

  const sourceUrl = String(candidate.previewUrl ?? "").trim();
  if (!sourceUrl) {
    return { canPreview: false, reason: candidate.fileId ? "missing_url" : "not_uploaded" };
  }
  if (isPresignedUrlExpired(sourceUrl)) return { canPreview: false, reason: "url_expired" };

  return { canPreview: true, kind: "image" };
}

export function logPreviewHiddenReasonOnce(args: {
  section: string;
  fileId?: string;
  reason: PreviewHiddenReason;
  filename?: string;
  formatLabel?: string;
  status?: string | null;
}) {
  if (process.env.NODE_ENV === "production") return;
  const key = `${args.section}:${args.fileId ?? "no-id"}:${args.reason}`;
  if (PREVIEW_HIDDEN_LOG_CACHE.has(key)) return;
  PREVIEW_HIDDEN_LOG_CACHE.add(key);
  console.info("preview_hidden_reason", {
    section: args.section,
    fileId: args.fileId ?? null,
    reason: args.reason,
    filename: args.filename ?? null,
    formatLabel: args.formatLabel ?? null,
    status: args.status ?? null,
  });
}
