import "server-only";
import { NextResponse } from "next/server";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { ddbDoc, getTableName, s3 } from "@/app/app/api/_lib/aws";
import { requireActorForProject } from "@/app/app/api/_lib/actor";
import { allowedOutputFormatsForFile } from "@/app/app/_lib/conversion-support";

export const runtime = "nodejs";

function nowIso() {
  return new Date().toISOString();
}

function safeFileName(input: string): string {
  const trimmed = input.trim();
  const base = trimmed.split("/").pop() ?? trimmed;
  const cleaned = base.replace(/[^\p{L}\p{N}._ -]+/gu, "_");
  const noDots = cleaned.replace(/^\.+/, "");
  return (noDots || "file").slice(0, 120);
}

function normalizeContentType(ct: string): string {
  const v = (ct || "").trim().toLowerCase();
  return (v || "application/octet-stream").slice(0, 200);
}

function extFromName(filename: string): string {
  const i = filename.lastIndexOf(".");
  if (i < 0) return "";
  return filename.slice(i + 1).toLowerCase();
}

function guessContentTypeFromName(filename: string): string {
  const ext = extFromName(filename);
  if (ext === "csv") return "text/csv";
  if (ext === "json") return "application/json";
  if (ext === "txt") return "text/plain";
  if (ext === "pdf") return "application/pdf";
  if (ext === "doc") return "application/msword";
  if (ext === "docx")
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (ext === "pages") return "application/vnd.apple.pages";
  if (ext === "xls") return "application/vnd.ms-excel";
  if (ext === "xlsx")
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  if (ext === "tif" || ext === "tiff") return "image/tiff";
  if (ext === "avif") return "image/avif";
  if (ext === "heic") return "image/heic";
  if (ext === "heif") return "image/heif";
  if (ext === "bmp") return "image/bmp";
  if (ext === "svg") return "image/svg+xml";
  if (ext === "ico") return "image/x-icon";
  return "application/octet-stream";
}

function startsWithBytes(buf: Buffer, bytes: number[]): boolean {
  if (buf.length < bytes.length) return false;
  for (let i = 0; i < bytes.length; i += 1) {
    if (buf[i] !== bytes[i]) return false;
  }
  return true;
}

function sniffIsoBmff(buf: Buffer): string | null {
  if (buf.length < 16) return null;
  if (buf.toString("ascii", 4, 8) !== "ftyp") return null;
  const brands = buf.toString("ascii", 8, Math.min(buf.length, 64)).toLowerCase();
  if (brands.includes("avif") || brands.includes("avis")) return "image/avif";
  if (
    brands.includes("heic") ||
    brands.includes("heix") ||
    brands.includes("hevc") ||
    brands.includes("hevx") ||
    brands.includes("heim") ||
    brands.includes("heis")
  ) {
    return "image/heic";
  }
  if (brands.includes("heif") || brands.includes("mif1") || brands.includes("msf1")) {
    return "image/heif";
  }
  return null;
}

function sniffSvg(buf: Buffer): boolean {
  const text = buf.subarray(0, Math.min(buf.length, 64 * 1024)).toString("utf8");
  const trimmed = text.replace(/^\uFEFF/, "").trimStart();
  if (!trimmed) return false;
  if (/^<svg[\s>]/i.test(trimmed)) return true;
  if (/^<\?xml[\s\S]{0,2048}<svg[\s>]/i.test(trimmed)) return true;
  return /<svg[\s>]/i.test(trimmed.slice(0, 4096));
}

function sniffContentTypeFromBytes(buf: Buffer, filename: string): string | null {
  if (buf.length === 0) return null;
  if (startsWithBytes(buf, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "application/pdf";
  if (startsWithBytes(buf, [0x89, 0x50, 0x4e, 0x47])) return "image/png";
  if (startsWithBytes(buf, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWithBytes(buf, [0x47, 0x49, 0x46, 0x38])) return "image/gif";
  if (
    buf.length >= 12 &&
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  if (
    startsWithBytes(buf, [0x49, 0x49, 0x2a, 0x00]) ||
    startsWithBytes(buf, [0x4d, 0x4d, 0x00, 0x2a])
  ) {
    return "image/tiff";
  }
  if (startsWithBytes(buf, [0x42, 0x4d])) return "image/bmp";
  if (startsWithBytes(buf, [0x00, 0x00, 0x01, 0x00])) return "image/x-icon";
  if (startsWithBytes(buf, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) return "application/msword";
  if (startsWithBytes(buf, [0x50, 0x4b, 0x03, 0x04])) {
    const ext = extFromName(filename);
    if (ext === "docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    if (ext === "pages") return "application/vnd.apple.pages";
    const probe = buf.subarray(0, Math.min(buf.length, 512 * 1024)).toString("utf8").toLowerCase();
    const looksLikePages =
      probe.includes("index/document.iwa") ||
      probe.includes("metadata/buildversionhistory.plist") ||
      probe.includes("quicklook/preview.pdf");
    if (looksLikePages) return "application/vnd.apple.pages";
  }
  const isoBmff = sniffIsoBmff(buf);
  if (isoBmff) return isoBmff;
  if (sniffSvg(buf)) return "image/svg+xml";
  return null;
}

function isUint8Array(v: unknown): v is Uint8Array {
  return v instanceof Uint8Array;
}

function isReadableStream(v: unknown): v is NodeJS.ReadableStream {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as NodeJS.ReadableStream).on === "function"
  );
}

async function asBuffer(body: unknown): Promise<Buffer> {
  if (Buffer.isBuffer(body)) return body;
  if (isUint8Array(body)) return Buffer.from(body);

  if (
    typeof body === "object" &&
    body !== null &&
    "transformToByteArray" in body &&
    typeof (body as { transformToByteArray?: unknown }).transformToByteArray === "function"
  ) {
    const fn = (body as { transformToByteArray: () => Promise<Uint8Array> }).transformToByteArray;
    const arr = await fn();
    return Buffer.from(arr);
  }

  if (!isReadableStream(body)) throw new Error("S3 GetObject body is not a readable stream");

  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    body.on("data", (c: unknown) => {
      if (Buffer.isBuffer(c)) chunks.push(c);
      else if (isUint8Array(c)) chunks.push(Buffer.from(c));
      else chunks.push(Buffer.from(String(c)));
    });
    body.on("end", () => resolve(Buffer.concat(chunks)));
    body.on("error", reject);
  });
}

async function readObjectPrefix(bucket: string, key: string, maxBytes: number = 64 * 1024): Promise<Buffer> {
  const rangeEnd = Math.max(1024, maxBytes) - 1;
  const res = await s3.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      Range: `bytes=0-${rangeEnd}`,
    })
  );
  return asBuffer(res.Body);
}

function getErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  try {
    return JSON.stringify(e);
  } catch {
    return "unknown error";
  }
}

type CompleteUploadBody = {
  filename?: string;
  contentType?: string;
  sizeBytes?: number;
  bucket?: string;
  key?: string;
};

type FileKind = "raw" | "output";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ projectId: string; uploadId: string }> }
) {
  try {
    const { projectId, uploadId } = await params;
    if (!projectId || !uploadId) {
      return NextResponse.json(
        { error: "bad_request", detail: "missing params" },
        { status: 400 }
      );
    }

    const actor = await requireActorForProject(projectId);
    const tableName = await getTableName();

    let body: Partial<CompleteUploadBody> = {};
    try {
      body = (await req.json()) as Partial<CompleteUploadBody>;
    } catch {
      return NextResponse.json(
        { error: "bad_request", detail: "invalid json" },
        { status: 400 }
      );
    }

    const rawName = String(body.filename ?? "");
    const filename = safeFileName(rawName);

    const bucket = String(body.bucket ?? "").trim();
    const key = String(body.key ?? "").trim();

    if (!rawName.trim() || !bucket || !key) {
      return NextResponse.json(
        { error: "bad_request", detail: "filename, bucket, key are required" },
        { status: 400 }
      );
    }

    const rawCt = normalizeContentType(String(body.contentType ?? ""));
    const guessedFromName = guessContentTypeFromName(filename);
    let prefixBytes: Buffer;
    try {
      prefixBytes = await readObjectPrefix(bucket, key);
    } catch (e: unknown) {
      return NextResponse.json(
        {
          error: "upload_not_found",
          detail: `Could not read uploaded object for verification: ${getErrorMessage(e)}`,
        },
        { status: 409 }
      );
    }
    const sniffed = sniffContentTypeFromBytes(prefixBytes, filename);
    const contentType = sniffed ?? (rawCt && rawCt !== "application/octet-stream" ? rawCt : guessedFromName);
    if (allowedOutputFormatsForFile(filename, contentType).length === 0) {
      return NextResponse.json(
        {
          error: "unsupported_media_type",
          detail: `Unsupported file type: ${contentType}`,
        },
        { status: 415 }
      );
    }

    const sizeBytes =
      typeof body.sizeBytes === "number" &&
      Number.isFinite(body.sizeBytes) &&
      body.sizeBytes >= 0
        ? Math.floor(body.sizeBytes)
        : null;

    const createdAt = nowIso();
    const PK = `USER#${actor.sub}`;
    const SK = `FILE#${projectId}#${uploadId}`; // deterministic

    const kind: FileKind = "raw";

    await ddbDoc.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          PK,
          SK,
          entity: "FILE",
          kind, // ✅ NEW
          fileId: uploadId,
          projectId,
          userSub: actor.sub,
          filename,
          contentType,
          sizeBytes,
          bucket,
          key,
          status: "queued",
          createdAt,
          updatedAt: createdAt,
        },
        ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)",
      })
    );

    return NextResponse.json(
      { file: { fileId: uploadId, status: "queued", kind } },
      { status: 201 }
    );
  } catch (e: unknown) {
    const msg = getErrorMessage(e);
    if (msg === "UNAUTHENTICATED" || msg === "INVALID_TOKEN") {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    console.error("complete upload error:", e);
    return NextResponse.json({ error: "server_error", detail: msg }, { status: 500 });
  }
}
