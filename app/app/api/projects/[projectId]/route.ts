import "server-only";
import { NextResponse } from "next/server";
import {
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";

import { ddbDoc, getTableName, s3 } from "../../_lib/aws";
import { requireUser } from "../../_lib/auth";

export const runtime = "nodejs";

type PatchBody = { name?: string };

function nowIso() {
  return new Date().toISOString();
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

function isAuthError(msg: string) {
  return msg === "UNAUTHENTICATED" || msg === "INVALID_TOKEN";
}

function authErrorResponse(msg: string) {
  return NextResponse.json({ error: msg.toLowerCase() }, { status: 401 });
}

function readStringProp(obj: unknown, key: string): string | undefined {
  if (typeof obj !== "object" || obj === null) return undefined;
  const rec = obj as Record<string, unknown>;
  const v = rec[key];
  return typeof v === "string" ? v : undefined;
}

function isConditionalCheckFailed(e: unknown) {
  const name = readStringProp(e, "name");
  const type = readStringProp(e, "__type");
  return (
    name === "ConditionalCheckFailedException" ||
    type === "ConditionalCheckFailedException"
  );
}

// Align with uploads slugify: no "untitled-project" string.
function slugify(input: string): string {
  const s = (input || "").trim().toLowerCase();
  const cleaned = s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return cleaned || "untitled";
}

type ProjectFound = {
  key: { PK: string; SK: string };
  item: Record<string, unknown>;
};

async function findProject(
  tableName: string,
  userSub: string,
  projectId: string
): Promise<ProjectFound | null> {
  const PK = `USER#${userSub}`;
  let lastEvaluatedKey: Record<string, unknown> | undefined;

  for (let page = 0; page < 50; page += 1) {
    const res = await ddbDoc.send(
      new QueryCommand({
        TableName: tableName,
        ConsistentRead: true,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
        ExpressionAttributeValues: {
          ":pk": PK,
          ":prefix": "PROJECT#",
          ":pid": projectId,
        },
        FilterExpression: "projectId = :pid",
        ScanIndexForward: false,
        ExclusiveStartKey: lastEvaluatedKey as never,
        Limit: 50,
      })
    );

    const item = (res.Items ?? [])[0];
    if (item) {
      const SK = typeof item.SK === "string" ? item.SK : "";
      if (!SK) return null;
      return { key: { PK, SK }, item: item as Record<string, unknown> };
    }

    lastEvaluatedKey = (res.LastEvaluatedKey ?? undefined) as unknown as
      | Record<string, unknown>
      | undefined;

    if (!lastEvaluatedKey) break;
  }

  return null;
}

type FileItem = {
  PK: string;
  SK: string;
  bucket: string;
  key: string;
};

async function listProjectFiles(
  tableName: string,
  userSub: string,
  projectId: string
): Promise<FileItem[]> {
  const PK = `USER#${userSub}`;
  const out: FileItem[] = [];
  let lastEvaluatedKey: Record<string, unknown> | undefined;

  for (let page = 0; page < 200; page += 1) {
    const res = await ddbDoc.send(
      new QueryCommand({
        TableName: tableName,
        ConsistentRead: true,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
        ExpressionAttributeValues: {
          ":pk": PK,
          ":prefix": "FILE#",
          ":projectId": projectId,
        },
        FilterExpression: "projectId = :projectId",
        ExclusiveStartKey: lastEvaluatedKey as never,
        Limit: 50,
      })
    );

    for (const it of res.Items ?? []) {
      const SK = typeof it.SK === "string" ? it.SK : "";
      const bucket = typeof it.bucket === "string" ? it.bucket : "";
      const key = typeof it.key === "string" ? it.key : "";
      if (!SK || !bucket || !key) continue;
      out.push({ PK, SK, bucket, key });
    }

    lastEvaluatedKey = (res.LastEvaluatedKey ?? undefined) as unknown as
      | Record<string, unknown>
      | undefined;

    if (!lastEvaluatedKey) break;
  }

  return out;
}

// ✅ GET single project (returns projectSlug when present)
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const user = await requireUser();
    const tableName = await getTableName();
    const { projectId } = await params;

    if (!projectId) {
      return NextResponse.json(
        { error: "projectId is required" },
        { status: 400 }
      );
    }

    const found = await findProject(tableName, user.sub, projectId);
    if (!found) return NextResponse.json({ error: "not found" }, { status: 404 });

    const it = found.item;

    const projectSlugRaw =
      typeof it.projectSlug === "string" ? it.projectSlug.trim() : "";

    const project = {
      projectId: String(it.projectId ?? projectId),
      name: String(it.name ?? "Untitled Project"),
      projectSlug: projectSlugRaw || undefined,
      createdAt: String(it.createdAt ?? ""),
      updatedAt: String(it.updatedAt ?? it.createdAt ?? ""),
      status: String(it.status ?? "active"),
    };

    return NextResponse.json({ project });
  } catch (e: unknown) {
    const msg = getErrorMessage(e);
    if (isAuthError(msg)) return authErrorResponse(msg);

    console.error("GET /app/api/projects/[projectId] error:", e);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}

// ✅ PATCH rename project (Solution A: projectSlug IMMUTABLE)
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const user = await requireUser();
    const tableName = await getTableName();
    const { projectId } = await params;

    if (!projectId) {
      return NextResponse.json(
        { error: "projectId is required" },
        { status: 400 }
      );
    }

    let body: Partial<PatchBody> = {};
    try {
      body = (await req.json()) as Partial<PatchBody>;
    } catch {
      return NextResponse.json({ error: "invalid json" }, { status: 400 });
    }

    const name = (body.name ?? "").trim();
    if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });
    if (name.length > 80) return NextResponse.json({ error: "name too long" }, { status: 400 });

    const found = await findProject(tableName, user.sub, projectId);
    if (!found) return NextResponse.json({ error: "not found" }, { status: 404 });

    const updatedAt = nowIso();

    const existingSlug =
      typeof found.item.projectSlug === "string" && found.item.projectSlug.trim()
        ? found.item.projectSlug.trim()
        : "";

    const shouldSetSlug = !existingSlug;
    const newSlug = shouldSetSlug ? slugify(name) : existingSlug;

    const updateExpr = shouldSetSlug
      ? "SET #n = :name, updatedAt = :u, projectSlug = :ps"
      : "SET #n = :name, updatedAt = :u";

    const exprValues: Record<string, unknown> = shouldSetSlug
      ? { ":name": name, ":u": updatedAt, ":ps": newSlug }
      : { ":name": name, ":u": updatedAt };

    try {
      await ddbDoc.send(
        new UpdateCommand({
          TableName: tableName,
          Key: found.key,
          UpdateExpression: updateExpr,
          ExpressionAttributeNames: { "#n": "name" },
          ExpressionAttributeValues: exprValues,
          ConditionExpression: "attribute_exists(PK) AND attribute_exists(SK)",
        })
      );
    } catch (e: unknown) {
      if (isConditionalCheckFailed(e)) {
        return NextResponse.json({ error: "not found" }, { status: 404 });
      }
      throw e;
    }

    return NextResponse.json({
      projectId,
      name,
      updatedAt,
      projectSlug: newSlug || undefined,
    });
  } catch (e: unknown) {
    const msg = getErrorMessage(e);
    if (isAuthError(msg)) return authErrorResponse(msg);

    console.error("PATCH /app/api/projects/[projectId] error:", e);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}

// ✅ DELETE project + all its files (DDB + S3 best-effort)
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const user = await requireUser();
    const tableName = await getTableName();
    const { projectId } = await params;

    if (!projectId) {
      return NextResponse.json(
        { error: "projectId is required" },
        { status: 400 }
      );
    }

    const found = await findProject(tableName, user.sub, projectId);
    if (!found) return NextResponse.json({ error: "not found" }, { status: 404 });

    const files = await listProjectFiles(tableName, user.sub, projectId);

    let deletedFileRows = 0;
    let deletedS3Objects = 0;

    for (const f of files) {
      try {
        await s3.send(new DeleteObjectCommand({ Bucket: f.bucket, Key: f.key }));
        deletedS3Objects += 1;
      } catch (err) {
        console.warn("DeleteObject failed (continuing):", err);
      }

      try {
        await ddbDoc.send(
          new DeleteCommand({
            TableName: tableName,
            Key: { PK: f.PK, SK: f.SK },
          })
        );
        deletedFileRows += 1;
      } catch (err) {
        console.warn("Delete FILE row failed (continuing):", err);
      }
    }

    try {
      await ddbDoc.send(
        new DeleteCommand({
          TableName: tableName,
          Key: found.key,
          ConditionExpression: "attribute_exists(PK) AND attribute_exists(SK)",
        })
      );
    } catch (e: unknown) {
      if (isConditionalCheckFailed(e)) {
        return NextResponse.json({ error: "not found" }, { status: 404 });
      }
      throw e;
    }

    return NextResponse.json({
      ok: true,
      projectId,
      deletedFileRows,
      deletedS3Objects,
    });
  } catch (e: unknown) {
    const msg = getErrorMessage(e);
    if (isAuthError(msg)) return authErrorResponse(msg);

    console.error("DELETE /app/api/projects/[projectId] error:", e);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}
