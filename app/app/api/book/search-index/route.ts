import "server-only";

import { NextResponse } from "next/server";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getBookContentBucket } from "@/app/app/api/book/_lib/env";

export const runtime = "nodejs";

const s3 = new S3Client({});

export async function GET() {
  try {
    const bucket = await getBookContentBucket();
    const result = await s3.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: "book-content/library/search-index.json",
      }),
    );

    const body = await result.Body?.transformToString("utf-8");
    if (!body) {
      return NextResponse.json([], {
        headers: { "Cache-Control": "public, max-age=60" },
      });
    }

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    });
  } catch {
    return NextResponse.json([], {
      status: 200,
      headers: { "Cache-Control": "public, max-age=60" },
    });
  }
}
