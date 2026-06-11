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
 * serving requests — that is exactly what the BLOCKING deploy health gate
 * asserts. It must stay lightweight, so every dependency probe below is
 * dynamically imported and only runs on the deep path.
 *
 * `GET /api/health?deep=1` additionally probes the subsystems the app depends
 * on — DynamoDB, the published catalog, S3 content storage, billing/Stripe
 * config, and Cognito auth config. It is non-throwing and STILL returns HTTP
 * 200 (per-check results are in the body, `status: "degraded"` if any fail) so
 * a transient dependency blip never false-fails a deploy. Use it as a
 * non-blocking post-deploy smoke check and for readiness monitoring.
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
    const [dynamo, catalog, content, billing] = await Promise.all([
      probeDynamo(),
      probeCatalog(),
      probeContent(),
      probeBilling(),
    ]);
    const auth = probeAuthConfig();
    body.checks = { dynamo, catalog, content, billing, auth };
    if (!dynamo || !catalog || !content || !billing || !auth) {
      body.status = "degraded";
    }
  }

  return NextResponse.json(body, {
    status: 200,
    headers: { "cache-control": "no-store" },
  });
}

const REGION = process.env.AWS_REGION ?? "us-east-1";

/** DynamoDB reachability — the operational table responds to DescribeTable. */
async function probeDynamo(): Promise<boolean> {
  const tableName = process.env.BOOK_TABLE_NAME;
  if (!tableName) return false;
  try {
    const { DynamoDBClient, DescribeTableCommand } = await import(
      "@aws-sdk/client-dynamodb"
    );
    const client = new DynamoDBClient({ region: REGION });
    await client.send(new DescribeTableCommand({ TableName: tableName }));
    return true;
  } catch {
    return false;
  }
}

/**
 * Catalog API — the published library list builds end-to-end (reads the
 * BOOKCATALOG partition from DynamoDB + the presentation index from S3).
 * Returning an array (even empty) means the read path is healthy.
 */
async function probeCatalog(): Promise<boolean> {
  const tableName = process.env.BOOK_TABLE_NAME;
  const contentBucket = process.env.BOOK_CONTENT_BUCKET;
  if (!tableName || !contentBucket) return false;
  try {
    const { listPublishedLibraryCatalog } = await import(
      "@/app/app/api/book/_lib/library-catalog"
    );
    const books = await listPublishedLibraryCatalog({ tableName, contentBucket });
    return Array.isArray(books);
  } catch {
    return false;
  }
}

/**
 * Content availability — the S3 content bucket is reachable. Uses
 * GetBucketLocation (which the Lambda role is granted via AppS3MetadataAccess),
 * so this never false-negatives on a missing s3:ListBucket permission.
 */
async function probeContent(): Promise<boolean> {
  const bucket = process.env.BOOK_CONTENT_BUCKET;
  if (!bucket) return false;
  try {
    const { S3Client, GetBucketLocationCommand } = await import(
      "@aws-sdk/client-s3"
    );
    const client = new S3Client({ region: REGION });
    await client.send(new GetBucketLocationCommand({ Bucket: bucket }));
    return true;
  } catch {
    return false;
  }
}

/**
 * Billing config — the Stripe secret + webhook secret are configured and the
 * central pricing config is structurally valid. Reads process.env directly
 * (secrets are deployed as Lambda env vars), so there is no Stripe API call and
 * no SSM round-trip — keeping the probe fast and network-free.
 */
async function probeBilling(): Promise<boolean> {
  if (
    !process.env.BOOK_STRIPE_SECRET_KEY ||
    !process.env.BOOK_STRIPE_WEBHOOK_SECRET
  ) {
    return false;
  }
  try {
    const pricing = await import("@/lib/pricing");
    return (
      typeof pricing.PRICING?.monthlyAmount === "number" &&
      Boolean(pricing.BILLING_CURRENCY)
    );
  } catch {
    return false;
  }
}

/**
 * Auth config — the Cognito OAuth settings sign-in depends on are present.
 * A config-presence check (no network), since a JWKS fetch would add an
 * external failure mode to a readiness probe.
 */
function probeAuthConfig(): boolean {
  return Boolean(
    process.env.COGNITO_DOMAIN &&
      process.env.COGNITO_CLIENT_ID &&
      process.env.COGNITO_USER_POOL_ID,
  );
}
