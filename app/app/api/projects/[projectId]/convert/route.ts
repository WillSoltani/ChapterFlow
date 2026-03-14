import "server-only";
import { NextResponse } from "next/server";
import { GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { SFNClient, StartExecutionCommand } from "@aws-sdk/client-sfn";

import { ddbDoc, getTableName, mustEnv } from "@/app/app/api/_lib/aws";
import { requireActorForProject } from "@/app/app/api/_lib/actor";
import { isGuestProjectId } from "@/app/app/api/_lib/guest-session";
import { getQuotaStateForActor, reserveQuota } from "@/app/app/api/_lib/quota";
import {
  allowedOutputFormatsForFile,
  sourceLabelFromFilenameOrContentType,
} from "@/app/app/_lib/conversion-support";
import {
  type ConversionJobInput,
  type ConvertBody,
  type ConvertResult,
  contentTypeFor,
  extForFormat,
  getErrorMessage,
  isImageOutput,
  isRawConvertibleStatus,
  nowIso,
  parseConversionJob,
  replaceExt,
  safeExecutionName,
  str,
  stripExt,
  toDbFileItem,
  isRecord,
} from "./_lib/convert-route-utils";

export const runtime = "nodejs";
const CONVERT_ENQUEUE_CONCURRENCY = 4;
const QUOTA_EXCEEDED_MESSAGE = "You've reached your conversion limit.";

type ProjectLookup = { status: string };

type PreparedJob = {
  job: ConversionJobInput;
  src: NonNullable<ReturnType<typeof toDbFileItem>>;
  sourceLabel: string;
};

function jsonError(status: number, error: string, detail?: string) {
  return NextResponse.json(
    { error, detail: process.env.NODE_ENV !== "production" ? detail : undefined },
    { status }
  );
}

async function fetchProjectById(
  tableName: string,
  userSub: string,
  projectId: string
): Promise<ProjectLookup | null> {
  const PK = `USER#${userSub}`;
  let lastKey: Record<string, unknown> | undefined;
  for (let page = 0; page < 50; page += 1) {
    const res = await ddbDoc.send(
      new QueryCommand({
        TableName: tableName,
        ConsistentRead: true,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
        ExpressionAttributeValues: { ":pk": PK, ":prefix": "PROJECT#", ":pid": projectId },
        FilterExpression: "projectId = :pid",
        ProjectionExpression: "projectId, #s",
        ExpressionAttributeNames: { "#s": "status" },
        ExclusiveStartKey: lastKey as never,
        Limit: 50,
      })
    );
    for (const it of res.Items ?? []) {
      if (!isRecord(it)) continue;
      if (str(it.projectId) !== projectId) continue;
      return { status: str(it.status) || "active" };
    }
    if (!res.LastEvaluatedKey) return null;
    lastKey = res.LastEvaluatedKey as unknown as Record<string, unknown>;
  }
  return null;
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

export async function POST(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const tableName = await getTableName();
    const { projectId } = await params;
    if (!projectId) return jsonError(400, "bad_request", "projectId is required");

    const actor = await requireActorForProject(projectId);
    const usingGuestProject = actor.kind === "guest" && isGuestProjectId(projectId);
    if (!usingGuestProject) {
      const project = await fetchProjectById(tableName, actor.sub, projectId);
      if (!project) return jsonError(404, "not_found", "project not found");
      if ((project.status || "active") !== "active") {
        return jsonError(410, "gone", "project is not active");
      }
    }

    let body: ConvertBody = {};
    try {
      body = (await req.json()) as ConvertBody;
    } catch {
      return jsonError(400, "bad_request", "invalid json");
    }

    if (!Array.isArray(body.conversions) || body.conversions.length === 0) {
      return jsonError(400, "bad_request", "conversions must be a non-empty array");
    }
    if (body.conversions.length > 25) {
      return jsonError(400, "bad_request", "too many conversions (max 25)");
    }

    const jobs = body.conversions
      .map(parseConversionJob)
      .filter((j): j is ConversionJobInput => j !== null);
    if (jobs.length === 0) return jsonError(400, "bad_request", "no valid conversion jobs");

    // Deduplicate by fileId (keep last)
    const seen = new Map<string, ConversionJobInput>();
    for (const j of jobs) seen.set(j.fileId, j);
    const dedupedJobs = Array.from(seen.values());

    const PK = `USER#${actor.sub}`;
    const prechecked = await mapLimit(dedupedJobs, CONVERT_ENQUEUE_CONCURRENCY, async (job) => {
      const { fileId, outputFormat } = job;
      const rawSK = `FILE#${projectId}#${fileId}`;

      const got = await ddbDoc.send(new GetCommand({ TableName: tableName, Key: { PK, SK: rawSK } }));
      const src = toDbFileItem(got.Item);
      if (!src) {
        return { type: "error" as const, result: { fileId, ok: false as const, error: "not found" } };
      }
      if (src.projectId !== projectId || src.userSub !== actor.sub) {
        return { type: "error" as const, result: { fileId, ok: false as const, error: "forbidden" } };
      }
      if (src.kind !== "raw") {
        return {
          type: "error" as const,
          result: { fileId, ok: false as const, error: "cannot convert an output file" },
        };
      }
      if (!isRawConvertibleStatus(src.status)) {
        return {
          type: "error" as const,
          result: {
            fileId,
            ok: false as const,
            error: `not convertible in status ${src.status}`,
          },
        };
      }

      const sourceLabel = sourceLabelFromFilenameOrContentType(src.filename, src.contentType);
      const allowedTargets = allowedOutputFormatsForFile(src.filename, src.contentType);
      if (!allowedTargets.includes(outputFormat)) {
        return {
          type: "error" as const,
          result: {
            fileId,
            ok: false as const,
            error: `unsupported conversion: ${sourceLabel} cannot be converted to ${outputFormat}`,
          },
        };
      }

      return {
        type: "prepared" as const,
        prepared: {
          job,
          src,
          sourceLabel,
        } satisfies PreparedJob,
      };
    });

    const preparedJobs: PreparedJob[] = [];
    const immediateResults: ConvertResult[] = [];
    for (const item of prechecked) {
      if (item.type === "prepared") preparedJobs.push(item.prepared);
      else immediateResults.push(item.result);
    }

    if (preparedJobs.length > 0) {
      const reserved = await reserveQuota(actor, preparedJobs.length);
      if (!reserved.ok) {
        const quotaBlockedResults: ConvertResult[] = preparedJobs.map((prepared) => ({
          fileId: prepared.job.fileId,
          ok: false,
          error: QUOTA_EXCEEDED_MESSAGE,
        }));
        return NextResponse.json(
          {
            ok: true,
            projectId,
            results: [...immediateResults, ...quotaBlockedResults],
            quota: reserved.stateAfter,
          },
          { status: 200 }
        );
      }
    }

    const enqueueResults =
      preparedJobs.length === 0
        ? ([] as ConvertResult[])
        : await (async () => {
            const stateMachineArn = await mustEnv("CONVERT_SFN_ARN");
            const outputBucketName = await mustEnv("OUTPUT_BUCKET");
            const sfn = new SFNClient({});

            return mapLimit(
              preparedJobs,
              CONVERT_ENQUEUE_CONCURRENCY,
              async (prepared): Promise<ConvertResult> => {
                const { job, src, sourceLabel } = prepared;
                const { fileId, outputFormat, quality, preset, resizePct } = job;
                const outFileId = crypto.randomUUID();
                const outSK = `FILE#${projectId}#${outFileId}`;
                const createdAt = nowIso();
                const srcIsPdf = sourceLabel === "PDF";
                const srcIsDocx = sourceLabel === "DOCX";
                const srcIsPages = sourceLabel === "PAGES";
                const isDocumentImageZip =
                  (srcIsPdf || srcIsDocx || srcIsPages) && isImageOutput(outputFormat);

                const outputFilename = isDocumentImageZip
                  ? `${stripExt(src.filename)}_${outputFormat.toLowerCase()}_pages.zip`
                  : replaceExt(src.filename, extForFormat(outputFormat));
                const outputKey = `private/${actor.sub}/${projectId}/output/${outFileId}/${outputFilename}`;

                const outItem = {
                  PK,
                  SK: outSK,
                  entity: "FILE" as const,
                  kind: "output" as const,
                  fileId: outFileId,
                  projectId,
                  userSub: actor.sub,
                  filename: outputFilename,
                  contentType: isDocumentImageZip ? "application/zip" : contentTypeFor(outputFormat),
                  sizeBytes: null as number | null,
                  bucket: outputBucketName,
                  key: outputKey,
                  status: "processing",
                  createdAt,
                  updatedAt: createdAt,
                  artifactType: "conversion" as const,
                  sourceFileId: fileId,
                  sourceContentType: src.contentType,
                  outputFormat,
                  quality,
                  preset,
                  resizePct,
                  packaging: isDocumentImageZip ? "zip" : "single",
                };

                try {
                  await ddbDoc.send(
                    new PutCommand({
                      TableName: tableName,
                      Item: outItem,
                      ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)",
                    })
                  );
                } catch (e: unknown) {
                  return { fileId, ok: false, error: `ddb put failed: ${getErrorMessage(e)}` };
                }

                try {
                  await sfn.send(
                    new StartExecutionCommand({
                      stateMachineArn,
                      name: safeExecutionName(projectId, outFileId),
                      input: JSON.stringify({
                        userSub: actor.sub,
                        projectId,
                        sourceFileId: fileId,
                        outputFileId: outFileId,
                        outputFormat,
                        quality,
                        preset,
                        resizePct,
                      }),
                    })
                  );
                } catch (e: unknown) {
                  const msg = getErrorMessage(e);
                  try {
                    await ddbDoc.send(
                      new PutCommand({
                        TableName: tableName,
                        Item: { ...outItem, status: "failed", updatedAt: nowIso(), errorMessage: msg },
                      })
                    );
                  } catch {
                    // ignore rollback-write failure
                  }
                  return { fileId, ok: false, error: `enqueue failed: ${msg}` };
                }

                return { fileId, ok: true, outputFileId: outFileId };
              }
            );
          })();

    const quota = await getQuotaStateForActor(actor);
    return NextResponse.json(
      { ok: true, projectId, results: [...immediateResults, ...enqueueResults], quota },
      { status: 200 }
    );
  } catch (e: unknown) {
    const msg = getErrorMessage(e);
    if (msg === "UNAUTHENTICATED" || msg === "INVALID_TOKEN") {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    console.error("POST convert error:", e);
    return jsonError(500, "server_error", msg);
  }
}

