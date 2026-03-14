import "server-only";
import { NextResponse } from "next/server";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ddbDoc, getTableName, mustEnv, s3 } from "@/app/app/api/_lib/aws";
import { requireUser } from "@/app/app/api/_lib/auth";

export const runtime = "nodejs";

type Body = {
  originalFileId?: string;
  filename?: string;
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

function safePdfFilename(input: string): string {
  const trimmed = input.trim();
  const basename = trimmed.split("/").pop() ?? trimmed;
  const cleaned = basename
    .replace(/[^\p{L}\p{N}._ -]+/gu, "_")
    .replace(/\s+/g, " ")
    .replace(/^\.+/, "")
    .slice(0, 140);
  if (!cleaned) return "filled.pdf";
  if (cleaned.toLowerCase().endsWith(".pdf")) return cleaned;
  return `${cleaned}.pdf`;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const user = await requireUser();
    const tableName = await getTableName();
    const { projectId } = await params;
    if (!projectId) {
      return NextResponse.json({ error: "bad_request", detail: "projectId is required" }, { status: 400 });
    }

    let body: Body = {};
    try {
      body = (await req.json()) as Body;
    } catch {
      return NextResponse.json({ error: "bad_request", detail: "invalid json" }, { status: 400 });
    }

    const originalFileId = String(body.originalFileId ?? "").trim();
    if (!originalFileId) {
      return NextResponse.json({ error: "bad_request", detail: "originalFileId is required" }, { status: 400 });
    }

    const filename = safePdfFilename(String(body.filename ?? ""));
    const sizeBytes =
      typeof body.sizeBytes === "number" && Number.isFinite(body.sizeBytes) && body.sizeBytes >= 0
        ? Math.floor(body.sizeBytes)
        : null;

    const PK = `USER#${user.sub}`;
    const sourceSK = `FILE#${projectId}#${originalFileId}`;
    const sourceRes = await ddbDoc.send(
      new GetCommand({ TableName: tableName, Key: { PK, SK: sourceSK } })
    );
    const source = sourceRes.Item;
    if (!source) {
      return NextResponse.json({ error: "not_found", detail: "source file not found" }, { status: 404 });
    }

    const outputBucket = await mustEnv("OUTPUT_BUCKET");
    const fileId = crypto.randomUUID();
    const createdAt = nowIso();
    const key = `private/${user.sub}/${projectId}/filled/${fileId}/${filename}`;
    const outSK = `FILE#${projectId}#${fileId}`;

    await ddbDoc.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          PK,
          SK: outSK,
          entity: "FILE",
          kind: "output",
          artifactType: "filled_pdf",
          fileId,
          projectId,
          userSub: user.sub,
          filename,
          contentType: "application/pdf",
          sizeBytes,
          bucket: outputBucket,
          key,
          status: "processing",
          createdAt,
          updatedAt: createdAt,
          sourceFileId: originalFileId,
          sourceContentType: String(source.contentType ?? "application/pdf"),
          outputFormat: "PDF",
          packaging: "single",
        },
        ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)",
      })
    );

    const putUrl = await getSignedUrl(
      s3,
      new PutObjectCommand({
        Bucket: outputBucket,
        Key: key,
        ContentType: "application/pdf",
      }),
      { expiresIn: 300 }
    );

    return NextResponse.json(
      {
        upload: {
          fileId,
          putUrl,
          bucket: outputBucket,
          key,
          headers: {
            "Content-Type": "application/pdf",
          },
        },
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const msg = getErrorMessage(error);
    if (msg === "UNAUTHENTICATED" || msg === "INVALID_TOKEN") {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    console.error("create filled upload error:", error);
    return NextResponse.json({ error: "server_error", detail: msg }, { status: 500 });
  }
}
