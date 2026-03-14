import "server-only";
import { NextResponse } from "next/server";
import { QueryCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { HeadObjectCommand } from "@aws-sdk/client-s3";

import { ddbDoc, getTableName, s3 } from "@/app/app/api/_lib/aws";
import { requireActorForProject } from "@/app/app/api/_lib/actor";

export const runtime = "nodejs";

type FileKind = "raw" | "output";
type OutputArtifactType = "conversion" | "filled_pdf";

type FileRow = {
  fileId: string;
  projectId: string;
  filename: string;
  contentType: string;
  sizeBytes: number | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  bucket: string;
  key: string;
  kind: FileKind;
  outputFormat?: string;
  sourceFileId?: string;
  sourceContentType?: string;
  artifactType?: OutputArtifactType;
  packaging?: "single" | "zip";
  pageCount?: number;
  outputCount?: number;
};

type DbFileItem = FileRow & { PK: string; SK: string };

function getErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  try {
    return JSON.stringify(e);
  } catch {
    return "unknown error";
  }
}

function toFileRow<T extends Record<string, unknown>>(item: T): FileRow {
  const next = { ...item };
  delete next.PK;
  delete next.SK;
  return next as unknown as FileRow;
}

function isAuthError(msg: string) {
  return msg === "UNAUTHENTICATED" || msg === "INVALID_TOKEN";
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function numOrNull(v: unknown): number | null {
  if (typeof v !== "number") return null;
  if (!Number.isFinite(v) || v < 0) return null;
  return Math.floor(v);
}

function intOrUndef(v: unknown): number | undefined {
  if (typeof v !== "number") return undefined;
  if (!Number.isFinite(v) || v < 0) return undefined;
  return Math.floor(v);
}

function parseKind(v: unknown): FileKind {
  return v === "raw" || v === "output" ? v : "raw";
}

function toDbFileItem(raw: unknown): DbFileItem | null {
  if (!isRecord(raw)) return null;

  const PK = str(raw.PK);
  const SK = str(raw.SK);

  const fileId = str(raw.fileId);
  const projectId = str(raw.projectId);
  const filename = str(raw.filename);
  const bucket = str(raw.bucket);
  const key = str(raw.key);

  if (!PK || !SK || !fileId || !projectId || !filename || !bucket || !key) return null;

  const now = new Date().toISOString();

  const result: DbFileItem = {
    PK,
    SK,
    fileId,
    projectId,
    filename,
    contentType: str(raw.contentType) || "application/octet-stream",
    sizeBytes: numOrNull(raw.sizeBytes),
    status: str(raw.status) || "queued",
    createdAt: str(raw.createdAt) || now,
    updatedAt: str(raw.updatedAt) || str(raw.createdAt) || now,
    bucket,
    key,
    kind: parseKind(raw.kind),
  };
  // Pass through optional output-file traceability fields
  const outputFormat = str(raw.outputFormat);
  if (outputFormat) result.outputFormat = outputFormat;
  const sourceFileId = str(raw.sourceFileId);
  if (sourceFileId) result.sourceFileId = sourceFileId;
  const sourceContentType = str(raw.sourceContentType);
  if (sourceContentType) result.sourceContentType = sourceContentType;
  const artifactType = str(raw.artifactType);
  if (artifactType === "conversion" || artifactType === "filled_pdf") {
    result.artifactType = artifactType;
  } else if (result.kind === "output") {
    result.artifactType = "conversion";
  }
  const packaging = str(raw.packaging);
  if (packaging === "single" || packaging === "zip") result.packaging = packaging;
  const pageCount = intOrUndef(raw.pageCount);
  if (pageCount !== undefined) result.pageCount = pageCount;
  const outputCount = intOrUndef(raw.outputCount);
  if (outputCount !== undefined) result.outputCount = outputCount;
  return result;
}

function awsHttpStatus(e: unknown): number | undefined {
  if (!isRecord(e)) return undefined;
  const md = e.$metadata;
  if (!isRecord(md)) return undefined;
  const code = md.httpStatusCode;
  return typeof code === "number" ? code : undefined;
}

function awsErrorName(e: unknown): string | undefined {
  if (!isRecord(e)) return undefined;
  const n = e.name;
  return typeof n === "string" ? n : undefined;
}

async function headExists(bucket: string, key: string): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch (e: unknown) {
    const name = awsErrorName(e);
    const status = awsHttpStatus(e);
    if (name === "NotFound" || name === "NoSuchKey" || status === 404) return false;

    // Unexpected (permissions, throttling, etc). Avoid deleting Dynamo rows.
    console.warn("HeadObject unexpected error (treating as exists):", e);
    return true;
  }
}

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let idx = 0;

  async function runOne() {
    while (idx < items.length) {
      const cur = idx++;
      results[cur] = await worker(items[cur]);
    }
  }

  const n = Math.max(1, Math.min(limit, items.length || 1));
  await Promise.all(Array.from({ length: n }, () => runOne()));
  return results;
}

export async function GET(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params;
    if (!projectId) {
      return NextResponse.json(
        { error: "bad_request", detail: "projectId is required" },
        { status: 400 }
      );
    }

    const actor = await requireActorForProject(projectId);
    const tableName = await getTableName();

    const url = new URL(req.url);
    const validate = url.searchParams.get("validate") === "1";

    const PK = `USER#${actor.sub}`;
    const prefix = `FILE#${projectId}#`;

    // ✅ deterministic query: no FilterExpression needed
    const res = await ddbDoc.send(
      new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
        ExpressionAttributeValues: {
          ":pk": PK,
          ":prefix": prefix,
        },
        ScanIndexForward: false,
      })
    );

    const items = (res.Items ?? [])
      .map(toDbFileItem)
      .filter((x): x is DbFileItem => x !== null);

    if (!validate) {
      const files: FileRow[] = items.map(toFileRow);
      return NextResponse.json({ files });
    }

    const checks = await mapLimit(items, 6, async (it) => {
      // Output files in "processing" state haven't been uploaded to S3 yet — skip the check
      if (it.kind === "output" && it.status === "processing") {
        return { it, exists: true };
      }
      const exists = await headExists(it.bucket, it.key);
      return { it, exists };
    });

    const missing = checks.filter((c) => !c.exists).map((c) => c.it);

    // delete missing Dynamo rows best-effort
    await Promise.all(
      missing.map((m) =>
        ddbDoc
          .send(
            new DeleteCommand({
              TableName: tableName,
              Key: { PK: m.PK, SK: m.SK },
            })
          )
          .catch((e) => console.warn("DDB delete (missing S3) failed:", e))
      )
    );

    const cleaned: FileRow[] = checks
      .filter((c) => c.exists)
      .map(({ it }) => toFileRow(it));

    return NextResponse.json({ files: cleaned, reconciled: { removed: missing.length } });
  } catch (e: unknown) {
    const msg = getErrorMessage(e);
    if (isAuthError(msg)) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    console.error("GET files error:", e);
    return NextResponse.json({ error: "server_error", detail: msg }, { status: 500 });
  }
}
