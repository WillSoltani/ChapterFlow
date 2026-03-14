import type { UiStatus, FileRow } from "./types";

export function normalizeStatus(s: string): UiStatus {
  const v = (s || "").toLowerCase();
  if (v === "queued") return "queued";
  if (v === "processing") return "processing";
  if (v === "done" || v === "completed" || v === "complete") return "done";
  if (v === "failed" || v === "error") return "failed";
  return "unknown";
}

export function fmtBytes(n: number | null) {
  if (n == null || !Number.isFinite(n) || n <= 0) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"] as const;
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function pickObject(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null ? (v as Record<string, unknown>) : null;
}

export function isFileRow(x: unknown): x is FileRow {
  const o = pickObject(x);
  if (!o) return false;

  // required fields
  if (typeof o.fileId !== "string") return false;
  if (typeof o.projectId !== "string") return false;
  if (typeof o.filename !== "string") return false;
  if (typeof o.contentType !== "string") return false;
  if (typeof o.status !== "string") return false;
  if (typeof o.createdAt !== "string") return false;
  if (typeof o.updatedAt !== "string") return false;
  if (typeof o.bucket !== "string") return false;
  if (typeof o.key !== "string") return false;

  // sizeBytes can be number or null (or missing if your API sometimes omits it)
  if (
    "sizeBytes" in o &&
    o.sizeBytes !== null &&
    typeof o.sizeBytes !== "number"
  ) {
    return false;
  }

  return true;
}


export function getIsoOrFallback(v: unknown, fallbackIso: string) {
  if (typeof v === "string" && v.length >= 10) return v;
  return fallbackIso;
}

export function getErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  try {
    return JSON.stringify(e);
  } catch {
    return "unknown error";
  }
}

export function parseCreatedProject(json: unknown) {
  if (typeof json !== "object" || json === null) return null;
  const root = json as { project?: unknown };
  if (typeof root.project !== "object" || root.project === null) return null;
  const p = root.project as Record<string, unknown>;

  const projectId = typeof p.projectId === "string" ? p.projectId : "";
  const name = typeof p.name === "string" ? p.name : "";
  const createdAt =
    typeof p.createdAt === "string" ? p.createdAt : new Date().toISOString();
  const updatedAt = typeof p.updatedAt === "string" ? p.updatedAt : createdAt;
  const status = typeof p.status === "string" ? p.status : "active";

  if (!projectId || !name) return null;
  return { projectId, name, createdAt, updatedAt, status };
}

export async function readErrorBody(res: Response): Promise<string> {
  const ct = res.headers.get("content-type") ?? "";
  const text = await res.text();

  if (ct.includes("application/json")) {
    try {
      const parsed = JSON.parse(text) as unknown;
      if (typeof parsed === "object" && parsed !== null) {
        const maybe = (parsed as { error?: unknown }).error;
        if (typeof maybe === "string" && maybe.trim()) return maybe.trim();
      }
    } catch {
      // ignore
    }
  }

  return text.trim();
}

function extFromName(name: string) {
  const idx = name.lastIndexOf(".");
  return idx >= 0 ? name.slice(idx + 1).toLowerCase() : "";
}

export function isLikelyImage(filename: string, contentType: string) {
  const ct = (contentType || "").toLowerCase();
  const ext = extFromName(filename);
  return (
    ct.startsWith("image/") ||
    ["png", "jpg", "jpeg", "gif", "webp", "svg", "ico", "bmp", "tif", "tiff", "avif", "heic"].includes(ext)
  );
}
