import type { FileRow } from "../../_lib/types"
import type { OutputFormat } from "./ui-types";

export function fmtBytes(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return "—";
  const units = ["B", "KB", "MB", "GB"] as const;
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

export function extFromName(name: string): string {
  const base = (name || "").split("?")[0].split("#")[0];
  const i = base.lastIndexOf(".");
  if (i === -1) return "";
  return base.slice(i + 1).toLowerCase();
}

export function formatFromFilenameOrContentType(
  filename: string,
  contentType?: string | null
): OutputFormat | "DOCX" | "PAGES" | "IMG" {
  const ext = extFromName(filename);
  const ct = (contentType ?? "").toLowerCase();

  if (ext === "png" || ct.includes("png")) return "PNG";
  if (ext === "jpg" || ext === "jpeg" || ct.includes("jpeg") || ct.includes("jpg")) return "JPG";
  if (ext === "webp" || ct.includes("webp")) return "WebP";
  if (ext === "gif" || ct.includes("gif")) return "GIF";
  if (ext === "avif" || ct.includes("avif")) return "AVIF";
  if (ext === "tif" || ext === "tiff" || ct.includes("tiff")) return "TIFF";
  if (ext === "heic" || ct.includes("heic")) return "HEIC";
  if (ext === "heif" || ct.includes("heif")) return "HEIF";
  if (ext === "bmp" || ct.includes("bmp")) return "BMP";
  if (ext === "svg" || ct.includes("svg")) return "SVG";
  if (ext === "ico" || ct.includes("x-icon") || ct.includes("vnd.microsoft.icon")) return "ICO";
  if (ext === "pdf" || ct.includes("pdf")) return "PDF";
  if (ext === "pages" || ct.includes("apple.pages") || ct.includes("iwork-pages")) return "PAGES";
  if (ext === "docx" || ext === "doc" || ct.includes("wordprocessingml") || ct.includes("msword")) return "DOCX";
  return "IMG";
}

export function normalizeStatus(s: string | null | undefined) {
  const v = (s ?? "").toLowerCase();
  if (v === "queued") return "queued";
  if (v === "processing") return "processing";
  if (v === "done" || v === "completed" || v === "complete") return "done";
  if (v === "failed" || v === "error") return "failed";
  return "unknown";
}

export function fingerprintFile(f: File): string {
  return `${f.name}::${f.size}::${f.lastModified}`;
}

export function safeFilenameFromRow(row: FileRow): string {
  const name = (row.filename ?? "").trim();
  return name || row.fileId || "file";
}
