import "server-only";
import { NextResponse } from "next/server";
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { ddbDoc, getTableName, s3 } from "@/app/app/api/_lib/aws";
import { requireUser } from "@/app/app/api/_lib/auth";

export const runtime = "nodejs";

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

function isPdfHeader(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  );
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

    const bodyBuffer = new Uint8Array(await req.arrayBuffer());
    if (bodyBuffer.length < 1024 || !isPdfHeader(bodyBuffer)) {
      return NextResponse.json({ error: "bad_request", detail: "invalid pdf bytes" }, { status: 400 });
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

    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: bodyBuffer,
        ContentType: "application/pdf",
      })
    );

    await ddbDoc.send(
      new UpdateCommand({
        TableName: tableName,
        Key: { PK, SK },
        UpdateExpression: "SET #s = :done, updatedAt = :u, sizeBytes = :sz, contentType = :ct, errorMessage = :em",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: {
          ":done": "done",
          ":u": nowIso(),
          ":sz": bodyBuffer.length,
          ":ct": "application/pdf",
          ":em": null,
        },
      })
    );

    return NextResponse.json({ ok: true, fileId });
  } catch (error: unknown) {
    const msg = getErrorMessage(error);
    if (msg === "UNAUTHENTICATED" || msg === "INVALID_TOKEN") {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    console.error("upload filled pdf bytes error:", error);
    return NextResponse.json({ error: "server_error", detail: msg }, { status: 500 });
  }
}
