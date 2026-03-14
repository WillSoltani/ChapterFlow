import "server-only";
import { NextResponse } from "next/server";
import { DeleteCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";

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

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function awsHttpStatus(e: unknown): number | undefined {
  if (typeof e !== "object" || e === null) return undefined;
  const rec = e as Record<string, unknown>;
  const md = rec.$metadata;
  if (typeof md !== "object" || md === null) return undefined;
  const mdr = md as Record<string, unknown>;
  const code = mdr.httpStatusCode;
  return typeof code === "number" ? code : undefined;
}

function awsErrorName(e: unknown): string | undefined {
  if (typeof e !== "object" || e === null) return undefined;
  const rec = e as Record<string, unknown>;
  const name = rec.name;
  return typeof name === "string" ? name : undefined;
}

export async function DELETE(
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
    const itemKind = str(isRecord(item) ? item.kind : "");
    const itemArtifactType = str(isRecord(item) ? item.artifactType : "");

    console.info(
      JSON.stringify({
        event: "single_file_delete_requested",
        projectId,
        fileId,
        itemFound: Boolean(item),
        itemKind: itemKind || "unknown",
        itemArtifactType: itemArtifactType || "unknown",
      })
    );

    let deletedS3Objects = 0;
    let plannedS3Deletes = 0;

    if (item) {
      const bucket = str(item.bucket);
      const key = str(item.key);
      plannedS3Deletes = bucket && key ? 1 : 0;

      // Safety rail: a single-delete endpoint must never delete more than one object.
      if (plannedS3Deletes > 1) {
        throw new Error(
          `single delete guardrail triggered for fileId=${fileId}: plannedS3Deletes=${plannedS3Deletes}`
        );
      }

      if (bucket && key) {
        try {
          await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
          deletedS3Objects = 1;
        } catch (e: unknown) {
          // If already deleted from S3, that's fine.
          const status = awsHttpStatus(e);
          const name = awsErrorName(e);
          const notFoundish = status === 404 || name === "NotFound" || name === "NoSuchKey";
          if (!notFoundish) {
            console.warn("DeleteObject failed (continuing):", e);
          }
        }
      }
    }

    await ddbDoc.send(
      new DeleteCommand({
        TableName: tableName,
        Key: { PK, SK },
      })
    );

    console.info(
      JSON.stringify({
        event: "single_file_delete_completed",
        projectId,
        fileId,
        plannedS3Deletes,
        deletedS3Objects,
        deletedDdbRows: item ? 1 : 0,
      })
    );

    return NextResponse.json({
      ok: true,
      fileId,
      deleted: {
        ddbRows: item ? 1 : 0,
        s3Objects: deletedS3Objects,
      },
    });
  } catch (e: unknown) {
    const msg = getErrorMessage(e);
    if (msg === "UNAUTHENTICATED" || msg === "INVALID_TOKEN") {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    console.error("DELETE file error:", e);
    return NextResponse.json({ error: "server_error", detail: msg }, { status: 500 });
  }
}
