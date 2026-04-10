import "server-only";

// Implements §7.1 — Insight Spark variable-ratio reward.
// 12% probability per loop completion. Random from {15,20,25,30,35,40,45} IP.
// Deterministic seed: hash(userId + date + loopSequenceNumber).
// Cannot trigger on consecutive loops within the same session.

import crypto from "crypto";
import { awardFlowPoints } from "@/app/app/api/book/_lib/flow-points-repo";

const SPARK_PROBABILITY = 0.12; // 12% per loop
const SPARK_AMOUNTS = [15, 20, 25, 30, 35, 40, 45] as const;

export type InsightSparkResult = {
  triggered: boolean;
  amount: number;
};

/**
 * §7.1 — Roll for Insight Spark after loop completion.
 * Seed is anchored to the loop event (bookId + chapter), not the post-update tier
 * counter, so a pipeline retry for the same loop produces the same result and
 * the awardFlowPoints idempotency guard rejects duplicates.
 */
export function rollInsightSpark(
  userId: string,
  dateStr: string,
  loopEventKey: string
): InsightSparkResult {
  const seed = `${userId}:${dateStr}:${loopEventKey}:spark`;
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
 * `loopEventKey` should uniquely identify the loop event being processed
 * (e.g., `${bookId}:${chapterNumber}`). Both the deterministic seed and the
 * grant sourceId derive from it, so a pipeline retry for the same loop
 * produces the same roll and is idempotent at the IP-grant layer.
 */
export async function maybeAwardInsightSpark(
  tableName: string,
  userId: string,
  dateStr: string,
  loopEventKey: string
): Promise<InsightSparkResult> {
  const roll = rollInsightSpark(userId, dateStr, loopEventKey);
  if (!roll.triggered) return { triggered: false, amount: 0 };

  const award = await awardFlowPoints(tableName, {
    userId,
    amount: roll.amount,
    sourceType: "insight_spark",
    sourceId: loopEventKey,
    metadata: {
      amount: roll.amount,
      date: dateStr,
      loopEventKey,
    },
  });

  return {
    triggered: award.awarded,
    amount: award.awarded ? roll.amount : 0,
  };
}
