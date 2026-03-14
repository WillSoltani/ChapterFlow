import type { FileRow } from "@/app/app/projects/_lib/types";
import {
  isFileRow,
  safeJsonParse,
  parseCreateUploadResponse,
  parseCompleteUploadResponse,
} from "./parsers";

export async function fetchFiles(projectId: string): Promise<FileRow[]> {
  const res = await fetch(
    `/app/api/projects/${encodeURIComponent(projectId)}/files`,
    { cache: "no-store" }
  );

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(t || `Fetch files failed: ${res.status}`);
  }

  const data = (await res.json()) as { files?: unknown };
  const filesUnknown = Array.isArray(data.files) ? data.files : [];
  return filesUnknown.filter(isFileRow);
}

export type UploadViaPresignResult = {
  createdFile?: FileRow;
  uploadId: string;
  bucket: string;
  key: string;
};

export async function uploadViaPresign(params: {
  projectId: string;
  file: File;
}): Promise<UploadViaPresignResult> {
  const { projectId, file } = params;

  // 1) Create upload (presign)
  const createRes = await fetch(
    `/app/api/projects/${encodeURIComponent(projectId)}/uploads`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        filename: file.name,
        contentType: file.type || "application/octet-stream",
        sizeBytes: file.size,
      }),
    }
  );

  const createText = await createRes.text().catch(() => "");
  if (!createRes.ok) {
    throw new Error(createText || `Create upload failed: ${createRes.status}`);
  }

  const createJson = safeJsonParse(createText);
  const { uploadId, putUrl, bucket, key, headers } =
    parseCreateUploadResponse(createJson);

  // 2) PUT to S3
  const putHeaders: Record<string, string> = { ...headers };

  // Ensure Content-Type exists if not already signed into headers
  if (!Object.keys(putHeaders).some((k) => k.toLowerCase() === "content-type")) {
    putHeaders["Content-Type"] = file.type || "application/octet-stream";
  }

  const putRes = await fetch(putUrl, {
    method: "PUT",
    headers: putHeaders,
    body: file,
  });

  if (!putRes.ok) {
    const t = await putRes.text().catch(() => "");
    throw new Error(t || `S3 PUT failed: ${putRes.status}`);
  }

  const etag = putRes.headers.get("etag") || putRes.headers.get("ETag");

  // 3) Complete upload
  const completeRes = await fetch(
    `/app/api/projects/${encodeURIComponent(projectId)}/uploads/${encodeURIComponent(
      uploadId
    )}/complete`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        etag: etag ?? undefined,
        filename: file.name,
        contentType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        bucket,
        key,
      }),
    }
  );

  const completeText = await completeRes.text().catch(() => "");
  if (!completeRes.ok) {
    throw new Error(completeText || `Complete failed: ${completeRes.status}`);
  }

  const completeJson = safeJsonParse(completeText);
  const complete = parseCompleteUploadResponse(completeJson);

  return { createdFile: complete.file, uploadId, bucket, key };
}
