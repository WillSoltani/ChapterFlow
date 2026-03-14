import "server-only";
import { NextResponse } from "next/server";
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { HeadObjectCommand } from "@aws-sdk/client-s3";
import { ddbDoc, getTableName, s3 } from "@/app/app/api/_lib/aws";
import { requireUser } from "@/app/app/api/_lib/auth";

export const runtime = "nodejs";

type Body = {
  bucket?: string;
  key?: string;
  sizeBytes?: number;
};

function nowIso(): string {
  return new Date().toISOString();
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return "unknown error";
  }
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ projectId: string; fileId: string }> }
) {
  try {
    const user = await requireUser();
    const tableName = await getTableName();
    const { projectId, fileId } = await params;
    if (!projectId || !fileId) {
      return NextResponse.json({ error: "bad_request", detail: "missing params" }, { status: 400 });
    }

    let body: Body = {};
    try {
      body = (await req.json()) as Body;
    } catch {
      return NextResponse.json({ error: "bad_request", detail: "invalid json" }, { status: 400 });
    }

    const PK = `USER#${user.sub}`;
    const SK = `FILE#${projectId}#${fileId}`;

    const got = await ddbDoc.send(new GetCommand({ TableName: tableName, Key: { PK, SK } }));
    const item = got.Item;
    if (!item) return NextResponse.json({ error: "not_found" }, { status: 404 });
    if (str(item.kind) !== "output" || str(item.artifactType) !== "filled_pdf") {
      return NextResponse.json({ error: "bad_request", detail: "not a filled pdf artifact" }, { status: 400 });
    }

    const bucket = str(item.bucket);
    const key = str(item.key);
    if (!bucket || !key) {
      return NextResponse.json({ error: "bad_request", detail: "missing bucket/key" }, { status: 400 });
    }
    if (str(body.bucket) && str(body.bucket) !== bucket) {
      return NextResponse.json({ error: "bad_request", detail: "bucket mismatch" }, { status: 400 });
    }
    if (str(body.key) && str(body.key) !== key) {
      return NextResponse.json({ error: "bad_request", detail: "key mismatch" }, { status: 400 });
    }

    let headSize: number | null = null;
    let headContentType: string | null = null;
    let headVerifyError: string | null = null;
    try {
      const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
      headSize =
        typeof head.ContentLength === "number" && Number.isFinite(head.ContentLength) && head.ContentLength >= 0
          ? Math.floor(head.ContentLength)
          : null;
      headContentType = typeof head.ContentType === "string" ? head.ContentType : null;
    } catch (error: unknown) {
      headVerifyError = getErrorMessage(error);
      console.warn("complete filled upload: head verification skipped", {
        projectId,
        fileId,
        bucket,
        key,
        error: headVerifyError,
      });
    }

    const fallbackBodySize =
      typeof body.sizeBytes === "number" && Number.isFinite(body.sizeBytes) && body.sizeBytes >= 0
        ? Math.floor(body.sizeBytes)
        : null;
    const finalSize = headSize ?? fallbackBodySize;

    const updateValues: Record<string, unknown> = {
      ":done": "done",
      ":u": nowIso(),
      ":sz": finalSize,
      ":ct": headContentType ?? "application/pdf",
      ":em": null,
    };

    await ddbDoc.send(
      new UpdateCommand({
        TableName: tableName,
        Key: { PK, SK },
        UpdateExpression: "SET #s = :done, updatedAt = :u, sizeBytes = :sz, contentType = :ct, errorMessage = :em",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: updateValues,
      })
    );

    return NextResponse.json({ ok: true, fileId });
  } catch (error: unknown) {
    const msg = getErrorMessage(error);
    if (msg === "UNAUTHENTICATED" || msg === "INVALID_TOKEN") {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    console.error("complete filled upload error:", error);
    return NextResponse.json({ error: "server_error", detail: msg }, { status: 500 });
  }
}
