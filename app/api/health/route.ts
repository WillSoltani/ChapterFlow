import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public, unauthenticated health endpoint used by the deploy pipeline's
 * post-deploy gate (and any uptime check).
 *
 * It lives at top-level `/api/health` — NOT under `/app`, `/book`, or
 * `/dashboard` — so it sits OUTSIDE middleware.ts's auth matcher and is
 * reachable without a Cognito session.
 *
 * `GET /api/health` is dependency-free and returns 200 whenever the Lambda is
 * serving requests — that is exactly what the deploy health gate asserts.
 *
 * `GET /api/health?deep=1` additionally probes DynamoDB reachability, but is
 * non-throwing and STILL returns HTTP 200 (the probe result is reported in the
 * body) so a transient DB blip never false-fails a deploy. Use it for manual
 * diagnostics, not as the blocking gate.
 */
export async function GET(req: Request): Promise<NextResponse> {
  const url = new URL(req.url);
  const deep = url.searchParams.get("deep") === "1";

  const body: {
    status: "ok" | "degraded";
    env: string;
    commit: string | null;
    time: string;
    checks?: Record<string, boolean>;
  } = {
    status: "ok",
    env: process.env.CHAPTERFLOW_ENV ?? "unknown",
    commit: process.env.CHAPTERFLOW_COMMIT_SHA ?? null,
    time: new Date().toISOString(),
  };

  if (deep) {
    const dynamo = await probeDynamo();
    body.checks = { dynamo };
    if (!dynamo) body.status = "degraded";
  }

  return NextResponse.json(body, {
    status: 200,
    headers: { "cache-control": "no-store" },
  });
}

async function probeDynamo(): Promise<boolean> {
  const tableName = process.env.BOOK_TABLE_NAME;
  if (!tableName) return false;
  try {
    const { DynamoDBClient, DescribeTableCommand } = await import(
      "@aws-sdk/client-dynamodb"
    );
    const client = new DynamoDBClient({
      region: process.env.AWS_REGION ?? "us-east-1",
    });
    await client.send(new DescribeTableCommand({ TableName: tableName }));
    return true;
  } catch {
    return false;
  }
}
