import "server-only";
import { NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

import { ddbDoc, getTableName, s3, mustEnv } from "@/app/app/api/_lib/aws";
import { requireActorForProject } from "@/app/app/api/_lib/actor";
import { isGuestProjectId } from "@/app/app/api/_lib/guest-session";

export const runtime = "nodejs";

type CreateUploadBody = {
  filename?: string;
  contentType?: string;
  sizeBytes?: number;
};

type ProjectLookup = {
  name: string;
  status: string;
  projectSlug?: string;
  projectSK: string; // needed for backfill update
} | null;

function jsonError(status: number, error: string, detail?: string) {
  return NextResponse.json(
    { error, detail: process.env.NODE_ENV !== "production" ? detail : undefined },
    { status }
  );
}

function safeFileName(input: string): string {
  const trimmed = input.trim();
  const base = trimmed.split("/").pop() ?? trimmed;
  const cleaned = base.replace(/[^\p{L}\p{N}._ -]+/gu, "_");
  const noDots = cleaned.replace(/^\.+/, "");
  return (noDots || "file").slice(0, 120);
}

function normalizeContentType(ct: string): string {
  const v = (ct || "").trim();
  return (v || "application/octet-stream").slice(0, 200);
}

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

function readString(obj: unknown, key: string): string | undefined {
  if (typeof obj !== "object" || obj === null) return undefined;
  const rec = obj as Record<string, unknown>;
  const v = rec[key];
  return typeof v === "string" ? v : undefined;
}

function userSlugFromClaims(user: { name?: unknown; email?: unknown }): string {
  const name = typeof user.name === "string" ? user.name.trim() : "";
  if (name) return slugify(name);

  const email = typeof user.email === "string" ? user.email.trim().toLowerCase() : "";
  if (email) return slugify((email.split("@")[0] || "user").trim());

  return "user";
}

/**
 * IMPORTANT:
 * - Never use Limit: 1 with FilterExpression (Limit applies pre-filter).
 * - ConsistentRead so create project -> upload immediately works.
 * - Paginate until found.
 * - Return the real stored name; do NOT substitute "Untitled Project" here.
 */
async function fetchProjectById(
  tableName: string,
  userSub: string,
  projectId: string
): Promise<ProjectLookup> {
  const PK = `USER#${userSub}`;
  let lastKey: Record<string, unknown> | undefined;

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
        Limit: 50,
        ExclusiveStartKey: lastKey as never,
        ProjectionExpression: "projectId, SK, #n, #s, projectSlug",
        ExpressionAttributeNames: {
          "#n": "name",
          "#s": "status",
        },
      })
    );

    for (const it of res.Items ?? []) {
      const pid = readString(it, "projectId");
      if (pid !== projectId) continue;

      const sk = readString(it, "SK") ?? "";
      if (!sk) continue;

      const name = (readString(it, "name") ?? "").trim();
      const status = (readString(it, "status") ?? "active").trim() || "active";
      const projectSlug = (readString(it, "projectSlug") ?? "").trim() || undefined;

      return { name, status, projectSlug, projectSK: sk };
    }

    if (!res.LastEvaluatedKey) return null;
    lastKey = res.LastEvaluatedKey as unknown as Record<string, unknown>;
  }

  return null;
}

async function backfillProjectSlugOnce(params: {
  tableName: string;
  userSub: string;
  projectSK: string;
  projectSlug: string;
}): Promise<void> {
  const PK = `USER#${params.userSub}`;

  // Only set if missing (immutable once set)
  await ddbDoc.send(
    new UpdateCommand({
      TableName: params.tableName,
      Key: { PK, SK: params.projectSK },
      UpdateExpression: "SET projectSlug = :ps",
      ExpressionAttributeValues: { ":ps": params.projectSlug },
      ConditionExpression:
        "attribute_exists(PK) AND attribute_exists(SK) AND attribute_not_exists(projectSlug)",
    })
  );
}

function fallbackProjectSlug(projectId: string): string {
  const short = projectId.slice(0, 8) || "project";
  return `project-${short}`;
}

function buildRawKey(args: {
  userSub: string;
  userSlug: string;
  projectId: string;
  projectSlug: string;
  fileId: string;
  filename: string;
}) {
  const { userSub, userSlug, projectId, projectSlug, fileId, filename } = args;

  // ✅ Stable across renames because projectSlug is immutable once set.
  // Desired shape: project-name first, then id
  return `private/${userSub}/${userSlug}/projects/${projectSlug}--${projectId}/raw/${fileId}/${filename}`;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    if (!projectId) return jsonError(400, "bad_request", "projectId is required");

    const actor = await requireActorForProject(projectId);
    const tableName = await getTableName();

    let body: CreateUploadBody = {};
    try {
      body = (await req.json()) as CreateUploadBody;
    } catch {
      return jsonError(400, "bad_request", "invalid json");
    }

    const rawName = (body.filename ?? "").trim();
    if (!rawName) return jsonError(400, "bad_request", "filename is required");

    const sizeBytes =
      typeof body.sizeBytes === "number" && Number.isFinite(body.sizeBytes) ? body.sizeBytes : undefined;

    if (sizeBytes != null && (sizeBytes <= 0 || sizeBytes > 250 * 1024 * 1024)) {
      return jsonError(400, "bad_request", "invalid sizeBytes");
    }

    const filename = safeFileName(rawName);
    const contentType = normalizeContentType(body.contentType ?? "");

    const usingGuestProject = actor.kind === "guest" && isGuestProjectId(projectId);
    let projectSlug = "guest-conversion-test";
    if (!usingGuestProject) {
      // Ensure project exists and is active
      const project = await fetchProjectById(tableName, actor.sub, projectId);
      if (!project) return jsonError(404, "not_found", "project not found");
      if ((project.status || "active") !== "active") {
        return jsonError(410, "gone", "project is not active");
      }

      // Stable slug: prefer stored projectSlug; otherwise compute once and store.
      projectSlug = project.projectSlug || "";
      if (!projectSlug) {
        const computed = project.name ? slugify(project.name) : fallbackProjectSlug(projectId);

        try {
          await backfillProjectSlugOnce({
            tableName,
            userSub: actor.sub,
            projectSK: project.projectSK,
            projectSlug: computed,
          });
        } catch {
          // Another request might have set it first; ignore.
        }

        projectSlug = computed;
      }
    }

    const bucket = await mustEnv("RAW_BUCKET");
    const fileId = crypto.randomUUID();

    const userSlug =
      actor.kind === "guest"
        ? "guest"
        : userSlugFromClaims({
            name: undefined,
            email: actor.email,
          });

    const key = buildRawKey({
      userSub: actor.sub,
      userSlug,
      projectId,
      projectSlug,
      fileId,
      filename,
    });

    const cmd = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
    });

    const putUrl = await getSignedUrl(s3, cmd, { expiresIn: 300 });

    return NextResponse.json(
      {
        upload: {
          uploadId: fileId,
          fileId,
          bucket,
          key,
          putUrl,
          headers: {
            "Content-Type": contentType,
          },
        },
      },
      { status: 201 }
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "UNAUTHENTICATED" || msg === "INVALID_TOKEN") {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    console.error("POST uploads error:", e);
    return jsonError(500, "server_error", msg);
  }
}
