import "server-only";

import { NextResponse } from "next/server";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getBookContentBucket } from "@/app/app/api/book/_lib/env";
import { putOpsMetric } from "@/app/app/api/book/_lib/cloudwatch-metrics";
import { readSearchIndex } from "./search-index-read-core";
import { logger } from "@/lib/logging/logger";

export const runtime = "nodejs";

const s3 = new S3Client({});

export async function GET() {
  const result = await readSearchIndex({
    fetchIndexBody: async () => {
      const bucket = await getBookContentBucket();
      const object = await s3.send(
        new GetObjectCommand({
          Bucket: bucket,
          Key: "book-content/library/search-index.json",
        }),
      );
      return object.Body?.transformToString("utf-8");
    },
    logError: (error) => {
      logger.error("search_index_read_failed", { err: error });
    },
    emitOpsFailure: () =>
      putOpsMetric("OpsFailure", 1, { context: "search_index_read_failed" }),
  });

  if (result.kind === "ok") {
    return new NextResponse(result.body, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    });
  }

  // Empty and failed both degrade to an empty index with a short cache —
  // the response shape is native-contract-locked (search-index.get) — but a
  // backend failure is logged + metered above instead of passing silently.
  return NextResponse.json([], {
    headers: { "Cache-Control": "public, max-age=60" },
  });
}
