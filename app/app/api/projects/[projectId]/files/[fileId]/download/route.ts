import "server-only";
import { NextResponse } from "next/server";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { ddbDoc, getTableName, s3 } from "@/app/app/api/_lib/aws";
import { requireActorForProject } from "@/app/app/api/_lib/actor";

export const runtime = "nodejs";

function getErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  try {
    return JSON.stringify(e);
  } catch {
    return "unknown error";
  }
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function safeDispositionFilename(name: string): string {
  // Keep it boring and safe for headers (no quotes/newlines)
  const cleaned = name.replace(/[\r\n"]/g, "");
  return cleaned || "download";
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ projectId: string; fileId: string }> }
) {
  try {
    const { projectId, fileId } = await params;

    if (!projectId || !fileId) {
      return NextResponse.json(
        { error: "bad_request", detail: "missing params" },
        { status: 400 }
      );
    }

    const actor = await requireActorForProject(projectId);
    const tableName = await getTableName();
    const PK = `USER#${actor.sub}`;
    const SK = `FILE#${projectId}#${fileId}`;

    const got = await ddbDoc.send(
      new GetCommand({
        TableName: tableName,
        Key: { PK, SK },
      })
    );

    const item = got.Item;
    if (!item) return NextResponse.json({ error: "not_found" }, { status: 404 });

    const bucket = str(item.bucket);
    const key = str(item.key);
    const filename = safeDispositionFilename(str(item.filename));

    if (!bucket || !key) {
      // Bad row in Dynamo, treat as missing
      return NextResponse.json(
        { error: "not_found", detail: "missing bucket/key" },
        { status: 404 }
      );
    }

    const inlineUrl = await getSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: bucket, Key: key }),
      { expiresIn: 60 }
    );

    const downloadUrl = await getSignedUrl(
      s3,
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
        ResponseContentDisposition: `attachment; filename="${filename}"`,
      }),
      { expiresIn: 60 }
    );

    return NextResponse.json({ inlineUrl, downloadUrl });
  } catch (e: unknown) {
    const msg = getErrorMessage(e);
    if (msg === "UNAUTHENTICATED" || msg === "INVALID_TOKEN") {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    console.error("GET download url error:", e);
    return NextResponse.json({ error: "server_error", detail: msg }, { status: 500 });
  }
}
