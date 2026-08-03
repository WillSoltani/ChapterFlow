import "server-only";

import {
  CloudWatchClient,
  GetMetricStatisticsCommand,
  PutMetricDataCommand,
  type Datapoint,
  type MetricDatum,
} from "@aws-sdk/client-cloudwatch";
import { DescribeTableCommand, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { logger } from "@/lib/logging/logger";
import { awsClientConfig } from "@/app/app/api/_lib/aws";

const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1";

let cwClient: CloudWatchClient | null = null;
let ddbMetaClient: DynamoDBClient | null = null;

function getCw(): CloudWatchClient {
  if (!cwClient) cwClient = new CloudWatchClient({ region: REGION, ...awsClientConfig });
  return cwClient;
}

function getDdbMeta(): DynamoDBClient {
  if (!ddbMetaClient) ddbMetaClient = new DynamoDBClient({ region: REGION, ...awsClientConfig });
  return ddbMetaClient;
}

/** Namespace for custom operational metrics that CloudWatch alarms watch. */
export const OPS_METRIC_NAMESPACE = "ChapterFlow/Ops";

/**
 * Emit a custom CloudWatch metric for an operational event (e.g. a Stripe
 * cancellation failure during account deletion). Fire-and-forget: never throws,
 * so a metrics outage can't break the calling request. Requires the Lambda role
 * to hold `cloudwatch:PutMetricData` (see the backend CDK stack).
 *
 * IMPORTANT — always emits a DIMENSIONLESS datapoint, because CloudWatch stores
 * dimensioned datapoints under their exact dimension set and does NOT roll them
 * up into the `{namespace, metricName}` series. The ops alarms (OpsFailure,
 * StripeWebhookFailure) watch the dimensionless series, so a dimensions-only
 * emit would make those alarms silently never fire. When `dimensions` are
 * supplied we additionally emit a dimensioned copy for per-cause breakdown in
 * the console — but the alarm-bearing rollup is always present.
 *
 * `unit` defaults to "Count"; pass "None" for dollar values, "Milliseconds" for
 * latencies, etc. It is applied to BOTH the rollup and the dimensioned copy.
 */
export async function putOpsMetric(
  metricName: string,
  value = 1,
  dimensions?: Record<string, string>,
  unit: MetricDatum["Unit"] = "Count"
): Promise<void> {
  try {
    const timestamp = new Date();
    const metricData: MetricDatum[] = [
      // Dimensionless rollup — the series the CloudWatch alarms watch.
      { MetricName: metricName, Value: value, Unit: unit, Timestamp: timestamp },
    ];
    if (dimensions && Object.keys(dimensions).length > 0) {
      // Dimensioned copy — for slicing by cause in the CloudWatch console.
      metricData.push({
        MetricName: metricName,
        Value: value,
        Unit: unit,
        Timestamp: timestamp,
        Dimensions: Object.entries(dimensions).map(([Name, Value]) => ({ Name, Value })),
      });
    }
    await getCw().send(
      new PutMetricDataCommand({
        Namespace: OPS_METRIC_NAMESPACE,
        MetricData: metricData,
      })
    );
  } catch (error) {
    logger.error("cloudwatch_put_metric_failed", {
      metricName,
      err: error,
    });
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function sumDatapoints(points: Datapoint[]): number {
  return points.reduce((acc, p) => acc + (p.Sum ?? 0), 0);
}

/** Read an ExtendedStatistics percentile (e.g. "p95") from the first datapoint. */
function extPercentile(point: Datapoint | undefined, key: string): number {
  if (!point) return 0;
  const ext = point.ExtendedStatistics as Record<string, number> | undefined;
  const v = ext?.[key];
  return typeof v === "number" ? v : 0;
}

// ─── Lambda metrics ──────────────────────────────────────────────────────────

export type LambdaHealth = {
  functionName: string;
  invocations: number;
  errors: number;
  throttles: number;
  durationP50Ms: number;
  durationP95Ms: number;
  durationP99Ms: number;
  coldStarts: number;
};

/**
 * Get 24-hour Lambda health for a function. All queries run in parallel.
 * Gracefully returns zeros if CloudWatch denies or times out.
 *
 * Percentiles are fetched as a SINGLE 24h-period datapoint (Period: 86400) so
 * CloudWatch computes the true 24h p50/p95/p99 over the whole window. Fetching
 * 1h buckets and then aggregating the per-bucket percentiles client-side would
 * under-report tail latency: the median of 24 hourly p95s is far below the true
 * 24h p95. Counts (Invocations/Errors/Throttles) Sum over the same single
 * window. coldStarts is the count of InitDuration samples in the window.
 */
export async function getLambdaHealth(functionName: string): Promise<LambdaHealth> {
  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000);
  const cw = getCw();

  const baseInput = {
    Namespace: "AWS/Lambda",
    Dimensions: [{ Name: "FunctionName", Value: functionName }],
    StartTime: startTime,
    EndTime: endTime,
    Period: 86400, // single 24h window — CloudWatch computes the true window percentiles
  };

  try {
    const [invRes, errRes, thRes, durRes, initRes] = await Promise.all([
      cw.send(new GetMetricStatisticsCommand({ ...baseInput, MetricName: "Invocations", Statistics: ["Sum"] })),
      cw.send(new GetMetricStatisticsCommand({ ...baseInput, MetricName: "Errors", Statistics: ["Sum"] })),
      cw.send(new GetMetricStatisticsCommand({ ...baseInput, MetricName: "Throttles", Statistics: ["Sum"] })),
      cw.send(
        new GetMetricStatisticsCommand({
          ...baseInput,
          MetricName: "Duration",
          Statistics: ["Average", "Maximum", "Minimum"],
          ExtendedStatistics: ["p50", "p95", "p99"],
        }),
      ),
      // InitDuration is only emitted on a cold start, so its SampleCount over the
      // window is the number of cold starts.
      cw.send(
        new GetMetricStatisticsCommand({
          ...baseInput,
          MetricName: "InitDuration",
          Statistics: ["SampleCount"],
        }),
      ),
    ]);

    const invocations = sumDatapoints(invRes.Datapoints ?? []);
    const errors = sumDatapoints(errRes.Datapoints ?? []);
    const throttles = sumDatapoints(thRes.Datapoints ?? []);
    const coldStarts = (initRes.Datapoints ?? []).reduce(
      (acc, p) => acc + (p.SampleCount ?? 0),
      0,
    );

    // A single 86400 window yields at most one Duration datapoint carrying the
    // true 24h p50/p95/p99 (no client-side aggregation needed).
    const durPoint = (durRes.Datapoints ?? [])[0];

    return {
      functionName,
      invocations: Math.round(invocations),
      errors: Math.round(errors),
      throttles: Math.round(throttles),
      durationP50Ms: Math.round(extPercentile(durPoint, "p50")),
      durationP95Ms: Math.round(extPercentile(durPoint, "p95")),
      durationP99Ms: Math.round(extPercentile(durPoint, "p99")),
      coldStarts: Math.round(coldStarts),
    };
  } catch (err) {
    logger.warn("cloudwatch_get_lambda_health_failed", { functionName, err });
    return {
      functionName,
      invocations: 0,
      errors: 0,
      throttles: 0,
      durationP50Ms: 0,
      durationP95Ms: 0,
      durationP99Ms: 0,
      coldStarts: 0,
    };
  }
}

// ─── DynamoDB metrics ────────────────────────────────────────────────────────

export type DdbHealth = {
  tableName: string;
  itemCount: number;
  tableSizeBytes: number;
  throttlesLast24h: number;
};

export async function getDdbHealth(tableName: string): Promise<DdbHealth> {
  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000);

  const [tableRes, throttleRes] = await Promise.all([
    getDdbMeta()
      .send(new DescribeTableCommand({ TableName: tableName }))
      .catch((err) => {
        logger.warn("cloudwatch_describe_table_failed", { tableName, err });
        return null;
      }),
    getCw()
      .send(
        new GetMetricStatisticsCommand({
          Namespace: "AWS/DynamoDB",
          MetricName: "ThrottledRequests",
          Dimensions: [{ Name: "TableName", Value: tableName }],
          StartTime: startTime,
          EndTime: endTime,
          Period: 3600,
          Statistics: ["Sum"],
        }),
      )
      .catch(() => null),
  ]);

  const throttles = sumDatapoints((throttleRes?.Datapoints ?? []) as Datapoint[]);
  const tbl = tableRes?.Table;

  return {
    tableName,
    itemCount: tbl?.ItemCount ?? 0,
    tableSizeBytes: tbl?.TableSizeBytes ?? 0,
    throttlesLast24h: Math.round(throttles),
  };
}

// ─── S3 metrics ──────────────────────────────────────────────────────────────

export async function getS3BucketSize(bucketName: string): Promise<number> {
  try {
    const endTime = new Date();
    // S3 BucketSizeBytes is a daily metric — look back 2 days
    const startTime = new Date(endTime.getTime() - 2 * 24 * 60 * 60 * 1000);
    const res = await getCw().send(
      new GetMetricStatisticsCommand({
        Namespace: "AWS/S3",
        MetricName: "BucketSizeBytes",
        Dimensions: [
          { Name: "BucketName", Value: bucketName },
          { Name: "StorageType", Value: "StandardStorage" },
        ],
        StartTime: startTime,
        EndTime: endTime,
        Period: 86400,
        Statistics: ["Average"],
      }),
    );
    // Use the most recent datapoint
    const points = (res.Datapoints ?? []) as Datapoint[];
    points.sort((a, b) => (b.Timestamp?.getTime() ?? 0) - (a.Timestamp?.getTime() ?? 0));
    return Math.round(points[0]?.Average ?? 0);
  } catch (err) {
    logger.warn("cloudwatch_get_s3_bucket_size_failed", { bucketName, err });
    return 0;
  }
}

// ─── Cost projections ────────────────────────────────────────────────────────

/**
 * On-demand AWS pricing constants used by {@link estimateMonthlyCost}.
 *
 * SINGLE SOURCE OF TRUTH for the cost dashboard. These are list prices and
 * drift over time and across regions, so they are tagged with the region and
 * the date they were captured. Update `pricingAsOf` whenever a value changes.
 *
 *   region:      us-east-1 (N. Virginia)
 *   as-of:       2025-06-01
 *   source:      https://aws.amazon.com/dynamodb/pricing/on-demand/
 *                https://aws.amazon.com/lambda/pricing/
 *                https://aws.amazon.com/s3/pricing/
 */
export const AWS_PRICING = {
  region: "us-east-1",
  pricingAsOf: "2025-06-01",
  /** DynamoDB on-demand write request units, USD per million. */
  dynamoWriteUsdPerMillion: 1.25,
  /** DynamoDB on-demand read request units, USD per million. */
  dynamoReadUsdPerMillion: 0.25,
  /** DynamoDB stored data, USD per GB-month. */
  dynamoStorageUsdPerGbMonth: 0.25,
  /** Lambda requests, USD per million. */
  lambdaRequestUsdPerMillion: 0.2,
  /** Lambda compute, USD per GB-second. */
  lambdaGbSecondUsd: 0.0000166667,
  /** S3 Standard storage, USD per GB-month. */
  s3StorageUsdPerGbMonth: 0.023,
  /** Days assumed per month when extrapolating last-24h usage. */
  daysPerMonth: 30,
} as const;

export type CostEstimate = {
  dynamoDBMonthlyUsd: number;
  lambdaMonthlyUsd: number;
  s3MonthlyUsd: number;
  totalMonthlyUsd: number;
  /** Region + date the pricing constants were captured (see {@link AWS_PRICING}). */
  pricingBasis: string;
  /**
   * True when read/write request counts were NOT supplied, so the DynamoDB
   * figure reflects STORAGE ONLY (request charges are omitted and the real
   * DynamoDB cost is higher). Callers should surface this caveat.
   */
  dynamoDBStorageOnly: boolean;
};

/**
 * Rough cost projection using on-demand AWS pricing constants.
 * Assumes ongoing daily usage matches last 24h.
 *
 * If `dynamoWritesLast24h`/`dynamoReadsLast24h` are omitted, the DynamoDB
 * estimate covers storage only and `dynamoDBStorageOnly` is set so the caller
 * can flag that request charges are missing (rather than silently reporting a
 * too-low number).
 */
export function estimateMonthlyCost(input: {
  dynamoWritesLast24h?: number;
  dynamoReadsLast24h?: number;
  dynamoTableSizeBytes: number;
  lambdaInvocationsLast24h: number;
  lambdaAvgDurationMs: number;
  lambdaMemoryMB: number;
  s3TotalBytes: number;
}): CostEstimate {
  const { daysPerMonth } = AWS_PRICING;

  // DynamoDB on-demand. Request counts are optional; when absent we report
  // storage only and flag it via `dynamoDBStorageOnly`.
  const dynamoDBStorageOnly =
    input.dynamoWritesLast24h === undefined && input.dynamoReadsLast24h === undefined;
  const dynamoWritesMonthly = (input.dynamoWritesLast24h ?? 0) * daysPerMonth;
  const dynamoReadsMonthly = (input.dynamoReadsLast24h ?? 0) * daysPerMonth;
  const dynamoStorageGB = input.dynamoTableSizeBytes / (1024 ** 3);
  const dynamoDBMonthlyUsd =
    (dynamoWritesMonthly / 1_000_000) * AWS_PRICING.dynamoWriteUsdPerMillion +
    (dynamoReadsMonthly / 1_000_000) * AWS_PRICING.dynamoReadUsdPerMillion +
    dynamoStorageGB * AWS_PRICING.dynamoStorageUsdPerGbMonth;

  // Lambda: per-million requests + per GB-second compute.
  const invocationsMonthly = input.lambdaInvocationsLast24h * daysPerMonth;
  const avgDurationSec = input.lambdaAvgDurationMs / 1000;
  const gbSeconds = invocationsMonthly * avgDurationSec * (input.lambdaMemoryMB / 1024);
  const lambdaMonthlyUsd =
    (invocationsMonthly / 1_000_000) * AWS_PRICING.lambdaRequestUsdPerMillion +
    gbSeconds * AWS_PRICING.lambdaGbSecondUsd;

  // S3 standard.
  const s3GB = input.s3TotalBytes / (1024 ** 3);
  const s3MonthlyUsd = s3GB * AWS_PRICING.s3StorageUsdPerGbMonth;

  const totalMonthlyUsd = dynamoDBMonthlyUsd + lambdaMonthlyUsd + s3MonthlyUsd;

  return {
    dynamoDBMonthlyUsd: round2(dynamoDBMonthlyUsd),
    lambdaMonthlyUsd: round2(lambdaMonthlyUsd),
    s3MonthlyUsd: round2(s3MonthlyUsd),
    totalMonthlyUsd: round2(totalMonthlyUsd),
    pricingBasis: `${AWS_PRICING.region} pricing as of ${AWS_PRICING.pricingAsOf}`,
    dynamoDBStorageOnly,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
