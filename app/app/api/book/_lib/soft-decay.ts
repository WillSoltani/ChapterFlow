import "server-only";

// Implements §9.5 — Soft-decay design (behind feature flag, OFF by default).
// Monthly computation: 5% of (balance − 2,000) for balances > 2,000
// with no spend in 60+ days. Capped at 200 IP per month.
// Creates ledger entry with sourceType: 'expiration'.
//
// FEATURE FLAG: Set BOOK_ENABLE_SOFT_DECAY=true to enable.
// Recommended: Do NOT enable until 6+ months after launch,
// and only if monitoring shows average balance consistently > 2,500 IP.

import { ScanCommand, TransactWriteCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ddbDoc } from "@/app/app/api/_lib/aws";
import {
  bookUserPk,
  engagementSk,
  flowPointsLedgerSk,
  nowIso,
} from "@/app/app/api/book/_lib/keys";
import { getServerEnv } from "@/app/app/api/_lib/server-env";

// ── Configuration ───────────────────────────────────────────────────────────

const DECAY_THRESHOLD = 2000;    // Only applies to balance above this
const DECAY_RATE = 0.05;         // 5% of (balance - threshold) per month
const DECAY_CAP = 200;           // Maximum decay per month
const SPEND_EXEMPTION_DAYS = 60; // Exempt if spent in last N days

// ── Feature flag check ──────────────────────────────────────────────────────

async function isSoftDecayEnabled(): Promise<boolean> {
  const flag = await getServerEnv("BOOK_ENABLE_SOFT_DECAY");
  return flag === "true" || flag === "1";
}

// ── Types ───────────────────────────────────────────────────────────────────

export type DecayResult = {
  userId: string;
  previousBalance: number;
  decayAmount: number;
  newBalance: number;
};

export type DecayBatchResult = {
  enabled: boolean;
  processed: number;
  decayed: number;
  exempted: number;
  skipped: number;
  results: DecayResult[];
  computedAt: string;
};

// ── Main decay function (designed for scheduled Lambda) ─────────────────────

/**
 * Process soft-decay for all eligible users.
 * Should be called monthly (e.g., 1st of each month via scheduled Lambda).
 *
 * Eligibility: balance > 2,000 AND no spend transaction in last 60 days.
 * Decay: 5% of (balance - 2,000), capped at 200 IP.
 */
export async function processSoftDecay(
  tableName: string
): Promise<DecayBatchResult> {
  const enabled = await isSoftDecayEnabled();
  if (!enabled) {
    return {
      enabled: false,
      processed: 0,
      decayed: 0,
      exempted: 0,
      skipped: 0,
      results: [],
      computedAt: nowIso(),
    };
  }

  const now = nowIso();
  const sixtyDaysAgo = new Date(
    Date.now() - SPEND_EXEMPTION_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const results: DecayResult[] = [];
  let processed = 0;
  let decayed = 0;
  let exempted = 0;
  let skipped = 0;
  let lastEvaluatedKey: Record<string, unknown> | undefined;

  do {
    // Scan engagement records with balance above threshold
    const res = await ddbDoc.send(
      new ScanCommand({
        TableName: tableName,
        FilterExpression: "entity = :entity AND points > :threshold",
        ExpressionAttributeValues: {
          ":entity": "BOOK_USER_ENGAGEMENT",
          ":threshold": DECAY_THRESHOLD,
        },
        ProjectionExpression: "PK, userId, points",
        ExclusiveStartKey: lastEvaluatedKey,
      })
    );

    for (const item of res.Items ?? []) {
      processed++;
      const userId = item.userId as string;
      const balance = item.points as number;

      if (!userId || typeof balance !== "number") {
        skipped++;
        continue;
      }

      // Check for recent spend activity (exemption per §9.5)
      const hasRecentSpend = await userHasRecentSpend(
        tableName,
        userId,
        sixtyDaysAgo
      );

      if (hasRecentSpend) {
        exempted++;
        continue;
      }

      // Calculate decay
      const decayBase = balance - DECAY_THRESHOLD;
      const rawDecay = Math.floor(decayBase * DECAY_RATE);
      const decayAmount = Math.min(rawDecay, DECAY_CAP);

      if (decayAmount <= 0) {
        skipped++;
        continue;
      }

      // Apply decay atomically
      const transactionId = crypto.randomUUID();
      try {
        await ddbDoc.send(
          new TransactWriteCommand({
            TransactItems: [
              {
                Update: {
                  TableName: tableName,
                  Key: { PK: bookUserPk(userId), SK: engagementSk() },
                  UpdateExpression:
                    "SET updatedAt = :now ADD points :negativeDecay, lifetimeSpent :decay, totalSpendEvents :one",
                  ConditionExpression: "points > :threshold",
                  ExpressionAttributeValues: {
                    ":now": now,
                    ":negativeDecay": -decayAmount,
                    ":decay": decayAmount,
                    ":one": 1,
                    ":threshold": DECAY_THRESHOLD,
                  },
                },
              },
              {
                Put: {
                  TableName: tableName,
                  Item: {
                    PK: bookUserPk(userId),
                    SK: flowPointsLedgerSk(now, transactionId),
                    entity: "BOOK_USER_FLOW_POINTS_LEDGER",
                    userId,
                    transactionId,
                    direction: "spend",
                    amount: decayAmount,
                    sourceType: "expiration",
                    sourceId: `soft-decay:${now.slice(0, 7)}`, // Monthly identifier
                    metadata: {
                      previousBalance: balance,
                      decayRate: DECAY_RATE,
                      threshold: DECAY_THRESHOLD,
                    },
                    createdAt: now,
                    updatedAt: now,
                  },
                  ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)",
                },
              },
            ],
          })
        );

        decayed++;
        results.push({
          userId,
          previousBalance: balance,
          decayAmount,
          newBalance: balance - decayAmount,
        });
      } catch {
        // Conditional check failed — balance changed, skip
        skipped++;
      }
    }

    lastEvaluatedKey = res.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastEvaluatedKey);

  return {
    enabled: true,
    processed,
    decayed,
    exempted,
    skipped,
    results,
    computedAt: now,
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

async function userHasRecentSpend(
  tableName: string,
  userId: string,
  since: string
): Promise<boolean> {
  const res = await ddbDoc.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "PK = :pk AND SK > :start",
      FilterExpression: "entity = :entity AND direction = :spend AND createdAt > :since",
      ExpressionAttributeValues: {
        ":pk": bookUserPk(userId),
        ":start": `FLOWPOINTS#${since}`,
        ":entity": "BOOK_USER_FLOW_POINTS_LEDGER",
        ":spend": "spend",
        ":since": since,
      },
      Limit: 1,
      Select: "COUNT",
    })
  );

  return (res.Count ?? 0) > 0;
}
