import {
  OUTPUT_FORMATS,
  type OutputFormat,
} from "@/app/app/_lib/conversion-support";

export type FileKind = "raw" | "output";

export type ConversionJobInput = {
  fileId: string;
  outputFormat: OutputFormat;
  quality: number | null;
  preset: string | null;
  resizePct: number | null;
};

export type ConvertBody = {
  conversions?: unknown[];
};

export type DbFileItem = {
  PK: string; SK: string; entity: "FILE"; kind: FileKind;
  fileId: string; projectId: string; userSub: string;
  filename: string; contentType: string; sizeBytes: number | null;
  bucket: string; key: string; status: string; createdAt: string; updatedAt: string;
};

export type ConvertResult =
  | { fileId: string; ok: true; outputFileId: string }
  | { fileId: string; ok: false; error: string };

export function nowIso() { return new Date().toISOString(); }

export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

export function str(v: unknown): string { return typeof v === "string" ? v : ""; }

export function numOrNull(v: unknown): number | null {
  if (typeof v !== "number") return null;
  if (!Number.isFinite(v) || v < 0) return null;
  return Math.floor(v);
}

export function getErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  try { return JSON.stringify(e); } catch { return "unknown error"; }
}

export function parseOutputFormat(v: unknown): OutputFormat | null {
  if (typeof v !== "string") return null;
  const up = v.trim();
  return OUTPUT_FORMATS.includes(up as OutputFormat) ? (up as OutputFormat) : null;
}

export function normalizeKind(v: unknown): FileKind { return v === "output" ? "output" : "raw"; }

export function toDbFileItem(raw: unknown): DbFileItem | null {
  if (!isRecord(raw)) return null;
  const PK = str(raw.PK); const SK = str(raw.SK);
  const fileId = str(raw.fileId); const projectId = str(raw.projectId);
  const userSub = str(raw.userSub); const filename = str(raw.filename);
  const bucket = str(raw.bucket); const key = str(raw.key);
  if (!PK || !SK || !fileId || !projectId || !userSub || !filename || !bucket || !key) return null;
  const createdAt = str(raw.createdAt) || nowIso();
  return {
    PK, SK, entity: "FILE", kind: normalizeKind(raw.kind),
    fileId, projectId, userSub, filename,
    contentType: str(raw.contentType) || "application/octet-stream",
    sizeBytes: numOrNull(raw.sizeBytes), bucket, key,
    status: str(raw.status) || "queued",
    createdAt, updatedAt: str(raw.updatedAt) || createdAt,
  };
}

export function isRawConvertibleStatus(status: string): boolean {
  const v = (status || "").toLowerCase();
  return v === "queued" || v === "done";
}

export function extForFormat(fmt: OutputFormat): string {
  const map: Record<OutputFormat, string> = {
    PNG: "png",
    JPG: "jpg",
    WebP: "webp",
    GIF: "gif",
    TIFF: "tiff",
    AVIF: "avif",
    HEIC: "heic",
    HEIF: "heif",
    BMP: "bmp",
    ICO: "ico",
    SVG: "svg",
    PDF: "pdf",
  };
  return map[fmt];
}

export function contentTypeFor(fmt: OutputFormat): string {
  const map: Record<OutputFormat, string> = {
    PNG: "image/png",
    JPG: "image/jpeg",
    WebP: "image/webp",
    GIF: "image/gif",
    TIFF: "image/tiff",
    AVIF: "image/avif",
    HEIC: "image/heic",
    HEIF: "image/heif",
    BMP: "image/bmp",
    ICO: "image/x-icon",
    SVG: "image/svg+xml",
    PDF: "application/pdf",
  };
  return map[fmt];
}

export function replaceExt(filename: string, ext: string): string {
  const dot = filename.lastIndexOf(".");
  return (dot < 0 ? filename : filename.slice(0, dot)) + "." + ext;
}

export function stripExt(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot < 0 ? filename : filename.slice(0, dot);
}

export function isImageOutput(fmt: OutputFormat): fmt is Exclude<OutputFormat, "PDF"> {
  return fmt !== "PDF";
}

export function safeExecutionName(projectId: string, outFileId: string): string {
  return `p-${projectId}-o-${outFileId}`.replace(/[^0-9A-Za-z-_]/g, "_").slice(0, 80);
}

export function parseConversionJob(raw: unknown): ConversionJobInput | null {
  if (!isRecord(raw)) return null;
  const fileId = str(raw.fileId);
  if (!fileId.trim()) return null;
  const outputFormat = parseOutputFormat(raw.outputFormat);
  if (!outputFormat) return null;
  const quality =
    typeof raw.quality === "number" && Number.isFinite(raw.quality)
      ? Math.max(1, Math.min(100, Math.floor(raw.quality))) : null;
  const preset = typeof raw.preset === "string" ? raw.preset.slice(0, 40) : null;
  const resizePct =
    typeof raw.resizePct === "number" && Number.isFinite(raw.resizePct)
      ? Math.max(10, Math.min(100, Math.floor(raw.resizePct))) : null;
  return { fileId: fileId.trim(), outputFormat, quality, preset, resizePct };
}
