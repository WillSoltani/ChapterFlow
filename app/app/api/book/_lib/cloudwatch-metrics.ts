import "server-only";

import {
  CloudWatchClient,
  GetMetricStatisticsCommand,
  PutMetricDataCommand,
  type Datapoint,
  type MetricDatum,
} from "@aws-sdk/client-cloudwatch";
import { DescribeTableCommand, DynamoDBClient } from "@aws-sdk/client-dynamodb";

const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1";

let cwClient: CloudWatchClient | null = null;
let ddbMetaClient: DynamoDBClient | null = null;

function getCw(): CloudWatchClient {
  if (!cwClient) cwClient = new CloudWatchClient({ region: REGION });
  return cwClient;
}

function getDdbMeta(): DynamoDBClient {
  if (!ddbMetaClient) ddbMetaClient = new DynamoDBClient({ region: REGION });
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
 */
export async function putOpsMetric(
  metricName: string,
  value = 1,
  dimensions?: Record<string, string>
): Promise<void> {
  try {
    const timestamp = new Date();
    const metricData: MetricDatum[] = [
      // Dimensionless rollup — the series the CloudWatch alarms watch.
      { MetricName: metricName, Value: value, Unit: "Count", Timestamp: timestamp },
    ];
    if (dimensions && Object.keys(dimensions).length > 0) {
      // Dimensioned copy — for slicing by cause in the CloudWatch console.
      metricData.push({
        MetricName: metricName,
        Value: value,
        Unit: "Count",
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
    console.error("cloudwatch_put_metric_failed", {
      metricName,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function sumDatapoints(points: Datapoint[]): number {
  return points.reduce((acc, p) => acc + (p.Sum ?? 0), 0);
}

function extractStat(points: Datapoint[], field: keyof Datapoint): number[] {
  return points
    .map((p) => {
      const v = p[field];
      return typeof v === "number" ? v : 0;
    })
    .sort((a, b) => a - b);
}

function quantile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.floor((p / 100) * sorted.length)),
  );
  return sorted[idx];
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
    Period: 3600, // 1h buckets
  };

  try {
    const [invRes, errRes, thRes, durRes] = await Promise.all([
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
    ]);

    const invocations = sumDatapoints(invRes.Datapoints ?? []);
    const errors = sumDatapoints(errRes.Datapoints ?? []);
    const throttles = sumDatapoints(thRes.Datapoints ?? []);

    // Duration percentiles come in ExtendedStatistics per datapoint
    const durPoints = durRes.Datapoints ?? [];
    const p50s = durPoints
      .map((p) => {
        const ext = p.ExtendedStatistics as Record<string, number> | undefined;
        return ext?.p50 ?? 0;
      })
      .sort((a, b) => a - b);
    const p95s = durPoints
      .map((p) => {
        const ext = p.ExtendedStatistics as Record<string, number> | undefined;
        return ext?.p95 ?? 0;
      })
      .sort((a, b) => a - b);
    const p99s = durPoints
      .map((p) => {
        const ext = p.ExtendedStatistics as Record<string, number> | undefined;
        return ext?.p99 ?? 0;
      })
      .sort((a, b) => a - b);

    return {
      functionName,
      invocations: Math.round(invocations),
      errors: Math.round(errors),
      throttles: Math.round(throttles),
      durationP50Ms: Math.round(quantile(p50s, 50)),
      durationP95Ms: Math.round(quantile(p95s, 50)),
      durationP99Ms: Math.round(quantile(p99s, 50)),
      coldStarts: 0, // placeholder — requires init duration metric parsing
    };
  } catch (err) {
    console.warn(`[cloudwatch] getLambdaHealth failed for ${functionName}:`, err);
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
        console.warn(`[cloudwatch] describe ${tableName} failed:`, err);
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
    console.warn(`[cloudwatch] getS3BucketSize failed for ${bucketName}:`, err);
    return 0;
  }
}

// ─── Cost projections ────────────────────────────────────────────────────────

export type CostEstimate = {
  dynamoDBMonthlyUsd: number;
  lambdaMonthlyUsd: number;
  s3MonthlyUsd: number;
  totalMonthlyUsd: number;
};

/**
 * Rough cost projection using on-demand AWS pricing constants.
 * Assumes ongoing daily usage matches last 24h.
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
  const daysPerMonth = 30;

  // DynamoDB on-demand
  // Writes: $1.25 per million WCU-equivalent requests
  // Reads: $0.25 per million RCU-equivalent
  // Storage: $0.25 per GB-month
  const dynamoWritesMonthly = (input.dynamoWritesLast24h ?? 0) * daysPerMonth;
  const dynamoReadsMonthly = (input.dynamoReadsLast24h ?? 0) * daysPerMonth;
  const dynamoStorageGB = input.dynamoTableSizeBytes / (1024 ** 3);
  const dynamoDBMonthlyUsd =
    (dynamoWritesMonthly / 1_000_000) * 1.25 +
    (dynamoReadsMonthly / 1_000_000) * 0.25 +
    dynamoStorageGB * 0.25;

  // Lambda: $0.20 per million requests + $0.0000166667 per GB-second
  const invocationsMonthly = input.lambdaInvocationsLast24h * daysPerMonth;
  const avgDurationSec = input.lambdaAvgDurationMs / 1000;
  const gbSeconds = invocationsMonthly * avgDurationSec * (input.lambdaMemoryMB / 1024);
  const lambdaMonthlyUsd =
    (invocationsMonthly / 1_000_000) * 0.2 + gbSeconds * 0.0000166667;

  // S3 standard: $0.023 per GB-month
  const s3GB = input.s3TotalBytes / (1024 ** 3);
  const s3MonthlyUsd = s3GB * 0.023;

  const totalMonthlyUsd = dynamoDBMonthlyUsd + lambdaMonthlyUsd + s3MonthlyUsd;

  return {
    dynamoDBMonthlyUsd: round2(dynamoDBMonthlyUsd),
    lambdaMonthlyUsd: round2(lambdaMonthlyUsd),
    s3MonthlyUsd: round2(s3MonthlyUsd),
    totalMonthlyUsd: round2(totalMonthlyUsd),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
