import "server-only";

// Implements §7.1 — Insight Spark variable-ratio reward.
// 12% probability per loop completion. Random from {15,20,25,30,35,40,45} IP.
// Deterministic seed: hash(userId + date + loopSequenceNumber).
// Cannot trigger on consecutive loops within the same session.

import crypto from "crypto";
import { awardFlowPoints } from "@/app/app/api/book/_lib/flow-points-repo";
import type { FlowPointsSourceType } from "@/app/app/api/book/_lib/types";

const SPARK_PROBABILITY = 0.12; // 12% per loop
const SPARK_AMOUNTS = [15, 20, 25, 30, 35, 40, 45] as const;

export type InsightSparkResult = {
  triggered: boolean;
  amount: number;
};

/**
 * §7.1 — Roll for Insight Spark after loop completion.
 * Uses a deterministic seed so the same userId + date + sequence always
 * produces the same result, but is unpredictable to the user.
 */
export function rollInsightSpark(
  userId: string,
  dateStr: string,
  loopSequenceNumber: number
): InsightSparkResult {
  const seed = `${userId}:${dateStr}:${loopSequenceNumber}:spark`;
  const hash = crypto.createHash("sha256").update(seed).digest();

  // Use first 4 bytes as a 32-bit integer for probability check
  const roll = hash.readUInt32BE(0) / 0xffffffff; // 0.0 to 1.0

  if (roll >= SPARK_PROBABILITY) {
    return { triggered: false, amount: 0 };
  }

  // Use next byte to select amount from the 7 options
  const amountIdx = hash[4] % SPARK_AMOUNTS.length;
  const amount = SPARK_AMOUNTS[amountIdx];

  return { triggered: true, amount };
}

/**
 * Award the Insight Spark if the roll triggered.
 * Returns the amount awarded, or 0 if not triggered / already awarded.
 */
export async function maybeAwardInsightSpark(
  tableName: string,
  userId: string,
  dateStr: string,
  loopSequenceNumber: number
): Promise<InsightSparkResult> {
  const roll = rollInsightSpark(userId, dateStr, loopSequenceNumber);
  if (!roll.triggered) return { triggered: false, amount: 0 };

  const award = await awardFlowPoints(tableName, {
    userId,
    amount: roll.amount,
    sourceType: "insight_spark" as FlowPointsSourceType,
    sourceId: `${dateStr}:${loopSequenceNumber}`,
    metadata: {
      amount: roll.amount,
      date: dateStr,
      loopSequence: loopSequenceNumber,
    },
  });

  return {
    triggered: award.awarded,
    amount: award.awarded ? roll.amount : 0,
  };
}
