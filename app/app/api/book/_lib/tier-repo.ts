import "server-only";

// Implements §3.2 Tier advancement requirements, §3.3 Endowed progress, §3.4 Tier celebration.

import { GetCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddbDoc } from "@/app/app/api/_lib/aws";
import {
  bookUserPk,
  nowIso,
  tierSk,
} from "@/app/app/api/book/_lib/keys";
import type { BookUserTierItem, TierName } from "@/app/app/api/book/_lib/types";
import { awardFlowPoints } from "@/app/app/api/book/_lib/flow-points-repo";

// ── Tier definitions (§3.2) ─────────────────────────────────────────────────

export type TierDefinition = {
  name: TierName;
  displayName: string;
  loopsRequired: number;
  avgScoreRequired: number;
  categoriesRequired: number;
  advancementIP: number;
  identityStatement: string;
};

export const TIER_DEFINITIONS: ReadonlyArray<TierDefinition> = [
  {
    name: "reader",
    displayName: "Reader",
    loopsRequired: 0,
    avgScoreRequired: 0,
    categoriesRequired: 0,
    advancementIP: 0,
    identityStatement: "I'm engaging with ideas",
  },
  {
    name: "analyst",
    displayName: "Analyst",
    loopsRequired: 25,
    avgScoreRequired: 70,
    categoriesRequired: 2,
    advancementIP: 200,
    identityStatement: "I understand what I read",
  },
  {
    name: "synthesizer",
    displayName: "Synthesizer",
    loopsRequired: 100,
    avgScoreRequired: 75,
    categoriesRequired: 5,
    advancementIP: 400,
    identityStatement: "I connect ideas across domains",
  },
  {
    name: "polymath",
    displayName: "Polymath",
    loopsRequired: 300,
    avgScoreRequired: 80,
    categoriesRequired: 10,
    advancementIP: 600,
    identityStatement: "I've built broad and deep knowledge",
  },
  {
    name: "luminary",
    displayName: "Luminary",
    loopsRequired: 750,
    avgScoreRequired: 85,
    categoriesRequired: 15,
    advancementIP: 800,
    identityStatement: "I illuminate understanding for myself and others",
  },
];

const TIER_ORDER: TierName[] = ["reader", "analyst", "synthesizer", "polymath", "luminary"];

function getTierIndex(tier: TierName): number {
  return TIER_ORDER.indexOf(tier);
}

export function getTierDefinition(tier: TierName): TierDefinition {
  return TIER_DEFINITIONS.find((t) => t.name === tier) ?? TIER_DEFINITIONS[0];
}

export function getNextTier(currentTier: TierName): TierDefinition | null {
  const idx = getTierIndex(currentTier);
  if (idx < 0 || idx >= TIER_ORDER.length - 1) return null;
  return getTierDefinition(TIER_ORDER[idx + 1]);
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function readNum(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readStr(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function readStrArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

function isConditionalCheckFailed(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const rec = error as Record<string, unknown>;
  return (
    rec.name === "ConditionalCheckFailedException" ||
    rec.__type === "ConditionalCheckFailedException" ||
    rec.name === "TransactionCanceledException"
  );
}

function parseTierItem(
  item: Record<string, unknown> | undefined,
  userId: string
): BookUserTierItem {
  return {
    userId,
    currentTier: (readStr(item?.currentTier) as TierName) ?? "reader",
    totalLoopsCompleted: Math.max(0, readNum(item?.totalLoopsCompleted) ?? 0),
    avgQuizScoreSum: Math.max(0, readNum(item?.avgQuizScoreSum) ?? 0),
    avgQuizScoreCount: Math.max(0, readNum(item?.avgQuizScoreCount) ?? 0),
    categoriesExplored: readStrArray(item?.categoriesExplored),
    tiersAdvanced: readStrArray(item?.tiersAdvanced) as TierName[],
    tierAdvancedAt: readStr(item?.tierAdvancedAt) ?? null,
    createdAt: readStr(item?.createdAt) ?? "",
    updatedAt: readStr(item?.updatedAt) ?? "",
  };
}

// ── Read / Create ───────────────────────────────────────────────────────────

export async function getOrCreateTier(
  tableName: string,
  userId: string
): Promise<BookUserTierItem> {
  const res = await ddbDoc.send(
    new GetCommand({
      TableName: tableName,
      Key: { PK: bookUserPk(userId), SK: tierSk() },
    })
  );
  if (res.Item) return parseTierItem(res.Item, userId);

  const now = nowIso();
  // §3.3 — Endowed progress: new users start at Reader tier
  const initial: BookUserTierItem = {
    userId,
    currentTier: "reader",
    totalLoopsCompleted: 0,
    avgQuizScoreSum: 0,
    avgQuizScoreCount: 0,
    categoriesExplored: [],
    tiersAdvanced: [],
    tierAdvancedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  try {
    await ddbDoc.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          PK: bookUserPk(userId),
          SK: tierSk(),
          entity: "BOOK_USER_TIER",
          ...initial,
        },
        ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)",
      })
    );
  } catch (error: unknown) {
    if (isConditionalCheckFailed(error)) {
      const retry = await ddbDoc.send(
        new GetCommand({
          TableName: tableName,
          Key: { PK: bookUserPk(userId), SK: tierSk() },
        })
      );
      return parseTierItem(retry.Item as Record<string, unknown>, userId);
    }
    throw error;
  }

  return initial;
}

// ── Tier progress update after loop completion ──────────────────────────────

export type TierUpdateResult = {
  tier: BookUserTierItem;
  advanced: boolean;
  newTier: TierName | null;
  advancementIP: number;
  definition: TierDefinition | null;
};

export async function updateTierOnLoopComplete(
  tableName: string,
  userId: string,
  quizScore: number,
  category: string
): Promise<TierUpdateResult> {
  const tier = await getOrCreateTier(tableName, userId);
  const now = nowIso();

  // Increment loop count and update score running average
  const newLoops = tier.totalLoopsCompleted + 1;
  const newScoreSum = tier.avgQuizScoreSum + quizScore;
  const newScoreCount = tier.avgQuizScoreCount + 1;

  // Add category if not already explored
  const newCategories = tier.categoriesExplored.includes(category)
    ? tier.categoriesExplored
    : [...tier.categoriesExplored, category];

  // Update tier record
  await ddbDoc.send(
    new UpdateCommand({
      TableName: tableName,
      Key: { PK: bookUserPk(userId), SK: tierSk() },
      UpdateExpression:
        "SET totalLoopsCompleted = :loops, avgQuizScoreSum = :scoreSum, avgQuizScoreCount = :scoreCount, categoriesExplored = :cats, updatedAt = :now",
      ExpressionAttributeValues: {
        ":loops": newLoops,
        ":scoreSum": newScoreSum,
        ":scoreCount": newScoreCount,
        ":cats": newCategories,
        ":now": now,
      },
    })
  );

  // Check for tier advancement (§3.2)
  const avgScore = newScoreCount > 0 ? newScoreSum / newScoreCount : 0;
  const catCount = newCategories.length;

  const result: TierUpdateResult = {
    tier: {
      ...tier,
      totalLoopsCompleted: newLoops,
      avgQuizScoreSum: newScoreSum,
      avgQuizScoreCount: newScoreCount,
      categoriesExplored: newCategories,
      updatedAt: now,
    },
    advanced: false,
    newTier: null,
    advancementIP: 0,
    definition: null,
  };

  // Find the highest tier the user qualifies for
  let qualifiedTier: TierName = "reader";
  for (const def of TIER_DEFINITIONS) {
    if (
      newLoops >= def.loopsRequired &&
      avgScore >= def.avgScoreRequired &&
      catCount >= def.categoriesRequired
    ) {
      qualifiedTier = def.name;
    }
  }

  // Check if this is an advancement (new tier > current tier)
  if (getTierIndex(qualifiedTier) > getTierIndex(tier.currentTier)) {
    // The user may have skipped tiers — award all intermediate tiers they haven't earned
    const currentIdx = getTierIndex(tier.currentTier);
    const qualifiedIdx = getTierIndex(qualifiedTier);

    let totalAdvancementIP = 0;
    const newTiersAdvanced: TierName[] = [];

    for (let i = currentIdx + 1; i <= qualifiedIdx; i++) {
      const tierName = TIER_ORDER[i];
      if (!tier.tiersAdvanced.includes(tierName)) {
        const def = getTierDefinition(tierName);
        if (def.advancementIP > 0) {
          const award = await awardFlowPoints(tableName, {
            userId,
            amount: def.advancementIP,
            sourceType: "tier_advance",
            sourceId: tierName,
            metadata: {
              tierName: def.displayName,
              loopsCompleted: newLoops,
              avgScore: Math.round(avgScore),
              categoriesExplored: catCount,
            },
          });
          if (award.awarded) {
            totalAdvancementIP += def.advancementIP;
          }
        }
        newTiersAdvanced.push(tierName);
      }
    }

    // Update tier record with new tier
    const allAdvanced = [...tier.tiersAdvanced, ...newTiersAdvanced];
    await ddbDoc.send(
      new UpdateCommand({
        TableName: tableName,
        Key: { PK: bookUserPk(userId), SK: tierSk() },
        UpdateExpression:
          "SET currentTier = :tier, tiersAdvanced = :advanced, tierAdvancedAt = :now, updatedAt = :now",
        ExpressionAttributeValues: {
          ":tier": qualifiedTier,
          ":advanced": allAdvanced,
          ":now": now,
        },
      })
    );

    result.advanced = true;
    result.newTier = qualifiedTier;
    result.advancementIP = totalAdvancementIP;
    result.definition = getTierDefinition(qualifiedTier);
    result.tier.currentTier = qualifiedTier;
    result.tier.tiersAdvanced = allAdvanced;
    result.tier.tierAdvancedAt = now;
  }

  return result;
}

// ── Tier progress for client display ────────────────────────────────────────

export type TierProgressInfo = {
  currentTier: TierName;
  currentTierDisplay: string;
  loopsCompleted: number;
  avgQuizScore: number;
  categoriesExplored: number;
  nextTier: {
    name: TierName;
    displayName: string;
    loopsRequired: number;
    loopsRemaining: number;
    loopsPercent: number;
    avgScoreRequired: number;
    avgScoreMet: boolean;
    categoriesRequired: number;
    categoriesRemaining: number;
    categoriesPercent: number;
  } | null;
};

export function computeTierProgress(tier: BookUserTierItem): TierProgressInfo {
  const currentDef = getTierDefinition(tier.currentTier);
  const nextDef = getNextTier(tier.currentTier);
  const avgScore =
    tier.avgQuizScoreCount > 0
      ? Math.round(tier.avgQuizScoreSum / tier.avgQuizScoreCount)
      : 0;

  return {
    currentTier: tier.currentTier,
    currentTierDisplay: currentDef.displayName,
    loopsCompleted: tier.totalLoopsCompleted,
    avgQuizScore: avgScore,
    categoriesExplored: tier.categoriesExplored.length,
    nextTier: nextDef
      ? {
          name: nextDef.name,
          displayName: nextDef.displayName,
          loopsRequired: nextDef.loopsRequired,
          loopsRemaining: Math.max(0, nextDef.loopsRequired - tier.totalLoopsCompleted),
          loopsPercent: Math.min(
            100,
            Math.round((tier.totalLoopsCompleted / nextDef.loopsRequired) * 100)
          ),
          avgScoreRequired: nextDef.avgScoreRequired,
          avgScoreMet: avgScore >= nextDef.avgScoreRequired,
          categoriesRequired: nextDef.categoriesRequired,
          categoriesRemaining: Math.max(
            0,
            nextDef.categoriesRequired - tier.categoriesExplored.length
          ),
          categoriesPercent: Math.min(
            100,
            Math.round(
              (tier.categoriesExplored.length / nextDef.categoriesRequired) * 100
            )
          ),
        }
      : null,
  };
}
