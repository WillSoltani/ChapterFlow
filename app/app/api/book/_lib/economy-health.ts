import "server-only";

// Implements §9.3 — Economy health monitoring.
// Designed to run as a scheduled Lambda function (weekly).
// Computes metrics from ENGAGEMENT and LEDGER records.

import { QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { ddbDoc } from "@/app/app/api/_lib/aws";

// ── Types ───────────────────────────────────────────────────────────────────

export type EconomyHealthMetrics = {
  computedAt: string;
  /** Average balance across all users with engagement records */
  averageBalance: number;
  /** Median balance */
  medianBalance: number;
  /** (monthly spend / monthly gross earned) as percentage */
  spendRate: number;
  /** Gini coefficient of balance distribution (0 = perfect equality, 1 = total inequality) */
  balanceGini: number;
  /** Total IP earned system-wide in the measurement period */
  grossFaucet: number;
  /** Total IP spent system-wide in the measurement period */
  grossSink: number;
  /** Number of users with engagement records */
  totalUsers: number;
  /** Number of active users (earned or spent in the period) */
  activeUsers: number;
};

export type EconomyHealthAlert = {
  metric: string;
  value: number;
  threshold: number;
  severity: "warning" | "alert";
  message: string;
};

// ── Threshold definitions (§9.3) ────────────────────────────────────────────

const THRESHOLDS = {
  averageBalance: { warningLow: 300, warningHigh: 2000, alertLow: 200, alertHigh: 3000 },
  medianBalance: { warningLow: 200, warningHigh: 1800, alertLow: 100, alertHigh: 2500 },
  spendRate: { warningLow: 30, warningHigh: 80, alertLow: 20, alertHigh: 90 },
  balanceGini: { warningHigh: 0.7, alertHigh: 0.8 },
} as const;

// ── Metric computation ──────────────────────────────────────────────────────

/**
 * Compute economy health metrics by scanning ENGAGEMENT records.
 * This is designed to run as a batch job, not in a request handler.
 *
 * @param tableName The DynamoDB table name
 * @param periodDays Number of days for the measurement period (default 30)
 */
export async function computeEconomyHealth(
  tableName: string,
  periodDays = 30
): Promise<EconomyHealthMetrics> {
  const now = new Date();
  const periodStart = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000).toISOString();

  // Scan engagement records to get balance distribution.
  // In production, this should use a GSI or materialized view for efficiency.
  // Bound the scan with a page cap + Limit (like estimatePeriodFlows below) so it
  // cannot run unbounded inside a request handler: an uncapped FilterExpression
  // scan reads every item in the table and can exceed the Lambda timeout.
  const balances: number[] = [];
  let lastEvaluatedKey: Record<string, unknown> | undefined;

  const maxPages = 10;
  let pages = 0;

  do {
    const res = await ddbDoc.send(
      new ScanCommand({
        TableName: tableName,
        FilterExpression: "entity = :entity",
        ExpressionAttributeValues: { ":entity": "BOOK_USER_ENGAGEMENT" },
        ProjectionExpression: "points, lifetimeEarned, lifetimeSpent, updatedAt",
        ExclusiveStartKey: lastEvaluatedKey,
        Limit: 1000,
      })
    );

    for (const item of res.Items ?? []) {
      const points = typeof item.points === "number" ? Math.max(0, item.points) : 0;
      balances.push(points);
    }

    lastEvaluatedKey = res.LastEvaluatedKey as Record<string, unknown> | undefined;
    pages++;
  } while (lastEvaluatedKey && pages < maxPages);

  if (balances.length === 0) {
    return {
      computedAt: now.toISOString(),
      averageBalance: 0,
      medianBalance: 0,
      spendRate: 0,
      balanceGini: 0,
      grossFaucet: 0,
      grossSink: 0,
      totalUsers: 0,
      activeUsers: 0,
    };
  }

  // Sort for median and Gini
  balances.sort((a, b) => a - b);

  const totalUsers = balances.length;
  const sum = balances.reduce((a, b) => a + b, 0);
  const averageBalance = Math.round(sum / totalUsers);
  const medianBalance = balances[Math.floor(totalUsers / 2)];

  // Gini coefficient
  const gini = computeGini(balances);

  // Estimate faucet/sink from ledger records in the period
  // This is approximate — a full implementation would scan ledger records
  const { grossFaucet, grossSink, activeUsers } = await estimatePeriodFlows(
    tableName,
    periodStart
  );

  const spendRate = grossFaucet > 0 ? Math.round((grossSink / grossFaucet) * 100) : 0;

  return {
    computedAt: now.toISOString(),
    averageBalance,
    medianBalance,
    spendRate,
    balanceGini: Math.round(gini * 100) / 100,
    grossFaucet,
    grossSink,
    totalUsers,
    activeUsers,
  };
}

// ── Alert generation ────────────────────────────────────────────────────────

export function generateAlerts(metrics: EconomyHealthMetrics): EconomyHealthAlert[] {
  const alerts: EconomyHealthAlert[] = [];

  // Average balance
  if (metrics.averageBalance < THRESHOLDS.averageBalance.alertLow) {
    alerts.push({
      metric: "averageBalance",
      value: metrics.averageBalance,
      threshold: THRESHOLDS.averageBalance.alertLow,
      severity: "alert",
      message: `Average balance (${metrics.averageBalance} IP) is critically low. Investigate earning/spending imbalance.`,
    });
  } else if (metrics.averageBalance < THRESHOLDS.averageBalance.warningLow) {
    alerts.push({
      metric: "averageBalance",
      value: metrics.averageBalance,
      threshold: THRESHOLDS.averageBalance.warningLow,
      severity: "warning",
      message: `Average balance (${metrics.averageBalance} IP) is below healthy range.`,
    });
  } else if (metrics.averageBalance > THRESHOLDS.averageBalance.alertHigh) {
    alerts.push({
      metric: "averageBalance",
      value: metrics.averageBalance,
      threshold: THRESHOLDS.averageBalance.alertHigh,
      severity: "alert",
      message: `Average balance (${metrics.averageBalance} IP) exceeds alert threshold. Consider activating soft-decay.`,
    });
  } else if (metrics.averageBalance > THRESHOLDS.averageBalance.warningHigh) {
    alerts.push({
      metric: "averageBalance",
      value: metrics.averageBalance,
      threshold: THRESHOLDS.averageBalance.warningHigh,
      severity: "warning",
      message: `Average balance (${metrics.averageBalance} IP) is above healthy range.`,
    });
  }

  // Spend rate
  if (metrics.spendRate < THRESHOLDS.spendRate.alertLow) {
    alerts.push({
      metric: "spendRate",
      value: metrics.spendRate,
      threshold: THRESHOLDS.spendRate.alertLow,
      severity: "alert",
      message: `Spend rate (${metrics.spendRate}%) is critically low. Add sinks or increase sink appeal.`,
    });
  } else if (metrics.spendRate < THRESHOLDS.spendRate.warningLow) {
    alerts.push({
      metric: "spendRate",
      value: metrics.spendRate,
      threshold: THRESHOLDS.spendRate.warningLow,
      severity: "warning",
      message: `Spend rate (${metrics.spendRate}%) is below healthy range.`,
    });
  } else if (metrics.spendRate > THRESHOLDS.spendRate.alertHigh) {
    alerts.push({
      metric: "spendRate",
      value: metrics.spendRate,
      threshold: THRESHOLDS.spendRate.alertHigh,
      severity: "alert",
      message: `Spend rate (${metrics.spendRate}%) is critically high. Check for exploits.`,
    });
  }

  // Gini
  if (metrics.balanceGini > THRESHOLDS.balanceGini.alertHigh) {
    alerts.push({
      metric: "balanceGini",
      value: metrics.balanceGini,
      threshold: THRESHOLDS.balanceGini.alertHigh,
      severity: "alert",
      message: `Balance inequality (Gini: ${metrics.balanceGini}) is extreme. Investigate top earners.`,
    });
  } else if (metrics.balanceGini > THRESHOLDS.balanceGini.warningHigh) {
    alerts.push({
      metric: "balanceGini",
      value: metrics.balanceGini,
      threshold: THRESHOLDS.balanceGini.warningHigh,
      severity: "warning",
      message: `Balance inequality (Gini: ${metrics.balanceGini}) is above healthy range.`,
    });
  }

  return alerts;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function computeGini(sortedValues: number[]): number {
  const n = sortedValues.length;
  if (n === 0) return 0;
  const sum = sortedValues.reduce((a, b) => a + b, 0);
  if (sum === 0) return 0;

  let numerator = 0;
  for (let i = 0; i < n; i++) {
    numerator += (2 * (i + 1) - n - 1) * sortedValues[i];
  }
  return numerator / (n * sum);
}

async function estimatePeriodFlows(
  tableName: string,
  periodStart: string
): Promise<{ grossFaucet: number; grossSink: number; activeUsers: number }> {
  // Sample-based estimation: scan ledger records in the period
  // A full implementation should aggregate from the analytics table
  let grossFaucet = 0;
  let grossSink = 0;
  const activeUserSet = new Set<string>();
  let lastEvaluatedKey: Record<string, unknown> | undefined;

  // Limit to a sample scan for performance — full implementation should
  // use a materialized view or analytics table aggregation
  const maxPages = 10;
  let pages = 0;

  do {
    const res = await ddbDoc.send(
      new ScanCommand({
        TableName: tableName,
        FilterExpression: "entity = :entity AND createdAt > :since",
        ExpressionAttributeValues: {
          ":entity": "BOOK_USER_FLOW_POINTS_LEDGER",
          ":since": periodStart,
        },
        ProjectionExpression: "userId, direction, amount",
        ExclusiveStartKey: lastEvaluatedKey,
        Limit: 1000,
      })
    );

    for (const item of res.Items ?? []) {
      const amount = typeof item.amount === "number" ? item.amount : 0;
      const userId = item.userId as string;
      if (userId) activeUserSet.add(userId);

      if (item.direction === "earn") {
        grossFaucet += amount;
      } else if (item.direction === "spend") {
        grossSink += amount;
      }
    }

    lastEvaluatedKey = res.LastEvaluatedKey as Record<string, unknown> | undefined;
    pages++;
  } while (lastEvaluatedKey && pages < maxPages);

  return {
    grossFaucet,
    grossSink,
    activeUsers: activeUserSet.size,
  };
}
