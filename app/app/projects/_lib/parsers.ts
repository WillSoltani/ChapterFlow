import type { FileRow, CreateUploadResult, CompleteUploadResult } from "@/app/app/projects/_lib/types";

export function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function pickString(...vals: unknown[]): string | null {
  for (const v of vals) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

export function pickObject(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null ? (v as Record<string, unknown>) : null;
}

export function isFileRow(x: unknown): x is FileRow {
  const o = pickObject(x);
  if (!o) return false;

  return (
    typeof o.fileId === "string" &&
    typeof o.projectId === "string" &&
    typeof o.filename === "string" &&
    typeof o.contentType === "string" &&
    typeof o.status === "string" &&
    typeof o.createdAt === "string" &&
    typeof o.updatedAt === "string" &&
    typeof o.bucket === "string" &&
    typeof o.key === "string"
  );
}

export function parseCreateUploadResponse(json: unknown): CreateUploadResult {
  const root = pickObject(json) ?? {};
  const upload = pickObject(root["upload"]) ?? {};

  const uploadId = pickString(
    root["uploadId"],
    upload["uploadId"],
    root["fileId"],
    upload["fileId"]
  );

  const putUrl = pickString(
    root["putUrl"],
    root["url"],
    upload["putUrl"],
    upload["url"]
  );

  const bucket = pickString(root["bucket"], upload["bucket"]);
  const key = pickString(root["key"], upload["key"]);

  const headersRaw =
    (pickObject(root["headers"]) ?? pickObject(upload["headers"]) ?? {}) as Record<
      string,
      unknown
    >;

  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(headersRaw)) {
    if (typeof v === "string") headers[k] = v;
  }

  if (!uploadId || !putUrl || !bucket || !key) {
    throw new Error(
      `Create upload response missing fields. uploadId=${Boolean(uploadId)} putUrl=${Boolean(
        putUrl
      )} bucket=${Boolean(bucket)} key=${Boolean(key)}`
    );
  }

  return { uploadId, putUrl, bucket, key, method: "PUT", headers };
}

export function parseCompleteUploadResponse(json: unknown): CompleteUploadResult {
  const root = pickObject(json) ?? {};
  const file = root["file"];
  return isFileRow(file) ? { file } : {};
}
